import { buildBitmap, GRID_SIZE, STAGE_ORDER, STAGE_DOT_SIZE } from "./pet-sprites.js";

const host = document.getElementById("landing-pet");
const label = document.getElementById("hero-stage-label");
host.style.setProperty("--grid-size", GRID_SIZE);

function showStage(stage) {
  host.style.setProperty("--dot-size", `${STAGE_DOT_SIZE[stage]}px`);
  const bitmap = buildBitmap(stage, { eyesOpen: true });
  let html = "";
  for (const row of bitmap) {
    for (const v of row) {
      html += `<i class="dot${v === 1 ? " dot--body" : ""}${v === 2 ? " dot--eye" : ""}"></i>`;
    }
  }
  host.innerHTML = html;
  label.textContent = stage;
}

let stageIndex = 0;
showStage(STAGE_ORDER[stageIndex]);
setInterval(() => {
  stageIndex = (stageIndex + 1) % STAGE_ORDER.length;
  showStage(STAGE_ORDER[stageIndex]);
}, 1500);
