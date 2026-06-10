// input.js
// Keyboard input abstracted into named actions. Movement reads isDown(); the
// single "action" button reads wasPressed() (true for exactly one update).
// Keys map to actions through ACTIONS, so on-screen touch controls can be
// added later by flipping the same action flags — nothing else changes.

const ACTIONS = {
  up: ["ArrowUp", "w", "W"],
  down: ["ArrowDown", "s", "S"],
  left: ["ArrowLeft", "a", "A"],
  right: ["ArrowRight", "d", "D"],
  action: [" ", "Enter", "e", "E"],
};

export class Input {
  constructor() {
    this.held = new Set();
    this.pressed = new Set(); // edge: actions that went down this update

    window.addEventListener("keydown", (e) => {
      const a = actionFor(e.key);
      if (!a) return;
      if (!this.held.has(a)) this.pressed.add(a);
      this.held.add(a);
      e.preventDefault();
    });

    window.addEventListener("keyup", (e) => {
      const a = actionFor(e.key);
      if (!a) return;
      this.held.delete(a);
      e.preventDefault();
    });
  }

  isDown(action) {
    return this.held.has(action);
  }

  wasPressed(action) {
    return this.pressed.has(action);
  }

  // Call once at the end of each update to clear edge-triggered presses.
  consume() {
    this.pressed.clear();
  }
}

function actionFor(key) {
  for (const a in ACTIONS) {
    if (ACTIONS[a].includes(key)) return a;
  }
  return null;
}
