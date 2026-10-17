# Night run 06: van interior

Status: approved by Smo, 16 Oct 2026
Effort: heavy
Depends on: nothing
Branch: `night/06-van-interior`

## Goal
Bring the van interior closer to what Smo has in mind: the right colours, a little more detail, a camera you notice right away, and polaroids that feel like part of the album.

Files: `camp/van.js` (the whole interior, built in code), `camp/album.js` (the album pages), `assets/album/index.json` (which photos the album and the polaroids show).

## References
- Read the images in `smoaf/portfolio-refs/van/` and follow its `README.md`. Look at them only. Copy nothing from that repository into this one.
- The old van references were removed on 16 Oct 2026. Only the new images Smo adds there count.

## 1. Keep the screen
The start screen where the steering wheel would be (the amber terminal) stays as it is. Smo likes it. Don't change its look or behaviour.

## 2. Colours
**Now:** the materials are defined near the top of `buildVanInterior` (`camp/van.js`, around line 59): paint, trim, dashboard, seat fabric, floor, ceiling, wood, metal and others.

**Expected:** a completely new colour scheme for the whole interior. Every colour is redesigned, including the red-orange paint and the red pedestals of the front seats. The old red-orange look of the earlier references no longer applies. The new scheme follows `cockpit-1.webp` for the front and `rear-desk-1.jpg` for the back: grey and silver panels, amber-orange leather on the seats (replacing the red pedestals), warm amber ceiling lights, teal accents on screens and indicators, light grey built-in panels in the back, and one blue seat at the desk. State old and new colour per surface in the pull request.

## 3. Slightly more detail
Add detail where the eye lands from the starting view, guided by the references. For example seams and stitching on the seats, switches and vents on the dashboard, a door panel with a handle, small everyday objects. "Slightly" means the interior still reads at a glance: no clutter, nothing that slows down a phone.

## 4. The camera
**Now:** a few boxes and cylinders on the console between the front seats (`camp/van.js`, around line 182), hard to notice from the starting view.

**Expected:**
- Placed where it is clearly visible from the starting view (`VIEWS.seat`), for example on the passenger seat or the table edge, facing the visitor at an angle that shows its shape.
- More detailed, following `camera-1.jpg`: a camera body with grip, buttons and dials, a long lens with rings and a lens hood, the small tripod, a strap.
- No brand names or logos.

## 5. Polaroids on the album
**Now:** five polaroids lie spread around the album on the table and on the console (`spots` in `camp/van.js`, around line 162), about 8.5 by 10 cm each.

**Expected:**
- The polaroids lie on top of the album, loosely: slightly overlapping, each turned a little differently, not lined up.
- They keep their current size (about 8.5 by 10 cm). Smo decided the size is fine. No click to open them large.
- They keep showing photos that are also in the album. They already do: the five polaroid photos are all on album pages. Keep it that way if the selection changes.

## 6. Clear tape
**Now:** the tape strips are opaque coloured paper: on the album cover (`camp/van.js`, around line 159) and on the album pages (`TAPES` in `camp/album.js`, line 11).

**Expected:** clear tape everywhere: mostly see-through, a faint sheen and slightly visible edges, so the photo under it shows through.

## 7. Redesign the back
**Now:** the rear (`camp/van.js`, from around line 195) holds a bench across the back wall, an equipment rack with blinking lights, a swivel stool, several cases and cables. The rack runs into the bench, and the whole back looks randomly put together.

**Keep:** the two front seats on their pedestals (`seat()`, around line 124). Smo likes their shape. Their colours change with the new scheme (section 2).

**Expected:** a redesigned back, laid out as one deliberate plan instead of loose pieces:
- Nothing overlaps or runs into anything else. Check every piece against its neighbours.
- Follow `rear-desk-1.jpg`: light grey built-in cabinets along the walls, a recessed desk niche with small screens, papers and a laptop, and a blue swivel seat in front of it. The bench, the equipment rack and the loose cases go.
- Everything has a reason to be there and a sensible place: fixed to a wall, stowed under the bench, strapped down, the way a working research van would be fitted out.
- The table with the album and the visitor's starting view (`VIEWS.seat`) keep working. If the starting position has to move because the back changes, move it so the view onto the screen and the table stays as good as now.

## Rules for this run
- Follow `CLAUDE.md`. Don't change the screen, the two front seats, the routes or the album's page turning.
- No brand names or logos.
- Keep it light for phones: share geometry and materials, no large textures.
- Test from the starting view and the album view, at desktop and phone width, in day and night. No console errors.
- Add a dated entry to `docs/build-log.md`.

## Finish
- Open a pull request into `main` from `night/06-van-interior` with before and after screenshots from the starting view and the album view, day and night, plus the colour table.
- Then merge it into `main` as described in `README.md` ("Every run", step 4). Smo tests the live site instead of reviewing the code.
