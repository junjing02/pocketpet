import { buildBitmap, GRID_SIZE, STAGE_ORDER, DOT_SIZE, STAGE_SHADE, SPECIES, SPECIES_SHADE } from "./pet-sprites.js";

const host = document.getElementById("landing-pet");
const label = document.getElementById("hero-stage-label");
const device = host.parentElement;
host.style.setProperty("--grid-size", GRID_SIZE);
host.style.setProperty("--dot-size", `${DOT_SIZE}px`);

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

function showStage(stage, species) {
  host.style.setProperty("--dot-color", STAGE_SHADE[stage]);
  const bitmap = buildBitmap(stage, { species, eyesOpen: true });
  let html = "";
  for (const row of bitmap) {
    for (const v of row) {
      html += `<i class="dot${v === 1 ? " dot--body" : ""}${v === 2 ? " dot--eye" : ""}${v === 3 ? " dot--outline" : ""}"></i>`;
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
let speciesIndex = 0;

function cycle() {
  const stage = STAGE_ORDER[stageIndex];
  showStage(stage, SPECIES[speciesIndex]);

  if (stage !== "egg") {
    setTimeout(placeRandomly, DRIFT_AFTER_MS);
  }

  setTimeout(() => {
    stageIndex += 1;
    if (stageIndex >= STAGE_ORDER.length) {
      // This one finished growing up — hand off to the next possible
      // surprise-egg outcome, starting from its own egg again.
      stageIndex = 0;
      speciesIndex = (speciesIndex + 1) % SPECIES.length;
    }
    cycle();
  }, STAGE_HOLD_MS);
}

cycle();

// Static full-evolution tree: one shared egg at the root (every species
// hatches from the same shape, so showing it 3 times would just be
// repetition) branching into one row per species — hatchling through adult.
const NON_EGG_STAGES = STAGE_ORDER.filter((s) => s !== "egg");

function stageDotsHtml(stage, species) {
  const bitmap = buildBitmap(stage, { species, eyesOpen: true });
  let dots = "";
  for (const row of bitmap) {
    for (const v of row) {
      dots += `<i class="dot${v === 1 ? " dot--body" : ""}${v === 2 ? " dot--eye" : ""}${v === 3 ? " dot--outline" : ""}"></i>`;
    }
  }
  return dots;
}

function renderEvolutionTree() {
  const egg = document.getElementById("evolution-egg");
  const branches = document.getElementById("evolution-branches");
  if (!egg || !branches) return;

  egg.style.setProperty("--grid-size", GRID_SIZE);
  egg.style.setProperty("--dot-color", STAGE_SHADE.egg);
  egg.innerHTML = stageDotsHtml("egg");

  branches.innerHTML = SPECIES.map((species) => {
    const cells = NON_EGG_STAGES.map(
      (stage) =>
        `<div class="evolution-stage" style="--grid-size:${GRID_SIZE};--dot-color:${SPECIES_SHADE[species]}">${stageDotsHtml(stage, species)}</div>`
    ).join("");
    return `<div class="evolution-branch"><div class="evolution-branch-row">${cells}</div></div>`;
  }).join("");
}

renderEvolutionTree();
