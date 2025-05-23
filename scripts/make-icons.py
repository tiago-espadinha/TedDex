"""Render the app icons from public/teddex.svg (needs Inkscape on PATH).

  python3 scripts/make-icons.py public/icons

Writes icon.svg (the bear on the icon background), the PNGs the manifest and iOS use, and
public/favicon.svg (the bear alone). iOS shows transparent touch icons on black, so the PNGs are opaque.
"""
import os
import re
import subprocess
import sys
import tempfile

BACKGROUND = "#DDD8F7"
# Bounding box of the bear in teddex.svg's 500x500 viewBox (ears to snout).
BEAR_X, BEAR_Y, BEAR_W, BEAR_H = 92, 82, 316, 310

out = sys.argv[1]
public = os.path.dirname(os.path.abspath(out.rstrip("/")))
source = open(os.path.join(public, "teddex.svg"), encoding="utf-8").read()
# The drawing without Inkscape's editor metadata, so browsers get a plain SVG.
art = re.search(r"<g\s+id=\"g8\">(.*)</g>\s*</svg>", source, re.S).group(1)
art = re.sub(r"<!--.*?-->", "", art, flags=re.S)
art = re.sub(r"\s(inkscape|sodipodi):[\w-]+=\"[^\"]*\"", "", art)
art = re.sub(r"\n\s*\n", "\n", art)


def icon(size, fill):
    """The bear centred on a square background, its larger side `fill` of the icon."""
    scale = size * fill / max(BEAR_W, BEAR_H)
    dx = (size - BEAR_W * scale) / 2 - BEAR_X * scale
    dy = (size - BEAR_H * scale) / 2 - BEAR_Y * scale
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}">\n'
        f'<rect width="{size}" height="{size}" fill="{BACKGROUND}"/>\n'
        f'<g transform="translate({dx:.2f} {dy:.2f}) scale({scale:.4f})">{art}</g>\n</svg>\n'
    )


def export(svg, path, size):
    # Next to the output, not in /tmp: snap's Inkscape has a private /tmp.
    with tempfile.NamedTemporaryFile("w", suffix=".svg", dir=os.path.dirname(path), delete=False) as f:
        f.write(svg)
    try:
        subprocess.run(
            ["inkscape", f.name, "--export-type=png", f"--export-filename={os.path.abspath(path)}",
             f"--export-width={size}", f"--export-height={size}", "--export-background-opacity=1", "--export-png-color-mode=RGB_8"],
            check=True, capture_output=True,
        )
    finally:
        os.unlink(f.name)


with open(os.path.join(out, "icon.svg"), "w", encoding="utf-8") as f:
    f.write(icon(512, 0.78))
with open(os.path.join(public, "favicon.svg"), "w", encoding="utf-8") as f:
    f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{BEAR_X} {BEAR_Y - 3} {BEAR_W} {BEAR_W}">{art}</svg>\n')
for s in (180, 192, 512):
    export(icon(512, 0.78), os.path.join(out, f"icon-{s}.png"), s)
# Maskable icons are cropped to a circle of 80% of the width: keep the bear inside it.
export(icon(512, 0.6), os.path.join(out, "maskable-512.png"), 512)
