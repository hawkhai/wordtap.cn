use std::error::Error;

use axum::{
    http::{header, HeaderMap, HeaderValue, Request, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use chrono::Utc;
use futures_util::{SinkExt, StreamExt};
use rand::RngCore;
use serde::Deserialize;
use tokio::time::timeout;
use tokio_tungstenite::{
    connect_async,
    tungstenite::{client::IntoClientRequest, Message},
};
use uuid::Uuid;

use crate::{
    api::GatewayError,
    config::{
        BASE_URL, CHROMIUM_FULL_VERSION, DEFAULT_VOICE, EDGE_WS_CONNECT_TIMEOUT,
        EDGE_WS_RECEIVE_TIMEOUT, EDGE_WS_SEND_TIMEOUT, MAX_SERVICE_TEXT_BYTES,
        MAX_SPEECH_TEXT_BYTES, OUTPUT_FORMAT, SECONDS_PER_TOKEN_WINDOW, SEC_MS_GEC_VERSION,
        TICKS_PER_SECOND, TRUSTED_CLIENT_TOKEN, WINDOWS_EPOCH_SECONDS,
    },
    speech_token::generate_sec_ms_gec_v2,
    wire::{parse_binary_message, parse_text_message},
};

#[derive(Debug, Deserialize)]
pub(crate) struct SpeechRecipeRequest {
    text: String,
    voice: Option<String>,
    rate: Option<String>,
    volume: Option<String>,
    pitch: Option<String>,
}

#[derive(Debug)]
struct SpeechVoiceConfig {
    voice: String,
    rate: String,
    volume: String,
    pitch: String,
    xml_lang: String,
}

pub(crate) async fn speech_recipe(Json(payload): Json<SpeechRecipeRequest>) -> Response {
    match synthesize_edge_speech(payload).await {
        Ok(audio) => {
            let mut headers = HeaderMap::new();
            headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("audio/mpeg"));
            headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
            (headers, audio).into_response()
        }
        Err(error) => (
            StatusCode::BAD_GATEWAY,
            Json(GatewayError {
                error: error.to_string(),
            }),
        )
            .into_response(),
    }
}

async fn synthesize_edge_speech(
    payload: SpeechRecipeRequest,
) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
    if payload.text.len() > MAX_SPEECH_TEXT_BYTES {
        return Err("Text is too large to synthesize in one request.".into());
    }

    let cleaned = remove_incompatible_characters(&payload.text)
        .trim()
        .to_string();
    if cleaned.is_empty() {
        return Err("No text to synthesize.".into());
    }

    let config = SpeechVoiceConfig::new(payload)?;
    let escaped_text = escape_xml(&cleaned);
    let text_parts = split_text_by_byte_length(&escaped_text, MAX_SERVICE_TEXT_BYTES)?;
    let mut audio = Vec::new();

    for text_part in text_parts {
        audio.extend(synthesize_part(&text_part, &config).await?);
    }

    Ok(audio)
}

impl SpeechVoiceConfig {
    fn new(payload: SpeechRecipeRequest) -> Result<Self, Box<dyn Error + Send + Sync>> {
        let voice_id = payload.voice.unwrap_or_else(|| DEFAULT_VOICE.to_string());
        let voice = normalize_voice(&voice_id)?;
        let xml_lang = infer_voice_locale(&voice_id);
        let rate = normalize_percent(payload.rate.as_deref().unwrap_or("+0%"))?;
        let volume = normalize_percent(payload.volume.as_deref().unwrap_or("+0%"))?;
        let pitch = normalize_pitch(payload.pitch.as_deref().unwrap_or("+0Hz"))?;

        Ok(Self {
            voice,
            rate,
            volume,
            pitch,
            xml_lang,
        })
    }
}

async fn synthesize_part(
    escaped_text: &str,
    config: &SpeechVoiceConfig,
) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
    let messages = send_edge_speech_socket(
        vec![
            Message::Text(create_speech_config_message()),
            Message::Text(create_ssml_message(&create_ssml(config, escaped_text))),
        ],
        "turn.end",
    )
    .await?;

    edge_speech_audio_from_messages(messages)
}

async fn send_edge_speech_socket(
    outbound_messages: Vec<Message>,
    stop_path: &str,
) -> Result<Vec<Message>, Box<dyn Error + Send + Sync>> {
    let request = create_edge_speech_socket_request()?;
    let connect_result = timeout(EDGE_WS_CONNECT_TIMEOUT, connect_async(request))
        .await
        .map_err(|_| "Timed out connecting to speech upstream.")?;
    let (mut socket, _) = connect_result?;
    let mut inbound_messages = Vec::new();

    for message in outbound_messages {
        timeout(EDGE_WS_SEND_TIMEOUT, socket.send(message))
            .await
            .map_err(|_| "Timed out sending to speech upstream.")??;
    }

    while let Some(message) = timeout(EDGE_WS_RECEIVE_TIMEOUT, socket.next())
        .await
        .map_err(|_| "Timed out waiting for speech upstream.")?
    {
        let message = message?;
        let is_turn_end = match &message {
            Message::Text(text) => {
                let parsed = parse_text_message(text);
                parsed.headers.get("Path").map(String::as_str) == Some(stop_path)
            }
            _ => false,
        };

        inbound_messages.push(message);
        if is_turn_end {
            break;
        }
    }

    let _ = socket.close(None).await;
    Ok(inbound_messages)
}

fn edge_speech_audio_from_messages(
    messages: Vec<Message>,
) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
    let mut audio = Vec::new();
    let mut received_audio = false;

    for message in messages {
        if let Message::Binary(bytes) = message {
            let parsed = parse_binary_message(&bytes)?;
            if parsed.headers.get("Path").map(String::as_str) != Some("audio") {
                continue;
            }

            let content_type = parsed.headers.get("Content-Type").map(String::as_str);
            if content_type.is_none() && parsed.data.is_empty() {
                continue;
            }
            if content_type != Some("audio/mpeg") || parsed.data.is_empty() {
                return Err("Speech recipe returned an unexpected binary message.".into());
            }

            received_audio = true;
            audio.extend(parsed.data);
        }
    }

    if !received_audio {
        return Err("Speech recipe did not return audio.".into());
    }

    Ok(audio)
}

fn create_edge_speech_socket_request() -> Result<Request<()>, Box<dyn Error + Send + Sync>> {
    let url = format!(
        "wss://{BASE_URL}/edge/v1?TrustedClientToken={TRUSTED_CLIENT_TOKEN}&ConnectionId={}&Sec-MS-GEC={}&Sec-MS-GEC-Version={SEC_MS_GEC_VERSION}",
        connection_id(),
        sec_ms_gec()
    );
    let mut request: Request<()> = url.into_client_request()?;
    let headers = request.headers_mut();
    headers.insert("Pragma", HeaderValue::from_static("no-cache"));
    headers.insert("Cache-Control", HeaderValue::from_static("no-cache"));
    headers.insert(
        "Origin",
        HeaderValue::from_static("chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold"),
    );
    headers.insert("Sec-WebSocket-Version", HeaderValue::from_static("13"));
    headers.insert(
        "User-Agent",
        HeaderValue::from_str(&format!(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{}.0.0.0 Safari/537.36 Edg/{}.0.0.0",
            CHROMIUM_FULL_VERSION.split('.').next().unwrap_or("143"),
            CHROMIUM_FULL_VERSION.split('.').next().unwrap_or("143"),
        ))?,
    );
    headers.insert(
        "Accept-Encoding",
        HeaderValue::from_static("gzip, deflate, br, zstd"),
    );
    headers.insert(
        "Accept-Language",
        HeaderValue::from_static("en-US,en;q=0.9"),
    );
    headers.insert(
        "Cookie",
        HeaderValue::from_str(&format!("muid={};", random_hex(16)))?,
    );
    Ok(request)
}

fn connection_id() -> String {
    Uuid::new_v4().simple().to_string()
}

fn random_hex(bytes: usize) -> String {
    let mut buffer = vec![0; bytes];
    rand::thread_rng().fill_bytes(&mut buffer);
    hex::encode_upper(buffer)
}

fn sec_ms_gec() -> String {
    sec_ms_gec_at(Utc::now().timestamp())
}

fn sec_ms_gec_at(unix_seconds: i64) -> String {
    let rounded_seconds = ((unix_seconds + WINDOWS_EPOCH_SECONDS) / SECONDS_PER_TOKEN_WINDOW)
        * SECONDS_PER_TOKEN_WINDOW;
    let ticks = i128::from(rounded_seconds) * TICKS_PER_SECOND;
    generate_sec_ms_gec_v2(ticks as u128)
}

fn create_speech_config_message() -> String {
    format!(
        "X-Timestamp:{}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{{\"context\":{{\"synthesis\":{{\"audio\":{{\"metadataoptions\":{{\"sentenceBoundaryEnabled\":\"true\",\"wordBoundaryEnabled\":\"false\"}},\"outputFormat\":\"{}\"}}}}}}}}\r\n",
        date_to_string(),
        OUTPUT_FORMAT
    )
}

fn create_ssml_message(ssml: &str) -> String {
    format!(
        "X-RequestId:{}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:{}Z\r\nPath:ssml\r\n\r\n{}",
        connection_id(),
        date_to_string(),
        ssml
    )
}

fn create_ssml(config: &SpeechVoiceConfig, escaped_text: &str) -> String {
    let xml_lang = escape_xml_attribute(&config.xml_lang);
    let voice = escape_xml_attribute(&config.voice);
    let pitch = escape_xml_attribute(&config.pitch);
    let rate = escape_xml_attribute(&config.rate);
    let volume = escape_xml_attribute(&config.volume);

    format!(
        "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='{}'><voice name='{}'><prosody pitch='{}' rate='{}' volume='{}'>{}</prosody></voice></speak>",
        xml_lang, voice, pitch, rate, volume, escaped_text
    )
}

fn date_to_string() -> String {
    Utc::now()
        .format("%a %b %d %Y %H:%M:%S GMT+0000 (Coordinated Universal Time)")
        .to_string()
}

fn normalize_voice(voice: &str) -> Result<String, Box<dyn Error + Send + Sync>> {
    if let Some(inner) = voice
        .strip_prefix("Microsoft Server Speech Text to Speech Voice (")
        .and_then(|value| value.strip_suffix(')'))
    {
        let (locale, name) = inner.split_once(',').ok_or("Invalid speech voice.")?;
        let locale = locale.trim();
        let name = name.trim();
        validate_voice_locale(locale)?;
        validate_voice_name(name)?;
        return Ok(format!(
            "Microsoft Server Speech Text to Speech Voice ({locale}, {name})"
        ));
    }

    let mut parts = voice.splitn(3, '-');
    let language = parts.next().ok_or("Invalid speech voice.")?;
    let region = parts.next().ok_or("Invalid speech voice.")?;
    let name = parts.next().ok_or("Invalid speech voice.")?;
    if !name.ends_with("Neural") {
        return Err(format!("Invalid speech voice: {voice}").into());
    }

    let (region, name) = if let Some((region_suffix, name_suffix)) = name.split_once('-') {
        (format!("{region}-{region_suffix}"), name_suffix.to_string())
    } else {
        (region.to_string(), name.to_string())
    };
    let locale = format!("{language}-{region}");
    validate_voice_locale(&locale)?;
    validate_voice_name(&name)?;

    Ok(format!(
        "Microsoft Server Speech Text to Speech Voice ({locale}, {name})"
    ))
}

fn infer_voice_locale(voice: &str) -> String {
    let mut parts = voice.splitn(3, '-');
    match (parts.next(), parts.next()) {
        (Some(language), Some(region)) => format!("{language}-{region}"),
        _ => "en-US".to_string(),
    }
}

fn normalize_percent(value: &str) -> Result<String, Box<dyn Error + Send + Sync>> {
    let trimmed = value.trim();
    let valid = trimmed.len() >= 3
        && (trimmed.starts_with('+') || trimmed.starts_with('-'))
        && trimmed.ends_with('%')
        && trimmed[1..trimmed.len() - 1]
            .chars()
            .all(|ch| ch.is_ascii_digit());
    if valid {
        Ok(trimmed.to_string())
    } else {
        Err(format!("Invalid speech percentage value: {value}").into())
    }
}

fn normalize_pitch(value: &str) -> Result<String, Box<dyn Error + Send + Sync>> {
    let trimmed = value.trim();
    let valid = trimmed.len() >= 4
        && (trimmed.starts_with('+') || trimmed.starts_with('-'))
        && trimmed.ends_with("Hz")
        && trimmed[1..trimmed.len() - 2]
            .chars()
            .all(|ch| ch.is_ascii_digit());
    if valid {
        Ok(trimmed.to_string())
    } else {
        Err(format!("Invalid speech pitch value: {value}").into())
    }
}

fn remove_incompatible_characters(text: &str) -> String {
    text.chars()
        .map(|ch| {
            let code = ch as u32;
            if (0..=8).contains(&code) || (11..=12).contains(&code) || (14..=31).contains(&code) {
                ' '
            } else {
                ch
            }
        })
        .collect()
}

fn escape_xml(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn escape_xml_attribute(text: &str) -> String {
    escape_xml(text)
}

fn validate_voice_locale(value: &str) -> Result<(), Box<dyn Error + Send + Sync>> {
    let valid = value
        .split('-')
        .all(|part| !part.is_empty() && part.chars().all(|ch| ch.is_ascii_alphanumeric()));
    if valid && value.contains('-') {
        Ok(())
    } else {
        Err(format!("Invalid speech voice locale: {value}").into())
    }
}

fn validate_voice_name(value: &str) -> Result<(), Box<dyn Error + Send + Sync>> {
    let valid = !value.is_empty()
        && value.ends_with("Neural")
        && value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '-');
    if valid {
        Ok(())
    } else {
        Err(format!("Invalid speech voice name: {value}").into())
    }
}

fn split_text_by_byte_length(
    text: &str,
    byte_length: usize,
) -> Result<Vec<String>, Box<dyn Error + Send + Sync>> {
    let mut chunks = Vec::new();
    let mut bytes = text.as_bytes();

    while bytes.len() > byte_length {
        let mut split_at = find_last_byte(bytes, b'\n', byte_length)
            .or_else(|| find_last_byte(bytes, b' ', byte_length))
            .unwrap_or_else(|| find_safe_utf8_split_point(&bytes[..byte_length]));

        split_at = adjust_split_point_for_xml_entity(bytes, split_at);
        if split_at == 0 {
            split_at = find_safe_utf8_split_point(&bytes[..byte_length]);
        }
        if split_at == 0 {
            return Err("Unable to find a safe speech text split point.".into());
        }

        let chunk = std::str::from_utf8(&bytes[..split_at])?.trim().to_string();
        if !chunk.is_empty() {
            chunks.push(chunk);
        }
        bytes = &bytes[split_at..];
    }

    let remaining = std::str::from_utf8(bytes)?.trim().to_string();
    if !remaining.is_empty() {
        chunks.push(remaining);
    }
    Ok(chunks)
}

fn find_last_byte(bytes: &[u8], needle: u8, limit: usize) -> Option<usize> {
    bytes[..limit.min(bytes.len())]
        .iter()
        .rposition(|byte| *byte == needle)
}

fn find_safe_utf8_split_point(bytes: &[u8]) -> usize {
    for index in (1..=bytes.len()).rev() {
        if validate_utf8(&bytes[..index]).is_ok() {
            return index;
        }
    }
    0
}

fn validate_utf8(bytes: &[u8]) -> Result<&str, std::str::Utf8Error> {
    std::str::from_utf8(bytes)
}

fn adjust_split_point_for_xml_entity(bytes: &[u8], mut split_at: usize) -> usize {
    while split_at > 0 {
        let Some(ampersand_index) = find_last_byte(bytes, b'&', split_at) else {
            return split_at;
        };
        if bytes[ampersand_index..split_at].contains(&b';') {
            return split_at;
        }
        split_at = ampersand_index;
    }
    split_at
}

#[cfg(test)]
mod token_tests {
    use super::*;

    #[test]
    fn handshake_selects_v2_and_uses_the_matching_token_shape() {
        let request = create_edge_speech_socket_request().unwrap();
        let query = request.uri().query().unwrap();
        assert!(query.contains("Sec-MS-GEC-Version=2-"));
        let token = query
            .split("Sec-MS-GEC=")
            .nth(1)
            .unwrap()
            .split('&')
            .next()
            .unwrap();
        assert_eq!(token.len(), 81);
        assert_eq!(&token[16..17], "-");
        assert!(token
            .replace('-', "")
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit()));
    }

    #[test]
    fn token_uses_five_minute_windows_and_rotates_at_the_boundary() {
        let start = chrono::DateTime::parse_from_rfc3339("2026-10-13T10:40:00Z")
            .unwrap()
            .timestamp();
        assert_eq!(sec_ms_gec_at(start), sec_ms_gec_at(start + 299));
        assert_ne!(sec_ms_gec_at(start), sec_ms_gec_at(start + 300));
    }
}
