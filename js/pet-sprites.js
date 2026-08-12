// Hand-tuned pixel-dot sprites — no image assets, just an on/off grid.
// grid values: 0 = off, 1 = fill dot, 2 = eye/sparkle dot, 3 = outline dot,
// 4 = bow dot, 5 = cape dot (each accessory gets its own color, so it
// actually stands out instead of blending in as plain black dots; the bow
// still gets the outline ring since it's chunky enough to carry one, the
// cape doesn't — a black ring around its 1-dot-wide tails read too heavy)
// (outline is a 1px black ring computed by dilating the silhouette outward
// — see buildBitmap — so fill stays a light tint and the outline reads as
// the bold black line of a low-res, limited-palette pixel-art sprite.)
export const GRID_SIZE = 25;
const CX = Math.floor(GRID_SIZE / 2);

export const STAGE_ORDER = ["egg", "hatchling", "young", "teen", "juvenile", "adult"];
// One fixed dot size for every stage, not a per-stage lookup — the outline
// is always exactly 1 dot wide, so if dot size grew with the stage (like it
// used to), the outline's absolute thickness grew right along with it,
// making the border look thin on a hatchling and chunky on an adult. Growth
// now comes entirely from each stage's silhouette using more cells (a
// hatchling is ~9 wide, an adult ~23 — plenty of size difference on its
// own), so the outline stroke stays the same width at every stage. Kept
// small (rather than the app's usual ~1px hairlines) only because the
// outline is 1 whole grid cell, not a border — this is close to the floor
// before eyes/features stop being legible at all.
export const DOT_SIZE = 3.5;
export const STAGE_SHADE = {
  egg: "#f0f0f0",
  hatchling: "#e8e8e8",
  young: "#dedede",
  teen: "#d4d4d4",
  juvenile: "#cacaca",
  adult: "#c0c0c0",
};

// Real young animals are more active than grown ones — a hatchling darts
// around quickly and often, an adult ambles and rests more. These tune both
// how long a single move takes (CSS transition duration) and how often a
// new move is triggered, so the slowdown reads as the pet visibly aging,
// not just growing bigger. Egg never moves at all (see wanderPet in app.js).
export const STAGE_MOVE_DURATION_S = {
  egg: 0,
  hatchling: 0.7,
  young: 0.85,
  teen: 1.1,
  juvenile: 1.4,
  adult: 1.8,
};
export const STAGE_WANDER_INTERVAL_MS = {
  egg: 0,
  hatchling: 1400,
  young: 1700,
  teen: 2300,
  juvenile: 3200,
  adult: 4200,
};

// Which creature an egg hatches into is a surprise — every species shares the
// same egg shape (no spoilers) and only diverges starting at hatchling. Each
// is a genuinely different silhouette, not a palette swap: different size,
// proportions, and features across all 5 post-egg stages.
export const SPECIES = ["bird", "bunny", "turtle", "cat", "hedgehog"];
export const SPECIES_SHADE = {
  bird: "#e2e2e2",
  bunny: "#eeeeee",
  turtle: "#d0d0d0",
  cat: "#e6e0d8",
  hedgehog: "#dcd4c8",
};

export function pickRandomSpecies() {
  return SPECIES[Math.floor(Math.random() * SPECIES.length)];
}

const EGG_PROFILE = {
  startRow: 6,
  halfWidths: [1, 3, 4, 5, 6, 6, 6, 6, 6, 5, 4, 3, 1],
};

// Bird: round and chick-like at every stage — big two-dot eyes, a stub
// beak, a single wispy tuft feather, and wings that grow in and flap
// (animFrames) as it ages, with a fanned tail by adulthood.
const BIRD_PROFILES = {
  hatchling: {
    startRow: 10,
    halfWidths: [2, 3, 4, 4, 3, 2],
    eyes: { rowOffset: 1, colOffset: 2, rows: [0, 1] },
    beak: { rowOffset: 6, colOffsets: [-1, 0, 1] },
    tuft: { rowOffset: -1, colOffsets: [0] },
    bow: { rowOffset: -1, colOffsets: [-1, 1] },
    cape: { rowOffset: 4 },
  },
  young: {
    startRow: 7,
    halfWidths: [1, 3, 4, 5, 5, 5, 4, 3],
    eyes: { rowOffset: 2, colOffset: 2, rows: [0, 1] },
    mouth: { rowOffset: 4, colOffsets: [0] },
    beak: { rowOffset: 8, colOffsets: [-1, 0, 1] },
    tuft: { rowOffset: -1, colOffsets: [0] },
    bow: { rowOffset: -2, colOffsets: [-1, 1] },
    cape: { rowOffset: 6 },
    animFrames: [
      [{ rowOffset: 4, colOffsets: [-6, 6] }],
      [{ rowOffset: 3, colOffsets: [-6, 6] }],
    ],
    limbFrames: [
      [{ rowOffset: 8, colOffsets: [-2, 1] }],
      [{ rowOffset: 8, colOffsets: [-1, 2] }],
    ],
  },
  teen: {
    startRow: 5,
    halfWidths: [1, 3, 4, 5, 6, 6, 6, 5, 4],
    eyes: { rowOffset: 2, colOffset: 2, rows: [0, 1] },
    mouth: { rowOffset: 4, colOffsets: [0] },
    beak: { rowOffset: 9, colOffsets: [-1, 0, 1] },
    tuft: { rowOffset: -2, colOffsets: [0] },
    bow: { rowOffset: -3, colOffsets: [-1, 1] },
    cape: { rowOffset: 6 },
    animFrames: [
      [{ rowOffset: 4, colOffsets: [-7, 7] }, { rowOffset: 5, colOffsets: [-7, 7] }],
      [{ rowOffset: 3, colOffsets: [-7, 7] }, { rowOffset: 4, colOffsets: [-7, 7] }],
    ],
    limbFrames: [
      [{ rowOffset: 9, colOffsets: [-2, 1] }],
      [{ rowOffset: 9, colOffsets: [-1, 2] }],
    ],
  },
  juvenile: {
    startRow: 4,
    halfWidths: [2, 4, 6, 7, 8, 8, 8, 7, 6, 4],
    eyes: { rowOffset: 2, colOffset: 3, rows: [0, 1] },
    mouth: { rowOffset: 5, colOffsets: [0] },
    beak: { rowOffset: 10, colOffsets: [-1, 0, 1] },
    tuft: { rowOffset: -2, colOffsets: [0] },
    bow: { rowOffset: -3, colOffsets: [-1, 1] },
    cape: { rowOffset: 7 },
    animFrames: [
      [{ rowOffset: 3, colOffsets: [-9, 9] }, { rowOffset: 4, colOffsets: [-10, 10] }],
      [{ rowOffset: 2, colOffsets: [-9, 9] }, { rowOffset: 3, colOffsets: [-10, 10] }],
    ],
    limbFrames: [
      [{ rowOffset: 10, colOffsets: [-3, 2] }],
      [{ rowOffset: 10, colOffsets: [-2, 3] }],
    ],
  },
  adult: {
    startRow: 4,
    halfWidths: [2, 5, 7, 8, 9, 9, 9, 9, 8, 6, 4],
    eyes: { rowOffset: 2, colOffset: 3, rows: [0, 1] },
    mouth: { rowOffset: 5, colOffsets: [0] },
    beak: { rowOffset: 11, colOffsets: [-1, 0, 1] },
    tuft: { rowOffset: -2, colOffsets: [0] },
    bow: { rowOffset: -3, colOffsets: [-1, 1] },
    cape: { rowOffset: 7 },
    features: [
      { rowOffset: 6, colOffsets: [12] }, // fanned tail feather, stays put while wings flap
    ],
    animFrames: [
      [{ rowOffset: 3, colOffsets: [-10, 10] }, { rowOffset: 4, colOffsets: [-11, 11] }],
      [{ rowOffset: 2, colOffsets: [-10, 10] }, { rowOffset: 3, colOffsets: [-11, 11] }],
    ],
    limbFrames: [
      [{ rowOffset: 11, colOffsets: [-4, 3] }],
      [{ rowOffset: 11, colOffsets: [-3, 4] }],
    ],
    // Only drawn when raised with consistently good care (see petVariant() in app.js)
    sparkle: { rowOffset: 0, colOffsets: [8] },
  },
};

// Bunny: round chubby body, big eyes, a tail poof, and tall ears that grow
// with every stage and wiggle outward on alternating walk frames.
function bunnyEars(rowOffset, height, halfSpan) {
  const upright = [];
  const wiggle = [];
  for (let i = 0; i < height; i++) {
    const row = rowOffset - i;
    upright.push({ rowOffset: row, colOffsets: [-halfSpan, halfSpan] });
    const flare = i === 0 ? 1 : 0;
    wiggle.push({ rowOffset: row, colOffsets: [-halfSpan - flare, halfSpan + flare] });
  }
  return [upright, wiggle];
}

const BUNNY_PROFILES = {
  hatchling: {
    startRow: 10,
    halfWidths: [2, 3, 4, 4, 3, 2],
    eyes: { rowOffset: 1, colOffset: 2, rows: [0, 1] },
    mouth: { rowOffset: 4, colOffsets: [0] },
    features: [{ rowOffset: -1, colOffsets: [-2, 2] }], // tiny ear buds
    bow: { rowOffset: -1, colOffsets: [-1, 1] },
    cape: { rowOffset: 4 },
  },
  young: {
    startRow: 7,
    halfWidths: [1, 3, 4, 5, 5, 5, 4, 3],
    eyes: { rowOffset: 2, colOffset: 2, rows: [0, 1] },
    mouth: { rowOffset: 4, colOffsets: [0] },
    animFrames: bunnyEars(-1, 2, 3),
    features: [{ rowOffset: 3, colOffsets: [-6] }], // tail poof
    bow: { rowOffset: -1, colOffsets: [-1, 1] },
    cape: { rowOffset: 6 },
    limbFrames: [
      [{ rowOffset: 8, colOffsets: [-2, 1] }],
      [{ rowOffset: 8, colOffsets: [-1, 2] }],
    ],
  },
  teen: {
    startRow: 5,
    halfWidths: [1, 3, 4, 5, 6, 6, 6, 5, 4],
    eyes: { rowOffset: 2, colOffset: 2, rows: [0, 1] },
    mouth: { rowOffset: 4, colOffsets: [0] },
    animFrames: bunnyEars(-1, 3, 4),
    features: [{ rowOffset: 4, colOffsets: [-7] }], // tail poof
    bow: { rowOffset: -1, colOffsets: [-1, 1] },
    cape: { rowOffset: 6 },
    limbFrames: [
      [{ rowOffset: 9, colOffsets: [-2, 1] }],
      [{ rowOffset: 9, colOffsets: [-1, 2] }],
    ],
  },
  juvenile: {
    startRow: 4,
    halfWidths: [2, 4, 6, 7, 8, 8, 8, 7, 6, 4],
    eyes: { rowOffset: 2, colOffset: 3, rows: [0, 1] },
    mouth: { rowOffset: 5, colOffsets: [0] },
    animFrames: bunnyEars(-1, 4, 5),
    features: [{ rowOffset: 5, colOffsets: [-9] }], // tail poof
    bow: { rowOffset: -1, colOffsets: [-1, 1] },
    cape: { rowOffset: 7 },
    limbFrames: [
      [{ rowOffset: 10, colOffsets: [-3, 2] }],
      [{ rowOffset: 10, colOffsets: [-2, 3] }],
    ],
  },
  adult: {
    startRow: 5,
    halfWidths: [2, 5, 7, 8, 9, 9, 9, 9, 8, 6],
    eyes: { rowOffset: 2, colOffset: 3, rows: [0, 1] },
    mouth: { rowOffset: 5, colOffsets: [0] },
    animFrames: bunnyEars(-1, 5, 6),
    features: [{ rowOffset: 6, colOffsets: [-10] }], // tail poof
    bow: { rowOffset: -1, colOffsets: [-1, 1] },
    cape: { rowOffset: 7 },
    limbFrames: [
      [{ rowOffset: 10, colOffsets: [-4, 3] }],
      [{ rowOffset: 10, colOffsets: [-3, 4] }],
    ],
    sparkle: { rowOffset: 1, colOffsets: [8] },
  },
};

// Turtle: a wide flat-topped shell with a genuinely rounded head hanging
// below it — built as a short stack of narrowing/widening rows (not one
// flat strip) so a visible "neck" separates head from shell, with legs
// peeking out at the sides.
function turtleHead(rowOffset, widths) {
  return widths.map((w, i) => ({ rowOffset: rowOffset + i, colOffsets: rangeSym(w) }));
}

function rangeSym(halfWidth) {
  const out = [];
  for (let off = -halfWidth; off <= halfWidth; off++) out.push(off);
  return out;
}

const TURTLE_PROFILES = {
  hatchling: {
    startRow: 11,
    halfWidths: [2, 4, 4, 1],
    features: turtleHead(4, [1, 2, 1]),
    eyes: { rowOffset: 5, colOffset: 1, rows: [0] },
    mouth: { rowOffset: 6, colOffsets: [0] },
    bow: { rowOffset: -1, colOffsets: [-1, 1] },
    cape: { rowOffset: 3 },
  },
  young: {
    startRow: 9,
    halfWidths: [2, 4, 5, 5, 3, 1],
    features: turtleHead(6, [1, 3, 3, 1]),
    eyes: { rowOffset: 7, colOffset: 2, rows: [0, 1] },
    mouth: { rowOffset: 9, colOffsets: [0] },
    bow: { rowOffset: -1, colOffsets: [-1, 1] },
    cape: { rowOffset: 5 },
    limbFrames: [
      [{ rowOffset: 4, colOffsets: [-6, 6] }],
      [{ rowOffset: 4, colOffsets: [-5, 5] }],
    ],
  },
  teen: {
    startRow: 8,
    halfWidths: [3, 5, 6, 7, 5, 2],
    features: turtleHead(7, [1, 4, 4, 2]),
    eyes: { rowOffset: 8, colOffset: 2, rows: [0, 1] },
    mouth: { rowOffset: 10, colOffsets: [0] },
    bow: { rowOffset: -1, colOffsets: [-1, 1] },
    cape: { rowOffset: 6 },
    limbFrames: [
      [{ rowOffset: 5, colOffsets: [-8, 8] }],
      [{ rowOffset: 5, colOffsets: [-7, 9] }],
    ],
  },
  juvenile: {
    startRow: 7,
    halfWidths: [3, 6, 7, 8, 6, 3],
    features: turtleHead(7, [2, 5, 5, 2]),
    eyes: { rowOffset: 8, colOffset: 3, rows: [0, 1] },
    mouth: { rowOffset: 10, colOffsets: [0] },
    bow: { rowOffset: -1, colOffsets: [-1, 1] },
    cape: { rowOffset: 6 },
    limbFrames: [
      [{ rowOffset: 6, colOffsets: [-9, 9] }],
      [{ rowOffset: 6, colOffsets: [-8, 10] }],
    ],
  },
  adult: {
    startRow: 6,
    halfWidths: [3, 7, 9, 10, 10, 8, 4],
    features: turtleHead(8, [2, 6, 6, 3]),
    eyes: { rowOffset: 9, colOffset: 3, rows: [0, 1] },
    mouth: { rowOffset: 11, colOffsets: [0] },
    bow: { rowOffset: -1, colOffsets: [-1, 1] },
    cape: { rowOffset: 7 },
    limbFrames: [
      [{ rowOffset: 7, colOffsets: [-10, 10] }],
      [{ rowOffset: 7, colOffsets: [-9, 11] }],
    ],
    sparkle: { rowOffset: 1, colOffsets: [8] },
  },
};

// Cat: pointy triangular ears (unlike bunny's tall straight ones), whiskers-
// free simple face, and a tail that curls at the tip by adulthood.
const CAT_PROFILES = {
  hatchling: {
    startRow: 10,
    halfWidths: [2, 3, 4, 4, 3, 2],
    eyes: { rowOffset: 1, colOffset: 2, rows: [0, 1] },
    mouth: { rowOffset: 4, colOffsets: [0] },
    features: [{ rowOffset: -1, colOffsets: [-2, 2] }], // tiny ear buds
    bow: { rowOffset: -1, colOffsets: [-1, 1] },
    cape: { rowOffset: 4 },
  },
  young: {
    startRow: 7,
    halfWidths: [1, 3, 4, 5, 5, 5, 4, 3],
    eyes: { rowOffset: 2, colOffset: 2, rows: [0, 1] },
    mouth: { rowOffset: 4, colOffsets: [0] },
    features: [
      { rowOffset: -1, colOffsets: [-4, -3, 3, 4] }, // ear base
      { rowOffset: -2, colOffsets: [-3, 4] }, // ear tip, leaning in
      { rowOffset: 3, colOffsets: [-6] }, // tail
    ],
    bow: { rowOffset: -1, colOffsets: [-1, 1] },
    cape: { rowOffset: 6 },
    limbFrames: [
      [{ rowOffset: 8, colOffsets: [-2, 1] }],
      [{ rowOffset: 8, colOffsets: [-1, 2] }],
    ],
  },
  teen: {
    startRow: 5,
    halfWidths: [1, 3, 4, 5, 6, 6, 6, 5, 4],
    eyes: { rowOffset: 2, colOffset: 2, rows: [0, 1] },
    mouth: { rowOffset: 4, colOffsets: [0] },
    features: [
      { rowOffset: -1, colOffsets: [-5, -4, 4, 5] },
      { rowOffset: -2, colOffsets: [-4, 5] },
      { rowOffset: -3, colOffsets: [-4, 5] },
      { rowOffset: 4, colOffsets: [-7] },
    ],
    bow: { rowOffset: -1, colOffsets: [-1, 1] },
    cape: { rowOffset: 6 },
    limbFrames: [
      [{ rowOffset: 9, colOffsets: [-2, 1] }],
      [{ rowOffset: 9, colOffsets: [-1, 2] }],
    ],
  },
  juvenile: {
    startRow: 4,
    halfWidths: [2, 4, 6, 7, 8, 8, 8, 7, 6, 4],
    eyes: { rowOffset: 2, colOffset: 3, rows: [0, 1] },
    mouth: { rowOffset: 5, colOffsets: [0] },
    features: [
      { rowOffset: -1, colOffsets: [-6, -5, 5, 6] },
      { rowOffset: -2, colOffsets: [-6, -5, 5, 6] },
      { rowOffset: -3, colOffsets: [-5, 6] },
      { rowOffset: 5, colOffsets: [-9] },
    ],
    bow: { rowOffset: -1, colOffsets: [-1, 1] },
    cape: { rowOffset: 7 },
    limbFrames: [
      [{ rowOffset: 10, colOffsets: [-3, 2] }],
      [{ rowOffset: 10, colOffsets: [-2, 3] }],
    ],
  },
  adult: {
    startRow: 4,
    halfWidths: [2, 5, 7, 8, 9, 9, 9, 9, 8, 6, 4],
    eyes: { rowOffset: 2, colOffset: 3, rows: [0, 1] },
    mouth: { rowOffset: 5, colOffsets: [0] },
    features: [
      { rowOffset: -1, colOffsets: [-7, -6, 6, 7] },
      { rowOffset: -2, colOffsets: [-7, -6, 6, 7] },
      { rowOffset: -3, colOffsets: [-6, 7] },
      { rowOffset: -4, colOffsets: [-6, 7] },
      { rowOffset: 6, colOffsets: [11, 12] }, // curled tail tip
    ],
    bow: { rowOffset: -1, colOffsets: [-1, 1] },
    cape: { rowOffset: 7 },
    limbFrames: [
      [{ rowOffset: 11, colOffsets: [-4, 3] }],
      [{ rowOffset: 11, colOffsets: [-3, 4] }],
    ],
    sparkle: { rowOffset: 0, colOffsets: [8] },
  },
};

// Hedgehog: a row of small staggered spikes along the back is what reads as
// "hedgehog" — a single flat row of spikes gets bridged solid by the
// outline dilation, so they're built two rows deep with alternating columns
// to keep visible gaps between points.
function hedgehogSpikes(row, halfSpan, count) {
  const cols = count <= 1 ? [0] : Array.from({ length: count }, (_, i) => Math.round(-halfSpan + ((2 * halfSpan) / (count - 1)) * i));
  return [
    { rowOffset: row - 1, colOffsets: cols.filter((_, i) => i % 2 === 0) },
    { rowOffset: row - 1, colOffsets: cols.filter((_, i) => i % 2 === 1) },
    { rowOffset: row, colOffsets: cols },
  ];
}

const HEDGEHOG_PROFILES = {
  hatchling: {
    startRow: 10,
    halfWidths: [2, 3, 4, 4, 3, 2],
    eyes: { rowOffset: 2, colOffset: 2, rows: [0, 1] },
    mouth: { rowOffset: 5, colOffsets: [0] },
    features: hedgehogSpikes(-1, 3, 3),
    bow: { rowOffset: -2, colOffsets: [-1, 1] },
    cape: { rowOffset: 4 },
  },
  young: {
    startRow: 7,
    halfWidths: [1, 3, 4, 5, 5, 5, 4, 3],
    eyes: { rowOffset: 3, colOffset: 2, rows: [0, 1] },
    mouth: { rowOffset: 5, colOffsets: [0] },
    features: [...hedgehogSpikes(-1, 4, 5), { rowOffset: 2, colOffsets: [-6, 6] }],
    bow: { rowOffset: -2, colOffsets: [-1, 1] },
    cape: { rowOffset: 6 },
    limbFrames: [
      [{ rowOffset: 8, colOffsets: [-2, 1] }],
      [{ rowOffset: 8, colOffsets: [-1, 2] }],
    ],
  },
  teen: {
    startRow: 5,
    halfWidths: [1, 3, 4, 5, 6, 6, 6, 5, 4],
    eyes: { rowOffset: 3, colOffset: 2, rows: [0, 1] },
    mouth: { rowOffset: 5, colOffsets: [0] },
    features: [...hedgehogSpikes(-1, 5, 6), { rowOffset: 2, colOffsets: [-7, 7] }],
    bow: { rowOffset: -2, colOffsets: [-1, 1] },
    cape: { rowOffset: 7 },
    limbFrames: [
      [{ rowOffset: 9, colOffsets: [-2, 1] }],
      [{ rowOffset: 9, colOffsets: [-1, 2] }],
    ],
  },
  juvenile: {
    startRow: 4,
    halfWidths: [2, 4, 6, 7, 8, 8, 8, 7, 6, 4],
    eyes: { rowOffset: 3, colOffset: 3, rows: [0, 1] },
    mouth: { rowOffset: 6, colOffsets: [0] },
    features: [...hedgehogSpikes(-1, 7, 7), { rowOffset: 3, colOffsets: [-9, 9] }],
    bow: { rowOffset: -2, colOffsets: [-1, 1] },
    cape: { rowOffset: 8 },
    limbFrames: [
      [{ rowOffset: 10, colOffsets: [-3, 2] }],
      [{ rowOffset: 10, colOffsets: [-2, 3] }],
    ],
  },
  adult: {
    startRow: 4,
    halfWidths: [2, 5, 7, 8, 9, 9, 9, 9, 8, 6, 4],
    eyes: { rowOffset: 3, colOffset: 3, rows: [0, 1] },
    mouth: { rowOffset: 6, colOffsets: [0] },
    features: [...hedgehogSpikes(-1, 8, 8), { rowOffset: 3, colOffsets: [-10, 10] }],
    bow: { rowOffset: -2, colOffsets: [-1, 1] },
    cape: { rowOffset: 8 },
    limbFrames: [
      [{ rowOffset: 11, colOffsets: [-4, 3] }],
      [{ rowOffset: 11, colOffsets: [-3, 4] }],
    ],
    sparkle: { rowOffset: 0, colOffsets: [8] },
  },
};

const SPECIES_PROFILES = {
  bird: BIRD_PROFILES,
  bunny: BUNNY_PROFILES,
  turtle: TURTLE_PROFILES,
  cat: CAT_PROFILES,
  hedgehog: HEDGEHOG_PROFILES,
};

function emptyGrid() {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
}

function setDot(grid, row, col, val) {
  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return;
  grid[row][col] = val;
}

// Only claims empty cells — used exclusively for the cape, so it renders
// BEHIND the body: cells the silhouette already filled (drawn earlier) stay
// as-is, and the cape only shows where it peeks out around the edges, like
// a Superman cape draped behind the shoulders. Parts drawn AFTER the cape
// (mouth, limbs, eyes) still win over it normally via plain setDot.
function setDotBehind(grid, row, col, val) {
  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return;
  if (grid[row][col] === 0) grid[row][col] = val;
}

export function buildBitmap(
  stage,
  { species = "bird", eyesOpen = true, frame = 0, variant = "normal", hasBow = false, hasCape = false, capeWindX = 0, capeWindY = 0 } = {}
) {
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
    // A small flared ribbon — a narrow knot row above a wider wing row —
    // instead of 2 isolated dots, so it actually reads as a bow. Every
    // profile's bow.colOffsets was just [-1, 1], so the shape is fixed here
    // rather than duplicated per species/stage.
    const row = profile.startRow + profile.bow.rowOffset;
    for (const off of [-1, 1]) setDot(grid, row - 1, CX + off, 4);
    for (const off of [-2, -1, 0, 1, 2]) setDot(grid, row, CX + off, 4);
  }

  if (profile.cape && hasCape) {
    // A big cloth draped BEHIND the body (Superman-style) — drawn with
    // setDotBehind, which only fills cells the silhouette hasn't already
    // claimed, so it just peeks out around the body's own outline instead
    // of painting over it. That also means mouth/limbs/eyes (drawn with
    // plain setDot further below) always win over it too, so it's safe to
    // make this generously large without any risk of covering the face.
    // Reacts to the pet's own movement — capeWindX/capeWindY are the
    // OPPOSITE of its travel direction (see setPetTarget() in app.js), so
    // it trails behind like real cloth caught in the air: pet moves left ->
    // wind blows the cape right, pet moves up -> cape drapes longer/lower
    // behind it, pet moves down -> cape tucks shorter, blown up against the
    // back. No outline ring on cape dots (see the body-check further down)
    // — it's cloth, not a body part, and the ring read heavy at this scale.
    const row = profile.startRow + profile.cape.rowOffset;
    const flutter = frame % 2 === 1 ? 1 : 0;
    const depth = capeWindY > 0 ? 8 : capeWindY < 0 ? 5 : 6;
    for (let dr = -1; dr < depth; dr++) {
      const spread = 3 + Math.floor(dr / 2); // widens as it falls
      const bias = capeWindX ? capeWindX * (2 + dr) : 0; // leans hard toward the wind, growing with distance
      const extra = dr === depth - 1 && capeWindX === 0 ? flutter : 0;
      for (let col = -spread - extra; col <= spread + extra; col++) {
        setDotBehind(grid, row + dr, CX + bias + col, 5);
      }
    }
  }

  if (profile.mouth) {
    const row = profile.startRow + profile.mouth.rowOffset;
    for (const off of profile.mouth.colOffsets) setDot(grid, row, CX + off, 2);
  }

  if (profile.limbFrames) {
    const limbs = profile.limbFrames[frame % profile.limbFrames.length];
    for (const limb of limbs) {
      const row = profile.startRow + limb.rowOffset;
      for (const off of limb.colOffsets) setDot(grid, row, CX + off, 1);
    }
  }

  // Secondary motion beyond the legs (wing flaps, ear wiggles) — same
  // frame-indexed shape as limbFrames, kept separate since not every
  // species has something here (turtles just walk).
  if (profile.animFrames) {
    const parts = profile.animFrames[frame % profile.animFrames.length];
    for (const part of parts) {
      const row = profile.startRow + part.rowOffset;
      for (const off of part.colOffsets) setDot(grid, row, CX + off, 1);
    }
  }

  if (profile.eyes) {
    const rows = profile.eyes.rows || [0];
    if (eyesOpen) {
      for (const dr of rows) {
        const row = profile.startRow + profile.eyes.rowOffset + dr;
        setDot(grid, row, CX - profile.eyes.colOffset, 2);
        setDot(grid, row, CX + profile.eyes.colOffset, 2);
      }
    } else {
      // Closed eyes read as a short "-" dash (a closed eyelid crease)
      // instead of just vanishing — centered on the open eye's own row.
      // Capped so the two dashes never meet in the middle when the eyes
      // themselves sit close together.
      const halfDash = Math.min(1, profile.eyes.colOffset - 1);
      const row = profile.startRow + profile.eyes.rowOffset + rows[Math.floor((rows.length - 1) / 2)];
      for (const side of [-1, 1]) {
        const cx = CX + side * profile.eyes.colOffset;
        for (let off = -halfDash; off <= halfDash; off++) setDot(grid, row, cx + off, 2);
      }
    }
  }

  if (profile.sparkle && variant === "pristine") {
    const row = profile.startRow + profile.sparkle.rowOffset;
    for (const off of profile.sparkle.colOffsets) setDot(grid, row, CX + off, 2);
  }

  outlineSilhouette(grid);
  return grid;
}

// Every sprite is drawn on a fixed 25x25 grid, but each stage/species only
// occupies a small, differently-positioned region of it (silhouettes are
// hand-placed around a shared center column, not centered in the full
// grid). Rendering the full 25x25 grid in a fixed-size box — as every
// static preview does — makes the creature look off-center in that box.
// This trims the grid down to just its occupied rows/columns so a preview
// box only needs to center the trimmed result, not fight the dead space.
export function trimBitmap(grid) {
  let minRow = GRID_SIZE;
  let maxRow = -1;
  let minCol = GRID_SIZE;
  let maxCol = -1;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] === 0) continue;
      if (r < minRow) minRow = r;
      if (r > maxRow) maxRow = r;
      if (c < minCol) minCol = c;
      if (c > maxCol) maxCol = c;
    }
  }
  if (maxRow < 0) return { rows: [], width: 0, height: 0 };
  const rows = [];
  for (let r = minRow; r <= maxRow; r++) rows.push(grid[r].slice(minCol, maxCol + 1));
  return { rows, width: maxCol - minCol + 1, height: maxRow - minRow + 1 };
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
          if (grid[r][c] === 1 || grid[r][c] === 2 || grid[r][c] === 4) {
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
