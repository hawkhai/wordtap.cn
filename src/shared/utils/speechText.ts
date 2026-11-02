import { siteCopy } from "../copy/siteCopy";

export type SpeechTextMode = "english" | "multilingual";

export class NoSpeechTextError extends Error {
  constructor() {
    super(siteCopy.status.noEnglishSpeechContent);
    this.name = "NoSpeechTextError";
  }
}

/** Capabilities belong to exact configured voice IDs, never their display names. */
export function gatewaySpeechTextMode(voice: string = siteCopy.controls.defaultGatewayVoice): SpeechTextMode {
  return siteCopy.controls.gatewayVoiceOptions.find(option => option.value === voice)?.textMode ?? "english";
}

const punctuation: Record<string, string> = {
  "。": ".", "，": ",", "、": ",", "；": ";", "：": ":", "！": "!", "？": "?",
  "（": "(", "）": ")", "【": "[", "】": "]", "「": '"', "」": '"',
  "『": '"', "』": '"', "《": '"', "》": '"', "〈": '"', "〉": '"',
};

/** Produces an engine-only copy. Article text and sentence offsets stay untouched. */
export function prepareSpeechText(text: string, mode: SpeechTextMode = "english"): string {
  const safe = text.replace(/[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u20E3]/gu,
    char => /[\n\r\t]/u.test(char) ? char : " ");
  if (mode === "multilingual") return /[\p{L}\p{N}]/u.test(safe) ? safe.trim() : "";

  let result = "";
  let latin = false;
  for (const original of safe) {
    const code = original.codePointAt(0)!;
    const char = punctuation[original] ?? (code >= 0xFF01 && code <= 0xFF5E ? String.fromCodePoint(code - 0xFEE0) : original);
    if (/\p{Script=Latin}/u.test(char) && /\p{L}/u.test(char)) {
      result += char;
      latin = true;
    } else if (/\p{M}/u.test(char) && latin && /[\p{Script=Inherited}\p{Script=Latin}]/u.test(char)) {
      result += char;
    } else {
      result += /[0-9\s.,!?;:'"‘’“”()\[\]{}\-–—…/\\@#$%&*+=<>_|~^`£€]/u.test(char) ? char : " ";
      latin = false;
    }
  }
  // Empty annotations must not become spoken bracket names or join adjacent words.
  let previous: string;
  do {
    previous = result;
    result = result.replace(/\([\s.,!?;:]*\)|\[[\s.,!?;:]*\]|\{[\s.,!?;:]*\}|"[\s.,!?;:]*"|“[\s.,!?;:]*”|‘[\s.,!?;:]*’/gu, " ");
  } while (result !== previous);
  result = result
    .replace(/^[^\p{Script=Latin}0-9\n]+$/gmu, "")
    .replace(/^[ \t]*[,;:!?]+[ \t]*/gmu, "")
    .replace(/^[ \t]*\.(?=\s|$)[ \t]*/gmu, "")
    .replace(/([.!?])(?:[ \t]+[.!?])+(?=\s|$)/gu, "$1")
    .replace(/[,;:][ \t]*([.!?])/gu, "$1")
    .replace(/[ \t]+([,.;:!?)}\]])/gu, "$1")
    .replace(/([(\[{])[ \t]+/gu, "$1")
    .replace(/[ \t]+/gu, " ")
    .replace(/ *\r?\n */gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
  return /[\p{Script=Latin}0-9]/u.test(result) ? result : "";
}
