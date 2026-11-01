use std::{collections::HashMap, error::Error, sync::Arc};

use tokio::sync::Mutex;

use crate::{
    config::GATEWAY_NAME, installer_auth::load_or_create_installer_token, ws_relay::SocketSession,
};

#[derive(Clone)]
pub(crate) struct GatewayState {
    pub(crate) http_client: reqwest::Client,
    pub(crate) socket_sessions: Arc<Mutex<HashMap<String, SocketSession>>>,
    pub(crate) installer_token: Arc<String>,
}

impl GatewayState {
    pub(crate) fn new() -> Result<Self, Box<dyn Error + Send + Sync>> {
        Ok(Self {
            http_client: reqwest::Client::builder()
                .user_agent(format!("{GATEWAY_NAME}/{}", env!("CARGO_PKG_VERSION")))
                .build()?,
            socket_sessions: Arc::new(Mutex::new(HashMap::new())),
            installer_token: Arc::new(load_or_create_installer_token()?),
        })
    }
}
