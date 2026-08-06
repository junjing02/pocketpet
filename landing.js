import { buildBitmap, GRID_SIZE } from "./pet-sprites.js";

const host = document.getElementById("landing-pet");
host.style.setProperty("--grid-size", GRID_SIZE);

const bitmap = buildBitmap("adult", { eyesOpen: true });
let html = "";
for (const row of bitmap) {
  for (const v of row) {
    html += `<i class="dot${v === 1 ? " dot--body" : ""}${v === 2 ? " dot--eye" : ""}"></i>`;
  }
}
host.innerHTML = html;
