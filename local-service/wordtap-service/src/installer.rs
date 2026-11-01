use std::{
    env,
    error::Error,
    io,
    path::{Path, PathBuf},
    process::Stdio,
    time::Duration,
};

use serde::Deserialize;
use tokio::{
    fs,
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpStream,
    process::Command,
    time::{sleep, timeout},
};

use crate::{
    config::{APP_DIR_NAME, EXE_NAME, GATEWAY_NAME, HOST, PORT, STARTUP_RUN_NAME},
    installer_auth::read_installer_token,
};

const INSTALLER_HTTP_TIMEOUT: Duration = Duration::from_secs(3);

#[derive(Debug, Deserialize)]
struct RunningServiceInfo {
    version: String,
}

pub(crate) async fn install_and_spawn_if_needed() -> Result<bool, Box<dyn Error + Send + Sync>> {
    let current_exe = env::current_exe()?;
    let target_exe = target_exe_path()?;

    if paths_equal(&current_exe, &target_exe).await {
        if let Some(running) = query_running_service().await {
            show_message(
                "WordTap 全文朗读服务",
                &format!("WordTap 全文朗读服务已在运行，版本为 {}。", running.version),
            );
            return Ok(true);
        }
        return Ok(false);
    }

    if let Some(running) = query_running_service().await {
        match compare_versions(env!("CARGO_PKG_VERSION"), &running.version) {
            std::cmp::Ordering::Greater => {
                shutdown_running_service().await?;
                wait_until_service_stops().await?;
            }
            std::cmp::Ordering::Less => {
                show_message(
                    "WordTap 全文朗读服务",
                    &format!(
                        "已运行的 WordTap 全文朗读服务版本为 {}，高于当前下载版本 {}。\n\n无需安装，现有服务将继续运行。",
                        running.version,
                        env!("CARGO_PKG_VERSION")
                    ),
                );
                return Ok(true);
            }
            std::cmp::Ordering::Equal => {
                show_message(
                    "WordTap 全文朗读服务",
                    &format!(
                        "WordTap 全文朗读服务已在运行，版本为 {}。\n\n无需重复安装。",
                        running.version
                    ),
                );
                return Ok(true);
            }
        }
    } else if is_port_open().await {
        show_message(
            "WordTap 全文朗读服务",
            "检测到全文朗读服务需要使用的本机端口已被占用，但无法读取服务版本。\n\n请先关闭正在运行的相关程序，再重新运行安装文件。",
        );
        return Ok(true);
    }

    if let Some(parent) = target_exe.parent() {
        fs::create_dir_all(parent).await?;
    }

    let enable_startup = ask_startup_enabled();
    install_executable(&current_exe, &target_exe).await?;
    configure_startup(&target_exe, enable_startup).await?;
    Command::new(&target_exe)
        .arg("--serve")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()?;

    println!("{GATEWAY_NAME} installed to {}", target_exe.display());
    println!("Service started at http://{HOST}:{PORT}");
    show_message(
        "WordTap 全文朗读服务",
        &format!(
            "WordTap 全文朗读服务已安装并启动。\n\n安装位置：{}\n开机启动：{}",
            target_exe.display(),
            if enable_startup {
                "已开启"
            } else {
                "未开启"
            }
        ),
    );
    Ok(true)
}

pub(crate) async fn shutdown_gateway_if_running() -> Result<bool, Box<dyn Error + Send + Sync>> {
    if query_running_service().await.is_some() {
        shutdown_running_service().await?;
        wait_until_service_stops().await?;
        println!("{GATEWAY_NAME} stopped.");
        return Ok(true);
    }

    if is_port_open().await {
        return Err("全文朗读服务需要使用的本机端口已被占用，但正在运行的程序没有响应状态检查。".into());
    }

    println!("{GATEWAY_NAME} is not running.");
    Ok(false)
}

async fn install_executable(
    source_exe: &Path,
    target_exe: &Path,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let temp_exe = target_exe.with_extension("tmp");
    let _ = fs::remove_file(&temp_exe).await;
    fs::copy(source_exe, &temp_exe).await?;

    if let Err(first_error) = fs::rename(&temp_exe, target_exe).await {
        let _ = fs::remove_file(target_exe).await;
        if let Err(second_error) = fs::rename(&temp_exe, target_exe).await {
            let _ = fs::remove_file(&temp_exe).await;
            return Err(format!(
                "无法把全文朗读服务安装到目标目录：{first_error}；重试也失败：{second_error}。"
            )
            .into());
        }
    }

    Ok(())
}

async fn is_port_open() -> bool {
    let Ok(Ok(stream)) = timeout(INSTALLER_HTTP_TIMEOUT, TcpStream::connect((HOST, PORT))).await
    else {
        return false;
    };
    drop(stream);
    true
}

async fn query_running_service() -> Option<RunningServiceInfo> {
    let response = http_request("GET", "/v1/status", None, None).await.ok()?;
    let body = response_body(&response)?;
    serde_json::from_slice::<RunningServiceInfo>(body).ok()
}

async fn shutdown_running_service() -> Result<(), Box<dyn Error + Send + Sync>> {
    let token = read_installer_token()?;
    let response = http_request(
        "POST",
        "/v1/lifecycle/shutdown",
        Some(b"{}"),
        Some(("X-WordTap-Installer-Token", token.as_str())),
    )
    .await?;
    let status = response_status(&response).unwrap_or(0);
    if !(200..300).contains(&status) {
        return Err(format!("Running service refused shutdown request with HTTP {status}.").into());
    }
    Ok(())
}

async fn wait_until_service_stops() -> Result<(), Box<dyn Error + Send + Sync>> {
    for _ in 0..40 {
        if !is_port_open().await {
            return Ok(());
        }
        sleep(Duration::from_millis(250)).await;
    }
    Err("Timed out waiting for the running service to stop.".into())
}

async fn http_request(
    method: &str,
    path: &str,
    body: Option<&[u8]>,
    auth_header: Option<(&str, &str)>,
) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
    let body = body.unwrap_or_default();
    let mut stream = timeout(INSTALLER_HTTP_TIMEOUT, TcpStream::connect((HOST, PORT)))
        .await
        .map_err(|_| "连接本机全文朗读服务超时。")??;
    let extra_header = auth_header
        .map(|(name, value)| format!("{name}: {value}\r\n"))
        .unwrap_or_default();
    let request = format!(
        "{method} {path} HTTP/1.1\r\nHost: {HOST}:{PORT}\r\nConnection: close\r\nContent-Type: application/json\r\n{extra_header}Content-Length: {}\r\n\r\n",
        body.len()
    );
    timeout(INSTALLER_HTTP_TIMEOUT, stream.write_all(request.as_bytes()))
        .await
        .map_err(|_| "向本机全文朗读服务发送请求超时。")??;
    if !body.is_empty() {
        timeout(INSTALLER_HTTP_TIMEOUT, stream.write_all(body))
            .await
            .map_err(|_| "向本机全文朗读服务发送请求内容超时。")??;
    }

    let mut response = Vec::new();
    timeout(INSTALLER_HTTP_TIMEOUT, stream.read_to_end(&mut response))
        .await
        .map_err(|_| "读取本机全文朗读服务响应超时。")??;
    Ok(response)
}

fn response_body(response: &[u8]) -> Option<&[u8]> {
    response
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .map(|index| &response[index + 4..])
}

fn response_status(response: &[u8]) -> Option<u16> {
    let line_end = response.windows(2).position(|window| window == b"\r\n")?;
    let status_line = std::str::from_utf8(&response[..line_end]).ok()?;
    status_line.split_whitespace().nth(1)?.parse().ok()
}

async fn paths_equal(a: &Path, b: &Path) -> bool {
    let canonical_a = fs::canonicalize(a)
        .await
        .unwrap_or_else(|_| a.to_path_buf());
    let canonical_b = fs::canonicalize(b)
        .await
        .unwrap_or_else(|_| b.to_path_buf());
    canonical_a.eq(&canonical_b)
}

fn target_exe_path() -> Result<PathBuf, Box<dyn Error + Send + Sync>> {
    let base_dir = env::var_os("APPDATA")
        .map(PathBuf::from)
        .or_else(dirs::data_dir)
        .ok_or("Unable to find a writable application data directory.")?;

    Ok(base_dir.join(APP_DIR_NAME).join(EXE_NAME))
}

fn compare_versions(current: &str, running: &str) -> std::cmp::Ordering {
    let parse = |version: &str| {
        version
            .split('.')
            .map(|part| part.parse::<u64>().unwrap_or(0))
            .collect::<Vec<_>>()
    };
    let current_parts = parse(current);
    let running_parts = parse(running);
    let max_len = current_parts.len().max(running_parts.len());

    for index in 0..max_len {
        let left = current_parts.get(index).copied().unwrap_or(0);
        let right = running_parts.get(index).copied().unwrap_or(0);
        match left.cmp(&right) {
            std::cmp::Ordering::Equal => {}
            ordering => return ordering,
        }
    }

    std::cmp::Ordering::Equal
}

fn ask_startup_enabled() -> bool {
    if let Ok(value) = env::var("WORDTAP_GATEWAY_STARTUP") {
        return !matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "0" | "false" | "no"
        );
    }

    let script = r#"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$form = New-Object System.Windows.Forms.Form
$form.Text = 'WordTap 全文朗读服务'
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.ClientSize = New-Object System.Drawing.Size(420,150)
$label = New-Object System.Windows.Forms.Label
$label.Text = '是否允许 WordTap 全文朗读服务开机自动启动？'
$label.AutoSize = $true
$label.Location = New-Object System.Drawing.Point(18,20)
$checkbox = New-Object System.Windows.Forms.CheckBox
$checkbox.Text = '开机自动启动（推荐）'
$checkbox.Checked = $true
$checkbox.AutoSize = $true
$checkbox.Location = New-Object System.Drawing.Point(20,58)
$ok = New-Object System.Windows.Forms.Button
$ok.Text = '确定'
$ok.DialogResult = [System.Windows.Forms.DialogResult]::OK
$ok.Location = New-Object System.Drawing.Point(240,105)
$cancel = New-Object System.Windows.Forms.Button
$cancel.Text = '取消'
$cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
$cancel.Location = New-Object System.Drawing.Point(325,105)
$form.Controls.AddRange(@($label,$checkbox,$ok,$cancel))
$form.AcceptButton = $ok
$form.CancelButton = $cancel
$result = $form.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK -and $checkbox.Checked) { Write-Output 'true' } else { Write-Output 'false' }
"#;

    run_powershell(script)
        .map(|output| output.trim().eq_ignore_ascii_case("true"))
        .unwrap_or_else(|error| {
            eprintln!("Unable to ask startup preference: {error}");
            false
        })
}

fn show_message(title: &str, message: &str) {
    if env::var_os("WORDTAP_GATEWAY_SILENT").is_some() {
        println!("{title}: {message}");
        return;
    }

    let script = format!(
        "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show(@'\n{}\n'@, @'\n{}\n'@, 'OK', 'Information') | Out-Null",
        message, title
    );
    let _ = run_powershell(&script);
}

fn run_powershell(script: &str) -> io::Result<String> {
    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-STA",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ])
        .stdin(Stdio::null())
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let details = if stderr.is_empty() { stdout } else { stderr };
        return Err(io::Error::other(format!(
            "PowerShell failed with exit code {:?}: {details}",
            output.status.code()
        )));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

async fn configure_startup(
    target_exe: &Path,
    enabled: bool,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let status = if enabled {
        let command = format!("\"{}\" --serve", target_exe.display());
        Command::new("reg")
            .args([
                "add",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                STARTUP_RUN_NAME,
                "/t",
                "REG_SZ",
                "/d",
                &command,
                "/f",
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .await?
    } else {
        Command::new("reg")
            .args([
                "delete",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                STARTUP_RUN_NAME,
                "/f",
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .await?
    };

    if !status.success() && enabled {
        return Err("Unable to configure Windows startup entry.".into());
    }
    Ok(())
}
