# WordTap Gateway

Local gateway for WordTap.cn. It gives the static web app a small, explicit localhost capability layer for protocol work that browsers cannot do directly, especially custom request headers, HTTP/HTTPS exchanges, WebSocket exchanges, long-lived WebSocket sessions, and the WordTap speech recipe.

Version 0.2.2 updates the speech handshake to the v2 `Sec-MS-GEC` token required by the upstream service. It retains the existing endpoint, voice, rate and audio format. Version 0.2.1's v1 token is rejected with HTTP 403 even when the gateway status endpoint is healthy.

The token implementation is adapted from [msedge-tts](https://github.com/hs-CN/msedge-tts/blob/0c60fb67e95fb20d484e26f565cca1abdd81def4/src/tts/drm.rs), based on the [edge-tts v2 protocol update](https://github.com/rany2/edge-tts/pull/492). Its [MIT license](licenses/msedge-tts-MIT.txt) is preserved. Tests include an independently captured accepted token, five-minute rotation boundaries and the handshake's version/token agreement. Run `cargo test` before building a release.

## Endpoints

System:

- `GET /v1/status`
- `GET /v1/capabilities`
- `POST /v1/lifecycle/shutdown`

HTTP/HTTPS relay:

- `POST /v1/http/exchange`

WebSocket relay:

- `POST /v1/ws/exchange`
- `POST /v1/ws/sessions`
- `POST /v1/ws/sessions/{id}/send`
- `GET /v1/ws/sessions/{id}/recv`
- `DELETE /v1/ws/sessions/{id}`

Recipes:

- `POST /v1/recipes/speech`

There are no legacy aliases. `/health`, `/tts`, `/edge-readaloud`, and `/shutdown` are intentionally not part of the public API.

## Origin Scopes

Browser requests are checked per endpoint scope:

- `PublicStatus`: no-origin callers, `localhost`, `127.0.0.1`, `::1`, and trusted public site origins.
- `TrustedWeb`: no-origin callers, `localhost`, `127.0.0.1`, `::1`, and trusted public site origins.
- `LocalTool`: no-origin callers, `localhost`, `127.0.0.1`, and `::1` only.
- `InstallerOnly`: no-origin callers with `X-WordTap-Installer-Token` only.

Endpoint mapping:

- `PublicStatus`: `/v1/status`, `/v1/capabilities`
- `TrustedWeb`: `/v1/recipes/speech`
- `LocalTool`: `/v1/http/exchange`, `/v1/ws/exchange`, `/v1/ws/sessions*`
- `InstallerOnly`: `/v1/lifecycle/shutdown`

Trusted public site origins are `hawkhai.com`, `sunocean.life`, `infsdk.com`, `wordtap.cn`, and their subdomains. In the release binary, these domains are stored as XOR-obfuscated byte arrays to avoid plain strings in basic reverse-engineering views.

The HTTP and WebSocket relay endpoints are further restricted to the Edge Speech public host used by the current product. They reject private/loopback target hosts by construction because arbitrary relay targets are not part of the supported public surface.

## Protocol Scope

Supported now:

- HTTP
- HTTPS
- WebSocket over `ws`
- WebSocket over `wss`
- Speech recipe built on the WebSocket relay internals

Not supported now:

- FTP
- SFTP
- raw TCP
- UDP

FTP and SFTP are intentionally outside this gateway for now. They are transfer protocols with separate connection, credential, and filesystem semantics, not header simulation problems. If WordTap ever needs them, they should become a separate transfer subsystem with its own permission model.

## HTTP Exchange

Request:

```json
{
  "method": "POST",
  "url": "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/...",
  "headers": {
    "User-Agent": "WordTap Gateway"
  },
  "body": {
    "type": "json",
    "value": { "hello": "world" }
  },
  "timeoutMs": 30000
}
```

Response:

```json
{
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "body": {
    "type": "base64",
    "base64": "..."
  }
}
```

## WebSocket Exchange

Short exchange:

```json
{
  "url": "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/...",
  "headers": {
    "Origin": "chrome-extension://example"
  },
  "frames": [
    { "type": "text", "data": "hello" }
  ],
  "stop": {
    "kind": "textHeader",
    "name": "Path",
    "value": "turn.end"
  },
  "timeoutMs": 45000
}
```

Long session flow:

1. `POST /v1/ws/sessions`
2. `POST /v1/ws/sessions/{id}/send`
3. `GET /v1/ws/sessions/{id}/recv`
4. `DELETE /v1/ws/sessions/{id}`

Frames:

```json
{ "type": "text", "data": "hello" }
{ "type": "binary", "base64": "..." }
{ "type": "ping", "base64": "" }
{ "type": "pong", "base64": "" }
{ "type": "close" }
```

## Limits

- Max headers: 64
- Max total header bytes: 8192
- Max HTTP exchange body: 2 MiB
- Max WebSocket frames per exchange: 32
- Max WebSocket frame: 256 KiB
- Max active WebSocket sessions: 16

## Runtime Model

WordTap Gateway has two runtime roles:

- **Gateway mode**: the executable running with `--serve` in the background.
- **Release installer mode**: the NSIS installer installs the executable, configures startup, starts the gateway, and owns uninstall.
- **Legacy self-install mode**: `wordtap-service.exe --install-self` keeps the previous self-copy behavior for internal migration only.

On Windows, the release installer installs the gateway to:

```text
%LOCALAPPDATA%\Programs\WordTap Gateway\wordtap-service.exe
```

The installer offers a startup checkbox and writes the startup command to `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` when selected. Uninstall stops the running gateway with `wordtap-service.exe --shutdown`, removes the startup entry, and removes the installer token from `%APPDATA%\WordTap` if the directory is otherwise empty.

Useful command-line modes:

```powershell
wordtap-service.exe --serve
wordtap-service.exe --shutdown
wordtap-service.exe --version
wordtap-service.exe --install-self
```

## Build and validate

From the repository root, with a Rust toolchain installed:

```bash
cargo test --manifest-path local-service/wordtap-service/Cargo.toml
cargo clippy --manifest-path local-service/wordtap-service/Cargo.toml --all-targets -- -D warnings
cargo build --release --manifest-path local-service/wordtap-service/Cargo.toml
```

On Windows, use the MSVC Rust toolchain and Windows SDK. If Cargo is not on PATH:

```powershell
& "$env:USERPROFILE\.cargo\bin\cargo.exe" test --manifest-path local-service/wordtap-service/Cargo.toml
& "$env:USERPROFILE\.cargo\bin\cargo.exe" build --release --manifest-path local-service/wordtap-service/Cargo.toml
```

Web development and its Node verification remain independent of this optional service.

## Local Windows installer

Install NSIS 3, build the release executable first, then run from the repository root:

```powershell
$gatewayOutput = Join-Path (Get-Location) "tmp\gateway-0.2.2"
New-Item -ItemType Directory -Force -Path $gatewayOutput | Out-Null
$gatewayNsis = Join-Path ${env:ProgramFiles(x86)} "NSIS\makensis.exe"
& $gatewayNsis /INPUTCHARSET UTF8 /DMyAppVersion=0.2.2 /DMyAppVersionQuad=0.2.2.0 "/DOutputDir=$gatewayOutput" installer\wordtap-gateway.nsi
```

The installer includes the speech token implementation's MIT notice. This command creates an unsigned local artifact; building it does not publish files or update the public download manifest. Official Gateway 0.2.2 is intentionally distributed unsigned: verify its version, size and SHA-256 against the official HTTPS release manifest. See the [0.2.2 publication and installation verification](../../docs/validation/2026-11-02-gateway-0.2.2-release/README.md).
