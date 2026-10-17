# Night run 03: new safari species and album notes

Status: approved by Smo, 16 Oct 2026
Effort: heavy
Depends on: nothing
Branch: `night/03-safari-species-and-notes`

## Goal
Add three new things to the Photo Safari and hint at the time-bound ones with handwritten notes in the van's photo album.

## Background
- The safari already follows the station's day/night cycle: a route started from the van takes the current time of day (`timeOfDay()` in `index.html`, around line 2530) as dawn, day, dusk or night. There is no switch, and none is added.
- Each route already has `secrets`, animals that only appear at certain times (`safari/routes/canyon.js` around line 99, `safari/routes/jungle.js` around line 53). The van's field log (`safari/fieldlog.js`) reads them and hints at them. It stays as it is.
- Species live in `safari/fauna/` and follow the existing pattern: a `SPECIES` entry (id, name, points, call) and a builder in `BUILDERS`. Glow uses the kit's existing glow level per time of day (`safari/kit.js`, `GLOW`).

## 1. Sea anemones in the canyon pool
- **Where:** the canyon's pool, next to the axolotl and the lantern tetras (`safari/fauna/pool.js`).
- **When:** always there, at every time of day. Not a secret.
- **Look:** a small group of anemones on the pool floor or rocks, tentacles swaying slowly in the water.
- **Night:** they glow. Use the kit's glow level so they are faint by day and bright at night.
- They can be photographed and count like the other species.

## 2. Jellyfish in the jungle
- **Where:** the jungle's brackish estuary (`safari/fauna/estuary.js`).
- **Behaviour:** they drift below the surface and rise up to it at certain times.
- **Glow:** they glow at certain times (see open questions).
- They can be photographed and count like the other species.

## 3. Fluorescent mushrooms in the jungle
- **Where:** the jungle forest floor (`safari/fauna/forest.js`).
- **When:** only at night. Add them to the jungle route's `secrets` with `when: 'NIGHT'`, next to the poodle moth.
- **Look:** small clusters on fallen wood or at the foot of trees, glowing softly.
- They can be photographed and count like the other species, so the existing found / not found logic of the field log covers them.

## 4. Notes in the photo album
- **Where:** the van's photo album (`camp/album.js`, laid out from `assets/album/index.json`).
- **What:** small handwritten-looking paper notes, stuck onto existing photo pages with a strip of tape like the photos (reuse the album's tape style). Spread them over different pages, not all on one.
- **Content:** one note per time-bound find. The texts are placeholders and must be marked as such in the data, for example:
  - "Night in the jungle: glowing mushrooms on the forest floor."
  - "Jellyfish rise in the jungle's river at [time]."
  - "After dark the anemones in the canyon pool light up."
- Store the notes in the album's data (for example a `notes` list per page in `assets/album/index.json`), not as text inside the code, so Smo can change them without touching code.
- Notes must not cover a photo's important part. A note may overlap a photo's corner.

## Rules for this run
- Follow `CLAUDE.md`. Do not change existing species, routes, scoring or the field log beyond adding the new entries.
- Do not use or copy anything from `smoaf/portfolio-refs`. Build the new species from scratch in the existing low-poly style.
- Keep the frame rate: reuse geometry and materials, use instancing for groups (as the lantern tetras do), and allocate nothing per frame.
- Test each species with `window.__explore('canyon', tod)` and `window.__explore('jungle', tod)` for all four times (dawn, day, dusk, night). Test the album at desktop and phone width. No console errors.
- Add a dated entry to `docs/build-log.md`.

## Finish
- Open a pull request into `main` from `night/03-safari-species-and-notes` with screenshots of each new species (day and night where it changes) and of the album pages with notes.
- Then merge it into `main` as described in `README.md` ("Every run", step 4). Smo tests the live site instead of reviewing the code.

## Decide on your own
Nobody is available during the night run. For each point below, choose the sensible option, build it, and state the choice in the pull request so Smo can change it.
- **Jellyfish times:** at which times of day do they rise to the surface, and at which do they glow? For example rise at dusk and glow at night.
- **Jellyfish secret or not:** always in the river (only rising and glowing at certain times), or only there at those times as a secret with a field log entry?
- **Points:** the run picks points similar to the existing species (130 to 260) and states them in the pull request.
