"""
Objects towards the faded edge of the plateau (Smo, 5 Oct 2026). After review: nature only
(a wind-bent dead tree, grass tussocks) plus one relay station in place of the weather mast.
The other makers (tripod, cairns, drums, sledge, marker poles) stay defined but unused.
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


def relay_station(x, y, h=17.0):
    """Radio relay station: lattice tower with guy wires, three large dish antennas, a ring of
    six panel antennas, yagi arms and whips at the top, an equipment hut with a cable bridge,
    and a beacon that glows at night."""
    from construction import lattice
    black = [lattice((x, y, 0.3), (x, y, h), 1.4, 1.5, 0.03)]
    plaster = [box(2.4, 2.4, 0.3, x, y, 0.15)]
    for a in (0.5, 2.6, 4.7):
        for f in (0.45, 0.7, 0.92):
            black.append(rod((x, y, h * f), (x + 9.5 * np.cos(a), y + 9.5 * np.sin(a), 0), 0.012, 4))
        plaster.append(box(0.7, 0.7, 0.3, x + 9.5 * np.cos(a), y + 9.5 * np.sin(a), 0.15))
    for z, a, r in ((h * 0.5, 0.2, 1.5), (h * 0.66, 2.1, 1.25), (h * 0.8, 4.0, 1.1)):     # big dishes
        d = np.array([np.cos(a), np.sin(a), 0.0])
        c = np.array([x, y, z]) + d * 1.1
        dish = trimesh.creation.cone(radius=r, height=r * 0.35, sections=36)
        dish.apply_transform(trimesh.geometry.align_vectors((0, 0, 1), -d))
        dish.apply_translation(c + d * r * 0.35)
        plaster.append(dish)
        rim = trimesh.creation.annulus(r_min=r - 0.04, r_max=r + 0.02, height=0.06, sections=36)
        rim.apply_transform(trimesh.geometry.align_vectors((0, 0, 1), d))
        rim.apply_translation(c)
        black.append(rim)
        black.append(rod(np.array([x, y, z]), c, 0.04, 6))
        black += [rod(c + np.array([0, 0, s * r * 0.7]), c + d * r * 0.9, 0.012, 4) for s in (-1, 1)]   # feed struts
        black.append(cyl(0.07, 0.25, *(c + d * r * 0.95), 10))
    for k in range(6):                                                         # ring of panel antennas
        a = 2 * np.pi * k / 6 + 0.25
        pa = box(0.12, 0.35, 1.8)
        pa.apply_transform(ROT(a, (0, 0, 1)))
        pa.apply_translation((x + 1.0 * np.cos(a), y + 1.0 * np.sin(a), h - 1.0))
        plaster.append(pa)
        black.append(rod((x, y, h - 0.6), (x + 0.95 * np.cos(a), y + 0.95 * np.sin(a), h - 0.6), 0.025, 6))
    black += ring_pts(x, y, 0.95, h - 0.2) + ring_pts(x, y, 0.95, h - 1.8)
    for a in (1.0, 3.1, 5.2):                                                  # yagi arms
        d = np.array([np.cos(a), np.sin(a), 0.0])
        base = np.array([x, y, h * 0.88])
        tip = base + d * 2.2
        black.append(rod(base, tip, 0.03, 6))
        s = np.array([-d[1], d[0], 0])
        black += [rod(base + d * t - s * 0.35, base + d * t + s * 0.35, 0.012, 4) for t in np.linspace(0.8, 2.1, 6)]
    black.append(rod((x, y, h), (x, y, h + 3.0), 0.035, 6))                   # top mast and whips
    black += [rod((x + 0.3 * np.cos(a), y + 0.3 * np.sin(a), h), (x + 0.3 * np.cos(a), y + 0.3 * np.sin(a), h + 2.2), 0.012, 4)
              for a in (0.0, 2.1, 4.2)]
    hx, hy = x + 4.4, y - 2.4          # between the guy wires, left of the tower in the default view
    plaster.append(box(3.4, 2.4, 2.6, hx, hy, 1.3 + 0.2))
    plaster.append(box(3.7, 2.7, 0.12, hx, hy, 2.86))
    black += [box(0.9, 0.02, 2.0, hx + 0.7, hy - 1.21, 1.2), box(0.5, 0.02, 0.35, hx - 0.9, hy - 1.21, 2.0)]
    black += [box(0.08, 0.08, 0.2, hx + dx, hy + dy, 0.1) for dx in (-1.5, 1.5) for dy in (-1.0, 1.0)]
    black.append(rod((hx - 1.7, hy + 0.4, 2.3), (x + 0.7, y - 0.3, 2.7), 0.05, 6))
    black += tv_antenna((x, y, h + 2.55), np.radians(15))            # Smo: one more antenna, like his photo
    beacon = trimesh.creation.icosphere(1, 0.15).apply_translation((x, y, h + 3.1))
    return cat(plaster), cat(black), beacon


def tv_antenna(at, heading, tilt=np.radians(7)):
    """Combined UHF/VHF antenna after Smo's photo (Downloads/01mm-dc21a.png): a long boom with a
    row of small V-shaped directors in front, a clamp on the mast, and behind it the VHF part:
    a few long elements, a folded dipole loop and a reflector, plus a brace back to the mast."""
    at = np.array(at, float)
    d = np.array((np.cos(heading) * np.cos(tilt), np.sin(heading) * np.cos(tilt), np.sin(tilt)))   # boom, forward
    s = np.array((-np.sin(heading), np.cos(heading), 0.0))                                          # sideways
    up = np.cross(s, d)
    P = lambda t, a=0.0, b=0.0: at + d * t + s * a + up * b
    parts = [rod(P(-1.6), P(3.4), 0.03, 6)]                                  # boom, clamp at t = 0
    parts.append(box(0.14, 0.14, 0.22, *P(0.0)))                              # clamp
    for i, t in enumerate(np.linspace(0.6, 3.3, 14)):                        # directors: small Vs
        w = 0.28 - i * 0.008
        for sg in (-1, 1):
            parts.append(rod(P(t), P(t + 0.06, sg * w, 0.05), 0.008, 3))
    for t, w in ((-0.25, 0.75), (-0.55, 0.95)):                              # VHF elements
        parts.append(rod(P(t, -w), P(t, w), 0.012, 4))
    loop = [P(-0.9, -0.8, 0), P(-0.9, 0.8, 0), P(-0.9, 0.8, 0.09), P(-0.9, -0.8, 0.09)]   # folded dipole
    parts += [rod(loop[i], loop[(i + 1) % 4], 0.012, 4) for i in range(4)]
    parts.append(rod(P(-0.9), P(-0.9, 0, 0.09), 0.012, 4))
    for t, w in ((-1.25, 1.05), (-1.55, 1.15)):                              # long rear elements
        parts.append(rod(P(t, -w), P(t, w), 0.012, 4))
    parts.append(rod(at + np.array((0, 0, -0.9)), P(-1.1), 0.015, 4))     # brace back to the mast
    return parts


def ring_pts(x, y, r, z, n=12):
    pts = [(x + r * np.cos(a), y + r * np.sin(a), z) for a in np.linspace(0, 2 * np.pi, n + 1)]
    return [rod(pts[i], pts[i + 1], 0.02, 4) for i in range(n)]


def solar_field_on_hill(cx, cy, face_to, height_fn, rows=8, tables=14, tilt=0.45, turn=0.0):
    """Solar field on a hillside: rows of 6 m tables, each table set on the ground height at its
    own spot, the whole field turned so the panels face `face_to` (x, y). `turn` (radians) turns
    the field further, so the rows run diagonally across the view."""
    from build_station_v4 import cat
    face = np.arctan2(face_to[1] - cy, face_to[0] - cx)
    R = ROT(face - np.pi / 2 + turn, (0, 0, 1))
    panels, black = [], []
    depth, w = 1.7, 3.4          # smaller tables (Smo: panels looked too big next to the buildings)
    for r in range(rows):
        ly = (r - (rows - 1) / 2) * 4.2
        for t in range(tables):
            lx = (t - (tables - 1) / 2) * (w + 0.4)
            wx, wy = (R[:2, :2] @ np.array([lx, ly])) + (cx, cy)
            gz = height_fn(wx, wy)
            zc = 0.5 + depth / 2 * np.sin(tilt)
            p = box(w, depth, 0.08); p.apply_transform(ROT(-tilt, (1, 0, 0))); p.apply_translation((lx, ly, zc + gz))
            p.apply_transform(R); p.apply_translation((cx, cy, 0)); panels.append(p)
            dy, dz = depth / 2 * np.cos(tilt), depth / 2 * np.sin(tilt)
            parts = [rod((xx, ly + dy * 0.8, gz - 1.0), (xx, ly + dy * 0.8, gz + zc - dz * 0.6), 0.05, 6) for xx in (lx - 1.3, lx + 1.3)]
            parts += [rod((xx, ly - dy * 0.8, gz - 1.0), (xx, ly - dy * 0.8, gz + zc + dz * 0.6), 0.05, 6) for xx in (lx - 1.3, lx + 1.3)]
            parts += [rod((lx - w / 2 + k * 0.85, ly - dy, gz + zc + dz + 0.05), (lx - w / 2 + k * 0.85, ly + dy, gz + zc - dz + 0.05), 0.012, 4) for k in range(1, 4)]
            b = cat(parts); b.apply_transform(R); b.apply_translation((cx, cy, 0)); black.append(b)
    return cat(panels), cat(black)


def wind_turbine(x, y, ground, face_to, hub_h=70.0, blade=28.0):
    """Modern three-blade wind turbine: tapered tower, nacelle, spinner. The rotor is returned
    separately with its own transform (pivot at the hub, rotor axis = node local x) so the viewer
    can turn it. Returns (static parts, rotor mesh, rotor transform)."""
    yaw = np.arctan2(face_to[1] - y, face_to[0] - x)
    ring = lambda r, z: [(x + r * np.cos(a), y + r * np.sin(a), z) for a in np.linspace(0, 2 * np.pi, 24, endpoint=False)]
    tower = trimesh.convex.convex_hull(np.array(ring(2.1, ground - 2) + ring(1.1, ground + hub_h - 1.5)))
    base = cyl(3.2, 1.0, x, y, ground - 0.3, 24)
    nac = trimesh.convex.convex_hull(np.array([(dx, sy * w, ground + hub_h + dz) for dx, w, dz in
                                               ((-7.5, 1.4, -1.2), (-7.5, 1.4, 1.3), (1.5, 1.7, -1.6), (1.5, 1.7, 1.7))
                                               for sy in (-1, 1)]))
    nac.apply_transform(ROT(yaw, (0, 0, 1), (0, 0, 0)))
    nac.apply_translation((x, y, 0))
    statics = cat([tower, base, nac])
    # rotor in its own frame: axis along +x, blades in the y-z plane
    spinner = trimesh.creation.cone(radius=1.6, height=3.0, sections=24)
    spinner.apply_transform(ROT(np.pi / 2, (0, 1, 0)))
    blades = [spinner, cyl(1.6, 1.0, 0, 0, 0, 24).apply_transform(ROT(np.pi / 2, (0, 1, 0)))]
    for k in range(3):
        a = 2 * np.pi * k / 3
        pts = []
        for t, c, th in ((0.0, 1.0, 0.45), (0.15, 2.4, 0.4), (0.5, 1.5, 0.25), (1.0, 0.45, 0.08)):
            r = 1.4 + t * blade
            pts += [(-th, -c / 2, r), (th, -c / 2 + 0.2, r), (0, c / 2, r)]
        b = trimesh.convex.convex_hull(np.array(pts))
        b.apply_transform(ROT(a, (1, 0, 0)))
        blades.append(b)
    rotor = cat(blades)
    T = ROT(yaw, (0, 0, 1))
    T[:3, 3] = (x + 2.6 * np.cos(yaw), y + 2.6 * np.sin(yaw), ground + hub_h)
    return statics, rotor, T


SOLAR = dict(cx=-60.0, cy=-115.0, rows=7, tables=11, turn=np.radians(35))   # shared with hill_dressing()


def hill_dressing(face_to=(33.0, 66.0)):
    """Boulders, bushes, grass patches and two small cacti on the hill around the solar field
    (Smo). Spots are drawn at random and rejected if they touch the solar field, the turbine or
    each other, so nothing overlaps. Each piece sits on the hill height, sunk slightly into the slope."""
    from landscape import hill_height, HILLS
    from flora import desert_bush, saguaro, candelabra
    rng = np.random.default_rng(42)
    S = SOLAR
    face = np.arctan2(face_to[1] - S["cy"], face_to[0] - S["cx"])
    a = face - np.pi / 2 + S["turn"]
    hx_ = S["tables"] * (3.4 + 0.4) / 2 + 3.0          # field half size plus 3 m margin
    hy_ = S["rows"] * 4.2 / 2 + 3.0
    tx, ty = HILLS[0][0], HILLS[0][1]                   # turbine
    from radio_dish import footprint
    dx_, dy_, dr_ = footprint()

    def free(x, y, r, taken):
        dx, dy = x - S["cx"], y - S["cy"]
        u, v = dx * np.cos(a) + dy * np.sin(a), -dx * np.sin(a) + dy * np.cos(a)
        if abs(u) < hx_ + r and abs(v) < hy_ + r:
            return False
        if np.hypot(x - tx, y - ty) < 8.0 + r:
            return False
        if np.hypot(x - dx_, y - dy_) < dr_ + r:            # keep clear of the radio dish and its towers
            return False
        if hill_height(x, y) < 7.0:                     # low ground is faded out in the viewer
            return False
        return all(np.hypot(x - px, y - py) > r + pr + 1.5 for px, py, pr in taken)

    def ground(x, y, r):                               # lowest point under the footprint
        return min(hill_height(x + r * np.cos(t), y + r * np.sin(t)) for t in np.linspace(0, 2 * np.pi, 8)) - 0.15

    taken = []

    def spots(n, rmin, rmax):
        out = []
        for _ in range(4000):
            if len(out) == n:
                break
            x, y, r = rng.uniform(-125, 5), rng.uniform(-138, -98), rng.uniform(rmin, rmax)
            if free(x, y, r, taken):
                taken.append((x, y, r)); out.append((x, y, r))
        return out

    items = []
    # two small cacti first, so they get good spots
    for k, (x, y, r) in enumerate(spots(2, 1.4, 1.6)):
        m = saguaro(0, 0, 3.6, 7) if k == 0 else candelabra(0, 0, 3.0, 8)
        m.apply_translation((x, y, ground(x, y, 0.5)))
        items.append((f"props/hill_cactus_{k}", m, "plaster"))
    rocks = []
    for x, y, r in spots(8, 0.9, 2.2):
        b = trimesh.creation.icosphere(subdivisions=1, radius=r)
        b.apply_scale((1.0, rng.uniform(0.7, 0.9), rng.uniform(0.45, 0.6)))
        b.apply_transform(ROT(rng.uniform(0, 3), (0, 0, 1)))
        b.apply_translation((x, y, ground(x, y, r * 0.6) + r * 0.1))
        rocks.append(b)
    items.append(("props/hill_boulders", cat(rocks), "plaster"))
    bushes = []
    for i, (x, y, r) in enumerate(spots(7, 1.4, 2.0)):
        m = desert_bush(0, 0, r, 20 + i)
        m.apply_translation((x, y, ground(x, y, r * 0.5)))
        bushes.append(m)
    items.append(("props/hill_bushes", cat(bushes), "plaster_warm"))
    grass = []
    for i, (x, y, r) in enumerate(spots(5, 2.6, 2.8)):
        m = tussocks(0, 0, 6, 30 + i)
        m.apply_translation((x, y, ground(x, y, 2.0)))
        grass.append(m)
    items.append(("props/hill_grass", cat(grass), "plaster_warm"))
    return items, taken


MOVERS = []    # parts with their own transform (turbine rotor), collected by scatter()


def scatter():
    """Nature only near the fade (Smo: too many manmade objects), plus one relay station."""
    items = []
    p, b, beacon = relay_station(46.0, -30.0)
    items += [("props/relay_station", p, "plaster"), ("props/relay_station_steel", b, "linework"),
              ("props/relay_beacon", beacon, "beacon")]
    items.append(("props/dead_tree", dead_tree(-34.0, -50.0), "plaster_warm"))
    # solar field on the front slope of the right-hand hill (default view), facing the station
    from landscape import hill_height
    # Smo: 100 m left, then 50 m back to the right (+x is left in the default view); 2/3 of the
    # tables (7 x 11 = 77 instead of 8 x 14 = 112); field turned 35 degrees so the rows run diagonally
    pan, blk = solar_field_on_hill(SOLAR["cx"], SOLAR["cy"], (33.0, 66.0), hill_height, rows=SOLAR["rows"],
                                   tables=SOLAR["tables"], turn=SOLAR["turn"])
    items += [("props/solar_panels", pan, "plaster_warm"), ("props/solar_frames", blk, "linework")]
    # modern wind turbine on the top of that hill
    from landscape import HILLS
    hx_, hy_ = HILLS[0][0], HILLS[0][1]
    gz = hill_height(hx_, hy_)
    HUB_H, BLADE = 40.5, 18.0          # Smo: smaller twice (70 / 28 -> 45 / 20 -> 10 % less)
    st, rotor, T = wind_turbine(hx_, hy_, gz, (33.0, 66.0), hub_h=HUB_H, blade=BLADE)
    items.append(("props/turbine", st, "plaster"))
    MOVERS.append(("props/turbine_rotor", rotor, "plaster", T))
    # aviation lights: two on the nacelle roof, one halfway up the tower
    for k, (dx, dy, dz) in enumerate(((-2.0, 0.9, HUB_H + 2.9), (-2.0, -0.9, HUB_H + 2.9), (0.0, 1.6, HUB_H / 2 + 0.5))):
        yaw = np.arctan2(66.0 - hy_, 33.0 - hx_)
        px = hx_ + dx * np.cos(yaw) - dy * np.sin(yaw)
        py = hy_ + dx * np.sin(yaw) + dy * np.cos(yaw)
        items.append((f"props/aviation_light_{k}", trimesh.creation.icosphere(1, 0.5).apply_translation((px, py, gz + dz)), "beacon"))
    from radio_dish import radio_dish
    items += radio_dish()
    items += hill_dressing()[0]
    items += [("props/tussocks_a", tussocks(24.0, -46.0, 7, 5), "plaster_warm"),
              ("props/tussocks_b", tussocks(-64.0, -2.0, 6, 6), "plaster_warm"),
              ("props/tussocks_c", tussocks(30.0, -52.0, 5, 7), "plaster_warm")]
    return items
