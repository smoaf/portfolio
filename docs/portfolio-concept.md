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
- 8.5 m long. iMac-style all-in-one computer (unbranded) angled on a desk, reading chair corner, standing lamp, bookshelves.
- Content: science, publications, thesis.

### Office (collaborative)
- Calm, sparse, low-hierarchy look after Apple's event stills: slab tables, wooden chairs, few screens, glass meeting room with high table and bar stools, lounge corner.
- Content: product management, case studies (assumed, to confirm).

### Workshop
- Measurement devices, prototypes, cables, server room behind glass. Content: information about AI.

### Showroom
- Twelve-sided oval, 11.8 × 19.2 m, walls 7.2 m. The tallest building (top 9.4 m above ground).
- Roof as a jalousie: 21 slats that turn on their long axis.
- Continuous window band round the walls (about 1.7 m high, from 3.8 m above the floor), filled with 85 vertical fins. Fins and slats open and close together on the same click, in one wave. Open by default.
- Interior: 360 degree screen ring, immersive (Atmos-style) speaker rigging on floor towers, projectors, plaster sculptures for projection mapping.
- Content: media work.

### Hub
- Same round shape, 10.8 m across. Lower than the showroom, taller than the modules: walls 4.9 m and a flat dome, top about 7.5 m above ground (modules 5.9 m, showroom 9.4 m).
- Plaster wall only up to hip height (1.0 m above the floor), glass sides above and a low glass dome. Calm frame: 24 mullions, one transom, 24 radial ribs and two rings on the dome. Plaster collars where the tubes come in, a frame round the door.
- Inside: round table with stools, ring lamp hanging from the dome, curved bench, free-standing intro panel. Entrance door and outside stair on the outer side.
- Content: name, intro, contact, CV.

### Van
- Expedition camper in the style of a Mercedes 208: 208 body with short bonnet, raked windscreen, dark grille band with square headlights; big all-terrain tyres with arch flares; bull bar, snorkel, railed roof deck, roof box, jerrycans, light bar, ladder, spare wheel, awning. No badges, no plates.

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
