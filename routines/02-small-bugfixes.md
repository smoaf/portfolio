# Night run 02: small bug fixes

Status: approved by Smo, 16 Oct 2026
Effort: light
Depends on: nothing
Branch: `night/02-small-bugfixes`

## Goal
Fix the small bugs listed below in one run. Each bug has its own section, so more can be added later.

Currently listed: 1. radio tuning snaps back, 2. papers list does not line up with the screen, 3. test commands only with `?test`, 4. safari van sound keeps running after the run.

## Bug 1: radio tuning snaps back
**Where:** the radio in the relay hut. `relay/house.js`, key handling around line 368 and the settle logic around line 386.

**What happens:** tuning with the arrow keys moves the dial in small steps. After a short pause (about half a second) the dial jumps by itself to a nearby station.

**Why:** the settle step was made for phones. When a visitor lets go of the dial after dragging, it settles on a station close by, because fine tuning with a finger is hard. The arrow keys trigger the same settle step, although keys already tune precisely.

**Expected:** after tuning with the arrow keys, the dial stays exactly where the visitor left it. Settling after a drag or a flick on the dial keeps working as it does now.

**Check:** tune with the arrow keys (with and without Shift) away from a station, wait several seconds, and confirm the dial does not move. Then drag the dial near a station, let go, and confirm it still settles.

## Bug 2: papers list does not line up with the screen
**Where:** the computer in the library. `library/library.js`, `fitScreen()` around line 160.

**What happens:** the list of papers is laid over the computer screen as a flat rectangle. The run takes the four corners of the screen as seen by the camera and uses the smallest rectangle around them. The screen leans back a little, so its outline in the picture is a slightly narrower shape at the top. The rectangle is therefore bigger than the visible screen and sticks out at the top corners.

**Expected:** the list sits inside the visible screen and does not stick out past its edges.

**How:** first try fitting the list to the area that lies fully inside the screen. Only if that looks wrong, try tilting the list in perspective to match the screen. Text must stay sharp and readable. Leave the phone-upright case alone (there the list already fills the whole view).

**Check:** open the computer on desktop at a few window sizes, in day and night mode, and compare the list's edges with the screen's edges. Confirm the phone-upright case is unchanged.

## 3. Test commands only with `?test`
**Where:** the end of `index.html`, where about 25 `window.__*` commands are defined (`__go`, `__explore`, `__set` and others).

**What happens:** the commands are switched on for every visitor. Automated checks use them to drive the site, and visitors don't need them.

**Expected:** the commands exist only when the address contains `?test` (for example `http://localhost:8000/?test`). Without it, none of them are defined. The site behaves the same either way.

**Check:** load the page without `?test` and confirm `window.__go` is undefined. Load it with `?test` and confirm `window.__go('workshop')` still flies to the workshop. Update the preview line in `CLAUDE.md` (Tech section) so later sessions know to add `?test`.

## 4. Safari: van sound keeps running after the run
**Where:** `safari/index.js`, `finish()` around line 333, and `safari/audio.js`.

**What happens:** when a safari run ends and the field report appears, the van's engine sound is still on. `finish()` only sets the engine to idle (`audio.drive(0, 0)`) instead of silencing it.

**Expected:** the engine and tyre sounds fade out within about a second when the report appears. Sounds the report itself makes still play. Leaving the report or starting again works as before.

**Check:** play a run to the end and listen at the report. Also end a run early with Esc and with the exit button.

## Rules for this run
- Follow `CLAUDE.md`. Change only what the listed bugs need. Do not touch other behaviour of the radio, the library or anything else.
- Test in a browser at desktop and phone width, in day and night mode. No console errors.
- Add a dated entry to `docs/build-log.md`.
- If a fix turns out to need a decision from Smo, finish the others, and describe the open one with its options in the pull request instead of guessing.

## Finish
- Open a pull request into `main` from `night/02-small-bugfixes` with one section per bug: what was wrong, what changed, how it was tested, and before and after screenshots where the bug is visible.
- Then merge it into `main` as described in `README.md` ("Every run", step 4). Smo tests the live site instead of reviewing the code.
