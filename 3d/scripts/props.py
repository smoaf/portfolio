"""
Scattered objects towards the faded edge of the plateau (Smo, 5 Oct 2026): a few, and of kinds
not used elsewhere. Weather mast, survey tripod, stone cairns, a wind-bent dead tree, grass
tussocks, fuel drums, an old wooden sledge, a line of marker poles running into the fade.
"""
import numpy as np
import trimesh
from build_station_v4 import box, cyl, rod, U, cat, ROT


def weather_mast(x, y, h=6.0):
    black = [rod((x, y, 0), (x, y, h), 0.04, 8)]
    for a in (0.3, 2.4, 4.5):                                   # guy wires
        black.append(rod((x, y, h * 0.8), (x + 2.6 * np.cos(a), y + 2.6 * np.sin(a), 0), 0.008, 4))
    black.append(rod((x - 0.5, y, h - 0.4), (x + 0.5, y, h - 0.4), 0.02, 6))   # cross arm
    for k in range(3):                                          # anemometer cups
        a = 2 * np.pi * k / 3
        p = (x + 0.5 + 0.18 * np.cos(a), y + 0.18 * np.sin(a), h - 0.25)
        black.append(rod((x + 0.5, y, h - 0.25), p, 0.008, 4))
        black.append(trimesh.creation.icosphere(1, 0.05).apply_translation(p))
    black.append(rod((x + 0.5, y, h - 0.4), (x + 0.5, y, h - 0.25), 0.012, 4))
    vane = box(0.35, 0.02, 0.15, x - 0.65, y, h - 0.3)
    plaster = [box(0.5, 0.35, 0.5, x, y, 1.0),                  # logger box
               box(0.9, 0.05, 0.6, x, y - 0.2, 2.2).apply_transform(ROT(0.5, (1, 0, 0), (x, y - 0.2, 2.2))),   # solar panel
               cyl(0.3, 0.12, x, y, 0.06, 16), vane]
    return cat(plaster), cat(black)


def survey_tripod(x, y):
    black = [rod((x + 0.6 * np.cos(a), y + 0.6 * np.sin(a), 0), (x, y, 1.45), 0.02, 6) for a in (0.2, 2.3, 4.4)]
    plaster = [cyl(0.12, 0.06, x, y, 1.48, 16), box(0.18, 0.28, 0.22, x, y, 1.62), cyl(0.05, 0.25, x, y + 0.2, 1.66, 12)
               .apply_transform(ROT(np.pi / 2, (1, 0, 0), (x, y + 0.2, 1.66)))]
    return cat(plaster), cat(black)


def cairn(x, y, h=1.4, seed=1):
    rng = np.random.default_rng(seed)
    stones, z = [], 0.0
    for k in range(6):
        r = 0.55 * (1 - k / 7) + rng.uniform(-0.05, 0.05)
        t = r * rng.uniform(0.35, 0.5)
        s = trimesh.creation.icosphere(1, 1.0)
        s.apply_scale((r, r * rng.uniform(0.75, 0.95), t))
        s.apply_transform(ROT(rng.uniform(0, 3), (0, 0, 1)))
        s.apply_translation((x + rng.uniform(-0.05, 0.05), y + rng.uniform(-0.05, 0.05), z + t * 0.8))
        stones.append(s)
        z += t * 1.5
        if z > h:
            break
    return cat(stones)


def dead_tree(x, y, h=3.4, seed=3):
    """Wind-bent bare tree: trunk leaning one way, a few crooked branches."""
    rng = np.random.default_rng(seed)
    lean = np.array([0.9, 0.35, 0.0])
    pts = [np.array([x, y, 0.0])]
    for k in range(1, 5):
        pts.append(np.array([x, y, 0]) + lean * (k / 4) ** 1.6 * 1.6 + np.array([0, 0, h * k / 4]))
    parts = []
    for i in range(4):
        r = 0.2 * (1 - i / 5)
        parts.append(rod(pts[i], pts[i + 1], r, 8))
        parts.append(trimesh.creation.icosphere(1, r).apply_translation(pts[i + 1]))
    for k in range(7):
        base = pts[2 + k % 3]
        a = rng.uniform(-0.6, 0.9)
        L = rng.uniform(0.8, 1.6)
        tip = base + np.array([np.cos(a) * L, np.sin(a) * L * 0.6, rng.uniform(0.1, 0.7)])
        mid = (base + tip) / 2 + np.array([0, 0, 0.15])
        parts += [rod(base, mid, 0.06, 6), rod(mid, tip, 0.035, 5)]
        twig = tip + np.array([0.3, rng.uniform(-0.3, 0.3), 0.25])
        parts.append(rod(tip, twig, 0.02, 4))
    return cat(parts)


def tussocks(x, y, n=7, seed=5):
    """A patch of grass tufts: each a fan of thin blades."""
    rng = np.random.default_rng(seed)
    blades = []
    for k in range(n):
        cx, cy = x + rng.uniform(-2.2, 2.2), y + rng.uniform(-1.6, 1.6)
        size = rng.uniform(0.35, 0.6)
        for j in range(11):
            a = rng.uniform(0, 2 * np.pi)
            tilt = rng.uniform(0.15, 0.7)
            v = np.array([np.cos(a) * np.sin(tilt), np.sin(a) * np.sin(tilt), np.cos(tilt)]) * size
            blade = trimesh.creation.cone(radius=0.025, height=size, sections=4)
            blade.apply_transform(trimesh.geometry.align_vectors((0, 0, 1), v))
            blade.apply_translation((cx, cy, 0))
            blades.append(blade)
    return cat(blades)


def fuel_drums(x, y):
    d = [cyl(0.29, 0.88, x + dx, y + dy, 0.44, 20) for dx, dy in ((0, 0), (0.62, 0.1), (0.3, 0.55))]
    lying = cyl(0.29, 0.88, 0, 0, 0, 20)
    lying.apply_transform(ROT(np.pi / 2, (0, 1, 0)))
    lying.apply_transform(ROT(0.6, (0, 0, 1)))
    lying.apply_translation((x - 0.9, y + 0.9, 0.29))
    rings = []
    for m in d:
        cx, cy = m.bounds.mean(axis=0)[:2]
        for z in (0.29, 0.59):
            rings.append(trimesh.creation.annulus(r_min=0.29, r_max=0.305, height=0.025, sections=20).apply_translation((cx, cy, z)))
    return cat(d + [lying]), cat(rings)


def sledge(x, y, heading=0.4):
    """Old wooden expedition sledge with upturned runners and black lashings."""
    wood, black = [], []
    for s in (-1, 1):
        wood.append(box(3.0, 0.07, 0.06, 0, s * 0.42, 0.03))
        tip = box(0.5, 0.07, 0.06)
        tip.apply_transform(ROT(-0.6, (0, 1, 0)))
        tip.apply_translation((1.68, s * 0.42, 0.16))
        wood.append(tip)
        for xx in np.linspace(-1.2, 1.2, 5):
            wood.append(box(0.05, 0.05, 0.3, xx, s * 0.42, 0.2))
    for xx in np.linspace(-1.3, 1.3, 9):
        wood.append(box(0.12, 0.95, 0.03, xx, 0, 0.36))
    wood.append(box(1.2, 0.7, 0.35, -0.4, 0, 0.55))               # a crate lashed on
    black += [rod((-0.4 + dx, -0.45, 0.38), (-0.4 + dx, 0.45, 0.38), 0.012, 4) for dx in (-0.3, 0.3)]
    black += [rod((-0.4 + dx, s * 0.36, 0.38), (-0.4 + dx, s * 0.36, 0.73), 0.012, 4) for dx in (-0.3, 0.3) for s in (-1, 1)]
    black += [rod((-0.4 + dx, -0.36, 0.73), (-0.4 + dx, 0.36, 0.73), 0.012, 4) for dx in (-0.3, 0.3)]
    T = ROT(heading, (0, 0, 1)); T[:3, 3] = (x, y, 0)
    return cat(wood).apply_transform(T), cat(black).apply_transform(T)


def marker_poles(p0, p1, n=5):
    black, flags = [], []
    for k in range(n):
        t = k / (n - 1)
        x, y = p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t
        black.append(rod((x, y, 0), (x, y, 1.8), 0.025, 6))
        flags.append(box(0.02, 0.35, 0.22, x, y + 0.18, 1.65))
    return cat(black), cat(flags)


def scatter():
    items = []
    p, b = weather_mast(46.0, -30.0); items += [("props/weather_mast", p, "plaster"), ("props/weather_mast_steel", b, "linework")]
    p, b = survey_tripod(40.0, -44.0); items += [("props/survey_tripod", p, "plaster"), ("props/survey_tripod_legs", b, "linework")]
    items += [("props/cairn_a", cairn(-48.0, -38.0, 1.5, 1), "plaster"), ("props/cairn_b", cairn(-60.0, -14.0, 1.1, 2), "plaster")]
    items.append(("props/dead_tree", dead_tree(-34.0, -50.0), "plaster_warm"))
    items += [("props/tussocks_a", tussocks(24.0, -46.0, 7, 5), "plaster_warm"),
              ("props/tussocks_b", tussocks(-64.0, -2.0, 6, 6), "plaster_warm"),
              ("props/tussocks_c", tussocks(30.0, -52.0, 5, 7), "plaster_warm")]
    p, b = fuel_drums(44.0, -4.0); items += [("props/fuel_drums", p, "plaster"), ("props/fuel_drum_rings", b, "linework")]
    p, b = sledge(-12.0, -56.0); items += [("props/sledge", p, "plaster_warm"), ("props/sledge_lashing", b, "linework")]
    b, f = marker_poles((6.0, -42.0), (16.0, -64.0)); items += [("props/marker_poles", b, "linework"), ("props/marker_flags", f, "plaster_warm")]
    return items
