// The ground pangolin (FEAT-006): a scaly anteater by a termite mound on the canyon floor, near the
// road at the start of the route.
//
//   ground-pangolin   about 1 m from nose to tail tip, covered in large overlapping scales like a pine
//                     cone (olive-brown on the body, more golden towards the tail), a small pointed
//                     head with tiny eyes, pale bare skin on the face and belly, big curved front
//                     claws. It walks slowly on its hind legs, body leaning forward, the tail held out
//                     behind as a balance and the front claws tucked. At the mound it digs with its
//                     front claws and flicks a long thin tongue into the hole. When the van comes
//                     close it rolls into a tight ball of scales and keeps still; once the van has
//                     passed by a bit it slowly unrolls and walks on. Rare pose: it stands fully
//                     upright on its hind legs, the tail on the ground, sniffing the air.
//
// By day it rests curled up at the mouth of its burrow at the foot of the mound until the van comes
// near; then it wakes and digs. After dark it forages along the road, digging here and there. The
// twist: faint glowing edges on some of the scales, barely there by day, clear at night.
//
// The body is one chain of segments from the head to the tail tip; every pose (walk, dig, stand,
// ball) is a set of bends along that chain, and the animal blends from one to the next.
import * as THREE from 'three';

export const SPECIES = {
  'ground-pangolin': { id: 'ground-pangolin', name: 'Ground pangolin', points: 220, call: { hz: 320, kind: 'noise' } },
};

const PI = Math.PI;
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vN = new THREE.Vector3(), mA = new THREE.Matrix4(), qA = new THREE.Quaternion();
const damp = (a, b, k, dt) => a + (b - a) * Math.min(1, k * dt);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = THREE.MathUtils.clamp;

// ---- the chain: where each joint sits along its parent (m) and how long the bend is that follows it
const FWD = [0.07, 0.1, 0.1, 0.06];                 // hips → belly → chest → neck → head
const TAIL = [0.07, 0.095, 0.095, 0.095, 0.095];    // hips → five tail segments
// rolled up: the body curls tight from the hips (on top) round the front, the head tucked in against
// the belly at the bottom; the tail curls the other way round the back and under, outside the head, so
// it covers the face (each joint bent by its length over the radius at that point)
const BALL_R = 0.105, TAIL_R = [0.1, 0.11, 0.13, 0.15, 0.16];
const BALL = {
  h: BALL_R + 0.2, lean: 0,
  j: FWD.map((o, i) => o / BALL_R + (i === 3 ? 0.6 : 0)), t: TAIL.map((o, i) => -o / TAIL_R[i]),
};
const POSE = {
  walk: { h: 0.215, lean: -0.5, j: [0.1, 0.1, 0.16, 0.3], t: [0.42, 0.06, 0.02, -0.03, -0.06] },
  dig: { h: 0.2, lean: 0.3, j: [0.1, 0.12, 0.16, 0.22], t: [-0.5, -0.05, 0.03, 0.05, 0.05] },
  stand: { h: 0.205, lean: -1.4, j: [0.04, 0.04, 0.12, 1.0], t: [1.16, 0.1, 0.05, 0.02, 0] },
  ball: BALL,
};

// a scale's outline: a rounded shield, the free edge pointing back (+y here, laid along the body)
const SCALE = [[0, -0.05], [0.3, 0], [0.47, 0.18], [0.5, 0.42], [0.43, 0.67], [0.27, 0.87], [0, 1], [-0.27, 0.87], [-0.43, 0.67], [-0.5, 0.42], [-0.47, 0.18], [-0.3, 0]];

// Cover one segment's ellipsoid (centre c, radii r) with rows of overlapping scales, their free edges
// towards the tail (-z). `rows` z positions, `n` scales per row across the back from -phi to +phi,
// w/l their size; every `glowEvery`-th scale gets a faint glowing edge.
function scales(K, g, { c, r, rows, n, phi, w, l, mat, glow, glowEvery = 0, tilt = 0.16 }) {
  const geo = K.shape('pg-scale', SCALE, 1);
  const edge = K.sphere(1, 7, 4);
  let k = 0;
  rows.forEach((z, ri) => {
    const off = ri % 2 ? 0.5 : 0;
    const zz = clamp((z - c[2]) / r[2], -0.96, 0.96), s = Math.sqrt(1 - zz * zz);
    for (let i = 0; i < n; i++) {
      const f = -phi + (2 * phi) * (n === 1 ? 0.5 : (i + off) / (n - 1 + (off ? 1 : 0)));
      const sx = Math.sin(f), cy = Math.cos(f);
      const p = vA.set(c[0] + r[0] * s * sx, c[1] + r[1] * s * cy, z);
      vN.set(sx / r[0], cy / r[1], zz / r[2] * 0.6).normalize();
      // the plate: its width across the body, its length back along it, its face out of the body
      vB.set(0, 0, -1).addScaledVector(vN, vN.z).normalize();          // back along the surface
      const x = new THREE.Vector3().crossVectors(vB, vN).normalize();
      mA.makeBasis(x, vB, vN);
      qA.setFromRotationMatrix(mA).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), tilt));
      const base = p.clone().addScaledVector(vN, 0.002);
      const m = K.mesh(geo, mat, [base.x, base.y, base.z], g, null, [w, l, 0.007]);
      m.quaternion.copy(qA);
      if (glow && glowEvery && (k++ % glowEvery) === glowEvery - 1) {
        // the glowing rim along the free edge of this scale
        const tip = new THREE.Vector3(0, l * 0.86, 0.006).applyQuaternion(qA).add(base);
        const e = K.mesh(edge, glow, [tip.x, tip.y, tip.z], g, null, [w * 0.36, l * 0.07, 0.0045]);
        e.quaternion.copy(qA);
      }
    }
  });
}

// =============================================================================================
// The termite mound it digs at: a lumpy clay tower ~1.4 m high with two smaller turrets, a hole in
// the side the pangolin digs into (towards `dig`, a direction on the ground) and its burrow at the
// foot beside it. Static: baked into a few draw calls.
export function buildTermiteMound(K, base, dig) {
  const clay = K.mat(0xa4673f, { roughness: 1, flatShading: true }), crust = K.mat(0x8c5434, { roughness: 1, flatShading: true });
  const hole = K.mat(0x1a0f09, { roughness: 1 }), loose = K.mat(0x7a4a2e, { roughness: 1, flatShading: true });
  const g = K.group();
  const tower = (key, h, r) => K.lathe('mound' + key, [[r, -0.1], [r * 0.96, 0.1 * h], [r * 0.82, 0.3 * h], [r * 0.64, 0.52 * h], [r * 0.5, 0.7 * h], [r * 0.34, 0.86 * h], [r * 0.16, 0.97 * h], [0.001, h]], 9);
  K.mesh(tower('a', 1.42, 0.72), clay, [0, 0, 0], g, [0, 0.3, 0.04]);
  K.mesh(tower('b', 0.95, 0.38), crust, [-0.42, 0, -0.2], g, [0.1, 1.1, -0.12]);
  K.mesh(tower('c', 0.7, 0.3), clay, [0.35, 0, -0.38], g, [-0.08, 2, 0.1]);
  // lumps of built-up clay round the foot
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * PI * 2 + 0.4;
    K.mesh(K.geo('mound-lump', () => new THREE.IcosahedronGeometry(1, 0)), i % 2 ? crust : clay, [Math.cos(a) * 0.68, 0.05, Math.sin(a) * 0.68], g, [i, i * 2, 0], [0.22, 0.16 + (i % 3) * 0.04, 0.2]);
  }
  K.place(g, base);
  g.rotation.y = Math.atan2(dig.x, dig.z);           // local +z: the side the pangolin digs at
  // the hole it digs into, and its burrow at the foot a little to the side, with the earth thrown out
  K.mesh(K.sphere(1, 10, 7), hole, [0.05, 0.2, 0.6], g, [-0.35, 0, 0], [0.1, 0.075, 0.05]);
  K.mesh(K.sphere(1, 10, 7), hole, [-0.42, 0.06, 0.58], g, [-0.2, -0.45, 0], [0.17, 0.12, 0.06]);
  for (let i = 0; i < 6; i++) K.mesh(K.geo('mound-crumb', () => new THREE.IcosahedronGeometry(1, 0)), loose, [-0.45 + (i % 3) * 0.17 + 0.08, 0.02, 0.86 + Math.floor(i / 3) * 0.14], g, [i, i, i], [0.09, 0.04, 0.08]);
  K.bake(g);
  return g;
}

// =============================================================================================
// The pangolin. opts:
//   mound   the mound's centre (world); dig: where it stands to dig at it, facing the mound
//   burrow  where it rests by day (curled up at the burrow's mouth)
//   spots   other places along the road it digs at while foraging (night) and walks on to (day)
export function buildPangolin(K, home, opts = {}) {
  const night = K.night;
  const body0 = K.mat(0x7a6235, { roughness: 0.55, metalness: 0.05 });      // olive-brown on the back
  const body1 = K.mat(0x8d7140, { roughness: 0.55, metalness: 0.05 });
  const tail0 = K.mat(0x9b7b44, { roughness: 0.5, metalness: 0.05 });       // more golden down the tail
  const tail1 = K.mat(0xaf8c4c, { roughness: 0.5, metalness: 0.05 });
  const skin = K.mat(0xcaa696, { roughness: 0.85 }), dark = K.mat(0x3a2c22, { roughness: 0.9 });
  const under = K.mat(0x45372a, { roughness: 0.9 });                         // between the scales
  const claw = K.sheen(0x2c241d, { roughness: 0.35 }), tongueM = K.mat(0xc9787a, { roughness: 0.45 });
  const eyeM = K.sheen(0x090706, { roughness: 0.1 }), dirt = K.mat(0x8a5634, { roughness: 1 });
  const glow = K.glow(0xa6f2d6, 0.45);

  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  K.shadow(root, 0.22, 0.42);

  // ---- the chain
  const H = K.group([0, POSE.dig.h, 0], near);                              // the hips
  K.mesh(K.sphere(1, 12, 9), under, [0, -0.005, 0], H, null, [0.108, 0.1, 0.098]);
  K.mesh(K.sphere(1, 10, 8), skin, [0, -0.035, 0.01], H, null, [0.085, 0.07, 0.085]);
  scales(K, H, { c: [0, 0, 0], r: [0.115, 0.105, 0.1], rows: [-0.08, -0.05, -0.02, 0.01, 0.04, 0.07], n: 8, phi: 2.0, w: 0.066, l: 0.062, mat: body0, glow, glowEvery: 7 });
  const F = [];                                                               // belly, chest, neck, head
  let parent = H;
  const segs = [
    { c: [0, 0, 0.05], r: [0.12, 0.11, 0.075], rows: [0.0, 0.03, 0.06, 0.09], n: 8, phi: 2.0, w: 0.07, l: 0.062, mat: body1, glowEvery: 7 },
    { c: [0, -0.003, 0.05], r: [0.105, 0.097, 0.07], rows: [0.0, 0.03, 0.06, 0.09], n: 8, phi: 1.95, w: 0.062, l: 0.056, mat: body0, glowEvery: 7 },
    { c: [0, -0.008, 0.03], r: [0.072, 0.068, 0.05], rows: [0.0, 0.028, 0.055], n: 6, phi: 1.7, w: 0.05, l: 0.045, mat: body1 },
  ];
  FWD.forEach((o, i) => {
    const g = K.group([0, 0, o], parent);
    if (i < 3) {
      const s = segs[i];
      K.mesh(K.sphere(1, 12, 9), under, [s.c[0], s.c[1] - 0.004, s.c[2]], g, null, [s.r[0] * 0.94, s.r[1] * 0.94, s.r[2] * 1.15]);
      K.mesh(K.sphere(1, 10, 8), skin, [s.c[0], s.c[1] - s.r[1] * 0.32, s.c[2]], g, null, [s.r[0] * 0.74, s.r[1] * 0.68, s.r[2] * 1.12]);   // the pale belly
      scales(K, g, { ...s, glow: s.glowEvery ? glow : null });
    }
    F.push(g); parent = g;
  });
  // the head: small and pointed, bare pale face, a cap of small scales, tiny eyes
  const head = F[3];
  K.mesh(K.sphere(1, 12, 9), skin, [0, -0.008, 0.035], head, null, [0.046, 0.04, 0.056]);
  K.mesh(K.cone(1, 1, 10), skin, [0, -0.016, 0.105], head, [PI / 2, 0, 0], [0.026, 0.09, 0.022]);
  K.mesh(K.sphere(1, 8, 6), dark, [0, -0.018, 0.148], head, null, [0.008, 0.007, 0.006]);
  scales(K, head, { c: [0, 0, 0.03], r: [0.05, 0.046, 0.06], rows: [-0.01, 0.015, 0.04], n: 4, phi: 0.85, w: 0.032, l: 0.032, mat: body1, tilt: 0.1 });
  for (const s of [-1, 1]) K.mesh(K.sphere(1, 6, 5), eyeM, [s * 0.036, 0.004, 0.058], head, null, 0.0075);
  // the tongue: thin and pink, shot out of the mouth along +z (its group's z scale is its reach)
  const tongue = K.group([0, -0.022, 0.15], head);
  K.mesh(K.cyl(0.0035, 0.005, 1, 5), tongueM, [0, 0, 0.5], tongue, [PI / 2, 0, 0]);
  tongue.scale.set(1, 1, 0.001);
  tongue.visible = false;

  const T = [];
  parent = H;
  TAIL.forEach((o, i) => {
    const g = K.group([0, 0, -o], parent);
    const k = i / (TAIL.length - 1), rx = 0.1 - k * 0.058, ry = 0.068 - k * 0.036, w = 0.062 - k * 0.026, l = 0.058 - k * 0.02;
    K.mesh(K.sphere(1, 10, 8), under, [0, -0.004, -0.048], g, null, [rx * 0.94, ry * 0.92, 0.064]);
    scales(K, g, { c: [0, 0, -0.048], r: [rx, ry, 0.066], rows: [0.005, -0.025, -0.055, -0.085].slice(0, i === TAIL.length - 1 ? 3 : 4), n: 6, phi: 2.35, w, l, mat: i < 2 ? tail0 : tail1, glow: i < 3 ? glow : null, glowEvery: 6 });
    if (i === TAIL.length - 1) K.mesh(K.cone(1, 1, 8), tail1, [0, 0, -0.11], g, [-PI / 2, 0, 0], [0.03, 0.06, 0.018]);
    T.push(g); parent = g;
  });

  // ---- the legs: strong hind legs it walks on, short front legs with big curved claws
  const legs = [-1, 1].map((s) => {
    const hip = K.group([s * 0.075, -0.045, 0.01], H);
    K.mesh(K.capsule(0.036, 0.07, 2, 7), body0, [0, -0.045, 0], hip);
    const knee = K.group([0, -0.1, 0.0], hip);
    K.mesh(K.capsule(0.024, 0.05, 2, 6), skin, [0, -0.035, 0], knee);
    const foot = K.group([0, -0.07, 0.0], knee);
    K.mesh(K.sphere(1, 8, 6), skin, [0, -0.008, 0.025], foot, null, [0.028, 0.014, 0.048]);
    for (let i = -1; i <= 1; i++) K.mesh(K.cone(0.006, 0.026, 5), claw, [i * 0.012, -0.012, 0.075], foot, [PI / 2 + 0.2, 0, 0]);
    return { hip, knee, foot, s };
  });
  const arms = [-1, 1].map((s) => {
    const sh = K.group([s * 0.068, -0.05, 0.06], F[1]);
    K.mesh(K.capsule(0.024, 0.045, 2, 6), skin, [0, -0.032, 0], sh);
    const el = K.group([0, -0.065, 0], sh);
    K.mesh(K.capsule(0.019, 0.035, 2, 6), skin, [0, -0.025, 0], el);
    // three big curved claws, the middle one longest
    for (let i = -1; i <= 1; i++) {
      const c = K.group([i * 0.011, -0.05, 0.004], el, [0.5, 0, i * 0.12]);
      K.mesh(K.cone(0.007, i ? 0.045 : 0.06, 5), claw, [0, -(i ? 0.02 : 0.027), 0.008], c, [PI - 0.35, 0, 0]);
    }
    return { sh, el, s };
  });
  // rolled up, the inside of the ball (seen only through the gaps between the coils)
  const core = K.group([0, BALL.h - BALL_R, 0], near);
  K.mesh(K.sphere(1, 10, 8), under, [0, 0, 0], core, null, 0.11);
  scales(K, core, { c: [0, 0, 0], r: [0.115, 0.115, 0.13], rows: [-0.09, -0.06, -0.03, 0, 0.03, 0.06, 0.09], n: 9, phi: PI, w: 0.06, l: 0.055, mat: tail0, glow, glowEvery: 9 });
  core.visible = false;
  // the earth it throws up digging, in front of its claws
  const puff = K.group([0, 0.03, 0.3], near);
  for (let i = 0; i < 5; i++) K.mesh(K.sphere(1, 7, 5), dirt, [(i - 2) * 0.035, (i % 2) * 0.03, -(i % 3) * 0.03], puff, null, 0.022 + (i % 2) * 0.01);
  puff.visible = false;

  // ---- far: a scaly lump with a tail, or a ball
  const farBody = K.group(null, far), farBall = K.group(null, far);
  K.mesh(K.sphere(1, 8, 6), body0, [0, 0.26, 0.06], farBody, [-0.5, 0, 0], [0.11, 0.1, 0.22]);
  K.mesh(K.cone(1, 1, 6), tail0, [0, 0.13, -0.32], farBody, [-PI / 2 - 0.35, 0, 0], [0.085, 0.42, 0.06]);
  K.mesh(K.sphere(1, 8, 6), body0, [0, BALL.h * 0.55, 0], farBall, null, [0.2, 0.2, 0.22]);

  K.place(root, home);

  // ---- the behaviour, decided here (not by the shared state machine):
  //   rest    curled up at the burrow (day, until the van comes near)
  //   unroll  slowly uncurling
  //   dig     digging at the mound or a spot (the first few seconds; `idle` after, so a pose may come)
  //   idle    digging on
  //   wander  walking on its hind legs to the next spot
  //   ball    rolled up tight while the van is close
  //   rare    standing upright on its hind legs, the tail on the ground, sniffing (planPoses)
  const BALL_AT = 9.5, WAKE_AT = 33;
  const spots = (opts.spots || []).map((p) => p.clone());
  const S = { p: clone(POSE.ball), minD: Infinity, calm: 0, ph: 0, dig: 0, sniff: 0, look: 0, after: 0, call: 2, lastSpot: night ? -1 : 0, passed: false };
  const c = K.makeCreature({
    species: SPECIES['ground-pangolin'], root, home, radius: 0.45, eye: new THREE.Vector3(0, 0.26, 0.1),
    ground: K.groundY, speed: night ? 0.36 : 0.26, roam: 0, fleeAt: 0, curiousAt: 0, shy: 1, rareChance: 0, yaw: opts.yaw,
  });
  c.state = night ? 'wander' : 'rest';
  c.hold = 99;
  c.air = !night;                                     // a ball is no animal to turn round to the feed
  if (night) c.target = (spots[0] || home).clone();

  // the next place to dig at: the mound first, then the spots in turn (by day it has dug at the mound
  // already, so it walks on to the first spot)
  const next = () => {
    const all = [opts.dig, ...spots].filter(Boolean);
    S.lastSpot = (S.lastSpot + 1) % all.length;
    return all[S.lastSpot].clone();
  };
  const startDig = (hold) => { c.go('dig', hold); S.dig = 0; };

  c.step = (dt, env) => {
    c.t += dt;
    const d = env.dist, rp = c.root.position;
    // the van close: roll up, whatever it was doing (a pose ends with it)
    if (d < BALL_AT && c.state !== 'ball' && c.state !== 'rest') { c.go('ball', 99); S.minD = d; S.calm = 0; if (env.call) env.call(c, 'flee'); }
    if (c.state === 'rest' && d < BALL_AT) { c.go('ball', 99); S.minD = d; }
    switch (c.state) {
      case 'rest':
        if (d < WAKE_AT) c.go('unroll', 2.2);
        break;
      case 'ball':
        // keeps still until the van has passed by a bit and is pulling away
        S.minD = Math.min(S.minD, d);
        S.calm = d > S.minD + 2.5 && d > BALL_AT + 1.5 ? S.calm + dt : 0;
        if (S.calm > 0.7) { S.passed = true; c.go('unroll', 2.6); }
        break;
      case 'unroll':
        if (c.t > c.hold) {
          if (S.passed) { c.target = next(); c.go('wander', 30); }      // walks on
          else startDig(night ? 2.5 : 3);
        }
        break;
      case 'dig':                                       // a first while at it; poses wait for it
        if (c.t > c.hold) c.go('idle', night ? 1.5 + Math.random() * 2 : 99);
        break;
      case 'idle':
        if (c.t > c.hold) { c.target = next(); c.go('wander', 30); }
        break;
      case 'wander': {
        const done = c.walkTo(c.target, dt);
        rp.y = K.groundY(rp.x, rp.z);
        if (done || c.t > c.hold) startDig(night ? 2 + Math.random() * 2 : 3);
        break;
      }
      case 'rare':
        if (c.t > c.hold) c.go('idle', 2);
        break;
      default:
        c.go('idle', 2);
    }
    // facing the mound (or the spot) while it digs
    if ((c.state === 'dig' || c.state === 'idle') && opts.mound) {
      if (opts.mound.distanceTo(rp) < 1.6) c.turnTo(opts.mound.x, opts.mound.z, dt, 2);
    }
    c.air = c.state === 'ball' || c.state === 'rest' || c.state === 'unroll';
    pose(dt, env);
    c.root.updateMatrixWorld();
  };

  function pose(dt, env) {
    const st = c.state, t = env.t;
    const P = S.p;
    // the target pose, and how fast it gets there: rolling up is quick, unrolling slow
    const want = st === 'ball' || st === 'rest' ? POSE.ball : st === 'rare' ? POSE.stand : st === 'wander' ? POSE.walk : st === 'unroll' ? POSE.walk : POSE.dig;
    const rate = st === 'ball' ? 7 : st === 'unroll' ? 1.5 : st === 'rare' ? 2.2 : 3;
    blend(P, want, rate, dt);
    const curl = clamp((P.h - POSE.walk.h) / (BALL.h - POSE.walk.h), 0, 1);
    // walking: the hind legs step, the body sways a little; the stride follows the real speed
    const spd = motion(dt);
    S.ph += dt * (spd / 0.11) * PI;
    const w = clamp(spd / 0.12, 0, 1) * (1 - curl);
    H.position.y = P.h + Math.abs(Math.sin(S.ph)) * 0.012 * w;
    H.rotation.x = P.lean;
    H.rotation.z = Math.sin(S.ph) * 0.05 * w;
    F.forEach((g, i) => { g.rotation.x = P.j[i]; });
    T.forEach((g, i) => { g.rotation.x = P.t[i] + Math.sin(t * 1.3 + i * 0.7 + c.bob) * 0.025 * (1 - curl); });
    // the hind legs stay upright under it whatever the lean; the front claws tuck under the chest
    for (const L of legs) {
      L.hip.rotation.x = -P.lean - 0.12 + Math.sin(S.ph + (L.s > 0 ? PI : 0)) * 0.55 * w + curl * 1.2;
      L.knee.rotation.x = Math.max(0, Math.cos(S.ph + (L.s > 0 ? PI : 0))) * 0.6 * w + 0.15 + curl * 0.8;
      L.foot.rotation.x = -(P.lean + L.hip.rotation.x + L.knee.rotation.x);
      L.hip.scale.setScalar(1 - curl * 0.7);
    }
    // digging: the claws scrape in turns, earth flies; now and then the head goes in and the tongue
    // flicks into the hole
    const digging = st === 'dig' || st === 'idle';
    S.dig = digging ? S.dig + dt : 0;
    const cyc = S.dig % 3.4, licking = digging && cyc > 2.1;
    const scrape = digging && !licking ? 1 : 0;
    for (const A of arms) {
      const tuck = st === 'wander' || st === 'unroll' || st === 'rare' ? 1 : 0;
      const sw = scrape ? Math.sin(t * 13 + (A.s > 0 ? PI : 0)) : 0;
      A.sh.rotation.x = damp(A.sh.rotation.x, tuck ? -0.9 - (st === 'rare' ? 0.3 : 0) : -0.55 + sw * 0.55 - (licking ? 0.3 : 0), 12, dt);
      A.el.rotation.x = damp(A.el.rotation.x, tuck ? -1.5 : -0.35 + Math.max(0, sw) * 0.5, 12, dt);
      A.sh.scale.setScalar(1 - curl * 0.7);
    }
    puff.visible = scrape > 0 && curl < 0.2;
    if (puff.visible) { const k = 0.6 + 0.5 * Math.abs(Math.sin(t * 9)); puff.scale.set(k, k * 1.2, k); puff.position.y = 0.03 + k * 0.03; }
    // the head: pushes into the hole to lick, sniffs while it stands, glances about while it walks
    const head = F[3];
    const lickDip = licking ? 0.18 + Math.sin(t * 5) * 0.04 : 0;
    const sniff = st === 'rare' ? Math.sin(t * 9) * 0.05 + Math.sin(t * 2.1) * 0.12 : 0;
    head.rotation.x = P.j[3] + lickDip + sniff;
    S.look -= dt;
    if (S.look <= 0) { S.lookY = (Math.random() - 0.5) * (st === 'rare' ? 0.9 : 0.5); S.look = 0.8 + Math.random() * 1.6; }
    head.rotation.y = damp(head.rotation.y, digging || curl > 0.3 ? 0 : S.lookY, 3, dt);
    const flick = licking ? Math.max(0, Math.sin((cyc - 2.1) * PI * 2.4)) : 0;
    tongue.visible = flick > 0.02;
    tongue.scale.z = 0.001 + flick * 0.22;
    // the photo point: the middle of the body, lower as a ball
    c.eye.set(0, 0.24 - curl * 0.06 + (st === 'rare' ? 0.12 : 0), 0.08 * (1 - curl));
    c.radius = 0.45 - curl * 0.17;
    core.visible = curl > 0.6;
    farBody.visible = curl < 0.5; farBall.visible = !farBody.visible;
    // a soft huff now and then while it digs
    S.call -= dt;
    if (S.call <= 0) { if (env.call && digging && env.dist < 40) env.call(c, 'idle'); S.call = 4 + Math.random() * 5; }
  }

  // how fast it really moves (m/s, smoothed): the stride follows it so the feet never skate
  function motion(dt) {
    const p = c.root.position;
    if (S.px === undefined) { S.px = p.x; S.pz = p.z; S.spd = 0; }
    const d = Math.hypot(p.x - S.px, p.z - S.pz);
    S.px = p.x; S.pz = p.z;
    if (dt > 0) S.spd = damp(S.spd, Math.min(3, d / dt), 6, dt);
    return S.spd;
  }

  // start in the right shape: a ball by day, walking at night
  if (night) Object.assign(S.p, clone(POSE.walk));
  pose(0, { t: 0, dist: 99 });
  return K.lod(c, near, far, 30);
}

function clone(p) { return { h: p.h, lean: p.lean, j: p.j.slice(), t: p.t.slice() }; }
function blend(P, W, k, dt) {
  P.h = damp(P.h, W.h, k, dt); P.lean = damp(P.lean, W.lean, k, dt);
  for (let i = 0; i < P.j.length; i++) P.j[i] = damp(P.j[i], W.j[i], k, dt);
  for (let i = 0; i < P.t.length; i++) P.t[i] = damp(P.t[i], W.t[i], k, dt);
}

export const BUILDERS = {
  'ground-pangolin': buildPangolin,
};
