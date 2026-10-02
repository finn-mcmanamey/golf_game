"""Lay out Kingston Beach's unmapped holes on the real land.

OpenStreetMap has Kingston Beach's boundary, river, ponds, 11 tees and 2 greens, but not the holes. The mapped land is
also smaller than the real 5803 m card needs with normal gaps between fairways, so (Finn's choice) holes keep their real
par and number but play at one shared fraction of their card length, the largest that fits.

How: east-west lanes 42 m apart cross the river bowl, plus a lane on the west bank and one down the east side. A depth-first
search puts holes 4-17 into lanes in card order, each tee near the last green, best-fitting lane first. Holes 1-3 and 18
are the real ones. Prints the result for courses.py.

    python3 tools/real-courses/kingston_layout.py
"""
import json
import math
import time

from shapely import prepared
from shapely.geometry import LineString, Point
from shapely.ops import unary_union

import build
import terrain

KINGSTON_BOX = (147.3139, -42.9796, 147.3242, -42.9701)   # west, south, east, north
CARD = [(3, 162), (4, 311), (4, 340), (4, 322), (4, 393), (5, 488), (3, 120), (3, 207), (5, 470),
        (4, 336), (5, 479), (4, 309), (4, 388), (4, 374), (4, 353), (3, 153), (5, 471), (3, 127)]
LANE_Z = (55, 97, 139, 181, 223, 265, 307, 349)        # east-west lanes across the bowl
EXTRA = {'WEST': [(-330, 45), (-316, 150), (-250, 262)], 'EAST': [(328, 170), (322, 330)]}
START = (25, -10)         # the 3rd green: hole 3 runs from the real tee by the river along the north of the bowl
WALK = 170                # the longest walk from a green to the next tee
GAP = 40                  # metres between one hole's green and the next hole's tee in the same lane


def setup():
    course = dict(key='kingston', box=KINGSTON_BOX)
    to_local, to_lonlat = build.local_frame(course)
    data = build.fetch(course)
    feats = []
    for kind in ('land_use', 'water'):
        for r in data[kind]:
            cls = build.classify(kind, r)
            if cls:
                feats += [(cls, p) for p in build.polygons(to_local(build.wkb.loads(bytes.fromhex(r['geometry']))))]
    bd = max((p for c, p in feats if c == 'boundary'), key=lambda p: p.area)
    land = bd.difference(unary_union([p for c, p in feats if c in ('water', 'sea') and p.area > 400]))
    lanes = {}
    for name, z in zip('ABCDEFGH', LANE_Z):
        seg = land.buffer(-11).intersection(LineString([(-600, z), (305, z)]))
        parts = sorted([g for g in getattr(seg, 'geoms', [seg]) if g.length > 100], key=lambda g: -g.length)
        if parts:
            xs = [c[0] for c in parts[0].coords]
            lanes[name] = [(min(xs), z), (min(max(xs), 305), z)]
    lanes.update(EXTRA)
    height = lambda x, z: terrain.height(*to_lonlat(x, z))
    return land, bd, lanes, height


class Fit:
    """Can a hole of length L sit in a lane from offset s (in the lane's or the reversed direction)?"""

    def __init__(self, land, bd, lanes, height):
        self.lanes = {k: LineString(v) for k, v in lanes.items()}
        self.green_ok = prepared.prep(land.buffer(-11))
        self.fairway_ok = prepared.prep(land.buffer(-6))
        self.inside = prepared.prep(bd.buffer(-3))
        self.height = height

    def slope(self, x, z):
        h = self.height
        return max(abs(h(x + 10, z) - h(x - 10, z)), abs(h(x, z + 10) - h(x, z - 10))) / 20

    def line(self, lane, L, par, rev, s):
        ln = self.lanes[lane]
        if rev:
            ln = LineString(list(ln.coords)[::-1])
        if s + L > ln.length - 16:
            return None
        pts = [ln.interpolate(s)] + [Point(q) for q in ln.coords if s < ln.project(Point(q)) < s + L] + [ln.interpolate(s + L)]
        line = [(p.x, p.y) for p in pts]
        hole, g = LineString(line), Point(line[-1])
        if not self.green_ok.contains(g.buffer(14)) or self.slope(g.x, g.y) > .15:
            return None
        if not self.inside.contains(hole) or not self.fairway_ok.contains(Point(line[0]).buffer(5)):
            return None
        if par > 3 and not self.fairway_ok.contains(LineString([hole.interpolate(110)] + [Point(q) for q in line[1:]]).buffer(13)):
            return None
        return line


def search(fit, scale, deadline):
    holes = list(range(3, 17))                        # holes 4..17
    length = {i: round(CARD[i][1] * scale) for i in holes}
    best = {'n': 0, 'route': None}

    def options(i, prev, used):
        par, L = CARD[i][0], length[i]
        out = []
        for lane, ln in fit.lanes.items():
            n = ln.length
            if L > n - 16:
                continue
            busy = used.get(lane, [])
            for rev in (False, True):
                for s in range(0, int(n - L - 16) + 1, 10):
                    a, b = (n - s - L, n - s) if rev else (s, s + L)
                    if any(not (b + GAP <= a2 or a >= b2 + GAP) for a2, b2 in busy):
                        continue
                    t = ln.interpolate(n - s if rev else s)
                    w = math.dist(prev, (t.x, t.y))
                    if w > WALK or w < 15:
                        continue
                    line = fit.line(lane, L, par, rev, s)
                    if line:
                        free = n - sum(b2 - a2 for a2, b2 in busy) - L      # best fit: fill the fullest lane first
                        out.append((w * .5 + free * .6, lane, (a, b), line))
        out.sort(key=lambda o: o[0])
        return out[:6]

    def dfs(k, prev, used, route):
        if time.time() > deadline:
            return None
        if k > best['n']:
            best['n'], best['route'] = k, list(route)
        if k == len(holes):
            return route
        i = holes[k]
        for _, lane, span, line in options(i, prev, used):
            u = dict(used)
            u[lane] = used.get(lane, []) + [span]
            r = dfs(k + 1, line[-1], u, route + [(i, lane, line)])
            if r:
                return r
        return None

    return dfs(0, START, {}, []), best


def main():
    fit = Fit(*setup())
    for scale in (.9, .88, .86, .84, .82, .8, .78):
        route, best = search(fit, scale, time.time() + 150)
        print(f'scale {scale}: ' + ('found' if route else f'reached hole {best["n"] + 3}'))
        if route:
            for i, lane, line in route:
                print(f'  {i + 1:2d} par {CARD[i][0]} {LineString(line).length:4.0f} m (card {CARD[i][1]}) lane {lane}: '
                      + json.dumps([[round(x), round(z)] for x, z in line]))
            json.dump({'scale': scale, 'holes': [(i, lane, line) for i, lane, line in route]},
                      open(build.HERE / 'cache' / 'kingston_layout.json', 'w'))
            return


if __name__ == '__main__':
    main()
