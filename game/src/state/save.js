// save.js
// Single source-of-truth game state with localStorage persistence, modeled on
// the repo's existing state.js. Import `state` and mutate it directly, then
// call save() (debounced) or saveNow() (immediate). hydrate() forward-merges a
// saved blob over fresh defaults so new fields appear for older saves.

const STORAGE_KEY = "animalAdventure_v1";

function seedDefaults() {
  return {
    mode: "title", // title | play
    hero: { room: "meadow", spawn: "start", facing: "down" },
    inventory: { hearts: 3, maxHearts: 3, acorns: 0, keys: 0, tools: [] },
    collected: {}, // "meadow:acorn:3,3": true — picked-up items stay gone
    doors: {}, // "cave_door": "open" — persistently opened (key) doors
    switches: {}, // reserved for persistent switch puzzles
    talkedTo: {}, // "rabbit_greet": true — first-meet vs repeat lines
    settings: { muted: false },
  };
}

function hydrate(saved, defaults) {
  if (!saved || typeof saved !== "object") return defaults;
  return {
    ...defaults,
    ...saved,
    hero: { ...defaults.hero, ...(saved.hero || {}) },
    inventory: { ...defaults.inventory, ...(saved.inventory || {}) },
    collected: { ...(saved.collected || {}) },
    doors: { ...(saved.doors || {}) },
    switches: { ...(saved.switches || {}) },
    talkedTo: { ...(saved.talkedTo || {}) },
    settings: { ...defaults.settings, ...(saved.settings || {}) },
  };
}

export function load() {
  const defaults = seedDefaults();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    return hydrate(JSON.parse(raw), defaults);
  } catch (err) {
    console.warn("Failed to read save, seeding defaults:", err);
    return defaults;
  }
}

// True if a real save existed when the page loaded (enables "Continue").
export const hadSave = !!safeGet(STORAGE_KEY);

// The live state object. Import this and mutate it directly.
export const state = load();

function writeNow() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("Failed to persist save:", err);
  }
}

// Debounced (~300ms) persistence for frequent updates.
export const save = debounce(writeNow, 300);

// Immediate persistence for structural changes (room change, pickups, doors).
export const saveNow = writeNow;

// Wipe progress back to defaults (New Game). Mutates `state` in place so all
// existing imports keep pointing at the same object.
export function resetState() {
  const d = seedDefaults();
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, d);
  writeNow();
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
