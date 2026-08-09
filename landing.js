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

// Static full-evolution timeline: the shared egg shown once (every species
// hatches from the same shape, so repeating it per row would just be
// redundant), then one full-width row per species — hatchling through
// adult, flowing left to right with arrows, stacked down the page.
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

function renderEvolutionTimeline() {
  const egg = document.getElementById("evolution-egg");
  const rows = document.getElementById("evolution-rows");
  if (!egg || !rows) return;

  egg.style.setProperty("--grid-size", GRID_SIZE);
  egg.style.setProperty("--dot-color", STAGE_SHADE.egg);
  egg.innerHTML = stageDotsHtml("egg");

  rows.innerHTML = SPECIES.map((species) => {
    const cells = NON_EGG_STAGES.map((stage, i) => {
      const stageLabel = stage[0].toUpperCase() + stage.slice(1);
      const arrow = i > 0 ? `<span class="evolution-arrow">→</span>` : "";
      return `
        ${arrow}
        <div class="evolution-cell">
          <div class="evolution-stage" style="--grid-size:${GRID_SIZE};--dot-color:${SPECIES_SHADE[species]}">${stageDotsHtml(stage, species)}</div>
          <span class="evolution-stage-label">${stageLabel}</span>
        </div>`;
    }).join("");
    return `<div class="evolution-row">${cells}</div>`;
  }).join("");
}

renderEvolutionTimeline();
