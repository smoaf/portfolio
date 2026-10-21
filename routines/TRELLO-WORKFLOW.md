# Portfolio work from Trello

How bugs and features for Smo's portfolio site (https://smoaf.github.io/portfolio/, repo `smoaf/portfolio`) are written down, and how a scheduled night run works through them. Agreed with Smo on 21 Oct 2026. This replaces the numbered run files in this folder for all new work.

- **Part A**: the card templates. Use them whenever a card is created, by Smo or by Claude with Smo.
- **Part B**: what a scheduled run does, step by step.

**Where:** Trello board **Smo weekly** (https://trello.com/b/NkWra5Is/smo-weekly), list **Portfolio**. Each card is one bug or one feature.

**Labels show the state:**

| Label | Colour | Meaning |
|---|---|---|
| `bug` | red | broken, to be fixed |
| `bugfix` | yellow | that bug is fixed and live |
| `feature` | purple | new thing to build |
| `feature implemented` | orange | that feature is built and live |

---

# Part A: writing cards

## IDs and card names
- Bugs: `BUG-001`, `BUG-002`, …; features: `FEAT-001`, `FEAT-002`, …
- Card name: `<ID> · <short title>`, for example `BUG-004 · Radio dial snaps back after tuning`.
- **Next ID** = the highest number of that kind on the Portfolio list **including archived cards**, plus one. Never reuse an ID.
- The ID also names the branch (`bug/BUG-004-radio-dial`, `feat/FEAT-007-...`) and starts the pull request title, so card, branch and pull request can always be found from each other.

## Creating a card together with Claude
When Smo describes a bug or feature, Claude fills in the matching template below and **asks about every required field that is missing or vague** before creating the card. Ask all missing points in one go, in plain language, at most about five questions. Suggest an answer where one is obvious ("Phone and computer, or only phone?").

Claude also checks what it can itself before asking: look at the live site, find the code involved, and add **Where in the code** (file and function) to the card. A night run then starts faster and guesses less.

A card is **ready** only when every field marked *(required)* is filled in. Otherwise it gets the comment `needs info: …` and runs skip it.

Images and videos go on the card as attachments. Reference photos that must stay private go into `smoaf/portfolio-refs`; the card names the path.

## Bug template (label `bug`)

```
BUG-<n> · <short title>

What happens (required)
  <what goes wrong, in one or two sentences>

What should happen instead (required)
  <the expected behaviour>

Steps to see it (required)
  1. Open https://smoaf.github.io/portfolio/ on <device>
  2. …
  3. …

Where on the site (required)
  <area: overview / hub / showroom / library / workshop (station?) / relay / radio telescope / camp / van / safari / menus>

Device and browser (required)
  <e.g. iPhone 15 Safari; Mac Chrome; phone and computer>

How often (required)
  <always / sometimes / only on the first visit / only after …>

Since when
  <worked before? after which change, if known>

How bad
  <blocks something / annoying / cosmetic>

Evidence
  <screenshots or a screen recording attached; what is visible in them>

Where in the code (filled in by Claude if found)
  <file, function, line>

Done when (required)
  <how Smo will check that it is fixed>
```

## Feature template (label `feature`)

```
FEAT-<n> · <short title>

Goal (required)
  <what it is and why, in two or three sentences>

Where on the site (required)
  <area and the exact spot>

How it should work (required)
  <step by step, as a visitor would use it: what they see, what they click or tap, what happens>

Look
  <style, sizes, colours; references attached or at portfolio-refs/<path>; "match the existing style" if nothing special>

Devices (required)
  <computer and phone (default) / only one, and what differs>

Not part of this
  <what must not be added or changed>

Assets
  <files Smo supplies, and which ones may be copied into the public repo>

Size (required)
  <S: under 1 hour / M: 1–2 hours / L: more → split into several cards>

Depends on
  <other card IDs that must be live first>

Where in the code (filled in by Claude if found)
  <file, function>

Done when (required)
  <what Smo will try on the live site>
```

**Size rule:** a card must be doable well inside one five-hour usage window. Anything bigger is split into several cards, each of which leaves the site working on its own (for example FEAT-012a, FEAT-012b).

---

# Part B: the night run

One run works on **one card at a time, start to finish**, then decides whether to take the next one.

## 0. Before starting anything: budget
- Read the plan usage: the five-hour window and the weekly limit, percent used.
- **Stop (do nothing) if the weekly limit is at 90% or more.**
- **Start a new card only if the five-hour window has enough room for it**: at most 40% used for an S card, at most 20% for an M card. Otherwise stop. Never start a card that might be cut off halfway.
- If the usage can't be read in this environment, follow the fallback in the schedule prompt (for now: at most **one** card per run, S or M only).

## 1. Pick the card
In the Portfolio list, from top to bottom:
1. **First, unfinished work:** a card with a `started` comment and no `done` comment. A run before this one was cut off, so continue it on its branch.
2. **Then bugs** (label `bug`), **then features** (label `feature`), in list order.
3. Skip cards with a `needs info` comment that hasn't been answered, cards whose **Depends on** cards aren't live yet, and cards of size L.

## 2. Check the card
- If a required field is missing or the card is too vague to build without guessing, **don't guess**. Comment `needs info: <precise questions>` and go to the next card.
- Read `CLAUDE.md` in the repo, then the code named on the card.

## 3. Mark it as started
Comment on the card: `started <date time, Vienna> · branch <name>`.

## 4. Build
- Branch from the latest `origin/main`: `bug/<ID>-<slug>` or `feat/<ID>-<slug>`.
- Do **only** what the card says. Nothing extra.
- **Push after every finished piece, at least every 20 minutes**, so a cut-off loses almost nothing.
- **No parallel sub-agents or background agents.** One session, step by step (they use up the limits several times faster).
- **Rules:**
  - No brand names or logos anywhere.
  - Copy nothing from `smoaf/portfolio-refs` unless the card allows it.
  - Never push to `main` directly.

## 5. Test
- Serve locally (`python3 -m http.server 8000`) and test in a headless browser:
  - **desktop and phone size**, with real touch emulation on the phone (`pointerType: 'touch'`, a few pixels of finger movement per tap);
  - **day and night**;
  - **no console errors.**
- For loading or timing behaviour, test **both** a normal fast load with no cache and a slowed download.
- **Check the card's "Done when"** exactly as Smo will do it.
- **Bugs:** first reproduce the bug on `main` and record that; then show it's gone on the branch.
- **Check that nothing else broke:** open every area once and look at the things the change touches.
- Keep screenshots few and small.

## 6. Pull request and merge
- Title: `<ID>: <short title>`. At the top of the body: two or three plain sentences on what Smo should try on the live site. Then what changed, how it was tested, and the Trello card link.
- Just before merging, merge the latest `origin/main` into the branch. If that brought changes, test again.
- Merge on GitHub with a merge commit, the run's own pull request only. Don't merge if:
  - a conflict can't be solved without losing someone's work, or
  - the site doesn't load, or
  - it shows console errors.

  In those cases, leave the pull request open and say why at its top.
- After the merge, wait for the GitHub Pages build and check the live site once.

## 7. Close the card
- **Label:** `bug` → `bugfix`, or `feature` → `feature implemented`.
- **Comment:** `done <date time>` followed by
  - what changed (short),
  - what to try on the live site,
  - the pull request link,
  - **usage spent** (five-hour and weekly percent before → after the card).
- **If it couldn't be finished:** leave the label. Comment what is done, what is left, and the branch name, so the next run can continue.

## 8. Next card or stop
Go back to step 0. Stop when:
- the budget says so, or
- there are no ready cards, or
- it is past **06:00 Vienna** (the site is never left mid-change in the morning).

Before ending, make sure nothing is left unpushed.

## Undoing a card
Because every card is one pull request, it can be undone on its own: revert that pull request's merge in a new pull request ("Revert <ID>"). Then put the card back to `bug` / `feature` with a comment on what was wrong.
