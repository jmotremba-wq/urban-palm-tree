// canvas.js
// Canvas setup and the core dimensions shared across the engine. The world is
// drawn at a small fixed internal resolution; game.css scales it up with crisp
// pixels. One tile is 16px; the viewport is 16x12 tiles (256x192).

export const TILE = 16;
export const VIEW_W = 16; // tiles
export const VIEW_H = 12; // tiles

export function setupCanvas(canvas) {
  canvas.width = VIEW_W * TILE; // 256
  canvas.height = VIEW_H * TILE; // 192
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  return ctx;
}
