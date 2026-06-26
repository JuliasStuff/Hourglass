#!/usr/bin/env python3
"""
Generate Hourglass PWA icons from icon.svg.

Outputs (next to this script, in icons/):
  - icon-192.png
  - icon-512.png
  - favicon-16.png
  - favicon-32.png
  - favicon.ico  (16/32/48/64)

Requires Pillow. cairosvg is used when available for crisp SVG rasterization;
otherwise a Pillow-only fallback is drawn (slightly simpler but still nice).

Run from the Hourglass folder:
    python icons/generate_icons.py
"""
from pathlib import Path
import sys

from PIL import Image, ImageDraw

HERE   = Path(__file__).resolve().parent
SVG    = HERE / "icon.svg"
PEACH        = (255, 142, 90)
PEACH_LIGHT  = (255, 210, 138)
CREAM_TOP    = (255, 241, 214)
CREAM_MID    = (255, 216, 230)
CREAM_BOT    = (207, 231, 255)
SAND_LIGHT   = (255, 226, 122)
SAND_DEEP    = (246, 185, 74)
GLASS        = (255, 255, 255, 220)


def rasterize_with_cairosvg(size: int) -> Image.Image:
    import cairosvg  # type: ignore
    from io import BytesIO
    png_bytes = cairosvg.svg2png(
        url=str(SVG), output_width=size, output_height=size
    )
    return Image.open(BytesIO(png_bytes)).convert("RGBA")


def gradient_background(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size))
    for y in range(size):
        t = y / max(1, size - 1)
        if t < 0.55:
            u = t / 0.55
            r = int(CREAM_TOP[0] * (1 - u) + CREAM_MID[0] * u)
            g = int(CREAM_TOP[1] * (1 - u) + CREAM_MID[1] * u)
            b = int(CREAM_TOP[2] * (1 - u) + CREAM_MID[2] * u)
        else:
            u = (t - 0.55) / 0.45
            r = int(CREAM_MID[0] * (1 - u) + CREAM_BOT[0] * u)
            g = int(CREAM_MID[1] * (1 - u) + CREAM_BOT[1] * u)
            b = int(CREAM_MID[2] * (1 - u) + CREAM_BOT[2] * u)
        for x in range(size):
            img.putpixel((x, y), (r, g, b, 255))
    return img


def vertical_gradient(w: int, h: int, top, bot) -> Image.Image:
    img = Image.new("RGBA", (w, h))
    for y in range(h):
        u = y / max(1, h - 1)
        r = int(top[0] * (1 - u) + bot[0] * u)
        g = int(top[1] * (1 - u) + bot[1] * u)
        b = int(top[2] * (1 - u) + bot[2] * u)
        for x in range(w):
            img.putpixel((x, y), (r, g, b, 255))
    return img


def rasterize_fallback(size: int) -> Image.Image:
    """Pillow-only render that mimics icon.svg reasonably well."""
    # Work at 4x then downsample for smoother edges.
    scale = 4
    S = size * scale
    bg = gradient_background(S)

    # Round the corners with a mask.
    mask = Image.new("L", (S, S), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 96 / 512),
                         fill=255)
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.paste(bg, (0, 0), mask)

    d = ImageDraw.Draw(out, "RGBA")

    # Coordinate helper (SVG was 512 units wide).
    def p(x: float, y: float):
        return (x * S / 512, y * S / 512)

    # Wooden caps with vertical gradient — paint as filled rounded rects of solid then a translucent gradient overlay.
    def rounded_rect_gradient(box_xy, top, bot, radius):
        x1, y1, x2, y2 = box_xy
        w = int(x2 - x1)
        h = int(y2 - y1)
        grad = vertical_gradient(w, h, top, bot)
        mask = Image.new("L", (w, h), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            [0, 0, w - 1, h - 1], radius=radius, fill=255
        )
        out.paste(grad, (int(x1), int(y1)), mask)

    cap_radius = int(14 * S / 512)
    rounded_rect_gradient(
        (*p(120, 96), *p(392, 132)),
        PEACH_LIGHT, PEACH, cap_radius
    )
    rounded_rect_gradient(
        (*p(120, 380), *p(392, 416)),
        PEACH_LIGHT, PEACH, cap_radius
    )

    # Glass bulbs (top & bottom). Approximated with polygons.
    glass_poly_top = [
        p(150, 132), p(362, 132),
        p(346, 170), p(316, 210),
        p(264, 252), p(248, 252),
        p(196, 210), p(166, 170),
    ]
    glass_poly_bot = [
        p(150, 380), p(362, 380),
        p(346, 342), p(316, 302),
        p(264, 260), p(248, 260),
        p(196, 302), p(166, 342),
    ]
    d.polygon(glass_poly_top, fill=(255, 255, 255, 210),
              outline=PEACH + (255,))
    d.polygon(glass_poly_bot, fill=(255, 255, 255, 210),
              outline=PEACH + (255,))

    # Outline strokes (thicker by overdrawing lines).
    stroke_w = max(2, int(6 * S / 512))
    for poly in (glass_poly_top, glass_poly_bot):
        for i in range(len(poly)):
            x1, y1 = poly[i]
            x2, y2 = poly[(i + 1) % len(poly)]
            d.line([(x1, y1), (x2, y2)], fill=PEACH + (255,),
                   width=stroke_w)

    # Sand in top bulb (smaller polygon, sand colored).
    sand_top = [
        p(200, 156), p(312, 156),
        p(296, 188), p(272, 220),
        p(252, 232), p(244, 232),
        p(216, 200), p(202, 174),
    ]
    d.polygon(sand_top, fill=SAND_LIGHT + (255,))
    # Add a slightly darker bottom shading on sand
    sand_top_shade = [
        p(216, 200), p(252, 232), p(244, 232), p(202, 174),
    ]
    d.polygon(sand_top_shade, fill=SAND_DEEP + (200,))

    # Falling sand stream
    sx1, sy1 = p(252, 244)
    sx2, sy2 = p(260, 304)
    d.rounded_rectangle([sx1, sy1, sx2, sy2],
                        radius=int(3 * S / 512),
                        fill=SAND_DEEP + (255,))

    # Sand pile in bottom bulb (mound)
    mound = [p(180, 380), p(208, 350), p(232, 338),
             p(256, 332), p(280, 338), p(304, 350),
             p(332, 380)]
    d.polygon(mound, fill=SAND_DEEP + (255,))
    mound_top = [p(210, 380), p(232, 350), p(256, 340),
                 p(280, 350), p(302, 380)]
    d.polygon(mound_top, fill=SAND_LIGHT + (255,))

    # Center pinch glint
    cx, cy = p(256, 256)
    r = 6 * S / 512
    d.ellipse([cx - r, cy - r, cx + r, cy + r],
              fill=PEACH + (255,))

    return out.resize((size, size), Image.LANCZOS)


def rasterize(size: int) -> Image.Image:
    try:
        return rasterize_with_cairosvg(size)
    except Exception as exc:
        print(f"  cairosvg unavailable ({exc!s}); using Pillow fallback")
        return rasterize_fallback(size)


def main() -> int:
    print("Generating Hourglass icons...")
    sizes = {
        "icon-192.png": 192,
        "icon-512.png": 512,
        "favicon-32.png": 32,
        "favicon-16.png": 16,
    }
    rendered = {}
    for name, size in sizes.items():
        img = rasterize(size)
        path = HERE / name
        img.save(path)
        rendered[size] = img
        print(f"  Created {path.name}  ({size}x{size})")

    # favicon.ico: render at 256 then bundle multiple sizes
    big = rasterize(256)
    ico_path = HERE / "favicon.ico"
    big.save(ico_path, format="ICO",
             sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    print(f"  Created {ico_path.name}  (16/32/48/64)")
    print("Done!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
