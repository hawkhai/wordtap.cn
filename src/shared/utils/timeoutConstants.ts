/**
 * 全站超时参数常量表
 *
 * 分类原则：
 *   UI_*      — 界面交互防抖/延迟，影响用户体感节奏
 *   GATEWAY_* — 本地网关（127.0.0.1:18765）相关请求
 *   DICTIONARY_* — 离线字典（manifest / shard）加载
 *   NETWORK_* — 通用网络请求（HEAD 探测、下载可用性检查）
 *   SPEECH_*  — 语音合成与播放看门狗
 *   RESPONSE_* — HTTP 响应体读取
 */

// ── UI 交互防抖 ──────────────────────────────────────────────

/** 文本输入 → 分词：快速响应，用户停顿即触发 */
export const UI_SPLIT_WORDS_DEBOUNCE = 250;

/** 分词完成 → 自动保存文章：避免频繁写入 IndexedDB */
export const UI_TEXT_HISTORY_SAVE_DEBOUNCE = 2000;

// ── 本地网关 ─────────────────────────────────────────────────

/** 网关心跳轮询间隔（5 秒） */
export const GATEWAY_HEARTBEAT_INTERVAL = 5000;

/** 网关状态快速探测 — 心跳调用，localhost 响应通常 <200ms，1.5 秒已留足余量 */
export const GATEWAY_STATUS_PROBE = 1500;

/** 网关诊断：状态检查（3 秒） */
export const GATEWAY_DIAGNOSTIC_STATUS = 3000;

/** 网关诊断：能力检查（3 秒） */
export const GATEWAY_DIAGNOSTIC_CAPABILITIES = 3000;

/** 网关诊断：在线查词 / 百度 Sug（5 秒） */
export const GATEWAY_DIAGNOSTIC_TRANSLATE = 5000;

/** 网关诊断：Edge TTS 语音合成 — 需等待音频生成（8 秒） */
export const GATEWAY_DIAGNOSTIC_SPEECH = 8000;

/** 在线查词请求 — 用户点击单词后等待（5 秒） */
export const GATEWAY_TRANSLATE_REQUEST = 5000;

// ── 离线字典 ─────────────────────────────────────────────────

/** 字典 manifest / shard JSON 获取（5 秒） */
export const DICTIONARY_FETCH = 5000;

// ── 通用网络 ─────────────────────────────────────────────────

/** HEAD 探测：下载链接可用性检查（5 秒） */
export const NETWORK_HEAD_PROBE = 5000;

/** 大型安装包 HEAD 探测：兼容本地预览和冷磁盘首次读取（20 秒） */
export const NETWORK_LARGE_DOWNLOAD_HEAD_PROBE = 20000;

/** 网关发布信息 manifest 获取（5 秒） */
export const NETWORK_RELEASE_MANIFEST = 5000;

// ── 语音播放 ─────────────────────────────────────────────────

/** 语音播放看门狗基础值 — 引擎无响应时的兜底超时（8 秒） */
export const SPEECH_WATCHDOG_BASE = 8000;

/** 浏览器语音看门狗系数：watchdog = max(BASE, textLen * 320ms) */
export const SPEECH_BROWSER_CHAR_MS = 320;

/** 有道语音看门狗系数：watchdog = max(BASE, textLen * 420ms) */
export const SPEECH_YOUDAO_CHAR_MS = 420;

/** 诊断：读取 Edge TTS 返回的音频 blob（8 秒） */
export const SPEECH_READ_AUDIO_BLOB = 8000;

// ── HTTP 响应体读取 ──────────────────────────────────────────

/** 读取错误响应文本（2 秒，截断至 140 字符） */
export const RESPONSE_READ_ERROR_TEXT = 2000;
