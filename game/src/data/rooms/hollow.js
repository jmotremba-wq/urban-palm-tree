// hollow.js — the reward room. A friendly owl congratulates the hero, with a
// few last acorns to gather.

export default {
  id: "hollow",
  name: "Hidden Hollow",
  tileSize: 16,
  legend: { ".": "grass", "#": "tree", "~": "water", "f": "flower" },
  tiles: [
    "################",
    "#....f....f....#",
    "#..............#",
    "#.....~~~~.....#",
    "#.....~~~~.....#",
    "#..............#",
    "...............#", // opening on the left edge -> back to the cave
    "#..............#",
    "#....f....f....#",
    "#..............#",
    "#..............#",
    "################",
  ],
  exits: [{ x: 0, y: 6, to: "cave", spawn: "fromHollow" }],
  spawns: {
    fromCave: { x: 1, y: 6, facing: "right" },
  },
  entities: [
    { type: "npc", x: 8, y: 5, sprite: "owl", dialog: "owl_congrats" },
    { type: "acorn", x: 3, y: 7 },
    { type: "acorn", x: 12, y: 7 },
    { type: "acorn", x: 7, y: 9 },
    { type: "acorn", x: 9, y: 9 },
  ],
};
