// interaction.js
// The single "action button" resolver. When the player presses SPACE in play
// mode, look at the tile directly in front of the hero and act on whatever is
// there: talk to an NPC, read a sign, or unlock a key-door.

import { state, saveNow } from "../state/save.js";

const DIR = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export function tryInteract(game) {
  const h = game.heroTile();
  const [dx, dy] = DIR[game.hero.facing] || [0, 1];
  const tx = h.tx + dx;
  const ty = h.ty + dy;

  for (const e of game.room.entities) {
    if (e.removed || e.tx !== tx || e.ty !== ty) continue;

    if (e.type === "npc" || e.type === "sign") {
      const first = !state.talkedTo[e.dialog];
      const id = !first && e.dialogRepeat ? e.dialogRepeat : e.dialog;
      if (first) {
        state.talkedTo[e.dialog] = true;
        saveNow();
      }
      game.openDialog(id);
      return true;
    }

    if (e.type === "door" && e.needs === "key" && !e.open) {
      if (state.inventory.keys > 0) {
        state.inventory.keys--;
        state.doors[e.id] = "open";
        e.open = true;
        saveNow();
        game.openDialog("door_unlock");
      } else {
        game.openDialog("door_locked");
      }
      return true;
    }
  }
  return false;
}
