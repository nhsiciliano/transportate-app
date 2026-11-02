#!/usr/bin/env python3
"""Rasterizá los polígonos de mark.svg y verificá los PNG, sin dependencias."""

import argparse
import math
from pathlib import Path
import re
import struct
import xml.etree.ElementTree as ET
import zlib


ROOT = Path(__file__).resolve().parent
NS = {"svg": "http://www.w3.org/2000/svg"}
SIGNATURE = b"\x89PNG\r\n\x1a\n"
SAMPLES = 4
# Escalas propias de composición; no son tokens de Obelisco.
VARIANTS = (
    ("icon-ios-1024.png", 1024, 1.13, "primary", False),
    ("adaptive-foreground-1024.png", 1024, 1.0, None, False),
    ("adaptive-monochrome-1024.png", 1024, 1.0, None, "mark"),
    ("splash-icon-1024.png", 1024, 1.13, None, "primary"),
    ("splash-icon-light-1024.png", 1024, 1.13, None, "primary"),
    ("splash-icon-dark-1024.png", 1024, 1.13, None, "mark"),
    ("notification-icon-96.png", 96, 1.0, None, "mark"),
)


def read_source():
    """El SVG es la única fuente de geometría y colores."""
    svg = ET.parse(ROOT / "mark.svg").getroot()
    if svg.attrib["viewBox"] != "0 0 1024 1024":
        raise ValueError("El lienzo del SVG debe ser 1024 × 1024")
    style = svg.find("svg:style", NS).text
    colors = {
        name: tuple(bytes.fromhex(value))
        for name, value in re.findall(r"\.(\w+)\s*\{\s*fill:\s*#([0-9a-f]{6});\s*\}", style)
    }
    group = svg.find("svg:g[@id='transportate-mark']", NS)
    polygons = []
    for shape in group:
        if shape.tag != "{" + NS["svg"] + "}polygon":
            raise ValueError("El rasterizador admite solo polígonos sin transformaciones")
        if set(shape.attrib) != {"class", "points"}:
            raise ValueError("No se admiten atributos de dibujo adicionales")
        points = [tuple(map(float, pair.split(","))) for pair in shape.attrib["points"].split()]
        polygons.append((shape.attrib["class"], points))
    if not polygons:
        raise ValueError("El SVG no contiene polígonos")
    return colors, polygons


def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))


def encode_png(size, pixels, alpha):
    channels = 4 if alpha else 3
    stride = size * channels
    rows = b"".join(b"\0" + pixels[y * stride:(y + 1) * stride] for y in range(size))
    header = struct.pack(">IIBBBBB", size, size, 8, 6 if alpha else 2, 0, 0, 0)
    # Solo chunks críticos: no se escriben nombres, fechas, perfiles ni metadatos.
    return SIGNATURE + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b"")


def render(size, scale, background, monochrome, colors, polygons):
    """Cobertura 4×4 por píxel; composición de polígonos en orden de pintura."""
    alpha = background is None
    channels = 4 if alpha else 3
    base = (0, 0, 0, 0) if alpha else colors[background]
    pixels = bytearray(bytes(base) * size * size)
    palette = [(0, 0, 0)] + [colors[monochrome or name] for name, _ in polygons]
    transformed = [
        [(size / 2 + (x - 512) * scale * size / 1024,
          size / 2 + (y - 512) * scale * size / 1024) for x, y in points]
        for _, points in polygons
    ]
    low_x = max(0, math.floor(min(x for points in transformed for x, _ in points)))
    high_x = min(size, math.ceil(max(x for points in transformed for x, _ in points)))
    low_y = max(0, math.floor(min(y for points in transformed for _, y in points)))
    high_y = min(size, math.ceil(max(y for points in transformed for _, y in points)))
    width = size * SAMPLES
    samples_per_pixel = SAMPLES * SAMPLES
    for y in range(low_y, high_y):
        scanlines = []
        for sample_y in range(SAMPLES):
            scan = bytearray(width)
            ordinate = y + (sample_y + 0.5) / SAMPLES
            for index, points in enumerate(transformed, 1):
                crossings = []
                for (x1, y1), (x2, y2) in zip(points, points[1:] + points[:1]):
                    if min(y1, y2) <= ordinate < max(y1, y2):
                        crossings.append(x1 + (ordinate - y1) * (x2 - x1) / (y2 - y1))
                crossings.sort()
                for left, right in zip(crossings[::2], crossings[1::2]):
                    start = max(0, math.ceil(left * SAMPLES - 0.5))
                    end = min(width, math.ceil(right * SAMPLES - 0.5))
                    scan[start:end] = bytes([index]) * (end - start)
            scanlines.append(scan)
        for x in range(low_x, high_x):
            samples = b"".join(scan[x * SAMPLES:(x + 1) * SAMPLES] for scan in scanlines)
            counts = [samples.count(index) for index in range(1, len(palette))]
            coverage = sum(counts)
            if not coverage:
                continue
            divisor = coverage if alpha else samples_per_pixel
            values = [round((sum(palette[i + 1][c] * count for i, count in enumerate(counts))
                             + (0 if alpha else base[c] * (samples_per_pixel - coverage))) / divisor)
                      for c in range(3)]
            if alpha:
                values.append(round(255 * coverage / samples_per_pixel))
            offset = (y * size + x) * channels
            pixels[offset:offset + channels] = bytes(values)
    return bytes(pixels), alpha


def decode_png(path):
    """Inspección independiente de estructura, CRC y píxeles descomprimidos."""
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
        checksum = struct.unpack(">I", data[offset + 8 + length:offset + 12 + length])[0]
        assert zlib.crc32(kind + payload) == checksum, (path.name, "CRC")
        kinds.append(kind)
        if kind == b"IHDR":
            width, height, depth, color_type, compression, filtering, interlace = struct.unpack(">IIBBBBB", payload)
            assert (depth, compression, filtering, interlace) == (8, 0, 0, 0)
        elif kind == b"IDAT":
            compressed.extend(payload)
        offset += length + 12
    assert kinds == [b"IHDR", b"IDAT", b"IEND"], (path.name, "chunks inesperados")
    assert offset == len(data), (path.name, "datos sobrantes")
    channels = {2: 3, 6: 4}[color_type]
    stride = width * channels + 1
    raw = zlib.decompress(compressed)
    assert len(raw) == height * stride
    assert all(raw[y * stride] == 0 for y in range(height))
    pixels = b"".join(raw[y * stride + 1:(y + 1) * stride] for y in range(height))
    return width, height, channels, pixels, len(data)


def verify(colors):
    for filename, size, _, background, monochrome in VARIANTS:
        width, height, channels, pixels, byte_count = decode_png(ROOT / filename)
        assert (width, height) == (size, size), filename
        assert channels == (3 if background else 4), (filename, "canal alfa")
        occupied = []
        for offset in range(0, len(pixels), channels):
            pixel = pixels[offset:offset + channels]
            if channels == 4 and pixel[3]:
                x, y = (offset // channels) % size, (offset // channels) // size
                occupied.append((x, y))
                if monochrome:
                    assert tuple(pixel[:3]) == colors[monochrome], (filename, "color")
                if filename.startswith("adaptive-"):
                    # Verifica el píxel entero, incluyendo sus cuatro esquinas.
                    radius = math.hypot(abs(x + 0.5 - size / 2) + 0.5,
                                        abs(y + 0.5 - size / 2) + 0.5)
                    assert radius <= size * 0.33, (filename, "fuera del círculo seguro")
        if channels == 4:
            assert occupied, (filename, "imagen vacía")
            assert pixels[3] == 0 and pixels[-1] == 0, (filename, "fondo")
            bounds = (min(x for x, _ in occupied), min(y for _, y in occupied),
                      max(x for x, _ in occupied) + 1, max(y for _, y in occupied) + 1)
            if filename.startswith("splash-"):
                assert 0.59 <= max(bounds[2] - bounds[0], bounds[3] - bounds[1]) / size <= 0.61
        else:
            bounds = "fondo completo"
            for x, y in ((0, 0), (size - 1, 0), (0, size - 1), (size - 1, size - 1)):
                offset = (y * size + x) * 3
                assert tuple(pixels[offset:offset + 3]) == colors[background]
        print(f"OK {filename}: {width}×{height}, {'RGBA' if channels == 4 else 'RGB sin alfa'}, "
              f"{byte_count} bytes, marca={bounds}, sin metadatos")
    assert (ROOT / "adaptive-background.txt").read_text() == "#" + bytes(colors["primary"]).hex() + "\n"
    assert (ROOT / "splash-icon-1024.png").read_bytes() == (ROOT / "splash-icon-light-1024.png").read_bytes()
    foreground = decode_png(ROOT / "adaptive-foreground-1024.png")[3]
    monochrome = decode_png(ROOT / "adaptive-monochrome-1024.png")[3]
    assert foreground[3::4] == monochrome[3::4], "Las máscaras adaptativas deben coincidir"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verificá los archivos existentes sin regenerar")
    args = parser.parse_args()
    colors, polygons = read_source()
    if not args.check:
        for filename, size, scale, background, monochrome in VARIANTS:
            pixels, alpha = render(size, scale, background, monochrome, colors, polygons)
            (ROOT / filename).write_bytes(encode_png(size, pixels, alpha))
        (ROOT / "adaptive-background.txt").write_text("#" + bytes(colors["primary"]).hex() + "\n")
    verify(colors)


if __name__ == "__main__":
    main()
