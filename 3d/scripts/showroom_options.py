"""
Showroom shape options (massing study).
Four shells with the same interior, placed side by side, left to right as seen from the front:
  A  drum         round, chamfered top and bottom edges
  B  faceted      twelve-sided, the module language scaled up
  C  oval         stretched stadium plan, closest to the module proportions
  D  dome         low drum with a shallow dome, planetarium-like
Interior in each: 360 degree screen ring, speaker rigging for an immersive (Atmos-style)
system with an outer ring and an overhead ring, projectors, and plaster sculptures in the
middle for projection mapping. Exports showroom_options.glb.
"""
import numpy as np
import trimesh
from shapely.geometry import Polygon, Point
from build_station_v3 import (P, box, cyl, rod, U, D, I, cat, ski, ROT, export)

LIFT = P["lift"]


def ring_pts(outline, z):
    return [(x, y, z) for x, y in outline]


def circle(r, n=64):
    a = np.linspace(0, 2 * np.pi, n, endpoint=False)
    return list(zip(r * np.cos(a), r * np.sin(a)))


def stadium(length, width, n=24):
    r = width / 2
    s = length / 2 - r
    pts = []
    for a in np.linspace(-np.pi / 2, np.pi / 2, n):
        pts.append((s + r * np.cos(a), r * np.sin(a)))
    for a in np.linspace(np.pi / 2, 3 * np.pi / 2, n):
        pts.append((-s + r * np.cos(a), r * np.sin(a)))
    return pts


def scaled(outline, d):
    """Offset an outline inwards by d (works for convex outlines)."""
    poly = Polygon(outline).buffer(-d, join_style=2)
    return list(poly.exterior.coords)[:-1]


def hull_body(outline_fn, H, cb, ct):
    """Convex body: tapered underside (cb), straight wall, chamfered top (ct)."""
    pts = ring_pts(outline_fn(-cb), 0) + ring_pts(outline_fn(0), cb) + \
          ring_pts(outline_fn(0), H - ct) + ring_pts(outline_fn(-ct), H)
    return trimesh.convex.convex_hull(np.array(pts))


def make_outline(base):
    return lambda d: base if d == 0 else (scaled(base, -d) if d < 0 else base)


def shell_from(base, H, cb, ct, wall):
    outer = trimesh.convex.convex_hull(np.array(
        ring_pts(scaled(base, cb), 0) + ring_pts(base, cb) + ring_pts(base, H - ct) + ring_pts(scaled(base, ct), H)))
    ib = scaled(base, wall)
    inner = trimesh.convex.convex_hull(np.array(
        ring_pts(scaled(ib, cb * 0.9), wall) + ring_pts(ib, cb) + ring_pts(ib, H - ct) + ring_pts(scaled(ib, ct * 0.9), H - wall)))
    return D(outer, inner)


def dome_shell(R, ring_h, dome_h, wall):
    def body(r, h0, hd, z0):
        pts = ring_pts(circle(r * 0.9), z0) + ring_pts(circle(r), z0 + 0.8)
        for k, f in enumerate(np.linspace(0, 1, 9)):
            ang = f * np.pi / 2
            pts += ring_pts(circle(max(r * np.cos(ang), 0.05)), z0 + h0 + hd * np.sin(ang))
        return trimesh.convex.convex_hull(np.array(pts))
    return D(body(R, ring_h, dome_h, 0), body(R - wall, ring_h - wall, dome_h - wall, wall))


def prism(outline, z0, h):
    m = trimesh.creation.extrude_polygon(Polygon(outline), h)
    m.apply_translation((0, 0, z0))
    return m


def interior(screen_outline, fz, top, roof_at=None, towers=False):
    """towers=True: rigging stands on floor towers behind the screen instead of hanging from the roof."""
    """Shared showroom kit, centred on the origin. Returns list of (name, mesh, material)."""
    out = []
    # 360 degree screen: thin ring, black edges top and bottom
    sz0, sh = fz + 0.5, 3.0
    ring = D(prism(screen_outline, sz0, sh), prism(scaled(screen_outline, 0.05), sz0 - 1, sh + 2))
    out.append(("screen", ring, "plaster_warm"))
    edges = []
    for z in (sz0, sz0 + sh):
        edges.append(D(prism(scaled(screen_outline, -0.03), z - 0.03, 0.06), prism(scaled(screen_outline, 0.03), z - 1, 2)))
    out.append(("screen_edges", U(edges), "linework"))
    # rigging: outer truss ring above the screen, inner overhead ring, spokes, hangers
    rz = min(sz0 + sh + 0.8, top - 0.6)
    outer = scaled(screen_outline, 0.6)
    inner = scaled(screen_outline, 2.6) if Polygon(screen_outline).area > 60 else scaled(screen_outline, 1.8)
    truss = []
    for ol, zz in ((outer, rz), (inner, rz + 0.35)):
        for dz in (0, 0.3):
            pts = [np.array([x, y, zz + dz]) for x, y in ol] + [np.array([ol[0][0], ol[0][1], zz + dz])]
            step = max(1, len(pts) // 48)
            pts = pts[::step] + [pts[-1]]
            truss += [rod(pts[i], pts[i + 1], 0.03, 6) for i in range(len(pts) - 1)]
        for k in range(0, len(ol), max(1, len(ol) // 16)):
            x, y = ol[k]
            truss.append(rod((x, y, zz), (x, y, zz + 0.3), 0.02, 6))
            if not towers:
                ztop = roof_at(x, y) if roof_at else top
                truss.append(rod((x, y, zz + 0.3), (x, y, ztop), 0.01, 6))      # hanger to the roof
    for k in range(0, len(outer), max(1, len(outer) // 6)):
        ox, oy = outer[k]
        p = Point(ox, oy)
        ix, iy = min(inner, key=lambda q: (q[0] - ox) ** 2 + (q[1] - oy) ** 2)
        truss.append(rod((ox, oy, rz + 0.3), (ix, iy, rz + 0.65), 0.03, 6))
    if towers:
        # ground-support towers between screen and wall, arms reaching over the screen to the ring
        behind = scaled(screen_outline, -0.45)
        n_t = len(behind)
        for k in range(0, n_t, max(1, n_t // 8)):
            bx, by = behind[k]
            ox_, oy_ = min(outer, key=lambda q: (q[0] - bx) ** 2 + (q[1] - by) ** 2)
            for dx, dy in ((-0.12, -0.12), (0.12, 0.12), (-0.12, 0.12), (0.12, -0.12)):
                truss.append(rod((bx + dx, by + dy, fz), (bx + dx, by + dy, rz + 0.3), 0.018, 6))
            for zz in np.arange(fz + 0.6, rz, 0.6):
                truss.append(rod((bx - 0.12, by - 0.12, zz), (bx + 0.12, by + 0.12, zz + 0.3), 0.01, 4))
            truss.append(rod((bx, by, rz + 0.3), (ox_, oy_, rz + 0.3), 0.03, 6))
            truss.append(rod((bx, by, rz), (ox_, oy_, rz), 0.03, 6))
    out.append(("rigging", cat(truss), "linework"))
    # speakers: on the outer ring aimed inwards, on the inner ring aimed down, subwoofers on the floor
    spk = []
    for k in range(0, len(outer), max(1, len(outer) // 16)):
        x, y = outer[k]
        s = box(0.28, 0.22, 0.4, 0, 0, 0)
        s.apply_transform(ROT(np.arctan2(y, x) + np.pi / 2, (0, 0, 1)))
        s.apply_translation((x * 0.97, y * 0.97, rz - 0.25))
        spk.append(s)
    for k in range(0, len(inner), max(1, len(inner) // 6)):
        x, y = inner[k]
        spk.append(box(0.3, 0.3, 0.25, x, y, rz + 0.2))
    for x, y in scaled(screen_outline, 0.5)[:: max(1, len(screen_outline) // 4)]:
        spk.append(box(0.55, 0.55, 0.5, x, y, fz + 0.25))
    out.append(("speakers", U(spk), "linework"))
    # projectors on the inner ring, aimed at the centre
    proj = []
    for k in range(0, len(inner), max(1, len(inner) // 4)):
        x, y = inner[k]
        proj.append(box(0.45, 0.35, 0.18, x * 0.9, y * 0.9, rz + 0.12))
    out.append(("projectors", U(proj), "plaster"))
    # sculptures for projection mapping, plaster, on low plinths
    sc = []
    ico = trimesh.creation.icosphere(subdivisions=0, radius=0.85)
    ico.apply_translation((-1.0, 0.4, fz + 0.35 + 0.85))
    sc += [ico, cyl(0.7, 0.35, -1.0, 0.4, fz + 0.175, 6)]
    for k, s in enumerate((1.0, 0.75, 0.5)):
        c = box(s, s, s)
        c.apply_transform(ROT(0.4 * k, (0, 0, 1)))
        c.apply_translation((1.2, -0.6, fz + 0.2 + sum((1.0, 0.75, 0.5)[:k]) + s / 2))
        sc.append(c)
    sc.append(box(1.3, 1.3, 0.2, 1.2, -0.6, fz + 0.1))
    wedge = trimesh.convex.convex_hull(np.array([(-0.35, -0.35, 0), (0.35, -0.35, 0), (0.35, 0.35, 0), (-0.35, 0.35, 0),
                                                 (-0.05, 0.12, 2.6), (0.08, 0.05, 2.6)]))
    wedge.apply_translation((0.4, 1.3, fz))
    sc.append(wedge)
    half = trimesh.creation.icosphere(subdivisions=3, radius=0.7)
    half = I(half, box(2, 2, 1, 0, 0, 0.5))
    half.apply_translation((-0.4, -1.4, fz))
    sc.append(half)
    out.append(("sculptures", U(sc), "plaster"))
    # two low curved benches near the screen
    for a in (np.pi * 0.85, np.pi * 1.15):
        b = box(2.0, 0.5, 0.42)
        b.apply_transform(ROT(a + np.pi / 2, (0, 0, 1)))
        b.apply_translation((3.0 * np.cos(a), 3.0 * np.sin(a), fz + 0.21))
        out.append(("bench", b, "plaster"))
    return out


def stilts(xs, spread):
    legs, skis = [], []
    under = LIFT + 0.02
    for lx in xs:
        legs.append(cyl(0.34, 0.1, lx, 0, under - 0.03))
        legs.append(box(0.3, 1.2, 0.14, lx, 0, under - 0.1))
        for fy in (-spread, 0.0, spread):
            top = np.array([lx, np.sign(fy) * 0.45, under - 0.15])
            foot = np.array([lx, fy, 0.32])
            legs.append(rod(top, foot, 0.085 if fy else 0.07, 16))
            legs.append(trimesh.creation.icosphere(subdivisions=2, radius=0.11).apply_translation(foot))
            legs.append(cyl(0.055, 0.2, lx, fy, 0.2, 12))
            s = ski()
            s.apply_translation((lx, fy, 0.05))
            skis.append(s)
    return U(legs), cat(skis)


def option(tag, cx):
    wall, cb = 0.2, 1.0
    if tag == "A":                                   # drum
        base = circle(7.0, 72)
        H, ct = 6.2, 0.7
        shell = shell_from(base, H, cb, ct, wall)
        screen = circle(5.4, 72)
        legs_x, spread = (-4.0, 0.0, 4.0), 3.2
    elif tag == "B":                                 # faceted twelve-sided
        base = circle(7.2, 12)
        H, ct = 6.2, 0.9
        shell = shell_from(base, H, cb, ct, wall)
        screen = circle(5.4, 12)
        legs_x, spread = (-4.0, 0.0, 4.0), 3.2
    elif tag == "C":                                 # oval / stadium
        base = stadium(19.0, 11.5)
        H, ct = 5.6, 0.65
        shell = shell_from(base, H, cb, ct, wall)
        screen = stadium(15.0, 8.6)
        legs_x, spread = (-6.5, -2.2, 2.2, 6.5), 3.0
    else:                                            # dome
        H = 7.4
        shell = dome_shell(7.2, 2.4, 5.0, wall)
        base = circle(7.2, 72)
        screen = circle(5.4, 72)
        legs_x, spread = (-4.0, 0.0, 4.0), 3.2
    fz_local = cb * 0.8
    shell = U([shell, prism(scaled(base, 0.9), fz_local - 0.16, 0.16)])
    # section cut: everything in front of y = 0.6 above the parapet
    cutter = box(40, 20, 20, 0, 0.6 + 10, fz_local + 1.0 + 10)
    shell = D(shell, cutter)
    items = [(f"option_{tag}/shell", shell, "plaster")]
    top = H - wall - 0.05
    roof_at = None
    if tag == "D":
        Ri = 7.2 - wall
        roof_at = lambda x, y: 2.4 + (5.0 - wall) * np.sqrt(max(0.0, 1 - (np.hypot(x, y) / Ri) ** 2)) - 0.1
    for name, mesh, mat in interior(screen, fz_local, top - 0.55, roof_at):
        mesh = D(mesh, cutter) if name in ("screen", "screen_edges") else mesh
        items.append((f"option_{tag}/{name}", mesh, mat))
    # everything above sits on the lift
    items = [(n, m.copy().apply_translation((cx, 0, LIFT)), mat) for n, m, mat in items]
    legs, skis = stilts(legs_x, spread)
    items += [(f"option_{tag}/legs", legs.apply_translation((cx, 0, 0)), "plaster"),
              (f"option_{tag}/skis", skis.apply_translation((cx, 0, 0)), "plaster")]
    return items


if __name__ == "__main__":
    items = []
    # left to right seen from the front (screen left is +x)
    for tag, cx in (("A", 34.0), ("B", 13.0), ("C", -10.0), ("D", -33.0)):
        items += option(tag, cx)
    items.append(("ground", box(86, 24, 1.2, 0, 0, -0.6), "ground"))
    print("exported showroom_options.glb triangles:", export(items, "showroom_options.glb"))
