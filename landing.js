import { buildBitmap, GRID_SIZE, STAGE_ORDER, STAGE_DOT_SIZE, STAGE_SHADE, SPECIES_SHADE } from "./pet-sprites.js";

const host = document.getElementById("landing-pet");
const label = document.getElementById("hero-stage-label");
const device = host.parentElement;
host.style.setProperty("--grid-size", GRID_SIZE);

function placeRandomly() {
  const maxX = Math.max(0, device.clientWidth - host.offsetWidth);
  const maxY = Math.max(0, device.clientHeight - host.offsetHeight);
  host.style.left = `${Math.random() * maxX}px`;
  host.style.top = `${Math.random() * maxY}px`;
}

function centerHost() {
  host.style.left = `${Math.max(0, (device.clientWidth - host.offsetWidth) / 2)}px`;
  host.style.top = `${Math.max(0, (device.clientHeight - host.offsetHeight) / 2)}px`;
}

function showStage(stage) {
  host.style.setProperty("--dot-size", `${STAGE_DOT_SIZE[stage]}px`);
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
// outcomes are visible together, each drifting on its own schedule.
function spawnCompanion(elId, species) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.style.setProperty("--grid-size", GRID_SIZE);
  el.style.setProperty("--dot-size", "4px");
  el.style.setProperty("--dot-color", SPECIES_SHADE[species]);
  const bitmap = buildBitmap("adult", { species, eyesOpen: true });
  let html = "";
  for (const row of bitmap) {
    for (const v of row) {
      html += `<i class="dot${v === 1 ? " dot--body" : ""}${v === 2 ? " dot--eye" : ""}"></i>`;
    }
  }
  el.innerHTML = html;

  function driftRandomly() {
    const maxX = Math.max(0, device.clientWidth - el.offsetWidth);
    const maxY = Math.max(0, device.clientHeight - el.offsetHeight);
    el.style.left = `${Math.random() * maxX}px`;
    el.style.top = `${Math.random() * maxY}px`;
  }

  driftRandomly();
  // Randomized interval per pet so the two don't move in lockstep.
  setInterval(driftRandomly, 2600 + Math.random() * 2000);
}

spawnCompanion("landing-pet-bunny", "bunny");
spawnCompanion("landing-pet-turtle", "turtle");
