"""
Rough arrangement, version 3.
Changes from v2 (Smo, 5 Oct 2026)
- Hub: one tall room instead of two storeys, clearly higher than the modules.
  Its cut works like a big stepped window that faces the inner corner between the two wings.
- Showroom roof: a jalousie of slats instead of a lid. Each slat is its own node with its own
  pivot ('showroom/louver_NN'), so the viewer can turn them open and closed in a wave.
Exports arrangement_v3.glb.
"""
import numpy as np
import trimesh
from shapely.geometry import Polygon, LineString
from build_station_v4 import (P, MAT, module, tube, stair, box, cyl, rod, U, D, I, cat, ROT, Part)
from showroom_options import shell_from, prism, interior, scaled, circle
from arrangement import a_frame, terrain, firepit, ellipse_poly
from vehicle import van
from flora import cacti
from construction import construction_site
from arrangement_v2 import (GAP, ARM_B_ANGLE, SHOW_A, SHOW_B, FACE_B, place, dir_tube, tube_hole, reserved_local)

HUB_R = 5.6
HUB_H = 8.6            # modules are 3.6 m tall, the hub stands well above them


def sector(r0, r1, a0, a1, n=24):
    """Ring sector outline between radii r0..r1 and angles a0..a1 (radians)."""
    t = np.linspace(a0, a1, n)
    outer = [(r1 * np.cos(a), r1 * np.sin(a)) for a in t]
    inner = [(r0 * np.cos(a), r0 * np.sin(a)) for a in t[::-1]]
    return outer + inner


def hub(cx, cy, fz, tcz, phi_b):
    R, H, cb, ct, wall = HUB_R, HUB_H, 0.9, 0.7, 0.2
    lift = fz - cb * 0.8
    f = cb * 0.8
    base = circle(R, 64)
    shell = U([shell_from(base, H, cb, ct, wall), prism(scaled(base, 0.8), f - 0.16, 0.16)])
    tz = tcz - lift
    holes = [tube_hole(R, 0.0, tz), tube_hole(R, phi_b, tz), box(1.1, 2.0, 2.4, -R, 0.0, f + 1.2)]
    shell = D(shell, U(holes))

    # stepped window towards the inner corner, the bisector of the two wings
    mid = phi_b / 2
    d = np.radians
    cut = [prism(sector(R - 1.2, R + 2, mid - d(15), mid + d(15)), f + 0.9, 20),           # deep centre, down to the parapet
           prism(sector(R - 1.2, R + 2, mid - d(26), mid + d(26)), f + 2.7, 20),           # shoulders above the tube tops
           prism(sector(1.2, R + 2, mid - d(26), mid + d(26)), H - ct - 0.35, 5)]          # roof opened deep towards the centre
    cutter = U(cut)
    items = [("hub/shell", D(shell, cutter), "plaster"), ("hub/ghost_shell", I(shell, cutter), "ghost")]

    # one tall room: round table, ring light hanging over it, a curved bench, a tall wall panel for the intro
    tx, ty = 0.6 * np.cos(mid), 0.6 * np.sin(mid)
    items.append(("hub/table", U([cyl(1.5, 0.06, tx, ty, f + 0.74, 64), cyl(0.4, 0.72, tx, ty, f + 0.36, 24)]), "plaster"))
    stools = [cyl(0.2, 0.44, tx + 2.05 * np.cos(a), ty + 2.05 * np.sin(a), f + 0.22, 20)
              for a in np.linspace(0, 2 * np.pi, 9, endpoint=False)]
    items.append(("hub/stools", U(stools), "plaster_warm"))
    ring = trimesh.creation.annulus(r_min=1.55, r_max=1.62, height=0.06, sections=64).apply_translation((tx, ty, f + 3.6))
    wires = [rod((tx + 1.58 * np.cos(a), ty + 1.58 * np.sin(a), f + 3.63), (tx + 0.2 * np.cos(a), ty + 0.2 * np.sin(a), H - 0.4), 0.006, 4)
             for a in (0.3, 2.4, 4.5)]
    items.append(("hub/ring_lamp", cat([ring] + wires), "linework"))
    # bench along the wall opposite the window, leaving the door free
    bench = D(prism(sector(R - wall - 0.65, R - wall - 0.05, mid + d(105), mid + d(165), 32), f, 0.44),
              box(2.0, 2.0, 2, -R, 0, f))
    items.append(("hub/bench", bench, "plaster_warm"))
    # tall intro panel standing free in the room, facing the window
    pa = mid + np.pi
    panel = box(3.2, 0.12, 4.2, 0, 0, 0)
    panel.apply_transform(ROT(pa + np.pi / 2, (0, 0, 1)))
    panel.apply_translation((2.9 * np.cos(pa), 2.9 * np.sin(pa), f + 2.1 + 0.25))
    foot = box(3.4, 0.5, 0.25, 0, 0, 0)
    foot.apply_transform(ROT(pa + np.pi / 2, (0, 0, 1)))
    foot.apply_translation((2.9 * np.cos(pa), 2.9 * np.sin(pa), f + 0.125))
    items.append(("hub/intro_panel", U([panel, foot]), "plaster"))
    frame_ = D(box(3.0, 0.02, 2.4), box(2.92, 0.1, 2.32))
    frame_.apply_transform(ROT(pa + np.pi / 2, (0, 0, 1)))
    frame_.apply_translation(((2.9 - 0.07) * np.cos(pa), (2.9 - 0.07) * np.sin(pa), f + 2.6))
    items.append(("hub/intro_frame", frame_, "linework"))
    # linear light strips across the ceiling, like the other modules
    strips = [box(2 * R - 3.0, 0.06, 0.03, 0, y, H - wall - 0.12) for y in (-2.0, -0.7, 0.6)]
    items.append(("hub/ceiling_lights", cat(strips), "lightstrip"))

    items = [(n, m.copy().apply_translation((cx, cy, lift)), mat) for n, m, mat in items]
    legs, skis = [], []
    for x in (-2.6, 2.6):
        l, s = a_frame(cx + x, cy, R - 1.5, lift + 0.05)
        legs.append(l); skis.append(s)
    items += [("hub/legs", U(legs), "plaster"), ("hub/skis", cat(skis), "plaster")]
    pt = Part()
    stair(pt, "hub", cx - R + 0.2, fz)
    items += [(n, m.copy().apply_translation((0, 0.6, 0)), mat) for n, m, mat in pt.items]
    return items


def showroom_local(fz, tcz):
    """Showroom in its own frame (long axis y, hub side +y). Walls full height,
    roof as a jalousie: returns (items, louvers) where louvers carry their own transforms."""
    a, b = SHOW_A, SHOW_B
    H, cb, ct, wall = 7.2, 1.0, 0.8, 0.2      # tall enough that the closed slats clear the rigging
    lift = fz - cb * 0.8
    f = cb * 0.8
    base = ellipse_poly(a, b, 12, np.pi / 12)
    full = U([shell_from(base, H, cb, ct, wall), prism(scaled(base, 0.9), f - 0.16, 0.16)])
    tz = tcz - lift
    r_in = P["tube_r"] - P["tube_wall"]
    holes = [trimesh.creation.cylinder(radius=r_in, height=3.0, sections=40)
             .apply_transform(ROT(np.pi / 2, (1, 0, 0))).apply_translation((0, s * b, tz)) for s in (-1, 1)]
    full = D(full, U(holes))
    walls = D(full, prism(scaled(base, wall), H - ct - 0.25, 2.0))     # open top
    items = [("showroom/shell", walls, "plaster")]
    screen = ellipse_poly(a - 1.5, b - 1.9, 12, np.pi / 12)
    for n, m, mat in interior(screen, f, 6.4 - wall - 0.6, towers=True):
        items.append((f"showroom/{n}", m, mat))

    # jalousie: slats across the short axis, pivoting on their long axis (local x)
    rim = Polygon(scaled(base, wall + 0.05))
    zc = H - ct - 0.15                       # just below the top rim
    slat_w, overlap, thick = 0.92, 0.06, 0.07
    pitch = slat_w - overlap
    ys = np.arange(-b + 0.9, b - 0.9 + 1e-6, pitch)
    louvers = []
    for k, y in enumerate(ys):
        seg = rim.intersection(LineString([(-a - 1, y), (a + 1, y)]))
        if seg.is_empty:
            continue
        x0, _, x1, _ = seg.bounds
        length = (x1 - x0) - 0.1
        if length < 0.8:
            continue
        slat = box(length, slat_w, thick)                 # centred on its own pivot
        slat = U([slat, box(length + 0.08, 0.05, 0.05, 0, 0, 0)])     # pivot rod showing at the ends
        T = np.eye(4); T[:3, 3] = ((x0 + x1) / 2, y, zc + lift)
        louvers.append((f"showroom/louver_{k:02d}", slat, "plaster", T))
    items = [(n, m.copy().apply_translation((0, 0, lift)), mat) for n, m, mat in items]
    legs, skis = [], []
    for y in (-6.2, -2.1, 2.1, 6.2):
        l, s = a_frame(0, y, a - 1.6, lift + 0.05, axis="x")
        legs.append(l); skis.append(s)
    items += [("showroom/legs", U(legs), "plaster"), ("showroom/skis", cat(skis), "plaster")]
    return items, louvers


def build():
    specs = P["modules"]
    total = sum(s["length"] for s in specs) + GAP * (len(specs) - 1)
    x = -total / 2
    centres = []
    for s in specs:
        centres.append(x + s["length"] / 2)
        x += s["length"] + GAP
    items, fz, tcz = [], None, None
    for i, (s, c) in enumerate(zip(specs, centres)):
        ends = {"left": "tube", "right": "tube" if i < len(specs) - 1 else "solid"}
        part, fz, tcz = module(P, s, c, ends)
        items += part.items
    for i in range(len(specs) - 1):
        a_end = centres[i] + specs[i]["length"] / 2 - P["wall"] * 0.5
        b_end = centres[i + 1] - specs[i + 1]["length"] / 2 + P["wall"] * 0.5
        items += tube(P, f"tube_{i + 1}", a_end, b_end, tcz, fz).items

    R = HUB_R
    left_end = centres[0] - specs[0]["length"] / 2
    hx, hy = left_end - GAP - R, 0.0
    phi = -np.radians(ARM_B_ANGLE)
    items += hub(hx, hy, fz, tcz, phi)
    items += tube(P, "tube_hub", hx + R - 0.1, left_end + P["wall"] * 0.5, tcz, fz).items

    d_show = R + GAP + FACE_B
    rot = phi + np.pi / 2
    sx, sy = hx + d_show * np.cos(phi), hy + d_show * np.sin(phi)
    s_items, louvers = showroom_local(fz, tcz)
    items += place(s_items, rot, sx, sy)
    Pm = ROT(rot, (0, 0, 1)); Pm[:3, 3] = (sx, sy, 0)
    louvers = [(n, m, mat, Pm @ T) for n, m, mat, T in louvers]
    items += dir_tube("tube_showroom", R - 0.1, R + GAP + 0.1, hx, hy, phi, tcz, fz)

    d_fut = d_show + FACE_B + GAP + 5.0
    items += place(construction_site(fz), rot, hx + d_fut * np.cos(phi), hy + d_fut * np.sin(phi))
    items += dir_tube("tube_future", d_show + FACE_B - 0.1, d_fut - 5.0, hx, hy, phi, tcz, fz)

    # camp at the cliff edge, well away from the buildings: van facing the view, firepit beside it
    camp_x = centres[-1] + specs[-1]["length"] / 2 + 9.0
    items += van(camp_x, 6.3, heading=np.radians(80))
    items += firepit(camp_x - 3.6, 8.4)
    # a few cacti, sparse, in the empty ground behind the office and workshop
    items += cacti([("candelabra", 5.0, -15.0, 4.2, 1), ("saguaro", 17.0, -24.0, 5.0, 2)])
    lo = np.min([m.bounds[0] for _, m, _ in items], axis=0)
    hi = np.max([m.bounds[1] for _, m, _ in items], axis=0)
    items += terrain(lo[0] - 8, hi[0] + 8, lo[1] - 8, 11.0)
    return items, louvers


def export(items, louvers, path):
    YUP = ROT(-np.pi / 2, (1, 0, 0))                 # z-up model to glTF y-up
    scene = trimesh.Scene()
    for name, mesh, mat in items:
        m = mesh.copy()
        m.merge_vertices()
        m.apply_transform(YUP)
        m = trimesh.graph.smooth_shade(m, angle=np.radians(32))
        m.visual = trimesh.visual.TextureVisuals(material=MAT[mat])
        scene.add_geometry(m, node_name=name, geom_name=name)
    for name, mesh, mat, T in louvers:
        m = mesh.copy()
        m.merge_vertices()
        m = trimesh.graph.smooth_shade(m, angle=np.radians(32))
        m.visual = trimesh.visual.TextureVisuals(material=MAT[mat])
        scene.add_geometry(m, node_name=name, geom_name=name, transform=YUP @ T)
    scene.export(path, include_normals=True)
    return sum(len(m.faces) for _, m, _ in items) + sum(len(m.faces) for _, m, _, _ in louvers)


if __name__ == "__main__":
    items, louvers = build()
    print("louvers:", len(louvers))
    print("exported arrangement_v3.glb triangles:", export(items, louvers, "arrangement_v3.glb"))
