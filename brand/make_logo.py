"""Builds the VibrantLearn wordmark logo set (direction 4: "vibrantlearn." in Bricolage Grotesque 800).

Glyphs are converted to outlines, so the SVGs need no font installed.
Usage: python make_logo.py <path-to-BricolageGrotesque-800.woff2-or-ttf> <out_dir>
(Font: npm pack @fontsource/bricolage-grotesque -> files/bricolage-grotesque-latin-800-normal.woff2, SIL OFL.)
"""
import sys, pathlib
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
import cairosvg

FONT, OUT = sys.argv[1], pathlib.Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)

INK, MIST, EMBER = "#1C1633", "#F5F2FB", "#FF6A3D"
TRACK = -0.042  # em, tight display tracking (r and a must not touch)

font = TTFont(FONT)
gs, cmap, hmtx = font.getGlyphSet(), font.getBestCmap(), font["hmtx"]
UPM = font["head"].unitsPerEm

def glyphs(text, size, x0=0.0, base=0.0):
    """Return list of (char, svg_path, bbox) and the advance end x."""
    sc, x, out = size / UPM, x0, []
    for ch in text:
        g = cmap[ord(ch)]
        pen, bp = SVGPathPen(gs), BoundsPen(gs)
        t = (sc, 0, 0, -sc, x, base)
        gs[g].draw(TransformPen(pen, t)); gs[g].draw(TransformPen(bp, t))
        out.append((ch, pen.getCommands(), bp.bounds))
        x += hmtx[g][0] * sc + TRACK * size
    return out, x

def bbox(gl):
    bs = [b for _, _, b in gl if b]
    return min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs)

def wordmark(word_fill, dot_fill=EMBER, pad=24, size=200):
    gl, _ = glyphs("vibrantlearn.", size)
    x0, y0, x1, y1 = bbox(gl)
    w, h = x1 - x0 + 2 * pad, y1 - y0 + 2 * pad
    body = "".join(f'<path d="{d}" fill="{dot_fill if ch == "." else word_fill}"/>' for ch, d, _ in gl)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.1f} {h:.1f}" width="{w:.0f}" height="{h:.0f}" role="img" aria-labelledby="t">'
            f'<title id="t">VibrantLearn</title><g transform="translate({pad - x0:.2f} {pad - y0:.2f})">{body}</g></svg>\n')

def app_icon(with_dot=True, tile=INK, letter=MIST, radius=116):
    # "v." centred optically on a 512 tile; tiny sizes drop the dot for legibility
    text = "v." if with_dot else "v"
    gl, _ = glyphs(text, 380 if with_dot else 420)
    x0, y0, x1, y1 = bbox(gl)
    gw, gh = x1 - x0, y1 - y0
    tx = (512 - gw) / 2 - x0
    ty = (512 - gh) / 2 - y0 - 6  # nudge up: optical centre sits above geometric centre
    body = "".join(f'<path d="{d}" fill="{EMBER if ch == "." else letter}"/>' for ch, d, _ in gl)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-labelledby="t">'
            f'<title id="t">VibrantLearn</title><rect width="512" height="512" rx="{radius}" fill="{tile}"/>'
            f'<g transform="translate({tx:.2f} {ty:.2f})">{body}</g></svg>\n')

files = {
    "logo-wordmark.svg": wordmark(INK),
    "logo-wordmark-dark.svg": wordmark(MIST),
    "logo-wordmark-mono.svg": wordmark(INK, dot_fill=INK),
    "app-icon.svg": app_icon(True),
    "favicon.svg": app_icon(False, radius=128),
}
for name, svg in files.items():
    (OUT / name).write_text(svg)

def png(src, dst, w):
    cairosvg.svg2png(url=str(OUT / src), write_to=str(OUT / dst), output_width=w)

png("logo-wordmark.svg", "logo-wordmark.png", 1600)
png("logo-wordmark-dark.svg", "logo-wordmark-dark.png", 1600)
for s in (512, 192, 180):
    png("app-icon.svg", f"app-icon-{s}.png", s)
for s in (48, 32, 16):
    png("favicon.svg", f"favicon-{s}.png", s)
print("built:", ", ".join(sorted(p.name for p in OUT.iterdir() if p.suffix in {".svg", ".png"})))
