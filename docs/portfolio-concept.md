# Portfolio website: concept and decisions

Status: concept and 3D studies, October 2026. Build progress is in build-log.md.

## Decisions so far
- One site, no gate at the start.
- Central metaphor: a research station of linked modules on legs, one building per purpose, inspired by the concept of Halley VI (Hugh Broughton Architects, 2013), shown as a cutaway model.
- Setting: a flat mountain plateau ending in a real cliff about 12 m in front of the station. Very little plant life: two cacti (4.2 m and 5.0 m) behind office and workshop, low desert bushes in the far corner, agave-like rosettes in front between hub and library, one desert bush with a rock beyond the hub. Smo wants the cacti kept.
- The modules hold the work. The surroundings hold the person and personal interests.
- Surroundings: expedition camper van in the style of a Mercedes 208 (T1 series), unbranded, and a firepit with two seats, near the cliff edge beyond the workshop (the arrangement 03 position, which Smo wants kept). At night a fire burns in the pit with a flickering light.
- The next module is shown under construction (clean: skeleton, scaffolding, stacked panels; no crane, no fence, no rocks on the site).
- The 3D model can be rotated by the viewer. Later: camera flies into a module, and each room gets a detailed version that loads on fly-in. Named parts can later show images or video or become clickable.
- Every module is also a normal page with its own link and a plain menu twin.
- Name, role and contact visible without any 3D loading. 3D loads after text, still-render fallback on weak devices.
- Tech: static site, plain HTML/CSS/JS, three.js included as a local file, models as .glb files, content in a data file. No build step. Deploy by uploading the folder to a static host.
- 3D is generated from code (Python with trimesh), real-world scale in metres.
- Lighting: cut-away parts stay in the model as invisible "ghost" parts that still cast shadows. A soft shadowless fill keeps rooms readable. At night, lights are placed automatically from named parts.
- Interaction so far: click the showroom (or the Roof buttons) to turn its roof slats and window fins open or closed in one wave.
- Working note: change only what Smo asks for. Don't remove or move elements he didn't mention. When he says "ask me before", ask first.

## Arrangement (arrangement 06, 5 Oct 2026)
Two wings from the hub. Wing A along the cliff edge: hub (entrance) – library – office – workshop. Wing B leaves the hub at 60° to wing A, swinging in behind the library: showroom – next module under construction (museum and curation?). Short closed tubes between all units. Van camp near the cliff edge beyond the workshop.

## Terrain (arrangement 06, Smo's choices)
- Flat plateau, no rising slopes or peaks behind.
- Floor detail kept light: very slight unevenness, a few low smooth outcrops and sparse boulders, away from the buildings.
- Front: a sheer cliff about 30 m high with soft vertical jointing, wavy edge line in plan. It fades out downwards into the backdrop.
- Outer edges of the plateau fade out into the backdrop; no visible border.
- Replaces the plaster block with striped front face (Smo didn't like the stripes).
- References in Downloads: 21_FYS_Biobasis_feltstation03_HeLu_2.jpg (Greenland field station on smooth bedrock), 4fcd82d0-...webp (station at the edge of a dark jointed cliff with snow), Sermilik-Meeresperspektive.jpg (huts on rocky slope with boulders), skylodge-...-designboom-01.jpg (glass pods on a sheer cliff).

## Station concept
Inspiration: Halley VI, British Antarctic Survey. Borrow the concept (modules on legs with skis, linked units, a larger hub, the station can move), not the design. Story: a station that relocates and gains modules over time, matching a career across several fields. The module under construction makes that story visible.
https://www.dezeen.com/2013/02/06/halley-vi-worlds-first-mobile-research-centre-opens-in-antarctica/

## Module details (from Smo, 5 Oct 2026)

### General, all modules
- Connecting tubes are closed and short. Modules 5.8 m deep.
- Cut: front wall down to a parapet, only a strip of roof along the front open, end walls and most of the roof closed.
- Stilts: A-frame with two splayed legs joined by a horizontal crossbar, no centre leg. Skis bowed upwards at both ends.
- Linear ceiling light strips.

### Library
- 8.5 m long. All-in-one computer (unbranded) square on the desk, facing the chair (was angled; straightened 15 Oct 2026), reading chair corner, standing lamp, bookshelves.
- Simon's own things (15 Oct 2026, LIBRARY_PLAN L1): on the shelf his waving lucky cat, a small terrarium in a glass carafe and a painted porcelain vase (some books taken out to make room); a big monstera in a terracotta pot and woven basket on the left by the window. The cat waves while the room is open or in view; clicking it zooms the camera close to it, nothing else.
- The computer holds Simon's papers (15 Oct 2026, LIBRARY_PLAN L2): clicking it brings the camera close until the screen almost fills the view, and the screen shows a plain list of papers in the site's style. For now one entry, his bachelor's thesis (HRTF Acquisition Methods, St. Pölten University of Applied Sciences, 2022, German), with one button, Open, which opens the PDF in a new tab (no download button). The list is `library/papers.json`; more papers will be added by Simon later.
- Content: science, publications, thesis.

### Office (collaborative)
- Calm, sparse, low-hierarchy look after Apple's event stills: slab tables, wooden chairs, few screens, glass meeting room with high table and bar stools, lounge corner.
- Content: product management, case studies (assumed, to confirm).

### Workshop
- Measurement devices, prototypes, cables, server room behind glass. Content: information about AI.
- Interactive stations (build plan in progress, Oct 2026): 3D printer on the back bench; the wider assembly table is the desk, with oscilloscope, power amp and modular synth at the back and the solder station (fuzz pedal) and tape delay at the front; the big rack on the left becomes the server rack with an AI game. The drone moved to the back wall; the three old bench devices are replaced by the desk's electronics. Back of the desk from left to right on screen: modular synth (two-row wooden skiff), power amp right beside it (it was behind the laptop), oscilloscope. Visitors can print one of five small models or upload their own .glb/.stl (it stays in their browser). Front of the desk, right half on screen: the solder bench tells how the fuzz pedal was made (schematic, breadboard, multimeter, iron); the finished pedal is playable with a guitar loop from a small audio interface, or with the synth. Front of the desk, in front of the synth: Simon's own tape delay after his prototype (clear acrylic case, tape loop, five playback heads, switchable erase head for sound on sound, motor speed bends the pitch), playable with a demo loop or the synth; the recorded sound shows as a glow travelling along the tape; a card beside it tells its story (EPOCH, two days of nonstop running, wear). The bank of racks on the left plays Mind reader: rock, paper, scissors over 20 rounds against the rack, which learns the visitor's habits live (small predictors plus a tiny network, the best one leads) and says honestly what it spotted; screens, LEDs and fans on the racks show the score, how well it knows you and its guess after each round. Nothing is stored. All stations share one sound chain (synth → fuzz → delay → amp) at balanced levels with one mute (M); the rack's fan hum and blips go straight to the master.

### Showroom
- Twelve-sided oval, 11.8 × 19.2 m, walls 7.2 m. The tallest building (top 9.4 m above ground).
- Roof as a jalousie: 21 slats that turn on their long axis.
- Continuous window band round the walls (about 1.7 m high, from 3.8 m above the floor), filled with 85 vertical fins. Fins and slats open and close together on the same click, in one wave. Open by default.
- Interior: 360 degree screen ring, immersive (Atmos-style) speaker rigging on floor towers, projectors, plaster sculptures for projection mapping. The ring screen plays Simon's 360° panorama "Echoes 2026" all the way round (Oct 2026, `media/media.js`); it loads only while the showroom is the open place, the still shows meanwhile.
- Content: media work.
- The robot (night run 07, Oct 2026, `showroom/`): a small six-legged robot lives on the showroom floor, after Smo's base model and five video stills of a real robot. White dome of six petal segments over a dark frame of servos and wires; each leg carries one white plate shaped like an orange-peel segment, its tip being the foot. Folded, the six plates and six petals close into a sphere. About 0.9 m across in the showroom (1.5 times the real robot, so it reads from the visitor's spot), no eyes, no lights. It wanders on its own (idles, walks, turns, looks at the visitor, crouches, stretches; rarely the crown, rolling as a ball, a spin, a wave), sleeps as a ball at night and wakes at dawn. Hover: it stops, turns and leans in, and glows a little; a click plays the next big animation of a short story (crown, fold and roll and bloom, spin, wave, stretch).

### Hub
- Same round shape, 10.8 m across. Lower than the showroom, taller than the modules: walls 4.9 m and a flat dome, top about 7.5 m above ground (modules 5.9 m, showroom 9.4 m).
- Plaster wall only up to hip height (1.0 m above the floor), glass sides above and a low glass dome. Calm frame: 24 mullions, one transom, 24 radial ribs and two rings on the dome. Plaster collars where the tubes come in, a frame round the door.
- Inside: round table with stools, ring lamp hanging from the dome, curved bench. Entrance door and outside stair on the outer side. The free-standing intro panel is gone (Oct 2026); instead four screens hang from the dome on thin cables: one 16:9 screen in the middle and three 2:3 poster screens (two left, one right), each playing a slideshow of images (`hub/screens.json`; placeholders: Simon's series "Rohrschach reimagined"). The middle screen plays the four "Other windows" films instead (one at random, then another; only while the hub is the open place, the film's still meanwhile); its images stay as the fallback.
- The hub's view stands at the top of the stairs, just inside the door, looking into the room towards the screens.
- Content: name, intro, contact, CV.

### Van
- Expedition camper in the style of a Mercedes 208: 208 body with short bonnet, raked windscreen, dark grille band with square headlights; big all-terrain tyres with arch flares; bull bar, snorkel, railed roof deck, roof box, jerrycans, light bar, ladder, spare wheel, awning. No badges, no plates.

### Radio telescope (was "Radio dish")
- The big steerable dish on the hill (after the Stanford Dish photos). Renamed "Radio telescope" (Oct 2026); the place id stays `dish`.
- Interactive (relay plan, phase R1): a click turns it to the sun or a moon above the horizon (the one nearest its pointing) and it keeps following that object; a second click parks it. With nothing in the sky it sweeps once and says "Nothing in view". The relay station's radio room (phase R2) uses it for a moon-bounce signal. It prefers a target it can really point at (10° up or more; the dish stops at 14°) over a nearer one just over the horizon (phase R3).

### Relay station
- Lattice tower with dishes and a small equipment hut (props.py). The hut has a window on the side the relay view looks at, lit warm at night (relay plan, phase R2).
- Click the hut to sit inside: a small radio room after Smo's references (vintage receivers on a pine desk, Morse key, desk microphone, clock, map). Its receiver plays "Tune in": find eleven stations on the band by ear and by the S-meter, each gives a QSL card; a twelfth, the moon bounce, only answers while the radio telescope tracks a moon. Texts on the air are placeholders. Difficulty (phase R3): a station is heard faintly and the needle stirs about 0.1 MHz before it comes in, and letting go within 0.08 MHz settles on it, so each one takes seconds.

### Still open
- Next module (under construction): museum and curation?

## Style direction
- Main style reference: Chisel & Mouse plaster architectural models (https://chiselandmouse.com/collections/all-model-buildings). Cast fine white plaster, crisp sharp edges, fine details as black etched-metal linework.
- Same plaster language applied to the cutaway, interiors in plaster too. Screens, frames, rails, tyres and lamps in black linework. Glass only on the hub, faintly tinted, framed in black.
- Ornament: keep it calm and structural, not playful.
- Terrain in the same plaster tone, detail kept light; edges and cliff bottom fade into the backdrop.
- White-beige palette. Colour comes mostly from light; the night fire is the warmest point.
- Day and night versions. Day sun direction (front or back) still to choose.

## Reference images (in Smo's Downloads folder)
- pantheon-model-cutaway-*.webp, images.jpeg: plaster and 3D-printed Pantheon cutaways.
- Gemini_Generated_Image_*.jpg: Smo's generated concepts.
- House-cutaway-energy-saving-1200px-1024x1024.jpg, images-2.jpeg / images-3.jpeg: plain CAD cutaway, basswood models.
- antartic-architecture-hugh-broughton_dezeen_2364_sq_0-1704x959.jpg: Halley VI.
- Screenshot 2026-10-05 at 17.59.14 / 18.00.13 / 18.00.44 (.png): office and lab references from Apple event stills.
- 951-12-medium.jpg, Mickey17_DNEG_ITW_01.webp, Abenteuer_Erzberg_...jpg: van references.
- images-4.jpeg, images-5.jpeg: cactus references.
- Terrain references: see the Terrain section.

## Open questions
- Day sun direction: front or back
- Next module: museum and curation?
- Whether a mockup figure sits in one module
- Which works become 3D exhibits and which stay as pages
- File size: arrangement 06 is about 7.4 MB as .glb (preview bundle 9.9 MB). Compress (Draco or meshopt) before the real site.
