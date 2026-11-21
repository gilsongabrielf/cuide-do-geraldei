/**
 * Sintetizador leve de efeitos sonoros com Web Audio API.
 * Seguro contra navegadores sem suporte ou contexto bloqueado antes da primeira interação.
 */

export class SoundManager {
  constructor(enabled = true) {
    this.enabled = Boolean(enabled);
    this.ctx = null;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  }

  ensureContext() {
    if (!this.enabled) return null;
    if (typeof window === "undefined") return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    try {
      if (!this.ctx) {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  tone(freq, duration = 0.12, { type = "sine", volume = 0.08, delay = 0, slideTo = null } = {}) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const start = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
      }

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    } catch {
      // ignora silenciosamente erros de áudio
    }
  }

  play(name) {
    if (!this.enabled) return;
    switch (name) {
      case "pet":
        this.tone(520, 0.11, { type: "sine", volume: 0.07, slideTo: 690 });
        this.tone(690, 0.14, { type: "triangle", volume: 0.06, delay: 0.09, slideTo: 840 });
        break;
      case "eat":
        this.tone(240, 0.08, { type: "triangle", volume: 0.09, slideTo: 180 });
        this.tone(310, 0.09, { type: "triangle", volume: 0.08, delay: 0.1, slideTo: 220 });
        this.tone(420, 0.12, { type: "sine", volume: 0.07, delay: 0.2, slideTo: 560 });
        break;
      case "bubble":
        this.tone(440 + Math.random() * 240, 0.09, { type: "sine", volume: 0.05, slideTo: 880 });
        break;
      case "rinse":
        this.tone(360, 0.14, { type: "sine", volume: 0.06, slideTo: 620 });
        this.tone(540, 0.16, { type: "sine", volume: 0.06, delay: 0.1, slideTo: 780 });
        break;
      case "coin":
        this.tone(880, 0.08, { type: "sine", volume: 0.07 });
        this.tone(1174, 0.16, { type: "triangle", volume: 0.07, delay: 0.07 });
        break;
      case "levelup":
        this.tone(523, 0.1, { type: "triangle", volume: 0.08, delay: 0 });
        this.tone(659, 0.1, { type: "triangle", volume: 0.08, delay: 0.1 });
        this.tone(784, 0.12, { type: "triangle", volume: 0.08, delay: 0.2 });
        this.tone(1046, 0.24, { type: "sine", volume: 0.09, delay: 0.32 });
        break;
      case "bounce":
        this.tone(260, 0.11, { type: "sine", volume: 0.08, slideTo: 520 });
        break;
      case "grumpy":
        this.tone(210, 0.16, { type: "sawtooth", volume: 0.04, slideTo: 135 });
        break;
      case "sleep":
        this.tone(420, 0.2, { type: "sine", volume: 0.05, slideTo: 290 });
        break;
      default:
        this.tone(540, 0.07, { type: "sine", volume: 0.05 });
        break;
    }
  }
}
