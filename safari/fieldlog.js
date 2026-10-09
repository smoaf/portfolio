// The field log: which species this visitor has photographed on each route, kept across runs so
// there is a reason to drive again (the van's screen shows it as a checklist). Per visitor only, in
// localStorage, every read and write wrapped (Global rule 5). Small on purpose: the van's screen
// imports it without pulling in any of the safari.
//
//   { [route]: { name, species: { id: name }, secrets: { id: { name, when } }, found: { id: { rare } } } }
//
// `species` is what the route has shown so far: a route only spawns its secrets at their time of
// day, so the list fills in as the visitor drives it at different times.

const KEY = 'smo.safari.log.v1';

export function readLog() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
}
function write(all) {
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* private mode: the log lives for this run only */ }
}
const entry = (all, id) => (all[id] = all[id] || { name: id, species: {}, secrets: {}, found: {} });

// on the start of a run: what this route has (its secrets with the hint for when they show)
export function survey(route, creatures) {
  const all = readLog(), r = entry(all, route.id);
  r.name = route.name;
  (route.secrets || []).forEach((s) => { r.secrets[s.id] = { name: s.name, when: s.when }; r.species[s.id] = s.name; });
  creatures.forEach((c) => { r.species[c.species.id] = c.species.name; });
  write(all);
}

// after every shot: true when the frame put a species in the log for the first time
export function record(routeId, shot) {
  if (!shot || !shot.best) return false;
  const all = readLog(), r = entry(all, routeId), id = shot.best.species.id;
  const fresh = !r.found[id];
  r.found[id] = { rare: !!(r.found[id] && r.found[id].rare) || !!shot.best.rare };
  r.species[id] = shot.best.species.name;
  write(all);
  return fresh;
}

// the summary the screen draws: counts, and the secrets either named or hinted at
export function summary(routeId) {
  const r = readLog()[routeId];
  if (!r) return null;
  const ids = Object.keys(r.species);
  return {
    total: ids.length,
    found: ids.filter((id) => r.found[id]).length,
    rare: ids.filter((id) => r.found[id] && r.found[id].rare).length,
    secrets: Object.entries(r.secrets).map(([id, s]) => ({ id, name: s.name, when: s.when, found: !!r.found[id] })),
    missing: ids.filter((id) => !r.found[id] && !r.secrets[id]).map((id) => r.species[id]),
  };
}
