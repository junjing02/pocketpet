import { buildBitmap, GRID_SIZE, STAGE_ORDER, STAGE_DOT_SIZE, STAGE_SHADE, SPECIES, SPECIES_SHADE } from "./pet-sprites.js";

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

function showStage(stage, species) {
  host.style.setProperty("--dot-size", `${STAGE_DOT_SIZE[stage]}px`);
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

// Static full-evolution chart, one row per species — every stage laid out
// side by side instead of watching them cycle one at a time.
function renderEvolutionShowcase() {
  const container = document.getElementById("evolution-rows");
  if (!container) return;
  container.innerHTML = SPECIES.map((species) => {
    const cells = STAGE_ORDER.map((stage) => {
      const bitmap = buildBitmap(stage, { species, eyesOpen: true });
      let dots = "";
      for (const row of bitmap) {
        for (const v of row) {
          dots += `<i class="dot${v === 1 ? " dot--body" : ""}${v === 2 ? " dot--eye" : ""}${v === 3 ? " dot--outline" : ""}"></i>`;
        }
      }
      return `<div class="evolution-stage" style="--grid-size:${GRID_SIZE};--dot-color:${SPECIES_SHADE[species]}">${dots}</div>`;
    }).join("");
    return `<div class="evolution-row">${cells}</div>`;
  }).join("");
}

renderEvolutionShowcase();
