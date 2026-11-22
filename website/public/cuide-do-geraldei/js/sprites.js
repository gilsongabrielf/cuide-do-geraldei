/**
 * Gerenciador de sprites oficiais do Geraldei.
 * Referencia os nomes exatos dos arquivos enviados (OFFICIAL_SPRITES) e garante
 * carregamento resiliente com fallback seguro em caso de erro de imagem:
 *   1. Recorte transparente fiel ao sprite original (sem alterar feições)
 *   2. Arquivo original (.jpeg) enviado pelo usuário
 *   3. Fallback vetorial (SVG data URI) para nunca quebrar o jogo
 */

import { OFFICIAL_SPRITES } from "./constants.js";

function encodeAssetPath(path) {
  return path
    .split("/")
    .map((segment) => (segment === "." || segment === ".." ? segment : encodeURIComponent(segment)))
    .join("/");
}

function createFallbackSvgDataUri(moodLabel) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220">
    <ellipse cx="52" cy="46" rx="28" ry="42" fill="#b77b4c" stroke="#fff" stroke-width="5" transform="rotate(-14 52 46)"/>
    <ellipse cx="168" cy="46" rx="28" ry="42" fill="#b77b4c" stroke="#fff" stroke-width="5" transform="rotate(14 168 46)"/>
    <circle cx="110" cy="122" r="78" fill="#cf9566" stroke="#fff" stroke-width="6"/>
    <circle cx="84" cy="108" r="9" fill="#2c1e16"/>
    <circle cx="136" cy="108" r="9" fill="#2c1e16"/>
    <ellipse cx="110" cy="134" rx="22" ry="15" fill="#4f3b31"/>
    <text x="110" y="198" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#2c1e16">${moodLabel}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function loadSingleImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve({ img, resolvedUrl: url });
    img.onerror = () => reject(new Error(`Falha ao carregar sprite: ${url}`));
    img.src = url;
  });
}

export class SpriteManager {
  constructor() {
    this.cache = new Map();
    this.errors = [];
  }

  async preloadAll() {
    const entries = Object.entries(OFFICIAL_SPRITES);
    await Promise.all(entries.map(([key, spec]) => this.loadSprite(key, spec)));
    return {
      loadedCount: this.cache.size,
      errors: [...this.errors],
    };
  }

  async loadSprite(key, spec) {
    const candidates = [encodeAssetPath(spec.cutoutSrc), encodeAssetPath(spec.src)];
    for (const candidate of candidates) {
      try {
        const result = await loadSingleImage(candidate);
        this.cache.set(key, {
          ...spec,
          img: result.img,
          resolvedUrl: result.resolvedUrl,
          isFallback: false,
        });
        return;
      } catch {
        // tenta próximo candidato
      }
    }

    const fallbackUri = createFallbackSvgDataUri("Geraldei");
    this.errors.push(`Não foi possível carregar "${spec.originalFile}". Usando fallback seguro.`);
    try {
      const fallbackResult = await loadSingleImage(fallbackUri);
      this.cache.set(key, {
        ...spec,
        img: fallbackResult.img,
        resolvedUrl: fallbackUri,
        isFallback: true,
      });
    } catch {
      this.cache.set(key, {
        ...spec,
        img: null,
        resolvedUrl: fallbackUri,
        isFallback: true,
      });
    }
  }

  getSprite(key) {
    const cached = this.cache.get(key);
    if (cached) return cached;
    const spec = OFFICIAL_SPRITES[key] ?? OFFICIAL_SPRITES.playfulA;
    return {
      ...spec,
      img: null,
      resolvedUrl: encodeAssetPath(spec.cutoutSrc || spec.src),
      isFallback: false,
    };
  }

  /**
   * Resolve qual sprite exibir com base no estado emocional atual e frame de alternância.
   * Alterna entre as imagens (2) e (3) no estado brincalhão/animado.
   */
  resolveForMood(mood, { playfulFrame = 0, seriousStyle = "sticker" } = {}) {
    if (mood === "affectionate") {
      return this.getSprite("affectionate");
    }
    if (mood === "grumpy") {
      return this.getSprite(seriousStyle === "portrait" ? "seriousPortrait" : "grumpy");
    }
    if (mood === "needy") {
      return this.getSprite(seriousStyle === "portrait" ? "seriousPortrait" : "needy");
    }
    if (mood === "sleeping") {
      return this.getSprite("sleeping");
    }
    return this.getSprite(playfulFrame % 2 === 0 ? "playfulA" : "playfulB");
  }
}
