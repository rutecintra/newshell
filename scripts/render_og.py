#!/usr/bin/env python3
"""Write the default social image. No font library: a small bitmap is enough."""

import struct
import zlib
from pathlib import Path

WIDTH = 1200
HEIGHT = 630
IVORY = (244, 239, 230)
INK = (28, 25, 21)
BLUE = (12, 61, 110)
ACCENT = (122, 48, 24)

GLYPHS = {
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "W": ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
    "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    ",": ["00000", "00000", "00000", "00000", "00100", "00100", "01000"],
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
}


def chunk(tag, data):
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def draw_text(pixels, text, x, y, scale, color):
    cursor = x
    for char in text:
        glyph = GLYPHS[char]
        for row, bits in enumerate(glyph):
            for col, bit in enumerate(bits):
                if bit != "1":
                    continue
                for dy in range(scale):
                    for dx in range(scale):
                        px = cursor + col * scale + dx
                        py = y + row * scale + dy
                        if 0 <= px < WIDTH and 0 <= py < HEIGHT:
                            pixels[py * WIDTH + px] = color
        cursor += 6 * scale


def main():
    pixels = [IVORY] * (WIDTH * HEIGHT)
    for y in range(HEIGHT):
        for x in range(36):
            pixels[y * WIDTH + x] = BLUE
    for y in range(250, 258):
        for x in range(96, 760):
            pixels[y * WIDTH + x] = ACCENT
    draw_text(pixels, "NEWS,", 96, 150, 14, INK)
    draw_text(pixels, "EXPLAINED", 96, 290, 14, INK)
    raw = bytearray()
    for y in range(HEIGHT):
        raw.append(0)
        for x in range(WIDTH):
            raw.extend(pixels[y * WIDTH + x])
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", WIDTH, HEIGHT, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    path = Path(__file__).resolve().parents[1] / "public" / "og" / "default.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


if __name__ == "__main__":
    main()
