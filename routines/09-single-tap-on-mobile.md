# Night run 09: one tap on mobile

Status: requested by Smo, 17 Oct 2026
Effort: medium (a careful audit of the whole site, then mostly small changes)
Depends on: nothing
Branch: `night/09-single-tap-on-mobile`

## Goal
On phones and tablets, Smo often has to tap a clickable thing **twice** before anything happens. **Every clickable thing must act on the first tap**, the same as a mouse click on a computer. This applies **everywhere on the site**: the station overview, every area, and everything inside a zoomed-in station, room or screen.

Smo says this happens in **many more places** than the obvious ones, so this run is an **audit first**: find every place where a single tap on touch does nothing (or only highlights), then fix them all.

## Known causes (checked on `main`, 17 Oct; line numbers may have moved)
1. **"First tap only highlights" on purpose.** On a non-mouse pointer, the first tap sets `armed`, shows the glow and label, and returns. Only a second tap acts. Remove this step in:
   - `index.html`, `campTap` (around line 1945): figure, fire, van and the other camp things.
   - `workshop/stations.js` (around line 332): every workshop station.
   - `relay/telescope.js` (around line 270): the radio telescope.
   - `relay/house.js` (around line 457): the relay house.
   - `library/library.js` (around line 341): the cat, the computer, etc.
2. **Taps that count as drags.** The main `pointerup` handler in `index.html` (around line 1758) treats a touch as a tap only if the finger moved **less than 6 px** within 600 ms. Real fingers often move more than that, so the tap is silently ignored as a tiny drag, and people tap again. Use a larger allowance for touch (about 12–16 px; keep 6 px for the mouse). Check the other modules that have their own tap/drag test (for example the radio room in `relay/house.js`, the workshop stations, the safari, the album) for the same problem.
3. **Taps lost while the camera is moving.** The same handler drops every tap while `tween.active` is true. A tap during or right at the end of a camera move does nothing. Instead, a tap during a move should act (for example go to the newly tapped place or object).
4. **Other places from inside a place.** From the overview a tap on a place goes there, but once you are in a place, taps only reach that place's own things. If another place is clearly visible and tappable-looking from there, decide sensibly whether one tap should go there, and say what you chose in the pull request.

## Then audit everything else
Go through the **whole site with touch emulation** and list every clickable thing: everything that gets a pointer cursor, glow, label or button look on desktop. That includes:
- the station overview and its places
- the camp: figure, fire, van, the van's screen and its route list, the album
- all workshop stations and the controls inside them
- the radio telescope; the relay house and everything in the radio room (dial, key, card box, hint card…)
- the library: cat, computer, the papers list and its Open button
- the hub (screens, the wind turbine)
- the showroom (roof, screen)
- the safari (start, controls, end screen)
- the menus and buttons of the page (navigation arrows, Back, Close, panel links)

For **each**, check that **one tap acts**. Fix every one that doesn't, whatever the cause: the patterns above, a missed `click` on touch, an element above that swallows the first touch, a hover-only menu, and so on.

## Must stay the same
- **Mouse:** hovering still shows the glow and label, and a click acts.
- **Drags never act:** dragging to look around, rotate, or turn a knob must never trigger a tap.
- **Fingers can still miss slightly:** keep the near-miss tolerance for touch (`nearThing` / `nearest`).
- Remove `armed` where it isn't needed any more, but keep the test hooks working (for example `window.__camp.armed()` may always return `null`).
- Update the code comments that describe the old "first tap shows, second tap acts" rule.
- Add nothing new: no new labels, toasts or effects to replace the first tap.

## Rules for this run
- Follow `CLAUDE.md` and `README.md`. Change only tap/click handling.

## Check before opening the pull request
- Phone-sized viewport with **real touch emulation** (`pointerType: 'touch'`, including a few pixels of finger movement between down and up, like a real finger). Tap every item from the audit list **once**. Put the full list in the pull request with ✓ (acts on the first tap) for each, and say what was wrong where you had to fix something.
- Drag in every area: it must only look around or turn things, never trigger a tap.
- Desktop with a mouse: works as before.
- No console errors.
- Add a dated entry to `docs/build-log.md`.

## Finish
- Open a pull request into `main` from `night/09-single-tap-on-mobile` and merge it as described in `README.md` ("Every run", step 4).
- At the top of the pull request, say in one or two plain sentences what Smo should try on a phone.
