// The rare poses of a route: which species show off this run, and what sets each one off. A route
// calls `planPoses()` once after it has spawned its animals. Per run every species in the plan rolls
// once: in about half of the runs it does its rare pose (the `rare` state, which the photo scores as
// "+ pose"), in the others it never does, whatever happens. The pose itself is the species' own
// animation in safari/fauna/*.js; while it lasts the animal's glow is half again as bright.
//
// What sets the pose off, per species (`kind`):
//   near     by itself, as the van comes along: each animal once, as soon as it can be photographed
//            ahead of the van (see below), so it plays while the van comes up to it
//   feed     feed: the animal eats and then shows off every time (the eating stays as it was)
//   startle  feed that lands close startles it: it jumps, looks at the food, then does its pose,
//            and leaves the food alone
// A key 'id:flock' gives a flock of a species its own kind (the roll stays one per species).
// Species marked `always` keep their own set piece every run (e.g. the crowned eagle's wing spread)
// and are left exactly as they are.
//
// Whatever sets a pose off (the van, feed, a startle, the time of day, curiosity), it only starts
// where it can be photographed: ahead of the van, close enough to score on the wide lens and not
// hidden behind rock or plants. If it can't be seen yet, it waits a while for that (or doesn't
// happen this time). In a herd or group of one species at most two animals pose at once; the
// others wait their turn. A pose lasts as long as the species' own animation (`c.poseLen`, else
// the time the trigger asks for), and it blends in and out over half a second, so no part of the
// animal jumps from one frame to the next.
import * as THREE from 'three';
import { FOV } from './rig.js';

const BOOST = 0.5;                                  // the glow during a pose: base × 1.5
const TURNS = 2;                                    // animals of one species posing at the same time
const WAIT = 12;                                    // s a held-back pose keeps waiting for its moment
const BLEND = 0.5;                                  // s to blend into and out of a pose
const FRAME = 0.07;                                 // the share of the frame height it must fill at 1.0×
const AHEAD = Math.cos(THREE.MathUtils.degToRad(45));   // within 45° of the way the van is heading (in the view ahead)
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vT = new THREE.Vector3();
const qA = new THREE.Quaternion();
const ray = new THREE.Raycaster();
ray.layers.enableAll();                             // the colliders include scenery the lens skips (chunked)

export function planPoses({ creatures, path, plan, colliders = () => [], roll = Math.random }) {
  const length = path.getLength();
  const wideHalf = Math.tan(THREE.MathUtils.degToRad(FOV.wide) / 2);
  // the van's heading, worked out once per frame
  const van = { t: -1, dir: new THREE.Vector3() };
  const heading = (env) => {
    if (van.t !== env.t) { van.t = env.t; path.getTangentAt(Math.min(1, Math.max(0, env.u || 0)), van.dir); van.dir.y = 0; van.dir.normalize(); }
    return van.dir;
  };
  // can the lens get it now? ahead of the van, big enough on the wide lens, nothing in the way
  // (the ray is the costly part, so each animal asks at most five times a second)
  const inView = (c, env) => {
    if (!env || !env.camPos) return false;
    if (c._seenT !== undefined && env.t - c._seenT < 0.2) return c._seen;
    c._seenT = env.t;
    c.root.updateMatrixWorld(true);
    c.photoPoint(vA);
    vB.subVectors(vA, env.camPos);
    const d = vB.length();
    let ok = d > 0.5 && (c.radius || 0.6) / (wideHalf * d) >= FRAME;
    if (ok) {
      vT.set(vB.x, 0, vB.z);
      const h = vT.length();
      ok = h < 0.5 || vT.dot(heading(env)) / h > AHEAD;
    }
    if (ok) {
      const cs = colliders();
      if (cs && cs.length) {
        ray.set(env.camPos, vB.normalize());
        ray.far = Math.max(0.1, d - (c.radius || 0.6) * 0.5);
        ok = !ray.intersectObjects(cs, false).length;
      }
    }
    c._seen = ok;
    return ok;
  };
  // the species' animals, for taking turns
  const herds = new Map();
  const turnFree = (c) => {
    const herd = herds.get(c.species.id) || [];
    let n = 0;
    for (const o of herd) if (o !== c && o.state === 'rare') n++;
    return n < TURNS;
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
    if (!herds.has(id)) herds.set(id, []);
    herds.get(id).push(c);
    if (kind === 'feed') c.rareChance = 1;
    if (kind === 'startle') c.startle = new Set();
    // every way into the pose goes through here: now, if the lens can get it and the herd has a
    // turn free; otherwise it is remembered and starts as soon as it can (within WAIT seconds)
    c.rareGate = (hold) => {
      if (c._env && inView(c, c._env) && turnFree(c)) { c._wait = 0; return c.poseLen || hold; }
      c._wait = c._env ? c._env.t + WAIT : 0; c._waitHold = hold;
      return 0;
    };
    brighten(c);
  }
  return on;

  // the step of a posing animal: the `near` trigger and held-back poses before it, the blend and
  // the glow after it
  function wrapStep(c) {
    const step = c.step;
    const nodes = [];
    c.root.traverse((o) => { if (o !== c.root) nodes.push(o); });
    const snap = new Float32Array(nodes.length * 10);
    let from = null, bt = 0, snapped = false;
    c.step = (dt, env) => {
      c._env = env;
      // the pose as it was drawn last frame, so a change into or out of the pose can blend from it
      if (c.root.visible) { save(nodes, snap); snapped = true; } else snapped = false;
      const was = c.state === 'rare';
      const calm = c.state === 'idle' || c.state === 'wander' || c.state === 'curious';
      if (c.poseKind === 'near' && !c._posed && calm && !c.air && inView(c, env) && turnFree(c)) {
        c._posed = true;
        c.go('rare', 5 + roll() * 1.5);
      } else if (c._wait && c.state !== 'rare' && calm) {
        if (env.t > c._wait) c._wait = 0;
        else if (inView(c, env) && turnFree(c)) { const h = c._waitHold; c._wait = 0; c.go('rare', h); }
      }
      step(dt, env);
      if (was !== (c.state === 'rare') && snapped) { from = from || new Float32Array(snap.length); from.set(snap); bt = 0; }
      if (from && bt < BLEND) {
        bt += dt;
        const w = THREE.MathUtils.smoothstep(bt / BLEND, 0, 1);
        if (w < 1) { mix(nodes, from, w); c.root.updateMatrixWorld(); }
      }
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

// every part's position, rotation and scale, ten numbers each
function save(nodes, out) {
  for (let i = 0, j = 0; i < nodes.length; i++, j += 10) {
    const o = nodes[i];
    out[j] = o.position.x; out[j + 1] = o.position.y; out[j + 2] = o.position.z;
    out[j + 3] = o.quaternion.x; out[j + 4] = o.quaternion.y; out[j + 5] = o.quaternion.z; out[j + 6] = o.quaternion.w;
    out[j + 7] = o.scale.x; out[j + 8] = o.scale.y; out[j + 9] = o.scale.z;
  }
}
// each part w of the way from where it was to where the animation now has it
function mix(nodes, from, w) {
  for (let i = 0, j = 0; i < nodes.length; i++, j += 10) {
    const o = nodes[i];
    o.position.set(from[j] + (o.position.x - from[j]) * w, from[j + 1] + (o.position.y - from[j + 1]) * w, from[j + 2] + (o.position.z - from[j + 2]) * w);
    qA.set(from[j + 3], from[j + 4], from[j + 5], from[j + 6]);
    o.quaternion.copy(qA.slerp(o.quaternion, w));
    o.scale.set(from[j + 7] + (o.scale.x - from[j + 7]) * w, from[j + 8] + (o.scale.y - from[j + 8]) * w, from[j + 9] + (o.scale.z - from[j + 9]) * w);
  }
}

// a pose that is off this run can't be started by anything: not by feed, the time of day or the van
// (and one that is on goes through the gate, also for species with their own `go`)
function wrapGo(c) {
  const go = c.go;
  if (!go || go._poses) return;
  c.go = (s, hold) => {
    if (s !== 'rare' || c.state === 'rare') return go(s, hold);
    if (c.rareOff) return go('idle', 2);
    if (c.rareGate) { const h = c.rareGate(hold); if (!h) return go('idle', 1.5); hold = h; }   // held back: carries on calmly
    return go(s, hold);
  };
  c.go._poses = true;
}
