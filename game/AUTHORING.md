# Make your own room 🛠️

Adding a new place to explore takes three steps. You draw the room like a
picture made of letters, then tell the game about it. Great to do together!

## 1. Copy a room file

Look in `src/data/rooms/`. Copy `meadow.js` to a new file, like
`river.js`. Open your new file and change the `id` and `name`:

```js
export default {
  id: "river",        // a short nickname, all lowercase, no spaces
  name: "Sparkly River",
  tileSize: 16,
  legend: { ".": "grass", "#": "tree", "~": "water", "f": "flower" },
  tiles: [ ... ],
};
```

## 2. Draw the room

The `tiles` are 16 letters wide and 12 rows tall. Each letter is one square:

| Letter | What it is        |
| ------ | ----------------- |
| `.`    | grass (walkable)  |
| `#`    | tree (a wall)     |
| `~`    | water (can't cross)|
| `f`    | a flower          |

(These come from `legend` — you can add your own! See the tile names in
`src/data/tiles.js`, e.g. `cavefloor`, `bridge`, `dirt`.)

Draw walls (`#`) around the edges so the fox can't wander off — but leave a
**gap** where you want a doorway to another room.

## 3. Add doors, items, and friends

- **Spawns** are where the fox appears when entering. `start` is the very first
  spot of the whole game.
- **Exits** send the fox to another room when she steps on that square:
  ```js
  exits: [{ x: 15, y: 6, to: "meadow", spawn: "fromRiver" }],
  ```
- **Entities** are the things in the room. `x` and `y` are which square (0 is
  the left/top). Try:
  ```js
  entities: [
    { type: "acorn", x: 4, y: 3 },                     // collect it!
    { type: "npc", x: 8, y: 5, sprite: "rabbit",       // a friend to talk to
      dialog: "rabbit_greet" },
    { type: "sign", x: 2, y: 4, dialog: "sign_meadow" },
    { type: "block", x: 6, y: 6 },                     // a crate to push
    { type: "switch", x: 6, y: 8, targets: ["my_door"] },
    { type: "door", x: 10, y: 6, id: "my_door", needs: "switch" },
    { type: "key", x: 9, y: 2 },
    { type: "door", x: 11, y: 6, id: "gold_door", needs: "key" },
  ],
  ```

### Writing what they say

Open `src/data/dialogs.js` and add your own lines:

```js
my_hello: ["Hi friend!", "Welcome to the river."],
```

Then point an `npc` or `sign` at it with `dialog: "my_hello"`.

## 4. Tell the game about your room

Open `src/data/../core/world.js` (`src/core/world.js`) and add two lines:

```js
import river from "../data/rooms/river.js";   // at the top

export const ROOMS = {
  meadow,
  forest,
  cave,
  hollow,
  river,                                        // add it here
};
```

Now make an exit in another room point `to: "river"`, and an exit in `river`
point back. Refresh the page — your new room is in the game! 🎉

## Tips

- Keep the grid exactly 16 wide and 12 tall to start.
- A `switch` opens a `door` when its `targets` list contains that door's `id`.
- A push-`block` that lands on a `switch` holds it down — great for puzzles.
- Stuck? Compare your file to `meadow.js` line by line.
