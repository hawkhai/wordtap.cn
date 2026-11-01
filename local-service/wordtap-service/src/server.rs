use std::{error::Error, net::SocketAddr};

use axum::{
    middleware,
    routing::{delete, get, post},
    Router,
};
use tokio::net::TcpListener;

use crate::{
    api::{gateway_capabilities, gateway_shutdown, gateway_status},
    config::{GATEWAY_NAME, HOST, PORT},
    http_relay::http_exchange,
    origin::origin_gate,
    speech::speech_recipe,
    state::GatewayState,
    translate::baidu_sug_recipe,
    ws_relay::{
        close_socket_session, open_socket_session, receive_socket_session_frames,
        send_socket_session_frame, socket_exchange,
    },
};

pub(crate) async fn run_server() -> Result<(), Box<dyn Error + Send + Sync>> {
    let state = GatewayState::new()?;

    let app = Router::new()
        .route("/v1/status", get(gateway_status))
        .route("/v1/capabilities", get(gateway_capabilities))
        .route("/v1/lifecycle/shutdown", post(gateway_shutdown))
        .route("/v1/http/exchange", post(http_exchange))
        .route("/v1/ws/exchange", post(socket_exchange))
        .route("/v1/ws/sessions", post(open_socket_session))
        .route("/v1/ws/sessions/:id/send", post(send_socket_session_frame))
        .route(
            "/v1/ws/sessions/:id/recv",
            get(receive_socket_session_frames),
        )
        .route("/v1/ws/sessions/:id", delete(close_socket_session))
        .route("/v1/recipes/speech", post(speech_recipe))
        .route("/v1/recipes/baidu-sug", post(baidu_sug_recipe))
        .with_state(state)
        .layer(middleware::from_fn(origin_gate));

    let addr: SocketAddr = format!("{HOST}:{PORT}").parse()?;
    let listener = TcpListener::bind(addr).await?;
    println!("{GATEWAY_NAME} listening at http://{addr}");
    axum::serve(listener, app).await?;
    Ok(())
}
