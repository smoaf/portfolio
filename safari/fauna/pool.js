// The canyon's water folk: the salamanders and the fish. The axolotl walks the floor of the deep
// pool with its feathery gills glowing; its land cousin, the fire salamander, only comes out on the
// wet banks in the half light (dawn and dusk, the canyon's twilight secret); and a shoal of lantern
// tetras turns in the open water of the pool, one instanced draw per part however many fish there are.
//
// The salamanders are skinned over a small skeleton (the rig from deep.js): the spine and tail bend
// side to side as they walk, the legs swing in diagonal pairs, the gills flutter.
import * as THREE from 'three';
import { Rig, xf, merge, tubeGeo, rigEye, flash, lit, turn } from './deep.js';

export const SPECIES = {
  axolotl: { id: 'axolotl', name: 'Axolotl', points: 220, call: { hz: 1900, kind: 'chirp' } },
  'fire-salamander': { id: 'fire-salamander', name: 'Fire salamander', points: 260, call: { hz: 1400, kind: 'chirp' } },
  'lantern-tetra': { id: 'lantern-tetra', name: 'Lantern tetra shoal', points: 150, call: { hz: 2400, kind: 'trill' } },
};

const PI = Math.PI, TAU = PI * 2;
const clamp = THREE.MathUtils.clamp;
const ease = (cur, to, k) => cur + (to - cur) * Math.min(1, k);
const UP = new THREE.Vector3(0, 1, 0);
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), mA = new THREE.Matrix4(), mB = new THREE.Matrix4(),
  qA = new THREE.Quaternion(), eA = new THREE.Euler(), sOne = new THREE.Vector3(1, 1, 1);

// a capsule from a to b (both [x, y, z]) as a loose geometry, for limbs and fingers
function seg(K, a, b, r, rs = 6) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = Math.max(0.001, d.length());
  const g = xf(K.capsule(r, len, 2, rs), null, null, 1);
  g.applyMatrix4(mA.compose(A.add(B).multiplyScalar(0.5), qA.setFromUnitVectors(UP, d.normalize()), sOne));
  return g;
}

// ---------------------------------------------------------------------------------------------
// The salamander body plan, shared by the axolotl and the fire salamander. One unit long (snout to
// tail tip about 1.05), facing +z, standing on y = 0; the builder scales it.
//   look: { skin, belly, spot, fin (or null), gill (or null), iris, key }
function salamander(K, near, look) {
  const H = 0.1;                                                     // the belly's height off the ground
  const R = new Rig(K, look.key);
  const trunk = R.bone(-1, [0, H, 0]);
  // the body: a soft flattened barrel from the hips (z = -0.08) to the shoulders (z = 0.38)
  R.add(look.skin, trunk, () => xf(tubeGeo(0.48, 10, 12, (t) => 0.064 + 0.024 * Math.sin(Math.min(1, t * 1.15) * PI) + (t > 0.9 ? -0.01 : 0), 1.2, 0.78), [0, 0, -0.09], null, 1));
  R.add(look.belly, trunk, () => xf(K.sphere(1, 12, 6), [0, -0.035, 0.15], null, [0.085, 0.035, 0.22]));
  // the head: broad and flat with a wide smiling mouth and small beady eyes high on the sides
  const head = R.bone(trunk, [0, 0.008, 0.38]);
  R.add(look.skin, head, () => merge([
    [K.sphere(1, 16, 10), [0, 0, 0.07], null, [0.118, 0.07, 0.115]],
    [K.sphere(1, 12, 8), [0, -0.012, 0.15], null, [0.094, 0.052, 0.07]],
    [tubeGeo(0.08, 3, 10, (t) => 0.07 + t * 0.01, 1.25, 0.8), [0, 0, -0.06], null, 1],   // the neck
  ]));
  R.add(look.belly, head, () => xf(K.sphere(1, 10, 6), [0, -0.035, 0.1], null, [0.1, 0.035, 0.1]));
  R.add(look.mouth, head, () => xf(K.torus(0.072, 0.0055, 4, 14, PI), [0, -0.024, 0.13], [PI / 2 + 0.25, 0, 0], [1, 0.82, 1]));
  // the gills: three feathery stalks a side, each on its own bone so they can flutter and flare
  const gills = [];
  if (look.gill) {
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const id = R.bone(head, [s * 0.1, 0.03 - k * 0.012, 0.0], [-0.75 + k * 0.62, s * (PI / 2 + 0.75), 0], 'YXZ');
      const len = 0.15 - Math.abs(k - 1) * 0.02;
      R.add(look.skin, id, () => xf(tubeGeo(len, 4, 5, (t) => 0.012 - t * 0.006), null, null, 1));
      R.add(look.gill, id, () => {
        const it = [];
        for (let i = 0; i < 9; i++) {
          const t = 0.12 + (i / 8) * 0.86, l = 0.055 * (1 - t * 0.45);
          for (const side of [-1, 1]) it.push([K.cone(0.0065, l, 3), [side * l * 0.45, 0, t * len], [0, 0, -side * PI / 2 + side * 0.15], 1]);
        }
        it.push([K.sphere(1, 6, 4), [0, 0, len], null, 0.012]);
        return merge(it);
      });
      gills.push({ id, s, k });
    }
  }
  // the eyes: small, dark and beady, set wide
  const eyeIds = [-1, 1].map((s) => rigEye(K, R, head, { pos: [s * 0.082, 0.036, 0.13], r: 0.017, iris: look.iris, dir: [s, 0.55, 0.45], glow: look.irisGlow || 0 }));
  // the spots along the back and flanks: the research twist (they glow after dark)
  R.add(look.spot, trunk, () => {
    const it = [];
    const P = look.spots;
    for (const [x, y, z, s] of P) it.push([K.sphere(1, 7, 5), [x, y, z], null, [s, s * 0.45, s * 1.25]]);
    return merge(it);
  });
  // the tail: a flattened blade on a five bone chain, with a fin crest above and below (axolotl)
  const tail = R.chain(look.skin, trunk, [0, 0.005, -0.08], [0, PI, 0], { len: 0.55, n: 5, prof: (t) => 0.07 * Math.pow(1 - t, 1.1) + 0.006, sx: 0.55, sy: 1, radial: 9, segs: 15 });
  if (look.fin) {
    R.add(look.fin, tail[0], () => xf(K.shape(look.key + 'Fin', [[-0.05, 0.05], [0.12, 0.1], [0.32, 0.085], [0.56, 0.0], [0.34, -0.07], [0.14, -0.08], [0.02, -0.05]]), null, [0, -PI / 2, 0], 1), tail.w);
    R.add(look.fin, trunk, () => xf(K.shape(look.key + 'Crest', [[0, 0], [0.3, 0], [0.22, 0.025], [0.06, 0.03]]), [0, 0.06, 0.24], [0, PI / 2, 0], 1));
  } else if (look.tailSpots) {
    R.add(look.spot, tail[0], () => merge(look.tailSpots.map(([z, s]) => [K.sphere(1, 6, 4), [0, 0.05 * (1 - z * 1.6), z], null, [s * 0.7, s * 0.45, s * 1.3]])), tail.w);
  }
  // the legs: an upper arm out to the side, a forearm down to the ground, four (front) or five
  // (hind) splayed fingers
  const legs = [];
  for (const [front, s] of [[1, -1], [1, 1], [0, -1], [0, 1]]) {
    const id = R.bone(trunk, [s * 0.075, -0.025, front ? 0.31 : 0.0]);
    const fx = s * 0.13, fz = front ? 0.03 : -0.01, n = front ? 4 : 5;
    R.add(look.skin, id, () => {
      const it = [seg(K, [0, 0, 0], [s * 0.075, -0.015, 0.005], 0.024), seg(K, [s * 0.075, -0.015, 0.005], [fx, -H + 0.016, fz], 0.019)];
      for (let f = 0; f < n; f++) {
        const a = (f / (n - 1) - 0.5) * 1.6 + (front ? 0.25 : -0.1) * s, l = 0.035 + (f === 1 || f === 2 ? 0.008 : 0);
        it.push(seg(K, [fx, -H + 0.012, fz], [fx + Math.sin(a) * l * s + s * 0.008, -H + 0.006, fz + Math.cos(a) * l], 0.0065, 4));
      }
      const g = mergeList(it);
      return g;
    });
    legs.push({ id, front, s });
  }
  return { R, trunk, head, gills, eyeIds, tail, legs, H };
}
const mergeList = (gs) => { const out = merge(gs.map((g) => [g, null, null, 1])); gs.forEach((g) => g.dispose()); return out; };

// the spots for each species: [x, y, z, size] in the trunk's space
const AXO_SPOTS = (() => {
  const out = [];
  for (let i = 0; i < 6; i++) out.push([0, 0.072 - Math.abs(i - 2.5) * 0.002, -0.04 + i * 0.08, 0.014]);
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) out.push([s * 0.085, 0.022, 0.0 + i * 0.08, 0.009]);
  return out;
})();
const FIRE_SPOTS = (() => {
  // two broken yellow stripes down the back, and the big patches behind the head (the parotoids)
  const out = [];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) out.push([s * (0.042 + (i % 2) * 0.012), 0.064, -0.06 + i * 0.075 + (s > 0 ? 0.02 : 0), 0.026 + (i % 3) * 0.004]);
    out.push([s * 0.06, 0.055, 0.4, 0.034]);
    out.push([s * 0.088, 0.02, 0.33, 0.02]);
    out.push([s * 0.09, 0.0, 0.0, 0.018]);
  }
  return out;
})();

// One salamander in the world. kind: 'axolotl' (the pool floor) or 'fire-salamander' (the banks).
function buildSalamander(K, home, opts, kind) {
  const axo = kind === 'axolotl';
  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  const lift = K.group(null, near);                                  // the axolotl rises off the floor
  const scale = opts.scale ?? (axo ? 1.25 : 1.05);
  const skin = axo ? K.sheen(0xf2bcc8, { roughness: 0.32 }) : K.sheen(0x15131a, { roughness: 0.28 });
  const belly = axo ? K.mat(0xf7d6dc, { roughness: 0.5 }) : K.mat(0x26222a, { roughness: 0.6 });
  const spot = axo ? flash(K, 0x8ff7ff, 0.9) : flash(K, 0xffc61a, 0.55, { roughness: 0.3 });
  const gill = axo ? flash(K, 0xff4d86, 1.0, { roughness: 0.5 }) : null;
  const finM = axo ? K.fin(0xf6c6d2, 0.55, 0.25) : null;
  const mouth = K.mat(axo ? 0x9a4f62 : 0x08070a, { roughness: 0.7 });
  const S = salamander(K, near, {
    key: kind, skin, belly, spot, gill, fin: finM, mouth, iris: axo ? 0x1a0d10 : 0x0d0b0b, irisGlow: 0,
    spots: axo ? AXO_SPOTS : FIRE_SPOTS, tailSpots: axo ? null : [[0.06, 0.03], [0.17, 0.026], [0.28, 0.02], [0.38, 0.016]],
  });
  const bones = S.R.build(lift);
  const B = (id) => bones[id];
  const eyes = S.eyeIds.map(B);
  near.scale.setScalar(scale);
  K.shadow(root, 0.2 * scale, 0.55 * scale);
  // far: body, head and tail in the skin, a line of the glow down the back
  far.scale.setScalar(scale);
  K.mesh(K.capsule(0.08, 0.42, 2, 6), skin, [0, 0.1, 0.14], far, [PI / 2, 0, 0], [1.2, 1, 0.75]);
  K.mesh(K.sphere(0.11, 6, 5), skin, [0, 0.1, 0.46], far, null, [1.05, 0.65, 1]);
  K.mesh(K.cone(0.06, 0.55, 5), skin, [0, 0.1, -0.33], far, [-PI / 2, 0, 0], [0.6, 1, 1]);
  K.mesh(K.capsule(0.02, 0.4, 2, 4), spot, [0, 0.165, 0.14], far, [PI / 2, 0, 0]);
  if (axo) for (const s of [-1, 1]) K.mesh(K.cone(0.05, 0.14, 4), gill, [s * 0.15, 0.13, 0.36], far, [0, 0, -s * 1.9]);

  K.place(root, home);
  let prevX = home.x, prevZ = home.z, sp = 0, flare = 0, hover = 0, step = 0;
  const c = K.makeCreature({
    species: SPECIES[kind], root, home, ground: K.groundY,
    radius: 0.45 * scale, eye: new THREE.Vector3(0, 0.12 * scale, 0.5 * scale),
    speed: axo ? 0.5 : 0.45, roam: opts.roam ?? 3.5, fleeAt: axo ? 4.5 : 5, curiousAt: 18, shy: axo ? 0.25 : 0.45,
    rareChance: 0.75, rareAt: axo ? 'night' : 'dawn',
    onState(c, s) { if (s === 'rare' && c._env && c._env.call) c._env.call(c, 'rare'); },
    pose(c, dt, env) {
      c._env = env;
      const p = c.root.position, st = c.state;
      sp = ease(sp, Math.hypot(p.x - prevX, p.z - prevZ) / Math.max(dt, 1e-3), dt * 6);
      prevX = p.x; prevZ = p.z;
      // the walk: a slow sway of the spine and tail, the legs swinging in diagonal pairs
      const walking = sp > 0.05 && hover < 0.3;
      step += dt * (walking ? 3 + sp * 7 : 0);
      const amp = walking ? 0.42 : 0;
      B(S.trunk).rotation.y = ease(B(S.trunk).rotation.y, Math.sin(step) * amp * 0.35, dt * 8);
      S.legs.forEach((l, i) => {
        const ph = step + ((i === 0 || i === 3) ? 0 : PI);
        const b = B(l.id);
        const swing = walking ? Math.sin(ph) * 0.6 : 0, raise = walking ? Math.max(0, Math.cos(ph)) * 0.35 : 0;
        // tucked along the body while it hovers (the rare show), splayed on the ground otherwise
        b.rotation.y = ease(b.rotation.y, (swing - (l.front ? 0 : 0)) * l.s * -1 + hover * l.s * (l.front ? 0.9 : -0.9), dt * 10);
        b.rotation.z = ease(b.rotation.z, l.s * (raise + hover * 0.6), dt * 10);
      });
      // the tail: a lazy curl at rest, a strong wave while it swims up
      const tw = hover > 0.3 ? 2.6 : (walking ? 1.4 : 0.6), ta = hover > 0.3 ? 0.32 : (walking ? 0.22 : 0.08);
      c.ph = (c.ph ?? 0) + dt * tw * 2;
      S.tail.forEach((id, j) => turn(B(id), 0, Math.sin(c.ph - j * 0.8 + (walking ? step : 0) * 0) * ta * (0.4 + j * 0.25) - B(S.trunk).rotation.y * 0.5, 0, dt * 8));
      // the head: follows the van when curious, otherwise looks about slowly
      const hb = B(S.head);
      K.look(c, hb, env, dt, { yaw: 0.6, pitch: 0.35, rate: 2, force: st === 'curious' });
      hb.rotation.x -= ease(0, hover * 0.25, 1);
      // the gills: a soft flutter always (they breathe with them); the rare show flares them wide
      flare = ease(flare, st === 'rare' ? 1 : (st === 'curious' ? 0.35 : 0), dt * 3);
      for (const g of S.gills) {
        const b = B(g.id), r0 = b.userData.r0;
        b.rotation.x = r0.x + Math.sin(env.t * 2.2 + g.k * 1.3 + c.bob) * 0.12 + (g.k - 1) * flare * 0.2;
        b.rotation.y = r0.y + g.s * flare * 0.22 + Math.sin(env.t * 1.5 + g.k) * 0.05;
      }
      // the rare show: the axolotl lifts off the floor with its tail and hangs there glowing; the
      // fire salamander rears up on its front legs and its yellow pattern pulses
      if (axo) {
        hover = ease(hover, st === 'rare' ? 1 : 0, dt * 1.2);
        lift.position.y = hover * 0.75 + hover * Math.sin(env.t * 1.4) * 0.06;
        lift.rotation.x = -hover * 0.25;
      } else {
        const rear = st === 'rare' ? 1 : 0;
        hover = 0;
        lift.rotation.x = ease(lift.rotation.x, -rear * 0.32, dt * 4);
        lift.position.y = ease(lift.position.y, rear * 0.06, dt * 4);
      }
      lit(spot, flare * (axo ? 1.6 : 1.4) * (0.6 + 0.4 * Math.sin(env.t * 5)));
      if (gill) lit(gill, flare * 1.8);
      // breathing: the throat and flanks
      const br = 1 + Math.sin(env.t * 2.6 + c.bob) * 0.018;
      B(S.trunk).scale.set(br, 1 + (br - 1) * 0.6, 1);
      K.blink(c, eyes, dt);
    },
  });
  return K.lod(c, near, far, 30);
}
export const buildAxolotl = (K, home, opts = {}) => buildSalamander(K, home, opts, 'axolotl');
export const buildFireSalamander = (K, home, opts = {}) => buildSalamander(K, home, opts, 'fire-salamander');

// ---------------------------------------------------------------------------------------------
// Lantern tetras: a shoal of silver fish as long as a hand and a half, a glowing neon line down each
// flank, a red rear half. They turn together around the open water; feed pulls them down to it, the
// van scatters them, and the rare show (after feed, or by themselves at dusk) is a bait ball: the
// shoal winds itself into a tight spinning sphere and every stripe flares.
// opts: { count = 30, roam = 7 }
export function buildLanternTetras(K, home, opts = {}) {
  const N = opts.count ?? 30, roam = opts.roam ?? 7;
  const silver = K.sheen(0xc9d6de, { roughness: 0.25, metalness: 0.45 }), red = K.sheen(0xd5283e, { roughness: 0.35 });
  const black = K.sheen(0x0b0b0e, { roughness: 0.1 }), finM = K.fin(0xe4eef4, 0.5, 0.2);
  const stripe = flash(K, 0x38e9ff, 1.4, { roughness: 0.3 });
  const L = 0.34;                                                    // one fish, nose to tail tip
  const body = K.geo('tetraBody', () => merge([[K.sphere(1, 12, 8), [0, 0, 0.02], null, [0.034, 0.068, L * 0.42]]]));
  const redG = K.geo('tetraRed', () => merge([[K.sphere(1, 10, 6), [0, -0.012, -0.05], null, [0.036, 0.046, L * 0.26]]]));
  const eyeG = K.geo('tetraEye', () => merge([-1, 1].map((s) => [K.sphere(1, 8, 6), [s * 0.026, 0.016, 0.1], null, [0.012, 0.016, 0.014]])));
  const stripeG = K.geo('tetraStripe', () => merge([[K.sphere(1, 10, 4), [0, 0.018, 0.02], null, [0.0365, 0.0085, L * 0.33]]]));
  const finG = K.geo('tetraFins', () => merge([
    [K.shape('tetraDorsal', [[0, 0], [0.07, 0], [0.03, 0.055], [0.0, 0.05]]), [0, 0.058, -0.04], [0, -PI / 2, 0], 1],
    [K.shape('tetraAnal', [[0, 0], [0.09, 0], [0.06, -0.035], [0.0, -0.03]]), [0, -0.045, -0.06], [0, -PI / 2, 0], 1],
    ...[-1, 1].map((s) => [K.shape('tetraPec', [[0, 0], [0.04, -0.01], [0.035, -0.03]]), [s * 0.03, -0.02, 0.06], [0, s * PI / 2 + PI, 0], 1]),
  ]));
  const tailG = K.geo('tetraTail', () => xf(K.shape('tetraTailFin', [[0, 0], [0.09, 0.055], [0.075, 0.0], [0.09, -0.05]]), null, [0, PI / 2, 0], 1));
  const farG = K.geo('tetraFar', () => merge([[K.sphere(1, 5, 4), null, null, [0.05, 0.08, 0.18]]]));

  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  const inst = (g, m, parent) => {
    const im = new THREE.InstancedMesh(g, m, N);
    im.frustumCulled = false;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    parent.add(im);
    return im;
  };
  const rigid = [inst(body, silver, near), inst(redG, red, near), inst(eyeG, black, near), inst(stripeG, stripe, near), inst(finG, finM, near)];
  const tails = inst(tailG, finM, near);
  const dots = [inst(farG, silver, far), inst(K.geo('tetraFarGlow', () => merge([[K.sphere(1, 4, 3), [0, 0.02, 0], null, [0.055, 0.02, 0.14]]])), stripe, far)];
  K.place(root, home);

  // every fish keeps its own slot in the shoal (a loose ellipsoid) and its own wobble
  const F = [];
  for (let i = 0; i < N; i++) {
    const u = K.rand(), v = K.rand(), th = u * TAU, ph = Math.acos(2 * v - 1), r = 0.5 + Math.cbrt(K.rand()) * 1.1;
    F.push({ o: new THREE.Vector3(Math.sin(ph) * Math.cos(th) * r * 1.4, Math.cos(ph) * r * 0.6, Math.sin(ph) * Math.sin(th) * r * 1.6),
      w: K.rand() * TAU, f: 0.7 + K.rand() * 0.8, pos: new THREE.Vector3(), yaw: 0, pitch: 0, ball: K.rand() * TAU, lane: K.rand() * 2 - 1 });
  }
  const C = new THREE.Vector3(), V = new THREE.Vector3(0, 0, 1), goal = new THREE.Vector3(), local = new THREE.Vector3();
  let around = K.rand() * TAU, spread = 1, flare = 0, ball = 0, spin = 0;
  const c = {
    species: SPECIES['lantern-tetra'], root, home: home.clone(), radius: 0.8, flock: true, state: 'idle', t: 0, hold: 3,
    visible: true, eye: new THREE.Vector3(), lead: null, near: 99, bob: K.rand() * 6, pellet: null,
  };
  c.go = (s, hold = 5) => { if (c.state === s) return; c.state = s; c.t = 0; c.hold = hold; };
  c.photoPoint = (out) => out.copy(c.lead ? c.lead.pos : C).applyMatrix4(c.root.matrixWorld);
  c.forward = (out) => out.set(Math.sin(c.lead ? c.lead.yaw : 0), 0, Math.cos(c.lead ? c.lead.yaw : 0));
  K.lod(c, near, far, 38);
  c.step = (dt, env) => {
    c.t += dt;
    const camL = local.copy(env.camPos).sub(c.root.position);
    const camD = camL.distanceTo(C);
    // what the shoal is up to
    if (c.state !== 'flee' && c.state !== 'rare' && camD < 4.5) {
      c.go('flee', 3);
      vA.copy(C).sub(camL).setY(0).normalize();
      goal.copy(C).addScaledVector(vA, 9);
      if (env.call) env.call(c, 'flee');
    } else if (c.state === 'idle' || c.state === 'wander' || c.state === 'curious') {
      const pellet = env.pellets.find((p) => !p.eaten && p.sunk && p.pos.distanceTo(c.root.position) < 16);
      if (pellet) { c.pellet = pellet; c.go('eat', 9); }
      else if (env.tod === 'dusk' && Math.random() < dt * 0.05) { c.go('rare', 7); if (env.call) env.call(c, 'rare'); }
      else if (camD < 14 && c.state !== 'curious' && Math.random() < dt * 0.4) c.go('curious', 3);
      else if (c.t > c.hold) c.go(c.state === 'wander' ? 'idle' : 'wander', 4 + Math.random() * 4);
    } else if (c.state === 'eat') {
      const p = c.pellet;
      if (!p || p.eaten || c.t > c.hold) c.go('idle', 2);
      else if (p.pos.distanceTo(vA.copy(C).add(c.root.position)) < 0.7) {
        p.eaten = true; p.eatenAt = env.t;
        if (env.call) env.call(c, 'eat');
        c.go(Math.random() < 0.75 ? 'rare' : 'idle', 6);
        if (c.state === 'rare' && env.call) env.call(c, 'rare');
      }
    } else if (c.t > c.hold) c.go('idle', 2);

    // where the centre of the shoal heads
    let speed = 1.1;
    if (c.state === 'flee') speed = 3.4;
    else if (c.state === 'eat' && c.pellet) { goal.copy(c.pellet.pos).sub(c.root.position); speed = 1.8; }
    else if (c.state === 'rare') speed = 0.5;
    else {
      around += dt * 0.16;
      goal.set(Math.cos(around) * roam, Math.sin(around * 0.7 + c.bob) * 0.8, Math.sin(around) * roam * 0.8);
      if (c.state === 'curious') goal.lerp(camL, 0.25);
    }
    vA.copy(goal).sub(C);
    const d = vA.length();
    if (d > 0.05) {
      vA.multiplyScalar(1 / d);
      V.lerp(vA, Math.min(1, dt * (c.state === 'flee' ? 3 : 1.2))).normalize();
      C.addScaledVector(V, Math.min(d, speed * dt));
    }
    // keep the shoal in the water: off the floor and under the surface
    const gx = c.root.position.x + C.x, gz = c.root.position.z + C.z;
    const lo = K.groundY(gx, gz) + 1.1 - c.root.position.y, hi = (K.waterY ? K.waterY(gx, gz) : 1e3) - 1 - c.root.position.y;
    C.y = clamp(C.y, lo, Math.max(lo, hi));

    spread = ease(spread, c.state === 'flee' ? 0.7 : (c.state === 'eat' ? 0.55 : 1), dt * 2);
    ball = ease(ball, c.state === 'rare' ? 1 : 0, dt * 1.4);
    flare = ease(flare, c.state === 'rare' ? 1 : (c.state === 'flee' ? 0.5 : 0), dt * 3);
    spin += dt * (1.2 + ball * 1.6);
    lit(stripe, flare * 2.4 * (0.75 + 0.25 * Math.sin(env.t * 9)));
    const heading = Math.atan2(V.x, V.z), pitch = -Math.asin(clamp(V.y, -0.6, 0.6));
    let best = null, bestD = Infinity;
    for (let i = 0; i < N; i++) {
      const f = F[i];
      // the loose shoal: the slot turned with the heading, a wobble each
      vA.copy(f.o).multiplyScalar(spread).applyAxisAngle(UP, heading);
      vA.x += Math.sin(env.t * f.f + f.w) * 0.18; vA.y += Math.sin(env.t * f.f * 1.3 + f.w) * 0.1;
      let yaw = heading + Math.sin(env.t * f.f * 0.8 + f.w) * 0.18, pt = pitch;
      if (ball > 0.01) {
        // the bait ball: each fish on its own ring of a sphere, all streaming round the same way
        const a = f.ball + spin * (1 + f.lane * 0.15), rr = 0.75 + Math.abs(f.lane) * 0.25, y = f.lane * 0.7;
        const r = Math.sqrt(Math.max(0.05, rr * rr - y * y));
        vB.set(Math.cos(a) * r, y + 0.4, Math.sin(a) * r);
        vA.lerp(vB, ball);
        yaw = yaw + (Math.atan2(-Math.sin(a), Math.cos(a)) - yaw) * ball;
        pt = pt * (1 - ball);
      }
      f.pos.copy(C).add(vA);
      f.yaw = yaw;
      // the tail beats faster when they hurry
      const beat = Math.sin(env.t * (c.state === 'flee' ? 26 : 12) * f.f + f.w);
      qA.setFromEuler(eA.set(pt, yaw + beat * 0.08, 0, 'YXZ'));
      mA.compose(f.pos, qA, sOne);
      for (const im of rigid) im.setMatrixAt(i, mA);
      for (const im of dots) im.setMatrixAt(i, mA);
      mB.makeRotationY(beat * 0.5).setPosition(0, 0, -0.13);
      tails.setMatrixAt(i, mB.premultiply(mA));
      const dd = f.pos.distanceToSquared(camL);
      if (dd < bestD) { bestD = dd; best = f; }
    }
    for (const im of rigid) im.instanceMatrix.needsUpdate = true;
    for (const im of dots) im.instanceMatrix.needsUpdate = true;
    tails.instanceMatrix.needsUpdate = true;
    c.lead = best;
    c.root.updateMatrixWorld();
  };
  return c;
}

export const BUILDERS = {
  axolotl: buildAxolotl,
  'fire-salamander': buildFireSalamander,
  'lantern-tetra': buildLanternTetras,
};
