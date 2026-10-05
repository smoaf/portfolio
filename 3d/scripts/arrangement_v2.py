"""
Rough arrangement, version 2.
Changes from v1 (Smo, 5 Oct 2026)
- Hub larger: radius 5.6 m (was 4.6 m).
- Arm B (showroom and the future slot) leaves the hub at less than 90 degrees to arm A,
  so it swings in behind the library. Angle set by ARM_B_ANGLE.
- Showroom: walls full height, ceiling completely open. The roof is a separate lid
  (showroom/roof) that the viewer can lower onto it with a click.
- Showroom rigging stands on floor towers instead of hanging from a roof.
Exports arrangement_v2.glb.
"""
import numpy as np
import trimesh
from build_station_v4 import (P, module, tube, stair, box, cyl, rod, U, D, I, cat, export, ROT, Part)
from showroom_options import shell_from, prism, interior, scaled, circle
from arrangement import a_frame, terrain, van, firepit, ellipse_poly

GAP = P["gap"]
HUB_R = 5.6
ARM_B_ANGLE = 60.0          # degrees between arm A (towards the library) and arm B (towards the showroom)
SHOW_A, SHOW_B = 5.9, 9.6   # showroom half width and half length (twelve-sided oval)
FACE_B = SHOW_B * np.sin(np.radians(75))   # distance from showroom centre to its end faces


def place(items, angle, dx, dy):
    """Rotate a group of items around the origin, then move it."""
    T = ROT(angle, (0, 0, 1)); T[:3, 3] = (dx, dy, 0)
    return [(n, m.copy().apply_transform(T), mat) for n, m, mat in items]


def dir_tube(name, d0, d1, ox, oy, phi, cz, fz):
    """Tube from distance d0 to d1 along direction phi, starting at (ox, oy)."""
    return place(tube(P, name, d0, d1, cz, fz).items, phi, ox, oy)


def tube_hole(R, angle, z, length=2.4):
    r_in = P["tube_r"] - P["tube_wall"]
    h = trimesh.creation.cylinder(radius=r_in, height=length, sections=40)
    h.apply_transform(ROT(np.pi / 2, (0, 1, 0)))
    h.apply_translation((R, 0, z))
    h.apply_transform(ROT(angle, (0, 0, 1)))
    return h


def hub(cx, cy, fz, tcz, phi_b):
    R, H, cb, ct, wall = HUB_R, 7.4, 0.9, 0.6, 0.2
    lift = fz - cb * 0.8
    f = cb * 0.8
    base = circle(R, 56)
    shell = U([shell_from(base, H, cb, ct, wall), prism(scaled(base, 0.8), f - 0.16, 0.16)])
    tz = tcz - lift
    holes = [tube_hole(R, 0.0, tz), tube_hole(R, phi_b, tz), box(1.1, 2.0, 2.1, -R, 0.0, f + 1.05)]
    shell = D(shell, U(holes))
    cutter = box(30, 20, 30, 0, 0.6 + 10, f + 1.0 + 15)
    items = [("hub/shell", D(shell, cutter), "plaster"), ("hub/ghost_shell", I(shell, cutter), "ghost")]
    # mezzanine over the back half, spiral stair up to it, a big round table
    ri = 2.8
    mezz = D(D(prism(circle(R - wall - 0.05, 56), f + 3.5, 0.2), prism(circle(ri, 56), f + 3.0, 1.0)),
             box(30, 10, 10, 0, 5.0 + 0.4, f + 3.5))
    items.append(("hub/mezzanine", mezz, "plaster"))
    rail = [rod((ri * np.cos(a), ri * np.sin(a), f + 3.7), (ri * np.cos(a), ri * np.sin(a), f + 4.65), 0.012, 6)
            for a in np.linspace(np.pi * 1.05, np.pi * 1.95, 9)]
    pts = [(ri * np.cos(a), ri * np.sin(a), f + 4.65) for a in np.linspace(np.pi * 1.05, np.pi * 1.95, 25)]
    rail += [rod(pts[i], pts[i + 1], 0.015, 6) for i in range(len(pts) - 1)]
    items.append(("hub/mezzanine_rail", cat(rail), "linework"))
    sc = (-2.9, -2.6)
    steps = [cyl(0.1, 3.7, sc[0], sc[1], f + 1.85, 16)]
    for i in range(17):
        a = i * (np.pi * 1.45 / 17) + 1.2
        st = box(1.0, 0.35, 0.05)
        st.apply_translation((0.6, 0, 0))
        st.apply_transform(ROT(a, (0, 0, 1)))
        st.apply_translation((sc[0], sc[1], f + 0.205 * (i + 1)))
        steps.append(st)
    items.append(("hub/stair", U(steps), "plaster"))
    tx, ty = 1.2, 0.8
    items.append(("hub/table", U([cyl(1.4, 0.06, tx, ty, f + 0.74, 56), cyl(0.38, 0.72, tx, ty, f + 0.36, 24)]), "plaster"))
    stools = [cyl(0.2, 0.42, tx + 1.9 * np.cos(a), ty + 1.9 * np.sin(a), f + 0.21, 20)
              for a in np.linspace(0, 2 * np.pi, 8, endpoint=False)]
    items.append(("hub/stools", U(stools), "plaster_warm"))
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
    """Showroom in its own frame: long axis along y, hub side at +y. Roof open, lid separate."""
    a, b = SHOW_A, SHOW_B
    H, cb, ct, wall = 6.4, 1.0, 0.8, 0.2
    lift = fz - cb * 0.8
    f = cb * 0.8
    base = ellipse_poly(a, b, 12, np.pi / 12)
    full = U([shell_from(base, H, cb, ct, wall), prism(scaled(base, 0.9), f - 0.16, 0.16)])
    tz = tcz - lift
    r_in = P["tube_r"] - P["tube_wall"]
    holes = [trimesh.creation.cylinder(radius=r_in, height=3.0, sections=40)
             .apply_transform(ROT(np.pi / 2, (1, 0, 0))).apply_translation((0, s * b, tz)) for s in (-1, 1)]
    full = D(full, U(holes))
    # open ceiling: everything inside the wall line above the top chamfer goes into the lid
    roof_zone = prism(scaled(base, wall), H - ct - 0.25, 2.0)
    walls = D(full, roof_zone)
    lid = I(full, roof_zone)
    items = [("showroom/shell", walls, "plaster"), ("showroom/roof", lid, "plaster")]
    screen = ellipse_poly(a - 1.5, b - 1.9, 12, np.pi / 12)
    for n, m, mat in interior(screen, f, H - wall - 0.6, towers=True):
        items.append((f"showroom/{n}", m, mat))
    items = [(n, m.copy().apply_translation((0, 0, lift)), mat) for n, m, mat in items]
    legs, skis = [], []
    for y in (-6.2, -2.1, 2.1, 6.2):
        l, s = a_frame(0, y, a - 1.6, lift + 0.05, axis="x")
        legs.append(l); skis.append(s)
    items += [("showroom/legs", U(legs), "plaster"), ("showroom/skis", cat(skis), "plaster")]
    return items


def reserved_local(fz, length=10.0, width=5.8, height=3.6):
    x0, x1, y0, y1 = -width / 2, width / 2, -length / 2, length / 2
    z0, z1 = fz - 1.0, fz - 1.0 + height
    c = [(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
    edges = [rod(c[i], c[j], 0.025, 6) for i in range(8) for j in range(i + 1, 8)
             if (np.abs(np.array(c[i]) - np.array(c[j])) > 1e-6).sum() == 1]
    return [("future/outline", cat(edges), "linework"), ("future/footprint", box(width, length, 0.02, 0, 0, 0.01), "plaster_warm")]


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
    phi = -np.radians(ARM_B_ANGLE)                  # arm B direction, measured from arm A
    items += hub(hx, hy, fz, tcz, phi)
    items += tube(P, "tube_hub", hx + R - 0.1, left_end + P["wall"] * 0.5, tcz, fz).items

    d_show = R + GAP + FACE_B
    rot = phi + np.pi / 2                           # local -y of the showroom points along arm B
    sx, sy = hx + d_show * np.cos(phi), hy + d_show * np.sin(phi)
    items += place(showroom_local(fz, tcz), rot, sx, sy)
    items += dir_tube("tube_showroom", R - 0.1, R + GAP + 0.1, hx, hy, phi, tcz, fz)

    d_fut = d_show + FACE_B + GAP + 5.0
    items += place(reserved_local(fz), rot, hx + d_fut * np.cos(phi), hy + d_fut * np.sin(phi))
    items += dir_tube("tube_future", d_show + FACE_B - 0.1, d_fut - 5.0, hx, hy, phi, tcz, fz)

    lo = np.min([m.bounds[0] for _, m, _ in items], axis=0)
    hi = np.max([m.bounds[1] for _, m, _ in items], axis=0)
    items += terrain(lo[0] - 9, hi[0] + 9, lo[1] - 9, 11.0)
    items += van(-4.0, 7.2, heading=0.15)
    items += firepit(6.5, 8.2)
    return items


if __name__ == "__main__":
    items = build()
    print("exported arrangement_v2.glb triangles:", export(items, "arrangement_v2.glb"))
