// Hand-tuned pixel-dot chick sprites — no image assets, just an on/off grid.
// grid values: 0 = off, 1 = fur/feather dot, 2 = eye dot
export const GRID_SIZE = 25;
const CX = Math.floor(GRID_SIZE / 2);

// One rounded body per stage (no separate head/body, no ears/tail) — a beak,
// a fluff tuft, and (from child onward) tiny feet and wing nubs are all it
// takes to read as a chick while staying much simpler than a dog.
const PROFILES = {
  egg: {
    startRow: 6,
    halfWidths: [1, 3, 4, 5, 6, 6, 6, 6, 6, 5, 4, 3, 1],
  },
  baby: {
    startRow: 9,
    halfWidths: [2, 3, 4, 4, 3, 2],
    eyes: { rowOffset: 1, colOffset: 2 },
    tuft: { rowOffset: -1, colOffsets: [0] },
    beak: { rowOffset: 6, colOffsets: [0, 1] },
  },
  child: {
    startRow: 7,
    halfWidths: [3, 4, 5, 5, 4, 3],
    eyes: { rowOffset: 1, colOffset: 3 },
    tuft: { rowOffset: -1, colOffsets: [0] },
    beak: { rowOffset: 6, colOffsets: [-1, 0] },
    limbFrames: [
      [{ rowOffset: 7, colOffsets: [-2, 1] }], // feet
      [{ rowOffset: 7, colOffsets: [-1, 2] }],
    ],
  },
  teen: {
    startRow: 6,
    halfWidths: [3, 5, 6, 6, 6, 5, 3],
    eyes: { rowOffset: 1, colOffset: 4 },
    tuft: { rowOffset: -1, colOffsets: [0] },
    beak: { rowOffset: 7, colOffsets: [-1, 0] },
    features: [{ rowOffset: 3, colOffsets: [-8, 8] }], // wings
    limbFrames: [
      [{ rowOffset: 8, colOffsets: [-3, 2] }], // feet
      [{ rowOffset: 8, colOffsets: [-2, 3] }],
    ],
  },
  adult: {
    startRow: 5,
    halfWidths: [3, 5, 7, 7, 7, 7, 5, 3],
    eyes: { rowOffset: 1, colOffset: 4 },
    tuft: { rowOffset: -1, colOffsets: [-1, 1] },
    beak: { rowOffset: 8, colOffsets: [-1, 0, 1] },
    features: [{ rowOffset: 3, colOffsets: [-9, 9] }], // wings
    limbFrames: [
      [{ rowOffset: 9, colOffsets: [-4, 2] }], // feet
      [{ rowOffset: 9, colOffsets: [-2, 4] }],
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

export function buildBitmap(stage, { eyesOpen = true, frame = 0 } = {}) {
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

  return grid;
}
