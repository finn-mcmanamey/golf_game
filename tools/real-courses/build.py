"""Build src/js/525-real-data.js: real golf courses from Overture Maps (OpenStreetMap) and AWS Terrain Tiles.

    pip install -r tools/real-courses/requirements.txt
    python3 tools/real-courses/build.py

Downloads are cached in tools/real-courses/cache/. Coordinates are local metres around each course,
x east and z south (the game's +z), stored as half-metre integers.
"""
import heapq
import json
import math
import statistics
from collections import defaultdict
from pathlib import Path

import shapely
from shapely import wkb
from shapely.affinity import affine_transform, rotate, scale, translate
from shapely.geometry import LineString, MultiPoint, Point, box as rect
from shapely.ops import unary_union

import overture
import terrain
from courses import COURSES

HERE = Path(__file__).parent
OUT = HERE.parents[1] / 'src' / 'js' / '525-real-data.js'
MARGIN = 250         # metres of land and water kept around a course for the scenery
DEM_STEP = 16        # metres between height samples (the source model is coarser than this)
FAR, FAR_STEP = 1600, 64   # the far scenery: real hills and water this far around the course, coarser
CLASS = ['boundary', 'rough', 'fairway', 'green', 'tee', 'bunker', 'water', 'sea', 'wood', 'building']
GOLF = {'golf_course': 'boundary', 'rough': 'rough', 'fairway': 'fairway', 'green': 'green', 'tee': 'tee',
        'bunker': 'bunker', 'water_hazard': 'water', 'lateral_water_hazard': 'water'}
SIMPLIFY = {'green': .3, 'tee': .3, 'bunker': .3, 'fairway': .6, 'rough': .8, 'boundary': 1, 'building': .5}
TYPICAL = {3: 150, 4: 340, 5: 460}


# ---------- fetching ----------

def fetch(course):
    path = HERE / 'cache' / f"{course['key']}.json"
    if path.exists():
        return json.loads(path.read_text())
    w, s, e, n = course['box']
    pad = .004
    big = (w - pad, s - pad, e + pad, n + pad)
    rel = overture.latest_release()
    data = {k: overture.features(k, big, rel) for k in ('land_use', 'water', 'land_cover', 'building')}
    data['release'] = rel
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(data, default=str))
    return data


# ---------- geometry ----------

def local_frame(course):
    w, s, e, n = course['box']
    lon0, lat0 = (w + e) / 2, (s + n) / 2
    kx, kz = 111320 * math.cos(math.radians(lat0)), 110540
    to_local = lambda g: affine_transform(g, [kx, 0, 0, -kz, -lon0 * kx, lat0 * kz])
    to_lonlat = lambda x, z: (lon0 + x / kx, lat0 - z / kz)
    return to_local, to_lonlat


def classify(kind, r):
    sub, cls = r.get('subtype'), r.get('class')
    if kind == 'land_use':
        return GOLF.get(cls) if sub == 'golf' else None
    if kind == 'water':
        if sub == 'human_made':   # swimming pools
            return None
        return 'sea' if cls in ('ocean', 'sea', 'bay', 'strait') or sub == 'ocean' else 'water'
    if kind == 'land_cover':
        return 'wood' if sub == 'forest' else None
    return 'building'


def polygons(g):
    return [p for p in getattr(g, 'geoms', [g]) if p.geom_type == 'Polygon' and not p.is_empty]


def centre_line(fairway, tee, green):
    """The fairway's middle from the tee end to the green end: the shortest path through the
    polygon's Voronoi skeleton between the skeleton points nearest the tee and the green."""
    ring = fairway.exterior
    n = max(16, int(ring.length / 2.5))
    edges = shapely.voronoi_polygons(MultiPoint([ring.interpolate(i * ring.length / n) for i in range(n)]), only_edges=True)
    inner = fairway.buffer(-.5)
    graph = defaultdict(list)
    key = lambda p: (round(p[0], 2), round(p[1], 2))
    for e in getattr(edges, 'geoms', [edges]):
        if not inner.contains(e):
            continue
        c = list(e.coords)
        for a, b in zip(c, c[1:]):
            d = math.dist(a, b)
            graph[key(a)].append((key(b), d))
            graph[key(b)].append((key(a), d))
    if not graph:
        return []
    near = lambda pt: min(graph, key=lambda q: math.dist(q, (pt.x, pt.y)))
    start, goal = near(tee.centroid), near(green.centroid)
    dist, prev, todo = {start: 0}, {start: None}, [(0, start)]
    while todo:
        d, u = heapq.heappop(todo)
        if u == goal:
            break
        if d > dist[u]:
            continue
        for v, w in graph[u]:
            if d + w < dist.get(v, 1e18):
                dist[v], prev[v] = d + w, u
                heapq.heappush(todo, (d + w, v))
    path, u = [], goal
    while u is not None:
        path.append(u)
        u = prev.get(u)
    return path[::-1]


def oval(cx, cz, along, across, heading):
    """an ellipse with its long axis along the heading (radians, 0 = +z)"""
    return translate(rotate(scale(Point(0, 0).buffer(1, 24), across, along), -heading, origin=(0, 0), use_radians=True), cx, cz)


def fill_gap(i, par, line, tee, green, fairway, land):
    """The pieces the map is missing for one hole, laid along its line: a tee box, an oval green with a bunker or two,
    and a fairway from the landing area to the green. Sizes vary with the hole number so no two greens match."""
    out = []
    head = lambda a, b: math.atan2(b[0] - a[0], b[1] - a[1])
    first, last = head(line[0], line[1]), head(line[-2], line[-1])
    if tee:
        out.append(('tee', oval(*line[0], 9, 5, first).minimum_rotated_rectangle))
    if green:
        gx, gz = line[-1]
        along, across = 14 + i % 3, 10.5 + (i * 7 % 3) * .8
        out.append(('green', oval(gx, gz, along, across, last)))
        side = 1 if i % 2 else -1    # one bunker beside the green, and on longer holes a second short of it on the other side
        for a in [last + side * (1.2 + .2 * (i % 3))] + ([last + math.pi - side * .7] if par > 3 and i % 3 != 1 else []):
            out.append(('bunker', oval(gx + math.sin(a) * (across + 5), gz + math.cos(a) * (across + 5), 5 + i % 2, 3, a + math.pi / 2)))
    if fairway and par > 3:
        L = LineString(line)
        spine = LineString([L.interpolate(110)] + [Point(p) for p in line[1:-1] if L.project(Point(p)) > 110] + [L.interpolate(L.length - 16)])
        strip = spine.buffer(14).intersection(land.buffer(-4))
        out += [('fairway', p) for p in polygons(strip) if p.area > 200]
    return out


def hole_line(tee, green, fairway):
    a, b = tee.centroid, green.centroid
    mid = centre_line(fairway, tee, green) if fairway is not None else []
    pts = [(a.x, a.y)] + [p for p in mid if Point(p).distance(a) > 25 and Point(p).distance(b) > 25] + [(b.x, b.y)]
    return list(LineString(pts).simplify(2.5).coords)


# ---------- terrain ----------

def height_grid(box, to_lonlat, step=None):
    step = step or DEM_STEP
    x0, z0, x1, z1 = box
    cols, rows = int((x1 - x0) // step) + 1, int((z1 - z0) // step) + 1
    g = [[terrain.height(*to_lonlat(x0 + i * step, z0 + j * step)) for i in range(cols)] for j in range(rows)]
    # the source has the odd spike: replace any sample far from its neighbours' median
    for j in range(rows):
        for i in range(cols):
            nb = [g[jj][ii] for jj in range(max(0, j - 1), min(rows, j + 2)) for ii in range(max(0, i - 1), min(cols, i + 2))]
            m = statistics.median(nb)
            if abs(g[j][i] - m) > 6:
                g[j][i] = m
    return cols, rows, g


# ---------- encoding ----------

B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'


def varints(values):
    """Zig-zag ints as base64 digits: 5 bits each, the 6th bit says 'more digits follow'."""
    out = []
    for v in values:
        z = v * 2 if v >= 0 else -v * 2 - 1
        while True:
            d, z = z & 31, z >> 5
            out.append(B64[d | (32 if z else 0)])
            if not z:
                break
    return ''.join(out)


def path_ints(pts):
    """A point list as half-metre deltas: n, x0, z0, dx1, dz1, ..."""
    q = [(round(x * 2), round(z * 2)) for x, z in pts]
    out, px, pz = [len(q)], 0, 0
    for x, z in q:
        out += [x - px, z - pz]
        px, pz = x, z
    return out


def stroke_index(holes):
    """Hardest first, odd numbers on the front nine and even on the back, like the game's own."""
    si = [0] * len(holes)
    for nine in (0, 1):
        idx = sorted(range(nine * 9, nine * 9 + 9), key=lambda i: -(holes[i]['m'] - TYPICAL[holes[i]['par']]))
        for r, i in enumerate(idx):
            si[i] = 2 * r + 1 + nine
    return si


# ---------- one course ----------

def build(course):
    data = fetch(course)
    to_local, to_lonlat = local_frame(course)
    feats, by_osm = [], {}
    for kind in ('land_use', 'water', 'land_cover', 'building'):
        for r in data[kind]:
            cls = classify(kind, r)
            if not cls:
                continue
            g = to_local(wkb.loads(bytes.fromhex(r['geometry'])))
            osm = ((r.get('sources') or [{}])[0].get('record_id') or '').split('@')[0]
            for p in polygons(g):
                feats.append((cls, p))
                by_osm.setdefault(osm, p)

    course_area = max((p for c, p in feats if c == 'boundary'), key=lambda p: p.area)
    x0, z0, x1, z1 = course_area.bounds
    box = (math.floor(x0 - MARGIN), math.floor(z0 - MARGIN), math.ceil(x1 + MARGIN), math.ceil(z1 + MARGIN))
    clip, near_course = rect(*box), course_area.buffer(120)

    land = course_area.difference(unary_union([p for c, p in feats if c in ('water', 'sea')]))
    holes = []
    for i, (par, tee, green, fw, *bends) in enumerate(course['holes']):
        if isinstance(tee, str) and isinstance(green, str) and fw != 'est' and not bends:
            line = hole_line(by_osm[tee], by_osm[green], by_osm.get(fw) if fw else None)
        else:
            a, b = (by_osm[s].centroid if isinstance(s, str) else Point(s) for s in (tee, green))
            line = [(a.x, a.y)] + list(bends[0] if bends else []) + [(b.x, b.y)]
            feats += fill_gap(i, par, line, isinstance(tee, tuple), isinstance(green, tuple), fw == 'est', land)
        holes.append(dict(par=par, line=line, m=round(LineString(line).length)))
    si = stroke_index(holes)

    polys = []
    for cls, p in feats:
        if cls == 'building':
            if not near_course.intersects(p):
                continue
            p = p.minimum_rotated_rectangle
        for q in polygons(p.intersection(clip)):
            q = q.simplify(SIMPLIFY.get(cls, 2.0))
            if q.area > 4:
                polys.append((CLASS.index(cls), list(q.exterior.coords)[:-1]))
    polys.sort(key=lambda t: t[0])

    cols, rows, g = height_grid(box, to_lonlat)
    lo = math.floor(min(min(r) for r in g))
    q = [round((h - lo) * 4) for r in g for h in r]
    deltas = [q[0]] + [b - a for a, b in zip(q, q[1:])]

    far_box = (box[0] - FAR, box[1] - FAR, box[2] + FAR, box[3] + FAR)
    fcols, frows, fg = height_grid(far_box, to_lonlat, FAR_STEP)
    flo = math.floor(min(min(r) for r in fg))
    fq = [round((h - flo) * 2) for r in fg for h in r]
    far_deltas = [fq[0]] + [b - a for a, b in zip(fq, fq[1:])]

    poly_ints = [len(polys)]
    for cls, pts in polys:
        poly_ints += [cls] + path_ints(pts)
    hole_ints = [len(holes)]
    for h in holes:
        hole_ints += path_ints(h['line'])

    report(course, holes)
    return dict(id=course['id'], key=course['key'], name=course['name'], town=course['town'], est=course['est'],
                **({'note': course['note']} if course.get('note') else {}),
                par=[h['par'] for h in holes], si=si, m=[h['m'] for h in holes], box=list(box),
                poly=varints(poly_ints), holes=varints(hole_ints),
                dem=dict(x0=box[0], z0=box[1], step=DEM_STEP, cols=cols, rows=rows, lo=lo, d=varints(deltas)),
                far=dict(x0=far_box[0], z0=far_box[1], step=FAR_STEP, cols=fcols, rows=frows, lo=flo, d=varints(far_deltas)),
                credit=f"Map data © OpenStreetMap contributors (ODbL), via Overture Maps {data['release'].split('/')[-1]} · terrain: AWS Terrain Tiles")


def report(course, holes):
    print(f"{course['name']}: par {sum(h['par'] for h in holes)}, {sum(h['m'] for h in holes)} m")
    for i, h in enumerate(holes):
        print(f"  {i + 1:2d}  par {h['par']}  {h['m']:4d} m  {len(h['line'])} points")


def main():
    src = [build(c) for c in COURSES]
    js = ('/* ===== Real courses: map data. Generated by tools/real-courses/build.py from Overture Maps (OpenStreetMap)\n'
          '   and AWS Terrain Tiles; do not edit by hand. Read by 526-real-courses.js ===== */\n'
          'const REAL_SRC=' + json.dumps(src, separators=(',', ':'), ensure_ascii=False) + ';\n')
    OUT.write_text(js)
    print(f'wrote {OUT.relative_to(HERE.parents[1])} ({len(js.encode()) / 1024:.1f} KB)')


if __name__ == '__main__':
    main()
