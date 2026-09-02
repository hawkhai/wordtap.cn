# WordTap Web

WordTap Web 是一个面向中文用户的英文点读阅读工具。用户可以粘贴英文文本，点击生词查看中文释义，播放单词或全文朗读，并在本地保存学习记录。

当前仓库包含 Vue 3 + Vite Web 客户端。Windows 本地 Gateway 是独立发布的可选组件，用来提供更高质量的全文朗读和部分网络翻译能力；它的服务端源码和安装器构建链不在本仓库中。

## 当前功能

- 在英文阅读文本中点击单词，打开释义卡片。
- 自动记录学习过的单词、次数、时间和释义。
- 支持保存和恢复阅读文本。
- 支持本地 ECDICT 词典查询。
- 支持 Gateway Baidu Sug 翻译配方。
- 支持浏览器语音和 Gateway 全文朗读。
- 单词发音优先使用浏览器 `speechSynthesis`，失败后回退到 Youdao 音频。
- 提供“学习”“我的单词”“音标”“诊断”等主要视图。
- 诊断页检查浏览器能力、IndexedDB、词典分片、Gateway、下载文件、音频缓存等状态。
- 轻量 Service Worker 会缓存应用外壳和已请求过的同源静态资源。

## 课程数据状态

当前完整验证覆盖 276 篇新概念英语、192 篇水木英语、40 篇研究生英语、72 篇大学英语、97 套四六级真题和 64 套考研英语真题。人教版英语当前收录 12/17 册、313 篇课文；5 册无可用来源的选修内容不会用占位数据补齐，具体状态见 `public/pep-english/manifest.json`。

## 代码结构

```text
src/
  App.vue                         # 选择桌面壳或移动壳
  main.ts                         # 挂载 Vue，加载全局样式，注册 Service Worker
  style.css                       # 共享基础样式和组件样式
  desktop/
    components/DesktopShell.vue   # 桌面端布局和导航
    styles/desktop.css            # 桌面端响应式规则
  mobile/
    components/MobileShell.vue    # 移动端布局、长按复习操作
    styles/mobile.css             # 移动端响应式规则
  shared/
    composables/useWordTap.ts     # 学习、查词、朗读、缓存、诊断主逻辑
    stores/historyStore.ts        # IndexedDB 持久化
    services/                     # 词典、Gateway、朗读、诊断等服务
public/
  dict/                           # ECDICT 静态词典 manifest 和分片
  downloads/                      # 外部发布包的元数据与校验文件
  */lessons/                      # 随站点发布的课程数据
  sw.js                           # 轻量运行时缓存 Service Worker
tools/                            # 构建、课程生成与验证脚本
```

课程原始文件、OCR 工作目录、安装包和构建产物不会提交到仓库；可复现的站点数据位于 `public/`。

## 本地数据

WordTap 使用 IndexedDB 数据库 `wordtap-study-history`，当前版本为 4。

主要存储：

- `words`：学习过的单词、次数、时间和释义。
- `texts`：保存的阅读文本。
- `translation_cache`：翻译缓存。
- `audio_cache`：Gateway 生成的全文朗读音频。
- `audio_cache_meta`：音频缓存元数据。

限制规则：

- 阅读文本最多保留 100 条。
- 单条文本最多 120,000 个字符。
- 翻译缓存最多 5,000 条。
- 音频缓存同时按数量和大小清理，并带有引擎版本校验。

启动时，应用会优先恢复最近保存的阅读文本。如果没有保存内容，默认示例文本只会在首次使用的前几次启动中显示，之后编辑区会保持为空。

## 查词流程

英文单词识别规则：

```text
[A-Za-z]+(?:['-][A-Za-z]+)?
```

每次查词都会先检查内存缓存和 IndexedDB 翻译缓存，再访问具体来源。

翻译模式：

- `auto`：本地 ECDICT 分片 -> Gateway Baidu Sug -> 内置兜底词典。
- `ecdict`：本地 ECDICT 分片 -> 内置兜底词典。
- `baidu_sug`：Gateway Baidu Sug -> 本地 ECDICT 分片 -> 内置兜底词典。

查询时会尝试原词、小写形式和简化形式。用户点击单词后，学习次数会立即记录；释义查询成功后，再回写到学习记录。

## 朗读流程

全文朗读：

- Gateway 可用时，优先调用 `/v1/recipes/speech` 生成 MP3 音频。
- 前端会按句子和段落切分文本，单个片段限制为 1,000 字节。
- 会预取前几个片段并顺序播放。
- 已缓存的 Gateway 音频可以在 Gateway 未运行时播放。
- Gateway 不可用时，会尝试浏览器全文朗读。

单词朗读：

- 优先使用浏览器 `speechSynthesis` 和用户选择的英语声音。
- 浏览器播放失败或超时后，回退到 Youdao `dictvoice` 音频。

## 本地词典

静态词典位于 `public/dict`，由 ECDICT 转换生成。

当前 manifest 数据：

- 版本：`ecdict-static-shards-v1`
- 词条数：765,023
- 分片数：10,129
- 目标分片大小：100,000 字节
- manifest 中最大分片：`ple`，99,941 字节，837 条
- 生成时间：`2026-06-14T18:37:09.373611+00:00`

Service Worker 不会预缓存全部词典分片。只有已经请求过的分片，才可能在后续离线时从缓存读取。

如需从合法取得的 ECDICT CSV 重新生成词典：

```bash
npm run generate:dict -- --source /path/to/ecdict.csv
```

研究生教材 OCR 使用 Windows 11 OneOCR。请显式传入引擎目录，避免把开发者本机路径写进项目：

```bash
npm run ocr:postgraduate -- --engine /path/to/oneocr/bin
```

也可以通过 `WORDTAP_ONEOCR_DIR` 环境变量设置引擎目录。原始扫描件和 OCR 中间产物位于被忽略的 `tools/graduate/`，不会进入开源提交。

## WordTap Gateway

Gateway 是可选的本地 Rust 服务，默认地址：

```text
http://127.0.0.1:18765
```

主要接口：

- `GET /v1/status`
- `GET /v1/capabilities`
- `POST /v1/recipes/speech`
- `POST /v1/recipes/baidu-sug`
- `POST /v1/http/exchange`
- `POST /v1/ws/exchange`
- `POST /v1/ws/sessions`
- `POST /v1/lifecycle/shutdown`

安全模型：

- 状态接口可以公开读取。
- WordTap 可信域名和本地开发域名可以使用配方接口。
- 公开网页不能使用通用本地工具交换接口。
- 关闭服务接口只允许安装器携带本地 token 调用。

## 在线和离线边界

WordTap 可以轻度离线使用，但不是完整离线学习应用。

可以离线的部分：

- 已缓存的应用外壳。
- 已请求过的同源静态资源。
- 已请求过的词典分片。
- 本地保存的单词、文本、翻译缓存和音频缓存。

仍需要网络或本地服务的部分：

- 新的 Baidu Sug 翻译。
- 新的 Gateway Edge TTS 全文朗读音频。
- 未缓存过的词典分片。
- Windows 安装包下载。

## 开发命令

Web 开发需要 Node.js 20.19 或更高版本。重新生成课程数据还需要 Python 3.10 或更高版本，并安装可选工具依赖：

```bash
python -m pip install -r requirements.txt
```

安装依赖：

```bash
npm ci
```

启动开发服务器：

```bash
npm run dev
```

类型检查：

```bash
npm run typecheck
```

生产构建：

```bash
npm run build
```

完整验证：

```bash
npm run verify
```

仅检查是否误提交本机文件、敏感文件或缺少开源必备声明：

```bash
npm run verify:open-source
```

`npm run build` 会先运行 `tools/check-downloads.mjs`。开发环境缺少安装包时只会打印 warning，不会阻断构建；如果 Gateway 安装包存在，则会校验 SHA-256 和 release manifest。

## 参与项目

提交 Issue 或 Pull Request 前请阅读 [`CONTRIBUTING.md`](CONTRIBUTING.md)。安全漏洞请按 [`SECURITY.md`](SECURITY.md) 私下报告。

## 第三方内容

词典、字体、课程数据和发音音频不随本项目原创代码改用 Apache-2.0。它们继续适用各自的上游许可证或权利条件，详见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。

## 许可证与派生项目署名

本项目原创代码和文档采用 [Apache License 2.0](LICENSE) 发布。分发 fork 或其他派生版本时：

1. 按照 Apache-2.0 保留 `LICENSE`、`NOTICE` 以及适用的第三方声明。
2. 在派生项目 README 的显著位置明确注明原项目地址和项目网站。可以直接使用下面这段文字：

> 本项目基于 [WordTap](https://github.com/hawkhai/wordtap.cn) 开发；原项目网站：[https://wordtap.cn/](https://wordtap.cn/)。

`NOTICE` 的署名保留义务来自 Apache-2.0 第 4(d) 节；README 中的写法是本项目的派生项目署名规范，不修改 Apache-2.0 正文。完整署名信息见 [`NOTICE`](NOTICE)。
