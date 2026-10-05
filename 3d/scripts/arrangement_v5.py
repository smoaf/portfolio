"""
Rough arrangement, version 5 (Smo, 5 Oct 2026)
Changes from v4:
- The rock that sat on the module under construction moves out beyond the hub, to the right of
  all buildings in the default view, with a desert bush next to it.
- Hub lower again: walls 4.9 m and a flatter dome, top about 7.5 m above ground.
- The two cacti are back (removing them was a misreading); the desert bushes stay.
- Van and firepit back at their arrangement 03 positions at the cliff edge beyond the workshop.

Version 4 notes:
- Van and firepit move towards the back centre, but not all the way, and a little to the left
  of the default view (towards +x).
- Showroom: a continuous window band around its walls, filled with vertical fins. The fins
  turn open or closed together with the roof slats ('showroom/fin_NNN', own pivots).
- Hub: lower than the showroom, still taller than the modules. Same round shape. Plaster wall
  only up to hip height, glass above and a glass dome, both with a calm black frame (mullions,
  one transom, radial ribs, two rings). Plaster collars where the tubes come in, a frame at the door.
- Plants: the cacti go. Low desert bushes in the far corner behind the workshop, and a
  different kind of plant (agave-like rosettes) in front, between the hub and the library.
Exports arrangement_v5.glb.
"""
import numpy as np
import trimesh
from build_station_v4 import (P, MAT, module, tube, stair, box, cyl, rod, U, D, I, cat, ROT, Part)
from trimesh.visual.material import PBRMaterial
from showroom_options import shell_from, prism, interior, scaled, circle
from arrangement import a_frame, terrain, firepit, ellipse_poly, ROCKS
from arrangement_v2 import GAP, ARM_B_ANGLE, SHOW_A, SHOW_B, FACE_B, place, dir_tube, tube_hole
from arrangement_v3 import sector, export as export_v3
from vehicle import van
from flora import desert_bush, agave, cacti
from construction import construction_site

MAT["glass"] = PBRMaterial(name="glass", baseColorFactor=[0.86, 0.9, 0.92, 0.18], metallicFactor=0.0,
                           roughnessFactor=0.08, alphaMode="BLEND")

MAT["flame"] = PBRMaterial(name="flame", baseColorFactor=[1.0, 0.62, 0.25, 1.0], metallicFactor=0.0, roughnessFactor=1.0)


def flames(x, y, seed=7):
    """A few twisted tongues of fire for the pit. The viewer shows them only at night."""
    rng = np.random.default_rng(seed)
    parts = []
    for k in range(7):
        a = 2 * np.pi * k / 7 + rng.uniform(-0.3, 0.3)
        r = rng.uniform(0.05, 0.25)
        h = rng.uniform(0.45, 0.95)
        c = trimesh.creation.cone(radius=rng.uniform(0.09, 0.16), height=h, sections=7)
        c.apply_transform(ROT(rng.uniform(-0.25, 0.25), (np.cos(a), np.sin(a), 0)))
        c.apply_translation((x + r * np.cos(a), y + r * np.sin(a), 0.22))
        parts.append(c)
    return cat(parts)


HUB_R = 5.4
HUB_H = 4.9          # with the flat dome the top is about 7.5 m: above the modules (5.9 m), well below the showroom (9.4 m)
SHOW_H = 7.2


def ring_rods(r, z, n, rad=0.02, a0=0.0, a1=2 * np.pi, closed=True):
    t = np.linspace(a0, a1, n + 1 if not closed else n + 1)
    pts = [(r * np.cos(a), r * np.sin(a), z) for a in t]
    return [rod(pts[i], pts[i + 1], rad, 6) for i in range(len(pts) - 1)]


def hub(cx, cy, fz, tcz, phi_b):
    R, H, cb, ct, wall = HUB_R, HUB_H, 0.9, 0.5, 0.2
    lift = fz - cb * 0.8
    f = cb * 0.8
    base = circle(R, 72)
    full = U([shell_from(base, H, cb, ct, wall), prism(scaled(base, 0.8), f - 0.16, 0.16)])
    tz = tcz - lift
    full = D(full, U([tube_hole(R, 0.0, tz), tube_hole(R, phi_b, tz), box(1.1, 2.0, 2.4, -R, 0.0, f + 1.2)]))
    full = D(full, prism(scaled(base, wall), H - ct - 0.2, 2.0))                 # open top for the dome

    # glass from hip height up: the plaster wall ends 1.0 m above the floor all round,
    # with plaster collars only where the tubes come in and a frame round the door
    z1, z2 = f + 1.0, H - ct - 0.35
    walls = D(full, prism(circle(R + 1.0, 72), z1, z2 - z1))
    r_in = P["tube_r"] - P["tube_wall"]

    def collar(angle, r_out, length):
        c = trimesh.creation.cylinder(radius=r_out, height=length, sections=40)
        c.apply_transform(ROT(np.pi / 2, (0, 1, 0)))
        c.apply_translation((R - 0.1, 0, tz))
        c.apply_transform(ROT(angle, (0, 0, 1)))
        return c
    collars = [D(collar(a, r_in + 0.28, 0.5), collar(a, r_in, 2.0)) for a in (0.0, phi_b)]
    door_frame = D(box(0.6, 1.6, 2.75, -R + 0.1, 0.0, f + 1.37), box(2.0, 1.1, 2.4, -R, 0.0, f + 1.2))
    walls = U([walls] + collars + [door_frame])
    items = [("hub/shell", walls, "plaster")]
    keep_out = U([collar(a, r_in + 0.28, 2.0) for a in (0.0, phi_b)] + [box(2.0, 1.6, 2.75, -R, 0.0, f + 1.37)])
    glass = D(D(prism(circle(R - 0.08, 72), z1, z2 - z1), prism(circle(R - 0.13, 72), z1 - 1, z2 - z1 + 2)), keep_out)
    items.append(("hub/glass_sides", glass, "glass"))

    # calm frame: mullions and one transom, nothing decorative
    rm = R - 0.1
    orn = []
    nb = 24
    zt = f + 2.75
    near_opening = lambda a: any(abs(np.angle(np.exp(1j * (a - s)))) < (r_in + 0.32) / R for s in (0.0, phi_b, np.pi))
    for k in range(nb):
        a = 2 * np.pi * k / nb
        z_start = zt if near_opening(a) else z1
        orn.append(rod((rm * np.cos(a), rm * np.sin(a), z_start), (rm * np.cos(a), rm * np.sin(a), z2), 0.03, 6))
    orn += ring_rods(rm, zt, 72, 0.022)
    items.append(("hub/glass_frame", cat(orn), "linework"))

    # glass dome with a quiet frame: radial ribs and two rings
    zb = H - ct - 0.2
    Rd, hd = R - 0.25, 0.95
    dome_z = lambda r: zb + hd * (1 - (r / Rd) ** 2)
    pts = []
    for r in np.linspace(0.02, Rd, 9):
        pts += [(r * np.cos(a), r * np.sin(a), dome_z(r)) for a in np.linspace(0, 2 * np.pi, 48, endpoint=False)]
    cap = trimesh.convex.convex_hull(np.array(pts + [(x, y, zb) for x, y in circle(Rd, 48)]))
    inner = cap.copy(); inner.apply_translation((0, 0, -0.05))
    items.append(("hub/glass_dome", D(cap, inner), "glass"))
    dz = []
    for r in (0.6, 2.6, Rd - 0.05):
        n = max(16, int(r * 10))
        t = np.linspace(0, 2 * np.pi, n + 1)
        pr = [(r * np.cos(a), r * np.sin(a), dome_z(r) + 0.02) for a in t]
        dz += [rod(pr[i], pr[i + 1], 0.03, 6) for i in range(n)]
    for k in range(nb):
        a = 2 * np.pi * k / nb
        rs = np.linspace(0.6, Rd - 0.05, 6)
        pr = [(r * np.cos(a), r * np.sin(a), dome_z(r) + 0.02) for r in rs]
        dz += [rod(pr[i], pr[i + 1], 0.026, 6) for i in range(len(pr) - 1)]
    items.append(("hub/dome_frame", cat(dz), "linework"))

    d = np.radians
    # interior: round table, ring lamp, curved bench, free-standing intro panel
    mid = phi_b / 2
    tx, ty = 0.5 * np.cos(mid), 0.5 * np.sin(mid)
    items.append(("hub/table", U([cyl(1.4, 0.06, tx, ty, f + 0.74, 64), cyl(0.38, 0.72, tx, ty, f + 0.36, 24)]), "plaster"))
    items.append(("hub/stools", U([cyl(0.2, 0.44, tx + 1.95 * np.cos(a), ty + 1.95 * np.sin(a), f + 0.22, 20)
                                    for a in np.linspace(0, 2 * np.pi, 9, endpoint=False)]), "plaster_warm"))
    ring = trimesh.creation.annulus(r_min=1.5, r_max=1.57, height=0.06, sections=64).apply_translation((tx, ty, f + 2.75))
    wires = [rod((tx + 1.53 * np.cos(a), ty + 1.53 * np.sin(a), f + 2.78), (tx, ty, H + 0.15), 0.006, 4) for a in (0.3, 2.4, 4.5)]
    items.append(("hub/ring_lamp", cat([ring] + wires), "linework"))
    bench = D(prism(sector(R - wall - 0.65, R - wall - 0.05, mid + d(105), mid + d(160), 32), f, 0.44), box(2.2, 2.2, 2, -R, 0, f))
    items.append(("hub/bench", bench, "plaster_warm"))
    pa = mid + np.pi
    panel = box(3.0, 0.12, 2.8); panel.apply_transform(ROT(pa + np.pi / 2, (0, 0, 1)))
    panel.apply_translation((2.7 * np.cos(pa), 2.7 * np.sin(pa), f + 1.4 + 0.25))
    foot = box(3.2, 0.5, 0.25); foot.apply_transform(ROT(pa + np.pi / 2, (0, 0, 1)))
    foot.apply_translation((2.7 * np.cos(pa), 2.7 * np.sin(pa), f + 0.125))
    items.append(("hub/intro_panel", U([panel, foot]), "plaster"))

    items = [(n, m.copy().apply_translation((cx, cy, lift)), mat) for n, m, mat in items]
    legs, skis = [], []
    for x in (-2.5, 2.5):
        l, s = a_frame(cx + x, cy, R - 1.5, lift + 0.05)
        legs.append(l); skis.append(s)
    items += [("hub/legs", U(legs), "plaster"), ("hub/skis", cat(skis), "plaster")]
    pt = Part()
    stair(pt, "hub", cx - R + 0.2, fz)
    items += [(n, m.copy().apply_translation((0, 0.6, 0)), mat) for n, m, mat in pt.items]
    return items


def showroom_local(fz, tcz):
    """Showroom in its own frame (long axis y, hub side +y). Open-top walls with a continuous
    window band of turning fins, roof of turning slats. Returns (items, movers with transforms)."""
    from shapely.geometry import Polygon, LineString
    a, b = SHOW_A, SHOW_B
    H, cb, ct, wall = SHOW_H, 1.0, 0.8, 0.2
    lift = fz - cb * 0.8
    f = cb * 0.8
    base = ellipse_poly(a, b, 12, np.pi / 12)
    full = U([shell_from(base, H, cb, ct, wall), prism(scaled(base, 0.9), f - 0.16, 0.16)])
    tz = tcz - lift
    r_in = P["tube_r"] - P["tube_wall"]
    holes = [trimesh.creation.cylinder(radius=r_in, height=3.0, sections=40)
             .apply_transform(ROT(np.pi / 2, (1, 0, 0))).apply_translation((0, s * b, tz)) for s in (-1, 1)]
    full = D(full, U(holes))
    walls = D(full, prism(scaled(base, wall), H - ct - 0.25, 2.0))

    # continuous window band, interrupted only by slim posts at the twelve corners
    z1, z2 = f + 3.8, H - ct - 0.1
    mid_ring = scaled(base, wall / 2)
    posts = []
    for (x, y) in base:
        p = box(0.3, 0.3, z2 - z1 + 0.2)
        p.apply_transform(ROT(np.arctan2(y, x), (0, 0, 1)))
        p.apply_translation((x * 0.985, y * 0.985, (z1 + z2) / 2))
        posts.append(p)
    band = D(prism(scaled(base, -1.0), z1, z2 - z1), U(posts))
    walls = D(walls, band)
    items = [("showroom/shell", walls, "plaster")]
    edge = []
    outer = scaled(base, -0.01)
    for z in (z1, z2):
        for i in range(len(outer)):
            p0, p1 = outer[i], outer[(i + 1) % len(outer)]
            edge.append(rod((p0[0], p0[1], z), (p1[0], p1[1], z), 0.025, 6))
    items.append(("showroom/window_frame", cat(edge), "linework"))

    screen = ellipse_poly(a - 1.5, b - 1.9, 12, np.pi / 12)
    for n, m, mat in interior(screen, f, 6.4 - wall - 0.6, towers=True):
        items.append((f"showroom/{n}", m, mat))

    movers = []
    # fins in the window band, pivoting on their vertical centre line
    k = 0
    for i in range(len(mid_ring)):
        p0, p1 = np.array(mid_ring[i]), np.array(mid_ring[(i + 1) % len(mid_ring)])
        seg = p1 - p0
        Ls = np.linalg.norm(seg)
        ang = np.arctan2(seg[1], seg[0])
        usable = Ls - 0.36
        n = max(1, int(round(usable / 0.62)))
        w = usable / n
        for j in range(n):
            c = p0 + seg / Ls * (0.18 + w * (j + 0.5))
            fin = box(w - 0.04, 0.05, z2 - z1 - 0.06)
            T = ROT(ang, (0, 0, 1)); T[:3, 3] = (c[0], c[1], (z1 + z2) / 2 + lift)
            movers.append((f"showroom/fin_{k:03d}", fin, "plaster", T))
            k += 1
    # roof slats across the short axis, pivoting on their long axis
    rim = Polygon(scaled(base, wall + 0.05))
    zc = H - ct - 0.15
    slat_w, overlap = 0.92, 0.06
    for k2, y in enumerate(np.arange(-b + 0.9, b - 0.9 + 1e-6, slat_w - overlap)):
        seg = rim.intersection(LineString([(-a - 1, y), (a + 1, y)]))
        if seg.is_empty:
            continue
        x0, _, x1, _ = seg.bounds
        length = (x1 - x0) - 0.1
        if length < 0.8:
            continue
        slat = U([box(length, slat_w, 0.07), box(length + 0.08, 0.05, 0.05)])
        T = np.eye(4); T[:3, 3] = ((x0 + x1) / 2, y, zc + lift)
        movers.append((f"showroom/louver_{k2:02d}", slat, "plaster", T))

    items = [(n, m.copy().apply_translation((0, 0, lift)), mat) for n, m, mat in items]
    legs, skis = [], []
    for y in (-6.2, -2.1, 2.1, 6.2):
        l, s = a_frame(0, y, a - 1.6, lift + 0.05, axis="x")
        legs.append(l); skis.append(s)
    items += [("showroom/legs", U(legs), "plaster"), ("showroom/skis", cat(skis), "plaster")]
    return items, movers


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
    s_items, movers = showroom_local(fz, tcz)
    items += place(s_items, rot, sx, sy)
    Pm = ROT(rot, (0, 0, 1)); Pm[:3, 3] = (sx, sy, 0)
    movers = [(n, m, mat, Pm @ T) for n, m, mat, T in movers]
    items += dir_tube("tube_showroom", R - 0.1, R + GAP + 0.1, hx, hy, phi, tcz, fz)

    d_fut = d_show + FACE_B + GAP + 5.0
    items += place(construction_site(fz), rot, hx + d_fut * np.cos(phi), hy + d_fut * np.sin(phi))
    items += dir_tube("tube_future", d_show + FACE_B - 0.1, d_fut - 5.0, hx, hy, phi, tcz, fz)

    # camp: moved back towards the centre of the plateau, behind office and workshop
    # camp back at its arrangement 03 place: cliff edge beyond the workshop
    camp_x = centres[-1] + specs[-1]["length"] / 2 + 9.0
    items += van(camp_x, 6.3, heading=np.radians(80))
    items += firepit(camp_x - 3.6, 8.4)
    items += [("firepit/flames", flames(camp_x - 3.6, 8.4), "flame")]
    items += cacti([("candelabra", 5.0, -15.0, 4.2, 1), ("saguaro", 17.0, -24.0, 5.0, 2)])
    # plants: desert bushes in the far corner behind the workshop, rosettes in front between hub and library
    items += [("flora/bush_00", desert_bush(24.0, -27.0, 1.6, 1), "plaster_warm"),
              ("flora/bush_01", desert_bush(27.5, -23.0, 1.1, 2), "plaster_warm"),
              ("flora/bush_02", desert_bush(21.5, -31.0, 1.3, 3), "plaster_warm"),
              ("flora/bush_03", desert_bush(hx - R - 6.8, -5.6, 1.3, 6), "plaster_warm"),
              ("flora/agave_00", agave(left_end - 2.6, 6.2, 1.25, 4), "plaster"),
              ("flora/agave_01", agave(left_end - 0.9, 7.8, 0.8, 5), "plaster")]
    lo = np.min([m.bounds[0] for _, m, _ in items], axis=0)
    hi = np.max([m.bounds[1] for _, m, _ in items], axis=0)
    # the rock that sat on the construction site moves out beyond the hub
    rocks = [r for r in ROCKS if (r[0], r[1]) != (-6, -24)] + [(hx - R - 8.6, -3.2, 1.2)]
    items += terrain(lo[0] - 8, hi[0] + 8, lo[1] - 8, 11.0, rocks_at=rocks)
    return items, movers


if __name__ == "__main__":
    items, movers = build()
    print("moving parts:", len(movers))
    print("exported arrangement_v5.glb triangles:", export_v3(items, movers, "arrangement_v5.glb"))
