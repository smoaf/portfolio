"""
Station generator, version 4 (study 04).
Library, office and workshop in a row, joined by short closed tubes.
Exports station_v3.glb.

Changes from v2 (Smo's module details, 5 Oct 2026)
- Tubes are closed and short.
- Modules are deeper (5.8 m instead of 5.0 m). The library is shorter than the others.
- Stilts: A-frame with a vertical bar, skis bowed up at both ends.
- Library: all-in-one computer angled on the desk, reading corner, standing lamp.
- Office (was study): collaborative, low-hierarchy workplace with equal desks.
- Workshop (new): measurement devices, prototypes, cables, server room behind glass.

All sizes in metres. Run:  python3 build_station_v4.py

v4: office rebuilt after Smo's reference stills (calm, sparse, slab tables, glass
meeting room, lounge), A-frames with a crossbar and no centre leg, linear ceiling lights.
"""
import numpy as np
import trimesh
from shapely.geometry import Polygon
from trimesh.visual.material import PBRMaterial

P = dict(
    width=5.8, height=3.6,
    chamfer_top=0.55, chamfer_bottom=0.95, chamfer_ends=0.45,
    wall=0.18, lift=2.3,
    window_w=0.65, window_h=0.85, window_spacing=1.25,
    parapet=0.9, roof_open=2.0, end_return=0.7,
    gap=1.6,               # short closed tubes
    tube_r=1.15, tube_wall=0.12,
    modules=[              # left to right
        dict(kind="library", length=8.5, back_windows=[2.9]),       # shelves cover the rest of the back wall
        dict(kind="office", length=10.0, back_windows=[-1.875, -0.625, 0.625, 1.875, 3.125]),   # meeting screen covers the last bay
        dict(kind="workshop", length=10.0, back_windows=[]),       # pegboard and server room on the back wall
    ],
    out="station_v4.glb",
)

MAT = {
    "plaster": PBRMaterial(name="plaster", baseColorFactor=[0.93, 0.905, 0.86, 1], metallicFactor=0, roughnessFactor=0.92),
    "plaster_warm": PBRMaterial(name="plaster_warm", baseColorFactor=[0.90, 0.86, 0.80, 1], metallicFactor=0, roughnessFactor=0.95),
    "linework": PBRMaterial(name="linework", baseColorFactor=[0.07, 0.07, 0.07, 1], metallicFactor=0.3, roughnessFactor=0.55),
    "ground": PBRMaterial(name="ground", baseColorFactor=[0.95, 0.94, 0.92, 1], metallicFactor=0, roughnessFactor=1),
    "lightstrip": PBRMaterial(name="lightstrip", baseColorFactor=[0.98, 0.97, 0.95, 1], metallicFactor=0, roughnessFactor=0.6),
    "ghost": PBRMaterial(name="ghost", baseColorFactor=[1, 0, 1, 1], metallicFactor=0, roughnessFactor=1),
}
ROT = trimesh.transformations.rotation_matrix


# ------------------------------------------------------------------ helpers
def box(sx, sy, sz, cx=0, cy=0, cz=0):
    m = trimesh.creation.box(extents=(sx, sy, sz))
    m.apply_translation((cx, cy, cz))
    return m


def cyl(r, h, cx, cy, cz, sections=24):
    m = trimesh.creation.cylinder(radius=r, height=h, sections=sections)
    m.apply_translation((cx, cy, cz))
    return m


def rod(p0, p1, r, sections=12):
    return trimesh.creation.cylinder(radius=r, segment=[p0, p1], sections=sections)


def xcyl(r, length, cx, cy, cz, sections=48):
    m = trimesh.creation.cylinder(radius=r, height=length, sections=sections)
    m.apply_transform(ROT(np.pi / 2, (0, 1, 0)))
    m.apply_translation((cx, cy, cz))
    return m


def turned(m, angle, cx, cy, cz):
    """Rotate a part around its own vertical axis, then place it."""
    m = m.copy()
    m.apply_transform(ROT(angle, (0, 0, 1)))
    m.apply_translation((cx, cy, cz))
    return m


def U(ms):
    ms = [m for m in ms if m is not None and len(m.faces)]
    return ms[0] if len(ms) == 1 else trimesh.boolean.union(ms, engine="manifold")


def D(a, b):
    return trimesh.boolean.difference([a, b], engine="manifold")


def I(a, b):
    return trimesh.boolean.intersection([a, b], engine="manifold")


def cat(ms):
    return trimesh.util.concatenate([m for m in ms if m is not None])


def chamfered_body(L, W, H, ct, cb, ce):
    a, b, h = L / 2, W / 2, H / 2
    pts = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                c = ct if sz > 0 else cb
                pts += [(sx * (a - ce), sy * b, sz * (h - c)),
                        (sx * (a - ce), sy * (b - c), sz * h),
                        (sx * a, sy * (b - ce), sz * (h - c)),
                        (sx * a, sy * (b - c - ce * 0.5), sz * (h - c * 0.5))]
    return trimesh.convex.convex_hull(np.array(pts))


def frame(w, h, depth, bar, mullion=True):
    f = D(box(w, depth, h), box(w - 2 * bar, depth * 2, h - 2 * bar))
    return U([f, box(bar * 0.8, depth, h)]) if mullion else f


def catenary(p0, p1, sag, r=0.012, n=14):
    """A hanging cable between two points, as a chain of thin rods."""
    p0, p1 = np.array(p0, float), np.array(p1, float)
    pts = [p0 + (p1 - p0) * t + np.array([0, 0, -sag * 4 * t * (1 - t)]) for t in np.linspace(0, 1, n)]
    return cat([rod(pts[i], pts[i + 1], r, 6) for i in range(n - 1)])


def ski(length=1.6, width=0.3, thick=0.07, rise=0.2, flat=0.55):
    """Ski bowed up at both ends: a side profile extruded across its width."""
    half = length / 2
    xs = np.linspace(-half, half, 41)
    lift = np.where(np.abs(xs) < flat, 0.0, rise * ((np.abs(xs) - flat) / (half - flat)) ** 2)
    pts = [(x, z) for x, z in zip(xs, lift)] + [(x, z + thick) for x, z in zip(xs[::-1], lift[::-1])]
    m = trimesh.creation.extrude_polygon(Polygon(pts), width)
    m.apply_transform(ROT(np.pi / 2, (1, 0, 0)))      # profile into x-z, width along y
    m.apply_translation((0, width / 2, 0))
    return m


class Part:
    def __init__(self):
        self.items = []

    def add(self, name, mesh, mat, offset=(0, 0, 0)):
        if mesh is None or not len(mesh.faces):
            return
        m = mesh.copy()
        m.apply_translation(offset)
        self.items.append((name, m, mat))


# ------------------------------------------------------------------ module
def module(p, spec, cx, ends):
    kind, L = spec["kind"], spec["length"]
    W, H, t = p["width"], p["height"], p["wall"]
    z0 = p["lift"] + H / 2
    out = Part()

    outer = chamfered_body(L, W, H, p["chamfer_top"], p["chamfer_bottom"], p["chamfer_ends"])
    inner = chamfered_body(L - 2 * t, W - 2 * t, H - 2 * t, p["chamfer_top"] * 0.9,
                           p["chamfer_bottom"] * 0.9, p["chamfer_ends"] * 0.9)
    shell = D(outer, inner)
    floor_z = -H / 2 + p["chamfer_bottom"] * 0.75
    shell = U([shell, box(L - 2 * t - 0.1, W - 2 * t - 0.1, 0.16, 0, 0, floor_z - 0.08)])

    win_z = floor_z + 1.35
    n = int((L - 2.5) // p["window_spacing"])
    xs = (np.arange(n) - (n - 1) / 2) * p["window_spacing"]
    holes, frames = [], []
    back_windows = spec.get("back_windows", xs)
    for side in (-1, 1):
        for x in (back_windows if side < 0 else xs):
            holes.append(box(p["window_w"], 1.0, p["window_h"], x, side * W / 2, win_z))
            f = frame(p["window_w"], p["window_h"], 0.05, 0.035)
            f.apply_translation((x, side * (W / 2 - t * 0.5), win_z))
            frames.append(f)
    tube_cz = floor_z + p["tube_r"] - p["tube_wall"] - 0.02
    for side, kind_end in ends.items():
        ex = -L / 2 if side == "left" else L / 2
        if kind_end == "door":
            holes.append(box(1.0, 1.1, 2.1, ex, -0.6, floor_z + 1.05))
        elif kind_end == "tube":
            holes.append(xcyl(p["tube_r"] - p["tube_wall"], 1.2, ex, 0, tube_cz))
        elif kind_end == "window":
            holes.append(box(1.0, 1.4, 0.9, ex, 0, win_z))
            f = frame(1.4, 0.9, 0.05, 0.035)
            f.apply_transform(ROT(np.pi / 2, (0, 0, 1)))
            f.apply_translation((ex - np.sign(ex) * t * 0.5, 0, win_z))
            frames.append(f)
    shell = D(shell, U(holes))

    xr = L / 2 - p["end_return"]
    cut_wall = box(2 * xr, 3.0, 6, 0, W / 2 - 1.0 + 1.5, floor_z + p["parapet"] + 3)
    cut_roof = box(2 * xr, p["roof_open"] + 2, 3, 0, W / 2 - p["roof_open"] + (p["roof_open"] + 2) / 2,
                   H / 2 - p["chamfer_top"] - 0.25 + 1.5)
    cutter = U([cut_wall, cut_roof])
    out.add(f"{kind}/shell", D(shell, cutter), "plaster", (cx, 0, z0))
    out.add(f"{kind}/ghost_shell", I(shell, cutter), "ghost", (cx, 0, z0))
    kept = [f for f in frames if not cutter.contains([f.bounds.mean(axis=0)])[0]]
    if kept:
        out.add(f"{kind}/window_frames", cat(kept), "linework", (cx, 0, z0))

    fz = z0 + floor_z
    ctx = dict(L=L, W=W, t=t, fz=fz, back=-(W - 2 * t) / 2, front=(W - 2 * t) / 2,
               ceil=fz + (H / 2 - p["chamfer_top"] * 0.9 - t - floor_z) + 0.4)
    INTERIORS[kind](out, ctx, cx)
    strips = [box(L - 2.4, 0.06, 0.03, 0, y, z0 + H / 2 - t - 0.12) for y in (-1.9, -0.9, 0.1)]
    out.add(f"{kind}/ceiling_lights", cat(strips), "lightstrip", (cx, 0, 0))
    stilts(out, p, kind, cx, L)
    if ends.get("left") == "door":
        stair(out, kind, cx - L / 2, fz)
    return out, fz, tube_cz + z0


# ------------------------------------------------------------------ furniture kit
def desk(w, d, x, y, fz, h=0.75):
    return U([box(w, d, 0.05, x, y, fz + h)] +
             [box(0.05, d - 0.1, h - 0.03, x + s * (w / 2 - 0.05), y, fz + (h - 0.03) / 2) for s in (-1, 1)])


def chair(x, y, fz, facing=1):
    """facing=+1: backrest towards +y (person looks to -y)."""
    parts = [box(0.45, 0.45, 0.05, x, y, fz + 0.45), box(0.45, 0.04, 0.45, x, y + facing * 0.23, fz + 0.7)]
    parts += [box(0.035, 0.035, 0.45, x + sx * 0.2, y + sy * 0.2, fz + 0.225) for sx in (-1, 1) for sy in (-1, 1)]
    return U(parts)


def monitor(x, y, z, facing=1, w=0.55, h=0.33):
    """Flat screen on a foot. facing=+1: screen looks to +y."""
    body = box(w, 0.025, h, 0, 0, 0.16 + h / 2)
    foot = U([box(0.2, 0.16, 0.012, 0, 0, 0.006), box(0.04, 0.02, 0.18, 0, -0.02, 0.09)])
    m = U([body, foot])
    if facing < 0:
        m.apply_transform(ROT(np.pi, (0, 0, 1)))
    m.apply_translation((x, y, z))
    return m


def all_in_one(angle, x, y, z):
    """All-in-one computer: thin screen with a chin on an angled stand (unbranded).
    Returns (body in plaster, screen face in linework)."""
    w, h = 0.62, 0.48
    body = box(w, 0.025, h, 0, 0, 0.12 + h / 2)
    body.apply_transform(ROT(-0.12, (1, 0, 0)))
    stand = U([box(0.18, 0.16, 0.01, 0, -0.03, 0.005), rod((0, -0.07, 0.01), (0, -0.02, 0.2), 0.03, 8)])
    face = box(w - 0.04, 0.006, h - 0.12, 0, 0.016, 0.12 + h / 2 + 0.04)
    face.apply_transform(ROT(-0.12, (1, 0, 0)))
    return turned(U([body, stand]), angle, x, y, z), turned(face, angle, x, y, z)


def floor_lamp(x, y, fz):
    shade = trimesh.creation.cone(radius=0.22, height=0.28, sections=32)
    shade.apply_transform(ROT(np.pi, (1, 0, 0)))
    shade.apply_translation((x, y, fz + 1.75))
    return cat([cyl(0.18, 0.025, x, y, fz + 0.0125), cyl(0.012, 1.6, x, y, fz + 0.82, 10), shade])


# ------------------------------------------------------------------ interiors
def library(out, c, cx):
    fz, back, L = c["fz"], c["back"], c["L"]
    shelves, books = [], []
    sh, sd, uw = 2.25, 0.36, 1.0
    rng = np.random.default_rng(7)
    units = int((L - 2.6) // (uw + 0.02))
    x_start = -L / 2 + 1.0
    for i in range(units):
        ux = x_start + i * (uw + 0.02) + uw / 2
        cy = back + 0.05 + sd / 2
        for sx in (-1, 1):
            shelves.append(box(0.04, sd, sh, ux + sx * uw / 2, cy, fz + sh / 2))
        for k in range(6):
            bz = fz + 0.06 + k * (sh - 0.1) / 5
            shelves.append(box(uw, sd, 0.035, ux, cy, bz))
            if k == 5:
                continue
            x = ux - uw / 2 + 0.05
            while x < ux + uw / 2 - 0.08:
                bw, bh = rng.uniform(0.025, 0.06), rng.uniform(0.22, 0.34)
                if rng.random() < 0.08:
                    x += 0.07
                    continue
                books.append(box(bw, sd * 0.8, bh, x + bw / 2, cy + 0.02, bz + 0.0175 + bh / 2))
                x += bw + 0.004
    out.add("library/shelves", U(shelves), "plaster", (cx, 0, 0))
    out.add("library/books", cat(books), "plaster_warm", (cx, 0, 0))

    # desk with an angled all-in-one computer
    dx, dy = 0.4, 0.2
    out.add("library/desk", desk(1.8, 0.85, dx, dy, fz), "plaster", (cx, 0, 0))
    body, face = all_in_one(-0.45, dx + 0.25, dy - 0.05, fz + 0.775)
    out.add("library/computer", body, "plaster", (cx, 0, 0))
    out.add("library/computer_screen", face, "linework", (cx, 0, 0))
    out.add("library/papers", cat([box(0.3, 0.21, 0.004, dx - 0.55, dy + 0.15, fz + 0.777),
                                   box(0.4, 0.28, 0.02, dx - 0.15, dy + 0.2, fz + 0.785)]), "plaster_warm", (cx, 0, 0))
    out.add("library/chair", chair(dx + 0.1, dy + 0.75, fz, facing=1), "plaster", (cx, 0, 0))

    # reading corner at the far end: armchair, side table, rug, standing lamp
    rx, ry = -L / 2 + 2.0, 0.75      # door end, clear of the corner returns
    arm = U([box(0.85, 0.85, 0.42, rx, ry, fz + 0.21),
             box(0.85, 0.18, 0.85, rx + 0.0, ry - 0.36, fz + 0.43),
             box(0.14, 0.85, 0.62, rx - 0.36, ry, fz + 0.31),
             box(0.14, 0.85, 0.62, rx + 0.36, ry, fz + 0.31)])
    arm = turned(arm, 0.5, 0, 0, 0)
    arm.apply_translation((rx - rx * np.cos(0.5) + ry * np.sin(0.5), ry - rx * np.sin(0.5) - ry * np.cos(0.5), 0))
    out.add("library/reading_chair", arm, "plaster", (cx, 0, 0))
    out.add("library/side_table", U([cyl(0.25, 0.03, rx - 0.95, ry - 0.35, fz + 0.55),
                                     cyl(0.025, 0.54, rx - 0.95, ry - 0.35, fz + 0.27, 10),
                                     cyl(0.18, 0.02, rx - 0.95, ry - 0.35, fz + 0.01)]), "plaster", (cx, 0, 0))
    out.add("library/side_table_book", box(0.22, 0.16, 0.035, rx - 0.95, ry - 0.35, fz + 0.583), "plaster_warm", (cx, 0, 0))
    out.add("library/rug", box(2.0, 1.5, 0.012, rx - 0.4, ry - 0.1, fz + 0.006), "plaster_warm", (cx, 0, 0))
    out.add("library/floor_lamp", floor_lamp(rx + 0.55, ry - 0.95, fz), "linework", (cx, 0, 0))


def slab_table(w, d, x, y, fz, h=0.74, top=0.07, panel=0.07):
    """Thick slab table on two full-depth panel legs, like the reference stills."""
    return U([box(w, d, top, x, y, fz + h - top / 2)] +
             [box(panel, d - 0.06, h - top, x + s * (w / 2 - panel / 2 - 0.12), y, fz + (h - top) / 2) for s in (-1, 1)])


def wood_chair(x, y, fz, facing=1):
    """Simple chair with a curved-looking back: seat, two-slat back, four legs."""
    parts = [box(0.46, 0.44, 0.04, x, y, fz + 0.45),
             box(0.44, 0.03, 0.14, x, y + facing * 0.22, fz + 0.76)]
    parts += [rod((x + sx * 0.19, y + sy * 0.18, fz), (x + sx * 0.2, y + sy * 0.19, fz + 0.45), 0.018, 8)
              for sx in (-1, 1) for sy in (-1, 1)]
    parts += [rod((x + sx * 0.2, y + facing * 0.19, fz + 0.45), (x + sx * 0.2, y + facing * 0.22, fz + 0.82), 0.018, 8)
              for sx in (-1, 1)]
    return U(parts)


def bar_stool(x, y, fz, h=0.75):
    seat = cyl(0.19, 0.04, x, y, fz + h)
    legs = [rod((x + 0.15 * np.cos(a), y + 0.15 * np.sin(a), fz), (x + 0.1 * np.cos(a), y + 0.1 * np.sin(a), fz + h - 0.02), 0.012, 6)
            for a in np.linspace(0, 2 * np.pi, 4, endpoint=False) + 0.4]
    ring = trimesh.creation.annulus(r_min=0.12, r_max=0.135, height=0.015, sections=24).apply_translation((x, y, fz + 0.3))
    return seat, cat(legs + [ring])


def laptop(x, y, z, facing=1, angle=0.0):
    m = U([box(0.33, 0.23, 0.014, 0, 0, 0.007), box(0.33, 0.012, 0.22, 0, -facing * 0.115, 0.115)])
    m.apply_transform(ROT(angle, (0, 0, 1)))
    m.apply_translation((x, y, z))
    return m


def office(out, c, cx):
    """Collaborative, low-hierarchy office after the reference stills: calm and sparse.
    Two big slab tables with chairs and laptops, one long table with two displays,
    a glass meeting room with a high table and bar stools, a lounge corner."""
    fz, back, front, L = c["fz"], c["back"], c["front"], c["L"]
    tables, chairs, black, warm = [], [], [], []

    # glass meeting room at the left end, against the back wall
    mx0, mx1 = -L / 2 + 0.25, -L / 2 + 3.6
    my1 = 0.55
    glass = []
    h = 2.6
    for (x, y) in [(mx1, back), (mx1, my1), (mx0 + 0.6, my1), ((mx0 + mx1) / 2, my1)]:
        glass.append(box(0.04, 0.04, h, x, y, fz + h / 2))
    glass.append(box(0.04, my1 - back, 0.05, mx1, (my1 + back) / 2, fz + h))          # top rails
    glass.append(box(mx1 - mx0 - 0.6, 0.04, 0.05, (mx0 + 0.6 + mx1) / 2, my1, fz + h))
    glass.append(box(0.04, my1 - back, 0.03, mx1, (my1 + back) / 2, fz + 0.015))     # floor tracks
    glass.append(box(mx1 - mx0 - 0.6, 0.04, 0.03, (mx0 + 0.6 + mx1) / 2, my1, fz + 0.015))
    out.add("office/meeting_glass", cat(glass), "linework", (cx, 0, 0))
    mt_x, mt_y = (mx0 + mx1) / 2 + 0.2, (back + my1) / 2 + 0.1
    tables.append(slab_table(2.2, 1.0, mt_x, mt_y, fz, h=1.05))
    for i, sx in enumerate((-0.7, 0.0, 0.7)):
        for sy in (-1, 1):
            s, l = bar_stool(mt_x + sx, mt_y + sy * 0.82, fz)
            warm.append(s); black.append(l)
    # screen on the meeting room back wall, the only big screen in the office
    out.add("office/meeting_screen", box(1.5, 0.04, 0.85, mt_x, back + 0.04, fz + 1.75), "linework", (cx, 0, 0))
    out.add("office/coffee_cups", cat([cyl(0.04, 0.09, mt_x - 0.6 + i * 0.5, mt_y + 0.2 - (i % 2) * 0.3, fz + 1.12, 16) for i in range(3)]),
            "plaster_warm", (cx, 0, 0))

    # two big shared slab tables in the middle, chairs on both sides, laptops only
    for i, tx in enumerate((-0.4, 2.4)):
        ty = -0.1
        tables.append(slab_table(2.4, 1.1, tx, ty, fz))
        for sx in (-0.65, 0.65):
            for sy in (-1, 1):
                chairs.append(wood_chair(tx + sx, ty + sy * 0.78, fz, facing=sy))
        black.append(laptop(tx - 0.6, ty + 0.25, fz + 0.74, facing=1, angle=0.15))
        black.append(laptop(tx + 0.55, ty - 0.25, fz + 0.74, facing=-1, angle=-0.1 + i * 0.2))
        warm.append(box(0.3, 0.22, 0.004, tx + 0.1, ty + 0.05, fz + 0.742))
        warm.append(box(0.22, 0.3, 0.004, tx - 0.05, ty - 0.2, fz + 0.743))

    # long work table along the back wall with two displays on arms
    lx = 1.0
    tables.append(slab_table(3.4, 0.8, lx, back + 0.5, fz))
    for dx in (-0.6, 0.6):
        black.append(box(0.6, 0.025, 0.36, lx + dx, back + 0.32, fz + 1.12))           # display
        black.append(rod((lx + dx, back + 0.22, fz + 0.74), (lx + dx, back + 0.3, fz + 1.0), 0.015, 8))
        black.append(box(0.18, 0.12, 0.012, lx + dx, back + 0.22, fz + 0.746))
        chairs.append(wood_chair(lx + dx, back + 1.15, fz, facing=1))

    # lounge corner at the far end: low sofa, armchair, round coffee table
    sx0 = L / 2 - 1.2
    sofa = U([box(0.85, 2.3, 0.42, sx0 + 0.15, 0.2, fz + 0.21),
              box(0.2, 2.3, 0.75, sx0 + 0.5, 0.2, fz + 0.375),
              box(0.85, 0.2, 0.6, sx0 + 0.15, 0.2 - 1.05, fz + 0.3),
              box(0.85, 0.2, 0.6, sx0 + 0.15, 0.2 + 1.05, fz + 0.3)])
    out.add("office/sofa", sofa, "plaster_warm", (cx, 0, 0))
    out.add("office/lounge_chair", U([box(0.75, 0.75, 0.4, sx0 - 1.5, -1.3, fz + 0.2),
                                      box(0.75, 0.16, 0.72, sx0 - 1.5, -1.6, fz + 0.36)]), "plaster_warm", (cx, 0, 0))
    out.add("office/coffee_table", U([cyl(0.42, 0.04, sx0 - 0.85, 0.2, fz + 0.4, 40),
                                      cyl(0.05, 0.38, sx0 - 0.85, 0.2, fz + 0.19, 12),
                                      cyl(0.25, 0.02, sx0 - 0.85, 0.2, fz + 0.01, 32)]), "plaster", (cx, 0, 0))
    warm.append(box(0.24, 0.18, 0.03, sx0 - 0.8, 0.25, fz + 0.435))

    out.add("office/tables", U(tables), "plaster", (cx, 0, 0))
    out.add("office/chairs", U(chairs), "plaster", (cx, 0, 0))
    out.add("office/details_black", cat(black), "linework", (cx, 0, 0))
    out.add("office/details_warm", cat(warm), "plaster_warm", (cx, 0, 0))


def workshop(out, c, cx):
    """Workbench with measurement devices and prototypes, cables, server room behind glass."""
    fz, back, front, L = c["fz"], c["back"], c["front"], c["L"]
    # server room at the far end, behind a glass partition (glass is implied by the black frame)
    px = L / 2 - 2.6
    racks, grilles = [], []
    for i, ry in enumerate((back + 0.55, back + 1.55, back + 2.55)):
        rx = L / 2 - 1.3
        racks.append(box(0.9, 0.8, 2.1, rx, ry, fz + 1.05))
        for k in range(12):                      # front grille, facing the partition
            grilles.append(box(0.02, 0.62, 0.035, rx - 0.46, ry, fz + 0.25 + k * 0.15))
    out.add("workshop/servers", U(racks), "plaster", (cx, 0, 0))
    out.add("workshop/server_grilles", cat(grilles), "linework", (cx, 0, 0))
    part = []
    h = 2.55
    ys = np.linspace(back, front - 0.4, 6)
    for y in ys:
        part.append(box(0.04, 0.04, h, px, y, fz + h / 2))
    part.append(box(0.05, front - 0.4 - back, 0.05, px, (front - 0.4 + back) / 2, fz + h))
    part.append(box(0.05, front - 0.4 - back, 0.04, px, (front - 0.4 + back) / 2, fz + 0.02))
    part.append(box(0.04, ys[3] - ys[2], 0.04, px, (ys[2] + ys[3]) / 2, fz + 2.1))   # door head
    out.add("workshop/glass_partition", cat(part), "linework", (cx, 0, 0))
    out.add("workshop/cable_tray", box(0.25, 3.0, 0.06, L / 2 - 1.3, back + 1.55, fz + 2.35), "plaster", (cx, 0, 0))

    # workbench along the back wall, pegboard above
    bx0, bx1 = -L / 2 + 0.6, px - 0.5
    bw, bc = bx1 - bx0, (bx0 + bx1) / 2
    by = back + 0.45
    out.add("workshop/bench", U([box(bw, 0.8, 0.06, bc, by, fz + 0.9),
                                 box(bw, 0.7, 0.04, bc, by, fz + 0.2)] +
                                [box(0.06, 0.7, 0.9, x, by, fz + 0.45) for x in (bx0 + 0.1, bc, bx1 - 0.1)]),
            "plaster", (cx, 0, 0))
    out.add("workshop/pegboard", box(bw - 0.6, 0.03, 0.9, bc, back + 0.03, fz + 1.75), "plaster_warm", (cx, 0, 0))
    tools = []
    for i, x in enumerate(np.linspace(bc - bw / 2 + 0.6, bc + bw / 2 - 0.6, 11)):
        if i % 3 == 0:     # spanner
            tools.append(rod((x, back + 0.06, fz + 1.45), (x, back + 0.06, fz + 1.85), 0.012, 6))
            tools.append(cyl(0.035, 0.012, x, back + 0.06, fz + 1.88, 12))
        elif i % 3 == 1:   # screwdriver
            tools.append(rod((x, back + 0.06, fz + 1.5), (x, back + 0.06, fz + 1.75), 0.006, 6))
            tools.append(rod((x, back + 0.06, fz + 1.75), (x, back + 0.06, fz + 1.88), 0.02, 8))
        else:              # pliers
            tools.append(rod((x - 0.03, back + 0.06, fz + 1.5), (x, back + 0.06, fz + 1.85), 0.008, 6))
            tools.append(rod((x + 0.03, back + 0.06, fz + 1.5), (x, back + 0.06, fz + 1.85), 0.008, 6))
    out.add("workshop/tools", cat(tools), "linework", (cx, 0, 0))

    # measurement devices on the bench: oscilloscope, power supply, multimeter, each with a black face
    top = fz + 0.93
    dev, faces = [], []
    for (x, w, h, d) in [(bx0 + 0.6, 0.42, 0.24, 0.32), (bx0 + 1.15, 0.3, 0.16, 0.3), (bx0 + 1.55, 0.3, 0.16, 0.3), (bx0 + 1.95, 0.12, 0.2, 0.06)]:
        dev.append(box(w, d, h, x, by + 0.1, top + h / 2))
        faces.append(box(w * 0.55, 0.008, h * 0.55, x - w * 0.15, by + 0.1 - d / 2 - 0.002, top + h * 0.55))
        for k in range(3):
            knob = cyl(0.015, 0.02, x + w * 0.3, by + 0.1 - d / 2 - 0.01, top + h * (0.25 + k * 0.25), 10)
            knob.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, (1, 0, 0), knob.centroid))
            faces.append(knob)
    out.add("workshop/devices", U(dev), "plaster", (cx, 0, 0))
    out.add("workshop/device_screens", cat(faces), "linework", (cx, 0, 0))
    # prototypes: circuit boards, a small robot arm, a drone frame
    boards = [box(0.22, 0.16, 0.006, bx0 + 2.5 + i * 0.3, by - 0.05, top + 0.003) for i in range(3)]
    chips = [box(0.04, 0.04, 0.01, bx0 + 2.5 + i * 0.3 + o, by - 0.05 + o2, top + 0.01)
             for i in range(3) for o in (-0.05, 0.04) for o2 in (-0.03, 0.03)]
    out.add("workshop/circuit_boards", cat(boards + chips), "linework", (cx, 0, 0))
    ax = bx0 + 3.6
    arm = U([cyl(0.09, 0.06, ax, by, top + 0.03), cyl(0.05, 0.12, ax, by, top + 0.12),
             rod((ax, by, top + 0.17), (ax + 0.15, by - 0.05, top + 0.45), 0.03, 10),
             rod((ax + 0.15, by - 0.05, top + 0.45), (ax + 0.38, by - 0.1, top + 0.38), 0.025, 10),
             trimesh.creation.icosphere(1, 0.04).apply_translation((ax + 0.15, by - 0.05, top + 0.45))])
    out.add("workshop/robot_arm", arm, "plaster", (cx, 0, 0))
    out.add("workshop/robot_gripper", cat([rod((ax + 0.38, by - 0.1 + s * 0.02, top + 0.38), (ax + 0.44, by - 0.1 + s * 0.03, top + 0.33), 0.008, 6) for s in (-1, 1)]),
            "linework", (cx, 0, 0))

    # assembly table in the middle with a drone prototype and a laptop
    tx, ty = -0.6, 0.9
    out.add("workshop/table", desk(2.2, 1.1, tx, ty, fz, 0.9), "plaster", (cx, 0, 0))
    t2 = fz + 0.925
    drone = [rod((tx - 0.5 - 0.2, ty - 0.2, t2 + 0.06), (tx - 0.5 + 0.2, ty + 0.2, t2 + 0.06), 0.012, 8),
             rod((tx - 0.5 - 0.2, ty + 0.2, t2 + 0.06), (tx - 0.5 + 0.2, ty - 0.2, t2 + 0.06), 0.012, 8),
             box(0.12, 0.12, 0.05, tx - 0.5, ty, t2 + 0.06)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            ring = trimesh.creation.annulus(r_min=0.085, r_max=0.1, height=0.015, sections=24)
            ring.apply_translation((tx - 0.5 + sx * 0.2, ty + sy * 0.2, t2 + 0.075))
            drone.append(ring)
            drone.append(cyl(0.012, 0.06, tx - 0.5 + sx * 0.2, ty + sy * 0.2, t2 + 0.03, 8))
    out.add("workshop/drone", U(drone), "plaster", (cx, 0, 0))
    out.add("workshop/laptop", U([box(0.34, 0.24, 0.015, tx + 0.5, ty, t2 + 0.008),
                                  box(0.34, 0.015, 0.23, tx + 0.5, ty + 0.12, t2 + 0.12)]), "linework", (cx, 0, 0))
    out.add("workshop/stools", U([cyl(0.17, 0.04, tx + s, ty - 0.8, fz + 0.65) for s in (-0.5, 0.5)] +
                                 [cyl(0.025, 0.63, tx + s, ty - 0.8, fz + 0.315, 10) for s in (-0.5, 0.5)]),
            "plaster", (cx, 0, 0))

    # cables: from the devices down behind the bench, a loose cable over the table edge, spools on the floor
    cables = [catenary((bx0 + 0.6, by + 0.25, top + 0.1), (bx0 + 1.3, by + 0.25, top + 0.08), 0.45),
              catenary((bx0 + 1.15, by + 0.25, top + 0.08), (bx0 + 2.0, by + 0.25, top + 0.1), 0.35),
              catenary((tx + 0.5, ty - 0.1, t2), (tx + 1.6, ty - 0.9, fz + 0.02), 0.25),
              catenary((L / 2 - 1.3, back + 0.2, fz + 2.35), (px, back + 0.3, fz + 2.3), 0.3)]
    out.add("workshop/cables", cat(cables), "linework", (cx, 0, 0))
    spools = []
    for (x, y, r) in [(tx + 1.7, ty - 1.1, 0.22), (tx + 2.15, ty - 1.25, 0.16)]:
        s = trimesh.creation.annulus(r_min=r * 0.35, r_max=r, height=0.12, sections=32)
        s.apply_transform(ROT(np.pi / 2, (1, 0, 0)))
        s.apply_translation((x, y, fz + r))
        spools.append(s)
    out.add("workshop/cable_spools", U(spools), "plaster_warm", (cx, 0, 0))
    out.add("workshop/crates", U([box(0.6, 0.4, 0.35, -L / 2 + 0.9, front - 0.9, fz + 0.175),
                                  box(0.5, 0.4, 0.3, -L / 2 + 0.9, front - 0.9, fz + 0.5)]), "plaster_warm", (cx, 0, 0))


INTERIORS = {"library": library, "office": office, "workshop": workshop}


# ------------------------------------------------------------------ stilts, stair, tube
def stilts(out, p, kind, cx, L):
    """Two A-frames per module across its width: two splayed legs joined by a
    horizontal crossbar, no centre leg. Each foot stands on a ski bowed up at both ends."""
    W = p["width"]
    under = p["lift"] + 0.02
    spread = W / 2 - 0.75
    bar_z = 1.05
    legs, skis = [], []
    for lx in (-L / 2 + 1.9, L / 2 - 1.9):
        legs.append(cyl(0.34, 0.1, lx, 0, under - 0.03))
        legs.append(box(0.3, 1.2, 0.14, lx, 0, under - 0.1))
        ends = []
        for sy in (-1, 1):
            top = np.array([lx, sy * 0.45, under - 0.15])
            foot = np.array([lx, sy * spread, 0.32])
            legs.append(rod(top, foot, 0.085, 16))
            legs.append(trimesh.creation.icosphere(subdivisions=2, radius=0.11).apply_translation(foot))
            legs.append(cyl(0.055, 0.2, lx, sy * spread, 0.2, 12))
            f = (bar_z - foot[2]) / (top[2] - foot[2])
            ends.append(foot + (top - foot) * f)
            s = ski()
            s.apply_translation((lx, sy * spread, 0.05))
            skis.append(s)
        legs.append(rod(ends[0], ends[1], 0.06, 12))
    out.add(f"{kind}/legs", U(legs), "plaster", (cx, 0, 0))
    out.add(f"{kind}/skis", cat(skis), "plaster", (cx, 0, 0))


def stair(out, kind, x_end, fz):
    st, rail = [], []
    n, run = 12, 0.28
    rise = fz / n
    sx0 = x_end - 0.2
    for i in range(n):
        st.append(box(run, 1.0, 0.06, sx0 - i * run, -0.6, fz - i * rise - 0.03))
    st.append(box(0.9, 1.2, 0.08, x_end + 0.05, -0.6, fz - 0.04))
    for side in (-1, 1):
        y = -0.6 + side * 0.52
        rail.append(rod((sx0 + 0.2, y, fz + 0.95), (sx0 - (n - 1) * run, y, rise + 0.95), 0.012, 8))
        for i in range(0, n, 4):
            rail.append(cyl(0.009, 0.95, sx0 - i * run, y, fz - i * rise + 0.475, 8))
    out.add(f"{kind}/stair", U(st), "plaster")
    out.add(f"{kind}/stair_rail", cat(rail), "linework")


def tube(p, name, x0, x1, cz, fz):
    """Short closed corridor between two end walls, with plaster ribs."""
    out = Part()
    r, t = p["tube_r"], p["tube_wall"]
    length, mid = x1 - x0, (x0 + x1) / 2
    body = D(xcyl(r, length, mid, 0, cz), xcyl(r - t, length + 1, mid, 0, cz))
    ribs = [D(xcyl(r + 0.07, 0.12, x, 0, cz), xcyl(r - 0.02, 0.4, x, 0, cz))
            for x in (x0 + 0.35, mid, x1 - 0.35)]
    floor = box(length, 1.5, 0.12, mid, 0, fz - 0.06)
    out.add(f"{name}/shell", U([body] + ribs + [floor]), "plaster")
    return out


# ------------------------------------------------------------------ assembly
def build(p):
    specs = p["modules"]
    total = sum(s["length"] for s in specs) + p["gap"] * (len(specs) - 1)
    x = -total / 2
    centres = []
    for s in specs:
        centres.append(x + s["length"] / 2)
        x += s["length"] + p["gap"]
    items = []
    fz = tcz = None
    for i, (s, c) in enumerate(zip(specs, centres)):
        ends = {"left": "door" if i == 0 else "tube",
                "right": "tube" if i < len(specs) - 1 else "window"}
        if s["kind"] == "workshop":
            ends["right"] = "solid"            # server room against the end wall
        part, fz, tcz = module(p, s, c, ends)
        items += part.items
    for i in range(len(specs) - 1):
        a_end = centres[i] + specs[i]["length"] / 2 - p["wall"] * 0.5
        b_end = centres[i + 1] - specs[i + 1]["length"] / 2 + p["wall"] * 0.5
        items += tube(p, f"tube_{i + 1}", a_end, b_end, tcz, fz).items
    items.append(("ground", box(total + 12, p["width"] + 11, 1.2, -1.0, 0, -0.6), "ground"))
    return items


def export(items, path):
    scene = trimesh.Scene()
    for name, mesh, mat in items:
        m = mesh.copy()
        m.merge_vertices()
        m.apply_transform(ROT(-np.pi / 2, (1, 0, 0)))     # z-up to glTF y-up
        m = trimesh.graph.smooth_shade(m, angle=np.radians(32))
        m.visual = trimesh.visual.TextureVisuals(material=MAT[mat])
        scene.add_geometry(m, node_name=name, geom_name=name)
    scene.export(path, include_normals=True)
    return sum(len(m.faces) for _, m, _ in items)


if __name__ == "__main__":
    items = build(P)
    print("exported", P["out"], "triangles:", export(items, P["out"]))
