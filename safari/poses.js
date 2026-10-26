// The rare poses of a route: which species show off this run, and what sets each one off. A route
// calls `planPoses()` once after it has spawned its animals. Per run every species in the plan rolls
// once: in about half of the runs it does its rare pose (the `rare` state, which the photo scores as
// "+ pose"), in the others it never does, whatever happens. The pose itself is the species' own
// animation in safari/fauna/*.js; while it lasts the animal's glow is half again as bright.
//
// What sets the pose off, per species (`kind`):
//   near     by itself, as the van comes along: each animal once, some metres before the van passes
//            it (the distance varies per animal), so it is in view ahead and lasts while it passes
//   feed     feed: the animal eats and then shows off every time (the eating stays as it was)
//   startle  feed that lands close startles it: it jumps, looks at the food, then does its pose,
//            and leaves the food alone
// A key 'id:flock' gives a flock of a species its own kind (the roll stays one per species).
// Species marked `always` keep their own set piece every run (e.g. the crowned eagle's wing spread)
// and are left exactly as they are.
import * as THREE from 'three';

const BOOST = 0.5;                                  // the glow during a pose: base × 1.5
const vA = new THREE.Vector3();

export function planPoses({ creatures, path, plan, roll = Math.random }) {
  const length = path.getLength();
  // the road, sampled once: each animal's nearest point on it says when the van passes
  const N = Math.max(200, Math.round(length / 2)), road = [];
  for (let i = 0; i <= N; i++) road.push(path.getPointAt(i / N));
  const passAt = (p) => {
    let best = 0, bestD = Infinity;
    for (let i = 0; i <= N; i++) { const d = road[i].distanceToSquared(p); if (d < bestD) { bestD = d; best = i; } }
    return best / N;
  };

  const on = {};                                     // species id -> does its pose this run
  for (const c of creatures) {
    const id = c.species && c.species.id, kind = (c.flock && plan[id + ':flock']) || plan[id];
    if (!kind || kind === 'always') continue;
    if (!(id in on)) on[id] = roll() < 0.5;
    c.poseRun = on[id];
    c.poseKind = kind;
    wrapGo(c);
    if (!c.poseRun) { c.rareOff = true; continue; }
    if (kind === 'feed') c.rareChance = 1;
    if (kind === 'startle') c.startle = new Set();
    if (kind === 'near') {
      c.root.updateMatrixWorld(true);
      c._passU = passAt(c.photoPoint(vA));
      c._lead = 12 + roll() * 18;                    // metres before the van passes it
    }
    brighten(c);
  }
  return on;

  // the step of a posing animal: the `near` trigger before it, the glow after it
  function wrapStep(c) {
    const step = c.step;
    c.step = (dt, env) => {
      if (c.poseKind === 'near' && !c._posed) {
        const ahead = (c._passU - env.u) * length;
        const calm = c.state === 'idle' || c.state === 'wander' || c.state === 'curious';
        if (ahead < c._lead && ahead > -6 && env.dist < 70 && calm && !c.air) {
          c._posed = true;
          c.go('rare', 5 + roll() * 1.5);
        }
      }
      step(dt, env);
      c._glow = c._glow ?? 0;
      c._glow += ((c.state === 'rare' ? 1 : 0) - c._glow) * Math.min(1, dt * 3);
      const k = 1 + BOOST * c._glow;
      for (const [orig, mine] of c._glowMats) mine.emissiveIntensity = orig.emissiveIntensity * k;
    };
  }
  // its own copies of the glowing materials (shared ones would light up every animal of the run);
  // the species' own animation keeps driving the shared one, the copy follows it
  function brighten(c) {
    const mine = new Map();
    c.root.traverse((o) => {
      const m = o.material;
      if (!o.isMesh || !m || Array.isArray(m) || !m.emissive || !(m.emissiveIntensity > 0)) return;
      if (m.emissive.r === 1 && m.emissive.g === 1 && m.emissive.b === 1) return;   // the eyes' catchlights
      if (!mine.has(m)) mine.set(m, m.clone());
      o.material = mine.get(m);
    });
    c._glowMats = [...mine];
    wrapStep(c);
  }
}

// a pose that is off this run can't be started by anything: not by feed, the time of day or the van
function wrapGo(c) {
  const go = c.go;
  if (!go || go._poses) return;
  c.go = (s, hold) => (s === 'rare' && c.rareOff ? go('idle', 2) : go(s, hold));
  c.go._poses = true;
}
