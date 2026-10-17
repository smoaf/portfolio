# Night run 09: one tap on mobile

Status: requested by Smo, 17 Oct 2026
Effort: light
Depends on: nothing
Branch: `night/09-single-tap-on-mobile`

## Goal
On phones and tablets, tapping a clickable object currently only highlights it and shows its label. A **second tap** is needed to actually go to it. Smo wants **one tap** to go straight to the object, the same as a mouse click on a computer.

## Where the two-tap step lives
Each of these has the same pattern: on a non-mouse pointer, the first tap only sets `armed` and shows the hover glow and label, then returns. Checked on `main` on 17 Oct; line numbers may have moved slightly.
- `index.html`, `campTap` (around line 1945): figure, fire, van and the other camp things (`camp.armed`).
- `workshop/stations.js` (around line 332): every workshop station (`S.armed`).
- `relay/telescope.js` (around line 270): the radio telescope (`t.armed`).
- `relay/house.js` (around line 457): the relay house (`S.armed`).
- `library/library.js` (around line 341): the lucky cat, the computer and the other library things (`S.armed`).

Search the whole repository for any other place with the same pattern (`pointerType !== 'mouse'` together with an `armed` check, in the hub, media, safari, van or anywhere else) and change it the same way.

## What to change
- **Touch and pen: one tap acts**, exactly like a mouse click does today (zoom to the station, open the house, track with the telescope, zoom to the cat, and so on).
- **Keep the finger-friendly tolerance**: near misses still count on touch (`nearThing` / `nearest`), so small objects stay easy to hit.
- **Mouse is unchanged**: hovering still shows the glow and label, a click acts.
- **Dragging is unchanged**: a drag to look around or rotate must never count as a tap (the existing tap test in the `pointerup` handler in `index.html`).
- Remove the `armed` state where it is no longer needed. Leave the test hooks working (for example `window.__camp.armed()` may simply always return `null`).
- Update the code comments that describe the old "first tap shows, second tap acts" rule (`index.html` around 1858 and 1944, `library/library.js` line 7, `relay/house.js` 456, `relay/telescope.js` 269, `workshop/stations.js` line 3), and any on-screen hint that tells people to tap twice.
- Don't add anything new. No new labels, toasts or effects to replace the first tap.

## Rules for this run
- Follow `CLAUDE.md` and `README.md`. Change only the tap handling described here.

## Check before opening the pull request
- In a phone-sized viewport with **touch emulation** (pointer events with `pointerType: 'touch'`), tap every clickable thing once in every area: camp (figure, fire, van, screen, album), workshop (every station), radio telescope, relay house, library (cat, computer). Each one must act on the **first** tap. List them in the pull request with a tick each.
- Drag on the screen in each area: it must still only look around and never trigger anything.
- Desktop with a mouse: hover glow and labels, and click to act, work as before.
- No console errors.
- Add a dated entry to `docs/build-log.md`.

## Finish
- Open a pull request into `main` from `night/09-single-tap-on-mobile` and merge it as described in `README.md` ("Every run", step 4).
- At the top of the pull request, say in one or two plain sentences what Smo should try on a phone.
