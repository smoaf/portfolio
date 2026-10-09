// The canyon floor: the animals of the red-rock desert, its green river, its boulders and its bushes.
// Nine species, each a near body (full detail) and a far body (a handful of primitives), built with
// the creature kit (safari/kit.js) and driven by the shared behaviour (safari/creature.js). The
// research-station twist: faint bioluminescent markings that come up at dusk and night, eyes that
// shine, and the insects and the spider grown to a size you can photograph from the van.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const SPECIES = {
  'frilled-lizard': { id: 'frilled-lizard', name: 'Frilled lizard', points: 160, call: { hz: 1800, kind: 'noise' } },
  'fennec-fox': { id: 'fennec-fox', name: 'Fennec fox', points: 140, call: { hz: 900, kind: 'chirp' } },
  'giant-tortoise': { id: 'giant-tortoise', name: 'Giant tortoise', points: 120, call: { hz: 120, kind: 'hoot' } },
  'saiga-antelope': { id: 'saiga-antelope', name: 'Saiga antelope', points: 130, call: { hz: 210, kind: 'hoot' } },
  'cape-buffalo': { id: 'cape-buffalo', name: 'Cape buffalo', points: 150, call: { hz: 95, kind: 'hoot' } },
  'peacock-spider': { id: 'peacock-spider', name: 'Peacock spider', points: 230, call: { hz: 2600, kind: 'trill' } },
  'stag-beetle': { id: 'stag-beetle', name: 'Stag beetle', points: 170, call: { hz: 420, kind: 'noise' } },
  ladybird: { id: 'ladybird', name: 'Ladybird swarm', points: 150, call: { hz: 3200, kind: 'trill' } },
  'picasso-bug': { id: 'picasso-bug', name: 'Picasso bug', points: 210, call: { hz: 1500, kind: 'chirp' } },
};

// ---------------------------------------------------------------------------------------------
// shared helpers (build time may allocate; the per-frame ones never do)
const PI = Math.PI, TAU = PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const clamp = THREE.MathUtils.clamp;
const vT = new THREE.Vector3(), vU = new THREE.Vector3(), eT = new THREE.Euler();
const ease = (a, b, dt, rate = 5) => a + (b - a) * Math.min(1, dt * rate);
const ramp = (a, b, x) => clamp((x - a) / (b - a), 0, 1);
const bell = (a, b, x) => Math.sin(ramp(a, b, x) * PI);           // 0 → 1 → 0 between a and b

// a capsule from point a to point b, still, inside `parent`
function limb(K, parent, a, b, r, mat, rs = 6) {
  vT.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = vT.length();
  const m = K.mesh(K.capsule(r, Math.max(0.002, +(len - r * 0.6).toFixed(3)), 2, rs), mat,
    [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], parent);
  m.quaternion.setFromUnitVectors(UP, vT.normalize());
  return m;
}
// a tapered rod from a (radius r0) to b (radius r1)
function rod(K, parent, a, b, r0, r1, mat, rs = 7) {
  vT.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = vT.length();
  const m = K.mesh(K.cyl(r1, r0, +len.toFixed(3), rs), mat, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], parent);
  m.quaternion.setFromUnitVectors(UP, vT.normalize());
  return m;
}
// a point and its normal on an ellipsoid (radii a, b, c); p = angle from the top, f = angle round from +z
function onDome(a, b, c, p, f, lift = 0) {
  const sx = Math.sin(p) * Math.sin(f), sy = Math.cos(p), sz = Math.sin(p) * Math.cos(f);
  const n = new THREE.Vector3(sx / a, sy / b, sz / c).normalize();
  return { pos: new THREE.Vector3(a * sx, b * sy, c * sz).addScaledVector(n, lift), n };
}
// a flat patch lying on a surface: its local y is the surface normal
function patch(K, g, mat, parent, at, n, sc, spin = 0) {
  const m = K.mesh(g, mat, [at.x, at.y, at.z], parent, null, sc);
  m.quaternion.setFromUnitVectors(UP, n);
  if (spin) m.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, spin));
  return m;
}
// Both eyes in one group, so a blink is one scale and the pair bakes into three draw calls.
// The group sits at eye height; each eye looks out sideways by `out` radians.
function eyes(K, parent, { x, y, z, r, iris = 0x5a3a1a, irisMat = null, out = 0.4, down = 0 }) {
  const g = K.group([0, y, z], parent);
  const ball = K.sheen(0x0b0908, { roughness: 0.12 });
  const im = irisMat || K.sheen(iris, { roughness: 0.15 });
  const hi = K.mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9 });
  for (const s of [-1, 1]) {
    eT.set(down, s * out, 0);
    const at = (lx, ly, lz) => { vU.set(lx, ly, lz).applyEuler(eT); return [s * x + vU.x, vU.y, vU.z]; };
    K.mesh(K.sphere(1, 12, 9), ball, [s * x, 0, 0], g, null, r);
    K.mesh(K.sphere(1, 10, 7), im, at(0, 0, r * 0.52), g, [down, s * out, 0], [r * 0.74, r * 0.74, r * 0.52]);
    K.mesh(K.sphere(1, 8, 6), ball, at(0, 0, r * 0.84), g, [down, s * out, 0], [r * 0.4, r * 0.42, r * 0.2]);
    K.mesh(K.sphere(1, 6, 5), hi, at(-r * 0.3, r * 0.34, r * 0.9), g, null, r * 0.17);
  }
  return g;
}
// a two-part leg: the hip swings, the knee folds. Returns { hip, knee }.
// `rigid` keeps the lower leg in the hip group (one draw call less; the knee is then a stand-in).
function leg2(K, parent, pos, { up, lo, r0, r1, rf = r1 * 1.15, mat, low = mat, foot = low, thigh = null, rigid = false }) {
  const hip = K.group(pos, parent);
  if (thigh) K.mesh(K.sphere(1, 10, 8), mat, [0, -up * 0.3, 0], hip, null, thigh);
  K.mesh(K.capsule(r0, +(up - r0).toFixed(3), 2, 7), mat, [0, -up / 2, 0], hip);
  const knee = rigid ? new THREE.Group() : K.group([0, -up, 0], hip);
  const kp = rigid ? hip : knee, y0 = rigid ? -up : 0;
  K.mesh(K.capsule(r1, +(lo - r1).toFixed(3), 2, 6), low, [0, y0 - lo / 2, 0], kp);
  K.mesh(K.cyl(rf * 0.8, rf, rf * 1.3, 7), foot, [0, y0 - lo + rf * 0.35, rf * 0.15], kp);
  return { hip, knee };
}
// how fast the body really moves (m/s, smoothed): the stride follows it so the feet never skate
function motion(c, dt) {
  const p = c.root.position;
  if (c._px === undefined) { c._px = p.x; c._pz = p.z; c._spd = 0; c._ph = c.bob; }
  const d = Math.hypot(p.x - c._px, p.z - c._pz);
  c._px = p.x; c._pz = p.z;
  if (dt > 0) c._spd = ease(c._spd, Math.min(12, d / dt), dt, 6);
  return c._spd;
}
// a four-legged walk: diagonal pairs, the knee folds on the forward swing. `w` blends it in.
function walk4(legs, ph, amp, bend, w) {
  for (const l of legs) {
    const s = Math.sin(ph + l.ph), co = Math.cos(ph + l.ph);
    l.hip.rotation.x = l.rx + s * amp * w;
    l.knee.rotation.x = l.kx + Math.max(0, -co) * bend * w;
  }
}
// the camera's bearing in the animal's own frame (radians, 0 = straight ahead)
function bearing(c, env) {
  vT.copy(env.camPos);
  c.root.worldToLocal(vT);
  return Math.atan2(vT.x, vT.z);
}
// the preview (and a route) may force wander or flee before a target exists: give it one
function fixTarget(c, s) {
  if ((s === 'wander' || s === 'flee') && !c.target) {
    c.target = c.home.clone().add(new THREE.Vector3(Math.sin(c.yaw) * 8, 0, Math.cos(c.yaw) * 8));
  }
}
// bake, place and wire up a walker
function finish(K, root, near, far, home, at, def) {
  K.place(root, home);
  const own = def.onState;
  const c = K.makeCreature({ root, home, ground: K.groundY, ...def, onState: (cc, s) => { fixTarget(cc, s); if (own) own(cc, s); } });
  K.lod(c, near, far, at);
  return c;
}
// keep a perched animal on its rock: it never strays further than `r` from the perch, nor drops
function perch(c, home, r) {
  const step = c.step;
  const y = home.y;
  c.step = (dt, env) => {
    step(dt, env);
    const p = c.root.position;
    vT.set(p.x - home.x, 0, p.z - home.z);
    const d = vT.length();
    if (d > r) { p.x = home.x + (vT.x / d) * r; p.z = home.z + (vT.z / d) * r; }
    p.y = y;
    if (c.target) { c.target.y = y; }
    c.home.y = y;
    c.root.updateMatrixWorld();
  };
}

// ---------------------------------------------------------------------------------------------
// FENNEC FOX: a small sand fox with enormous ears that turn to the van. Rare: the ears flick, it
// crouches, pounces and digs. Its eyes shine at night.
export function buildFennecFox(K, home, opts = {}) {
  const S = 1.7;                                                     // a little larger than life
  const fur = K.mat(0xe3c497, { roughness: 0.92 }), cream = K.mat(0xf7efe2, { roughness: 0.92 });
  const pink = K.mat(0xeba597, { roughness: 0.85 }), dark = K.sheen(0x17110e, { roughness: 0.4 });
  const paw = K.mat(0xecd6b2, { roughness: 0.92 });
  const glow = K.glow(0x86f0dc, 1.1), sand = K.mat(0xc4805a, { roughness: 1 });
  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  root.scale.setScalar(S);
  K.shadow(root, 0.13, 0.22);

  const body = K.group([0, 0.215, 0], near);
  K.mesh(K.sphere(1, 12, 9), fur, [0, 0, -0.03], body, null, [0.085, 0.085, 0.17]);
  K.mesh(K.sphere(1, 12, 9), fur, [0, 0.008, 0.075], body, null, [0.08, 0.088, 0.1]);
  K.mesh(K.sphere(1, 10, 8), cream, [0, -0.03, 0.0], body, null, [0.065, 0.06, 0.15]);
  K.mesh(K.sphere(1, 10, 8), cream, [0, 0.0, 0.13], body, null, [0.05, 0.075, 0.05]);
  limb(K, body, [0, 0.03, 0.1], [0, 0.085, 0.15], 0.042, fur);       // the neck
  for (let i = 0; i < 4; i++) K.mesh(K.sphere(1, 6, 5), glow, [0, 0.083 - i * 0.002, 0.06 - i * 0.055], body, null, 0.007);

  const neck = K.group([0, 0.09, 0.155], body);
  const head = K.group([0, 0, 0], neck);
  K.mesh(K.sphere(1, 12, 9), fur, [0, 0.012, -0.005], head, null, [0.062, 0.058, 0.062]);
  K.mesh(K.sphere(1, 12, 9), cream, [0, -0.012, 0.025], head, null, [0.06, 0.044, 0.055]);
  K.mesh(K.cone(1, 1, 10), cream, [0, -0.017, 0.082], head, [PI / 2, 0, 0], [0.028, 0.075, 0.022]);
  K.mesh(K.sphere(1, 8, 6), dark, [0, -0.013, 0.118], head, null, [0.011, 0.009, 0.009]);
  K.mesh(K.sphere(1, 8, 6), fur, [0, 0.022, 0.03], head, null, [0.04, 0.03, 0.045]);   // the brow
  const eyeG = eyes(K, head, { x: 0.03, y: 0.008, z: 0.043, r: 0.0165, out: 0.4,
    irisMat: K.glow(0xd8d55a, 0.5, { color: 0x2c1d12, roughness: 0.15 }) });
  const ears = [-1, 1].map((s) => {
    const e = K.group([s * 0.036, 0.04, -0.012], head);
    K.mesh(K.cone(1, 1, 9), fur, [s * 0.034, 0.09, 0], e, [0, 0, -s * 0.34], [0.062, 0.2, 0.018]);
    K.mesh(K.cone(1, 1, 9), pink, [s * 0.032, 0.083, 0.007], e, [0, 0, -s * 0.34], [0.047, 0.165, 0.009]);
    return e;
  });

  const legs = [];
  for (const [s, f] of [[-1, 1], [1, 1], [-1, 0], [1, 0]]) {
    const L = f
      ? leg2(K, body, [s * 0.045, -0.035, 0.09], { up: 0.085, lo: 0.1, r0: 0.021, r1: 0.016, mat: paw, rigid: true })
      : leg2(K, body, [s * 0.05, -0.02, -0.13], { up: 0.095, lo: 0.105, r0: 0.026, r1: 0.016, mat: fur, low: paw, thigh: [0.044, 0.064, 0.058] });
    L.front = f; L.s = s;
    L.rx = f ? 0 : -0.2; L.kx = f ? 0 : 0.35;
    L.ph = (f ? PI / 2 : 0) + (s > 0 ? PI : 0);
    legs.push(L);
  }
  const tail = K.group([0, 0.02, -0.19], body, [-0.75, 0, 0]);
  K.mesh(K.capsule(0.028, 0.08, 2, 7), fur, [0, 0, -0.06], tail, [PI / 2, 0, 0]);
  K.mesh(K.capsule(0.037, 0.08, 2, 7), fur, [0, -0.012, -0.16], tail, [PI / 2 - 0.25, 0, 0]);
  K.mesh(K.sphere(1, 8, 6), dark, [0, -0.026, -0.235], tail, null, [0.027, 0.027, 0.036]);
  // the sand it throws up when it digs
  const puff = K.group([0, 0.03, 0.17], near);
  for (let i = 0; i < 5; i++) K.mesh(K.sphere(1, 7, 5), sand, [(i - 2) * 0.03, (i % 2) * 0.03, -(i % 3) * 0.03], puff, null, 0.022 + (i % 2) * 0.01);
  puff.visible = false;

  K.mesh(K.sphere(1, 8, 6), fur, [0, 0.22, -0.01], far, null, [0.085, 0.09, 0.2]);
  K.mesh(K.sphere(1, 8, 6), cream, [0, 0.3, 0.15], far, null, [0.06, 0.055, 0.075]);
  for (const s of [-1, 1]) K.mesh(K.cone(1, 1, 5), fur, [s * 0.065, 0.39, 0.14], far, [0, 0, -s * 0.36], [0.05, 0.19, 0.02]);
  K.mesh(K.box(0.09, 0.2, 0.22), cream, [0, 0.1, 0], far);

  return finish(K, root, near, far, home, 38, {
    species: SPECIES['fennec-fox'], radius: 0.42, eye: new THREE.Vector3(0, 0.33, 0.2),
    speed: 1.9, roam: 7, fleeAt: 9, curiousAt: 26, shy: 0.55, rareChance: 0.6, rareAt: 'night',
    pose(c, dt, env) {
      const spd = motion(c, dt), w = clamp(spd / 0.5, 0, 1), run = clamp((spd - 1.8) / 2, 0, 1);
      c._ph += dt * (spd / 0.42) * TAU;
      const rare = c.state === 'rare', t = c.t;
      // rare: ears flick (0-1.3 s), crouch (1.3-1.9), pounce (1.9-2.5), dig (2.5 on)
      const twitch = rare && t < 1.4 ? 1 : 0;
      const crouch = rare ? ramp(1.2, 1.7, t) * (1 - ramp(1.9, 2.0, t)) : 0;
      const leap = rare ? bell(1.9, 2.5, t) : 0;
      const dig = rare && t > 2.5 ? 1 : 0;
      if (rare && t > 1.9 && t < 2.5) {
        c.root.position.addScaledVector(c.forward(vU), dt * 1.5);
        c.root.position.y = c.ground(c.root.position.x, c.root.position.z);
      }
      c._cr = ease(c._cr ?? 0, crouch, dt, 7);
      c._dig = ease(c._dig ?? 0, dig, dt, 5);
      const breathe = 1 + Math.sin(env.t * 3.1 + c.bob) * 0.02;
      body.scale.set(breathe, breathe, 1);
      body.position.y = 0.215 - c._cr * 0.06 + leap * 0.16 + Math.abs(Math.sin(c._ph)) * 0.018 * w;
      body.rotation.x = ease(body.rotation.x, -c._cr * 0.12 + c._dig * 0.32 - leap * 0.25 + (c.state === 'eat' ? 0.15 : 0), dt, 6);
      walk4(legs, c._ph, 0.5 + run * 0.35, 0.9, w);
      for (const L of legs) {
        if (L.front && c._dig > 0.05) L.hip.rotation.x = -0.5 * c._dig + Math.sin(env.t * 22 + L.s) * 0.55 * c._dig;
        if (leap > 0) { L.hip.rotation.x += (L.front ? -0.9 : 0.8) * leap; }
        if (c._cr > 0.05) L.knee.rotation.x += c._cr * (L.front ? 0.5 : 0.6);
      }
      puff.visible = c._dig > 0.3;
      if (puff.visible) { const k = 0.6 + 0.5 * Math.abs(Math.sin(env.t * 9)); puff.scale.set(k, k * 1.2, k); puff.position.y = 0.03 + k * 0.03; }
      // the head watches the van, the neck dips to eat and dig
      K.look(c, head, env, dt, { yaw: 0.9, pitch: 0.45, force: c.state === 'curious' || twitch > 0 });
      const down = c.state === 'eat' ? 0.55 + Math.sin(env.t * 8) * 0.12 : c._dig * 0.75 + c._cr * 0.35;
      neck.rotation.x = ease(neck.rotation.x, down, dt, 5);
      K.blink(c, [eyeG], dt);
      // the ears swivel to the van; in the rare they flick fast
      const toVan = c.near !== undefined && c.near < 45 ? clamp((bearing(c, env) - head.rotation.y) * 0.7, -0.75, 0.75) : 0;
      ears.forEach((e, i) => {
        const fl = twitch * Math.max(0, Math.sin(env.t * 26 + i * 2.1)) * 0.45;
        e.rotation.y = ease(e.rotation.y, toVan + Math.sin(env.t * 0.9 + i) * 0.08, dt, 4);
        e.rotation.x = ease(e.rotation.x, -run * 0.6 - c._dig * 0.3 - fl, dt, 14);
      });
      tail.rotation.x = ease(tail.rotation.x, -0.75 + run * 0.55 + c._cr * 0.3, dt, 4);
      tail.rotation.y = Math.sin(env.t * 1.4 + c.bob) * 0.18 + c._dig * Math.sin(env.t * 7) * 0.3;
    },
  });
}

// ---------------------------------------------------------------------------------------------
// FRILLED LIZARD: a long-tailed lizard with a pleated frill folded round its neck. When it flees it
// sprints upright on its hind legs. Rare: the frill snaps open (glowing veins), the jaw gapes, it hisses.
function frillGeo(K) {
  return K.geo('frill', () => {
    const N = 34, R = 4, a0 = -PI * 0.86, a1 = PI * 0.86;
    const pos = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const a = a0 + (a1 - a0) * (i / N), pleat = i % 2 ? 1 : -1;
      for (let j = 0; j <= R; j++) {
        const r = 0.22 + 0.78 * (j / R), rr = j === R ? r * (1 + (i % 2) * 0.08) : r;
        pos.push(Math.sin(a) * rr, -Math.cos(a) * rr, -0.5 * r + pleat * 0.06 * r);
      }
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < R; j++) {
      const a = i * (R + 1) + j, b = a + R + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  });
}
export function buildFrilledLizard(K, home, opts = {}) {
  const S = 1.9;
  const skin = K.mat(0xa98463, { roughness: 0.78 }), pale = K.mat(0xd8c3a0, { roughness: 0.8 });
  const mouth = K.mat(0xf2d873, { roughness: 0.5 });
  const memb = K.fin(0xe46a2c, 0.9, 0.35, { roughness: 0.6 }), inner = K.fin(0xc8341f, 0.92, 0.45, { roughness: 0.6 });
  const veins = K.glow(0xffc552, 1.5), dots = K.glow(0xffa040, 0.9);
  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  root.scale.setScalar(S);
  K.shadow(root, 0.08, 0.2);

  const body = K.group([0, 0.07, 0], near);
  K.mesh(K.sphere(1, 12, 9), skin, [0, 0, 0], body, null, [0.048, 0.036, 0.12]);
  K.mesh(K.sphere(1, 10, 8), pale, [0, -0.012, 0.01], body, null, [0.042, 0.026, 0.1]);
  for (let i = 0; i < 6; i++) K.mesh(K.sphere(1, 6, 5), dots, [0, 0.035 - Math.abs(i - 2) * 0.002, 0.08 - i * 0.034], body, null, 0.0055);
  for (let i = 0; i < 4; i++) K.mesh(K.box(0.05, 0.006, 0.012), skin, [0, 0.03, 0.06 - i * 0.045], body, null, 1);

  const neck = K.group([0, 0.012, 0.11], body);
  K.mesh(K.sphere(1, 10, 8), skin, [0, 0, 0.005], neck, null, [0.032, 0.03, 0.05]);
  const head = K.group([0, 0.012, 0.04], neck);
  K.mesh(K.sphere(1, 12, 9), skin, [0, 0.002, 0.022], head, null, [0.032, 0.025, 0.045]);
  K.mesh(K.sphere(1, 10, 8), skin, [0, -0.003, 0.062], head, null, [0.022, 0.017, 0.032]);
  K.mesh(K.sphere(1, 8, 6), skin, [0, 0.017, 0.035], head, null, [0.026, 0.01, 0.03]);
  K.mesh(K.sphere(1, 8, 6), mouth, [0, -0.015, 0.05], head, null, [0.021, 0.006, 0.038]);
  const jaw = K.group([0, -0.014, 0.008], head);
  K.mesh(K.sphere(1, 10, 7), skin, [0, -0.002, 0.04], jaw, null, [0.022, 0.008, 0.047]);
  K.mesh(K.sphere(1, 8, 6), mouth, [0, 0.004, 0.042], jaw, null, [0.018, 0.004, 0.038]);
  const eyeG = eyes(K, head, { x: 0.026, y: 0.008, z: 0.036, r: 0.0085, iris: 0xc4903c, out: 1.05 });

  // the frill: a pleated cone round the neck, folded back like a cape until it opens
  const frill = K.group([0, 0.004, 0.012], neck);
  const fg = frillGeo(K);
  K.mesh(fg, memb, [0, 0, 0], frill);
  K.mesh(fg, inner, [0, 0, 0.012], frill, null, [0.6, 0.6, 0.6]);
  for (let i = 1; i < 34; i += 2) {
    const a = -PI * 0.86 + PI * 1.72 * (i / 34);
    vU.set(Math.sin(a) * 0.68, -Math.cos(a) * 0.68, -0.34 + 0.06 * 0.6).normalize();
    const m = K.mesh(K.box(0.03, 0.66, 0.03), veins, [Math.sin(a) * 0.58, -Math.cos(a) * 0.58, -0.29 + 0.04], frill);
    m.quaternion.setFromUnitVectors(UP, vT.set(Math.sin(a) * 0.7, -Math.cos(a) * 0.7, -0.35).normalize());
  }
  const FOLD = [0.052, 0.05, 0.13], OPEN = [0.135, 0.135, 0.035];
  frill.scale.set(...FOLD);

  const legs = [];
  for (const s of [-1, 1]) {                                           // front: one sprawled piece
    const g = K.group([s * 0.035, -0.008, 0.07], body);
    limb(K, g, [0, 0, 0], [s * 0.05, -0.006, 0.0], 0.012, skin);
    limb(K, g, [s * 0.05, -0.006, 0.0], [s * 0.072, -0.058, 0.022], 0.01, skin);
    for (const k of [-1, 0, 1]) limb(K, g, [s * 0.072, -0.058, 0.022], [s * (0.082 + k * 0.01), -0.062, 0.044 - Math.abs(k) * 0.008], 0.0045, skin, 4);
    legs.push({ hip: g, s, front: 1 });
  }
  for (const s of [-1, 1]) {                                           // hind: thigh and shin
    const g = K.group([s * 0.035, -0.004, -0.075], body);
    limb(K, g, [0, 0, 0], [s * 0.058, 0.0, 0.016], 0.015, skin);
    const kn = K.group([s * 0.058, 0.0, 0.016], g);
    limb(K, kn, [0, 0, 0], [s * 0.016, -0.062, -0.018], 0.011, skin);
    for (const k of [-1, 0, 1]) limb(K, kn, [s * 0.016, -0.062, -0.018], [s * (0.03 + k * 0.014), -0.066, 0.016], 0.0045, skin, 4);
    legs.push({ hip: g, knee: kn, s, front: 0 });
  }
  const tail = K.group([0, 0, -0.105], body, [-0.12, 0, 0]);
  rod(K, tail, [0, 0, 0], [0, 0, -0.2], 0.024, 0.013, skin);
  const tail2 = K.group([0, 0, -0.2], tail);
  rod(K, tail2, [0, 0, 0], [0, 0, -0.26], 0.013, 0.003, skin);

  K.mesh(K.sphere(1, 8, 6), skin, [0, 0.07, 0.02], far, null, [0.05, 0.04, 0.16]);
  K.mesh(K.cone(1, 1, 6), skin, [0, 0.06, -0.3], far, [-PI / 2, 0, 0], [0.024, 0.42, 0.024]);
  K.mesh(K.sphere(1, 8, 6), memb, [0, 0.085, 0.13], far, null, [0.05, 0.045, 0.06]);
  K.mesh(K.box(0.15, 0.06, 0.02), skin, [0, 0.03, 0.04], far);

  return finish(K, root, near, far, home, 36, {
    species: SPECIES['frilled-lizard'], radius: 0.42, eye: new THREE.Vector3(0, 0.1, 0.2),
    speed: 2.1, roam: 6, fleeAt: 8, curiousAt: 22, shy: 0.6, rareChance: 0.7, rareAt: 'dusk',
    pose(c, dt, env) {
      const spd = motion(c, dt), w = clamp(spd / 0.4, 0, 1);
      c._ph += dt * (spd / 0.3) * TAU;
      const rare = c.state === 'rare', t = c.t;
      c._bip = ease(c._bip ?? 0, c.state === 'flee' && spd > 0.9 ? 1 : 0, dt, 6);
      const open = rare ? ramp(0.1, 0.45, t) * (1 - ramp(c.hold - 0.6, c.hold, t)) : 0;
      c._open = ease(c._open ?? 0, open, dt, 9);
      const o = c._open, b = c._bip;
      // the frill: cape → dish
      frill.scale.set(FOLD[0] + (OPEN[0] - FOLD[0]) * o, FOLD[1] + (OPEN[1] - FOLD[1]) * o, FOLD[2] + (OPEN[2] - FOLD[2]) * o);
      frill.rotation.z = Math.sin(env.t * 21) * 0.025 * o;
      jaw.rotation.x = ease(jaw.rotation.x, o * (0.75 + Math.sin(t * 9) * 0.08) + (c.state === 'eat' ? Math.max(0, Math.sin(env.t * 9)) * 0.3 : 0), dt, 10);
      // posture: up on the front legs to display; upright to sprint
      const breathe = 1 + Math.sin(env.t * 2 + c.bob) * 0.03 + o * Math.max(0, Math.sin(t * 6)) * 0.05;
      body.scale.set(breathe, breathe, 1);
      body.rotation.x = ease(body.rotation.x, -0.32 * o - 0.95 * b + (c.state === 'eat' ? 0.12 : 0), dt, 7);
      body.position.y = ease(body.position.y, 0.07 + 0.025 * o + 0.07 * b, dt, 7) + Math.abs(Math.sin(c._ph)) * 0.02 * b;
      body.rotation.y = Math.sin(c._ph) * 0.14 * w * (1 - b);
      neck.rotation.x = ease(neck.rotation.x, -0.3 * o + 0.6 * b + (c.state === 'eat' ? 0.45 : 0), dt, 6);
      for (const L of legs) {
        const ph = c._ph + (L.front ? 0 : PI) + (L.s > 0 ? PI : 0), sn = Math.sin(ph), co = Math.cos(ph);
        if (L.front) {
          L.hip.rotation.y = sn * 0.55 * w * (1 - b);
          L.hip.rotation.z = L.s * (Math.max(0, -co) * 0.35 * w * (1 - b) + 0.9 * b);
          L.hip.rotation.x = 0.9 * b - 0.2 * o;
        } else {
          L.hip.rotation.y = sn * 0.5 * w * (1 - b);
          L.hip.rotation.z = L.s * Math.max(0, -co) * 0.3 * w * (1 - b) - L.s * 0.55 * b;
          L.hip.rotation.x = 0.95 * b + Math.sin(c._ph * 1.0 + (L.s > 0 ? PI : 0)) * 0.9 * b;
          L.knee.rotation.x = Math.max(0, -Math.cos(c._ph + (L.s > 0 ? PI : 0))) * 1.0 * b;
        }
      }
      tail.rotation.x = ease(tail.rotation.x, -0.12 + 0.75 * b + 0.15 * o, dt, 5);
      tail.rotation.y = -Math.sin(c._ph) * 0.2 * w + Math.sin(env.t * 0.8 + c.bob) * 0.12;
      tail2.rotation.y = -Math.sin(c._ph - 0.9) * 0.25 * w + Math.sin(env.t * 0.8 + c.bob - 1) * 0.15;
      tail2.rotation.x = ease(tail2.rotation.x, 0.12 - 0.2 * b, dt, 5);
      K.look(c, head, env, dt, { yaw: 0.8, pitch: 0.35, force: rare || c.state === 'curious', rate: rare ? 6 : 3 });
      K.blink(c, [eyeG], dt);
    },
  });
}

// ---------------------------------------------------------------------------------------------
// GIANT TORTOISE: a high dome of plated shell on four pillar legs and a long leathery neck. Its shell
// seams glow after dark. Rare: it rises tall on straightened legs and stretches the neck up to browse.
export function buildGiantTortoise(K, home, opts = {}) {
  const plate = K.mat(0x6f5b48, { roughness: 0.82 }), plate2 = K.mat(0x8b745c, { roughness: 0.78 });
  const seam = K.glow(0xffb447, 0.16, { color: 0x2e241b, roughness: 0.9 });
  const skin = K.mat(0x6a6157, { roughness: 0.9 });
  const beak = K.sheen(0x2a2622, { roughness: 0.45 });
  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  K.shadow(root, 0.75, 0.95);

  const body = K.group([0, 0.32, 0], near);
  const shell = K.group([0, 0, 0], body);
  const A = 0.6, B = 0.56, C = 0.74;
  const hemi = K.geo('hemi14', () => new THREE.SphereGeometry(1, 16, 8, 0, TAU, 0, PI / 2));
  K.mesh(hemi, seam, [0, 0, 0], shell, null, [A, B, C]);
  K.mesh(K.sphere(1, 14, 6), skin, [0, -0.02, 0], shell, null, [A * 0.94, 0.1, C * 0.94]);   // plastron
  const scute = K.cyl(0.78, 1, 0.5, 6), scuteTop = K.cyl(0.55, 0.8, 0.35, 6);
  const put = (p, f, s, lift = 0.012) => {
    const { pos, n } = onDome(A, B, C, p, f, lift);
    patch(K, scute, plate, shell, pos, n, [s, s * 0.5, s * 1.08]);
    const top = pos.clone().addScaledVector(n, s * 0.16);
    patch(K, scuteTop, plate2, shell, top, n, [s * 0.75, s * 0.4, s * 0.8]);
  };
  for (const [p, f] of [[0, 0], [0.5, 0], [0.98, 0], [0.5, PI], [0.98, PI]]) put(p, f, p ? 0.235 : 0.24, 0.01);
  for (const s of [-1, 1]) for (const f of [0.55, 1.15, 1.95, 2.6]) put(0.98, s * f, 0.235);
  for (let i = 0; i < 22; i++) {
    const f = (i / 22) * TAU + 0.14;
    const { pos, n } = onDome(A, B, C, 1.42, f, 0.01);
    patch(K, scute, plate, shell, pos, n, [0.15, 0.06, 0.12]);
  }
  for (let i = 0; i < 7; i++) {                                        // the faint seam lights along the ridge
    const { pos } = onDome(A, B, C, (i - 3) * 0.3, 0, 0.03);
    K.mesh(K.sphere(1, 6, 5), K.glow(0xffc35c, 0.8), [pos.x, pos.y, pos.z], shell, null, 0.012);
  }

  const legs = [];
  for (const [s, f] of [[-1, 1], [1, 1], [-1, 0], [1, 0]]) {
    const g = K.group([s * 0.4, -0.0, f ? 0.42 : -0.42], body);
    K.mesh(K.capsule(0.13, 0.12, 2, 8), skin, [0, -0.13, 0], g, null, [1, 1, 1.05]);
    K.mesh(K.cyl(0.13, 0.14, 0.08, 8), skin, [0, -0.28, 0.01], g);
    if (f) for (let k = 0; k < 3; k++) K.mesh(K.sphere(1, 6, 5), skin, [s * 0.03 * (k - 1), -0.1 - (k % 2) * 0.07, 0.12], g, null, [0.06, 0.05, 0.03]);
    legs.push({ hip: g, s, f, ph: (f ? PI / 2 : 0) + (s > 0 ? PI : 0) });
  }

  const neck = K.group([0, 0.06, 0.66], body, [-0.6, 0, 0]);
  rod(K, neck, [0, 0, -0.1], [0, 0, 0.2], 0.1, 0.08, skin, 8);
  for (let k = 0; k < 4; k++) K.mesh(K.torus(0.078, 0.014, 4, 10), skin, [0, 0, -0.04 + k * 0.06], neck);
  const neck2 = K.group([0, 0, 0.2], neck);
  rod(K, neck2, [0, 0, 0], [0, 0, 0.19], 0.08, 0.07, skin, 8);
  const head = K.group([0, 0.01, 0.2], neck2, [0.25, 0, 0]);
  head.scale.setScalar(1.3);
  K.mesh(K.sphere(1, 12, 9), skin, [0, 0.01, 0.04], head, null, [0.085, 0.075, 0.12]);
  K.mesh(K.sphere(1, 10, 8), skin, [0, 0.035, 0.06], head, null, [0.07, 0.05, 0.09]);
  K.mesh(K.sphere(1, 10, 7), beak, [0, -0.025, 0.12], head, null, [0.05, 0.03, 0.04]);
  K.mesh(K.sphere(1, 6, 5), beak, [0.018, 0.012, 0.145], head, null, 0.008);
  K.mesh(K.sphere(1, 6, 5), beak, [-0.018, 0.012, 0.145], head, null, 0.008);
  const eyeG = eyes(K, head, { x: 0.06, y: 0.025, z: 0.075, r: 0.016, iris: 0x2a1c12, out: 0.75,
    irisMat: K.glow(0xffb447, 0.35, { color: 0x3a2716, roughness: 0.2 }) });
  const tail = K.group([0, -0.05, -0.68], body);
  K.mesh(K.cone(0.05, 0.14, 6), skin, [0, -0.04, -0.03], tail, [-2.2, 0, 0]);

  K.mesh(K.sphere(1, 10, 6), plate, [0, 0.36, 0], far, null, [A, B, C]);
  K.mesh(K.sphere(1, 8, 6), skin, [0, 0.5, 0.95], far, null, [0.08, 0.07, 0.11]);
  K.mesh(K.box(0.16, 0.18, 0.4), skin, [0, 0.4, 0.75], far, [-0.4, 0, 0]);
  K.mesh(K.box(0.85, 0.3, 0.95), skin, [0, 0.15, 0], far);

  return finish(K, root, near, far, home, 48, {
    species: SPECIES['giant-tortoise'], radius: 0.95, eye: new THREE.Vector3(0, 0.6, 1.0),
    speed: 0.32, roam: 4, fleeAt: 3.5, curiousAt: 20, shy: 0.1, rareChance: 0.75,
    pose(c, dt, env) {
      const spd = motion(c, dt), w = clamp(spd / 0.15, 0, 1);
      c._ph += dt * (spd / 0.38) * TAU;
      const rare = c.state === 'rare', t = c.t;
      c._up = ease(c._up ?? 0, rare ? 1 : 0, dt, rare ? 1.6 : 2.2);
      c._shy = ease(c._shy ?? 0, c.state === 'flee' ? 1 : 0, dt, 3);  // pulls the head in a little
      const u = c._up, browse = rare ? Math.max(0, Math.sin(t * 3.2)) * u : 0;
      const breathe = 1 + Math.sin(env.t * 1.2 + c.bob) * 0.012;
      body.scale.set(breathe, 1, breathe);
      body.position.y = 0.32 + u * 0.13 + Math.abs(Math.sin(c._ph)) * 0.015 * w;
      body.rotation.z = Math.sin(c._ph) * 0.035 * w;
      body.rotation.x = -u * 0.12;
      for (const L of legs) {
        const sn = Math.sin(c._ph + L.ph), co = Math.cos(c._ph + L.ph);
        L.hip.rotation.x = sn * 0.32 * w + (L.f ? 0.1 : -0.05) * u;
        L.hip.rotation.z = L.s * (0.08 - u * 0.06);
        L.hip.position.y = -0.02 + Math.max(0, -co) * 0.04 * w;
        L.hip.scale.y = 1 + u * 0.45;
      }
      neck.rotation.x = ease(neck.rotation.x, -0.6 - u * 0.6 + c._shy * 0.4 + (c.state === 'eat' ? 0.75 : 0), dt, 2.5);
      neck2.rotation.x = ease(neck2.rotation.x, -u * 0.35 + (c.state === 'eat' ? 0.3 : 0), dt, 2.5);
      neck.scale.z = 1 + u * 0.35 - c._shy * 0.25;
      neck.position.z = 0.66 - c._shy * 0.08;
      head.position.z = 0.2 + browse * 0.025;
      K.look(c, head, env, dt, { yaw: 0.7, pitch: 0.35, rate: 1.8 });
      if (rare) head.rotation.x += (-0.2 - browse * 0.25 - head.rotation.x) * Math.min(1, dt * 4);
      if (c.state === 'eat') head.rotation.x += (0.35 + Math.sin(env.t * 4) * 0.12 - head.rotation.x) * Math.min(1, dt * 4);
      tail.rotation.y = Math.sin(c._ph) * 0.2 * w;
      K.blink(c, [eyeG], dt);
    },
  });
}

// ---------------------------------------------------------------------------------------------
// SAIGA ANTELOPE: a pale, stocky steppe antelope with a big drooping nose and amber ridged horns
// (the males). Herd animal: the route places a few together. Rare: the nose flares and it stots.
// opts.female: no horns (default: random).
export function buildSaigaAntelope(K, home, opts = {}) {
  const female = opts.female ?? K.rand() < 0.4;
  const fur = K.mat(0xdcd2c0, { roughness: 0.92 }), belly = K.mat(0xf3efe7, { roughness: 0.92 });
  const shade = K.mat(0x6f6a66, { roughness: 0.9 }), legMat = K.mat(0xc9bba3, { roughness: 0.9 });
  // the horns: waxy amber, a little see-through, with dark tips
  const horn = K.sheen(0xe0a878, { roughness: 0.3, emissive: 0x7a3a18, emissiveIntensity: 0.3, transparent: true, opacity: 0.94 });
  const hornTip = K.sheen(0x2a1a12, { roughness: 0.3 });
  const nostril = K.sheen(0x2a2420, { roughness: 0.5 }), glow = K.glow(0x9fd8ff, 0.9);
  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  K.shadow(root, 0.32, 0.62);

  const body = K.group([0, 0.7, 0], near);
  K.mesh(K.sphere(1, 18, 12), fur, [0, 0, -0.04], body, null, [0.22, 0.23, 0.46]);
  K.mesh(K.sphere(1, 16, 12), fur, [0, 0.02, 0.24], body, null, [0.21, 0.24, 0.25]);
  K.mesh(K.sphere(1, 10, 8), belly, [0, -0.09, 0], body, null, [0.17, 0.13, 0.4]);
  K.mesh(K.sphere(1, 10, 8), fur, [0, 0.02, -0.33], body, null, [0.18, 0.19, 0.18]);
  K.mesh(K.cone(1, 1, 6), fur, [0, 0.02, -0.5], body, [-2.4, 0, 0], [0.035, 0.12, 0.03]);
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) K.mesh(K.sphere(1, 6, 5), glow, [s * 0.185, -0.02, 0.24 - i * 0.12], body, null, 0.011);

  const neck = K.group([0, 0.08, 0.38], body, [-0.5, 0, 0]);
  limb(K, neck, [0, 0, -0.04], [0, 0, 0.26], 0.085, fur);
  K.mesh(K.sphere(1, 10, 8), fur, [0, -0.05, 0.1], neck, null, [0.07, 0.065, 0.16]);
  const head = K.group([0, 0.02, 0.28], neck, [0.75, 0, 0]);
  head.scale.setScalar(1.2);
  K.mesh(K.sphere(1, 12, 9), fur, [0, 0.03, 0.02], head, null, [0.085, 0.09, 0.12]);
  K.mesh(K.sphere(1, 10, 8), shade, [0.062, -0.03, 0.09], head, null, [0.03, 0.05, 0.07]);
  K.mesh(K.sphere(1, 10, 8), shade, [-0.062, -0.03, 0.09], head, null, [0.03, 0.05, 0.07]);
  for (const s of [-1, 1]) {
    K.mesh(K.sphere(1, 9, 7), fur, [s * 0.085, 0.09, -0.04], head, [0, 0, -s * 0.9], [0.045, 0.055, 0.02]);
    K.mesh(K.sphere(1, 8, 6), shade, [s * 0.087, 0.09, -0.03], head, [0, 0, -s * 0.9], [0.032, 0.04, 0.012]);
    if (!female) {
      // long and ringed for most of their length (the ridges of the reference), smooth near the tip
      const prof = [];
      for (let i = 0; i <= 30; i++) {
        const y = (i / 30) * 0.34, r = 0.021 * (1 - (i / 30) * 0.78);
        prof.push([r * (i < 24 && i % 2 ? 1.32 : 1), y]);
      }
      prof.push([0.0005, 0.345]);
      K.mesh(K.lathe('saigaHorn2', prof, 9), horn, [s * 0.035, 0.1, 0.0], head, [-0.32, 0, -s * 0.1]);
      K.mesh(K.cone(0.0052, 0.05, 6), hornTip, [s * (0.035 + 0.032), 0.1 + 0.31, -0.105], head, [-0.32, 0, -s * 0.1]);
    }
  }
  const eyeG = eyes(K, head, { x: 0.074, y: 0.05, z: 0.065, r: 0.018, iris: 0x2b1c12, out: 0.75 });
  // the nose: a soft drooping proboscis that flares
  const nose = K.group([0, -0.01, 0.12], head);
  K.mesh(K.sphere(1, 14, 10), fur, [0, 0.0, 0.03], nose, null, [0.07, 0.075, 0.1]);
  K.mesh(K.sphere(1, 12, 9), fur, [0, -0.05, 0.1], nose, null, [0.066, 0.074, 0.068]);
  // the trunk-like tip that hangs over the mouth
  K.mesh(K.sphere(1, 12, 9), fur, [0, -0.1, 0.13], nose, null, [0.058, 0.056, 0.048]);
  K.mesh(K.sphere(1, 10, 8), belly, [0, -0.13, 0.07], nose, null, [0.042, 0.028, 0.05]);
  K.mesh(K.box(0.005, 0.06, 0.012), nostril, [0, -0.12, 0.172], nose);                    // the crease
  K.mesh(K.sphere(1, 6, 5), nostril, [0.022, -0.145, 0.155], nose, null, [0.016, 0.01, 0.012]);
  K.mesh(K.sphere(1, 6, 5), nostril, [-0.022, -0.145, 0.155], nose, null, [0.016, 0.01, 0.012]);

  const legs = [];
  for (const [s, f] of [[-1, 1], [1, 1], [-1, 0], [1, 0]]) {
    const L = f
      ? leg2(K, body, [s * 0.11, -0.12, 0.3], { up: 0.28, lo: 0.3, r0: 0.058, r1: 0.03, mat: fur, low: legMat, rigid: true })
      : leg2(K, body, [s * 0.12, -0.06, -0.32], { up: 0.31, lo: 0.31, r0: 0.065, r1: 0.03, mat: fur, low: legMat, thigh: [0.11, 0.17, 0.14] });
    L.rx = f ? 0 : -0.2; L.kx = f ? 0 : 0.3; L.front = f; L.s = s;
    L.ph = (f ? PI / 2 : 0) + (s > 0 ? PI : 0);
    legs.push(L);
  }

  K.mesh(K.sphere(1, 8, 6), fur, [0, 0.72, 0.0], far, null, [0.22, 0.24, 0.52]);
  K.mesh(K.sphere(1, 8, 6), fur, [0, 0.9, 0.58], far, null, [0.1, 0.12, 0.16]);
  K.mesh(K.box(0.26, 0.58, 0.6), legMat, [0, 0.3, 0], far);
  if (!female) K.mesh(K.box(0.09, 0.32, 0.02), horn, [0, 1.12, 0.5], far, [-0.3, 0, 0]);

  return finish(K, root, near, far, home, 45, {
    species: SPECIES['saiga-antelope'], radius: 0.72, eye: new THREE.Vector3(0, 1.0, 0.62),
    speed: 2.3, roam: 9, fleeAt: 11, curiousAt: 30, shy: 0.6, rareChance: 0.55,
    pose(c, dt, env) {
      const spd = motion(c, dt), w = clamp(spd / 0.7, 0, 1), run = clamp((spd - 2.2) / 2.5, 0, 1);
      c._ph += dt * (spd / (0.95 + run * 0.6)) * TAU;
      const rare = c.state === 'rare', t = c.t;
      c._r = ease(c._r ?? 0, rare ? 1 : 0, dt, 5);
      // stotting: stiff-legged bounces after the nose has flared a while
      const stot = rare && t > 1.2 && t < c.hold - 0.6 ? Math.abs(Math.sin((t - 1.2) * 4.4)) : 0;
      const flare = rare ? 1 + 0.18 * Math.max(0, Math.sin(t * 11)) * (t < 1.6 ? 1 : 0.5) : 1;
      nose.scale.set(flare, ease(nose.scale.y, rare ? 1.06 : 1, dt, 6), flare);
      nose.rotation.x = Math.sin(env.t * 1.3 + c.bob) * 0.04 + (c.state === 'eat' ? Math.sin(env.t * 10) * 0.08 : 0);
      const breathe = 1 + Math.sin(env.t * 2.4 + c.bob) * 0.015;
      body.scale.set(breathe, breathe, 1);
      body.position.y = 0.7 + stot * 0.42 + Math.abs(Math.sin(c._ph)) * (0.02 + run * 0.05) * w;
      body.rotation.x = Math.sin(c._ph * 2) * 0.04 * run;
      walk4(legs, c._ph, 0.42 + run * 0.35, 1.0 + run * 0.4, w * (1 - c._r));
      for (const L of legs) if (c._r > 0.01) {
        L.hip.rotation.x += ((L.front ? -0.12 : 0.15) * stot) * c._r;
        L.knee.rotation.x += 0.15 * stot * c._r;
      }
      neck.rotation.x = ease(neck.rotation.x, -0.5 + (c.state === 'eat' ? 1.35 : 0) - c._r * 0.15 - run * 0.15, dt, 4);
      K.look(c, head, env, dt, { yaw: 0.8, pitch: 0.4 });
      if (c.state === 'eat') head.rotation.x += (0.35 - head.rotation.x) * Math.min(1, dt * 4);
      K.blink(c, [eyeG], dt);
    },
  });
}

// ---------------------------------------------------------------------------------------------
// CAPE BUFFALO: a massive dark bovine with the heavy boss of fused horns sweeping down and up.
// Rare: snorts (breath puffs), tosses the head and paws the ground.
export function buildCapeBuffalo(K, home, opts = {}) {
  const hide = K.mat(0x26211e, { roughness: 0.86 }), hide2 = K.mat(0x332b26, { roughness: 0.9 });
  const horn = K.mat(0x6d6457, { roughness: 0.55, metalness: 0.05 }), nose = K.sheen(0x1b1816, { roughness: 0.25 });
  const earIn = K.mat(0xb7a48a, { roughness: 0.9 }), glow = K.glow(0xff9a4a, 0.8);
  const breath = K.fin(0xe9eef2, 0.32, 0.4, { roughness: 1 });
  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  K.shadow(root, 0.9, 1.7);

  const body = K.group([0, 1.12, 0], near);
  K.mesh(K.sphere(1, 14, 10), hide, [0, 0.02, 0.38], body, null, [0.52, 0.6, 0.62]);
  K.mesh(K.sphere(1, 14, 10), hide, [0, -0.02, -0.12], body, null, [0.5, 0.5, 0.8]);
  K.mesh(K.sphere(1, 12, 9), hide, [0, 0.0, -0.62], body, null, [0.46, 0.48, 0.42]);
  K.mesh(K.sphere(1, 12, 9), hide2, [0, 0.3, 0.28], body, null, [0.36, 0.3, 0.5]);
  K.mesh(K.sphere(1, 10, 8), hide2, [0, -0.32, 0.45], body, null, [0.28, 0.25, 0.3]);       // dewlap
  for (let i = 0; i < 5; i++) K.mesh(K.sphere(1, 6, 5), glow, [0, 0.6 - i * 0.04, 0.38 - i * 0.22], body, null, 0.025);

  const neck = K.group([0, 0.12, 0.85], body, [0.35, 0, 0]);
  K.mesh(K.sphere(1, 12, 9), hide, [0, -0.05, 0.08], neck, null, [0.34, 0.4, 0.36]);
  const head = K.group([0, -0.12, 0.3], neck);
  K.mesh(K.sphere(1, 12, 9), hide, [0, 0.02, 0.1], head, null, [0.24, 0.26, 0.28]);
  K.mesh(K.sphere(1, 12, 9), hide, [0, -0.18, 0.3], head, null, [0.17, 0.18, 0.2]);
  K.mesh(K.sphere(1, 10, 8), nose, [0, -0.24, 0.45], head, null, [0.14, 0.1, 0.07]);
  K.mesh(K.sphere(1, 6, 5), hide2, [0.05, -0.24, 0.51], head, null, [0.025, 0.02, 0.012]);
  K.mesh(K.sphere(1, 6, 5), hide2, [-0.05, -0.24, 0.51], head, null, [0.025, 0.02, 0.012]);
  // the boss and the horns: down, out, then hooked up and in
  K.mesh(K.sphere(1, 12, 8), horn, [0, 0.22, 0.04], head, null, [0.27, 0.09, 0.16]);
  for (const s of [-1, 1]) {
    const P = [[0.05, 0.23, 0.04], [0.25, 0.21, 0.02], [0.47, 0.05, -0.02], [0.66, -0.06, 0.04], [0.82, 0.1, 0.1], [0.8, 0.4, 0.05]].map(([x, y, z]) => [s * x, y, z]);
    K.mesh(K.tube('bufHorn' + s, P, 0.14, 0.024, 8, 18), horn, [0, 0, 0], head);
    // drooping fringed ears under the horn
    K.mesh(K.sphere(1, 10, 7), hide, [s * 0.32, 0.0, -0.04], head, [0, 0, -s * 0.5], [0.16, 0.06, 0.1]);
    K.mesh(K.sphere(1, 8, 6), earIn, [s * 0.33, -0.01, 0.0], head, [0, 0, -s * 0.5], [0.12, 0.035, 0.07]);
  }
  const eyeG = eyes(K, head, { x: 0.17, y: 0.06, z: 0.22, r: 0.03, iris: 0x2c1a10, out: 0.7,
    irisMat: K.glow(0xff8a3a, 0.35, { color: 0x3a2010, roughness: 0.2 }) });
  const puff = K.group([0, -0.26, 0.6], head);
  for (const s of [-1, 1]) for (let k = 0; k < 2; k++) K.mesh(K.sphere(1, 8, 6), breath, [s * (0.06 + k * 0.05), -0.02 - k * 0.04, 0.06 + k * 0.12], puff, null, 0.07 + k * 0.04);
  puff.visible = false;

  const legs = [];
  for (const [s, f] of [[-1, 1], [1, 1], [-1, 0], [1, 0]]) {
    const L = f
      ? leg2(K, body, [s * 0.3, -0.38, 0.52], { up: 0.4, lo: 0.42, r0: 0.13, r1: 0.09, rf: 0.095, mat: hide })
      : leg2(K, body, [s * 0.3, -0.3, -0.6], { up: 0.42, lo: 0.46, r0: 0.14, r1: 0.085, rf: 0.095, mat: hide, thigh: [0.22, 0.34, 0.28] });
    L.rx = f ? 0 : -0.15; L.kx = f ? 0 : 0.22; L.front = f; L.s = s;
    L.ph = (f ? PI / 2 : 0) + (s > 0 ? PI : 0);
    legs.push(L);
  }
  const tail = K.group([0, 0.2, -1.0], body, [0.25, 0, 0]);
  rod(K, tail, [0, 0, 0], [0, -0.62, -0.06], 0.035, 0.02, hide);
  K.mesh(K.sphere(1, 8, 6), hide2, [0, -0.66, -0.06], tail, null, [0.06, 0.12, 0.06]);

  K.mesh(K.sphere(1, 8, 6), hide, [0, 1.15, -0.1], far, null, [0.55, 0.6, 1.05]);
  K.mesh(K.sphere(1, 8, 6), hide, [0, 1.05, 1.25], far, null, [0.24, 0.3, 0.3]);
  K.mesh(K.box(1.5, 0.12, 0.2), horn, [0, 1.3, 1.2], far);
  K.mesh(K.box(0.6, 0.8, 1.4), hide2, [0, 0.4, 0], far);

  return finish(K, root, near, far, home, 55, {
    species: SPECIES['cape-buffalo'], radius: 1.5, eye: new THREE.Vector3(0, 1.25, 1.35),
    speed: 1.5, roam: 8, fleeAt: 9, curiousAt: 30, shy: 0.25, rareChance: 0.5,
    pose(c, dt, env) {
      const spd = motion(c, dt), w = clamp(spd / 0.6, 0, 1), run = clamp((spd - 1.6) / 2, 0, 1);
      c._ph += dt * (spd / (1.5 + run)) * TAU;
      const rare = c.state === 'rare', t = c.t;
      // rare: two snorts (0-1.4 s), a head toss (1.4-2.2), pawing the ground (2.2 on)
      const snort = rare && t < 1.6 ? Math.max(0, Math.sin(t * 7.5)) : 0;
      const toss = rare ? bell(1.4, 2.3, t) : 0;
      const paw = rare && t > 2.2 && t < c.hold - 0.3 ? 1 : 0;
      c._paw = ease(c._paw ?? 0, paw, dt, 6);
      const breathe = 1 + Math.sin(env.t * 1.6 + c.bob) * 0.012 + snort * 0.02;
      body.scale.set(breathe, breathe, 1);
      body.position.y = 1.12 + Math.abs(Math.sin(c._ph)) * (0.02 + run * 0.05) * w;
      body.rotation.x = c._paw * 0.04;
      walk4(legs, c._ph, 0.35 + run * 0.25, 0.8, w);
      const L = legs[1];                                               // the right fore paws
      if (c._paw > 0.01) {
        const sw = Math.sin(t * 6.5);
        L.hip.rotation.x += (-0.25 + sw * 0.4) * c._paw;
        L.knee.rotation.x += Math.max(0, sw) * 1.1 * c._paw;
      }
      puff.visible = snort > 0.15;
      if (puff.visible) puff.scale.setScalar(0.6 + snort * 0.7);
      neck.rotation.x = ease(neck.rotation.x, 0.35 + (c.state === 'eat' ? 0.75 : 0) + c._paw * 0.3 - toss * 0.85 + snort * 0.06, dt, toss > 0 ? 9 : 4);
      K.look(c, head, env, dt, { yaw: 0.55, pitch: 0.3, rate: 2.5, force: rare });
      if (c.state === 'eat') head.rotation.x += (0.2 + Math.sin(env.t * 5) * 0.06 - head.rotation.x) * Math.min(1, dt * 4);
      head.rotation.z = Math.sin(t * 9) * toss * 0.2;
      tail.rotation.z = Math.sin(env.t * 1.7 + c.bob) * 0.25 + Math.sin(env.t * 9) * 0.15 * (snort + c._paw);
      K.blink(c, [eyeG], dt);
    },
  });
}

// ---------------------------------------------------------------------------------------------
// insect and spider legs: a femur out and up, a tibia down to the ground, placed in body space
function insectLeg(K, parent, attach, ang, s, femur, tibia, r, mat) {
  const ry = -s * ang, cs = Math.cos(ry), sn = Math.sin(ry);
  const P = (x, y) => [attach[0] + x * cs, attach[1] + y, attach[2] - x * sn];
  const knee = P(s * femur[0], femur[1]), foot = P(s * tibia[0], tibia[1]);
  limb(K, parent, attach, knee, r, mat, 5);
  limb(K, parent, knee, foot, r * 0.75, mat, 5);
  return { knee, foot };
}

// PEACOCK SPIDER: a jumping spider the size of a dog, sitting on the boulders. Huge glossy front
// eyes, an orange cap, and the striped red and blue fan it lifts and shakes in its dance (rare),
// waving its third pair of legs. opts.perch: it lives on a boulder top (home.y = the rock top).
export function buildPeacockSpider(K, home, opts = {}) {
  const grey = K.mat(0x9b9893, { roughness: 0.95 }), dark = K.mat(0x2b2726, { roughness: 0.9 });
  const cap = K.mat(0xc0702e, { roughness: 0.85 }), white = K.mat(0xf2f0ea, { roughness: 0.9 });
  const blue = K.sheen(0x2f86f0, { roughness: 0.3, emissive: 0x1a60c0, emissiveIntensity: 0.25 });
  const red = K.mat(0xe2401c, { roughness: 0.5 }), cyan = K.glow(0x38e6ff, 1.2);
  const eyeB = K.sheen(0x080808, { roughness: 0.06 }), eyeG = K.glow(0x9de05a, 0.5, { color: 0x3a6a28, roughness: 0.1, metalness: 0.4 });
  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  K.shadow(root, 0.38, 0.42);

  const body = K.group([0, 0.26, 0], near);
  K.mesh(K.sphere(1, 12, 9), cap, [0, 0.03, 0.08], body, null, [0.15, 0.12, 0.17]);
  K.mesh(K.sphere(1, 12, 9), dark, [0, -0.02, 0.07], body, null, [0.162, 0.1, 0.178]);
  for (const s of [-1, 1]) {
    K.mesh(K.sphere(1, 12, 9), eyeB, [s * 0.052, 0.02, 0.22], body, null, 0.056);
    K.mesh(K.sphere(1, 10, 7), eyeG, [s * 0.054, 0.04, 0.255], body, null, [0.03, 0.022, 0.022]);
    K.mesh(K.sphere(1, 6, 5), K.mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9 }), [s * 0.045, 0.055, 0.273], body, null, 0.009);
    K.mesh(K.sphere(1, 10, 7), eyeB, [s * 0.128, 0.04, 0.19], body, null, 0.03);
    K.mesh(K.sphere(1, 8, 6), eyeB, [s * 0.11, 0.12, 0.07], body, null, 0.018);
    limb(K, body, [s * 0.05, -0.06, 0.2], [s * 0.065, -0.1, 0.26], 0.018, white, 5);   // pedipalps
    K.mesh(K.sphere(1, 8, 6), white, [s * 0.067, -0.11, 0.265], body, null, 0.024);
  }
  // walking legs in two alternating sets of three (the dance legs are their own)
  const setA = K.group([0, 0, 0], body), setB = K.group([0, 0, 0], body);
  const LEG = [[0.92, 0.07, [0.16, 0.1], [0.3, -0.27]], [0.35, 0.02, [0.17, 0.11], [0.32, -0.27]], null, [-0.85, -0.05, [0.17, 0.11], [0.31, -0.27]]];
  for (const s of [-1, 1]) LEG.forEach((L, k) => {
    if (!L) return;
    const g = (k === 1) === (s > 0) ? setA : setB;
    insectLeg(K, g, [s * 0.1, -0.02, L[1] + 0.06], L[0], s, L[2], L[3], k === 0 ? 0.04 : 0.034, grey);
  });
  const dance = [-1, 1].map((s) => {
    const hip = K.group([s * 0.11, 0.0, 0.03], body);
    limb(K, hip, [0, 0, 0], [s * 0.18, 0.12, -0.04], 0.034, grey, 5);
    const knee = K.group([s * 0.18, 0.12, -0.04], hip);
    limb(K, knee, [0, 0, 0], [s * 0.12, -0.2, -0.05], 0.028, grey, 5);
    K.mesh(K.sphere(1, 8, 6), dark, [s * 0.135, -0.24, -0.055], knee, null, [0.05, 0.075, 0.05]);
    K.mesh(K.sphere(1, 6, 5), white, [s * 0.145, -0.33, -0.06], knee, null, [0.03, 0.045, 0.03]);
    return { hip, knee, s };
  });
  // the fan: the abdomen, striped red, blue and glowing cyan, with two side flaps
  const fan = K.group([0, 0.04, -0.06], body, [0.12, 0, 0]);
  const AB = [0.15, 0.08, 0.2], zc = -0.19;
  K.mesh(K.sphere(1, 14, 10), blue, [0, 0, zc], fan, null, AB);
  [[-0.05, red, 1.06, 0.03], [-0.095, cyan, 1.07, 0.008], [-0.135, red, 1.06, 0.034], [-0.185, cyan, 1.07, 0.008], [-0.23, red, 1.06, 0.034], [-0.28, cyan, 1.07, 0.008], [-0.32, red, 1.07, 0.026]].forEach(([z, m, k, th]) => {
    const u = (z - zc) / AB[2], f = Math.sqrt(Math.max(0.02, 1 - u * u));
    K.mesh(K.sphere(1, 14, 4), m, [0, 0, z], fan, null, [AB[0] * f * k, AB[1] * f * k, th]);
    // and across the top, where the dance shows it
    vU.set(0, (u * AB[1]) / (AB[2] * f), 1).normalize();             // the surface tilt along z
    const lens = K.mesh(K.sphere(1, 12, 5), m, [0, AB[1] * f * 0.985, z], fan, null, [AB[0] * f * 0.86, 0.022, th * 0.9]);
    lens.rotation.x = Math.atan2(u * AB[1], AB[2] * f) * 0.9;
  });
  for (let i = 0; i < 7; i++) {
    const a = -1.2 + i * 0.4;
    limb(K, fan, [0, 0.01, zc - 0.18], [Math.sin(a) * 0.09, 0.03 + Math.cos(a) * 0.05, zc - 0.25], 0.008, dark, 4);
  }
  const flaps = [-1, 1].map((s) => {
    const g = K.group([s * 0.12, 0.0, zc], fan, [0, 0, -s * 1.2]);
    K.mesh(K.sphere(1, 12, 8), red, [s * 0.06, 0, 0], g, null, [0.075, 0.014, 0.16]);
    return { g, s };
  });

  K.mesh(K.sphere(1, 8, 6), cap, [0, 0.29, 0.08], far, null, [0.16, 0.13, 0.18]);
  K.mesh(K.sphere(1, 8, 6), blue, [0, 0.31, -0.15], far, null, [0.15, 0.09, 0.2]);
  K.mesh(K.box(0.8, 0.05, 0.5), grey, [0, 0.16, 0.03], far);
  K.mesh(K.sphere(1, 6, 5), red, [0, 0.36, -0.16], far, null, [0.12, 0.05, 0.12]);

  const c = finish(K, root, near, far, home, 34, {
    species: SPECIES['peacock-spider'], radius: 0.45, eye: new THREE.Vector3(0, 0.3, 0.2),
    speed: 1.6, roam: opts.perch ? 0.8 : 4, fleeAt: 6, curiousAt: 20, shy: 0.4, rareChance: 0.8, flyer: !!opts.perch,
    pose(c, dt, env) {
      const spd = motion(c, dt), w = clamp(spd / 0.4, 0, 1);
      c._ph += dt * (spd / 0.35) * TAU;
      const rare = c.state === 'rare', t = c.t;
      c._d = ease(c._d ?? 0, rare ? 1 : 0, dt, rare ? 4 : 3);
      const d = c._d;
      // jumping-spider gait: little hops, the leg sets stepping alternately
      const hop = Math.abs(Math.sin(c._ph)) * w;
      body.position.y = 0.26 + hop * 0.06 + Math.sin(env.t * 2 + c.bob) * 0.004;
      body.position.x = Math.sin(t * 3.2) * 0.07 * d;                   // the side-to-side shuffle
      body.rotation.z = Math.sin(t * 3.2) * 0.08 * d;
      setA.position.set(0, Math.max(0, Math.cos(c._ph)) * 0.04 * w, Math.sin(c._ph) * 0.05 * w);
      setB.position.set(0, Math.max(0, -Math.cos(c._ph)) * 0.04 * w, -Math.sin(c._ph) * 0.05 * w);
      fan.rotation.x = ease(fan.rotation.x, 0.12 + d * 1.3 + Math.sin(env.t * 1.5 + c.bob) * 0.04, dt, 6);
      fan.rotation.z = Math.sin(t * 6.4) * 0.12 * d;
      for (const f of flaps) f.g.rotation.z = -f.s * (1.2 - d * 1.15) + f.s * Math.sin(t * 13) * 0.08 * d;
      for (const L of dance) {
        const wave = Math.sin(t * 6.4 + (L.s > 0 ? 0 : PI));
        L.hip.rotation.z = L.s * d * (0.95 + wave * 0.3);
        L.knee.rotation.z = L.s * d * (1.0 + wave * 0.25);
        L.hip.rotation.y = Math.sin(c._ph) * 0.2 * w;
      }
      // the whole spider turns to keep the van in its big front eyes
      const b = bearing(c, env);
      if (c.near < 30 && c.state !== 'flee' && c.state !== 'wander' && c.state !== 'eat') c.root.rotation.y += clamp(b, -1.5 * dt, 1.5 * dt);
      body.rotation.x = ease(body.rotation.x, -d * 0.12 + (c.state === 'eat' ? 0.2 : 0), dt, 5);
    },
  });
  if (opts.perch) perch(c, home.clone(), 0.9);
  return c;
}

// ---------------------------------------------------------------------------------------------
// STAG BEETLE: a glossy chestnut beetle as long as a man's arm, with antler mandibles. Rare: it
// rears, opens its jaws wide, parts its wing cases and flickers its flight wings.
export function buildStagBeetle(K, home, opts = {}) {
  const shell = K.sheen(0x5e2616, { roughness: 0.2 }), rim = K.sheen(0x1a0f0b, { roughness: 0.25 });
  const black = K.sheen(0x22160f, { roughness: 0.3 }), jaw = K.sheen(0x6e2c1a, { roughness: 0.25 });
  const wing = K.fin(0xb5874e, 0.5, 0.5), glow = K.glow(0xffb85a, 1.0);
  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  K.shadow(root, 0.38, 0.6);

  const body = K.group([0, 0.17, 0], near);
  K.mesh(K.sphere(1, 12, 8), black, [0, -0.03, -0.25], body, null, [0.24, 0.07, 0.32]);
  K.mesh(K.sphere(1, 12, 9), black, [0, 0.02, 0.08], body, null, [0.23, 0.075, 0.13]);
  K.mesh(K.box(0.3, 0.04, 0.04), black, [0, 0.01, -0.02], body);
  for (const s of [-1, 1]) K.mesh(K.sphere(1, 6, 5), glow, [s * 0.14, 0.08, 0.08], body, null, [0.03, 0.01, 0.03]);
  const elytra = [-1, 1].map((s) => {
    const g = K.group([s * 0.005, 0.03, -0.03], body);
    K.mesh(K.sphere(1, 14, 9), shell, [s * 0.115, 0, -0.27], g, null, [0.125, 0.075, 0.3]);
    K.mesh(K.sphere(1, 12, 8), rim, [s * 0.117, -0.01, -0.27], g, null, [0.132, 0.07, 0.306]);
    K.mesh(K.sphere(1, 6, 4), glow, [s * 0.008, 0.072, -0.22], g, null, [0.006, 0.006, 0.16]);
    return { g, s };
  });
  const wings = [-1, 1].map((s) => {
    const g = K.group([s * 0.05, 0.05, -0.02], body);
    K.mesh(K.sphere(1, 10, 4), wing, [s * 0.02, 0, -0.3], g, null, [0.09, 0.004, 0.32]);
    g.visible = false;
    return { g, s };
  });
  const head = K.group([0, 0.02, 0.2], body);
  K.mesh(K.sphere(1, 12, 8), black, [0, 0, 0.05], head, null, [0.21, 0.06, 0.11]);
  for (const s of [-1, 1]) {
    K.mesh(K.sphere(1, 8, 6), rim, [s * 0.185, 0.01, 0.06], head, null, 0.03);
    limb(K, head, [s * 0.12, 0.02, 0.1], [s * 0.2, 0.08, 0.18], 0.008, black, 4);
    limb(K, head, [s * 0.2, 0.08, 0.18], [s * 0.27, 0.07, 0.24], 0.007, black, 4);
    for (let k = 0; k < 3; k++) K.mesh(K.box(0.035, 0.008, 0.012), black, [s * (0.28 + k * 0.004), 0.07, 0.25 + k * 0.016], head, [0, -s * 0.6, 0]);
  }
  const mand = [-1, 1].map((s) => {
    const g = K.group([s * 0.08, 0.0, 0.12], head);
    const P = [[0, 0, 0], [0.09, 0.05, 0.13], [0.08, 0.14, 0.27], [-0.04, 0.23, 0.38]].map(([x, y, z]) => [s * x, y, z]);
    K.mesh(K.tube('stagJaw' + s, P, 0.042, 0.012, 7, 12), jaw, [0, 0, 0], g);
    K.mesh(K.cone(0.02, 0.09, 5), jaw, [s * 0.05, 0.11, 0.22], g, [0, 0, s * 1.5]);
    K.mesh(K.cone(0.014, 0.06, 5), jaw, [s * 0.03, 0.21, 0.33], g, [-0.6, 0, s * 1.3]);
    return { g, s };
  });
  const setA = K.group([0, 0, 0], body), setB = K.group([0, 0, 0], body);
  [[0.7, 0.12], [0.05, -0.05], [-0.75, -0.17]].forEach(([ang, z], k) => {
    for (const s of [-1, 1]) {
      const g = (k === 1) === (s > 0) ? setA : setB;
      insectLeg(K, g, [s * 0.13, -0.03, z], ang, s, [0.17, 0.06], [0.32, -0.17], 0.024, black);
    }
  });

  K.mesh(K.sphere(1, 8, 6), shell, [0, 0.24, -0.27], far, null, [0.26, 0.1, 0.3]);
  K.mesh(K.sphere(1, 8, 6), black, [0, 0.22, 0.14], far, null, [0.21, 0.08, 0.17]);
  K.mesh(K.box(0.25, 0.04, 0.32), jaw, [0, 0.27, 0.48], far);
  K.mesh(K.box(0.7, 0.03, 0.45), black, [0, 0.12, -0.03], far);

  return finish(K, root, near, far, home, 36, {
    species: SPECIES['stag-beetle'], radius: 0.6, eye: new THREE.Vector3(0, 0.25, 0.3),
    speed: 0.8, roam: 4, fleeAt: 6, curiousAt: 18, shy: 0.35, rareChance: 0.75, flyer: !!opts.perch,
    pose(c, dt, env) {
      const spd = motion(c, dt), w = clamp(spd / 0.3, 0, 1);
      c._ph += dt * (spd / 0.24) * TAU;
      const rare = c.state === 'rare', t = c.t;
      c._r = ease(c._r ?? 0, rare ? 1 : 0, dt, rare ? 4 : 3);
      const r = c._r, part = rare ? ramp(1.0, 1.6, t) * (1 - ramp(c.hold - 0.7, c.hold, t)) : 0;
      c._p = ease(c._p ?? 0, part, dt, 6);
      body.position.y = 0.17 + r * 0.09 + Math.sin(env.t * 1.8 + c.bob) * 0.003;
      body.rotation.x = ease(body.rotation.x, -r * 0.42 + (c.state === 'eat' ? 0.1 : 0), dt, 6);
      body.rotation.z = Math.sin(c._ph) * 0.03 * w;
      setA.position.set(0, Math.max(0, Math.cos(c._ph)) * 0.04 * w + r * 0.07, Math.sin(c._ph) * 0.05 * w + r * 0.05);
      setB.position.set(0, Math.max(0, -Math.cos(c._ph)) * 0.04 * w + r * 0.07, -Math.sin(c._ph) * 0.05 * w + r * 0.05);
      for (const m of mand) m.g.rotation.y = ease(m.g.rotation.y, m.s * (-0.04 + r * (0.42 + Math.sin(t * 5) * 0.1)) + (c.state === 'eat' ? m.s * Math.sin(env.t * 7) * 0.15 : 0), dt, 8);
      const p = c._p;
      for (const e of elytra) { e.g.rotation.z = e.s * p * 0.75; e.g.rotation.x = p * 0.35; }
      for (const g of wings) {
        g.g.visible = p > 0.05;
        g.g.rotation.y = -g.s * p * 1.25;
        g.g.rotation.z = g.s * (p * 0.3 + Math.sin(env.t * 44 + g.s) * 0.35 * p);
      }
      K.look(c, head, env, dt, { yaw: 0.4, pitch: 0.3, rate: 2 });
    },
  });
}

// ---------------------------------------------------------------------------------------------
// PICASSO BUG: a round shield bug painted cream, teal, black and orange like a modern canvas. Rare
// (and by itself at dawn): its painted rings pulse with light.
export function buildPicassoBug(K, home, opts = {}) {
  const cream = K.sheen(0xefe6cb, { roughness: 0.35 }), teal = K.sheen(0x3f9e98, { roughness: 0.3 });
  const black = K.sheen(0x141414, { roughness: 0.35 }), orange = K.glow(0xff5a2c, 0.55, { roughness: 0.35 });
  const under = K.mat(0x2f2a22, { roughness: 0.8 }), light = K.fin(0x8ffff0, 0.75, 3.2);
  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  K.shadow(root, 0.3, 0.38);

  const body = K.group([0, 0.12, 0], near);
  const hemi = K.geo('hemi14', () => new THREE.SphereGeometry(1, 16, 8, 0, TAU, 0, PI / 2));
  const A = 0.27, B = 0.17, C = 0.3, Z = -0.05;
  K.mesh(hemi, cream, [0, 0, Z], body, null, [A, B, C]);
  K.mesh(hemi, cream, [0, 0.0, 0.17], body, null, [0.22, 0.11, 0.15]);
  K.mesh(K.sphere(1, 12, 6), under, [0, -0.005, 0.02], body, null, [0.25, 0.05, 0.36]);
  const disc = K.cyl(1, 1, 1, 12);
  const pulse = K.group([0, 0, Z], body);                             // the light layer, hidden till the rare
  const blob = (p, f, s0, sx = 1, spin = 0, onPron = false) => {
    const s = s0 * 1.12;
    const [a, b, c, z] = onPron ? [0.22, 0.11, 0.15, 0.17] : [A, B, C, Z];
    const n0 = onDome(a, b, c, p, f, 0);
    for (const [m, k, lift] of [[orange, 1.38, 0.002], [black, 1.16, 0.005], [teal, 1, 0.008]]) {
      const at = n0.pos.clone().addScaledVector(n0.n, lift);
      at.z += z;
      patch(K, disc, m, body, at, n0.n, [s * k * sx, 0.006, s * k], spin);
    }
    if (!onPron) patch(K, disc, light, pulse, n0.pos.clone().addScaledVector(n0.n, 0.012), n0.n, [s * 1.05 * sx, 0.004, s * 1.05], spin);
  };
  blob(0.25, 0, 0.05, 1.3, 0);
  blob(0.62, PI, 0.045);
  for (const s of [-1, 1]) {
    blob(0.6, s * 0.95, 0.048, 1.2, s * 0.5);
    blob(0.7, s * 2.05, 0.046);
    blob(1.0, s * 2.75, 0.04, 1.4, s * 0.3);
    blob(1.05, s * 1.45, 0.042, 1.5, s * 1.4);
    blob(1.15, s * 0.45, 0.035, 1.3, s * 0.2);
    blob(0.7, s * 0.6, 0.042, 1.6, s * 0.2, true);
    blob(1.0, s * 1.1, 0.032, 1.4, s * 0.6, true);
  }
  for (let i = 0; i < 6; i++) {                                         // small black dots between
    const { pos, n } = onDome(A, B, C, 0.85 + (i % 2) * 0.2, (i - 2.5) * 0.9, 0.006);
    pos.z += Z;
    patch(K, disc, black, body, pos, n, [0.014, 0.006, 0.014]);
  }
  pulse.scale.setScalar(0.96);
  pulse.visible = false;

  const head = K.group([0, 0.03, 0.31], body);
  K.mesh(K.sphere(1, 10, 7), cream, [0, 0, 0.02], head, null, [0.06, 0.035, 0.06]);
  K.mesh(K.sphere(1, 8, 6), teal, [0, 0.02, 0.03], head, null, [0.03, 0.02, 0.04]);
  for (const s of [-1, 1]) {
    K.mesh(K.sphere(1, 8, 6), K.sheen(0x6a1a14, { roughness: 0.15 }), [s * 0.055, 0.012, 0.0], head, null, 0.016);
    limb(K, head, [s * 0.035, 0.0, 0.06], [s * 0.11, 0.07, 0.17], 0.007, black, 4);
    limb(K, head, [s * 0.11, 0.07, 0.17], [s * 0.18, 0.05, 0.3], 0.0065, black, 4);
  }
  const setA = K.group([0, 0, 0], body), setB = K.group([0, 0, 0], body);
  [[0.7, 0.18], [0.1, 0.02], [-0.7, -0.15]].forEach(([ang, z], k) => {
    for (const s of [-1, 1]) {
      const g = (k === 1) === (s > 0) ? setA : setB;
      insectLeg(K, g, [s * 0.15, -0.02, z], ang, s, [0.12, 0.02], [0.2, -0.11], 0.016, under);
    }
  });

  K.mesh(K.sphere(1, 8, 5), cream, [0, 0.12, 0.0], far, null, [0.27, 0.17, 0.33]);
  K.mesh(K.sphere(1, 6, 4), teal, [0, 0.27, -0.03], far, null, [0.12, 0.03, 0.14]);
  K.mesh(K.sphere(1, 6, 4), orange, [0, 0.24, -0.2], far, null, [0.14, 0.03, 0.09]);
  K.mesh(K.box(0.5, 0.04, 0.5), under, [0, 0.07, 0.02], far);

  const c = finish(K, root, near, far, home, 34, {
    species: SPECIES['picasso-bug'], radius: 0.4, eye: new THREE.Vector3(0, 0.22, 0.05),
    speed: 0.55, roam: opts.perch ? 0.6 : 3, fleeAt: 5, curiousAt: 16, shy: 0.45, rareChance: 0.7, rareAt: 'dawn', flyer: !!opts.perch,
    pose(c, dt, env) {
      const spd = motion(c, dt), w = clamp(spd / 0.2, 0, 1);
      c._ph += dt * (spd / 0.16) * TAU;
      const rare = c.state === 'rare', t = c.t;
      c._r = ease(c._r ?? 0, rare ? 1 : 0, dt, 3);
      const beat = 0.5 + 0.5 * Math.sin(t * 5.5);
      pulse.visible = c._r > 0.04;
      pulse.scale.setScalar(0.975 + c._r * (0.03 + beat * 0.03));
      body.position.y = 0.12 + c._r * beat * 0.015 + Math.sin(env.t * 1.5 + c.bob) * 0.002;
      body.rotation.z = Math.sin(c._ph) * 0.02 * w;
      setA.position.set(0, Math.max(0, Math.cos(c._ph)) * 0.025 * w, Math.sin(c._ph) * 0.03 * w);
      setB.position.set(0, Math.max(0, -Math.cos(c._ph)) * 0.025 * w, -Math.sin(c._ph) * 0.03 * w);
      K.look(c, head, env, dt, { yaw: 0.35, pitch: 0.25, rate: 2 });
      head.rotation.z = Math.sin(env.t * 2.3 + c.bob) * 0.08;
      if (c.state === 'eat') head.rotation.x = 0.3 + Math.sin(env.t * 6) * 0.1;
    },
  });
  if (opts.perch) perch(c, home.clone(), 0.5);
  return c;
}

// ---------------------------------------------------------------------------------------------
// LADYBIRD: a swarm of glowing ladybirds the size of a cat's head, hovering over a bush and lit
// like fireflies after dark. One InstancedMesh per material: the whole swarm is six draw calls.
// Rare: they gather and spiral up together. opts: { count = 16, spread = 2.4 }.
const mA = new THREE.Matrix4(), mB = new THREE.Matrix4(), qA = new THREE.Quaternion(), qB = new THREE.Quaternion();
const sOne = new THREE.Vector3(1, 1, 1), eA = new THREE.Euler(), pA = new THREE.Vector3(), hinge = new THREE.Vector3();
function partsGeo(K, key, parts) {
  return K.geo(key, () => {
    const gs = parts.map(([g, p, r, s, n]) => {
      const c = g.clone();
      const m = new THREE.Matrix4().compose(new THREE.Vector3(...p),
        n ? new THREE.Quaternion().setFromUnitVectors(UP, n) : new THREE.Quaternion().setFromEuler(new THREE.Euler(...(r || [0, 0, 0]))),
        typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s));
      c.applyMatrix4(m);
      return c;
    });
    const out = mergeGeometries(gs, false);
    gs.forEach((g) => g.dispose());
    return out;
  });
}
export function buildLadybird(K, home, opts = {}) {
  const N = opts.count ?? 16, spread = opts.spread ?? 2.4;
  const red = K.sheen(0xd8301c, { roughness: 0.18, emissive: 0xd8301c, emissiveIntensity: K.glowLevel * 0.12 });
  const black = K.sheen(0x101010, { roughness: 0.3 }), white = K.mat(0xf2ead6, { roughness: 0.6 });
  const glow = K.glow(0xd4ff6a, 1.6), wingM = K.fin(0x9a7656, 0.45, 0.4);
  const sph = new THREE.SphereGeometry(1, 12, 8), low = new THREE.SphereGeometry(1, 8, 6);
  const dome = new THREE.SphereGeometry(1, 14, 7, 0, TAU, 0, PI / 2);
  const DA = 0.13, DB = 0.1, DC = 0.15;
  const spots = [[0.32, 0.0], [0.75, 0.55], [0.75, -0.55], [1.05, 1.5], [1.05, -1.5], [0.9, 2.4], [0.9, -2.4]].map(([p, f]) => {
    const { pos, n } = onDome(DA, DB, DC, p, f, 0.004);
    return [low, [pos.x, pos.y, pos.z - 0.01], null, [0.03, 0.01, 0.03], n];
  });
  const geoRed = partsGeo(K, 'ladyRed', [[dome, [0, 0, -0.01], null, [DA, DB, DC]]]);
  const geoBlack = partsGeo(K, 'ladyBlack', [
    ...spots,
    [low, [0, -0.01, -0.01], null, [0.12, 0.035, 0.14]],                // belly
    [sph, [0, 0.02, 0.13], null, [0.075, 0.045, 0.05]],                 // pronotum
    [low, [0, 0.0, 0.18], null, [0.045, 0.03, 0.03]],                   // head
  ]);
  const geoWhite = partsGeo(K, 'ladyWhite', [[low, [0.05, 0.03, 0.15], null, [0.025, 0.02, 0.025]], [low, [-0.05, 0.03, 0.15], null, [0.025, 0.02, 0.025]], [low, [0, 0.012, 0.205], null, [0.02, 0.012, 0.012]]]);
  const geoGlow = partsGeo(K, 'ladyGlow', [[low, [0, -0.03, -0.1], null, [0.06, 0.03, 0.05]]]);
  const geoWR = partsGeo(K, 'ladyWingR', [[low, [0.13, 0, -0.04], [0, -0.35, 0], [0.13, 0.004, 0.06]]]);
  const geoWL = partsGeo(K, 'ladyWingL', [[low, [-0.13, 0, -0.04], [0, 0.35, 0], [0.13, 0.004, 0.06]]]);
  [sph, low, dome].forEach((g) => g.dispose());

  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  const inst = (g, m, n, parent) => {
    const im = new THREE.InstancedMesh(g, m, n);
    im.frustumCulled = false;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    parent.add(im);
    return im;
  };
  const parts = [inst(geoRed, red, N, near), inst(geoBlack, black, N, near), inst(geoWhite, white, N, near), inst(geoGlow, glow, N, near)];
  // after dark each one carries a soft halo of light, like a firefly
  if (K.dim) {
    const halo = K.fin(0x7fae2a, K.night ? 0.55 : 0.35, 0.5, { roughness: 1, blending: THREE.AdditiveBlending });
    parts.push(inst(partsGeo(K, 'ladyHalo', [[new THREE.SphereGeometry(1, 10, 7), [0, -0.03, -0.07], null, [0.13, 0.1, 0.15]]]), halo, N, near));
  }
  const wR = inst(geoWR, wingM, N, near), wL = inst(geoWL, wingM, N, near);
  const dots = inst(K.geo('ladyFar', () => new THREE.IcosahedronGeometry(0.16, 0)), red, N, far);
  K.place(root, home);

  // each ladybird: its own little orbit round the bush
  const P = [];
  for (let i = 0; i < N; i++) P.push({ r: 0.5 + K.rand() * spread, w: (0.35 + K.rand() * 0.5) * (K.rand() < 0.5 ? -1 : 1), a: K.rand() * TAU,
    y: 0.7 + K.rand() * 1.5, f: 0.6 + K.rand() * 0.9, ph: K.rand() * TAU, pos: new THREE.Vector3(), yaw: 0 });
  const c = {
    species: SPECIES.ladybird, root, home: home.clone(), radius: 0.9, flock: true, state: 'idle', t: 0, hold: 0, bob: K.rand() * 6.28,
    visible: true, eye: new THREE.Vector3(0, 1.2, 0), lead: null, near: 99,
  };
  c.go = (s, hold = 7) => { if (c.state === s) return; c.state = s; c.t = 0; c.hold = hold; };
  c.photoPoint = (out) => out.copy(c.lead ? c.lead.pos : c.eye).applyMatrix4(c.root.matrixWorld);
  c.forward = (out) => out.set(Math.sin(c.lead ? c.lead.yaw : 0), 0, Math.cos(c.lead ? c.lead.yaw : 0));
  K.lod(c, near, far, 40);
  c.step = (dt, env) => {
    c.t += dt;
    // a feed pellet nearby, or the dark, sets them spiralling up
    if (c.state !== 'rare') {
      const fed = env.pellets.some((p) => p.landed && !p.eaten && p.pos.distanceTo(c.root.position) < 12);
      if (fed || (env.tod === 'night' && Math.random() < dt * 0.03) || Math.random() < dt * 0.006) {
        c.go('rare', 8);
        if (env.call) env.call(c, 'rare');
      }
    } else if (c.t > c.hold) c.go('idle', 0);
    const rare = c.state === 'rare';
    const T = Math.min(c.hold, 8), up = rare ? bell(0, T, c.t % T) : 0;  // rises and settles back
    c._up = ease(c._up ?? 0, up, dt, 2);
    const u = c._up;
    c.root.updateMatrixWorld();
    vU.copy(env.camPos); c.root.worldToLocal(vU);
    let best = null, bestD = Infinity;
    const night = env.tod === 'night' || env.tod === 'dusk';
    for (let i = 0; i < N; i++) {
      const b = P[i];
      b.a += dt * b.w * (1 + u * 1.6);
      const r = b.r * (1 - u * 0.55) + u * 0.6;
      const helix = u * (2 + 6 * ((i / N + c.t * 0.12) % 1));
      const x = Math.cos(b.a) * r + Math.sin(env.t * b.f + b.ph) * 0.12;
      const z = Math.sin(b.a) * r + Math.cos(env.t * b.f * 1.3 + b.ph) * 0.12;
      const y = b.y * (1 - u * 0.4) + helix + Math.sin(env.t * b.f * 2 + b.ph) * 0.18 + (night ? 0.3 : 0);
      const yaw = Math.atan2(-Math.sin(b.a) * Math.sign(b.w), Math.cos(b.a) * Math.sign(b.w));
      b.pos.set(x, y, z); b.yaw = yaw;
      eA.set(-0.35 + Math.sin(env.t * 3 + b.ph) * 0.1, yaw, Math.sin(env.t * 2 + b.ph) * 0.2);
      qA.setFromEuler(eA);
      mA.compose(b.pos, qA, sOne);
      for (const im of parts) im.setMatrixAt(i, mA);
      dots.setMatrixAt(i, mA);
      const flap = Math.sin(env.t * 38 + b.ph * 5) * 0.55;
      for (const [im, s] of [[wR, 1], [wL, -1]]) {
        hinge.set(s * 0.05, 0.06, 0.06);
        qB.setFromEuler(eA.set(0.2, 0, s * (0.35 + flap)));
        mB.compose(hinge, qB, sOne);
        im.setMatrixAt(i, mB.premultiply(mA));
      }
      const d = pA.copy(b.pos).distanceToSquared(vU);
      if (d < bestD) { bestD = d; best = b; }
    }
    for (const im of parts) im.instanceMatrix.needsUpdate = true;
    wR.instanceMatrix.needsUpdate = true; wL.instanceMatrix.needsUpdate = true; dots.instanceMatrix.needsUpdate = true;
    c.lead = best;
    c.root.updateMatrixWorld();
  };
  return c;
}

export const BUILDERS = {
  'frilled-lizard': buildFrilledLizard,
  'fennec-fox': buildFennecFox,
  'giant-tortoise': buildGiantTortoise,
  'saiga-antelope': buildSaigaAntelope,
  'cape-buffalo': buildCapeBuffalo,
  'peacock-spider': buildPeacockSpider,
  'stag-beetle': buildStagBeetle,
  ladybird: buildLadybird,
  'picasso-bug': buildPicassoBug,
};
