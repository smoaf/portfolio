"""
Rough arrangement of the whole station (massing study).
L-shaped plan seen from above:
  arm A (along x):  hub at the corner, then library, office, workshop
  arm B (going back from the hub): showroom (twelve-sided oval), then a reserved
                    slot for a future module (museum and curation), drawn as an outline
The station stands on a plateau whose front edge drops off as a cliff. The camper van and the
firepit sit near the edge. Library, office and workshop are the detailed study 04 modules;
hub, showroom, van and firepit are rough massing.
Exports arrangement_v1.glb.
"""
import numpy as np
import trimesh
from build_station_v4 import (P, module, tube, stair, box, cyl, rod, U, D, I, cat, ski, export, ROT)
from showroom_options import shell_from, prism, interior, scaled, circle

GAP = P["gap"]


def ellipse_poly(a, b, n, phase):
    t = np.linspace(0, 2 * np.pi, n, endpoint=False) + phase
    return list(zip(a * np.cos(t), b * np.sin(t)))


def a_frame(x, y, spread, under, axis="y"):
    """A-frame with crossbar, feet on bowed skis. axis: direction the A spans."""
    legs, skis = [], []
    legs.append(cyl(0.34, 0.1, x, y, under - 0.03))
    ends = []
    for s in (-1, 1):
        if axis == "y":
            top, foot = np.array([x, y + s * 0.45, under - 0.15]), np.array([x, y + s * spread, 0.32])
        else:
            top, foot = np.array([x + s * 0.45, y, under - 0.15]), np.array([x + s * spread, y, 0.32])
        legs.append(rod(top, foot, 0.085, 16))
        legs.append(trimesh.creation.icosphere(subdivisions=2, radius=0.11).apply_translation(foot))
        legs.append(cyl(0.055, 0.2, foot[0], foot[1], 0.2, 12))
        ends.append(foot + (top - foot) * ((1.05 - 0.32) / (top[2] - 0.32)))
        sk = ski()
        if axis == "x":
            sk.apply_transform(ROT(np.pi / 2, (0, 0, 1)))
        sk.apply_translation((foot[0], foot[1], 0.05))
        skis.append(sk)
    legs.append(rod(ends[0], ends[1], 0.06, 12))
    bar = box(0.3, 1.2, 0.14) if axis == "y" else box(1.2, 0.3, 0.14)
    legs.append(bar.apply_translation((x, y, under - 0.1)))
    return U(legs), cat(skis)


def ytube(name, y0, y1, xc, cz, fz):
    items = []
    for n, m, mat in tube(P, name, y0, y1, cz, fz).items:
        m = m.copy()
        m.apply_transform(ROT(np.pi / 2, (0, 0, 1)))       # x axis -> y axis
        m.apply_translation((xc, 0, 0))
        items.append((n, m, mat))
    return items


def hub(cx, cy, fz, tcz):
    """Round double-height hub. Entrance stair on the outer side, tubes to library (+x) and showroom (-y)."""
    R, H, cb, ct, wall = 4.6, 7.2, 0.9, 0.6, 0.2
    lift = fz - cb * 0.8
    base = circle(R, 48)
    shell = U([shell_from(base, H, cb, ct, wall), prism(scaled(base, 0.8), cb * 0.8 - 0.16, 0.16)])
    tz = tcz - lift
    r_in = P["tube_r"] - P["tube_wall"]
    holes = [trimesh.creation.cylinder(radius=r_in, height=2.0, sections=40)
             .apply_transform(ROT(np.pi / 2, (0, 1, 0))).apply_translation((R, 0, tz)),
             trimesh.creation.cylinder(radius=r_in, height=2.0, sections=40)
             .apply_transform(ROT(np.pi / 2, (1, 0, 0))).apply_translation((0, -R, tz)),
             box(1.1, 2.0, 2.1, -R, 0.0, cb * 0.8 + 1.05)]                     # entrance door
    shell = D(shell, U(holes))
    cutter = box(30, 20, 30, 0, 0.6 + 10, cb * 0.8 + 1.0 + 15)
    items = [("hub/shell", D(shell, cutter), "plaster"), ("hub/ghost_shell", I(shell, cutter), "ghost")]
    f = cb * 0.8
    # mezzanine ring over the back half, spiral stair round a central column, big round table
    mezz = D(D(prism(circle(R - wall - 0.05, 48), f + 3.4, 0.2), prism(circle(2.2, 48), f + 3.0, 1.0)),
             box(20, 10, 10, 0, 5.0 + 0.4, f + 3.5))
    items.append(("hub/mezzanine", mezz, "plaster"))
    rail = [rod((2.2 * np.cos(a), 2.2 * np.sin(a), f + 3.6), (2.2 * np.cos(a), 2.2 * np.sin(a), f + 4.55), 0.012, 6)
            for a in np.linspace(np.pi, 2 * np.pi, 9)]
    pts = [(2.2 * np.cos(a), 2.2 * np.sin(a), f + 4.55) for a in np.linspace(np.pi, 2 * np.pi, 25)]
    rail += [rod(pts[i], pts[i + 1], 0.015, 6) for i in range(len(pts) - 1)]
    items.append(("hub/mezzanine_rail", cat(rail), "linework"))
    steps = [cyl(0.1, 3.6, -2.4, 0.6, f + 1.8, 16)]
    for i in range(16):
        a = i * (np.pi * 1.4 / 16) + 0.3
        st = box(1.0, 0.35, 0.05)
        st.apply_translation((0.6, 0, 0))
        st.apply_transform(ROT(a, (0, 0, 1)))
        st.apply_translation((-2.4, 0.6, f + 0.21 * (i + 1)))
        steps.append(st)
    items.append(("hub/stair", U(steps), "plaster"))
    items.append(("hub/table", U([cyl(1.3, 0.06, 0.8, -0.6, f + 0.74, 48), cyl(0.35, 0.72, 0.8, -0.6, f + 0.36, 24)]), "plaster"))
    stools = [cyl(0.2, 0.42, 0.8 + 1.75 * np.cos(a), -0.6 + 1.75 * np.sin(a), f + 0.21, 20) for a in np.linspace(0, 2 * np.pi, 7, endpoint=False)]
    items.append(("hub/stools", U(stools), "plaster_warm"))
    items = [(n, m.copy().apply_translation((cx, cy, lift)), mat) for n, m, mat in items]
    legs, skis = [], []
    for x in (-2.2, 2.2):
        l, s = a_frame(cx + x, cy, R - 1.3, lift + 0.05)
        legs.append(l); skis.append(s)
    items += [("hub/legs", U(legs), "plaster"), ("hub/skis", cat(skis), "plaster")]
    # entrance stair down from the door on the outer side
    sitems = []
    from build_station_v4 import Part
    pt = Part()
    stair(pt, "hub", cx - R + 0.2, fz)
    for n, m, mat in pt.items:
        m = m.copy(); m.apply_translation((0, 0.6, 0))
        sitems.append((n, m, mat))
    return items + sitems


def showroom(cx, cy, fz, tcz):
    """Twelve-sided oval, long axis along y, cut open towards +x (the station's inner corner)."""
    a, b = 5.9, 9.6
    H, cb, ct, wall = 6.2, 1.0, 0.8, 0.2
    lift = fz - cb * 0.8
    base = ellipse_poly(a, b, 12, np.pi / 12)
    shell = U([shell_from(base, H, cb, ct, wall), prism(scaled(base, 0.9), cb * 0.8 - 0.16, 0.16)])
    tz = tcz - lift
    r_in = P["tube_r"] - P["tube_wall"]
    holes = [trimesh.creation.cylinder(radius=r_in, height=3.0, sections=40)
             .apply_transform(ROT(np.pi / 2, (1, 0, 0))).apply_translation((0, s * b, tz)) for s in (-1, 1)]
    shell = D(shell, U(holes))
    cutter = box(20, 40, 30, 0.6 + 10, 0, cb * 0.8 + 1.0 + 15)
    items = [("showroom/shell", D(shell, cutter), "plaster"), ("showroom/ghost_shell", I(shell, cutter), "ghost")]
    screen = ellipse_poly(a - 1.5, b - 1.9, 12, np.pi / 12)
    for n, m, mat in interior(screen, cb * 0.8, H - wall - 0.6):
        if n in ("screen", "screen_edges"):
            m = D(m, cutter)
        items.append((f"showroom/{n}", m, mat))
    items = [(n, m.copy().apply_translation((cx, cy, lift)), mat) for n, m, mat in items]
    legs, skis = [], []
    for y in (-6.0, -2.0, 2.0, 6.0):
        l, s = a_frame(cx, cy + y, a - 1.6, lift + 0.05, axis="x")
        legs.append(l); skis.append(s)
    items += [("showroom/legs", U(legs), "plaster"), ("showroom/skis", cat(skis), "plaster")]
    return items


def reserved_slot(cx, cy, fz, length=10.0, width=5.8, height=3.6):
    """Outline of a future module: black edges and a faint footprint on the ground."""
    x0, x1 = cx - width / 2, cx + width / 2
    y0, y1 = cy - length / 2, cy + length / 2
    z0, z1 = fz - 1.0, fz - 1.0 + height
    c = [(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
    edges = []
    for i in range(8):
        for j in range(i + 1, 8):
            d = np.array(c[i]) - np.array(c[j])
            if (np.abs(d) > 1e-6).sum() == 1:
                edges.append(rod(c[i], c[j], 0.025, 6))
    foot = box(width, length, 0.02, cx, cy, 0.01)
    return [("future/outline", cat(edges), "linework"), ("future/footprint", foot, "plaster_warm")]


ROCKS = [(-30, 4, 1.4), (-27, 6.5, 0.9), (12, 5.5, 1.1), (18, -12, 1.6), (-6, -24, 1.2), (8, -30, 1.0)]


def terrain(x0, x1, y0, edge_y, rocks_at=None):
    """Plateau block, front face is the cliff edge, with strata grooves cut into it."""
    g = box(x1 - x0, edge_y - y0, 8.0, (x0 + x1) / 2, (y0 + edge_y) / 2, -4.0)
    grooves = [box(x1 - x0 + 2, 0.5, 0.12, (x0 + x1) / 2, edge_y, z) for z in (-0.9, -2.1, -2.6, -3.9, -5.4, -6.2)]
    g = D(g, U(grooves))
    rocks = []
    rng = np.random.default_rng(3)
    for (x, y, s) in (rocks_at or ROCKS):
        r = trimesh.creation.icosphere(subdivisions=1, radius=s)
        r.apply_scale((1.0, 0.8, 0.45))
        r.apply_transform(ROT(rng.uniform(0, 3), (0, 0, 1)))
        r.apply_translation((x, y, s * 0.2))
        rocks.append(r)
    return [("terrain/plateau", g, "ground"), ("terrain/rocks", U(rocks), "plaster")]


def van(x, y, heading=0.0):
    """Boxy 1980s camper van, rough massing, unbranded."""
    body = U([box(4.0, 2.0, 2.2, -0.45, 0, 0.55 + 1.1),        # box body
              box(1.0, 1.9, 1.1, 1.95, 0, 0.55 + 0.55),         # short bonnet
              box(0.7, 1.95, 1.0, 1.35, 0, 0.55 + 1.5)])        # cab front
    glass = [box(0.04, 1.6, 0.6, 1.71, 0, 0.55 + 1.65), box(0.8, 0.04, 0.5, 1.2, 1.0, 0.55 + 1.7),
             box(0.8, 0.04, 0.5, 1.2, -1.0, 0.55 + 1.7), box(1.2, 0.04, 0.5, -0.8, 1.0, 0.55 + 1.6)]
    wheels = []
    for wx in (-1.5, 1.6):
        for wy in (-0.92, 0.92):
            w = trimesh.creation.cylinder(radius=0.36, height=0.25, sections=24)
            w.apply_transform(ROT(np.pi / 2, (1, 0, 0)))
            w.apply_translation((wx, wy, 0.36))
            wheels.append(w)
    T = ROT(heading, (0, 0, 1)); T[:3, 3] = (x, y, 0)
    return [("van/body", body.apply_transform(T), "plaster"),
            ("van/windows", cat(glass).apply_transform(T), "linework"),
            ("van/wheels", U(wheels).apply_transform(T), "linework")]


def firepit(x, y):
    ring = trimesh.creation.annulus(r_min=0.45, r_max=0.62, height=0.3, sections=32).apply_translation((x, y, 0.15))
    logs = [rod((x - 0.3, y - 0.1, 0.12), (x + 0.3, y + 0.1, 0.25), 0.06, 8), rod((x - 0.2, y + 0.25, 0.12), (x + 0.15, y - 0.25, 0.25), 0.06, 8)]
    seats = []
    for a in (np.pi * 0.85, np.pi * 1.25):
        sx, sy = x + 1.6 * np.cos(a), y + 1.6 * np.sin(a)
        s = U([box(0.55, 0.5, 0.06, 0, 0, 0.4), box(0.06, 0.5, 0.45, -0.25, 0, 0.62)] +
              [box(0.04, 0.04, 0.4, dx, dy, 0.2) for dx in (-0.22, 0.22) for dy in (-0.2, 0.2)])
        s.apply_transform(ROT(a + np.pi, (0, 0, 1)))
        s.apply_translation((sx, sy, 0))
        seats.append(s)
    return [("firepit/ring", ring, "plaster"), ("firepit/logs", cat(logs), "plaster_warm"), ("firepit/seats", U(seats), "plaster")]


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

    left_end = centres[0] - specs[0]["length"] / 2
    R = 4.6
    hx = left_end - GAP - R
    items += hub(hx, 0.0, fz, tcz)
    items += tube(P, "tube_hub", hx + R - 0.1, left_end + P["wall"] * 0.5, tcz, fz).items

    fb = 9.6 * np.sin(np.radians(75))          # end face of the twelve-sided oval
    sy = -(R + GAP + fb)
    items += showroom(hx, sy, fz, tcz)
    items += ytube("tube_showroom", -R - GAP - 0.1, -R + 0.1, hx, tcz, fz)

    fy = sy - fb - GAP - 5.0
    items += ytube("tube_future", fy + 5.0, sy - fb + 0.1, hx, tcz, fz)
    items += reserved_slot(hx, fy, fz)

    items += terrain(hx - 14, centres[-1] + 12, fy - 9, 11.0)
    items += van(-4.0, 7.2, heading=0.15)
    items += firepit(6.5, 8.2)
    return items


if __name__ == "__main__":
    items = build()
    print("exported arrangement_v1.glb triangles:", export(items, "arrangement_v1.glb"))
