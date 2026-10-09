# Portfolio: research station

Simon Winkler's ("Smo") portfolio site. The main page is a 3D research station (modules on legs, after Halley VI) on a plateau above a cliff, shown as a plaster cutaway model. Each module holds one field of work; the surroundings (camp, van, fire, relay station, dish) hold the person.

## Read first
- `docs/portfolio-concept.md`: decisions, module details, style, open questions
- `docs/gui.md`: site GUI, menu structure, content model, glass style tokens
- `docs/build-log.md`: what was built when, and how the viewer works (day cycle, places, figure, printer, performance)

## Working rules (Smo)
- Change only what Smo asks for. Don't remove or move elements that weren't mentioned.
- When Smo says "ask me before", ask first.
- All texts are placeholders until Smo supplies real ones; keep them marked as such.
- After a change, check it in the browser pane (desktop and phone width) before reporting it done.
- Add a dated entry to `docs/build-log.md` for every built change; update `docs/portfolio-concept.md` when a decision changes.
- Commit with clear messages. Push only when Smo says to publish: a push to `main` goes live.

## Structure
- `index.html`: the whole site and viewer (HTML, CSS, JS in one file; three.js r160 from jsDelivr via import map)
- `arrangement_v7.glb`: the current model, loaded by `index.html` (about 14 MB)
- `3d/scripts/`: Python (trimesh) generators, real-world scale in metres. Complete (Cowork export, 7 Oct). `3d/scripts/README.md` says which file builds which part and how to rebuild (`python3 arrangement_v7.py` in a venv with `requirements.txt`; the result lands in `3d/scripts/`, copy it to the top folder to update the site).
- `camp/`, `safari/`, `assets/`: camp interactions (van interior, photo album, message form) and the Photo Safari minigame, built by cloud runs after the plans in the private repo `smoaf/portfolio-refs`; live since 9 Oct 2026 (PR #1 merged).
- `3d/models/`: earlier .glb exports. `3d/models/arrangement_v7.glb` is an older 5 Oct export, not the current model.
- `3d/renders/`: test renders

## Tech decisions
- Static site, plain HTML/CSS/JS, no build step. Content to move into a data file (`MENU`, `PAGES`, `PLACES` are in `index.html` for now).
- Model coordinates are z-up; the viewer is y-up (`W2T`). In the default view +x is to the left.
- glTF drops the `/` from node names (`library/shell` becomes `libraryshell`); the viewer finds parts by these names.
- Name, role and contact must show without any 3D loading; still-render fallback on weak devices (not built yet).
- Performance plan before launch: compress the model (Draco or meshopt), bake ambient occlusion, fewer live shadow casters and night lights.

## Preview and deploy
- Local preview: `python3 -m http.server 8000` in a clone of this repository, then http://localhost:8000. GitHub is the only copy; there is no permanent folder on the Mac.
- GitHub: https://github.com/smoaf/portfolio (public). GitHub Pages serves `main`; every push updates the live site.
- This repository is public. Never add personal details: who the site is aimed at, applications, contact data beyond what the site shows. Reference images and run plans live in the private repo `smoaf/portfolio-refs`.
