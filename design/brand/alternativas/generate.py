#!/usr/bin/env python3
"""Regenerá las tres propuestas y sus vistas previas sin paquetes ni red."""

import argparse
import math
from pathlib import Path
import re
import struct
import xml.etree.ElementTree as ET
import zlib


ROOT = Path(__file__).resolve().parent
SVG_NS = "{http://www.w3.org/2000/svg}"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
SAMPLES = 4
# Fondos de comparación pedidos por alternativas/BRIEF.md; no son tokens del producto.
LIGHT = (245, 245, 245)
DARK = (17, 17, 17)
INK = (29, 51, 67)  # docs/02-obelisco-tokens.md §1.2: primary, colors:135.
WHITE = (255, 255, 255)  # docs/02-obelisco-tokens.md §1.3: text-white, typo:170.


def rounded_rect(x, y, width, height, radius):
    radius = min(radius, width / 2, height / 2)
    if not radius:
        return [(x, y), (x + width, y), (x + width, y + height), (x, y + height)]
    points = []
    for cx, cy, start in ((x + width - radius, y + radius, -90),
                          (x + width - radius, y + height - radius, 0),
                          (x + radius, y + height - radius, 90),
                          (x + radius, y + radius, 180)):
        for step in range(25):
            angle = math.radians(start + step * 90 / 24)
            points.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle)))
    return points


def circle(cx, cy, radius):
    return [(cx + radius * math.cos(i * math.tau / 96),
             cy + radius * math.sin(i * math.tau / 96)) for i in range(96)]


def path_points(data):
    """Subconjunto explícito del SVG: M/L/H/V/Q/C/Z absolutos, un contorno."""
    tokens = re.findall(r"[A-Za-z]|-?\d+(?:\.\d+)?", data)
    points = []
    position = (0, 0)
    index = 0
    while index < len(tokens):
        command = tokens[index]
        index += 1
        if command == "Z":
            continue
        if command not in {"M", "L", "H", "V", "Q", "C"}:
            raise ValueError(f"Comando SVG no admitido: {command}")
        count = {"M": 2, "L": 2, "H": 1, "V": 1, "Q": 4, "C": 6}[command]
        args = list(map(float, tokens[index:index + count]))
        index += count
        if command in {"M", "L"}:
            position = tuple(args)
            points.append(position)
        elif command == "H":
            position = (args[0], position[1])
            points.append(position)
        elif command == "V":
            position = (position[0], args[0])
            points.append(position)
        else:
            controls = [position] + [tuple(args[i:i + 2]) for i in range(0, len(args), 2)]
            length = sum(math.dist(a, b) for a, b in zip(controls, controls[1:]))
            steps = max(16, math.ceil(length / 6))
            for step in range(1, steps + 1):
                t = step / steps
                u = 1 - t
                if command == "Q":
                    points.append(tuple(u * u * controls[0][axis] + 2 * u * t * controls[1][axis]
                                        + t * t * controls[2][axis] for axis in (0, 1)))
                else:
                    points.append(tuple(u ** 3 * controls[0][axis] + 3 * u * u * t * controls[1][axis]
                                        + 3 * u * t * t * controls[2][axis]
                                        + t ** 3 * controls[3][axis] for axis in (0, 1)))
            position = controls[-1]
    return points


def read_svg(letter):
    svg = ET.parse(ROOT / f"mark-{letter}.svg").getroot()
    assert svg.attrib["viewBox"] == "0 0 1024 1024"
    style = svg.find(SVG_NS + "style").text
    colors = {name: tuple(bytes.fromhex(value)) for name, value in
              re.findall(r"\.(\w+)\s*\{\s*fill:\s*#([0-9a-f]{6});\s*\}", style)}
    assert set(colors) == {"bg", "mark", "accent"}
    palette = [colors[name] for name in ("bg", "mark", "accent")]
    indices = {"bg": 0, "mark": 1, "accent": 2}
    shapes = []
    for element in svg.iter():
        tag = element.tag.removeprefix(SVG_NS)
        if tag in {"svg", "style", "title", "desc", "g"}:
            continue
        attrs = element.attrib
        if "transform" in attrs or "stroke" in attrs or "style" in attrs:
            raise ValueError("Solo rellenos por clase, sin transformaciones ni trazos")
        color = indices[attrs["class"]]
        if tag == "rect":
            points = rounded_rect(float(attrs.get("x", 0)), float(attrs.get("y", 0)),
                                  float(attrs["width"]), float(attrs["height"]),
                                  float(attrs.get("rx", 0)))
            if (attrs.get("width"), attrs.get("height"), color) == ("1024", "1024", 0):
                continue
        elif tag == "circle":
            points = circle(float(attrs["cx"]), float(attrs["cy"]), float(attrs["r"]))
        elif tag == "polygon":
            points = [tuple(map(float, pair.split(","))) for pair in attrs["points"].split()]
        elif tag == "path":
            points = path_points(attrs["d"])
        else:
            raise ValueError(f"Elemento SVG no admitido: {tag}")
        shapes.append((color, points))
    return palette, shapes


def raster(width, height, palette, shapes):
    """Relleno par-impar, composición en orden y cobertura de 4×4 muestras."""
    pixels = bytearray(bytes(palette[0]) * width * height)
    low_x = max(0, math.floor(min(x for _, points in shapes for x, _ in points)))
    high_x = min(width, math.ceil(max(x for _, points in shapes for x, _ in points)))
    low_y = max(0, math.floor(min(y for _, points in shapes for _, y in points)))
    high_y = min(height, math.ceil(max(y for _, points in shapes for _, y in points)))
    sample_width = width * SAMPLES
    for y in range(low_y, high_y):
        rows = []
        for sample_y in range(SAMPLES):
            scan = bytearray(sample_width)
            ordinate = y + (sample_y + 0.5) / SAMPLES
            for color, points in shapes:
                crossings = sorted(x1 + (ordinate - y1) * (x2 - x1) / (y2 - y1)
                                   for (x1, y1), (x2, y2) in zip(points, points[1:] + points[:1])
                                   if min(y1, y2) <= ordinate < max(y1, y2))
                for left, right in zip(crossings[::2], crossings[1::2]):
                    start = max(0, math.ceil(left * SAMPLES - 0.5))
                    end = min(sample_width, math.ceil(right * SAMPLES - 0.5))
                    scan[start:end] = bytes([color]) * (end - start)
            rows.append(scan)
        for x in range(low_x, high_x):
            samples = b"".join(row[x * SAMPLES:(x + 1) * SAMPLES] for row in rows)
            counts = [samples.count(i) for i in range(len(palette))]
            pixel = bytes(round(sum(count * color[channel] for count, color in zip(counts, palette)) / 16)
                          for channel in range(3))
            offset = (y * width + x) * 3
            pixels[offset:offset + 3] = pixel
    return pixels


def render_icon(letter, size, monochrome=False):
    palette, shapes = read_svg(letter)
    if monochrome:
        palette[2] = palette[1]
    scale = size / 1024
    return raster(size, size, palette,
                  [(color, [(x * scale, y * scale) for x, y in points]) for color, points in shapes])


def png_chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))


def write_png(path, width, height, pixels):
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    stride = width * 3
    raw = b"".join(b"\0" + pixels[y * stride:(y + 1) * stride] for y in range(height))
    path.write_bytes(PNG_SIGNATURE + png_chunk(b"IHDR", header)
                     + png_chunk(b"IDAT", zlib.compress(raw, 9)) + png_chunk(b"IEND", b""))


def read_png(path):
    """Verificá estructura, CRC y RGB sin alfa; devolvé los píxeles."""
    data = path.read_bytes()
    assert data.startswith(PNG_SIGNATURE), path.name
    offset = 8
    compressed = bytearray()
    kinds = []
    while offset < len(data):
        length = struct.unpack(">I", data[offset:offset + 4])[0]
        kind = data[offset + 4:offset + 8]
        payload = data[offset + 8:offset + 8 + length]
        crc = struct.unpack(">I", data[offset + 8 + length:offset + 12 + length])[0]
        assert zlib.crc32(kind + payload) == crc, path.name
        kinds.append(kind)
        if kind == b"IHDR":
            width, height, depth, color, compression, filtering, interlace = struct.unpack(">IIBBBBB", payload)
            assert (depth, color, compression, filtering, interlace) == (8, 2, 0, 0, 0), path.name
        if kind == b"IDAT":
            compressed.extend(payload)
        offset += length + 12
    assert kinds == [b"IHDR", b"IDAT", b"IEND"], (path.name, "metadatos inesperados")
    assert offset == len(data), path.name
    raw = zlib.decompress(compressed)
    stride = width * 3 + 1
    assert len(raw) == stride * height
    assert all(raw[y * stride] == 0 for y in range(height))
    pixels = b"".join(raw[y * stride + 1:(y + 1) * stride] for y in range(height))
    return width, height, pixels


def canvas(width, height, background):
    return bytearray(bytes(background) * width * height)


def paste(target, target_width, pixels, width, height, left, top, rounded=False):
    """El radio del 22 % solo se aplica a las vistas de comparación."""
    radius = width * 0.22
    for y in range(height):
        for x in range(width):
            coverage = 16
            if rounded and (x < radius or x >= width - radius) and (y < radius or y >= height - radius):
                cx = radius if x < radius else width - radius
                cy = radius if y < radius else height - radius
                coverage = sum((x + (sx + 0.5) / 4 - cx) ** 2 + (y + (sy + 0.5) / 4 - cy) ** 2 <= radius ** 2
                               for sx in range(4) for sy in range(4))
            if not coverage:
                continue
            source = (y * width + x) * 3
            destination = ((top + y) * target_width + left + x) * 3
            target[destination:destination + 3] = bytes(
                round((pixels[source + channel] * coverage + target[destination + channel] * (16 - coverage)) / 16)
                for channel in range(3))


# Alfabeto monolineal original para las etiquetas de comparación: no usa fuentes externas.
GLYPHS = {
    "A": [[(0, 7), (2.5, 0), (5, 7)], [(1, 4.5), (4, 4.5)]],
    "B": [[(0, 7), (0, 0), (3, 0), (5, 1), (5, 2.5), (3, 3.5), (0, 3.5)],
          [(3, 3.5), (5, 4.5), (5, 6), (3, 7), (0, 7)]],
    "C": [[(5, 0.5), (3.5, 0), (1, 0), (0, 1.5), (0, 5.5), (1, 7), (3.5, 7), (5, 6.5)]],
    "L": [[(0, 0), (0, 7), (5, 7)]],
    "O": [[(1.5, 0), (3.5, 0), (5, 1.5), (5, 5.5), (3.5, 7), (1.5, 7), (0, 5.5), (0, 1.5), (1.5, 0)]],
    "P": [[(0, 7), (0, 0), (3.5, 0), (5, 1.5), (5, 3), (3.5, 4), (0, 4)]],
    "R": [[(0, 7), (0, 0), (3.5, 0), (5, 1.5), (5, 3), (3.5, 4), (0, 4)], [(3, 4), (5, 7)]],
    "S": [[(5, 0.5), (3.5, 0), (1, 0), (0, 1), (0, 2.5), (1, 3.5), (4, 3.5), (5, 4.5), (5, 6), (4, 7), (1, 7), (0, 6.5)]],
    "T": [[(0, 0), (5, 0)], [(2.5, 0), (2.5, 7)]],
    "U": [[(0, 0), (0, 5.5), (1.5, 7), (3.5, 7), (5, 5.5), (5, 0)]],
    "X": [[(0, 0), (5, 7)], [(5, 0), (0, 7)]],
    "0": [[(1.5, 0), (3.5, 0), (5, 1.5), (5, 5.5), (3.5, 7), (1.5, 7), (0, 5.5), (0, 1.5), (1.5, 0)]],
    "1": [[(1, 1.5), (2.5, 0), (2.5, 7)], [(0, 7), (5, 7)]],
    "4": [[(3.5, 7), (3.5, 0), (0, 5), (5, 5)]],
    "8": [[(1, 0), (4, 0), (5, 1), (5, 2.5), (4, 3.5), (1, 3.5), (0, 2.5), (0, 1), (1, 0)],
          [(1, 3.5), (0, 4.5), (0, 6), (1, 7), (4, 7), (5, 6), (5, 4.5), (4, 3.5)]],
}


def label(target, target_width, text, center_x, top, height, foreground, background):
    scale = height / 7
    step = 7.5 * scale
    width = math.ceil((len(text) * 7.5 - 2.5) * scale + 4)
    glyph_height = math.ceil(height + 4)
    shapes = []
    radius = height / 22
    for index, letter in enumerate(text.upper()):
        if letter == " ":
            continue
        for path in GLYPHS[letter]:
            points = [(2 + index * step + x * scale, 2 + y * scale) for x, y in path]
            for a, b in zip(points, points[1:]):
                dx, dy = b[0] - a[0], b[1] - a[1]
                length = math.hypot(dx, dy)
                nx, ny = -dy / length * radius, dx / length * radius
                shapes.append((1, [(a[0] + nx, a[1] + ny), (b[0] + nx, b[1] + ny),
                                   (b[0] - nx, b[1] - ny), (a[0] - nx, a[1] - ny)]))
            shapes.extend((1, circle(x, y, radius)) for x, y in points)
    pixels = raster(width, glyph_height, [background, foreground], shapes)
    paste(target, target_width, pixels, width, glyph_height, round(center_x - width / 2), top)


def preview(letter):
    width, height = 720, 360
    pixels = canvas(width, height, LIGHT)
    paste(pixels, width, canvas(360, height, DARK), 360, height, 360, 0)
    for left, background, foreground, title in ((0, LIGHT, INK, "CLARO"), (360, DARK, WHITE, "OSCURO")):
        label(pixels, width, title, left + 180, 28, 14, foreground, background)
        paste(pixels, width, render_icon(letter, 180), 180, 180, left + 36, 92, rounded=True)
        paste(pixels, width, render_icon(letter, 48), 48, 48, left + 260, 158, rounded=True)
        label(pixels, width, "180 PX", left + 126, 298, 12, foreground, background)
        label(pixels, width, "48 PX", left + 284, 298, 12, foreground, background)
    write_png(ROOT / f"preview-{letter}.png", width, height, pixels)


def contact_sheet():
    width, height = 1216, 376
    pixels = canvas(width, height, LIGHT)
    old_width, old_height, old_pixels = read_png(ROOT.parent / "icon-ios-1024.png")
    assert (old_width, old_height) == (1024, 1024)
    old_small = bytearray()
    for y in range(256):
        for x in range(256):
            for channel in range(3):
                old_small.append(round(sum(old_pixels[((y * 4 + sy) * 1024 + x * 4 + sx) * 3 + channel]
                                           for sy in range(4) for sx in range(4)) / 16))
    sources = [old_small] + [render_icon(letter, 256) for letter in "abc"]
    for index, (source, title) in enumerate(zip(sources, ("ACTUAL", "A", "B", "C"))):
        left = 32 + index * 296
        paste(pixels, width, source, 256, 256, left, 32, rounded=True)
        label(pixels, width, title, left + 128, 316, 20, INK, LIGHT)
    write_png(ROOT / "contact-sheet.png", width, height, pixels)


def check():
    expected = {f"icon-ios-1024-{letter}.png": (1024, 1024) for letter in "abc"}
    expected.update({f"preview-{letter}.png": (720, 360) for letter in "abc"})
    expected["contact-sheet.png"] = (1216, 376)
    for filename, dimensions in expected.items():
        path = ROOT / filename
        width, height, pixels = read_png(path)
        assert (width, height) == dimensions, filename
        assert path.stat().st_size < 1_000_000, filename
        if filename.startswith("icon-ios"):
            palette, _ = read_svg(filename[-5])
            for x, y in ((0, 0), (1023, 0), (0, 1023), (1023, 1023)):
                offset = (y * width + x) * 3
                assert tuple(pixels[offset:offset + 3]) == palette[0], filename
        print(f"OK {filename}: {width}×{height}, RGB sin alfa, {path.stat().st_size} bytes, IHDR/IDAT/IEND")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verificá sin sobrescribir los PNG")
    args = parser.parse_args()
    if not args.check:
        for letter in "abc":
            write_png(ROOT / f"icon-ios-1024-{letter}.png", 1024, 1024, render_icon(letter, 1024))
            preview(letter)
        contact_sheet()
    check()


if __name__ == "__main__":
    main()
