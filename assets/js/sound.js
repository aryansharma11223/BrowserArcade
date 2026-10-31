/**
 * Browser Arcade - Procedural Audio Synthesizer
 * Zero external audio files. 100% synthesized via native Web Audio API.
 * High performance, zero latency, zero bandwidth cost.
 */

import { storage } from './storage.js';

class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    // Sound is strictly disabled by default; activated only through explicit user interaction
    this.isMuted = !storage.getItem('sound_enabled', false);
    this._isUnlocked = false;

    // Pre-bind unlocker to global user interactions
    this._boundUnlock = this._unlockAudioContext.bind(this);
    if (typeof window !== 'undefined') {
      window.addEventListener('click', this._boundUnlock, { once: false, passive: true });
      window.addEventListener('keydown', this._boundUnlock, { once: false, passive: true });
      window.addEventListener('touchstart', this._boundUnlock, { once: false, passive: true });
    }
  }

  /**
   * Initializes the AudioContext upon user gesture.
   * Browsers require a user gesture before playing sound.
   * @private
   */
  _unlockAudioContext() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.4, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        this._isUnlocked = true;
      }).catch(() => {});
    } else {
      this._isUnlocked = true;
    }
  }

  /**
   * Toggles audio mute state and stores preference.
   * @returns {boolean} New mute state
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    storage.setItem('sound_enabled', !this.isMuted);

    if (this.ctx && this.masterGain) {
      const targetGain = this.isMuted ? 0 : 0.4;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.02);
    }

    this._dispatchSoundStateEvent();
    return this.isMuted;
  }

  /**
   * Dispatches a custom event so UI components can sync icon states.
   * @private
   */
  _dispatchSoundStateEvent() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('arcade:soundchange', {
        detail: { isMuted: this.isMuted }
      }));
    }
  }

  /**
   * Helper to create a quick envelope oscillator.
   * @private
   */
  _playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.3) {
    if (this.isMuted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(gainVal, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + duration + 0.05);
    } catch (e) {
      // Graceful error ignore on unsupported environments
    }
  }

  /**
   * Play tile slide whoosh sound.
   */
  playSlide() {
    if (this.isMuted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {}
  }

  /**
   * Play tile merge chime sound.
   * Frequency scales melodically with tile value.
   * @param {number} value Tile value (4, 8, 16, 32, ..., 2048)
   */
  playMerge(value = 4) {
    if (this.isMuted || !this.ctx) return;
    try {
      const baseFreqs = {
        4: 330,    // E4
        8: 392,    // G4
        16: 440,   // A4
        32: 523,   // C5
        64: 587,   // D5
        128: 659,  // E5
        256: 784,  // G5
        512: 880,  // A5
        1024: 988, // B5
        2048: 1046 // C6
      };

      const freq = baseFreqs[value] || (600 + Math.min(value, 4096) * 0.15);
      const now = this.ctx.currentTime;

      // Primary tone
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, now);

      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.28, now + 0.015);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc1.connect(gain1);
      gain1.connect(this.masterGain);
      osc1.start(now);
      osc1.stop(now + 0.18);

      // Harmonic shimmer for tiles >= 128
      if (value >= 128) {
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(freq * 1.5, now + 0.02);

        gain2.gain.setValueAtTime(0, now + 0.02);
        gain2.gain.linearRampToValueAtTime(0.15, now + 0.04);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc2.connect(gain2);
        gain2.connect(this.masterGain);
        osc2.start(now + 0.02);
        osc2.stop(now + 0.25);
      }
    } catch (e) {}
  }

  /**
   * Play undo action sound (short rewind blip).
   */
  playUndo() {
    if (this.isMuted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.09);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch (e) {}
  }

  /**
   * Play snake food collection sound (crisp retro 8-bit chime/bite).
   */
  playEat() {
    if (this.isMuted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = 'square';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {}
  }

  /**
   * Play victory fanfare arpeggio on reaching 2048.
   */
  playWin() {
    if (this.isMuted || !this.ctx) return;
    // Arpeggio notes: C5, E5, G5, C6
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, index) => {
      setTimeout(() => {
        this._playTone(freq, 'triangle', 0.22, 0.35);
      }, index * 90);
    });
  }

  /**
   * Play game-over sound (melancholic descending tone).
   */
  playGameOver() {
    if (this.isMuted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(75, now + 0.4);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.45);
    } catch (e) {}
  }

  /**
   * Play general UI button click.
   */
  playClick() {
    this._playTone(550, 'sine', 0.04, 0.12);
  }
}

// Global audio singleton
const audio = new AudioManager();

if (typeof window !== 'undefined') {
  window.AudioManager = AudioManager;
  window.arcadeAudio = audio;
}

export { AudioManager, audio };
