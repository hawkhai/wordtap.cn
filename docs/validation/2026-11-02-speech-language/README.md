# 按声音能力过滤朗读文本：真实服务验收

日期：2026-11-02。正文、句子定位、文章保存和跟打内容保留原文，仅过滤发送给声音的副本。

## 能力与过滤规则

声音能力使用完整 ID 显式配置。`en-US-EmmaMultilingualNeural` 保留中英混读，Jenny、普通 Emma 及其余现有英文声音保留拉丁字母词、数字、常用标点，略过不支持的文字。表情、不可见控制字符不发送给语音引擎；不翻译或生成拼音。

依据：[Microsoft 语音语言支持表](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=text-to-speech) 将 Emma 多语言与 Jenny、普通 Emma 的标准声音分别列出。浏览器当前仅提供英文声音选择，无法确认多语言能力时使用英文规则。声音降级后重新过滤原始输入。

统一过滤先于音频分块、缓存键和网络请求；纯中文等空结果不发起合成或播放，只通过原有状态栏说明可选择 Emma 多语言。语音设置增加共用的 13px 辅助说明，沿用辅助色、自然换行和移动端折叠。

## 自动检查

- 源仓库：朗读 56 项，连同跟打、音标 79 项通过；typecheck、verify:responsive、完整 npm run build（含 prebuild / postbuild）通过，构建内 8 项 Python、111 项 Node 测试通过。Gateway 7 项 Rust 测试及严格 Clippy（all-targets / -D warnings）通过。
- 公共仓库：111 项业务测试、typecheck、verify:responsive、完整 npm run build（含发布内容验证、类型检查、静态生成、短链、考试、主题和站内资源检查）及开源完整性检查通过。
- cf-design 定向源码扫描新增说明组件、桌面／移动 Shell 及样式，0 primary、0 advisory。真实渲染使用宿主浏览器检查，未运行独立的 cf-design 渲染脚本。

## 真实声音样本

本机 Gateway 状态为 0.2.2。使用生产 `GatewaySpeechSession` 顺序调用全部 12 个现有声音。输入为 `Hello中文world。 Good morning（注释）! café costs 3.14 dollars. 日本語 한국어 😀`。11 个英文声音的实际请求统一为 `Hello world. Good morning! café costs 3.14 dollars.`，Emma 多语言保留混排文字、略过表情。

全部请求返回 HTTP 200 / audio/mpeg，原生音频完整播放。每个声音保留对应 `voice-*-result.json` 与真实 MP3；[样本结果汇总](all-voices-summary.json)。这些样本直接测试生产朗读模块，不以页面上恢复的其他文章作为输入。

## 页面连续播放与布局

使用生产 App / Shell 和真实点击全文朗读。临时开发页只增加 fetch、Audio 原生事件与逐帧 DOM 几何观测，不替换响应、不生成假音频、不模拟 playing / ended。每份长文含 18 句英文、中文前言／注释／结尾及紧邻中英文；视口标签使不同运行的分块文本不同，确保实际访问服务。

每次保存真实 MP3、请求文本、状态码、字节数、解码时长、RMS、原生 playing / timeupdate / ended，以及首次发声后的正文位置、尺寸、滚动、等待提示、空白与节点替换计数。文件中的请求顺序按 HTTP 返回观测，播放顺序以 audio 事件为准。

| 视口／声音 | 真实请求／完整播放 | MP3 字节总数 | 音频总时长 | 观察帧 | 位移／提示重现／空白／节点替换 |
| --- | --- | --- | --- | --- | --- |
| 1440×1000 Jenny | 2×200／2 段 | 453600 | 75.600 秒 | 4405 | 0／0／0／0 |
| 1440×1000 Emma 多语言 | 2×200／2 段 | 470016 | 78.336 秒 | 4713 | 0／0／0／0 |
| 390×844 Jenny | 2×200／2 段 | 464256 | 77.376 秒 | 4623 | 0／0／0／0 |
| 390×844 Emma 多语言 | 2×200／2 段 | 485424 | 80.904 秒 | 4797 | 0／0／0／0 |
| 360×800 Jenny | 2×200／2 段 | 464544 | 77.424 秒 | 4626 | 0／0／0／0 |
| 360×800 Emma 多语言 | 2×200／2 段 | 485424 | 80.904 秒 | 4858 | 0／0／0／0 |

六组累计 108 句英文及相应中文内容、12 段实际音频、470.544 秒、28022 帧。所有英文声音请求均无中文，Emma 多语言保留中文；拼接各请求与按声音规则处理的原文严格一致，英文内容没有丢失。全部实际音频非静音、可解码，原生 ended 与时长一致。各组无水平溢出，播放错误为空；未发生浏览器降级。

每组原始请求、实际 MP3 和逐帧计数见 `*-result.json`，总表见 [机器结果汇总](evidence-summary.json)。代表截图：[桌面 Jenny 播放](desktop-jenny-playing.jpg)、[桌面 Emma 播放](desktop-emma-playing.jpg)、[390px Jenny 完成](mobile-390-jenny-completed.jpg)、[390px Emma 播放](mobile-390-emma-playing.jpg)、[360px Jenny 完成](mobile-360-jenny-completed.jpg)、[360px Emma 播放](mobile-360-emma-playing.jpg)。桌面长文声音路径在按钮预留宽度调整前完成；该布局调整后对窄屏四组全部重测，并检查最终桌面按钮占位。

[最终桌面布局](desktop-final-layout.jpg) 实测主按钮宽 104px，页面 scrollWidth / clientWidth 均为 1425px，无横向溢出；按钮键盘焦点可见。

纯中文配 Jenny 的实际页面验收保留正文，无语音 HTTP 请求、无 Audio 播放、无等待说明，停止按钮不可用，状态明确提示可选择 Emma 多语言。见 [空内容记录](empty-chinese.json) 与 [截图](empty-chinese.jpg)。[390px 设置说明](mobile-390-settings.jpg)、[360px 设置说明](mobile-360-settings.jpg) 自然换行并随设置折叠。

## 真实验收中发现并修复的边界

- 输入后立即开始播放：旧的延迟分词可能取消新朗读。现在开始全文前同步完成待分词，回归测试验证快速点击能连续读完。
- 390px 的播放完成帧：主按钮由“暂停”变回“全文朗读”时变宽，工具栏会新增一行。已统一预留最小宽度（当前字号下 104px），暂停与完成实测同宽，最终窄屏复测的计数包含完成帧。[修正前真实记录](before-button-width/mobile-390-jenny-result.json) 保留原来的 1 帧位移，最终验收不以该旧记录代替复测。

## 验收限制

非人工主观听感评审。自动证据确认不支持的文字未发送给英文声音、实际返回可解码且非静音的音频，并由原生播放器完整播放；不将此等同于对每个英文单词的发音质量保证。窄屏为浏览器视口验收，未使用真实手机触屏。本次不修改 Gateway 安装包、官方发布清单、语速、遍数或句间停顿。
