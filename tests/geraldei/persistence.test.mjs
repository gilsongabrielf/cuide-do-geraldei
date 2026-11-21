import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  DECAY_RATES_PER_MINUTE,
  OFFICIAL_SPRITES,
  STORAGE_KEY,
} from "../../website/public/cuide-do-geraldei/js/constants.js";
import {
  clearGameState,
  isStorageAvailable,
  loadGameState,
  saveGameState,
} from "../../website/public/cuide-do-geraldei/js/persistence.js";
import { createInitialState } from "../../website/public/cuide-do-geraldei/js/state.js";

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => {
      store.set(k, String(v));
    },
    removeItem: (k) => {
      store.delete(k);
    },
  };
}

describe("Persistência em localStorage e integridade de sprites", () => {
  test("salva e recarrega estado aplicando queda das barras pelo tempo offline decorrido", () => {
    const storage = createMemoryStorage();
    const t0 = 1_700_000_000_000;
    const saved = createInitialState(t0);
    saved.level = 4;
    saved.coins = 250;
    saved.stats = { hunger: 90, happiness: 80, energy: 70, hygiene: 60 };
    saved.inventory.food["calabresa-special"] = 3;

    assert.equal(isStorageAvailable(storage), true);
    const saveRes = saveGameState(saved, { storage, now: t0 });
    assert.equal(saveRes.ok, true);

    // Reabre exatamente 40 minutos depois
    const elapsedMin = 40;
    const t1 = t0 + elapsedMin * 60_000;
    const loaded = loadGameState({ storage, now: t1 });

    assert.equal(loaded.restored, true);
    assert.equal(loaded.recoveredFromError, false);
    assert.equal(loaded.elapsedMs, elapsedMin * 60_000);
    assert.equal(loaded.state.level, 4);
    assert.equal(loaded.state.coins, 250);
    assert.equal(loaded.state.inventory.food["calabresa-special"], 3);
    assert.equal(
      loaded.state.stats.hunger,
      90 + DECAY_RATES_PER_MINUTE.awake.hunger * elapsedMin,
    );
    assert.equal(
      loaded.state.stats.happiness,
      80 + DECAY_RATES_PER_MINUTE.awake.happiness * elapsedMin,
    );
    assert.equal(
      loaded.state.stats.energy,
      70 + DECAY_RATES_PER_MINUTE.awake.energy * elapsedMin,
    );
    assert.equal(
      loaded.state.stats.hygiene,
      60 + DECAY_RATES_PER_MINUTE.awake.hygiene * elapsedMin,
    );
  });

  test("recupera com segurança quando o localStorage contém JSON corrompido ou formato inválido", () => {
    const storage = createMemoryStorage();
    storage.setItem(STORAGE_KEY, "{json_quebrado_sem_fechar");

    const now = 1_700_000_500_000;
    const loaded = loadGameState({ storage, now });

    assert.equal(loaded.restored, false);
    assert.equal(loaded.recoveredFromError, true);
    assert.ok(loaded.warning);
    assert.equal(loaded.state.level, 1);
    assert.equal(storage.getItem(STORAGE_KEY), null);
  });

  test("sanitiza campos corrompidos (NaN, negativos, itens inexistentes) sem perder o save", () => {
    const storage = createMemoryStorage();
    const now = 1_700_000_500_000;
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        level: -5,
        coins: "NaN",
        stats: { hunger: 999, happiness: -20, energy: "bad", hygiene: 50 },
        inventory: {
          food: { kibble: 2, "item-invalido": 99 },
          accessories: ["collar-red", "fantasma"],
        },
        lastUpdatedAt: now,
      }),
    );

    const loaded = loadGameState({ storage, now });
    assert.equal(loaded.restored, true);
    assert.equal(loaded.state.level, 1);
    assert.equal(loaded.state.coins, 90);
    assert.equal(loaded.state.stats.hunger, 100);
    assert.equal(loaded.state.stats.happiness, 0);
    assert.equal(loaded.state.stats.energy, 86);
    assert.equal(loaded.state.stats.hygiene, 50);
    assert.equal(loaded.state.inventory.food.kibble, 2);
    assert.equal(loaded.state.inventory.food["item-invalido"], undefined);
    assert.deepEqual(loaded.state.inventory.accessories, ["collar-red"]);
  });

  test("lida sem lançar exceções quando localStorage está indisponível ou lança QuotaExceededError", () => {
    const unavailable = loadGameState({ storage: null, now: 1_700_000_000_000 });
    assert.equal(unavailable.storageAvailable, false);
    assert.equal(unavailable.state.level, 1);

    const throwingStorage = {
      getItem() {
        throw new Error("SecurityError");
      },
      setItem() {
        const err = new Error("Quota");
        err.name = "QuotaExceededError";
        throw err;
      },
      removeItem() {
        throw new Error("SecurityError");
      },
    };

    assert.equal(isStorageAvailable(throwingStorage), false);
    const loadBlocked = loadGameState({ storage: throwingStorage, now: 1_700_000_000_000 });
    assert.equal(loadBlocked.storageAvailable, false);
    assert.equal(loadBlocked.recoveredFromError, true);

    const saveQuota = saveGameState(createInitialState(), { storage: throwingStorage });
    assert.equal(saveQuota.ok, false);
    assert.match(saveQuota.error, /esgotado/i);

    const clearBlocked = clearGameState({ storage: throwingStorage });
    assert.equal(clearBlocked.ok, false);
  });

  test("todos os sprites oficiais referenciados no manifesto existem no diretório do jogo", () => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const gameDir = path.resolve(__dirname, "../../website/public/cuide-do-geraldei");

    for (const spec of Object.values(OFFICIAL_SPRITES)) {
      const origPath = path.resolve(gameDir, spec.src);
      const cutoutPath = path.resolve(gameDir, spec.cutoutSrc);
      assert.equal(existsSync(origPath), true, `Sprite original ausente: ${spec.src}`);
      assert.equal(existsSync(cutoutPath), true, `Cutout ausente: ${spec.cutoutSrc}`);
    }
  });
});
