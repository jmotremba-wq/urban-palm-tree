// room.js
// Wraps a room-data object: parses the tile grid, builds runtime entities, and
// applies persisted progress (collected pickups stay gone; key-doors stay
// open). Provides tile lookups used by collision and rendering.

import { makeEntity, isPickup } from "./entities.js";
import { TILES } from "../data/tiles.js";
import { state } from "../state/save.js";

export class Room {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.tileSize = data.tileSize || 16;
    this.legend = data.legend;
    this.tiles = data.tiles;
    this.rows = data.tiles.length;
    this.cols = data.tiles[0].length;
    this.pixelW = this.cols * this.tileSize;
    this.pixelH = this.rows * this.tileSize;
    this.exits = data.exits || [];
    this.spawns = data.spawns || {};

    this.entities = [];
    for (const def of data.entities || []) {
      if (isPickup(def.type)) {
        const key = `${this.id}:${def.type}:${def.x},${def.y}`;
        if (state.collected[key]) continue; // already picked up
      }
      const e = makeEntity(def, this.tileSize);
      if (e.type === "door" && e.needs === "key" && state.doors[e.id] === "open") {
        e.open = true;
      }
      this.entities.push(e);
    }
  }

  tileName(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return "wall";
    const ch = this.tiles[ty][tx];
    return this.legend[ch] || "grass";
  }

  isSolidTile(tx, ty) {
    const t = TILES[this.tileName(tx, ty)];
    return !t || t.solid;
  }
}
