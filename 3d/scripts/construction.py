"""
Construction site for the future module (the one 'being built').
Built in the slot's own frame: long axis along y, the finished end (towards the tube) at +y.
- A-frames and skis already standing, floor deck half laid
- bare ribs with the module's chamfered profile, the first bays near the tube already clad
- stacked wall panels on pallets, laser-cut offcuts and trimmed parts beside them
- FEAT-025a: a robot worksite instead of the scaffolds: tool rack, material silo and drums,
  charging dock with cable reel and console (the arms themselves are built in the viewer)
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


def worksite_equipment(L, W):
    """FEAT-025a: the equipment for the two robot arms, in the site's frame (ground at z = 0).
    All of it within the New module view (on an upright phone it shows about 8 m to each side of
    the module's middle), with a lane of ~3 m left free beside the module so the arms' tracked
    bases can drive between it and the equipment: the charging dock and the tool rack on the open
    side (+x), the print material behind the module (-x), the offcuts by the panel stacks.
    Returns (plaster parts, steel parts); the steel parts are drawn as black linework.
    The viewer (newmodule/worksite.js) parks the arms on the dock's spots, puts the tool heads in
    the rack's cradles and lays the hose from the pump: keep DOCK, RACK and PUMP there in step."""
    from shapely.geometry import Polygon
    pl, st = [], []
    # --- tool rack on the open side: a low plinth, two posts, a top rail and four cradles facing
    # the module (the tool heads sit in the cradles)
    rx, ry0, ry1 = W / 2 + 3.9, 1.4, 4.8
    pl.append(box(0.9, ry1 - ry0 + 0.6, 0.1, rx, (ry0 + ry1) / 2, 0.05))
    for y in (ry0 - 0.15, ry1 + 0.15):
        st.append(rod((rx + 0.25, y, 0.1), (rx + 0.25, y, 1.65), 0.04, 8))
    st.append(rod((rx + 0.25, ry0 - 0.15, 1.6), (rx + 0.25, ry1 + 0.15, 1.6), 0.03, 6))
    st.append(rod((rx + 0.25, ry0 - 0.15, 0.55), (rx + 0.25, ry1 + 0.15, 0.55), 0.025, 6))
    for k in range(4):
        y = ry0 + 0.45 + k * (ry1 - ry0 - 0.9) / 3
        pl.append(box(0.5, 0.62, 0.06, rx - 0.02, y, 1.12))                      # the cradle's shelf
        for dy in (-0.24, 0.24):                                                  # its two fork arms
            st.append(rod((rx + 0.25, y + dy, 1.16), (rx - 0.26, y + dy, 1.16), 0.018, 6))
        st.append(rod((rx + 0.25, y, 1.15), (rx + 0.25, y, 1.6), 0.018, 6))      # hanger to the top rail
    # --- charging dock on the open side: a slab with two marked spots, a charging post behind each,
    # a cable reel and a small control console
    dx, sp = W / 2 + 4.9, (-3.4, -0.6)
    pl.append(box(2.8, 5.8, 0.08, dx, (sp[0] + sp[1]) / 2, 0.04))
    for py in sp:
        for k in (-1, 1):                                                         # the spot's lines
            st.append(box(2.2, 0.04, 0.012, dx - 0.1, py + k * 1.15, 0.086))
        st.append(box(0.04, 2.34, 0.012, dx + 1.0, py, 0.086))
        px, qy = dx + 1.2, py + 0.85
        pl.append(box(0.3, 0.3, 1.05, px, qy, 0.08 + 0.525))                      # the charging post
        st.append(box(0.06, 0.18, 0.3, px - 0.16, qy, 0.85))                       # its connector
        st.append(rod((px - 0.16, qy, 0.7), (dx + 0.6, py + 0.35, 0.12), 0.025, 6))   # the lead to the spot
    cx, cy = dx + 1.55, (sp[0] + sp[1]) / 2                                       # the control console
    pl.append(box(0.45, 0.55, 1.0, cx, cy, 0.08 + 0.5))
    top = box(0.5, 0.7, 0.08, 0, 0, 0)
    top.apply_transform(ROT(-0.5, (0, 1, 0))); top.apply_translation((cx - 0.05, cy, 1.15))
    pl.append(top)
    scr = box(0.36, 0.56, 0.012, 0, 0, 0)
    scr.apply_transform(ROT(-0.5, (0, 1, 0))); scr.apply_translation((cx - 0.075, cy, 1.2))
    st.append(scr)
    rlx, rly = dx + 1.0, ry0 + 0.15                                               # the cable reel, axis along y
    for k in (-0.32, 0.32):
        disc = cyl(0.42, 0.04, rlx, rly + k, 0.52, 28)
        disc.apply_transform(ROT(np.pi / 2, (1, 0, 0), (rlx, rly + k, 0.52)))
        pl.append(disc)
    core = cyl(0.28, 0.62, rlx, rly, 0.52, 24); core.apply_transform(ROT(np.pi / 2, (1, 0, 0), (rlx, rly, 0.52)))
    st.append(core)                                                               # the wound cable
    for k in (-0.42, 0.42):
        st.append(rod((rlx - 0.35, rly + k, 0.08), (rlx, rly + k, 0.52), 0.025, 6))
        st.append(rod((rlx + 0.35, rly + k, 0.08), (rlx, rly + k, 0.52), 0.025, 6))
    st.append(rod((rlx, rly - 0.3, 0.3), (dx + 1.05, sp[1] + 0.85, 0.09), 0.02, 6))   # the cable to the nearer post
    # --- print material behind the module: a silo on four legs and a group of drums on a pallet
    sx, sy = -W / 2 - 3.5, -3.0
    pl.append(cyl(0.85, 2.6, sx, sy, 1.9 + 1.3, 32))                              # the bin
    cone = trimesh.creation.cone(radius=0.85, height=0.9, sections=32)
    cone.apply_transform(ROT(np.pi, (1, 0, 0))); cone.apply_translation((sx, sy, 1.9))
    pl.append(cone)
    pl.append(cyl(0.9, 0.08, sx, sy, 4.54, 32))                                   # the lid's rim
    pl.append(cyl(0.22, 0.25, sx, sy, 4.7, 16))                                   # the filler cap
    for a in (0.785, 2.356, 3.927, 5.498):
        lx, ly = sx + 0.78 * np.cos(a), sy + 0.78 * np.sin(a)
        st.append(rod((lx, ly, 0), (lx, ly, 2.6), 0.045, 8))
        st.append(rod((lx, ly, 0.6), (sx + 0.78 * np.cos(a + 1.571), sy + 0.78 * np.sin(a + 1.571), 0.6), 0.02, 4))
    st.append(cyl(0.12, 0.5, sx, sy, 0.95, 12))                                   # the outlet under the cone
    pl.append(box(0.6, 0.5, 0.45, sx + 0.55, sy, 0.22))                           # the feed pump (the hose leaves it at +x)
    st.append(rod((sx, sy, 0.75), (sx + 0.55, sy, 0.45), 0.06, 8))                # outlet into the pump
    for ddx, ddy in ((0, 0), (0.66, 0), (0, 0.66), (0.66, 0.66)):
        pl.append(cyl(0.3, 0.88, sx - 0.4 + ddx, sy + 2.0 + ddy, 0.12 + 0.44, 20))
        st.append(cyl(0.305, 0.03, sx - 0.4 + ddx, sy + 2.0 + ddy, 0.12 + 0.3, 20))
        st.append(cyl(0.305, 0.03, sx - 0.4 + ddx, sy + 2.0 + ddy, 0.12 + 0.68, 20))
    pl.append(box(1.4, 1.4, 0.12, sx - 0.07, sy + 2.33, 0.06))                    # their pallet

    # --- laser-cut offcuts and trimmed parts beside the panel stacks (x -7.0..-4.0, y 2.3..5.5)
    def plate(pts, z, thick=0.03):
        m = trimesh.creation.extrude_polygon(Polygon(pts), thick)
        m.apply_translation((0, 0, z))
        return m
    ox, oy = -5.0, 1.45                                                           # loose offcuts in front of the stacks
    pl.append(plate([(ox - 0.9, oy - 0.45), (ox + 0.6, oy - 0.45), (ox - 0.9, oy + 0.35)], 0.0))   # triangles left by a chamfer cut
    pl.append(plate([(ox + 0.1, oy - 0.3), (ox + 1.0, oy - 0.3), (ox + 1.0, oy + 0.4)], 0.03))
    pl.append(plate([(ox - 0.5, oy - 0.1), (ox + 0.4, oy - 0.1), (ox + 0.4, oy + 0.1), (ox - 0.3, oy + 0.1), (ox - 0.3, oy + 0.4), (ox - 0.5, oy + 0.4)], 0.06))   # an L-shaped strip
    pl.append(plate([(ox - 0.8, oy - 0.3), (ox - 0.1, oy - 0.3), (ox - 0.1, oy - 0.2), (ox - 0.8, oy - 0.2)], 0.09))   # a thin strip
    kx, ky = -6.75, 1.45                                                          # a crate of small offcuts
    for z in (0.02, 0.52):
        for y in (ky - 0.35, ky + 0.35):
            st.append(rod((kx - 0.5, y, z), (kx + 0.5, y, z), 0.02, 4))
        for x in (kx - 0.5, kx + 0.5):
            st.append(rod((x, ky - 0.35, z), (x, ky + 0.35, z), 0.02, 4))
    for x in (kx - 0.5, kx + 0.5):
        for y in (ky - 0.35, ky + 0.35):
            st.append(rod((x, y, 0), (x, y, 0.54), 0.02, 4))
    pl.append(box(0.96, 0.66, 0.36, kx, ky, 0.2))                                 # the offcuts filling it
    for a, (px, py) in ((0.4, (kx - 0.2, ky)), (-0.3, (kx + 0.25, ky + 0.1))):    # two pieces sticking out
        piece = box(0.5, 0.03, 0.3, 0, 0, 0)
        piece.apply_transform(ROT(a, (0, 0, 1))); piece.apply_transform(ROT(0.35, (1, 0, 0)))
        piece.apply_translation((px, py, 0.48))
        pl.append(piece)
    tx, ty = -5.5, 6.25                                                           # trimmed parts at the far end of the stacks
    pl.append(box(2.6, 0.9, 0.12, tx, ty, 0.06))                                  # a low pallet of finished parts
    for k in range(3):
        pl.append(plate([(tx - 1.1, ty - 0.35), (tx + 0.8, ty - 0.35), (tx + 1.1, ty - 0.05), (tx + 1.1, ty + 0.35), (tx - 0.8, ty + 0.35), (tx - 1.1, ty + 0.05)], 0.12 + k * 0.07, 0.06))
    blank = Polygon([(tx - 0.6, ty + 0.65), (tx + 0.6, ty + 0.65), (tx + 0.6, ty + 1.35), (tx - 0.6, ty + 1.35)]).difference(
        Polygon([(tx - 0.42, ty + 0.8), (tx + 0.42, ty + 0.8), (tx + 0.42, ty + 1.2), (tx - 0.42, ty + 1.2)]))
    pl.append(trimesh.creation.extrude_polygon(blank, 0.08))                      # a window frame blank, cut out
    return pl, st


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

    # materials on the ground: stacked wall panels on pallets
    for k in range(2):
        warm.append(box(3.0, 1.4, 0.14, -5.5, 3.0 + k * 1.8, 0.07))
        for j in range(4):
            plaster.append(box(2.8, 1.2, 0.14, -5.5, 3.0 + k * 1.8, 0.21 + j * 0.15))
    # FEAT-025a: the scaffolds are gone; two robot arms will build the module (their rigs, the
    # tool heads on the rack and the material hose are drawn by the viewer, newmodule/worksite.js)
    eq, eq_steel = worksite_equipment(L, W)
    plaster += eq
    black += eq_steel

    sx0 = W / 2 + 0.5                                                  # where the side scaffold stood (the lamp keeps its place)
    lamps = []
    # Smo: the leftmost lamp in the default view (free-standing in front of the side scaffold) removed
    # one work light left, standing clear of the scaffolds and the panel stacks, aimed at the site
    for i, (lx, ly, aim) in [(0, (sx0 + 3.2, -L / 2 - 3.0, 2.49))]:
        lamps += site_lamp(i, lx, ly, aim)
    return lamps + [("future/site_structure", cat(plaster), "plaster"),
            ("future/site_steel", cat(black), "linework"),
            ("future/site_timber", cat(warm), "plaster_warm")]
