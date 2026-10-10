import type { DictionaryShard, WordPhonetic } from "../types/app";

export function phoneticWordKey(word: string): string {
  return word.toLowerCase().replace(/[‘’]/g, "'");
}

export function normalizePhonetic(value: string): string {
  return value.trim().replace(/ә/g, "ə").replace(/'/g, "ˈ")
    .replace(/([aeiouyɑɒæɐəɛɜɞɪɔœøʊʌɨʉɯɤ]):/g, "$1ː");
}

/** Shared across generations so obsolete in-flight work cannot exceed the limit. */
export function createTaskLimiter(limit: number) {
  let active = 0;
  const waiting: Array<() => void> = [];
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= limit) await new Promise<void>(resolve => waiting.push(resolve));
    else active++;
    try { return await task(); }
    finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}

export async function lookupWordPhonetic(word: string, candidates: (key: string) => string[],
  load: (name: string) => Promise<DictionaryShard | null>): Promise<WordPhonetic> {
  const key = phoneticWordKey(word);
  try {
    for (const name of candidates(key)) {
      const shard = await load(name);
      if (!shard) return { status: "error" };
      const entry = shard[key];
      if (entry) {
        const text = normalizePhonetic(entry.phonetic ?? "");
        return text ? { status: "ready", text } : { status: "missing" };
      }
    }
    return { status: "missing" };
  } catch { return { status: "error" }; }
}
