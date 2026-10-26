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
