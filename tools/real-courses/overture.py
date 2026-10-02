"""Read map features from Overture Maps' public S3 bucket without downloading whole files.

Overture publishes OpenStreetMap-derived data as GeoParquet. Each file's row groups carry bbox
statistics, so we fetch only the footer, then only the row groups that overlap our box (HTTP Range).
"""
import io
import re

import pyarrow.parquet as pq
import requests

BUCKET = 'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com'
THEME = {'land_use': 'base', 'land': 'base', 'land_cover': 'base', 'water': 'base', 'building': 'buildings'}
http = requests.Session()


class RangeFile(io.RawIOBase):
    """A seekable read-only file over HTTP, so pyarrow can jump straight to the parts it needs."""

    def __init__(self, url, size):
        self.url, self.size, self.pos = url, size, 0

    def readable(self): return True
    def seekable(self): return True
    def tell(self): return self.pos

    def seek(self, off, whence=0):
        self.pos = (off, self.pos + off, self.size + off)[whence]
        return self.pos

    def readinto(self, buf):
        n = min(len(buf), self.size - self.pos)
        if n <= 0:
            return 0
        data = http.get(self.url, headers={'Range': f'bytes={self.pos}-{self.pos + n - 1}'}, timeout=120).content
        buf[:len(data)] = data
        self.pos += len(data)
        return len(data)


def list_keys(prefix, delimiter=''):
    """S3 ListObjectsV2 → [(key, size)] (or common prefixes when a delimiter is given)."""
    out, token = [], None
    while True:
        q = {'list-type': 2, 'prefix': prefix, 'delimiter': delimiter}
        if token:
            q['continuation-token'] = token
        xml = http.get(BUCKET, params=q, timeout=60).text
        out += re.findall(r'<Prefix>([^<]+)</Prefix>', xml)[1:] if delimiter else \
            [(k, int(s)) for k, s in re.findall(r'<Key>([^<]+)</Key>.*?<Size>(\d+)</Size>', xml)]
        token = (re.findall(r'<NextContinuationToken>([^<]+)<', xml) or [None])[0]
        if not token:
            return out


def latest_release():
    return sorted(list_keys('release/', '/'))[-1].rstrip('/')


def features(kind, box, release):
    """All rows of one Overture type whose bbox overlaps box = (west, south, east, north)."""
    w, s, e, n = box
    overlaps = lambda x0, y0, x1, y1: x0 <= e and x1 >= w and y0 <= n and y1 >= s
    rows = []
    for key, size in list_keys(f'{release}/theme={THEME[kind]}/type={kind}/'):
        f = pq.ParquetFile(io.BufferedReader(RangeFile(f'{BUCKET}/{key}', size), 1 << 20))
        md = f.metadata
        col = {md.row_group(0).column(i).path_in_schema: i for i in range(md.num_columns)}
        want = [c for c in ('id', 'geometry', 'bbox', 'subtype', 'class', 'names', 'sources') if c in f.schema_arrow.names]
        for g in range(md.num_row_groups):
            st = lambda c: md.row_group(g).column(col[c]).statistics
            if not overlaps(st('bbox.xmin').min, st('bbox.ymin').min, st('bbox.xmax').max, st('bbox.ymax').max):
                continue
            for r in f.read_row_group(g, columns=want).to_pylist():
                b = r['bbox']
                if overlaps(b['xmin'], b['ymin'], b['xmax'], b['ymax']):
                    r['geometry'] = r['geometry'].hex()
                    rows.append(r)
    return rows
