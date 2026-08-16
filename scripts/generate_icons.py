"""Generate the PWA icon set (apple-touch-icon + manifest icons).

One-off helper, not part of the running app. Uses Pillow to draw a simple
rounded-square mark echoing the app's timeline UI, then resizes it down.
Run: python scripts/generate_icons.py
"""

import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "icons")

BG = (31, 111, 107, 255)       # teal accent, matches app palette
CARD = (247, 248, 250, 255)    # near-white card
LINE = (31, 111, 107, 255)     # teal lines on the card
LINE_MUTED = (198, 217, 214, 255)

SIZE = 512


def draw_master():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # rounded-square background
    draw.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=112, fill=BG)

    # white "card" representing the timeline sheet
    card_margin = 108
    card_box = [card_margin, card_margin, SIZE - card_margin, SIZE - card_margin]
    draw.rounded_rectangle(card_box, radius=36, fill=CARD)

    # a few horizontal rule lines (timeline rows), one accented
    rows_x0 = card_margin + 40
    rows_x1 = SIZE - card_margin - 40
    row_ys = [176, 224, 272, 320, 368]
    accented_row = 2  # third row stands out, like a filled schedule entry
    for i, y in enumerate(row_ys):
        color = LINE if i == accented_row else LINE_MUTED
        width = 14
        x1 = rows_x1 if i == accented_row else rows_x0 + (rows_x1 - rows_x0) * 0.62
        draw.rounded_rectangle([rows_x0, y, x1, y + width], radius=7, fill=color)

    return img


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    master = draw_master()

    targets = {
        "icon-512.png": 512,
        "icon-192.png": 192,
        "icon-180.png": 180,
    }
    for filename, size in targets.items():
        resized = master.resize((size, size), Image.LANCZOS)
        path = os.path.join(OUT_DIR, filename)
        resized.save(path)
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
