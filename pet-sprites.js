// Procedural pixel-dot pet sprites — no image assets, just an on/off grid.
// grid values: 0 = off, 1 = body dot, 2 = eye dot
export const GRID_SIZE = 15;

const STAGE_SHAPE = {
  egg:   { rx: 4, ry: 5, cy: 9, eyes: false },
  baby:  { rx: 4, ry: 4, cy: 9, eyes: true },
  child: { rx: 5, ry: 5, cy: 9, eyes: true, ears: true },
  teen:  { rx: 5, ry: 5, cy: 8, eyes: true, ears: true, arms: true, legs: true },
  adult: { rx: 6, ry: 6, cy: 7, eyes: true, ears: true, arms: true, legs: true, antenna: true },
};

function emptyGrid() {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
}

function setDot(grid, row, col, val) {
  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return;
  grid[row][col] = val;
}

export function buildBitmap(stage, { eyesOpen = true } = {}) {
  const shape = STAGE_SHAPE[stage] || STAGE_SHAPE.egg;
  const { rx, ry, cy, eyes, ears, arms, legs, antenna } = shape;
  const cx = Math.floor(GRID_SIZE / 2);
  const grid = emptyGrid();

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) grid[y][x] = 1;
    }
  }

  if (ears) {
    setDot(grid, cy - ry - 1, cx - 3, 1);
    setDot(grid, cy - ry - 1, cx + 3, 1);
  }
  if (arms) {
    setDot(grid, cy, cx - rx - 1, 1);
    setDot(grid, cy, cx + rx + 1, 1);
  }
  if (legs) {
    setDot(grid, cy + ry + 1, cx - 2, 1);
    setDot(grid, cy + ry + 1, cx + 2, 1);
  }
  if (antenna) {
    setDot(grid, cy - ry - 1, cx, 1);
  }
  if (eyes && eyesOpen) {
    const eyeRow = cy - Math.round(ry / 2);
    setDot(grid, eyeRow, cx - 2, 2);
    setDot(grid, eyeRow, cx + 2, 2);
  }

  return grid;
}
