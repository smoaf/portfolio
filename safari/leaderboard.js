// The safari leaderboard. One board per route, the top 10, whatever the time of day. Everything goes
// through `LeaderboardStore`, an async interface: the local store below keeps the boards in
// localStorage (Global rule 5: every read and write wrapped), and a shared online board later only
// has to implement the same three methods.
//
//   list(route)        -> Promise<[{ name, score, at, shots, species }]>, best first
//   add(route, entry)  -> Promise<entry>, the stored entry
//   best(route)        -> Promise<number>, the top score (0 when the board is empty)
//
// Names are 1 to 5 capital letters (A–Z, Ä, Ö, Ü), see `cleanName`.
//
// `boardStore()` picks the store: the local one while `BOARD_URL` in safari/board-config.js is empty,
// else the shared online board (FEAT-016, contract in docs/scoreboard-api.md), which keeps every saved
// run locally as well and falls back to the local board (`offline`) when the server doesn't answer
// within 3 s or answers with an error.
import { BOARD_URL } from './board-config.js';

const KEY = 'smo.safari.scores.v3';
// the earlier boards, cleared once: v1 Smo's test runs, v2 scored before the bonus points (not comparable)
const OLD = ['smo.safari.scores.v1', 'smo.safari.scores.v2'];
const MAX = 10;                                        // kept per board, all of them shown
export const NAME_MAX = 5;

// a lowercase letter becomes its capital, anything else (digits, symbols, spaces, ß) is dropped
export function cleanName(s) {
  return [...String(s || '')].map((ch) => { const u = ch.toUpperCase(); return /^[A-ZÄÖÜ]$/.test(u) ? u : ''; }).join('').slice(0, NAME_MAX);
}

function read() {
  OLD.forEach((k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } });
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
}
function write(all) {
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* private mode, full disk: scores stay in this run */ }
}

// the board for one route, read straight away (the van's field log draws it on its screen)
export function localBoard(route) {
  const b = read()[route];
  return Array.isArray(b) ? b : [];
}

export function localStore() {
  return {
    kind: 'local',
    async list(route) { return localBoard(route); },
    async best(route) { const b = localBoard(route); return b.length ? b[0].score : 0; },
    async add(route, entry) {
      const all = read();
      const e = { name: cleanName(entry.name), score: Math.round(entry.score || 0),
                  shots: entry.shots || 0, species: entry.species || 0, at: Date.now() };
      if (!e.name) return null;
      // a new run goes below the runs with the same score, so it has to beat number 10 to stay
      all[route] = [...localBoard(route), e].sort((a, b) => b.score - a.score).slice(0, MAX);
      write(all);
      return e;
    },
  };
}

// The name the visitor used last, so they don't have to type it again.
export function lastName() {
  try { return cleanName(localStorage.getItem('smo.safari.name')); } catch (e) { return ''; }
}
export function rememberName(n) {
  try { localStorage.setItem('smo.safari.name', n); } catch (e) { /* ignore */ }
}

// ---- the shared online board (FEAT-016)
// The highest score a run could plausibly reach: the 20 most valuable species of the route, each
// in a perfect frame with every bonus at once (group, feeding, pose, four other species: ×3.25),
// rounded up. The server checks the same limit (docs/scoreboard-api.md).
export const MAX_SCORE = { canyon: 15000, jungle: 15000 };
const WAIT = 3000;                                    // ms the server has to answer, then: offline

// the rules a server applies too: a known route, a name of 1–5 letters, a whole score in range
export function validEntry(route, name, score) {
  return Object.prototype.hasOwnProperty.call(MAX_SCORE, route) && typeof name === 'string' && name.length >= 1 &&
    cleanName(name) === name && Number.isInteger(score) && score >= 0 && score <= MAX_SCORE[route];
}
// a unique id for one run, so the server takes each run once
export function newRunId() {
  try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* older browser */ }
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
}
async function ask(url, init) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), WAIT);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error('board ' + res.status);
    return await res.json();
  } finally { clearTimeout(timer); }
}

export function onlineStore(url) {
  const local = localStore();
  const store = {
    kind: 'online',
    offline: false,                                   // the last answer failed: the local board is shown
    async list(route) {
      try {
        const data = await ask(url + (url.includes('?') ? '&' : '?') + 'route=' + encodeURIComponent(route));
        const rows = Array.isArray(data) ? data : data && data.entries;
        if (!Array.isArray(rows)) throw new Error('board: no list');
        store.offline = false;
        return rows.map((e) => ({ name: cleanName(e.name), score: Math.round(+e.score || 0), at: Date.parse(e.date) || 0 }))
          .filter((e) => e.name).sort((a, b) => b.score - a.score).slice(0, MAX);
      } catch (e) {
        store.offline = true;
        return localBoard(route);
      }
    },
    async best(route) { const b = await store.list(route); return b.length ? b[0].score : 0; },
    async localList(route) { return localBoard(route); },   // this browser's own board (after a save the server didn't take)
    // kept locally first (the backup), then sent; `sent` says whether the server took it
    async add(route, entry) {
      const kept = await local.add(route, entry);
      if (!kept) return null;
      const runId = entry.runId || newRunId();
      if (!validEntry(route, kept.name, kept.score)) return { ...kept, runId, sent: false };
      try {
        const data = await ask(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: JSON.stringify({ route, name: kept.name, score: kept.score, runId }) });
        store.offline = false;
        return { ...kept, runId, sent: !!(data && data.ok) };
      } catch (e) {
        store.offline = true;
        return { ...kept, runId, sent: false };
      }
    },
  };
  return store;
}

// the board the safari and the van use: online when an address is set, else this browser's own
export function boardStore() {
  const url = String(BOARD_URL || '').trim();
  return url ? onlineStore(url) : localStore();
}
