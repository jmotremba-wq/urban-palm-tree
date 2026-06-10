// cave.js — the key-and-locked-door puzzle room.
// Grab the key, then face the golden door and press SPACE to unlock it. Beyond
// lies the Hidden Hollow.

export default {
  id: "cave",
  name: "Cozy Cave",
  tileSize: 16,
  legend: { ".": "cavefloor", "#": "wall" },
  tiles: [
    "################",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "................", // corridor: left -> forest, right -> hollow (past the door)
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "################",
  ],
  exits: [
    { x: 0, y: 6, to: "forest", spawn: "fromCave" },
    { x: 15, y: 6, to: "hollow", spawn: "fromCave" },
  ],
  spawns: {
    fromForest: { x: 1, y: 6, facing: "right" },
    fromHollow: { x: 14, y: 6, facing: "left" },
  },
  entities: [
    { type: "key", x: 8, y: 3 },
    { type: "door", x: 13, y: 6, id: "cave_door", needs: "key" },
    { type: "sign", x: 3, y: 3, dialog: "sign_cave" },
    { type: "acorn", x: 5, y: 8 },
    { type: "acorn", x: 11, y: 9 },
  ],
};
