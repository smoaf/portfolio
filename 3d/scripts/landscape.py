"""
Mountain terrain instead of the plaster block (Smo, 5 Oct 2026).
- Flat plateau with very light unevenness, a few low rounded outcrops worn smooth by ice and a
  handful of boulders, all kept away from the buildings. Detail kept deliberately light.
- The front edge is a real cliff: a wavy edge line in plan and a sheer face with soft vertical
  jointing. The face runs 30 m down; the viewer fades it out towards the bottom.
- The outer edges of the plateau fade out into the background in the viewer as well
  (materials 'ground' and 'cliff'), so the terrain has no hard border.
References: Smo's Downloads (21_FYS_Biobasis_feltstation03_HeLu_2.jpg, 4fcd82d0-...webp,
Sermilik-Meeresperspektive.jpg, skylodge-...-designboom-01.jpg).
"""
import numpy as np
import trimesh
from build_station_v4 import U, cat, ROT
from trimesh.visual.material import PBRMaterial
from build_station_v4 import MAT

MAT["hills"] = PBRMaterial(name="hills", baseColorFactor=[0.9, 0.89, 0.87, 1.0], metallicFactor=0.0, roughnessFactor=1.0)
MAT["beacon"] = PBRMaterial(name="beacon", baseColorFactor=[0.75, 0.08, 0.06, 1.0], metallicFactor=0.0, roughnessFactor=0.5)
MAT["cliff"] = PBRMaterial(name="cliff", baseColorFactor=[0.9, 0.885, 0.86, 1.0], metallicFactor=0.0, roughnessFactor=1.0)

X0, X1 = -100.0, 90.0          # plateau extent left to right
Y0 = -80.0                     # back (pulled in from -105 on Smo's request)
DROP = 30.0                    # cliff height
STEP = 1.25                    # grid spacing


DENTS = [  # x, width, depth: bays bitten into the cliff edge, kept clear of the buildings and the camp
    (-48.0, 5.0, 2.6), (-34.0, 2.5, 1.2), (-4.0, 3.5, 2.2), (9.0, 2.0, 1.0), (40.0, 4.5, 2.8), (58.0, 3.0, 1.6), (74.0, 5.0, 2.4),
]


def edge_y(x):
    """Cliff edge line in plan: about 12 m in front of the station, wavy, with a few dents."""
    y = 12.0 + 1.6 * np.sin(x * 0.07 + 0.4) + 0.9 * np.sin(x * 0.19 + 1.7) + 0.4 * np.sin(x * 0.47)
    y = y + 0.5 * np.sin(x * 0.9 + 0.3) + 0.25 * np.sin(x * 1.7 + 2.1)      # small irregular wobble
    for cx, w, dpt in DENTS:
        y = y - dpt * np.exp(-((x - cx) / w) ** 2)
    return y


OUTCROPS = [  # x, y, radius along, radius across, height, angle: low, smooth, away from the buildings
    (-58.0, -12.0, 9.0, 5.0, 1.1, 0.4), (-47.0, 3.0, 5.0, 3.5, 0.6, -0.3), (44.0, -30.0, 8.0, 4.5, 0.9, 0.9),
    (60.0, -4.0, 6.0, 4.0, 0.7, 0.2), (-28.0, -60.0, 9.0, 5.5, 1.1, -0.6), (18.0, -58.0, 7.0, 4.0, 0.8, 0.3),
    (-70.0, -45.0, 8.0, 5.0, 1.0, 1.1),
]


# --- slight bumps (Smo: floor too flat). They fade to zero near anything standing on the ground,
# so skis, wheels and plant bases stay level. set_flat_points() feeds in the contact points.
_FLAT = {"tree": None}
_rng = np.random.default_rng(21)
HUMMOCKS = [(x, y, r, h) for x, y, r, h in zip(_rng.uniform(X0 + 5, X1 - 5, 46), _rng.uniform(Y0 + 5, 10, 46),
                                               _rng.uniform(2.5, 6.0, 46), _rng.uniform(0.15, 0.45, 46))]


def set_flat_points(points):
    from scipy.spatial import cKDTree
    _FLAT["tree"] = cKDTree(np.asarray(points)[:, :2]) if len(points) else None


def flat_mask(x, y):
    if _FLAT["tree"] is None:
        return 1.0
    d, _ = _FLAT["tree"].query([x, y])
    t = np.clip((d - 2.5) / (8.0 - 2.5), 0, 1)
    return t * t * (3 - 2 * t)


def bumps(x, y):
    h = 0.22 * np.sin(x * 0.16 + y * 0.07) + 0.16 * np.sin(x * 0.09 - y * 0.21 + 1.3) + 0.09 * np.sin(x * 0.33 + y * 0.29 + 0.7)
    for cx, cy, r, hh in HUMMOCKS:
        h += hh * np.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (r * r))
    return h


def height(x, y):
    h = 0.06 * np.sin(x * 0.21 + y * 0.13) + 0.05 * np.sin(x * 0.11 - y * 0.27 + 1.0) + 0.03 * np.sin(x * 0.53 + y * 0.41)
    for cx, cy, ra, rb, hh, ang in OUTCROPS:
        dx, dy = x - cx, y - cy
        u = dx * np.cos(ang) + dy * np.sin(ang)
        v = -dx * np.sin(ang) + dy * np.cos(ang)
        h = h + hh * np.exp(-((u / ra) ** 2 + (v / rb) ** 2) * 1.6)
    h = flat_mask(x, y) * (h + bumps(x, y))
    # the plateau dips very slightly towards the edge, as rock tops often do
    return h - 0.25 * np.exp(-((edge_y(x) - y) / 4.0) ** 2)


def plateau():
    xs = np.arange(X0, X1 + 1e-6, STEP)
    nt = int((edge_y(0) - Y0) / STEP)
    ts = np.linspace(0, 1, nt + 1)
    verts = []
    for t in ts:
        for x in xs:
            y = Y0 + t * (edge_y(x) - Y0)            # last row follows the cliff edge exactly
            verts.append((x, y, height(x, y)))
    verts = np.array(verts)
    nx = len(xs)
    faces = []
    for j in range(nt):
        for i in range(nx - 1):
            a, b = j * nx + i, j * nx + i + 1
            c, d = (j + 1) * nx + i, (j + 1) * nx + i + 1
            faces += [(a, b, d), (a, d, c)]
    m = trimesh.Trimesh(verts, np.array(faces), process=False)
    if m.face_normals[:, 2].mean() < 0:
        m.invert()
    top_edge = verts[nt * nx:(nt + 1) * nx]
    return m, top_edge


def cliff(top_edge):
    """Sheer face hanging from the edge line, with soft vertical jointing and a slight lean."""
    rows = np.linspace(0, -DROP, 31)
    n = len(top_edge)
    rng = np.random.default_rng(11)
    col_depth = rng.uniform(-0.9, 0.9, 400)            # each 3.4 m column juts out or sits back a little
    verts = []
    for k, z in enumerate(rows):
        for i, (x, y, h) in enumerate(top_edge):
            col = int(np.floor((x + 200) / 3.4))
            joint = 0.4 * np.tanh(3.0 * np.sin(x * 2 * np.pi / 3.4)) + col_depth[col % 400] * (0.6 + 0.4 * np.sin(z * 0.15 + col))
            lean = -0.04 * z                                                # face leans out very slightly lower down
            ledge = 0.6 * (np.tanh((z + 9.0) * 2.0) + 1) / 2 - 0.5 * (np.tanh((z + 18.0) * 2.0) + 1) / 2   # two soft steps
            rough = (0.35 * np.sin(z * 0.6 + x * 0.3) + 0.2 * np.sin(z * 1.7 - x * 0.9)) * (k > 0)
            rough = rough + ledge
            yy = y + (joint + lean + rough) * (1 if k > 0 else 0)
            zz = (h if k == 0 else z + 0.0)
            verts.append((x, yy, zz))
    verts = np.array(verts)
    faces = []
    for k in range(len(rows) - 1):
        for i in range(n - 1):
            a, b = k * n + i, k * n + i + 1
            c, d = (k + 1) * n + i, (k + 1) * n + i + 1
            faces += [(a, c, d), (a, d, b)]
    m = trimesh.Trimesh(verts, np.array(faces), process=False)
    # the face must look outwards, towards +y
    if m.face_normals[:, 1].mean() < 0:
        m.invert()
    return m


BOULDERS = [(-36.0, -3.2, 1.2), (-30.0, 4.0, 1.4), (-27.0, 6.5, 0.9), (12.0, 5.5, 1.1), (18.0, -12.0, 1.6),
            (8.0, -30.0, 1.0), (-52.0, -24.0, 1.3), (38.0, -14.0, 0.9), (52.0, -40.0, 1.5), (-12.0, -60.0, 1.2)]


def boulders(spots):
    rng = np.random.default_rng(3)
    out = []
    for (x, y, s) in spots:
        r = trimesh.creation.icosphere(subdivisions=1, radius=s)
        r.apply_scale((1.0, 0.8, 0.5))
        r.apply_transform(ROT(rng.uniform(0, 3), (0, 0, 1)))
        r.apply_translation((x, y, height(x, y) + s * 0.15))
        out.append(r)
    return cat(out)


def landscape(rocks_at=None):
    ground, top_edge = plateau()
    return [("terrain/plateau", ground, "ground"),
            ("terrain/cliff", cliff(top_edge), "cliff"),
            ("terrain/rocks", boulders(rocks_at or BOULDERS), "plaster")]


# a couple of low hills, only hinted (Smo). Shared so the solar field can sit on them.
HILLS = [(-110, -125, 70, 35, 22), (-10, -155, 80, 40, 26), (110, -135, 70, 34, 18)]   # 75 m closer (Smo)


def hill_base(x, y):
    h = -6.0
    for cx, cy, rx, ry, hh in HILLS:
        h += hh * np.exp(-(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2))
    return h + 1.5 * np.sin(x * 0.05 + y * 0.03)


# level pad for the steerable radio dish (radio_dish.py). Smo did not want the hill dug away for
# the sunk dish, so this is only a small local levelling: flat inside PAD r, blending back to the
# hill over PAD blend; at most about 3.5 m of cut or fill.
PAD = dict(cx=15.0, cy=-155.0, r=16.0, blend=12.0)
PAD["z"] = float(np.mean([hill_base(PAD["cx"] + r * np.cos(a), PAD["cy"] + r * np.sin(a))
                          for r in (0, 5, 10, 14) for a in np.linspace(0, 2 * np.pi, 24)]))


def hill_height(x, y):
    h = hill_base(x, y)
    d = np.hypot(x - PAD["cx"], y - PAD["cy"])
    t = np.clip((d - PAD["r"]) / PAD["blend"], 0, 1)
    w = t * t * (3 - 2 * t)
    return PAD["z"] + (h - PAD["z"]) * w


def distant_hills():
    """Broad, low hills well behind the plateau. The viewer fades their base and their sides
    out and hides them in haze, so they only read as soft shapes in the background."""
    xs = np.arange(-300, 260 + 1e-6, 5.0)
    ys = np.arange(-240, -85 + 1e-6, 5.0)
    verts = [(x, y, hill_height(x, y)) for y in ys for x in xs]
    nx = len(xs)
    faces = []
    for j in range(len(ys) - 1):
        for i in range(nx - 1):
            a, b = j * nx + i, j * nx + i + 1
            c, d = (j + 1) * nx + i, (j + 1) * nx + i + 1
            faces += [(a, b, d), (a, d, c)]
    m = trimesh.Trimesh(np.array(verts), np.array(faces), process=False)
    if m.face_normals[:, 2].mean() < 0:
        m.invert()
    return ("terrain/distant_hills", m, "hills")
