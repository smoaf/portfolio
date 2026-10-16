# Night run 01: loading animation

Status: approved by Smo, 16 Oct 2026
Effort: light
Depends on: nothing
Branch: `night/01-loading-animation`

## Goal
While the station model loads, visitors currently see only the text "Loading model…" in the middle of the screen. Replace it with a small animation of three dots, so the page looks alive while it waits.

## The animation
One loop, repeated until the model is ready:
1. **Triangle, twice:** the three dots sit on the corners of a triangle and move around it, each dot travelling to the next corner. They do this two times.
2. **Circle, fast:** the dots spread evenly on a circle and spin around it, faster than in the triangle phase.
3. **Back to the triangle:** they settle into the triangle shape again and the loop starts over.

The changes between shapes are smooth. The dots never jump.

## Where it lives
- `index.html`: the `#status` element (line 287), its CSS (lines 50 and 180) and the loading code around `onModel` / `onFail` (around line 1440).
- Build it with CSS and plain JS or SVG inside `index.html`. Add no library.

## Rules for this run
- Follow `CLAUDE.md`. Change only the loading display. Do not touch the model, the model file or anything else on the page.
- Dot colour comes from the existing tokens (`--ink-soft` or similar), so it reads in both day and night mode.
- When the model is ready, the animation disappears as the text does now (`status.hidden = true`) and stops running.
- If loading fails, the animation stops and the existing error text "The model could not be loaded." shows in its place.
- Visitors with "reduce motion" switched on in their system settings get a calm version: dots pulsing gently in place, no spinning.

## Check before opening the pull request
- Test in a browser at desktop and phone width, in day and night mode. No console errors.
- To see the animation long enough, slow the model download (for example with the browser's network throttling) or test the animation on its own.
- Record a short screen capture or a few screenshots of each phase and attach them to the pull request.
- Add a dated entry to `docs/build-log.md`.

## Finish
- Open a pull request into `main` from `night/01-loading-animation` that describes what was built and shows the captures.
- Do not merge. Smo merges after looking at it.

## Not part of this run
- Compressing `arrangement_v7.glb`. Smo decided to wait until the model is finished.

## Decide on your own
Nobody is available during the night run. For each point below, choose the sensible option, build it, and state the choice in the pull request so Smo can change it.
- Keep a small "Loading" text under the dots, or dots only?
- Dot size and speed: the run picks values that look calm on desktop and phone and states them in the pull request so you can adjust them.
