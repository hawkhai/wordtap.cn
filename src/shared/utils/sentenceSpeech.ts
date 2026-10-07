import { GatewaySpeechSession } from "./gatewaySpeech";
import { browserSpeechAvailable, playBrowserSpeech } from "./browserSpeech";

/** One sentence, one play. The owner arbitrates word/full-text playback. */
export class SentenceSpeechSession {
  private controller = new AbortController();
  private gateway: GatewaySpeechSession | null = null;

  cancel(): void {
    this.controller.abort();
    this.gateway?.cancel();
    this.gateway = null;
  }

  async speak(text: string, options: {
    useGateway: boolean;
    gatewayVoice: string;
    gatewayRate: string;
    browserVoice: SpeechSynthesisVoice | null;
    browserRate: number;
    onPlaying: () => void;
    onFallback: () => void;
  }): Promise<void> {
    const signal = this.controller.signal;
    signal.throwIfAborted();
    if (options.useGateway) {
      this.gateway = new GatewaySpeechSession();
      try {
        await this.gateway.speak(text, {
          voice: options.gatewayVoice,
          rate: options.gatewayRate,
          onProgress: ({ phase }) => {
            if (!signal.aborted && phase === "playing") options.onPlaying();
          },
        });
        signal.throwIfAborted();
        return;
      } catch (error) {
        signal.throwIfAborted();
        if (!browserSpeechAvailable()) throw error;
      } finally {
        this.gateway?.cancel();
        this.gateway = null;
      }
      options.onFallback();
    }
    signal.throwIfAborted();
    await playBrowserSpeech(text, {
      signal, voice: options.browserVoice, rate: options.browserRate,
      onStart: () => { if (!signal.aborted) options.onPlaying(); },
    });
  }
}
