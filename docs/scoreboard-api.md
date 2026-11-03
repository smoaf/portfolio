# Scoreboard: what the server has to do

The Photo Safari keeps a board of the best runs per route ("Best runs" in the field report and in the van's field log). Without a server, each visitor sees only the runs saved in their own browser. With a server, every visitor sees the same board. This page describes the two requests such a server has to answer, so that any hosting can provide one. How to set it up: [scoreboard-setup.md](scoreboard-setup.md).

The site talks to one web address (in this page: `BOARD`), the one pasted into `safari/board-config.js`.

## 1. Get the top 10 of a route

```
GET BOARD?route=canyon
```

`route` is `canyon` or `jungle`. If the address already has a `?`, the site adds `&route=…` instead.

Answer (status 200, JSON), best first, at most 10 entries:

```json
{ "entries": [
  { "name": "VIKI", "score": 959, "date": "2026-11-03T21:14:00Z" },
  { "name": "SMO",  "score": 812, "date": "2026-11-02T18:40:12Z" }
] }
```

- `name`: 1–5 capital letters, `score`: a whole number, `date`: when it was saved (ISO 8601, UTC).
- A plain list (`[ … ]` without `entries`) is accepted as well.
- Equal scores: the older entry stays above the newer one.

## 2. Save one run

```
POST BOARD
Content-Type: text/plain;charset=UTF-8

{ "route": "jungle", "name": "VIKI", "score": 959, "runId": "3f1c…" }
```

The body is JSON, sent as plain text: a browser then sends it straight away (no extra "preflight" request first), which keeps the server simpler. The server reads the body as JSON whatever its type says.

Answers (JSON):

| Status | Body | When |
| --- | --- | --- |
| 200 | `{ "ok": true }` | saved (also when it didn't make the top 10) |
| 400 | `{ "ok": false, "reason": "name" }` (or `"score"`, `"unknown route"`) | the entry breaks a rule below |
| 409 | `{ "ok": false, "reason": "run already saved" }` | this `runId` was saved before |
| 429 | `{ "ok": false, "reason": "too many" }` | too many entries from this browser or address |

## Rules the server must apply

The site checks the name and score rules itself before sending, but a server must never trust what it is sent.

- **Route:** only `canyon` or `jungle`.
- **Name:** 1 to 5 letters, only `A`–`Z`, `Ä`, `Ö`, `Ü` (capitals).
- **Score:** a whole number from 0 to the highest plausible score of the route: **15,000** for both routes. (How that is worked out: a run has 20 frames, and the report counts the best frame of each species. The 20 most valuable species of a route are worth about 4,300–4,600 points together; a perfect frame with every bonus at once (same species, feeding, pose, four other species) is worth 3.25 × the species' value. That gives at most ~14,900, rounded up to 15,000. Real runs so far score around 1,000.)
- **One entry per run:** each `runId` is taken once (it is a random id, 8–64 characters, made fresh for every run).
- **Not too many:** at most about 6 entries per address per hour.
- **Keep only the top 10 per route;** anything below can be thrown away.

## What is stored

Only the route, the name, the score and the date. No addresses, no cookies, no tracking, nothing else. (The address is used only for the "not too many" rule and is not kept.)

## Other things the server needs

- **CORS:** the site lives on a different address than the server, so every answer (also errors) needs the header `Access-Control-Allow-Origin: https://smoaf.github.io` (or `*`). It should also answer an `OPTIONS` request with that header (status 204), in case a browser asks first.
- **HTTPS:** the address must start with `https://`, otherwise browsers block it on the live site.
- **Speed:** the site waits 3 seconds. If the server hasn't answered by then, or answers with an error, the site shows the visitor's own local board with a small "offline" note instead.

A working example that follows this contract (for testing on one computer only): `tools/scoreboard-test-server.py`.
