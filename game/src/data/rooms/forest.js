// forest.js — the push-block puzzle room.
// A crate sits at the bottom of a narrow vertical shaft. Stand below it in the
// corridor and push it UP onto the round button (switch) — that's the only way
// it can go (the shaft is capped above and walled on both sides), so the puzzle
// can never be wedged into an unsolvable state, and the corridor stays clear.
// Pressing the switch opens the door on the right, revealing the way to the cave.

export default {
  id: "forest",
  name: "Whispering Forest",
  tileSize: 16,
  legend: { ".": "grass", "#": "tree", "f": "flower" },
  tiles: [
    "################",
    "#...#..........#", // (4,1) caps the shaft so the crate can't be over-pushed
    "#..#.#....f....#", // switch sits at (4,2); trees at x3/x5 wall the shaft
    "#..#.#.........#",
    "#..#.#....f....#",
    "#..#.#.........#", // crate starts at (4,5), just above the corridor
    "................", // corridor: left -> meadow, right -> cave (past the door)
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "################",
  ],
  exits: [
    { x: 0, y: 6, to: "meadow", spawn: "fromForest" },
    { x: 15, y: 6, to: "cave", spawn: "fromForest" },
  ],
  spawns: {
    fromMeadow: { x: 1, y: 6, facing: "right" },
    fromCave: { x: 14, y: 6, facing: "left" },
  },
  entities: [
    { type: "block", x: 4, y: 5 },
    { type: "switch", x: 4, y: 2, targets: ["forest_door"] },
    { type: "door", x: 13, y: 6, id: "forest_door", needs: "switch" },
    { type: "sign", x: 8, y: 4, dialog: "sign_forest" },
    { type: "acorn", x: 2, y: 2 },
    { type: "acorn", x: 11, y: 3 },
    { type: "acorn", x: 8, y: 8 },
  ],
};
