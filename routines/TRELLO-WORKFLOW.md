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
When Smo describes a bug or feature, Claude fills in the matching template below and **asks about every required field that is missing or vague** before creating the card. Ask the missing points in plain language, grouped together, and keep asking until nothing is open. Suggest an answer where one is obvious ("Phone and computer, or only phone?"). **Always ask how it must not be**, even when everything else is clear: it is the easiest thing for a night run to get wrong.

Claude also checks what it can itself before asking: look at the live site, find the code involved, and add **Where in the code** (file and function) to the card. A night run then starts faster and guesses less.

A card goes on the list only when **every question is answered**: all fields marked *(required)* are filled in and nothing is left open. The card is the complete instruction for the night run; the run doesn't ask back.

Images and videos go on the card as attachments. Reference photos that must stay private go into `smoaf/portfolio-refs`; the card names the path.

## Bug template (label `bug`)

```
BUG-<n> · <short title>

What happens (required)
  <what goes wrong, in one or two sentences>

What should happen instead (required)
  <the expected behaviour>

How it must NOT be (required)
  <what the fix must not do or look like, e.g. "don't just hide the button", "no new popup", "desktop must stay as it is">

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

Estimate (required)
  <share of one five-hour usage window this card will take, e.g. 15%>

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

How it must NOT be (required)
  <how it must not look or behave: styles, motions, sounds, wordings to avoid; what must stay unchanged>

Not part of this
  <things that might seem related but are left for later>

Assets
  <files Smo supplies, and which ones may be copied into the public repo>

Estimate (required)
  <share of one five-hour usage window this card will take, e.g. 25%>

Depends on
  <other card IDs that must be live first>

Where in the code (filled in by Claude if found)
  <file, function>

Done when (required)
  <what Smo will try on the live site>
```

**Estimate rule:** every card says how much of one five-hour usage window it will take, in percent. Claude proposes the number when the card is written; Smo can change it. Rough guide until there is real data:
- text or style fix in one place: 5–10%
- a bug in one module: 10–20%
- a feature in one station or area: 25–40%
- a feature across several areas: 40–70%

**No card may be estimated above 70%.** Anything bigger is split into several cards that each leave the site working on its own (for example FEAT-012a, FEAT-012b).

**Calibrate:** before estimating, look at recently finished cards. Their `done` comments give the estimate and the real working time. Adjust new estimates to match.

---

# Part B: the night run

One run works on **one card at a time, start to finish**, then decides whether to take the next one.

## 0. Plan the run: the very first thing
A cloud run can't read the plan usage (tested 21 Oct 2026), so the run plans its work from the cards' **estimates** instead:
- Make the ordered list of cards (see step 1 for which cards count and the order).
- Take cards from the top of the list while the **sum of their estimates stays at or below 70%**. That is this run's plan.
- An unfinished card (step 1) counts with its full estimate.
- A card estimated above 70%, or a card without an estimate, is not started. Comment `not started: estimate missing or above 70%` and skip it.
- **Stick to the plan.** Don't add more cards later, even if there is time left; the next run takes them.
- If no card fits or there is nothing to do, stop without changing anything.

## 1. Pick the card
**Only real cards count:** cards whose name starts with an ID (`BUG-<n> ·` or `FEAT-<n> ·`). Cards without an ID (like the four label examples called "bug", "bugfix", "feature", "feature implemented") are never touched.

**Is another run still working?** If a card has a `started` comment without a `done` comment, check the newest commit on its branch and the card's last activity. If either is less than 60 minutes old, another run is still busy: **stop right away** and change nothing. Two runs must never work at the same time.

**Order:**
1. **First, unfinished work:** a card with a `started` comment and no `done` comment. A run before this one was cut off, so continue it on its branch.
2. **Then bugs** (label `bug`) **by number**: BUG-001, BUG-002, …
3. **Then features** (label `feature`) **by number**: FEAT-001, FEAT-002, …
4. Skip cards whose **Depends on** cards aren't live yet; they come back once those are done.

## 2. Mark it as started
Comment on the card: `started <date time, Vienna> · branch <name>`.

## 3. Build
- Read `CLAUDE.md` in the repo, then the code the card names under "Where in the code".
- Branch from the latest `origin/main`: `bug/<ID>-<slug>` or `feat/<ID>-<slug>`.
- Do **only** what the card says. Nothing extra.
- **Push after every finished piece, at least every 20 minutes**, so a cut-off loses almost nothing.
- **No parallel sub-agents or background agents.** One session, step by step (they use up the limits several times faster).
- **Rules:**
  - No brand names or logos anywhere.
  - Copy nothing from `smoaf/portfolio-refs` unless the card allows it.
  - Never push to `main` directly.

## 4. Test
- Serve locally (`python3 -m http.server 8000`) and test in a headless browser:
  - **desktop and phone size**, with real touch emulation on the phone (`pointerType: 'touch'`, a few pixels of finger movement per tap);
  - **day and night**;
  - **no console errors.**
- For loading or timing behaviour, test **both** a normal fast load with no cache and a slowed download.
- **Check the card's "Done when"** exactly as Smo will do it. Then go through **"How it must NOT be"** point by point and confirm none of it happens.
- **Bugs:** first reproduce the bug on `main` and record that; then show it's gone on the branch.
- **Check that nothing else broke:** open every area once and look at the things the change touches.
- Keep screenshots few and small.

## 5. Pull request and merge
- Title: `<ID>: <short title>`. At the top of the body: two or three plain sentences on what Smo should try on the live site. Then what changed, how it was tested, and the Trello card link.
- Just before merging, merge the latest `origin/main` into the branch. If that brought changes, test again.
- Merge on GitHub with a merge commit, the run's own pull request only. Don't merge if:
  - a conflict can't be solved without losing someone's work, or
  - the site doesn't load, or
  - it shows console errors.

  In those cases, leave the pull request open and say why at its top.
- After the merge, wait for the GitHub Pages build and check the live site once.

## 6. Close the card
- **Label:** `bug` → `bugfix`, or `feature` → `feature implemented`.
- **Comment:** `done <date time>` followed by
  - what changed (short),
  - what to try on the live site,
  - the pull request link,
  - **time:** started → finished (Vienna time), working minutes, and the card's estimate, so later estimates can be calibrated.
- **If it couldn't be finished:** leave the label. Comment what is done, what is left, and the branch name, so the next run can continue.

## 7. Next card or stop
Take the next card **from the plan** (step 0) and go back to step 2. Stop when:
- the plan is done, or
- it is past **07:00 Vienna**: finish the card in hand, but don't start a new one after 07:00.

Before ending, make sure nothing is left unpushed.

## Undoing a card
Because every card is one pull request, it can be undone on its own: revert that pull request's merge in a new pull request ("Revert <ID>"). Then put the card back to `bug` / `feature` with a comment on what was wrong.
