// Hand-tuned pixel-dot pet sprites — no image assets, just an on/off grid.
// grid values: 0 = off, 1 = body dot, 2 = eye dot
export const GRID_SIZE = 15;
const CX = Math.floor(GRID_SIZE / 2);

// Each profile is a stack of rows described by half-width (row spans
// cx-w..cx+w), plus optional eyes and small feature dots (ears/arms/feet)
// anchored relative to the stack. Hand-tuned instead of a pure ellipse
// formula because raw math reads as a blob at 15x15 — these curves are
// shaped to actually look like a rounded creature.
const PROFILES = {
  egg: {
    startRow: 2,
    halfWidths: [1, 2, 3, 4, 4, 4, 4, 4, 3, 2, 1],
  },
  baby: {
    startRow: 5,
    halfWidths: [2, 3, 4, 4, 4, 3, 2],
    eyes: { rowOffset: 1, colOffset: 2 },
  },
  child: {
    startRow: 5,
    halfWidths: [3, 4, 5, 5, 5, 5, 4, 3],
    eyes: { rowOffset: 1, colOffset: 3 },
    features: [
      { rowOffset: -1, colOffsets: [-4, 4] }, // ears
      { rowOffset: 8, colOffsets: [-2, 2] }, // feet
    ],
  },
  teen: {
    startRow: 4,
    halfWidths: [3, 4, 5, 6, 6, 6, 5, 4, 3],
    eyes: { rowOffset: 1, colOffset: 3 },
    features: [
      { rowOffset: -1, colOffsets: [-4, 4] }, // ears
      { rowOffset: 4, colOffsets: [-7, 7] }, // arms
      { rowOffset: 9, colOffsets: [-3, 3] }, // feet
    ],
  },
  adult: {
    startRow: 3,
    halfWidths: [3, 4, 5, 6, 7, 7, 7, 6, 5, 4, 3],
    eyes: { rowOffset: 2, colOffset: 3 },
    features: [
      { rowOffset: -2, colOffsets: [0] }, // antenna
      { rowOffset: -1, colOffsets: [-5, 5] }, // ears
      { rowOffset: 3, colOffsets: [-7, 7] }, // arms
      { rowOffset: 11, colOffsets: [-3, 3] }, // feet
    ],
  },
};

function emptyGrid() {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
}

function setDot(grid, row, col, val) {
  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return;
  grid[row][col] = val;
}

export function buildBitmap(stage, { eyesOpen = true } = {}) {
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

  if (profile.eyes && eyesOpen) {
    const row = profile.startRow + profile.eyes.rowOffset;
    setDot(grid, row, CX - profile.eyes.colOffset, 2);
    setDot(grid, row, CX + profile.eyes.colOffset, 2);
  }

  return grid;
}
