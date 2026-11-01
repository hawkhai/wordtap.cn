use std::{collections::HashMap, error::Error, time::Duration};

use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tokio::time::timeout;

use crate::{
    api::GatewayError,
    config::{HTTP_EXCHANGE_TIMEOUT, MAX_EXCHANGE_BODY_BYTES},
    relay::{
        apply_http_headers, decode_limited_base64, ensure_exchange_body_size, validate_relay_target,
    },
    state::GatewayState,
};

#[derive(Debug, Deserialize)]
pub(crate) struct HttpExchangeRequest {
    method: String,
    url: String,
    headers: Option<HashMap<String, String>>,
    body: Option<ExchangeBody>,
    timeout_ms: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum ExchangeBody {
    Text { data: String },
    Base64 { base64: String },
    Json { value: serde_json::Value },
}

#[derive(Serialize)]
struct HttpExchangeResult {
    status: u16,
    headers: HashMap<String, String>,
    body: ExchangeBodyResult,
}

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum ExchangeBodyResult {
    Base64 { base64: String },
}

pub(crate) async fn http_exchange(
    State(state): State<GatewayState>,
    Json(payload): Json<HttpExchangeRequest>,
) -> Response {
    match perform_http_exchange(&state.http_client, payload).await {
        Ok(response) => Json(response).into_response(),
        Err(error) => (
            StatusCode::BAD_GATEWAY,
            Json(GatewayError {
                error: error.to_string(),
            }),
        )
            .into_response(),
    }
}

async fn perform_http_exchange(
    client: &reqwest::Client,
    payload: HttpExchangeRequest,
) -> Result<HttpExchangeResult, Box<dyn Error + Send + Sync>> {
    let url = payload.url.parse::<reqwest::Url>()?;
    validate_relay_target(
        url.scheme(),
        url.host_str().ok_or("Relay URL must include a host.")?,
        &["http", "https"],
    )?;

    let method = payload.method.parse::<reqwest::Method>()?;
    let timeout_ms = payload
        .timeout_ms
        .unwrap_or(HTTP_EXCHANGE_TIMEOUT.as_millis() as u64)
        .min(HTTP_EXCHANGE_TIMEOUT.as_millis() as u64);

    timeout(Duration::from_millis(timeout_ms), async {
        let mut request = client.request(method, url);
        request = apply_http_headers(request, payload.headers.as_ref())?;
        if let Some(body) = payload.body {
            request = match body {
                ExchangeBody::Text { data } => {
                    ensure_exchange_body_size(data.len())?;
                    request.body(data)
                }
                ExchangeBody::Base64 { base64 } => {
                    let bytes = decode_limited_base64(&base64, MAX_EXCHANGE_BODY_BYTES)?;
                    request.body(bytes)
                }
                ExchangeBody::Json { value } => {
                    let bytes = serde_json::to_vec(&value)?;
                    ensure_exchange_body_size(bytes.len())?;
                    request
                        .header(reqwest::header::CONTENT_TYPE, "application/json")
                        .body(bytes)
                }
            };
        }

        let response = request.send().await?;
        let status = response.status().as_u16();
        let headers = response_headers_to_map(response.headers());
        let bytes = read_limited_response_body(response).await?;

        Ok(HttpExchangeResult {
            status,
            headers,
            body: ExchangeBodyResult::Base64 {
                base64: BASE64_STANDARD.encode(bytes),
            },
        })
    })
    .await
    .map_err(|_| "Timed out waiting for HTTP exchange.")?
}

fn response_headers_to_map(headers: &reqwest::header::HeaderMap) -> HashMap<String, String> {
    headers
        .iter()
        .filter_map(|(name, value)| {
            value
                .to_str()
                .ok()
                .map(|value| (name.to_string(), value.to_string()))
        })
        .collect()
}

async fn read_limited_response_body(
    response: reqwest::Response,
) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
    if response
        .content_length()
        .is_some_and(|length| length > MAX_EXCHANGE_BODY_BYTES as u64)
    {
        return Err("Exchange body is too large.".into());
    }

    let mut bytes = Vec::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        ensure_exchange_body_size(bytes.len() + chunk.len())?;
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}
