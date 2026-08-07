import { buildBitmap, GRID_SIZE, STAGE_ORDER, STAGE_DOT_SIZE, STAGE_SHADE, SPECIES_SHADE } from "./pet-sprites.js";

const host = document.getElementById("landing-pet");
const label = document.getElementById("hero-stage-label");
const device = host.parentElement;
host.style.setProperty("--grid-size", GRID_SIZE);

// Every pet sharing the playground registers here so placement can check
// against everyone else's current box and avoid landing on top of them.
const pets = [host];

// On a narrow phone the box holding the fully-grown hero already eats most
// of the width, so there's no honest way to fit 3 full-size sprites without
// overlap — shrink everyone together instead, keeping their proportions.
function sizeScale() {
  return Math.max(0.5, Math.min(1, device.clientWidth / 520));
}

function rectOf(el) {
  const left = parseFloat(el.style.left) || 0;
  const top = parseFloat(el.style.top) || 0;
  return { left, top, right: left + el.offsetWidth, bottom: top + el.offsetHeight };
}

function overlapsOthers(el, x, y, pad = 4) {
  const rect = { left: x, top: y, right: x + el.offsetWidth, bottom: y + el.offsetHeight };
  return pets.some((p) => {
    if (p === el) return false;
    const other = rectOf(p);
    return rect.left < other.right + pad && other.left < rect.right + pad && rect.top < other.bottom + pad && other.top < rect.bottom + pad;
  });
}

// Rejection-samples random spots (or spots near a preferred point) until one
// doesn't collide with any other pet's current box, falling back to the last
// try if the playground is too crowded to find a clean spot.
function findOpenSpot(el, { near } = {}) {
  const maxX = Math.max(0, device.clientWidth - el.offsetWidth);
  const maxY = Math.max(0, device.clientHeight - el.offsetHeight);
  let lastX = near ? near.x : Math.random() * maxX;
  let lastY = near ? near.y : Math.random() * maxY;

  for (let attempt = 0; attempt < 60; attempt++) {
    let x, y;
    if (near) {
      const spread = 20 + attempt * 8; // widen the search the longer the center stays blocked
      x = Math.min(maxX, Math.max(0, near.x + (Math.random() * 2 - 1) * spread));
      y = Math.min(maxY, Math.max(0, near.y + (Math.random() * 2 - 1) * spread));
    } else {
      x = Math.random() * maxX;
      y = Math.random() * maxY;
    }
    lastX = x;
    lastY = y;
    if (!overlapsOthers(el, x, y)) return { x, y };
  }
  return { x: lastX, y: lastY };
}

function placeRandomly() {
  const { x, y } = findOpenSpot(host);
  host.style.left = `${x}px`;
  host.style.top = `${y}px`;
}

function centerHost() {
  const near = {
    x: Math.max(0, (device.clientWidth - host.offsetWidth) / 2),
    y: Math.max(0, (device.clientHeight - host.offsetHeight) / 2),
  };
  const { x, y } = findOpenSpot(host, { near });
  host.style.left = `${x}px`;
  host.style.top = `${y}px`;
}

function showStage(stage) {
  host.style.setProperty("--dot-size", `${STAGE_DOT_SIZE[stage] * sizeScale()}px`);
  host.style.setProperty("--dot-color", STAGE_SHADE[stage]);
  const bitmap = buildBitmap(stage, { eyesOpen: true });
  let html = "";
  for (const row of bitmap) {
    for (const v of row) {
      html += `<i class="dot${v === 1 ? " dot--body" : ""}${v === 2 ? " dot--eye" : ""}"></i>`;
    }
  }
  host.innerHTML = html;
  label.textContent = stage;
  // Freeze in a readable spot right away — no competing with a shape change.
  centerHost();
}

const STAGE_HOLD_MS = 2500;
const DRIFT_AFTER_MS = 1100; // pause before wandering, so the new shape registers first

let stageIndex = 0;

function cycle() {
  const stage = STAGE_ORDER[stageIndex];
  showStage(stage);

  if (stage !== "egg") {
    setTimeout(placeRandomly, DRIFT_AFTER_MS);
  }

  setTimeout(() => {
    stageIndex = (stageIndex + 1) % STAGE_ORDER.length;
    cycle();
  }, STAGE_HOLD_MS);
}

cycle();

// The other two species wander the same playground as full-grown adults,
// alongside the hero pet growing up — so all 3 possible surprise-egg
// outcomes are visible together, each drifting on its own schedule, and
// none of them land on top of each other or the hero.
function spawnCompanion(elId, species) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.style.setProperty("--grid-size", GRID_SIZE);
  el.style.setProperty("--dot-size", `${4 * sizeScale()}px`);
  el.style.setProperty("--dot-color", SPECIES_SHADE[species]);
  const bitmap = buildBitmap("adult", { species, eyesOpen: true });
  let html = "";
  for (const row of bitmap) {
    for (const v of row) {
      html += `<i class="dot${v === 1 ? " dot--body" : ""}${v === 2 ? " dot--eye" : ""}"></i>`;
    }
  }
  el.innerHTML = html;
  pets.push(el);

  function driftRandomly() {
    const { x, y } = findOpenSpot(el);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  driftRandomly();
  // Randomized interval per pet so the two don't move in lockstep.
  setInterval(driftRandomly, 2600 + Math.random() * 2000);
}

spawnCompanion("landing-pet-bunny", "bunny");
spawnCompanion("landing-pet-turtle", "turtle");
