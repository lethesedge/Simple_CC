#!/usr/bin/env python3
"""Generates simple placeholder solid-color PNG icons (no external deps)."""
import struct
import zlib
from pathlib import Path

ICONS_DIR = Path(__file__).parent.parent / "icons"
COLOR = (0x1f, 0x6f, 0x4a)  # a plain green


def make_png(path, size, color):
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c))

    r, g, b = color
    row = bytes([0, *([r, g, b] * size)])
    raw = row * size
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", ihdr)
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


if __name__ == "__main__":
    ICONS_DIR.mkdir(exist_ok=True)
    make_png(ICONS_DIR / "icon-192.png", 192, COLOR)
    make_png(ICONS_DIR / "icon-512.png", 512, COLOR)
    print("Wrote placeholder icons to", ICONS_DIR)
