const stage = document.getElementById("stage");
const canvas = document.getElementById("draw");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const cupImg = document.getElementById("cup");
const cursorImg = document.getElementById("cursor");
const sizeInput = document.getElementById("size");
const sizeLabel = document.getElementById("size-label");
const hint = document.getElementById("hint");

const CUPS = {
  coffee: { src: "assets/cups/coffee-cup.png", liquid: { cx: 0.4297, cy: 0.4983, r: 0.3621 } },
  matcha: { src: "assets/cups/matcha-cup.png", liquid: { cx: 0.4237, cy: 0.4969, r: 0.3695 } },
};

// hot = the point of the sprite that sits under the pointer, as a fraction of its box.
// The pouring jug is anchored where its milk lands, so foam appears under the stream.
const CURSORS = {
  pourIdle: { src: "assets/cursor/pitcher-idle.png", hot: [0.14, 0.18], tilt: 0 },
  pourHover: { src: "assets/cursor/pitcher-hover.png", hot: [0.15, 0.21], tilt: 0 },
  pourActive: { src: "assets/cursor/pitcher-pouring.png", hot: [0.17, 0.78], tilt: 0 },
  pickIdle: { src: "assets/cursor/toothpick.png", hot: [0.1, 0.9], tilt: 0 },
  pickActive: { src: "assets/cursor/toothpick.png", hot: [0.1, 0.9], tilt: -10 },
};

const FOAM_RGB = [255, 253, 248];
const TOOL_SIZES = { pour: 34, pick: 26 };

const foamStamp = new Image();
foamStamp.src = "assets/brushes/foam-stamp.png";

let cup = CUPS.coffee;
let tool = "pour";
let drawing = false;
let pointer = { x: 0, y: 0 };
let last = null;

Object.values(CURSORS).forEach((cursor) => {
  const preload = new Image();
  preload.src = cursor.src;
});

function dpr() {
  return window.devicePixelRatio || 1;
}

/** The paintable drink disc, in CSS pixels relative to the stage. */
function liquidDisc() {
  const rect = stage.getBoundingClientRect();
  return {
    x: cup.liquid.cx * rect.width,
    y: cup.liquid.cy * rect.height,
    r: cup.liquid.r * Math.min(rect.width, rect.height) - 2,
  };
}

function insideLiquid(x, y) {
  const disc = liquidDisc();
  return Math.hypot(x - disc.x, y - disc.y) <= disc.r;
}

function resize() {
  const rect = stage.getBoundingClientRect();
  const width = Math.round(rect.width * dpr());
  const height = Math.round(rect.height * dpr());
  if (canvas.width === width && canvas.height === height) return;

  const previous = document.createElement("canvas");
  previous.width = canvas.width;
  previous.height = canvas.height;
  if (canvas.width && canvas.height) {
    previous.getContext("2d").drawImage(canvas, 0, 0);
  }

  canvas.width = width;
  canvas.height = height;
  ctx.setTransform(dpr(), 0, 0, dpr(), 0, 0);

  if (previous.width && previous.height) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(previous, 0, 0, width, height);
    ctx.restore();
  }
}

function setCursor(key) {
  const cursor = CURSORS[key];
  const [hx, hy] = cursor.hot;
  cursorImg.src = cursor.src;
  cursorImg.style.transformOrigin = `${hx * 100}% ${hy * 100}%`;
  cursorImg.style.transform = `translate(${-hx * 100}%, ${-hy * 100}%) rotate(${cursor.tilt}deg)`;
}

function refreshCursor() {
  if (tool === "pour") {
    setCursor(drawing ? "pourActive" : insideLiquid(pointer.x, pointer.y) ? "pourHover" : "pourIdle");
  } else {
    setCursor(drawing ? "pickActive" : "pickIdle");
  }
}

function moveCursor(event) {
  const rect = stage.getBoundingClientRect();
  pointer.x = event.clientX - rect.left;
  pointer.y = event.clientY - rect.top;
  cursorImg.style.left = `${pointer.x}px`;
  cursorImg.style.top = `${pointer.y}px`;
}

/* ---------------- Pouring ---------------- */

function stamp(x, y) {
  if (!foamStamp.complete) return;
  const size = Number(sizeInput.value);
  ctx.drawImage(foamStamp, x - size / 2, y - size / 2, size, size);
}

function pour(x0, y0, x1, y1) {
  const disc = liquidDisc();
  ctx.save();
  ctx.beginPath();
  ctx.arc(disc.x, disc.y, disc.r, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalAlpha = 0.45;

  if (x0 === null) {
    stamp(x1, y1);
  } else {
    const distance = Math.hypot(x1 - x0, y1 - y0);
    const step = Math.max(1.5, Number(sizeInput.value) * 0.12);
    for (let travelled = 0; travelled <= distance; travelled += step) {
      const t = distance === 0 ? 0 : travelled / distance;
      stamp(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
    }
  }
  ctx.restore();
}

/* ---------------- Toothpick (warp) ---------------- */

/**
 * Drags foam along the pointer motion, the way a pick pulls microfoam.
 * Only alpha is displaced and RGB is repainted flat, which avoids the dark
 * fringes you get from smearing fully transparent pixels.
 */
function warp(x0, y0, x1, y1) {
  const scale = dpr();
  const radius = Number(sizeInput.value) * scale;
  const cx = x1 * scale;
  const cy = y1 * scale;

  let dx = (x1 - x0) * scale;
  let dy = (y1 - y0) * scale;
  const travel = Math.hypot(dx, dy);
  if (travel < 0.5) return;

  const maxPull = radius * 0.85;
  if (travel > maxPull) {
    dx = (dx / travel) * maxPull;
    dy = (dy / travel) * maxPull;
  }

  const x = Math.max(0, Math.floor(cx - radius));
  const y = Math.max(0, Math.floor(cy - radius));
  const w = Math.min(canvas.width - x, Math.ceil(radius * 2) + 2);
  const h = Math.min(canvas.height - y, Math.ceil(radius * 2) + 2);
  if (w <= 0 || h <= 0) return;

  let src;
  try {
    src = ctx.getImageData(x, y, w, h);
  } catch {
    hint.textContent = "Serve this over http:// so the toothpick can read the canvas.";
    return;
  }

  const out = ctx.createImageData(w, h);
  out.data.set(src.data);

  const alphaAt = (px, py) => src.data[(py * w + px) * 4 + 3];
  const sampleAlpha = (fx, fy) => {
    const gx = Math.min(w - 1, Math.max(0, fx));
    const gy = Math.min(h - 1, Math.max(0, fy));
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    const ix2 = Math.min(w - 1, ix + 1);
    const iy2 = Math.min(h - 1, iy + 1);
    const tx = gx - ix;
    const ty = gy - iy;
    const top = alphaAt(ix, iy) * (1 - tx) + alphaAt(ix2, iy) * tx;
    const bottom = alphaAt(ix, iy2) * (1 - tx) + alphaAt(ix2, iy2) * tx;
    return top * (1 - ty) + bottom * ty;
  };

  const disc = liquidDisc();
  const lx = disc.x * scale;
  const ly = disc.y * scale;
  const lr = disc.r * scale;

  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const px = x + i;
      const py = y + j;
      const distance = Math.hypot(px - cx, py - cy);
      if (distance > radius) continue;
      if (Math.hypot(px - lx, py - ly) > lr) continue;

      const falloff = (1 - distance / radius) ** 2;
      const offset = (j * w + i) * 4;
      out.data[offset] = FOAM_RGB[0];
      out.data[offset + 1] = FOAM_RGB[1];
      out.data[offset + 2] = FOAM_RGB[2];
      out.data[offset + 3] = sampleAlpha(i - dx * falloff, j - dy * falloff);
    }
  }

  ctx.putImageData(out, x, y);
}

/* ---------------- Interaction ---------------- */

stage.addEventListener("pointerenter", (event) => {
  moveCursor(event);
  stage.classList.add("has-pointer");
  refreshCursor();
});

stage.addEventListener("pointermove", (event) => {
  const previous = { ...pointer };
  moveCursor(event);

  if (drawing) {
    if (tool === "pour") pour(last ? last.x : null, last ? last.y : null, pointer.x, pointer.y);
    else warp(previous.x, previous.y, pointer.x, pointer.y);
    last = { ...pointer };
  }
  refreshCursor();
});

stage.addEventListener("pointerdown", (event) => {
  try {
    stage.setPointerCapture(event.pointerId);
  } catch {
    /* pointer already released */
  }
  moveCursor(event);
  drawing = true;
  last = null;
  if (tool === "pour") {
    pour(null, null, pointer.x, pointer.y);
    last = { ...pointer };
  }
  refreshCursor();
});

function endStroke() {
  drawing = false;
  last = null;
  refreshCursor();
}

stage.addEventListener("pointerup", endStroke);
stage.addEventListener("pointercancel", endStroke);

stage.addEventListener("pointerleave", () => {
  stage.classList.remove("has-pointer");
  endStroke();
});

document.querySelectorAll(".cup-btn").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".cup-btn").forEach((other) => {
      other.classList.toggle("active", other === button);
      other.setAttribute("aria-pressed", String(other === button));
    });
    cup = CUPS[button.dataset.cup];
    cupImg.src = cup.src;
  });
});

document.querySelectorAll(".tool-btn").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tool-btn").forEach((other) => {
      other.classList.toggle("active", other === button);
      other.setAttribute("aria-pressed", String(other === button));
    });
    TOOL_SIZES[tool] = Number(sizeInput.value);
    tool = button.dataset.tool;

    const pouring = tool === "pour";
    sizeLabel.textContent = pouring ? "Pour" : "Pick";
    sizeInput.min = pouring ? 16 : 12;
    sizeInput.max = pouring ? 64 : 40;
    sizeInput.value = TOOL_SIZES[tool];
    hint.textContent = pouring
      ? "Hold to pour · Switch to the toothpick to drag the foam"
      : "Drag through the foam to pull hearts, rosettas and swirls";
    refreshCursor();
  });
});

document.getElementById("clear").addEventListener("click", () => {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
});

window.addEventListener("resize", resize);
resize();
setCursor("pourIdle");
