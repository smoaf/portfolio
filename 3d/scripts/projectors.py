"""
Three projectors for projection mapping on the showroom's outer wall (Smo, 5 Oct 2026).
No stands: each projector sits folded inside a low plaster box in front of the wall. At night
the viewer opens the lid and lifts the projector out, then switches its beam on.

Wall: the three facets of the showroom facing away from the inner corner (showroom local -x),
the right-hand side in the default view. Boxes are pushed clear of the hub if needed.
One projector per facet, aimed at the plain wall between the bottom chamfer and the window band.

Exported per projector N (0..2):
  showroom/projector_box_N      static box with an open top (plaster)
  showroom/projector_lid_N      lid, own node, pivot on the hinge, turns about its local x axis
  showroom/projector_head_N     projector on its lift post, own node, pivot at the lens; rises
  showroom/projector_target_N   tiny marker inside the wall at the beam centre (ghost: invisible)
"""
import numpy as np
from build_station_v4 import P, box, cyl, rod, U, D, cat, ROT
from arrangement import ellipse_poly
from arrangement_v2 import GAP, ARM_B_ANGLE, SHOW_A, SHOW_B, FACE_B
import arrangement_v5 as v5

BOX_OUT = 4.6        # box distance in front of the wall facet
RISE = 1.0           # how far the projector lifts out of the box


def showroom_frame():
    """Same placement as arrangement_v5.build(): returns (transform local->world, lift)."""
    specs = P["modules"]
    total = sum(s["length"] for s in specs) + GAP * (len(specs) - 1)
    left_end = -total / 2
    R = v5.HUB_R
    hx, hy = left_end - GAP - R, 0.0
    phi = -np.radians(ARM_B_ANGLE)
    d_show = R + GAP + FACE_B
    T = ROT(phi + np.pi / 2, (0, 0, 1))
    T[:3, 3] = (hx + d_show * np.cos(phi), hy + d_show * np.sin(phi), 0)
    fz = P["lift"] + P["chamfer_bottom"] * 0.75
    return T, fz - 1.0 * 0.8


def facets():
    """The three wall facets facing local +x: (centre xy, outward normal xy, length)."""
    base = ellipse_poly(SHOW_A, SHOW_B, 12, np.pi / 12)
    out = []
    for i in range(len(base)):
        p0, p1 = np.array(base[i]), np.array(base[(i + 1) % len(base)])
        e = p1 - p0
        n = np.array([e[1], -e[0]]) / np.linalg.norm(e)
        c = (p0 + p1) / 2
        if n @ c < 0:
            n = -n
        out.append((c, n, np.linalg.norm(e)))
    out.sort(key=lambda f: f[1][0])            # facets facing local -x (Smo: the other side)
    return sorted(out[:3], key=lambda f: f[0][1])


def clear_of_hub(pos, n, Tw, margin=2.4):
    """Slide a box along its facet normal until it stands clear of the hub's footprint."""
    specs = P["modules"]
    total = sum(s["length"] for s in specs) + GAP * (len(specs) - 1)
    hub = np.array([-total / 2 - GAP - v5.HUB_R, 0.0])
    p = pos.copy()
    for _ in range(40):
        w = (Tw @ np.array([p[0], p[1], 0, 1]))[:2]
        if np.linalg.norm(w - hub) > v5.HUB_R + margin:
            break
        p = p + n * 0.25
    return p


def projectors():
    Tw, lift = showroom_frame()
    z_wall = lift + 1.0 + (3.6 / 2)           # middle of the plain wall: bottom chamfer to window band
    statics, movers = [], []
    for i, (c, n, length) in enumerate(facets()):
        ang = np.arctan2(n[1], n[0]) + np.pi    # box frame: local +x points back at the wall
        pos = c + n * BOX_OUT
        pos = clear_of_hub(pos, n, Tw)
        F = ROT(ang, (0, 0, 1)); F[:3, 3] = (pos[0], pos[1], 0)
        W = Tw @ F                               # box frame -> world
        # box with an open top
        shell = D(box(1.3, 1.2, 0.7, 0, 0, 0.35), box(1.1, 1.0, 0.8, 0, 0, 0.5))
        shell.apply_transform(W)
        statics.append((f"showroom/projector_box_{i}", shell, "plaster"))
        # lid hinged on the far edge (away from the wall), lies closed on the box
        lid = box(1.3, 1.2, 0.06, 0.65, 0, 0.03)          # pivot at x = 0 = hinge
        H = W @ np.array([[1, 0, 0, -0.65], [0, 1, 0, 0], [0, 0, 1, 0.7], [0, 0, 0, 1.0]])
        # hinge axis must be the node's local x: turn the lid frame so the hinge runs along x
        Hr = H @ ROT(np.pi / 2, (0, 0, 1))
        lid.apply_transform(ROT(-np.pi / 2, (0, 0, 1)))
        movers.append((f"showroom/projector_lid_{i}", lid, "plaster", Hr))
        # projector head: body tilted up towards the wall centre, post going down into the box
        horiz = BOX_OUT + 0.0
        tilt = np.arctan2(z_wall - (0.45 + RISE), horiz)
        body = box(0.55, 0.45, 0.24, -0.2, 0, 0)
        lens = cyl(0.08, 0.08, 0, 0, 0, 20)
        lens.apply_transform(ROT(np.pi / 2, (0, 1, 0)))
        lens.apply_translation((0.1, 0, 0))
        yoke = [rod((-0.2, s * 0.27, -0.05), (-0.2, s * 0.27, -0.25), 0.02, 6) for s in (-1, 1)]
        head = cat([body, lens])
        head.apply_transform(ROT(-tilt, (0, 1, 0)))
        post = cat(yoke + [rod((-0.2, -0.27, -0.25), (-0.2, 0.27, -0.25), 0.02, 6),
                           rod((-0.2, 0, -0.25), (-0.2, 0, -1.25), 0.03, 8)])
        unit = cat([head, post])
        Hd = W @ np.array([[1, 0, 0, 0.1], [0, 1, 0, 0], [0, 0, 1, 0.45], [0, 0, 0, 1.0]])
        movers.append((f"showroom/projector_head_{i}", unit, "linework", Hd))
        # target marker inside the wall at the beam centre
        tw = c - n * 0.25
        mk = box(0.05, 0.05, 0.05)
        Tm = np.eye(4); Tm[:3, 3] = (tw[0], tw[1], z_wall)
        mk.apply_transform(Tw @ Tm)
        statics.append((f"showroom/projector_target_{i}", mk, "ghost"))
    return statics, movers
