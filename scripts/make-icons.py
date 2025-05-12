"""Render the app icon PNGs (same geometry as public/icons/icon.svg)."""
from PIL import Image, ImageDraw
import sys, os
out = sys.argv[1]
def render(size, pad_scale=1.0):
    S = 4 * size  # supersample
    img = Image.new("RGB", (S, S), "#4A3FC0")
    d = ImageDraw.Draw(img)
    k = S / 512 * pad_scale
    off = (S - 512 * k) / 2
    def rr(x, y, w, h, r, fill):
        d.rounded_rectangle([off + x*k, off + y*k, off + (x+w)*k, off + (y+h)*k], radius=r*k, fill=fill)
    rr(120, 120, 124, 124, 34, "#FFFFFF")
    rr(268, 120, 124, 124, 34, "#DDD8F7")
    rr(120, 268, 124, 124, 34, "#DDD8F7")
    rr(268, 268, 124, 124, 62, "#FFFFFF")
    return img.resize((size, size), Image.LANCZOS)
for s in (180, 192, 512):
    render(s).save(os.path.join(out, f"icon-{s}.png"))
render(512, 0.8).save(os.path.join(out, "maskable-512.png"))
