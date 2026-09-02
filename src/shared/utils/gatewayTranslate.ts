import { localGatewayBaseUrl } from "./gatewaySpeech";
import { GATEWAY_TRANSLATE_REQUEST } from "./timeoutConstants";

type BaiduSugResult = {
  meaning?: string;
};

export async function translateWithBaiduSugGateway(
  word: string,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<string> {
  const normalized = word.trim();
  if (!normalized) {
    return "";
  }

  const timeoutMs = options.timeoutMs ?? GATEWAY_TRANSLATE_REQUEST;
  if (options.signal?.aborted) {
    return "";
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const abortRequest = () => controller.abort();
  options.signal?.addEventListener("abort", abortRequest, { once: true });
  try {
    const response = await fetch(`${localGatewayBaseUrl}/v1/recipes/baidu-sug`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ word: normalized }),
      signal: controller.signal,
    });
    if (!response.ok) {
      return "";
    }

    const payload = (await response.json()) as BaiduSugResult;
    return typeof payload.meaning === "string" ? payload.meaning.trim() : "";
  } catch {
    return "";
  } finally {
    options.signal?.removeEventListener("abort", abortRequest);
    window.clearTimeout(timeout);
  }
}
