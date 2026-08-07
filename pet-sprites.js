// Hand-tuned pixel-dot puppy sprites — no image assets, just an on/off grid.
// grid values: 0 = off, 1 = fur dot, 2 = dark dot (eyes/nose)
export const GRID_SIZE = 25;
const CX = Math.floor(GRID_SIZE / 2);

// A separate (smaller) body stacked under a (bigger) head is what makes this
// read as a puppy instead of one big circle — the head/body seam creates a
// visible "neck" instead of one continuous round blob.
const PROFILES = {
  egg: {
    head: { startRow: 6, halfWidths: [1, 3, 4, 5, 6, 6, 6, 6, 6, 5, 4, 3, 1] },
  },
  baby: {
    head: { startRow: 9, halfWidths: [2, 3, 3, 3, 2] },
    eyes: { rowOffset: 2, colOffset: 2 },
    nose: { rowOffset: 3, col: 0 },
  },
  child: {
    head: { startRow: 6, halfWidths: [2, 3, 4, 3] },
    body: { startRow: 10, halfWidths: [2, 2, 1] },
    eyes: { rowOffset: 1, colOffset: 2 },
    nose: { rowOffset: 2, col: 0 },
    features: [{ onHead: true, rowOffset: -1, colOffsets: [-3, 3] }], // ears
    limbFrames: [
      [
        { onBody: true, rowOffset: 0, colOffsets: [3] }, // tail
        { onBody: true, rowOffset: 3, colOffsets: [-2, 1] }, // feet
      ],
      [
        { onBody: true, rowOffset: 0, colOffsets: [4] },
        { onBody: true, rowOffset: 3, colOffsets: [-1, 2] },
      ],
    ],
  },
  teen: {
    head: { startRow: 5, halfWidths: [3, 4, 5, 5, 4] },
    body: { startRow: 10, halfWidths: [3, 3, 2] },
    eyes: { rowOffset: 1, colOffset: 3 },
    nose: { rowOffset: 3, col: 0 },
    features: [{ onHead: true, rowOffset: -1, colOffsets: [-4, 4] }], // ears
    limbFrames: [
      [
        { onBody: true, rowOffset: 0, colOffsets: [5] }, // tail
        { onBody: true, rowOffset: 3, colOffsets: [-3, 1] }, // feet
      ],
      [
        { onBody: true, rowOffset: 0, colOffsets: [6] },
        { onBody: true, rowOffset: 3, colOffsets: [-1, 3] },
      ],
    ],
  },
  adult: {
    head: { startRow: 4, halfWidths: [3, 5, 6, 6, 5] },
    body: { startRow: 9, halfWidths: [4, 4, 3, 2] },
    eyes: { rowOffset: 1, colOffset: 4 },
    nose: { rowOffset: 3, col: 0 },
    features: [{ onHead: true, rowOffset: -1, colOffsets: [-5, 5] }], // ears
    limbFrames: [
      [
        { onBody: true, rowOffset: 0, colOffsets: [6] }, // tail
        { onBody: true, rowOffset: 4, colOffsets: [-4, 2] }, // feet
      ],
      [
        { onBody: true, rowOffset: 0, colOffsets: [7] },
        { onBody: true, rowOffset: 4, colOffsets: [-2, 4] },
      ],
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

function drawStack(grid, stack) {
  if (!stack) return;
  stack.halfWidths.forEach((w, i) => {
    const row = stack.startRow + i;
    for (let c = CX - w; c <= CX + w; c++) setDot(grid, row, c, 1);
  });
}

export function buildBitmap(stage, { eyesOpen = true, frame = 0 } = {}) {
  const profile = PROFILES[stage] || PROFILES.egg;
  const grid = emptyGrid();

  drawStack(grid, profile.head);
  drawStack(grid, profile.body);

  const anchorRow = (feature) => (feature.onBody ? profile.body : profile.head).startRow + feature.rowOffset;

  for (const feature of profile.features || []) {
    const row = anchorRow(feature);
    for (const off of feature.colOffsets) setDot(grid, row, CX + off, 1);
  }

  if (profile.limbFrames) {
    const limbs = profile.limbFrames[frame % profile.limbFrames.length];
    for (const limb of limbs) {
      const row = anchorRow(limb);
      for (const off of limb.colOffsets) setDot(grid, row, CX + off, 1);
    }
  }

  if (profile.eyes && eyesOpen) {
    const row = profile.head.startRow + profile.eyes.rowOffset;
    setDot(grid, row, CX - profile.eyes.colOffset, 2);
    setDot(grid, row, CX + profile.eyes.colOffset, 2);
  }

  if (profile.nose) {
    const row = profile.head.startRow + profile.nose.rowOffset;
    setDot(grid, row, CX + profile.nose.col, 2);
  }

  return grid;
}
