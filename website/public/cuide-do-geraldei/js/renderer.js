/**
 * Módulo de renderização do HUD, quarto, personagem Geraldei, acessórios e partículas.
 */

import { CATALOG, STAT_BOUNDS, STAT_KEYS, xpRequiredForLevel } from "./constants.js";
import { computeMood } from "./state.js";

const MOOD_LABELS = Object.freeze({
  playful: "Brincalhão",
  affectionate: "Apaixonado",
  grumpy: "Emburrado",
  needy: "Carente",
  sleeping: "Dormindo",
});

export class GameRenderer {
  constructor(spriteManager) {
    this.sprites = spriteManager;
    this.playfulFrame = 0;
    this.lastSpriteUrl = null;
    this.toastTimer = null;
    this.mouthTimer = null;

    this.els = {
      app: document.getElementById("app"),
      moodBadge: document.getElementById("moodBadge"),
      levelValue: document.getElementById("levelValue"),
      xpFill: document.getElementById("xpFill"),
      coinsValue: document.getElementById("coinsValue"),
      shopCoinsValue: document.getElementById("shopCoinsValue"),
      soundToggleBtn: document.getElementById("soundToggleBtn"),
      petZone: document.getElementById("petZone"),
      petRig: document.getElementById("petRig"),
      geraldeiFaceImg: document.getElementById("geraldeiFaceImg"),
      foamLayer: document.getElementById("foamLayer"),
      foamFill: document.getElementById("foamFill"),
      particlesLayer: document.getElementById("particlesLayer"),
      toastBanner: document.getElementById("toastBanner"),
      petHint: document.getElementById("petHint"),
      dockSleepIcon: document.getElementById("dockSleepIcon"),
      dockSleepLabel: document.getElementById("dockSleepLabel"),
      dockSleepBtn: document.getElementById("dock-sleep"),
      roomStage: document.getElementById("roomStage"),
      roomBallBtn: document.getElementById("roomBallBtn"),
      highScoreCatch: document.getElementById("highScoreCatch"),
      highScoreJump: document.getElementById("highScoreJump"),
    };

    this.statEls = {};
    for (const key of STAT_KEYS) {
      this.statEls[key] = {
        card: document.querySelector(`.stat-card[data-stat="${key}"]`),
        text: document.getElementById(`statText-${key}`),
        fill: document.getElementById(`statFill-${key}`),
        wrap: document.getElementById(`statBarWrap-${key}`),
      };
    }

    this.accessoryEls = new Map();
    for (const acc of CATALOG.accessories) {
      const el = document.getElementById(`acc-${acc.id}`);
      if (el) this.accessoryEls.set(acc.id, el);
    }
  }

  advancePlayfulFrame() {
    this.playfulFrame = (this.playfulFrame + 1) % 2;
  }

  render(state, now = Date.now()) {
    const moodInfo = computeMood(state, now);

    // Dormindo / Acordado
    this.els.app.dataset.sleeping = String(Boolean(state.isSleeping));
    this.els.dockSleepIcon.textContent = state.isSleeping ? "☀️" : "🌙";
    this.els.dockSleepLabel.textContent = state.isSleeping ? "Acordar" : "Dormir";
    this.els.dockSleepBtn.classList.toggle("active", Boolean(state.isSleeping));

    // Nível, XP e Moedas
    const xpNeeded = xpRequiredForLevel(state.level);
    const xpPct = Math.min(100, Math.round((state.xp / xpNeeded) * 100));
    this.els.levelValue.textContent = `Nv. ${state.level}`;
    this.els.xpFill.style.width = `${xpPct}%`;
    this.els.coinsValue.textContent = String(state.coins);
    if (this.els.shopCoinsValue) {
      this.els.shopCoinsValue.textContent = String(state.coins);
    }

    // Som
    this.els.soundToggleBtn.textContent = state.preferences.soundEnabled ? "🔊" : "🔇";
    this.els.soundToggleBtn.setAttribute("aria-pressed", String(state.preferences.soundEnabled));

    // Recordes
    if (this.els.highScoreCatch) {
      this.els.highScoreCatch.textContent = String(state.highScores.catch || 0);
    }
    if (this.els.highScoreJump) {
      this.els.highScoreJump.textContent = String(state.highScores.jump || 0);
    }

    // 4 Barras de Status
    for (const key of STAT_KEYS) {
      const val = Math.round(state.stats[key]);
      const refs = this.statEls[key];
      if (!refs) continue;
      refs.text.textContent = `${val}%`;
      refs.fill.style.width = `${val}%`;
      refs.wrap.setAttribute("aria-valuenow", String(val));

      refs.fill.classList.remove("warn", "danger");
      if (val < STAT_BOUNDS.LOW_THRESHOLD) {
        refs.fill.classList.add("danger");
        refs.card.classList.add("is-low");
      } else if (val < 60) {
        refs.fill.classList.add("warn");
        refs.card.classList.remove("is-low");
      } else {
        refs.card.classList.remove("is-low");
      }
    }

    // Humor, postura e sprite oficial do Geraldei
    this.els.petZone.dataset.mood = moodInfo.mood;
    this.els.petZone.dataset.stance = moodInfo.stance;
    this.els.moodBadge.dataset.mood = moodInfo.mood;
    this.els.moodBadge.textContent = MOOD_LABELS[moodInfo.mood] || "Brincalhão";

    const sprite = this.sprites.resolveForMood(moodInfo.mood, {
      playfulFrame: this.playfulFrame,
      seriousStyle: state.preferences.seriousStyle,
    });

    if (sprite && sprite.resolvedUrl !== this.lastSpriteUrl) {
      this.lastSpriteUrl = sprite.resolvedUrl;
      this.els.geraldeiFaceImg.src = sprite.resolvedUrl;
      this.els.geraldeiFaceImg.alt = `Geraldei — ${sprite.label}`;
      this.els.geraldeiFaceImg.classList.toggle(
        "portrait-frame",
        sprite.id === "seriousPortrait",
      );
    }

    // Acessórios equipados
    const equippedIds = new Set(Object.values(state.equipped).filter(Boolean));
    for (const [id, el] of this.accessoryEls.entries()) {
      el.classList.toggle("hidden", !equippedIds.has(id));
    }

    // Espuma do banho
    this.renderFoam(state.bathFoam || 0);
  }

  renderFoam(foamAmount) {
    if (this.els.foamFill) {
      this.els.foamFill.style.width = `${Math.round(foamAmount)}%`;
    }

    const desiredCount = Math.min(18, Math.floor(foamAmount / 6));
    const container = this.els.foamLayer;
    if (!container) return;

    while (container.childElementCount > desiredCount) {
      container.lastElementChild.remove();
    }

    while (container.childElementCount < desiredCount) {
      const bubble = document.createElement("span");
      bubble.className = "foam-bubble";
      const size = 16 + ((container.childElementCount * 11) % 24);
      const left = 12 + ((container.childElementCount * 29) % 72);
      const top = 14 + ((container.childElementCount * 23) % 68);
      bubble.style.width = `${size}px`;
      bubble.style.height = `${size}px`;
      bubble.style.left = `${left}%`;
      bubble.style.top = `${top}%`;
      container.appendChild(bubble);
    }
  }

  triggerPetAnimation(type) {
    const rig = this.els.petRig;
    if (!rig) return;
    const classMap = {
      jump: "anim-jump",
      shake: "anim-shake",
      petting: "anim-petting",
    };
    const cls = classMap[type];
    if (!cls) return;

    rig.classList.remove("anim-jump", "anim-shake", "anim-petting");
    void rig.offsetWidth; // força reflow para reiniciar animação
    rig.classList.add(cls);
    setTimeout(() => rig.classList.remove(cls), 600);
  }

  setMouthState(mode, autoResetMs = 0) {
    if (this.mouthTimer) {
      clearTimeout(this.mouthTimer);
      this.mouthTimer = null;
    }
    this.els.petZone.dataset.mouth = mode;
    if (autoResetMs > 0) {
      this.mouthTimer = setTimeout(() => {
        this.els.petZone.dataset.mouth = "idle";
        this.mouthTimer = null;
      }, autoResetMs);
    }
  }

  bounceRoomBall() {
    const ball = this.els.roomBallBtn;
    if (!ball) return;
    ball.classList.remove("bouncing");
    void ball.offsetWidth;
    ball.classList.add("bouncing");
    setTimeout(() => ball.classList.remove("bouncing"), 700);
  }

  setHint(message) {
    if (!message) {
      this.els.petHint.classList.add("hidden");
      this.els.petHint.textContent = "";
      return;
    }
    this.els.petHint.textContent = message;
    this.els.petHint.classList.remove("hidden");
  }

  showToast(message, durationMs = 2600) {
    if (!message) return;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.els.toastBanner.textContent = message;
    this.els.toastBanner.classList.remove("hidden");
    this.toastTimer = setTimeout(() => {
      this.els.toastBanner.classList.add("hidden");
      this.toastTimer = null;
    }, durationMs);
  }

  spawnParticles(symbols, { count = 5, clientX = null, clientY = null, falling = false } = {}) {
    const stageRect = this.els.roomStage.getBoundingClientRect();
    const petRect = this.els.petZone.getBoundingClientRect();
    const baseX =
      clientX !== null ? clientX - stageRect.left : petRect.left - stageRect.left + petRect.width / 2;
    const baseY =
      clientY !== null ? clientY - stageRect.top : petRect.top - stageRect.top + petRect.height * 0.35;

    const list = Array.isArray(symbols) ? symbols : [symbols];
    for (let i = 0; i < count; i += 1) {
      const el = document.createElement("span");
      el.className = falling ? "particle particle-drop" : "particle";
      el.textContent = list[i % list.length];
      const jitterX = (Math.random() - 0.5) * 96;
      const jitterY = (Math.random() - 0.5) * 44;
      el.style.left = `${Math.max(16, Math.min(stageRect.width - 16, baseX + jitterX))}px`;
      el.style.top = `${Math.max(16, Math.min(stageRect.height - 24, baseY + jitterY))}px`;
      el.style.animationDelay = `${i * 55}ms`;
      this.els.particlesLayer.appendChild(el);
      setTimeout(() => el.remove(), 1150);
    }
  }
}
