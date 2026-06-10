// collision.js
// Movement, push-blocks, and switch/door logic. Movement resolves one axis at a
// time (move-and-slide) so the hero slides along walls instead of sticking.
// Blocks snap to the grid so switch puzzles stay exact.

import { TILE } from "../engine/canvas.js";
import { state } from "../state/save.js";

// Attempt to move entity `e` by (dx, dy) along a single axis. Returns true if it
// moved. If the hero walks into a pushable block, tries to push it first.
export function moveAxis(e, dx, dy, room, game) {
  const nx = e.x + dx;
  const ny = e.y + dy;
  const box = { x: nx + e.ox, y: ny + e.oy, w: e.w, h: e.h };

  if (collidesTiles(box, room)) return false;

  const blocker = solidEntityAt(box, room, e);
  if (blocker) {
    if (e.isHero && blocker.pushable) {
      const pushed = tryPushBlock(blocker, Math.sign(dx), Math.sign(dy), room);
      if (!pushed) return false;
      if (solidEntityAt(box, room, e)) return false; // still blocked somehow
    } else {
      return false;
    }
  }

  e.x = nx;
  e.y = ny;
  return true;
}

function collidesTiles(box, room) {
  const x0 = Math.floor(box.x / TILE);
  const x1 = Math.floor((box.x + box.w - 1) / TILE);
  const y0 = Math.floor(box.y / TILE);
  const y1 = Math.floor((box.y + box.h - 1) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (room.isSolidTile(tx, ty)) return true;
    }
  }
  return false;
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function solidEntityAt(box, room, self) {
  for (const e of room.entities) {
    if (e === self || e.removed || !e.solid) continue;
    if (e.type === "door" && e.open) continue;
    const eb = { x: e.x + e.ox, y: e.y + e.oy, w: e.w, h: e.h };
    if (overlap(box, eb)) return e;
  }
  return null;
}

function tryPushBlock(block, sx, sy, room) {
  if (block.pushCd > 0) return false;
  if (sx === 0 && sy === 0) return false;
  const ntx = block.tx + sx;
  const nty = block.ty + sy;
  if (room.isSolidTile(ntx, nty)) return false;
  for (const e of room.entities) {
    if (e === block || e.removed) continue;
    if (e.solid && e.tx === ntx && e.ty === nty && !(e.type === "door" && e.open)) {
      return false; // destination occupied by another solid
    }
  }
  block.tx = ntx;
  block.ty = nty;
  block.x = ntx * TILE;
  block.y = nty * TILE;
  block.pushCd = 0.16; // brief cooldown -> deliberate, one-tile-at-a-time pushing
  return true;
}

// Recompute switches (pressed by hero or a block) and doors (switch-driven or
// key-driven) every step.
export function evaluateMechanisms(room, game) {
  const heroT = game.heroTile();

  for (const e of room.entities) {
    if (e.type === "block" && e.pushCd > 0) {
      e.pushCd = Math.max(0, e.pushCd - game.dt);
    }
  }

  for (const s of room.entities) {
    if (s.type !== "switch") continue;
    let pressed = heroT.tx === s.tx && heroT.ty === s.ty;
    if (!pressed) {
      for (const b of room.entities) {
        if (b.type === "block" && b.tx === s.tx && b.ty === s.ty) {
          pressed = true;
          break;
        }
      }
    }
    s.pressed = pressed;
  }

  for (const d of room.entities) {
    if (d.type !== "door") continue;
    if (d.needs === "switch") {
      const controlling = room.entities.filter(
        (s) => s.type === "switch" && s.targets.includes(d.id)
      );
      d.open = controlling.length > 0 && controlling.every((s) => s.pressed);
    } else if (d.needs === "key") {
      d.open = state.doors[d.id] === "open";
    }
  }
}
