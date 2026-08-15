import {
  buildBitmap,
  trimBitmap,
  STAGE_ORDER,
  DOT_SIZE,
  SPECIES,
  SPECIES_SHADE,
  pickRandomSpecies,
  STAGE_MOVE_DURATION_S,
  STAGE_WANDER_INTERVAL_MS,
} from "./pet-sprites.js?v=78";
import * as db from "./supabase.js?v=78";
import { playSound, soundEnabled, setSoundEnabled, playMelody, stopMelody, isMelodyPlaying } from "./sound.js?v=78";
import { VERSION } from "./version.js?v=78";

const HOUR = 3600000;

// Decay runs at normal (1x) speed; life stages are tuned to a 2-hour full
// growth cycle (egg -> adult) instead of the real multi-day pacing.
const TIME_SCALE = 1;
const AGE_THRESHOLD_MS = {
  hatchling: 4 * 60 * 1000, // 4 min
  young: 14 * 60 * 1000, // 14 min
  teen: 36 * 60 * 1000, // 36 min
  juvenile: 72 * 60 * 1000, // 1h 12m
  adult: 120 * 60 * 1000, // 2h
};

const EVOLVE_HEALTH_MIN = 50;
const DECAY_PER_HOUR = { hunger: 4, happiness: 3, energy: 2.5, hygiene: 3.5 };
const HEALTH_DECAY_PER_HOUR_NEGLECTED = 5;
const HEALTH_REGEN_PER_HOUR = 6;
const SLEEP_ENERGY_GAIN_PER_HOUR = 10;
const SLEEP_DECAY_MULTIPLIER = 0.5;
// A pet with a bed always walks to it before sleeping (see
// walkToBedThenSleep), so has_bed alone is enough to know it's sleeping on
// one — no separate "currently on the bed" state needed.
const BED_SLEEP_ENERGY_MULTIPLIER = 1.5;

const SNACK_PRICE = 5;
const MEAL_PRICE = 15;
const BOW_PRICE = 25;
const DEFAULT_BOW_COLOR = "#d1477a";
const BED_PRICE = 30;
const DEFAULT_BED_X = 0.7;
const DEFAULT_BED_Y = 0.7;

const VITAMINS_PRICE = 30;
const NIGHT_LIGHT_PRICE = 20;
const MUSIC_BOX_PRICE = 20;
const DEFAULT_MUSIC_BOX_X = 0.05;
const DEFAULT_MUSIC_BOX_Y = 0.95;
const TOY_PRICE = 20;
const DEFAULT_TOY_X = 0.3;
const DEFAULT_TOY_Y = 0.3;
const DEFAULT_BALL_COLOR = "#5b9bd5";

const VITAMINS_HEALTH_REGEN_MULTIPLIER = 1.5; // health regenerates 50% faster while a dose is active
const VITAMIN_BUFF_DURATION_MS = 15 * 60 * 1000;
const NIGHT_LIGHT_SLEEP_DECAY_MULTIPLIER = 0.75; // stacks on top of SLEEP_DECAY_MULTIPLIER
const MUSIC_BOX_HAPPINESS_MULTIPLIER = 0.8; // happiness decays 20% slower
const MUSIC_BOX_CHIME_MIN_MS = 45 * 1000;
const MUSIC_BOX_CHIME_MAX_MS = 90 * 1000;
const TOY_VISIT_MIN_MS = 30 * 1000;
const TOY_VISIT_MAX_MS = 75 * 1000;
const TOY_HAPPY_GAIN = 8;

// Poop spawns on the same simulated-elapsed-time schedule as everything else
// (design doc §6) — every POOP_INTERVAL_HOURS of "awake" time, capped at
// MAX_POOP_COUNT. Each uncleared poop bites into Hygiene on top of its usual
// decay, so ignoring it feeds into the existing neglect/health pipeline in
// applyDecay rather than needing a separate illness path of its own.
const MAX_POOP_COUNT = 3;
const POOP_INTERVAL_HOURS = 0.33; // ~20 min at 1x TIME_SCALE
const POOP_HYGIENE_PENALTY_PER_HOUR = 2;

// Beethoven's "Ode to Joy" opening phrase (public domain) — the Music Box's
// toggleable song, played as a plain note sequence through the same
// synthesized-tone approach as every other sound (see playMelody in
// sound.js), not an audio file, to keep the project's zero-asset-weight
// approach intact.
const ODE_TO_JOY = [
  329.63, 329.63, 349.23, 392.0, // E E F G
  392.0, 349.23, 329.63, 293.66, // G F E D
  261.63, 261.63, 293.66, 329.63, // C C D E
  329.63, 293.66, 293.66, // E D D
];

const STARTING_COINS = 20;
const STARTING_SNACKS = 3;
const GAME_ROUNDS = 5;
const GAME_TARGET_MS = 700;
const COINS_PER_HIT = 4;
const PRISTINE_NEGLECT_MAX = 1;
const MAX_PETS = 3;
const DAILY_BONUS_BASE = 5;
const DAILY_BONUS_PER_STREAK = 2;
const DAILY_BONUS_MAX = 25;
const LOW_STAT_THRESHOLD = 20;

// Visual + text cue for the most urgent unmet need, checked in this order —
// sick/sleeping/egg take priority and are handled separately in renderPuppy.
const LOW_STAT_MOODS = [
  { key: "hunger", cls: "pet--hungry", label: "hungry" },
  { key: "energy", cls: "pet--tired", label: "tired" },
  { key: "hygiene", cls: "pet--dirty", label: "dirty" },
  { key: "happiness", cls: "pet--sad", label: "sad" },
];

function lowStatMood(pet) {
  if (pet.is_sick || pet.is_sleeping || pet.life_stage === "egg") return null;
  return LOW_STAT_MOODS.find((m) => pet[m.key] <= LOW_STAT_THRESHOLD) || null;
}

// First-person status + suggestion, shown as a hover tooltip on the pet
// itself (reuses the existing [data-tooltip] hover/hold-to-peek system —
// see wireTooltipTouch and the CSS rules for it). Priority matches the
// status badge above: sick > sleeping > low stat > content.
const MOOD_TOOLTIP = {
  hunger: "Hungry! Feed me?",
  energy: "Too tired to move. Sleep?",
  hygiene: "Feeling gross. Clean me?",
  happiness: "Feeling down. Play?",
};

function petTooltipMessage(pet, mood) {
  if (pet.life_stage === "egg") return "Shh, still hatching...";
  if (pet.is_sick) return "Not feeling well. Medicine?";
  if (pet.is_sleeping) return "Zzz... resting.";
  if (mood) return MOOD_TOOLTIP[mood.key];
  return "Doing great! Poke me.";
}

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
    species: pickRandomSpecies(),
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
    last_login_date: null,
    login_streak: 0,
    has_bow: false,
    bow_worn: false,
    bow_color: DEFAULT_BOW_COLOR,
    has_bed: false,
    bed_active: true,
    bed_x: DEFAULT_BED_X,
    bed_y: DEFAULT_BED_Y,
    vitamin_count: 0,
    vitamins_until: null,
    has_night_light: false,
    night_light_active: true,
    night_light_x: 0.5,
    has_music_box: false,
    music_box_active: true,
    music_box_x: DEFAULT_MUSIC_BOX_X,
    music_box_y: DEFAULT_MUSIC_BOX_Y,
    has_toy: false,
    toy_active: true,
    toy_x: DEFAULT_TOY_X,
    toy_y: DEFAULT_TOY_Y,
    ball_color: DEFAULT_BALL_COLOR,
    poop_count: 0,
    last_poop_at: now,
    music_box_playing: false,
    birth_timestamp: now,
    last_updated: now,
  };
}

// Returns { streak, bonus } the first time this is called on a given
// calendar day, or null if today's login was already counted.
export function applyDailyLogin(pet, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  if (pet.last_login_date === today) return null;

  let streak = 1;
  if (pet.last_login_date) {
    const prev = new Date(`${pet.last_login_date}T00:00:00Z`);
    const cur = new Date(`${today}T00:00:00Z`);
    const dayGap = Math.round((cur - prev) / 86400000);
    if (dayGap === 1) streak = (pet.login_streak || 0) + 1;
  }

  pet.login_streak = streak;
  pet.last_login_date = today;
  const bonus = Math.min(DAILY_BONUS_BASE + (streak - 1) * DAILY_BONUS_PER_STREAK, DAILY_BONUS_MAX);
  pet.coins += bonus;
  pet.total_coins_earned = (pet.total_coins_earned || 0) + bonus;
  return { streak, bonus };
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

  // An egg has no needs yet — it just waits to hatch, nothing to decay.
  if (pet.life_stage !== "egg") {
    const mul = pet.is_sleeping
      ? SLEEP_DECAY_MULTIPLIER * (pet.has_night_light && pet.night_light_active ? NIGHT_LIGHT_SLEEP_DECAY_MULTIPLIER : 1)
      : 1;

    const musicBoxMul = pet.has_music_box && pet.music_box_active ? MUSIC_BOX_HAPPINESS_MULTIPLIER : 1;
    pet.hunger = clamp(pet.hunger - DECAY_PER_HOUR.hunger * elapsedHours * mul);
    pet.happiness = clamp(pet.happiness - DECAY_PER_HOUR.happiness * elapsedHours * mul * musicBoxMul);
    const poopHygieneRate = DECAY_PER_HOUR.hygiene + POOP_HYGIENE_PENALTY_PER_HOUR * (pet.poop_count || 0);
    pet.hygiene = clamp(pet.hygiene - poopHygieneRate * elapsedHours * mul);

    if ((pet.poop_count || 0) < MAX_POOP_COUNT) {
      const lastPoopMs = new Date(pet.last_poop_at || pet.last_updated).getTime();
      const hoursSincePoop = ((nowMs - lastPoopMs) / HOUR) * TIME_SCALE * mul;
      const newPoops = Math.floor(hoursSincePoop / POOP_INTERVAL_HOURS);
      if (newPoops > 0) {
        pet.poop_count = Math.min(MAX_POOP_COUNT, (pet.poop_count || 0) + newPoops);
        pet.last_poop_at = new Date(lastPoopMs + newPoops * POOP_INTERVAL_HOURS * HOUR).toISOString();
      }
    }
    const sleepEnergyRate = SLEEP_ENERGY_GAIN_PER_HOUR * (pet.has_bed && pet.bed_active ? BED_SLEEP_ENERGY_MULTIPLIER : 1);
    pet.energy = pet.is_sleeping
      ? clamp(pet.energy + sleepEnergyRate * elapsedHours)
      : clamp(pet.energy - DECAY_PER_HOUR.energy * elapsedHours);

    // Health only drops from neglect; it recovers on its own once every other
    // stat is above 0 again (unless sick — that needs Medicine, not just care).
    const neglected = pet.hunger <= 0 || pet.happiness <= 0 || pet.hygiene <= 0;
    if (neglected) {
      pet.health = clamp(pet.health - HEALTH_DECAY_PER_HOUR_NEGLECTED * elapsedHours);
      pet.neglect_incidents = (pet.neglect_incidents || 0) + 1;
    } else if (!pet.is_sick) {
      // A fed dose of Vitamins (see giveVitamins) sets vitamins_until —
      // regen runs faster only while that window is still open.
      const vitaminsActive = pet.vitamins_until && new Date(pet.vitamins_until).getTime() > nowMs;
      const regenRate = HEALTH_REGEN_PER_HOUR * (vitaminsActive ? VITAMINS_HEALTH_REGEN_MULTIPLIER : 1);
      pet.health = clamp(pet.health + regenRate * elapsedHours);
    }
    if (pet.health <= 0) {
      pet.is_sick = true;
      pet.ever_sick = true;
    }
  }

  updateLifeStage(pet, nowMs);
  pet.last_updated = new Date(nowMs).toISOString();

  const recap = [];
  for (const stat of ["hunger", "happiness", "energy", "health", "hygiene"]) {
    const delta = Math.round(pet[stat] - before[stat]);
    if (delta !== 0) recap.push({ stat, delta });
  }
  if (before.life_stage !== pet.life_stage) recap.push({ stat: "life_stage", to: pet.life_stage, species: pet.species || "bird" });
  return { pet, recap };
}

export function feed(pet) {
  if (pet.life_stage === "egg" || pet.is_sleeping || pet.food_count <= 0) return pet;
  pet.food_count -= 1;
  pet.hunger = clamp(pet.hunger + 30);
  pet.happiness = clamp(pet.happiness + 5);
  pet.hygiene = clamp(pet.hygiene - 5);
  return pet;
}

export function feedMeal(pet) {
  if (pet.life_stage === "egg" || pet.is_sleeping || pet.meal_count <= 0) return pet;
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

export function buyBow(pet) {
  if (pet.has_bow || pet.coins < BOW_PRICE) return pet;
  pet.coins -= BOW_PRICE;
  pet.has_bow = true;
  pet.bow_worn = true; // wear it right away so the purchase is immediately visible
  return pet;
}

export function toggleBow(pet) {
  if (!pet.has_bow) return pet;
  pet.bow_worn = !pet.bow_worn;
  return pet;
}

export function setBowColor(pet, color) {
  if (!pet.has_bow) return pet;
  pet.bow_color = color;
  return pet;
}

export function buyBed(pet) {
  if (pet.has_bed || pet.coins < BED_PRICE) return pet;
  pet.coins -= BED_PRICE;
  pet.has_bed = true;
  pet.bed_active = true; // placed in the playground right away, same as the bow is worn right away
  if (pet.bed_x == null) pet.bed_x = DEFAULT_BED_X;
  if (pet.bed_y == null) pet.bed_y = DEFAULT_BED_Y;
  return pet;
}

export function toggleBedActive(pet) {
  if (!pet.has_bed) return pet;
  pet.bed_active = !pet.bed_active;
  return pet;
}

// Vitamins are a stash-and-feed consumable like Snacks/Meals, not a one-time
// purchase — buying just adds to the count; giveVitamins is what actually
// starts the temporary faster-Health-regen window (see applyDecay).
export function buyVitamins(pet) {
  if (pet.coins < VITAMINS_PRICE) return pet;
  pet.coins -= VITAMINS_PRICE;
  pet.vitamin_count = (pet.vitamin_count || 0) + 1;
  return pet;
}

export function giveVitamins(pet, nowMs = Date.now()) {
  if (pet.life_stage === "egg" || pet.vitamin_count <= 0) return pet;
  pet.vitamin_count -= 1;
  pet.vitamins_until = new Date(nowMs + VITAMIN_BUFF_DURATION_MS).toISOString();
  return pet;
}

export function buyNightLight(pet) {
  if (pet.has_night_light || pet.coins < NIGHT_LIGHT_PRICE) return pet;
  pet.coins -= NIGHT_LIGHT_PRICE;
  pet.has_night_light = true;
  pet.night_light_active = true;
  return pet;
}

export function toggleNightLightActive(pet) {
  if (!pet.has_night_light) return pet;
  pet.night_light_active = !pet.night_light_active;
  return pet;
}

export function buyMusicBox(pet) {
  if (pet.has_music_box || pet.coins < MUSIC_BOX_PRICE) return pet;
  pet.coins -= MUSIC_BOX_PRICE;
  pet.has_music_box = true;
  pet.music_box_active = true;
  return pet;
}

export function toggleMusicBoxActive(pet) {
  if (!pet.has_music_box) return pet;
  pet.music_box_active = !pet.music_box_active;
  return pet;
}

export function buyToy(pet) {
  if (pet.has_toy || pet.coins < TOY_PRICE) return pet;
  pet.coins -= TOY_PRICE;
  pet.has_toy = true;
  pet.toy_active = true;
  return pet;
}

export function toggleToyActive(pet) {
  if (!pet.has_toy) return pet;
  pet.toy_active = !pet.toy_active;
  return pet;
}

export function setBallColor(pet, color) {
  if (!pet.has_toy) return pet;
  pet.ball_color = color;
  return pet;
}

export function play(pet) {
  if (pet.life_stage === "egg" || pet.is_sleeping || pet.energy < 10) return pet;
  pet.happiness = clamp(pet.happiness + 25);
  pet.energy = clamp(pet.energy - 15);
  pet.hunger = clamp(pet.hunger - 10);
  return pet;
}

export function clean(pet) {
  if (pet.life_stage === "egg") return pet;
  pet.hygiene = clamp(pet.hygiene + 40);
  return pet;
}

// Clears a single dropped poop (see MAX_POOP_COUNT in applyDecay) — a small
// direct Hygiene bump, separate from the full-bath Clean button above.
export function clearPoop(pet) {
  if ((pet.poop_count || 0) <= 0) return pet;
  pet.poop_count -= 1;
  pet.hygiene = clamp(pet.hygiene + 5);
  return pet;
}

export function toggleSleep(pet) {
  if (pet.life_stage === "egg") return pet;
  pet.is_sleeping = !pet.is_sleeping;
  return pet;
}

export function giveMedicine(pet) {
  if (pet.life_stage === "egg" || !pet.is_sick) return pet;
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
let eyesOpen = true;
let walkFrame = 0;
let gameActive = false;
let draggingPet = false;
let walkingToBed = false;
let visitingToy = false; // walking to/playing with the Toy on its own — see walkToToyThenPlay
let currentCollection = new Set(); // species discovered across this user's pet history — see Collection screen
let currentScores = {}; // game id -> best hits, shown as a badge in the Play menu

function screen(name) {
  for (const el of document.querySelectorAll(".screen")) el.hidden = el.dataset.screen !== name;
}

function centerPetScreen(host) {
  const device = host.parentElement;
  host.style.left = `${Math.max(0, (device.clientWidth - host.offsetWidth) / 2)}px`;
  host.style.top = `${Math.max(0, (device.clientHeight - host.offsetHeight) / 2)}px`;
}

// Too exhausted to move under its own power (still fine to be dragged,
// since that's you carrying it rather than it walking).
function isTooTiredToWalk(pet) {
  return pet.energy <= LOW_STAT_THRESHOLD;
}

// Sick pets stay mostly put instead of roaming — most wander ticks are
// skipped, and the rare one that isn't is a small shuffle from wherever it
// already is, not a full jump across the playground.
const SICK_WANDER_CHANCE = 0.2;
const SICK_SHUFFLE_PX = 24;

// Keeps a small gap between the pet and the playground's own wall instead of
// letting it wander/drag flush up against the edge. Shared by every place
// that computes where the pet is allowed to go.
const PLAYGROUND_MARGIN_PX = 8;

function wanderBounds(host, device) {
  const minX = PLAYGROUND_MARGIN_PX;
  const minY = PLAYGROUND_MARGIN_PX;
  const maxX = Math.max(minX, device.clientWidth - host.offsetWidth - PLAYGROUND_MARGIN_PX);
  const maxY = Math.max(minY, device.clientHeight - host.offsetHeight - PLAYGROUND_MARGIN_PX);
  return { minX, minY, maxX, maxY };
}

// The bed can't be dragged above this fraction of the playground's height —
// keeps it in the lower portion instead of floating up near the top, which
// read oddly for a "floor" prop. No visible marker for the limit — it just
// silently stops there.
const GROUND_MIN_Y_FRACTION = 0.42;

function groundedBounds(el, device) {
  const base = wanderBounds(el, device);
  const floorMinY = device.clientHeight * GROUND_MIN_Y_FRACTION;
  return { ...base, minY: Math.max(base.minY, floorMinY) };
}

// Small AABB overlap test (with a little padding so items don't end up
// touching edge-to-edge either) used to keep every floor item apart.
function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh, pad = 4) {
  return ax < bx + bw + pad && ax + aw + pad > bx && ay < by + bh + pad && ay + ah + pad > by;
}

// Every floor item that must never overlap another — the Bed and Toy are
// draggable (see GROUNDED_ITEMS), the Music Box is fixed but still occupies
// floor space, so it's still a live obstacle for the other two.
const FLOOR_OBSTACLE_IDS = ["pet-bed", "toy", "music-box"];

function overlapsFloorObstacles(excludeId, x, y, w, h) {
  for (const id of FLOOR_OBSTACLE_IDS) {
    if (id === excludeId) continue;
    const el = $(id);
    if (el.hidden) continue;
    if (rectsOverlap(x, y, w, h, el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight)) return true;
  }
  return false;
}

// Random spot within `el`'s own grounded bounds that doesn't overlap any
// other floor item — used for the Toy's "kick" (see kickToy). Gives up
// after a handful of tries and just returns the last spot rolled rather
// than looping forever on a crowded playground.
function randomFreeFloorSpot(el, device, excludeId) {
  const { minX, minY, maxX, maxY } = groundedBounds(el, device);
  let x = minX, y = minY;
  for (let i = 0; i < 12; i++) {
    x = minX + Math.random() * (maxX - minX);
    y = minY + Math.random() * (maxY - minY);
    if (!overlapsFloorObstacles(excludeId, x, y, el.offsetWidth, el.offsetHeight)) break;
  }
  return { x, y };
}

function wanderPet() {
  if (!currentPet || currentPet.life_stage === "egg" || currentPet.is_sleeping || gameActive || draggingPet || walkingToBed || visitingToy) return;
  if (isTooTiredToWalk(currentPet)) return;
  const host = $("pet-screen");
  const device = host.parentElement;
  const { minX, minY, maxX, maxY } = wanderBounds(host, device);

  if (currentPet.is_sick) {
    if (Math.random() > SICK_WANDER_CHANCE) return;
    const x = Math.min(maxX, Math.max(minX, host.offsetLeft + (Math.random() * 2 - 1) * SICK_SHUFFLE_PX));
    const y = Math.min(maxY, Math.max(minY, host.offsetTop + (Math.random() * 2 - 1) * SICK_SHUFFLE_PX));
    host.style.left = `${x}px`;
    host.style.top = `${y}px`;
    return;
  }

  host.style.left = `${minX + Math.random() * (maxX - minX)}px`;
  host.style.top = `${minY + Math.random() * (maxY - minY)}px`;
}

// Younger pets wander more often (and move there faster, via --move-duration
// set in renderPuppy) than older ones — re-reads the current pet's stage on
// every tick instead of a fixed interval, so pacing updates live as it grows.
function scheduleWander() {
  const interval = currentPet ? STAGE_WANDER_INTERVAL_MS[currentPet.life_stage] || 3000 : 3000;
  setTimeout(() => {
    wanderPet();
    scheduleWander();
  }, interval);
}

// Click-to-walk: tapping empty space in the playground (not the pet itself)
// sends it toward that spot instead of just wandering randomly.
function movePetTowards(clickX, clickY) {
  if (!currentPet || currentPet.life_stage === "egg" || currentPet.is_sleeping || gameActive || walkingToBed || visitingToy) return;
  if (isTooTiredToWalk(currentPet)) return;
  const host = $("pet-screen");
  const device = host.parentElement;
  const { minX, minY, maxX, maxY } = wanderBounds(host, device);
  const targetX = Math.min(maxX, Math.max(minX, clickX - host.offsetWidth / 2));
  const targetY = Math.min(maxY, Math.max(minY, clickY - host.offsetHeight / 2));
  host.style.left = `${targetX}px`;
  host.style.top = `${targetY}px`;
}

function renderPuppy(pet, eyesOpen) {
  const frame = pet.is_sleeping ? 0 : walkFrame;
  const bitmap = buildBitmap(pet.life_stage, {
    species: speciesOf(pet),
    eyesOpen,
    frame,
    variant: petVariant(pet),
    hasBow: pet.has_bow && pet.bow_worn,
  });
  const host = $("pet-screen");
  // Trim to the creature's actual bounding box (not the full 25x25 grid) so
  // the host element's own size matches what's visible — keeps wandering
  // bounds accurate and lets the ground shadow (CSS ::after) sit right
  // under its feet instead of under a bunch of empty grid.
  const { rows, width } = trimBitmap(bitmap);
  host.style.setProperty("--grid-size", width);
  host.style.setProperty("--dot-size", `${DOT_SIZE}px`);
  host.style.setProperty("--move-duration", `${STAGE_MOVE_DURATION_S[pet.life_stage] ?? 1.6}s`);
  // Species stays a surprise until it hatches — the egg shape is shared, so
  // don't leak a species-specific shade before there's a species to reveal.
  if (pet.life_stage === "egg") host.style.removeProperty("--dot-color");
  else host.style.setProperty("--dot-color", SPECIES_SHADE[speciesOf(pet)]);
  host.style.setProperty("--bow-color", pet.bow_color || DEFAULT_BOW_COLOR);
  let html = "";
  for (const row of rows) {
    for (const v of row) {
      html += `<i class="dot${v === 1 ? " dot--body" : ""}${v === 2 ? " dot--eye" : ""}${v === 3 ? " dot--outline" : ""}${v === 4 ? " dot--bow" : ""}"></i>`;
    }
  }
  host.innerHTML = html;
  host.classList.toggle("pet--sleeping", pet.is_sleeping);
  host.classList.toggle("pet--sick", pet.is_sick);
  const mood = lowStatMood(pet);
  for (const m of LOW_STAT_MOODS) host.classList.toggle(m.cls, mood === m);
  host.dataset.tooltip = petTooltipMessage(pet, mood);
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
  } else if (mood) {
    status.textContent = mood.label;
    status.className = `pet-status pet-status--mood ${mood.cls}`;
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
  const isEgg = pet.life_stage === "egg";

  $("pet-name").textContent = pet.name;
  $("pet-stage").textContent = isEgg ? pet.life_stage : `${speciesLabel(pet)} · ${pet.life_stage}`;
  $("btn-medicine").hidden = !pet.is_sick;
  $("btn-sleep").textContent = walkingToBed ? "Walking…" : pet.is_sleeping ? "Wake" : "Sleep";
  $("btn-sleep").disabled = walkingToBed;
  $("pet-progress").textContent = stageProgressText(pet);

  $("egg-note").hidden = !isEgg;
  $("care-actions").hidden = isEgg;

  $("val-coins").textContent = pet.coins;
  $("val-food").textContent = pet.food_count;
  $("val-meals").textContent = pet.meal_count;
  $("val-vitamins").textContent = pet.vitamin_count || 0;
  $("btn-feed").disabled = pet.food_count <= 0 || pet.is_sleeping;
  $("btn-feed-meal").disabled = pet.meal_count <= 0 || pet.is_sleeping;
  $("btn-clean").disabled = pet.is_sleeping;
  $("btn-play").disabled = pet.is_sleeping || pet.energy < 10;
  $("btn-medicine").disabled = pet.is_sleeping;
  $("btn-vitamins").disabled = (pet.vitamin_count || 0) <= 0 || pet.is_sleeping;

  // A visible "↑" next to Health acknowledges a fed dose of Vitamins —
  // otherwise the buff has no on-screen sign it's doing anything until it
  // wears off.
  const vitaminsActive = pet.vitamins_until && new Date(pet.vitamins_until).getTime() > Date.now();
  $("stat-health").classList.toggle("stat--boosted", !!vitaminsActive);
}

function renderAchievements(pet) {
  const list = $("achievements-list");
  list.innerHTML = ACHIEVEMENTS.map((a) => {
    const earned = a.check(pet);
    return `
      <div class="achievement${earned ? " achievement--earned" : ""}">
        <span class="achievement-mark">${earned ? "✓" : "·"}</span>
        <span class="achievement-text"><b>${a.label}</b>${a.desc ? ` (${a.desc})` : ""}</span>
      </div>`;
  }).join("");
}

// One row per known species (see SPECIES in pet-sprites.js) — undiscovered
// ones show a "???" placeholder instead of the mini sprite, same secrecy as
// an unhatched egg. Built from a stand-in adult pet object, not a real one,
// since this tracks species discovered across a user's whole pet history
// (survives Release/Reset), not anything about the currently active pet.
function renderCollection() {
  const list = $("collection-list");
  list.innerHTML = SPECIES.map((sp) => {
    const discovered = currentCollection.has(sp);
    const label = sp[0].toUpperCase() + sp.slice(1);
    const thumb = discovered
      ? (() => {
          const sprite = miniSpriteHtml({ life_stage: "adult", species: sp, has_bow: false, neglect_incidents: 0 });
          return `<div class="pet-picker-thumb" style="--dot-color:${SPECIES_SHADE[sp]}">
            <div class="pet-picker-thumb-grid" style="--grid-size:${sprite.width}">${sprite.html}</div>
          </div>`;
        })()
      : `<div class="collection-thumb-placeholder">?</div>`;
    return `
      <div class="collection-row${discovered ? " collection-row--discovered" : ""}">
        ${thumb}
        <span>${discovered ? `<b>${label}</b>` : "???"}</span>
      </div>`;
  }).join("");
}

function petVariant(pet) {
  return pet.neglect_incidents <= PRISTINE_NEGLECT_MAX ? "pristine" : "normal";
}

// Falls back to "bird" for any pet row fetched before the `species` column
// existed — old rows read as undefined until the migration backfills them.
function speciesOf(pet) {
  return pet.species || "bird";
}

function speciesLabel(pet) {
  const s = speciesOf(pet);
  return s[0].toUpperCase() + s.slice(1);
}

function miniSpriteHtml(pet) {
  const bitmap = buildBitmap(pet.life_stage, {
    species: speciesOf(pet),
    eyesOpen: true,
    variant: petVariant(pet),
    hasBow: pet.has_bow && pet.bow_worn,
  });
  const { rows, width } = trimBitmap(bitmap);
  let html = "";
  for (const row of rows) {
    for (const v of row) {
      html += `<i class="dot${v === 1 ? " dot--body" : ""}${v === 2 ? " dot--eye" : ""}${v === 3 ? " dot--outline" : ""}${v === 4 ? " dot--bow" : ""}"></i>`;
    }
  }
  return { html, width };
}

function renderPetPicker(pets) {
  const list = $("pet-picker-list");
  list.innerHTML = pets
    .map((p) => {
      const sprite = miniSpriteHtml(p);
      return `
    <div class="pet-picker-item${p.is_active ? " pet-picker-item--active" : ""}">
      <div class="pet-picker-thumb" style="${p.life_stage === "egg" ? "" : `--dot-color:${SPECIES_SHADE[speciesOf(p)]};`}--bow-color:${p.bow_color || DEFAULT_BOW_COLOR}">
        <div class="pet-picker-thumb-grid" style="--grid-size:${sprite.width}">${sprite.html}</div>
      </div>
      <div class="pet-picker-info">
        <b>${p.name}</b>
        <span>${p.life_stage === "egg" ? p.life_stage : `${speciesLabel(p)} · ${p.life_stage}${p.is_sleeping ? " · zzz" : ""}`}</span>
      </div>
      <button type="button" class="pet-picker-select" data-pet-id="${p.id}" ${p.is_active ? "disabled" : ""}>
        ${p.is_active ? "Active" : "Select"}
      </button>
    </div>`;
    })
    .join("");

  list.querySelectorAll(".pet-picker-select").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const petId = btn.dataset.petId;
      btn.disabled = true;
      btn.textContent = "Loading…";
      try {
        const updated = await db.setActivePet(currentUserId, petId);
        await activatePetAndRender(updated);
      } catch (err) {
        showMessage(err.message, true);
        btn.disabled = false;
        btn.textContent = "Select";
      }
    });
  });

  $("btn-hatch-another").disabled = pets.length >= MAX_PETS;
  $("btn-hatch-another").dataset.tooltip =
    pets.length >= MAX_PETS ? `Max ${MAX_PETS} pets. Release your active one to hatch another` : "Hatch a new egg. Your other pets keep going";
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
  if (pet.health < EVOLVE_HEALTH_MIN) return `Ready to evolve. Raise Health above ${EVOLVE_HEALTH_MIN} first`;
  return "Evolving soon…";
}

function showRecap(recap, loginBonus) {
  const stageChange = recap.find((r) => r.stat === "life_stage");
  if (stageChange) playSound(stageChange.to === "hatchling" ? "hatch" : "evolve");

  const el = $("recap");
  const items = recap.map((r) => {
    if (r.stat !== "life_stage") return `${STAT_LABELS[r.stat]} ${r.delta > 0 ? "+" : ""}${r.delta}`;
    if (r.to === "hatchling") {
      const species = `${r.species[0].toUpperCase()}${r.species.slice(1)}`;
      return `It hatched. You got a ${species}!`;
    }
    return `Evolved into ${r.to}!`;
  });
  if (loginBonus) {
    items.unshift(`Day ${loginBonus.streak} login streak, +${loginBonus.bonus} coins`);
  }
  if (!items.length) {
    el.hidden = true;
    return;
  }
  el.innerHTML = `
    <button type="button" class="recap-close" aria-label="Dismiss">×</button>
    <p class="recap-title">While you were away</p>
    <ul class="recap-list">${items.map((i) => `<li>${i}</li>`).join("")}</ul>
  `;
  el.querySelector(".recap-close").addEventListener("click", () => {
    el.hidden = true;
  });
  el.hidden = false;
}

async function persist() {
  currentPet = await db.savePet(currentPet);
}

const BOWL_SHOW_MS = 1800;
const BOWL_FADE_MS = 300;
const BOWL_WIDTH = 16; // matches .pet-bowl's CSS width — can't read offsetWidth while hidden
let bowlHideTimer = null;

// A little dish that appears near the pet right after feeding and fades
// out on its own — purely decorative, reinforces the action rather than
// signaling anything new.
function showFoodBowl() {
  if (!currentPet || currentPet.life_stage === "egg") return;
  const bowl = $("pet-bowl");
  const host = $("pet-screen");
  bowl.style.left = `${host.offsetLeft + host.offsetWidth / 2 - BOWL_WIDTH / 2}px`;
  bowl.style.top = `${host.offsetTop + host.offsetHeight + 4}px`;
  bowl.classList.remove("pet-bowl--fade");
  bowl.hidden = false;
  clearTimeout(bowlHideTimer);
  bowlHideTimer = setTimeout(() => {
    bowl.classList.add("pet-bowl--fade");
    bowlHideTimer = setTimeout(() => {
      bowl.hidden = true;
    }, BOWL_FADE_MS);
  }, BOWL_SHOW_MS);
}

// Floor items are dragged and persisted as a saved fraction (0..1) of the
// playground's usable area, not raw pixels, since the device's own width is
// responsive (see .pet-visual's breakpoint). Recomputed on every render,
// same approach as wanderBounds().
const GROUNDED_ITEMS = [
  { id: "pet-bed", xField: "bed_x", yField: "bed_y", defaultX: DEFAULT_BED_X, defaultY: DEFAULT_BED_Y, owned: (p) => p.has_bed && p.bed_active },
  { id: "toy", xField: "toy_x", yField: "toy_y", defaultX: DEFAULT_TOY_X, defaultY: DEFAULT_TOY_Y, owned: (p) => p.has_toy && p.toy_active },
  { id: "music-box", xField: "music_box_x", yField: "music_box_y", defaultX: DEFAULT_MUSIC_BOX_X, defaultY: DEFAULT_MUSIC_BOX_Y, owned: (p) => p.has_music_box && p.music_box_active },
];

function renderGroundedItems(pet) {
  const device = $("pet-device");
  for (const item of GROUNDED_ITEMS) {
    const el = $(item.id);
    if (pet.life_stage === "egg" || !item.owned(pet)) {
      el.hidden = true;
      continue;
    }
    el.hidden = false;
    const { minX, minY, maxX, maxY } = groundedBounds(el, device);
    const fx = pet[item.xField] ?? item.defaultX;
    const fy = pet[item.yField] ?? item.defaultY;
    el.style.left = `${minX + fx * (maxX - minX)}px`;
    el.style.top = `${minY + fy * (maxY - minY)}px`;
  }
}

// Purely ambient — fixed in its own corner, never dragged, so it doesn't
// need a saved position the way the floor items above do.
// Music Box's hidden/position are handled generically now that it's part of
// GROUNDED_ITEMS (see renderGroundedItems, called first in render() below).
//
// The song itself is kept in sync with two things every render: the box's
// visibility (el.hidden, from renderGroundedItems just above — you should
// never hear a pet's box while a different pet is active) and the pet's own
// persisted music_box_playing flag, so switching back to a pet whose box
// was left on resumes it instead of staying silent until re-tapped.
function syncMusicBoxAudio(pet) {
  const el = $("music-box");
  const shouldPlay = !el.hidden && pet.music_box_playing;
  if (!shouldPlay) {
    if (isMelodyPlaying()) stopMelody();
    el.classList.remove("music-box--playing");
    return;
  }
  el.classList.add("music-box--playing");
  if (!isMelodyPlaying()) playMelody(ODE_TO_JOY);
}

function renderPoop(pet) {
  const isEgg = pet.life_stage === "egg";
  for (let i = 0; i < MAX_POOP_COUNT; i++) {
    $(`poop-${i}`).hidden = isEgg || i >= (pet.poop_count || 0);
  }
}

function render() {
  renderPuppy(currentPet, eyesOpen && !currentPet.is_sleeping);
  renderStats(currentPet);
  renderGroundedItems(currentPet);
  renderNightLight(currentPet);
  renderPoop(currentPet);
  syncMusicBoxAudio(currentPet);
  $("toy").style.setProperty("--ball-color", currentPet.ball_color || DEFAULT_BALL_COLOR);
  checkNotifications(currentPet);
}

// A single list drives the whole Shop modal instead of one hand-wired button
// per item — with this many purchasable items, adding a new one is just a
// new entry here plus its buy() function, no new HTML/wiring per item.
//
// kind: "consumable" (Snack/Meal/Vitamins) always shows a repeatable Buy
// button and stacks a count. "wearable" (Bow) and "placeable" (everything
// else) are one-time buys that, once owned, swap the Buy button for a
// toggle — worn/not for the Bow, in the playground/put away for the rest —
// exactly like the Bow always worked.
const SHOP_ITEMS = [
  { id: "food", name: "Snack", desc: "+1 Snack", price: SNACK_PRICE, buy: buyFood, kind: "consumable" },
  { id: "meal", name: "Meal", desc: "+1 Meal", price: MEAL_PRICE, buy: buyMeal, kind: "consumable" },
  { id: "vitamins", name: "Vitamins", desc: "Feed for faster Health regen", price: VITAMINS_PRICE, buy: buyVitamins, kind: "consumable" },
  { id: "bow", name: "Bow", desc: "Cosmetic only", price: BOW_PRICE, buy: buyBow, kind: "wearable", owned: (p) => p.has_bow, toggle: toggleBow },
  {
    id: "bed",
    name: "Bed",
    desc: "Faster Energy recovery while asleep",
    price: BED_PRICE,
    buy: buyBed,
    kind: "placeable",
    owned: (p) => p.has_bed,
    active: (p) => p.bed_active,
    toggle: toggleBedActive,
  },
  {
    id: "nightlight",
    name: "Night Light",
    desc: "Slows decay further while asleep",
    price: NIGHT_LIGHT_PRICE,
    buy: buyNightLight,
    kind: "placeable",
    owned: (p) => p.has_night_light,
    active: (p) => p.night_light_active,
    toggle: toggleNightLightActive,
  },
  {
    id: "musicbox",
    name: "Music Box",
    desc: "Happy decays 20% slower. Click it to play or stop a little song",
    price: MUSIC_BOX_PRICE,
    buy: buyMusicBox,
    kind: "placeable",
    owned: (p) => p.has_music_box,
    active: (p) => p.music_box_active,
    toggle: toggleMusicBoxActive,
  },
  {
    id: "toy",
    name: "Ball",
    desc: "Pet kicks it around on its own for a little Happy each time",
    price: TOY_PRICE,
    buy: buyToy,
    kind: "placeable",
    owned: (p) => p.has_toy,
    active: (p) => p.toy_active,
    toggle: toggleToyActive,
  },
];

function shopItemControlHtml(item, pet) {
  if (item.kind === "consumable" || !item.owned(pet)) {
    return `<button type="button" data-item="${item.id}" ${pet.coins < item.price ? "disabled" : ""}>Buy (${item.price})</button>`;
  }
  if (item.kind === "wearable") {
    return `
      <div class="accessory-btn-wrap">
        <button type="button" data-toggle="${item.id}" class="${pet.bow_worn ? "btn--active" : ""}">${pet.bow_worn ? "Take Off" : "Put On"}</button>
        <input type="color" data-bow-color value="${pet.bow_color || DEFAULT_BOW_COLOR}" aria-label="Bow color" />
      </div>`;
  }
  const active = item.active(pet);
  if (item.id === "toy") {
    return `
      <div class="accessory-btn-wrap">
        <button type="button" data-toggle="${item.id}" class="${active ? "btn--active" : ""}">${active ? "Remove" : "Put In"}</button>
        <input type="color" data-ball-color value="${pet.ball_color || DEFAULT_BALL_COLOR}" aria-label="Ball color" />
      </div>`;
  }
  return `<button type="button" data-toggle="${item.id}" class="${active ? "btn--active" : ""}">${active ? "Remove" : "Put In"}</button>`;
}

function renderShop(pet) {
  $("shop-coins").textContent = pet.coins;
  $("shop-list").innerHTML = SHOP_ITEMS.map(
    (item) => `
    <div class="shop-item">
      <div class="shop-item-info">
        <b>${item.name}</b>
        <span>${item.desc}</span>
      </div>
      ${shopItemControlHtml(item, pet)}
    </div>`
  ).join("");
}

function wireShop() {
  $("btn-shop").addEventListener("click", () => {
    renderShop(currentPet);
    $("shop-modal").hidden = false;
  });
  $("btn-shop-close").addEventListener("click", () => {
    $("shop-modal").hidden = true;
  });
  $("shop-modal").addEventListener("click", (e) => {
    if (e.target.id === "shop-modal") $("shop-modal").hidden = true;
  });

  $("shop-list").addEventListener("click", (e) => {
    const buyBtn = e.target.closest("[data-item]");
    if (buyBtn) {
      const item = SHOP_ITEMS.find((i) => i.id === buyBtn.dataset.item);
      runAction(item.buy, { bounce: false, sound: "coin" });
      renderShop(currentPet);
      return;
    }
    const toggleBtn = e.target.closest("[data-toggle]");
    if (toggleBtn) {
      const item = SHOP_ITEMS.find((i) => i.id === toggleBtn.dataset.toggle);
      runAction(item.toggle, { bounce: false, sound: "poke" });
      renderShop(currentPet);
    }
  });

  // Same input/change split as the old dedicated color picker: live-preview
  // on every drag step, only persist once the user commits a color.
  $("shop-list").addEventListener("input", (e) => {
    if (e.target.matches("[data-bow-color]")) {
      setBowColor(currentPet, e.target.value);
      renderPuppy(currentPet, eyesOpen);
    } else if (e.target.matches("[data-ball-color]")) {
      setBallColor(currentPet, e.target.value);
      $("toy").style.setProperty("--ball-color", currentPet.ball_color);
    }
  });
  $("shop-list").addEventListener("change", async (e) => {
    if (!e.target.matches("[data-bow-color], [data-ball-color]")) return;
    try {
      await persist();
    } catch (err) {
      showMessage(err.message, true);
    }
  });
}

// Local-only nudges — only fire while this tab is open, never across a closed
// tab (see design doc §7). Uses a per-stat "already notified" set so it fires
// once when a stat crosses the threshold, not on every render.
const NOTIFY_KEY = "pocketpet_notify_enabled";
const notifiedLow = new Set();

// Supabase syncs a recovery session to every open tab, so clicking a
// password-reset email link (which opens a new tab) also drops the
// original tab into the same "set a new password" screen. Once either tab
// actually changes the password, this key is written to localStorage —
// the storage event it triggers only fires in OTHER tabs, never the one
// that wrote it — so the other tab can log straight in instead of prompting
// for a password change a second time (see wireAuth's storage listener).
const PASSWORD_RESET_KEY = "pocketpet_password_reset_at";

function notificationsEnabled() {
  return (
    localStorage.getItem(NOTIFY_KEY) === "1" &&
    typeof Notification !== "undefined" &&
    Notification.permission === "granted"
  );
}

// Routes through the Service Worker's showNotification when one is active
// (works better for an installed PWA — proper OS notification, tap-to-focus
// via the notificationclick handler in sw.js), falling back to a plain
// Notification otherwise. Still entirely client-side: no push server, so
// this only fires while the app/service worker is alive, not after the
// browser itself is fully closed.
async function notifyUser(title, body) {
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, { body, icon: "icons/icon.svg" });
      return;
    } catch {
      // fall through to a plain Notification below
    }
  }
  new Notification(title, { body });
}

function checkNotifications(pet) {
  if (!notificationsEnabled() || !pet) return;
  const checks = [
    ["hunger", "Hunger"],
    ["happiness", "Happy"],
    ["hygiene", "Clean"],
    ["energy", "Energy"],
  ];
  for (const [key, label] of checks) {
    if (pet[key] <= LOW_STAT_THRESHOLD) {
      if (!notifiedLow.has(key)) {
        notifiedLow.add(key);
        notifyUser("PocketPet", `${label} is low. ${pet.name} needs you.`);
      }
    } else {
      notifiedLow.delete(key);
    }
  }
  if (pet.is_sick) {
    if (!notifiedLow.has("sick")) {
      notifiedLow.add("sick");
      notifyUser("PocketPet", `${pet.name} is sick! Give Medicine.`);
    }
  } else {
    notifiedLow.delete("sick");
  }
}

function bouncePet() {
  const host = $("pet-screen");
  host.classList.remove("pet--bounce");
  void host.offsetWidth; // restart the animation if it's still running
  host.classList.add("pet--bounce");
}

// Purely cosmetic — no stat effect, so clicking the pet can't be farmed for
// free happiness. Just makes it feel alive and responsive to being poked.
function pokePet() {
  if (!currentPet || currentPet.life_stage === "egg") return;
  const host = $("pet-screen");
  host.classList.remove("pet--poke");
  void host.offsetWidth;
  host.classList.add("pet--poke");
  playSound("poke");
}

const IDLE_QUIRK_CLASSES = ["pet--idle-glance", "pet--idle-stretch", "pet--idle-hop"];

// Random little flourishes (glance around, stretch, hop in place) so the pet
// still reads as alive when you're not actively poking or feeding it. Skips
// whenever a stronger animation already owns the pet's motion (sleeping,
// sick, a mood cue, a game, egg, or mid-drag) so nothing fights visually.
function playIdleQuirk() {
  if (!currentPet || currentPet.life_stage === "egg" || currentPet.is_sleeping || currentPet.is_sick) return;
  if (gameActive || draggingPet || lowStatMood(currentPet)) return;
  const host = $("pet-screen");
  const cls = IDLE_QUIRK_CLASSES[Math.floor(Math.random() * IDLE_QUIRK_CLASSES.length)];
  host.classList.remove(...IDLE_QUIRK_CLASSES);
  void host.offsetWidth; // restart the animation if one is still finishing
  host.classList.add(cls);
}

const IDLE_QUIRK_MIN_MS = 5000;
const IDLE_QUIRK_MAX_MS = 12000;

function scheduleIdleQuirk() {
  const delay = IDLE_QUIRK_MIN_MS + Math.random() * (IDLE_QUIRK_MAX_MS - IDLE_QUIRK_MIN_MS);
  setTimeout(() => {
    playIdleQuirk();
    scheduleIdleQuirk();
  }, delay);
}

// A real blink is a quick flicker, not eyes-closed-for-seconds — hold the
// closed frame for BLINK_CLOSED_MS, then reopen. eyesOpen is shared with the
// walk-frame interval so both stay in sync instead of fighting over state.
const BLINK_MIN_MS = 2600;
const BLINK_MAX_MS = 5000;
const BLINK_CLOSED_MS = 150;

function scheduleBlink() {
  const delay = BLINK_MIN_MS + Math.random() * (BLINK_MAX_MS - BLINK_MIN_MS);
  setTimeout(() => {
    if (currentPet && !currentPet.is_sleeping) {
      eyesOpen = false;
      renderPuppy(currentPet, eyesOpen);
      setTimeout(() => {
        eyesOpen = true;
        if (currentPet && !currentPet.is_sleeping) renderPuppy(currentPet, eyesOpen);
      }, BLINK_CLOSED_MS);
    }
    scheduleBlink();
  }, delay);
}

// Also purely cosmetic (no stat effect, same reasoning as pokePet): lets
// the pet be picked up and carried anywhere in the playground, not just
// clicked-to-walk. A plain click (no real movement) still counts as a poke,
// same as before — only tells them apart by whether the pointer actually
// moved before release.
let suppressNextPetClick = false;

// A real click/tap is almost never perfectly stationary between press and
// release (mouse jitter, finger wobble) — without a tolerance, that tiny
// movement alone was enough to mark it as a drag, which suppresses the
// click that would otherwise poke the pet. Same fix already applied to the
// tooltip's touch-hold system for the same reason.
const DRAG_MOVE_TOLERANCE_PX = 6;

function wireDragPet() {
  const host = $("pet-screen");
  const device = $("pet-device");
  let dragging = false;
  let moved = false;
  let grabOffsetX = 0;
  let grabOffsetY = 0;
  let downX = 0;
  let downY = 0;

  host.addEventListener("pointerdown", (e) => {
    if (!currentPet || currentPet.life_stage === "egg" || currentPet.is_sleeping || gameActive || walkingToBed || visitingToy) return;
    dragging = true;
    draggingPet = true;
    moved = false;
    downX = e.clientX;
    downY = e.clientY;
    const rect = device.getBoundingClientRect();
    // offsetLeft/offsetTop reflect the pet's live, currently-rendered spot
    // even mid-wander (left/top transitions force a reflow, so this reads
    // the interpolated value, not the wander's destination). Pin left/top
    // to that exact spot *before* the "pet--dragging" class below disables
    // the transition — otherwise disabling it mid-flight snaps the pet
    // straight to the wander's destination instead of staying put, which is
    // the little glitch/jump you'd see clicking it while it's moving.
    const currentLeft = host.offsetLeft;
    const currentTop = host.offsetTop;
    host.style.left = `${currentLeft}px`;
    host.style.top = `${currentTop}px`;
    grabOffsetX = e.clientX - rect.left - currentLeft;
    grabOffsetY = e.clientY - rect.top - currentTop;
    host.setPointerCapture(e.pointerId);
    host.classList.add("pet--dragging");
  });

  host.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    if (!moved && Math.hypot(e.clientX - downX, e.clientY - downY) < DRAG_MOVE_TOLERANCE_PX) return;
    moved = true;
    const rect = device.getBoundingClientRect();
    const { minX, minY, maxX, maxY } = wanderBounds(host, device);
    host.style.left = `${Math.min(maxX, Math.max(minX, e.clientX - rect.left - grabOffsetX))}px`;
    host.style.top = `${Math.min(maxY, Math.max(minY, e.clientY - rect.top - grabOffsetY))}px`;
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    draggingPet = false;
    host.classList.remove("pet--dragging");
    if (moved) suppressNextPetClick = true; // don't also treat the release as a poke/click-to-walk
  }

  host.addEventListener("pointerup", endDrag);
  host.addEventListener("pointercancel", endDrag);
}

// Drag handler for the Bed and Toy (see GROUNDED_ITEMS) — dragging is
// blocked from crossing into any other floor item (see
// overlapsFloorObstacles), same "just stops there" feel as the invisible
// vertical floor line.
function wireDragGroundedItem(item) {
  const el = $(item.id);
  const device = $("pet-device");
  let dragging = false;
  let moved = false;
  let downX = 0;
  let downY = 0;

  el.addEventListener("pointerdown", (e) => {
    if (!currentPet || !item.owned(currentPet)) return;
    // Don't let the bed be dragged out from under a sleeping pet — it's
    // already resting there (see bedRestTarget), so moving the mat mid-sleep
    // would just leave the pet floating apart from it until it wakes.
    if (item.id === "pet-bed" && currentPet.is_sleeping) return;
    dragging = true;
    moved = false;
    downX = e.clientX;
    downY = e.clientY;
    el.setPointerCapture(e.pointerId);
    el.classList.add("grounded-item--dragging");
  });

  el.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    if (!moved && Math.hypot(e.clientX - downX, e.clientY - downY) < DRAG_MOVE_TOLERANCE_PX) return;
    moved = true;
    const rect = device.getBoundingClientRect();
    const { minX, minY, maxX, maxY } = groundedBounds(el, device);
    const x = Math.min(maxX, Math.max(minX, e.clientX - rect.left - el.offsetWidth / 2));
    const y = Math.min(maxY, Math.max(minY, e.clientY - rect.top - el.offsetHeight / 2));
    if (overlapsFloorObstacles(item.id, x, y, el.offsetWidth, el.offsetHeight)) return;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  });

  async function endDrag() {
    if (!dragging) return;
    dragging = false;
    el.classList.remove("grounded-item--dragging");
    // A real drag shouldn't also send the pet walking toward the release
    // point — reuses the same flag the pet's own drag uses to swallow the
    // click the browser fires on release (see wireDragPet above).
    if (moved) suppressNextPetClick = true;
    if (!moved) return; // plain tap, nothing moved — leave its saved position untouched
    const { minX, minY, maxX, maxY } = groundedBounds(el, device);
    currentPet[item.xField] = maxX > minX ? (el.offsetLeft - minX) / (maxX - minX) : 0.5;
    currentPet[item.yField] = maxY > minY ? (el.offsetTop - minY) / (maxY - minY) : 0.5;
    try {
      await persist();
    } catch (err) {
      showMessage(err.message, true);
    }
  }

  el.addEventListener("pointerup", endDrag);
  el.addEventListener("pointercancel", endDrag);
}

function wireGroundedItems() {
  for (const item of GROUNDED_ITEMS) wireDragGroundedItem(item);
}

// Sends the pet walking to the bed's current spot first, then puts it to
// sleep once it actually arrives (matching the CSS move transition's own
// duration) instead of just snapping is_sleeping on wherever it already was.
// Where the pet should end up sitting once it's on the bed — centered
// horizontally on the mat, with its bottom edge (its feet/ground line) a
// bit below the mat's own vertical center rather than the pet's whole box
// centered on it, which looked like it was floating inside the bed instead
// of lying on top. Shared by walkToBedThenSleep (the walk target) and the
// on-load snap for a pet that's already asleep on reload (see
// activatePetAndRender) — both need the exact same resting spot.
function bedRestTarget(host, bed) {
  const { minX, minY, maxX, maxY } = wanderBounds(host, host.parentElement);
  const bedCenterX = bed.offsetLeft + bed.offsetWidth / 2;
  const bedCenterY = bed.offsetTop + bed.offsetHeight / 2;
  return {
    targetX: Math.min(maxX, Math.max(minX, bedCenterX - host.offsetWidth / 2)),
    targetY: Math.min(maxY, Math.max(minY, bedCenterY + bed.offsetHeight * 0.15 - host.offsetHeight)),
  };
}

function walkToBedThenSleep() {
  if (!currentPet || currentPet.life_stage === "egg" || walkingToBed || visitingToy || currentPet.is_sleeping) return;
  const petId = currentPet.id;
  const host = $("pet-screen");
  const bed = $("pet-bed");
  const { targetX, targetY } = bedRestTarget(host, bed);
  walkingToBed = true;
  host.style.left = `${targetX}px`;
  host.style.top = `${targetY}px`;
  renderStats(currentPet); // reflects the "Walking…" sleep-button state right away
  const duration = (STAGE_MOVE_DURATION_S[currentPet.life_stage] ?? 1.6) * 1000;
  setTimeout(() => {
    walkingToBed = false;
    if (!currentPet || currentPet.id !== petId || currentPet.is_sleeping) {
      render();
      return;
    }
    runAction(toggleSleep, { bounce: false, sound: "sleep" });
  }, duration + 50);
}

// Same "walk over, then do a thing" shape as bedRestTarget/walkToBedThenSleep
// above, for the Toy's own on-its-own visits.
function toyRestTarget(host, toy) {
  const { minX, minY, maxX, maxY } = wanderBounds(host, host.parentElement);
  const toyCenterX = toy.offsetLeft + toy.offsetWidth / 2;
  const toyCenterY = toy.offsetTop + toy.offsetHeight / 2;
  return {
    targetX: Math.min(maxX, Math.max(minX, toyCenterX - host.offsetWidth / 2)),
    targetY: Math.min(maxY, Math.max(minY, toyCenterY - host.offsetHeight / 2)),
  };
}

// Sends the ball rolling off to a new (non-overlapping) spot on the floor —
// called right after the pet "kicks" it, so the ball actually looks played
// with instead of just sitting there getting Happy credit. render()'s own
// call to renderGroundedItems right after this picks up the new toy_x/toy_y
// and animates there via .toy's own left/top transition.
function kickToy() {
  const toy = $("toy");
  const device = $("pet-device");
  const { minX, minY, maxX, maxY } = groundedBounds(toy, device);
  const spot = randomFreeFloorSpot(toy, device, "toy");
  currentPet.toy_x = maxX > minX ? (spot.x - minX) / (maxX - minX) : 0.5;
  currentPet.toy_y = maxY > minY ? (spot.y - minY) / (maxY - minY) : 0.5;
}

function walkToToyThenPlay() {
  if (!currentPet || currentPet.life_stage === "egg" || currentPet.is_sleeping) return;
  if (gameActive || draggingPet || walkingToBed || visitingToy) return;
  if (isTooTiredToWalk(currentPet)) return;
  const toy = $("toy");
  if (toy.hidden) return;
  const petId = currentPet.id;
  const host = $("pet-screen");
  const { targetX, targetY } = toyRestTarget(host, toy);
  visitingToy = true;
  host.style.left = `${targetX}px`;
  host.style.top = `${targetY}px`;
  const duration = (STAGE_MOVE_DURATION_S[currentPet.life_stage] ?? 1.6) * 1000;
  setTimeout(() => {
    visitingToy = false;
    if (!currentPet || currentPet.id !== petId || currentPet.is_sleeping) {
      render();
      return;
    }
    currentPet.happiness = clamp(currentPet.happiness + TOY_HAPPY_GAIN);
    kickToy();
    render();
    playSound("play");
    persist().catch((err) => showMessage(err.message, true));
  }, duration + 50);
}

function scheduleToyVisit() {
  const delay = TOY_VISIT_MIN_MS + Math.random() * (TOY_VISIT_MAX_MS - TOY_VISIT_MIN_MS);
  setTimeout(() => {
    if (currentPet && currentPet.has_toy && currentPet.toy_active) walkToToyThenPlay();
    scheduleToyVisit();
  }, delay);
}

function scheduleMusicBoxChime() {
  const delay = MUSIC_BOX_CHIME_MIN_MS + Math.random() * (MUSIC_BOX_CHIME_MAX_MS - MUSIC_BOX_CHIME_MIN_MS);
  setTimeout(() => {
    if (currentPet && currentPet.has_music_box && currentPet.music_box_active && !currentPet.is_sleeping) {
      playSound("chime");
    }
    scheduleMusicBoxChime();
  }, delay);
}

// The Night Light hangs from the ceiling — its own render/drag pair instead
// of joining GROUNDED_ITEMS, since it only ever moves horizontally and
// never enters the floor region the way the Bed does. top stays fixed in
// CSS; only left (as a saved 0..1 fraction of the horizontal range) moves.
function renderNightLight(pet) {
  const el = $("night-light");
  if (pet.life_stage === "egg" || !pet.has_night_light || !pet.night_light_active) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const device = $("pet-device");
  const { minX, maxX } = wanderBounds(el, device);
  const fx = pet.night_light_x ?? 0.5;
  el.style.left = `${minX + fx * (maxX - minX)}px`;
}

function wireDragNightLight() {
  const el = $("night-light");
  const device = $("pet-device");
  let dragging = false;
  let moved = false;
  let downX = 0;

  el.addEventListener("pointerdown", (e) => {
    if (!currentPet || !currentPet.has_night_light || !currentPet.night_light_active) return;
    dragging = true;
    moved = false;
    downX = e.clientX;
    el.setPointerCapture(e.pointerId);
    el.classList.add("grounded-item--dragging");
  });

  el.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    if (!moved && Math.abs(e.clientX - downX) < DRAG_MOVE_TOLERANCE_PX) return;
    moved = true;
    const rect = device.getBoundingClientRect();
    const { minX, maxX } = wanderBounds(el, device);
    el.style.left = `${Math.min(maxX, Math.max(minX, e.clientX - rect.left - el.offsetWidth / 2))}px`;
  });

  async function endDrag() {
    if (!dragging) return;
    dragging = false;
    el.classList.remove("grounded-item--dragging");
    if (moved) suppressNextPetClick = true;
    if (!moved) return; // plain tap, nothing moved — leave its saved position untouched
    const { minX, maxX } = wanderBounds(el, device);
    currentPet.night_light_x = maxX > minX ? (el.offsetLeft - minX) / (maxX - minX) : 0.5;
    try {
      await persist();
    } catch (err) {
      showMessage(err.message, true);
    }
  }

  el.addEventListener("pointerup", endDrag);
  el.addEventListener("pointercancel", endDrag);
}

// Click to toggle the song on/off — persisted via music_box_playing so it
// keeps playing until explicitly turned off, including across a pet switch
// (see syncMusicBoxAudio, called on every render). Direction is decided by
// the actual isMelodyPlaying() state rather than the persisted flag, so a
// tap always does the right thing even if a resume elsewhere got silently
// blocked by the browser's autoplay policy.
// The Music Box is now also draggable (see GROUNDED_ITEMS/wireGroundedItems)
// on the same element, so a plain tap and a drag-release both end up
// firing this click listener — suppressNextPetClick (set by
// wireDragGroundedItem's endDrag on a real drag) is how it tells them
// apart, same signal #pet-device's own click handler uses.
function wireMusicBox() {
  $("music-box").addEventListener("click", (e) => {
    e.stopPropagation(); // don't also let this bubble up into a click-to-walk
    if (suppressNextPetClick) {
      suppressNextPetClick = false;
      return;
    }
    if (!currentPet || !currentPet.has_music_box || !currentPet.music_box_active) return;
    const el = $("music-box");
    if (isMelodyPlaying()) {
      stopMelody();
      el.classList.remove("music-box--playing");
      currentPet.music_box_playing = false;
    } else {
      playMelody(ODE_TO_JOY);
      el.classList.add("music-box--playing");
      currentPet.music_box_playing = true;
    }
    persist().catch((err) => showMessage(err.message, true));
  });
}

async function runAction(fn, { bounce = true, sound } = {}) {
  fn(currentPet);
  render();
  if (bounce && !currentPet.is_sleeping) bouncePet();
  if (sound) playSound(sound);
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
    const count = 7;
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
    setTimeout(() => finish(false), 1300);
  });
}

// Shared by Count the Dots and More Dots — scatters `count` small dots at
// random non-overlapping-by-construction (just random, collisions are fine
// visually) positions inside `container`.
const SCATTER_DOT_SIZE = 10;
function scatterDots(container, count) {
  const w = container.clientWidth || 130;
  const h = container.clientHeight || 180;
  for (let i = 0; i < count; i++) {
    const dot = document.createElement("div");
    dot.className = "count-dot";
    dot.style.left = `${Math.random() * Math.max(0, w - SCATTER_DOT_SIZE)}px`;
    dot.style.top = `${Math.random() * Math.max(0, h - SCATTER_DOT_SIZE)}px`;
    container.appendChild(dot);
  }
}

function playCountRound(overlay) {
  return new Promise((resolve) => {
    const count = 6 + Math.floor(Math.random() * 5); // 6..10
    overlay.innerHTML = '<div class="count-dots-area"></div>';
    scatterDots(overlay.querySelector(".count-dots-area"), count);

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

// Two dot clusters, tap the side with more before they disappear — a quick
// at-a-glance comparison, distinct from Count the Dots' hide-then-guess-the-
// exact-number shape.
function playMoreDotsRound(overlay) {
  return new Promise((resolve) => {
    const leftCount = 4 + Math.floor(Math.random() * 6); // 4..9
    let rightCount = 4 + Math.floor(Math.random() * 6);
    while (rightCount === leftCount) rightCount = 4 + Math.floor(Math.random() * 6);
    const moreSide = leftCount > rightCount ? "left" : "right";

    overlay.innerHTML = `
      <div class="moredots-row">
        <div class="moredots-side" data-side="left"></div>
        <div class="moredots-side" data-side="right"></div>
      </div>`;
    const leftEl = overlay.querySelector('[data-side="left"]');
    const rightEl = overlay.querySelector('[data-side="right"]');
    scatterDots(leftEl, leftCount);
    scatterDots(rightEl, rightCount);

    let settled = false;
    const finish = (hit) => {
      if (settled) return;
      settled = true;
      overlay.innerHTML = "";
      resolve(hit);
    };
    leftEl.addEventListener("click", () => finish(moreSide === "left"));
    rightEl.addEventListener("click", () => finish(moreSide === "right"));
    setTimeout(() => finish(false), 1500);
  });
}

const DIRECTION_ARROWS = ["▲", "▼", "◀", "▶"];

// Shows one big arrow, tap the matching one of 4 small buttons before it
// times out — a reflex/reaction game, the one input shape (directional
// choice) none of the others use.
function playDirectionRound(overlay) {
  return new Promise((resolve) => {
    const target = DIRECTION_ARROWS[Math.floor(Math.random() * DIRECTION_ARROWS.length)];
    overlay.innerHTML = `
      <div class="direction-prompt">${target}</div>
      <div class="direction-choices"></div>`;
    const choicesEl = overlay.querySelector(".direction-choices");

    let settled = false;
    const finish = (hit) => {
      if (settled) return;
      settled = true;
      overlay.innerHTML = "";
      resolve(hit);
    };
    for (const arrow of DIRECTION_ARROWS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "direction-choice";
      btn.textContent = arrow;
      btn.addEventListener("click", () => finish(arrow === target));
      choicesEl.appendChild(btn);
    }
    setTimeout(() => finish(false), 1400);
  });
}

const MINI_GAMES = [
  { id: "tap", name: "Tap the Target", round: playTapRound },
  { id: "timing", name: "Stop the Marker", round: playTimingRound },
  { id: "odd", name: "Odd One Out", round: playOddOneOutRound },
  { id: "count", name: "Count the Dots", round: playCountRound },
  { id: "moredots", name: "More Dots", round: playMoreDotsRound },
  { id: "direction", name: "Match the Direction", round: playDirectionRound },
];

function renderGamePickerScores() {
  document.querySelectorAll(".game-picker-btn[data-game]").forEach((btn) => {
    const best = currentScores[btn.dataset.game];
    const badge = btn.querySelector(".game-best");
    if (badge) badge.textContent = best ? `(${best})` : "";
  });
}

function openGamePicker() {
  $("btn-play").disabled = true;
  gameActive = true;
  $("game-modal-title").textContent = "Choose a Game";
  $("game-modal-round").textContent = "";
  renderGamePickerScores();
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

  // The base GAME_ROUNDS always play out in full, same as before. A perfect
  // run (all GAME_ROUNDS hit) instead of just stopping there keeps going one
  // round at a time, sudden-death style, until the player finally misses —
  // so a high score means something past just "5/5" every time.
  let hits = 0;
  let round = 0;
  while (true) {
    round++;
    const label = round <= GAME_ROUNDS ? `Round ${round}/${GAME_ROUNDS}` : `Bonus round ${round - GAME_ROUNDS}`;
    $("game-modal-round").textContent = `${label}, ${hits} hit${hits === 1 ? "" : "s"}`;
    overlay.innerHTML = "";
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));
    const hit = await game.round(overlay);
    if (hit) hits++;
    if (round < GAME_ROUNDS) continue;
    if (round === GAME_ROUNDS) {
      if (hits === GAME_ROUNDS) continue; // perfect base run — keep going
      break;
    }
    if (!hit) break; // bonus round miss ends it
  }

  closeGameModal();

  play(currentPet); // usual happiness/energy/hunger effect — no-ops if sleeping or too tired
  const coinsEarned = hits * COINS_PER_HIT;
  currentPet.coins += coinsEarned;
  currentPet.total_coins_earned = (currentPet.total_coins_earned || 0) + coinsEarned;
  if (coinsEarned > 0) playSound("coin");

  const isNewBest = hits > (currentScores[game.id] || 0);
  if (isNewBest) {
    currentScores[game.id] = hits;
    if (currentUserId) db.recordScore(currentUserId, game.id, hits).catch(() => {});
  }

  render();
  if (!currentPet.is_sleeping) bouncePet();
  showMessage(`${game.name}: ${hits} hit${hits === 1 ? "" : "s"}, +${coinsEarned} coins!${isNewBest ? " New best!" : ""}`, false, 3500);
  try {
    await persist();
  } catch (err) {
    showMessage(err.message, true);
  }
}

const TOOLTIP_HOLD_MS = 550; // long enough to tell apart from a normal tap

// Touch has no hover, so `[data-tooltip]:hover` either fires instantly on
// tap or gets stuck on (no hover-exit event) — CSS scopes hover to real
// pointers only (see style.css), and this gives touch its own hold-to-reveal
// gesture: hold past TOOLTIP_HOLD_MS to peek the tooltip, release early for
// a normal tap. A long-press that reveals the tooltip also swallows the
// resulting click, so peeking doesn't accidentally trigger the action too.
function wireTooltipTouch() {
  const MOVE_TOLERANCE_PX = 12; // small jitter while holding still shouldn't cancel it
  let timer = null;
  let heldEl = null;
  let suppressClick = false;
  let startX = 0;
  let startY = 0;

  function cancel(e) {
    clearTimeout(timer);
    if (heldEl) {
      if (suppressClick && e.type === "touchend") e.preventDefault();
      heldEl.classList.remove("tooltip--held");
    }
    heldEl = null;
    suppressClick = false;
  }

  document.addEventListener(
    "touchstart",
    (e) => {
      const el = e.target.closest("[data-tooltip]");
      if (!el) return;
      heldEl = el;
      suppressClick = false;
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      timer = setTimeout(() => {
        suppressClick = true;
        el.classList.add("tooltip--held");
      }, TOOLTIP_HOLD_MS);
    },
    { passive: true }
  );
  document.addEventListener(
    "touchmove",
    (e) => {
      if (!heldEl) return;
      const touch = e.touches[0];
      const moved = Math.hypot(touch.clientX - startX, touch.clientY - startY);
      if (moved > MOVE_TOLERANCE_PX) cancel(e);
    },
    { passive: true }
  );
  document.addEventListener("touchend", cancel);
  document.addEventListener("touchcancel", cancel);
}

function wireActions() {
  $("btn-feed").dataset.tooltip = "+30 Hunger, +5 Happy, -5 Clean";
  $("btn-feed-meal").dataset.tooltip = "+60 Hunger, +15 Happy, -10 Clean";
  $("btn-play").dataset.tooltip = "Mini-game: +25 Happy, -15 Energy, -10 Hunger, plus coins";
  $("btn-clean").dataset.tooltip = "+40 Clean";
  $("btn-sleep").dataset.tooltip = "Restores Energy over time (faster with a Bed) and halves other decay while asleep";
  $("btn-medicine").dataset.tooltip = "Cures Sick, +40 Health, -5 Happy";
  $("btn-vitamins").dataset.tooltip = `${VITAMIN_BUFF_DURATION_MS / 60000} min of 50% faster Health recovery`;

  $("btn-feed").addEventListener("click", () => {
    runAction(feed, { sound: "feed" });
    showFoodBowl();
  });
  $("btn-feed-meal").addEventListener("click", () => {
    runAction(feedMeal, { sound: "feed" });
    showFoodBowl();
  });
  $("btn-play").addEventListener("click", openGamePicker);
  $("btn-game-cancel").addEventListener("click", closeGameModal);
  document.querySelectorAll(".game-picker-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const game = MINI_GAMES.find((g) => g.id === btn.dataset.game);
      runPlayGame(game);
    });
  });
  $("btn-clean").addEventListener("click", () => runAction(clean, { sound: "clean" }));
  for (let i = 0; i < MAX_POOP_COUNT; i++) {
    $(`poop-${i}`).addEventListener("click", (e) => {
      e.stopPropagation(); // otherwise this bubbles to #pet-device and also walks the pet here
      runAction(clearPoop, { bounce: false, sound: "clean" });
    });
  }
  $("btn-sleep").addEventListener("click", () => {
    if (walkingToBed) return;
    if (currentPet.is_sleeping) {
      runAction(toggleSleep, { bounce: false, sound: "wake" });
      return;
    }
    if (currentPet.has_bed && currentPet.bed_active) walkToBedThenSleep();
    else runAction(toggleSleep, { bounce: false, sound: "sleep" });
  });
  $("btn-medicine").addEventListener("click", () => runAction(giveMedicine, { sound: "medicine" }));
  $("btn-vitamins").addEventListener("click", () => runAction(giveVitamins, { bounce: false, sound: "medicine" }));

  wireDragPet();
  wireGroundedItems();
  wireDragNightLight();
  wireMusicBox();
  wireShop();
  $("pet-device").addEventListener("click", (e) => {
    if (suppressNextPetClick) {
      suppressNextPetClick = false;
      return;
    }
    if (e.target.closest("#pet-screen")) {
      pokePet();
      return;
    }
    const rect = $("pet-device").getBoundingClientRect();
    movePetTowards(e.clientX - rect.left, e.clientY - rect.top);
  });

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

  function showSettingsMenu() {
    $("settings-menu").hidden = false;
    $("settings-bottom-actions").hidden = false;
  }

  function openSettingsForm(formId) {
    $("settings-menu").hidden = true;
    $("settings-bottom-actions").hidden = true;
    $(formId).hidden = false;
  }

  function collapsePasswordForm() {
    $("change-password-form").reset();
    $("change-password-form").hidden = true;
    showSettingsMenu();
  }

  function openPickerRenameForm() {
    $("pet-picker-menu").hidden = true;
    $("rename-pet-form").hidden = false;
    $("rename-pet-input").value = currentPet.name;
  }

  function collapsePickerRenameForm() {
    $("rename-pet-form").reset();
    $("rename-pet-form").hidden = true;
    $("pet-picker-menu").hidden = false;
  }

  $("btn-settings").addEventListener("click", () => {
    $("account-email").textContent = currentUserEmail || "";
    $("btn-toggle-notifications").textContent = notificationsEnabled() ? "Disable Notifications" : "Enable Notifications";
    $("btn-toggle-sound").textContent = soundEnabled() ? "Disable Sound" : "Enable Sound";
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

  $("btn-collection").addEventListener("click", () => {
    renderCollection();
    screen("collection");
  });
  $("btn-collection-back").addEventListener("click", () => screen("settings"));

  $("btn-switch-pet-main").addEventListener("click", async () => {
    try {
      const pets = await db.fetchPets(currentUserId);
      collapsePickerRenameForm();
      renderPetPicker(pets);
      screen("pet-picker");
    } catch (err) {
      showMessage(err.message, true);
    }
  });
  $("btn-picker-back").addEventListener("click", () => {
    collapsePickerRenameForm();
    screen("pet");
    render();
  });
  $("btn-hatch-another").addEventListener("click", () => screen("name-pet"));

  $("btn-toggle-notifications").addEventListener("click", async () => {
    if (notificationsEnabled()) {
      localStorage.setItem(NOTIFY_KEY, "0");
      $("btn-toggle-notifications").textContent = "Enable Notifications";
      showMessage("Notifications disabled.");
      return;
    }
    if (typeof Notification === "undefined") {
      showMessage("Notifications aren't supported in this browser.", true);
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      showMessage("Notification permission denied.", true);
      return;
    }
    localStorage.setItem(NOTIFY_KEY, "1");
    $("btn-toggle-notifications").textContent = "Disable Notifications";
    showMessage("Notifications on. We'll nudge you if a stat gets low while this tab is open.");
  });

  $("btn-toggle-sound").addEventListener("click", () => {
    const enabling = !soundEnabled();
    setSoundEnabled(enabling);
    $("btn-toggle-sound").textContent = enabling ? "Disable Sound" : "Enable Sound";
    if (enabling) playSound("poke"); // quick sample so the toggle itself confirms audibly
  });

  $("btn-change-password").addEventListener("click", () => {
    openSettingsForm("change-password-form");
  });
  $("btn-cancel-password").addEventListener("click", collapsePasswordForm);

  $("btn-rename-pet").addEventListener("click", openPickerRenameForm);
  $("btn-cancel-rename").addEventListener("click", collapsePickerRenameForm);

  $("rename-pet-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("rename-pet-input").value.trim();
    if (!name) return;
    currentPet.name = name;
    collapsePickerRenameForm();
    try {
      await persist();
      showMessage("Name updated.");
      const pets = await db.fetchPets(currentUserId);
      renderPetPicker(pets);
    } catch (err) {
      showMessage(err.message, true);
    }
  });

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
    if (!confirm("Reset your active pet back to a fresh egg? This cannot be undone.")) return;
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

  $("btn-release-pet").addEventListener("click", async () => {
    if (!confirm("Give your active pet to a new home? This can't be undone.")) return;
    const releasedId = currentPet.id;
    try {
      await db.deletePet(releasedId);
      const remaining = await db.fetchPets(currentUserId);
      if (remaining.length === 0) {
        currentPet = null;
        screen("name-pet");
        return;
      }
      const updated = await db.setActivePet(currentUserId, remaining[0].id);
      await activatePetAndRender(updated);
    } catch (err) {
      showMessage(err.message, true);
    }
  });

  setInterval(() => {
    if (!currentPet) return;
    $("pet-progress").textContent = stageProgressText(currentPet);
  }, 2500);

  setInterval(() => {
    if (!currentPet || currentPet.is_sleeping) return;
    walkFrame = walkFrame === 0 ? 1 : 0;
    renderPuppy(currentPet, eyesOpen);
  }, 450);

  scheduleWander();
  scheduleIdleQuirk();
  scheduleBlink();
  scheduleToyVisit();
  scheduleMusicBoxChime();
}

// Runs decay/login-bonus for whichever pet just became the active one
// (initial load, or switching via the picker) and shows it.
async function activatePetAndRender(pet) {
  const { pet: decayed, recap } = applyDecay(pet, Date.now());
  const loginBonus = applyDailyLogin(decayed);
  currentPet = await db.savePet(decayed);
  screen("pet");
  render();
  // A pet that was already asleep on its bed before a reload should render
  // sitting there right away, not at the pet-screen's default top-left
  // starting spot — render() positions the bed itself, but never touches
  // the pet's own left/top, so without this it'd sit in the wrong place
  // until it next moves. transition disabled + a forced reflow so it
  // appears there instantly instead of visibly sliding in on load.
  if (currentPet.is_sleeping && currentPet.has_bed && currentPet.bed_active && currentPet.life_stage !== "egg") {
    const host = $("pet-screen");
    const bed = $("pet-bed");
    const { targetX, targetY } = bedRestTarget(host, bed);
    host.style.transition = "none";
    host.style.left = `${targetX}px`;
    host.style.top = `${targetY}px`;
    void host.offsetHeight; // force a reflow so transition:none actually applies before re-enabling it
    host.style.transition = "";
  }
  showRecap(recap, loginBonus);

  // Record the species the moment it's revealed (egg -> hatchling), same
  // trigger point as the "You got a ___!" recap line above — not on later
  // stage-ups, and not re-fired for a species already in the collection.
  const hatched = recap.find((r) => r.stat === "life_stage" && r.to === "hatchling");
  if (hatched && currentUserId && !currentCollection.has(hatched.species)) {
    currentCollection.add(hatched.species);
    db.recordSpeciesDiscovered(currentUserId, hatched.species).catch(() => {});
  }
}

async function loadPetsForUser(userId, email) {
  currentUserId = userId;
  currentUserEmail = email;
  notifiedLow.clear();
  try {
    // Collection/scores are user-scoped, not pet-scoped, so they're fetched
    // once here rather than on every activatePetAndRender pet switch. Each
    // falls back to empty on failure (e.g. the table doesn't exist yet in
    // Supabase because the migration hasn't been run) so a pending schema
    // update can't take down login entirely.
    const [pets, collection, scores] = await Promise.all([
      db.fetchPets(userId),
      db.fetchCollection(userId).catch(() => []),
      db.fetchScores(userId).catch(() => ({})),
    ]);
    currentCollection = new Set(collection);
    currentScores = scores;
    if (!pets.length) {
      screen("name-pet");
      return;
    }
    const active = pets.find((p) => p.is_active) || pets[0];
    await activatePetAndRender(active);
  } catch (err) {
    currentUserId = null;
    showMessage(err.message, true);
  }
}

let messageToken = 0;

// autoHideMs (optional) clears the message after a delay — used for
// transient confirmations like a mini-game result, which shouldn't linger
// forever. The token guards against clearing a *newer* message that replaced
// this one before the timeout fired.
function showMessage(text, isError = false, autoHideMs = 0) {
  const el = $("error");
  el.textContent = text;
  el.classList.toggle("error--bad", isError);
  const token = ++messageToken;
  if (autoHideMs) {
    setTimeout(() => {
      if (messageToken !== token) return;
      el.textContent = "";
      el.classList.remove("error--bad");
    }, autoHideMs);
  }
}

// Supabase intentionally returns the same generic error for "wrong password"
// and "no such account" — distinguishing them would let an attacker enumerate
// registered emails, so we don't try to unmask that here.
function friendlyAuthError(err) {
  const msg = err.message || String(err);
  if (/invalid login credentials/i.test(msg)) return "Incorrect email or password.";
  if (/email not confirmed/i.test(msg)) return "Please confirm your email first, check your inbox.";
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
      showMessage("Password reset email sent, check your inbox.");
    });
  });

  $("reset-password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = $("new-password-input").value;
    const confirmPassword = $("new-password-confirm-input").value;
    if (password !== confirmPassword) {
      showMessage("New passwords do not match.", true);
      return;
    }
    await withBusy(e.submitter, "Updating…", async () => {
      await db.updatePassword(password);
      localStorage.setItem(PASSWORD_RESET_KEY, String(Date.now()));
      const session = await db.getSession();
      if (session) await loadPetsForUser(session.user.id, session.user.email);
    });
  });

  $("name-pet-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("pet-name-input").value.trim() || "Mochi";
    try {
      currentPet = await db.createPet(currentUserId, name, pickRandomSpecies());
      screen("pet");
      render();
    } catch (err) {
      showMessage(err.message, true);
    }
  });
}

async function init() {
  $("app-version").textContent = `v${VERSION}`;
  wireAuth();
  wireActions();
  wireTooltipTouch();
  screen("auth");

  if (!db.isConfigured) {
    showMessage("Supabase not configured yet. Add your project URL/anon key to supabase.js", true);
    return;
  }

  // A previous fix here tried to detect a recovery link by checking
  // window.location.hash for "type=recovery" — wrong, because that's only
  // how the OLD implicit auth flow encodes it. Supabase's current default
  // (PKCE) flow instead redirects with a plain ?code= (or routes through
  // /auth/confirm?type=recovery server-side, which this static site
  // doesn't have), so the recovery type isn't reliably visible in the URL
  // at all — trying to sniff it there means guessing a format that depends
  // on the Supabase project's own flow settings, and guessing wrong is
  // exactly what broke it last time.
  //
  // Rely entirely on onAuthStateChange instead — no separate getSession()
  // call, so nothing races it. But it's unclear which of PASSWORD_RECOVERY
  // vs. the session-bearing event (INITIAL_SESSION/SIGNED_IN) fires first
  // for a recovery link — both stem from the same URL, and the ordering
  // isn't documented. So a session-bearing event doesn't commit to loading
  // pets immediately; it waits a brief moment for PASSWORD_RECOVERY to
  // possibly still arrive first. Imperceptible on a normal login, but
  // closes the gap regardless of which event order this Supabase project's
  // flow happens to produce.
  let sawPasswordRecovery = false;
  db.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      sawPasswordRecovery = true;
      screen("reset-password");
      return;
    }
    if (!session || currentUserId) return;
    setTimeout(() => {
      if (sawPasswordRecovery || currentUserId) return;
      loadPetsForUser(session.user.id, session.user.email);
    }, 150);
  });

  // A sibling tab (e.g. the original one, if the recovery link opened a
  // new tab) just changed the password on this same recovery session —
  // log in directly here too instead of leaving this tab sitting on a
  // stale "set a new password" form that would either fail or set a
  // different password than the one already saved.
  window.addEventListener("storage", (e) => {
    if (e.key !== PASSWORD_RESET_KEY || currentUserId) return;
    db.getSession().then((session) => {
      if (session) loadPetsForUser(session.user.id, session.user.email);
    });
  });
}

init();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
