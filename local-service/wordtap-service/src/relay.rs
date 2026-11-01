use std::{collections::HashMap, error::Error};

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine};

use crate::config::{BASE_URL, MAX_EXCHANGE_BODY_BYTES, MAX_RELAY_HEADERS, MAX_RELAY_HEADER_BYTES};

const BLOCKED_RELAY_HEADERS: &[&str] = &[
    "authorization",
    "connection",
    "content-length",
    "cookie",
    "host",
    "proxy-authenticate",
    "proxy-authorization",
    "sec-websocket-accept",
    "sec-websocket-extensions",
    "sec-websocket-key",
    "sec-websocket-protocol",
    "sec-websocket-version",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
];

pub(crate) fn apply_http_headers(
    mut request: reqwest::RequestBuilder,
    headers: Option<&HashMap<String, String>>,
) -> Result<reqwest::RequestBuilder, Box<dyn Error + Send + Sync>> {
    let Some(headers) = headers else {
        return Ok(request);
    };
    validate_relay_headers(headers)?;

    for (name, value) in headers {
        request = request.header(name, value);
    }
    Ok(request)
}

pub(crate) fn validate_relay_headers(
    headers: &HashMap<String, String>,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    if headers.len() > MAX_RELAY_HEADERS {
        return Err("Too many relay headers.".into());
    }

    let total_bytes = headers
        .iter()
        .map(|(name, value)| name.len() + value.len())
        .sum::<usize>();
    if total_bytes > MAX_RELAY_HEADER_BYTES {
        return Err("Relay headers are too large.".into());
    }

    for name in headers.keys() {
        if BLOCKED_RELAY_HEADERS.contains(&name.trim().to_ascii_lowercase().as_str()) {
            return Err(format!("Relay header is not allowed: {name}").into());
        }
    }

    Ok(())
}

pub(crate) fn validate_relay_target(
    scheme: &str,
    host: &str,
    allowed_schemes: &[&str],
) -> Result<(), Box<dyn Error + Send + Sync>> {
    if !allowed_schemes.contains(&scheme) {
        return Err("Relay URL uses an unsupported scheme.".into());
    }

    let normalized_host = host.trim_matches(['[', ']']).to_ascii_lowercase();
    let allowed_host = BASE_URL
        .split('/')
        .next()
        .unwrap_or(BASE_URL)
        .to_ascii_lowercase();
    if normalized_host != allowed_host {
        return Err(format!("Relay target host is not allowed: {host}").into());
    }

    Ok(())
}

pub(crate) fn ensure_exchange_body_size(size: usize) -> Result<(), Box<dyn Error + Send + Sync>> {
    if size > MAX_EXCHANGE_BODY_BYTES {
        return Err("Exchange body is too large.".into());
    }
    Ok(())
}

pub(crate) fn decode_limited_base64(
    value: &str,
    max_bytes: usize,
) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
    if value.len() > max_bytes * 2 {
        return Err("Base64 payload is too large.".into());
    }
    let decoded = BASE64_STANDARD.decode(value)?;
    if decoded.len() > max_bytes {
        return Err("Decoded payload is too large.".into());
    }
    Ok(decoded)
}
