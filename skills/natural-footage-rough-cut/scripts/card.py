"""card.py <out.png> <width> <height> <title> <subtitle> <body>

Draws one review-reel title card: dark background, large title, a subtitle
line and an optional wrapped body. Uses PIL (the installed ffmpeg has no
drawtext filter).
"""
import sys
import textwrap

from PIL import Image, ImageDraw, ImageFont

out, w, h, title, subtitle, body = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), *sys.argv[4:7]
FONT = "/System/Library/Fonts/Helvetica.ttc"
s = h / 1080


def font(size, bold=False):
    try:
        return ImageFont.truetype(FONT, int(size * s), index=1 if bold else 0)
    except OSError:
        return ImageFont.load_default()


img = Image.new("RGB", (w, h), (18, 20, 24))
d = ImageDraw.Draw(img)
x = int(140 * s)
y = int(h * 0.30)
d.text((x, y), title, font=font(110, bold=True), fill=(245, 245, 240))
y += int(150 * s)
d.text((x, y), subtitle, font=font(48), fill=(240, 190, 80))
y += int(110 * s)
for line in textwrap.wrap(body, width=60)[:6]:
    d.text((x, y), line, font=font(44), fill=(200, 200, 205))
    y += int(62 * s)
img.save(out)
