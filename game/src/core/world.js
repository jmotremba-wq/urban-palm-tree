// world.js
// The room registry. To add a new room: create a file under data/rooms/, import
// it here, and add it to ROOMS keyed by its id. That's the only wiring step —
// exits in the room data reference other rooms by these ids.

import meadow from "../data/rooms/meadow.js";
import forest from "../data/rooms/forest.js";
import cave from "../data/rooms/cave.js";
import hollow from "../data/rooms/hollow.js";

export const ROOMS = {
  meadow,
  forest,
  cave,
  hollow,
};
