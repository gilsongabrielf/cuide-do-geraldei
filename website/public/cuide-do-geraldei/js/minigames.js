/**
 * Engine modular de minijogos em HTML5 Canvas (responsivo, toque + mouse + teclado):
 * 1. "Chuva de Linguiças e Calabresas" (catch): pegar linguiças e calabresas com a boca.
 * 2. "Pula Calabresa" (jump): pular em cima de calabresas para subir e somar combos.
 * Exibe o Geraldei com expressão brincalhona alternando os sprites (2) e (3).
 */

import { applyMinigameReward } from "./state.js";

const LOGICAL_W = 480;
const LOGICAL_H = 540;

/**
 * Desenha uma linguiça ou calabresa estilizada no canvas para não depender de fontes de emoji.
 */
function drawSausageItem(ctx, x, y, kind, angle = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  if (kind === "boot") {
    // Bota velha (obstáculo para desviar)
    ctx.fillStyle = "#5c4d43";
    ctx.strokeStyle = "#2d241e";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-14, -18, 18, 24, 4);
    ctx.roundRect(-14, 0, 30, 14, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#c9433b";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("✕", 0, -22);
    ctx.restore();
    return;
  }

  const isGolden = kind === "calabresa-gold";
  const isCalabresa = kind === "calabresa" || isGolden;

  // Corpo curvo da linguiça/calabresa
  ctx.lineCap = "round";
  ctx.lineWidth = isCalabresa ? 17 : 14;
  ctx.strokeStyle = isGolden ? "#a66c00" : "#6c2317";
  ctx.beginPath();
  ctx.arc(0, 6, isCalabresa ? 18 : 16, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();

  ctx.lineWidth = isCalabresa ? 13 : 10;
  ctx.strokeStyle = isGolden ? "#f5c23b" : isCalabresa ? "#b83b27" : "#d95d39";
  ctx.beginPath();
  ctx.arc(0, 6, isCalabresa ? 18 : 16, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();

  // Brilho e pontinhos de tempero
  ctx.lineWidth = 3;
  ctx.strokeStyle = isGolden ? "#fff4b8" : "#f29d7e";
  ctx.beginPath();
  ctx.arc(0, 6, isCalabresa ? 20 : 18, Math.PI * 1.25, Math.PI * 1.65);
  ctx.stroke();

  // Amarrilhos nas pontas
  ctx.fillStyle = "#f2e2c4";
  ctx.beginPath();
  ctx.arc(-16, -2, 3.2, 0, Math.PI * 2);
  ctx.arc(16, -2, 3.2, 0, Math.PI * 2);
  ctx.fill();

  if (isGolden) {
    ctx.fillStyle = "#fff8c7";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("★", 0, -16);
  }

  ctx.restore();
}

/**
 * Desenha uma plataforma de calabresa para o minijogo "Pula Calabresa".
 */
function drawCalabresaPlatform(ctx, plat) {
  ctx.save();
  const isGold = plat.golden;
  const x = plat.x;
  const y = plat.y;
  const w = plat.w;
  const h = plat.h;

  ctx.fillStyle = isGold ? "#f4be32" : "#b93a26";
  ctx.strokeStyle = isGold ? "#8f5f00" : "#671d12";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.stroke();

  // Listra de brilho e nó nas pontas
  ctx.fillStyle = isGold ? "#fff0a8" : "#e37b5d";
  ctx.beginPath();
  ctx.roundRect(x + 12, y + 3, w - 24, 4, 2);
  ctx.fill();

  ctx.fillStyle = "#f2e2c4";
  ctx.beginPath();
  ctx.arc(x + 3, y + h / 2, 4, 0, Math.PI * 2);
  ctx.arc(x + w - 3, y + h / 2, 4, 0, Math.PI * 2);
  ctx.fill();

  if (isGold) {
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SUPER!", x + w / 2, y - 5);
  }
  ctx.restore();
}

/**
 * Desenha o Geraldei no canvas (corpo cartoon compacto + sprite oficial brincalhão).
 */
function drawCanvasGeraldei(ctx, x, y, spriteImg, { scale = 1, chomp = 0, facing = 1 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Sombra
  ctx.fillStyle = "rgba(60, 38, 18, 0.2)";
  ctx.beginPath();
  ctx.ellipse(0, 34, 28, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Corpo compacto de buldog francês
  ctx.fillStyle = "#d19664";
  ctx.strokeStyle = "#7a4c2a";
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.ellipse(0, 18, 22, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Barriguinha e coleira
  ctx.fillStyle = "#f4dec4";
  ctx.beginPath();
  ctx.ellipse(0, 20, 12, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#d63b3b";
  ctx.fillRect(-16, 4, 32, 6);

  // Cabeça oficial do Geraldei (proporção grande estilo Pou)
  const headScale = 1 + chomp * 0.14;
  ctx.save();
  ctx.translate(0, -18);
  ctx.scale(facing * headScale, headScale);
  const headSize = 72;
  if (spriteImg && spriteImg.complete && spriteImg.naturalWidth > 0) {
    ctx.drawImage(spriteImg, -headSize / 2, -headSize / 2, headSize, headSize);
  } else {
    ctx.fillStyle = "#d49a6a";
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.restore();
}

export class MinigameManager {
  constructor({ getState, updateState, spriteManager, renderer, audio, onFinished }) {
    this.getState = getState;
    this.updateState = updateState;
    this.sprites = spriteManager;
    this.renderer = renderer;
    this.audio = audio;
    this.onFinished = onFinished;

    this.activeGame = null; // "catch" | "jump" | null
    this.lastPlayedGame = "catch";
    this.rafId = null;
    this.lastFrameTime = 0;
    this.keys = { left: false, right: false };
    this.pointerActive = false;
    this.pointerX = LOGICAL_W / 2;

    this.els = {
      modal: document.getElementById("minigamesModal"),
      menu: document.getElementById("minigameMenu"),
      arena: document.getElementById("minigameArena"),
      summary: document.getElementById("minigameSummary"),
      canvas: document.getElementById("minigameCanvas"),
      score: document.getElementById("mgScore"),
      extraStat: document.getElementById("mgExtraStat"),
      coinsPreview: document.getElementById("mgCoinsPreview"),
      controlsHint: document.getElementById("mgControlsHint"),
      summaryTitle: document.getElementById("summaryTitle"),
      summarySubtitle: document.getElementById("summarySubtitle"),
      summaryScore: document.getElementById("summaryScore"),
      summaryCoins: document.getElementById("summaryCoins"),
      summaryHappiness: document.getElementById("summaryHappiness"),
      closeBtn: document.getElementById("closeMinigameBtn"),
      startCatchBtn: document.getElementById("startCatchBtn"),
      startJumpBtn: document.getElementById("startJumpBtn"),
      backBtn: document.getElementById("mgBackBtn"),
      replayBtn: document.getElementById("mgReplayBtn"),
      menuBtn: document.getElementById("mgMenuBtn"),
    };

    this.ctx = this.els.canvas.getContext("2d");
    this.bindEvents();
  }

  bindEvents() {
    this.els.closeBtn.addEventListener("click", () => this.close());
    this.els.modal.addEventListener("click", (ev) => {
      if (ev.target === this.els.modal) this.close();
    });

    this.els.startCatchBtn.addEventListener("click", () => this.startGame("catch"));
    this.els.startJumpBtn.addEventListener("click", () => this.startGame("jump"));
    this.els.backBtn.addEventListener("click", () => this.showMenu());
    this.els.menuBtn.addEventListener("click", () => this.showMenu());
    this.els.replayBtn.addEventListener("click", () => this.startGame(this.lastPlayedGame));

    // Teclado
    window.addEventListener("keydown", (ev) => {
      if (!this.activeGame) return;
      if (ev.key === "ArrowLeft" || ev.key === "a" || ev.key === "A") {
        this.keys.left = true;
      }
      if (ev.key === "ArrowRight" || ev.key === "d" || ev.key === "D") {
        this.keys.right = true;
      }
      if (ev.key === "Escape") {
        this.close();
      }
    });

    window.addEventListener("keyup", (ev) => {
      if (ev.key === "ArrowLeft" || ev.key === "a" || ev.key === "A") {
        this.keys.left = false;
      }
      if (ev.key === "ArrowRight" || ev.key === "d" || ev.key === "D") {
        this.keys.right = false;
      }
    });

    // Toque e mouse no Canvas
    const updatePointerFromEvent = (ev) => {
      const rect = this.els.canvas.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = (ev.clientX - rect.left) / rect.width;
      this.pointerX = Math.max(24, Math.min(LOGICAL_W - 24, ratio * LOGICAL_W));
    };

    this.els.canvas.addEventListener("pointerdown", (ev) => {
      this.pointerActive = true;
      updatePointerFromEvent(ev);
      try {
        this.els.canvas.setPointerCapture(ev.pointerId);
      } catch {
        // ignora se pointerId não suportar captura
      }
    });

    this.els.canvas.addEventListener("pointermove", (ev) => {
      if (this.pointerActive || ev.pointerType === "mouse") {
        updatePointerFromEvent(ev);
      }
    });

    this.els.canvas.addEventListener("pointerup", () => {
      this.pointerActive = false;
    });
    this.els.canvas.addEventListener("pointercancel", () => {
      this.pointerActive = false;
    });
  }

  open() {
    this.els.modal.classList.remove("hidden");
    this.showMenu();
  }

  close() {
    this.stopLoop();
    this.activeGame = null;
    this.els.modal.classList.add("hidden");
  }

  showMenu() {
    this.stopLoop();
    this.activeGame = null;
    this.els.menu.classList.remove("hidden");
    this.els.arena.classList.add("hidden");
    this.els.summary.classList.add("hidden");
  }

  stopLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.keys.left = false;
    this.keys.right = false;
    this.pointerActive = false;
  }

  startGame(gameId) {
    this.stopLoop();
    this.activeGame = gameId;
    this.lastPlayedGame = gameId;
    this.pointerX = LOGICAL_W / 2;

    this.els.menu.classList.add("hidden");
    this.els.summary.classList.add("hidden");
    this.els.arena.classList.remove("hidden");

    if (gameId === "catch") {
      this.els.controlsHint.textContent =
        "Arraste o dedo/mouse ou use ← / → para pegar linguiças e calabresas com a boca!";
      this.sim = {
        score: 0,
        timeLeft: 35,
        playerX: LOGICAL_W / 2,
        playerY: LOGICAL_H - 68,
        facing: 1,
        chomp: 0,
        spawnTimer: 0.35,
        items: [],
        popups: [],
        frameTick: 0,
      };
    } else {
      this.els.controlsHint.textContent =
        "Mova o dedo/mouse ou use ← / → para o Geraldei pular em cima das calabresas!";
      const platforms = [];
      for (let i = 0; i < 8; i += 1) {
        platforms.push({
          x: i === 0 ? LOGICAL_W / 2 - 52 : 30 + Math.random() * (LOGICAL_W - 150),
          y: LOGICAL_H - 60 - i * 68,
          w: 96,
          h: 18,
          golden: i > 1 && Math.random() < 0.22,
          hit: false,
        });
      }
      this.sim = {
        score: 0,
        combo: 0,
        playerX: LOGICAL_W / 2,
        playerY: LOGICAL_H - 120,
        vx: 0,
        vy: -560,
        facing: 1,
        chomp: 0,
        platforms,
        popups: [],
        frameTick: 0,
      };
    }

    this.lastFrameTime = performance.now();
    const tick = (now) => {
      if (!this.activeGame) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastFrameTime) / 1000));
      this.lastFrameTime = now;

      if (this.activeGame === "catch") {
        this.updateCatch(dt);
        this.renderCatch();
      } else {
        this.updateJump(dt);
        this.renderJump();
      }

      if (this.activeGame) {
        this.rafId = requestAnimationFrame(tick);
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  getPlayfulSpriteImg(tick) {
    const key = Math.floor(tick * 2.2) % 2 === 0 ? "playfulA" : "playfulB";
    return this.sprites.getSprite(key)?.img ?? null;
  }

  // ===========================
  // MINIJOGO 1: CHUVA DE LINGUIÇAS E CALABRESAS
  // ===========================
  updateCatch(dt) {
    const s = this.sim;
    s.frameTick += dt;
    s.timeLeft = Math.max(0, s.timeLeft - dt);
    s.chomp = Math.max(0, s.chomp - dt * 4);

    // Movimento do jogador
    const speed = 390;
    const prevX = s.playerX;
    if (this.keys.left) s.playerX -= speed * dt;
    else if (this.keys.right) s.playerX += speed * dt;
    else {
      const diff = this.pointerX - s.playerX;
      s.playerX += diff * Math.min(1, dt * 14);
    }
    s.playerX = Math.max(42, Math.min(LOGICAL_W - 42, s.playerX));
    if (Math.abs(s.playerX - prevX) > 0.6) {
      s.facing = s.playerX >= prevX ? 1 : -1;
    }

    // Spawn de itens
    s.spawnTimer -= dt;
    if (s.spawnTimer <= 0) {
      const elapsedRatio = 1 - s.timeLeft / 35;
      s.spawnTimer = Math.max(0.32, 0.78 - elapsedRatio * 0.34);

      const roll = Math.random();
      let kind = "sausage";
      if (roll < 0.17) kind = "boot";
      else if (roll < 0.32) kind = "calabresa-gold";
      else if (roll < 0.68) kind = "calabresa";

      s.items.push({
        x: 34 + Math.random() * (LOGICAL_W - 68),
        y: -26,
        vy: 175 + Math.random() * 110 + elapsedRatio * 100,
        angle: (Math.random() - 0.5) * 0.6,
        spin: (Math.random() - 0.5) * 2.2,
        kind,
      });
    }

    // Atualiza itens e colisão com a boca do Geraldei
    const mouthY = s.playerY - 16;
    for (let i = s.items.length - 1; i >= 0; i -= 1) {
      const it = s.items[i];
      it.y += it.vy * dt;
      it.angle += it.spin * dt;

      const dist = Math.hypot(it.x - s.playerX, it.y - mouthY);
      if (dist < 44) {
        s.items.splice(i, 1);
        if (it.kind === "boot") {
          s.score = Math.max(0, s.score - 3);
          this.audio.play("grumpy");
          s.popups.push({ x: s.playerX, y: mouthY - 22, text: "-3 Bota!", color: "#d63b3b", life: 0.9 });
        } else {
          const pts = it.kind === "calabresa-gold" ? 4 : it.kind === "calabresa" ? 2 : 1;
          s.score += pts;
          s.chomp = 1;
          this.audio.play(pts >= 4 ? "coin" : "eat");
          s.popups.push({
            x: s.playerX,
            y: mouthY - 24,
            text: pts >= 4 ? `+${pts} ★` : `+${pts} NHAC!`,
            color: pts >= 4 ? "#d48a00" : "#2f8f53",
            life: 0.85,
          });
        }
        continue;
      }

      if (it.y > LOGICAL_H + 40) {
        s.items.splice(i, 1);
      }
    }

    // Popups
    for (let i = s.popups.length - 1; i >= 0; i -= 1) {
      s.popups[i].y -= 52 * dt;
      s.popups[i].life -= dt;
      if (s.popups[i].life <= 0) s.popups.splice(i, 1);
    }

    // Atualiza HUD do minijogo
    const coinsEst = Math.max(4, Math.floor(s.score * 1.4));
    this.els.score.textContent = String(s.score);
    this.els.extraStat.innerHTML = `Tempo: <strong>${Math.ceil(s.timeLeft)}s</strong>`;
    this.els.coinsPreview.textContent = String(coinsEst);

    if (s.timeLeft <= 0) {
      this.finishGame("catch", s.score);
    }
  }

  renderCatch() {
    const ctx = this.ctx;
    const s = this.sim;

    // Fundo aconchegante
    const sky = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    sky.addColorStop(0, "#cde8fc");
    sky.addColorStop(0.76, "#f4ecdf");
    sky.addColorStop(1, "#d9b892");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Chão
    ctx.fillStyle = "#c8a074";
    ctx.fillRect(0, LOGICAL_H - 36, LOGICAL_W, 36);

    // Itens caindo
    for (const it of s.items) {
      drawSausageItem(ctx, it.x, it.y, it.kind, it.angle);
    }

    // Geraldei brincalhão (alternando sprites 2 e 3)
    drawCanvasGeraldei(ctx, s.playerX, s.playerY, this.getPlayfulSpriteImg(s.frameTick), {
      chomp: s.chomp,
      facing: s.facing,
    });

    // Popups
    for (const p of s.popups) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.font = "800 18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    }
  }

  // ===========================
  // MINIJOGO 2: PULA CALABRESA
  // ===========================
  updateJump(dt) {
    const s = this.sim;
    s.frameTick += dt;
    s.chomp = Math.max(0, s.chomp - dt * 3.5);

    const prevX = s.playerX;
    if (this.keys.left) s.playerX -= 360 * dt;
    else if (this.keys.right) s.playerX += 360 * dt;
    else {
      const diff = this.pointerX - s.playerX;
      s.playerX += diff * Math.min(1, dt * 11);
    }

    // Wrap horizontal estilo jumper arcade
    if (s.playerX < -24) s.playerX = LOGICAL_W + 24;
    if (s.playerX > LOGICAL_W + 24) s.playerX = -24;
    if (Math.abs(s.playerX - prevX) > 0.5) {
      s.facing = s.playerX >= prevX ? 1 : -1;
    }

    // Gravidade
    const prevY = s.playerY;
    s.vy += 1180 * dt;
    s.playerY += s.vy * dt;

    // Colisão com calabresas ao cair
    if (s.vy > 0) {
      const footPrev = prevY + 32;
      const footNow = s.playerY + 32;
      for (const plat of s.platforms) {
        const withinX = s.playerX >= plat.x - 16 && s.playerX <= plat.x + plat.w + 16;
        if (withinX && footPrev <= plat.y + 8 && footNow >= plat.y - 4) {
          s.vy = plat.golden ? -790 : -590;
          s.chomp = 1;
          if (!plat.hit) {
            plat.hit = true;
            s.combo += 1;
            const pts = plat.golden ? 5 : 2;
            s.score += pts;
            s.popups.push({
              x: s.playerX,
              y: plat.y - 14,
              text: plat.golden ? `+${pts} SUPER!` : `+${pts}`,
              color: plat.golden ? "#d48a00" : "#2f8f53",
              life: 0.8,
            });
          }
          this.audio.play(plat.golden ? "coin" : "bounce");
          break;
        }
      }
    }

    // Scroll de câmera quando Geraldei sobe
    if (s.playerY < LOGICAL_H * 0.42) {
      const delta = LOGICAL_H * 0.42 - s.playerY;
      s.playerY = LOGICAL_H * 0.42;
      for (const plat of s.platforms) {
        plat.y += delta;
      }
      for (const p of s.popups) {
        p.y += delta;
      }

      // Recicla plataformas que saíram por baixo
      let highestY = Math.min(...s.platforms.map((p) => p.y));
      for (const plat of s.platforms) {
        if (plat.y > LOGICAL_H + 24) {
          highestY -= 64 + Math.random() * 20;
          plat.y = highestY;
          plat.x = 24 + Math.random() * (LOGICAL_W - 134);
          plat.w = Math.max(76, 98 - Math.min(20, Math.floor(s.score / 12)));
          plat.golden = Math.random() < 0.2;
          plat.hit = false;
        }
      }
    }

    for (let i = s.popups.length - 1; i >= 0; i -= 1) {
      s.popups[i].y -= 42 * dt;
      s.popups[i].life -= dt;
      if (s.popups[i].life <= 0) s.popups.splice(i, 1);
    }

    const coinsEst = Math.max(4, Math.floor(s.score * 1.2));
    this.els.score.textContent = String(s.score);
    this.els.extraStat.innerHTML = `Combo: <strong>x${s.combo}</strong>`;
    this.els.coinsPreview.textContent = String(coinsEst);

    // Fim ao cair abaixo da tela
    if (s.playerY > LOGICAL_H + 72) {
      this.finishGame("jump", s.score);
    }
  }

  renderJump() {
    const ctx = this.ctx;
    const s = this.sim;

    const sky = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    sky.addColorStop(0, "#b8defa");
    sky.addColorStop(1, "#f7efe3");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Nuvens decorativas
    ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
    ctx.beginPath();
    ctx.ellipse(90, 96, 46, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(370, 172, 54, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    for (const plat of s.platforms) {
      drawCalabresaPlatform(ctx, plat);
    }

    drawCanvasGeraldei(ctx, s.playerX, s.playerY, this.getPlayfulSpriteImg(s.frameTick), {
      scale: 0.92,
      chomp: s.chomp,
      facing: s.facing,
    });

    for (const p of s.popups) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.font = "800 17px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    }
  }

  finishGame(gameId, score) {
    this.stopLoop();
    this.activeGame = null;

    const coinsEarned = Math.max(5, Math.floor(score * (gameId === "catch" ? 1.4 : 1.2)));
    const happinessGain = Math.min(38, Math.max(10, Math.floor(score * 0.9) + 8));
    const xpGain = Math.max(12, Math.floor(score * 1.1) + 8);

    const result = applyMinigameReward(this.getState(), {
      gameId,
      score,
      coinsEarned,
      happinessGain,
      xpGain,
    });

    this.updateState(() => result.state);
    this.audio.play(result.leveledUp ? "levelup" : "coin");

    this.els.arena.classList.add("hidden");
    this.els.summary.classList.remove("hidden");
    this.els.summaryTitle.textContent = result.isNewRecord
      ? "🏆 Novo Recorde!"
      : "🎉 Ótima Partida!";
    this.els.summarySubtitle.textContent = result.leveledUp
      ? `Geraldei subiu para o Nível ${result.state.level} (+${result.bonusCoins} Coins bônus)!`
      : "O Geraldei se divertiu muito pegando calabresas!";
    this.els.summaryScore.textContent = String(score);
    this.els.summaryCoins.textContent = `+${coinsEarned + result.bonusCoins}`;
    this.els.summaryHappiness.textContent = `+${happinessGain}`;

    if (this.onFinished) {
      this.onFinished(result);
    }
  }
}
