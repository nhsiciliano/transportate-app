#!/usr/bin/env python3
"""Regenerá Subte conectado desde mark.svg y verificá el set sin paquetes ni red."""

import argparse
import math
from pathlib import Path
import re
import struct
import xml.etree.ElementTree as ET
import zlib


ROOT = Path(__file__).resolve().parent
SVG_NS = "{http://www.w3.org/2000/svg}"
SIGNATURE = b"\x89PNG\r\n\x1a\n"
SAMPLES = 4
# Decisiones de composición propias: no son tokens de Obelisco.
MARK_CENTER = (528, 528)
ADAPTIVE_SCALE = 0.76
SPLASH_SCALE = 0.96
VARIANTS = (
    ("icon-ios-1024.png", 1024, 1.0, (512, 512), "primary", None),
    ("adaptive-foreground-1024.png", 1024, ADAPTIVE_SCALE, MARK_CENTER, None, None),
    ("adaptive-monochrome-1024.png", 1024, ADAPTIVE_SCALE, MARK_CENTER, None, "mark"),
    ("splash-icon-1024.png", 1024, SPLASH_SCALE, MARK_CENTER, None, "primary"),
    ("splash-icon-light-1024.png", 1024, SPLASH_SCALE, MARK_CENTER, None, "primary"),
    ("splash-icon-dark-1024.png", 1024, SPLASH_SCALE, MARK_CENTER, None, "mark"),
)


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


def read_source():
    """El SVG sin fondo es la única fuente de geometría y paleta."""
    svg = ET.parse(ROOT / "mark.svg").getroot()
    assert svg.attrib["viewBox"] == "0 0 1024 1024"
    style = svg.find(SVG_NS + "style").text
    colors = {name: tuple(bytes.fromhex(value)) for name, value in
              re.findall(r"\.(\w+)\s*\{\s*fill:\s*#([0-9a-f]{6});\s*\}", style)}
    assert set(colors) == {"primary", "mark", "accent"}
    indices = {"primary": 0, "mark": 1, "accent": 2}
    shapes = []
    for element in svg.iter():
        tag = element.tag.removeprefix(SVG_NS)
        if tag in {"svg", "style", "title", "desc", "g"}:
            continue
        attrs = element.attrib
        if any(name in attrs for name in ("transform", "stroke", "style", "opacity")):
            raise ValueError("Solo rellenos por clase, sin transformaciones ni trazos")
        color = indices[attrs["class"]]
        if tag == "rect":
            width, height = float(attrs["width"]), float(attrs["height"])
            if width == height == 1024:
                raise ValueError("mark.svg debe estar libre de rectángulo de fondo")
            points = rounded_rect(float(attrs.get("x", 0)), float(attrs.get("y", 0)),
                                  width, height, float(attrs.get("rx", 0)))
        elif tag == "circle":
            points = circle(float(attrs["cx"]), float(attrs["cy"]), float(attrs["r"]))
        elif tag == "polygon":
            points = [tuple(map(float, pair.split(","))) for pair in attrs["points"].split()]
        elif tag == "path":
            points = path_points(attrs["d"])
        else:
            raise ValueError(f"Elemento SVG no admitido: {tag}")
        shapes.append((color, points))
    assert shapes, "La marca no puede estar vacía"
    return colors, shapes


def render(size, scale, center, background, monochrome, colors, shapes):
    """Cobertura 4×4; primary es fondo en iOS y recorte en los RGBA."""
    alpha = background is None
    channels = 4 if alpha else 3
    base = (0, 0, 0, 0) if alpha else colors[background]
    pixels = bytearray(bytes(base) * size * size)
    palette = [colors["primary"], colors[monochrome or "mark"], colors[monochrome or "accent"]]
    factor = scale * size / 1024
    transformed = [(color, [(size / 2 + (x - center[0]) * factor,
                             size / 2 + (y - center[1]) * factor) for x, y in points])
                   for color, points in shapes]
    low_x = max(0, math.floor(min(x for _, points in transformed for x, _ in points)))
    high_x = min(size, math.ceil(max(x for _, points in transformed for x, _ in points)))
    low_y = max(0, math.floor(min(y for _, points in transformed for _, y in points)))
    high_y = min(size, math.ceil(max(y for _, points in transformed for _, y in points)))
    sample_width = size * SAMPLES
    for y in range(low_y, high_y):
        rows = []
        for sample_y in range(SAMPLES):
            scan = bytearray(sample_width)
            ordinate = y + (sample_y + 0.5) / SAMPLES
            for color, points in transformed:
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
            counts = [samples.count(i) for i in range(3)]
            coverage = counts[1] + counts[2] if alpha else 16
            if not coverage:
                continue
            first_color = 1 if alpha else 0
            values = [round(sum(counts[i] * palette[i][channel] for i in range(first_color, 3)) / coverage)
                      for channel in range(3)]
            if alpha:
                values.append(round(255 * coverage / 16))
            offset = (y * size + x) * channels
            pixels[offset:offset + channels] = bytes(values)
    return bytes(pixels), alpha


def png_chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))


def encode_png(size, pixels, alpha):
    channels = 4 if alpha else 3
    stride = size * channels
    raw = b"".join(b"\0" + pixels[y * stride:(y + 1) * stride] for y in range(size))
    header = struct.pack(">IIBBBBB", size, size, 8, 6 if alpha else 2, 0, 0, 0)
    return SIGNATURE + png_chunk(b"IHDR", header) + png_chunk(b"IDAT", zlib.compress(raw, 9)) + png_chunk(b"IEND", b"")


def decode_png(path):
    """Inspeccioná CRC, píxeles y ausencia de todo chunk de metadatos."""
    data = path.read_bytes()
    assert data.startswith(SIGNATURE), path.name
    assert len(data) < 1_000_000, (path.name, "supera 1 MB")
    offset = len(SIGNATURE)
    compressed = bytearray()
    kinds = []
    while offset < len(data):
        length = struct.unpack(">I", data[offset:offset + 4])[0]
        kind = data[offset + 4:offset + 8]
        payload = data[offset + 8:offset + 8 + length]
        crc = struct.unpack(">I", data[offset + 8 + length:offset + 12 + length])[0]
        assert zlib.crc32(kind + payload) == crc, (path.name, "CRC")
        kinds.append(kind)
        if kind == b"IHDR":
            width, height, depth, color, compression, filtering, interlace = struct.unpack(">IIBBBBB", payload)
            assert (depth, compression, filtering, interlace) == (8, 0, 0, 0), path.name
        elif kind == b"IDAT":
            compressed.extend(payload)
        elif kind == b"IEND":
            assert not payload
        offset += length + 12
    assert kinds == [b"IHDR", b"IDAT", b"IEND"], (path.name, "chunks inesperados")
    assert offset == len(data), (path.name, "datos sobrantes")
    channels = {2: 3, 6: 4}[color]
    stride = width * channels + 1
    raw = zlib.decompress(compressed)
    assert len(raw) == stride * height
    assert all(raw[y * stride] == 0 for y in range(height))
    pixels = b"".join(raw[y * stride + 1:(y + 1) * stride] for y in range(height))
    return width, height, channels, pixels


def reduce_mask(pixels, source_size, size, color):
    """Promedio de área exacto de la máscara alfa; conserva el RGB puro."""
    intervals = []
    for destination in range(size):
        left, right = destination * source_size, (destination + 1) * source_size
        intervals.append([(source, min(right, (source + 1) * size) - max(left, source * size))
                          for source in range(left // size, math.ceil(right / size))])
    result = bytearray()
    for rows in intervals:
        for columns in intervals:
            coverage = sum(pixels[(y * source_size + x) * 4 + 3] * wx * wy
                           for y, wy in rows for x, wx in columns)
            alpha = round(coverage / (source_size * source_size))
            result.extend((*color, alpha) if alpha else (0, 0, 0, 0))
    return bytes(result)


def verify(colors):
    images = {}
    specifications = list(VARIANTS) + [("notification-icon-96.png", 96, ADAPTIVE_SCALE, MARK_CENTER, None, "mark")]
    for filename, size, scale, center, background, monochrome in specifications:
        width, height, channels, pixels = decode_png(ROOT / filename)
        assert (width, height) == (size, size), filename
        assert channels == (3 if background else 4), (filename, "canal alfa")
        images[filename] = (width, height, channels, pixels)
        if channels == 3:
            for x, y in ((0, 0), (size - 1, 0), (0, size - 1), (size - 1, size - 1)):
                offset = (y * size + x) * 3
                assert tuple(pixels[offset:offset + 3]) == colors[background], (filename, "esquinas opacas")
            bounds = "fondo completo"
        else:
            visible = []
            for offset in range(0, len(pixels), 4):
                if not pixels[offset + 3]:
                    assert pixels[offset:offset + 3] == b"\0\0\0", (filename, "RGB oculto")
                    continue
                x, y = (offset // 4) % size, (offset // 4) // size
                visible.append((x, y))
                if monochrome:
                    assert tuple(pixels[offset:offset + 3]) == colors[monochrome], (filename, "color monocromo")
                if filename.startswith("adaptive-"):
                    radius = math.hypot(abs(x + 0.5 - size / 2) + 0.5,
                                        abs(y + 0.5 - size / 2) + 0.5)
                    assert radius <= size * 0.33, (filename, "fuera del círculo seguro")
            assert visible, (filename, "imagen vacía")
            bounds = (min(x for x, _ in visible), min(y for _, y in visible),
                      max(x for x, _ in visible) + 1, max(y for _, y in visible) + 1)
            assert all(pixels[(y * size + x) * 4 + 3] == 0 for x, y in
                       ((0, 0), (size - 1, 0), (0, size - 1), (size - 1, size - 1))), filename
            if filename.startswith("splash-"):
                assert 0.59 <= max(bounds[2] - bounds[0], bounds[3] - bounds[1]) / size <= 0.61
                assert abs((bounds[0] + bounds[2]) / 2 - size / 2) <= 1
                assert abs((bounds[1] + bounds[3]) / 2 - size / 2) <= 1
            # El parabrisas y ambos faros deben seguir perforados en todas las máscaras.
            for source_x, source_y in ((472, 380), (344, 578), (600, 578)):
                x = int(size / 2 + (source_x - center[0]) * scale * size / 1024)
                y = int(size / 2 + (source_y - center[1]) * scale * size / 1024)
                assert pixels[(y * size + x) * 4 + 3] == 0, (filename, "recorte interior")
            for source_x, source_y in ((472, 260), (472, 620), (338, 720), (800, 500)):
                x = int(size / 2 + (source_x - center[0]) * scale * size / 1024)
                y = int(size / 2 + (source_y - center[1]) * scale * size / 1024)
                assert pixels[(y * size + x) * 4 + 3] > 0, (filename, "falta parte de la marca")
        print(f"OK {filename}: {width}×{height}, {'RGBA' if channels == 4 else 'RGB sin alfa'}, "
              f"{(ROOT / filename).stat().st_size} bytes, marca={bounds}, sin metadatos")
    assert (ROOT / "adaptive-background.txt").read_bytes() == b"#1d3343\n"
    foreground = images["adaptive-foreground-1024.png"][3]
    monochrome = images["adaptive-monochrome-1024.png"][3]
    assert foreground[3::4] == monochrome[3::4], "Máscaras adaptativas distintas"
    light = images["splash-icon-light-1024.png"][3]
    dark = images["splash-icon-dark-1024.png"][3]
    assert light[3::4] == dark[3::4], "Máscaras splash distintas"
    assert (ROOT / "splash-icon-1024.png").read_bytes() == (ROOT / "splash-icon-light-1024.png").read_bytes()
    assert images["notification-icon-96.png"][3] == reduce_mask(monochrome, 1024, 96, colors["mark"])
    assert images["icon-ios-1024.png"] == decode_png(ROOT / "alternativas/icon-ios-1024-b.png"), "iOS debe coincidir píxel a píxel con B"
    print("OK: iOS idéntico a B; máscaras, recortes y reducción de notificación verificados")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verificá sin regenerar los PNG")
    args = parser.parse_args()
    colors, shapes = read_source()
    if not args.check:
        cache = {}
        for filename, size, scale, center, background, monochrome in VARIANTS:
            key = (size, scale, center, background, monochrome)
            if key not in cache:
                cache[key] = render(size, scale, center, background, monochrome, colors, shapes)
            pixels, alpha = cache[key]
            (ROOT / filename).write_bytes(encode_png(size, pixels, alpha))
            if filename == "adaptive-monochrome-1024.png":
                notification = reduce_mask(pixels, size, 96, colors["mark"])
                (ROOT / "notification-icon-96.png").write_bytes(encode_png(96, notification, True))
    verify(colors)


if __name__ == "__main__":
    main()
