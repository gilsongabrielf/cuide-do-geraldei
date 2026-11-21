/**
 * Módulo de mecânicas interativas do quarto:
 * - Carinho no Geraldei (toque, mouse, teclado)
 * - Arrastar alimento canino até a boca do Geraldei com reação de mastigação
 * - Banho com esponja (arraste/esfregar), shampoo e enxágue com chuveirinho
 * - Loja canina, Guarda-roupa, Dormir e Bola interativa do quarto
 */

import { CATALOG, findCatalogItem } from "./constants.js";
import {
  applyBathRinse,
  applyBathScrub,
  buyItem,
  equipAccessory,
  feedPet,
  petGeraldei,
  playWithBall,
  setSeriousStyle,
  toggleSleep,
} from "./state.js";

function isPointNearRect(x, y, rect, padding = 24) {
  return (
    x >= rect.left - padding &&
    x <= rect.right + padding &&
    y >= rect.top - padding &&
    y <= rect.bottom + padding
  );
}

export class GameMechanics {
  constructor({ getState, updateState, renderer, audio, onOpenMinigames }) {
    this.getState = getState;
    this.updateState = updateState;
    this.renderer = renderer;
    this.audio = audio;
    this.onOpenMinigames = onOpenMinigames;

    this.activeTray = null; // "food" | "bath" | null
    this.activeModal = null; // "shop" | "wardrobe" | null
    this.shopTab = "food";
    this.dragState = null; // { kind: "food"|"sponge", id?, icon, startX, startY, moved }
    this.lastScrubAt = 0;

    this.els = {
      petZone: document.getElementById("petZone"),
      petHeadWrap: document.getElementById("petHeadWrap"),
      roomBallBtn: document.getElementById("roomBallBtn"),
      soundToggleBtn: document.getElementById("soundToggleBtn"),
      dragGhost: document.getElementById("dragGhost"),
      foodTray: document.getElementById("foodTray"),
      foodList: document.getElementById("foodList"),
      foodGoShopBtn: document.getElementById("foodGoShopBtn"),
      bathTray: document.getElementById("bathTray"),
      spongeDragSource: document.getElementById("spongeDragSource"),
      shampooSelect: document.getElementById("shampooSelect"),
      rinseBtn: document.getElementById("rinseBtn"),
      shopModal: document.getElementById("shopModal"),
      shopItemsGrid: document.getElementById("shopItemsGrid"),
      wardrobeModal: document.getElementById("wardrobeModal"),
      wardrobeGrid: document.getElementById("wardrobeGrid"),
      styleStickerBtn: document.getElementById("styleStickerBtn"),
      stylePortraitBtn: document.getElementById("stylePortraitBtn"),
    };

    this.bindEvents();
  }

  bindEvents() {
    // Menu inferior (6 ações)
    document.querySelectorAll(".dock-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.handleDockAction(btn.dataset.action));
    });

    // Fechar bandejas
    document.querySelectorAll("[data-close-tray]").forEach((btn) => {
      btn.addEventListener("click", () => this.closeTrays());
    });

    // Fechar modais
    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => this.closeModals());
    });

    [this.els.shopModal, this.els.wardrobeModal].forEach((backdrop) => {
      backdrop.addEventListener("click", (ev) => {
        if (ev.target === backdrop) this.closeModals();
      });
    });

    // Atalho + Loja na bandeja de comida
    this.els.foodGoShopBtn.addEventListener("click", () => {
      this.closeTrays();
      this.shopTab = "food";
      this.openShop();
    });

    // Tabs da Loja
    document.querySelectorAll("[data-shop-tab]").forEach((tabBtn) => {
      tabBtn.addEventListener("click", () => {
        this.shopTab = tabBtn.dataset.shopTab;
        this.renderShop();
      });
    });

    // Alternar estilo da postura séria no Guarda-roupa
    [this.els.styleStickerBtn, this.els.stylePortraitBtn].forEach((btn) => {
      btn.addEventListener("click", () => {
        const style = btn.dataset.seriousStyle;
        this.updateState((s) => setSeriousStyle(s, style));
        this.renderWardrobe();
        this.renderer.showToast(
          style === "portrait"
            ? "Retrato sério clássico selecionado!"
            : "Figurinha emburrada selecionada!",
        );
      });
    });

    // Alternar som
    this.els.soundToggleBtn.addEventListener("click", () => {
      const nextEnabled = !this.getState().preferences.soundEnabled;
      this.audio.setEnabled(nextEnabled);
      this.updateState((s) => ({
        ...s,
        preferences: { ...s.preferences, soundEnabled: nextEnabled },
      }));
      if (nextEnabled) this.audio.play("coin");
    });

    // Bola interativa do quarto
    this.els.roomBallBtn.addEventListener("click", () => this.handleRoomBall());

    // Carinho direto no Geraldei (clique/toque ou teclado) + esfregar direto no modo banho
    this.els.petZone.addEventListener("pointerdown", (ev) => {
      if (this.activeTray === "bath") {
        this.scrubAtPoint(ev.clientX, ev.clientY);
        return;
      }
      this.handlePetting(ev.clientX, ev.clientY);
    });

    this.els.petZone.addEventListener("pointermove", (ev) => {
      if (this.activeTray === "bath" && ev.buttons > 0 && !this.dragState) {
        this.scrubAtPoint(ev.clientX, ev.clientY);
      }
    });

    this.els.petZone.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        this.handlePetting(null, null);
      }
    });

    // Arrastar esponja no banho
    this.els.spongeDragSource.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      this.startDrag({
        kind: "sponge",
        icon: "🧽",
        clientX: ev.clientX,
        clientY: ev.clientY,
      });
    });

    // Teclado na esponja (acessibilidade)
    this.els.spongeDragSource.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        this.scrubAtPoint(null, null, 20);
      }
    });

    // Botão Enxaguar (chuveirinho)
    this.els.rinseBtn.addEventListener("click", () => this.handleRinse());

    // Eventos globais de arraste (Pointer Events unificados para touch e mouse)
    window.addEventListener("pointermove", (ev) => this.onPointerMove(ev));
    window.addEventListener("pointerup", (ev) => this.onPointerUp(ev));
    window.addEventListener("pointercancel", () => this.cancelDrag());

    // Tecla Escape fecha modais/bandejas
    window.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        this.closeModals();
        this.closeTrays();
      }
    });
  }

  handleDockAction(action) {
    if (action === "sleep") {
      this.closeTrays();
      this.closeModals();
      const result = toggleSleep(this.getState());
      this.updateState(() => result.state);
      this.audio.play("sleep");
      this.renderer.showToast(
        result.isSleeping
          ? "🌙 Boa noite, Geraldei! Energia regenerando..."
          : "☀️ Geraldei acordou pronto para brincar!",
      );
      return;
    }

    if (action === "shop") {
      this.closeTrays();
      this.openShop();
      return;
    }

    if (action === "wardrobe") {
      this.closeTrays();
      this.openWardrobe();
      return;
    }

    if (action === "minigames") {
      this.closeTrays();
      this.closeModals();
      this.onOpenMinigames();
      return;
    }

    if (action === "food") {
      this.closeModals();
      if (this.activeTray === "food") {
        this.closeTrays();
      } else {
        this.openFoodTray();
      }
      return;
    }

    if (action === "bath") {
      this.closeModals();
      if (this.activeTray === "bath") {
        this.closeTrays();
      } else {
        this.openBathTray();
      }
    }
  }

  syncDockHighlights() {
    document.getElementById("dock-food")?.classList.toggle("active", this.activeTray === "food");
    document.getElementById("dock-bath")?.classList.toggle("active", this.activeTray === "bath");
    document.getElementById("dock-shop")?.classList.toggle("active", this.activeModal === "shop");
    document
      .getElementById("dock-wardrobe")
      ?.classList.toggle("active", this.activeModal === "wardrobe");
  }

  closeTrays() {
    this.activeTray = null;
    this.els.foodTray.classList.add("hidden");
    this.els.bathTray.classList.add("hidden");
    this.renderer.setHint("");
    this.syncDockHighlights();
  }

  closeModals() {
    this.activeModal = null;
    this.els.shopModal.classList.add("hidden");
    this.els.wardrobeModal.classList.add("hidden");
    this.syncDockHighlights();
  }

  openFoodTray() {
    this.activeTray = "food";
    this.els.bathTray.classList.add("hidden");
    this.els.foodTray.classList.remove("hidden");
    this.renderFoodTray();
    this.renderer.setHint("Arraste a comida até a boca do Geraldei!");
    this.syncDockHighlights();
  }

  renderFoodTray() {
    const state = this.getState();
    const list = this.els.foodList;
    list.innerHTML = "";

    const ownedFoods = CATALOG.food.filter((item) => (state.inventory.food[item.id] || 0) > 0);
    if (ownedFoods.length === 0) {
      const empty = document.createElement("div");
      empty.className = "tray-empty";
      empty.textContent = "Sua despensa canina está vazia! Clique em + Loja para comprar petiscos.";
      list.appendChild(empty);
      return;
    }

    for (const item of ownedFoods) {
      const qty = state.inventory.food[item.id];
      const card = document.createElement("div");
      card.className = "food-item-card";
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", `${item.name}, quantidade ${qty}. Arraste até o Geraldei.`);
      card.innerHTML = `
        <span class="food-qty">x${qty}</span>
        <span class="food-emoji" aria-hidden="true">${item.icon}</span>
        <span class="food-name">${item.name}</span>
        <span class="food-bonus">+${item.hunger} Fome</span>
      `;

      card.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        this.startDrag({
          kind: "food",
          id: item.id,
          icon: item.icon,
          clientX: ev.clientX,
          clientY: ev.clientY,
        });
      });

      // Acessibilidade por teclado (Enter/Espaço alimenta diretamente)
      card.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          this.performFeed(item.id, null, null);
        }
      });

      list.appendChild(card);
    }
  }

  openBathTray() {
    this.activeTray = "bath";
    this.els.foodTray.classList.add("hidden");
    this.els.bathTray.classList.remove("hidden");
    this.renderBathTray();
    this.renderer.setHint("Esfregue a esponja no Geraldei para ensaboar!");
    this.syncDockHighlights();
  }

  renderBathTray() {
    const state = this.getState();
    const select = this.els.shampooSelect;
    const prev = select.value;
    select.innerHTML = "";

    const basicOpt = document.createElement("option");
    basicOpt.value = "";
    basicOpt.textContent = "Sabão Neutro Básico (ilimitado)";
    select.appendChild(basicOpt);

    for (const item of CATALOG.hygiene) {
      const qty = state.inventory.hygiene[item.id] || 0;
      if (qty > 0) {
        const opt = document.createElement("option");
        opt.value = item.id;
        opt.textContent = `${item.icon} ${item.name} (x${qty}) +${item.hygieneBonus}`;
        select.appendChild(opt);
      }
    }

    if ([...select.options].some((o) => o.value === prev)) {
      select.value = prev;
    } else if (select.options.length > 1) {
      select.selectedIndex = 1;
    }
  }

  openShop() {
    this.activeModal = "shop";
    this.els.wardrobeModal.classList.add("hidden");
    this.els.shopModal.classList.remove("hidden");
    this.renderShop();
    this.syncDockHighlights();
  }

  renderShop() {
    const state = this.getState();
    document.querySelectorAll("[data-shop-tab]").forEach((btn) => {
      const active = btn.dataset.shopTab === this.shopTab;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    });

    const grid = this.els.shopItemsGrid;
    grid.innerHTML = "";
    const items = CATALOG[this.shopTab] || [];

    for (const item of items) {
      const isAccessory = this.shopTab === "accessories";
      const ownedAcc = isAccessory && state.inventory.accessories.includes(item.id);
      const stock = isAccessory
        ? ownedAcc
          ? "Já possui"
          : "Novo"
        : `Estoque: ${state.inventory[this.shopTab]?.[item.id] || 0}`;

      const effectLabel =
        this.shopTab === "food"
          ? `+${item.hunger} Fome · +${item.happiness} Diversão`
          : this.shopTab === "hygiene"
            ? `+${item.hygieneBonus} Higiene bônus`
            : `Slot: ${item.slot === "head" ? "Cabeça" : item.slot === "eyes" ? "Olhos" : "Pescoço"}`;

      const card = document.createElement("article");
      card.className = "catalog-card";
      card.innerHTML = `
        <div class="catalog-card-top">
          <span class="catalog-emoji" aria-hidden="true">${item.icon}</span>
          <span class="catalog-stock">${stock}</span>
        </div>
        <div class="catalog-name">${item.name}</div>
        <div class="catalog-desc">${item.description}</div>
        <div class="catalog-effect">${effectLabel}</div>
      `;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "primary-btn";
      if (ownedAcc) {
        btn.textContent = "Comprado ✓";
        btn.disabled = true;
      } else {
        btn.textContent = `Comprar · 🪙 ${item.price}`;
        btn.disabled = state.coins < item.price;
        btn.addEventListener("click", () => this.handleBuy(this.shopTab, item.id));
      }
      card.appendChild(btn);
      grid.appendChild(card);
    }
  }

  openWardrobe() {
    this.activeModal = "wardrobe";
    this.els.shopModal.classList.add("hidden");
    this.els.wardrobeModal.classList.remove("hidden");
    this.renderWardrobe();
    this.syncDockHighlights();
  }

  renderWardrobe() {
    const state = this.getState();
    this.els.styleStickerBtn.classList.toggle("active", state.preferences.seriousStyle === "sticker");
    this.els.stylePortraitBtn.classList.toggle("active", state.preferences.seriousStyle === "portrait");

    const grid = this.els.wardrobeGrid;
    grid.innerHTML = "";

    for (const acc of CATALOG.accessories) {
      const owned = state.inventory.accessories.includes(acc.id);
      const equipped = state.equipped[acc.slot] === acc.id;

      const card = document.createElement("article");
      card.className = "catalog-card";
      card.innerHTML = `
        <div class="catalog-card-top">
          <span class="catalog-emoji" aria-hidden="true">${acc.icon}</span>
          <span class="catalog-stock">${equipped ? "Equipado" : owned ? "Disponível" : `🪙 ${acc.price}`}</span>
        </div>
        <div class="catalog-name">${acc.name}</div>
        <div class="catalog-desc">${acc.description}</div>
      `;

      const btn = document.createElement("button");
      btn.type = "button";
      if (!owned) {
        btn.className = "secondary-btn";
        btn.textContent = "Ver na Loja";
        btn.addEventListener("click", () => {
          this.shopTab = "accessories";
          this.openShop();
        });
      } else {
        btn.className = equipped ? "secondary-btn" : "primary-btn";
        btn.textContent = equipped ? "Remover" : "Equipar";
        btn.addEventListener("click", () => this.handleEquip(acc.id));
      }
      card.appendChild(btn);
      grid.appendChild(card);
    }
  }

  handleBuy(category, itemId) {
    const result = buyItem(this.getState(), category, itemId);
    if (!result.ok) {
      this.audio.play("grumpy");
      this.renderer.showToast(result.error);
      return;
    }

    this.updateState(() => result.state);
    this.audio.play("coin");
    this.renderShop();

    if (category === "accessories") {
      this.renderer.spawnParticles(["❤️", "✨", result.item.icon], { count: 6 });
      this.renderer.showToast(`🎁 Geraldei amou o presente: ${result.item.name}!`);
    } else {
      this.renderer.showToast(`Comprado: ${result.item.icon} ${result.item.name}!`);
    }

    if (result.leveledUp) {
      this.celebrateLevelUp(result.state.level, result.bonusCoins);
    }
  }

  handleEquip(accessoryId) {
    const result = equipAccessory(this.getState(), accessoryId);
    if (!result.ok) {
      this.renderer.showToast(result.error);
      return;
    }
    this.updateState(() => result.state);
    this.audio.play(result.equipped ? "pet" : "bounce");
    this.renderWardrobe();
    if (result.equipped) {
      this.renderer.triggerPetAnimation("jump");
      this.renderer.spawnParticles(["✨", "❤️"], { count: 5 });
      this.renderer.showToast(`${result.item.icon} ${result.item.name} equipado!`);
    } else {
      this.renderer.showToast(`${result.item.name} removido.`);
    }
  }

  handlePetting(clientX, clientY) {
    const result = petGeraldei(this.getState());
    if (!result.ok) {
      this.renderer.showToast(result.error);
      return;
    }
    this.updateState(() => result.state);
    this.audio.play("pet");
    this.renderer.triggerPetAnimation("petting");
    this.renderer.spawnParticles(["❤️", "💖", "😘"], { count: 5, clientX, clientY });

    if (result.coinsGained > 0) {
      this.renderer.showToast(`💖 Geraldei amou o carinho! +${result.coinsGained} Coins`);
    }
    if (result.leveledUp) {
      this.celebrateLevelUp(result.state.level, result.bonusCoins);
    }
  }

  handleRoomBall() {
    this.renderer.bounceRoomBall();
    const result = playWithBall(this.getState());
    this.updateState(() => result.state);
    if (!result.ok) {
      this.audio.play("grumpy");
      this.renderer.triggerPetAnimation("shake");
      this.renderer.showToast(result.error);
      return;
    }
    this.audio.play("bounce");
    this.renderer.triggerPetAnimation("jump");
    this.renderer.spawnParticles(["⚽", "✨", "+2🪙"], { count: 4 });
    if (result.leveledUp) {
      this.celebrateLevelUp(result.state.level, result.bonusCoins);
    }
  }

  startDrag({ kind, id = null, icon, clientX, clientY }) {
    this.dragState = {
      kind,
      id,
      icon,
      startX: clientX,
      startY: clientY,
      moved: false,
    };

    const ghost = this.els.dragGhost;
    ghost.textContent = icon;
    ghost.style.left = `${clientX}px`;
    ghost.style.top = `${clientY}px`;
    ghost.classList.remove("hidden");
  }

  onPointerMove(ev) {
    if (!this.dragState) return;
    const { clientX, clientY } = ev;

    const dx = clientX - this.dragState.startX;
    const dy = clientY - this.dragState.startY;
    if (Math.hypot(dx, dy) > 8) {
      this.dragState.moved = true;
    }

    const ghost = this.els.dragGhost;
    ghost.style.left = `${clientX}px`;
    ghost.style.top = `${clientY}px`;

    const headRect = this.els.petHeadWrap.getBoundingClientRect();
    const petRect = this.els.petZone.getBoundingClientRect();

    if (this.dragState.kind === "food") {
      const nearMouth = isPointNearRect(clientX, clientY, headRect, 48);
      this.renderer.setMouthState(nearMouth ? "anticipation" : "idle");
    } else if (this.dragState.kind === "sponge") {
      if (isPointNearRect(clientX, clientY, petRect, 14)) {
        this.scrubAtPoint(clientX, clientY);
      }
    }
  }

  onPointerUp(ev) {
    if (!this.dragState) return;
    const current = this.dragState;
    this.dragState = null;
    this.els.dragGhost.classList.add("hidden");

    if (current.kind === "food") {
      const petRect = this.els.petZone.getBoundingClientRect();
      const headRect = this.els.petHeadWrap.getBoundingClientRect();
      const droppedOnPet =
        isPointNearRect(ev.clientX, ev.clientY, headRect, 36) ||
        isPointNearRect(ev.clientX, ev.clientY, petRect, 16);

      if (droppedOnPet) {
        this.performFeed(current.id, ev.clientX, ev.clientY);
      } else {
        this.renderer.setMouthState("idle");
        if (!current.moved) {
          this.renderer.showToast("Segure e arraste o alimento até a boca do Geraldei!");
        }
      }
    }
  }

  cancelDrag() {
    if (!this.dragState) return;
    this.dragState = null;
    this.els.dragGhost.classList.add("hidden");
    this.renderer.setMouthState("idle");
  }

  performFeed(foodId, clientX, clientY) {
    const result = feedPet(this.getState(), foodId);
    if (!result.ok) {
      this.renderer.setMouthState("idle");
      this.audio.play("grumpy");
      this.renderer.triggerPetAnimation("shake");
      this.renderer.showToast(result.error);
      return;
    }

    this.updateState(() => result.state);
    this.audio.play("eat");
    this.renderer.setMouthState("chewing", 1150);
    this.renderer.triggerPetAnimation("jump");
    this.renderer.spawnParticles([result.item.icon, "✨", `+${result.item.hunger}🦴`], {
      count: 6,
      clientX,
      clientY,
    });
    this.renderFoodTray();

    if (result.leveledUp) {
      this.celebrateLevelUp(result.state.level, result.bonusCoins);
    }
  }

  scrubAtPoint(clientX, clientY, intensity = 14) {
    const now = Date.now();
    if (now - this.lastScrubAt < 180) return;
    this.lastScrubAt = now;

    const result = applyBathScrub(this.getState(), intensity, now);
    if (!result.ok) {
      this.renderer.showToast(result.error);
      return;
    }
    this.updateState(() => result.state);
    this.audio.play("bubble");
    this.renderer.spawnParticles(["🫧", "✨"], { count: 3, clientX, clientY });
  }

  handleRinse() {
    const shampooId = this.els.shampooSelect.value || null;
    const result = applyBathRinse(this.getState(), shampooId);
    if (!result.ok) {
      this.audio.play("grumpy");
      this.renderer.showToast(result.error);
      return;
    }

    this.updateState(() => result.state);
    this.audio.play("rinse");
    this.renderer.triggerPetAnimation("jump");
    this.renderer.spawnParticles(["💧", "💦", "🫧", "✨"], { count: 10, falling: true });
    this.renderBathTray();

    const shampooText = result.usedShampoo ? ` com ${result.usedShampoo.name}` : "";
    this.renderer.showToast(
      `✨ Geraldei limpinho${shampooText}! +${result.hygieneRecovered} Higiene`,
    );

    if (result.leveledUp) {
      this.celebrateLevelUp(result.state.level, result.bonusCoins);
    }
  }

  celebrateLevelUp(newLevel, bonusCoins) {
    this.audio.play("levelup");
    this.renderer.triggerPetAnimation("jump");
    this.renderer.spawnParticles(["🎉", "⭐", "🪙", "❤️"], { count: 10 });
    this.renderer.showToast(`🎉 Geraldei subiu para o Nível ${newLevel}! +${bonusCoins} Coins!`, 3600);
  }

  refreshOpenViews() {
    if (this.activeTray === "food") this.renderFoodTray();
    if (this.activeTray === "bath") this.renderBathTray();
    if (this.activeModal === "shop") this.renderShop();
    if (this.activeModal === "wardrobe") this.renderWardrobe();
  }
}
