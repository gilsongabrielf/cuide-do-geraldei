/**
 * Ponto de entrada do jogo "Cuide do Geraldei".
 * Orquestra estado, persistência, sprites, renderização, mecânicas, minijogos e ciclo em tempo real.
 */

import { SoundManager } from "./audio.js";
import { GameMechanics } from "./mechanics.js";
import { MinigameManager } from "./minigames.js";
import { loadGameState, saveGameState } from "./persistence.js";
import { GameRenderer } from "./renderer.js";
import { SpriteManager } from "./sprites.js";
import { applyTimeDecay } from "./state.js";

async function bootstrap() {
  const spriteManager = new SpriteManager();
  const renderer = new GameRenderer(spriteManager);

  const loadResult = loadGameState();
  let currentState = loadResult.state;
  const audio = new SoundManager(currentState.preferences.soundEnabled);

  let saveWarned = false;
  const persistNow = () => {
    const res = saveGameState(currentState);
    if (!res.ok && !saveWarned) {
      saveWarned = true;
      renderer.showToast(res.error || "Não foi possível salvar localmente.", 3500);
    }
  };

  let mechanics = null;

  const updateState = (updater, { persist = true } = {}) => {
    currentState = updater(currentState);
    renderer.render(currentState);
    if (mechanics) mechanics.refreshOpenViews();
    if (persist) persistNow();
  };

  const minigames = new MinigameManager({
    getState: () => currentState,
    updateState,
    spriteManager,
    renderer,
    audio,
    onFinished: (res) => {
      renderer.triggerPetAnimation("jump");
      renderer.spawnParticles(["🌭", "🪙", "✨"], { count: 7 });
      if (res.leveledUp) {
        renderer.showToast(
          `🎉 Geraldei subiu para o Nível ${res.state.level}! +${res.bonusCoins} Coins!`,
          3600,
        );
      }
    },
  });

  mechanics = new GameMechanics({
    getState: () => currentState,
    updateState,
    renderer,
    audio,
    onOpenMinigames: () => minigames.open(),
  });

  // Render inicial imediato e pré-carregamento assíncrono dos sprites oficiais
  renderer.render(currentState);

  const spriteReport = await spriteManager.preloadAll();
  renderer.render(currentState);

  if (loadResult.warning) {
    renderer.showToast(loadResult.warning, 3600);
  } else if (loadResult.restored && loadResult.elapsedMs >= 120_000) {
    const mins = Math.round(loadResult.elapsedMs / 60_000);
    const label = mins >= 60 ? `${Math.round(mins / 60)}h` : `${mins} min`;
    renderer.showToast(`🐾 Bem-vindo de volta! Geraldei sentiu sua falta (${label}).`, 3200);
  } else if (spriteReport.errors.length > 0) {
    renderer.showToast(spriteReport.errors[0], 3500);
  }

  // Loop em tempo real: queda gradual das barras (1s) + alternância suave da piscadinha brincalhona
  let lastTickAt = Date.now();
  let lastSaveAt = lastTickAt;

  setInterval(() => {
    const now = Date.now();
    const elapsed = Math.max(0, now - lastTickAt);
    lastTickAt = now;

    currentState = applyTimeDecay(currentState, elapsed, now);
    renderer.render(currentState, now);

    // Autosave periódico a cada 10s
    if (now - lastSaveAt >= 10_000) {
      lastSaveAt = now;
      persistNow();
    }
  }, 1_000);

  // Alternância entre sprites brincalhões (2) e (3) — piscadela e língua
  setInterval(() => {
    renderer.advancePlayfulFrame();
    renderer.render(currentState);
  }, 1_450);

  // Salva ao trocar de aba ou fechar o navegador
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      persistNow();
    } else {
      const now = Date.now();
      const elapsed = Math.max(0, now - lastTickAt);
      lastTickAt = now;
      currentState = applyTimeDecay(currentState, elapsed, now);
      renderer.render(currentState, now);
    }
  });

  window.addEventListener("pagehide", () => persistNow());

  // Registra Service Worker para PWA apenas em HTTP/HTTPS
  if (
    "serviceWorker" in navigator &&
    (window.location.protocol === "https:" || window.location.protocol === "http:")
  ) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

bootstrap().catch((err) => {
  console.error("Erro ao inicializar Cuide do Geraldei:", err);
  const toast = document.getElementById("toastBanner");
  if (toast) {
    toast.textContent = "Ocorreu um erro ao iniciar o jogo. Recarregue a página.";
    toast.classList.remove("hidden");
  }
});
