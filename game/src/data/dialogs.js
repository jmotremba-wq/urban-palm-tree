// dialogs.js
// Named dialog scripts. Each id maps to an array of short, friendly lines shown
// one page at a time. Keep lines to 1-2 short sentences. NPCs and signs in the
// room files reference these by id (and optionally a shorter `dialogRepeat`).

export const DIALOGS = {
  rabbit_greet: [
    "Hi there, little fox!",
    "I dropped my acorns all over the woods.",
    "Can you help me find them?",
    "Press SPACE to talk, read signs, and push blocks.",
  ],
  rabbit_repeat: ["Thank you for helping, little fox!"],

  sign_meadow: [
    "~ Sunny Meadow ~",
    "Arrow keys or WASD to walk. SPACE to read and talk.",
  ],
  sign_forest: [
    "~ Whispering Forest ~",
    "Stand below the crate and push it UP onto the round button!",
  ],
  sign_cave: [
    "~ Cozy Cave ~",
    "A golden door waits ahead. Find a key to open it!",
  ],

  owl_congrats: [
    "Hoo! You found the Hidden Hollow!",
    "What a brave and clever little fox you are.",
    "Thank you for helping all the woodland friends.",
    "The end... for now!",
  ],

  door_locked: ["It's locked tight.", "Maybe a key would help."],
  door_unlock: ["You used a key!", "The door creaks open."],
};
