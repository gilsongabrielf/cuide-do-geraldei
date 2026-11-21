# Cuide do Geraldei 🐾

Jogo web responsivo de mascote virtual no estilo Pou, estrelando o **Geraldei** (corpo estilizado de buldog francês em proporções cartoon com os sprites oficiais do rosto sem redesenho), integrado à base do repositório [`morluto/rea`](https://github.com/morluto/rea).

> O README original do repositório base (`morluto/rea`) foi preservado em [`docs/REA_ORIGINAL_README.md`](docs/REA_ORIGINAL_README.md).

## Stack escolhida e justificativa

- **HTML5 + CSS3 + JavaScript modular (ES Modules nativos) + HTML5 Canvas + PWA (`manifest.json` e `sw.js`)**
- **Testes automatizados com `node:test` e `node:assert/strict`**

**Por que essa stack?**
1. **Zero instalação / zero build:** abre e hospeda diretamente em qualquer servidor estático (ou Cloudflare/GitHub Pages via `website/public/` do `morluto/rea`) sem precisar instalar `node_modules`.
2. **Alinhamento com a base `morluto/rea`:** aproveita o padrão nativo de ES Modules (`"type": "module"`), a pasta estática `website/public/` servida pelo `website/worker.mjs` e o runner nativo `node:test` já adotado em `website/worker.test.mjs`.
3. **Desempenho e responsividade:** Pointer Events unificados (toque e mouse), animações suaves por CSS e minijogos em Canvas a 60 FPS com baixo consumo em celulares e desktops.

## Como abrir no navegador

A partir da raiz do repositório:

```bash
node scripts/serve-geraldei.mjs
```

Depois abra `http://127.0.0.1:4173/` no navegador (ou sirva diretamente a pasta `website/public/cuide-do-geraldei/` com qualquer servidor estático, como `python -m http.server 8080`).

> **Dica (Mobile / PWA):** ao hospedar em HTTPS (ou `localhost`), o navegador oferece a opção **"Adicionar à tela inicial"** usando `manifest.json` e os ícones oficiais do Geraldei.

## Como rodar os testes automatizados

```bash
node --test tests/geraldei/state.test.mjs tests/geraldei/decay.test.mjs tests/geraldei/persistence.test.mjs
```

Ou via script npm:

```bash
npm run geraldei:test
```

Os testes cobrem:
- **Lógica de estado e progressão** (`tests/geraldei/state.test.mjs`): alimentação, carinho, banho, loja, guarda-roupa, níveis/XP/Coins, recompensas de minijogo e máquina de estados de humor.
- **Cálculo de queda das barras com tempo decorrido** (`tests/geraldei/decay.test.mjs`): decaimento em tempo real, recuperação de energia dormindo, saturação `[0, 100]` e entradas inválidas.
- **Persistência e tratamento de erros** (`tests/geraldei/persistence.test.mjs`): salvar/reabrir com decaimento offline, JSON corrompido, sanitização de dados parciais, `localStorage` indisponível, `QuotaExceededError` e verificação dos arquivos de sprite oficiais.

## Estrutura modular

```text
website/public/cuide-do-geraldei/
├── index.html                   # Estrutura semântica, quarto neutro SVG, corpo cartoon + rosto oficial, HUD e modais
├── manifest.json                # Manifesto PWA
├── sw.js                        # Service Worker para cache offline
├── css/styles.css               # Layout responsivo 100dvh (portrait/landscape), animações suaves e modo noite
├── assets/
│   ├── icons/                   # icon-192.png e icon-512.png
│   └── sprites/                 # Sprites oficiais com nomes originais + cutouts/ transparentes sem alterar o rosto
└── js/
    ├── constants.js             # Catálogo canino, taxas de queda, curva de XP e manifesto oficial de sprites
    ├── state.js                 # Lógica pura de estado, humor, progressão e sanitização (zero DOM)
    ├── persistence.js           # Persistência segura em localStorage com cálculo de tempo offline
    ├── sprites.js               # Pré-carregamento e fallback seguro para imagens ausentes/falhas
    ├── audio.js                 # Efeitos sonoros opcionais (Web Audio API)
    ├── renderer.js              # Atualização do HUD, 4 barras, personagem, acessórios, espuma e partículas
    ├── mechanics.js             # Interações: carinho, arrastar comida até a boca, banho com esponja/chuveiro, loja e visual
    ├── minigames.js             # Canvas: "Chuva de Linguiças e Calabresas" (pegar) e "Pula Calabresa" (pular)
    └── main.js                  # Bootstrap, loop em tempo real e autosave

scripts/serve-geraldei.mjs       # Servidor estático local sem dependências
tests/geraldei/                  # Suíte de testes unitários (state, decay, persistence)
```

## Como estender o jogo

- **Novos itens (comidas, shampoos ou acessórios):** adicione uma entrada em `CATALOG` dentro de `website/public/cuide-do-geraldei/js/constants.js`. Para acessórios novos, inclua o SVG correspondente em `index.html` com `id="acc-<id>"`.
- **Novos sons:** adicione novos casos em `SoundManager.play()` em `js/audio.js` (ou carregue arquivos `.mp3`/`.ogg` no mesmo módulo).
- **Novos minijogos:** adicione um botão de entrada no `#minigameMenu` (`index.html`) e registre a dupla `update<Nome>` / `render<Nome>` em `MinigameManager` (`js/minigames.js`), finalizando via `this.finishGame(gameId, score)`.
