"""Render quote diagrams from a UTF-8 page specification."""

import argparse
import json
from tempfile import TemporaryDirectory
from functools import lru_cache
from pathlib import Path
import random
import re
import sys

from PIL import Image, ImageDraw, ImageFont

FONTS = Path(__file__).resolve().parents[1] / "assets" / "fonts"
W = 1440
M = 76
R = W - M
CW = R - M
BG = "#FAF8F3"
IVORY = "#FFFDF9"
INK = "#171C25"
MUTED = "#4B5362"
COBALT = "#2046A9"
NAVY = "#17233D"
BLUE = "#DDE7F9"
PINK = "#F1CFD8"
LINE = "#D2CCC0"

SANS = "NotoSansSC.ttf"
TEXT_SERIF = "NotoSerifSC.ttf"


@lru_cache(None)
def font(size, kind, weight):
    family = {"sans": SANS, "display": TEXT_SERIF, "serif": TEXT_SERIF, "mono": SANS}[kind]
    ft = ImageFont.truetype(str(FONTS / family), size)
    if family in (SANS, TEXT_SERIF):
        target = 865 if kind == "display" else 540 if kind == "mono" else weight
        ft.set_variation_by_axes([target])
    return ft


class Sheet:
    def __init__(self, page, total, height):
        self.page = page
        self.total = total
        self.height = height
        self.image = Image.new("RGB", (W, height), BG)
        self.d = ImageDraw.Draw(self.image)
        rng = random.Random(93 + page)
        for _ in range(4550):
            x, y = rng.randrange(W), rng.randrange(height)
            self.d.line((x, y, x + rng.choice((0, 1, 2, 3)), y), fill=rng.choice(("#F2EEE6", "#F4F0E8", "#F5F1E9")))

    def measure(self, text, size, kind="sans", weight=400):
        return self.d.textlength(text, font=font(size, kind, weight))

    def label(self, text, x, y, size, color=INK, kind="sans", weight=400, anchor="lt"):
        self.d.text((x, y), text, fill=color, font=font(size, kind, weight), anchor=anchor)

    def wrap(self, text, width, size, kind="sans", weight=400):
        opening = "（《「『【“"
        closing = "，。！？、）》」』】”：；…"
        rows = []
        for para in text.split("\n"):
            row = ""
            tokens = re.findall(r"[A-Za-z0-9]+(?:[.:–/-][A-Za-z0-9]+)*|.", para)
            for word in tokens:
                parts = [word] if self.measure(word, size, kind, weight) <= width else word
                for token in parts:
                    if not row and token.isspace():
                        continue
                    if row and self.measure(row + token, size, kind, weight) > width:
                        if (
                            len(row) > 1
                            and (row[-1] in opening or token[0] in closing)
                            and self.measure(row[-1] + token, size, kind, weight) <= width
                        ):
                            token = row[-1] + token
                            row = row[:-1]
                        rows.append(row.rstrip())
                        row = token.lstrip()
                    else:
                        row += token
            rows.append(row.rstrip())
        return rows

    def para(self, text, x, y, width, size=42, color=INK, kind="sans", weight=400, spacing=None):
        spacing = spacing or round(size * 1.47)
        for row in self.wrap(text, width, size, kind, weight):
            self.label(row, x, y, size, color, kind, weight)
            y += spacing
        return y

    def rect(self, x, y, w, h, fill):
        self.d.rectangle((x, y, x + w, y + h), fill=fill)

    def rule(self, y, x=M, end=R, color=LINE, size=2):
        self.d.line((x, y, end, y), fill=color, width=size)

    def torn(self, x, y, w, h, fill, jitter=10):
        r = random.Random(x + y + w + h)
        top = [(x + i*w/24, y + r.randint(-jitter, jitter)) for i in range(25)]
        bottom = [(x + i*w/24, y + h + r.randint(-jitter, jitter)) for i in range(24, -1, -1)]
        self.d.polygon(top + bottom, fill=fill)

    def cutout(self, path, x, y, w, h):
        with Image.open(path) as src:
            art = src.convert("RGBA")
        box = art.getchannel("A").getbbox()
        if box is None:
            raise ValueError(f"Illustration has no visible pixels: {path}")
        art = art.crop(box)
        art.thumbnail((w, h), Image.Resampling.LANCZOS)
        self.image.paste(art, (x + (w-art.width)//2, y + (h-art.height)//2), art)

    def heading(self, title, y, hint=None):
        self.rule(y, color=INK, size=3)
        self.label(title, M, y + 23, 53, INK, "display")
        if hint:
            self.label(hint, R, y + 40, 29, MUTED, weight=500, anchor="rt")
        return y + 110

    def hero(self, series, section, title, sub, art):
        self.rule(74, color=INK, size=3)
        series_width = self.measure(series, 33, weight=650)
        section_label = "引用解读  /  " + section
        if series_width + self.measure(section_label, 31, weight=500) > CW - 250:
            raise ValueError("Shorten the series name or section label.")
        self.label(series, M, 99, 33, COBALT, weight=650)
        self.label(section_label, M + series_width + 33, 98, 31, MUTED, weight=500)
        self.label(f"{self.page:02d} / {self.total:02d}", R, 101, 34, COBALT, "mono", anchor="rt")
        if art:
            self.cutout(art, 727, 145, 676, 478)
        max_title_width = 665 if art else CW
        if not 1 <= len(title) <= 2:
            raise ValueError("Use one or two title lines.")
        largest = max(self.measure(line, 98, "display") for line in title)
        display_size = min(98, int(98 * max_title_width / max(largest, 1)))
        if display_size < 68:
            raise ValueError("Shorten the title or split it across two lines.")
        for i, row in enumerate(title):
            self.label(row, M - 4, (200 if len(title) == 2 else 273) + i * 124, display_size, INK, "display")
        end = self.para(sub, M, 479, max_title_width, 40, MUTED, weight=500, spacing=54)
        if end > 638:
            raise ValueError("Shorten the subtitle to three readable lines.")
        self.rule(640, color=INK, size=3)
        return 674

    def strip(self, y, label, text, dark=False):
        fill, color = (NAVY, IVORY) if dark else (BLUE, NAVY)
        lines = self.wrap(text, CW - 76, 45, "serif", 650)
        h = 104 + 63 * len(lines)
        self.torn(M + 4, y, CW - 8, h, fill, 8)
        self.label(label, M + 36, y + 27, 28, PINK if dark else COBALT, weight=650)
        for i, line in enumerate(lines):
            self.label(line, M + 36, y + 78 + i * 63, 45, color, "serif", 650)
        return y + h + 53

    def two(self, y, items):
        gap = 27
        w = (CW - gap) // 2
        contents = [self.wrap(body, w - 62, 40) for _, body in items]
        h = 108 + max(map(len, contents)) * 58
        for i, ((title, _), lines) in enumerate(zip(items, contents)):
            x = M + i * (w + gap)
            self.rect(x, y, w, h, IVORY)
            self.rect(x, y, w, 9, PINK if i == 0 else BLUE)
            self.label(title, x + 30, y + 27, 43, COBALT, weight=680)
            for j, row in enumerate(lines):
                self.label(row, x + 30, y + 95 + j * 58, 40)
        return y + h + 47

    def explain(self, y, narration, chart, label=""):
        left_width, gx = 454, M + 492
        if label:
            self.label(label, M, y + 4, 28, COBALT, weight=700)
        text_finish = self.para(narration, M, y + 56, left_width, 40, INK, "serif", 510, 62)
        w = R - gx
        self.rect(gx, y, w, len(chart)*69+35, "#F0EEE7")
        for i, (key, body) in enumerate(chart):
            if self.measure(key, 33, weight=730) > 190 or self.measure(body, 31, weight=490) > w - 270:
                raise ValueError(f"Shorten the right-hand chart entry: {key}")
            rect_y = y+18+i*69
            dark = i == len(chart)-1
            self.rect(gx+18, rect_y, w-36, 61, COBALT if dark else IVORY)
            self.label(key, gx+36, rect_y+10, 33, IVORY if dark else COBALT, weight=730)
            self.label(body, gx+240, rect_y+12, 31, IVORY if dark else INK, weight=490)
        return max(y+len(chart)*69+35, text_finish)+43

    def row(self, y, name, body, *, label_width=212, body_size=41, stripe=False):
        if type(label_width) is not int or not 50 <= label_width <= CW - 110:
            raise ValueError("Table label_width must leave room for both columns.")
        x = M + label_width + 36
        label_lines = self.wrap(name, label_width, 38, weight=680)
        body_lines = self.wrap(body, R - x - 20, body_size)
        label_spacing = 53
        body_spacing = round(body_size * 1.40)
        h = 36 + max(label_spacing * len(label_lines), body_spacing * len(body_lines))
        if stripe:
            self.rect(M, y, CW, h, IVORY)
        for i, line in enumerate(label_lines):
            self.label(line, M + 14, y + 17 + i * label_spacing, 38, COBALT, weight=680)
        for i, line in enumerate(body_lines):
            self.label(line, x, y + 17 + i * body_spacing, body_size)
        self.rule(y+h)
        return y+h

    def steps(self, y, items):
        gap = 20
        w = (CW - (len(items)-1)*gap) // len(items)
        rows = [self.wrap(body, w-38, 34, weight=430) for _, body in items]
        h = 117 + max(map(len, rows))*46
        for i, ((title, _), copy) in enumerate(zip(items, rows)):
            x = M + i*(w+gap)
            self.rect(x, y, w, h, BLUE if i % 2 == 0 else IVORY)
            self.label(f"0{i+1}", x+19, y+20, 28, COBALT, "mono")
            self.label(title, x+19, y+62, 37, INK, weight=700)
            for j, row in enumerate(copy):
                self.label(row, x+19, y+111+j*46, 34, INK, weight=430)
            if i < len(items)-1:
                cy = y+83
                self.d.polygon([(x+w-7, cy-10), (x+w+13, cy), (x+w-7, cy+10)], fill=COBALT)
        return y+h+47

    def inset(self, y, label, body, color=PINK):
        lines = self.wrap(body, CW-90, 41)
        h = 88 + 58 * len(lines)
        self.rect(M, y, CW, h, IVORY)
        self.rect(M, y, 8, h, COBALT)
        self.torn(M + 32, y + 17, min(CW - 70, int(self.measure(label, 38, weight=700) + 37)), 48, color, 6)
        self.label(label, M + 49, y + 20, 38, INK, weight=700)
        for i, line in enumerate(lines):
            self.label(line, M+47, y+81+i*58, 41)
        return y+h+40

    def stages(self, y, items):
        col = (CW-36)//3
        for i, (name, text) in enumerate(items):
            if self.measure(name, 35, weight=700) > col - 86 or len(self.wrap(text, col-30, 28, weight=480)) > 1:
                raise ValueError(f"Shorten the grid entry: {name}")
            x = M + i % 3 * (col+18)
            row_y = y + i // 3 * 134
            self.rect(x, row_y, col, 123, (IVORY, BLUE, "#EEE5EA")[i//3])
            self.label(str(i+1).zfill(2), x + 17, row_y+19, 27, COBALT, "mono")
            self.label(name, x + 71, row_y+15, 35, INK, weight=700)
            self.para(text, x+18, row_y+65, col-30, 28, MUTED, weight=480, spacing=38)
        return y+134*((len(items)+2)//3)+28

    def timeline(self, y, when, title, prompts, tone):
        self.d.ellipse((M+61, y+45, M+91, y+75), fill=COBALT)
        self.label(when, M, y+5, 31, COBALT, weight=750)
        x = M + 145
        rows = [(key, self.wrap(body, R-x-201, 38)) for key, body in prompts]
        h = 106 + sum(54*len(lines)+11 for _, lines in rows)
        self.d.line((M+76, y+60, M+76, y+h+18), fill=COBALT, width=3)
        self.rect(x, y, R-x, h, tone)
        self.label(title, x+26, y+21, 47, INK, "display")
        yy = y+99
        for key, lines in rows:
            self.label(key, x+28, yy, 34, COBALT, weight=700)
            for j, line in enumerate(lines):
                self.label(line, x+176, yy+j*54, 38)
            yy += len(lines)*54+11
        return y+h+31


    def footer(self, body_end, source, chapters):
        y = self.height - 105
        if body_end > y:
            raise ValueError(f"Page content ends at {body_end}px, with only {y}px before the footer. Shorten, split, or extend the page.")
        if self.measure(source, 29, weight=500) + self.measure(chapters, 31, weight=650) > CW - 45:
            raise ValueError("Shorten the source line and put the full citation in the handoff.")
        self.rule(y, color=INK, size=3)
        self.label(source, M, y+26, 29, MUTED, weight=500)
        self.label(chapters, R, y+25, 31, COBALT, weight=650, anchor="rt")


def render_block(sheet, y, block):
    kind = block["type"]
    if kind == "heading":
        return sheet.heading(block["title"], y, block.get("hint"))
    if kind == "banner":
        return sheet.strip(y, block["label"], block["text"], block.get("dark", False))
    if kind == "side":
        return sheet.explain(y, block["text"], block["items"], block.get("label", ""))
    if kind == "compare":
        if len(block["items"]) != 2:
            raise ValueError("Compare requires exactly two entries.")
        return sheet.two(y, block["items"])
    if kind == "steps":
        if not 2 <= len(block["items"]) <= 5:
            raise ValueError("Steps requires two to five entries.")
        return sheet.steps(y, block["items"])
    if kind == "table":
        for i, (label, text) in enumerate(block["items"]):
            y = sheet.row(y, label, text, label_width=block.get("label_width", 212), stripe=i%2 == 0)
        return y + 42
    if kind == "grid":
        return sheet.stages(y, block["items"])
    if kind == "timeline":
        return sheet.timeline(y, block["when"], block["title"], block["items"], BLUE if block.get("accent") else IVORY)
    if kind == "text":
        return sheet.para(block["text"], M, y, CW) + 38
    if kind == "callout":
        return sheet.inset(y, block["label"], block["text"])
    raise ValueError(f"Unknown block type: {kind}")


def page_height(page):
    height = page.get("height", 2880)
    if type(height) is not int or not 1200 <= height <= 6000:
        raise ValueError("Page height must be an integer between 1200 and 6000 pixels.")
    return height


def render_page(page, index, total, spec, directory, *, height=None):
    height = page_height(page) if height is None else height
    art = directory / page["art"] if page.get("art") else None
    sheet = Sheet(index, total, height)
    try:
        y = sheet.hero(spec["series"], page["section"], page["title"], page["subtitle"], art)
        for block in page["blocks"]:
            y = render_block(sheet, y, block)
        sheet.footer(y, page.get("source", spec["source"]), page.get("chapters", ""))
    except Exception:
        sheet.image.close()
        raise
    return sheet.image


def render(spec_path, output, *, preview=False):
    spec = json.loads(spec_path.read_text(encoding="utf-8-sig"))
    pages = spec["pages"]
    if not pages:
        raise ValueError("The specification contains no pages.")
    filenames = []
    for i, page in enumerate(pages, 1):
        slug = page["slug"]
        if not slug or any(char in slug for char in '<>:"/\\|?*') or slug.endswith((".", " ")):
            raise ValueError(f"Invalid page slug: {slug!r}")
        filenames.append(f"{i:02d}-{slug}.png")
    height_policy = spec.get("height_policy", "uniform")
    if height_policy not in ("uniform", "per-page"):
        raise ValueError("height_policy must be uniform or per-page.")
    heights = [page_height(page) for page in pages]
    if height_policy == "uniform":
        heights = [max(heights)] * len(pages)
    for filename in filenames:
        if (output / filename).exists():
            raise FileExistsError(f"Choose a new output directory. File exists: {output / filename}")
    if preview and (output / "preview").exists():
        raise FileExistsError(f"Choose a new output directory. Preview directory exists: {output / 'preview'}")
    output.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(dir=output) as temp:
        stage = Path(temp)
        if preview:
            (stage / "preview").mkdir()
        for i, (page, filename, height) in enumerate(zip(pages, filenames, heights), 1):
            try:
                with render_page(page, i, len(pages), spec, spec_path.parent, height=height) as image:
                    image.save(stage / filename, optimize=True)
                    if preview:
                        size = 390, round(image.height * 390 / image.width)
                        with image.resize(size, Image.Resampling.LANCZOS) as thumbnail:
                            thumbnail.save(stage / "preview" / filename)
            except (OSError, ValueError, KeyError, TypeError) as error:
                raise ValueError(f"Page {i} ({page['slug']}): {error}") from error
        for filename in filenames:
            (stage / filename).rename(output / filename)
            print(output / filename)
        if preview:
            (stage / "preview").rename(output / "preview")


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("spec", type=Path, help="UTF-8 JSON page specification")
    cli.add_argument("--out", type=Path, required=True, help="Output directory for PNGs")
    cli.add_argument("--fonts-dir", type=Path, default=FONTS, help="Directory containing the two Noto variable TTFs")
    cli.add_argument("--preview", action="store_true", help="Also export 390px-wide PNGs under preview/")
    args = cli.parse_args()
    FONTS = args.fonts_dir.resolve()
    try:
        render(args.spec.resolve(), args.out.resolve(), preview=args.preview)
    except (ValueError, OSError, KeyError, TypeError) as error:
        cli.exit(1, f"{error}\n")
