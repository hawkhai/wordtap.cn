/** One pause state shared across preparation, chunks, repeats and engine fallback. */
export class SpeechPlaybackControl {
  paused = false;
  private listeners = new Set<() => void>();

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    for (const listener of this.listeners) listener();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
