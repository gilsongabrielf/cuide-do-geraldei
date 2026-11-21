/**
 * Módulo de persistência em localStorage com tratamento robusto de erros:
 * - JSON corrompido ou truncado
 * - localStorage indisponível (modo privado / SecurityError)
 * - QuotaExceededError ao salvar
 * - Cálculo automático de queda das barras pelo tempo decorrido ao reabrir
 */

import { STORAGE_KEY } from "./constants.js";
import { applyTimeDecay, createInitialState, sanitizeState } from "./state.js";

function resolveStorage(customStorage) {
  if (customStorage !== undefined) {
    return customStorage;
  }
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function isStorageAvailable(customStorage) {
  const storage = resolveStorage(customStorage);
  if (!storage) return false;
  try {
    const probeKey = `${STORAGE_KEY}__probe`;
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

export function saveGameState(state, { storage: customStorage, key = STORAGE_KEY, now = Date.now() } = {}) {
  const storage = resolveStorage(customStorage);
  if (!storage) {
    return {
      ok: false,
      error: "Armazenamento local indisponível neste navegador.",
    };
  }

  try {
    const payload = {
      ...state,
      lastUpdatedAt: Number.isFinite(now) ? now : Date.now(),
    };
    storage.setItem(key, JSON.stringify(payload));
    return { ok: true, error: null };
  } catch (err) {
    const message =
      err && err.name === "QuotaExceededError"
        ? "Espaço do localStorage esgotado."
        : "Não foi possível salvar o progresso localmente.";
    return { ok: false, error: message };
  }
}

export function loadGameState({ storage: customStorage, key = STORAGE_KEY, now = Date.now() } = {}) {
  const currentNow = Number.isFinite(now) ? now : Date.now();
  const storage = resolveStorage(customStorage);

  if (!storage) {
    return {
      state: createInitialState(currentNow),
      restored: false,
      recoveredFromError: false,
      storageAvailable: false,
      elapsedMs: 0,
      warning: "localStorage indisponível; jogando em modo temporário.",
    };
  }

  let rawText = null;
  try {
    rawText = storage.getItem(key);
  } catch {
    return {
      state: createInitialState(currentNow),
      restored: false,
      recoveredFromError: true,
      storageAvailable: false,
      elapsedMs: 0,
      warning: "Acesso ao localStorage bloqueado; usando estado padrão.",
    };
  }

  if (!rawText) {
    return {
      state: createInitialState(currentNow),
      restored: false,
      recoveredFromError: false,
      storageAvailable: true,
      elapsedMs: 0,
      warning: null,
    };
  }

  let parsed = null;
  try {
    parsed = JSON.parse(rawText);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Formato de save inválido");
    }
  } catch {
    // Limpa dado corrompido com segurança e inicia novo jogo sem quebrar a UI
    try {
      storage.removeItem(key);
    } catch {
      // ignora erro secundário
    }
    return {
      state: createInitialState(currentNow),
      restored: false,
      recoveredFromError: true,
      storageAvailable: true,
      elapsedMs: 0,
      warning: "Save anterior estava corrompido e foi restaurado com segurança.",
    };
  }

  const sanitized = sanitizeState(parsed, currentNow);
  const rawElapsed = currentNow - sanitized.lastUpdatedAt;
  const elapsedMs = Number.isFinite(rawElapsed) && rawElapsed > 0 ? rawElapsed : 0;
  const decayedState = applyTimeDecay(sanitized, elapsedMs, currentNow);

  return {
    state: decayedState,
    restored: true,
    recoveredFromError: false,
    storageAvailable: true,
    elapsedMs,
    warning: null,
  };
}

export function clearGameState({ storage: customStorage, key = STORAGE_KEY } = {}) {
  const storage = resolveStorage(customStorage);
  if (!storage) return { ok: false, error: "localStorage indisponível." };
  try {
    storage.removeItem(key);
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "Falha ao limpar o save local." };
  }
}
