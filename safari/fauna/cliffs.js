// The cliff path: the species of the red canyon walls. A mountain track up narrow ledges to a
// lookout high over the canyon, so most of what lives here flies: the giant soaring bird that is the
// route's highlight, a harpy eagle on a rock spire, caracaras (a circling flock and a single bird
// strutting along a ledge), and the two climbers of the steep ground, the markhor and the fallow deer.
//
// The birds share one rig: a body group, a neck and head, two wings that are each an arm (shoulder
// joint) with a hand (wrist joint) on it, laid with overlapping flat feathers, and a tail that fans.
// One pose function folds, flaps, glides or mantles the wings from a handful of eased numbers.
import * as THREE from 'three';

const PI = Math.PI;
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const damp = (a, b, k, dt) => a + (b - a) * Math.min(1, k * dt);
const clamp = THREE.MathUtils.clamp;
// feathers are flat, and seen from below as often as from above
const two = (K, color, o = {}) => K.mat(color, { side: THREE.DoubleSide, roughness: 0.78, ...o });

export const SPECIES = {
  'argentavis-giant-bird': { id: 'argentavis-giant-bird', name: 'Argentavis', points: 320, call: { hz: 170, kind: 'hoot' } },
  'harpy-eagle': { id: 'harpy-eagle', name: 'Harpy eagle', points: 230, call: { hz: 1250, kind: 'trill' } },
  'crested-caracara': { id: 'crested-caracara', name: 'Crested caracara', points: 150, call: { hz: 720, kind: 'noise' } },
  'markhor': { id: 'markhor', name: 'Markhor', points: 210, call: { hz: 330, kind: 'noise' } },
  'fallow-deer': { id: 'fallow-deer', name: 'Fallow deer', points: 140, call: { hz: 120, kind: 'hoot' } },
};

// ---------------------------------------------------------------- feathers, wings, tails, eyes

// a rounded body feather and a slim pointed flight feather, unit size, base at the origin, tip at +y
const FEATHER = [[-0.3, 0], [0.3, 0], [0.5, 0.45], [0.44, 0.8], [0.2, 0.97], [0, 1], [-0.2, 0.97], [-0.44, 0.8], [-0.5, 0.45]];
const QUILL = [[-0.24, 0], [0.24, 0], [0.44, 0.4], [0.36, 0.82], [0.12, 0.98], [0, 1], [-0.14, 0.95], [-0.34, 0.8], [-0.42, 0.4]];

// one feather laid flat and pointing back (-z), turned by `yaw`, w wide and len long
function plume(K, parent, mat, p, yaw, w, len, slim = false, tilt = 0) {
  const m = K.mesh(K.shape(slim ? 'cl-quill' : 'cl-feather', slim ? QUILL : FEATHER), mat, p, parent, [-PI / 2 + tilt, yaw, 0], [w, len, 1]);
  m.rotation.order = 'YXZ';
  return m;
}

// A wing on side s (+1 = the bird's left, +x). W: { at, arm, hand, chord, bone, sec, prim, primLen, primW,
// mats: { wing, cov, prim, tip, edge } }. The arm carries the secondaries and their coverts, the hand
// the fingered primaries; both are groups so a beat bends at the wrist.
function wing(K, body, s, W) {
  const M = W.mats;
  const arm = K.group([s * W.at[0], W.at[1], W.at[2]], body);
  arm.rotation.order = 'YXZ';
  K.mesh(K.capsule(W.bone, W.arm, 3, 6), M.wing, [s * W.arm * 0.5, 0, 0], arm, [0, 0, PI / 2]);
  const ns = W.sec ?? 6;
  for (let i = 0; i < ns; i++) {
    const u = (i + 0.5) / ns, x = s * u * W.arm;
    const len = W.chord * (1.02 - 0.1 * u), yaw = s * 0.22 * (1 - u);
    plume(K, arm, M.wing, [x, -0.004, W.bone * 0.4], yaw, (W.arm / ns) * 1.8, len);
    if (M.edge) plume(K, arm, M.edge, [x - Math.sin(yaw) * len * 0.8, 0.003, W.bone * 0.4 - Math.cos(yaw) * len * 0.8], yaw, (W.arm / ns) * 1.5, len * 0.2);
    plume(K, arm, M.cov, [s * (u - 0.04) * W.arm, W.bone * 0.35, W.bone * 0.5], yaw * 0.6, (W.arm / ns) * 2, len * 0.5);
  }
  const hand = K.group([s * W.arm, 0, 0], arm);
  hand.rotation.order = 'YXZ';
  K.mesh(K.capsule(W.bone * 0.75, W.hand * 0.6, 3, 6), M.wing, [s * W.hand * 0.32, 0, 0], hand, [0, 0, PI / 2]);
  const np = W.prim;
  for (let i = 0; i < np; i++) {
    const u = i / (np - 1), yaw = -s * (0.04 + 1.15 * Math.pow(u, 1.25));
    const x = s * W.hand * (0.08 + 0.62 * u), z = W.bone * 0.3;
    const len = W.primLen * (0.8 + 0.32 * Math.sin(u * PI * 0.8));
    plume(K, hand, M.prim, [x, -0.003 * i, z], yaw, W.primW, len, true);
    if (M.tip) plume(K, hand, M.tip, [x - Math.sin(yaw) * len * 0.74, 0.004 - 0.003 * i, z - Math.cos(yaw) * len * 0.74], yaw, W.primW * 0.8, len * 0.27, true);
  }
  for (let i = 0; i < 3; i++) plume(K, hand, M.cov, [s * W.hand * (0.06 + 0.2 * i), W.bone * 0.3, W.bone * 0.5], -s * 0.15 * i, W.hand * 0.32, W.chord * 0.5);
  return { arm, hand, s };
}

// a fan of n tail feathers pointing back from `at`, with an optional band (tip or bars) on each
function fanTail(K, body, at, n, len, w, spread, mat, band, bandAt = [0.72], bandLen = 0.28) {
  const g = K.group(at, body);
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? i / (n - 1) - 0.5 : 0, yaw = -u * spread, l = len * (1 - Math.abs(u) * 0.12);
    plume(K, g, mat, [u * w * 0.6, -Math.abs(u) * 0.004, 0], yaw, w, l);
    if (band) for (const b of bandAt) plume(K, g, band, [u * w * 0.6 - Math.sin(yaw) * l * b, 0.003, -Math.cos(yaw) * l * b], yaw, w * 0.97, l * bandLen);
  }
  return g;
}

// Both eyes in one group (blinking scales it), flattened into it so the bake makes them a few draw
// calls. dir = how far round to the side the eyes look (0 = straight ahead). ring = a glowing eye-ring.
function eyePair(K, head, { x, y, z, r, iris = null, glow = 0, dir = 0.5, slit = false, ring = null }) {
  const g = K.group([0, y, 0], head);
  const dark = K.sheen(0x0b0908, { roughness: 0.12 }), shine = K.mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9 });
  const im = iris === null ? null : glow ? K.glow(iris, glow, { roughness: 0.15 }) : K.sheen(iris, { roughness: 0.15 });
  const e = new THREE.Object3D();
  for (const s of [-1, 1]) {
    e.position.set(s * x, 0, z);
    e.lookAt(s * x + s * Math.sin(dir), 0, z + Math.cos(dir));
    e.updateMatrix();
    const parts = [K.mesh(K.sphere(1, 12, 8), dark, [0, 0, 0], null, null, r)];
    if (im) {
      parts.push(K.mesh(K.sphere(1, 10, 6), im, [0, 0, r * 0.5], null, null, [r * 0.76, r * 0.76, r * 0.54]));
      parts.push(K.mesh(K.sphere(1, 8, 6), dark, [0, 0, r * 0.82], null, null, slit ? [r * 0.5, r * 0.15, r * 0.24] : [r * 0.4, r * 0.4, r * 0.24]));
    }
    if (ring) parts.push(K.mesh(K.torus(1, 0.16, 4, 14), ring, [0, 0, r * 0.62], null, null, r * 0.92));
    parts.push(K.mesh(K.sphere(1, 6, 4), shine, [-r * 0.3, r * 0.36, r * 0.9], null, null, r * 0.17));
    for (const p of parts) { p.updateMatrix(); p.matrix.premultiply(e.matrix); p.matrix.decompose(p.position, p.quaternion, p.scale); g.add(p); }
  }
  return g;
}

// a hooked raptor beak, unit length along +z, curling down at the tip
function hookBeak(K, parent, mat, p, len, w) {
  const g = K.tube('cl-hook', [[0, 0, 0], [0, 0.05, 0.42], [0, -0.08, 0.82], [0, -0.38, 1.0]], 0.36, 0.05, 7, 10);
  K.mesh(g, mat, p, parent, null, [w / 0.72, len, len]);
}

// the shared bird pose. T = targets; P = the eased state. fold 1 = wings folded on the flanks,
// mantle 1 = wings spread low around the body, amp/rate = the wing beat, dihedral = the soaring V,
// sweep = wings drawn back (+) or reached forward (-), pitch = body pitch, legs = leg swing (+ = tucked)
const BIRD_KEYS = ['fold', 'mantle', 'amp', 'dihedral', 'sweep', 'pitch', 'bank', 'legs', 'fan', 'tailUp'];
function birdState(o = {}) {
  return { fold: 0, mantle: 0, amp: 0, dihedral: 0.1, sweep: 0, pitch: 0, bank: 0, legs: 1.3, fan: 1, tailUp: 0, phase: Math.random() * 6, rate: 0, ...o };
}
function birdPose(R, dt, T, k = 3) {
  const P = R.P;
  for (const key of BIRD_KEYS) P[key] = damp(P[key], T[key], key === 'bank' ? 2 : k, dt);
  P.rate = damp(P.rate, T.rate, 4, dt);
  P.phase += dt * P.rate;
  const beat = Math.sin(P.phase) * P.amp, lag = Math.sin(P.phase - 0.9) * P.amp;
  for (const W of R.wings) {
    const s = W.s, f = P.fold, m = P.mantle, open = 1 - f;
    W.arm.rotation.set(-1.2 * f - 0.5 * m, s * (1.48 * f + 0.45 * m + 0.25 * P.sweep * open), s * ((P.dihedral + beat) * open - 0.55 * m));
    // folded, the arm shortens (its feathers stack) and the hand lies straight on along the flank
    const k = 1 - 0.55 * f;
    W.arm.scale.set(k, 1, 1 - 0.3 * f);
    W.hand.scale.set(1 / k, 1, (1 - 0.45 * f) / (1 - 0.3 * f));
    W.hand.rotation.set(0.1 * m, s * (-0.2 * P.sweep * open - 0.15 * m + 0.12 * f), s * 0.06 * f + s * (lag * 0.8 + P.dihedral * 0.6) * open + s * 0.25 * m);
  }
  R.body.rotation.x = P.pitch;
  R.body.rotation.z = P.bank;
  if (R.tail) { R.tail.scale.x = P.fan; R.tail.rotation.x = P.tailUp; }
}

// ---------------------------------------------------------------- flight off a perch and back

// lift off the perch and spiral out to a circle beside it, away from the van; later spiral back down
function takeOff(c, F) {
  const cam = c._env ? c._env.camPos : c.root.position;
  vA.subVectors(c.root.position, cam).setY(0);
  if (vA.lengthSq() < 1e-6) vA.set(Math.sin(c.root.rotation.y), 0, Math.cos(c.root.rotation.y));
  vA.normalize();
  c.air = {
    t: 0, base: c.root.position.clone(), dx: vA.x, dz: vA.z, a: Math.atan2(-vA.z, -vA.x), spin: Math.random() < 0.5 ? 1 : -1,
    dur: F.dur, r: F.r, h: F.h, v: F.v, phase: 'up', yr: 0, climb: 0,
  };
  if (c._env && c._env.call) c._env.call(c, 'flee');
}
// one step of the flight; true when it has landed again
function airStep(c, dt) {
  const A = c.air;
  A.t += dt;
  const out = A.dur === Infinity ? 1 : ease(1 - (A.t - A.dur) / 3.5);
  const k = Math.min(ease(A.t / 2.6), out), ky = Math.min(ease(A.t / 1.5), out);
  const rr = A.r * k;
  A.a += dt * A.spin * A.v / Math.max(rr, A.r * 0.3);
  const p = c.root.position;
  vB.copy(p);
  p.set(A.base.x + (A.dx + Math.cos(A.a)) * rr, A.base.y + (A.h + Math.sin(A.t * 0.5) * 1.2) * ky, A.base.z + (A.dz + Math.sin(A.a)) * rr);
  A.phase = A.t < 1.5 ? 'up' : A.t > A.dur ? 'down' : 'cruise';
  vB.subVectors(p, vB);
  A.climb = damp(A.climb, vB.y / Math.max(dt, 1e-3), 3, dt);
  if (Math.hypot(vB.x, vB.z) > 1e-4) {
    const d = wrap(Math.atan2(vB.x, vB.z) - c.root.rotation.y) * Math.min(1, dt * 5);
    c.root.rotation.y += d;
    A.yr = damp(A.yr, d / Math.max(dt, 1e-3), 3, dt);
  }
  return A.t > A.dur + 3.5;
}
// the wing targets for a bird on its flight off the perch
function airTargets(T, A, env, c) {
  const burst = Math.sin(env.t * 0.55 + c.bob) > 0.45;
  if (A.phase === 'up') Object.assign(T, { fold: 0, mantle: 0, amp: 0.95, rate: 10, dihedral: 0.15, sweep: 0, pitch: -0.55, legs: 0.5, fan: 1.3, tailUp: 0.1 });
  else if (A.phase === 'down') Object.assign(T, { fold: 0, mantle: 0, amp: 0.75, rate: 8, dihedral: 0.2, sweep: -0.25, pitch: -0.6, legs: -0.35, fan: 1.6, tailUp: 0.25 });
  else Object.assign(T, { fold: 0, mantle: 0, amp: burst ? 0.55 : 0.04, rate: burst ? 7 : 2, dihedral: 0.08, sweep: 0.05, pitch: clamp(-A.climb * 0.06, -0.3, 0.3), legs: 1.35, fan: 1.05, tailUp: 0 });
  T.bank = A.phase === 'cruise' ? clamp(-A.yr * 0.5, -0.7, 0.7) : 0;
}

// ---------------------------------------------------------------- argentavis (the giant soarer)

export function buildArgentavis(K, home, opts = {}) {
  const RAD = opts.radius ?? 60, HGT = opts.height ?? 0;
  const dark = K.mat(0x241c18, { roughness: 0.8 }), ruffM = K.mat(0xefe8da, { roughness: 0.95 }), skin = K.mat(0xd9b9a2, { roughness: 0.6 });
  const beakM = K.sheen(0xd6c9a8, { roughness: 0.35 });
  const feather = two(K, 0x1f1815), cov = two(K, 0xb8b08a, { roughness: 0.85 });
  const glowTip = K.glow(0x6ff0ff, 1.4, { side: THREE.DoubleSide });            // the wing edges light up
  const glowBase = glowTip.emissiveIntensity;

  const root = K.group();
  const near = K.group(null, root), far = K.group(null, root);
  const body = K.group([0, 0, 0], near);
  // body: a long heavy barrel, a white ruff at the neck, a bare pale neck and head
  K.mesh(K.sphere(0.3, 14, 10), dark, [0, 0, 0], body, null, [1.05, 0.9, 2.2]);
  K.mesh(K.sphere(0.24, 12, 8), dark, [0, -0.06, 0.32], body, null, [1.1, 1, 1.3]);              // deep chest
  K.mesh(K.torus(0.17, 0.1, 6, 14), ruffM, [0, 0.03, 0.6], body, [0, 0, 0]);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * PI * 2;
    K.mesh(K.sphere(0.1, 8, 6), ruffM, [Math.cos(a) * 0.18, 0.04 + Math.sin(a) * 0.16, 0.56], body, null, [1, 1, 1.4]);
  }
  K.mesh(K.capsule(0.075, 0.22, 3, 8), skin, [0, 0.05, 0.76], body, [PI / 2 - 0.15, 0, 0]);
  // legs tucked back under the tail, pale and scaly
  for (const s of [-1, 1]) K.mesh(K.capsule(0.05, 0.36, 3, 6), ruffM, [s * 0.12, -0.22, -0.36], body, [PI / 2 + 0.15, 0, 0]);
  // the head: bare, cream-pink, with a heavy pale hooked beak and amber eyes in glowing rings
  const head = K.group([0, 0.09, 0.92], body);
  head.scale.setScalar(1.25);
  K.mesh(K.sphere(0.12, 12, 9), skin, [0, 0, 0], head, null, [0.92, 0.92, 1.18]);
  K.mesh(K.sphere(0.07, 10, 6), skin, [0, -0.03, 0.08], head, null, [1.05, 0.9, 1.1]);               // cheeks
  K.mesh(K.sphere(0.06, 8, 6), K.mat(0x7c5f50), [0, 0.03, 0.12], head, null, [0.9, 0.55, 0.8]);     // the cere
  hookBeak(K, head, beakM, [0, 0.0, 0.11], 0.17, 0.075);
  const eyes = eyePair(K, head, { x: 0.068, y: 0.035, z: 0.06, r: 0.022, iris: 0xffb347, glow: 1.2, dir: 0.75, ring: glowTip });
  // the wings: ~7 m across, a pale covert band, fingered primaries with glowing tips
  const WS = { at: [0.24, 0.1, 0.28], arm: 1.35, hand: 1.75, chord: 0.86, bone: 0.085, sec: 8, prim: 7, primLen: 1.1, primW: 0.2,
    mats: { wing: feather, cov, prim: feather, tip: glowTip, edge: glowTip } };
  const wings = [wing(K, body, -1, WS), wing(K, body, 1, WS)];
  const tail = fanTail(K, body, [0, 0.03, -0.6], 9, 0.6, 0.17, 0.6, feather, glowTip, [0.82], 0.16);
  const R = { body, wings, tail, P: birdState({ dihedral: 0.14, legs: 0 }) };

  // far: barrel, head, ruff and one flat wing slab that still banks and beats
  K.mesh(K.sphere(0.3, 8, 6), dark, [0, 0, 0], far, null, [1.05, 0.9, 2.4]);
  K.mesh(K.sphere(0.2, 8, 6), ruffM, [0, 0.03, 0.62], far);
  K.mesh(K.sphere(0.12, 6, 5), skin, [0, 0.08, 0.92], far);
  const farW = K.group(null, far);
  K.mesh(K.shape('cl-argfar', [[-3.3, -0.2], [-1.6, 0.25], [0, 0.35], [1.6, 0.25], [3.3, -0.2], [3.2, -0.75], [1.5, -0.85], [0, -0.7], [-1.5, -0.85], [-3.2, -0.75]]), feather, [0, 0.05, 0.3], farW, [-PI / 2, 0, 0]);

  K.place(root, home);
  const T = {};
  const fly = { a: Math.random() * PI * 2, r: 0, cx: home.x, cz: home.z, y: home.y + HGT, fig: 0, yr: 0, climb: 0, call: 0 };
  const c = K.makeCreature({
    species: SPECIES['argentavis-giant-bird'], root, home, flyer: true, radius: 3.4, eye: new THREE.Vector3(0, 0.12, 0.95),
    speed: 11, roam: RAD, fleeAt: 9, curiousAt: 70, shy: 0.2, rareChance: 0.5, rareAt: 'dusk',
    onState(c, s) { if (s === 'rare' && c._env && c._env.call) c._env.call(c, 'rare'); },
    pose(c, dt, env) {
      const st = c.state;
      const beatWin = Math.sin(env.t * 0.21 + c.bob) > 0.72 || st === 'flee';
      Object.assign(T, { fold: 0, mantle: 0, amp: beatWin ? 0.34 : 0.025, rate: beatWin ? 2.3 : 0.8, dihedral: 0.14, sweep: 0.05,
        pitch: clamp(-fly.climb * 0.04, -0.25, 0.25), bank: clamp(-fly.yr * 1.8, -0.55, 0.55), legs: 0, fan: 1, tailUp: 0 });
      if (st === 'curious') T.sweep = -0.05;
      let pulse = 0;
      if (st === 'rare') {                                       // the low pass: everything spread, the edges blaze
        const u = ease(c.t / 1.5);
        T.amp = 0; T.dihedral = 0.03; T.sweep = -0.3 * u; T.fan = 1 + 0.6 * u; T.tailUp = -0.1 * u;
        pulse = u * (0.6 + 0.4 * Math.sin(c.t * 4.2));
      }
      birdPose(R, dt, T, 1.6);
      glowTip.emissiveIntensity = glowBase * (1 + 2.5 * pulse) + pulse * 0.8;
      K.look(c, head, env, dt, { yaw: 1.1, pitch: 0.6, rate: 2, force: st === 'curious' || st === 'rare' || c.near < 45 });
      K.blink(c, [eyes], dt);
      body.scale.y = 1 + Math.sin(env.t * 1.3) * 0.012;
      farW.rotation.z = Math.sin(R.P.phase) * R.P.amp * 0.6;
    },
  });
  // the soaring loop replaces the walking: big slow circles or figure-eights about the home point,
  // a swing past the van when curious, a low pass for the rare one. It never lands and never goes far.
  c.step = (dt, env) => {
    c._env = env; c.t += dt;
    const d = env.dist, st = c.state;
    if (st !== 'flee' && st !== 'rare' && d < c.fleeAt) c.go('flee', 6);
    else if (st === 'idle' || st === 'wander') {
      if (d < c.curiousAt && c.t > 3 && Math.random() < dt * 0.2) c.go('curious', 12 + Math.random() * 6);
      else if (c.rareAt === env.tod && Math.random() < dt * 0.03) c.go('rare', 10);
      else if (c.t > c.hold) c.go(st === 'idle' ? 'wander' : 'idle', 18 + Math.random() * 14);
    } else if (st === 'curious' && c.t > c.hold) c.go(Math.random() < c.rareChance * 0.5 ? 'rare' : 'idle', 10 + Math.random() * 6);
    else if ((st === 'rare' || st === 'flee') && c.t > c.hold) c.go('idle', 12);

    let tr = RAD, ty = home.y + HGT, tcx = home.x, tcz = home.z, v = 10;
    const fig = c.state === 'wander' ? 1 : 0;
    if (c.state === 'curious' || c.state === 'rare') {
      const rare = c.state === 'rare';
      vA.set(home.x - env.camPos.x, 0, home.z - env.camPos.z);
      if (vA.lengthSq() < 1) vA.set(1, 0, 0);
      vA.normalize();
      tr = Math.min(RAD, rare ? 22 : 30);
      tcx = env.camPos.x + vA.x * (tr + (rare ? 7 : 15)); tcz = env.camPos.z + vA.z * (tr + (rare ? 7 : 15));
      ty = rare ? env.camPos.y + 4 : Math.max(home.y + HGT - 8, env.camPos.y + 9);
      v = rare ? 12 : 10;
    } else if (c.state === 'flee') { ty += 14; tr = RAD * 1.15; v = 12; }
    fly.cx = damp(fly.cx, tcx, 0.3, dt); fly.cz = damp(fly.cz, tcz, 0.3, dt);
    fly.r = damp(fly.r, tr, 0.3, dt); fly.y = damp(fly.y, ty, 0.35, dt); fly.fig = damp(fly.fig, fig, 0.25, dt);
    fly.a += dt * v / Math.max(fly.r, 9);
    const p = c.root.position;
    vB.copy(p);
    p.set(fly.cx + Math.cos(fly.a) * fly.r, fly.y + Math.sin(fly.a * 2 + c.bob) * 2.5,
      fly.cz + Math.sin(fly.a) * fly.r * (1 - fly.fig + fly.fig * Math.cos(fly.a)));
    vB.subVectors(p, vB);
    fly.climb = damp(fly.climb, vB.y / Math.max(dt, 1e-3), 2, dt);
    if (Math.hypot(vB.x, vB.z) > 1e-4) {
      const dy = wrap(Math.atan2(vB.x, vB.z) - c.root.rotation.y) * Math.min(1, dt * 3);
      c.root.rotation.y += dy;
      fly.yr = damp(fly.yr, dy / Math.max(dt, 1e-3), 2, dt);
    }
    c.pose(c, dt, env);
    c.root.updateMatrixWorld();
  };
  return K.lod(c, near, far, 85);
}

// ---------------------------------------------------------------- harpy eagle (on a rock spire)

export function buildHarpyEagle(K, home, opts = {}) {
  const perch = opts.perch ?? true;
  const slate = K.mat(0x2a2e39, { roughness: 0.75 }), white = K.mat(0xebe8e1, { roughness: 0.9 });
  const grey = K.mat(0x8d8a89, { roughness: 0.9 }), face = K.mat(0xbcb8b4, { roughness: 0.9 });
  const beakM = K.sheen(0x2c2b30, { roughness: 0.3 }), yellow = K.mat(0xe6b13a, { roughness: 0.55 });
  const feather = two(K, 0x2a2e39), crestM = two(K, 0x463f3c, { roughness: 0.9 }), bandM = two(K, 0x9c9da5);
  const amber = K.glow(0xffb24a, 1.3, { side: THREE.DoubleSide });

  const root = K.group();
  const near = K.group(null, root), far = K.group(null, root);
  const body = K.group([0, 0.3, 0], near);
  // body (+z along the spine): slate back, white belly and thighs, a black band across the chest
  K.mesh(K.sphere(0.2, 14, 10), slate, [0, 0.02, 0.18], body, null, [1.0, 0.95, 1.55]);
  K.mesh(K.sphere(0.18, 12, 9), white, [0, -0.07, 0.15], body, null, [0.95, 0.85, 1.45]);
  K.mesh(K.sphere(0.16, 12, 8), slate, [0, -0.02, 0.38], body, null, [1.05, 0.95, 0.75]);        // chest band
  for (const s of [-1, 1]) K.mesh(K.sphere(0.08, 10, 7), white, [s * 0.08, -0.12, 0.02], body, null, [0.9, 1.1, 1.5]);   // feathered thighs
  const neck = K.group([0, 0.05, 0.44], body);
  const head = K.group([0, 0.09, 0.0], neck);
  // the head: big, round and grey, a pale facial disc, a heavy black hook, forward-facing eyes
  K.mesh(K.capsule(0.09, 0.1, 3, 8), grey, [0, -0.08, -0.02], head);
  K.mesh(K.sphere(0.13, 14, 10), grey, [0, 0.02, 0], head, null, [1, 0.98, 1.0]);
  K.mesh(K.sphere(0.11, 12, 8), face, [0, 0.0, 0.05], head, null, [1.05, 1.0, 0.75]);
  hookBeak(K, head, beakM, [0, 0.0, 0.115], 0.11, 0.06);
  K.mesh(K.sphere(0.03, 8, 6), beakM, [0, 0.015, 0.11], head, null, [1.1, 0.8, 1]);
  const eyes = eyePair(K, head, { x: 0.052, y: 0.03, z: 0.1, r: 0.021, iris: 0xffa640, glow: 1.0, dir: 0.28, ring: amber });
  // the crest: a double fan of dark feathers, folded back at rest, raised when it is curious
  const crest = K.group([0, 0.11, -0.03], head);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const sp = s * (0.12 + 0.24 * i), len = 0.13 - i * 0.012;
    K.mesh(K.shape('cl-feather', FEATHER), crestM, [s * (0.035 + 0.012 * i), 0, -0.008 * i], crest, [0, 0, -sp], [0.055, len, 1]);
    K.mesh(K.shape('cl-quill', QUILL), amber, [s * (0.035 + 0.012 * i) - Math.sin(-sp) * len * 0.78, Math.cos(sp) * len * 0.78, -0.008 * i + 0.002], crest, [0, 0, -sp], [0.03, len * 0.22, 1]);
  }
  // broad rounded wings, a long barred tail, huge yellow feet
  const WS = { at: [0.16, 0.12, 0.36], arm: 0.42, hand: 0.48, chord: 0.36, bone: 0.035, sec: 6, prim: 6, primLen: 0.4, primW: 0.075,
    mats: { wing: feather, cov: feather, prim: feather, tip: amber } };
  const wings = [wing(K, body, -1, WS), wing(K, body, 1, WS)];
  const tail = fanTail(K, body, [0, 0.0, -0.14], 7, 0.44, 0.1, 0.36, feather, bandM, [0.3, 0.6], 0.12);
  const legs = [-1, 1].map((s) => {
    const g = K.group([s * 0.075, 0.22, 0.02], near);
    K.mesh(K.capsule(0.03, 0.14, 3, 7), yellow, [0, -0.12, 0], g);
    for (const a of [-0.45, 0, 0.45, PI]) K.mesh(K.capsule(0.017, 0.07, 2, 5), yellow, [Math.sin(a) * 0.045, -0.21, Math.cos(a) * 0.045], g, [PI / 2, a, 0]);
    return g;
  });
  const shade = K.shadow(root, 0.35);
  const R = { body, wings, tail, P: birdState({ fold: 1, pitch: -1.0, legs: 0 }) };

  // far: body, belly, head, and wings as one slab that folds in when perched
  const fb = K.group([0, 0.3, 0], far);
  K.mesh(K.sphere(0.2, 8, 6), slate, [0, 0.02, 0.18], fb, null, [1, 0.95, 1.6]);
  K.mesh(K.sphere(0.17, 8, 6), white, [0, -0.07, 0.15], fb, null, [0.95, 0.85, 1.4]);
  K.mesh(K.sphere(0.14, 8, 6), grey, [0, 0.12, 0.48], fb);
  const fw = K.group([0, 0.06, 0.25], fb);
  K.mesh(K.box(2.0, 0.03, 0.42), slate, [0, 0, -0.18], fw);

  K.place(root, home);
  const T = {};
  const c = K.makeCreature({
    species: SPECIES['harpy-eagle'], root, home, flyer: true, radius: 0.6, eye: new THREE.Vector3(0, 0.95, 0.12),
    fleeAt: 14, curiousAt: 32, shy: 0.6, rareChance: 0.5, rareAt: 'dawn',
    onState(c, s) { if (s === 'rare' && c._env && c._env.call) c._env.call(c, 'rare'); },
    pose(c, dt, env) {
      const A = c.air, st = c.state;
      let raise = 0.38 + 0.12 * Math.sin(env.t * 0.7 + c.bob);
      if (A) { airTargets(T, A, env, c); raise = 0; }
      else {
        const rare = st === 'rare' ? ease(c.t / 0.9) : 0;
        Object.assign(T, { fold: 1 - rare, mantle: rare, amp: 0, rate: 0, dihedral: 0, sweep: 0, pitch: -1.0 + 0.3 * rare, bank: 0, legs: 0, fan: 1 + 0.5 * rare, tailUp: 0.1 * rare });
        if (st === 'curious') raise = 0.85;
        if (st === 'rare') raise = 1;
      }
      birdPose(R, dt, T, A ? 4 : 2.5);
      neck.rotation.x = -R.body.rotation.x * 0.92;
      crest.rotation.x = damp(crest.rotation.x, THREE.MathUtils.lerp(-1.35, -0.05, raise), 3, dt);
      K.look(c, head, env, dt, { yaw: 1.5, pitch: 0.55, rate: 3, force: !A && (st === 'curious' || st === 'rare') });
      K.blink(c, [eyes], dt);
      const breathe = 1 + Math.sin(env.t * 1.6 + c.bob) * 0.015;
      body.scale.set(breathe, breathe, 1);
      for (const l of legs) l.rotation.x = R.P.legs;
      shade.visible = !A;
      fb.rotation.x = R.body.rotation.x; fb.rotation.z = R.body.rotation.z;
      fw.scale.x = 0.22 + 0.78 * (1 - R.P.fold);
      fw.rotation.z = Math.sin(R.P.phase) * R.P.amp * 0.5;
    },
  });
  // perched it never walks: it sits, watches, raises the crest, and bolts into the air when the van
  // comes close, circles the spire and comes back to the same perch
  c.step = (dt, env) => {
    c._env = env; c.t += dt;
    if (!perch && !c.air) takeOff(c, { dur: Infinity, r: opts.radius ?? 18, h: opts.height ?? 6, v: 8 });
    if (c.air) {
      if (airStep(c, dt)) { c.air = null; c.go('idle', 2 + Math.random() * 2); }
    } else {
      const st = c.state, d = env.dist;
      if (st !== 'flee' && st !== 'rare' && d < c.fleeAt * (0.6 + c.shy * 0.8)) c.go('flee', 9 + Math.random() * 5);
      else if (st === 'idle') {
        if (d < c.curiousAt && c.t > 0.6 && Math.random() < dt * (1.2 - c.shy)) c.go('curious', 3 + Math.random() * 3);
        else if (c.rareAt === env.tod && Math.random() < dt * 0.06) c.go('rare', 6);
      } else if (st === 'curious' && c.t > c.hold) c.go(Math.random() < c.rareChance * 0.4 ? 'rare' : 'idle', 4 + Math.random() * 3);
      else if (st === 'rare' && c.t > c.hold) c.go('idle', 3);
      else if (st === 'wander' || st === 'eat') c.go('idle', 2);
      if (c.state === 'flee') takeOff(c, { dur: Math.min(c.hold, 30), r: 14, h: 9, v: 8 });
    }
    c.pose(c, dt, env);
    c.root.updateMatrixWorld();
  };
  return K.lod(c, near, far, 45);
}

// ---------------------------------------------------------------- crested caracara

// One caracara body. lite = a flock bird: no neck or leg joints, legs tucked, head fixed.
function caracaraRig(K, parent, lite) {
  const black = K.mat(0x1d1714, { roughness: 0.78 }), white = K.mat(0xeee8dc, { roughness: 0.9 });
  const faceM = K.glow(0xff7a2c, 0.9, { roughness: 0.5 }), beakM = K.sheen(0xa9bccb, { roughness: 0.3 });
  const yellow = K.mat(0xe8b62e, { roughness: 0.5 });
  const feather = two(K, 0x231b16), pale = two(K, 0xe2dccd), cap = two(K, 0x161210);
  const body = K.group(lite ? null : [0, 0.2, 0], parent);
  // body: dark, with a white barred breast and white under the tail
  K.mesh(K.sphere(0.085, 12, 9), black, [0, 0, 0.08], body, null, [1, 1, 1.8]);
  K.mesh(K.sphere(0.07, 10, 8), white, [0, -0.008, 0.18], body, null, [1.08, 1.02, 1.15]);
  for (let i = 0; i < 4; i++) K.mesh(K.torus(0.072 - i * 0.004, 0.0065, 3, 12, PI), black, [0, -0.008 - i * 0.004, 0.13 + i * 0.026], body, [0, 0, PI]);
  K.mesh(K.sphere(0.05, 8, 6), white, [0, -0.04, -0.06], body, null, [1, 0.8, 1.4]);
  if (!lite) for (const s of [-1, 1]) K.mesh(K.sphere(0.03, 8, 6), black, [s * 0.035, -0.04, 0.02], body, null, [0.8, 1.5, 1]);
  else for (const s of [-1, 1]) K.mesh(K.capsule(0.008, 0.11, 2, 5), yellow, [s * 0.03, -0.05, -0.08], body, [PI / 2 + 0.2, 0, 0]);
  // neck and head: white cheeks, a black cap with a short crest, orange bare face, pale blue hook
  const neck = lite ? null : K.group([0, 0.035, 0.25], body);
  const head = lite ? body : K.group([0, 0.09, 0], neck);
  const ho = lite ? [0, 0.05, 0.33] : [0, 0, 0];
  const at = (x, y, z) => [ho[0] + x, ho[1] + y, ho[2] + z];
  K.mesh(K.capsule(0.042, 0.07, 3, 8), white, at(0, -0.06, -0.01), head, [lite ? 1.1 : 0.2, 0, 0]);
  K.mesh(K.sphere(0.054, 12, 9), white, at(0, 0, 0), head, null, [0.9, 0.95, 1.15]);
  K.mesh(K.sphere(0.056, 12, 8), black, at(0, 0.015, -0.006), head, null, [0.94, 0.72, 1.16]);
  K.mesh(K.shape('cl-feather', FEATHER), cap, at(0, 0.03, -0.045), head, [-PI / 2 - 0.5, PI, 0], [0.05, 0.06, 1]);
  K.mesh(K.sphere(0.034, 10, 7), faceM, at(0, -0.006, 0.035), head, null, [1.3, 0.85, 1.05]);
  hookBeak(K, head, beakM, at(0, -0.003, 0.06), 0.052, 0.03);
  const eyes = eyePair(K, head, { x: 0.036, y: ho[1] + 0.008, z: ho[2] + 0.028, r: 0.0115, iris: 0x5a3018, dir: 0.75 });
  // wings: dark with a pale barred patch across the primaries, dark tips
  const WS = { at: [0.066, 0.035, 0.2], arm: 0.2, hand: 0.26, chord: 0.15, bone: 0.017, sec: 6, prim: 6, primLen: 0.2, primW: 0.045,
    mats: { wing: feather, cov: feather, prim: pale, tip: feather } };
  const wings = [wing(K, body, -1, WS), wing(K, body, 1, WS)];
  const tail = fanTail(K, body, [0, 0.005, -0.1], 6, 0.21, 0.05, 0.3, pale, feather, [0.75], 0.25);
  let legs = null;
  if (!lite) legs = [-1, 1].map((s) => {
    const g = K.group([s * 0.035, 0.19, 0.0], parent);
    K.mesh(K.capsule(0.009, 0.12, 2, 6), yellow, [0, -0.1, 0], g);
    for (const a of [-0.5, 0, 0.5, PI]) K.mesh(K.capsule(0.006, 0.035, 2, 4), yellow, [Math.sin(a) * 0.022, -0.183, Math.cos(a) * 0.022], g, [PI / 2, a, 0]);
    return g;
  });
  return { body, neck, head, eyes, wings, tail, legs, P: birdState({ fold: lite ? 0 : 1, pitch: lite ? 0 : -0.55, legs: 0 }) };
}
// a far caracara: dark body with the white head, and one wing slab
function caracaraFar(K, parent, lite) {
  const black = K.mat(0x1d1714, { roughness: 0.78 }), white = K.mat(0xeee8dc, { roughness: 0.9 });
  const b = K.group(lite ? null : [0, 0.2, 0], parent);
  K.mesh(K.sphere(0.09, 8, 6), black, [0, 0, 0.06], b, null, [1, 1, 2]);
  K.mesh(K.sphere(0.06, 6, 5), white, lite ? [0, 0.05, 0.31] : [0, 0.1, 0.28], b);
  const w = K.group([0, 0.03, 0.15], b);
  K.mesh(K.box(1.0, 0.012, 0.15), black, [0, 0, -0.07], w);
  return { b, w };
}

// the flock: 6-9 caracaras circling over the canyon. opts: { n, radius, height, speed, scale }
export function buildCaracaraFlock(K, home, opts = {}) {
  const n = opts.n ?? 6 + Math.floor(K.rand() * 4), S = opts.scale ?? 1.45;
  const root = K.group();
  const bodies = [], rigs = [];
  for (let i = 0; i < n; i++) {
    const b = K.group(null, root);
    b.scale.setScalar(S * (0.92 + K.rand() * 0.16));
    const near = K.group(null, b), far = K.group(null, b);
    const R = caracaraRig(K, near, true), F = caracaraFar(K, far, true);
    far.visible = false;
    Object.assign(R, { near, far: F, isFar: false, prev: new THREE.Vector3(), yaw: 0, yr: 0, t0: -1, T: {} });
    b.userData.rig = R;
    bodies.push(b); rigs.push(R);
  }
  K.place(root);                                          // bodies fly in world space: the root stays at the origin
  const c = K.makeFlock({
    species: SPECIES['crested-caracara'], root, bodies, centre: home, radius: opts.radius ?? 24, height: opts.height ?? 12,
    speed: opts.speed ?? 0.24, climb: 3.5,
    pose(b, i, t, state) {
      const R = b.userData.rig, dt = R.t0 < 0 ? 1 / 30 : Math.max(1e-3, t - R.t0);
      R.t0 = t;
      // face along the flight path and bank into the turn
      if (R.prev.lengthSq() > 0) {
        vC.subVectors(b.position, R.prev);
        if (Math.hypot(vC.x, vC.z) > 1e-4) {
          const d = wrap(Math.atan2(vC.x, vC.z) - R.yaw);
          R.yaw += d; R.yr = damp(R.yr, d / dt, 3, dt);
        }
      }
      R.prev.copy(b.position);
      b.rotation.set(0, R.yaw, 0);
      const flapping = Math.sin(t * 0.7 + i * 1.9) > -0.2;
      const dive = state === 'rare';
      Object.assign(R.T, { fold: dive ? 0.35 : 0, mantle: 0, amp: dive ? 0.08 : flapping ? 0.6 : 0.05, rate: flapping ? 8.5 : 2, dihedral: 0.1, sweep: dive ? 0.5 : 0,
        pitch: 0, bank: clamp(-R.yr * 0.9, -0.6, 0.6), legs: 0, fan: flapping ? 1 : 1.3, tailUp: 0 });
      if (!R.isFar) birdPose(R, dt, R.T, 4);
      else { R.P.phase += dt * R.T.rate; R.body.rotation.z = R.T.bank; }
      R.far.b.rotation.z = R.T.bank;
      R.far.w.rotation.z = Math.sin(R.P.phase) * R.T.amp * 0.6;
    },
  });
  // each bird swaps to its far body on its own, by its own distance to the van
  const flockStep = c.step;
  c.step = (dt, env) => {
    flockStep(dt, env);
    for (const R of rigs) {
      const f = R.prev.distanceTo(env.camPos) > 32;
      if (f !== R.isFar) { R.isFar = f; R.near.visible = !f; R.far.b.parent.visible = f; }
    }
  };
  return c;
}

// a single caracara strutting on a ledge; it hops off and circles when the van comes near
export function buildCaracaraPerched(K, home, opts = {}) {
  const root = K.group();
  root.scale.setScalar(opts.scale ?? 1.45);
  const near = K.group(null, root), far = K.group(null, root);
  const R = caracaraRig(K, near, false), F = caracaraFar(K, far, false);
  const shade = K.shadow(root, 0.2);
  K.place(root, home);
  const T = {};
  let peck = 0, prevX = home.x, prevZ = home.z, sp = 0;
  const c = K.makeCreature({
    species: SPECIES['crested-caracara'], root, home, ground: K.groundY, radius: 0.5, eye: new THREE.Vector3(0, 0.39, 0.2),
    speed: 0.9, roam: opts.roam ?? 2.5, fleeAt: 9, curiousAt: 24, shy: 0.45, rareChance: 0.6, rareAt: 'dawn',
    onState(c, s) { if (s === 'rare' && c._env && c._env.call) c._env.call(c, 'rare'); },
    pose(c, dt, env) {
      const A = c.air, st = c.state;
      const p = c.root.position;
      sp = damp(sp, Math.hypot(p.x - prevX, p.z - prevZ) / Math.max(dt, 1e-3), 6, dt);
      prevX = p.x; prevZ = p.z;
      let neckX = 0, swing = 0;
      if (A) airTargets(T, A, env, c);
      else {
        const walking = sp > 0.08;
        c.bob += dt * (walking ? 4 + sp * 8 : 0);
        swing = walking ? Math.sin(c.bob) * 0.55 : 0;
        Object.assign(T, { fold: 1, mantle: 0, amp: 0, rate: 0, dihedral: 0, sweep: 0, pitch: -0.55 + (walking ? 0.12 : 0), bank: 0, legs: 0, fan: 1, tailUp: 0.15 });
        // a forager: when it stands it stoops and pecks at the ledge now and then
        const pecking = (st === 'idle' && Math.sin(env.t * 0.8 + c.bob * 3) > 0.55) || (st === 'eat' && !walking);
        peck = damp(peck, pecking ? 1 : 0, 5, dt);
        neckX = peck * (1.1 + 0.25 * Math.max(0, Math.sin(env.t * 11)));
        if (st === 'rare') {                                     // the head-throw: head flung back, calling
          const u = ease(c.t / 0.5) * ease((c.hold - c.t) / 0.5);
          neckX = -1.9 * u + Math.sin(c.t * 9) * 0.12 * u;
          T.mantle = 0.25 * u; T.fold = 1 - 0.25 * u; T.fan = 1 + 0.5 * u; T.pitch = -0.75;
        }
        R.head.position.z = walking ? Math.max(0, Math.sin(c.bob * 2)) * 0.02 : 0;   // the head bob of a walking bird
        if (Number.isFinite(c.ground(p.x, p.z)) && !A) p.y = c.ground(p.x, p.z);
      }
      birdPose(R, dt, T, A ? 4 : 3);
      R.neck.rotation.x = damp(R.neck.rotation.x, -R.body.rotation.x * 0.9 + neckX, 8, dt);
      K.look(c, R.head, env, dt, { yaw: 1.4, pitch: 0.5, rate: 4, force: !A && st === 'curious' });
      K.blink(c, [R.eyes], dt);
      R.legs[0].rotation.x = R.P.legs + swing; R.legs[1].rotation.x = R.P.legs - swing;
      R.body.position.y = 0.2 + (swing ? Math.abs(Math.sin(c.bob)) * 0.01 : 0);
      shade.visible = !A;
      F.b.rotation.x = R.body.rotation.x; F.b.rotation.z = R.body.rotation.z;
      F.w.scale.x = 0.25 + 0.75 * (1 - R.P.fold);
    },
  });
  const walk = c.step;
  c.step = (dt, env) => {
    c._env = env;
    if (c.air) {
      c.t += dt;
      if (airStep(c, dt)) { c.air = null; c.home.copy(c.root.position); c.go('idle', 2); }
      c.pose(c, dt, env);
      c.root.updateMatrixWorld();
      return;
    }
    walk(dt, env);
    if (c.state === 'flee') takeOff(c, { dur: c.hold > 100 ? 20 : 8 + Math.random() * 5, r: 8, h: 5, v: 7 });
  };
  return K.lod(c, near, far, 40);
}

// ---------------------------------------------------------------- the climbers: shared legs and gait

// a leg: an upper group (hip/shoulder) and a lower one (knee/hock) so the gait bends
function leg(K, parent, at, L, upper, lower) {
  const hip = K.group(at, parent);
  K.mesh(K.sphere(L.r0, 8, 6), upper, [0, 0, 0], hip, null, [1, 1.3, 1.25]);
  K.mesh(K.cyl(L.r0, L.r1 * 1.25, L.up, 7), upper, [0, -L.up * 0.5, 0], hip);
  const knee = K.group([0, -L.up, 0], hip);
  K.mesh(K.capsule(L.r1, L.low, 2, 6), lower, [0, -L.low * 0.5, 0], knee);
  K.mesh(K.cyl(L.r1 * 1.05, L.r1 * 1.35, L.hoof, 6), lower, [0, -L.low - L.hoof * 0.25, 0.008], knee);
  return { hip, knee };
}
// walk (lateral sequence) and gallop footfall offsets for [LF, RF, LH, RH]
const WALK = [0.25, 0.75, 0, 0.5], GALLOP = [0.1, 0.0, 0.55, 0.45];
// one step of the gait: legs, bob and the slope. Q: { root-ish parts }, sp = ground speed
function gait(Q, c, dt, sp, slope) {
  const moving = sp > 0.12, run = sp > 2.4;
  Q.amp = damp(Q.amp, moving ? (run ? 0.75 : 0.38) : 0, 5, dt);
  c.bob += dt * (moving ? (run ? 1.9 + sp * 0.18 : 0.9 + sp * 0.55) : 0) * PI;
  const off = run ? GALLOP : WALK;
  Q.legs.forEach((l, i) => {
    const ps = c.bob + off[i] * PI * 2, front = i < 2;
    const swingBack = -Math.sin(ps) * Q.amp;
    l.hip.rotation.x = damp(l.hip.rotation.x, swingBack + slope * 0.75 + (l.extraHip || 0), 12, dt);
    const flex = Math.max(0, Math.cos(ps)) * Q.amp * (front ? 1.8 : 1.3);
    l.knee.rotation.x = damp(l.knee.rotation.x, flex + (l.extraKnee || 0), 12, dt);
  });
  return moving ? -Math.abs(Math.cos(c.bob * 2)) * (run ? 0.05 : 0.02) : 0;
}
// the ground under the animal: put the feet on it and pitch the body along the slope
function slopeOf(c, Q, dt) {
  const p = c.root.position, y = c.root.rotation.y, fx = Math.sin(y), fz = Math.cos(y);
  const h1 = c.ground(p.x + fx * 0.6, p.z + fz * 0.6), h0 = c.ground(p.x - fx * 0.6, p.z - fz * 0.6);
  const hl = c.ground(p.x + fz * 0.3, p.z - fx * 0.3), hr = c.ground(p.x - fz * 0.3, p.z + fx * 0.3);
  if (!Number.isFinite(h1 + h0 + hl + hr)) return 0;
  p.y = (h1 + h0 + hl + hr) * 0.25;
  const pitch = clamp(Math.atan2(h1 - h0, 1.2), -0.6, 0.6);
  Q.tilt.rotation.x = damp(Q.tilt.rotation.x, -pitch, 6, dt);
  Q.tilt.rotation.z = damp(Q.tilt.rotation.z, clamp(Math.atan2(hl - hr, 0.6), -0.25, 0.25) * 0.5, 6, dt);
  return -Q.tilt.rotation.x;
}

// a corkscrew horn: a helix whose coils widen towards the tip; s mirrors the twist
function helix(s, L, turns, r0, r1, axis, n = 26, edge = 0) {
  const A = new THREE.Vector3(...axis).normalize();
  const B1 = new THREE.Vector3().crossVectors(A, new THREE.Vector3(0, 0, 1)).normalize();
  const B2 = new THREE.Vector3().crossVectors(A, B1).normalize();
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, th = s * turns * PI * 2 * t, R = THREE.MathUtils.lerp(r0, r1, t);
    const radial = B1.clone().multiplyScalar(Math.cos(th)).addScaledVector(B2, Math.sin(th));
    pts.push(A.clone().multiplyScalar(t * L).addScaledVector(radial, R + edge * (1 - t * 0.7)).addScaledVector(B1, -r0));
  }
  return pts;
}

// ---------------------------------------------------------------- markhor

export function buildMarkhor(K, home, opts = {}) {
  const coat = K.mat(0xa59c8c, { roughness: 0.92 }), shoulderM = K.mat(0x8a8072, { roughness: 0.92 });
  const white = K.mat(0xe6e1d6, { roughness: 0.95 }), dark = K.mat(0x2e2722, { roughness: 0.9 });
  const headM = K.mat(0x52483f, { roughness: 0.9 }), legLow = K.mat(0xd9d3c7, { roughness: 0.9 });
  const hornM = K.mat(0x8f8573, { roughness: 0.6 }), keel = K.glow(0x8ff3ff, 1.1);

  const root = K.group();
  const near = K.group(null, root), far = K.group(null, root);
  const tilt = K.group(null, near);
  const body = K.group([0, 0.74, -0.38], tilt);                 // pivots at the hips, so it can rear
  // torso: a deep grey-tan barrel, darker over the shoulders, pale belly
  K.mesh(K.sphere(0.3, 14, 10), coat, [0, 0.04, 0.4], body, null, [0.85, 1, 1.62]);
  K.mesh(K.sphere(0.25, 12, 9), coat, [0, 0.0, 0.08], body, null, [0.95, 1, 0.95]);
  K.mesh(K.sphere(0.27, 12, 9), shoulderM, [0, 0.03, 0.66], body, null, [0.92, 1.05, 1.0]);
  K.mesh(K.sphere(0.25, 12, 8), white, [0, -0.13, 0.4], body, null, [0.75, 0.5, 1.45]);
  // the ruff: a long shaggy apron down the chest, white at the sides, a dark mane down the front;
  // it hangs from the chest in its own group, so it still hangs when the buck rears
  const ruff = K.group([0, -0.05, 0.8], body);
  K.mesh(K.cone(0.24, 0.62, 8), white, [0, -0.19, 0], ruff, [PI + 0.1, 0, 0], [1, 1, 0.62]);
  K.mesh(K.cone(0.12, 0.66, 6), dark, [0, -0.2, 0.12], ruff, [PI + 0.14, 0, 0], [1, 1, 0.5]);
  for (let i = 0; i < 12; i++) {
    const a = -1.3 + (i / 11) * 2.6, x = Math.sin(a) * 0.2, z = 0.8 + Math.cos(a) * 0.1, len = 0.5 + ((i * 7) % 5) * 0.04 - Math.abs(a) * 0.1;
    K.mesh(K.cone(0.055, len, 6), Math.abs(a) < 0.3 ? dark : white, [x, -0.07 - len * 0.35, z - 0.8], ruff, [PI + 0.1, 0, -x * 0.6 + ((i % 3) - 1) * 0.06], [1, 1, 0.8]);
  }
  const neck = K.group([0, 0.16, 0.86], body);
  K.mesh(K.capsule(0.12, 0.3, 3, 8), shoulderM, [0, 0.16, 0.0], neck);
  // the neck ruff: locks hanging forward of the throat
  K.mesh(K.cone(0.13, 0.4, 7), white, [0, 0.12, 0.07], neck, [PI - 0.2, 0, 0], [1, 1, 0.6]);
  for (let i = 0; i < 5; i++) K.mesh(K.cone(0.06, 0.42, 6), i === 2 ? dark : white, [(i - 2) * 0.05, 0.12 + 0.04 * (i % 2), 0.1], neck, [PI - 0.15, 0, (i - 2) * 0.1], [1, 1, 0.8]);
  const neckEnd = K.group([0, 0.36, 0.0], neck);
  const head = K.group(null, neckEnd);
  // the head: long and dark, a chin beard, swept ears, and the great corkscrew horns
  K.mesh(K.sphere(0.11, 12, 9), headM, [0, 0.03, 0.02], head, null, [0.85, 0.95, 1.2]);
  K.mesh(K.sphere(0.075, 10, 8), headM, [0, -0.04, 0.2], head, null, [0.75, 0.82, 1.35]);
  K.mesh(K.sphere(0.035, 8, 6), dark, [0, -0.035, 0.3], head, null, [1.1, 0.8, 0.7]);
  K.mesh(K.cone(0.05, 0.22, 6), dark, [0, -0.17, 0.12], head, [PI + 0.25, 0, 0]);
  for (const s of [-1, 1]) {
    K.mesh(K.tube('mk-horn' + s, helix(s, 0.78, 1.35, 0.045, 0.1, [s * 0.5, 1, -0.25]), 0.07, 0.018, 7, 36), hornM, [s * 0.045, 0.11, -0.02], head);
    K.mesh(K.tube('mk-keel' + s, helix(s, 0.78, 1.35, 0.045, 0.1, [s * 0.5, 1, -0.25], 26, 0.06), 0.014, 0.004, 4, 36), keel, [s * 0.045, 0.11, -0.02], head);
  }
  const ears = [-1, 1].map((s) => {
    const g = K.group([s * 0.085, 0.06, -0.03], head, [0, 0, -s * 1.15]);
    K.mesh(K.sphere(0.065, 8, 6), headM, [0, 0.055, 0], g, null, [0.38, 1, 0.16]);
    return g;
  });
  const eyes = eyePair(K, head, { x: 0.083, y: 0.045, z: 0.075, r: 0.021, iris: 0xd9a63c, glow: 0.6, dir: 0.95, slit: true });
  const tail = K.group([0, 0.14, -0.26], body);
  K.mesh(K.capsule(0.04, 0.06, 2, 6), dark, [0, 0.02, -0.03], tail, [-0.9, 0, 0]);
  // legs: shoulders and haunches in the coat, white shanks
  const LF = { up: 0.27, low: 0.27, hoof: 0.06, r0: 0.065, r1: 0.035 }, LH = { up: 0.29, low: 0.29, hoof: 0.06, r0: 0.08, r1: 0.035 };
  const legs = [
    leg(K, body, [0.13, -0.14, 0.72], LF, coat, legLow), leg(K, body, [-0.13, -0.14, 0.72], LF, coat, legLow),
    leg(K, tilt, [0.13, 0.64, -0.36], LH, coat, legLow), leg(K, tilt, [-0.13, 0.64, -0.36], LH, coat, legLow),
  ];
  K.shadow(root, 0.55, 0.85);
  // far: the barrel, neck and head, legs, ruff and horns in three materials
  K.mesh(K.sphere(0.3, 8, 6), coat, [0, 0.78, 0.02], far, null, [0.85, 1, 1.75]);
  K.mesh(K.capsule(0.11, 0.35, 2, 6), coat, [0, 1.05, 0.55], far, [0.6, 0, 0]);
  K.mesh(K.sphere(0.1, 6, 5), coat, [0, 1.22, 0.7], far, null, [0.85, 0.9, 1.4]);
  for (const [x, z] of [[0.13, 0.32], [-0.13, 0.32], [0.13, -0.36], [-0.13, -0.36]]) K.mesh(K.capsule(0.045, 0.6, 2, 5), white, [x, 0.33, z], far);
  K.mesh(K.cone(0.2, 0.55, 6), white, [0, 0.6, 0.48], far, [PI, 0, 0], [1, 1, 0.6]);
  for (const s of [-1, 1]) K.mesh(K.cone(0.06, 0.8, 5), hornM, [s * 0.18, 1.58, 0.6], far, [-0.3, 0, -s * 0.4]);

  K.place(root, home);
  const Q = { tilt, legs, amp: 0 };
  let prevX = home.x, prevZ = home.z, sp = 0, browse = 0;
  const c = K.makeCreature({
    species: SPECIES['markhor'], root, home, ground: K.groundY, radius: 0.95, eye: new THREE.Vector3(0, 1.3, 0.72),
    speed: 1.0, roam: opts.roam ?? 7, fleeAt: 11, curiousAt: 26, shy: 0.55, rareChance: 0.6, rareAt: opts.rareAt ?? null,
    pose(c, dt, env) {
      const p = c.root.position, st = c.state;
      sp = damp(sp, Math.hypot(p.x - prevX, p.z - prevZ) / Math.max(dt, 1e-3), 6, dt);
      prevX = p.x; prevZ = p.z;
      const slope = slopeOf(c, Q, dt);
      // rearing on the hind legs to browse high: the body swings up about the hips, forelegs tuck
      const rear = st === 'rare' ? ease(c.t / 0.9) * ease((c.hold - c.t) / 0.9) : 0;
      for (let i = 0; i < 2; i++) { legs[i].extraHip = -0.9 * rear; legs[i].extraKnee = 1.9 * rear; }
      for (let i = 2; i < 4; i++) { legs[i].extraHip = 0.35 * rear; legs[i].extraKnee = -0.2 * rear; }
      const bob = gait(Q, c, dt, rear > 0.01 ? 0 : sp, slope);
      body.rotation.x = -0.8 * rear;
      ruff.rotation.x = 0.7 * rear;
      body.position.y = 0.74 + bob - 0.05 * rear;
      // grazing and browsing on the ledge plants while it stands
      const grazing = (st === 'idle' && Math.sin(env.t * 0.25 + c.bob * 0.3 + home.x) > 0.3) || (st === 'eat' && sp < 0.15);
      browse = damp(browse, grazing ? 1 : 0, 2.5, dt);
      const nx = 0.3 + browse * 1.85 + (sp > 2.4 ? 0.3 : 0) - rear * 0.2;
      neck.rotation.x = damp(neck.rotation.x, nx, 4, dt);
      neckEnd.rotation.x = -neck.rotation.x - body.rotation.x * 0.6 + browse * 0.8 - rear * 0.15;
      if (browse > 0.5) { head.rotation.x = damp(head.rotation.x, Math.sin(env.t * 6) * 0.06, 6, dt); head.rotation.y = damp(head.rotation.y, 0, 3, dt); }
      else K.look(c, head, env, dt, { yaw: 0.9, pitch: 0.4, rate: 2.5, force: st === 'curious' });
      K.blink(c, [eyes], dt);
      ears.forEach((e, i) => { e.rotation.x = Math.sin(env.t * 1.3 + i * 2 + c.bob) * 0.15 + (st === 'curious' ? -0.25 : 0); });
      tail.rotation.x = Math.sin(env.t * 2.1) * 0.15 + (sp > 2.4 ? -0.5 : 0);
      const br = 1 + Math.sin(env.t * 1.5 + c.bob) * 0.012;
      body.scale.set(br, br, 1);
    },
  });
  return K.lod(c, near, far, 45);
}

// ---------------------------------------------------------------- fallow deer (a buck)

// a flat palm with points along its back edge, x back, y up
const PALM = [[0, 0], [0.07, 0.02], [0.14, 0.08], [0.24, 0.12], [0.27, 0.18], [0.2, 0.18], [0.24, 0.25], [0.18, 0.25], [0.2, 0.33],
  [0.13, 0.3], [0.13, 0.4], [0.07, 0.33], [0.04, 0.42], [-0.01, 0.33], [-0.05, 0.22], [-0.04, 0.08]];
const PALM_TIPS = [[0.27, 0.18], [0.24, 0.25], [0.2, 0.33], [0.13, 0.4], [0.04, 0.42]];

export function buildFallowDeer(K, home, opts = {}) {
  const coat = K.mat(0xc2682b, { roughness: 0.86 }), white = K.mat(0xf4eee2, { roughness: 0.9 }), dark = K.mat(0x231914, { roughness: 0.6 });
  const legLow = K.mat(0xd39a63, { roughness: 0.88 }), antlerM = K.mat(0xbf9a6c, { roughness: 0.7 });
  const spotGlow = K.glow(0x9ff6ff, 1.3), tipGlow = K.glow(0xfff0b8, 1.2);

  const root = K.group();
  const near = K.group(null, root), far = K.group(null, root);
  const tilt = K.group(null, near);
  const body = K.group([0, 0.86, -0.4], tilt);
  // torso: a slim rufous barrel, white belly and flank line, a white rump framed in black
  K.mesh(K.sphere(0.29, 14, 10), coat, [0, 0.0, 0.42], body, null, [0.78, 0.93, 1.62]);
  K.mesh(K.sphere(0.25, 12, 9), coat, [0, -0.02, 0.72], body, null, [0.84, 1.02, 1.0]);
  K.mesh(K.sphere(0.24, 12, 9), coat, [0, -0.01, 0.1], body, null, [0.88, 1, 0.95]);
  K.mesh(K.sphere(0.25, 12, 8), white, [0, -0.13, 0.42], body, null, [0.65, 0.45, 1.4]);
  for (const s of [-1, 1]) {
    K.mesh(K.capsule(0.016, 0.42, 2, 5), white, [s * 0.205, -0.08, 0.42], body, [PI / 2, 0, 0]);
    K.mesh(K.capsule(0.02, 0.17, 2, 5), dark, [s * 0.12, 0.0, -0.17], body, [0.2, 0, s * 0.25]);
  }
  K.mesh(K.sphere(0.17, 10, 8), white, [0, 0.0, -0.16], body, null, [0.85, 1.05, 0.45]);
  // the spots: rows down the back and flanks; the line along the spine glows after dark (the twist)
  for (const s of [-1, 1]) for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) {
    const z = 0.08 + i * 0.13 + (r % 2) * 0.06, th = 0.42 + r * 0.33;
    const ex = 0.29 * 0.78, ey = 0.29 * 0.93, x = s * Math.sin(th) * ex * 1.03, y = Math.cos(th) * ey * 1.02;
    const m = K.mesh(K.sphere(1, 6, 4), white, [x, y, z], body, null, [0.032, 0.03, 0.012]);
    m.quaternion.setFromUnitVectors(vA.set(0, 0, 1), vB.set(x / (ex * ex), y / (ey * ey), (z - 0.42) / 0.22).normalize());
  }
  for (let i = 0; i < 7; i++) K.mesh(K.sphere(1, 6, 4), spotGlow, [0, 0.274, 0.1 + i * 0.12], body, null, [0.02, 0.01, 0.02]);
  // the tail: long for a deer, white below, a black stripe on top
  const tail = K.group([0, 0.13, -0.22], body);
  K.mesh(K.capsule(0.035, 0.17, 2, 6), white, [0, -0.1, -0.02], tail, [0.15, 0, 0]);
  K.mesh(K.capsule(0.018, 0.17, 2, 5), dark, [0, -0.09, -0.05], tail, [0.15, 0, 0]);
  // neck and head: a slender neck with the buck's throat, big ears, palmate antlers
  const neck = K.group([0, 0.12, 0.84], body);
  K.mesh(K.capsule(0.095, 0.36, 3, 8), coat, [0, 0.2, 0], neck);
  K.mesh(K.sphere(0.08, 8, 6), coat, [0, 0.12, 0.06], neck, null, [0.9, 1.6, 1]);
  const neckEnd = K.group([0, 0.44, 0], neck);
  const head = K.group(null, neckEnd);
  K.mesh(K.sphere(0.1, 12, 9), coat, [0, 0.02, 0], head, null, [0.85, 0.92, 1.2]);
  K.mesh(K.sphere(0.07, 10, 8), coat, [0, -0.03, 0.16], head, null, [0.72, 0.75, 1.4]);
  K.mesh(K.sphere(0.034, 8, 6), dark, [0, -0.02, 0.26], head, null, [1.1, 0.8, 0.7]);
  const jaw = K.group([0, -0.07, 0.08], head);
  K.mesh(K.capsule(0.035, 0.12, 2, 6), coat, [0, 0, 0.08], jaw, [PI / 2, 0, 0]);
  K.mesh(K.sphere(0.03, 6, 5), white, [0, -0.012, 0.0], jaw, null, [1.3, 0.7, 1.4]);
  for (const s of [-1, 1]) {
    K.mesh(K.tube('fd-beam' + s, [[0, 0, 0], [s * 0.06, 0.1, -0.04], [s * 0.17, 0.2, -0.04], [s * 0.24, 0.3, 0.02], [s * 0.27, 0.38, 0.02]], 0.026, 0.018, 6, 10), antlerM, [s * 0.05, 0.1, -0.02], head);
    K.mesh(K.tube('fd-brow' + s, [[0, 0, 0], [s * 0.02, 0.05, 0.05], [s * 0.03, 0.06, 0.13]], 0.016, 0.006, 5, 5), antlerM, [s * 0.06, 0.13, -0.03], head);
    K.mesh(K.tube('fd-trez' + s, [[0, 0, 0], [s * 0.02, 0.04, 0.06], [s * 0.03, 0.06, 0.12]], 0.014, 0.005, 5, 5), antlerM, [s * 0.2, 0.31, -0.06], head);
    const palm = K.mesh(K.shape('fd-palm', PALM, 0.016), antlerM, [s * 0.31, 0.45, 0.03], head, [0, PI / 2 - s * 0.97, -s * 0.3], [0.85, 0.72, 1]);
    palm.rotation.order = 'ZYX';
    palm.updateMatrix();
    for (const [x, y] of PALM_TIPS) {
      vA.set(x, y, 0).applyMatrix4(palm.matrix);
      K.mesh(K.sphere(0.014, 6, 4), tipGlow, [vA.x, vA.y, vA.z], head);
    }
  }
  const ears = [-1, 1].map((s) => {
    const g = K.group([s * 0.075, 0.07, -0.04], head, [0, 0, -s * 0.95]);
    K.mesh(K.sphere(0.07, 8, 6), coat, [0, 0.07, 0], g, null, [0.5, 1, 0.18]);
    return g;
  });
  const eyes = eyePair(K, head, { x: 0.073, y: 0.035, z: 0.07, r: 0.022, iris: null, dir: 0.95 });
  const LF = { up: 0.32, low: 0.36, hoof: 0.06, r0: 0.06, r1: 0.028 }, LH = { up: 0.34, low: 0.36, hoof: 0.06, r0: 0.075, r1: 0.028 };
  const legs = [
    leg(K, body, [0.12, -0.12, 0.74], LF, coat, legLow), leg(K, body, [-0.12, -0.12, 0.74], LF, coat, legLow),
    leg(K, tilt, [0.12, 0.76, -0.36], LH, coat, legLow), leg(K, tilt, [-0.12, 0.76, -0.36], LH, coat, legLow),
  ];
  K.shadow(root, 0.5, 0.85);
  // far: barrel, neck, head and legs in the coat, the white rump and belly, the antlers
  K.mesh(K.sphere(0.29, 8, 6), coat, [0, 0.86, 0.02], far, null, [0.8, 0.95, 1.8]);
  K.mesh(K.capsule(0.09, 0.4, 2, 6), coat, [0, 1.18, 0.5], far, [0.35, 0, 0]);
  K.mesh(K.sphere(0.1, 6, 5), coat, [0, 1.42, 0.6], far, null, [0.85, 0.9, 1.4]);
  for (const [x, z] of [[0.12, 0.34], [-0.12, 0.34], [0.12, -0.36], [-0.12, -0.36]]) K.mesh(K.capsule(0.04, 0.68, 2, 5), coat, [x, 0.38, z], far);
  K.mesh(K.sphere(0.2, 6, 5), white, [0, 0.84, -0.5], far, null, [0.9, 1, 0.4]);
  for (const s of [-1, 1]) K.mesh(K.box(0.04, 0.42, 0.22), antlerM, [s * 0.2, 1.75, 0.55], far, [0, 0, -s * 0.4]);

  K.place(root, home);
  const Q = { tilt, legs, amp: 0 };
  let prevX = home.x, prevZ = home.z, sp = 0, graze = 0, flick = 0;
  const c = K.makeCreature({
    species: SPECIES['fallow-deer'], root, home, ground: K.groundY, radius: 0.95, eye: new THREE.Vector3(0, 1.5, 0.66),
    speed: 1.2, roam: opts.roam ?? 9, fleeAt: 12, curiousAt: 28, shy: 0.65, rareChance: 0.5, rareAt: 'dusk',
    onState(c, s) { if (s === 'rare' && c._env && c._env.call) c._env.call(c, 'rare'); },
    pose(c, dt, env) {
      c._env = env;
      const p = c.root.position, st = c.state;
      sp = damp(sp, Math.hypot(p.x - prevX, p.z - prevZ) / Math.max(dt, 1e-3), 6, dt);
      prevX = p.x; prevZ = p.z;
      const slope = slopeOf(c, Q, dt);
      const bob = gait(Q, c, dt, sp, slope);
      body.position.y = 0.86 + bob;
      // the bellow of the rut: neck stretched forward and up, mouth open, groaning in pulses
      const bell = st === 'rare' ? ease(c.t / 0.8) * ease((c.hold - c.t) / 0.8) : 0;
      const pulse = bell * (0.55 + 0.45 * Math.max(0, Math.sin(c.t * 2.6)));
      const grazing = (st === 'idle' && Math.sin(env.t * 0.3 + c.bob * 0.2 + home.z) > 0.15) || (st === 'eat' && sp < 0.15);
      graze = damp(graze, grazing && !bell ? 1 : 0, 2.5, dt);
      neck.rotation.x = damp(neck.rotation.x, 0.3 + graze * 1.95 + bell * 0.75 + (sp > 2.4 ? 0.45 : 0), 4, dt);
      neckEnd.rotation.x = -neck.rotation.x + graze * 0.9 - bell * 0.75;
      body.rotation.x = damp(body.rotation.x, graze * 0.08, 3, dt);
      jaw.rotation.x = damp(jaw.rotation.x, pulse * 0.5 + (graze > 0.6 ? Math.max(0, Math.sin(env.t * 7)) * 0.12 : 0), 10, dt);
      if (graze > 0.5 || bell > 0.2) { head.rotation.y = damp(head.rotation.y, 0, 3, dt); head.rotation.x = damp(head.rotation.x, 0, 3, dt); }
      else K.look(c, head, env, dt, { yaw: 0.9, pitch: 0.4, rate: 2.5, force: st === 'curious' });
      K.blink(c, [eyes], dt);
      // ears swivel, the tail flicks in bursts (a nervous deer flicks more)
      ears.forEach((e, i) => { e.rotation.x = Math.sin(env.t * 1.1 + i * 2.3) * 0.2 + (st === 'curious' || st === 'flee' ? -0.35 : 0); e.rotation.y = (i ? 1 : -1) * (st === 'curious' ? 0.4 : 0.1); });
      const nervous = st === 'curious' || st === 'flee' ? 1 : 0;
      flick = damp(flick, Math.sin(env.t * 0.9 + c.bob) > 0.6 - nervous * 0.8 ? 1 : 0, 6, dt);
      tail.rotation.x = -0.25 * flick - (sp > 2.4 ? 0.9 : 0) + 0.1;
      tail.rotation.z = flick * Math.sin(env.t * 16) * 0.5;
      const br = 1 + Math.sin(env.t * 1.5 + c.bob) * 0.012 + pulse * 0.04;
      body.scale.set(br, br, 1);
    },
  });
  return K.lod(c, near, far, 45);
}

export const BUILDERS = {
  'argentavis-giant-bird': buildArgentavis,
  'harpy-eagle': buildHarpyEagle,
  'crested-caracara': buildCaracaraFlock,
  'crested-caracara-perched': buildCaracaraPerched,
  'markhor': buildMarkhor,
  'fallow-deer': buildFallowDeer,
};
