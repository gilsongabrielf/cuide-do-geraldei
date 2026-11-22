/**
 * Configurações centrais, catálogo canino e manifesto oficial de sprites do jogo "Cuide do Geraldei".
 * Sem dependência de DOM para permitir importação direta em testes automatizados (Node.js ESM).
 */

export const STORAGE_KEY = "cuide_do_geraldei_save_v1";
export const SCHEMA_VERSION = 1;

export const STAT_KEYS = Object.freeze(["hunger", "happiness", "energy", "hygiene"]);

export const STAT_BOUNDS = Object.freeze({
  MIN: 0,
  MAX: 100,
  LOW_THRESHOLD: 35,
  CRITICAL_THRESHOLD: 18,
  HIGH_MOOD_THRESHOLD: 68,
});

/**
 * Taxas de variação por minuto.
 * Valores negativos representam queda gradual; positivos representam regeneração.
 */
export const DECAY_RATES_PER_MINUTE = Object.freeze({
  awake: Object.freeze({
    hunger: -0.6,
    happiness: -0.45,
    energy: -0.35,
    hygiene: -0.3,
  }),
  sleeping: Object.freeze({
    hunger: -0.22,
    happiness: -0.1,
    energy: 4.5,
    hygiene: -0.12,
  }),
});

/**
 * Tempo máximo (ms) sem interação para Geraldei demonstrar sinal de carência/ignorado.
 */
export const IGNORED_TIMEOUT_MS = 180_000;

/**
 * Duração padrão (ms) de expressões temporárias disparadas por ações (carinho, presente, vitória).
 */
export const MOOD_BOOST_DURATION_MS = Object.freeze({
  affectionate: 4_500,
  playful: 5_000,
  grumpy: 3_500,
});

/**
 * Manifesto oficial de sprites referenciando os arquivos originais enviados.
 * Cada sprite indica o arquivo oficial (.jpeg) e seu recorte transparente pré-processado (.png)
 * sem alterar qualquer feição do rosto do Geraldei.
 */
export const OFFICIAL_SPRITES = Object.freeze({
  affectionate: Object.freeze({
    id: "affectionate",
    label: "Carinhoso / Apaixonado",
    originalFile: "WhatsApp Image 2026-11-18 at 15.58.00 (4).jpeg",
    src: "./assets/sprites/WhatsApp Image 2026-11-18 at 15.58.00 (4).jpeg",
    cutoutSrc: "./assets/sprites/cutouts/affectionate.png",
  }),
  playfulA: Object.freeze({
    id: "playfulA",
    label: "Brincalhão / Animado (1)",
    originalFile: "WhatsApp Image 2026-11-18 at 15.58.00 (2).jpeg",
    src: "./assets/sprites/WhatsApp Image 2026-11-18 at 15.58.00 (2).jpeg",
    cutoutSrc: "./assets/sprites/cutouts/playful-1.png",
  }),
  playfulB: Object.freeze({
    id: "playfulB",
    label: "Brincalhão / Animado (2)",
    originalFile: "WhatsApp Image 2026-11-18 at 15.58.00 (3).jpeg",
    src: "./assets/sprites/WhatsApp Image 2026-11-18 at 15.58.00 (3).jpeg",
    cutoutSrc: "./assets/sprites/cutouts/playful-2.png",
  }),
  grumpy: Object.freeze({
    id: "grumpy",
    label: "Sério / Emburrado",
    originalFile: "geraldei-emburrado.jpeg",
    src: "./assets/sprites/geraldei-emburrado.jpeg",
    cutoutSrc: "./assets/sprites/cutouts/grumpy.png",
  }),
  needy: Object.freeze({
    id: "needy",
    label: "Carente / Com fome",
    originalFile: "geraldei-carente.jpeg",
    src: "./assets/sprites/geraldei-carente.jpeg",
    cutoutSrc: "./assets/sprites/cutouts/needy.png",
  }),
  seriousPortrait: Object.freeze({
    id: "seriousPortrait",
    label: "Postura Firme Clássica",
    originalFile: "geraldei-serio.jpeg",
    src: "./assets/sprites/geraldei-serio.jpeg",
    cutoutSrc: "./assets/sprites/geraldei-serio.jpeg",
  }),
  sleeping: Object.freeze({
    id: "sleeping",
    label: "Dormindo",
    originalFile: "geraldei-dormindo.jpg",
    src: "./assets/sprites/geraldei-dormindo.jpg",
    cutoutSrc: "./assets/sprites/cutouts/sleeping.png",
  }),
});

/**
 * Catálogo completo de itens temáticos de cachorro.
 * Fácil de estender: basta adicionar novos objetos em food, hygiene ou accessories.
 */
export const CATALOG = Object.freeze({
  food: Object.freeze([
    {
      id: "kibble",
      name: "Ração Crocante",
      icon: "🥣",
      price: 12,
      hunger: 20,
      happiness: 4,
      energy: 3,
      xp: 8,
      description: "Ração balanceada para buldog francês.",
    },
    {
      id: "bone-biscuit",
      name: "Biscoito Ossinho",
      icon: "🦴",
      price: 18,
      hunger: 26,
      happiness: 10,
      energy: 4,
      xp: 12,
      description: "Petisco crocante que o Geraldei adora.",
    },
    {
      id: "sausage-snack",
      name: "Linguiça Pet",
      icon: "🌭",
      price: 25,
      hunger: 34,
      happiness: 15,
      energy: 6,
      xp: 16,
      description: "Linguiça suculenta segura para cães.",
    },
    {
      id: "calabresa-special",
      name: "Calabresa Gourmet",
      icon: "🍖",
      price: 36,
      hunger: 46,
      happiness: 20,
      energy: 10,
      xp: 22,
      description: "A favorita do Geraldei nos dias especiais.",
    },
    {
      id: "dog-cake",
      name: "Bolo Canino",
      icon: "🎂",
      price: 55,
      hunger: 60,
      happiness: 30,
      energy: 15,
      xp: 30,
      description: "Festa garantida com pasta de amendoim pet.",
    },
  ]),
  hygiene: Object.freeze([
    {
      id: "puppy-shampoo",
      name: "Shampoo Neutro Pet",
      icon: "🧴",
      price: 16,
      hygieneBonus: 18,
      happiness: 6,
      xp: 10,
      description: "Limpeza suave sem arder os olhinhos.",
    },
    {
      id: "oat-shampoo",
      name: "Shampoo de Aveia",
      icon: "🫧",
      price: 28,
      hygieneBonus: 30,
      happiness: 12,
      xp: 16,
      description: "Deixa o pelo macio e super cheiroso.",
    },
    {
      id: "pet-perfume",
      name: "Colônia Canina",
      icon: "✨",
      price: 35,
      hygieneBonus: 38,
      happiness: 18,
      xp: 20,
      description: "Finalizador perfumado pós-banho.",
    },
  ]),
  accessories: Object.freeze([
    {
      id: "collar-red",
      slot: "neck",
      name: "Coleira Vermelha",
      icon: "🔴",
      price: 0,
      description: "Coleira clássica com pingente dourado.",
    },
    {
      id: "bandana-blue",
      slot: "neck",
      name: "Bandana Estilosa",
      icon: "🧣",
      price: 45,
      description: "Bandana azul de passeio no parque.",
    },
    {
      id: "bowtie-gold",
      slot: "neck",
      name: "Gravata Borboleta",
      icon: "🎀",
      price: 65,
      description: "Elegância máxima para o Geraldei.",
    },
    {
      id: "shades-cool",
      slot: "eyes",
      name: "Óculos Escuros",
      icon: "🕶️",
      price: 80,
      description: "Estilo puro com atitude de buldog.",
    },
    {
      id: "cap-street",
      slot: "head",
      name: "Boné Street",
      icon: "🧢",
      price: 90,
      description: "Boné descolado para os minijogos.",
    },
    {
      id: "crown-royal",
      slot: "head",
      name: "Coroa do Geraldei",
      icon: "👑",
      price: 150,
      description: "A majestade absoluta da casa.",
    },
  ]),
});

export function findCatalogItem(category, itemId) {
  const list = CATALOG[category];
  if (!Array.isArray(list)) return null;
  return list.find((item) => item.id === itemId) ?? null;
}

export function xpRequiredForLevel(level) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  return 80 + (safeLevel - 1) * 45;
}
