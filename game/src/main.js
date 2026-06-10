// main.js
// Bootstrap: build the Game once the DOM is ready and start the loop. Mirrors
// the repo's readyState-guarded init pattern.

import { Game } from "./core/game.js";

function init() {
  const canvas = document.getElementById("game");
  const game = new Game(canvas);
  game.start();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
