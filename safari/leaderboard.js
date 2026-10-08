// The safari leaderboard. One board per route and time of day, so a night canyon run is not measured
// against a day run. Everything goes through `LeaderboardStore`, an async interface: the local store
// below keeps the boards in localStorage (Global rule 5: every read and write wrapped), and a shared
// online board later only has to implement the same three methods.
//
//   list(route, tod)        -> Promise<[{ name, score, at, shots, species }]>, best first
//   add(route, tod, entry)  -> Promise<entry>, the stored entry
//   best(route, tod)        -> Promise<number>, the top score (0 when the board is empty)

const KEY = 'smo.safari.scores.v1';
const MAX = 20;                                        // kept per board, the UI shows the top few

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
}
function write(all) {
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* private mode, full disk: scores stay in this run */ }
}

export function localStore() {
  const board = (all, route, tod) => all[`${route}:${tod}`] || [];
  return {
    kind: 'local',
    async list(route, tod) { return board(read(), route, tod); },
    async best(route, tod) { const b = board(read(), route, tod); return b.length ? b[0].score : 0; },
    async add(route, tod, entry) {
      const all = read(), k = `${route}:${tod}`;
      const e = { name: String(entry.name || 'Visitor').slice(0, 14), score: Math.round(entry.score || 0),
                  shots: entry.shots || 0, species: entry.species || 0, at: Date.now() };
      all[k] = [...board(all, route, tod), e].sort((a, b) => b.score - a.score).slice(0, MAX);
      write(all);
      return e;
    },
  };
}

// The name the visitor used last, so they don't have to type it again.
export function lastName() {
  try { return localStorage.getItem('smo.safari.name') || ''; } catch (e) { return ''; }
}
export function rememberName(n) {
  try { localStorage.setItem('smo.safari.name', n); } catch (e) { /* ignore */ }
}
