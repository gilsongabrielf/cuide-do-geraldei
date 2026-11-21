import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { IGNORED_TIMEOUT_MS, xpRequiredForLevel } from "../../website/public/cuide-do-geraldei/js/constants.js";
import {
  addXp,
  applyBathRinse,
  applyBathScrub,
  applyMinigameReward,
  buyItem,
  clampStat,
  computeMood,
  createInitialState,
  equipAccessory,
  feedPet,
  petGeraldei,
  playWithBall,
  setSeriousStyle,
  toggleSleep,
} from "../../website/public/cuide-do-geraldei/js/state.js";

describe("Estado do Geraldei — regras centrais e progressão", () => {
  test("clampStat limita valores entre 0 e 100 e trata NaN com segurança", () => {
    assert.equal(clampStat(55), 55);
    assert.equal(clampStat(-12), 0);
    assert.equal(clampStat(145), 100);
    assert.equal(clampStat(Number.NaN), 0);
    assert.equal(clampStat("invalido"), 0);
  });

  test("feedPet consome alimento do inventário, recupera Fome e bloqueia quando dormindo ou sem estoque", () => {
    const now = 1_700_000_000_000;
    const base = createInitialState(now);
    base.stats.hunger = 40;
    const initialQty = base.inventory.food["sausage-snack"];

    const fed = feedPet(base, "sausage-snack", now + 1_000);
    assert.equal(fed.ok, true);
    assert.equal(fed.state.stats.hunger, 74);
    assert.equal(fed.state.inventory.food["sausage-snack"], initialQty - 1);
    assert.equal(fed.state.moodOverride.mood, "playful");

    const sleeping = toggleSleep(fed.state, now + 2_000).state;
    const blockedSleep = feedPet(sleeping, "kibble", now + 3_000);
    assert.equal(blockedSleep.ok, false);

    const outOfStock = feedPet(base, "dog-cake", now + 4_000);
    assert.equal(outOfStock.ok, false);
  });

  test("petGeraldei ativa estado carinhoso/apaixonado, sobe Felicidade e respeita cooldown de moedas", () => {
    const now = 1_700_000_000_000;
    const base = createInitialState(now);
    base.stats.happiness = 60;

    const first = petGeraldei(base, now + 10_000);
    assert.equal(first.ok, true);
    assert.equal(first.coinsGained, 3);
    assert.equal(first.state.coins, base.coins + 3);
    assert.equal(first.state.stats.happiness, 66);
    assert.equal(computeMood(first.state, now + 10_500).mood, "affectionate");

    // Segundo carinho em seguida (dentro do cooldown de 8s) ainda dá felicidade mas não repete moeda
    const second = petGeraldei(first.state, now + 12_000);
    assert.equal(second.ok, true);
    assert.equal(second.coinsGained, 0);
    assert.equal(second.state.stats.happiness, 72);
  });

  test("banho com esponja e enxágue com shampoo recupera Higiene e consome shampoo do inventário", () => {
    const now = 1_700_000_000_000;
    const base = createInitialState(now);
    base.stats.hygiene = 30;
    const initialShampoo = base.inventory.hygiene["puppy-shampoo"];

    const scrubbed = applyBathScrub(base, 25, now + 500);
    assert.equal(scrubbed.ok, true);
    assert.equal(scrubbed.foam, 25);
    assert.ok(scrubbed.state.stats.hygiene > 30);

    const rinsed = applyBathRinse(scrubbed.state, "puppy-shampoo", now + 1_500);
    assert.equal(rinsed.ok, true);
    assert.equal(rinsed.state.bathFoam, 0);
    assert.equal(rinsed.state.inventory.hygiene["puppy-shampoo"], initialShampoo - 1);
    assert.ok(rinsed.state.stats.hygiene >= 65);
    assert.equal(computeMood(rinsed.state, now + 1_600).mood, "affectionate");
  });

  test("Loja e Guarda-roupa permitem comprar, equipar, desequipar e impedem compra duplicada ou sem Coins", () => {
    const now = 1_700_000_000_000;
    const base = createInitialState(now);
    base.coins = 100;

    const bought = buyItem(base, "accessories", "shades-cool", now + 1_000);
    assert.equal(bought.ok, true);
    assert.equal(bought.state.coins, 20);
    assert.ok(bought.state.inventory.accessories.includes("shades-cool"));
    assert.equal(computeMood(bought.state, now + 1_500).mood, "affectionate");

    // Compra duplicada bloqueada
    const dup = buyItem(bought.state, "accessories", "shades-cool", now + 2_000);
    assert.equal(dup.ok, false);

    // Saldo insuficiente bloqueado
    const broke = buyItem(bought.state, "accessories", "crown-royal", now + 2_500);
    assert.equal(broke.ok, false);

    // Equipar e desequipar
    const eq = equipAccessory(bought.state, "shades-cool", now + 3_000);
    assert.equal(eq.ok, true);
    assert.equal(eq.equipped, true);
    assert.equal(eq.state.equipped.eyes, "shades-cool");

    const uneq = equipAccessory(eq.state, "shades-cool", now + 3_500);
    assert.equal(uneq.ok, true);
    assert.equal(uneq.equipped, false);
    assert.equal(uneq.state.equipped.eyes, null);

    // Alternar estilo da postura séria
    const portrait = setSeriousStyle(uneq.state, "portrait");
    assert.equal(portrait.preferences.seriousStyle, "portrait");
  });

  test("addXp processa múltiplas subidas de nível com bônus de Coins e expressão brincalhona", () => {
    const now = 1_700_000_000_000;
    const base = createInitialState(now);
    const totalXp = xpRequiredForLevel(1) + xpRequiredForLevel(2) + 15;

    const res = addXp(base, totalXp, now + 1_000);
    assert.equal(res.leveledUp, true);
    assert.equal(res.levelsGained, 2);
    assert.equal(res.state.level, 3);
    assert.equal(res.state.xp, 15);
    assert.ok(res.bonusCoins > 0);
    assert.equal(res.state.coins, base.coins + res.bonusCoins);
    assert.equal(computeMood(res.state, now + 1_500).mood, "playful");
  });

  test("applyMinigameReward atualiza recorde, recompensa Coins/Felicidade e mantém humor brincalhão", () => {
    const now = 1_700_000_000_000;
    const base = createInitialState(now);
    base.stats.happiness = 50;

    const res = applyMinigameReward(
      base,
      { gameId: "catch", score: 24, coinsEarned: 33, happinessGain: 25, xpGain: 30 },
      now + 1_000,
    );
    assert.equal(res.ok, true);
    assert.equal(res.isNewRecord, true);
    assert.equal(res.state.highScores.catch, 24);
    assert.equal(res.state.coins, base.coins + 33 + res.bonusCoins);
    assert.equal(res.state.stats.happiness, 75);
    assert.equal(computeMood(res.state, now + 1_200).mood, "playful");
  });

  test("computeMood alterna corretamente entre brincalhão, sério/emburrado, carente e dormindo", () => {
    const now = 1_700_000_000_000;
    const healthy = createInitialState(now);
    assert.equal(computeMood(healthy, now + 1_000).mood, "playful");

    // Ignorado por mais de IGNORED_TIMEOUT_MS -> emburrado com postura firme
    const ignored = computeMood(healthy, now + IGNORED_TIMEOUT_MS + 5_000);
    assert.equal(ignored.mood, "grumpy");
    assert.equal(ignored.stance, "firm");

    // Higiene baixa -> emburrado
    const dirty = createInitialState(now);
    dirty.stats.hygiene = 25;
    assert.equal(computeMood(dirty, now + 1_000).mood, "grumpy");

    // Fome baixa (mas não crítica) -> carente com postura firme
    const hungry = createInitialState(now);
    hungry.stats.hunger = 26;
    const hungryMood = computeMood(hungry, now + 1_000);
    assert.equal(hungryMood.mood, "needy");
    assert.equal(hungryMood.stance, "firm");

    // Bola quando sem energia dispara recusa emburrada
    const tired = createInitialState(now);
    tired.stats.energy = 4;
    const ballRes = playWithBall(tired, now + 1_000);
    assert.equal(ballRes.ok, false);
    assert.equal(computeMood(ballRes.state, now + 1_100).mood, "grumpy");

    // Dormindo
    const sleeping = toggleSleep(healthy, now + 1_000).state;
    assert.equal(computeMood(sleeping, now + 2_000).mood, "sleeping");
  });
});
