// meadow.js — the starting room. See AUTHORING.md to make your own!
// `tiles` is drawn like ASCII art; each character is looked up in `legend`.
// Entity x/y are tile coordinates (0,0 is top-left).

export default {
  id: "meadow",
  name: "Sunny Meadow",
  tileSize: 16,
  legend: { ".": "grass", "#": "tree", "~": "water", "f": "flower" },
  tiles: [
    "################",
    "#..............#",
    "#...f......f...#",
    "#..............#",
    "#.....~~~......#",
    "#.....~~~......#",
    "#...............", // opening on the right edge -> exit to the forest
    "#..............#",
    "#..............#",
    "#......f.......#",
    "#..............#",
    "################",
  ],
  exits: [{ x: 15, y: 6, to: "forest", spawn: "fromMeadow" }],
  spawns: {
    start: { x: 7, y: 6, facing: "down" },
    fromForest: { x: 14, y: 6, facing: "left" },
  },
  entities: [
    { type: "npc", x: 5, y: 8, sprite: "rabbit", dialog: "rabbit_greet", dialogRepeat: "rabbit_repeat" },
    { type: "sign", x: 10, y: 8, dialog: "sign_meadow" },
    { type: "acorn", x: 3, y: 3 },
    { type: "acorn", x: 12, y: 3 },
    { type: "acorn", x: 7, y: 7 },
    { type: "acorn", x: 13, y: 9 },
  ],
};
