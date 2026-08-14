"""Split generated watercolor sheets into transparent, web-ready PNG assets."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(
    r"C:\Users\alexi\.cursor\projects"
    r"\c-Users-alexi-OneDrive-Documents-concept-cafe\assets"
)
OUTPUT = ROOT / "watercolor-assets"


SHEETS: dict[str, dict] = {
    "watercolor-pourers-sheet.png": {
        "grid": (3, 1),
        "assets": [
            "cursors/pourer-idle",
            "cursors/pourer-hover",
            "cursors/pourer-pouring",
        ],
    },
    "watercolor-tart-assets-sheet.png": {
        "grid": (3, 2),
        "assets": [
            "tart/plain-custard-tart",
            None,
            "tart-toppings/sliced-strawberry",
            "tart-toppings/blueberry",
            None,
            "tart-toppings/mandarin-segment",
        ],
    },
    "watercolor-bread-stamps-sheet.png": {
        "grid": (3, 4),
        "assets": [
            None,
            None,
            None,
            "bread/untoasted-paw-pressed",
            "bread/untoasted-heart-pressed",
            "bread/untoasted-star-pressed",
            "bread/toasted-paw-pressed",
            "bread/toasted-heart-pressed",
            "bread/toasted-star-pressed",
            None,
            None,
            None,
        ],
    },
    "watercolor-stationery-sheet.png": {
        "grid": (3, 2),
        "assets": [
            "bread/plain-white-bread",
            "stationery/blank-letter",
            "stationery/open-pink-envelope",
            None,
            "stationery/letter-in-envelope",
            None,
        ],
    },
    "watercolor-untoasted-egg-bread-sheet.png": {
        "grid": (3, 1),
        "assets": [
            "bread/egg-paw",
            "bread/egg-heart",
            "bread/egg-star",
        ],
    },
    "watercolor-chocolate-bread-sheet.png": {
        "grid": (3, 2),
        "assets": [
            "bread/untoasted-chocolate-paw",
            "bread/untoasted-chocolate-heart",
            "bread/untoasted-chocolate-star",
            "bread/toasted-chocolate-paw",
            "bread/toasted-chocolate-heart",
            "bread/toasted-chocolate-star",
        ],
    },
}

MAGENTA_SHEETS = {
    "watercolor-untoasted-egg-bread-sheet.png",
    "watercolor-chocolate-bread-sheet.png",
}

REPLACEMENTS = {
    "tart-toppings/whipped-cream": "watercolor-whipped-cream-opaque.png",
    "tart-toppings/sliced-mango": "watercolor-single-mango-slice.png",
    "packaging/writable-name-tag": "watercolor-pink-name-sticker.png",
    "packaging/paper-bag-brown": "watercolor-brown-paper-bag.png",
    "cursors/latte-toothpick": "watercolor-latte-toothpick.png",
}

STALE_ASSETS = [
    "packaging/blank-name-tag.png",
    "packaging/blank-blue-gift-tag.png",
    "packaging/paper-bag-pink.png",
    "packaging/paper-bag-green.png",
    "packaging/paper-bag-blue.png",
    "cups/green-empty.png",
    "cups/blue-empty.png",
    "cups/green-coffee.png",
    "cups/blue-coffee.png",
    "cups/green-matcha.png",
    "cups/blue-matcha.png",
    "cups/green-ube.png",
    "cups/blue-ube.png",
]

STALE_SOURCE_SHEETS = [
    "watercolor-paper-bags-sheet.png",
    "watercolor-latte-cups-sheet.png",
    "watercolor-writable-name-tag.png",
    "watercolor-whipped-cream.png",
]


def remove_connected_background(image: Image.Image) -> Image.Image:
    """Remove only the near-white region connected to the sheet edges."""
    rgba = np.array(image.convert("RGBA"))
    rgb = rgba[:, :, :3].astype(np.float32)
    height, width = rgb.shape[:2]

    corners = np.array(
        [rgb[0, 0], rgb[0, width - 1], rgb[height - 1, 0], rgb[height - 1, width - 1]]
    )
    background = np.median(corners, axis=0)
    distance = np.sqrt(((rgb - background) ** 2).sum(axis=2))

    solid_threshold = 20.0
    feather = 28.0
    candidate = (distance <= solid_threshold + feather).astype(np.uint8)
    _, labels = cv2.connectedComponents(candidate, connectivity=4)

    edge_labels = np.unique(
        np.concatenate((labels[0], labels[-1], labels[:, 0], labels[:, -1]))
    )
    connected = np.isin(labels, edge_labels) & (candidate > 0)

    alpha = np.full((height, width), 255.0, dtype=np.float32)
    alpha[connected & (distance <= solid_threshold)] = 0.0
    ramp = connected & (distance > solid_threshold)
    alpha[ramp] = (
        np.clip((distance[ramp] - solid_threshold) / feather, 0.0, 1.0) * 255.0
    )

    # Remove the white paper colour from semi-transparent edge pixels.
    amount = (alpha / 255.0)[:, :, None]
    soft_edge = (amount > 0.02) & (amount < 0.98)
    recovered = np.where(
        soft_edge,
        (rgb - background * (1.0 - amount)) / np.maximum(amount, 0.02),
        rgb,
    )

    rgba[:, :, :3] = np.clip(recovered, 0, 255).astype(np.uint8)
    rgba[:, :, 3] = alpha.astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def remove_magenta_background(image: Image.Image) -> Image.Image:
    """Key the saturated magenta generation background without harming pale art."""
    rgba = np.array(image.convert("RGBA"))
    rgb = rgba[:, :, :3].astype(np.float32)
    height, width = rgb.shape[:2]
    magenta_score = np.minimum(rgb[:, :, 0], rgb[:, :, 2]) - rgb[:, :, 1]
    candidate = (magenta_score > 38).astype(np.uint8)
    _, labels = cv2.connectedComponents(candidate, connectivity=4)
    edge_labels = np.unique(
        np.concatenate((labels[0], labels[-1], labels[:, 0], labels[:, -1]))
    )
    connected = np.isin(labels, edge_labels) & (candidate > 0)

    alpha = np.full((height, width), 255.0, dtype=np.float32)
    alpha[connected & (magenta_score >= 105)] = 0
    feather = connected & (magenta_score < 105)
    alpha[feather] = (
        np.clip((105 - magenta_score[feather]) / 67, 0.0, 1.0) * 255.0
    )
    chroma_contamination = (
        (magenta_score > 80)
        & (rgb[:, :, 0] > 160)
        & (rgb[:, :, 2] > 160)
    )
    alpha[chroma_contamination] = 0

    background = np.median(
        np.array(
            [
                rgb[0, 0],
                rgb[0, width - 1],
                rgb[height - 1, 0],
                rgb[height - 1, width - 1],
            ]
        ),
        axis=0,
    )
    amount = (alpha / 255.0)[:, :, None]
    soft_edge = (amount > 0.02) & (amount < 0.98)
    recovered = np.where(
        soft_edge,
        (rgb - background * (1.0 - amount)) / np.maximum(amount, 0.02),
        rgb,
    )
    rgba[:, :, :3] = np.clip(recovered, 0, 255).astype(np.uint8)
    rgba[:, :, 3] = alpha.astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def clear_magenta_resampling_fringe(image: Image.Image) -> Image.Image:
    """Clear faint chroma pixels introduced while resizing transparent edges."""
    rgba = np.array(image.convert("RGBA"))
    rgb = rgba[:, :, :3].astype(np.int16)
    score = np.minimum(rgb[:, :, 0], rgb[:, :, 2]) - rgb[:, :, 1]
    fringe = (
        (rgba[:, :, 3] < 64)
        & (score > 65)
        & (rgb[:, :, 0] > 150)
        & (rgb[:, :, 2] > 150)
    )
    rgba[fringe] = 0
    return Image.fromarray(rgba, "RGBA")


def remove_enclosed_white_holes(image: Image.Image) -> Image.Image:
    """Clear the white centers of the three metal stamp cursor assets."""
    rgba = np.array(image.convert("RGBA"))
    rgb = rgba[:, :, :3].astype(np.float32)
    distance = np.sqrt(((rgb - 255.0) ** 2).sum(axis=2))
    candidate = ((distance < 42) & (rgba[:, :, 3] > 180)).astype(np.uint8)

    count, labels, stats, _ = cv2.connectedComponentsWithStats(candidate, connectivity=4)
    for label in range(1, count):
        area = stats[label, cv2.CC_STAT_AREA]
        if area >= 180:
            rgba[labels == label, 3] = 0
    return Image.fromarray(rgba, "RGBA")


def clear_small_white_enclosures(
    image: Image.Image,
    *,
    right_side_only: bool = False,
) -> Image.Image:
    """Clear paper-white holes, while preserving large pale painted surfaces."""
    rgba = np.array(image.convert("RGBA"))
    rgb = rgba[:, :, :3].astype(np.float32)
    height, width = rgba.shape[:2]
    distance = np.sqrt(((rgb - 255.0) ** 2).sum(axis=2))
    candidate = ((distance < 34) & (rgba[:, :, 3] > 180)).astype(np.uint8)

    count, labels, stats, centroids = cv2.connectedComponentsWithStats(
        candidate, connectivity=4
    )
    for label in range(1, count):
        area = stats[label, cv2.CC_STAT_AREA]
        center_x = centroids[label][0]
        if not 120 <= area <= width * height * 0.08:
            continue
        if right_side_only and center_x < width * 0.52:
            continue
        rgba[labels == label, 3] = 0
    return Image.fromarray(rgba, "RGBA")


def fill_whipped_cream_silhouette(image: Image.Image) -> Image.Image:
    """Make the rosette a continuous topping instead of transparent spiral strips."""
    rgba = np.array(image.convert("RGBA"))
    alpha = rgba[:, :, 3]
    mask = (alpha > 24).astype(np.uint8) * 255
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return image

    outer = max(contours, key=cv2.contourArea)
    filled = np.zeros_like(mask)
    cv2.drawContours(filled, [outer], -1, 255, thickness=cv2.FILLED)
    interior = cv2.erode(filled, np.ones((5, 5), np.uint8), iterations=1) > 0

    cream = np.array([255, 248, 229], dtype=np.uint8)
    completely_missing = interior & (alpha < 12)
    rgba[completely_missing, :3] = cream
    rgba[interior, 3] = 255
    return Image.fromarray(rgba, "RGBA")


def neutralize_light_paper(image: Image.Image, *, whole_image: bool = False) -> Image.Image:
    """Cool yellow paper toward a neutral white while retaining its grain."""
    rgba = np.array(image.convert("RGBA")).astype(np.float32)
    rgb = rgba[:, :, :3]
    lightness = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
    spread = rgb.max(axis=2) - rgb.min(axis=2)

    if whole_image:
        selected = rgba[:, :, 3] > 0
    else:
        selected = (
            (rgba[:, :, 3] > 24)
            & (lightness > 170)
            & (spread < 48)
        )

    neutral = np.stack(
        (
            np.clip(lightness + 4, 0, 255),
            np.clip(lightness + 4, 0, 255),
            np.clip(lightness + 5, 0, 255),
        ),
        axis=2,
    )
    strength = 0.84
    rgba[selected, :3] = (
        rgb[selected] * (1 - strength) + neutral[selected] * strength
    )
    return Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), "RGBA")


def make_yolk_oblong(image: Image.Image) -> Image.Image:
    """Stretch the central watercolor yolk into an organic horizontal oval."""
    rgba = np.array(image.convert("RGBA"))
    rgb = rgba[:, :, :3].astype(np.int16)
    height, width = rgba.shape[:2]

    yellow = (
        (rgb[:, :, 0] > 205)
        & (rgb[:, :, 1] > 105)
        & (rgb[:, :, 1] < 225)
        & (rgb[:, :, 2] < 115)
        & (rgb[:, :, 0] - rgb[:, :, 1] > 28)
        & (rgb[:, :, 1] - rgb[:, :, 2] > 55)
        & (rgba[:, :, 3] > 100)
    ).astype(np.uint8)

    count, labels, stats, centroids = cv2.connectedComponentsWithStats(
        yellow, connectivity=4
    )
    candidates: list[tuple[float, int]] = []
    center = np.array([width / 2, height / 2])
    for label in range(1, count):
        area = stats[label, cv2.CC_STAT_AREA]
        component_width = stats[label, cv2.CC_STAT_WIDTH]
        component_height = stats[label, cv2.CC_STAT_HEIGHT]
        if (
            area < 80
            or area > width * height * 0.08
            or component_width > width * 0.36
            or component_height > height * 0.36
        ):
            continue
        distance = float(np.linalg.norm(centroids[label] - center))
        candidates.append((distance, label))
    if not candidates:
        return image

    _, label = min(candidates)
    mask = (labels == label).astype(np.uint8) * 255
    mask = cv2.dilate(mask, np.ones((5, 5), np.uint8), iterations=1)
    x, y, box_width, box_height = cv2.boundingRect(mask)

    padding = 4
    x0 = max(0, x - padding)
    y0 = max(0, y - padding)
    x1 = min(width, x + box_width + padding)
    y1 = min(height, y + box_height + padding)

    piece = rgba[y0:y1, x0:x1].copy()
    piece_mask = mask[y0:y1, x0:x1]
    piece[:, :, 3] = np.minimum(piece[:, :, 3], piece_mask)

    ring = cv2.dilate(mask, np.ones((15, 15), np.uint8), iterations=1) - mask
    ring_pixels = rgba[(ring > 0) & (rgba[:, :, 3] > 100), :3]
    egg_white = (
        np.median(ring_pixels, axis=0).astype(np.uint8)
        if len(ring_pixels)
        else np.array([255, 248, 225], dtype=np.uint8)
    )

    base = rgba.copy()
    base[mask > 0, :3] = egg_white
    base[mask > 0, 3] = 255

    piece_image = Image.fromarray(piece, "RGBA")
    new_width = max(1, round(piece_image.width * 1.38))
    new_height = max(1, round(piece_image.height * 0.74))
    piece_image = piece_image.resize(
        (new_width, new_height), Image.Resampling.LANCZOS
    )

    center_x = x0 + (x1 - x0) / 2
    center_y = y0 + (y1 - y0) / 2
    paste_x = round(center_x - new_width / 2)
    paste_y = round(center_y - new_height / 2)

    result = Image.fromarray(base, "RGBA")
    result.alpha_composite(piece_image, (paste_x, paste_y))
    return result


def add_egg_seasoning(image: Image.Image, seed_name: str) -> Image.Image:
    """Add restrained pepper, paprika, and herb flecks over the original egg."""
    rgba = np.array(image.convert("RGBA"))
    rgb = rgba[:, :, :3].astype(np.int16)
    height, width = rgba.shape[:2]
    lightness = rgb.mean(axis=2)
    spread = rgb.max(axis=2) - rgb.min(axis=2)

    white_seed = (
        (lightness > 200)
        & (spread < 55)
        & (rgba[:, :, 3] > 180)
    ).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(
        white_seed, connectivity=4
    )
    egg_white = np.zeros((height, width), dtype=bool)
    for label in range(1, count):
        area = stats[label, cv2.CC_STAT_AREA]
        component_width = stats[label, cv2.CC_STAT_WIDTH]
        component_height = stats[label, cv2.CC_STAT_HEIGHT]
        if (
            1200 <= area <= width * height * 0.20
            and component_width < width * 0.65
            and component_height < height * 0.65
        ):
            egg_white |= labels == label

    yolk = (
        (rgb[:, :, 0] > 205)
        & (rgb[:, :, 1] > 105)
        & (rgb[:, :, 2] < 125)
    )
    surface = (egg_white | yolk) & (rgba[:, :, 3] > 180)
    coordinates = np.argwhere(surface)
    if len(coordinates) == 0:
        return image

    seed = sum((index + 1) * ord(char) for index, char in enumerate(seed_name))
    rng = np.random.default_rng(seed)
    selected = coordinates[
        rng.choice(len(coordinates), size=min(34, len(coordinates)), replace=False)
    ]

    from PIL import ImageDraw

    result = image.copy()
    draw = ImageDraw.Draw(result, "RGBA")
    colours = [
        (88, 58, 37, 205),   # black pepper
        (128, 65, 42, 185),  # paprika
        (76, 102, 53, 190),  # dried herb
    ]
    for index, (y, x) in enumerate(selected):
        colour = colours[index % len(colours)]
        if index % 5 == 0:
            draw.line(
                (x - 2, y + 1, x + 3, y - 2),
                fill=colour,
                width=1,
            )
        else:
            radius_x = 1 + (index % 2)
            radius_y = 1
            draw.ellipse(
                (x - radius_x, y - radius_y, x + radius_x, y + radius_y),
                fill=colour,
            )
    return result


def trim_and_square(image: Image.Image, size: int = 512, padding: int = 24) -> Image.Image:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        return Image.new("RGBA", (size, size), (0, 0, 0, 0))

    left, top, right, bottom = bbox
    left = max(0, left - 6)
    top = max(0, top - 6)
    right = min(image.width, right + 6)
    bottom = min(image.height, bottom + 6)
    cropped = image.crop((left, top, right, bottom))

    available = size - padding * 2
    scale = min(available / cropped.width, available / cropped.height)
    resized = cropped.resize(
        (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale))),
        Image.Resampling.LANCZOS,
    )

    result = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    result.alpha_composite(
        resized, ((size - resized.width) // 2, (size - resized.height) // 2)
    )
    return result


def split_sheet(filename: str, config: dict, manifest: dict) -> None:
    source_path = SOURCE / filename
    source = Image.open(source_path)
    if filename in MAGENTA_SHEETS:
        sheet = remove_magenta_background(source)
    else:
        sheet = remove_connected_background(source)
    columns, rows = config["grid"]
    cell_width = sheet.width / columns
    cell_height = sheet.height / rows

    names = config["assets"]
    for index, name in enumerate(names):
        if name is None:
            continue
        column = index % columns
        row = index // columns
        box = (
            round(column * cell_width),
            round(row * cell_height),
            round((column + 1) * cell_width),
            round((row + 1) * cell_height),
        )
        asset = sheet.crop(box)
        asset = trim_and_square(asset)
        if filename in MAGENTA_SHEETS:
            asset = clear_magenta_resampling_fringe(asset)
        if name.startswith("cursors/pourer-"):
            asset = clear_small_white_enclosures(asset, right_side_only=True)
        elif name.startswith("bread/egg-"):
            asset = add_egg_seasoning(asset, name)
        elif name == "stationery/blank-letter":
            asset = neutralize_light_paper(asset)

        destination = OUTPUT / f"{name}.png"
        destination.parent.mkdir(parents=True, exist_ok=True)
        asset.save(destination, "PNG", optimize=True)
        info = {
            "file": f"{name}.png",
            "width": asset.width,
            "height": asset.height,
            "sourceSheet": filename,
        }
        if name.startswith("bread/egg-"):
            info.update({"breadState": "untoasted", "filling": "egg"})
        elif "chocolate" in name:
            info.update(
                {
                    "breadState": (
                        "untoasted" if "/untoasted-" in name else "toasted"
                    ),
                    "filling": "chocolate",
                }
            )
        manifest["assets"][name] = info


def build_single(name: str, filename: str, manifest: dict) -> None:
    source = Image.open(SOURCE / filename)
    if filename in {
        "watercolor-whipped-cream-opaque.png",
        "watercolor-latte-toothpick.png",
    }:
        asset = remove_magenta_background(source)
    else:
        asset = remove_connected_background(source)
    asset = trim_and_square(asset)
    if filename in {
        "watercolor-whipped-cream-opaque.png",
        "watercolor-latte-toothpick.png",
    }:
        asset = clear_magenta_resampling_fringe(asset)
    if name == "packaging/writable-name-tag":
        asset = remove_enclosed_white_holes(asset)
    elif name == "tart-toppings/whipped-cream":
        asset = fill_whipped_cream_silhouette(asset)

    destination = OUTPUT / f"{name}.png"
    destination.parent.mkdir(parents=True, exist_ok=True)
    asset.save(destination, "PNG", optimize=True)
    info = {
        "file": f"{name}.png",
        "width": asset.width,
        "height": asset.height,
        "sourceSheet": filename,
    }
    if name == "cursors/latte-toothpick":
        info["hotspot"] = [0.10, 0.90]
    manifest["assets"][name] = info


def build_pink_cups(manifest: dict) -> None:
    filename = "watercolor-pink-cups-refined-sheet.png"
    sheet = remove_connected_background(Image.open(SOURCE / filename))
    names = [
        "cups/pink-empty",
        "cups/pink-coffee",
        "cups/pink-matcha",
        "cups/pink-ube",
    ]
    cell_width = sheet.width / 2
    cell_height = sheet.height / 2

    for index, name in enumerate(names):
        column = index % 2
        row = index // 2
        asset = sheet.crop(
            (
                round(column * cell_width),
                round(row * cell_height),
                round((column + 1) * cell_width),
                round((row + 1) * cell_height),
            )
        )
        asset = trim_and_square(asset)
        destination = OUTPUT / f"{name}.png"
        destination.parent.mkdir(parents=True, exist_ok=True)
        asset.save(destination, "PNG", optimize=True)
        manifest["assets"][name] = {
            "file": f"{name}.png",
            "width": asset.width,
            "height": asset.height,
            "sourceSheet": filename,
            "cupColor": "pink",
        }


def build_solid_stamps(manifest: dict) -> None:
    filename = "watercolor-solid-metal-stamps.png"
    sheet = remove_connected_background(Image.open(SOURCE / filename))
    names = ["bread-stamps/paw", "bread-stamps/heart", "bread-stamps/star"]
    cell_width = sheet.width / 3

    for index, name in enumerate(names):
        asset = sheet.crop(
            (
                round(index * cell_width),
                0,
                round((index + 1) * cell_width),
                sheet.height,
            )
        )
        asset = trim_and_square(asset)
        destination = OUTPUT / f"{name}.png"
        destination.parent.mkdir(parents=True, exist_ok=True)
        asset.save(destination, "PNG", optimize=True)
        manifest["assets"][name] = {
            "file": f"{name}.png",
            "width": asset.width,
            "height": asset.height,
            "sourceSheet": filename,
            "solidStampFace": True,
        }


def build_contact_sheet(manifest: dict) -> None:
    """Create a checkerboard index so transparency and naming are easy to review."""
    entries = [
        (name, info)
        for name, info in manifest["assets"].items()
        if info.get("transparent", True)
    ]
    columns = 6
    cell_width = 200
    cell_height = 230
    rows = (len(entries) + columns - 1) // columns
    preview = Image.new(
        "RGB", (columns * cell_width, rows * cell_height), (247, 243, 238)
    )

    for index, (name, info) in enumerate(entries):
        column = index % columns
        row = index // columns
        origin_x = column * cell_width
        origin_y = row * cell_height

        checker = Image.new("RGBA", (180, 180), (255, 255, 255, 255))
        pixels = np.array(checker)
        tile = 12
        yy, xx = np.mgrid[0:180, 0:180]
        dark = ((xx // tile + yy // tile) % 2) == 0
        pixels[dark, :3] = (225, 225, 225)
        checker = Image.fromarray(pixels, "RGBA")

        asset = Image.open(OUTPUT / info["file"]).convert("RGBA")
        asset.thumbnail((164, 164), Image.Resampling.LANCZOS)
        checker.alpha_composite(
            asset, ((180 - asset.width) // 2, (180 - asset.height) // 2)
        )
        preview.paste(checker.convert("RGB"), (origin_x + 10, origin_y + 8))

        from PIL import ImageDraw

        draw = ImageDraw.Draw(preview)
        short_name = name.split("/")[-1]
        draw.text((origin_x + 10, origin_y + 194), short_name, fill=(51, 48, 44))
        draw.text(
            (origin_x + 10, origin_y + 210),
            name.rsplit("/", 1)[0],
            fill=(138, 123, 114),
        )

    preview.save(OUTPUT / "preview-contact-sheet.png", "PNG", optimize=True)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    source_output = OUTPUT / "source-sheets"
    source_output.mkdir(exist_ok=True)

    manifest = {
        "name": "Concept Cafe watercolor asset pack",
        "format": "transparent PNG",
        "canvasSize": 512,
        "assets": {},
    }

    for stale in STALE_ASSETS:
        path = OUTPUT / stale
        if path.exists():
            path.unlink()
    for stale in STALE_SOURCE_SHEETS:
        path = source_output / stale
        if path.exists():
            path.unlink()

    for filename, config in SHEETS.items():
        split_sheet(filename, config, manifest)
        shutil.copy2(SOURCE / filename, source_output / filename)

    build_pink_cups(manifest)
    shutil.copy2(
        SOURCE / "watercolor-pink-cups-refined-sheet.png",
        source_output / "watercolor-pink-cups-refined-sheet.png",
    )

    for name, filename in REPLACEMENTS.items():
        build_single(name, filename, manifest)
        shutil.copy2(SOURCE / filename, source_output / filename)

    build_solid_stamps(manifest)
    shutil.copy2(
        SOURCE / "watercolor-solid-metal-stamps.png",
        source_output / "watercolor-solid-metal-stamps.png",
    )

    paper_source = SOURCE / "blank-watercolor-paper-texture.png"
    paper_destination = OUTPUT / "backgrounds" / "blank-watercolor-paper.png"
    paper_destination.parent.mkdir(parents=True, exist_ok=True)
    neutral_paper = neutralize_light_paper(
        Image.open(paper_source).convert("RGBA"), whole_image=True
    )
    neutral_paper.convert("RGB").save(paper_destination, "PNG", optimize=True)
    shutil.copy2(paper_source, source_output / paper_source.name)
    manifest["assets"]["backgrounds/blank-watercolor-paper"] = {
        "file": "backgrounds/blank-watercolor-paper.png",
        "width": 1024,
        "height": 1024,
        "transparent": False,
        "usage": "seamless background texture",
    }

    (OUTPUT / "manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    build_contact_sheet(manifest)
    print(f"Created {len(manifest['assets'])} assets in {OUTPUT}")


if __name__ == "__main__":
    main()
