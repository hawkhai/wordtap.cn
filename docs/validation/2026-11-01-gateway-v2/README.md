# Gateway 0.2.2 真实朗读验收

日期：2026-11-01（Asia/Shanghai）。本次验证 v2 握手修复及已完成的全文朗读切句稳定性修复。

## 原因与修复

旧服务 0.2.1 使用 v1 `Sec-MS-GEC` 令牌，上游在 2026 年 10 月改为要求 v2，导致合成接口返回 HTTP 502，内容为上游 `403 Forbidden`。状态接口正常不能证明语音合成可用。

0.2.2 将握手令牌及版本前缀更新为 v2，保留原有端点、声线、语速、音频格式和接口。实现参考 [edge-tts 已合入的协议修复](https://github.com/rany2/edge-tts/pull/492)，采用 [msedge-tts 的 Rust 实现](https://github.com/hs-CN/msedge-tts/blob/0c60fb67e95fb20d484e26f565cca1abdd81def4/src/tts/drm.rs)，保留 MIT 许可，并让安装器一并携带许可文件。

## 自动验证与直接合成

- `cargo test --manifest-path local-service/wordtap-service/Cargo.toml`：7 项通过，包含独立捕获的已接受令牌样本、五分钟时间窗口轮换和版本／令牌格式匹配。
- `cargo build --release --manifest-path local-service/wordtap-service/Cargo.toml`：通过，生成 0.2.2 可执行文件。
- 修改文件的 `rustfmt --check --config skip_children=true` 通过。全包格式检查发现既有 `installer.rs` 第 119 行格式差异，未修改该无关实现。
- 本机实际运行 0.2.2 后，Emma 多语言声线的两句直接合成返回 HTTP 200 / `audio/mpeg`，生成 29,520 字节 MP3。

## 真实页面播放

使用正常语速、1 遍、Emma 多语言声线连续播放 18 句。三个视口分别刷新，重新选择桌面或移动 Shell；不同文本变体避免以旧模拟音频缓存充当真实服务结果。页面的 HTTP 请求和原生 `HTMLAudioElement` 只增加观测监听，未替换响应、音频或播放事件。

每次合成请求均记录状态、字节数及实际解码后的时长、RMS；原生音频记录 `playing`、`timeupdate`、`ended`，确认真实音频非静音且完整播放。首段开始后逐帧检查正文位置、尺寸、页面／正文滚动、准备提示、空白帧和正文节点替换。

| 视口 | 真实 HTTP 请求 | 完整播放 | 音频总时长 | 观察帧 | 位移／提示重现／空白／节点替换 |
| --- | --- | --- | --- | --- | --- |
| 1440×1000 | 2 次 200，359,856 + 48,096 字节 | 2/2 段 | 67.992 秒 | 2,070 | 0 / 0 / 0 / 0 |
| 390×844 | 2 次 200，335,808 + 73,296 字节 | 2/2 段 | 68.184 秒 | 2,076 | 0 / 0 / 0 / 0 |
| 360×800 | 2 次 200，358,992 + 50,112 字节 | 2/2 段 | 68.184 秒 | 2,077 | 0 / 0 / 0 / 0 |

桌面两段衔接约 12ms。首次开始后按钮保持“暂停”，直至全文完成恢复“全文朗读”，没有再次显示“准备中”。无水平溢出，未降级到浏览器语音。详见 [桌面完整数据](desktop-result.json)、[播放截图](desktop-playing.png) 和 [完成截图](desktop-completed.png)。

390px 两段衔接同样约 12ms，无水平溢出或浏览器语音降级。详见 [390px 完整数据](mobile-390-result.json)、[播放截图](mobile-390-playing.png) 和 [完成截图](mobile-390-completed.png)。

360px 两段衔接约 11ms，同样无水平溢出或浏览器语音降级。详见 [360px 完整数据](mobile-360-result.json)、[播放截图](mobile-360-playing.png) 和 [完成截图](mobile-360-completed.png)。三个视口累计完整朗读 54 句、204.36 秒，6,223 帧中上述异常计数均为 0；控制台 error / warning 为空。

## 本机运行与安装交付

通过项目 NSIS 安装器的正常升级流程（`/S /STARTUP=1`）完成本机就地升级，退出码为 0；安装目录的服务版本为 0.2.2，第三方许可文件已安装。原开机启动设置为开启，升级后仍为开启，入口继续指向安装目录。

已在 `tmp/gateway-0.2.2/WordTapGatewaySetup.exe` 生成本地未签名安装包（0.2.2，2,442,467 字节），含第三方许可；SHA256 为 `DAF61FCD3DE3E341CF90C87FD7F47A08F4C2D15A93B1058B69E09CE046CFA06A`，旁附 `.sha256` 文件。官方发布清单未变更，未上传发布。

安装目录和工作区构建的服务 SHA256 均为 `001F961C71D910D688F3D1F58D163E63E01DA37473C587C04A89AB65B8641148`。升级后的再次直接合成使用 Jenny 声线，返回 HTTP 200 / `audio/mpeg`，49,248 字节，状态接口确认 0.2.2。

自动审批曾拒绝直接覆盖安装文件的操作及安装目录启动服务的组合命令，仅返回 `blocked by policy`；正常 NSIS 安装操作获准完成。目前由工作区的同哈希 0.2.2 构建继续在 `127.0.0.1:18765` 提供服务；下次开机使用已升级的安装目录版本。

本轮确认的是上述实际播放条件下未复现闪烁；未作真实触屏、多浏览器或卸载／恢复安装的完整生命周期验收。前次 0.2.1 的失败证据仍保留在 [旧服务复测记录](../2026-11-01-real-fulltext/README.md)。

## 提交前独立构建检查

`cargo test --release --manifest-path local-service/wordtap-service/Cargo.toml` 的 7 项测试通过，`cargo build --release --manifest-path local-service/wordtap-service/Cargo.toml` 及 NSIS 本地安装包编译通过；本次重新生成的包为 2,443,233 字节，未运行安装器或上传发布。上方安装状态与 SHA256 为真实播放验收当时的快照。

`npm test` 的 90 项 Web 测试和 `npm run verify:open-source` 通过；Web 的 Node 构建未引入 Rust 依赖。源码及本地证据检查通过，本轮未重复执行已完成的三视口真实播放。
