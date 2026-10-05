"""
Station generator, version 2.
Two modules (library and study) joined by a tube, as a cutaway plaster model.
Exports station_v2.glb.

Changes from v1
- Simpler cut: the front wall is removed down to a parapet, and only a strip of the
  roof along the front is open. End walls and most of the roof stay closed.
- The removed pieces are exported as "ghost" parts. The viewer hides them but lets
  them cast shadows, so light only enters where real openings are.
- A-frame legs without a crossbar, each foot on a ski.
- A tube corridor connects the two modules, cut open the same way.

All sizes in metres. Run:  python3 build_station.py
"""
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

P = dict(
    length=10.0, width=5.0, height=3.6,
    chamfer_top=0.55, chamfer_bottom=0.95, chamfer_ends=0.45,
    wall=0.18, lift=2.3,
    window_w=0.65, window_h=0.85, window_spacing=1.25,
    parapet=0.9,          # height of the cut front wall above the floor
    roof_open=2.0,        # depth of the open roof strip, measured from the front face
    end_return=0.7,       # how far the end walls wrap around the front corner
    gap=3.6,              # distance between the two modules (tube length)
    tube_r=1.15,          # tube outer radius
    tube_wall=0.12,
    out="station_v2.glb",
)

MAT = {
    "plaster": PBRMaterial(name="plaster", baseColorFactor=[0.93, 0.905, 0.86, 1], metallicFactor=0, roughnessFactor=0.92),
    "plaster_warm": PBRMaterial(name="plaster_warm", baseColorFactor=[0.90, 0.86, 0.80, 1], metallicFactor=0, roughnessFactor=0.95),
    "linework": PBRMaterial(name="linework", baseColorFactor=[0.07, 0.07, 0.07, 1], metallicFactor=0.3, roughnessFactor=0.55),
    "ground": PBRMaterial(name="ground", baseColorFactor=[0.95, 0.94, 0.92, 1], metallicFactor=0, roughnessFactor=1),
    "ghost": PBRMaterial(name="ghost", baseColorFactor=[1, 0, 1, 1], metallicFactor=0, roughnessFactor=1),
}

ROT = trimesh.transformations.rotation_matrix


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
    """Cylinder lying along the x axis."""
    m = trimesh.creation.cylinder(radius=r, height=length, sections=sections)
    m.apply_transform(ROT(np.pi / 2, (0, 1, 0)))
    m.apply_translation((cx, cy, cz))
    return m


def U(ms):
    ms = [m for m in ms if m is not None and len(m.faces)]
    return ms[0] if len(ms) == 1 else trimesh.boolean.union(ms, engine="manifold")


def D(a, b):
    return trimesh.boolean.difference([a, b], engine="manifold")


def I(a, b):
    return trimesh.boolean.intersection([a, b], engine="manifold")


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


def frame(w, h, depth, bar):
    f = D(box(w, depth, h), box(w - 2 * bar, depth * 2, h - 2 * bar))
    return U([f, box(bar * 0.8, depth, h)])


class Part:
    """Collects named meshes with materials, already in world position."""
    def __init__(self):
        self.items = []

    def add(self, name, mesh, mat, offset=(0, 0, 0)):
        if mesh is None or not len(mesh.faces):
            return
        m = mesh.copy()
        m.apply_translation(offset)
        self.items.append((name, m, mat))


# ---------------------------------------------------------------- module
def module(p, kind, cx, ends):
    """Build one module centred at x=cx.
    ends: dict with 'left' / 'right' set to 'door', 'tube' or 'window'."""
    L, W, H, t = p["length"], p["width"], p["height"], p["wall"]
    z0 = p["lift"] + H / 2
    out = Part()

    outer = chamfered_body(L, W, H, p["chamfer_top"], p["chamfer_bottom"], p["chamfer_ends"])
    inner = chamfered_body(L - 2 * t, W - 2 * t, H - 2 * t, p["chamfer_top"] * 0.9,
                           p["chamfer_bottom"] * 0.9, p["chamfer_ends"] * 0.9)
    shell = D(outer, inner)
    floor_z = -H / 2 + p["chamfer_bottom"] * 0.75
    shell = U([shell, box(L - 2 * t - 0.1, W - 2 * t - 0.1, 0.16, 0, 0, floor_z - 0.08)])

    # openings: windows along both long walls, then the end walls
    win_z = floor_z + 1.35
    n = int((L - 2.5) // p["window_spacing"])
    xs = (np.arange(n) - (n - 1) / 2) * p["window_spacing"]
    holes, frames = [], []
    for side in (-1, 1):
        for x in xs:
            holes.append(box(p["window_w"], 1.0, p["window_h"], x, side * W / 2, win_z))
            f = frame(p["window_w"], p["window_h"], 0.05, 0.035)
            f.apply_translation((x, side * (W / 2 - t * 0.5), win_z))
            frames.append(f)
    tube_cz = floor_z + p["tube_r"] - p["tube_wall"] - 0.02     # tube floor meets module floor
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

    # the cut: front wall down to the parapet, plus a strip of roof along the front
    xr = L / 2 - p["end_return"]
    cut_wall = box(2 * xr, 3.0, 6, 0, W / 2 - 1.0 + 1.5, floor_z + p["parapet"] + 3)
    cut_roof = box(2 * xr, p["roof_open"] + 2, 3, 0, W / 2 - p["roof_open"] + (p["roof_open"] + 2) / 2,
                   H / 2 - p["chamfer_top"] - 0.25 + 1.5)
    cutter = U([cut_wall, cut_roof])
    kept = D(shell, cutter)
    ghost = I(shell, cutter)
    out.add(f"{kind}/shell", kept, "plaster", (cx, 0, z0))
    out.add(f"{kind}/ghost_shell", ghost, "ghost", (cx, 0, z0))
    kept_frames = [f for f in frames if not cutter.contains([f.bounds.mean(axis=0)])[0]]
    if kept_frames:
        out.add(f"{kind}/window_frames", trimesh.util.concatenate(kept_frames), "linework", (cx, 0, z0))

    fz = z0 + floor_z
    furnish = library if kind == "library" else study
    furnish(out, p, cx, fz)
    a_frames(out, p, kind, cx)
    if ends.get("left") == "door":
        stair(out, p, kind, cx - L / 2, fz)
    return out, fz, tube_cz + z0


# ---------------------------------------------------------------- interiors
def library(out, p, cx, fz):
    W, t = p["width"], p["wall"]
    back_y = -(W - 2 * t) / 2 + 0.05
    shelves, books = [], []
    sh, sd, uw = 2.25, 0.36, 1.0
    rng = np.random.default_rng(7)
    for i in range(7):
        ux = -p["length"] / 2 + 1.0 + i * (uw + 0.02) + uw / 2
        if ux + uw / 2 > p["length"] / 2 - 0.5:
            break
        cy = back_y + sd / 2
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
    out.add("library/books", trimesh.util.concatenate(books), "plaster_warm", (cx, 0, 0))
    dx, dy = 1.2, 0.4
    out.add("library/desk", U([box(2.0, 0.9, 0.05, dx, dy, fz + 0.75)] +
                              [box(0.05, 0.8, 0.72, dx + s * 0.95, dy, fz + 0.36) for s in (-1, 1)]),
            "plaster", (cx, 0, 0))
    out.add("library/papers", trimesh.util.concatenate([
        box(0.3, 0.21, 0.004, dx - 0.4, dy + 0.1, fz + 0.777),
        box(0.21, 0.3, 0.004, dx - 0.05, dy + 0.05, fz + 0.778),
        box(0.42, 0.3, 0.02, dx + 0.45, dy + 0.12, fz + 0.785)]), "plaster_warm", (cx, 0, 0))
    chair(out, "library/chair", cx + dx, dy + 0.75, fz, facing=1)
    lamp(out, "library/lamp", cx + dx - 0.8, dy - 0.25, fz + 0.78)
    out.add("library/armchair", U([box(0.8, 0.8, 0.4, -p["length"] / 2 + 1.0, 1.0, fz + 0.2),
                                   box(0.8, 0.15, 0.8, -p["length"] / 2 + 1.0, 1.35, fz + 0.4)]),
            "plaster", (cx, 0, 0))


def study(out, p, cx, fz):
    W, t = p["width"], p["wall"]
    back_y = -(W - 2 * t) / 2
    # whiteboard on the back wall, black frame and a few drawn diagram lines
    bw, bh, bz = 3.2, 1.3, fz + 1.55
    out.add("study/whiteboard", box(bw, 0.04, bh, -0.6, back_y + 0.03, bz), "plaster_warm", (cx, 0, 0))
    lines = [D(box(bw + 0.06, 0.03, bh + 0.06), box(bw, 0.1, bh))]
    lines[0].apply_translation((-0.6, back_y + 0.06, bz))
    y = back_y + 0.055
    for (x0, z0_, w, h) in [(-1.8, 0.25, 0.6, 0.35), (-0.9, 0.25, 0.6, 0.35), (0.0, 0.25, 0.6, 0.35),
                            (-1.35, -0.35, 0.6, 0.3), (0.45, -0.35, 0.5, 0.3)]:
        r = D(box(w, 0.01, h), box(w - 0.03, 0.05, h - 0.03))
        r.apply_translation((-0.6 + x0 + w / 2 - 0.3, y, bz + z0_))
        lines.append(r)
    for (xa, za, xb, zb) in [(-1.5, 0.25, -1.2, 0.25), (-0.6, 0.25, -0.3, 0.25), (-0.9, 0.08, -1.05, -0.2), (0.0, 0.08, 0.6, -0.2)]:
        lines.append(rod((-0.6 + xa, y, bz + za), (-0.6 + xb, y, bz + zb), 0.008, 6))
    out.add("study/whiteboard_lines", U(lines), "linework", (cx, 0, 0))
    # desk facing the board, chair, low cabinet with a small model on it
    dx, dy = -0.6, -0.2
    out.add("study/desk", U([box(2.2, 0.9, 0.05, dx, dy, fz + 0.75)] +
                            [box(0.05, 0.8, 0.72, dx + s * 1.05, dy, fz + 0.36) for s in (-1, 1)]),
            "plaster", (cx, 0, 0))
    out.add("study/laptop", U([box(0.34, 0.24, 0.015, dx + 0.3, dy + 0.1, fz + 0.785),
                               box(0.34, 0.015, 0.23, dx + 0.3, dy - 0.02, fz + 0.89)]), "linework", (cx, 0, 0))
    out.add("study/papers", box(0.3, 0.21, 0.004, dx - 0.5, dy + 0.15, fz + 0.777), "plaster_warm", (cx, 0, 0))
    chair(out, "study/chair", cx + dx, dy + 0.75, fz, facing=1)
    out.add("study/cabinet", box(1.6, 0.5, 0.8, 2.9, back_y + 0.3, fz + 0.4), "plaster", (cx, 0, 0))
    # small architectural maquette on the cabinet, a nod to the station itself
    mq = [box(0.35, 0.18, 0.12, 2.7, back_y + 0.3, fz + 0.86), box(0.25, 0.18, 0.12, 3.15, back_y + 0.3, fz + 0.86)]
    out.add("study/maquette", U(mq), "plaster_warm", (cx, 0, 0))
    out.add("study/stool", U([cyl(0.2, 0.04, 2.0, 1.2, fz + 0.5), cyl(0.03, 0.48, 2.0, 1.2, fz + 0.24, 12),
                              cyl(0.18, 0.02, 2.0, 1.2, fz + 0.01)]), "plaster", (cx, 0, 0))


def chair(out, name, x, y, fz, facing=1):
    parts = [box(0.45, 0.45, 0.05, x, y, fz + 0.45), box(0.45, 0.04, 0.45, x, y + facing * 0.23, fz + 0.7)]
    parts += [box(0.035, 0.035, 0.45, x + sx * 0.2, y + sy * 0.2, fz + 0.225) for sx in (-1, 1) for sy in (-1, 1)]
    out.add(name, U(parts), "plaster")


def lamp(out, name, x, y, z):
    shade = trimesh.creation.cone(radius=0.13, height=0.16, sections=32)
    shade.apply_transform(ROT(np.pi, (1, 0, 0)))
    shade.apply_translation((x, y, z + 0.57))
    out.add(name, trimesh.util.concatenate([cyl(0.008, 0.45, x, y, z + 0.225, 12),
                                            cyl(0.07, 0.015, x, y, z + 0.005), shade]), "linework")


# ---------------------------------------------------------------- legs, stair
def a_frames(out, p, kind, cx):
    """Two A-frames per module, standing across the module, no crossbar."""
    L = p["length"]
    under = p["lift"] + 0.02
    legs, skis = [], []
    for lx in (-L / 2 + 1.9, L / 2 - 1.9):
        apex = np.array([lx, 0.0, under])
        legs.append(cyl(0.32, 0.1, lx, 0, under - 0.03))            # mounting plate
        legs.append(box(0.3, 1.1, 0.14, lx, 0, under - 0.1))          # short beam under the body
        for sy in (-1, 1):
            top = np.array([lx, sy * 0.45, under - 0.15])
            foot = np.array([lx, sy * 1.85, 0.3])
            legs.append(rod(top, foot, 0.085, 16))
            legs.append(trimesh.creation.icosphere(subdivisions=2, radius=0.12).apply_translation(foot))
            legs.append(cyl(0.06, 0.18, lx, sy * 1.85, 0.2, 12))
            ski = box(1.5, 0.3, 0.07, lx, sy * 1.85, 0.08)
            tip = box(0.35, 0.3, 0.07)
            tip.apply_transform(ROT(-0.45, (0, 1, 0)))
            tip.apply_translation((lx + 0.89, sy * 1.85, 0.13))
            skis += [ski, tip]
    out.add(f"{kind}/legs", U(legs), "plaster", (cx, 0, 0))
    out.add(f"{kind}/skis", U(skis), "plaster", (cx, 0, 0))


def stair(out, p, kind, x_end, fz):
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
    out.add(f"{kind}/stair_rail", trimesh.util.concatenate(rail), "linework")


# ---------------------------------------------------------------- tube
def tube(p, x0, x1, cz, fz):
    """Corridor tube from x0 to x1 (module end walls), cut open like the modules."""
    out = Part()
    r, t = p["tube_r"], p["tube_wall"]
    length = x1 - x0
    mid = (x0 + x1) / 2
    body = D(xcyl(r, length, mid, 0, cz), xcyl(r - t, length + 1, mid, 0, cz))
    # ribs every 0.9 m give the plaster tube some rhythm
    ribs = []
    k = int(length // 0.9)
    for i in range(1, k + 1):
        x = x0 + i * length / (k + 1)
        ribs.append(D(xcyl(r + 0.06, 0.1, x, 0, cz), xcyl(r - 0.02, 0.3, x, 0, cz)))
    body = U([body] + ribs)
    floor = box(length, 1.5, 0.12, mid, 0, fz - 0.06)
    body = U([body, floor])
    # same cut logic as the modules: open towards the front above the parapet
    cutter = box(length + 0.2, 3, 4, mid, 0.25 + 1.5, fz + p["parapet"] + 2)
    out.add("tube/shell", D(body, cutter), "plaster")
    out.add("tube/ghost_shell", I(body, cutter), "ghost")
    # thin black handrail along the back side
    out.add("tube/rail", rod((x0 + 0.1, -0.62, fz + 0.95), (x1 - 0.1, -0.62, fz + 0.95), 0.014, 8), "linework")
    return out


# ---------------------------------------------------------------- assembly
def build(p):
    L, gap = p["length"], p["gap"]
    lib_cx = -(L / 2 + gap / 2)
    stu_cx = (L / 2 + gap / 2)
    parts = []
    lib, fz, tcz = module(p, "library", lib_cx, {"left": "door", "right": "tube"})
    stu, _, _ = module(p, "study", stu_cx, {"left": "tube", "right": "window"})
    tb = tube(p, lib_cx + L / 2 - p["wall"] * 0.5, stu_cx - L / 2 + p["wall"] * 0.5, tcz, fz)
    parts = lib.items + stu.items + tb.items
    ground = box(2 * L + gap + 14, p["width"] + 10, 1.2, -1.5, 0, -0.6)
    parts.append(("ground", ground, "ground"))
    return parts


def export(parts, path):
    scene = trimesh.Scene()
    for name, mesh, mat in parts:
        m = mesh.copy()
        m.merge_vertices()
        m.apply_transform(ROT(-np.pi / 2, (1, 0, 0)))     # z-up to glTF y-up
        m = trimesh.graph.smooth_shade(m, angle=np.radians(32))
        m.visual = trimesh.visual.TextureVisuals(material=MAT[mat])
        scene.add_geometry(m, node_name=name, geom_name=name)
    scene.export(path, include_normals=True)
    return sum(len(m.faces) for _, m, _ in parts)


if __name__ == "__main__":
    parts = build(P)
    print("exported", P["out"], "triangles:", export(parts, P["out"]))
