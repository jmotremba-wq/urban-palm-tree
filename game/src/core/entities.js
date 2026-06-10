// entities.js
// Turns a room-data entry (tile coordinates + type) into a runtime entity
// (pixel coordinates + behavior flags). A lightweight type-tagged model rather
// than a full ECS: each entity is a plain object whose flags drive collision,
// pickups, and interaction. The hero is created separately in game.js but uses
// the same shape, so combat (hp/attack) could be bolted on later.

const PICKUPS = ["acorn", "key", "heart", "tool"];
const SOLID = ["block", "door", "npc", "sign"];

export function makeEntity(def, ts) {
  const e = {
    type: def.type,
    tx: def.x,
    ty: def.y,
    x: def.x * ts,
    y: def.y * ts,
    w: ts,
    h: ts,
    ox: 0,
    oy: 0,
    removed: false,
  };

  e.solid = SOLID.includes(def.type);
  e.pushable = def.type === "block";
  e.pickup = PICKUPS.includes(def.type);

  if (def.type === "block") e.pushCd = 0;
  if (def.type === "switch") {
    e.solid = false;
    e.pressed = false;
    e.targets = def.targets || [];
  }
  if (def.type === "door") {
    e.id = def.id;
    e.needs = def.needs; // "switch" | "key"
    e.open = false;
  }
  if (def.type === "npc" || def.type === "sign") {
    e.dialog = def.dialog;
    e.dialogRepeat = def.dialogRepeat;
    e.sprite = def.sprite;
  }
  if (def.type === "tool") e.sprite = def.sprite; // tool id, e.g. "lantern"

  return e;
}

export function isPickup(type) {
  return PICKUPS.includes(type);
}
