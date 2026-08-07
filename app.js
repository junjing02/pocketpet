import { buildBitmap, GRID_SIZE } from "./pet-sprites.js";
import * as db from "./supabase.js";

const HOUR = 3600000;
const STAGE_ORDER = ["egg", "baby", "child", "teen", "adult"];
const STAGE_DOT_SIZE = { egg: 3, baby: 3.5, child: 4.5, teen: 5.5, adult: 6.5 };

// Decay runs at normal (1x) speed; life stages are tuned to a 2-hour full
// growth cycle (egg -> adult) instead of the real multi-day pacing.
const TIME_SCALE = 1;
const AGE_THRESHOLD_MS = {
  baby: 12 * 60 * 1000, // 12 min
  child: 36 * 60 * 1000, // 36 min
  teen: 72 * 60 * 1000, // 1h 12m
  adult: 120 * 60 * 1000, // 2h
};

const EVOLVE_HEALTH_MIN = 50;
const DECAY_PER_HOUR = { hunger: 4, happiness: 3, energy: 2.5, hygiene: 3.5 };
const HEALTH_DECAY_PER_HOUR_NEGLECTED = 5;
const HEALTH_REGEN_PER_HOUR = 6;
const SLEEP_ENERGY_GAIN_PER_HOUR = 10;
const SLEEP_DECAY_MULTIPLIER = 0.5;

const SNACK_PRICE = 5;
const MEAL_PRICE = 15;
const STARTING_COINS = 20;
const STARTING_SNACKS = 3;
const GAME_ROUNDS = 5;
const GAME_TARGET_MS = 700;
const COINS_PER_HIT = 4;
const PRISTINE_NEGLECT_MAX = 1;

const ACHIEVEMENTS = [
  { id: "grown", label: "Fully Grown", check: (p) => p.life_stage === "adult" },
  { id: "coins", label: "Coin Collector", desc: "Earn 100 coins", check: (p) => p.total_coins_earned >= 100 },
  { id: "healthy", label: "Never Sick", desc: "Never let Health hit 0", check: (p) => !p.ever_sick },
  { id: "pristine", label: "Pristine Care", desc: "Never let a stat hit 0", check: (p) => p.neglect_incidents === 0 },
];

const clamp = (v) => Math.round(Math.max(0, Math.min(100, v)));

export function createInitialPet(name) {
  const now = new Date().toISOString();
  return {
    name,
    life_stage: "egg",
    hunger: 100,
    happiness: 100,
    energy: 100,
    health: 100,
    hygiene: 100,
    is_sick: false,
    is_sleeping: false,
    coins: STARTING_COINS,
    food_count: STARTING_SNACKS,
    meal_count: 0,
    total_coins_earned: 0,
    ever_sick: false,
    neglect_incidents: 0,
    birth_timestamp: now,
    last_updated: now,
  };
}

function updateLifeStage(pet, nowMs) {
  const ageMs = nowMs - new Date(pet.birth_timestamp).getTime();
  const idx = STAGE_ORDER.indexOf(pet.life_stage);
  const next = STAGE_ORDER[idx + 1];
  if (!next) return;
  if (ageMs >= AGE_THRESHOLD_MS[next] && pet.health >= EVOLVE_HEALTH_MIN) {
    pet.life_stage = next;
  }
}

// Simulates elapsed real time since last_updated — see design doc §6.
export function applyDecay(pet, nowMs = Date.now()) {
  const elapsedHours = ((nowMs - new Date(pet.last_updated).getTime()) / HOUR) * TIME_SCALE;
  if (elapsedHours <= 0.001) return { pet, recap: [] };

  const before = { ...pet };
  const mul = pet.is_sleeping ? SLEEP_DECAY_MULTIPLIER : 1;

  pet.hunger = clamp(pet.hunger - DECAY_PER_HOUR.hunger * elapsedHours * mul);
  pet.happiness = clamp(pet.happiness - DECAY_PER_HOUR.happiness * elapsedHours * mul);
  pet.hygiene = clamp(pet.hygiene - DECAY_PER_HOUR.hygiene * elapsedHours * mul);
  pet.energy = pet.is_sleeping
    ? clamp(pet.energy + SLEEP_ENERGY_GAIN_PER_HOUR * elapsedHours)
    : clamp(pet.energy - DECAY_PER_HOUR.energy * elapsedHours);

  // Health only drops from neglect; it recovers on its own once every other
  // stat is above 0 again (unless sick — that needs Medicine, not just care).
  const neglected = pet.hunger <= 0 || pet.happiness <= 0 || pet.hygiene <= 0;
  if (neglected) {
    pet.health = clamp(pet.health - HEALTH_DECAY_PER_HOUR_NEGLECTED * elapsedHours);
    pet.neglect_incidents = (pet.neglect_incidents || 0) + 1;
  } else if (!pet.is_sick) {
    pet.health = clamp(pet.health + HEALTH_REGEN_PER_HOUR * elapsedHours);
  }
  if (pet.health <= 0) {
    pet.is_sick = true;
    pet.ever_sick = true;
  }

  updateLifeStage(pet, nowMs);
  pet.last_updated = new Date(nowMs).toISOString();

  const recap = [];
  for (const stat of ["hunger", "happiness", "energy", "health", "hygiene"]) {
    const delta = Math.round(pet[stat] - before[stat]);
    if (delta !== 0) recap.push({ stat, delta });
  }
  if (before.life_stage !== pet.life_stage) recap.push({ stat: "life_stage", to: pet.life_stage });
  return { pet, recap };
}

export function feed(pet) {
  if (pet.is_sleeping || pet.food_count <= 0) return pet;
  pet.food_count -= 1;
  pet.hunger = clamp(pet.hunger + 30);
  pet.happiness = clamp(pet.happiness + 5);
  pet.hygiene = clamp(pet.hygiene - 5);
  return pet;
}

export function feedMeal(pet) {
  if (pet.is_sleeping || pet.meal_count <= 0) return pet;
  pet.meal_count -= 1;
  pet.hunger = clamp(pet.hunger + 60);
  pet.happiness = clamp(pet.happiness + 15);
  pet.hygiene = clamp(pet.hygiene - 10);
  return pet;
}

export function buyFood(pet) {
  if (pet.coins < SNACK_PRICE) return pet;
  pet.coins -= SNACK_PRICE;
  pet.food_count += 1;
  return pet;
}

export function buyMeal(pet) {
  if (pet.coins < MEAL_PRICE) return pet;
  pet.coins -= MEAL_PRICE;
  pet.meal_count += 1;
  return pet;
}

export function play(pet) {
  if (pet.is_sleeping || pet.energy < 10) return pet;
  pet.happiness = clamp(pet.happiness + 25);
  pet.energy = clamp(pet.energy - 15);
  pet.hunger = clamp(pet.hunger - 10);
  return pet;
}

export function clean(pet) {
  pet.hygiene = clamp(pet.hygiene + 40);
  return pet;
}

export function toggleSleep(pet) {
  pet.is_sleeping = !pet.is_sleeping;
  return pet;
}

export function giveMedicine(pet) {
  if (!pet.is_sick) return pet;
  pet.is_sick = false;
  pet.health = clamp(pet.health + 40);
  pet.happiness = clamp(pet.happiness - 5);
  return pet;
}

// ---- UI wiring ----

const STAT_LABELS = { hunger: "Hunger", happiness: "Happy", energy: "Energy", health: "Health", hygiene: "Clean" };
const $ = (id) => document.getElementById(id);

let currentPet = null;
let currentUserId = null;
let currentUserEmail = null;
let blinkOn = true;
let walkFrame = 0;
let gameActive = false;

function screen(name) {
  for (const el of document.querySelectorAll(".screen")) el.hidden = el.dataset.screen !== name;
}

function centerPetScreen(host) {
  const device = host.parentElement;
  host.style.left = `${Math.max(0, (device.clientWidth - host.offsetWidth) / 2)}px`;
  host.style.top = `${Math.max(0, (device.clientHeight - host.offsetHeight) / 2)}px`;
}

function wanderPet() {
  if (!currentPet || currentPet.life_stage === "egg" || currentPet.is_sleeping || gameActive) return;
  const host = $("pet-screen");
  const device = host.parentElement;
  const maxX = Math.max(0, device.clientWidth - host.offsetWidth);
  const maxY = Math.max(0, device.clientHeight - host.offsetHeight);
  host.style.left = `${Math.random() * maxX}px`;
  host.style.top = `${Math.random() * maxY}px`;
}

function renderPuppy(pet, eyesOpen) {
  const frame = pet.is_sleeping ? 0 : walkFrame;
  const bitmap = buildBitmap(pet.life_stage, { eyesOpen, frame, variant: petVariant(pet) });
  const host = $("pet-screen");
  host.style.setProperty("--grid-size", GRID_SIZE);
  host.style.setProperty("--dot-size", `${STAGE_DOT_SIZE[pet.life_stage] || STAGE_DOT_SIZE.egg}px`);
  let html = "";
  for (const row of bitmap) {
    for (const v of row) {
      html += `<i class="dot${v === 1 ? " dot--body" : ""}${v === 2 ? " dot--eye" : ""}"></i>`;
    }
  }
  host.innerHTML = html;
  host.classList.toggle("pet--sleeping", pet.is_sleeping);
  host.classList.toggle("pet--sick", pet.is_sick);
  if (pet.life_stage === "egg") centerPetScreen(host);

  const status = $("pet-status");
  if (pet.is_sick) {
    status.textContent = "sick";
    status.className = "pet-status pet-status--sick";
    status.hidden = false;
  } else if (pet.is_sleeping) {
    status.textContent = "zzz";
    status.className = "pet-status pet-status--sleeping";
    status.hidden = false;
  } else {
    status.hidden = true;
  }
}

function renderStats(pet) {
  for (const stat of Object.keys(STAT_LABELS)) {
    const bar = $(`bar-${stat}`);
    if (bar) bar.style.width = `${pet[stat]}%`;
    const val = $(`val-${stat}`);
    if (val) val.textContent = Math.round(pet[stat]);
  }
  $("pet-name").textContent = pet.name;
  $("pet-stage").textContent = pet.life_stage;
  $("btn-medicine").hidden = !pet.is_sick;
  $("btn-sleep").textContent = pet.is_sleeping ? "Wake" : "Sleep";
  $("pet-progress").textContent = stageProgressText(pet);

  $("val-coins").textContent = pet.coins;
  $("val-food").textContent = pet.food_count;
  $("val-meals").textContent = pet.meal_count;
  $("btn-feed").disabled = pet.food_count <= 0 || pet.is_sleeping;
  $("btn-feed-meal").disabled = pet.meal_count <= 0 || pet.is_sleeping;
  $("btn-buy-food").disabled = pet.coins < SNACK_PRICE;
  $("btn-buy-meal").disabled = pet.coins < MEAL_PRICE;
}

function renderAchievements(pet) {
  const list = $("achievements-list");
  list.innerHTML = ACHIEVEMENTS.map((a) => {
    const earned = a.check(pet);
    return `
      <div class="achievement${earned ? " achievement--earned" : ""}">
        <span class="achievement-mark">${earned ? "✓" : "·"}</span>
        <span class="achievement-text"><b>${a.label}</b>${a.desc ? ` — ${a.desc}` : ""}</span>
      </div>`;
  }).join("");
}

function petVariant(pet) {
  return pet.neglect_incidents <= PRISTINE_NEGLECT_MAX ? "pristine" : "normal";
}

function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function stageProgressText(pet) {
  const idx = STAGE_ORDER.indexOf(pet.life_stage);
  const next = STAGE_ORDER[idx + 1];
  if (!next) return "Fully grown";
  const ageMs = Date.now() - new Date(pet.birth_timestamp).getTime();
  const remaining = AGE_THRESHOLD_MS[next] - ageMs;
  if (remaining > 0) return `Evolves into ${next} in ${formatDuration(remaining)}`;
  if (pet.health < EVOLVE_HEALTH_MIN) return `Ready to evolve — raise Health above ${EVOLVE_HEALTH_MIN} first`;
  return "Evolving soon…";
}

function showRecap(recap) {
  const el = $("recap");
  if (!recap.length) {
    el.hidden = true;
    return;
  }
  const items = recap.map((r) =>
    r.stat === "life_stage" ? `Evolved into ${r.to}!` : `${STAT_LABELS[r.stat]} ${r.delta > 0 ? "+" : ""}${r.delta}`
  );
  el.innerHTML = `
    <p class="recap-title">While you were away</p>
    <ul class="recap-list">${items.map((i) => `<li>${i}</li>`).join("")}</ul>
  `;
  el.hidden = false;
}

async function persist() {
  currentPet = await db.savePet(currentPet);
}

function render() {
  renderPuppy(currentPet, blinkOn);
  renderStats(currentPet);
}

function bouncePet() {
  const host = $("pet-screen");
  host.classList.remove("pet--bounce");
  void host.offsetWidth; // restart the animation if it's still running
  host.classList.add("pet--bounce");
}

async function runAction(fn, { bounce = true } = {}) {
  fn(currentPet);
  render();
  if (bounce && !currentPet.is_sleeping) bouncePet();
  try {
    await persist();
  } catch (err) {
    showMessage(err.message, true);
  }
}

function playTapRound(overlay) {
  return new Promise((resolve) => {
    const target = document.createElement("button");
    target.type = "button";
    target.className = "game-target";
    const size = 22;
    const maxX = Math.max(0, overlay.clientWidth - size);
    const maxY = Math.max(0, overlay.clientHeight - size);
    target.style.left = `${Math.random() * maxX}px`;
    target.style.top = `${Math.random() * maxY}px`;

    let settled = false;
    const finish = (hit) => {
      if (settled) return;
      settled = true;
      target.remove();
      resolve(hit);
    };
    target.addEventListener("click", () => finish(true));
    overlay.appendChild(target);
    setTimeout(() => finish(false), GAME_TARGET_MS);
  });
}

const TIMING_PERIOD_MS = 1100;
const TIMING_ZONE = [0.4, 0.6]; // hit if the marker is within this 0..1 range

function triangleWave(elapsedMs, periodMs) {
  const phase = (elapsedMs % periodMs) / periodMs;
  return phase < 0.5 ? phase * 2 : 2 - phase * 2;
}

function playTimingRound(overlay) {
  return new Promise((resolve) => {
    overlay.innerHTML = `
      <div class="timing-track">
        <div class="timing-zone"></div>
        <div class="timing-marker"></div>
      </div>`;
    const marker = overlay.querySelector(".timing-marker");
    const start = performance.now();
    let raf, settled = false;

    const tick = (now) => {
      marker.style.left = `${triangleWave(now - start, TIMING_PERIOD_MS) * 100}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const finish = (hit) => {
      if (settled) return;
      settled = true;
      cancelAnimationFrame(raf);
      overlay.innerHTML = "";
      resolve(hit);
    };

    overlay.addEventListener(
      "click",
      () => {
        const pos = triangleWave(performance.now() - start, TIMING_PERIOD_MS);
        finish(pos >= TIMING_ZONE[0] && pos <= TIMING_ZONE[1]);
      },
      { once: true }
    );
    setTimeout(() => finish(false), 3000);
  });
}

function playOddOneOutRound(overlay) {
  return new Promise((resolve) => {
    overlay.innerHTML = '<div class="oddoneout-row"></div>';
    const row = overlay.querySelector(".oddoneout-row");
    const count = 5;
    const oddIndex = Math.floor(Math.random() * count);
    const oddClass = Math.random() < 0.5 ? "oddoneout-dot--odd-big" : "oddoneout-dot--odd-small";

    let settled = false;
    const finish = (hit) => {
      if (settled) return;
      settled = true;
      overlay.innerHTML = "";
      resolve(hit);
    };
    for (let i = 0; i < count; i++) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = `oddoneout-dot${i === oddIndex ? ` ${oddClass}` : ""}`;
      dot.addEventListener("click", () => finish(i === oddIndex));
      row.appendChild(dot);
    }
    setTimeout(() => finish(false), 1800);
  });
}

function playCountRound(overlay) {
  return new Promise((resolve) => {
    const count = 3 + Math.floor(Math.random() * 4); // 3..6
    overlay.innerHTML = '<div class="count-dots-area"></div>';
    const area = overlay.querySelector(".count-dots-area");
    const size = 10;
    const w = overlay.clientWidth || 260;
    const h = overlay.clientHeight || 180;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement("div");
      dot.className = "count-dot";
      dot.style.left = `${Math.random() * (w - size)}px`;
      dot.style.top = `${Math.random() * (h - size)}px`;
      area.appendChild(dot);
    }

    setTimeout(() => {
      const wrongPool = [count - 2, count - 1, count + 1, count + 2].filter((n) => n > 0 && n !== count);
      const wrong = [];
      while (wrong.length < 2 && wrongPool.length) {
        wrong.push(wrongPool.splice(Math.floor(Math.random() * wrongPool.length), 1)[0]);
      }
      const options = [count, ...wrong].sort(() => Math.random() - 0.5);

      overlay.innerHTML = '<div class="count-choices"></div>';
      const choicesEl = overlay.querySelector(".count-choices");
      let settled = false;
      const finish = (hit) => {
        if (settled) return;
        settled = true;
        overlay.innerHTML = "";
        resolve(hit);
      };
      options.forEach((n) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "count-choice";
        btn.textContent = String(n);
        btn.addEventListener("click", () => finish(n === count));
        choicesEl.appendChild(btn);
      });
    }, 900);
  });
}

const MINI_GAMES = [
  { id: "tap", name: "Tap the Target", round: playTapRound },
  { id: "timing", name: "Stop the Marker", round: playTimingRound },
  { id: "odd", name: "Odd One Out", round: playOddOneOutRound },
  { id: "count", name: "Count the Dots", round: playCountRound },
];

function openGamePicker() {
  $("btn-play").disabled = true;
  gameActive = true;
  $("game-modal-title").textContent = "Choose a Game";
  $("game-modal-round").textContent = "";
  $("game-picker").hidden = false;
  $("game-overlay").hidden = true;
  $("game-modal").hidden = false;
}

function closeGameModal() {
  $("game-modal").hidden = true;
  $("btn-play").disabled = false;
  gameActive = false;
}

async function runPlayGame(game) {
  const overlay = $("game-overlay");
  $("game-picker").hidden = true;
  overlay.hidden = false;
  $("game-modal-title").textContent = game.name;

  let hits = 0;
  for (let i = 0; i < GAME_ROUNDS; i++) {
    $("game-modal-round").textContent = `Round ${i + 1}/${GAME_ROUNDS} — ${hits} hit${hits === 1 ? "" : "s"}`;
    overlay.innerHTML = "";
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));
    if (await game.round(overlay)) hits++;
  }

  closeGameModal();

  play(currentPet); // usual happiness/energy/hunger effect — no-ops if sleeping or too tired
  const coinsEarned = hits * COINS_PER_HIT;
  currentPet.coins += coinsEarned;
  currentPet.total_coins_earned = (currentPet.total_coins_earned || 0) + coinsEarned;
  render();
  if (!currentPet.is_sleeping) bouncePet();
  showMessage(`${game.name}: ${hits}/${GAME_ROUNDS} hits — +${coinsEarned} coins!`);
  try {
    await persist();
  } catch (err) {
    showMessage(err.message, true);
  }
}

function wireActions() {
  $("btn-buy-food").textContent = `Buy Snack (${SNACK_PRICE})`;
  $("btn-buy-meal").textContent = `Buy Meal (${MEAL_PRICE})`;
  $("btn-feed").addEventListener("click", () => runAction(feed));
  $("btn-feed-meal").addEventListener("click", () => runAction(feedMeal));
  $("btn-play").addEventListener("click", openGamePicker);
  $("btn-game-cancel").addEventListener("click", closeGameModal);
  document.querySelectorAll(".game-picker-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const game = MINI_GAMES.find((g) => g.id === btn.dataset.game);
      runPlayGame(game);
    });
  });
  $("btn-clean").addEventListener("click", () => runAction(clean));
  $("btn-sleep").addEventListener("click", () => runAction(toggleSleep, { bounce: false }));
  $("btn-medicine").addEventListener("click", () => runAction(giveMedicine));
  $("btn-buy-food").addEventListener("click", () => runAction(buyFood, { bounce: false }));
  $("btn-buy-meal").addEventListener("click", () => runAction(buyMeal, { bounce: false }));

  $("btn-signout").addEventListener("click", async () => {
    await db.signOut();
    currentPet = null;
    currentUserId = null;
    resetAuthForm();
    screen("auth");
  });

  $("btn-help").addEventListener("click", () => {
    $("help-modal").hidden = false;
  });
  $("btn-help-close").addEventListener("click", () => {
    $("help-modal").hidden = true;
  });
  $("help-modal").addEventListener("click", (e) => {
    if (e.target.id === "help-modal") $("help-modal").hidden = true;
  });

  function collapsePasswordForm() {
    $("change-password-form").reset();
    $("change-password-form").hidden = true;
    $("btn-change-password").hidden = false;
  }

  $("btn-settings").addEventListener("click", () => {
    $("account-email").textContent = currentUserEmail || "";
    collapsePasswordForm();
    screen("settings");
  });
  $("btn-settings-back").addEventListener("click", () => {
    screen("pet");
    render();
  });

  $("btn-achievements").addEventListener("click", () => {
    renderAchievements(currentPet);
    screen("achievements");
  });
  $("btn-achievements-back").addEventListener("click", () => screen("settings"));

  $("btn-change-password").addEventListener("click", () => {
    $("btn-change-password").hidden = true;
    $("change-password-form").hidden = false;
  });
  $("btn-cancel-password").addEventListener("click", collapsePasswordForm);

  $("change-password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const oldPassword = $("settings-old-password").value;
    const newPassword = $("settings-new-password").value;
    const confirmPassword = $("settings-new-password-confirm").value;

    if (newPassword !== confirmPassword) {
      showMessage("New passwords do not match.", true);
      return;
    }

    const btn = e.submitter;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Updating…";
    showMessage("");
    try {
      await db.signIn(currentUserEmail, oldPassword);
    } catch {
      showMessage("Current password is incorrect.", true);
      btn.disabled = false;
      btn.textContent = originalText;
      return;
    }
    try {
      await db.updatePassword(newPassword);
      collapsePasswordForm();
      showMessage("Password updated.");
    } catch (err) {
      showMessage(err.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });

  $("btn-reset-pet").addEventListener("click", async () => {
    if (!confirm("Reset your pet back to a fresh egg? This cannot be undone.")) return;
    const fresh = createInitialPet(currentPet.name);
    fresh.id = currentPet.id;
    try {
      currentPet = await db.savePet(fresh);
      screen("pet");
      render();
    } catch (err) {
      showMessage(err.message, true);
    }
  });

  setInterval(() => {
    if (!currentPet) return;
    blinkOn = !blinkOn;
    renderPuppy(currentPet, blinkOn && !currentPet.is_sleeping ? blinkOn : false);
    $("pet-progress").textContent = stageProgressText(currentPet);
  }, 2500);

  setInterval(() => {
    if (!currentPet || currentPet.is_sleeping) return;
    walkFrame = walkFrame === 0 ? 1 : 0;
    renderPuppy(currentPet, blinkOn && !currentPet.is_sleeping ? blinkOn : false);
  }, 450);

  setInterval(wanderPet, 3000);
}

async function loadPetForUser(userId, email) {
  currentUserId = userId;
  currentUserEmail = email;
  try {
    let pet = await db.fetchPet(userId);
    if (!pet) {
      screen("name-pet");
      return;
    }
    const { pet: decayed, recap } = applyDecay(pet, Date.now());
    currentPet = await db.savePet(decayed);
    screen("pet");
    render();
    showRecap(recap);
  } catch (err) {
    currentUserId = null;
    showMessage(err.message, true);
  }
}

function showMessage(text, isError = false) {
  const el = $("error");
  el.textContent = text;
  el.classList.toggle("error--bad", isError);
}

// Supabase intentionally returns the same generic error for "wrong password"
// and "no such account" — distinguishing them would let an attacker enumerate
// registered emails, so we don't try to unmask that here.
function friendlyAuthError(err) {
  const msg = err.message || String(err);
  if (/invalid login credentials/i.test(msg)) return "Incorrect email or password.";
  if (/email not confirmed/i.test(msg)) return "Please confirm your email first — check your inbox.";
  return msg;
}

async function withBusy(button, busyText, fn) {
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = busyText;
  showMessage("");
  try {
    await fn();
  } catch (err) {
    showMessage(friendlyAuthError(err), true);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function wirePasswordToggles() {
  document.querySelectorAll(".toggle-pw").forEach((btn) => {
    const target = $(btn.dataset.target);
    const show = () => { target.type = "text"; };
    const hide = () => { target.type = "password"; };
    btn.addEventListener("pointerdown", show);
    btn.addEventListener("pointerup", hide);
    btn.addEventListener("pointerleave", hide);
    btn.addEventListener("pointercancel", hide);
  });
}

let authMode = "signin";

function setAuthMode(mode) {
  authMode = mode;
  $("btn-auth-primary").textContent = mode === "signin" ? "Sign In" : "Create Account";
  $("btn-toggle-mode").textContent = mode === "signin" ? "Create account" : "Back to sign in";
  $("btn-forgot").hidden = mode !== "signin";
  $("confirm-password-wrap").hidden = mode !== "signup";
  showMessage("");
}

function resetAuthForm() {
  $("auth-form").reset();
  $("reset-password-form").reset();
  setAuthMode("signin");
}

function wireAuth() {
  setAuthMode("signin");
  wirePasswordToggles();

  $("btn-toggle-mode").addEventListener("click", () => {
    setAuthMode(authMode === "signin" ? "signup" : "signin");
  });

  $("auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("auth-email").value.trim();
    const password = $("auth-password").value;
    const wasSignIn = authMode === "signin";

    if (!wasSignIn && password !== $("auth-password-confirm").value) {
      showMessage("Passwords do not match.", true);
      return;
    }

    let signedUp = false;
    await withBusy($("btn-auth-primary"), wasSignIn ? "Signing in…" : "Creating account…", async () => {
      if (wasSignIn) {
        await db.signIn(email, password);
      } else {
        await db.signUp(email, password);
        signedUp = true;
      }
    });
    if (signedUp) {
      setAuthMode("signin");
      showMessage("Check your email to confirm, then sign in.");
    }
  });

  $("btn-forgot").addEventListener("click", async () => {
    const email = $("auth-email").value.trim();
    if (!email) {
      showMessage("Enter your email above first.", true);
      return;
    }
    await withBusy($("btn-forgot"), "Sending…", async () => {
      await db.resetPasswordForEmail(email);
      showMessage("Password reset email sent — check your inbox.");
    });
  });

  $("reset-password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = $("new-password-input").value;
    await withBusy(e.submitter, "Updating…", async () => {
      await db.updatePassword(password);
      const session = await db.getSession();
      if (session) await loadPetForUser(session.user.id, session.user.email);
    });
  });

  $("name-pet-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("pet-name-input").value.trim() || "Mochi";
    try {
      currentPet = await db.createPet(currentUserId, name);
      screen("pet");
      render();
    } catch (err) {
      showMessage(err.message, true);
    }
  });
}

async function init() {
  wireAuth();
  wireActions();
  screen("auth");

  if (!db.isConfigured) {
    showMessage("Supabase not configured yet — add your project URL/anon key to supabase.js", true);
    return;
  }

  db.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      screen("reset-password");
      return;
    }
    if (session && !currentUserId) loadPetForUser(session.user.id, session.user.email);
  });

  const session = await db.getSession();
  if (session) {
    await loadPetForUser(session.user.id, session.user.email);
  }
}

init();
