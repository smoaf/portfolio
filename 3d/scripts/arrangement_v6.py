"""
Rough arrangement, version 6 (Smo, 5 Oct 2026)
Same station as version 5. Only the ground changes: the plaster block becomes a mountain
plateau with a real cliff at the front (see landscape.py). Smo's choices: flat plateau, light
floor detail (a few smooth outcrops and sparse boulders), cliff fading out downwards, outer
edges fading out. The fades happen in the viewer.
Exports arrangement_v6.glb.
"""
import arrangement_v5 as v5
from arrangement_v3 import export as export_v3
from landscape import landscape, BOULDERS


def terrain_v6(x0, x1, y0, edge_y, rocks_at=None):
    # keep the v5 rocks (including the one moved beyond the hub) and add the far boulders
    near = rocks_at or []
    far = [b for b in BOULDERS if all(abs(b[0] - r[0]) + abs(b[1] - r[1]) > 3 for r in near)]
    return landscape(near + far)


v5.terrain = terrain_v6

if __name__ == "__main__":
    items, movers = v5.build()
    print("exported arrangement_v6.glb triangles:", export_v3(items, movers, "arrangement_v6.glb"))
