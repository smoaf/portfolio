// The lammergeier (FEAT-010): the bearded vulture that drops bones onto the rocks to break them.
//
//   lammergeier  a huge vulture, about 2.7 m across, with long narrow pointed wings and a long
//                wedge-shaped tail: more like a giant falcon than a griffon. Dark grey-black back and
//                wings; head, neck and underside rust-orange (it bathes in iron-rich mud); a pale head
//                with a black mask from the eye to the bill and a black bristly "beard" under the
//                bill; a red ring round the pale eye.
//
// The set piece (every run that is not at night): before the van comes, it glides to and fro low
// over the canyon beside a few flat rocks (the "ossuary") on a ledge below the road, a long bone in
// its feet. As the van comes up the road it glides up along the cliff in wide circles to about 50 m
// above the rocks, flies in over them and lets go. The bone falls, hits the rocks and breaks into
// pieces in a small puff of dust. The bird swoops down in a spiral, lands on the rocks, picks at the
// pieces and swallows one. Rare pose (about half of the runs): on the rocks it spreads its wings wide
// in the sun and raises its head, showing the rust chest and the beard.
//
// At night it roosts on the same ledge a few metres from the rocks, wings folded. The twist: faint
// glowing lines along the flight feathers and round the eye, barely there by day, clear at night.
//
// The behaviour is its own (not the shared state machine): the van never sends it off and it leaves
// feed alone.
import * as THREE from 'three';
import { two, plume, eyePair, birdState, birdPose } from './cliffs.js';

export const SPECIES = {
  lammergeier: { id: 'lammergeier', name: 'Lammergeier', points: 240, call: { hz: 1900, kind: 'trill' } },
};

const PI = Math.PI;
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), qA = new THREE.Quaternion();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const damp = (a, b, k, dt) => a + (b - a) * Math.min(1, k * dt);
const clamp = THREE.MathUtils.clamp;
const G = 9.8;
const UP = 0.5;                                            // the body's centre above the feet
// the set piece, in metres of road still to go to the rocks: it starts climbing, flies in and lets
// go, and swallows (at the latest) at these
const CLIMB_AT = 200, DROP_AT = 140, DROP_LATE = 95, SWALLOW_AT = 55;
const HIGH = 50;                                           // how far above the rocks it lets go

// ---------------------------------------------------------------- the body parts

// A long narrow pointed wing on side s (+1 = the bird's left): the arm carries the secondaries, the
// hand the primaries, laid close (not fingered like a griffon's) and longest near the tip. A glowing
// line runs along each flight feather, on top and underneath. Returns what birdPose() moves.
function pointedWing(K, body, s, W) {
  const M = W.mats;
  const arm = K.group([s * W.at[0], W.at[1], W.at[2]], body);
  arm.rotation.order = 'YXZ';
  K.mesh(K.capsule(W.bone, W.arm, 3, 6), M.wing, [s * W.arm * 0.5, 0, 0], arm, [0, 0, PI / 2]);
  const ns = 7;
  for (let i = 0; i < ns; i++) {
    const u = (i + 0.5) / ns, x = s * u * W.arm, len = W.chord * (1.0 - 0.14 * u), yaw = s * 0.1 * (1 - u);
    plume(K, arm, M.wing, [x, -0.004, W.bone * 0.4], yaw, (W.arm / ns) * 1.8, len);
    plume(K, arm, M.cov, [s * (u - 0.04) * W.arm, W.bone * 0.35, W.bone * 0.5], yaw * 0.6, (W.arm / ns) * 2, len * 0.55);
    plume(K, arm, M.shaft, [x, -0.001, W.bone * 0.4], yaw, (W.arm / ns) * 0.18, len * 0.86, true);
    plume(K, arm, M.shaft, [x, -0.007, W.bone * 0.4], yaw, (W.arm / ns) * 0.18, len * 0.86, true);
  }
  const hand = K.group([s * W.arm, 0, 0], arm);
  hand.rotation.order = 'YXZ';
  K.mesh(K.capsule(W.bone * 0.75, W.hand * 0.6, 3, 6), M.wing, [s * W.hand * 0.32, 0, 0], hand, [0, 0, PI / 2]);
  const np = 8;
  for (let i = 0; i < np; i++) {
    const u = i / (np - 1), yaw = -s * (0.03 + 0.42 * Math.pow(u, 1.3));
    const x = s * W.hand * (0.08 + 0.6 * u), z = W.bone * 0.3;
    const len = W.primLen * (0.68 + 0.42 * Math.sin(u * PI * 0.62));
    plume(K, hand, M.prim, [x, -0.003 * i, z], yaw, W.primW, len, true);
    plume(K, hand, M.shaft, [x, 0.001 - 0.003 * i, z], yaw, W.primW * 0.16, len * 0.9, true);
    plume(K, hand, M.shaft, [x, -0.006 - 0.003 * i, z], yaw, W.primW * 0.16, len * 0.9, true);
  }
  for (let i = 0; i < 3; i++) plume(K, hand, M.cov, [s * W.hand * (0.06 + 0.2 * i), W.bone * 0.3, W.bone * 0.5], -s * 0.1 * i, W.hand * 0.32, W.chord * 0.5);
  return { arm, hand, s };
}

// the long wedge of a tail: the middle feathers the longest, the outer ones much shorter
function wedgeTail(K, body, at, mats) {
  const g = K.group(at, body);
  const n = 12;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1) - 0.5, yaw = -u * 0.32, l = 0.5 * (1 - Math.abs(u) * 0.8);
    plume(K, g, mats.feather, [u * 0.09, -Math.abs(u) * 0.004, 0], yaw, 0.07, l);
  }
  return g;
}

// the bone: a long leg bone, a shaft with a knob at each end, along +z
function boneBody(K, parent, mat) {
  const g = K.group(null, parent);
  K.mesh(K.capsule(0.022, 0.42, 3, 7), mat, [0, 0, 0], g, [PI / 2, 0, 0]);
  for (const e of [-1, 1]) {
    K.mesh(K.sphere(0.034, 8, 6), mat, [0.012, 0, e * 0.24], g);
    K.mesh(K.sphere(0.028, 8, 6), mat, [-0.016, 0.004, e * 0.255], g);
  }
  return g;
}

// ---------------------------------------------------------------- the rocks

// A few flat rocks jutting from the slope below the road: one wide slab (the bones break on it) and
// two smaller ones beside it. Each top lies just above the highest ground under it, and each slab
// reaches deep, so it stands out of the slope as a shelf with no gap under its downhill side. A few
// old splinters of bone lie on them. `at` is the ground in the middle, `along` the way the road
// runs, `out` across the canyon. Returns the top of the big slab (where the bone lands) and of the
// smaller one on its left (the night roost).
export function buildOssuary(K, at, along, out, rockMat, boneMat) {
  const ry = Math.atan2(-along.z, along.x);              // a slab's local x along the road
  const P = (a, o) => at.clone().addScaledVector(along, a).addScaledVector(out, o);
  const slab = (a, o, ra, ro, turn, sides) => {
    let top = -Infinity;
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      const q = P(a + ra * i / 2, o + ro * j / 2);
      top = Math.max(top, K.groundY(q.x, q.z));
    }
    top += 0.22;
    const c = P(a, o).setY(top);
    const g = K.group();
    K.mesh(K.cyl(1, 1.7, 5, sides), rockMat, [0, -2.5, 0], g, [0, turn, 0], [ra, 1, ro]);   // a slab on a sloping foot, like the rock it broke from
    K.place(g, c);
    g.rotation.y = ry;
    return c;
  };
  const top = slab(0, 0, 1.6, 0.9, 0.3, 7);
  const side = slab(-2.35, 0.15, 0.85, 0.7, 1.1, 6);
  slab(2.25, -0.1, 0.8, 0.65, 0.5, 6);
  // old splinters, bleached, lying where earlier bones broke
  const OLD = [[1.05, 0.5, 0.4, 0.07], [-0.95, 0.45, 2.1, 0.09], [0.6, -0.55, 1.2, 0.06], [-0.3, -0.6, 2.8, 0.05]];
  const old = K.group();
  for (const [a, o, r, l] of OLD) {
    const q = P(a, o).setY(top.y + 0.012);
    K.mesh(K.capsule(0.012, l, 2, 5), boneMat, [q.x, q.y, q.z], old, [PI / 2, r, 0]);
  }
  K.place(old);
  return { top, side };
}

// ---------------------------------------------------------------- the bird

// opts:
//   top      the top of the big slab, where the bone lands
//   out      unit vector across the canyon, away from the cliff (its circles keep out there)
//   ahead    env => metres of road the van still has to go to the rocks
//   land     where it lands on the rocks, landYaw its heading there
//   roost    the night: where it sits (home), yaw its heading
//   boneMat  the bone's material
export function buildLammergeier(K, home, opts = {}) {
  const night = K.night;
  const slate = K.mat(0x2b2d31, { roughness: 0.85 });
  const flight = two(K, 0x222428), cov = two(K, 0x3a3c41, { roughness: 0.9 });
  const rust = K.mat(0xc4692a, { roughness: 0.95 }), rustLight = K.mat(0xd98f4e, { roughness: 0.95 });
  const cream = K.mat(0xe8cfa8, { roughness: 0.9 }), black = K.mat(0x111111, { roughness: 0.85 });
  const beakM = K.sheen(0x6c6862, { roughness: 0.4 }), legM = K.mat(0x7d7a76, { roughness: 0.8 });
  const lum = K.glow(0x8ff2d4, 0.9, { side: THREE.DoubleSide, roughness: 0.41 });   // its own (the griffons flicker theirs)
  const ringM = K.glow(0xd8342c, 0.8, { roughness: 0.4 });            // the red ring round the eye
  const lumBase = lum.emissiveIntensity;
  const boneMat = opts.boneMat || K.mat(0xe6dcc4, { roughness: 0.75 });

  const root = K.group();
  const near = K.group(null, root), far = K.group(null, root);
  const body = K.group([0, UP, 0], near);
  // the body (+z along the spine): a slim dark back, the rust underside and a full rust chest
  K.mesh(K.sphere(0.17, 14, 10), slate, [0, 0.03, -0.01], body, null, [1.0, 0.82, 2.0]);
  K.mesh(K.sphere(0.155, 12, 9), rust, [0, -0.04, 0.04], body, null, [0.96, 0.9, 1.75]);
  K.mesh(K.sphere(0.13, 12, 9), rust, [0, -0.01, 0.2], body, null, [1.0, 1.08, 1.0]);
  for (let i = 0; i < 9; i++) {                                        // shaggy rust feathers on the breast and flanks
    const a = -0.9 + (i / 8) * 1.8;
    K.mesh(K.sphere(0.034, 7, 5), rust, [Math.sin(a) * 0.125, -0.1 + Math.cos(a * 2) * 0.02, 0.12 - Math.abs(a) * 0.05], body, [0.3, 0, a * 0.5], [1, 0.45, 1.9]);
  }
  // the neck: feathered, rust, thick; the head on it, pale, with the black mask and the beard
  const neck = K.group([0, 0.06, 0.26], body);
  K.mesh(K.capsule(0.062, 0.1, 3, 8), rustLight, [0, 0.05, 0.03], neck, [-0.6, 0, 0]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2;
    K.mesh(K.sphere(0.024, 6, 5), rustLight, [Math.cos(a) * 0.05, 0.045 + Math.sin(a) * 0.045, 0.02], neck, null, [1, 0.8, 1.7]);
  }
  const head = K.group([0, 0.13, 0.08], neck);
  K.mesh(K.sphere(0.06, 12, 9), cream, [0, 0, 0], head, null, [0.9, 0.95, 1.15]);
  K.mesh(K.sphere(0.045, 10, 7), rustLight, [0, -0.026, -0.01], head, null, [1.05, 0.8, 1.1]);     // throat and cheeks, tinged rust
  for (const s of [-1, 1]) {
    K.mesh(K.sphere(1, 8, 6), black, [s * 0.04, 0.012, 0.045], head, [0, s * 0.4, 0], [0.014, 0.022, 0.062]);   // the mask, eye to bill
    K.mesh(K.cone(1, 1, 5), black, [s * 0.009, -0.04, 0.085], head, [PI - 0.5, 0, s * 0.2], [0.014, 0.075, 0.014]);   // the beard
  }
  K.mesh(K.cone(1, 1, 5), black, [0, -0.045, 0.08], head, [PI - 0.4, 0, 0], [0.013, 0.07, 0.013]);
  K.mesh(K.tube('lg-beak', [[0, 0, 0], [0, 0.008, 0.045], [0, 0.002, 0.08], [0, -0.018, 0.095]], 0.019, 0.006, 6, 8), beakM, [0, -0.004, 0.06], head);
  const eyes = eyePair(K, head, { x: 0.038, y: 0.018, z: 0.03, r: 0.012, iris: 0xf1ebda, dir: 0.9, ring: ringM });
  // long, narrow, pointed wings and the long wedge of a tail
  const WS = { at: [0.1, 0.07, 0.12], arm: 0.46, hand: 0.46, chord: 0.34, bone: 0.03, primLen: 0.48, primW: 0.085,
    mats: { wing: flight, cov, prim: flight, shaft: lum } };
  const wings = [pointedWing(K, body, -1, WS), pointedWing(K, body, 1, WS)];
  const tail = wedgeTail(K, body, [0, 0.02, -0.28], { feather: flight });
  // legs: rust-feathered down to the toes, grey toes
  const legs = [-1, 1].map((s) => {
    const g = K.group([s * 0.065, 0.3, 0.02], near);
    K.mesh(K.sphere(0.055, 9, 7), rust, [0, -0.07, 0], g, null, [0.85, 2.5, 1.0]);              // feathered right down: rust "trousers"
    K.mesh(K.sphere(0.032, 7, 5), rustLight, [0, -0.21, 0.012], g, null, [0.9, 1.6, 1.1]);
    for (const a of [-0.45, 0, 0.45, PI]) K.mesh(K.capsule(0.012, 0.05, 2, 5), legM, [Math.sin(a) * 0.035, -0.27, Math.cos(a) * 0.035], g, [PI / 2, a, 0]);
    return g;
  });
  const shade = K.shadow(root, 0.35);
  const R = { body, wings, tail, P: birdState({ fold: night ? 1 : 0, pitch: night ? -0.5 : 0, legs: night ? 0 : 1.3 }) };

  // far: the barrel, the head, one wing slab that folds in on the ground, the wedge of a tail
  const fb = K.group([0, UP, 0], far);
  K.mesh(K.sphere(0.17, 8, 6), slate, [0, 0.02, 0], fb, null, [1.0, 0.85, 2.0]);
  K.mesh(K.sphere(0.14, 8, 6), rust, [0, -0.04, 0.1], fb, null, [0.95, 0.9, 1.5]);
  K.mesh(K.sphere(0.075, 6, 5), cream, [0, 0.2, 0.38], fb);
  const fw = K.group([0, 0.07, 0.1], fb);
  K.mesh(K.shape('lg-far', [[-1.35, -0.12], [-0.6, 0.1], [0, 0.16], [0.6, 0.1], [1.35, -0.12], [1.15, -0.27], [0.5, -0.3], [0, -0.24], [-0.5, -0.3], [-1.15, -0.27]]), flight, [0, 0, 0], fw, [-PI / 2, 0, 0]);
  K.mesh(K.shape('lg-fartail', [[-0.05, 0], [0.05, 0], [0.12, 0.3], [0, 0.48], [-0.12, 0.3]]), flight, [0, 0.02, -0.25], fb, [PI / 2, PI, 0]);

  K.place(root, home);
  root.rotation.y = opts.yaw ?? 0;

  // ---- the bone, the pieces it breaks into and the puff of dust (in the scene, not on the bird)
  const bone = boneBody(K, null, boneMat);
  K.place(bone);
  bone.visible = !night;
  const PIECES = [[0.12, 0.022, -0.1, 0.05, 0.5], [0.16, 0.026, 0.42, -0.12, 1.4], [0.2, 0.02, -0.45, -0.3, 2.4], [0.1, 0.03, 0.15, -0.45, 0.9],
    [0.08, 0.018, 0.7, 0.05, 2.0], [0.07, 0.016, -0.7, -0.1, 0.2]];          // [length, radius, along, out, turn]
  const pieces = PIECES.map(([len, r, x, z, ry]) => {
    const g = K.group();
    K.mesh(K.cyl(r, r * 0.9, len, 6), boneMat, [0, r * 0.8, 0], g, [PI / 2, 0, 0]);
    K.mesh(K.cone(r * 0.9, len * 0.45, 5), boneMat, [0, r * 0.8, -len * 0.7], g, [-PI / 2, 0, 0]);        // the splintered end
    if (len > 0.11) K.mesh(K.sphere(r * 1.25, 6, 5), boneMat, [0, r, len * 0.5], g, null, [1, 0.85, 1.1]);
    K.place(g);
    g.visible = false;
    return { g, x, z, ry, from: new THREE.Vector3(), to: new THREE.Vector3(), t: -1 };
  });
  const dustMat = K.keep(new THREE.MeshLambertMaterial({ color: night ? 0x6a5c52 : 0xd9c0a0, transparent: true, opacity: 0, depthWrite: false }));
  const dust = K.group();
  const PUFF = [[0, 0.2, 0, 0.6], [0.35, 0.15, 0.2, 0.45], [-0.3, 0.12, 0.25, 0.5], [0.1, 0.25, -0.35, 0.5], [-0.2, 0.3, -0.15, 0.4], [0.25, 0.35, -0.05, 0.35], [0, 0.45, 0.1, 0.4]];
  const puffs = PUFF.map(([x, y, z, r]) => K.mesh(K.sphere(1, 8, 6), dustMat, [x, y, z], dust, null, r));
  K.scene.add(dust);
  dust.visible = false;
  const top = opts.top ? opts.top.clone() : home.clone();
  dust.position.copy(top);
  const B = { ph: night ? 'none' : 'held', t: 0, from: new THREE.Vector3(), fall: 0, spin: new THREE.Vector3(1.7, 0.6, 2.3), dust: -1, gulp: -1 };

  // ---- the flight: circles about (cx, cz) at height y (the body's centre), drifting to new ones
  const out = (opts.out || new THREE.Vector3(1, 0, 0)).clone().setY(0).normalize();
  const along = new THREE.Vector3(-out.z, 0, out.x);
  const fly = { a: 0, r: 9, cx: 0, cz: 0, y: 0, ty: 0, rise: 6, tcx: 0, tcz: 0, tr: 9, spin: 1, v: 9, yr: 0, climb: 0 };
  const m = { ph: night ? 'roost' : 'patrol', t: 0, from: new THREE.Vector3(), lift: 0, picked: 0 };
  const W = { neck: 0, head: 0, gulp: 0 };                                  // the neck's and head's own pose on the rocks
  const centre = (k) => vA.copy(top).addScaledVector(out, k);

  const c = K.makeCreature({
    species: SPECIES.lammergeier, root, home, flyer: true, radius: 0.9, eye: new THREE.Vector3(0, UP + 0.2, 0.36),
    ground: K.groundY, speed: 0, roam: 0, fleeAt: 0, curiousAt: 0, shy: 1, rareChance: 0, poseLen: 5.5, yaw: root.rotation.y,
  });
  c.state = 'idle'; c.hold = 99;
  if (!night) {
    // the patrol: a slow circle out over the canyon beside the rocks, a little above the road
    centre(16);
    fly.cx = fly.tcx = vA.x; fly.cz = fly.tcz = vA.z; fly.y = fly.ty = top.y + 10 + UP; fly.r = fly.tr = 9;
    fly.a = Math.atan2(top.z - vA.z, top.x - vA.x) + 0.6;
    root.position.set(fly.cx + Math.cos(fly.a) * fly.r, fly.y - UP, fly.cz + Math.sin(fly.a) * fly.r);
    root.rotation.y = Math.atan2(-Math.sin(fly.a) * fly.spin, Math.cos(fly.a) * fly.spin);
  }
  c.air = !night;                                      // aloft (or busy eating): no pose
  if (night) c._posed = true;                          // asleep on its ledge: no pose at night
  const T = {};

  // into a circle from where it is now, flying the way it faces (so the path doesn't jump)
  const toCircle = (r, tcx, tcz, ty, rise) => {
    const p = root.position, h = root.rotation.y, hx = Math.sin(h), hz = Math.cos(h);
    vA.set(tcx - p.x, 0, tcz - p.z);
    fly.spin = hx * vA.z - hz * vA.x > 0 ? -1 : 1;
    fly.a = Math.atan2(-hx * fly.spin, hz * fly.spin);
    fly.r = r; fly.tr = r; fly.cx = p.x - Math.cos(fly.a) * r; fly.cz = p.z - Math.sin(fly.a) * r;
    fly.y = p.y + UP; fly.tcx = tcx; fly.tcz = tcz; fly.ty = ty; fly.rise = rise;
  };
  const circle = (dt) => {
    fly.cx = damp(fly.cx, fly.tcx, 0.5, dt); fly.cz = damp(fly.cz, fly.tcz, 0.5, dt);
    fly.r = damp(fly.r, fly.tr, 0.5, dt);
    fly.y += clamp(fly.ty - fly.y, -fly.rise * dt, fly.rise * dt);
    fly.a += dt * fly.spin * fly.v / Math.max(fly.r, 5);
    root.position.set(fly.cx + Math.cos(fly.a) * fly.r, fly.y - UP, fly.cz + Math.sin(fly.a) * fly.r);
  };
  const face = (dt, k = 4) => {
    vB.subVectors(root.position, vC);
    fly.climb = damp(fly.climb, vB.y / Math.max(dt, 1e-3), 2.5, dt);
    if (Math.hypot(vB.x, vB.z) > 1e-4) {
      const d = wrap(Math.atan2(vB.x, vB.z) - root.rotation.y) * Math.min(1, dt * k);
      root.rotation.y += d;
      fly.yr = damp(fly.yr, d / Math.max(dt, 1e-3), 2, dt);
    }
  };
  // the bone in its feet: under the body, along it
  const holdBone = () => {
    body.updateWorldMatrix(true, false);
    bone.position.set(0, -0.27, 0.02).applyMatrix4(body.matrixWorld);
    body.getWorldQuaternion(qA);
    bone.quaternion.copy(qA);
  };
  const letGo = () => {
    B.ph = 'fall'; B.t = 0; B.from.copy(bone.position);
    B.fall = Math.sqrt(2 * Math.max(1, B.from.y - top.y) / G);
  };

  c.step = (dt, env) => {
    c._env = env; c.t += dt; m.t += dt;
    const p = root.position;
    vC.copy(p);
    const ahead = opts.ahead ? opts.ahead(env) : Infinity;
    let carry = B.ph === 'held';
    switch (m.ph) {
      case 'patrol':
        circle(dt); face(dt, 3);
        if (ahead < CLIMB_AT) {                         // the van is coming: up along the cliff over the rocks
          centre(9);
          toCircle(fly.r, vA.x, vA.z, top.y + HIGH + UP, 6.5);
          fly.tr = 9;
          m.ph = 'climb'; m.t = 0;
        }
        break;
      case 'climb':
        circle(dt); face(dt, 3);
        if ((fly.y > top.y + HIGH + UP - 0.5 && ahead < DROP_AT) || ahead < DROP_LATE) {
          m.ph = 'runin'; m.t = 0; m.from.copy(p);
        }
        break;
      case 'runin': {
        // a straight glide in over the rocks; it lets go right above them
        vA.set(top.x - p.x, 0, top.z - p.z);
        const dist = vA.length();
        root.rotation.y += wrap(Math.atan2(vA.x, vA.z) - root.rotation.y) * Math.min(1, dt * 2.2);
        const sp = 10 * dt;
        p.x += Math.sin(root.rotation.y) * sp; p.z += Math.cos(root.rotation.y) * sp;
        fly.yr = damp(fly.yr, 0, 3, dt);
        if (dist < 1.2 || m.t > 6) {
          holdBone(); letGo(); carry = false;
          if (env.call) env.call(c, 'rare');
          centre(7);
          toCircle(7, vA.x, vA.z, top.y + 3.5 + UP, 8);
          fly.v = 10;
          m.ph = 'swoop'; m.t = 0;
        }
        break;
      }
      case 'swoop':
        // down in a tight spiral; once low and the bone has broken, in to land
        circle(dt); face(dt, 4);
        if (fly.y < top.y + 4.2 + UP && B.ph !== 'fall' && m.t > 2) {
          m.ph = 'land'; m.t = 0; m.from.copy(p); m.lift = root.rotation.y;
        }
        break;
      case 'land': {
        // the last glide in, wings braking, feet forward, onto the rocks
        const k = ease(m.t / 1.6), to = opts.land || top;
        p.lerpVectors(m.from, to, k);
        p.y += Math.sin(k * PI) * 0.6 * (1 - k);
        vA.subVectors(to, m.from);
        const want = k < 0.75 ? Math.atan2(vA.x, vA.z) : (opts.landYaw ?? root.rotation.y);
        root.rotation.y += wrap(want - root.rotation.y) * Math.min(1, dt * 5);
        fly.yr = 0; fly.climb = 0;
        if (m.t > 1.6) { p.copy(to); m.ph = 'pick'; m.t = 0; c.air = false; c.go('eat', 99); }
        break;
      }
      case 'pick':
        // pecks at the pieces, head down and up; the van close enough: it swallows one
        if ((m.t > 2 && ahead < SWALLOW_AT) || m.t > 8) { m.ph = 'swallow'; m.t = 0; B.gulp = 0; }
        break;
      case 'swallow':
        if (m.t > 1.4) { m.ph = 'perch'; m.t = 0; c.go('idle', 99); }
        break;
      case 'perch':
        if (c.state === 'rare' && c.t > c.hold) c.go('idle', 99);
        break;
      default: break;                                   // 'roost'
    }
    c.air = !(m.ph === 'perch' || m.ph === 'roost') || c.state === 'eat';
    if (night) c.air = false;

    // ---- the wings and the body
    const ph = m.ph, onRocks = ph === 'pick' || ph === 'swallow' || ph === 'perch' || ph === 'roost';
    const rare = c.state === 'rare' ? ease(c.t / 0.9) * ease((c.hold - c.t) / 0.9) : 0;
    if (onRocks) {
      Object.assign(T, { fold: 1 - rare, mantle: 0, amp: 0, rate: 0, dihedral: 0.03 * rare, sweep: -0.12 * rare, pitch: -0.5 - 0.15 * rare, bank: 0, legs: 0, fan: 1 + 0.5 * rare, tailUp: 0 });
      if (ph === 'pick') T.pitch = -0.12;
    } else if (ph === 'land') {
      Object.assign(T, { fold: 0, mantle: 0, amp: 0.6, rate: 6, dihedral: 0.15, sweep: -0.3, pitch: -0.7, bank: 0, legs: -0.4, fan: 1.6, tailUp: 0.3 });
    } else {
      const burst = ph === 'climb' ? Math.sin(env.t * 0.9 + c.bob) > 0.55 : Math.sin(env.t * 0.33 + c.bob) > 0.8;
      Object.assign(T, { fold: 0, mantle: 0, amp: burst ? 0.3 : 0.02, rate: burst ? 3.4 : 1, dihedral: 0.06, sweep: ph === 'swoop' ? 0.35 : 0.12,
        pitch: clamp(-fly.climb * 0.04, -0.3, 0.35), bank: clamp(-fly.yr * 1.5, -0.65, 0.65), legs: carry ? 0.55 : 1.3, fan: ph === 'swoop' ? 0.8 : 0.95, tailUp: 0 });
    }
    birdPose(R, dt, T, onRocks ? 2.5 : 3.5);
    // the neck and the head: pecking, the gulp, raised high in the pose, drawn in aloft
    let wn = 0.2, wh = 0;
    if (ph === 'pick') {
      const peck = Math.max(0, Math.sin(m.t * 3.1));
      wn = 0.75 + 0.5 * peck; wh = 0.5 + 0.35 * peck;
    } else if (ph === 'swallow') {
      const k = m.t / 1.4;
      wn = 0.9 * (1 - ease(k / 0.3)) - 0.45 * ease((k - 0.3) / 0.25) * (1 - ease((k - 0.8) / 0.2));
      wh = 0.5 * (1 - ease(k / 0.3)) - 0.6 * ease((k - 0.3) / 0.25) * (1 - ease((k - 0.8) / 0.2));
      W.gulp = Math.sin(clamp((k - 0.45) / 0.4, 0, 1) * PI);
    } else if (onRocks) {
      wn = -0.15 - 0.3 * rare; wh = -0.35 * rare;
    } else wn = 0.35;
    W.neck = damp(W.neck, wn, 6, dt); W.head = damp(W.head, wh, 6, dt);
    neck.rotation.x = W.neck - R.body.rotation.x * 0.4;
    neck.scale.set(1 + 0.25 * W.gulp, 1, 1 + 0.25 * W.gulp);
    if (ph === 'perch' || ph === 'roost') {
      K.look(c, head, env, dt, { yaw: 1.2, pitch: 0.45, rate: 2.5, force: rare === 0 && c.near < 60 });
      if (rare) head.rotation.x = damp(head.rotation.x, W.head, 4, dt);
    } else {
      head.rotation.y = damp(head.rotation.y, 0, 4, dt);
      head.rotation.x = W.head;
    }
    K.blink(c, [eyes], dt);
    const breathe = 1 + Math.sin(env.t * 1.3 + c.bob) * 0.015;
    body.scale.set(breathe, breathe, 1);
    const grounded = onRocks || (ph === 'land' && m.t > 0.9);
    for (let i = 0; i < 2; i++) { legs[i].rotation.x = grounded ? 0 : R.P.legs; legs[i].visible = grounded || carry; }
    shade.visible = grounded;
    lum.emissiveIntensity = lumBase * (0.88 + 0.12 * Math.sin(env.t * 0.9 + c.bob));
    fb.rotation.x = R.body.rotation.x; fb.rotation.z = R.body.rotation.z;
    fw.scale.x = 0.25 + 0.75 * (1 - R.P.fold);
    fw.rotation.z = Math.sin(R.P.phase) * R.P.amp * 0.5;
    root.updateMatrixWorld();

    // ---- the bone: held, falling, broken
    if (B.ph === 'held') holdBone();
    else if (B.ph === 'fall') {
      B.t += dt;
      const k = Math.min(1, B.t / B.fall);
      bone.position.set(B.from.x + (top.x - B.from.x) * k, Math.max(top.y + 0.04, B.from.y - 0.5 * G * B.t * B.t), B.from.z + (top.z - B.from.z) * k);
      bone.rotation.x += B.spin.x * dt; bone.rotation.y += B.spin.y * dt; bone.rotation.z += B.spin.z * dt;
      if (k >= 1) {                                       // it hits the rocks: pieces fly a little, a puff of dust
        B.ph = 'broken'; bone.visible = false; B.dust = 0;
        dust.visible = true;
        for (const q of pieces) {
          q.g.visible = true; q.t = 0;
          q.from.copy(top);
          q.to.copy(top).addScaledVector(along, q.x).addScaledVector(out, q.z);
          q.g.rotation.set(0, q.ry, 0);
        }
        if (env.call) env.call(c, 'idle');
      }
    }
    for (const q of pieces) {
      if (q.t < 0 || q.t >= 1) continue;
      q.t = Math.min(1, q.t + dt / 0.45);
      q.g.position.lerpVectors(q.from, q.to, ease(q.t));
      q.g.position.y = top.y + Math.sin(q.t * PI) * (0.18 + 0.1 * Math.abs(q.x));
      q.g.rotation.x = (1 - q.t) * 2.2 * q.x;
    }
    if (B.dust >= 0 && B.dust < 1) {
      B.dust = Math.min(1, B.dust + dt / 1.8);
      const s = 0.35 + 1.1 * ease(Math.min(1, B.dust * 1.6));
      dust.scale.set(s, 0.6 + 0.8 * B.dust, s);
      dustMat.opacity = 0.55 * (1 - ease(B.dust));
      for (let i = 0; i < puffs.length; i++) puffs[i].position.y = PUFF[i][1] + B.dust * 0.35 * (1 + i * 0.1);
      if (B.dust >= 1) dust.visible = false;
    }
    if (B.gulp >= 0) {                                    // the swallow: the first piece goes to the bill, then down
      B.gulp += dt / 1.4;
      const q = pieces[0];
      if (B.gulp < 0.3) {
        head.updateWorldMatrix(true, false);
        vA.set(0, -0.03, 0.18).applyMatrix4(head.matrixWorld);
        q.g.position.lerp(vA, Math.min(1, dt * 12));
      } else if (B.gulp < 0.45) {
        head.updateWorldMatrix(true, false);
        q.g.position.set(0, -0.03, 0.17).applyMatrix4(head.matrixWorld);
      } else q.g.visible = false;
      if (B.gulp >= 1) B.gulp = -1;
    }
  };
  c.phase = () => ({ bird: m.ph, bone: B.ph, at: bone.position, top });   // tests: where the set piece is
  return K.lod(c, near, far, 42);
}

export const BUILDERS = {
  lammergeier: buildLammergeier,
};
