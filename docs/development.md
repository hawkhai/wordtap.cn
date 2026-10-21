# WordTap 开发与维护指南

[返回项目介绍](../README.md) · [学习数据与使用边界](../README.md#学习数据与使用边界)

## 环境与验证命令

Node.js 20.19+、npm 与 Git 即可开发和验证本项目；此仓库不含来源重建、历史审核、Gateway 服务端和安装器构建链。

```bash
npm ci
npm run dev
npm run typecheck
npm test
npm run verify:published
npm run verify:responsive
npm run verify:open-source
npm run build
npm run verify
```

按需运行；`npm run verify` 自带一次完整构建，无须先重复执行 `npm run build`。构建会生成课程、考试和安装指南静态页，并检查短码、主题、导航与资源。

独立浏览器验收使用 `npm run verify:browser`，需另行提供 Playwright 与 Chromium；配置项为 `WORDTAP_PLAYWRIGHT_MODULE`、`WORDTAP_CHROMIUM_EXECUTABLE`、`WORDTAP_TEST_URL`、`WORDTAP_TEST_OUTPUT`，输出默认在忽略的 `tmp/web-sync/`。普通构建及 CI 不下载浏览器。

官方下载使用官方 HTTPS 地址；非官方部署保留原有跨域下载适配，缺少可选发布元数据时诊断显示无法确认。Gateway [安装说明](https://wordtap.cn/install/gateway/)独立提供。

## 依赖安全状态

2026-10-21 复核：[依赖安全修复提交 `663e9192`](https://github.com/hawkhai/wordtap.cn/commit/663e9192cce1a7825dc8d7c2724e38e049a48a32)已 push 到 `main`，原有 2 项 npm 依赖告警已修复。完整 `npm audit` 和 `npm audit --omit=dev` 均为 0 项告警；这是当日审计快照，后续以重新运行的结果为准。

根目录声明的最低版本为 Vue `^3.5.42`、Vite `^7.3.7`；当前锁文件的相关版本如下：

| 依赖 | 锁定版本 |
| --- | --- |
| Vue 及配套运行时、编译器 | 3.5.42 |
| Vite | 7.3.7 |
| esbuild | 0.28.2 |
| PostCSS | 8.5.26 |
| nanoid | 3.3.18 |
| source-map-js | 1.2.2 |

依赖修复采用兼容升级，仅调整根目录 `package.json` 与锁文件，没有修改应用逻辑或学习数据。复核命令：

```bash
npm ci
npm audit
npm audit --omit=dev
npm ls vue vite esbuild postcss nanoid source-map-js
npm run verify
```

后续升级先审阅依赖声明与锁文件差异，再运行完整验证。当前 CI 执行 `npm ci` 时会输出审计摘要，但尚未配置独立的 `npm audit` 阻断步骤。

## GitHub CI 与已验收基线

[Verify 工作流](../.github/workflows/verify.yml)在推送到 `main` 或提交 PR 时运行，使用 `ubuntu-latest` 与 Node.js 20.19.0，执行 `npm ci`、完整 `npm run verify`，最后用 `git diff --exit-code` 检查生成文件与受跟踪内容。任务名为 `verify`，权限为 `contents: read`；此工作流不部署站点或交付 Gateway 安装器。

依赖修复提交 `663e9192` 的 [CI 已成功](https://github.com/hawkhai/wordtap.cn/actions/runs/39593944966)，包含完整构建、85 项回归测试、发布数据、静态页面、仓库与响应式检查，以及生成文件差异检查。后续提交的实时状态见 [Actions](https://github.com/hawkhai/wordtap.cn/actions)，不要把这条基线记录当成所有后续提交均已通过。

同一依赖基线的本地验证使用 Node.js 20.19.0。干净副本的 `npm run verify:browser` 已通过，覆盖备份迁移、查词、跟打、词汇、考试、深层链接、HMR 与 Service Worker 在线／离线缓存；生产页面在 1440、390、360px 下检查通过，无页面错误或横向溢出。保留 schemaVersion 4 的五类学习备份。朗读入口已检查，未人工听音；Gateway 安装器不在本仓库的构建验证范围内。

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
    utils/                        # 词典、Gateway、朗读、资源地址等工具
public/
  dict/                           # ECDICT 静态词典 manifest 和分片
  fonts/                          # 阅读与音标字体及许可证
  */lessons/                      # 随站点发布的课程数据
  sw.js                           # 轻量运行时缓存 Service Worker
content/release/                  # 当前发布哈希、来源版本及已知问题
tools/                            # 页面生成、发布检查与业务测试
```

课程原始文件、OCR 工作目录、安装包和构建产物不会提交到仓库；可复现的站点数据位于 `public/`。

## 本地数据

WordTap 使用 IndexedDB 数据库 `wordtap-study-history`，当前版本为 6。

主要存储：

- `words`：学习过的单词、次数、时间和释义。
- `texts`：保存的阅读文本。
- `translation_cache`：翻译缓存。
- `audio_cache`：Gateway 生成的全文朗读音频。
- `audio_cache_meta`：音频缓存元数据。
- `exam_progress`、`exam_word_encounters`：考试进度与考试生词。
- `article_typing_progress`：文章跟打草稿、选区及完成进度。

考试学习页的“导出学习数据”会备份单词、保存的文章、考试进度、考试生词和跟打进度；导入时会与本机记录合并。翻译和音频缓存可重新生成，不包含在备份中。

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

## 界面风格与后续迭代

本项目沿用 cf-design / Arco Design 的阅读优先风格，技能来源、设计变量、响应式宽度和交互约定见 [STYLE_GUIDE.md](../STYLE_GUIDE.md)，同步说明见 [CF_DESIGN_NOTES.md](../CF_DESIGN_NOTES.md)。Vue 和静态生成网页共享主题变量；功能迭代应同时检查这两条渲染路径。`npm run build` 检查全部生成页面的风格；`npm test` 包含主题回归测试。

## 发布范围

本仓库包含已发布的 Web 学习功能；Gateway 与安装器独立交付，不包含原始内容重建和历史审核工具。发布与验收记录见 [Web 发布记录](../OPEN_SOURCE_ALIGNMENT.md)。

原七套课程共 1,054 份，另有 1,181 篇词汇文章。词汇按每篇最多 100 词组合，最后不足 100 词的独立成篇，保留所有原始释义、音标和例句；运行 JSON 共 1,205 个。词汇不再生成静态目录和单元内容页、也不收录到 sitemap，`/english-vocabulary/` 仅保留进入学习工具的跳转入口。旧分享链接定位到包含原单元的新文章，已保存的旧 20 词文章及跟打草稿兼容恢复。120 篇文章仍待来源确认，16 处词汇源数据问题原样保留；当前发布检查不代表历史审核完成。对应标识、来源与哈希见 [发布说明](../content/release/README.md)。

修改课程直接更新发布 JSON、manifest 和索引，按 [课程接入协议](../COURSE_INTEGRATION_PROTOCOL.md) 检查和更新发布哈希，无需搭建审核系统。

完整学习备份使用 schemaVersion 4，兼容旧单词数组及版本 2/3 对象，包含单词、文章、考试进度、考试生词和跟打进度，缓存不进入备份。数据库版本 6 采用增量升级；回退前端也必须兼容版本 6，不能降级或清库。

## 课程与词库

| 学习材料 | 当前收录 | 入口 |
| --- | --- | --- |
| 新概念英语 | 276 篇 | [新概念英语点读](https://wordtap.cn/nce/) |
| 水木英语 | 192 篇 | [水木英语阅读](https://wordtap.cn/shuimu/) |
| 研究生英语 | 40 篇 | [研究生英语阅读](https://wordtap.cn/postgraduate/) |
| 大学英语 | 72 篇 | [大学英语阅读](https://wordtap.cn/college-english/) |
| 人教版英语 | 12/17 册、313 篇 | [人教版英语点读](https://wordtap.cn/pep-english/) |
| 英语四六级真题 | 97 套 | [CET-4 / CET-6 阅读](https://wordtap.cn/cet/) |
| 考研英语真题 | 64 套 | [考研英语阅读](https://wordtap.cn/kaoyan-english/) |
| 英语词汇 | 23 套词库、1,181 篇文章，每篇最多 100 词 | [仓库内词库与例句数据](../public/english-vocabulary/) |

词库覆盖 CET-4、CET-6、考研、IELTS、TOEFL、GRE、GMAT、SAT、专四、专八及中小学英语等，共 116,953 条源记录；该数字不是去重后的单词数。词汇单元支持搜索、阅读、例句跟打与分享。

课程与词典数据保留各自的来源和权利条件。人教版缺失的 5 册未用占位内容补齐；120 篇文章仍待来源确认，16 处词汇源数据问题原样保留。具体状态见[发布说明](../content/release/README.md)和[第三方声明](../THIRD_PARTY_NOTICES.md)。
