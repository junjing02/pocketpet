import { buildBitmap, GRID_SIZE, STAGE_ORDER, STAGE_DOT_SIZE } from "./pet-sprites.js";

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
  const bitmap = buildBitmap(stage, { eyesOpen: true });
  let html = "";
  for (const row of bitmap) {
    for (const v of row) {
      html += `<i class="dot${v === 1 ? " dot--body" : ""}${v === 2 ? " dot--eye" : ""}"></i>`;
    }
  }
  host.innerHTML = html;
  label.textContent = stage;
  // Eggs don't move; every other stage gets a new random spot each cycle.
  stage === "egg" ? centerHost() : placeRandomly();
}

let stageIndex = 0;
showStage(STAGE_ORDER[stageIndex]);
setInterval(() => {
  stageIndex = (stageIndex + 1) % STAGE_ORDER.length;
  showStage(STAGE_ORDER[stageIndex]);
}, 1500);

// A little extra wandering within a stage, not just on stage change.
setInterval(() => {
  if (STAGE_ORDER[stageIndex] !== "egg") placeRandomly();
}, 700);
