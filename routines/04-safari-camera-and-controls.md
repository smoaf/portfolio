# Night run 04: safari camera and controls

Status: approved by Smo, 16 Oct 2026
Effort: heavy
Depends on: nothing
Branch: `night/04-safari-camera-and-controls`

## Goal
Make the Photo Safari feel like looking through an old camera instead of a game with an interface on top. Fix how aiming, feeding and the flashlight work, and show every photo on its own in the field report.

Files: `safari/hud.js` (everything drawn on top), `safari/safari.css` (its look), `safari/index.js` (input, film, feed, lights, report data).

## 1. Viewfinder that does not look like a gun
**Now:** a thin cross with a small circle in the middle (`.sf-cross` in `safari/safari.css`, around line 25) plus corner marks. The cross and circle read as a gun sight.

**Expected:** a vintage camera focusing screen, after `smoaf/portfolio-refs/safari/viewfinder-1.webp` (look only, copy nothing): four thin corner marks, a pale circle in the middle with a split-image focusing spot, faint grain and specks. Remove the cross and the small ring. Keep the picture clearly visible: the pale tint of the reference is a hint, not a white veil over the scene.

## 2. Vintage readouts instead of interface chips
**Now:** film count and zoom are boxes with a blurred background in the top left (`#sf-film`, `#sf-zoom`, class `.sf-chip`). They look like website interface.

**Expected:** film count and zoom are part of the viewfinder itself, the way an old camera shows them: small figures along the edge of the frame, in the viewfinder's own light colour, without boxes or blur. The run clock and the progress rail fit the same style. Exit and mute stay reachable but quiet.

## 3. Aim follows the mouse on desktop
**Now:** on desktop the visitor drags to look around. Moving the mouse to the screen edge also turns the view slowly (`edge()` in `safari/index.js`, around line 391).

**Expected:** with a mouse, the aim follows the cursor without a button pressed. Where the cursor points is where the camera looks, within the same limits the view has now. Clicking takes the photo. Use smoothing so the view doesn't shake. Phones keep drag to look.

## 4. Feed with the space bar, and more central
**Now:** space takes a photo, F throws feed (`safari/index.js`, around line 404). The help line says "space, F to feed", which doesn't match. The feed button sits at the bottom right.

**Expected:**
- Space throws feed. F keeps working for feed too.
- Taking a photo: click on desktop, tap on phones. Enter also takes a photo.
- Update the help line so it matches the keys.
- The feed button moves closer to the centre at the bottom, reachable with a thumb on a phone.

## 5. Flashlight at night
**Now:** a torch follows the lens at dusk and night (`safari/index.js`, around line 103: angle 0.32, range 110).

**Expected:** a somewhat wider cone that reaches further. Keep its character close to now: it is a torch, not daylight.

## 6. Film down to 20
`FILM = 30` in `safari/index.js` line 23 becomes 20. Check that the low film warning still comes at a sensible point.

## 7. Field report: every photo on its own, large on click
**Now:** the report groups photos by species. Each card shows the best frame of one animal with the other frames as small thumbnails below (`safari/hud.js`, around line 150).

**Expected:**
- No grouping: every photo taken gets its own card with species name and points.
- Clicking or tapping a photo opens it large on top of the report. Close with a click outside, a close button or Esc. Arrow keys and swipe go to the previous or next photo.
- Check how the points total is computed now. If it currently counts only the best frame per species, keep that rule and mark the counted frame on its card, rather than changing the scoring.

## Rules for this run
- Follow `CLAUDE.md`. Don't change routes, animals, speed or scoring. Those belong to night run 05.
- Test with `window.__explore('canyon', 'day')`, `('canyon', 'night')` and `('jungle', 'night')` at desktop and phone width. Try mouse, keyboard and touch (phone emulation). No console errors.
- Add a dated entry to `docs/build-log.md`.

## Finish
- Open a pull request into `main` from `night/04-safari-camera-and-controls` with before and after screenshots of the viewfinder (day and night), the feed button on a phone, and the report with the large photo open.
- Then merge it into `main` as described in `README.md` ("Every run", step 4). Smo tests the live site instead of reviewing the code.
