# Station model: generator scripts (arrangement 07)

All Python files needed to rebuild `arrangement_v7.glb` from scratch, latest versions, 7 Oct 2026.
Checked: these files alone, in an empty folder, rebuild a .glb that is byte-identical to the
current one (283,030 triangles, 263 nodes).

## Rebuild

    pip install -r requirements.txt
    python3 arrangement_v7.py          # writes arrangement_v7.glb (about 13 MB) into this folder

Run it from this folder: the scripts import each other by file name.
Coordinates: metres, z up while building; the export turns the model y up for glTF.
In the default view +x is to the left.

## Which file builds which part

Entry point
- `arrangement_v7.py`: builds the whole scene in order (station, props, projectors, 3D printer,
  camp cases, moving parts), then the terrain last so it can flatten under everything standing
  on it, then exports `arrangement_v7.glb`.

Station and layout
- `arrangement_v5.py`: the station layout: wing A along the cliff (hub, library, office,
  workshop), wing B at 60° (showroom, new module), the connecting tubes, the glass hub, the
  showroom shell with window band fins and roof slats (moving parts), the camp position (van,
  fire pit, flames), cacti, desert bushes and agaves. Its `terrain` is replaced in v7.
- `arrangement_v2.py`: layout constants still in use (gap between units, wing angle, showroom
  size), `place()` and `dir_tube()` for the wing B units.
- `arrangement_v3.py`: `export()`, the glTF writer (y-up turn, smooth shading, moving parts as
  their own nodes with pivots), and `sector()`.
- `arrangement.py`: shared helpers: `ellipse_poly()` (showroom outline), `a_frame()` (stilts
  with crossbar and bowed skis), `firepit()` (ring and logs; the chairs come from camp.py).
- `build_station_v4.py`: the module builder: parameters `P`, materials `MAT`, module shells with
  the cutaway, library, office and workshop interiors (incl. the workshop bench), tubes,
  stairs, and the geometry helpers (`box`, `cyl`, `rod`, unions, `ROT` …).
- `build_station_v3.py`: older parameter set and helpers, still imported by showroom_options.py.
- `showroom_options.py`: showroom interior kit: oval LED wall, speaker rigging on floor towers,
  speakers, ceiling projectors, benches (sculptures switched off); `shell_from()`, `prism()`.
- `construction.py`: the new module under construction (skeleton, two scaffolds, work light),
  and `lattice()`, the lattice mast used by the relay station and the radio dish.

Things around the station
- `vehicle.py`: the expedition van.
- `flora.py`: cacti (candelabra, saguaro), desert bush, agave.
- `camp.py`: the two folding camping chairs, the stack of transport cases with the open hard
  case, the case by the van, and the loose case the figure carries (moving parts).
- `props.py`: dead tree, grass tussocks, relay station (lattice tower, dishes, panel antennas,
  yagis, TV antenna, hut, red beacon), solar field on the hill, hill dressing (boulders,
  bushes, grass, two small cacti), wind turbine with its rotor (moving part) and red aviation
  lights; it calls radio_dish.py.
- `radio_dish.py`: the steerable 40 m radio dish on the hill (reflector, backup structure,
  feed tripod, alt-az mount, rail, stairs, equipment house, plinth).
- `projectors.py`: the three exterior projectors by the showroom (boxes, lids and lift heads as
  moving parts, invisible beam targets).
- `printer.py`: the workshop 3D printer (frame, spool, bed, X bar, head) and the toy robot
  (moving parts).
- `landscape.py`: plateau with bumps, cliff, boulders, the distant hills (`hill_base`,
  `hill_height`), the level pad under the dish; materials for hills, cliff and beacons.

Viewer
- The viewer is `index.html` at the top of the repository (sky and day cycle, moons, figure at
  the camp, printer animation, colour touches, site GUI). The figure, sky and GUI are built in
  that page, not in the .glb. It loads `arrangement_v7.glb` from the same folder.
- To update the site after a rebuild: copy `3d/scripts/arrangement_v7.glb` to the top folder.
- `mktest.sh`: packs a .glb into gzip + base64 for the Cowork preview host, which does not
  serve .glb. Not needed for the real site.
- Rebuilt on a Mac (Python 3.12, 9 Oct 2026): all parts match the live model except
  `hub/shell` (3,480 instead of 3,488 triangles), a numerical difference of the boolean cut
  between Linux and macOS.
