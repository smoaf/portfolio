"""
Steerable radio dish standing ON the left flank of the middle hill (Smo, 6 Oct 2026). Replaces the
sunk dish: the hill stays whole. After Smo's photos of the Stanford Dish in Downloads
(stanforddish.jpg, images-6.jpeg); concept and details, not a copy, scaled to 40 m.

Details taken from the photos:
- open mesh reflector (see-through), dense grid of ribs and rings on it, a heavy rim ring
- deep backup structure behind the reflector: radial trusses and rings, a central hub
- feed on a tripod of three heavy struts from the rim, feed housing at the apex, cross braces
- elevation axle behind the hub at the top of the mount, a gear sector below it for the drive
- alt-azimuth mount: two tall lattice A-frames joined by trusses, base frame on four bogies
  running on a circular rail, zigzag stairs with landings up one side, platforms at the bearings
- low equipment house under the mount
The rail sits on a low round concrete plinth on a small levelled pad (landscape.PAD).
"""
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial
from build_station_v4 import box, cyl, rod, cat, ROT, MAT
from construction import lattice
from landscape import hill_height, PAD

MAT["dishmesh"] = PBRMaterial(name="dishmesh", baseColorFactor=[0.93, 0.92, 0.89, 1.0], metallicFactor=0.2, roughnessFactor=0.6)

CX, CY = PAD["cx"], PAD["cy"]  # left of the middle hill's top (default view: +x is left)
D = 40.0                       # dish diameter
R = D / 2
F = 0.4 * D                    # focal length
H_AX = 22.0                    # elevation axle height above the rail
BACK = 5.0                     # axle sits this far behind the dish vertex
EL = np.radians(40)            # elevation
FACE = np.radians(130)         # pointing direction in plan (towards the station, turned to show the dish)
PLINTH_R = 15.0
TRACK_R = np.hypot(7.0, 11.0)


def zs(r):
    return r * r / (4 * F)


def ring(r, z, n, rad, sec=4):
    pts = [(r * np.cos(a), r * np.sin(a), z) for a in np.linspace(0, 2 * np.pi, n + 1)]
    return [rod(pts[i], pts[i + 1], rad, sec) for i in range(n)]


# ---------------------------------------------------------------- dish, in its own frame:
# vertex at the origin, boresight +z
def reflector(nr=20, na=72):
    rs = np.linspace(1.6, R, nr)
    verts = []
    for r in rs:
        for k in range(na):
            a = 2 * np.pi * k / na
            verts.append((r * np.cos(a), r * np.sin(a), zs(r)))
    faces = []
    for i in range(nr - 1):
        for k in range(na):
            k1 = (k + 1) % na
            a, b, c, d = i * na + k, i * na + k1, (i + 1) * na + k, (i + 1) * na + k1
            faces += [(a, c, d), (a, d, b)]
    m = trimesh.Trimesh(np.array(verts), np.array(faces), process=False)
    if m.face_normals[:, 2].mean() < 0:
        m.invert()
    return m


def surface_grid():
    parts = []
    for k in range(48):                                    # ribs on the surface
        a = 2 * np.pi * k / 48
        rs = np.linspace(1.6, R, 7)
        pts = [(r * np.cos(a), r * np.sin(a), zs(r) + 0.03) for r in rs]
        parts += [rod(pts[i], pts[i + 1], 0.035, 4) for i in range(len(pts) - 1)]
    for r in np.linspace(3.0, R - 1.2, 11):                # rings on the surface
        parts += ring(r, zs(r) + 0.03, 72, 0.03)
    return cat(parts)


def zb(r):                                                 # bottom chord of the backup trusses
    return -3.6 + (r - 2.0) / (R - 2.0) * (zs(R) - 1.4 + 3.6)


def backup():
    parts = []
    for k in range(18):
        a = 2 * np.pi * k / 18 + np.pi / 36
        c, s = np.cos(a), np.sin(a)
        st = np.linspace(2.0, R, 7)
        top = [(r * c, r * s, zs(r) - 0.05) for r in st]
        bot = [(r * c, r * s, zb(r)) for r in st]
        parts += [rod(top[i], top[i + 1], 0.07, 4) for i in range(6)]
        parts += [rod(bot[i], bot[i + 1], 0.09, 4) for i in range(6)]
        parts += [rod(top[i], bot[i], 0.05, 4) for i in range(7)]
        parts += [rod(top[i + 1], bot[i], 0.05, 4) for i in range(6)]
    for r in (8.0, 14.0, R):
        parts += ring(r, zb(r), 54, 0.07)
    return cat(parts)


def rim_and_hub():
    rim = ring(R, zs(R), 72, 0.28, 8)
    hub = cyl(2.6, 4.4, 0, 0, -1.9, 32)
    return cat(rim + [hub])


def tripod():
    """Three heavy feed struts from the rim to the apex, feed housing, braces."""
    apex = np.array((0, 0, F))
    feet = [np.array((R * np.cos(a), R * np.sin(a), zs(R))) for a in np.radians((90, 210, 330))]
    struts = [rod(p, apex - (apex - p) / np.linalg.norm(apex - p) * 0.4, 0.32, 10) for p in feet]
    mids = [p + (apex - p) * 0.72 for p in feet]
    braces = [rod(mids[i], mids[(i + 1) % 3], 0.1, 6) for i in range(3)]
    feed = box(1.5, 1.5, 2.4, 0, 0, F + 0.9)
    return cat(struts + [feed]), cat(braces)


def axle_parts():
    """Bearing arms from the hub to the axle ends, and the elevation gear sector. In the dish frame
    the axle runs along x at z = -BACK."""
    plaster, black = [], []
    for sx in (-1, 1):
        b = np.array((sx * 7.6, 0, -BACK))
        plaster.append(rod((sx * 2.4, 0, -3.6), b, 0.35, 8))
        for p in ((sx * 14.0, 0, zb(14.0)), (sx * 7.0, 8.0, zb(np.hypot(7, 8))), (sx * 7.0, -8.0, zb(np.hypot(7, 8)))):
            black.append(rod(b, p, 0.12, 6))
    # gear sector: arc of radius 9 round the axle, in the dish's y-z plane, braced to the hub
    th = np.radians(np.linspace(-60, 60, 25))
    arc = [np.array((0, 9 * np.sin(t), -BACK - 9 * np.cos(t))) for t in th]
    black += [rod(arc[i], arc[i + 1], 0.22, 6) for i in range(len(arc) - 1)]
    black += [rod((0, 0, -3.8), arc[i], 0.12, 6) for i in (0, 6, 12, 18, 24)]
    return cat(plaster), cat(black)


# ---------------------------------------------------------------- mount, in the azimuth frame:
# origin at the plinth top on the rail centre, x = axle direction, y = pointing direction (plan)
def mount():
    black, plaster = [], []
    for sx in (-7.0, 7.0):                               # side A-frames
        top = (sx, 0.0, H_AX - 0.6)
        for sy in (-11.0, 11.0):
            black.append(lattice((sx, sy, 0.6), top, 1.3, 2.2, 0.06))
        black.append(lattice((sx, -6.05, H_AX * 0.45), (sx, 6.05, H_AX * 0.45), 1.0, 2.0, 0.05))
        black.append(lattice((sx, -11.0, 0.6), (sx, 11.0, 0.6), 1.0, 2.2, 0.05))
        plaster.append(box(3.0, 3.0, 1.6, sx, 0, H_AX - 0.4))                    # bearing block
        black.append(box(4.2, 4.2, 0.12, sx + np.sign(sx) * 0.4, 0, H_AX - 1.6))  # platform
        black += [rod((sx + np.sign(sx) * 0.4 + dx, dy, H_AX - 1.6), (sx + np.sign(sx) * 0.4 + dx, dy, H_AX - 0.5), 0.03, 4)
                  for dx in (-2.0, 2.0) for dy in (-2.0, 2.0)]
    for sy in (-11.0, 11.0):                             # base frame and mid trusses across
        black.append(lattice((-7.0, sy, 0.6), (7.0, sy, 0.6), 1.0, 2.2, 0.05))
    for sy in (-6.05, 6.05):
        black.append(lattice((-7.0, sy, H_AX * 0.45), (7.0, sy, H_AX * 0.45), 1.0, 2.0, 0.05))
    plaster.append(cyl(0.7, 17.0, 0, 0, H_AX, 24).apply_transform(ROT(np.pi / 2, (0, 1, 0), (0, 0, H_AX))))  # axle
    for sx in (-7.0, 7.0):                               # bogies on the rail
        for sy in (-11.0, 11.0):
            plaster.append(box(2.4, 1.6, 1.0, sx, sy, 0.5))
            black += [cyl(0.35, 0.25, sx + dx, sy, 0.35, 12).apply_transform(ROT(np.pi / 2, (1, 0, 0), (sx + dx, sy, 0.35)))
                      for dx in (-0.7, 0.7)]
    plaster.append(box(8.0, 5.0, 3.0, 0, -1.0, 1.5))     # equipment house
    plaster.append(box(8.4, 5.4, 0.15, 0, -1.0, 3.07))
    black.append(box(1.0, 0.03, 2.0, 2.0, -3.52, 1.1))
    # zigzag stairs up the outside of the +x frame, landings at each turn
    x = 9.2
    z, sy, step = 0.0, -4.0, 3.1
    while z + step <= H_AX - 1.6 + 1e-6:
        y0, y1 = sy, -sy
        p0, p1 = np.array((x, y0, z)), np.array((x, y1, z + step))
        L = np.linalg.norm(p1 - p0)
        fl = box(1.0, L, 0.12)
        fl.apply_transform(ROT(np.arctan2(step, y1 - y0), (1, 0, 0)))
        fl.apply_translation((p0 + p1) / 2)
        black.append(fl)
        black.append(rod(p0 + (0.5, 0, 1.0), p1 + (0.5, 0, 1.0), 0.03, 4))
        black.append(box(1.2, 1.2, 0.12, x, y1 + np.sign(y1) * 0.6, z + step))
        black.append(rod((x + 0.6, y1 + np.sign(y1) * 0.6, z + step - 0.3), (6.6, y1 * 0.5, z + step - 0.3), 0.04, 4))  # tie to frame
        z += step
        sy = -sy
    black.append(rod((x, sy, z), (7.4, 0.0, H_AX - 1.6), 0.05, 4))   # last flight to the platform
    black += ring(TRACK_R, 0.06, 64, 0.12)              # rail
    return cat(plaster), cat(black)


def plinth():
    """Low round concrete plinth for the rail on the levelled pad (landscape.PAD).
    Returns (mesh, top height)."""
    top = PAD["z"] + 0.6                                 # low plinth on the levelled pad
    low = PAD["z"] - 1.0
    return cyl(PLINTH_R, top - low, CX, CY, (top + low) / 2, 64), top


def radio_dish():
    pl, top = plinth()
    W = ROT(FACE - np.pi / 2, (0, 0, 1))                 # azimuth frame -> world
    W[:3, 3] = (CX, CY, top)
    E = ROT(EL - np.pi / 2, (1, 0, 0))                   # dish frame (shifted) -> azimuth frame
    E[:3, 3] = (0, 0, H_AX)
    S = np.eye(4); S[2, 3] = BACK                        # vertex BACK in front of the axle
    Dm = W @ E @ S
    t = lambda m, T: m.apply_transform(T)
    mp, mb = mount()
    tp, tb = tripod()
    ap, ab = axle_parts()
    return [("props/dish_plinth", pl, "plaster"),
            ("props/dish_mount", t(mp, W), "plaster"),
            ("props/dish_mount_steel", t(mb, W), "linework"),
            ("props/dish_reflector", t(reflector(), Dm), "dishmesh"),
            ("props/dish_grid", t(surface_grid(), Dm), "linework"),
            ("props/dish_backup", t(backup(), Dm), "linework"),
            ("props/dish_rim", t(rim_and_hub(), Dm), "plaster"),
            ("props/dish_feed", t(tp, Dm), "plaster"),
            ("props/dish_feed_braces", t(tb, Dm), "linework"),
            ("props/dish_axle", t(ap, Dm), "plaster"),
            ("props/dish_gear", t(ab, Dm), "linework")]


def footprint():
    """(x, y, radius) the hill dressing must keep clear of (the dish overhangs the plinth)."""
    return CX, CY, 25.0
