"""
Plaster cacti after Smo's references (Downloads images-4.jpeg, images-5.jpeg):
- candelabra(): a short thick trunk that opens into a crown of many ribbed columns rising
  straight up, like a giant candelabra cactus.
- saguaro(): a tall central column with arms that leave in tiers, curve out and turn upwards.
Columns are low-sided cylinders, so they read as ribbed in plaster.
"""
import numpy as np
import trimesh
from build_station_v4 import U, cat, ROT

SIDES = 9


def column(path, r_start, r_end):
    """A ribbed column along a polyline, with spheres smoothing the joints and a rounded tip."""
    path = [np.array(p, float) for p in path]
    n = len(path) - 1
    parts = []
    for i in range(n):
        r = r_start + (r_end - r_start) * (i / max(1, n - 1))
        seg = trimesh.creation.cylinder(radius=r, segment=[path[i], path[i + 1]], sections=SIDES)
        parts.append(seg)
        last = i == n - 1
        joint = trimesh.creation.icosphere(subdivisions=1 if last else 0, radius=r * (0.98 if last else 1.02))
        joint.apply_translation(path[i + 1])
        parts.append(joint)
    return cat(parts)


def curve_up(start, direction, out, up, r, steps=5):
    """Path that leaves `start` sideways along `direction` for `out` metres, bends and rises `up`."""
    d = np.array([direction[0], direction[1], 0.0])
    d /= np.linalg.norm(d)
    pts = []
    for k in range(steps + 1):
        t = k / steps
        a = t * np.pi / 2
        pts.append(np.array(start) + d * out * np.sin(a) + np.array([0, 0, 1]) * (out * (1 - np.cos(a)) * 0.6))
    top = pts[-1] + np.array([0, 0, up])
    mid = (pts[-1] + top) / 2
    return pts + [mid, top]


def candelabra(x, y, height=7.5, seed=1):
    rng = np.random.default_rng(seed)
    trunk_h = height * 0.32
    parts = [column([(x, y, 0), (x, y, trunk_h * 0.6), (x, y, trunk_h)], 0.7, 0.8)]
    # crown: rings of columns growing out of the trunk top, outer ring leans furthest
    for ring, (count, out, r) in enumerate([(18, 2.6, 0.2), (12, 1.6, 0.21), (7, 0.6, 0.22)]):
        for k in range(count):
            a = 2 * np.pi * k / count + rng.uniform(-0.15, 0.15) + ring * 0.3
            start = (x + 0.3 * np.cos(a), y + 0.3 * np.sin(a), trunk_h + rng.uniform(-0.2, 0.2))
            up = height - trunk_h - out * 0.6 - rng.uniform(0.0, 1.6) + ring * 0.4
            parts.append(column(curve_up(start, (np.cos(a), np.sin(a)), out, up, r), r * 1.05, r))
    return U(parts) if False else cat(parts)


def saguaro(x, y, height=9.0, seed=2):
    rng = np.random.default_rng(seed)
    parts = [column([(x, y, 0), (x, y, height * 0.5), (x + 0.05, y, height)], 0.42, 0.34)]
    tiers = [(0.28, 4, 1.1), (0.45, 5, 0.9), (0.6, 5, 0.7), (0.75, 3, 0.5)]
    for t, count, out in tiers:
        for k in range(count):
            a = 2 * np.pi * k / count + rng.uniform(-0.3, 0.3) + t * 3
            z = height * t + rng.uniform(-0.3, 0.3)
            up = height * (0.95 - t) * rng.uniform(0.45, 0.8)
            parts.append(column(curve_up((x, y, z), (np.cos(a), np.sin(a)), out, up, 0.2), 0.22, 0.19))
    return cat(parts)


def cacti(spots):
    """spots: list of (kind, x, y, height, seed). Returns one item per cactus."""
    items = []
    for i, (kind, x, y, h, seed) in enumerate(spots):
        m = candelabra(x, y, h, seed) if kind == "candelabra" else saguaro(x, y, h, seed)
        items.append((f"flora/cactus_{i:02d}", m, "plaster"))
    return items


if __name__ == "__main__":
    from build_station_v4 import export, box
    items = cacti([("candelabra", 0, 0, 7.5, 1), ("saguaro", 8, 0, 9.0, 2)]) + [("ground", box(20, 12, 0.2, 4, 0, -0.1), "ground")]
    print("cactus test triangles:", export(items, "cactus_test.glb"))


def desert_bush(x, y, size=1.4, seed=1):
    """Low, airy desert shrub: thin branches fanning out from one base, small leaf clumps at the tips."""
    rng = np.random.default_rng(seed)
    parts = []
    base = np.array([x, y, 0.0])
    for k in range(16):
        a = rng.uniform(0, 2 * np.pi)
        tilt = rng.uniform(0.35, 1.2)
        L = size * rng.uniform(0.7, 1.0)
        tip = base + np.array([np.cos(a) * np.sin(tilt) * L, np.sin(a) * np.sin(tilt) * L, np.cos(tilt) * L * 0.85])
        mid = base + (tip - base) * 0.55
        parts.append(trimesh.creation.cylinder(radius=0.025 * size, segment=[base, tip], sections=5))
        for s in (-1, 1):
            b = a + s * rng.uniform(0.3, 0.7)
            twig = mid + np.array([np.cos(b) * 0.3 * size, np.sin(b) * 0.3 * size, 0.25 * size])
            parts.append(trimesh.creation.cylinder(radius=0.015 * size, segment=[mid, twig], sections=4))
            parts.append(trimesh.creation.icosphere(subdivisions=0, radius=0.09 * size).apply_translation(twig))
        parts.append(trimesh.creation.icosphere(subdivisions=0, radius=0.11 * size).apply_translation(tip))
    return cat(parts)


def agave(x, y, size=1.2, seed=4):
    """Rosette of long pointed leaves, a different, more sculptural plant."""
    rng = np.random.default_rng(seed)
    leaves = []
    for ring, (count, tilt, length) in enumerate([(9, 1.05, 1.0), (7, 0.7, 0.95), (5, 0.35, 0.8)]):
        for k in range(count):
            a = 2 * np.pi * k / count + ring * 0.4 + rng.uniform(-0.1, 0.1)
            L = size * length * rng.uniform(0.85, 1.05)
            d = np.array([np.cos(a) * np.sin(tilt), np.sin(a) * np.sin(tilt), np.cos(tilt)])
            side = np.array([-np.sin(a), np.cos(a), 0.0])
            w = 0.09 * size
            root = np.array([x, y, 0.05])
            pts = [root + side * w, root - side * w, root + d * 0.02 + np.array([0, 0, 0.04]),
                   root + d * L * 0.45 + side * w * 0.8, root + d * L * 0.45 - side * w * 0.8,
                   root + d * L + np.array([0, 0, -0.08 * L * np.sin(tilt)])]
            leaves.append(trimesh.convex.convex_hull(np.array(pts)))
    return cat(leaves)
