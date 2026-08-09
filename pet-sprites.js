// Hand-tuned pixel-dot sprites — no image assets, just an on/off grid.
// grid values: 0 = off, 1 = fill dot, 2 = eye/sparkle/bow dot, 3 = outline dot
// (outline is a 1px black ring computed by dilating the silhouette outward —
// see buildBitmap — so fill stays a light tint and the outline reads as the
// bold black line of a low-res, limited-palette pixel-art sprite.)
export const GRID_SIZE = 25;
const CX = Math.floor(GRID_SIZE / 2);

export const STAGE_ORDER = ["egg", "hatchling", "young", "teen", "juvenile", "adult"];
export const STAGE_DOT_SIZE = { egg: 3, hatchling: 3.5, young: 4.5, teen: 5.5, juvenile: 6.5, adult: 7.5 };
export const STAGE_SHADE = {
  egg: "#f0f0f0",
  hatchling: "#e8e8e8",
  young: "#dedede",
  teen: "#d4d4d4",
  juvenile: "#cacaca",
  adult: "#c0c0c0",
};

// Which creature an egg hatches into is a surprise — every species shares the
// same egg shape (no spoilers) and only diverges starting at hatchling. Each
// is a genuinely different silhouette, not a palette swap: different size,
// proportions, and features across all 5 post-egg stages.
export const SPECIES = ["bird", "bunny", "turtle"];
export const SPECIES_SHADE = {
  bird: "#e2e2e2",
  bunny: "#eeeeee",
  turtle: "#d0d0d0",
};

export function pickRandomSpecies() {
  return SPECIES[Math.floor(Math.random() * SPECIES.length)];
}

const EGG_PROFILE = {
  startRow: 6,
  halfWidths: [1, 3, 4, 5, 6, 6, 6, 6, 6, 5, 4, 3, 1],
};

// Bird: a wet-looking featureless hatchling, a round fluffy young bird, a
// gawky tall teen with lopsided wing stubs, a proportionate juvenile growing
// real wings, and a full majestic adult with a fanned tail.
const BIRD_PROFILES = {
  hatchling: {
    startRow: 10,
    halfWidths: [1, 2, 3, 3, 2, 1],
    eyes: { rowOffset: 2, colOffset: 1 },
    bow: { rowOffset: -1, colOffsets: [-1, 1] },
  },
  young: {
    startRow: 8,
    halfWidths: [2, 3, 4, 4, 3, 2],
    eyes: { rowOffset: 1, colOffset: 1 },
    tuft: { rowOffset: -1, colOffsets: [0] },
    bow: { rowOffset: -2, colOffsets: [-1, 1] },
    beak: { rowOffset: 6, colOffsets: [-1, 0] },
    limbFrames: [
      [{ rowOffset: 7, colOffsets: [-2, 1] }],
      [{ rowOffset: 7, colOffsets: [-1, 2] }],
    ],
  },
  teen: {
    // Tall/uniform-width column instead of round — the "awkward teenager" shape
    startRow: 6,
    halfWidths: [2, 3, 3, 3, 3, 3, 2],
    eyes: { rowOffset: 1, colOffset: 1 },
    tuft: { rowOffset: -1, colOffsets: [-1] }, // off-center, scruffy
    bow: { rowOffset: -2, colOffsets: [-1, 1] },
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
    eyes: { rowOffset: 1, colOffset: 3 },
    tuft: { rowOffset: -1, colOffsets: [0] },
    bow: { rowOffset: -2, colOffsets: [-1, 1] },
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
    eyes: { rowOffset: 1, colOffset: 3 },
    tuft: { rowOffset: -1, colOffsets: [-1, 1] }, // crest
    bow: { rowOffset: -2, colOffsets: [-1, 1] },
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

// Bunny: round chubby body, no beak, tall ears that grow with every stage,
// a small tail poof out back — a much wider, softer silhouette than the bird.
const BUNNY_PROFILES = {
  hatchling: {
    startRow: 10,
    halfWidths: [1, 2, 3, 3, 2, 1],
    eyes: { rowOffset: 2, colOffset: 1 },
    features: [{ rowOffset: -1, colOffsets: [-2, 2] }], // tiny ear buds
    bow: { rowOffset: -2, colOffsets: [-1, 1] },
  },
  young: {
    startRow: 7,
    halfWidths: [2, 3, 4, 4, 4, 3, 2],
    eyes: { rowOffset: 2, colOffset: 2 },
    features: [
      { rowOffset: -1, colOffsets: [-3, 3] }, // ear base
      { rowOffset: -2, colOffsets: [-3, 3] }, // ear tip
      { rowOffset: 3, colOffsets: [-6] }, // tail poof
    ],
    bow: { rowOffset: -3, colOffsets: [-3, 3] },
    limbFrames: [
      [{ rowOffset: 7, colOffsets: [-2, 1] }],
      [{ rowOffset: 7, colOffsets: [-1, 2] }],
    ],
  },
  teen: {
    startRow: 5,
    halfWidths: [2, 3, 4, 5, 5, 5, 4, 3, 2],
    eyes: { rowOffset: 2, colOffset: 2 },
    features: [
      { rowOffset: -1, colOffsets: [-4, 4] },
      { rowOffset: -2, colOffsets: [-4, 4] },
      { rowOffset: -3, colOffsets: [-4, 4] }, // long, gawky ears
      { rowOffset: 4, colOffsets: [-7] }, // tail poof
    ],
    bow: { rowOffset: -4, colOffsets: [-4, 4] },
    limbFrames: [
      [{ rowOffset: 9, colOffsets: [-3, 2] }],
      [{ rowOffset: 9, colOffsets: [-2, 3] }],
    ],
  },
  juvenile: {
    startRow: 5,
    halfWidths: [3, 5, 6, 7, 7, 7, 6, 5, 3],
    eyes: { rowOffset: 2, colOffset: 4 },
    features: [
      { rowOffset: -1, colOffsets: [-5, 5] },
      { rowOffset: -2, colOffsets: [-5, 5] },
      { rowOffset: -3, colOffsets: [-5, 5] },
      { rowOffset: -4, colOffsets: [-5, 5] },
      { rowOffset: 5, colOffsets: [9] }, // tail poof
    ],
    bow: { rowOffset: -5, colOffsets: [-5, 5] },
    limbFrames: [
      [{ rowOffset: 9, colOffsets: [-4, 3] }],
      [{ rowOffset: 9, colOffsets: [-3, 4] }],
    ],
  },
  adult: {
    startRow: 6,
    halfWidths: [3, 5, 7, 8, 8, 8, 8, 6, 4],
    eyes: { rowOffset: 2, colOffset: 5 },
    features: [
      { rowOffset: -1, colOffsets: [-6, 6] },
      { rowOffset: -2, colOffsets: [-6, 6] },
      { rowOffset: -3, colOffsets: [-6, 6] },
      { rowOffset: -4, colOffsets: [-6, 6] },
      { rowOffset: -5, colOffsets: [-6, 6] }, // tall, full-grown ears
      { rowOffset: 6, colOffsets: [10] }, // tail poof
    ],
    bow: { rowOffset: -6, colOffsets: [-6, 6] },
    limbFrames: [
      [{ rowOffset: 9, colOffsets: [-5, 4] }],
      [{ rowOffset: 9, colOffsets: [-4, 5] }],
    ],
    sparkle: { rowOffset: 1, colOffsets: [8] },
  },
};

// Turtle: wide, flat shell dome with a small head poking out front and
// stubby legs peeking from under the shell edge — short and broad instead
// of tall, the opposite proportions of the bird and bunny.
const TURTLE_PROFILES = {
  hatchling: {
    startRow: 11,
    halfWidths: [2, 4, 4, 2],
    features: [{ rowOffset: 4, colOffsets: [-2, -1, 0, 1, 2] }], // small head
    eyes: { rowOffset: 4, colOffset: 1 },
  },
  young: {
    startRow: 9,
    halfWidths: [2, 4, 5, 5, 4, 2],
    features: [
      { rowOffset: 6, colOffsets: [-3, -2, -1, 0, 1, 2, 3] }, // head pokes out further
    ],
    eyes: { rowOffset: 6, colOffset: 1 },
    limbFrames: [
      [{ rowOffset: 5, colOffsets: [-6, 6] }],
      [{ rowOffset: 5, colOffsets: [-5, 5] }],
    ],
  },
  teen: {
    startRow: 8,
    halfWidths: [3, 5, 6, 7, 6, 5, 3],
    features: [{ rowOffset: 7, colOffsets: [-4, -3, -2, -1, 0, 1, 2, 3, 4] }], // longer head
    eyes: { rowOffset: 7, colOffset: 2 },
    limbFrames: [
      [{ rowOffset: 6, colOffsets: [-8, 8] }],
      [{ rowOffset: 6, colOffsets: [-7, 9] }],
    ],
  },
  juvenile: {
    startRow: 7,
    halfWidths: [3, 6, 7, 8, 8, 7, 6, 3],
    features: [{ rowOffset: 8, colOffsets: [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5] }],
    eyes: { rowOffset: 8, colOffset: 3 },
    limbFrames: [
      [{ rowOffset: 7, colOffsets: [-9, 9] }],
      [{ rowOffset: 7, colOffsets: [-8, 10] }],
    ],
  },
  adult: {
    startRow: 6,
    halfWidths: [3, 7, 9, 10, 10, 10, 9, 7, 3],
    features: [{ rowOffset: 9, colOffsets: [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6] }], // big head, fully out
    eyes: { rowOffset: 9, colOffset: 4 },
    limbFrames: [
      [{ rowOffset: 8, colOffsets: [-10, 10] }],
      [{ rowOffset: 8, colOffsets: [-9, 11] }],
    ],
    sparkle: { rowOffset: 2, colOffsets: [8] },
  },
};

const SPECIES_PROFILES = { bird: BIRD_PROFILES, bunny: BUNNY_PROFILES, turtle: TURTLE_PROFILES };

function emptyGrid() {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
}

function setDot(grid, row, col, val) {
  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return;
  grid[row][col] = val;
}

export function buildBitmap(stage, { species = "bird", eyesOpen = true, frame = 0, variant = "normal", hasBow = false } = {}) {
  const profile = stage === "egg" ? EGG_PROFILE : (SPECIES_PROFILES[species] || BIRD_PROFILES)[stage] || EGG_PROFILE;
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

  if (profile.bow && hasBow) {
    const row = profile.startRow + profile.bow.rowOffset;
    for (const off of profile.bow.colOffsets) setDot(grid, row, CX + off, 2);
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

  outlineSilhouette(grid);
  return grid;
}

// Dilates the silhouette by one dot in every direction (including diagonals,
// so corners stay solid) and marks that ring as outline — the thick black
// border that reads as a single bold line around an otherwise flat sprite.
function outlineSilhouette(grid) {
  const toOutline = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (grid[row][col] !== 0) continue;
      let touchesBody = false;
      for (let dr = -1; dr <= 1 && !touchesBody; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const r = row + dr;
          const c = col + dc;
          if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) continue;
          if (grid[r][c] === 1 || grid[r][c] === 2) {
            touchesBody = true;
            break;
          }
        }
      }
      if (touchesBody) toOutline.push([row, col]);
    }
  }
  for (const [row, col] of toOutline) grid[row][col] = 3;
}
