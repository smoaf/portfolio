# Night run 10: reach other sections from inside a place, and the papers glow

Status: requested by Smo, 17 Oct 2026
Effort: medium
Depends on: night run 09 (one tap on mobile). Both change the tap handling in `index.html`, so build on top of 09. If 09 is not merged into `main` yet, still do this run on the latest `main`, and keep the changes easy to merge with 09 (same function names, no reformatting of the tap code).
Branch: `night/10-other-sections-and-papers-glow`

## 1. Click other sections from inside a place

**Today:** from the overview, a click or tap on a place (hub, showroom, library, workshop, relay, radio telescope, camp…) goes there. But once you are **in** a place, clicks only reach that place's own things. Other places are often clearly visible: from the library you can see the hub module, the radio telescope and other modules. Clicking them does nothing, and you have to go back to the overview first.

**Wanted:** from inside any place, **one click or tap on another visible place goes straight there**, the same as from the overview. That covers both kinds of view: `object` views looking at a module from outside, and `inside` views like the hub and showroom, where other places show through windows and openings.

Where it lives: the `pointerup` handler in `index.html` (around line 1760, checked on 17 Oct) only calls `zoneAt(ev)` when `!nav.place`. Inside a place it hands the tap to that place's handler (`campTap`, `workshop.tap`, `telescope.tap`, `relay.tap`, `library.tap`, the showroom roof) and stops.

How to do it:
- **The current place's own things win.** If the tap hits something of the current place (a station, the cat, the computer, the van, the roof…), that still happens. Change the handlers so they report whether they used the tap (return `true` or `false`).
- **Otherwise, find the place that was actually hit, respecting what is in front.** Don't just test the invisible zone spheres: from inside one module, the ray also passes through spheres of places hidden behind walls. Raycast against the model, take the **first** mesh hit, and find which place it belongs to: the place whose zone contains the hit point, or better, the place the mesh belongs to by name (meshes are named after their module, for example `library…`, `hub…`, `workshop…`; check the model). If that place is not the current one, `setRoute(it)`.
- Taps on empty sky or the ground do nothing, as now.
- **Desktop hover:** while inside a place, hovering another place shows the pointer cursor and its name label (the same label as on the overview, with the same delay). The current place's own hover glow and labels stay as they are.
- Don't break: Back/Esc, the arrows, drag to look around, the turbine click, the van and safari, the radio room, the zoomed-in states (a zoomed station, the cat, the computer screen, the radio room inside: **no** jumping to other places while zoomed in or inside the radio room or the van; those keep their own controls).
- Phones: one tap, as defined in run 09.

## 2. The yellow glow when pointing at the papers (library computer)

**Today (seen on the live site, 17 Oct):** hovering the computer in the library ("Papers") lights up **the whole library**: walls, floor, desk and shelves turn warm yellow. In `library/library.js`, `THINGS.pc.pick` is `[face, body]` (around line 136), and `setHover` changes the `emissive` of those meshes' **materials**. The computer body shares its plaster material with the rest of the room, so the glow spreads to everything with that material.

**Wanted:** the glow appears **only on the computer's screen** (`librarycomputer_screen`), nowhere else.
- Glow only the screen mesh. Before the first glow, give it its **own material** (clone it) so no other mesh changes. Clicking the computer body may still count as clicking the computer, but only the screen lights up.
- Check the cat the same way: only the cat glows.
- **Check every other hover glow on the site for the same leak** (camp things, workshop stations, telescope, relay house, hub, showroom roof, turbine). Wherever a glow lights up more than the object itself, fix it the same way (own material for the glowing mesh). List what you checked in the pull request.

## Rules for this run
- Follow `CLAUDE.md` and `README.md`. Change only what is described here.

## Check before opening the pull request
- From **every** place, click or tap each other place that is visible from there. It must go there in one click or tap. Make a table in the pull request: from where → to where, ✓ or "not visible from here".
- Clicks on the current place's own things still do their own thing first.
- Nothing jumps away while zoomed in, inside the radio room, in the van or in the safari.
- Hover the computer in the library: **only the screen** glows. Same for every other glow you checked.
- Desktop and phone (touch emulation), day and night. No console errors.
- Add a dated entry to `docs/build-log.md`.

## Finish
- Open a pull request into `main` from `night/10-other-sections-and-papers-glow` and merge it as described in `README.md` ("Every run", step 4).
- At the top of the pull request, say in two or three plain sentences what Smo should try on the live site.
