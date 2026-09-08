/**
 * Dźwiękowy i haptyczny system wczesnego ostrzegania (SafeTracks Life-Saving Alert).
 * Wykorzystuje Web Audio API do natychmiastowej syntezy syreny kolejowej oraz wibracje telefonu.
 */

class AlertAudioService {
  private audioCtx: AudioContext | null = null;
  private activeOscillators: OscillatorNode[] = [];
  private isAlarmPlaying = false;
  private soundEnabled = true;

  private initAudioContext() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    if (!enabled) {
      this.stopAlarm();
    }
  }

  public isSoundOn(): boolean {
    return this.soundEnabled;
  }

  /**
   * Krótki dwutonowy sygnał ostrzegawczy (Approaching train warning - < 120s)
   */
  public playWarningSound() {
    if (!this.soundEnabled) return;
    this.initAudioContext();
    if (!this.audioCtx) return;

    // Haptyka na telefonie: 2 krótkie impulsy
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880.0, now + 0.15); // A5

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {
      console.warn('[Audio] Błąd odtwarzania dźwięku ostrzeżenia:', e);
    }
  }

  /**
   * Ciągły, donośny alarm kolizyjny (Critical collision alarm - < 30s)
   */
  public playCriticalAlarm() {
    if (this.isAlarmPlaying || !this.soundEnabled) return;
    this.initAudioContext();
    if (!this.audioCtx) return;

    this.isAlarmPlaying = true;

    // Agresywna wibracja telefonu w kieszeni (wzorzec SOS)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([400, 150, 400, 150, 600]);
    }

    try {
      const now = this.audioCtx.currentTime;
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'square';

      // Dwutonowa modulacja częstotliwości (syrena kolejowa)
      osc1.frequency.setValueAtTime(440, now);
      osc1.frequency.linearRampToValueAtTime(880, now + 0.25);
      osc1.frequency.linearRampToValueAtTime(440, now + 0.5);

      osc2.frequency.setValueAtTime(445, now);
      osc2.frequency.linearRampToValueAtTime(890, now + 0.25);
      osc2.frequency.linearRampToValueAtTime(445, now + 0.5);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.9);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.9);
      osc2.stop(now + 0.9);

      this.activeOscillators = [osc1, osc2];

      setTimeout(() => {
        this.isAlarmPlaying = false;
      }, 1000);
    } catch (e) {
      console.warn('[Audio] Błąd odtwarzania alarmu krytycznego:', e);
      this.isAlarmPlaying = false;
    }
  }

  public stopAlarm() {
    this.activeOscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    });
    this.activeOscillators = [];
    this.isAlarmPlaying = false;
  }
}

export const alertAudio = new AlertAudioService();
