from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path("app/static/icons")
OUT.mkdir(parents=True, exist_ok=True)


def make_icon(size):
    s = size / 512

    def p(x, y):
        return (x * s, y * s)

    img = Image.new("RGB", (size, size), "#4f46e5")
    d = ImageDraw.Draw(img)
    white = "#ffffff"

    # cart ka handle aur side
    d.line([p(110, 150), p(170, 150), p(220, 330), p(390, 330)], fill=white, width=max(1, int(26 * s)), joint="curve")
    # cart ki tokri
    d.polygon([p(185, 205), p(425, 205), p(390, 305), p(215, 305)], fill=white)
    # do pahiye
    r = 26 * s
    for cx in (245, 365):
        cy = 395
        d.ellipse([(cx * s - r, cy * s - r), (cx * s + r, cy * s + r)], fill=white)

    img.save(OUT / f"icon-{size}.png")


for size in (180, 192, 512):
    make_icon(size)

print("Icons ready in", OUT)