# Portfolio: research station

Simon Winkler's ("Smo") portfolio site, live at https://smoaf.github.io/portfolio/. The main page is a 3D research station (modules on legs, after Halley VI) on a plateau above a cliff, shown as a plaster cutaway model. Each module holds one field of work; the surroundings (camp, van, fire, relay station, radio telescope, wind turbine) hold the person. Small interactive things (printer, synth, radio, cat, safari) live inside the 3D.

## Start here
- `docs/open-items.md`: what is still open per area, and the suggested refactors. Read this first.
- Read other docs only when the task needs them: `docs/portfolio-concept.md` (decisions, module details, style), `docs/gui.md` (menu, content panels, glass style), `docs/build-log.md` (long history of how things were built).
- What each feature does and how to use it: the pull request descriptions, #1 camp & Photo Safari, #2 workshop, #3 relay & telescope, #4 library, #5 hub, #6 media.

## Working rules (Smo)
- Change only what Smo asks for. Don't remove or move elements that weren't mentioned. When Smo says "ask me before", ask first.
- All texts are placeholders until Smo supplies real ones; keep them marked as such.
- Check every change in a browser (desktop and phone width, day and night) before calling it done. No console errors.
- Work on a branch with a pull request. A push or merge to `main` goes live, so only on Smo's go.
- Add a dated entry to `docs/build-log.md` for every built change; update `docs/open-items.md` when something is fixed or found.
- This repository is public. Never add personal details (who the site is aimed at, applications, private contact data). Reference images live in the private repo `smoaf/portfolio-refs`; copy nothing from it except files Smo explicitly releases.
- No brand names or logos anywhere (van, camera, screens, props).
- GitHub is the only copy; there is no permanent folder on the Mac. Work in a fresh clone or a cloud session.

## Map
- `index.html`: the page and the viewer core (2,650 lines): CSS and GUI, light, model loading, projectors, showroom dark, the camp figure, colour touches, sky and day cycle, showroom roof, places and navigation (`PLACES`), camp interactions, site GUI (`MENU`, `PAGES`), pause/resume, the area hosts, test hooks (`window.__*`).
- Areas, each in its own folder and exporting one object with `setup(host)`, `step()`, and as needed `tap`, `hover`, `arrive`, `reset`, `resume`. `index.html` builds a host object per area (near the end) and calls these by hand:
  - `workshop/`: station framework (`stations.js`) and the stations: printer, amp, scope, synth, solder + fuzz, tape delay, rack (mind reader). `layout.js` places the bench at load.
  - `relay/`: `telescope.js` (radio telescope tracks sun and moons), `house.js` + `room.js` + `radio*.js` + `cards.js` (relay hut, radio room game).
  - `library/`: room details, waving cat, computer with `papers.json`.
  - `hub/`: hanging slideshow screens (`screens.json`).
  - `media/`: showroom 360° video and hub films (files in `assets/media/`).
  - `showroom/`: the six-legged robot on the showroom floor: `robot-model.js` (built from `assets/robot/orbweaver.glb`), `robot-motion.js` (IK, gait, blended clips), `robot.js` (behaviour, hover, click).
  - `camp/`: van interior with start screen, photo album, message form (`config.js` holds `FORM_ENDPOINT`). The camp click logic itself is still in `index.html`.
  - `safari/`: Photo Safari minigame, loaded only when a route starts. `index.js` engine, `routes/` canyon and jungle, `fauna/` species, `hud.js`, `photo.js` scoring, `fieldlog.js`, `leaderboard.js`, `audio.js` (also used by media, relay and workshop).
- `assets/`: album photos, hub placeholders, media videos, the thesis PDF (public on purpose).
- `arrangement_v7.glb`: the station model (14 MB), loaded by `index.html`.
- `3d/scripts/`: Python (trimesh) generators that build `arrangement_v7.glb`; `3d/scripts/README.md` says which file builds which part and how to rebuild. Copy a rebuilt `.glb` to the top folder to update the site.

## Tech
- Static site on GitHub Pages: plain HTML/CSS/JS ES modules, no build step, no backend. three.js 0.160 from jsDelivr via the import map in `index.html`.
- Model coordinates are z-up; the viewer is y-up (`W2T`). In the default view +x is to the left. glTF drops the `/` from node names (`library/shell` becomes `libraryshell`); code finds parts by these names.
- `localStorage` only for per-visitor data (sky settings, field log, leaderboard), every access in try/catch.
- Preview: `python3 -m http.server 8000` in the repository, then http://localhost:8000. Test hooks: `window.__go('workshop')` flies to a place, `window.__explore('canyon', 'day')` starts a safari route, `window.__set({ mode: 'night' })`.
