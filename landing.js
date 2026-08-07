import { buildBitmap, GRID_SIZE } from "./pet-sprites.js";

function renderDots(host, stage) {
  host.style.setProperty("--grid-size", GRID_SIZE);
  const bitmap = buildBitmap(stage, { eyesOpen: true });
  let html = "";
  for (const row of bitmap) {
    for (const v of row) {
      html += `<i class="dot${v === 1 ? " dot--body" : ""}${v === 2 ? " dot--eye" : ""}"></i>`;
    }
  }
  host.innerHTML = html;
}

renderDots(document.getElementById("landing-pet"), "adult");

const STAGES = [
  { id: "egg", label: "Egg" },
  { id: "hatchling", label: "Hatchling" },
  { id: "chick", label: "Chick" },
  { id: "fledgling", label: "Fledgling" },
  { id: "juvenile", label: "Juvenile" },
  { id: "adult", label: "Adult" },
];

const gallery = document.getElementById("stage-gallery");
gallery.innerHTML = STAGES.map(
  (s) => `
    <div class="stage-item">
      <div class="pet-screen stage-preview" id="stage-${s.id}"></div>
      <p class="stage-label">${s.label}</p>
    </div>`
).join("");

for (const s of STAGES) {
  renderDots(document.getElementById(`stage-${s.id}`), s.id);
}
