# Night run 05: safari pacing and animals

Status: approved by Smo, 16 Oct 2026
Effort: heavy
Depends on: 03 (merged), so the new species are part of the checks
Branch: `night/05-safari-pacing-and-animals`

## Before you start
Check that night run 03 is merged into `main`: `safari/fauna/pool.js` has the anemones and `safari/routes/jungle.js` lists the mushrooms as a secret. If not, do nothing, open no pull request, and report "Night run 05 skipped: run 03 is not merged yet."

## Goal
Give the visitor time to see and photograph the animals. The van slows down where it matters and speeds up where nothing is lost. No animal is placed where it can never be seen.

Files: `safari/routes/canyon.js` and `safari/routes/jungle.js` (`seconds` and `speedAt(u)`), `safari/rig.js` (how speed is applied), `safari/fauna/*.js` (animal behaviour), `safari/index.js` (feed, hints).

## 1. Slower overall
**Now:** the canyon takes 92 seconds, the jungle 96 (`seconds` in each route). The van is too fast to see the animals properly.

**Expected:** a slower base speed. The run picks the new length after playing both routes and states it in the pull request, together with the old one.

## 2. Speed by section
Use each route's `speedAt(u)` to vary the speed along the route:
- **Faster** where the scenery is the point, for example passing through a swarm or a flock.
- **Slower** at the especially striking animals, so they can be photographed well.
- **Slower** on sections where an animal can only be photographed with the zoom (shy or distant ones).
- Speed changes are smooth. The van never stops completely, unless a route already does that.

The pull request lists each section with its speed and the reason.

## 3. Zoom hint
On the first section that needs the zoom, show a short hint on how to zoom:
- Phone: "Pinch to zoom"
- Desktop: "Scroll or pinch the trackpad to zoom"

The hint goes away as soon as the visitor zooms once and does not come back during that run. It fits the viewfinder style (see night run 04 if merged).

## 4. Animals turn around for feed
**Now:** some animals show their back to the van.

**Expected:** when feed is thrown, every animal currently facing away turns to face the van, no matter where the feed lands. Keep it simple: one rule for all species, no per-species logic beyond what is needed for the turn to look natural. Animals that already face the van are unchanged.

## 5. No animal that can never be seen
Check every species on both routes, at all four times of day (dawn, day, dusk, night):
- Is it ever inside the camera's view along the route, given how far the view can turn and zoom?
- Is it hidden behind rocks, trees, water or terrain the whole time?
- Is it too dark to make out at night even with the flashlight?

Fix the placement of every animal that fails. List all checks and results in the pull request as a table (species, route, time, visible yes or no, what was changed).

## Rules for this run
- Follow `CLAUDE.md`. Don't change the viewfinder, controls, film or report. Those belong to night run 04.
- Keep the frame rate: nothing allocated per frame.
- Test with `window.__explore(route, tod)` for both routes and all four times at desktop and phone width. Play each route through at least once. No console errors.
- Add a dated entry to `docs/build-log.md`.

## Finish
- Open a pull request into `main` from `night/05-safari-pacing-and-animals` with the speed table, the visibility table and screenshots of animals that were moved.
- Do not merge. Smo merges after looking at it.
