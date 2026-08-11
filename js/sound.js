// Tiny synthesized sound effects — no audio files, just short oscillator
// blips. Keeps the app at zero extra asset weight and matches the rest of
// the project's "no build step, no external assets" approach.

let ctx;
function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq, startTime, duration, type = "sine", peakGain = 0.15) {
  const audioCtx = getCtx();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = audioCtx.currentTime + startTime;
  gain.gain.setValueAtTime(peakGain, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + duration);
}

const SOUND_KEY = "pocketpet_sound_enabled";

export function soundEnabled() {
  return localStorage.getItem(SOUND_KEY) !== "0";
}

export function setSoundEnabled(on) {
  localStorage.setItem(SOUND_KEY, on ? "1" : "0");
}

const CLIPS = {
  feed: () => { tone(520, 0, 0.12); tone(720, 0.08, 0.12); },
  clean: () => { tone(900, 0, 0.08, "triangle", 0.1); tone(1200, 0.06, 0.08, "triangle", 0.1); },
  play: () => { tone(600, 0, 0.1); tone(800, 0.09, 0.1); tone(1000, 0.18, 0.12); },
  sleep: () => tone(400, 0, 0.3, "sine", 0.08),
  wake: () => tone(520, 0, 0.15),
  medicine: () => { tone(700, 0, 0.1, "square", 0.08); tone(500, 0.1, 0.1, "square", 0.08); },
  hatch: () => { tone(440, 0, 0.15); tone(660, 0.13, 0.15); tone(880, 0.26, 0.2); },
  evolve: () => { tone(523, 0, 0.12); tone(659, 0.1, 0.12); tone(784, 0.2, 0.12); tone(1046, 0.3, 0.2); },
  poke: () => tone(300, 0, 0.06, "square", 0.08),
  coin: () => { tone(988, 0, 0.06, "square", 0.09); tone(1318, 0.05, 0.08, "square", 0.09); },
};

export function playSound(name) {
  if (!soundEnabled() || !CLIPS[name]) return;
  try {
    CLIPS[name]();
  } catch {
    // Audio unavailable (autoplay policy, unsupported browser) — skip silently.
  }
}
