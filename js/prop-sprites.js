// Hand-tuned pixel-dot sprites for playground props — Bed, Ball, Music Box
// disc, Night Light bulb, poop. Same rendering language as the pet itself
// (see pet-sprites.js): a flat-fill silhouette with a 1-dot outline dilated
// around it, no smooth curves/gradients/border-radius. Reuses
// pet-sprites.js's outline/trim machinery directly (same DOT_SIZE, same
// dilation algorithm) rather than duplicating it, so the outline treatment
// is guaranteed pixel-identical to the creature's — that consistency was
// the whole point of this module existing (props used to be plain CSS
// circles/ovals/gradients, which read as a completely different, smoother
// visual language than the blocky pixel-art pet standing next to them).
import { GRID_SIZE, outlineSilhouette, trimBitmap } from "./pet-sprites.js?v=97";

const CX = Math.floor(GRID_SIZE / 2);

function emptyGrid() {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
}
function setDot(grid, row, col, val) {
  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return;
  grid[row][col] = val;
}

// halfWidths: same authoring convention as pet-sprites.js — one row per
// entry, filled symmetrically around the shared center column CX. accents
// (optional): a handful of dot--eye (dark) cells layered on top, for a bit
// of surface texture (e.g. the Bed's woven-mat stitching) without needing a
// whole second shape.
const PROP_PROFILES = {
  ball: {
    startRow: 9,
    halfWidths: [1, 2, 2, 2, 1],
  },
  poop: {
    startRow: 10,
    halfWidths: [0, 1, 2, 2],
  },
  bed: {
    startRow: 7,
    halfWidths: [3, 6, 9, 10, 10, 10, 10, 9, 6, 3],
    accents: { rowOffset: 4, colOffsets: [-6, -2, 2, 6] },
  },
  musicBoxDisc: {
    startRow: 8,
    halfWidths: [1, 3, 4, 4, 4, 3, 1],
    // A single light dot at the center — the record's label hole — so the
    // disc isn't just a plain filled circle. value: 4 (dot--light) instead
    // of the dark dot--eye accent the Bed uses, since this needs to read as
    // lighter than the disc, not another dark detail.
    accents: { rowOffset: 3, colOffsets: [0], value: 4 },
  },
  nightLightBulb: {
    startRow: 10,
    halfWidths: [1, 2, 2, 1],
  },
};

function buildPropBitmap(name) {
  const profile = PROP_PROFILES[name];
  const grid = emptyGrid();
  profile.halfWidths.forEach((w, i) => {
    const row = profile.startRow + i;
    for (let c = CX - w; c <= CX + w; c++) setDot(grid, row, c, 1);
  });
  if (profile.accents) {
    const row = profile.startRow + profile.accents.rowOffset;
    const value = profile.accents.value ?? 2;
    for (const off of profile.accents.colOffsets) setDot(grid, row, CX + off, value);
  }
  outlineSilhouette(grid);
  return grid;
}

// Returns the same { html, width } shape pet-sprites.js's own sprite
// rendering produces, so call sites set --grid-size and inject .innerHTML
// exactly like every other dot-grid render in this app. Value 4 (dot--light)
// is prop-only — the pet's own sprites never use it, that slot is dot--bow
// there — so reusing the number doesn't collide with anything.
export function propSpriteHtml(name) {
  const { rows, width } = trimBitmap(buildPropBitmap(name));
  let html = "";
  for (const row of rows) {
    for (const v of row) {
      html += `<i class="dot${v === 1 ? " dot--body" : ""}${v === 2 ? " dot--eye" : ""}${v === 3 ? " dot--outline" : ""}${v === 4 ? " dot--light" : ""}"></i>`;
    }
  }
  return { html, width, height: rows.length };
}
