// dialog.js
// A simple text-box with a typewriter reveal, rendered into the #dialog DOM
// overlay. open() queues lines; update() reveals characters over time; advance()
// (the action button) completes the current line or moves to the next, closing
// when the queue is empty.

const CHARS_PER_SEC = 1 / 0.025; // ~40 chars/sec

export class Dialog {
  constructor() {
    this.box = document.getElementById("dialog");
    this.textEl = document.getElementById("dialog-text");
    this.moreEl = this.box ? this.box.querySelector(".dialog-more") : null;
    this.lines = [];
    this.idx = 0;
    this.shown = 0;
    this.timer = 0;
    this.active = false;
  }

  open(lines) {
    this.lines = (lines || []).slice();
    this.idx = 0;
    this.shown = 0;
    this.timer = 0;
    this.active = this.lines.length > 0;
    if (this.box) this.box.classList.toggle("show", this.active);
    this.render();
  }

  update(dt) {
    if (!this.active) return;
    const full = this.lines[this.idx] || "";
    if (this.shown < full.length) {
      this.timer += dt;
      while (this.timer > 0.025 && this.shown < full.length) {
        this.shown++;
        this.timer -= 0.025;
      }
      this.render();
    }
  }

  // Triggered by the action button: finish the line, else advance / close.
  advance() {
    if (!this.active) return;
    const full = this.lines[this.idx] || "";
    if (this.shown < full.length) {
      this.shown = full.length;
      this.render();
      return;
    }
    this.idx++;
    this.shown = 0;
    if (this.idx >= this.lines.length) {
      this.close();
    } else {
      this.render();
    }
  }

  render() {
    if (!this.textEl) return;
    const full = this.lines[this.idx] || "";
    this.textEl.textContent = full.slice(0, this.shown);
    if (this.moreEl) {
      this.moreEl.style.visibility = this.shown >= full.length ? "visible" : "hidden";
    }
  }

  close() {
    this.active = false;
    if (this.box) this.box.classList.remove("show");
  }
}
