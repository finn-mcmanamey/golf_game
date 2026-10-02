"""The real courses: where they are and how their holes are routed.

Each hole names its tee, green and (optional) fairway by OpenStreetMap id, as Overture reports them
in `sources[0].record_id`. The map has no hole numbers, so the order below is our reading of it:
tee boxes point down their hole, fairways join a tee to a green, and each green sits near the next tee.
"""

COURSES = [
    dict(
        id=1, key='claremont', name='Claremont Golf Club', town='Claremont, Hobart', est=1973,
        box=(147.2660, -42.7965, 147.2865, -42.7875),   # west, south, east, north
        clubhouse=(147.27007, -42.79153),
        # Current card: par 69, 5362 m from the blue tees (golfify, planetgolf)
        holes=[  # (par, tee, green, fairway)
            (5, 'w1259659750', 'w1259659718', 'r19625138'),   # 1  along the western shore to the point
            (3, 'w1259659719', 'w1259659716', None),          # 2  over the bay from the point
            (5, 'w1259659717', 'w1259659714', 'r19625141'),   # 3  the long diagonal up the middle
            (3, 'w1431104913', 'w1259659710', None),          # 4
            (4, 'w1259659707', 'w1259659705', 'r19625142'),   # 5  dogleg right to the eastern tip
            (3, 'w1259659704', 'w1259659701', None),          # 6  along the tip
            (4, 'w1259659697', 'w1259659715', 'r19628210'),   # 7  back west, dogleg left
            (5, 'w1259659741', 'w1259659731', 'r19628209'),   # 8
            (4, 'w1431104914', 'w1259659723', 'r19628205'),   # 9  home to the clubhouse
            (4, 'w1259659752', 'w1259659727', 'r19628206'),   # 10
            (3, 'w1431120513', 'w1259659722', None),          # 11
            (3, 'w1259659756', 'w1259659720', 'r19628207'),   # 12
            (4, 'w1259659754', 'w1259659730', 'r19628208'),   # 13
            (3, 'w1431104915', 'w1431120516', None),          # 14
            (4, 'w1259659735', 'w1259659739', 'r19628203'),   # 15 dogleg left
            (5, 'w1259659746', 'w1259659696', 'w1431509770'),  # 16 the northern shore
            (4, 'w1259659736', 'w1259659734', 'r19628204'),   # 17
            (3, 'w1431120515', 'w1259659726', None),          # 18 to the clubhouse
        ],
    ),
]
