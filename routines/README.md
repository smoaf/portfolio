# Night runs

Instructions for scheduled cloud runs that work on the site at night. Each file `0X-*.md` is one run. Smo approved them on 16 Oct 2026. Since 17 Oct 2026 every run merges its own pull request (see step 4).

## Schedule (Europe/Vienna)
| When | Run | Effort |
|---|---|---|
| Sat 17 Oct, 22:00 | 01 loading animation | light |
| Sun 18 Oct, 03:00 | 07 showroom robot | very heavy |
| Sun 18 Oct, 22:00 | 02 small bug fixes | light |
| Mon 19 Oct, 03:00 | 03 safari: new species and album notes | heavy |
| Mon 19 Oct, 22:00 | 04 safari: camera and controls | heavy |
| Tue 20 Oct, 03:00 | 06 van interior | heavy |
| Tue 20 Oct, 22:00 | 05 safari: pacing and animals (needs 03 merged) | heavy |

## Slot rules
- Each night has two slots: the first run at 22:00, the second five hours later at 03:00. Exactly one run per slot.
- The usage limit counts in five-hour windows, starting with the first use after the last window ended. A run that starts a slot gets a fresh window, unless Smo used Claude in the five hours before 22:00; then the 22:00 run shares that window.
- So the heaviest runs go into the 03:00 slot, and light runs into the 22:00 slot.
- Estimate each run's volume before scheduling it. Earlier heavy runs (relay R2, relay R3, library L1) took 20 to 65 minutes and fit in one window with room to spare. A run that looks bigger than these gets split into two runs in two slots.
- Runs that build on each other keep their order (03 before 04 before 05), so each one branches from a `main` that already has the earlier merge.

## Every run
1. Work in a fresh clone of `smoaf/portfolio`, branched from the latest `main`.
2. Read `CLAUDE.md`, then the run's own file in this folder, and follow it.
3. Reference images, where a run names them, are in the private `smoaf/portfolio-refs`. Look at them only. Copy nothing from that repository.
4. Push the run's branch, open a pull request into `main`, then merge it yourself. Smo gave a standing go for this on 17 Oct 2026: he doesn't review the code, he tests the live site after the merge.
   - Just before merging, merge the latest `origin/main` into the run's branch, because another run may have merged in the meantime. If that brought in changes, test again in the browser and push.
   - Merge the pull request on GitHub with a merge commit. Never push commits directly to `main`.
   - Don't merge if a conflict can't be resolved without losing someone else's work, or if the site no longer loads or shows console errors. Leave the pull request open and say at its top why it wasn't merged.
   - A run that stops early merges only if what it built works on its own. Otherwise it leaves the pull request open and lists what is left.
   - After the merge, write in the pull request that it is live and what Smo should test.
5. Nobody is available at night. Where a run leaves a choice open, choose the sensible option and state it in the pull request.
6. If something blocks the run, stop, and describe what was done and what blocked it in the pull request (or, if nothing was built, in the session).
