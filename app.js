import { buildBitmap, GRID_SIZE } from "./pet-sprites.js";
import * as db from "./supabase.js";

const HOUR = 3600000;
const STAGE_ORDER = ["egg", "baby", "child", "teen", "adult"];
const AGE_THRESHOLD_MS = { baby: HOUR, child: HOUR * 24, teen: HOUR * 24 * 3, adult: HOUR * 24 * 7 };
const EVOLVE_HEALTH_MIN = 50;
const DECAY_PER_HOUR = { hunger: 4, happiness: 3, energy: 2.5, hygiene: 3.5 };
const HEALTH_DECAY_PER_HOUR_NEGLECTED = 5;
const SLEEP_ENERGY_GAIN_PER_HOUR = 10;
const SLEEP_DECAY_MULTIPLIER = 0.5;

const clamp = (v) => Math.max(0, Math.min(100, v));

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
  const elapsedHours = (nowMs - new Date(pet.last_updated).getTime()) / HOUR;
  if (elapsedHours <= 0.001) return { pet, recap: [] };

  const before = { ...pet };
  const mul = pet.is_sleeping ? SLEEP_DECAY_MULTIPLIER : 1;

  pet.hunger = clamp(pet.hunger - DECAY_PER_HOUR.hunger * elapsedHours * mul);
  pet.happiness = clamp(pet.happiness - DECAY_PER_HOUR.happiness * elapsedHours * mul);
  pet.hygiene = clamp(pet.hygiene - DECAY_PER_HOUR.hygiene * elapsedHours * mul);
  pet.energy = pet.is_sleeping
    ? clamp(pet.energy + SLEEP_ENERGY_GAIN_PER_HOUR * elapsedHours)
    : clamp(pet.energy - DECAY_PER_HOUR.energy * elapsedHours);

  const neglected = pet.hunger <= 0 || pet.happiness <= 0 || pet.hygiene <= 0;
  if (neglected) {
    pet.health = clamp(pet.health - HEALTH_DECAY_PER_HOUR_NEGLECTED * elapsedHours);
  }
  if (pet.health <= 0) pet.is_sick = true;

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
  if (pet.is_sleeping) return pet;
  pet.hunger = clamp(pet.hunger + 30);
  pet.happiness = clamp(pet.happiness + 5);
  pet.hygiene = clamp(pet.hygiene - 5);
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
let blinkOn = true;

function screen(name) {
  for (const el of document.querySelectorAll(".screen")) el.hidden = el.dataset.screen !== name;
}

function renderPetDots(pet, eyesOpen) {
  const bitmap = buildBitmap(pet.life_stage, { eyesOpen });
  const host = $("pet-screen");
  host.style.setProperty("--grid-size", GRID_SIZE);
  let html = "";
  for (const row of bitmap) {
    for (const v of row) {
      html += `<i class="dot${v === 1 ? " dot--body" : ""}${v === 2 ? " dot--eye" : ""}"></i>`;
    }
  }
  host.innerHTML = html;
  host.classList.toggle("pet--sleeping", pet.is_sleeping);

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
}

function showRecap(recap) {
  const el = $("recap");
  if (!recap.length) {
    el.hidden = true;
    return;
  }
  const parts = recap.map((r) =>
    r.stat === "life_stage" ? `Evolved into ${r.to}!` : `${STAT_LABELS[r.stat]} ${r.delta > 0 ? "+" : ""}${r.delta}`
  );
  el.textContent = "While you were away: " + parts.join(", ");
  el.hidden = false;
}

async function persist() {
  currentPet = await db.savePet(currentPet);
}

function render() {
  renderPetDots(currentPet, blinkOn);
  renderStats(currentPet);
}

async function runAction(fn) {
  fn(currentPet);
  render();
  try {
    await persist();
  } catch (err) {
    $("error").textContent = err.message;
  }
}

function wireActions() {
  $("btn-feed").addEventListener("click", () => runAction(feed));
  $("btn-play").addEventListener("click", () => runAction(play));
  $("btn-clean").addEventListener("click", () => runAction(clean));
  $("btn-sleep").addEventListener("click", () => runAction(toggleSleep));
  $("btn-medicine").addEventListener("click", () => runAction(giveMedicine));
  $("btn-signout").addEventListener("click", async () => {
    await db.signOut();
    currentPet = null;
    currentUserId = null;
    screen("auth");
  });

  setInterval(() => {
    if (!currentPet) return;
    blinkOn = !blinkOn;
    renderPetDots(currentPet, blinkOn && !currentPet.is_sleeping ? blinkOn : false);
  }, 2500);
}

async function loadPetForUser(userId) {
  currentUserId = userId;
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
}

function wireAuth() {
  $("auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("auth-email").value.trim();
    const password = $("auth-password").value;
    $("error").textContent = "";
    try {
      await db.signIn(email, password);
    } catch (err) {
      $("error").textContent = err.message;
    }
  });

  $("btn-signup").addEventListener("click", async () => {
    const email = $("auth-email").value.trim();
    const password = $("auth-password").value;
    $("error").textContent = "";
    try {
      await db.signUp(email, password);
      $("error").textContent = "Check your email to confirm, then sign in.";
    } catch (err) {
      $("error").textContent = err.message;
    }
  });

  $("name-pet-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("pet-name-input").value.trim() || "Mochi";
    try {
      currentPet = await db.createPet(currentUserId, name);
      screen("pet");
      render();
    } catch (err) {
      $("error").textContent = err.message;
    }
  });
}

async function init() {
  wireAuth();
  wireActions();
  screen("auth");

  if (!db.isConfigured) {
    $("error").textContent = "Supabase not configured yet — add your project URL/anon key to supabase.js";
    return;
  }

  const session = await db.getSession();
  if (session) {
    await loadPetForUser(session.user.id);
  }

  db.onAuthStateChange((session) => {
    if (session && !currentUserId) loadPetForUser(session.user.id);
  });
}

init();
