<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { siteCopy as copy } from "./shared/copy/siteCopy";
import { appAssetUrl } from "./shared/utils/assetUrls";

interface PhoneticItem {
  symbol: string;
  example: string;
}
interface PhoneticSection {
  section: string;
  items: PhoneticItem[];
}

const phoneticToId: Record<string, string> = {
  'iː': '001', 'ɜː': '002', 'ɑː': '003', 'ɔː': '004', 'uː': '005',
  'ɪ': '006', 'e': '007', 'æ': '008', 'ə': '009', 'ʌ': '010',
  'ɒ': '011', 'ʊ': '012', 'eɪ': '013', 'aɪ': '014', 'ɔɪ': '015',
  'əʊ': '016', 'aʊ': '017', 'ɪə': '018', 'eə': '019', 'ʊə': '020',
  'p': '021', 't': '022', 'k': '023', 'f': '024', 'θ': '025',
  's': '026', 'ʃ': '051', 'h': '028', 'tʃ': '050', 'ts': '030',
  'tr': '031', 'b': '032', 'd': '033', 'g': '034', 'v': '035',
  'ð': '036', 'z': '037', 'ʒ': '038', 'r': '039', 'dʒ': '040',
  'dz': '041', 'dr': '042', 'm': '043', 'n': '044', 'ŋ': '045',
  'l': '046', 'j': '047', 'w': '048', 'ks': '049',
};

interface AudioSource {
  key: string;
  label: string;
  path: string;
}

const sources: AudioSource[] = [
  { key: "yp", label: copy.ipa.sourceYp, path: "ipa/yp" },
  { key: "xdf", label: copy.ipa.sourceXdf, path: "ipa/xdf" },
  { key: "mp3", label: copy.ipa.sourceMp3, path: "ipa/mp3" },
];

const enabledSources = ref<Set<string>>(new Set(["yp"]));

function toggleSource(key: string): void {
  if (key === "yp") return;
  const next = new Set(enabledSources.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  enabledSources.value = next;
}

const vowels: PhoneticSection[] = [
  { section: copy.ipa.longVowels, items: [
    { symbol: 'iː', example: 'see' }, { symbol: 'ɜː', example: 'bird' }, { symbol: 'ɑː', example: 'car' },
    { symbol: 'ɔː', example: 'door' }, { symbol: 'uː', example: 'food' },
  ]},
  { section: copy.ipa.shortVowels, items: [
    { symbol: 'ɪ', example: 'sit' }, { symbol: 'e', example: 'bed' }, { symbol: 'æ', example: 'cat' },
    { symbol: 'ə', example: 'about' }, { symbol: 'ʌ', example: 'cup' }, { symbol: 'ɒ', example: 'hot' },
    { symbol: 'ʊ', example: 'book' },
  ]},
  { section: copy.ipa.diphthongs, items: [
    { symbol: 'eɪ', example: 'day' }, { symbol: 'aɪ', example: 'my' }, { symbol: 'ɔɪ', example: 'boy' },
    { symbol: 'əʊ', example: 'go' }, { symbol: 'aʊ', example: 'now' }, { symbol: 'ɪə', example: 'ear' },
    { symbol: 'eə', example: 'air' }, { symbol: 'ʊə', example: 'tour' },
  ]},
];

const consonants: PhoneticSection[] = [
  { section: copy.ipa.voicelessConsonants, items: [
    { symbol: 'p', example: 'pen' }, { symbol: 't', example: 'tea' }, { symbol: 'k', example: 'key' },
    { symbol: 'f', example: 'fish' }, { symbol: 'θ', example: 'think' }, { symbol: 's', example: 'sun' },
    { symbol: 'ʃ', example: 'ship' }, { symbol: 'h', example: 'hat' }, { symbol: 'tʃ', example: 'chair' },
    { symbol: 'ts', example: 'cats' }, { symbol: 'tr', example: 'tree' },
  ]},
  { section: copy.ipa.voicedConsonants, items: [
    { symbol: 'b', example: 'book' }, { symbol: 'd', example: 'dog' }, { symbol: 'g', example: 'go' },
    { symbol: 'v', example: 'very' }, { symbol: 'ð', example: 'this' }, { symbol: 'z', example: 'zoo' },
    { symbol: 'ʒ', example: 'vision' }, { symbol: 'r', example: 'red' }, { symbol: 'dʒ', example: 'jump' },
    { symbol: 'dz', example: 'beds' }, { symbol: 'dr', example: 'dream' }, { symbol: 'm', example: 'man' },
    { symbol: 'n', example: 'no' }, { symbol: 'ŋ', example: 'sing' }, { symbol: 'l', example: 'love' },
    { symbol: 'j', example: 'yes' }, { symbol: 'w', example: 'water' },
  ]},
];

let currentAudio: HTMLAudioElement | null = null;
let playChainTimeout: ReturnType<typeof setTimeout> | null = null;
const playingSymbol = ref("");

function stopCurrent(): void {
  if (playChainTimeout) {
    clearTimeout(playChainTimeout);
    playChainTimeout = null;
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  playingSymbol.value = "";
}

onBeforeUnmount(stopCurrent);

function playPhonetic(symbol: string): void {
  const id = phoneticToId[symbol];
  if (!id) return;
  stopCurrent();

  const enabled = sources.filter((s) => enabledSources.value.has(s.key));
  if (!enabled.length) return;

  const urls = enabled.map((s) => appAssetUrl(`${s.path}/${id}.mp3`));
  playingSymbol.value = symbol;

  let i = 0;
  const playNext = (): void => {
    if (i >= urls.length) {
      playingSymbol.value = "";
      return;
    }
    const audio = new Audio(urls[i++]);
    currentAudio = audio;
    audio.addEventListener("ended", () => {
      playChainTimeout = setTimeout(playNext, 200);
    }, { once: true });
    audio.addEventListener("error", () => {
      playChainTimeout = setTimeout(playNext, 200);
    }, { once: true });
    audio.play().catch(() => {
      playChainTimeout = setTimeout(playNext, 200);
    });
  };
  playNext();
}
</script>

<template>
  <section class="ipa-page" aria-labelledby="ipa-title">
    <div class="ipa-header flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h2 id="ipa-title" class="study-panel-title text-lg font-semibold">
          {{ copy.ipa.title }}
        </h2>
        <p class="ipa-subtitle mt-1 text-sm">{{ copy.ipa.subtitle }}</p>
      </div>
      <div class="ipa-sources">
        <label
          v-for="src in sources"
          :key="src.key"
          class="ipa-source-toggle"
          :class="{ 'ipa-source-lock': src.key === 'yp' }"
        >
          <input
            type="checkbox"
            :checked="enabledSources.has(src.key)"
            :disabled="src.key === 'yp'"
            @change="toggleSource(src.key)"
          >
          <span>{{ src.label }}</span>
        </label>
      </div>
    </div>

    <div class="ipa-section">
      <h3 class="ipa-section-title">{{ copy.ipa.vowels }}</h3>
      <div v-for="sub in vowels" :key="sub.section" class="ipa-subsection">
        <h4 class="ipa-subsection-title">{{ sub.section }}</h4>
        <div class="ipa-grid">
          <button
            v-for="item in sub.items"
            :key="item.symbol"
            type="button"
            class="ipa-card"
            :class="{ 'ipa-card-playing': playingSymbol === item.symbol }"
            @click="playPhonetic(item.symbol)"
          >
            <span class="ipa-symbol">{{ item.symbol }}</span>
            <span class="ipa-example">{{ item.example }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="ipa-section">
      <h3 class="ipa-section-title">{{ copy.ipa.consonants }}</h3>
      <div v-for="sub in consonants" :key="sub.section" class="ipa-subsection">
        <h4 class="ipa-subsection-title">{{ sub.section }}</h4>
        <div class="ipa-grid">
          <button
            v-for="item in sub.items"
            :key="item.symbol"
            type="button"
            class="ipa-card"
            :class="{ 'ipa-card-playing': playingSymbol === item.symbol }"
            @click="playPhonetic(item.symbol)"
          >
            <span class="ipa-symbol">{{ item.symbol }}</span>
            <span class="ipa-example">{{ item.example }}</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
