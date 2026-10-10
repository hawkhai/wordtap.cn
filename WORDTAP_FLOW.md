# WordTap 运行流程

这份文档说明 WordTap Web 当前代码中的主要运行链路，包括前端 Vue 应用和可选的本地 Gateway 服务。

## 启动流程

1. `src/main.ts` 加载共享样式、桌面样式和移动样式。
2. Vue 挂载 `App.vue`。
3. `App.vue` 根据设备和宽度选择 `DesktopShell` 或 `MobileShell`。
4. 当前壳组件通过 `useWordTap()` 创建共享状态。
5. 应用优先从 IndexedDB 恢复最近保存的阅读文本。
6. 如果没有保存文本，默认示例文本只在首次使用的前几次启动中显示。
7. 初始化浏览器语音、词典元数据、Gateway 心跳和诊断状态。
8. 浏览器支持时注册 `public/sw.js`。

Service Worker 只是轻量缓存层，不代表完整离线应用。

## 阅读文本流程

用户编辑或粘贴文本时：

1. 文本进入应用状态。
2. 应用用 `[A-Za-z]+(?:['-][A-Za-z]+)?` 提取英文单词。
3. 文本历史保存会 debounce。
4. 持久化前会遵守文本数量和长度限制。
5. 下次访问时可以从 IndexedDB 恢复最近文本。

文本身份优先使用 SHA-256。旧环境不可用时，使用确定性的 fallback hash。

## 点击单词流程

用户点击一个单词时：

1. 捕获选中的单词和句子上下文。
2. 立即在 IndexedDB 记录学习次数。
3. 开始翻译查询。
4. 先检查内存缓存和 IndexedDB `translation_cache`。
5. 按当前翻译模式查询具体来源。
6. 单词卡片或移动端弹层显示最佳可用释义。
7. 查询成功后，把释义回写到学习记录。

查词应保持容错。首选来源失败时，仍要继续尝试后续 fallback。

## 翻译模式

`auto`：

1. 本地 ECDICT 静态分片。
2. Gateway Baidu Sug 配方。
3. 内置兜底词典。

`ecdict`：

1. 本地 ECDICT 静态分片。
2. 内置兜底词典。

`baidu_sug`：

1. Gateway Baidu Sug 配方。
2. 本地 ECDICT 静态分片。
3. 内置兜底词典。

所有模式都会先查内存缓存和 IndexedDB 缓存。

## 词典流程

本地 ECDICT 位于 `public/dict`：

1. manifest 把单词或前缀映射到静态分片文件。
2. 查询会尝试原词、小写词和简化形式。
3. 命中的词条会格式化后展示在单词卡片中。
4. 成功结果会写入内存缓存和 IndexedDB 翻译缓存。

当前词典 manifest 包含 765,023 条词条和 10,129 个分片。

## 全文朗读流程

用户开始全文朗读时：

1. 应用检查浏览器语音能力和 Gateway 可用性。
2. 如果已有匹配的 Gateway 音频缓存，可以直接播放。
3. 如果 Gateway 正在运行，前端会按 1,000 字节限制切分文本。
4. 前几个片段会提前预取。
5. Gateway `/v1/recipes/speech` 调用 Edge TTS 生成 MP3。
6. 音频片段按顺序播放，并更新缓存元数据。
7. Gateway 播放不可用时，尝试浏览器全文朗读。

音频缓存 key 包含文本、声音、语速、音量、音调和引擎版本。缓存修复会清理过期或不兼容记录。

## 单词朗读流程

用户播放单词发音时：

1. 优先使用浏览器 `speechSynthesis`。
2. 使用用户选择的英语声音。
3. 把应用中的语速设置映射到浏览器语速。
4. 浏览器发音失败或超时后，尝试 Youdao `dictvoice` 音频。
5. Youdao 声音类型尽量跟随当前选择的英式或美式声音。

单词 fallback 音频不使用全文朗读的 Gateway 音频缓存。

## Gateway 流程

可选 Rust Gateway 默认监听：

```text
127.0.0.1:18765
```

前端常用检查：

1. `GET /v1/status`
2. `GET /v1/capabilities`
3. 需要时检查 speech 和 Baidu Sug 配方。

配方接口：

- `POST /v1/recipes/speech`
- `POST /v1/recipes/baidu-sug`

本地工具接口：

- `POST /v1/http/exchange`
- `POST /v1/ws/exchange`
- `POST /v1/ws/sessions`
- `POST /v1/ws/sessions/:id/send`
- `GET /v1/ws/sessions/:id/recv`
- `DELETE /v1/ws/sessions/:id`

关闭接口：

- `POST /v1/lifecycle/shutdown`

Origin 策略把公开状态、可信网页配方、本地工具交换和安装器关闭分开处理。生产 WordTap 域名可以使用可信配方接口，但不能使用通用本地工具接口。

## IndexedDB 存储

数据库：`wordtap-study-history`

版本：4

对象仓库：

- `words`
- `texts`
- `translation_cache`
- `audio_cache`
- `audio_cache_meta`

限制：

- 文本历史最多 100 条。
- 单条文本最多 120,000 个字符。
- 翻译缓存最多 5,000 条。
- 音频缓存按数量和存储大小限制，并清理陈旧元数据。

## Service Worker 流程

`public/sw.js` 使用缓存名 `wordtap-v2`。

安装时预缓存：

- `./`
- `./manifest.json`
- `./favicon.ico`
- `./favicon-192.png`
- `./favicon-512.png`
- `./apple-touch-icon.png`
- `./logo-mark.png`

请求处理：

- 只处理同源 `GET` 请求。
- HTML 使用 network-first。
- 其他静态资源使用 cache-first，并在未命中时访问网络。
- 只缓存状态码为 `200` 的响应。

这意味着已经请求过的词典分片和静态资源可能离线可用，但应用不会预缓存完整词典或发布下载文件。

## 诊断流程

诊断页检查真实浏览器中最容易出问题的部分：

- 浏览器语音支持和声音列表。
- IndexedDB 可用性和对象仓库状态。
- 翻译缓存读写。
- localStorage 设置。
- 词典 manifest 和分片请求。
- Gateway 状态和能力。
- Baidu Sug 配方。
- Edge TTS 朗读配方。
- Gateway release manifest。
- 安装器和下载地址。
- 浏览器存储估算。
- 音频缓存元数据和修复状态。

诊断应该展示可操作状态，同时不要把可选组件缺失描述成致命错误。

## 失败处理矩阵

| 失败情况 | 预期表现 |
| --- | --- |
| 本地词典分片缺失 | 尝试后续翻译 fallback，并在诊断中暴露失败 |
| Gateway 未运行 | Gateway 专属检查不可用，但本地词典和浏览器语音继续可用 |
| Baidu Sug 不可用 | 根据当前模式回退到 ECDICT 或内置兜底词典 |
| Edge TTS 不可用 | 优先播放已有缓存，否则尝试浏览器全文朗读 |
| 浏览器语音不可用 | 阅读和翻译继续可用，诊断显示语音限制 |
| IndexedDB 不可用 | 当前会话可能还能使用，但持久化和缓存诊断失败 |
| 开发环境缺少安装器 | 构建只提示 warning，发布下载诊断应显示缺口 |
