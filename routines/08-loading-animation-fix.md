# Night run 08: loading animation fix

Status: requested by Smo, 17 Oct 2026
Effort: light
Depends on: night run 01 (merged in #8)
Branch: `night/08-loading-animation-fix`

## Why
Night run 01 added the three-dot loading animation (`#status` in `index.html`). It is live, but Smo says it doesn't work well and isn't what `01-loading-animation.md` describes. Checked on the live site on 17 Oct:

1. **Too small to read.** The dots are 6 px wide on a 12 px radius inside a 44 px box. On the full-screen page it reads as a speck, and the motion can't be followed.
2. **The three shapes look the same.** The "circle" has the same radius as the triangle's corners. Three dots evenly spaced on a circle look exactly like three dots on a triangle, so phase 2 just looks like the triangle spinning faster.
3. **The triangle phase is too short.** The spec says the dots move around the triangle "two times". Run 01 made two single steps of one corner each, which is only two-thirds of one lap.
4. **The page goes dead between the dots and the station (the main technical issue).** Smo sees it mostly on a first visit: "it does nothing really". Measured on 17 Oct with nothing cached and a throttled download: the dots run fine while the model downloads. But `onModel` sets `status.hidden = true` **before the scene has ever been drawn**. The first `renderer.render` then compiles every shader and uploads every texture in one blocking go, so the dots are already gone and the screen stays empty and frozen. That took about 0.5 s on a fast desktop with a warm shader cache. On a first visit (no cached shaders) and on phones it is much longer. On top of that, the dots are moved from JavaScript every frame (`setAttribute` in `requestAnimationFrame`), so any busy moment on the main thread stops them too.

## What to build
Keep the idea from `01-loading-animation.md`. Same loop, but readable and smooth:

1. **Triangle, two full laps.** The three dots sit on the corners of a triangle and travel along its **straight edges** to the next corner, again and again, until each dot has gone **twice all the way round** (6 corner-to-corner moves). Ease each move, with a very short rest at the corners.
2. **Circle, fast.** The dots move outwards onto a **clearly larger circle** (about 1.5× the triangle's corner radius), spread evenly, and spin around it **noticeably faster** than in the triangle phase (about two turns).
3. **Back to the triangle.** They come back in to the triangle's corners and the loop starts over.

Every change is smooth: the dots never jump, and not even the loop restart is visible.

- **Size:** clearly visible on desktop and phone, about 8 px dots and an overall size of about 64–72 px. Choose the exact values and state them in the pull request.
- **Keep the dots until the station is really on screen.** Don't hide `#status` in `onModel` straight away. First prepare the scene for drawing (three.js r160 has `renderer.compileAsync(scene, camera)`; compile it, then render one frame), and hide the dots only after that first frame has been drawn. Fade them out over about 0.3 s instead of cutting. If `compileAsync` isn't usable, hide the status after the first rendered frame (two `requestAnimationFrame`s after the first `renderer.render`).
- **Smooth while busy:** the motion must not depend on the main thread. Animate the dots with CSS transforms (CSS keyframes or `element.animate()` on `transform`), which the browser runs off the main thread, instead of moving them from JavaScript every frame. Precomputing the keyframes once in JS is fine.
- **Keep from run 01:** the "Loading model…" line under the dots, the colour token `--glass-soft` (works by day and night), `role="status"`, the reduced-motion version (dots pulse in place, no movement), hiding with `status.hidden = true` when the model is ready, and the error text "The model could not be loaded." on failure. The animation must stop when the status is hidden or replaced.

## Rules for this run
- Follow `CLAUDE.md` and `README.md`. Change only the loading display (`#status`, its CSS and its small script in `index.html`) and the moment it is hidden (`status.hidden = true` in `onModel`, plus the shader precompile described above). Don't touch the model, the model file or anything else.
- No library.

## Check before opening the pull request
- Test with a **cold cache** and a **throttled network** so the loading screen stays up. Record frame times from page start until the station is drawn: the dots must keep moving the whole time, and **there must be no frozen, empty moment between the dots disappearing and the station appearing**. Report the before/after numbers in the pull request (the old build froze for about 0.5 s right after the dots vanished, on a fast desktop). No console errors.
- Desktop and phone width, day and night, reduced motion, failed load.
- Attach a short capture of one full loop to the pull request, on a separate captures branch like run 01 did.
- Add a dated entry to `docs/build-log.md`.

## Finish
- Open a pull request into `main` from `night/08-loading-animation-fix` and merge it as described in `README.md` ("Every run", step 4).
- At the top of the pull request, say in two or three plain sentences what Smo should look at on the live site.
