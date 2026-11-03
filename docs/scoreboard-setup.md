# Scoreboard: how to switch it online

Right now every visitor's safari board is kept in their own browser. Once you have a hosting provider, you can make it one shared board for everyone. Nothing else on the site changes.

## 1. What to ask the hosting provider for

Ask for (or have someone set up):

1. **A small script on your web space** that answers two requests: "give me the top 10 of a route" and "save this run". What exactly it has to do is in [scoreboard-api.md](scoreboard-api.md); you can hand that page to whoever writes it. Almost any hosting can do this (for example a small PHP script, or a "serverless function").
2. **Somewhere to keep the entries:** a small database, or simply one file on the web space. It only holds names, scores, the route and the date.
3. **An `https://` address** for that script, for example `https://your-domain.example/scoreboard.php`.

Tell them the site lives on `https://smoaf.github.io`, so the script must allow requests from there (this is called CORS, the details are in the contract).

## 2. Switch it on

1. Open `safari/board-config.js` in the repository.
2. Paste the address between the quotes:
   ```js
   export const BOARD_URL = 'https://your-domain.example/scoreboard.php';
   ```
3. Save it in a pull request and merge it as usual. A minute later it is live.

## 3. Test it with two browsers

1. Open the site in two different browsers (for example Safari and Chrome, or your computer and your phone).
2. In the first one: drive a safari route to the end, type a name (e.g. `TEST`) and press Save.
3. In the second one: drive the same route (or open the van's field log). Under "Best runs" you should see `TEST` with its score.
4. Save a run in the second browser too and check that the first one shows it after its next run.

If you see the word **offline** under "Best runs": the site could not reach the script within 3 seconds or got an error. The board then shows only the runs saved in that browser. Check the address, and that the script allows requests from `https://smoaf.github.io`.

To remove the test entries, delete them in the database or file on your web space.

## 4. Switch it off again

Empty the address in `safari/board-config.js` (leave the two quotes: `''`) and merge. The board is then back to each visitor's own browser. Nothing is lost: every run saved while the board was online was also kept in the browser it was played in.

## For testing on your own computer

`tools/scoreboard-test-server.py` is a small fake server that follows the same rules. Start it with `python3 tools/scoreboard-test-server.py`, put `http://localhost:8787/` into `safari/board-config.js` **only on your computer** (don't push that), and open the site from `python3 -m http.server 8000`. Entries vanish when the fake server stops.
