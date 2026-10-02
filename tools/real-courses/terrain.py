"""Ground height from AWS Terrain Tiles (Terrarium PNGs: height = R*256 + G + B/256 - 32768 metres)."""
import math
import struct
import zlib
from functools import lru_cache
from pathlib import Path

import requests

ZOOM = 15
URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
CACHE = Path(__file__).parent / 'cache' / 'terrain'


def _png_rows(data):
    """Decode an 8-bit RGB/RGBA PNG into rows of bytes (only what Terrarium tiles use)."""
    pos, idat = 8, b''
    while pos < len(data):
        n, kind = struct.unpack('>I4s', data[pos:pos + 8])
        body = data[pos + 8:pos + 8 + n]
        pos += 12 + n
        if kind == b'IHDR':
            w, h, depth, colour = struct.unpack('>IIBB', body[:10])
            assert depth == 8 and colour in (2, 6)
            bpp = 3 if colour == 2 else 4
        elif kind == b'IDAT':
            idat += body
    raw, stride, rows, prev, i = zlib.decompress(idat), w * bpp, [], bytearray(w * bpp), 0
    for _ in range(h):
        f, line = raw[i], bytearray(raw[i + 1:i + 1 + stride])
        i += 1 + stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0
            b, c = prev[x], prev[x - bpp] if x >= bpp else 0
            if f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + b) & 255
            elif f == 3: line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append((bytes(line), bpp))
        prev = line
    return rows


@lru_cache(maxsize=None)
def _tile(x, y):
    path = CACHE / f'{ZOOM}-{x}-{y}.png'
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(requests.get(URL.format(z=ZOOM, x=x, y=y), timeout=60).content)
    return [[r[k * bpp] * 256 + r[k * bpp + 1] + r[k * bpp + 2] / 256 - 32768 for k in range(256)]
            for r, bpp in _png_rows(path.read_bytes())]


def height(lon, lat):
    """Bilinear height in metres at a lon/lat."""
    n = 256 * 2 ** ZOOM
    fx = (lon + 180) / 360 * n - .5
    fy = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n - .5
    x0, y0 = math.floor(fx), math.floor(fy)
    u, v = fx - x0, fy - y0
    px = lambda X, Y: _tile(X // 256, Y // 256)[Y % 256][X % 256]
    return (px(x0, y0) * (1 - u) * (1 - v) + px(x0 + 1, y0) * u * (1 - v)
            + px(x0, y0 + 1) * (1 - u) * v + px(x0 + 1, y0 + 1) * u * v)
