import {
  buildBitmap,
  trimBitmap,
  STAGE_ORDER,
  DOT_SIZE,
  STAGE_SHADE,
  SPECIES,
  SPECIES_SHADE,
  STAGE_MOVE_DURATION_S,
} from "./pet-sprites.js?v=73";
import { VERSION } from "./version.js?v=73";

document.getElementById("app-version").textContent = `v${VERSION}`;

const host = document.getElementById("landing-pet");
const label = document.getElementById("hero-stage-label");
const device = host.parentElement;
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
  host.style.setProperty("--move-duration", `${STAGE_MOVE_DURATION_S[stage] ?? 1.6}s`);
  const bitmap = buildBitmap(stage, { species, eyesOpen: true });
  // Trim to the creature's actual bounding box (not the full 25x25 grid) so
  // the host element's own size matches what's visible — needed both for
  // accurate wandering bounds and so the ground shadow (CSS ::after, below)
  // lands right under its feet instead of under a bunch of empty grid.
  const { rows, width } = trimBitmap(bitmap);
  host.style.setProperty("--grid-size", width);
  let html = "";
  for (const row of rows) {
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

// Each stage/species only occupies a small region of the fixed 25x25 grid,
// hand-placed around a shared center column rather than centered in the
// full grid — trim to just that region so the preview box only has to
// center the trimmed result, instead of the creature sitting off-center
// inside a mostly-empty 25x25 box.
function stageGridHtml(stage, species) {
  const bitmap = buildBitmap(stage, { species, eyesOpen: true });
  const { rows, width } = trimBitmap(bitmap);
  let dots = "";
  for (const row of rows) {
    for (const v of row) {
      dots += `<i class="dot${v === 1 ? " dot--body" : ""}${v === 2 ? " dot--eye" : ""}${v === 3 ? " dot--outline" : ""}"></i>`;
    }
  }
  return { dots, width };
}

function renderEvolutionTimeline() {
  const egg = document.getElementById("evolution-egg");
  const rows = document.getElementById("evolution-rows");
  if (!egg || !rows) return;

  const eggSprite = stageGridHtml("egg");
  egg.style.setProperty("--dot-color", STAGE_SHADE.egg);
  egg.innerHTML = `<div class="evolution-stage-grid" style="--grid-size:${eggSprite.width}">${eggSprite.dots}</div>`;

  rows.innerHTML = SPECIES.map((species) => {
    const cells = NON_EGG_STAGES.map((stage, i) => {
      const sprite = stageGridHtml(stage, species);
      const arrow = i > 0 ? `<span class="evolution-arrow">→</span>` : "";
      return `
        ${arrow}
        <div class="evolution-stage" style="--dot-color:${SPECIES_SHADE[species]}">
          <div class="evolution-stage-grid" style="--grid-size:${sprite.width}">${sprite.dots}</div>
        </div>`;
    }).join("");
    return `<div class="evolution-row">${cells}</div>`;
  }).join("");
}

renderEvolutionTimeline();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
