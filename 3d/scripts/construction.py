"""
Construction site for the future module (the one 'being built').
Built in the slot's own frame: long axis along y, the finished end (towards the tube) at +y.
- A-frames and skis already standing, floor deck half laid
- bare ribs with the module's chamfered profile, the first bays near the tube already clad
- scaffolding along the open side, planks and ladders
- stacked wall panels on pallets
Kept clean on Smo's request: no crane, no fence, no container.
"""
import numpy as np
import trimesh
from build_station_v4 import P, box, cyl, rod, U, D, I, cat, ROT, chamfered_body
from arrangement import a_frame


def lattice(p0, p1, w, step, r=0.025):
    """Square lattice mast or jib between two points, four chords and zigzag bracing."""
    p0, p1 = np.array(p0, float), np.array(p1, float)
    axis = p1 - p0
    L = np.linalg.norm(axis)
    a = axis / L
    ref = np.array([0, 0, 1.0]) if abs(a[2]) < 0.9 else np.array([1.0, 0, 0])
    u = np.cross(a, ref); u /= np.linalg.norm(u)
    v = np.cross(a, u)
    corners = [(u * su + v * sv) * w / 2 for su, sv in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    parts = [rod(p0 + c, p1 + c, r, 6) for c in corners]
    n = max(1, int(L // step))
    for k in range(n):
        s0, s1 = p0 + a * (k * L / n), p0 + a * ((k + 1) * L / n)
        for i in range(4):
            c0, c1 = corners[i], corners[(i + 1) % 4]
            parts.append(rod(s0 + c0, s1 + c1, r * 0.6, 4))
            parts.append(rod(s1 + c0, s1 + c1, r * 0.6, 4))
    return cat(parts)


def site_lamp(i, x, y, aim):
    """Standing work light: tripod, telescopic pole, a bar with two flood heads aimed at the site.
    The heads use the 'lightstrip' material, so they glow at night; the name ends in 'lamp',
    so the viewer puts a light there."""
    h = 3.4
    black = [rod((x + 0.7 * np.cos(a), y + 0.7 * np.sin(a), 0), (x, y, 0.9), 0.022, 6) for a in (0.3, 2.4, 4.5)]
    black += [rod((x, y, 0.85), (x, y, h), 0.035, 8), rod((x, y, h - 1.4), (x, y, h), 0.025, 8)]
    d = np.array([np.cos(aim), np.sin(aim), 0.0]); s = np.array([-d[1], d[0], 0.0])
    black.append(rod(np.array([x, y, h]) - s * 0.45, np.array([x, y, h]) + s * 0.45, 0.025, 6))
    heads, faces = [], []
    for k in (-1, 1):
        c = np.array([x, y, h + 0.12]) + s * 0.32 * k + d * 0.05
        hd = box(0.32, 0.12, 0.26)
        hd.apply_transform(ROT(aim + np.pi / 2, (0, 0, 1)))
        hd.apply_transform(ROT(0.35, tuple(s), (0, 0, 0)))
        hd.apply_translation(c)
        heads.append(hd)
        fc = box(0.26, 0.012, 0.2)
        fc.apply_transform(ROT(aim + np.pi / 2, (0, 0, 1)))
        fc.apply_transform(ROT(0.35, tuple(s), (0, 0, 0)))
        fc.apply_translation(c + d * 0.065)
        faces.append(fc)
    black += heads
    black.append(cyl(0.12, 0.25, x + 0.3, y + 0.3, 0.125, 12))          # small generator box
    return [(f"future/work_light_{i}", cat(black), "linework"),
            (f"future/work_light_{i}_lamp", cat(faces), "lightstrip")]


def construction_site(fz):
    L, W, H, t = 10.0, P["width"], P["height"], P["wall"]
    lift = P["lift"]
    z0 = lift + H / 2
    plaster, black, warm = [], [], []

    # module skeleton in its own x-long frame, then turned so the long axis runs along y
    outer = chamfered_body(L, W, H, P["chamfer_top"], P["chamfer_bottom"], P["chamfer_ends"])
    inner = chamfered_body(L - 2 * t, W - 2 * t, H - 2 * t, P["chamfer_top"] * 0.9, P["chamfer_bottom"] * 0.9, P["chamfer_ends"] * 0.9)
    shell = D(outer, inner)
    floor_z = -H / 2 + P["chamfer_bottom"] * 0.75
    ribs = [I(shell, box(0.16, 20, 20, x, 0, 0)) for x in (-4.6, -3.0, -1.4, 0.2)]
    clad = I(shell, box(3.4, 20, 20, L / 2 - 1.7, 0, 0))                 # first bays finished, end wall closed
    clad = D(clad, box(4, 3.0, 6, L / 2 - 1.7, -(W / 2 - 1.0 + 1.5), floor_z + 0.9 + 3))   # open side ends up facing +x after the turn
    r_in = P["tube_r"] - P["tube_wall"]
    hole = trimesh.creation.cylinder(radius=r_in, height=1.2, sections=40)
    hole.apply_transform(ROT(np.pi / 2, (0, 1, 0)))
    hole.apply_translation((L / 2, 0, floor_z + P["tube_r"] - P["tube_wall"] - 0.02))
    clad = D(clad, hole)
    deck = box(L * 0.55, W - 2 * t - 0.1, 0.16, L / 2 - L * 0.55 / 2, 0, floor_z - 0.08)
    beams = [box(L - 0.4, 0.14, 0.2, 0, y, floor_z - 0.26) for y in (-2.0, -0.7, 0.7, 2.0)]
    sk = U(ribs + [clad, deck] + beams)
    sk.apply_translation((0, 0, z0))
    sk.apply_transform(ROT(np.pi / 2, (0, 0, 1)))
    plaster.append(sk)
    fz_l = z0 + floor_z

    # legs already standing
    for y in (-L / 2 + 1.9, L / 2 - 1.9):
        l, s = a_frame(0, y, W / 2 - 0.75, lift + 0.02, axis="x")
        plaster += [l, s]

    # scaffolding along the open (+x) side
    sx0 = W / 2 + 0.5
    for y in np.linspace(-L / 2, L / 2 - 2.0, 6):
        for dx in (0, 1.0):
            black.append(rod((sx0 + dx, y, 0), (sx0 + dx, y, 6.2), 0.03, 6))
    for z in (2.0, 4.0, 6.0):
        for dx in (0, 1.0):
            black.append(rod((sx0 + dx, -L / 2, z), (sx0 + dx, L / 2 - 2.0, z), 0.025, 6))
        warm.append(box(0.9, L - 2.0, 0.05, sx0 + 0.5, -1.0, z + 0.03))           # planks
        if z < 6.0:   # Smo: the top rail stood above the posts, connected to nothing
            black.append(rod((sx0 + 1.0, -L / 2, z + 1.0), (sx0 + 1.0, L / 2 - 2.0, z + 1.0), 0.015, 6))   # guard rail
    for k in range(5):                                                                 # diagonal bracing
        y0 = -L / 2 + k * (L - 2.0) / 5
        black.append(rod((sx0 + 1.0, y0, 0.0), (sx0 + 1.0, y0 + (L - 2.0) / 5, 6.0), 0.015, 4))
    black.append(rod((sx0 + 0.3, -L / 2 + 0.5, 0), (sx0 + 0.3, -L / 2 + 1.0, 4.0), 0.02, 4))   # ladder rails
    black.append(rod((sx0 + 0.7, -L / 2 + 0.5, 0), (sx0 + 0.7, -L / 2 + 1.0, 4.0), 0.02, 4))

    # materials on the ground: stacked wall panels on pallets
    for k in range(2):
        warm.append(box(3.0, 1.4, 0.14, -5.5, 3.0 + k * 1.8, 0.07))
        for j in range(4):
            plaster.append(box(2.8, 1.2, 0.14, -5.5, 3.0 + k * 1.8, 0.21 + j * 0.15))
    # second scaffold across the open, unclad end (-y)
    ey0 = -L / 2 - 0.5
    xs = np.linspace(-W / 2 - 0.5, sx0 + 1.0, 5)
    for x in xs:
        for dy in (0, -1.0):
            black.append(rod((x, ey0 + dy, 0), (x, ey0 + dy, 6.2), 0.03, 6))
    for z in (2.0, 4.0, 6.0):
        for dy in (0, -1.0):
            black.append(rod((xs[0], ey0 + dy, z), (xs[-1], ey0 + dy, z), 0.025, 6))
        warm.append(box(xs[-1] - xs[0], 0.9, 0.05, (xs[0] + xs[-1]) / 2, ey0 - 0.5, z + 0.03))
        if z < 6.0:
            black.append(rod((xs[0], ey0 - 1.0, z + 1.0), (xs[-1], ey0 - 1.0, z + 1.0), 0.015, 6))
    for k in range(len(xs) - 1):
        black.append(rod((xs[k], ey0 - 1.0, 0.0), (xs[k + 1], ey0 - 1.0, 6.0), 0.015, 4))

    lamps = []
    # Smo: the leftmost lamp in the default view (free-standing in front of the side scaffold) removed
    # one work light left, standing clear of the scaffolds and the panel stacks, aimed at the site
    for i, (lx, ly, aim) in [(0, (sx0 + 3.2, -L / 2 - 3.0, 2.49))]:
        lamps += site_lamp(i, lx, ly, aim)
    return lamps + [("future/site_structure", cat(plaster), "plaster"),
            ("future/site_steel", cat(black), "linework"),
            ("future/site_timber", cat(warm), "plaster_warm")]
