"""Build the Concept Cafe asset pack from the illustrated source art.

Keeps the hand-drawn look of the generated illustrations while:
  * keying out the background properly (no leftover white box / halo)
  * recolouring the matcha to the requested #6EB769
  * lifting the cup body closer to white
  * detecting the paintable liquid disc so the app can clip strokes to it
"""

from __future__ import annotations

import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets"
OUT = ROOT / "public" / "assets"

MATCHA_TARGET = (0x52, 0xA0, 0x4D)
MATCHA_HEX = "#%02X%02X%02X" % MATCHA_TARGET


# --------------------------------------------------------------------------- #
# Background removal
# --------------------------------------------------------------------------- #

def key_background(img: Image.Image, tolerance: int = 46, feather: int = 30) -> Image.Image:
    """Flood the paper background from the edges and feather the cut.

    Flooding (rather than a global colour test) protects white areas *inside*
    the artwork, such as the milk in the pitcher.
    """
    rgba = img.convert("RGBA")
    data = np.array(rgba).astype(np.int16)
    h, w = data.shape[:2]

    corners = np.array(
        [data[0, 0, :3], data[0, w - 1, :3], data[h - 1, 0, :3], data[h - 1, w - 1, :3]],
        dtype=np.float32,
    )
    bg = np.median(corners, axis=0)

    dist = np.sqrt(((data[:, :, :3].astype(np.float32) - bg) ** 2).sum(axis=2))
    candidate = dist <= tolerance + feather

    reached = np.zeros((h, w), dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    for x in range(w):
        for y in (0, h - 1):
            if candidate[y, x]:
                queue.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if candidate[y, x]:
                queue.append((y, x))

    while queue:
        y, x = queue.popleft()
        if reached[y, x] or not candidate[y, x]:
            continue
        reached[y, x] = True
        if y > 0:
            queue.append((y - 1, x))
        if y < h - 1:
            queue.append((y + 1, x))
        if x > 0:
            queue.append((y, x - 1))
        if x < w - 1:
            queue.append((y, x + 1))

    alpha = np.full((h, w), 255.0, dtype=np.float32)
    solid = reached & (dist <= tolerance)
    ramp = reached & (dist > tolerance)
    alpha[solid] = 0.0
    alpha[ramp] = np.clip((dist[ramp] - tolerance) / feather, 0.0, 1.0) * 255.0

    # Unmultiply the paper tint out of the soft edge so it does not read as a halo.
    rgb = data[:, :, :3].astype(np.float32)
    a = (alpha / 255.0)[:, :, None]
    edge = (a > 0.02) & (a < 0.98)
    recovered = np.where(edge, (rgb - bg * (1 - a)) / np.maximum(a, 0.02), rgb)

    data[:, :, :3] = np.clip(recovered, 0, 255).astype(np.int16)
    data[:, :, 3] = alpha.astype(np.int16)
    return Image.fromarray(data.astype(np.uint8), "RGBA")


def trim(img: Image.Image, pad: int = 6) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    left, top, right, bottom = bbox
    return img.crop(
        (
            max(0, left - pad),
            max(0, top - pad),
            min(img.width, right + pad),
            min(img.height, bottom + pad),
        )
    )


def fit(img: Image.Image, max_side: int) -> Image.Image:
    scale = max_side / max(img.size)
    if scale >= 1:
        return img
    return img.resize(
        (round(img.width * scale), round(img.height * scale)), Image.Resampling.LANCZOS
    )


def square(img: Image.Image) -> Image.Image:
    """Centre the artwork on a transparent square so fractions stay stable."""
    side = max(img.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - img.width) // 2, (side - img.height) // 2))
    return canvas


# --------------------------------------------------------------------------- #
# Recolouring
# --------------------------------------------------------------------------- #

def recolour_matcha(img: Image.Image) -> Image.Image:
    """Shift the green tea to #6EB769, keeping the painted texture."""
    data = np.array(img).astype(np.float32)
    rgb = data[:, :, :3]
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]

    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    delta = mx - mn
    sat = np.where(mx > 0, delta / np.maximum(mx, 1e-6), 0.0)

    greens = (g >= r) & (g >= b) & (delta > 18) & (sat > 0.10) & (data[:, :, 3] > 8)
    if not greens.any():
        return img

    # Per-pixel shading is preserved by scaling the target colour with the
    # pixel's own brightness relative to the average of the drink.
    lightness = 0.299 * r + 0.587 * g + 0.114 * b
    reference = float(lightness[greens].mean())
    factor = np.clip(lightness / max(reference, 1e-6), 0.55, 1.45)[:, :, None]

    target = np.array(MATCHA_TARGET, dtype=np.float32)[None, None, :]
    recoloured = np.clip(target * factor, 0, 255)
    data[:, :, :3] = np.where(greens[:, :, None], recoloured, rgb)
    return Image.fromarray(np.clip(data, 0, 255).astype(np.uint8), "RGBA")


def whiten_cup(img: Image.Image, liquid: tuple[float, float, float] | None) -> Image.Image:
    """Desaturate the cream ceramic toward white, leaving outlines and drink alone."""
    data = np.array(img).astype(np.float32)
    rgb = data[:, :, :3]
    h, w = data.shape[:2]

    lightness = rgb.mean(axis=2)
    spread = rgb.max(axis=2) - rgb.min(axis=2)
    body = (lightness > 150) & (spread < 60) & (data[:, :, 3] > 8)

    if liquid is not None:
        cx, cy, radius = liquid
        yy, xx = np.mgrid[0:h, 0:w]
        body &= np.hypot(xx - cx, yy - cy) > radius * 1.02

    strength = np.clip((lightness[body] - 150) / 90.0, 0.0, 1.0)[:, None] * 0.85
    data[body, :3] = rgb[body] * (1 - strength) + 255.0 * strength
    return Image.fromarray(np.clip(data, 0, 255).astype(np.uint8), "RGBA")


# --------------------------------------------------------------------------- #
# Liquid detection
# --------------------------------------------------------------------------- #

def detect_liquid(img: Image.Image) -> tuple[float, float, float]:
    """Find the drink disc: saturated mid-tone pixels, excluding the ink outline.

    The radius comes from the filled area rather than the furthest pixel, so a
    stray speck or the rim stroke cannot inflate it.
    """
    data = np.array(img).astype(np.float32)
    rgb = data[:, :, :3]
    alpha = data[:, :, 3]

    spread = rgb.max(axis=2) - rgb.min(axis=2)
    lightness = rgb.mean(axis=2)
    drink = (alpha > 60) & (spread > 34) & (lightness > 90) & (lightness < 232)

    ys, xs = np.nonzero(drink)
    if len(xs) == 0:
        h, w = alpha.shape
        return w / 2, h / 2, min(h, w) * 0.3

    cx, cy = float(xs.mean()), float(ys.mean())
    radius = float(np.sqrt(len(xs) / np.pi))
    return cx, cy, radius


def debug_liquid(img: Image.Image, liquid: tuple[float, float, float], dest: Path) -> None:
    from PIL import ImageDraw

    preview = img.copy()
    draw = ImageDraw.Draw(preview)
    cx, cy, r = liquid
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(255, 0, 0, 255), width=3)
    dest.parent.mkdir(parents=True, exist_ok=True)
    preview.save(dest, "PNG")


# --------------------------------------------------------------------------- #
# Build
# --------------------------------------------------------------------------- #

def build_cup(name: str, source: Path, matcha: bool) -> dict:
    img = trim(key_background(Image.open(source)))
    if matcha:
        img = recolour_matcha(img)

    cx, cy, radius = detect_liquid(img)
    img = whiten_cup(img, (cx, cy, radius))

    img = fit(square(img), 520)

    cx, cy, radius = detect_liquid(img)
    dest = OUT / f"cups/{name}.png"
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "PNG")
    debug_liquid(img, (cx, cy, radius), ROOT / "scripts" / f"debug-{name}.png")

    return {
        "file": f"assets/cups/{name}.png",
        "width": img.width,
        "height": img.height,
        "liquid": {
            "cx": round(cx / img.width, 4),
            "cy": round(cy / img.height, 4),
            "r": round(radius / img.width, 4),
        },
    }


def split_pitchers(source: Path) -> dict:
    sheet = trim(key_background(Image.open(source)))
    width, height = sheet.size
    alpha = np.array(sheet)[:, :, 3]
    columns = (alpha > 16).sum(axis=0)

    # Find the two widest empty gutters between the three pitchers.
    empty = columns < max(2, columns.max() * 0.01)
    runs: list[tuple[int, int]] = []
    start = None
    for x in range(width):
        if empty[x] and start is None:
            start = x
        elif not empty[x] and start is not None:
            runs.append((start, x))
            start = None
    if start is not None:
        runs.append((start, width))

    inner = [r for r in runs if r[0] > width * 0.08 and r[1] < width * 0.92]
    inner.sort(key=lambda r: r[1] - r[0], reverse=True)
    cuts = sorted((r[0] + r[1]) // 2 for r in inner[:2])
    if len(cuts) != 2:
        cuts = [width // 3, 2 * width // 3]

    bounds = [(0, cuts[0]), (cuts[0], cuts[1]), (cuts[1], width)]
    names = ["pitcher-idle", "pitcher-hover", "pitcher-pouring"]

    result = {}
    for name, (x0, x1) in zip(names, bounds):
        part = fit(square(trim(sheet.crop((x0, 0, x1, height)), pad=4)), 200)
        dest = OUT / f"cursor/{name}.png"
        dest.parent.mkdir(parents=True, exist_ok=True)
        part.save(dest, "PNG")
        result[f"cursor/{name}"] = {
            "file": f"assets/cursor/{name}.png",
            "width": part.width,
            "height": part.height,
        }
    return result


def build_foam_stamp(source: Path, size: int = 256) -> dict:
    """Make a paintable microfoam stamp.

    The source illustration is white foam on white paper, so keying it leaves
    almost nothing behind. Instead we keep its bubble detail as a subtle alpha
    variation and pair it with a soft radial falloff that blends when stamped
    repeatedly along a stroke.
    """
    foam = Image.open(source).convert("L").resize((size, size), Image.Resampling.LANCZOS)
    detail = np.array(foam).astype(np.float32) / 255.0

    # Emphasise the bubbles (darker specks) as density variation.
    density = np.clip((detail - detail.min()) / max(float(np.ptp(detail)), 1e-6), 0, 1)
    texture = 1.0 - (1.0 - density) * 0.55

    yy, xx = np.mgrid[0:size, 0:size]
    radius = size / 2.0
    dist = np.hypot(xx - radius + 0.5, yy - radius + 0.5) / radius
    falloff = np.clip((1.0 - dist) / 0.42, 0.0, 1.0) ** 1.4

    alpha = np.clip(falloff * texture, 0, 1) * 255.0

    rgba = np.zeros((size, size, 4), dtype=np.uint8)
    rgba[:, :, 0] = 255
    rgba[:, :, 1] = 253
    rgba[:, :, 2] = 248
    rgba[:, :, 3] = alpha.astype(np.uint8)

    dest = OUT / "brushes/foam-stamp.png"
    dest.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, "RGBA").save(dest, "PNG")
    return {"file": "assets/brushes/foam-stamp.png", "width": size, "height": size}


def build_simple(name: str, source: Path, max_side: int, folder: str) -> dict:
    img = fit(square(trim(key_background(Image.open(source)))), max_side)
    dest = OUT / f"{folder}/{name}.png"
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "PNG")
    return {"file": f"assets/{folder}/{name}.png", "width": img.width, "height": img.height}


def main() -> None:
    assets: dict = {}

    assets["cups/coffee-cup"] = build_cup("coffee-cup", SRC / "coffee-cup.png", matcha=False)
    assets["cups/matcha-cup"] = build_cup("matcha-cup", SRC / "matcha-cup.png", matcha=True)
    assets.update(split_pitchers(SRC / "pitcher-cursors.png"))

    toothpick = SRC / "toothpick.png"
    if toothpick.exists():
        assets["cursor/toothpick"] = build_simple("toothpick", toothpick, 200, "cursor")

    foam = SRC / "foam-texture.png"
    if foam.exists():
        assets["brushes/foam-stamp"] = build_foam_stamp(foam)

    # Calibrated by eye: the sprite point that should sit under the pointer.
    hotspots = {
        "cursor/pitcher-idle": [0.14, 0.18],
        "cursor/pitcher-hover": [0.15, 0.21],
        "cursor/pitcher-pouring": [0.17, 0.78],
        "cursor/toothpick": [0.10, 0.90],
    }
    for key, hotspot in hotspots.items():
        if key in assets:
            assets[key]["hotspot"] = hotspot

    manifest = {
        "concept": "Concept Cafe - illustrated latte art",
        "palette": {
            "paper": "#F7F3EE",
            "ink": "#33302C",
            "matcha": MATCHA_HEX,
            "accent": MATCHA_HEX,
        },
        "notes": {
            "liquid": "Fraction of the cup image where painting is allowed",
            "hotspot": "Fraction of the cursor sprite that sits under the pointer",
        },
        "assets": assets,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
