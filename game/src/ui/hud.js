// hud.js
// Draws the heads-up display (hearts, acorns, keys) into the #hud DOM overlay.
// DOM rather than canvas so it's easy to restyle in game.css.

let el = null;

export function drawHud(state) {
  if (!el) el = document.getElementById("hud");
  if (!el) return;

  const inv = state.inventory;
  let hearts = "";
  for (let i = 0; i < inv.maxHearts; i++) {
    hearts += i < inv.hearts ? "❤️" : "\u{1F90D}";
  }

  el.innerHTML =
    `<span class="hud-hearts">${hearts}</span>` +
    `<span class="hud-item">\u{1F330} ${inv.acorns}</span>` +
    `<span class="hud-item">\u{1F511} ${inv.keys}</span>`;
}
