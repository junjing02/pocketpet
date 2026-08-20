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
import { GRID_SIZE, outlineSilhouette, trimBitmap } from "./pet-sprites.js?v=116";

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
    startRow: 10,
    halfWidths: [0, 1, 0],
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
  // The actual spinning vinyl — a small round disc with a light center label
  // dot, unchanged in shape from before the box redesign (still gets its
  // spin animation, see .music-box-disc in style.css). Rendered separately
  // from musicBoxFrame below and layered on top of it via CSS grid stacking
  // (see #music-box), not merged into one shape, specifically so the frame
  // can stay still while only the disc spins.
  musicBoxDisc: {
    startRow: 10,
    halfWidths: [1, 2, 1],
    accents: { rowOffset: 1, colOffsets: [0], value: 4 },
  },
  // A squared-off box/cabinet the disc sits inside — straight sides (uniform
  // halfWidth), unlike every other prop's rounded profile, sized a bit
  // wider/taller than the disc above so it reads as a frame around it.
  musicBoxFrame: {
    startRow: 9,
    halfWidths: [3, 3, 3, 3, 3],
  },
  nightLightBulb: {
    startRow: 10,
    halfWidths: [1, 2, 2, 1],
  },
  // A shallow wide basin — rounder and shorter than the Bed's mat, with a
  // light center dot (reusing the same dot--light accent as the Music Box's
  // record label) reading as water inside the bowl.
  toiletBowl: {
    startRow: 9,
    halfWidths: [2, 4, 5, 5, 4],
    accents: { rowOffset: 2, colOffsets: [0], value: 4 },
  },
};

function buildPropBitmap(name) {
  const profile = PROP_PROFILES[name];
  const grid = emptyGrid();
  profile.halfWidths.forEach((w, i) => {
    const row = profile.startRow + i;
    for (let c = CX - w; c <= CX + w; c++) setDot(grid, row, c, 1);
  });
  // accents can be a single group or an array of groups (e.g. the Music
  // Box's boxed-in disc needs several rows to read as a small circle inside
  // the box, not just one row of dots).
  if (profile.accents) {
    const groups = Array.isArray(profile.accents) ? profile.accents : [profile.accents];
    for (const group of groups) {
      const row = profile.startRow + group.rowOffset;
      const value = group.value ?? 2;
      for (const off of group.colOffsets) setDot(grid, row, CX + off, value);
    }
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
