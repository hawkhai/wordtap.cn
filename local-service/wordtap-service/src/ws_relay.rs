use std::{
    collections::{HashMap, VecDeque},
    error::Error,
    sync::{Arc, Mutex as StdMutex},
    time::{Duration, Instant},
};

use axum::{
    extract::{Path as AxumPath, State},
    http::{header, HeaderMap, HeaderValue, Request, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::{
    sync::{mpsc, Mutex},
    time::timeout,
};
use tokio_tungstenite::{
    connect_async,
    tungstenite::{client::IntoClientRequest, Message},
};
use uuid::Uuid;

use crate::{
    api::GatewayError,
    config::{
        EDGE_WS_CONNECT_TIMEOUT, EDGE_WS_RECEIVE_TIMEOUT, EDGE_WS_SEND_TIMEOUT, MAX_SOCKET_FRAMES,
        MAX_SOCKET_FRAME_BYTES, MAX_SOCKET_SESSIONS, SOCKET_SESSION_IDLE_TTL,
    },
    relay::{decode_limited_base64, validate_relay_headers, validate_relay_target},
    state::GatewayState,
    wire::parse_text_message,
};

#[derive(Debug, Deserialize)]
pub(crate) struct SocketExchangeRequest {
    url: String,
    headers: Option<HashMap<String, String>>,
    frames: Vec<GatewayFrame>,
    stop: Option<SocketStopCondition>,
    timeout_ms: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct SocketSessionOpenRequest {
    url: String,
    headers: Option<HashMap<String, String>>,
}

#[derive(Clone)]
pub(crate) struct SocketSession {
    pub(crate) outbound: mpsc::UnboundedSender<GatewayFrame>,
    inbound: Arc<Mutex<VecDeque<GatewayFrame>>>,
    last_used_at: Arc<StdMutex<Instant>>,
    terminal_error: Arc<StdMutex<Option<String>>>,
}

#[derive(Serialize)]
pub(crate) struct SocketSessionOpenResult {
    session_id: String,
}

#[derive(Serialize)]
pub(crate) struct SocketSessionReceiveResult {
    frames: Vec<GatewayFrame>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum SocketStopCondition {
    TextHeader { name: String, value: String },
    TextContains { value: String },
    FrameCount { count: usize },
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(tag = "type", rename_all = "lowercase")]
pub(crate) enum GatewayFrame {
    Text { data: String },
    Binary { base64: String },
    Ping { base64: String },
    Pong { base64: String },
    Close,
}

pub(crate) async fn socket_exchange(Json(payload): Json<SocketExchangeRequest>) -> Response {
    match perform_socket_exchange(payload).await {
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

pub(crate) async fn open_socket_session(
    State(state): State<GatewayState>,
    Json(payload): Json<SocketSessionOpenRequest>,
) -> Response {
    match create_socket_session(state, payload).await {
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

pub(crate) async fn send_socket_session_frame(
    State(state): State<GatewayState>,
    AxumPath(id): AxumPath<String>,
    Json(frame): Json<GatewayFrame>,
) -> Response {
    match send_to_socket_session(state, &id, frame).await {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => (
            StatusCode::BAD_GATEWAY,
            Json(GatewayError {
                error: error.to_string(),
            }),
        )
            .into_response(),
    }
}

pub(crate) async fn receive_socket_session_frames(
    State(state): State<GatewayState>,
    AxumPath(id): AxumPath<String>,
) -> Response {
    match receive_from_socket_session(state, &id).await {
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

pub(crate) async fn close_socket_session(
    State(state): State<GatewayState>,
    AxumPath(id): AxumPath<String>,
) -> Response {
    let removed = state.socket_sessions.lock().await.remove(&id);
    if let Some(session) = removed {
        let _ = session.outbound.send(GatewayFrame::Close);
    }
    StatusCode::NO_CONTENT.into_response()
}

async fn perform_socket_exchange(
    payload: SocketExchangeRequest,
) -> Result<SocketSessionReceiveResult, Box<dyn Error + Send + Sync>> {
    if payload.frames.len() > MAX_SOCKET_FRAMES {
        return Err("Too many WebSocket frames for one exchange.".into());
    }

    let request = create_socket_request(&payload.url, payload.headers.as_ref())?;
    let connect_timeout = Duration::from_millis(
        payload
            .timeout_ms
            .unwrap_or(EDGE_WS_CONNECT_TIMEOUT.as_millis() as u64),
    );
    let receive_timeout = Duration::from_millis(
        payload
            .timeout_ms
            .unwrap_or(EDGE_WS_RECEIVE_TIMEOUT.as_millis() as u64),
    );
    let connect_result = timeout(connect_timeout, connect_async(request))
        .await
        .map_err(|_| "Timed out connecting to WebSocket endpoint.")?;
    let (mut socket, _) = connect_result?;
    let mut frames = Vec::new();

    for frame in payload.frames {
        let message = gateway_frame_to_message(frame)?;
        timeout(EDGE_WS_SEND_TIMEOUT, socket.send(message))
            .await
            .map_err(|_| "Timed out sending WebSocket frame.")??;
    }

    while frames.len() < MAX_SOCKET_FRAMES {
        let Some(message) = timeout(receive_timeout, socket.next())
            .await
            .map_err(|_| "Timed out waiting for WebSocket frame.")?
        else {
            break;
        };
        let frame = message_to_gateway_frame(message?)?;
        let should_stop = socket_stop_matches(payload.stop.as_ref(), &frame, frames.len() + 1);
        frames.push(frame);
        if should_stop {
            break;
        }
    }

    let _ = socket.close(None).await;
    Ok(SocketSessionReceiveResult { frames })
}

async fn create_socket_session(
    state: GatewayState,
    payload: SocketSessionOpenRequest,
) -> Result<SocketSessionOpenResult, Box<dyn Error + Send + Sync>> {
    cleanup_socket_sessions(&state).await;

    let mut sessions = state.socket_sessions.lock().await;
    if sessions.len() >= MAX_SOCKET_SESSIONS {
        return Err("Too many active WebSocket sessions.".into());
    }

    let request = create_socket_request(&payload.url, payload.headers.as_ref())?;
    let connect_result = timeout(EDGE_WS_CONNECT_TIMEOUT, connect_async(request))
        .await
        .map_err(|_| "Timed out connecting to WebSocket endpoint.")?;
    let (socket, _) = connect_result?;
    let (mut writer, mut reader) = socket.split();
    let (outbound, mut outbound_rx) = mpsc::unbounded_channel::<GatewayFrame>();
    let inbound = Arc::new(Mutex::new(VecDeque::new()));
    let inbound_reader = Arc::clone(&inbound);
    let last_used_at = Arc::new(StdMutex::new(Instant::now()));
    let terminal_error = Arc::new(StdMutex::new(None));
    let writer_error = Arc::clone(&terminal_error);
    let reader_error = Arc::clone(&terminal_error);
    let session_id = Uuid::new_v4().simple().to_string();
    let writer_sessions = Arc::clone(&state.socket_sessions);
    let writer_session_id = session_id.clone();
    let reader_sessions = Arc::clone(&state.socket_sessions);
    let reader_session_id = session_id.clone();

    tokio::spawn(async move {
        let mut should_remove = false;
        while let Some(frame) = outbound_rx.recv().await {
            let Ok(message) = gateway_frame_to_message(frame) else {
                continue;
            };
            if writer.send(message).await.is_err() {
                set_session_error(&writer_error, "WebSocket session is closed.");
                should_remove = true;
                break;
            }
        }
        let _ = writer.close().await;
        set_session_error(&writer_error, "WebSocket session is closed.");
        if should_remove {
            writer_sessions.lock().await.remove(&writer_session_id);
        }
    });

    tokio::spawn(async move {
        let mut should_remove = true;
        while let Some(message) = reader.next().await {
            let Ok(message) = message else {
                set_session_error(&reader_error, "WebSocket session is closed.");
                break;
            };
            let Ok(frame) = message_to_gateway_frame(message) else {
                continue;
            };
            let mut queue = inbound_reader.lock().await;
            if queue.len() < MAX_SOCKET_FRAMES {
                queue.push_back(frame);
            } else {
                set_session_error(&reader_error, "WebSocket inbound queue overflowed.");
                should_remove = false;
                break;
            }
        }
        if should_remove {
            reader_sessions.lock().await.remove(&reader_session_id);
        }
    });

    sessions.insert(
        session_id.clone(),
        SocketSession {
            outbound,
            inbound,
            last_used_at,
            terminal_error,
        },
    );
    Ok(SocketSessionOpenResult { session_id })
}

async fn send_to_socket_session(
    state: GatewayState,
    id: &str,
    frame: GatewayFrame,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    cleanup_socket_sessions(&state).await;
    let sessions = state.socket_sessions.lock().await;
    let session = sessions.get(id).ok_or("Unknown WebSocket session.")?;
    if let Some(error) = session_terminal_error(session) {
        return Err(error.into());
    }
    mark_session_used(session);
    session
        .outbound
        .send(frame)
        .map_err(|_| "WebSocket session is closed.")?;
    Ok(())
}

async fn receive_from_socket_session(
    state: GatewayState,
    id: &str,
) -> Result<SocketSessionReceiveResult, Box<dyn Error + Send + Sync>> {
    cleanup_socket_sessions(&state).await;
    let session = {
        let sessions = state.socket_sessions.lock().await;
        sessions
            .get(id)
            .cloned()
            .ok_or("Unknown WebSocket session.")?
    };
    if let Some(error) = session_terminal_error(&session) {
        state.socket_sessions.lock().await.remove(id);
        return Err(error.into());
    }
    mark_session_used(&session);
    let mut queue = session.inbound.lock().await;
    let frames = queue.drain(..).collect();
    Ok(SocketSessionReceiveResult { frames })
}

async fn cleanup_socket_sessions(state: &GatewayState) {
    let mut sessions = state.socket_sessions.lock().await;
    sessions.retain(|_, session| !session_is_expired(session));
}

fn session_is_expired(session: &SocketSession) -> bool {
    session
        .last_used_at
        .lock()
        .map(|last_used_at| last_used_at.elapsed() > SOCKET_SESSION_IDLE_TTL)
        .unwrap_or(true)
}

fn mark_session_used(session: &SocketSession) {
    if let Ok(mut last_used_at) = session.last_used_at.lock() {
        *last_used_at = Instant::now();
    }
}

fn session_terminal_error(session: &SocketSession) -> Option<String> {
    session
        .terminal_error
        .lock()
        .ok()
        .and_then(|error| error.clone())
}

fn set_session_error(error: &Arc<StdMutex<Option<String>>>, message: &str) {
    if let Ok(mut current) = error.lock() {
        if current.is_none() {
            *current = Some(message.to_string());
        }
    }
}

fn create_socket_request(
    url: &str,
    headers: Option<&HashMap<String, String>>,
) -> Result<Request<()>, Box<dyn Error + Send + Sync>> {
    let uri = url.parse::<http::Uri>()?;
    validate_relay_target(
        uri.scheme_str()
            .ok_or("WebSocket relay URL must include a scheme.")?,
        uri.host()
            .ok_or("WebSocket relay URL must include a host.")?,
        &["ws", "wss"],
    )?;

    let mut request: Request<()> = url.into_client_request()?;
    apply_socket_headers(request.headers_mut(), headers)?;
    Ok(request)
}

fn apply_socket_headers(
    target: &mut HeaderMap,
    headers: Option<&HashMap<String, String>>,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let Some(headers) = headers else {
        return Ok(());
    };
    validate_relay_headers(headers)?;

    for (name, value) in headers {
        target.insert(
            header::HeaderName::from_bytes(name.as_bytes())?,
            HeaderValue::from_str(value)?,
        );
    }
    Ok(())
}

fn gateway_frame_to_message(frame: GatewayFrame) -> Result<Message, Box<dyn Error + Send + Sync>> {
    Ok(match frame {
        GatewayFrame::Text { data } => {
            if data.len() > MAX_SOCKET_FRAME_BYTES {
                return Err("WebSocket text frame is too large.".into());
            }
            Message::Text(data)
        }
        GatewayFrame::Binary { base64 } => {
            Message::Binary(decode_limited_base64(&base64, MAX_SOCKET_FRAME_BYTES)?)
        }
        GatewayFrame::Ping { base64 } => {
            Message::Ping(decode_limited_base64(&base64, MAX_SOCKET_FRAME_BYTES)?)
        }
        GatewayFrame::Pong { base64 } => {
            Message::Pong(decode_limited_base64(&base64, MAX_SOCKET_FRAME_BYTES)?)
        }
        GatewayFrame::Close => Message::Close(None),
    })
}

fn message_to_gateway_frame(
    message: Message,
) -> Result<GatewayFrame, Box<dyn Error + Send + Sync>> {
    Ok(match message {
        Message::Text(data) => GatewayFrame::Text {
            data: data.to_string(),
        },
        Message::Binary(data) => GatewayFrame::Binary {
            base64: BASE64_STANDARD.encode(data),
        },
        Message::Ping(data) => GatewayFrame::Ping {
            base64: BASE64_STANDARD.encode(data),
        },
        Message::Pong(data) => GatewayFrame::Pong {
            base64: BASE64_STANDARD.encode(data),
        },
        Message::Close(_) => GatewayFrame::Close,
        Message::Frame(_) => return Err("Unexpected raw WebSocket frame.".into()),
    })
}

fn socket_stop_matches(
    stop: Option<&SocketStopCondition>,
    frame: &GatewayFrame,
    frame_count: usize,
) -> bool {
    match stop {
        Some(SocketStopCondition::FrameCount { count }) => frame_count >= *count,
        Some(SocketStopCondition::TextContains { value }) => {
            matches!(frame, GatewayFrame::Text { data } if data.contains(value))
        }
        Some(SocketStopCondition::TextHeader { name, value }) => {
            let GatewayFrame::Text { data } = frame else {
                return false;
            };
            parse_text_message(data)
                .headers
                .get(name)
                .map(String::as_str)
                == Some(value.as_str())
        }
        None => false,
    }
}
