"""
Camp details (Smo, 6 Oct 2026):
- folding camping armchairs after his photo (Downloads/campingstuhl-basic-faltbar-beige.jpg.avif):
  crossed tube legs on all four sides, sagging fabric seat, fabric backrest between two posts,
  fabric armrests on curved tube supports, a mesh cup holder on the left armrest
- rugged transport cases after his photos (Downloads/images-7.jpeg, images-8.jpeg): a stack by the
  van's side door with an open hard case on top (foam inside), a case at the van's other side, and
  one loose case (own node 'camp/carry_case') that the walking figure in the viewer carries
  between the two places
Positions in world coordinates (z up). The van stands at (27.0, 4.2), the fire at (23.4, 6.3).
"""
import numpy as np
import trimesh
from build_station_v4 import box, cyl, rod, U, D, cat, ROT

STACK = (23.9, 2.6)          # case stack with the open case on top
PILE_A = (29.5, 2.3)         # case at the van's far side; the loose case starts on top of it
PILE_B = (22.7, 2.6)         # ground spot next to the stack where the loose case gets put down
CARRY = (0.62, 0.44, 0.34)   # loose case size


def camping_chair():
    """Folding armchair, seat centre at the origin's foot, facing +x. Returns (frame, fabric)."""
    r = 0.011
    fr, fb = [], []
    w, d = 0.27, 0.25                     # half width, half depth of the leg frame
    hs = 0.44                             # seat height at the frame
    for s in (-1, 1):                     # side crosses
        fr.append(rod((-d, s * w, 0.0), (d, s * w, hs), r, 6))
        fr.append(rod((d, s * w, 0.0), (-d, s * w, hs), r, 6))
    for x in (-d, d):                     # front and back crosses
        fr.append(rod((x, -w, 0.0), (x, w, hs), r, 6))
        fr.append(rod((x, w, 0.0), (x, -w, hs), r, 6))
    for x in (-d, d):                     # seat rails
        fr.append(rod((x, -w, hs), (x, w, hs), r, 6))
    for s in (-1, 1):
        fr.append(rod((-d, s * w, hs), (d, s * w, hs), r, 6))
    feet = [box(0.05, 0.04, 0.02, x, s * w, 0.01) for x in (-d, d) for s in (-1, 1)]
    # backrest posts and fabric panel, leaning back a little
    top = (-d - 0.07, 0.0, 0.97)
    for s in (-1, 1):
        fr.append(rod((-d, s * (w - 0.02), hs), (-d - 0.07, s * (w - 0.02), 0.97), r, 6))
    back = box(0.025, 2 * w - 0.02, 0.27)
    back.apply_transform(ROT(-0.15, (0, 1, 0)))
    back.apply_translation((-d - 0.055, 0, 0.82))
    fb.append(back)
    # armrests: fabric strips on a back post and a curved front support down to the seat rail
    for s in (-1, 1):
        y = s * (w + 0.03)
        arm = box(0.42, 0.09, 0.02, -0.03, y, 0.64)
        fb.append(arm)
        pts = [(0.17, y, 0.64), (0.2, y, 0.6), (0.21, s * w, 0.52), (d - 0.02, s * w, hs)]
        fr += [rod(pts[i], pts[i + 1], r, 6) for i in range(3)]
        fr.append(rod((-d, s * w, hs), (-d - 0.02, y, 0.64), r, 6))
    # sagging fabric seat: a small grid mesh hanging between the rails
    n = 6
    verts = []
    for i in range(n + 1):
        for j in range(n + 1):
            u, v = i / n, j / n
            x, y = -d + 2 * d * u, -w + 2 * w * v
            sag = 0.06 * (1 - (2 * u - 1) ** 2) * (1 - (2 * v - 1) ** 2) + 0.03 * (1 - (2 * v - 1) ** 2)
            verts.append((x, y, hs + 0.01 - sag))
    faces = []
    for i in range(n):
        for j in range(n):
            a, b, c, e = i * (n + 1) + j, i * (n + 1) + j + 1, (i + 1) * (n + 1) + j, (i + 1) * (n + 1) + j + 1
            faces += [(a, c, e), (a, e, b)]
    seat = trimesh.Trimesh(np.array(verts), np.array(faces), process=False)
    seat = trimesh.util.concatenate([seat, seat.copy().apply_translation((0, 0, -0.012))])
    seat.fix_normals()
    fb.append(seat)
    # mesh cup holder on the left armrest (the chair's own left: +y when facing +x)
    cup = D(cyl(0.05, 0.11, 0.1, w + 0.1, 0.58, 16), cyl(0.04, 0.2, 0.1, w + 0.1, 0.62, 16))
    fr.append(cup)
    return cat(fr + feet), cat(fb)


def chairs(x, y):
    """Two chairs round the fire at (x, y), where the old plain seats stood, facing the fire."""
    frames, fabric = [], []
    for a in (np.pi * 0.85, np.pi * 1.25):
        sx, sy = x + 1.6 * np.cos(a), y + 1.6 * np.sin(a)
        f, c = camping_chair()
        T = ROT(a + np.pi, (0, 0, 1)); T[:3, 3] = (sx, sy, 0)
        frames.append(f.apply_transform(T)); fabric.append(c.apply_transform(T))
    return [("firepit/chair_frames", cat(frames), "linework"), ("firepit/chair_fabric", cat(fabric), "plaster_warm")]


def chamfered(L, W, H, c=0.03):
    pts = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (0, 1):
                z = sz * H
                pts += [(sx * (L / 2 - c), sy * W / 2, z + (c if sz == 0 else -c)), (sx * L / 2, sy * (W / 2 - c), z + (c if sz == 0 else -c)),
                        (sx * (L / 2 - c), sy * (W / 2 - c), z)]
    return trimesh.convex.convex_hull(np.array(pts))


def rugged_case(L, W, H):
    """Transport case standing on the origin: body with a seam, ribbed lid, corner feet; latches and
    handles in black. Returns (body, black)."""
    body = [chamfered(L, W, H)]
    nx, ny = max(2, int(L / 0.16)), max(2, int(W / 0.16))
    for i in range(nx):                                   # ribbed lid
        x = -L / 2 + 0.08 + (L - 0.16) * i / (nx - 1)
        body.append(box(0.07, W - 0.1, 0.03, x, 0, H + 0.012))
    for sx in (-1, 1):
        for sy in (-1, 1):
            body.append(box(0.1, 0.1, 0.04, sx * (L / 2 - 0.07), sy * (W / 2 - 0.07), 0.0))
    black = [box(L + 0.004, W + 0.004, 0.012, 0, 0, H * 0.78)]          # lid seam
    for sy in (-1, 1):
        for x in np.linspace(-L / 2 + 0.15, L / 2 - 0.15, 3 if L > 0.7 else 2):
            black.append(box(0.05, 0.02, 0.07, x, sy * (W / 2 + 0.008), H * 0.78))     # latches
        black.append(box(0.16, 0.025, 0.05, 0, sy * (W / 2 + 0.012), H * 0.5))        # handles
    for sx in (-1, 1):
        black.append(box(0.025, 0.16, 0.05, sx * (L / 2 + 0.012), 0, H * 0.5))
    return cat(body), cat(black)


def open_case(L=0.5, W=0.38, H=0.15, lid_open=np.radians(105)):
    """Hard case with the lid open, foam inside (black egg-crate bumps). Hinge along the -y edge."""
    shell = D(chamfered(L, W, H, 0.02), box(L - 0.04, W - 0.04, H, 0, 0, H / 2 + 0.03))
    black = []
    foam_pts = [(x, y) for x in np.linspace(-L / 2 + 0.05, L / 2 - 0.05, 6) for y in np.linspace(-W / 2 + 0.05, W / 2 - 0.05, 5)]
    black.append(box(L - 0.05, W - 0.05, 0.05, 0, 0, 0.055))
    black += [trimesh.creation.icosphere(0, 0.025).apply_translation((x, y, 0.085)) for x, y in foam_pts[::2]]
    # lid: same shell shape, hinged on the -y top edge, opened past upright
    lid = D(chamfered(L, W, 0.07, 0.02), box(L - 0.04, W - 0.04, 0.07, 0, 0, 0.035 - 0.03))
    lid_black = [box(L - 0.05, W - 0.05, 0.03, 0, 0, 0.035)]
    lid_black += [trimesh.creation.icosphere(0, 0.022).apply_translation((x, y, 0.015)) for x, y in foam_pts[1::2]]
    T = ROT(lid_open, (1, 0, 0), (0, -W / 2, 0))             # swing the lid up over the hinge line
    T2 = np.eye(4); T2[:3, 3] = (0, 0, H)
    M = T2 @ T
    lid.apply_transform(M)
    lid_black = [m.apply_transform(M) for m in lid_black]
    handle = rod((-0.08, W / 2 + 0.02, H * 0.6), (0.08, W / 2 + 0.02, H * 0.6), 0.012, 6)
    return cat([shell, lid]), cat(black + lid_black + [handle])


def place(m, x, y, z, heading=0.0):
    T = ROT(heading, (0, 0, 1)); T[:3, 3] = (x, y, z)
    return m.apply_transform(T)


def camp_cases():
    """Static cases and the loose case (a mover with its pivot at its bottom centre)."""
    warm, black = [], []
    b, k = rugged_case(1.0, 0.72, 0.58); warm.append(place(b, *STACK, 0.0)); black.append(place(k, *STACK, 0.0))
    b, k = rugged_case(0.8, 0.6, 0.44); warm.append(place(b, *STACK, 0.6, 0.06)); black.append(place(k, *STACK, 0.6, 0.06))
    b, k = open_case(); warm.append(place(b, STACK[0] + 0.05, STACK[1] - 0.02, 1.06, 0.06)); black.append(place(k, STACK[0] + 0.05, STACK[1] - 0.02, 1.06, 0.06))
    b, k = rugged_case(0.66, 0.6, 0.44); warm.append(place(b, *PILE_A, 0.0, np.pi / 2)); black.append(place(k, *PILE_A, 0.0, np.pi / 2))
    statics = [("camp/cases", cat(warm), "plaster_warm"), ("camp/cases_black", cat(black), "linework")]
    cb, ck = rugged_case(*CARRY)                           # two nodes with the same pivot; the viewer moves both
    T = ROT(np.pi / 2, (0, 0, 1)); T[:3, 3] = (PILE_A[0], PILE_A[1], 0.44 + 0.04)
    movers = [("camp/carry_case", cb, "plaster_warm", T), ("camp/carry_case_black", ck, "linework", T.copy())]
    return statics, movers


if __name__ == "__main__":
    f, c = camping_chair()
    print("chair", f.bounds.round(2).tolist(), c.bounds.round(2).tolist())
    s, m = camp_cases()
    for n, mesh, _ in s:
        print(n, mesh.bounds.round(2).tolist())
