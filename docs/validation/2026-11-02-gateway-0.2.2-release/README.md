# Gateway 0.2.2 未签名正式发布与官网复测

日期：2026-11-02。本次按明确要求保持未签名，`signed=false`、`signatureStatus=NotSigned`；不声明或伪造 Authenticode 签名。

## 发布产物

- 版本：0.2.2，NSIS 安装包文件版本与产品版本均为 0.2.2。
- 文件名：`WordTapGatewaySetup.exe`；大小：2,442,759 字节。
- 安装包 SHA-256：`B2B1EE0A2FE1806B130C15CD1A78BC226F46517EE56E8DDF61511D0933A9EAAB`。
- 安装后服务 SHA-256：`B40604E48CD924306DF746900B5AB6CF903C1CE39CDD0B583CBD92446ADA2D94`。
- 安装包与服务均保持未签名；包含 speech token 实现的 MIT 许可。

使用项目的 `tools/package-gateway.ps1 -SkipSigning` 和 Rust 1.97.1 构建服务及安装包，生成对应 checksum 与 release manifest。本地 exe 仍按仓库约定忽略，不强制提交二进制。

## 官网与 CDN

定向替换官网、CDN 源站各自的安装包、`.sha256` 和 `wordtap-gateway-release.json`，先上传临时文件并逐个回读核验，再切换正式文件，清单最后切换；旧产物有本地及源站回滚副本。见 [源站发布记录](origin-publication.json)。

CDN 固定 URL 原来命中长期旧缓存；由维护者提交这三个 URL 的缓存刷新。本次不改下载地址、不用查询参数绕过验收。刷新后以原始 URL 执行普通 GET，官网与 CDN 共 6 个请求均为 200，安装包、版本、哈希和大小全部一致。详见 [HTTP 发布校验](http-publication-check.json)。

- [官网安装包](https://wordtap.cn/downloads/WordTapGatewaySetup.exe)
- [CDN 安装包](https://cdn.sunocean.life/wordtap/downloads/WordTapGatewaySetup.exe)
- [官网发布清单](https://wordtap.cn/downloads/wordtap-gateway-release.json)
- [CDN 发布清单](https://cdn.sunocean.life/wordtap/downloads/wordtap-gateway-release.json)

## 官网下载安装

通过[官网安装指引](https://wordtap.cn/install/gateway/)中的“重新下载”入口下载实际安装包，下载件版本为 0.2.2，大小及 SHA-256 与本次产物一致，签名状态为 NotSigned。使用下载件执行标准 NSIS 安装，退出码 0；保留原有开机启动设置。

安装后由 `%LOCALAPPDATA%/Programs/WordTap Gateway/wordtap-service.exe --serve` 实际运行，进程路径及哈希核对通过；注册表卸载版本为 0.2.2，状态接口返回 0.2.2，启动项有效，MIT 许可已安装且与源码一致。见 [下载与安装校验](download-install-check.json)、[下载入口截图](official-download-page.jpg)。

使用官网重新下载并安装的服务实际合成 Jenny 英文与 Emma 多语言中英混排，均返回 HTTP 200 / audio/mpeg，分别 47,376 和 41,040 字节；不再出现上游 403。原始输入与响应记录见 [真实合成数据](official-installed-speech.json)，对应 MP3 随记录保留。

## 官网页面与缓存

官网先前仍加载较早前端；本轮仅更新官方页面入口、5 个被引用的前端资源与 `sw.js`，使已提交的混排过滤和稳定按钮修复在官网生效，不上传课程数据。上传后回读哈希全部一致；见 [前端发布记录](web-publication.json)。

发现旧 Service Worker 也可能缓存安装包与旧校验清单。现在 `/downloads/` 请求交给浏览器正常 HTTPS 下载，不再从离线缓存取旧安装包、哈希或版本信息；课程、词典及发音资源的既有缓存规则保留。新增回归覆盖已有旧缓存、在线／离线、子目录与查询参数。

官网页面使用本次实际安装的服务完成连续长文与窄屏中英混排朗读；两组最终状态均为“完成：全文朗读（1 遍）”，控制台错误及警告为空。

| 官网实测 | 只读 DOM 采样 | 位置／滚动变化 | 等待提示重现 | 播放结果 |
| --- | --- | --- | --- | --- |
| 1440×1000，Jenny，20 句英文及中文注释长文 | 180 | 0 | 0 | 完整结束 |
| 390×844，Emma 多语言，4 句中英混排 | 65 | 0 | 0 | 完整结束 |

见 [Jenny 原始记录](official-jenny-result.json)、[播放截图](official-jenny-playing.jpg)、[完成截图](official-jenny-completed.jpg)，以及 [Emma 原始记录](official-emma-mobile-result.json)、[播放截图](official-emma-mobile-playing.jpg)、[完成截图](official-emma-mobile-completed.jpg)。正文保留中文，Jenny 使用线上已部署的英文过滤逻辑，Emma 保留中英混读。

本轮使用只读 DOM 定期采样，不声称逐帧捕获，也不将其作为人工听感评审。此前完整的六组真实音频与逐帧切句验收见 [混排朗读记录](../2026-11-02-speech-language/README.md)。

## 自动检查

- 两仓库完整 Web 构建（含各自 prebuild / postbuild）通过。
- 两仓库缓存回归各 23 项通过；源仓库缓存与朗读合计 79 项通过。
- 公共仓库全部业务测试 112 项通过。
- 发布前后版本、大小、SHA-256 与签名状态核对通过；下载代码不改动语速、遍数或合成参数。

完整卸载再安装、系统重启以及真实手机触屏未作为本次验收项目；已验证当前机器的正常就地升级、启动项、运行路径和真实合成。
