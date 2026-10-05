"""
Expedition camper van in the style of a Mercedes 208 (T1 series), unbranded.
Body shape follows the 208: tall box body, short sloping bonnet, big raked windscreen,
a dark grille band with square headlights, black bumpers.
Expedition kit after Smo's references (film expedition truck, mining truck with a railed deck):
lifted on big all-terrain tyres, wheel-arch flares, bull bar, snorkel, roof deck with a black
railing, roof box and jerrycans, light bar, rear ladder and spare wheel, side awning.
No badges, no number plates.

van(x, y, heading) returns a list of (name, mesh, material) in station coordinates (z up).
"""
import numpy as np
import trimesh
from build_station_v4 import box, cyl, rod, U, D, I, cat, ROT

WR, WW = 0.52, 0.36            # tyre radius and width
AXLES = (-1.35, 1.65)          # rear and front axle, x forward
TRACK = 0.95
FLOOR = 0.95                   # underside of the body


def tyre(cx, cy, cz, axis="y"):
    """Chunky all-terrain tyre with tread blocks, plaster rim and hub. Returns (rubber, rim)."""
    t = trimesh.creation.cylinder(radius=WR - 0.03, height=WW, sections=40)
    blocks = []
    for k in range(28):
        a = 2 * np.pi * k / 28
        b = box(0.11, WW * (0.48 if k % 2 else 0.9), 0.07)
        b.apply_translation((0, (WW * 0.25 if k % 2 else 0) * (1 if k % 4 == 1 else -1), WR - 0.045))
        b.apply_transform(ROT(a, (0, 1, 0)))
        blocks.append(b)
    rubber = U([t.apply_transform(ROT(np.pi / 2, (1, 0, 0)))] + blocks)
    rim = U([trimesh.creation.cylinder(radius=0.29, height=WW + 0.02, sections=32).apply_transform(ROT(np.pi / 2, (1, 0, 0))),
             trimesh.creation.cylinder(radius=0.1, height=WW + 0.08, sections=16).apply_transform(ROT(np.pi / 2, (1, 0, 0)))])
    rubber = D(rubber, trimesh.creation.cylinder(radius=0.3, height=WW + 0.2, sections=32).apply_transform(ROT(np.pi / 2, (1, 0, 0))))
    for m in (rubber, rim):
        if axis == "x":
            m.apply_transform(ROT(np.pi / 2, (0, 0, 1)))
        m.apply_translation((cx, cy, cz))
    return rubber, rim


def body():
    """Box body plus cab with bonnet and raked windscreen, wheel arches cut out."""
    from build_station_v4 import chamfered_body
    rear = chamfered_body(3.55, 2.0, 2.12, 0.14, 0.06, 0.12)
    rear.apply_translation((-2.55 + 3.55 / 2, 0, FLOOR + 1.06))
    # two hulls so the bonnet and the raked windscreen meet at a crease, as on the 208
    lower = [(0.85, FLOOR), (2.30, FLOOR), (2.34, 1.72), (1.98, 1.96), (0.85, 1.96)]
    upper = [(0.85, 1.9), (1.98, 1.9), (1.98, 1.96), (1.56, 2.98), (0.85, 3.07)]
    hulls = []
    for prof in (lower, upper):
        pts = [(x, y, z) for y in (-0.99, 0.99) for x, z in prof]
        hulls.append(trimesh.convex.convex_hull(np.array(pts)))
    cab = U(hulls)
    b = U([rear, cab])
    wells = [trimesh.creation.cylinder(radius=WR + 0.1, height=2.6, sections=40)
             .apply_transform(ROT(np.pi / 2, (1, 0, 0))).apply_translation((ax, 0, WR)) for ax in AXLES]
    return D(b, U(wells))


def van(x, y, heading=0.0):
    plaster, black, warm = [], [], []
    plaster.append(body())

    # wheel arch flares, tyres
    for ax in AXLES:
        for s in (-1, 1):
            flare = D(trimesh.creation.cylinder(radius=WR + 0.2, height=0.16, sections=40),
                      trimesh.creation.cylinder(radius=WR + 0.09, height=0.4, sections=40))
            flare.apply_transform(ROT(np.pi / 2, (1, 0, 0)))
            flare = I(flare, box(2, 1, 1, 0, 0, 0.5 - 0.02))
            flare.apply_translation((ax, s * 1.03, WR))
            black.append(flare)
            r, rim = tyre(ax, s * TRACK, WR)
            black.append(r); plaster.append(rim)

    # chassis, axles, side steps, mud flaps
    black += [box(4.6, 0.12, 0.2, 0.1, s * 0.55, 0.72) for s in (-1, 1)]
    black += [rod((ax, -TRACK + 0.2, WR), (ax, TRACK - 0.2, WR), 0.06, 10) for ax in AXLES]
    black += [cyl(0.16, 0.22, ax, 0, WR, 16).apply_transform(ROT(np.pi / 2, (1, 0, 0), (ax, 0, WR))) for ax in AXLES]
    black += [box(1.1, 0.22, 0.05, 0.25, s * 1.08, 0.78) for s in (-1, 1)]
    black += [box(0.03, 0.3, 0.32, ax - 0.62, s * TRACK, 0.36) for ax in AXLES for s in (-1, 1)]

    # windows: raked windscreen, cab side windows, a sliding window in the body, rear windows
    a = np.arctan2(0.42, 1.02)
    ws = box(0.03, 1.78, 0.9)
    ws.apply_transform(ROT(-a, (0, 1, 0)))
    ws.apply_translation((1.77 + 0.02 * np.cos(a), 0, 2.47 + 0.02 * np.sin(a)))
    black.append(ws)
    for s in (-1, 1):
        black.append(box(0.72, 0.03, 0.7, 1.28, s * 0.995, 2.42))           # cab door window
        black.append(box(0.9, 0.03, 0.62, -0.75, s * 1.005, 2.5))           # sliding window
        black.append(box(0.65, 0.03, 0.62, -1.95, s * 1.005, 2.5))
        # panel lines: sliding door outline and cab door gap
        for (x0, x1, z) in [(-0.55, 0.65, 1.0), (-0.55, 0.65, 2.92)]:
            black.append(box(x1 - x0, 0.02, 0.015, (x0 + x1) / 2, s * 1.003, z))
        for xx in (-0.55, 0.65, 0.88):
            black.append(box(0.015, 0.02, 1.95, xx, s * 1.003, 1.97))
        black.append(box(0.07, 0.04, 0.03, 0.75, s * 1.01, 1.95))           # door handle
    black += [box(0.03, 0.75, 0.62, -2.565, s * 0.47, 2.45) for s in (-1, 1)]   # rear door windows
    black.append(box(0.02, 0.015, 1.95, -2.567, 0, 1.97))                   # rear door split

    # front: dark grille band with square headlights and indicators, lower grille, bumper
    black.append(box(0.04, 1.92, 0.36, 2.345, 0, 1.43))
    for s in (-1, 1):
        warm.append(box(0.04, 0.3, 0.24, 2.36, s * 0.6, 1.43))             # headlight
        warm.append(box(0.04, 0.12, 0.2, 2.36, s * 0.86, 1.43))            # indicator
    black += [box(0.03, 1.0, 0.025, 2.335, 0, z) for z in (1.08, 1.14, 1.2)]
    black.append(box(0.22, 2.06, 0.22, 2.42, 0, 0.98))                      # front bumper
    black.append(box(0.2, 2.06, 0.2, -2.64, 0, 0.98))                       # rear bumper
    black += [box(0.42, 0.04, 0.012, 1.95 - 0.08 * k, 0, 2.02 + 0.03 * k) for k in (0, 1)]   # bonnet vents
    for s in (-1, 1):                                                        # wipers
        black.append(rod((1.98, s * 0.55, 2.0), (1.86, s * 0.1, 2.32), 0.008, 4))

    # bull bar
    bb = [rod((2.6, s * 0.75, 0.9), (2.6, s * 0.75, 1.75), 0.035, 10) for s in (-1, 1)]
    bb += [rod((2.6, -0.75, 1.75), (2.6, 0.75, 1.75), 0.035, 10), rod((2.6, -0.85, 1.12), (2.6, 0.85, 1.12), 0.035, 10)]
    bb += [rod((2.6, s * 0.75, 1.75), (2.45, s * 0.75, 1.68), 0.03, 8) for s in (-1, 1)]
    black += bb
    # mirrors on arms
    for s in (-1, 1):
        black.append(rod((1.75, s * 1.0, 2.3), (1.85, s * 1.32, 2.42), 0.015, 6))
        plaster.append(box(0.08, 0.16, 0.26, 1.86, s * 1.36, 2.42))
    # snorkel up the right A-pillar
    sn = [rod((2.0, -1.03, 1.55), (2.0, -1.05, 2.0), 0.06, 12), rod((2.0, -1.05, 2.0), (1.58, -1.06, 3.05), 0.06, 12),
          rod((1.58, -1.06, 3.05), (1.58, -1.06, 3.35), 0.06, 12)]
    black += sn
    plaster.append(box(0.22, 0.16, 0.16, 1.66, -1.06, 3.4))

    # roof deck with black railing, roof box, jerrycans, light bar
    rz = 3.1
    deck_x0, deck_x1, dy = -2.45, 1.45, 0.9
    rail = [box(deck_x1 - deck_x0, 0.05, 0.05, (deck_x0 + deck_x1) / 2, s * dy, rz + 0.06) for s in (-1, 1)]
    rail += [box(0.05, 2 * dy, 0.05, xx, 0, rz + 0.06) for xx in np.linspace(deck_x0, deck_x1, 7)]
    top = rz + 0.55
    rail += [rod((deck_x0, s * dy, top), (deck_x1, s * dy, top), 0.018, 6) for s in (-1, 1)]
    rail += [rod((deck_x0, -dy, top), (deck_x0, dy, top), 0.018, 6)]
    for xx in np.linspace(deck_x0, deck_x1, 7):
        for s in (-1, 1):
            rail.append(rod((xx, s * dy, rz + 0.06), (xx, s * dy, top), 0.012, 6))
    for xx in np.linspace(deck_x0, deck_x1, 13):
        for s in (-1, 1):
            rail.append(rod((xx, s * dy, rz + 0.3), (xx + 0.15, s * dy, rz + 0.3), 0.006, 4))
    rail += [rod((deck_x0 + k * 0.32, s * dy, rz + 0.3), (deck_x0 + k * 0.32 + 0.32, s * dy, rz + 0.3), 0.008, 4)
             for k in range(12) for s in (-1, 1)]
    black += rail
    plaster.append(box(1.7, 1.1, 0.42, -1.25, 0.1, rz + 0.33))             # roof box
    warm += [box(0.17, 0.35, 0.47, 0.2 + 0.2 * k, -0.55, rz + 0.33) for k in range(3)]   # jerrycans
    plaster.append(box(0.9, 0.5, 0.2, 0.75, 0.45, rz + 0.18))              # folded solar panel / crate
    black.append(box(0.08, 1.6, 0.12, 1.5, 0, rz + 0.22))                  # light bar housing
    lamps = [box(0.03, 0.26, 0.08, 1.545, -0.6 + 0.4 * k, rz + 0.22) for k in range(4)]
    # rolled awning along the left roof edge
    aw = trimesh.creation.cylinder(radius=0.09, height=3.2, sections=16)
    aw.apply_transform(ROT(np.pi / 2, (0, 1, 0)))
    aw.apply_translation((-0.6, 1.06, 2.98))
    warm.append(aw)
    # rear: ladder and spare wheel
    lad = [rod((-2.62, s * 0.62, 1.15), (-2.62, s * 0.62, rz + 0.55), 0.02, 6) for s in (-1, 1)]
    lad += [rod((-2.62, -0.62, z), (-2.62, -0.18, z), 0.015, 6) for z in np.arange(1.35, rz + 0.5, 0.3)]
    lad = [m.apply_translation((0, 0.38 * 0, 0)) for m in lad]
    black += lad
    r, rim = tyre(-2.85, 0.42, 1.75, axis="x")
    black.append(r); plaster.append(rim)
    black.append(box(0.2, 0.08, 0.08, -2.72, 0.42, 1.75))

    T = ROT(heading, (0, 0, 1)); T[:3, 3] = (x, y, 0)
    return [("van/body", U(plaster).apply_transform(T), "plaster"),
            ("van/black_parts", cat(black).apply_transform(T), "linework"),
            ("van/light_details", cat(warm).apply_transform(T), "plaster_warm"),
            ("van/light_bar_lamp", cat(lamps).apply_transform(T), "plaster_warm")]


if __name__ == "__main__":
    from build_station_v4 import export
    items = van(0, 0) + [("ground", box(14, 10, 0.2, 0, 0, -0.1), "ground")]
    print("van triangles:", export(items, "van_test.glb"))
