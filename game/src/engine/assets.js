// assets.js
// Programmer-art rendering. Every entity is drawn here as simple shapes. This
// is the single seam where real sprite sheets can be swapped in later: replace
// the body of drawSprite() (or branch on a loaded image) and nothing else in
// the engine needs to change.

const T = 16;

export const COLORS = {
  bg: "#0d1b12",
};

// Draw an entity at screen position (sx, sy).
export function drawSprite(ctx, e, sx, sy) {
  switch (e.type) {
    case "hero":
      drawFox(ctx, sx, sy, e.facing);
      break;
    case "block":
      ctx.fillStyle = "#9b6a3c";
      ctx.fillRect(sx + 1, sy + 1, T - 2, T - 2);
      ctx.fillStyle = "#b98a55";
      ctx.fillRect(sx + 2, sy + 2, T - 4, 3);
      ctx.strokeStyle = "#5e3f22";
      ctx.strokeRect(sx + 1.5, sy + 1.5, T - 3, T - 3);
      break;
    case "switch":
      ctx.fillStyle = "#3b3b3b";
      ctx.fillRect(sx + 3, sy + 3, T - 6, T - 6);
      ctx.fillStyle = e.pressed ? "#7bdc6a" : "#9a9a9a";
      ctx.fillRect(sx + 5, sy + 5, T - 10, T - 10);
      break;
    case "door":
      ctx.fillStyle = e.needs === "key" ? "#e3c34b" : "#7a5a32";
      ctx.fillRect(sx + 1, sy, T - 2, T);
      ctx.fillStyle = e.needs === "key" ? "#fff6c2" : "#5e4426";
      ctx.fillRect(sx + 6, sy + 5, 4, 6); // keyhole / panel
      break;
    case "acorn":
      ctx.fillStyle = "#caa15a";
      ctx.beginPath();
      ctx.arc(sx + 8, sy + 10, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6e4a23";
      ctx.fillRect(sx + 4, sy + 4, 8, 4);
      ctx.fillRect(sx + 7, sy + 2, 2, 2); // stem
      break;
    case "key":
      ctx.fillStyle = "#f2cf4a";
      ctx.beginPath();
      ctx.arc(sx + 6, sy + 6, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(sx + 7, sy + 6, 2.5, 7);
      ctx.fillRect(sx + 7, sy + 11, 4, 2);
      break;
    case "heart":
      drawHeart(ctx, sx, sy, "#e8556b");
      break;
    case "npc":
      drawCritter(ctx, sx, sy, e.sprite, e.facing);
      break;
    case "sign":
      ctx.fillStyle = "#5e4528";
      ctx.fillRect(sx + 7, sy + 7, 2, 7); // post
      ctx.fillStyle = "#8a6a40";
      ctx.fillRect(sx + 2, sy + 2, 12, 8); // board
      ctx.fillStyle = "#d8b87e";
      ctx.fillRect(sx + 3, sy + 4, 10, 1);
      ctx.fillRect(sx + 3, sy + 7, 8, 1);
      break;
    default:
      ctx.fillStyle = "#ff00ff"; // missing-art marker
      ctx.fillRect(sx + 2, sy + 2, T - 4, T - 4);
  }
}

function drawFox(ctx, x, y, facing) {
  // ears
  ctx.fillStyle = "#e8772e";
  ctx.fillRect(x + 3, y + 2, 3, 3);
  ctx.fillRect(x + 10, y + 2, 3, 3);
  // body / head
  ctx.fillRect(x + 3, y + 4, 10, 10);
  // belly
  ctx.fillStyle = "#fce8d2";
  ctx.fillRect(x + 5, y + 8, 6, 5);
  // nose, offset toward facing direction
  let nx = x + 7;
  let ny = y + 6;
  if (facing === "left") nx = x + 3;
  else if (facing === "right") nx = x + 11;
  if (facing === "up") ny = y + 4;
  else if (facing === "down") ny = y + 8;
  ctx.fillStyle = "#3a2410";
  ctx.fillRect(nx, ny, 2, 2);
}

function drawCritter(ctx, x, y, sprite, facing) {
  if (sprite === "owl") {
    ctx.fillStyle = "#7a5a3a";
    ctx.fillRect(x + 3, y + 3, 10, 11);
    ctx.fillStyle = "#caa97e";
    ctx.fillRect(x + 5, y + 7, 6, 6);
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + 5, y + 5, 3, 3);
    ctx.fillRect(x + 8, y + 5, 3, 3);
    ctx.fillStyle = "#222";
    ctx.fillRect(x + 6, y + 6, 1, 1);
    ctx.fillRect(x + 9, y + 6, 1, 1);
    return;
  }
  // default: rabbit
  ctx.fillStyle = "#f2efe9";
  ctx.fillRect(x + 5, y + 1, 2, 4); // ears
  ctx.fillRect(x + 9, y + 1, 2, 4);
  ctx.fillRect(x + 4, y + 5, 8, 9); // body
  ctx.fillStyle = "#ffc7d6";
  ctx.fillRect(x + 7, y + 8, 2, 2); // nose
  ctx.fillStyle = "#3a2410";
  ctx.fillRect(x + 5, y + 7, 1, 1);
  ctx.fillRect(x + 10, y + 7, 1, 1);
}

function drawHeart(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x + 4, y + 4, 3, 3);
  ctx.fillRect(x + 9, y + 4, 3, 3);
  ctx.fillRect(x + 4, y + 6, 8, 3);
  ctx.fillRect(x + 5, y + 9, 6, 2);
  ctx.fillRect(x + 7, y + 11, 2, 2);
}
