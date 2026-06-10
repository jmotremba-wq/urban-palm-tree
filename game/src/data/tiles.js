// tiles.js
// The tile table: tile NAME -> visual color + properties. Room files map their
// single-character grid keys to these names via a per-room `legend`. To add a
// new kind of ground or obstacle, add an entry here and reference it from a
// room's legend.

export const TILES = {
  grass: { color: "#7bc86c", solid: false },
  tree: { color: "#2e6b3e", solid: true },
  water: { color: "#4a90c2", solid: true }, // impassable, but not deadly
  flower: { color: "#7bc86c", solid: false }, // grass base; a blossom is drawn on top
  bridge: { color: "#a9743b", solid: false },
  cavefloor: { color: "#5a5752", solid: false },
  wall: { color: "#37343b", solid: true },
  dirt: { color: "#8a6a44", solid: false },
};
