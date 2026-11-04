/**
 * Tiny procedural sound engine — no samples, no network requests.
 * All sounds are synthesized with the Web Audio API after the first gesture.
 */
const STORAGE_KEY = "neon-pong-muted";

export class SoundEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.enabled = true;

    try {
      this.enabled = window.localStorage.getItem(STORAGE_KEY) !== "1";
    } catch {
      // Storage can be unavailable in private browsing; sound is on by default.
    }
  }

  async unlock() {
    if (!this.enabled) return;

    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.42;
      this.master.connect(this.context.destination);
    }

    if (this.context.state === "suspended") {
      try {
        await this.context.resume();
      } catch {
        // A suspended context is harmless; the next gesture can retry.
      }
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;

    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(enabled ? 0.42 : 0.0001, this.context.currentTime, 0.02);
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, enabled ? "0" : "1");
    } catch {
      // Ignore storage failures.
    }
  }

  toggle() {
    this.setEnabled(!this.enabled);
    if (this.enabled) this.unlock();
    return this.enabled;
  }

  tone({ frequency, endFrequency = frequency, duration = 0.1, type = "sine", gain = 0.05, delay = 0, detune = 0 }) {
    if (!this.enabled || !this.context || !this.master) return;

    const context = this.context;
    const start = context.currentTime + delay;
    const end = start + duration;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();

    oscillator.type = type;
    oscillator.detune.value = detune;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), end);

    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + Math.min(0.008, duration * 0.2));
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.start(start);
    oscillator.stop(end + 0.03);
  }

  paddle(power = 1) {
    const strength = Math.min(1.4, 0.8 + power * 0.25);
    this.tone({ frequency: 260, endFrequency: 150, duration: 0.085, type: "triangle", gain: 0.065 * strength });
    this.tone({ frequency: 620, endFrequency: 380, duration: 0.045, type: "sine", gain: 0.025 * strength, delay: 0.004 });
  }

  wall() {
    this.tone({ frequency: 150, endFrequency: 92, duration: 0.09, type: "sine", gain: 0.04 });
    this.tone({ frequency: 320, endFrequency: 220, duration: 0.05, type: "triangle", gain: 0.018 });
  }

  launch() {
    this.tone({ frequency: 180, endFrequency: 660, duration: 0.24, type: "triangle", gain: 0.045 });
    this.tone({ frequency: 90, endFrequency: 330, duration: 0.24, type: "sine", gain: 0.025, delay: 0.015 });
  }

  score(playerScored) {
    if (playerScored) {
      this.tone({ frequency: 330, endFrequency: 620, duration: 0.18, type: "triangle", gain: 0.055 });
      this.tone({ frequency: 495, endFrequency: 930, duration: 0.2, type: "sine", gain: 0.03, delay: 0.08 });
    } else {
      this.tone({ frequency: 220, endFrequency: 92, duration: 0.32, type: "sawtooth", gain: 0.045 });
      this.tone({ frequency: 110, endFrequency: 55, duration: 0.36, type: "sine", gain: 0.035, delay: 0.02 });
    }
  }

  win() {
    const notes = [392, 523.25, 659.25, 783.99];
    notes.forEach((frequency, index) => {
      this.tone({
        frequency,
        endFrequency: frequency * 1.01,
        duration: 0.34,
        type: "triangle",
        gain: 0.045,
        delay: index * 0.085,
      });
    });
    this.tone({ frequency: 196, endFrequency: 392, duration: 0.7, type: "sine", gain: 0.035, delay: 0.05 });
  }

  lose() {
    const notes = [293.66, 246.94, 196, 146.83];
    notes.forEach((frequency, index) => {
      this.tone({
        frequency,
        endFrequency: frequency * 0.92,
        duration: 0.3,
        type: "triangle",
        gain: 0.038,
        delay: index * 0.11,
      });
    });
  }
}
