# Night runs

Instructions for scheduled cloud runs that work on the site at night. Each file `0X-*.md` is one run. Smo approved them on 16 Oct 2026. On 17 Oct 2026 Smo changed one rule: every run merges its own pull request (step 4). This README wins over older wording in a scheduled task's prompt, including "Never merge".

## Schedule (Europe/Vienna)
Each night has two slots: 22:00, and five hours later 03:00. One run per slot, each sized to finish well inside one five-hour usage window (earlier heavy runs took 20 to 65 minutes).

| When | Run | Effort |
|---|---|---|
| Sat 17 Oct, 22:00 | 01 loading animation | light |
| Sat 17 Oct, 23:00 | 02 small bug fixes (ran early) | light |
| Sun 18 Oct, 03:00 | 07 showroom robot | very heavy |
| Sun 18 Oct, 22:00 | 03 safari: new species and album notes | heavy |
| Mon 19 Oct, 03:00 | 04 safari: camera and controls | heavy |
| Mon 19 Oct, 22:00 | 06 van interior | heavy |
| Tue 20 Oct, 03:00 | 05 safari: pacing and animals (needs 03 merged) | heavy |
| Tue 20 Oct, 22:00 | 08 loading animation fix | light |
| Wed 21 Oct, 03:00 | 09 one tap on mobile (audit of the whole site) | medium |
| Wed 21 Oct, 22:00 | 10 other sections from inside a place, papers glow (after 09) | medium |

## Every run
1. Work in a fresh clone of `smoaf/portfolio`, branched from the latest `main`.
2. Read `CLAUDE.md`, then the run's own file in this folder, and follow it.
3. Reference images, where a run names them, are in the private `smoaf/portfolio-refs`. Look at them only. Copy nothing from that repository.
4. Push the run's branch, open a pull request into `main`, then merge it yourself. Smo doesn't review the code, he tests the live site after the merge.
   - Just before merging, merge the latest `origin/main` into the run's branch, because another run may have merged in the meantime. If that brought in changes, test again in the browser and push.
   - Merge the pull request on GitHub with a merge commit. Never push commits directly to `main`.
   - Don't merge if a conflict can't be resolved without losing someone else's work, or if the site no longer loads or shows console errors. Leave the pull request open and say at its top why it wasn't merged.
   - A run that stops early merges only if what it built works on its own. Otherwise it leaves the pull request open and lists what is left.
   - After the merge, write in the pull request that it is live and what Smo should test.
5. Nobody is available at night. Where a run leaves a choice open, choose the sensible option and state it in the pull request.
6. If something blocks the run, stop, and describe what was done and what blocked it in the pull request (or, if nothing was built, in the session).
