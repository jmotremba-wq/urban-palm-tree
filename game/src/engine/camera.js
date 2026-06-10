// camera.js
// A camera that centers on a target (the hero) and clamps to the room bounds
// so it never reveals past the edge of a small room. Rooms exactly the size of
// the viewport keep the camera at 0,0 (a static, single-screen feel).

import { TILE, VIEW_W, VIEW_H } from "./canvas.js";

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
  }

  follow(target, room) {
    const viewW = VIEW_W * TILE;
    const viewH = VIEW_H * TILE;
    const cx = target.x + TILE / 2;
    const cy = target.y + TILE / 2;
    this.x = clamp(cx - viewW / 2, 0, Math.max(0, room.pixelW - viewW));
    this.y = clamp(cy - viewH / 2, 0, Math.max(0, room.pixelH - viewH));
  }
}

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}
