"""
Rough arrangement, version 7 (Smo, 5 Oct 2026)
- Plateau floor gets slight bumps (landscape.bumps), flattened near anything standing on the
  ground so skis, wheels and plant bases stay level.
- A few new kinds of objects scattered towards the faded edge (props.py).
- Construction site: a second scaffold across the open end and three standing work lights.
Everything else as in version 6. Exports arrangement_v7.glb.
"""
import numpy as np
import arrangement_v5 as v5
from arrangement_v3 import export as export_v3
import landscape
from landscape import landscape as make_landscape, BOULDERS
from props import scatter
from projectors import projectors

CAPTURE = {}


def capture_terrain(x0, x1, y0, edge_y, rocks_at=None):
    CAPTURE["rocks"] = rocks_at or []
    return []


v5.terrain = capture_terrain
v5.CAMP_SHIFT = (2.1, -2.1)

if __name__ == "__main__":
    items, movers = v5.build()
    items += scatter()
    st, mv = projectors()
    items += st
    movers += mv
    import props
    movers += props.MOVERS
    import printer                                            # 3D printer in the workshop (Smo)
    st, mv = printer.printer()
    items += st
    movers += mv
    import camp                                               # case stacks and the loose case (Smo)
    st, mv = camp.camp_cases()
    items += st
    movers += mv
    # ground contact points: low vertices of everything standing on the plateau
    pts = np.vstack([m.vertices[m.vertices[:, 2] < 0.6] for _, m, _ in items if len(m.vertices)])
    pts = pts[np.random.default_rng(0).permutation(len(pts))[:60000]]
    landscape.set_flat_points(pts)
    near = CAPTURE["rocks"]
    far = [b for b in BOULDERS if all(abs(b[0] - r[0]) + abs(b[1] - r[1]) > 3 for r in near)]
    items += make_landscape(near + far)
    items.append(landscape.distant_hills())
    print("exported arrangement_v7.glb triangles:", export_v3(items, movers, "arrangement_v7.glb"))
