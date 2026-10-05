"""
Station module generator, version 1.
Builds one research-station module (the library) as a cutaway plaster model
and exports it as a .glb object.

All sizes are in metres at real-world scale. Change the numbers in PARAMS
and re-run:  python3 build_module.py
"""
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

PARAMS = dict(
    length=10.0,        # along x
    width=5.0,          # along y
    height=3.6,         # body height
    chamfer_top=0.55,   # chamfer on the upper edges
    chamfer_bottom=0.95,  # bigger chamfer underneath gives the lifted, tapered look
    chamfer_ends=0.45,  # chamfer on the vertical end edges
    wall=0.18,          # wall thickness
    lift=2.3,           # height of the body underside above the ground
    window_w=0.65, window_h=0.85, window_spacing=1.25,
    out="module_library.glb",
)

# ------------------------------------------------------------------ materials
PLASTER = PBRMaterial(name="plaster", baseColorFactor=[0.93, 0.905, 0.86, 1.0],
                      metallicFactor=0.0, roughnessFactor=0.92)
PAPER = PBRMaterial(name="plaster_warm", baseColorFactor=[0.90, 0.86, 0.80, 1.0],
                    metallicFactor=0.0, roughnessFactor=0.95)
LINE = PBRMaterial(name="linework", baseColorFactor=[0.07, 0.07, 0.07, 1.0],
                   metallicFactor=0.3, roughnessFactor=0.55)
GROUND = PBRMaterial(name="ground", baseColorFactor=[0.95, 0.94, 0.92, 1.0],
                     metallicFactor=0.0, roughnessFactor=1.0)


def box(sx, sy, sz, cx=0, cy=0, cz=0):
    m = trimesh.creation.box(extents=(sx, sy, sz))
    m.apply_translation((cx, cy, cz))
    return m


def cyl(r, h, cx, cy, cz, sections=24):
    m = trimesh.creation.cylinder(radius=r, height=h, sections=sections)
    m.apply_translation((cx, cy, cz))
    return m


def chamfered_body(L, W, H, ct, cb, ce):
    """Convex hull of a box whose 12 edges are chamfered.
    Top and bottom edges can have different chamfers."""
    a, b, h = L / 2, W / 2, H / 2
    pts = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                c = ct if sz > 0 else cb
                # long horizontal edges (along x): chamfer c
                pts.append((sx * (a - ce), sy * b, sz * (h - c)))
                pts.append((sx * (a - ce), sy * (b - c), sz * h))
                # end faces
                pts.append((sx * a, sy * (b - ce), sz * (h - c)))
                pts.append((sx * a, sy * (b - c - ce * 0.5), sz * (h - c * 0.5)))
    return trimesh.convex.convex_hull(np.array(pts))


def union(meshes):
    return trimesh.boolean.union(meshes, engine="manifold")


def diff(a, b):
    return trimesh.boolean.difference([a, b], engine="manifold")


def frame(w, h, depth, bar, cx, cy, cz, axis="y"):
    """Thin black window frame with one mullion, set into a wall facing +/-y or +/-x."""
    outer = box(w, depth, h)
    inner = box(w - 2 * bar, depth * 2, h - 2 * bar)
    f = diff(outer, inner)
    f = union([f, box(bar * 0.8, depth, h)])          # vertical mullion
    if axis == "x":
        f.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, (0, 0, 1)))
    f.apply_translation((cx, cy, cz))
    return f


def build(p):
    L, W, H, t = p["length"], p["width"], p["height"], p["wall"]
    z0 = p["lift"] + H / 2           # body centre height
    parts = {}                       # name -> (mesh, material)

    # ---------------------------------------------------------------- shell
    outer = chamfered_body(L, W, H, p["chamfer_top"], p["chamfer_bottom"], p["chamfer_ends"])
    inner = chamfered_body(L - 2 * t, W - 2 * t, H - 2 * t,
                           p["chamfer_top"] * 0.9, p["chamfer_bottom"] * 0.9, p["chamfer_ends"] * 0.9)
    shell = diff(outer, inner)

    # floor slab inside, flat walking surface above the tapered underside
    floor_z = -H / 2 + p["chamfer_bottom"] * 0.75
    shell = union([shell, box(L - 2 * t - 0.1, W - 2 * t - 0.1, 0.16, 0, 0, floor_z - 0.08)])

    # windows: a row along both long sides, plus one in each end wall
    win_z = floor_z + 1.35
    n = int((L - 2.5) // p["window_spacing"])
    xs = (np.arange(n) - (n - 1) / 2) * p["window_spacing"]
    holes, frames = [], []
    for side in (-1, 1):
        for x in xs:
            holes.append(box(p["window_w"], 1.0, p["window_h"], x, side * W / 2, win_z))
            frames.append(frame(p["window_w"], p["window_h"], 0.05, 0.035,
                                x, side * (W / 2 - t * 0.5), win_z))
    # door in the left end wall
    door_h = 2.1
    holes.append(box(1.0, 1.1, door_h, -L / 2, -0.6, floor_z + door_h / 2))
    shell = diff(shell, union(holes))

    # ------------------------------------------------------- stepped cutaway
    # Like a section model of a monument: the cut steps down along the module.
    cut = []
    # roof: kept over the first 1.4 m, half kept for the next 1.2 m, then open
    cut.append(box(L, W + 2, 3, -L / 2 + 1.4 + 1.2 + L / 2, 0, H / 2 - 0.3 + 1.5))
    cut.append(box(1.2, W / 2 + 1, 3, -L / 2 + 1.4 + 0.6, W / 4 + 0.5, H / 2 - 0.3 + 1.5))
    # front wall (+y side): stepped down from left to right
    steps = [(-L / 2 + 1.4, -L / 2 + 2.6, win_z + 0.75),   # high block keeps a window
             (-L / 2 + 2.6, -L / 2 + 4.4, win_z - 0.1),
             (-L / 2 + 4.4, L / 2 + 1, floor_z + 0.75)]     # low parapet
    for x0, x1, zc in steps:
        cut.append(box(x1 - x0, 2.2, 6, (x0 + x1) / 2, W / 2 - 0.95 + 1.1, zc + 3))
    # right end wall: opened down to the parapet over the front half
    cut.append(box(2.0, W * 0.75, 6, L / 2, W / 2 - W * 0.375 + 0.3, floor_z + 0.75 + 3))
    cutter = union(cut)
    shell = diff(shell, cutter)
    shell.apply_translation((0, 0, z0))
    parts["module_shell"] = (shell, PLASTER)

    # frames: drop the ones that now float in the cut-away region
    keep = []
    for f in frames:
        c = f.bounds.mean(axis=0)
        inside = cutter.contains([c])[0]
        if not inside:
            keep.append(f)
    if keep:
        fr = trimesh.util.concatenate(keep)
        fr.apply_translation((0, 0, z0))
        parts["window_frames"] = (fr, LINE)

    # --------------------------------------------------------- library inside
    fz = z0 + floor_z            # top of floor
    inner_w = W - 2 * t
    back_y = -inner_w / 2 + 0.05
    shelf_parts, book_parts = [], []
    shelf_h, shelf_d = 2.25, 0.36
    unit_w = 1.0
    x_start = -L / 2 + 1.0
    rng = np.random.default_rng(7)
    for i in range(7):
        ux = x_start + i * (unit_w + 0.02) + unit_w / 2
        if ux + unit_w / 2 > L / 2 - 0.5:
            break
        cy = back_y + shelf_d / 2
        # sides and boards
        for sx in (-1, 1):
            shelf_parts.append(box(0.04, shelf_d, shelf_h, ux + sx * unit_w / 2, cy, fz + shelf_h / 2))
        boards = 5
        for k in range(boards + 1):
            bz = fz + 0.06 + k * (shelf_h - 0.1) / boards
            shelf_parts.append(box(unit_w, shelf_d, 0.035, ux, cy, bz))
            if k < boards:
                # books standing on the board, varied height and thickness
                x = ux - unit_w / 2 + 0.05
                while x < ux + unit_w / 2 - 0.08:
                    bw = rng.uniform(0.025, 0.06)
                    bh = rng.uniform(0.22, 0.34)
                    if rng.random() < 0.08:          # small gap
                        x += 0.07
                        continue
                    book_parts.append(box(bw, shelf_d * 0.8, bh, x + bw / 2,
                                          cy + 0.02, bz + 0.0175 + bh / 2))
                    x += bw + 0.004
    parts["shelves"] = (union(shelf_parts), PLASTER)
    parts["books"] = (trimesh.util.concatenate(book_parts), PAPER)

    # desk with chair and lamp
    dx, dy = 1.2, 0.4
    desk = [box(2.0, 0.9, 0.05, dx, dy, fz + 0.75)]
    for sx in (-1, 1):
        desk.append(box(0.05, 0.8, 0.72, dx + sx * 0.95, dy, fz + 0.36))
    parts["desk"] = (union(desk), PLASTER)
    papers = [box(0.3, 0.21, 0.004, dx - 0.4, dy + 0.1, fz + 0.777),
              box(0.21, 0.3, 0.004, dx - 0.05, dy + 0.05, fz + 0.778),
              box(0.42, 0.3, 0.02, dx + 0.45, dy + 0.12, fz + 0.785)]   # open book
    parts["papers"] = (trimesh.util.concatenate(papers), PAPER)
    chair = [box(0.45, 0.45, 0.05, dx, dy + 0.75, fz + 0.45),
             box(0.45, 0.04, 0.45, dx, dy + 0.98, fz + 0.7)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            chair.append(box(0.035, 0.035, 0.45, dx + sx * 0.2, dy + 0.75 + sy * 0.2, fz + 0.225))
    parts["chair"] = (union(chair), PLASTER)
    lamp = [cyl(0.008, 0.45, dx - 0.8, dy - 0.25, fz + 0.78 + 0.225, 12),
            cyl(0.07, 0.015, dx - 0.8, dy - 0.25, fz + 0.785, 24)]
    shade = trimesh.creation.cone(radius=0.13, height=0.16, sections=32)
    shade.apply_transform(trimesh.transformations.rotation_matrix(np.pi, (1, 0, 0)))
    shade.apply_translation((dx - 0.8, dy - 0.25, fz + 0.78 + 0.45 + 0.12))
    lamp.append(shade)
    parts["lamp"] = (trimesh.util.concatenate(lamp), LINE)

    # reading armchair corner near the window end
    arm = [box(0.8, 0.8, 0.4, -L / 2 + 1.0, 1.2, fz + 0.2),
           box(0.8, 0.15, 0.8, -L / 2 + 1.0, 1.55, fz + 0.4)]
    parts["armchair"] = (union(arm), PLASTER)

    # ------------------------------------------------------- legs and skis
    leg_parts, ski_parts = [], []
    body_bottom = p["lift"]
    for lx in (-L / 2 + 1.7, L / 2 - 1.7):
        for ly in (-1.3, 1.3):
            top = body_bottom + 0.05
            leg_parts.append(cyl(0.11, top - 0.35, lx, ly, 0.35 + (top - 0.35) / 2))
            leg_parts.append(cyl(0.17, 0.12, lx, ly, top - 0.06))       # top plate
            leg_parts.append(cyl(0.07, 0.25, lx, ly, 0.22))              # ankle
            # ski foot with an upturned tip
            ski = box(1.5, 0.32, 0.07, lx, ly, 0.08)
            tip = box(0.35, 0.32, 0.07, 0, 0, 0)
            tip.apply_transform(trimesh.transformations.rotation_matrix(-0.45, (0, 1, 0)))
            tip.apply_translation((lx + 0.75 + 0.14, ly, 0.13))
            ski_parts += [ski, tip]
    parts["legs"] = (union(leg_parts), PLASTER)
    parts["skis"] = (union(ski_parts), PLASTER)

    # ------------------------------------------------------- stair to the door
    st = []
    step_n = 12
    run = 0.28
    rise = (fz) / step_n
    sx0 = -L / 2 - 0.2
    for i in range(step_n):
        h = fz - i * rise
        st.append(box(run, 1.0, 0.06, sx0 - i * run, -0.6, h - 0.03))
    landing = box(0.9, 1.2, 0.08, -L / 2 - 0.2 + 0.25, -0.6, fz - 0.04)
    st.append(landing)
    parts["stair"] = (union(st), PLASTER)
    rail = []
    for side in (-1, 1):
        y = -0.6 + side * 0.52
        p0 = np.array([sx0 + 0.2, y, fz + 0.95])
        p1 = np.array([sx0 - (step_n - 1) * run, y, rise + 0.95])
        seg = trimesh.creation.cylinder(radius=0.012, segment=[p0, p1], sections=8)
        rail.append(seg)
        for i in range(0, step_n, 4):
            x = sx0 - i * run
            zt = fz - i * rise
            rail.append(cyl(0.009, 0.95, x, y, zt + 0.475, 8))
    parts["stair_rail"] = (trimesh.util.concatenate(rail), LINE)

    # ------------------------------------------------------- ground block
    g = box(L + 9, W + 7, 1.2, -1.5, 0, -0.6)
    parts["ground"] = (g, GROUND)
    return parts


def export(parts, path):
    scene = trimesh.Scene()
    for name, (mesh, mat) in parts.items():
        mesh = mesh.copy()
        mesh.merge_vertices()
        # glTF is y-up: rotate z-up model into y-up
        mesh.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, (1, 0, 0)))
        # hard edges stay crisp (plaster), round parts like legs shade smoothly
        mesh = trimesh.graph.smooth_shade(mesh, angle=np.radians(32))
        mesh.visual = trimesh.visual.TextureVisuals(material=mat)
        scene.add_geometry(mesh, node_name=name, geom_name=name)
    scene.export(path, include_normals=True)
    tri = sum(len(m.faces) for m, _ in parts.values())
    return tri


if __name__ == "__main__":
    parts = build(PARAMS)
    tri = export(parts, PARAMS["out"])
    print("exported", PARAMS["out"], "triangles:", tri)
