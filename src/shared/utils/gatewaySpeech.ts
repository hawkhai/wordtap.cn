import { appAssetUrl, appDownloadUrl } from "./assetUrls";
import { getCachedAudio, makeAudioCacheKey, putCachedAudio } from "../stores/historyStore";
import { siteCopy } from "../copy/siteCopy";
import { GATEWAY_STATUS_PROBE } from "./timeoutConstants";

type GatewaySpeechProgressPhase = "cache-hit" | "connecting" | "receiving" | "playing";

export type GatewaySpeechProgress = {
  phase: GatewaySpeechProgressPhase;
  audioBytes?: number;
  chunkIndex?: number;
  chunkCount?: number;
};

export type GatewaySpeechOptions = {
  voice?: string;
  rate?: string;
  volume?: string;
  pitch?: string;
  onProgress?: (progress: GatewaySpeechProgress) => void;
};

const silentAudioUrl =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQQAAAAAAA==";
export const localGatewayBaseUrl = "http://127.0.0.1:18765";
const clientSpeechChunkBytes = 1000;
export const gatewaySpeechEngineVersion = "edge-tts-recipe-v1";
export const gatewayDownloadUrl = appDownloadUrl("downloads/WordTapGatewaySetup.exe");
export const gatewayReleaseManifestUrl = appAssetUrl("downloads/wordtap-gateway-release.json");

class GatewaySpeechCancelledError extends Error {
  constructor() {
    super(siteCopy.gatewaySpeech.cancelled);
    this.name = "GatewaySpeechCancelledError";
  }
}

export function isGatewaySpeechCancelError(error: unknown): boolean {
  return error instanceof GatewaySpeechCancelledError || (error instanceof DOMException && error.name === "AbortError");
}

export async function isLocalGatewayRunning(timeoutMs = GATEWAY_STATUS_PROBE): Promise<boolean> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${localGatewayBaseUrl}/v1/status`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

export class GatewaySpeechSession {
  private abortControllers = new Set<AbortController>();
  private audio: HTMLAudioElement | null = null;
  private objectUrl = "";
  private cancelled = false;

  async speak(text: string, options: GatewaySpeechOptions = {}): Promise<void> {
    this.cancelled = false;
    await this.primeAudio();
    this.throwIfCancelled();

    const chunks = splitTextForIncrementalSpeech(text, clientSpeechChunkBytes);
    if (!chunks.length) {
      throw new Error(siteCopy.gatewaySpeech.noContent);
    }

    const chunkCount = chunks.length;
    // 首批并发合成数量：前 3 个 chunk 同时请求
    const prefetchCount = Math.min(3, chunkCount);
    // 已发起的合成 Promise（settle 包装，不会 reject）
    const pending: Array<Promise<Settled<Blob>>> = [];
    // 下一个要发起合成的 chunk 索引
    let nextToSynthesize = 0;

    // 发起一个 chunk 的合成，返回 settle 包装的 Promise
    const enqueue = (index: number): Promise<Settled<Blob>> => {
      return settle(this.synthesize(chunks[index], options, index, chunkCount));
    };

    // 首批并发：同时发起前 prefetchCount 个 chunk
    for (let i = 0; i < prefetchCount; i++) {
      pending.push(enqueue(nextToSynthesize));
      nextToSynthesize += 1;
    }

    // 逐个播放：取队首 → 等就绪 → 播放 → 补一个到队尾
    for (let index = 0; index < chunkCount; index += 1) {
      const result = await pending.shift()!;
      this.throwIfCancelled();

      if (!result.ok) {
        throw result.error;
      }

      // 播放当前 chunk 的同时，预加载下一个
      if (nextToSynthesize < chunkCount) {
        pending.push(enqueue(nextToSynthesize));
        nextToSynthesize += 1;
      }

      await this.play(result.value, options.onProgress, index, chunkCount);
      this.throwIfCancelled();
    }
  }

  cancel(): void {
    this.cancelled = true;
    for (const controller of this.abortControllers) {
      controller.abort();
    }
    this.abortControllers.clear();

    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
      this.audio = null;
    }

    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = "";
    }
  }

  private async synthesize(
    text: string,
    options: GatewaySpeechOptions,
    chunkIndex: number,
    chunkCount: number,
  ): Promise<Blob> {
    const cleaned = text.trim();
    if (!cleaned) {
      return new Blob([], { type: "audio/mpeg" });
    }

    const cacheKey = await makeAudioCacheKey([
      cleaned,
      options.voice ?? "",
      options.rate ?? "",
      options.volume ?? "",
      options.pitch ?? "",
      gatewaySpeechEngineVersion,
    ]);
    const cachedAudio = await getCachedAudio(cacheKey).catch(() => undefined);
    if (cachedAudio?.blob?.size) {
      options.onProgress?.({
        phase: "cache-hit",
        audioBytes: cachedAudio.size,
        chunkIndex,
        chunkCount,
      });
      return cachedAudio.blob;
    }

    const abortController = new AbortController();
    this.abortControllers.add(abortController);
    options.onProgress?.({ phase: "connecting", chunkIndex, chunkCount });

    let response: Response;
    try {
      response = await fetch(`${localGatewayBaseUrl}/v1/recipes/speech`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: cleaned,
          voice: options.voice,
          rate: options.rate,
          volume: options.volume,
          pitch: options.pitch,
        }),
        signal: abortController.signal,
      });
    } catch (error) {
      if (isGatewaySpeechCancelError(error)) {
        throw error;
      }
      throw new Error(siteCopy.gatewaySpeech.gatewayNotStarted);
    } finally {
      this.abortControllers.delete(abortController);
    }

    this.throwIfCancelled();
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const audio = await response.blob();
    options.onProgress?.({ phase: "receiving", audioBytes: audio.size, chunkIndex, chunkCount });
    void putCachedAudio(cacheKey, audio, gatewaySpeechEngineVersion).catch(() => {
      // Audio cache is an optimization; playback should not fail if storage is full or blocked.
    });
    return audio;
  }

  private async play(
    audioBlob: Blob,
    onProgress?: (progress: GatewaySpeechProgress) => void,
    chunkIndex = 0,
    chunkCount = 1,
  ): Promise<void> {
    if (!audioBlob.size) {
      throw new Error(siteCopy.gatewaySpeech.noAudioGenerated);
    }

    this.objectUrl = URL.createObjectURL(audioBlob);
    this.audio ??= new Audio();
    this.audio.src = this.objectUrl;
    onProgress?.({ phase: "playing", audioBytes: audioBlob.size, chunkIndex, chunkCount });

    return new Promise((resolve, reject) => {
      if (!this.audio) {
        reject(new GatewaySpeechCancelledError());
        return;
      }

      this.audio.onended = () => {
        this.releaseAudio();
        resolve();
      };
      this.audio.onerror = () => {
        this.releaseAudio();
        reject(new Error(siteCopy.gatewaySpeech.audioPlaybackFailed));
      };

      this.audio.play().catch((error: unknown) => {
        this.releaseAudio();
        reject(error instanceof Error ? error : new Error(siteCopy.gatewaySpeech.audioPlaybackFailed));
      });
    });
  }

  private releaseAudio(): void {
    this.audio = null;
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = "";
    }
  }

  private async primeAudio(): Promise<void> {
    this.audio = new Audio(silentAudioUrl);
    this.audio.muted = true;

    try {
      await this.audio.play();
      this.audio.pause();
    } catch {
      // Some automation environments do not grant user activation; real clicks can still play normally.
    } finally {
      if (this.audio) {
        this.audio.muted = false;
        this.audio.removeAttribute("src");
        this.audio.load();
      }
    }
  }

  private throwIfCancelled(): void {
    if (this.cancelled) {
      throw new GatewaySpeechCancelledError();
    }
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || siteCopy.gatewaySpeech.requestFailed(response.status);
  } catch {
    return siteCopy.gatewaySpeech.requestFailed(response.status);
  }
}

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
  return promise.then(
    (value) => ({ ok: true, value }),
    (error: unknown) => ({ ok: false, error }),
  );
}

function splitTextForIncrementalSpeech(text: string, byteLength: number): string[] {
  if (byteLength <= 0) {
    throw new Error("Speech chunk byte length must be greater than 0.");
  }

  const cleaned = removeIncompatibleCharacters(text).trim();
  if (!cleaned) {
    return [];
  }

  // 短文本（<1000 字节）不分块，直接返回
  if (utf8ByteLength(cleaned) <= 1000) {
    return [cleaned];
  }

  // 句子优先分块：先按句子边界拆分，再合并短句直到接近 byteLength
  const sentences = splitBySentenceBoundaries(cleaned);
  return mergeShortChunks(sentences, byteLength);
}

/** 按句子边界拆分文本，保留标点在句尾 */
function splitBySentenceBoundaries(text: string): string[] {
  // 按句末标点 + 后续空白拆分，标点保留在前一段
  const parts = text.split(/(?<=[.!?;:])\s+/);
  // 进一步按双换行拆分（段落边界）
  const sentences: string[] = [];
  for (const part of parts) {
    const paragraphs = part.split(/\n\n+/);
    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (trimmed) {
        sentences.push(trimmed);
      }
    }
  }
  return sentences.length ? sentences : [text];
}

/** 将短句合并，使每个 chunk 接近但不超过 maxBytes */
function mergeShortChunks(sentences: string[], maxBytes: number): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const separator = current ? " " : "";
    const candidate = current + separator + sentence;
    if (current && utf8ByteLength(candidate) > maxBytes) {
      chunks.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }

  if (current.trim()) {
    chunks.push(current);
  }

  // 如果合并后仍然有超大 chunk，用字节级切分兜底
  const result: string[] = [];
  for (const chunk of chunks) {
    if (utf8ByteLength(chunk) <= maxBytes) {
      result.push(chunk);
    } else {
      result.push(...splitByByteLength(chunk, maxBytes));
    }
  }
  return result;
}

/** 字节级切分兜底（处理单句超长的情况） */
function splitByByteLength(text: string, maxBytes: number): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (utf8ByteLength(remaining) > maxBytes) {
    const splitAt = findNaturalSplitPoint(remaining, maxBytes);
    if (splitAt <= 0) {
      throw new Error("Unable to find a safe speech text split point.");
    }
    const chunk = remaining.slice(0, splitAt).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining) {
    chunks.push(remaining);
  }
  return chunks;
}

function findNaturalSplitPoint(text: string, byteLength: number): number {
  let bytes = 0;
  let safeSplit = 0;
  let lastNewline = 0;
  let lastSentence = 0;
  let lastSpace = 0;

  for (const match of text.matchAll(/[\s\S]/gu)) {
    const char = match[0];
    const index = match.index ?? 0;
    const nextIndex = index + char.length;
    const nextBytes = bytes + utf8ByteLength(char);
    if (nextBytes > byteLength) {
      break;
    }

    bytes = nextBytes;
    safeSplit = nextIndex;
    if (char === "\n") {
      lastNewline = nextIndex;
    } else if (isSentenceBoundary(char)) {
      lastSentence = nextIndex;
    } else if (/\s/u.test(char)) {
      lastSpace = nextIndex;
    }
  }

  return lastNewline || lastSentence || lastSpace || safeSplit;
}

function isSentenceBoundary(char: string): boolean {
  return char === "." || char === "!" || char === "?" || char === ";" || char === ":";
}

function removeIncompatibleCharacters(text: string): string {
  return Array.from(text, (char) => {
    const code = char.charCodeAt(0);
    return (code >= 0 && code <= 8) || (code >= 11 && code <= 12) || (code >= 14 && code <= 31) ? " " : char;
  }).join("");
}

function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}
