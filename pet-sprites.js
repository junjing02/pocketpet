// Hand-tuned pixel-dot bird sprites — no image assets, just an on/off grid.
// grid values: 0 = off, 1 = fur/feather dot, 2 = eye dot
export const GRID_SIZE = 25;
const CX = Math.floor(GRID_SIZE / 2);

// Each stage is a genuinely different silhouette (not the same shape scaled
// up) — a wet-looking featureless hatchling, a round fluffy chick, a gawky
// tall fledgling with lopsided wing stubs, a more proportionate juvenile
// growing real wings, and a full majestic adult with a fanned tail.
const PROFILES = {
  egg: {
    startRow: 6,
    halfWidths: [1, 3, 4, 5, 6, 6, 6, 6, 6, 5, 4, 3, 1],
  },
  hatchling: {
    startRow: 10,
    halfWidths: [1, 2, 3, 3, 2, 1],
    eyes: { rowOffset: 2, colOffset: 2 },
  },
  chick: {
    startRow: 8,
    halfWidths: [2, 3, 4, 4, 3, 2],
    eyes: { rowOffset: 1, colOffset: 2 },
    tuft: { rowOffset: -1, colOffsets: [0] },
    beak: { rowOffset: 6, colOffsets: [-1, 0] },
    limbFrames: [
      [{ rowOffset: 7, colOffsets: [-2, 1] }], // feet
      [{ rowOffset: 7, colOffsets: [-1, 2] }],
    ],
  },
  fledgling: {
    // Tall/uniform-width column instead of round — the "awkward teenager" shape
    startRow: 6,
    halfWidths: [2, 3, 3, 3, 3, 3, 2],
    eyes: { rowOffset: 1, colOffset: 2 },
    tuft: { rowOffset: -1, colOffsets: [-1] }, // off-center, scruffy
    beak: { rowOffset: 7, colOffsets: [0, 1] },
    features: [
      { rowOffset: 3, colOffsets: [-5] }, // lopsided wing stub, one side only sticks out here
      { rowOffset: 4, colOffsets: [6] }, // the other wing stub, different row — asymmetric on purpose
    ],
    limbFrames: [
      [{ rowOffset: 8, colOffsets: [-3, 2] }], // big gangly feet
      [{ rowOffset: 8, colOffsets: [-2, 3] }],
    ],
  },
  juvenile: {
    startRow: 5,
    halfWidths: [3, 5, 6, 6, 6, 5, 3],
    eyes: { rowOffset: 1, colOffset: 4 },
    tuft: { rowOffset: -1, colOffsets: [0] },
    beak: { rowOffset: 7, colOffsets: [-1, 0, 1] },
    features: [
      { rowOffset: 2, colOffsets: [-8, 8] }, // real, symmetric wings now
      { rowOffset: 2, colOffsets: [9] }, // small tail nub
    ],
    limbFrames: [
      [{ rowOffset: 8, colOffsets: [-4, 2] }],
      [{ rowOffset: 8, colOffsets: [-2, 4] }],
    ],
  },
  adult: {
    startRow: 5,
    halfWidths: [3, 5, 7, 7, 7, 7, 5, 3],
    eyes: { rowOffset: 1, colOffset: 4 },
    tuft: { rowOffset: -1, colOffsets: [-1, 1] }, // crest
    beak: { rowOffset: 8, colOffsets: [-1, 0, 1] },
    features: [
      { rowOffset: 3, colOffsets: [-9, 9] }, // full wings
      { rowOffset: 5, colOffsets: [11] }, // fanned tail feather
    ],
    limbFrames: [
      [{ rowOffset: 9, colOffsets: [-4, 2] }],
      [{ rowOffset: 9, colOffsets: [-2, 4] }],
    ],
    // Only drawn when raised with consistently good care (see petVariant() in app.js)
    sparkle: { rowOffset: 0, colOffsets: [7] },
  },
};

function emptyGrid() {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
}

function setDot(grid, row, col, val) {
  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return;
  grid[row][col] = val;
}

export function buildBitmap(stage, { eyesOpen = true, frame = 0, variant = "normal" } = {}) {
  const profile = PROFILES[stage] || PROFILES.egg;
  const grid = emptyGrid();

  profile.halfWidths.forEach((w, i) => {
    const row = profile.startRow + i;
    for (let c = CX - w; c <= CX + w; c++) setDot(grid, row, c, 1);
  });

  for (const feature of profile.features || []) {
    const row = profile.startRow + feature.rowOffset;
    for (const off of feature.colOffsets) setDot(grid, row, CX + off, 1);
  }

  if (profile.tuft) {
    const row = profile.startRow + profile.tuft.rowOffset;
    for (const off of profile.tuft.colOffsets) setDot(grid, row, CX + off, 1);
  }

  if (profile.beak) {
    const row = profile.startRow + profile.beak.rowOffset;
    for (const off of profile.beak.colOffsets) setDot(grid, row, CX + off, 1);
  }

  if (profile.limbFrames) {
    const limbs = profile.limbFrames[frame % profile.limbFrames.length];
    for (const limb of limbs) {
      const row = profile.startRow + limb.rowOffset;
      for (const off of limb.colOffsets) setDot(grid, row, CX + off, 1);
    }
  }

  if (profile.eyes && eyesOpen) {
    const row = profile.startRow + profile.eyes.rowOffset;
    setDot(grid, row, CX - profile.eyes.colOffset, 2);
    setDot(grid, row, CX + profile.eyes.colOffset, 2);
  }

  if (profile.sparkle && variant === "pristine") {
    const row = profile.startRow + profile.sparkle.rowOffset;
    for (const off of profile.sparkle.colOffsets) setDot(grid, row, CX + off, 2);
  }

  return grid;
}
