# Concept Café watercolor asset pack

This folder contains individually cropped, web-ready assets in a delicate
pastel watercolor and hand-drawn ink style.

## Format

- Every interactive asset is a transparent 512 × 512 PNG.
- `backgrounds/blank-watercolor-paper.png` is intentionally opaque.
- `preview-contact-sheet.png` shows the transparent assets on a checkerboard.
- `manifest.json` lists every file and its original source sheet.
- `source-sheets/` contains the generated sheets used to build the pack.

## Contents

- `cups/` — one refined pink cup style: empty, coffee, matcha, and ube
- `cursors/` — idle, hover, and pouring milk pitchers plus a latte toothpick
- `tart/` — plain custard tart
- `tart-toppings/` — solid whipped cream, strawberry, blueberry, one mango slice,
  and mandarin
- `bread-stamps/` — paw, heart, and star metal stamp cursors
- `bread/` — plain bread; pressed and toasted shapes; seasoned egg in untoasted
  bread; and chocolate-filled paw, heart, and star shapes in both untoasted and
  toasted bread
- `stationery/` — blank letter, open envelope, and combined letter/envelope
- `packaging/` — transparent-center pink name sticker and a brown kraft goodie bag
- `backgrounds/` — cool neutral-white watercolor paper texture

Rebuild the pack with:

```powershell
python "scripts\build_watercolor_asset_pack.py"
```
