# Portfolio station: build log

Preview page (always the latest study): https://claude.ai/artifact/DBbr3R7miiUED3joKHY2si
The artifact host does not serve .glb, so the preview loads the model from a script file: the .glb gzipped and base64-encoded (`window.MODULE_GLB_GZ`, unpacked in the browser with `DecompressionStream('gzip')`; `mktest.sh` makes it). The plain base64 version hit the 16 MB per-file limit once the first dish was added. The real site will load the .glb directly.
Scripts and .glb files are sent to Smo in the chat with each study.

## 5 Oct 2026: Studies 01 to 04
- `build_module.py`, `build_station.py`, `build_station_v3.py`, `build_station_v4.py`. Library module, cut and ghost parts (`*/ghost_shell`, material "ghost", seen only by shadow cameras), tubes, office after Smo's reference stills, A-frames with crossbar, ceiling light strips (material "lightstrip"). Night lights placed from part names (glTF strips the '/', so names read like 'libraryshell').

## 5 Oct 2026: Showroom shape options
- `showroom_options.py`. Smo chose the twelve-sided oval. `interior()` has `towers=True` for floor-standing rigging.

## 5 Oct 2026: Arrangements 01 to 05
- `arrangement.py`, `arrangement_v2.py`, `arrangement_v3.py` (jalousie roof, `vehicle.py`, `flora.py`, `construction.py`), `arrangement_v4.py` (fire at night, window fins, glass hub, bushes and agaves), `arrangement_v5.py` (lower hub, cacti and camp restored, `CAMP_SHIFT`).

## 5 Oct 2026: Arrangement 06
- `arrangement_v6.py` + `landscape.py`: plateau with a real cliff, fades in the viewer (`addFade()` on 'ground' and 'cliff', ellipse radii 88 × 64 m, cliff fade 3–24 m below the plateau). Plateau back edge at y = -80. Cliff edge with `DENTS` and wobble, jutting rock columns and two ledges. Camp shifted `CAMP_SHIFT = (2.1, -2.1)`.

## 5–6 Oct 2026: Arrangement 07 (on the preview page)
- `arrangement_v7.py` (about 283k triangles; .glb about 13 MB, preview bundle about 5 MB gzipped). Builds the v5 station with terrain capture, adds props, projectors, the 3D printer, camp cases and the movers, then builds the terrain last so it can flatten under everything that stands on it.
- Floor bumps (`landscape.bumps`), flattened near anything standing on the ground (`set_flat_points()`).
- `props.py`: dead tree, three grass tussock patches, relay station at (46, -30) with the hut between the guy wires and a red blinking beacon (material "beacon").
- Relay station extra antenna (Smo, after Downloads/01mm-dc21a.png): `props.tv_antenna()` on the top mast at h + 2.55, boom 5 m tilted up 7°: 14 small V-shaped directors in front, clamp, two VHF elements, a folded dipole loop, two long rear elements, a brace to the mast.
- Distant hills: `landscape.HILLS`, `hill_base()` (the plain hills) and `hill_height()` (with the small dish pad) are shared. Three low hills (18–26 m) centred at y -125 to -155, mesh on a 5 m grid. Viewer `hazeFade(m, base, strength)`: alpha fades at the sides and, for hills, at the base; fog near/far = camera distance + 50 / + 300.
- Note: in the default view +x is to the left (also in the module cutaway views).
- Default view (viewer `HOME`, Smo: lower, part of the turbine in view): camera (37, 24, -75), target (-5, 12, 20) in three.js coordinates. On narrow screens the camera steps back until 64 m of width fit (`HOME_FIT`, `fitPose()`).
- Solar field on the hills (`props.solar_field_on_hill`, settings in `props.SOLAR`): centre (-60, -115); 7 rows × 11 tables = 77 of 3.4 × 1.7 m, rows 4.2 m apart, turned a further 35° so the rows run diagonally across the view. `hazeFade(…, true, 0.32)`.
- Hill dressing (`props.hill_dressing()`, Smo): 2 small cacti, 8 boulders, 7 desert bushes, 5 grass patches round the solar field, kept clear of the field, turbine, dish and each other. Nodes `props/hill_*`.
- Radio dish (`radio_dish.py`, Smo: the steerable kind, ON the hill, after his Stanford Dish photos; the first try, sunk into a carved hollow, was dropped): centre (15, -155), 40 m dish on an alt-az mount with lattice A-frames, rail, bogies, stairs and equipment house; small level pad `landscape.PAD`. Static for now.
- Wind turbine on top of `HILLS[0]`: 40.5 m hub height, 18 m blades (Smo: smaller twice), turning rotor node, no shadow; three red aviation lights (`props/aviation_light_0..2`) blinking at night with the relay beacon.
- New module under construction (`construction.py`; Smo: "new module" everywhere): two scaffolds, one work light; top guard rails removed.
- `projectors.py`: three projectors on the showroom's right-hand facets, lid and lift animation, spotlights with a split canvas at night; placeholder content.
- Viewer: scroll zoom `zoomSpeed` 7 with `zoomToCursor`.

## 6 Oct 2026: Showroom changes (Smo)
- LED wall is a smooth oval (`screen_shape`); sculptures removed; closed fins and slats overlap and reach into the frame so no light gets in; viewer `showDark` fades sky and environment light inside the walls as the roof closes and the fill light while the camera is inside.

## 6 Oct 2026: Camp (Smo)
- `camp.py`: folding camping armchairs after Smo's photo; rugged transport cases after his photos (stack with an open hard case on top, a case by the van, a loose case as mover nodes `camp/carry_case` and `camp/carry_case_black`).
- Viewer figure: plaster figure carrying the loose case round the van by day, working at the open case, sitting in the left chair (seen from the camp view) at night; walks a path graph round the van; contact shadow discs while moving.

## 6 Oct 2026: Workshop 3D printer (Smo)
- `printer.py`: open-frame bed-slinger printer at the left end of the back bench (centre (12.05, -2.30), left as seen from the open front = +x), 0.50 × 0.46 × 0.56 m: base with screen and knob, two uprights with Z rods, top bar, Y rails, spool holder on the outer side with a spool in material "filament", filament line to the top. Moving nodes: `workshop/printer_bed` (slides in y), `workshop/printer_xbar` (rises with the layers), `workshop/printer_head` (moves in x, rises), `workshop/printer_toy` (a 20 cm toy robot: feet, legs, body with chest panel, arms, hands, neck, head with eyes, antenna).
- Viewer (`PRN`): a 48 s print and a 7 s pause in a loop; the toy is cut off above the current layer with a clip plane (its own material, double-sided), the head darts over the part's width at that height, the bed slides, the X bar climbs; when done the head parks. Entering the workshop starts a new print. Reduced motion: shows it 60 % printed. Test hook `__print(u)`.
- Note: the accent setup must run before the printer setup (cloning a material copies its clip planes, which broke the reveal once).

## 6 Oct 2026: Colour touches (Smo: rooms looked stale, especially by day)
- Viewer (`PALETTES`, `ACCENT_ROLES`, `setupAccents`, `applyAccents`): the model stays plaster; chosen pieces take colour from a palette, blended with their plaster colour by a strength setting. Roles: fabric 1 (library reading chair, office sofa, hub bench, showroom bench, camping chair fabric), fabric 2 (office lounge chair, hub stools), wood (office chairs, workshop crates), rug (library rug), signal (book on the side table, coffee cups, cable spools, the printer's toy and spool, the loose camp case), books (each book its own colour; books are told apart by connected vertices, colours as vertex colours), screens (library computer, office meeting screen, workshop device screens, laptop: faint glow, by day too).
- Palettes: Field (default: burnt orange, deep teal-grey, camel, walnut, brick red), Mid-century (rust, olive, mustard, teak), Lab (signal orange, cobalt, mint). Sky panel section "Colour": strength (default 0.7) and palette; saved with the sky settings.
- This changes the earlier style rule (white-beige, colour only from light): plaster stays the base, colour now comes as small touches on objects.

## 6 Oct 2026: Day cycle (Smo)
- Smo: visitors stay up to about 10 minutes, so the cycle must be noticeable but need not update every frame; not planet Earth.
- `SKY_DEFAULTS` = Smo's chosen settings: 4 minutes per day, noon sun from -120° with a 47° path tilt, shorter days (-0.3), sun hue 138, dusk hue 31, sky hue 214 (saturation 0.78), night hue 156 (brightness 0.1), sun step 0.1 s.
- Two moons (Smo: blue one removed), each on its own orbit: moon 1 pale gold/orange, 1.2°, speed 0.1, highest at midnight of the first night towards -180°, tilt 76°; moon 2 orange-red/crimson, 0.8°, speed 0.43, highest at 20:00 towards 135°, tilt 58°, oval orbit (±50 % size, `m2Swing`). Glow, horizon reddening, partial phase shadow, light procedural surface (craters and patches), pale and almost glowless by day. Per-moon and shared sliders.
- Cost: colours per frame; key light in steps with only the sun's shadow map redrawn (`markSun()`); moving shadow casters redraw all maps once (`markShadows()`). Sky sphere with sun, moons and stars; haze takes the horizon colour.
- Lamps, light strips, fire and projectors come on 30 minutes later in the evening than darkness alone would say (Smo); mornings unchanged. Day/Night buttons jump to 10:05 and 22:20.
- Sky panel: sliders, fps readout with quality step, Copy settings, Reset; settings in localStorage 'station-sky'.

## 6 Oct 2026: Frame rate (Smo saw 8 fps)
- Pixel ratio capped at 1.5; sun shadow map 2048; PCF shadow filter; lamps' shadows no longer redraw on sun steps; small screen and laptop lights removed (23 → 18 lights); adaptive quality steps down below 40 fps (medium: no ambient occlusion, pixel ratio 1.25; low: pixel ratio 1, sun shadow map 1024).
- Headless comparison (software rendering, ratio only): day about 2–3× and night about 4× faster. Not yet measured on a real laptop or phone.

## 6 Oct 2026: Places (navigation framework)
- Tap a bigger zone round a thing to fly to its view; markers only with the Places button; hub and showroom entered and looked round 360°; no text box; hover name after 0.65 s rest, fixed above the place, hidden as soon as a drag starts (Smo); arrows: from the camp ‹ relay station, › workshop.
- `PLACES` (to move into the content data file): order hub, showroom, new module (#new-module), radio dish, relay station, camp, workshop, office, library. View types `cutaway`, `object`, `inside`; `fit` for narrow screens; flights 1.2 s; nav bar, Esc, arrow keys, browser back, hash links. Showroom roof opens on entering; workshop starts a new print on entering.
- Tests (headless): places, arrows, browser back, hash links, phone taps, showroom, figure, hover label, cycle, moons, frame rate, printer half and fully printed, rooms with colour touches. No page errors.

## Performance notes (not yet measured on real devices)
- Still heavy: ambient occlusion on "high"; at night 3 shadow-casting point lights plus 3 spot shadows and 12 more point lights; about 250 separate meshes; transparent faded materials; 13 MB model.
- Plan for the real site: compress, bake ambient occlusion and drop GTAO, fewer live shadow casters, fewer or baked night lights, merge static meshes, draw fewer frames when nothing moves, load room details on fly-in, play room media only in view.
- Where the work runs: model building and test renders on the cloud workspace; the preview on the viewing device's GPU.

## Next
- GUI design language for the site and the game layer.
- Activities per place (minigames) on top of the places framework; the printer could become the first one (choose what to print).
- Real projection content (one video or image from Smo).
- Performance pass and compression for the real site.

## 7–9 Oct 2026: Moved to Claude Code, GitHub and GitHub Pages
- Project folder `~/Sites/portfolio`, Git history rebuilt from Station Model Studies 1–5 (Study 6 was identical to 5 and to the preview page). Repository https://github.com/smoaf/portfolio (public), live at https://smoaf.github.io/portfolio/ (every push to `main` goes live).
- The site loads `arrangement_v7.glb` directly (unpacked from the preview bundle); `arrangement_v7.js` is gone. `viewer.html` is now `index.html`.
- Notes: the concept, GUI notes, this log and CLAUDE.md were kept off GitHub at first; private details were then removed and they are in the repository (`docs/`, `CLAUDE.md`).
- Generator scripts complete in `3d/scripts/` (Cowork export of 7 Oct). Rebuilt on the Mac: identical except `hub/shell` (3,480 vs 3,488 triangles, Linux vs macOS boolean cut).
- `3d/models/` holds older exports; its `arrangement_v7.glb` is the 5 Oct version, not the current model.
- 9 Oct: complete generator scripts on `main`; page title "Simon Winkler"; Camp & Photo Safari (PR #1, 33 commits from the cloud runs) merged and live. Local copies on the Mac moved to the Trash after checking every file is on GitHub; GitHub is the only copy now.
