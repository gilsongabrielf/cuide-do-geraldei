import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DECAY_RATES_PER_MINUTE } from "../../website/public/cuide-do-geraldei/js/constants.js";
import {
  applyTimeDecay,
  createInitialState,
  toggleSleep,
} from "../../website/public/cuide-do-geraldei/js/state.js";

describe("Cálculo de queda das barras com tempo decorrido", () => {
  test("acordado: aplica taxas exatas por minuto após 30 minutos", () => {
    const start = 1_700_000_000_000;
    const initial = createInitialState(start);
    initial.stats = { hunger: 80, happiness: 70, energy: 60, hygiene: 90 };

    const elapsedMinutes = 30;
    const after = applyTimeDecay(initial, elapsedMinutes * 60_000, start + elapsedMinutes * 60_000);

    assert.equal(after.stats.hunger, 80 + DECAY_RATES_PER_MINUTE.awake.hunger * elapsedMinutes);
    assert.equal(
      after.stats.happiness,
      70 + DECAY_RATES_PER_MINUTE.awake.happiness * elapsedMinutes,
    );
    assert.equal(after.stats.energy, 60 + DECAY_RATES_PER_MINUTE.awake.energy * elapsedMinutes);
    assert.equal(after.stats.hygiene, 90 + DECAY_RATES_PER_MINUTE.awake.hygiene * elapsedMinutes);
    assert.equal(after.lastUpdatedAt, start + elapsedMinutes * 60_000);
  });

  test("dormindo: regenera Energia até 100 e reduz queda das outras barras", () => {
    const start = 1_700_000_000_000;
    let state = createInitialState(start);
    state.stats = { hunger: 80, happiness: 80, energy: 20, hygiene: 80 };
    state = toggleSleep(state, start).state;

    const after10m = applyTimeDecay(state, 10 * 60_000, start + 10 * 60_000);
    assert.equal(after10m.stats.energy, 20 + DECAY_RATES_PER_MINUTE.sleeping.energy * 10);
    assert.ok(after10m.stats.hunger < 80);
    assert.ok(after10m.stats.hunger > 80 + DECAY_RATES_PER_MINUTE.awake.hunger * 10);

    // Após 60 minutos dormindo, energia satura exatamente em 100 (sem ultrapassar)
    const after60m = applyTimeDecay(state, 60 * 60_000, start + 60 * 60_000);
    assert.equal(after60m.stats.energy, 100);
  });

  test("tempo offline muito longo faz clamp exato em 0 sem gerar negativos", () => {
    const start = 1_700_000_000_000;
    const initial = createInitialState(start);
    const after24h = applyTimeDecay(initial, 24 * 60 * 60_000, start + 24 * 60 * 60_000);

    assert.equal(after24h.stats.hunger, 0);
    assert.equal(after24h.stats.happiness, 0);
    assert.equal(after24h.stats.energy, 0);
    assert.equal(after24h.stats.hygiene, 0);
  });

  test("ignora valores de tempo inválidos (negativo, 0 ou NaN) e limpa moodOverride expirado", () => {
    const start = 1_700_000_000_000;
    const initial = createInitialState(start);
    initial.moodOverride = { mood: "affectionate", until: start + 5_000 };

    const neg = applyTimeDecay(initial, -15_000, start);
    assert.deepEqual(neg.stats, initial.stats);
    assert.equal(neg.moodOverride.mood, "affectionate");

    const nan = applyTimeDecay(initial, Number.NaN, start);
    assert.deepEqual(nan.stats, initial.stats);

    const expired = applyTimeDecay(initial, 10_000, start + 10_000);
    assert.equal(expired.moodOverride, null);
  });
});
