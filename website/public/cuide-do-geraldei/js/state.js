/**
 * Módulo de estado puro do jogo "Cuide do Geraldei".
 * Todas as funções são determinísticas e livres de efeitos colaterais de DOM,
 * facilitando testes unitários e manutenção.
 */

import {
  CATALOG,
  DECAY_RATES_PER_MINUTE,
  IGNORED_TIMEOUT_MS,
  MOOD_BOOST_DURATION_MS,
  SCHEMA_VERSION,
  STAT_BOUNDS,
  STAT_KEYS,
  findCatalogItem,
  xpRequiredForLevel,
} from "./constants.js";

export function clampStat(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return STAT_BOUNDS.MIN;
  return Math.max(STAT_BOUNDS.MIN, Math.min(STAT_BOUNDS.MAX, num));
}

export function roundStat(value) {
  return Math.round(clampStat(value) * 100) / 100;
}

export function createInitialState(now = Date.now()) {
  const timestamp = Number.isFinite(now) ? now : Date.now();
  return {
    schemaVersion: SCHEMA_VERSION,
    level: 1,
    xp: 0,
    coins: 90,
    stats: {
      hunger: 82,
      happiness: 84,
      energy: 86,
      hygiene: 85,
    },
    isSleeping: false,
    bathFoam: 0,
    inventory: {
      food: {
        kibble: 4,
        "bone-biscuit": 3,
        "sausage-snack": 2,
      },
      hygiene: {
        "puppy-shampoo": 2,
      },
      accessories: ["collar-red"],
    },
    equipped: {
      head: null,
      eyes: null,
      neck: "collar-red",
    },
    preferences: {
      soundEnabled: true,
      seriousStyle: "sticker", // "sticker" | "portrait"
    },
    moodOverride: null, // { mood: "affectionate"|"playful"|"grumpy", until: number }
    highScores: {
      catch: 0,
      jump: 0,
    },
    lastInteractionAt: timestamp,
    lastUpdatedAt: timestamp,
    lastPetCoinAt: 0,
  };
}

/**
 * Clona profundamente o estado do jogo (estruturas JSON-safe).
 */
export function cloneState(state) {
  return structuredClone(state);
}

/**
 * Aplica a queda (ou recuperação, no caso de energia dormindo) proporcional ao tempo decorrido.
 * Funciona tanto para ticks em tempo real quanto para tempo offline ao reabrir o jogo.
 */
export function applyTimeDecay(state, elapsedMs, now = null) {
  const next = cloneState(state);
  const safeElapsedMs = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;

  if (safeElapsedMs > 0) {
    const elapsedMinutes = safeElapsedMs / 60_000;
    const rates = next.isSleeping
      ? DECAY_RATES_PER_MINUTE.sleeping
      : DECAY_RATES_PER_MINUTE.awake;

    for (const key of STAT_KEYS) {
      next.stats[key] = roundStat(next.stats[key] + rates[key] * elapsedMinutes);
    }
  }

  if (Number.isFinite(now)) {
    next.lastUpdatedAt = Math.max(next.lastUpdatedAt || 0, now);
  } else if (safeElapsedMs > 0) {
    next.lastUpdatedAt = (next.lastUpdatedAt || 0) + safeElapsedMs;
  }

  if (next.moodOverride && next.lastUpdatedAt >= next.moodOverride.until) {
    next.moodOverride = null;
  }

  return next;
}

/**
 * Calcula o estado emocional e visual atual do Geraldei.
 * Prioridade:
 * 1. Override temporário recente (carinho, presente, vitória/minijogo, reclamação)
 * 2. Dormindo -> postura serena/sonolenta
 * 3. Barra crítica ou baixa -> sério/emburrado ou carente
 * 4. Ignorado por tempo prolongado -> sério/emburrado
 * 5. Barras saudáveis -> brincalhão/animado
 */
export function computeMood(state, now = Date.now()) {
  const timestamp = Number.isFinite(now) ? now : Date.now();
  const { hunger, happiness, energy, hygiene } = state.stats;
  const lowestStat = Math.min(hunger, happiness, energy, hygiene);

  if (state.moodOverride && timestamp < state.moodOverride.until) {
    const forced = state.moodOverride.mood;
    return {
      mood: forced,
      stance: forced === "grumpy" ? "firm" : forced === "affectionate" ? "warm" : "playful",
      reason: "interaction",
    };
  }

  if (state.isSleeping) {
    return {
      mood: "sleeping",
      stance: "resting",
      reason: "sleeping",
    };
  }

  if (lowestStat <= STAT_BOUNDS.CRITICAL_THRESHOLD) {
    return {
      mood: "grumpy",
      stance: "firm",
      reason: "critical-stat",
    };
  }

  if (lowestStat < STAT_BOUNDS.LOW_THRESHOLD) {
    // Se higiene ou felicidade estiverem baixas, fica emburrado; se fome/energia baixas, alterna para carente/sério
    const isGrumpyCause =
      hygiene < STAT_BOUNDS.LOW_THRESHOLD || happiness < STAT_BOUNDS.LOW_THRESHOLD;
    return {
      mood: isGrumpyCause ? "grumpy" : "needy",
      stance: "firm",
      reason: "low-stat",
    };
  }

  const idleMs = timestamp - (state.lastInteractionAt || timestamp);
  if (idleMs >= IGNORED_TIMEOUT_MS) {
    return {
      mood: "grumpy",
      stance: "firm",
      reason: "ignored",
    };
  }

  return {
    mood: "playful",
    stance: "playful",
    reason: "happy",
  };
}

/**
 * Adiciona XP e processa eventuais subidas de nível com bônus de moedas.
 */
export function addXp(state, amount, now = Date.now()) {
  const next = cloneState(state);
  const gain = Math.max(0, Math.floor(Number(amount) || 0));
  if (gain <= 0) {
    return { state: next, leveledUp: false, levelsGained: 0, bonusCoins: 0 };
  }

  next.xp += gain;
  let levelsGained = 0;
  let bonusCoins = 0;

  while (next.xp >= xpRequiredForLevel(next.level)) {
    next.xp -= xpRequiredForLevel(next.level);
    next.level += 1;
    levelsGained += 1;
    const reward = 25 + next.level * 5;
    next.coins += reward;
    bonusCoins += reward;
  }

  if (levelsGained > 0) {
    next.moodOverride = {
      mood: "playful",
      until: now + MOOD_BOOST_DURATION_MS.playful,
    };
  }

  return {
    state: next,
    leveledUp: levelsGained > 0,
    levelsGained,
    bonusCoins,
  };
}

/**
 * Alimenta o Geraldei com um item do inventário.
 */
export function feedPet(state, foodId, now = Date.now()) {
  const item = findCatalogItem("food", foodId);
  if (!item) {
    return { ok: false, error: "Alimento desconhecido.", state };
  }

  if (state.isSleeping) {
    return { ok: false, error: "Acorde o Geraldei antes de alimentá-lo!", state };
  }

  const qty = Number(state.inventory?.food?.[foodId] || 0);
  if (qty <= 0) {
    return { ok: false, error: "Sem estoque desse alimento. Compre na Loja!", state };
  }

  let next = cloneState(state);
  next.inventory.food[foodId] = qty - 1;
  if (next.inventory.food[foodId] <= 0) {
    delete next.inventory.food[foodId];
  }

  next.stats.hunger = roundStat(next.stats.hunger + item.hunger);
  next.stats.happiness = roundStat(next.stats.happiness + item.happiness);
  next.stats.energy = roundStat(next.stats.energy + item.energy);
  next.lastInteractionAt = now;
  next.lastUpdatedAt = now;

  // Petiscos gourmet ou carinho ao comer deixam super feliz/carinhoso
  const isSpecialTreat = item.id === "calabresa-special" || item.id === "dog-cake";
  next.moodOverride = {
    mood: isSpecialTreat ? "affectionate" : "playful",
    until: now + (isSpecialTreat ? MOOD_BOOST_DURATION_MS.affectionate : MOOD_BOOST_DURATION_MS.playful),
  };

  const xpResult = addXp(next, item.xp, now);
  return {
    ok: true,
    item,
    state: xpResult.state,
    leveledUp: xpResult.leveledUp,
    bonusCoins: xpResult.bonusCoins,
  };
}

/**
 * Faz carinho no Geraldei: ativa estado carinhoso/apaixonado, sobe felicidade e dá XP.
 */
export function petGeraldei(state, now = Date.now()) {
  if (state.isSleeping) {
    return { ok: false, error: "Geraldei está dormindo tranquilo. Toque em Dormir para acordá-lo.", state };
  }

  let next = cloneState(state);
  next.stats.happiness = roundStat(next.stats.happiness + 6);
  next.lastInteractionAt = now;
  next.lastUpdatedAt = now;
  next.moodOverride = {
    mood: "affectionate",
    until: now + MOOD_BOOST_DURATION_MS.affectionate,
  };

  let coinsGained = 0;
  if (now - (next.lastPetCoinAt || 0) >= 8_000) {
    coinsGained = 3;
    next.coins += coinsGained;
    next.lastPetCoinAt = now;
  }

  const xpResult = addXp(next, 5, now);
  return {
    ok: true,
    coinsGained,
    state: xpResult.state,
    leveledUp: xpResult.leveledUp,
    bonusCoins: xpResult.bonusCoins,
  };
}

/**
 * Interage com a bola do quarto para diversão rápida.
 */
export function playWithBall(state, now = Date.now()) {
  if (state.isSleeping) {
    return { ok: false, error: "Acorde o Geraldei para brincar com a bola!", state };
  }
  if (state.stats.energy < 8) {
    let grumpy = cloneState(state);
    grumpy.moodOverride = { mood: "grumpy", until: now + MOOD_BOOST_DURATION_MS.grumpy };
    grumpy.lastInteractionAt = now;
    return { ok: false, error: "Geraldei está cansado demais. Hora de dormir!", state: grumpy };
  }

  let next = cloneState(state);
  next.stats.happiness = roundStat(next.stats.happiness + 9);
  next.stats.energy = roundStat(next.stats.energy - 3);
  next.coins += 2;
  next.lastInteractionAt = now;
  next.lastUpdatedAt = now;
  next.moodOverride = {
    mood: "playful",
    until: now + MOOD_BOOST_DURATION_MS.playful,
  };

  const xpResult = addXp(next, 6, now);
  return {
    ok: true,
    coinsGained: 2,
    state: xpResult.state,
    leveledUp: xpResult.leveledUp,
    bonusCoins: xpResult.bonusCoins,
  };
}

/**
 * Aplica esfregação da esponja com shampoo no banho.
 * Sobe a espuma (`bathFoam`) e já recupera parcialmente a higiene.
 */
export function applyBathScrub(state, intensity = 14, now = Date.now()) {
  if (state.isSleeping) {
    return { ok: false, error: "Acorde o Geraldei antes do banho!", state };
  }

  const amount = Math.max(1, Math.min(35, Number(intensity) || 14));
  const next = cloneState(state);
  next.bathFoam = roundStat((next.bathFoam || 0) + amount);
  next.stats.hygiene = roundStat(next.stats.hygiene + amount * 0.25);
  next.lastInteractionAt = now;
  next.lastUpdatedAt = now;

  return {
    ok: true,
    foam: next.bathFoam,
    state: next,
  };
}

/**
 * Enxágua a espuma com o chuveirinho, aplicando bônus de shampoo se selecionado.
 */
export function applyBathRinse(state, shampooId = null, now = Date.now()) {
  if (state.isSleeping) {
    return { ok: false, error: "Acorde o Geraldei antes do banho!", state };
  }

  let next = cloneState(state);
  const foam = Number(next.bathFoam || 0);
  const shampoo = shampooId ? findCatalogItem("hygiene", shampooId) : null;
  let usedShampoo = null;

  if (shampoo && Number(next.inventory?.hygiene?.[shampoo.id] || 0) > 0) {
    next.inventory.hygiene[shampoo.id] -= 1;
    if (next.inventory.hygiene[shampoo.id] <= 0) {
      delete next.inventory.hygiene[shampoo.id];
    }
    usedShampoo = shampoo;
  }

  const baseClean = foam > 0 ? Math.max(16, foam * 0.45) : 12;
  const bonusClean = usedShampoo ? usedShampoo.hygieneBonus : 0;
  const happinessGain = (usedShampoo ? usedShampoo.happiness : 5) + (foam >= 50 ? 6 : 0);
  const xpGain = (usedShampoo ? usedShampoo.xp : 8) + (foam >= 50 ? 6 : 0);

  next.bathFoam = 0;
  next.stats.hygiene = roundStat(next.stats.hygiene + baseClean + bonusClean);
  next.stats.happiness = roundStat(next.stats.happiness + happinessGain);
  next.lastInteractionAt = now;
  next.lastUpdatedAt = now;
  next.moodOverride = {
    mood: "affectionate",
    until: now + MOOD_BOOST_DURATION_MS.affectionate,
  };

  const xpResult = addXp(next, xpGain, now);
  return {
    ok: true,
    usedShampoo,
    hygieneRecovered: Math.round(baseClean + bonusClean),
    state: xpResult.state,
    leveledUp: xpResult.leveledUp,
    bonusCoins: xpResult.bonusCoins,
  };
}

/**
 * Alterna o modo dormir (escurece o quarto e regenera energia).
 */
export function toggleSleep(state, now = Date.now()) {
  const next = cloneState(state);
  next.isSleeping = !next.isSleeping;
  next.lastInteractionAt = now;
  next.lastUpdatedAt = now;
  if (!next.isSleeping && next.stats.energy >= 75) {
    next.moodOverride = {
      mood: "playful",
      until: now + MOOD_BOOST_DURATION_MS.playful,
    };
  }
  return {
    ok: true,
    isSleeping: next.isSleeping,
    state: next,
  };
}

/**
 * Compra um item na Loja canina usando Coins.
 */
export function buyItem(state, category, itemId, now = Date.now()) {
  const item = findCatalogItem(category, itemId);
  if (!item) {
    return { ok: false, error: "Item não encontrado na loja.", state };
  }

  if (category === "accessories" && state.inventory.accessories.includes(itemId)) {
    return { ok: false, error: "Você já possui este acessório!", state };
  }

  if (state.coins < item.price) {
    return {
      ok: false,
      error: `Moedas insuficientes! Precisa de ${item.price} Coins.`,
      state,
    };
  }

  let next = cloneState(state);
  next.coins -= item.price;
  next.lastInteractionAt = now;
  next.lastUpdatedAt = now;

  if (category === "food") {
    next.inventory.food[itemId] = (next.inventory.food[itemId] || 0) + 1;
  } else if (category === "hygiene") {
    next.inventory.hygiene[itemId] = (next.inventory.hygiene[itemId] || 0) + 1;
  } else if (category === "accessories") {
    next.inventory.accessories.push(itemId);
    // Receber presente deixa o Geraldei apaixonado/carinhoso!
    next.moodOverride = {
      mood: "affectionate",
      until: now + MOOD_BOOST_DURATION_MS.affectionate,
    };
  }

  const xpResult = addXp(next, category === "accessories" ? 14 : 4, now);
  return {
    ok: true,
    item,
    state: xpResult.state,
    leveledUp: xpResult.leveledUp,
    bonusCoins: xpResult.bonusCoins,
  };
}

/**
 * Equipa ou desequipa um acessório canino no guarda-roupa.
 */
export function equipAccessory(state, accessoryId, now = Date.now()) {
  const item = findCatalogItem("accessories", accessoryId);
  if (!item) {
    return { ok: false, error: "Acessório inválido.", state };
  }

  if (!state.inventory.accessories.includes(accessoryId)) {
    return { ok: false, error: "Compre este acessório na Loja primeiro!", state };
  }

  const next = cloneState(state);
  const current = next.equipped[item.slot];
  const equippedNow = current === accessoryId ? null : accessoryId;
  next.equipped[item.slot] = equippedNow;
  next.lastInteractionAt = now;
  next.lastUpdatedAt = now;

  if (equippedNow) {
    next.moodOverride = {
      mood: "affectionate",
      until: now + MOOD_BOOST_DURATION_MS.affectionate,
    };
  }

  return {
    ok: true,
    equipped: equippedNow !== null,
    item,
    state: next,
  };
}

/**
 * Alterna o estilo visual usado na postura séria/emburrada ("sticker" | "portrait").
 */
export function setSeriousStyle(state, style) {
  const valid = style === "portrait" ? "portrait" : "sticker";
  const next = cloneState(state);
  next.preferences.seriousStyle = valid;
  return next;
}

/**
 * Aplica recompensas ao finalizar um minijogo (Coins, Felicidade, XP e recorde).
 */
export function applyMinigameReward(
  state,
  { gameId = "catch", score = 0, coinsEarned = 0, happinessGain = 0, xpGain = 0 } = {},
  now = Date.now(),
) {
  let next = cloneState(state);
  const safeScore = Math.max(0, Math.floor(Number(score) || 0));
  const safeCoins = Math.max(0, Math.floor(Number(coinsEarned) || 0));
  const safeHappiness = Math.max(0, Number(happinessGain) || 0);
  const safeXp = Math.max(0, Math.floor(Number(xpGain) || 0));

  next.isSleeping = false;
  next.coins += safeCoins;
  next.stats.happiness = roundStat(next.stats.happiness + safeHappiness);
  next.stats.energy = roundStat(next.stats.energy - Math.min(12, Math.max(3, Math.floor(safeScore / 6))));
  next.stats.hunger = roundStat(next.stats.hunger - Math.min(8, Math.max(2, Math.floor(safeScore / 10))));
  next.lastInteractionAt = now;
  next.lastUpdatedAt = now;

  const isNewRecord = safeScore > (next.highScores[gameId] || 0);
  if (isNewRecord) {
    next.highScores[gameId] = safeScore;
  }

  next.moodOverride = {
    mood: "playful",
    until: now + MOOD_BOOST_DURATION_MS.playful,
  };

  const xpResult = addXp(next, safeXp, now);
  return {
    ok: true,
    isNewRecord,
    coinsEarned: safeCoins,
    state: xpResult.state,
    leveledUp: xpResult.leveledUp,
    bonusCoins: xpResult.bonusCoins,
  };
}

/**
 * Valida e sanitiza qualquer objeto carregado (ex.: do localStorage),
 * garantindo que valores corrompidos nunca quebrem o jogo.
 */
export function sanitizeState(raw, now = Date.now()) {
  const base = createInitialState(now);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }

  const safeNumber = (val, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) => {
    const num = Number(val);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(min, Math.min(max, num));
  };

  const next = cloneState(base);
  next.level = Math.floor(safeNumber(raw.level, base.level, 1, 999));
  next.xp = Math.floor(safeNumber(raw.xp, base.xp, 0, xpRequiredForLevel(next.level) * 10));
  next.coins = Math.floor(safeNumber(raw.coins, base.coins, 0, 9_999_999));
  next.isSleeping = Boolean(raw.isSleeping);
  next.bathFoam = roundStat(safeNumber(raw.bathFoam, 0, 0, 100));

  if (raw.stats && typeof raw.stats === "object") {
    for (const key of STAT_KEYS) {
      next.stats[key] = roundStat(safeNumber(raw.stats[key], base.stats[key], 0, 100));
    }
  }

  if (raw.inventory && typeof raw.inventory === "object") {
    const cleanQtyMap = (source, category) => {
      const result = {};
      if (!source || typeof source !== "object") return result;
      for (const item of CATALOG[category]) {
        const qty = Math.floor(safeNumber(source[item.id], 0, 0, 999));
        if (qty > 0) result[item.id] = qty;
      }
      return result;
    };

    next.inventory.food = cleanQtyMap(raw.inventory.food, "food");
    next.inventory.hygiene = cleanQtyMap(raw.inventory.hygiene, "hygiene");

    if (Array.isArray(raw.inventory.accessories)) {
      const validIds = new Set(CATALOG.accessories.map((a) => a.id));
      const owned = new Set(["collar-red"]);
      for (const id of raw.inventory.accessories) {
        if (typeof id === "string" && validIds.has(id)) owned.add(id);
      }
      next.inventory.accessories = [...owned];
    }
  }

  if (raw.equipped && typeof raw.equipped === "object") {
    for (const slot of ["head", "eyes", "neck"]) {
      const id = raw.equipped[slot];
      const item = findCatalogItem("accessories", id);
      if (item && item.slot === slot && next.inventory.accessories.includes(id)) {
        next.equipped[slot] = id;
      } else {
        next.equipped[slot] = slot === "neck" && id === null ? null : next.equipped[slot];
      }
    }
  }

  if (raw.preferences && typeof raw.preferences === "object") {
    next.preferences.soundEnabled =
      typeof raw.preferences.soundEnabled === "boolean"
        ? raw.preferences.soundEnabled
        : base.preferences.soundEnabled;
    next.preferences.seriousStyle =
      raw.preferences.seriousStyle === "portrait" ? "portrait" : "sticker";
  }

  if (raw.highScores && typeof raw.highScores === "object") {
    next.highScores.catch = Math.floor(safeNumber(raw.highScores.catch, 0, 0, 999_999));
    next.highScores.jump = Math.floor(safeNumber(raw.highScores.jump, 0, 0, 999_999));
  }

  next.lastUpdatedAt = safeNumber(raw.lastUpdatedAt, now, 0, now + 60_000);
  next.lastInteractionAt = safeNumber(raw.lastInteractionAt, next.lastUpdatedAt, 0, now + 60_000);
  next.lastPetCoinAt = safeNumber(raw.lastPetCoinAt, 0, 0, now + 60_000);

  return next;
}
