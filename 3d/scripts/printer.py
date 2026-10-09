"""
3D printer at the left end of the workshop's back bench (Smo, 6 Oct 2026; left as seen from the
open front, which is +x in model coordinates). An open-frame printer in the bed-slinger layout:
the bed slides front to back, the X bar climbs the two Z rods layer by layer, the print head runs
along the X bar. A filament spool hangs on a holder on the frame's outer side. A small toy robot
stands on the bed; the viewer reveals it from the bottom up as it is "printed".

Moving parts (own nodes, pivots at the given transforms; the viewer animates them):
  workshop/printer_bed     bed plate, slides along y
  workshop/printer_xbar    X bar with its two end blocks, rises along z
  workshop/printer_head    print head and nozzle, moves along x and rises with the X bar
  workshop/printer_toy     the toy on the bed (material "filament"), moves with the bed
All in model coordinates (z up). Positions come from the workshop bench in build_station_v4.
"""
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial
from build_station_v4 import box, cyl, rod, U, D, cat, ROT, MAT

MAT["filament"] = PBRMaterial(name="filament", baseColorFactor=[0.85, 0.42, 0.2, 1.0], metallicFactor=0.0, roughnessFactor=0.55)

TOP = 3.9425            # bench top (fz + 0.93)
CX, CY = 12.05, -2.30   # printer centre on the bench
W, D, H = 0.50, 0.46, 0.56
BED_Z = TOP + 0.10      # bed surface height
TOY_H = 0.17


def frame():
    plaster, black = [], []
    plaster.append(box(W, D, 0.08, CX, CY, TOP + 0.04))                        # base with electronics
    black.append(box(0.12, 0.006, 0.05, CX - 0.12, CY + D / 2 + 0.003, TOP + 0.045))   # small screen on the front
    black.append(cyl(0.014, 0.012, CX + 0.04, CY + D / 2 + 0.006, TOP + 0.045, 12).apply_transform(
        ROT(np.pi / 2, (1, 0, 0), (CX + 0.04, CY + D / 2 + 0.006, TOP + 0.045))))   # knob
    for sx in (-1, 1):                                                          # upright frame and Z rods
        x = CX + sx * (W / 2 - 0.03)
        plaster.append(box(0.04, 0.06, H - 0.08, x, CY, TOP + 0.08 + (H - 0.08) / 2))
        black.append(rod((x - sx * 0.035, CY + 0.02, TOP + 0.09), (x - sx * 0.035, CY + 0.02, TOP + H - 0.02), 0.005, 8))
        black.append(rod((x - sx * 0.035, CY - 0.02, TOP + 0.09), (x - sx * 0.035, CY - 0.02, TOP + H - 0.02), 0.004, 8))
    plaster.append(box(W, 0.06, 0.04, CX, CY, TOP + H))                        # top bar
    for sx in (-1, 1):                                                          # Y rails under the bed
        black.append(rod((CX + sx * 0.08, CY - D / 2 + 0.02, TOP + 0.085), (CX + sx * 0.08, CY + D / 2 - 0.02, TOP + 0.085), 0.004, 8))
    # spool holder on the outer (+x) side, spool in filament colour
    hx = CX + W / 2 + 0.015
    plaster.append(box(0.03, 0.04, 0.12, hx, CY, TOP + H - 0.08))
    black.append(rod((hx, CY, TOP + H - 0.1), (hx + 0.11, CY, TOP + H - 0.1), 0.008, 8))
    spool_c = (hx + 0.07, CY, TOP + H - 0.1)
    flanges = [cyl(0.105, 0.008, 0, 0, s * 0.032, 40) for s in (-1, 1)]
    hub = cyl(0.03, 0.07, 0, 0, 0, 24)
    spool_frame = cat(flanges + [hub])
    wound = cyl(0.085, 0.056, 0, 0, 0, 40)
    for m in (spool_frame, wound):
        m.apply_transform(ROT(np.pi / 2, (0, 1, 0)))
        m.apply_translation(spool_c)
    black.append(spool_frame)
    # filament from the spool over the top bar to the head (static, follows the middle of the print)
    black.append(rod((spool_c[0] - 0.03, CY, TOP + H - 0.02), (CX + 0.05, CY, TOP + H + 0.02), 0.002, 4))
    return [("workshop/printer_frame", cat(plaster), "plaster"),
            ("workshop/printer_frame_black", cat(black), "linework"),
            ("workshop/printer_spool", wound, "filament")]


def toy():
    """Small toy robot, about 17 cm, in the bed's local frame (origin on the bed surface)."""
    parts = []
    for sx in (-1, 1):
        parts.append(box(0.03, 0.04, 0.012, sx * 0.022, 0.006, 0.006))         # feet
        parts.append(box(0.022, 0.022, 0.045, sx * 0.022, 0, 0.034))           # legs
    parts.append(box(0.085, 0.055, 0.06, 0, 0, 0.087))                          # body
    parts.append(box(0.03, 0.006, 0.02, 0, 0.03, 0.092))                        # chest panel
    for sx in (-1, 1):
        parts.append(box(0.018, 0.022, 0.05, sx * 0.054, 0, 0.09))              # arms
        parts.append(cyl(0.012, 0.012, sx * 0.054, 0, 0.06, 12))               # hands
    parts.append(box(0.016, 0.016, 0.012, 0, 0, 0.123))                         # neck
    head = box(0.07, 0.05, 0.045, 0, 0, 0.151)
    parts.append(head)
    for sx in (-1, 1):
        parts.append(cyl(0.008, 0.006, sx * 0.016, 0.026, 0.153, 12).apply_transform(
            ROT(np.pi / 2, (1, 0, 0), (sx * 0.016, 0.026, 0.153))))             # eyes
    parts.append(rod((0, 0, 0.173), (0, 0, 0.19), 0.003, 6))                   # antenna
    parts.append(trimesh.creation.icosphere(1, 0.007).apply_translation((0, 0, 0.192)))
    return cat(parts)


def printer():
    statics = frame()
    movers = []
    # bed: plate on a carriage, pivot at the bed surface centre; slides along y
    bed = cat([box(0.32, 0.32, 0.006, 0, 0, -0.003), box(0.24, 0.12, 0.012, 0, 0, -0.012)])
    T = np.eye(4); T[:3, 3] = (CX, CY, BED_Z)
    movers.append(("workshop/printer_bed", bed, "linework", T))
    movers.append(("workshop/printer_toy", toy(), "filament", T.copy()))
    # X bar: pivot at bed height + 0.02 in the middle of the frame; rises along z
    xbar = cat([rod((-W / 2 + 0.06, 0, 0), (W / 2 - 0.06, 0, 0), 0.005, 8),
                rod((-W / 2 + 0.06, 0, 0.03), (W / 2 - 0.06, 0, 0.03), 0.005, 8),
                box(0.05, 0.05, 0.06, -W / 2 + 0.065, 0, 0.015), box(0.05, 0.05, 0.06, W / 2 - 0.065, 0, 0.015)])
    T = np.eye(4); T[:3, 3] = (CX, CY, BED_Z + 0.03)
    movers.append(("workshop/printer_xbar", xbar, "plaster", T))
    # head: pivot at the nozzle tip; moves along x and z
    head = cat([box(0.07, 0.05, 0.07, 0, 0.012, 0.055), box(0.05, 0.004, 0.04, 0, 0.038, 0.06),
                trimesh.creation.cone(radius=0.008, height=0.02, sections=12).apply_transform(ROT(np.pi, (1, 0, 0))).apply_translation((0, 0, 0.02))])
    T = np.eye(4); T[:3, 3] = (CX, CY, BED_Z + 0.002)
    movers.append(("workshop/printer_head", head, "plaster", T))
    return statics, movers


if __name__ == "__main__":
    s, m = printer()
    for n, mesh, _ in s:
        print(n, mesh.bounds.round(3).tolist())
    for n, mesh, _, T in m:
        print(n, T[:3, 3].round(3).tolist(), mesh.bounds.round(3).tolist())
