use std::time::Duration;

use axum::{
    extract::State,
    http::{header::HeaderName, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use tokio::time::sleep;

use crate::config::{
    GATEWAY_NAME, MAX_EXCHANGE_BODY_BYTES, MAX_RELAY_HEADERS, MAX_SOCKET_FRAMES,
    MAX_SOCKET_FRAME_BYTES,
};
use crate::state::GatewayState;

const INSTALLER_TOKEN_HEADER: HeaderName = HeaderName::from_static("x-wordtap-installer-token");

#[derive(Serialize)]
pub(crate) struct GatewayStatus {
    ok: bool,
    name: &'static str,
    version: &'static str,
}

#[derive(Serialize)]
pub(crate) struct GatewayCapabilities {
    protocols: Vec<&'static str>,
    endpoints: Vec<&'static str>,
    max_headers: usize,
    max_exchange_body_bytes: usize,
    max_socket_frames: usize,
    max_socket_frame_bytes: usize,
}

#[derive(Serialize)]
pub(crate) struct GatewayError {
    pub(crate) error: String,
}

pub(crate) async fn gateway_status() -> Json<GatewayStatus> {
    Json(GatewayStatus {
        ok: true,
        name: GATEWAY_NAME,
        version: env!("CARGO_PKG_VERSION"),
    })
}

pub(crate) async fn gateway_capabilities() -> Json<GatewayCapabilities> {
    Json(GatewayCapabilities {
        protocols: vec!["http", "https", "websocket", "speech"],
        endpoints: vec![
            "GET /v1/status",
            "GET /v1/capabilities",
            "POST /v1/http/exchange",
            "POST /v1/ws/exchange",
            "POST /v1/ws/sessions",
            "POST /v1/ws/sessions/{id}/send",
            "GET /v1/ws/sessions/{id}/recv",
            "DELETE /v1/ws/sessions/{id}",
            "POST /v1/recipes/speech",
            "POST /v1/recipes/baidu-sug",
            "POST /v1/lifecycle/shutdown",
        ],
        max_headers: MAX_RELAY_HEADERS,
        max_exchange_body_bytes: MAX_EXCHANGE_BODY_BYTES,
        max_socket_frames: MAX_SOCKET_FRAMES,
        max_socket_frame_bytes: MAX_SOCKET_FRAME_BYTES,
    })
}

pub(crate) async fn gateway_shutdown(
    State(state): State<GatewayState>,
    headers: HeaderMap,
) -> Response {
    let authorized = headers
        .get(&INSTALLER_TOKEN_HEADER)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|token| token == state.installer_token.as_str());

    if !authorized {
        return (
            StatusCode::FORBIDDEN,
            Json(GatewayError {
                error: "关闭全文朗读服务需要安装程序授权。".to_string(),
            }),
        )
            .into_response();
    }

    tokio::spawn(async {
        sleep(Duration::from_millis(120)).await;
        std::process::exit(0);
    });

    gateway_status().await.into_response()
}
