#![cfg_attr(all(windows, not(debug_assertions)), windows_subsystem = "windows")]

use std::{env, error::Error};

mod api;
mod config;
mod http_relay;
mod installer;
mod installer_auth;
mod origin;
mod relay;
mod server;
mod speech;
mod speech_token;
mod state;
mod translate;
mod wire;
mod ws_relay;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error + Send + Sync>> {
    let _ = rustls::crypto::ring::default_provider().install_default();

    let args: Vec<String> = env::args().skip(1).collect();
    if args.iter().any(|arg| arg == "--version") {
        println!("{}", env!("CARGO_PKG_VERSION"));
        return Ok(());
    }

    if args.iter().any(|arg| arg == "--shutdown") {
        installer::shutdown_gateway_if_running().await?;
        return Ok(());
    }

    if args.iter().any(|arg| arg == "--install-self")
        && installer::install_and_spawn_if_needed().await?
    {
        return Ok(());
    }

    server::run_server().await
}
