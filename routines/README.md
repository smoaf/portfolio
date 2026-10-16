# Night runs

Instructions for scheduled cloud runs that work on the site at night. Each file `0X-*.md` is one run. Smo approved them on 16 Oct 2026.

## Schedule (Europe/Vienna)
| When | Run | Effort |
|---|---|---|
| Fri 16 Oct, 22:00 | 01 loading animation | light |
| Fri 16 Oct, 23:00 | 02 small bug fixes | light |
| Sat 17 Oct, 00:00 | 07 showroom robot | very heavy |
| Sat 17 Oct, 03:00 | 03 safari: new species and album notes | heavy |
| Sat 17 Oct, 22:00 | 04 safari: camera and controls | heavy |
| Sun 18 Oct, 03:00 | 06 van interior | heavy |
| Sun 18 Oct, 22:00 | 05 safari: pacing and animals (needs 03 merged) | heavy |

## Every run
1. Work in a fresh clone of `smoaf/portfolio`, branched from the latest `main`.
2. Read `CLAUDE.md`, then the run's own file in this folder, and follow it.
3. Reference images, where a run names them, are in the private `smoaf/portfolio-refs`. Look at them only. Copy nothing from that repository.
4. Push the run's branch and open a pull request into `main`. Never merge and never push to `main`: a merge goes live, and Smo merges after looking.
5. Nobody is available at night. Where a run leaves a choice open, choose the sensible option and state it in the pull request.
6. If something blocks the run, stop, and describe what was done and what blocked it in the pull request (or, if nothing was built, in the session).
