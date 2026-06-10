// game.js
// The central Game class: owns the canvas, input, camera, current room, hero,
// dialog, and the current mode (title | play | dialog). Drives update and
// render each frame and ties every subsystem together.

import { setupCanvas, TILE, VIEW_W, VIEW_H } from "../engine/canvas.js";
import { startLoop, STEP } from "../engine/loop.js";
import { Input } from "../engine/input.js";
import { Camera } from "../engine/camera.js";
import { drawSprite, COLORS } from "../engine/assets.js";
import { Room } from "./room.js";
import { ROOMS } from "./world.js";
import { moveAxis, evaluateMechanisms } from "./collision.js";
import { tryInteract } from "./interaction.js";
import { TILES } from "../data/tiles.js";
import { DIALOGS } from "../data/dialogs.js";
import { Dialog } from "../ui/dialog.js";
import { drawHud } from "../ui/hud.js";
import { setupTitle } from "../ui/titlescreen.js";
import { state, saveNow, resetState, hadSave } from "../state/save.js";

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.dt = STEP;
    this.mode = "title";
  }

  start() {
    this.ctx = setupCanvas(this.canvas);
    this.input = new Input();
    this.camera = new Camera();
    this.dialog = new Dialog();

    this.hero = {
      type: "hero",
      isHero: true,
      x: 0,
      y: 0,
      w: 12,
      h: 12,
      ox: 2,
      oy: 2,
      facing: "down",
      speed: 70, // pixels per second
      moving: false,
    };

    this.title = setupTitle({
      hadSave,
      onNew: () => this.beginPlay("new"),
      onContinue: () => this.beginPlay("continue"),
    });
    this.title.show();

    startLoop({
      update: (dt) => this.update(dt),
      render: () => this.render(),
    });
  }

  beginPlay(kind) {
    if (kind === "new") resetState();
    state.mode = "play";
    saveNow();
    this.title.hide();
    this.mode = "play";
    this.enterRoom(state.hero.room, state.hero.spawn);
  }

  enterRoom(id, spawnName) {
    this.room = new Room(ROOMS[id]);
    const sp =
      this.room.spawns[spawnName] ||
      this.room.spawns.start ||
      { x: 1, y: 1, facing: "down" };
    this.hero.x = sp.x * TILE;
    this.hero.y = sp.y * TILE;
    this.hero.facing = sp.facing || "down";
    state.hero.room = id;
    state.hero.spawn = spawnName;
    state.hero.facing = this.hero.facing;
    saveNow();
    this.camera.follow(this.hero, this.room);
  }

  openDialog(id) {
    const lines = DIALOGS[id] || ["..."];
    this.dialog.open(lines);
    this.mode = "dialog";
  }

  // ---- center tile of the hero -------------------------------------------
  heroTile() {
    return {
      tx: Math.floor((this.hero.x + TILE / 2) / TILE),
      ty: Math.floor((this.hero.y + TILE / 2) / TILE),
    };
  }

  // ---- update ------------------------------------------------------------
  update(dt) {
    this.dt = dt;

    if (this.mode === "title") {
      if (this.input.wasPressed("action")) {
        this.beginPlay(hadSave ? "continue" : "new");
      }
      this.input.consume();
      return;
    }

    if (this.mode === "dialog") {
      this.dialog.update(dt);
      if (this.input.wasPressed("action")) this.dialog.advance();
      if (!this.dialog.active) this.mode = "play";
      this.input.consume();
      return;
    }

    // play
    this.updateHero();
    evaluateMechanisms(this.room, this);
    this.checkPickups();
    if (this.input.wasPressed("action")) tryInteract(this);
    this.checkExits();
    this.camera.follow(this.hero, this.room);
    this.input.consume();
  }

  updateHero() {
    let dx = 0;
    let dy = 0;
    if (this.input.isDown("left")) dx -= 1;
    if (this.input.isDown("right")) dx += 1;
    if (this.input.isDown("up")) dy -= 1;
    if (this.input.isDown("down")) dy += 1;

    const sp = this.hero.speed * this.dt;
    if (dx) this.hero.facing = dx < 0 ? "left" : "right";
    if (dy) this.hero.facing = dy < 0 ? "up" : "down"; // vertical wins ties

    if (dx) moveAxis(this.hero, dx * sp, 0, this.room, this);
    if (dy) moveAxis(this.hero, 0, dy * sp, this.room, this);
    this.hero.moving = !!(dx || dy);
  }

  checkPickups() {
    const hb = {
      x: this.hero.x + this.hero.ox,
      y: this.hero.y + this.hero.oy,
      w: this.hero.w,
      h: this.hero.h,
    };
    for (const e of this.room.entities) {
      if (e.removed || !e.pickup) continue;
      if (overlap(hb, { x: e.x, y: e.y, w: e.w, h: e.h })) this.collect(e);
    }
  }

  collect(e) {
    const inv = state.inventory;
    if (e.type === "acorn") inv.acorns++;
    else if (e.type === "key") inv.keys++;
    else if (e.type === "heart") inv.hearts = Math.min(inv.maxHearts, inv.hearts + 1);
    else if (e.type === "tool" && !inv.tools.includes(e.sprite)) inv.tools.push(e.sprite);

    state.collected[`${this.room.id}:${e.type}:${e.tx},${e.ty}`] = true;
    e.removed = true;
    saveNow();
  }

  checkExits() {
    const h = this.heroTile();
    for (const ex of this.room.exits) {
      if (ex.x === h.tx && ex.y === h.ty) {
        this.enterRoom(ex.to, ex.spawn);
        return;
      }
    }
  }

  // ---- render ------------------------------------------------------------
  render() {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, VIEW_W * TILE, VIEW_H * TILE);

    if (this.mode === "title" || !this.room) return;

    this.drawRoom(ctx);
    drawHud(state);
  }

  drawRoom(ctx) {
    const cam = this.camera;
    const room = this.room;

    // tiles
    for (let ty = 0; ty < room.rows; ty++) {
      for (let tx = 0; tx < room.cols; tx++) {
        const name = room.tileName(tx, ty);
        const t = TILES[name];
        const sx = tx * TILE - cam.x;
        const sy = ty * TILE - cam.y;
        ctx.fillStyle = t.color;
        ctx.fillRect(sx, sy, TILE, TILE);
        if (name === "tree") {
          ctx.fillStyle = "#1f4d2c";
          ctx.fillRect(sx + 2, sy + 1, 12, 12);
        } else if (name === "flower") {
          ctx.fillStyle = "#ffd2ec";
          ctx.fillRect(sx + 6, sy + 6, 4, 4);
          ctx.fillStyle = "#ffe9a0";
          ctx.fillRect(sx + 7, sy + 7, 2, 2);
        }
      }
    }

    // entities, sorted by y so the hero overlaps things above-behind him
    const ents = room.entities.filter((e) => !e.removed);
    ents.push(this.hero);
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) {
      if (e.type === "door" && e.open) continue; // open doors are invisible gaps
      drawSprite(ctx, e, e.x - cam.x, e.y - cam.y);
    }
  }
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
