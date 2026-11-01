use std::time::Duration;

pub(crate) const GATEWAY_NAME: &str = "WordTap Gateway";
pub(crate) const APP_DIR_NAME: &str = "WordTap";
pub(crate) const EXE_NAME: &str = "wordtap-service.exe";
pub(crate) const HOST: &str = "127.0.0.1";
pub(crate) const PORT: u16 = 18765;
pub(crate) const STARTUP_RUN_NAME: &str = "WordTapGateway";

pub(crate) const TRUSTED_CLIENT_TOKEN: &str = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
pub(crate) const CHROMIUM_FULL_VERSION: &str = "143.0.3650.75";
pub(crate) const SEC_MS_GEC_VERSION: &str = "2-143.0.3650.75";
pub(crate) const BASE_URL: &str = "speech.platform.bing.com/consumer/speech/synthesize/readaloud";
pub(crate) const BAIDU_SUG_URL: &str = "https://fanyi.baidu.com/sug";
pub(crate) const DEFAULT_VOICE: &str = "en-US-EmmaMultilingualNeural";
pub(crate) const OUTPUT_FORMAT: &str = "audio-24khz-48kbitrate-mono-mp3";
pub(crate) const MAX_SERVICE_TEXT_BYTES: usize = 4096;
pub(crate) const MAX_SPEECH_TEXT_BYTES: usize = 64 * 1024;
pub(crate) const MAX_RELAY_HEADERS: usize = 64;
pub(crate) const MAX_RELAY_HEADER_BYTES: usize = 8 * 1024;
pub(crate) const MAX_EXCHANGE_BODY_BYTES: usize = 2 * 1024 * 1024;
pub(crate) const MAX_SOCKET_FRAMES: usize = 32;
pub(crate) const MAX_SOCKET_FRAME_BYTES: usize = 256 * 1024;
pub(crate) const MAX_SOCKET_SESSIONS: usize = 16;
pub(crate) const SOCKET_SESSION_IDLE_TTL: Duration = Duration::from_secs(300);
pub(crate) const EDGE_WS_CONNECT_TIMEOUT: Duration = Duration::from_secs(12);
pub(crate) const EDGE_WS_SEND_TIMEOUT: Duration = Duration::from_secs(8);
pub(crate) const EDGE_WS_RECEIVE_TIMEOUT: Duration = Duration::from_secs(45);
pub(crate) const HTTP_EXCHANGE_TIMEOUT: Duration = Duration::from_secs(30);
pub(crate) const BAIDU_SUG_TIMEOUT: Duration = Duration::from_secs(5);
pub(crate) const WINDOWS_EPOCH_SECONDS: i64 = 11_644_473_600;
pub(crate) const SECONDS_PER_TOKEN_WINDOW: i64 = 300;
pub(crate) const TICKS_PER_SECOND: i128 = 10_000_000;
pub(crate) const DOMAIN_OBFUSCATION_KEY: u8 = 0x37;
pub(crate) const TRUSTED_PUBLIC_DOMAINS: &[&[u8]] = &[
    &[
        0x5f, 0x56, 0x40, 0x5c, 0x5f, 0x56, 0x5e, 0x19, 0x54, 0x58, 0x5a,
    ],
    &[
        0x44, 0x42, 0x59, 0x58, 0x54, 0x52, 0x56, 0x59, 0x19, 0x5b, 0x5e, 0x51, 0x52,
    ],
    &[0x5e, 0x59, 0x51, 0x44, 0x53, 0x5c, 0x19, 0x54, 0x58, 0x5a],
    &[0x40, 0x58, 0x45, 0x53, 0x43, 0x56, 0x47, 0x19, 0x54, 0x59],
];
