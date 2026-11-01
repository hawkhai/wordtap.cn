use std::error::Error;

use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use tokio::time::timeout;

use crate::{
    api::GatewayError,
    config::{BAIDU_SUG_TIMEOUT, BAIDU_SUG_URL},
    state::GatewayState,
};

const MAX_WORD_CHARS: usize = 128;

#[derive(Debug, Deserialize)]
pub(crate) struct BaiduSugRequest {
    word: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct BaiduSugResult {
    meaning: String,
}

#[derive(Debug, Deserialize)]
struct BaiduSugPayload {
    data: Option<Vec<BaiduSugItem>>,
}

#[derive(Debug, Deserialize)]
struct BaiduSugItem {
    k: Option<String>,
    v: Option<String>,
}

pub(crate) async fn baidu_sug_recipe(
    State(state): State<GatewayState>,
    Json(payload): Json<BaiduSugRequest>,
) -> Response {
    match query_baidu_sug(&state.http_client, payload).await {
        Ok(result) => Json(result).into_response(),
        Err(error) => (
            StatusCode::BAD_GATEWAY,
            Json(GatewayError {
                error: error.to_string(),
            }),
        )
            .into_response(),
    }
}

async fn query_baidu_sug(
    client: &reqwest::Client,
    payload: BaiduSugRequest,
) -> Result<BaiduSugResult, Box<dyn Error + Send + Sync>> {
    let word = payload.word.trim();
    if word.is_empty() {
        return Err("Word is required.".into());
    }
    if word.chars().count() > MAX_WORD_CHARS {
        return Err("Word is too long.".into());
    }
    if !word
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '\'' || ch == '-' || ch.is_whitespace())
    {
        return Err("Word contains unsupported characters.".into());
    }

    let body = format!("kw={}", form_encode(word));

    let response = timeout(BAIDU_SUG_TIMEOUT, async {
        client
            .post(BAIDU_SUG_URL)
            .header(
                reqwest::header::CONTENT_TYPE,
                "application/x-www-form-urlencoded; charset=UTF-8",
            )
            .body(body)
            .send()
            .await
    })
    .await
    .map_err(|_| "Timed out waiting for Baidu sug.")??;

    if !response.status().is_success() {
        return Err(format!("Baidu sug request failed with HTTP {}.", response.status()).into());
    }

    let payload = response.json::<BaiduSugPayload>().await?;
    Ok(BaiduSugResult {
        meaning: format_baidu_sug(payload),
    })
}

fn form_encode(value: &str) -> String {
    let mut encoded = String::new();
    for byte in value.as_bytes() {
        match *byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(char::from(*byte));
            }
            b' ' => encoded.push('+'),
            _ => encoded.push_str(&format!("%{:02X}", *byte)),
        }
    }
    encoded
}

fn format_baidu_sug(payload: BaiduSugPayload) -> String {
    payload
        .data
        .unwrap_or_default()
        .into_iter()
        .filter_map(|item| {
            let key = item.k.unwrap_or_default().trim().to_string();
            let value = item.v.unwrap_or_default().trim().to_string();
            if key.is_empty() || value.is_empty() {
                None
            } else {
                Some(format!("{key} -> {value}"))
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}
