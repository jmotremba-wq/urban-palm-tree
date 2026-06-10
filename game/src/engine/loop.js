// loop.js
// Fixed-timestep game loop. Update runs in discrete STEP-sized slices so that
// grid movement, push-blocks, and switches behave identically regardless of
// frame rate, and a slow frame can never tunnel the hero through a wall.

export const STEP = 1 / 60; // seconds per simulation step

export function startLoop({ update, render }) {
  let last = performance.now();
  let acc = 0;

  function frame(now) {
    // Clamp huge gaps (e.g. the tab was backgrounded) so we don't spiral.
    acc += Math.min((now - last) / 1000, 0.25);
    last = now;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    render();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
