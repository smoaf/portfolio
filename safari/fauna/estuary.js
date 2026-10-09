// The estuary: a wide brackish jungle river near its mouth, mangroves with their feet in the water,
// mudflats and sandbanks. Seven species that live on the water, in it and above it. Swimmers keep to
// the water surface (K.waterY, or y = 0 when the route has none); feed pellets float there and the
// swimmers come up to take them.
import * as THREE from 'three';

export const SPECIES = {
  heron: { id: 'heron', name: 'Grey-blue heron', points: 150, call: { hz: 320, kind: 'noise' } },
  frigatebird: { id: 'frigatebird', name: 'Frigatebird', points: 190, call: { hz: 260, kind: 'trill' } },
  mudskipper: { id: 'mudskipper', name: 'Mudskipper colony', points: 140, call: { hz: 1500, kind: 'chirp' } },
  'fiddler-crab': { id: 'fiddler-crab', name: 'Fiddler crabs', points: 130, call: { hz: 2300, kind: 'chirp' } },
  crocodile: { id: 'crocodile', name: 'Estuarine crocodile', points: 210, call: { hz: 85, kind: 'hoot' } },
  'river-dolphin': { id: 'river-dolphin', name: 'Pink river dolphin', points: 230, call: { hz: 1900, kind: 'trill' } },
  archerfish: { id: 'archerfish', name: 'Archerfish', points: 170, call: { hz: 1300, kind: 'noise' } },
};

// ---- small shared helpers (scratch vectors are reused, never allocated per frame)
const PI = Math.PI, DS = THREE.DoubleSide;
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), vD = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const damp = (a, b, k, dt) => a + (b - a) * Math.min(1, k * dt);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ss = (e0, e1, x) => { const u = clamp01((x - e0) / (e1 - e0)); return u * u * (3 - 2 * u); };
const bump = (x) => (x <= 0 || x >= 1 ? 0 : Math.sin(PI * x));
const surfAt = (K, x, z, fb = 0) => (K.waterY ? K.waterY(x, z) : fb);
let uid = 0;
const TEST = typeof location !== 'undefined' && location.search.includes('estest');   // DEVTEST

// a feather, leaf or fin blade from its base (0,0) to its tip (0,L) in the XY plane
const bladePts = (L, W) => [[0, 0], [W * 0.5, L * 0.12], [W * 0.55, L * 0.55], [W * 0.32, L * 0.88], [0, L], [-W * 0.32, L * 0.88], [-W * 0.55, L * 0.55], [-W * 0.5, L * 0.12]];
const blade = (K, L, W) => K.shape(`blade${L},${W}`, bladePts(L, W));

// a rod (limb, stalk, finger) from a to b; r1 < r0 tapers it, r1 ~ 0 makes a spike
function rod(K, parent, mat, a, b, r0, r1 = r0, rs = 6) {
  vC.set(a[0], a[1], a[2]); vD.set(b[0], b[1], b[2]);
  const L = Math.max(0.01, Math.round(vC.distanceTo(vD) * 100) / 100);
  const m = K.mesh(K.cyl(r1, r0, L, rs), mat, null, parent);
  m.position.copy(vC).add(vD).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, vD.sub(vC).normalize());
  return m;
}

// Both eyes in ONE group (so the pair bakes into a handful of draw calls and blinks together).
// pos is the right eye ([x, y, z]); the left one is mirrored. plain: the iris is the whole ball.
function eyePair(K, parent, { pos, r, iris = 0x6a4a2a, dir = [1, 0, 0.3], glow = 0, slit = false, plain = false }) {
  const g = K.group([0, pos[1], pos[2]], parent);
  const ball = K.sheen(0x0c0a09, { roughness: 0.12 });
  const irisM = glow ? K.glow(iris, glow, { roughness: 0.15 }) : K.sheen(iris, { roughness: 0.15 });
  const pupil = K.sheen(0x040404, { roughness: 0.1 });
  const shine = K.mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9 });
  for (const s of [-1, 1]) {
    const e = new THREE.Group();
    e.position.set(s * pos[0], 0, 0);
    e.lookAt(vA.set(s * dir[0], dir[1], dir[2]).normalize().add(e.position));
    if (!plain) K.mesh(K.sphere(1, 12, 9), ball, [0, 0, 0], e, null, r);
    K.mesh(K.sphere(1, 12, 8), irisM, [0, 0, plain ? 0 : r * 0.52], e, null, plain ? r : [r * 0.72, r * 0.72, r * 0.5]);
    K.mesh(K.sphere(1, 8, 6), pupil, [0, 0, plain ? r * 0.76 : r * 0.82], e, null, slit ? [r * 0.14, r * 0.62, r * 0.3] : [r * 0.42, r * 0.42, r * 0.3]);
    K.mesh(K.sphere(1, 6, 5), shine, [-r * 0.3, r * 0.36, r * 0.93], e, null, r * 0.17);
    e.updateMatrix();
    for (const m of [...e.children]) { m.applyMatrix4(e.matrix); g.add(m); }
  }
  return g;
}

// a burst of spray on the water (white droplets): one baked mesh, the pose scales it
function splash(K, parent, size = 1) {
  const g = K.group([0, 0, 0], parent);
  const m = K.fin(0xeaf6f8, 0.75, 0.5);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * PI * 2, r = 0.55 * size;
    K.mesh(K.sphere(1, 6, 5), m, [Math.cos(a) * r, 0.2 * size + (i % 3) * 0.12 * size, Math.sin(a) * r], g, null, 0.05 * size);
    K.mesh(K.sphere(1, 5, 4), m, [Math.cos(a + 0.3) * r * 0.7, 0.45 * size + (i % 2) * 0.2 * size, Math.sin(a + 0.3) * r * 0.7], g, null, 0.035 * size);
    rod(K, g, m, [Math.cos(a) * r * 0.6, 0, Math.sin(a) * r * 0.6], [Math.cos(a) * r * 0.95, 0.3 * size * (1 + (i % 2) * 0.5), Math.sin(a) * r * 0.95], 0.03 * size, 0.004, 4);
  }
  K.mesh(K.torus(0.6 * size, 0.06 * size, 4, 18), m, [0, 0.02, 0], g, [PI / 2, 0, 0]);
  g.scale.setScalar(0.01); g.visible = false;
  return g;
}
// a splash's life: k 0..1 in, then it opens up and sinks away
function splashPose(g, k) {
  g.visible = k > 0.01 && k < 0.99;
  const s = 0.2 + 1.2 * Math.sqrt(k);
  g.scale.set(s, Math.max(0.01, bump(k) * 1.2), s);
}

// ================================================================================================
// HERON: a tall grey wader in the shallows. S-neck, dagger bill, slow stalking walk, spear strikes.
// Flee: takes off on slow deep wing beats and lands further off. Rare: catches a fish and swallows.
export function buildHeron(K, home, opts = {}) {
  const root = new THREE.Group(), near = K.group(null, root), far = K.group(null, root);
  const grey = K.mat(0x7c8693, { roughness: 0.85 }), greyF = K.mat(0x8a94a0, { roughness: 0.85, side: DS });
  const slate = K.mat(0x3c424c, { roughness: 0.8, side: DS }), buff = K.mat(0xc7ab88, { roughness: 0.85 });
  const white = K.mat(0xebe8e0, { roughness: 0.8 }), black = K.mat(0x17191e, { roughness: 0.6 });
  const beakM = K.sheen(0xd8a544, { roughness: 0.35 }), legM = K.mat(0x7a6d4f, { roughness: 0.7 });
  const glow = K.glow(0x7fe6ff, 1.5), fishM = K.sheen(0xc6d2d6, { metalness: 0.45 });

  const B = K.group([0, 0, 0], near);                         // bob + flight pitch
  const T = K.group([0, 0.8, 0], B);                          // the torso, tilted chest-up when standing
  K.mesh(K.sphere(1, 12, 9), grey, [0, 0, 0], T, null, [0.13, 0.14, 0.3]);
  K.mesh(K.sphere(1, 10, 8), white, [0, -0.03, 0.17], T, null, [0.1, 0.11, 0.13]);     // pale breast
  // long breast plumes hanging from the lower neck, and back plumes over the tail
  for (let i = 0; i < 6; i++) {
    const x = (i - 2.5) * 0.022;
    const L = 0.2 + (i % 3) * 0.04;
    rod(K, T, i % 2 ? white : buff, [x, 0.03, 0.25], [x * 1.4, 0.03 - L * 0.85, 0.25 - L * 0.5], 0.011, 0.0015, 4);
  }
  for (let i = 0; i < 5; i++) rod(K, T, greyF, [(i - 2) * 0.03, 0.1, -0.02], [(i - 2) * 0.05, 0.02, -0.42 - (i % 2) * 0.05], 0.014, 0.002, 4);
  // the folded wing: layered rows of feathers down each side, dark flight feathers at the back
  const sideFeather = (mat, L, W, p, s, droop) => K.mesh(blade(K, L, W), mat, [s * p[0], p[1], p[2]], T, [0, s * PI / 2, -s * (PI / 2 + droop)]);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) sideFeather(slate, 0.34, 0.07, [0.128 + i * 0.002, 0.04 - i * 0.012, -0.06 - i * 0.02], s, 0.14 + i * 0.05);
    for (let i = 0; i < 5; i++) sideFeather(greyF, 0.24, 0.085, [0.134 + i * 0.002, 0.07 - i * 0.022, 0.1 - i * 0.025], s, 0.22 + i * 0.03);
    for (let i = 0; i < 4; i++) sideFeather(greyF, 0.13, 0.08, [0.138, 0.085 - i * 0.025, 0.17 - i * 0.01], s, 0.35);
    K.mesh(K.sphere(1, 8, 6), black, [s * 0.108, 0.06, 0.15], T, null, [0.015, 0.035, 0.04]);   // black shoulder patch
  }
  // the neck: two links in an S, then the head (which has its own look group)
  const N1 = K.group([0, 0.07, 0.24], T);
  K.mesh(K.capsule(0.05, 0.17, 3, 8), buff, [0, 0.1, 0], N1);
  K.mesh(K.capsule(0.024, 0.15, 3, 6), white, [0, 0.1, 0.034], N1);
  const N2 = K.group([0, 0.21, 0], N1);
  K.mesh(K.sphere(1, 10, 8), buff, [0, 0, 0], N2, null, 0.047);
  K.mesh(K.capsule(0.04, 0.16, 3, 8), buff, [0, 0.1, 0], N2);
  K.mesh(K.capsule(0.018, 0.15, 3, 6), white, [0, 0.1, 0.028], N2);
  const H = K.group([0, 0.2, 0], N2), HL = K.group(null, H);
  K.mesh(K.sphere(1, 10, 8), white, [0, -0.03, -0.01], H, null, 0.04);
  K.mesh(K.sphere(1, 10, 8), white, [0, 0, 0.005], HL, null, [0.042, 0.045, 0.06]);
  for (const s of [-1, 1]) K.mesh(K.sphere(1, 8, 6), black, [s * 0.026, 0.024, -0.012], HL, null, [0.016, 0.016, 0.058]);   // black brow stripes
  rod(K, HL, black, [0, 0.03, -0.04], [0, 0.0, -0.21], 0.008, 0.002, 4);                         // head plume
  rod(K, HL, glow, [0.004, 0.035, -0.03], [0.006, 0.012, -0.17], 0.004, 0.0015, 4);
  rod(K, HL, beakM, [0, 0.004, 0.035], [0, -0.004, 0.22], 0.019, 0.002, 6);
  rod(K, HL, beakM, [0, -0.012, 0.035], [0, -0.008, 0.2], 0.014, 0.002, 5);
  const eyes = eyePair(K, HL, { pos: [0.031, 0.012, 0.035], r: 0.011, iris: 0xf0c419, dir: [1, 0.05, 0.3], plain: true, glow: 0.5 });
  const FG = K.group([0, -0.006, 0.15], HL);                  // the caught fish, crosswise in the bill
  K.mesh(K.sphere(1, 8, 6), fishM, [0, 0, 0], FG, null, [0.09, 0.025, 0.018]);
  K.mesh(K.cone(0.03, 0.05, 4), fishM, [-0.11, 0, 0], FG, [0, 0, PI / 2], [1, 1, 0.3]);
  FG.scale.setScalar(0.01); FG.visible = false;
  // legs: thigh at the hip, a joint, the long lower leg and the toes
  const legs = [-1, 1].map((s) => {
    const L = K.group([s * 0.055, 0.6, -0.02], B);
    K.mesh(K.sphere(1, 8, 6), grey, [0, 0.0, 0], L, null, [0.028, 0.05, 0.035]);
    rod(K, L, legM, [0, 0, 0], [0, -0.27, 0], 0.017, 0.014, 6);
    const kn = K.group([0, -0.27, 0], L);
    rod(K, kn, legM, [0, 0, 0], [0, -0.31, 0], 0.014, 0.012, 6);
    for (const a of [-0.45, 0, 0.45]) rod(K, kn, legM, [0, -0.31, 0], [Math.sin(a) * 0.1, -0.325, Math.cos(a) * 0.1], 0.008, 0.004, 4);
    rod(K, kn, legM, [0, -0.31, 0], [0, -0.32, -0.06], 0.007, 0.003, 4);
    return { L, kn };
  });
  // flight wings: arm + hand, flat in the XZ plane, folded away (hidden) on the ground
  const wings = [-1, 1].map((s) => {
    const W = K.group([s * 0.1, 0.07, 0.1], T); W.rotation.order = 'YXZ';
    const A = K.group(null, W), Hd = K.group([s * 0.46, 0, 0], A);
    rod(K, A, greyF, [0, 0, 0.02], [s * 0.47, 0, 0.0], 0.03, 0.022, 6);
    for (let i = 0; i < 7; i++) K.mesh(blade(K, 0.27, 0.085), slate, [s * (0.05 + i * 0.065), -0.004, 0.0], A, [-PI / 2, 0, -s * 0.08]);
    for (let i = 0; i < 7; i++) K.mesh(blade(K, 0.15, 0.09), greyF, [s * (0.04 + i * 0.065), 0.008, 0.02], A, [-PI / 2, 0, -s * 0.1]);
    for (let i = 0; i < 6; i++) K.mesh(blade(K, 0.3 + i * 0.03, 0.075), slate, [s * (0.02 + i * 0.02), -0.002, 0.01], Hd, [-PI / 2, 0, -s * (0.35 + i * 0.17)]);
    W.visible = false; W.scale.setScalar(0.02);
    return { W, A, Hd, s };
  });
  // far body
  K.mesh(K.sphere(1, 8, 6), grey, [0, 0.8, -0.02], far, [-0.5, 0, 0], [0.14, 0.15, 0.32]);
  K.mesh(K.tube('heronFarNeck', [[0, 0.92, 0.2], [0, 1.06, 0.3], [0, 1.18, 0.24], [0, 1.27, 0.3]], 0.045, 0.035, 5, 6), buff, null, far);
  K.mesh(K.cone(0.03, 0.26, 5), beakM, [0, 1.28, 0.42], far, [PI / 2, 0, 0]);
  K.mesh(K.cyl(0.015, 0.015, 0.62, 4), legM, [0.05, 0.31, -0.02], far);
  K.mesh(K.cyl(0.015, 0.015, 0.62, 4), legM, [-0.05, 0.31, -0.02], far);
  K.place(root, home);

  const st = { lift: 0, w: 0, fp: 0, g: 0, px: home.x, pz: home.z, sk: 9, from: new THREE.Vector3(), a1: 0.45, a2: -0.35, hp: 0, tilt: -0.55, fish: 0 };
  const fishOn = (k) => { st.fish = k; FG.visible = k > 0.02; FG.scale.setScalar(Math.max(0.01, k)); };
  const c = K.makeCreature({
    species: SPECIES.heron, root, home, radius: 0.75, eye: new THREE.Vector3(0, 1.36, 0.3),
    ground: K.groundY, speed: 0.5, roam: 8, fleeAt: 9, curiousAt: 26, shy: 0.65, rareChance: 0.55, rareAt: opts.rareAt ?? 'dawn',
    onState(c, s) {
      if (s === 'flee') {
        vA.copy(c.target || c.root.position).sub(c.root.position).setY(0);
        if (vA.lengthSq() < 0.01) vA.set(Math.random() - 0.5, 0, Math.random() - 0.5);
        c.target = c.root.position.clone().addScaledVector(vA.normalize(), 15 + Math.random() * 8);
        st.from.copy(c.root.position);
        c.speed = 2.6; c.hold = 5.2;
      } else c.speed = 0.5;
      if (s === 'rare') c.hold = 6;
    },
    pose(c, dt, env) {
      const t = env.t, P = c.root.position;
      // moving speed, from what the state machine did this frame
      const spd = Math.hypot(P.x - st.px, P.z - st.pz) / Math.max(dt, 1e-4);
      st.px = P.x; st.pz = P.z;
      // flight: rises off the water in an arc between the take-off and the landing spot
      let h = 0, fly = 0;
      if (c.state === 'flee' && c.target) {
        const dA = Math.hypot(P.x - st.from.x, P.z - st.from.z), dB = Math.hypot(P.x - c.target.x, P.z - c.target.z);
        h = Math.min(3.4, 0.5 * Math.min(dA + 0.2, dB));
        fly = dB > 0.4 ? 1 : 0;
      }
      st.lift = damp(st.lift, h, 3, dt);
      st.w = damp(st.w, fly, fly ? 5 : 2.5, dt);
      P.y = K.groundY(P.x, P.z) + st.lift;
      const air = st.w;
      // wing beats: slow and deep
      st.fp += dt * PI * 2 * 1.5;
      const flap = Math.sin(st.fp);
      for (const w of wings) {
        w.W.visible = air > 0.03;
        w.W.scale.setScalar(0.02 + 0.98 * air);
        w.W.rotation.set(0.05, w.s * (1 - air) * 1.3, w.s * (flap * 0.8 + 0.1) * air);
        w.Hd.rotation.z = w.s * Math.sin(st.fp - 0.7) * 0.45 * air;
      }
      // the strike: a coil, a stab down at the water, a hold, back up
      if (st.sk > 1.3) {
        const fishing = c.state === 'idle' && ((t * 0.13 + c.bob) % 1) < 0.006;
        const pel = c.state === 'eat' && c.pellet && c.pellet.pos.distanceTo(P) < 1.5;
        if (fishing || pel || (c.state === 'rare' && c.t < 0.1)) st.sk = 0;
      }
      st.sk += dt;
      // where the neck wants to be (angles in the world, a1 lower link, a2 upper link, hp the bill)
      let a1 = 0.45, a2 = -0.35, hp = 0, tilt = -0.55, rate = 4;
      const moving = spd > 0.08 && st.lift < 0.1;
      if (moving) { a1 = 0.95; a2 = 0.35; hp = 0.3; tilt = -0.35; }                  // stalking: neck out, peering down
      if (c.state === 'curious') { a1 = 0.3; a2 = -0.25; hp = 0; }
      const k = st.sk;
      if (k < 1.3) {
        if (k < 0.35) { a1 = 0.15; a2 = -0.9; hp = 0.5; tilt = -0.3; rate = 6; }         // coil
        else if (k < 0.8) { a1 = 1.65; a2 = 1.75; hp = 1.35; tilt = 0.1; rate = 28; }    // stab
        else { rate = 5; }
      }
      if (c.state === 'rare') {                                       // the catch: fish in the bill, toss, swallow
        const r = c.t;
        if (r > 0.6 && r < 0.75 && st.fish < 0.5) fishOn(1);
        if (r > 1.3 && r < 2.6) { a1 = 0.4; a2 = -0.3; hp = 0.1 + Math.sin(r * 14) * 0.08; FG.rotation.z = Math.sin(r * 22) * 0.4; }
        if (r >= 2.6 && r < 3.6) { a1 = 0.2; a2 = -0.6; hp = -1.05; FG.rotation.y = damp(FG.rotation.y, PI / 2, 6, dt); FG.position.z = damp(FG.position.z, 0.06, 3, dt); }
        if (r >= 3.6 && r < 4.4) { a1 = 0.25; a2 = -0.5; hp = -0.9; fishOn(Math.max(0, st.fish - dt * 1.6)); FG.position.z = damp(FG.position.z, -0.02, 3, dt); }
        if (r >= 4.4) { fishOn(0); H.rotation.z = Math.sin(r * 18) * 0.15 * Math.max(0, 5.2 - r); }
      } else if (st.fish > 0) { fishOn(0); }
      if (c.state !== 'rare' || c.t < 0.1) { FG.rotation.set(0, 0, 0); FG.position.z = 0.15; H.rotation.z = damp(H.rotation.z, 0, 4, dt); }
      if (air > 0.05) { a1 = -0.25; a2 = 1.7; hp = 0; tilt = 0.05; rate = 4; }         // flight: neck tucked into an S
      st.a1 = damp(st.a1, a1, rate, dt); st.a2 = damp(st.a2, a2, rate, dt); st.hp = damp(st.hp, hp, rate, dt);
      st.tilt = damp(st.tilt, tilt, 3, dt);
      T.rotation.x = st.tilt;
      N1.rotation.x = st.a1 - st.tilt;
      N2.rotation.x = st.a2 - st.a1;
      H.rotation.x = st.hp - st.a2;
      // breathing, blinking, a look at the van when the bill is not busy
      T.scale.set(1, 1 + Math.sin(t * 1.4 + c.bob) * 0.012, 1);
      K.blink(c, [eyes], dt);
      if (k > 1.3 && c.state !== 'rare' && air < 0.1) K.look(c, HL, env, dt, { yaw: 1.0, pitch: 0.35 });
      else { HL.rotation.y = damp(HL.rotation.y, 0, 6, dt); HL.rotation.x = damp(HL.rotation.x, 0, 6, dt); }
      // legs: a high, slow step on the ground; trailed behind in the air
      if (moving) st.g += dt * spd * 5.5;
      for (let i = 0; i < 2; i++) {
        const ph = st.g + i * PI;
        let up = moving ? -Math.sin(ph) * 0.38 : 0, kn = moving ? Math.max(0, Math.cos(ph)) * 1.1 : 0;
        if (air > 0.05) { up = 1.35 * air; kn = 0.1; }
        legs[i].L.rotation.x = damp(legs[i].L.rotation.x, up, 8, dt);
        legs[i].kn.rotation.x = damp(legs[i].kn.rotation.x, kn, 8, dt);
      }
      B.position.y = moving ? -Math.abs(Math.sin(st.g)) * 0.02 : 0;
    },
  });
  return K.lod(c, near, far, 45);
}

// ================================================================================================
// FRIGATEBIRD: comes in from the sea and soars in wide circles at 15-30 m on long angular wings,
// forked tail scissoring. Rare: the red throat pouch blows up into a glowing balloon, then a swoop
// down to snatch something off the water. Pellets on the water bring the same swoop.
function frigateBody(K, parent, lite) {
  const black = K.mat(0x121318, { roughness: 0.5, metalness: 0.15 }), feath = K.mat(0x15161b, { roughness: 0.55, metalness: 0.1, side: DS });
  const beakM = K.sheen(0x8c929a, { roughness: 0.3 }), glow = K.glow(0x5fd0ff, 1.8);
  const pouchM = K.glow(0xe0241b, 1.15, { roughness: 0.28 });
  const B = K.group(null, parent);
  K.mesh(K.sphere(1, 12, 9), black, [0, 0, 0], B, null, [0.09, 0.085, 0.36]);
  const HD = K.group([0, 0.035, 0.34], B);
  K.mesh(K.sphere(1, 10, 8), black, [0, 0, 0.02], HD, null, [0.048, 0.05, 0.065]);
  rod(K, HD, beakM, [0, -0.005, 0.06], [0, -0.012, 0.3], 0.013, 0.009, 6);
  rod(K, HD, beakM, [0, -0.012, 0.29], [0, -0.05, 0.31], 0.01, 0.002, 5);       // the hook
  const eyes = lite ? null : eyePair(K, HD, { pos: [0.034, 0.012, 0.04], r: 0.012, iris: 0x2a1c16, dir: [1, 0.1, 0.4] });
  const PG = K.group([0, -0.02, 0.36], B);                                       // the throat pouch
  K.mesh(K.sphere(1, 12, 9), pouchM, [0, -0.11, 0.05], PG, null, [0.13, 0.13, 0.14]);
  if (!lite) for (let i = 0; i < 7; i++) {
    const a = (i / 7) * 1.6 - 0.8;
    K.mesh(K.cone(0.008, 0.04, 4), black, [Math.sin(a) * 0.11, -0.04 - (i % 3) * 0.02, 0.0 + Math.cos(a) * 0.03], PG, [0.9, 0, a]);
  }
  PG.scale.setScalar(0.22);
  const tails = [-1, 1].map((s) => {
    const g = K.group([s * 0.012, 0.01, -0.3], B);
    K.mesh(blade(K, 0.55, 0.075), feath, [0, 0, 0], g, [-PI / 2, 0, s * 0.04]);
    return g;
  });
  const wings = [-1, 1].map((s) => {
    const A = K.group([s * 0.06, 0.03, 0.08], B); A.rotation.order = 'YXZ';
    const Hd = K.group([s * 0.5, 0, 0], A); Hd.rotation.order = 'YXZ';
    rod(K, A, feath, [0, 0, 0.02], [s * 0.52, 0, 0.0], 0.03, 0.022, 5);
    for (let i = 0; i < (lite ? 4 : 8); i++) K.mesh(blade(K, 0.28, lite ? 0.15 : 0.085), feath, [s * (0.03 + i * (lite ? 0.12 : 0.062)), -0.003, 0.0], A, [-PI / 2, 0, -s * 0.06]);
    if (!lite) for (let i = 0; i < 7; i++) K.mesh(blade(K, 0.14, 0.09), feath, [s * (0.03 + i * 0.07), 0.008, 0.02], A, [-PI / 2, 0, -s * 0.1]);
    rod(K, Hd, feath, [0, 0, 0.01], [s * 0.36, 0, -0.04], 0.022, 0.012, 5);
    for (let i = 0; i < (lite ? 4 : 7); i++) {
      const n = lite ? 4 : 7;
      K.mesh(blade(K, 0.62 - i * 0.04, lite ? 0.12 : 0.07), feath, [s * (0.02 + i * 0.04), -0.002, 0.0], Hd, [-PI / 2, 0, -s * (1.45 - (i / (n - 1)) * 0.95)]);
    }
    if (!lite) rod(K, Hd, glow, [0, 0.012, 0.02], [s * 0.6, 0.005, -0.08], 0.006, 0.003, 4);   // the twist: a lit leading edge
    return { A, Hd, s };
  });
  return { B, HD, PG, tails, wings, eyes };
}
function frigateWings(b, k, t, tuck) {
  // k: flap amount 0..1; tuck: swept back for a dive
  const flap = Math.sin(t * 5.2) * 0.55 * k, flex = Math.sin(t * 0.9) * 0.04;
  for (const w of b.wings) {
    w.A.rotation.set(0, w.s * (-0.2 + tuck * 0.55), w.s * (0.16 + flap + flex - tuck * 0.15));
    w.Hd.rotation.set(0, w.s * (0.55 + tuck * 0.6), w.s * (-0.3 + Math.sin(t * 5.2 - 0.8) * 0.35 * k - tuck * 0.2));
  }
}

export function buildFrigatebird(K, home, opts = {}) {
  const root = new THREE.Group(), near = K.group(null, root), far = K.group(null, root);
  const S = opts.scale ?? 1.25;                                // a touch big, so it reads at 20 m up
  near.scale.setScalar(S); far.scale.setScalar(S);
  const b = frigateBody(K, near, false);
  // far: body, one M-shaped wing outline, the pouch
  const fb = K.mat(0x121318, { roughness: 0.5, side: DS });
  K.mesh(K.sphere(1, 8, 6), fb, [0, 0, 0], far, null, [0.09, 0.09, 0.42]);
  const wingOutline = [[0, -0.12], [-0.55, -0.16], [-1.25, 0.35], [-0.5, 0.05], [-0.1, 0.12], [0, 0.75], [0.1, 0.12], [0.5, 0.05], [1.25, 0.35], [0.55, -0.16]];
  K.mesh(K.shape('frigateFar', wingOutline), fb, [0, 0.02, 0.08], far, [-PI / 2, 0, 0]);
  K.mesh(K.sphere(1, 6, 5), K.glow(0xe0241b, 1.15, { roughness: 0.28 }), [0, -0.06, 0.38], far, null, 0.05);
  K.place(root, home);
  root.rotation.order = 'YXZ';

  const base = surfAt(K, home.x, home.z, home.y);
  const st = {
    a: Math.random() * PI * 2, cx: home.x, cz: home.z, R: opts.r ?? 22, alt: opts.alt ?? 20, sw: -1, swT: new THREE.Vector3(),
    prev: new THREE.Vector3(), yaw: 0, bank: 0, pitch: 0, flapK: 0, tuck: 0, pouch: 0.22, snatched: false, init: false,
  };
  const R0 = st.R, ALT0 = st.alt;
  const c = K.makeCreature({
    species: SPECIES.frigatebird, root, home, radius: 1.2 * S, eye: new THREE.Vector3(0, 0.04 * S, 0.4 * S), flyer: true,
    speed: 9, roam: 30, fleeAt: 10, curiousAt: 40, shy: 0.4, rareChance: 0.6, rareAt: opts.rareAt ?? 'dusk',
    onState(c, s) { if (s === 'rare') c.hold = 10; if (s === 'eat') c.hold = 9; },
  });
  const startSwoop = (p) => { st.sw = 0; st.snatched = false; st.swT.copy(p); };
  c.step = (dt, env) => {
    c.t += dt;
    const t = env.t, P = root.position;
    // decide: the van is too close, there is feed on the water, the van is interesting, or showing off
    if (c.state !== 'flee' && c.state !== 'rare' && c.state !== 'eat' && env.dist < c.fleeAt) c.go('flee', 6);
    if (c.state === 'idle' || c.state === 'wander') {
      const p = env.pellets.find((q) => q.landed && !q.eaten && Math.hypot(q.pos.x - st.cx, q.pos.z - st.cz) < 50);
      if (p) { c.pellet = p; c.go('eat', 9); startSwoop(p.pos); }
      else if (env.dist < c.curiousAt && Math.random() < dt * 0.12) c.go('curious', 9);
      else if (c.rareAt === env.tod && Math.random() < dt * 0.03) c.go('rare', 10);
      else if (c.t > c.hold) c.go(c.state === 'idle' ? 'wander' : 'idle', 8 + Math.random() * 6);
    } else if (c.t > c.hold) { c.go('idle', 8); st.sw = -1; }
    // the circle it rides: where, how wide, how high
    let tcx = home.x, tcz = home.z, tR = R0, tAlt = ALT0;
    if (c.state === 'wander') { tcx += Math.sin(t * 0.05 + c.bob) * 10; tcz += Math.cos(t * 0.04 + c.bob) * 10; tAlt = ALT0 + 6; }
    if (c.state === 'curious') { tcx = THREE.MathUtils.lerp(home.x, env.camPos.x, 0.6); tcz = THREE.MathUtils.lerp(home.z, env.camPos.z, 0.6); tR = R0 * 0.7; tAlt = Math.max(11, ALT0 - 7); }
    if (c.state === 'flee') { tR = R0 * 1.5; tAlt = ALT0 + 12; }
    if (c.state === 'rare') { tAlt = Math.max(10, ALT0 - 8); tR = R0 * 0.8; if (st.sw < 0 && c.t > 4) { vA.set(Math.cos(st.a + 0.7) * st.R + st.cx, 0, Math.sin(st.a + 0.7) * st.R + st.cz); vA.y = surfAt(K, vA.x, vA.z, base); startSwoop(vA); } }
    st.cx = damp(st.cx, tcx, 0.25, dt); st.cz = damp(st.cz, tcz, 0.25, dt);
    st.R = damp(st.R, tR, 0.3, dt); st.alt = damp(st.alt, tAlt, 0.35, dt);
    st.a += dt * (c.state === 'flee' ? 1.4 : 1) * c.speed / st.R;
    if (TEST) { st.R = 0.05; st.alt = 1.5; st.a += -dt * c.speed / 0.05 + dt * 0.3; }   // DEVTEST
    const sea = surfAt(K, st.cx, st.cz, base);
    vB.set(st.cx + Math.cos(st.a) * st.R, sea + st.alt + Math.sin(st.a * 1.3 + c.bob) * 1.5, st.cz + Math.sin(st.a) * st.R);
    // the swoop: blend from the circle down to the water point and back up
    let tuck = 0;
    if (st.sw >= 0) {
      st.sw += dt / 4.5;
      const k = st.sw, bl = Math.pow(bump(k), 0.8);
      vA.copy(st.swT); vA.y += 0.35;
      vB.lerp(vA, bl);
      tuck = k < 0.45 ? ss(0.05, 0.3, k) : 0;
      if (k > 0.5 && !st.snatched) {
        st.snatched = true;
        if (c.state === 'eat' && c.pellet && !c.pellet.eaten) { c.pellet.eaten = true; c.pellet.eatenAt = env.t; if (env.call) env.call(c, 'eat'); }
      }
      if (k >= 1) { st.sw = -1; if (c.state === 'eat') { if (Math.random() < c.rareChance) c.go('rare', 10); else c.go('idle', 6); } }
    }
    if (!st.init) { P.copy(vB); st.prev.copy(vB).x -= 0.01; st.init = true; }
    P.copy(vB);
    // face along the flight, bank into the turn, pitch with the climb
    vA.subVectors(P, st.prev);
    const h = Math.hypot(vA.x, vA.z);
    if (h > 1e-4) {
      const yaw = Math.atan2(vA.x, vA.z);
      const dy = Math.atan2(Math.sin(yaw - st.yaw), Math.cos(yaw - st.yaw));
      st.yaw = yaw;
      st.bank = damp(st.bank, THREE.MathUtils.clamp(-dy / Math.max(dt, 1e-3) * 0.9, -0.75, 0.75), 3, dt);
      st.pitch = damp(st.pitch, THREE.MathUtils.clamp(Math.atan2(-vA.y, h), -0.7, 0.9), 4, dt);
    }
    st.prev.copy(P);
    root.rotation.set(st.pitch, st.yaw, st.bank);
    // wings: mostly a still soar, now and then a few slow beats (more when climbing away)
    const beat = c.state === 'flee' || (st.sw > 0.5 && st.sw < 0.8) || ((t * 0.09 + c.bob) % 1) < 0.12;
    st.flapK = damp(st.flapK, beat ? 1 : 0, 2.5, dt);
    st.tuck = damp(st.tuck, tuck, 4, dt);
    frigateWings(b, st.flapK, t, st.tuck);
    const open = 0.12 + 0.1 * Math.sin(t * 0.7 + c.bob) + st.tuck * 0.2;
    b.tails[0].rotation.y = -open; b.tails[1].rotation.y = open;
    // the pouch: inflates in the rare show, pulses and glows
    st.pouch = damp(st.pouch, c.state === 'rare' ? 1 : 0.22, c.state === 'rare' ? 1.2 : 2, dt);
    const pul = c.state === 'rare' ? 1 + Math.sin(t * 3.2) * 0.04 : 1;
    b.PG.scale.setScalar(st.pouch * pul);
    b.HD.rotation.x = damp(b.HD.rotation.x, c.state === 'rare' ? -0.25 : st.tuck * 0.3, 3, dt);
    b.HD.rotation.y = Math.sin(t * 0.5 + c.bob) * 0.3;
    K.blink(c, [b.eyes], dt);
    root.updateMatrixWorld();
  };
  return K.lod(c, near, far, 55);
}

// a few frigatebirds riding one thermal together (a flock: the nearest is the subject)
export function buildFrigatebirdGroup(K, home, opts = {}) {
  const n = opts.n ?? 4, S = opts.scale ?? 1.25;
  const root = new THREE.Group(), bodies = [];
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group(); g.rotation.order = 'YXZ';
    const inner = K.group(null, g); inner.scale.setScalar(S);
    g.userData.b = frigateBody(K, inner, true);
    g.userData.b.PG.scale.setScalar(i === 0 ? 0.6 : 0.22);
    root.add(g); bodies.push(g);
  }
  K.place(root, null);
  const centre = home.clone(); centre.y = surfAt(K, home.x, home.z, home.y);
  return K.makeFlock({
    species: SPECIES.frigatebird, root, bodies, centre, radius: opts.r ?? 26, height: opts.alt ?? 22, speed: 0.14, climb: 3,
    pose(b, i, t, state) {
      frigateWings(b.userData.b, ((t * 0.08 + i * 0.23) % 1) < 0.15 ? 1 : 0, t + i, state === 'rare' ? 0.6 : 0);
      const o = 0.14 + 0.08 * Math.sin(t * 0.7 + i);
      b.userData.b.tails[0].rotation.y = -o; b.userData.b.tails[1].rotation.y = o;
    },
  });
}

// ================================================================================================
// MUDSKIPPERS: a colony on the mudflat, one creature with several fish (~0.5 m each, scaled up).
// Bulging eyes on top of the head, crutch-like pectoral fins, skipping hops, dorsal fin flicks.
// Rare: territorial display, sails raised, two rivals jumping high at each other.
export function buildMudskipper(K, home, opts = {}) {
  const n = opts.n ?? 5;
  const root = new THREE.Group(), near = K.group(null, root), far = K.group(null, root);
  const skin = K.mat(0x6d6046, { roughness: 0.42, metalness: 0.05, side: DS });
  const dark = K.sheen(0x17130f, { roughness: 0.25 }), glow = K.glow(0x6fe3ff, 1.7);
  const finM = K.fin(0x3a4a5e, 0.82, 0.35);
  const fish = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2 + 0.4, r = i === 0 ? 0.2 : 0.9 + (i % 2) * 0.6;
    const slot = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    const F = K.group([slot.x, 0, slot.z], near); F.rotation.order = 'YXZ';
    K.mesh(K.sphere(1, 12, 9), skin, [0, 0.07, 0.12], F, null, [0.075, 0.068, 0.095]);               // big blunt head
    K.mesh(K.tube('mudBody', [[0, 0.068, 0.1], [0, 0.064, -0.05], [0, 0.056, -0.2], [0, 0.05, -0.3]], 0.07, 0.018, 8, 8), skin, null, F);
    K.mesh(K.sphere(1, 8, 6), skin, [0, 0.045, 0.2], F, null, [0.055, 0.03, 0.035]);                 // fat lips
    rod(K, F, dark, [-0.035, 0.04, 0.226], [0.035, 0.04, 0.226], 0.006, 0.006, 4);                     // the mouth line
    for (const s of [-1, 1]) {
      K.mesh(K.sphere(1, 8, 6), skin, [s * 0.026, 0.12, 0.15], F, null, 0.03);                         // eye turrets
      K.mesh(K.sphere(1, 10, 8), dark, [s * 0.028, 0.145, 0.155], F, null, 0.027);
      K.mesh(K.sphere(1, 5, 4), glow, [s * 0.024, 0.165, 0.172], F, null, 0.007);                      // catchlight
      // pectoral 'arms' with a fan at the end, propped on the mud
      rod(K, F, skin, [s * 0.06, 0.04, 0.08], [s * 0.1, 0.005, 0.1], 0.016, 0.012, 5);
      K.mesh(K.shape('mudPec', [[0, 0], [0.05, 0.02], [0.065, 0.05], [0.03, 0.06], [0, 0.03]]), skin, [s * 0.1, 0.004, 0.1], F, [-PI / 2, 0, s > 0 ? -0.6 : PI + 0.6]);
      // glowing blue spots (the real ones have them too) and dark mottles
      for (let j = 0; j < 4; j++) K.mesh(K.sphere(1, 5, 4), glow, [s * (0.066 - j * 0.008), 0.085 - (j % 2) * 0.02, 0.1 - j * 0.07], F, null, 0.008);
      for (let j = 0; j < 3; j++) K.mesh(K.sphere(1, 5, 4), dark, [s * (0.06 - j * 0.01), 0.06, 0.06 - j * 0.08], F, null, [0.004, 0.018, 0.022]);
    }
    // second dorsal and the rounded tail, both in the body colour
    K.mesh(K.shape('mudD2', [[0, 0], [0.17, 0], [0.16, 0.035], [0.03, 0.045]]), skin, [0, 0.105, -0.06], F, [0, PI / 2, 0]);
    K.mesh(K.shape('mudTail', [[0, 0], [0.06, 0.055], [0.11, 0.04], [0.12, 0], [0.11, -0.035], [0.06, -0.045]]), skin, [0, 0.05, -0.29], F, [0, PI / 2, 0]);
    // the first dorsal: a tall spiny sail, folded flat unless flicked or raised in display
    const D = K.group([0, 0.12, 0.04], F);
    K.mesh(K.shape('mudSail', [[0, 0], [0.12, 0], [0.11, 0.035], [0.085, 0.1], [0.06, 0.08], [0.04, 0.125], [0.02, 0.09], [0.005, 0.11]]), finM, [0, 0, 0], D, [0, PI / 2, 0]);
    D.rotation.x = -1.2;
    fish.push({ F, D, slot, x: slot.x, z: slot.z, yaw: Math.random() * 6.28, hop: -1, rest: Math.random() * 2, dur: 0.35, len: 0.4, ht: 0.15, dx: 0, dz: 1, sx: 0, sz: 0, flick: 0, d: 0 });
    // far: one lump per fish
    K.mesh(K.sphere(1, 6, 5), skin, [slot.x, 0.07, slot.z], far, [0, a, 0], [0.08, 0.07, 0.24]);
  }
  K.place(root, home);
  const st = { px: home.x, pz: home.z };
  const c = K.makeCreature({
    species: SPECIES.mudskipper, root, home, radius: 1.4, eye: new THREE.Vector3(0, 0.15, 0.3),
    ground: K.groundY, speed: 0.55, roam: 4, fleeAt: 8, curiousAt: 22, shy: 0.55, rareChance: 0.6, rareAt: opts.rareAt ?? 'day',
    onState(c, s) { if (s === 'rare') c.hold = 6; if (s === 'flee') c.hold = Math.min(c.hold, 3); },
    pose(c, dt, env) {
      const t = env.t, P = c.root.position;
      const spd = Math.hypot(P.x - st.px, P.z - st.pz) / Math.max(dt, 1e-4);
      st.px = P.x; st.pz = P.z;
      const moving = spd > 0.1, rare = c.state === 'rare';
      fish.forEach((f, i) => {
        f.rest -= dt;
        if (f.hop < 0 && f.rest <= 0) {
          // pick the next hop: along with the colony, back towards its own spot, or a display jump
          f.hop = 0; f.sx = f.x; f.sz = f.z;
          if (rare && i < 2) {
            f.dur = 0.55; f.len = 0; f.ht = 0.55 + Math.random() * 0.2;
            const o = fish[1 - i]; f.yaw = Math.atan2(o.x - f.x, o.z - f.z);
          } else if (moving) {
            f.dur = 0.3; f.len = 0.25; f.ht = c.state === 'flee' ? 0.22 : 0.13;
            f.yaw = damp(f.yaw, 0, 1, 1);
          } else {
            const back = Math.hypot(f.x - f.slot.x, f.z - f.slot.z) > 0.45;
            f.yaw = back ? Math.atan2(f.slot.x - f.x, f.slot.z - f.z) : f.yaw + (Math.random() - 0.5) * 2.2;
            f.dur = 0.34; f.len = 0.2 + Math.random() * 0.25; f.ht = 0.1 + Math.random() * 0.08;
          }
          f.dx = Math.sin(f.yaw); f.dz = Math.cos(f.yaw);
          f.rest = rare ? (i < 2 ? 0.15 : 1 + Math.random()) : moving ? (c.state === 'flee' ? 0.02 : 0.18) : 0.8 + Math.random() * 2.8;
          if (!moving && Math.random() < 0.3) f.flick = 0.5;
        }
        let y = 0, pitch = 0;
        if (f.hop >= 0) {
          f.hop += dt;
          const u = Math.min(1, f.hop / f.dur);
          f.x = f.sx + f.dx * f.len * u; f.z = f.sz + f.dz * f.len * u;
          y = 4 * f.ht * u * (1 - u);
          pitch = (u - 0.5) * (f.len > 0 ? 0.9 : 0.4);
          if (u >= 1) f.hop = -1;
        } else if (moving) { f.x = damp(f.x, f.slot.x, 1.5, dt); f.z = damp(f.z, f.slot.z, 1.5, dt); }
        f.F.position.set(f.x, y, f.z);
        f.F.rotation.y = f.yaw;
        f.F.rotation.x = pitch - (f.hop < 0 ? 0.08 : 0);                   // head up, propped on its fins
        f.F.rotation.z = f.hop >= 0 ? Math.sin(f.hop * 30) * 0.08 : 0;
        // gill puffs, and the sail: flicked up now and then, held high in display
        f.F.scale.set(1 + Math.sin(t * 3 + i * 1.7) * 0.03, 1, 1);
        f.flick -= dt;
        const up = rare || f.flick > 0 || c.state === 'curious' && i === 0;
        f.D.rotation.x = damp(f.D.rotation.x, up ? 0.15 : -1.2, up ? 14 : 5, dt);
      });
    },
  });
  return K.lod(c, near, far, 40);
}

// ================================================================================================
// FIDDLER CRABS: a colony on the mud (~0.4 m crabs). Each has one giant claw that it waves to
// signal, and eyes on stalks. Flee: scuttle sideways to the burrows and sink into the mud. Rare:
// the whole colony waves in sync, claws glowing.
export function buildFiddlerCrab(K, home, opts = {}) {
  const n = opts.n ?? 6;
  const root = new THREE.Group(), near = K.group(null, root), far = K.group(null, root);
  const shell = K.mat(0x3d9fb5, { roughness: 0.45 }), legM = K.mat(0xb2563a, { roughness: 0.55 });
  const dark = K.sheen(0x14100c, { roughness: 0.3 }), mud = K.mat(0x4a3d2e, { roughness: 0.95 }), hole = K.mat(0x17120d, { roughness: 1 });
  // this colony's own claw material, so its glow can pulse without lighting up every other colony
  const clawM = K.mat(0xf2a33a, { emissive: 0xff8a2a, emissiveIntensity: K.glowLevel * 0.5, roughness: 0.4, name: 'fiddlerClaw' + (++uid) });
  const crabs = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2 + 0.3, r = 0.9 + (i % 3) * 0.45;
    const slot = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    const side = i % 2 ? 1 : -1;
    const burrow = slot.clone().add(new THREE.Vector3(side * 0.45, 0, 0.1));
    K.mesh(K.geo('crabHole', () => new THREE.CircleGeometry(0.11, 10)), hole, [burrow.x, 0.012, burrow.z], near, [-PI / 2, 0, 0]);
    K.mesh(K.torus(0.14, 0.035, 4, 10), mud, [burrow.x, 0.012, burrow.z], near, [PI / 2, 0, 0]);
    const C = K.group([slot.x, 0, slot.z], near); C.rotation.order = 'YXZ';
    C.rotation.y = (Math.random() - 0.5) * 0.8;
    // carapace: wide at the front, narrower behind, a dark mottle and the mouthparts
    K.mesh(K.sphere(1, 12, 8), shell, [0, 0.14, 0.02], C, null, [0.2, 0.07, 0.1]);
    K.mesh(K.sphere(1, 10, 7), shell, [0, 0.14, -0.05], C, null, [0.15, 0.065, 0.1]);
    K.mesh(K.sphere(1, 8, 6), dark, [0, 0.165, -0.04], C, null, [0.09, 0.03, 0.06]);
    K.mesh(K.box(0.07, 0.04, 0.03), dark, [0, 0.11, 0.115], C);
    // eye stalks with dark eyes on top
    for (const s of [-1, 1]) {
      rod(K, C, shell, [s * 0.035, 0.17, 0.1], [s * 0.05, 0.3, 0.115], 0.012, 0.009, 5);
      K.mesh(K.capsule(0.02, 0.03, 2, 6), dark, [s * 0.05, 0.315, 0.115], C);
    }
    // the small feeding claw on the other side
    rod(K, C, legM, [-side * 0.1, 0.12, 0.08], [-side * 0.12, 0.08, 0.17], 0.018, 0.014, 5);
    rod(K, C, legM, [-side * 0.12, 0.08, 0.17], [-side * 0.09, 0.05, 0.2], 0.014, 0.004, 4);
    // the walking legs, four a side, in one group that shuffles
    const L = K.group([0, 0.12, 0], C);
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
      const z = 0.06 - k * 0.055, kz = z - (k - 1.5) * 0.02;
      rod(K, L, legM, [s * 0.15, 0, z], [s * 0.27, 0.06, kz], 0.016, 0.013, 5);
      rod(K, L, legM, [s * 0.27, 0.06, kz], [s * 0.34, -0.12, kz - (k - 1.5) * 0.03], 0.013, 0.004, 5);
    }
    // the giant claw: arm, a big palm and two long fingers
    const CL = K.group([side * 0.15, 0.13, 0.08], C); CL.rotation.order = 'YXZ';
    rod(K, CL, clawM, [0, 0, 0], [side * 0.06, 0.02, 0.09], 0.025, 0.022, 5);
    K.mesh(K.sphere(1, 10, 8), clawM, [side * 0.05, 0.035, 0.17], CL, [0, side * 0.5, 0], [0.05, 0.07, 0.1]);
    rod(K, CL, clawM, [side * 0.02, 0.0, 0.24], [-side * 0.12, -0.01, 0.34], 0.03, 0.006, 6);
    rod(K, CL, clawM, [side * 0.03, 0.07, 0.23], [-side * 0.12, 0.05, 0.35], 0.026, 0.005, 6);
    crabs.push({ C, L, CL, side, slot, burrow, x: slot.x, z: slot.z, tx: slot.x, tz: slot.z, ph: Math.random() * 6.28, sink: 0, wave: 0, next: Math.random() * 3 });
    // far: shell + claw
    K.mesh(K.sphere(1, 6, 4), shell, [slot.x, 0.14, slot.z], far, null, [0.2, 0.08, 0.13]);
    K.mesh(K.sphere(1, 6, 4), clawM, [slot.x + side * 0.12, 0.2, slot.z + 0.2], far, null, [0.06, 0.08, 0.13]);
  }
  K.place(root, home);
  const st = { px: home.x, pz: home.z, glow: 0 };
  const c = K.makeCreature({
    species: SPECIES['fiddler-crab'], root, home, radius: 1.5, eye: new THREE.Vector3(0, 0.3, 0.2),
    ground: K.groundY, speed: 0.35, roam: 2, fleeAt: 9, curiousAt: 20, shy: 0.7, rareChance: 0.65, rareAt: opts.rareAt ?? 'dusk',
    onState(c, s) {
      if (s === 'flee') { c.target = c.root.position.clone(); c.hold = 4 + Math.random() * 2; }   // they hide, they do not run off
      if (s === 'rare') c.hold = 6;
    },
    pose(c, dt, env) {
      const t = env.t, P = c.root.position;
      const spd = Math.hypot(P.x - st.px, P.z - st.pz) / Math.max(dt, 1e-4);
      st.px = P.x; st.pz = P.z;
      const flee = c.state === 'flee', rare = c.state === 'rare';
      const syncW = Math.pow(Math.max(0, Math.sin(t * 3.4)), 0.7);
      crabs.forEach((k, i) => {
        // where to go: the burrow when scared, otherwise a little sideways shuffle around its spot
        if (flee) { k.tx = k.burrow.x; k.tz = k.burrow.z; }
        else if ((k.next -= dt) < 0) {
          k.next = 1.5 + Math.random() * 3;
          k.tx = k.slot.x + (Math.random() - 0.5) * 0.7; k.tz = k.slot.z + (Math.random() - 0.5) * 0.3;
        }
        const dx = k.tx - k.x, dz = k.tz - k.z, d = Math.hypot(dx, dz);
        const v = flee ? 2.2 : 0.35, step = Math.min(d, v * dt);
        if (d > 0.01) { k.x += (dx / d) * step; k.z += (dz / d) * step; }
        const walking = d > 0.03 || spd > 0.05;
        // sink into the burrow once there; come out again a while after the scare
        const hide = flee && d < 0.08;
        k.sink = damp(k.sink, hide ? 1 : 0, hide ? 6 : 1.2, dt);
        k.ph += dt * (walking ? (flee ? 26 : 12) : 0);
        k.C.position.set(k.x, -k.sink * 0.32 + (walking ? Math.abs(Math.sin(k.ph)) * 0.015 : 0), k.z);
        k.C.scale.setScalar(1 - k.sink * 0.45);
        k.C.rotation.z = walking ? Math.sin(k.ph) * 0.05 : 0;
        k.L.rotation.z = walking ? Math.sin(k.ph) * 0.12 : 0;
        k.L.position.y = 0.12 + (walking ? Math.cos(k.ph) * 0.01 : 0);
        // waving: each in its own time, or all together in the rare show
        const own = Math.pow(Math.max(0, Math.sin(t * 2.2 + i * 1.9)), 0.7) * (((t * 0.15 + i * 0.37) % 1) < 0.45 ? 1 : 0);
        const w = flee ? 0 : rare ? syncW : c.state === 'curious' ? Math.max(own, syncW * 0.6) : own;
        k.wave = damp(k.wave, w, 10, dt);
        k.CL.rotation.set(-1.25 * k.wave, k.side * 0.2 * k.wave, k.side * 0.55 * k.wave);
        if (rare) k.C.rotation.y = damp(k.C.rotation.y, 0, 3, dt);
      });
      st.glow = damp(st.glow, rare ? 1 : 0, 2, dt);
      clawM.emissiveIntensity = K.glowLevel * 0.5 + st.glow * (1.2 + K.glowLevel * 1.2) * (0.35 + 0.65 * syncW);
      if (rare) c.turnTo(env.camPos.x, env.camPos.z, dt, 0.8);
    },
  });
  return K.lod(c, near, far, 38);
}

// ================================================================================================
// CROCODILE: lies at the surface with only eyes, nostrils and the back scutes showing, or basks
// on a sandbank with its jaws open (opts.bask). Curious: drifts towards the van. Rare: jaw claps
// and a death roll in a burst of spray. Eye shine at night.
export function buildCrocodile(K, home, opts = {}) {
  const bask = !!opts.bask;
  const root = new THREE.Group(), near = K.group(null, root), far = K.group(null, root);
  const skin = K.mat(0x4e5534, { roughness: 0.78 }), scute = K.mat(0x2f3424, { roughness: 0.85 });
  const belly = K.mat(0xcdc28e, { roughness: 0.75 }), teeth = K.mat(0xeee6cf, { roughness: 0.5 });
  const nose = K.sheen(0x040404, { roughness: 0.1 });
  const B = K.group([0, 0, 0], near);
  // torso + neck as ellipsoids; the scutes are placed on their top surface
  const ell = [[0, -0.16, -0.05, 0.42, 0.24, 1.0], [0, -0.14, 0.82, 0.3, 0.2, 0.42]];
  const topY = (x, z) => {
    let y = -9;
    for (const [cx, cy, cz, a, b, cc] of ell) {
      const q = 1 - ((x - cx) / a) ** 2 - ((z - cz) / cc) ** 2;
      if (q > 0) y = Math.max(y, cy + b * Math.sqrt(q));
    }
    return y;
  };
  for (const [cx, cy, cz, a, b, cc] of ell) K.mesh(K.sphere(1, 14, 10), skin, [cx, cy, cz], B, null, [a, b, cc]);
  K.mesh(K.sphere(1, 12, 8), belly, [0, -0.27, -0.02], B, null, [0.38, 0.14, 0.92]);
  for (let z = 1.0; z > -0.98; z -= 0.17) for (const x of [0.06, 0.16, 0.26]) {
    if (x > 0.2 && (z > 0.5 || z < -0.75)) continue;
    for (const s of [-1, 1]) {
      const y = topY(s * x, z);
      if (y < -1) continue;
      K.mesh(K.cone(x > 0.2 ? 0.03 : 0.042, x > 0.2 ? 0.05 : 0.075, 4), scute, [s * x, y - 0.005, z], B, [0, PI / 4, 0]);
    }
  }
  // head: pitch group (claps, lunges) > look group > skull, snout, eye bosses, jaw
  const HP = K.group([0, -0.06, 1.05], B), H = K.group([0, 0, 0.05], HP);
  K.mesh(K.sphere(1, 12, 8), skin, [0, 0, 0.08], H, null, [0.24, 0.11, 0.26]);
  K.mesh(K.sphere(1, 12, 8), skin, [0, -0.005, 0.52], H, null, [0.14, 0.065, 0.44]);
  K.mesh(K.sphere(1, 10, 7), skin, [0, 0.0, 0.88], H, null, [0.1, 0.055, 0.12]);
  K.mesh(K.sphere(1, 8, 6), skin, [0, 0.045, 0.9], H, null, [0.055, 0.035, 0.05]);                  // nostril knob
  for (const s of [-1, 1]) {
    K.mesh(K.sphere(1, 5, 4), nose, [s * 0.018, 0.074, 0.91], H, null, 0.011);
    K.mesh(K.sphere(1, 8, 6), skin, [s * 0.11, 0.075, 0.16], H, null, [0.065, 0.05, 0.075]);      // eye bosses
    for (let i = 0; i < 9; i++) {                                                                   // upper teeth
      const z = 0.22 + i * 0.075, x = 0.125 - i * 0.007;
      K.mesh(K.cone(0.012, i % 3 === 1 ? 0.06 : 0.04, 4), teeth, [s * x, -0.055, z], H, [PI, 0, 0]);
    }
  }
  const eyes = eyePair(K, H, { pos: [0.11, 0.112, 0.17], r: 0.03, iris: 0xd9a63a, dir: [0.5, 0.6, 0.6], glow: 2.2, slit: true });
  const J = K.group([0, -0.06, 0.1], H);
  K.mesh(K.sphere(1, 12, 8), skin, [0, -0.02, 0.38], J, null, [0.15, 0.045, 0.44]);
  K.mesh(K.sphere(1, 10, 6), belly, [0, 0.005, 0.36], J, null, [0.12, 0.02, 0.38]);                  // pale inside of the mouth
  for (const s of [-1, 1]) for (let i = 0; i < 8; i++) {
    const z = 0.14 + i * 0.075, x = 0.11 - i * 0.007;
    K.mesh(K.cone(0.011, i % 3 === 0 ? 0.055 : 0.035, 4), teeth, [s * x, 0.02, z], J);
  }
  // tail: three links with a scute crest (double, then single)
  const tail = [];
  let parent = B, at = [0, -0.12, -0.95];
  [[0.24, 0.17, 0.5], [0.15, 0.12, 0.48], [0.08, 0.08, 0.46]].forEach(([a, b, l], i) => {
    const g = K.group(at, parent);
    K.mesh(K.sphere(1, 10, 8), skin, [0, 0, -l * 0.8], g, null, [a, b, l]);
    for (let j = 0; j < 5; j++) {
      const z = -0.1 - j * l * 0.32, y = b * Math.sqrt(Math.max(0, 1 - ((z + l * 0.8) / l) ** 2));
      for (const s of i === 0 ? [-1, 1] : [0]) K.mesh(K.cone(0.03, 0.085 - i * 0.012, 4), scute, [s * 0.07, y - 0.005, z], g, [0, PI / 4, 0]);
    }
    tail.push(g); parent = g; at = [0, 0, -l * 1.6];
  });
  // legs: sprawled, tucked back along the flanks when swimming
  const legs = [[1, 0.6], [-1, 0.6], [1, -0.55], [-1, -0.55]].map(([s, z]) => {
    const g = K.group([s * 0.34, -0.26, z], B); g.rotation.order = 'YXZ';
    rod(K, g, skin, [0, 0, 0], [s * 0.2, -0.05, 0], 0.07, 0.055, 6);
    rod(K, g, skin, [s * 0.2, -0.05, 0], [s * 0.23, -0.22, 0.03], 0.055, 0.04, 6);
    K.mesh(K.sphere(1, 8, 5), skin, [s * 0.24, -0.24, 0.09], g, null, [0.07, 0.025, 0.1]);
    return { g, s, z };
  });
  const sp = splash(K, root, 1.6);
  sp.position.set(0, 0, 0.3);
  // far
  K.mesh(K.sphere(1, 8, 6), skin, [0, -0.16, 0], far, null, [0.42, 0.24, 1.1]);
  K.mesh(K.sphere(1, 8, 5), skin, [0, -0.08, 1.55], far, null, [0.17, 0.08, 0.62]);
  K.mesh(K.cone(0.22, 2.2, 6), skin, [0, -0.12, -2.0], far, [-PI / 2, 0, 0], [1, 1, 0.7]);
  K.place(root, home);

  const st = { px: home.x, pz: home.z, ph: 0, gape: 0, lift: bask ? 0.42 : 0.12, roll: 0, sp: 0, hp: 0, lunge: 0 };
  const c = K.makeCreature({
    species: SPECIES.crocodile, root, home, radius: 2.1, eye: new THREE.Vector3(0, 0.1, 1.25), flyer: !bask,
    ground: K.groundY, speed: bask ? 0.5 : 0.6, roam: bask ? 3 : 10, fleeAt: 7, curiousAt: 30, shy: bask ? 0.6 : 0.15, rareChance: 0.5,
    rareAt: opts.rareAt ?? 'night',
    onState(c, s) {
      if (s === 'rare') c.hold = 7;
      if (s === 'curious') c.hold = 6 + Math.random() * 3;
      if (s === 'flee' && c.target) c.hold = 4;
    },
    pose(c, dt, env) {
      const t = env.t, P = c.root.position;
      const spd = Math.hypot(P.x - st.px, P.z - st.pz) / Math.max(dt, 1e-4);
      st.px = P.x; st.pz = P.z;
      const moving = spd > 0.05;
      P.y = bask ? K.groundY(P.x, P.z) : surfAt(K, P.x, P.z, home.y);
      // in the water it floats at the line, sinks out of sight when it flees; on land it lies flat
      let lift = bask ? 0.42 : 0.12;                   // afloat the back, eyes and nostrils ride above the water
      if (!bask && c.state === 'flee') lift = c.t < c.hold - 1 ? -0.75 : 0;
      st.lift = damp(st.lift, lift, 2, dt);
      B.position.y = st.lift + (bask ? 0 : Math.sin(t * 0.7 + c.bob) * 0.012);
      // tail sweeps: a slow drift, a swimming S, a hard thrash in the roll
      st.ph += dt * (moving ? 2.5 + spd * 1.5 : 0.8);
      let amp = moving ? 0.22 : 0.05;
      if (c.state === 'flee') amp = 0.32;
      tail.forEach((g, i) => { g.rotation.y = Math.sin(st.ph - i * 0.9) * amp * (1 + i * 0.4); });
      // legs: tucked when swimming, a sprawling walk on land
      legs.forEach((l, i) => {
        const swim = !bask;
        const gait = Math.sin(st.ph * 1.4 + (i === 0 || i === 3 ? 0 : PI));
        l.g.rotation.y = damp(l.g.rotation.y, swim ? l.s * 1.1 : (moving ? gait * 0.5 * l.s : 0), 4, dt);
        l.g.rotation.z = swim ? l.s * 0.2 : (moving ? Math.max(0, -gait) * 0.35 * l.s : 0);
      });
      // jaws and head: gaping in the sun, clapping in the rare show, a lunge at a pellet
      let gape = bask && c.state === 'idle' ? 0.42 : 0, hp = 0, roll = 0, spk = 0;
      if (c.state === 'eat' && c.pellet && c.pellet.pos.distanceTo(P) < 2.6) { gape = 0.7; hp = -0.15; }
      if (c.state === 'rare') {
        const r = c.t;
        if (r < 2.4) {                                                // two big claps, head up out of the water
          hp = -0.42; gape = Math.abs(Math.sin(r * PI / 1.2)) * 0.95;
          if (r > 1.1 && r < 1.35) spk = (r - 1.1) / 0.25 * 0.5;
        } else if (r < 4.6 && !bask) {                                // the death roll
          const u = (r - 2.4) / 2.2;
          roll = ss(0, 1, u) * PI * 4; hp = 0.1; gape = 0.25;
          spk = 0.15 + u * 0.8;
          tail.forEach((g, i) => { g.rotation.y = 0.55 + i * 0.2; });
        } else if (r < 5.4 && !bask) spk = 0.95 + (r - 4.6) * 0.06;
      }
      st.gape = damp(st.gape, gape, gape > st.gape ? 9 : 16, dt);
      J.rotation.x = st.gape;
      st.hp = damp(st.hp, hp, 5, dt);
      HP.rotation.x = st.hp - st.gape * 0.25;
      B.rotation.z = roll ? roll : damp(B.rotation.z % (PI * 2), 0, 4, dt);
      splashPose(sp, spk);
      // breathing on land, eyes on the van
      if (bask) B.scale.set(1 + Math.sin(t * 0.9) * 0.012, 1 + Math.sin(t * 0.9) * 0.015, 1);
      K.blink(c, [eyes], dt);
      if (c.state !== 'rare') K.look(c, H, env, dt, { yaw: 0.45, pitch: 0.12, rate: 1.5 });
    },
  });
  return K.lod(c, near, far, 50);
}

// ================================================================================================
// RIVER DOLPHIN: a pink, long-beaked river dolphin. Swims under the surface and rolls up for a
// breath (an arc and a blow); comes to surface beside the van. Rare: a full leap out of the water.
export function buildRiverDolphin(K, home, opts = {}) {
  const root = new THREE.Group(), near = K.group(null, root), far = K.group(null, root);
  const pink = K.sheen(0xd99aa3, { roughness: 0.35, side: DS }), belly = K.sheen(0xf2b7bf, { roughness: 0.3 });
  const glow = K.glow(0xd59aff, 1.4), dark = K.sheen(0x3a2a2c, { roughness: 0.3 });
  const B = K.group(null, near);
  K.mesh(K.sphere(1, 14, 10), pink, [0, 0, 0.02], B, null, [0.26, 0.27, 0.62]);
  K.mesh(K.sphere(1, 12, 8), belly, [0, -0.08, 0.08], B, null, [0.22, 0.2, 0.52]);
  K.mesh(K.shape('dolRidge', [[0, 0], [0.42, 0], [0.3, 0.06], [0.12, 0.075], [0.03, 0.04]]), pink, [0, 0.24, -0.12], B, [0, PI / 2, 0]);
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) K.mesh(K.sphere(1, 5, 4), glow, [s * (0.24 - Math.abs(i - 2.5) * 0.01), 0.04 - (i % 2) * 0.06, 0.35 - i * 0.12], B, null, 0.014);
  const H = K.group([0, 0.02, 0.55], B);
  K.mesh(K.sphere(1, 12, 9), pink, [0, 0.04, 0.08], H, null, [0.19, 0.2, 0.25]);                        // the melon
  K.mesh(K.sphere(1, 10, 8), belly, [0, -0.07, 0.12], H, null, [0.15, 0.1, 0.2]);
  rod(K, H, pink, [0, -0.05, 0.25], [0, -0.1, 0.7], 0.05, 0.028, 7);                                    // the long beak
  K.mesh(K.sphere(1, 6, 5), pink, [0, -0.1, 0.7], H, null, 0.028);
  rod(K, H, dark, [-0.035, -0.085, 0.3], [-0.022, -0.1, 0.62], 0.004, 0.003, 4);                        // mouth line
  rod(K, H, dark, [0.035, -0.085, 0.3], [0.022, -0.1, 0.62], 0.004, 0.003, 4);
  K.mesh(K.sphere(1, 6, 5), dark, [0, 0.22, 0.0], H, null, [0.03, 0.01, 0.018]);                       // blowhole
  const eyes = eyePair(K, H, { pos: [0.152, -0.03, 0.17], r: 0.017, iris: 0x3a2a20, dir: [1, 0.05, 0.25] });
  const flips = [-1, 1].map((s) => {
    const g = K.group([s * 0.2, -0.13, 0.3], B); g.rotation.order = 'YXZ';
    K.mesh(K.shape('dolFlip', [[0, -0.02], [0.08, -0.05], [0.24, -0.02], [0.3, 0.06], [0.24, 0.12], [0.08, 0.1], [0, 0.06]]), pink, [0, 0, 0], g, [-PI / 2, 0, s > 0 ? 0 : PI]);
    return { g, s };
  });
  const TL = K.group([0, 0, -0.5], B);
  K.mesh(K.sphere(1, 10, 8), pink, [0, 0, -0.28], TL, null, [0.16, 0.18, 0.42]);
  const FL = K.group([0, 0, -0.66], TL);
  K.mesh(K.shape('dolFluke', [[0, 0.04], [0.1, 0.1], [0.3, 0.18], [0.27, 0.25], [0.1, 0.22], [0, 0.17], [-0.1, 0.22], [-0.27, 0.25], [-0.3, 0.18], [-0.1, 0.1]]), pink, [0, 0, 0], FL, [-PI / 2, 0, 0]);
  // the blow (a column of mist over the blowhole) and the splash, both kept upright in the root
  const BL = K.group([0, 0, 0.57], root);
  const mist = K.fin(0xf2fbff, 0.5, 0.6);
  for (let i = 0; i < 7; i++) K.mesh(K.sphere(1, 7, 5), mist, [Math.sin(i * 2.1) * 0.06 * i, 0.15 + i * 0.16, Math.cos(i * 2.1) * 0.05 * i], BL, null, 0.06 + i * 0.025);
  BL.visible = false;
  const sp = splash(K, root, 1.1);
  // far
  K.mesh(K.sphere(1, 8, 6), pink, [0, 0, -0.1], far, null, [0.26, 0.27, 0.85]);
  K.mesh(K.cone(0.05, 0.5, 5), pink, [0, -0.06, 1.0], far, [PI / 2, 0, 0]);
  K.mesh(K.shape('dolFluke', [[0, 0.04], [0.1, 0.1], [0.3, 0.18], [0.27, 0.25], [0.1, 0.22], [0, 0.17], [-0.1, 0.22], [-0.27, 0.25], [-0.3, 0.18], [-0.1, 0.1]]), pink, [0, 0, -1.12], far, [-PI / 2, 0, 0]);
  K.place(root, home);

  const DEPTH = 1.1;
  const st = { px: home.x, pz: home.z, cyc: Math.random(), d: DEPTH, pitch: 0, bl: -1, sp: -1, ph: 0, leapY: 0 };
  const c = K.makeCreature({
    species: SPECIES['river-dolphin'], root, home, radius: 1.2, eye: new THREE.Vector3(0, 0.05, 0.75), flyer: true,
    speed: 1.6, roam: 14, fleeAt: 4.5, curiousAt: 40, shy: 0.1, rareChance: 0.6, rareAt: opts.rareAt ?? 'dawn',
    onState(c, s) {
      if (s === 'curious') { c.hold = 7 + Math.random() * 3; st.cyc = 0.92; }   // come up beside the van soon
      if (s === 'rare') c.hold = 4.5;
    },
    pose(c, dt, env) {
      const t = env.t, P = c.root.position;
      const spd = Math.hypot(P.x - st.px, P.z - st.pz) / Math.max(dt, 1e-4);
      const surf = surfAt(K, P.x, P.z, home.y);
      // it never really stops: drift forward a little while idle
      if (c.state === 'idle') { c.forward(vA); P.addScaledVector(vA, 0.5 * dt); }
      // the breathing cycle: under for a while, then a rolling arc at the surface with a blow
      const period = c.state === 'curious' ? 4.5 : 8;
      st.cyc += dt / period;
      const u = st.cyc % 1, W = 0.3;
      let y = -DEPTH, pitch = 0;
      if (u < W) {
        const k = u / W;
        y = -DEPTH + (DEPTH + 0.06) * bump(k);
        pitch = -Math.cos(PI * k) * 0.45;
        if (k > 0.42 && k < 0.47 && st.bl < 0) st.bl = 0;
      }
      if (c.state === 'eat' && c.pellet && c.pellet.pos.distanceTo(P) < 3) { y = -0.12; pitch = -0.35; }
      if (c.state === 'flee') { y = -DEPTH * 1.6; pitch = 0.2; }
      if (c.state === 'rare') {                                     // the leap: out, over and back in
        const k = c.t / 2.2;
        if (k < 1) {
          c.forward(vA); P.addScaledVector(vA, 4.2 * dt);
          y = -0.9 + 3.1 * Math.sin(PI * k);
          pitch = -Math.atan2(3.1 * PI * Math.cos(PI * k) / 2.2, 4.2);
          if (k > 0.1 && k < 0.14 && st.sp < 0) st.sp = 0;
          if (k > 0.86 && k < 0.9 && st.sp < 0) st.sp = 0;
        }
      }
      const rate = c.state === 'rare' ? 30 : 3;
      st.d = damp(st.d, y, rate, dt);
      st.pitch = damp(st.pitch, pitch, c.state === 'rare' ? 20 : 4, dt);
      P.y = surf + st.d;
      st.px = P.x; st.pz = P.z;
      B.rotation.x = st.pitch;
      // swimming: the flukes beat up and down, the body follows
      st.ph += dt * (2 + Math.min(4, spd) * 1.6);
      TL.rotation.x = Math.sin(st.ph) * 0.18;
      FL.rotation.x = Math.sin(st.ph - 1.1) * 0.35;
      H.rotation.x = -Math.sin(st.ph) * 0.04;
      flips.forEach((f) => { f.g.rotation.set(0, f.s * (0.55 + Math.sin(st.ph * 0.5) * 0.1), -f.s * 0.45); });
      // the flexible neck: it looks at the van when up
      if (st.d > -0.5) K.look(c, H, env, dt, { yaw: 0.6, pitch: 0.3, force: c.state === 'curious' });
      else H.rotation.y = damp(H.rotation.y, Math.sin(t * 0.8) * 0.15, 3, dt);
      K.blink(c, [eyes], dt);
      // the blow and the splash live at the water line
      if (st.bl >= 0) { st.bl += dt / 1.3; if (st.bl > 1) st.bl = -1; }
      BL.visible = st.bl >= 0;
      if (BL.visible) { const k = st.bl; BL.scale.set(0.4 + k * 0.9, Math.max(0.05, Math.min(1, k * 4)) * (1 - k * 0.3), 0.4 + k * 0.9); }
      BL.position.y = surf - P.y;
      if (st.sp >= 0) { st.sp += dt / 1.1; if (st.sp > 1) st.sp = -1; }
      splashPose(sp, st.sp < 0 ? 0 : st.sp);
      sp.position.y = surf - P.y;
    },
  });
  return K.lod(c, near, far, 50);
}

// ================================================================================================
// ARCHERFISH: a little school just under the surface, silver with black bars. Rare: the lead fish
// shoots a jet of water at an insect on a mangrove leaf overhead, the insect drops, the fish take
// it. opts.target: a world point (on a real mangrove leaf) to shoot at; without it the creature
// brings its own overhanging twig (opts.branch !== false).
function archerGeo(K) {
  return K.geo('archerBody', () => {
    const g = new THREE.SphereGeometry(1, 18, 12);
    const p = g.attributes.position, col = new Float32Array(p.count * 3);
    const silver = new THREE.Color(0xdfe5e8), white = new THREE.Color(0xf6f4ec), black = new THREE.Color(0x15171a), olive = new THREE.Color(0x9c9a6c), c = new THREE.Color();
    const bars = [0.68, 0.3, -0.06, -0.42];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      // deep, flat-sided body; straight back running into a pointed snout
      const Y = y * (y > 0 ? 0.105 : 0.13) - Math.max(0, z - 0.4) * 0.05 * (y > 0 ? 1 : -0.6);
      p.setXYZ(i, x * 0.055 * (1 - Math.max(0, z - 0.6) * 0.5), Y, z * 0.28);
      c.copy(y < -0.35 ? white : silver);
      if (y > 0.82) c.copy(olive);
      for (const b of bars) {
        const w = 0.1 * (0.4 + 0.6 * (y + 1) / 2);                 // wedge bars: wide at the back, narrow below
        if (Math.abs(z - b) < w && y > -0.15 && y < 0.95) c.copy(black);
      }
      c.toArray(col, i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  });
}
export function buildArcherfish(K, home, opts = {}) {
  const n = opts.n ?? 4;
  const root = new THREE.Group(), near = K.group(null, root), far = K.group(null, root);
  const bodyM = K.mat(0xffffff, { vertexColors: true, roughness: 0.3, metalness: 0.35 });
  const finD = K.fin(0x2a2a22, 0.85, 0.1), finY = K.fin(0xd8c76a, 0.6, 0.35);
  const dark = K.sheen(0x0c0b0a, { roughness: 0.12 }), glow = K.glow(0x9ff7d8, 1.6);
  const jetM = K.fin(0xcdeefa, 0.6, 0.7);
  const fish = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2, r = i === 0 ? 0 : 0.8 + (i % 2) * 0.5;
    const slot = new THREE.Vector3(Math.cos(a) * r, -0.2 - (i % 3) * 0.06, Math.sin(a) * r);
    const F = K.group([slot.x, slot.y, slot.z], near); F.rotation.order = 'YXZ';
    K.mesh(archerGeo(K), bodyM, [0, 0, 0], F);
    K.mesh(K.shape('archDors', [[0, 0], [0.16, 0], [0.13, 0.06], [0.04, 0.075]]), finD, [0, 0.09, -0.04], F, [0, PI / 2, 0]);
    K.mesh(K.shape('archAnal', [[0, 0], [0.16, 0], [0.12, -0.08], [0.03, -0.07]]), finD, [0, -0.1, -0.05], F, [0, PI / 2, 0]);
    for (const s of [-1, 1]) {
      K.mesh(K.sphere(1, 10, 8), dark, [s * 0.035, 0.04, 0.17], F, null, [0.018, 0.028, 0.028]);       // big eyes, set high
      K.mesh(K.sphere(1, 5, 4), glow, [s * 0.05, 0.05, 0.18], F, null, 0.006);
      for (let j = 0; j < 5; j++) K.mesh(K.sphere(1, 4, 3), glow, [s * 0.052 * (1 - j * 0.12), -0.01, 0.1 - j * 0.07], F, null, 0.006);
      K.mesh(K.shape('archPec', [[0, 0], [0.05, 0.02], [0.06, -0.02], [0.02, -0.03]]), finY, [s * 0.05, -0.03, 0.09], F, [0, s > 0 ? -2 : -1.1, 0]);
    }
    const TG = K.group([0, 0, -0.27], F);
    K.mesh(K.shape('archTail', [[0, 0], [0.13, 0.09], [0.11, 0], [0.13, -0.09]]), finY, [0, 0, 0], TG, [0, PI / 2, 0]);
    fish.push({ F, TG, slot, x: slot.x, z: slot.z, y: slot.y, yaw: a + PI / 2, ph: Math.random() * 6 });
    K.mesh(K.sphere(1, 6, 5), K.sheen(0xd0d6d8, { metalness: 0.35 }), [slot.x, slot.y, slot.z], far, [0, a + PI / 2, 0], [0.06, 0.12, 0.29]);
  }
  // the water jet: a thin arc of droplets from (0,0,0) to (0,1,1), scaled to the real throw each time
  const JG = K.group(null, root);
  const arc = [];
  for (let i = 0; i <= 8; i++) { const u = i / 8; arc.push([0, 1.3 * u - 0.3 * u * u, u]); }
  K.mesh(K.tube('archJet', arc, 0.012, 0.006, 5, 12), jetM, null, JG);
  for (let i = 1; i < 9; i++) { const u = i / 9 + 0.03; K.mesh(K.sphere(1, 5, 4), jetM, [0.01 * Math.sin(i * 3), 1.3 * u - 0.3 * u * u, u], JG, null, 0.018); }
  JG.visible = false;
  // the leaf with the insect on it: its own little static object at home, so it stays put
  const twig = new THREE.Group();
  const target = opts.target ? opts.target.clone() : null;
  const surf0 = surfAt(K, home.x, home.z, home.y);
  const tipLocal = new THREE.Vector3(0.6, 2.55, 0.5);
  if (!target && opts.branch !== false) {
    const wood = K.mat(0x4a3a2c, { roughness: 0.9 }), leaf = K.sheen(0x2e5a2a, { roughness: 0.35, side: DS });
    K.mesh(K.tube('archTwig', [[-3.4, 3.9, -1.2], [-1.8, 3.4, -0.4], [-0.4, 2.85, 0.3], [0.75, 2.5, 0.55]], 0.07, 0.018, 5, 10), wood, null, twig);
    rod(K, twig, wood, [-1.2, 3.2, -0.15], [-0.6, 3.3, 0.9], 0.025, 0.01, 4);
    const leaves = [[0.6, 2.5, 0.48, 0.1, 0.0], [0.45, 2.56, 0.32, -0.7, 0.6], [0.2, 2.66, 0.55, 0.9, -0.4], [-0.25, 2.8, 0.15, -0.4, 0.7], [-0.6, 3.27, 0.85, 1.4, 0.3], [-0.75, 3.32, 0.75, -0.9, -0.2]];
    for (const [x, y, z, ry, rz] of leaves) K.mesh(blade(K, 0.32, 0.14), leaf, [x, y, z], twig, [-PI / 2 + 0.35, ry, rz]);
  }
  // the insect: a firefly-ish beetle, its tail lit
  const INS = K.group(null, twig);
  const insDark = K.mat(0x2a1a14, { roughness: 0.6 });
  K.mesh(K.capsule(0.035, 0.1, 3, 6), insDark, [0, 0.03, 0], INS, [PI / 2, 0, 0]);
  K.mesh(K.sphere(1, 8, 6), K.glow(0xd8ff6a, 2.6), [0, 0.03, -0.09], INS, null, [0.035, 0.03, 0.05]);
  for (const s of [-1, 1]) K.mesh(blade(K, 0.13, 0.05), K.fin(0xd8e4ff, 0.45, 0.4), [s * 0.02, 0.06, 0.02], INS, [-PI / 2 + 0.2, 0, s * 2.7]);
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) rod(K, INS, insDark, [s * 0.02, 0.02, 0.03 - k * 0.03], [s * 0.07, -0.01, 0.04 - k * 0.04], 0.005, 0.003, 3);
  K.place(twig, null);
  twig.position.set(home.x, surf0, home.z);
  if (target) twig.position.set(0, 0, 0);
  const restIns = target ? target.clone() : tipLocal.clone();
  INS.position.copy(restIns);
  twig.updateMatrixWorld(true);
  // far
  K.place(root, home);

  const st = { ins: 1, fall: 0, iy: 0, jet: 0, mouth: new THREE.Vector3() };
  const c = K.makeCreature({
    species: SPECIES.archerfish, root, home, radius: 0.9, eye: new THREE.Vector3(0, -0.12, 0.2), flyer: true,
    speed: 0.7, roam: 2.5, fleeAt: 6, curiousAt: 18, shy: 0.5, rareChance: 0.75, rareAt: opts.rareAt ?? 'day',
    onState(c, s) { if (s === 'rare') { c.hold = 6.5; } },
    pose(c, dt, env) {
      const t = env.t, P = c.root.position;
      const rare = c.state === 'rare';
      P.y = surfAt(K, P.x, P.z, home.y);
      // the insect in this root's frame
      twig.localToWorld(vB.copy(INS.position));
      root.worldToLocal(vC.copy(vB));
      // rare: back under the twig; the lead fish lines up below the insect and shoots
      if (rare && Math.hypot(P.x - home.x, P.z - home.z) > 0.3 && c.t < 2) c.walkTo(home, dt, 1.2);
      const r = c.t;
      fish.forEach((f, i) => {
        let tx = f.slot.x + Math.sin(t * 0.35 + i * 2) * 0.45, tz = f.slot.z + Math.cos(t * 0.3 + i * 1.3) * 0.35, ty = f.slot.y;
        let pitch = 0, beat = 7;
        if (c.state === 'flee') { ty = -0.8; beat = 18; }
        if (c.state === 'eat' && c.pellet) { root.worldToLocal(vA.copy(c.pellet.pos)); tx = vA.x + (i - 1) * 0.15; tz = vA.z - 0.25; ty = -0.07; pitch = -0.3; beat = 12; }
        if (rare) {
          if (i === 0 && r < 3.6) {                                     // lead: just short of below the insect, nose up
            tx = vC.x; tz = vC.z - 0.55; ty = -0.06; pitch = r > 1.6 ? -0.75 : -0.2;
          } else if (r > 3.3 && r < 4.6) { tx = vC.x + (i - 1.5) * 0.2; tz = vC.z + 0.1; ty = -0.06; beat = 16; pitch = -0.3; }
        }
        const k = rare ? 2.2 : 0.9;
        const ox = f.x, oz = f.z;
        f.x = damp(f.x, tx, k, dt); f.z = damp(f.z, tz, k, dt); f.y = damp(f.y, ty, 2, dt);
        const vx = f.x - ox, vz = f.z - oz;
        if (rare && i === 0 && r < 3.6) f.yaw = damp(f.yaw, Math.atan2(vC.x - f.x, vC.z - f.z), 4, dt);
        else if (Math.abs(vx) + Math.abs(vz) > 1e-4) {
          const want = Math.atan2(vx, vz);
          f.yaw += Math.atan2(Math.sin(want - f.yaw), Math.cos(want - f.yaw)) * Math.min(1, dt * 4);
        }
        f.ph += dt * beat;
        f.F.position.set(f.x, f.y + Math.sin(t * 1.3 + i) * 0.015, f.z);
        f.F.rotation.y = f.yaw + Math.sin(f.ph) * 0.05;
        f.F.rotation.x = damp(f.F.rotation.x, pitch, 4, dt);
        f.TG.rotation.y = Math.sin(f.ph) * 0.4;
      });
      // the shot
      let jet = 0;
      if (rare && r > 2.2 && r < 3.2) jet = r < 2.45 ? (r - 2.2) / 0.25 : r < 2.85 ? 1 : 1 - (r - 2.85) / 0.35;
      st.jet = jet;
      JG.visible = jet > 0.02;
      if (JG.visible) {
        const L = fish[0];
        L.F.updateMatrix();
        st.mouth.set(0, 0.03, 0.3).applyMatrix4(L.F.matrix);
        const dx = vC.x - st.mouth.x, dz = vC.z - st.mouth.z, D = Math.hypot(dx, dz), Hh = vC.y - st.mouth.y;
        JG.position.copy(st.mouth);
        JG.rotation.set(0, Math.atan2(dx, dz), 0);
        const grow = r < 2.85 ? Math.min(1, jet * 1.2) : 1;
        JG.scale.set(1, Math.max(0.01, Hh * grow), Math.max(0.01, D * grow));
        if (r > 2.85) JG.position.y -= (1 - jet) * 0.5;
      }
      // the insect: knocked off the leaf, drops, is taken, then a new one turns up
      const wl = surfAt(K, vB.x, vB.z, home.y) - twig.position.y;
      if (rare && r > 2.5) {
        st.fall += dt;
        const y = restIns.y - 4.9 * st.fall * st.fall;
        INS.position.set(restIns.x + st.fall * 0.2, Math.max(wl + 0.02, y), restIns.z);
        INS.rotation.z += dt * 9;
        if (r > 4.0) st.ins = damp(st.ins, 0, 6, dt);
      } else {
        st.fall = 0;
        INS.position.copy(restIns);
        INS.rotation.z = 0;
        st.ins = damp(st.ins, 1, rare ? 0 : 1.5, dt);
        INS.position.y += Math.sin(t * 2.3) * 0.004;
      }
      INS.scale.setScalar(Math.max(0.01, st.ins));
      INS.visible = st.ins > 0.02;
    },
  });
  return K.lod(c, near, far, 40);
}

export const BUILDERS = {
  heron: buildHeron,
  frigatebird: buildFrigatebird,
  mudskipper: buildMudskipper,
  'fiddler-crab': buildFiddlerCrab,
  crocodile: buildCrocodile,
  'river-dolphin': buildRiverDolphin,
  archerfish: buildArcherfish,
};
// group builders (flocks) that are not one-per-species
export const GROUPS = { frigatebird: buildFrigatebirdGroup };
