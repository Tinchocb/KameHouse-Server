// Silent audio engine (No Web Audio API) per project requirements
// Microinteractions are handled visually with Framer Motion

class SoundEngine {
  public toggleMute(): boolean {
    return true;
  }

  public isMuted(): boolean {
    return true;
  }

  public playFlip(): void {
    // No-op
  }

  public playSelect(): void {
    // No-op
  }

  public playLoreReveal(): void {
    // No-op
  }
}

export const sounds = new SoundEngine();
