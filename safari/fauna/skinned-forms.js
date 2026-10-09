// Body plans the species share: a four-legged animal, a bird, a swimmer with a bending spine, and
// a six- or eight-legged arthropod. Each one lays out the bones and the big shapes from a few
// proportions; the species file adds what makes the animal itself (horns, ears, frill, markings)
// and its animation. All sizes in metres, facing +z, standing on y = 0.
import * as THREE from 'three';
import { damp, wrap, lookAt, blinker, twoBodies, blob } from '../skinned.js';
import { makeCreature } from '../creature.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const arr = (v) => [v.x, v.y, v.z];
const lerp3 = (a, b, t) => a.clone().lerp(b, t);

// ---- four legs ----------------------------------------------------------------------------------
// s: { L, H, R: [side, up], neck: { len, up, r: [base, top] }, head: { len, r, drop }, leg: [thigh, shin, hoof],
//      tail: { len, r }, coat, belly, legColor, hoofColor, hump }
export function quadruped(B, M, s) {
  const q = B.q;
  const { L, H } = s;
  const [Rx, Ry] = s.R;
  const back = H + Ry * 0.25;                            // the line of the back
  const mid = H - Ry * 0.55;                             // the middle of the barrel
  const hipZ = -L * 0.36, chestZ = L * 0.34;
  B.bone('hips', 'root', [0, mid, hipZ]);
  B.bone('chest', 'hips', [0, mid, chestZ]);
  // the neck leaves the chest up and forward
  const nb = V(0, mid + Ry * 0.45, chestZ + Rx * 0.35);
  const nu = s.neck.up ?? 0.7;
  const ne = nb.clone().add(V(0, Math.sin(nu), Math.cos(nu)).multiplyScalar(s.neck.len));
  B.bone('neck', 'chest', arr(nb));
  B.bone('head', 'neck', arr(ne));
  // tail
  const t0 = V(0, back - Ry * 0.35, hipZ - Rx * 0.95);
  B.bone('tail1', 'hips', arr(t0));
  B.bone('tail2', 'tail1', arr(t0.clone().add(V(0, -s.tail.len * 0.45, -s.tail.len * 0.18))));

  // the barrel: rump, waist, ribs, chest; the hump (buffalo) lifts the shoulders
  const N = q ? 11 : 6;
  const rings = [];
  const z0 = hipZ - Rx * 1.05, z1 = chestZ + Rx * 0.95;
  for (let i = 0; i <= N; i++) {
    const t = i / N, z = THREE.MathUtils.lerp(z0, z1, t);
    const end = Math.sin(Math.min(1, t * 1.0) * Math.PI);          // round at both ends
    const cap = Math.pow(Math.max(0, Math.sin(t * Math.PI)), 0.42);
    const waist = 1 - 0.12 * Math.exp(-((t - 0.45) ** 2) / 0.02);
    const chest = 1 + 0.12 * Math.exp(-((t - 0.78) ** 2) / 0.03);
    const hump = (s.hump || 0) * Math.exp(-((t - 0.82) ** 2) / 0.02);
    rings.push({
      p: [0, mid + hump * Ry * 0.5 + (t > 0.7 ? (t - 0.7) * Ry * 0.25 : 0), z],
      r: [Rx * cap * waist * (0.95 + 0.05 * end), Ry * cap * chest * (1 + hump * 0.4)],
      b: B.along(['hips', 'chest'], THREE.MathUtils.clamp((t - 0.2) / 0.6, 0, 1)),
    });
  }
  B.loft(rings, { mat: M.skin, seg: q ? 18 : 8, color: s.coat ?? 0xffffff,
    profile: (a) => 1 - 0.08 * Math.max(0, Math.cos(a)) });         // a slightly flatter belly

  // the neck, thick where it meets the shoulders
  const nr = s.neck.r;
  const nRings = [];
  const NN = q ? 6 : 3;
  for (let i = 0; i <= NN; i++) {
    const t = i / NN;
    const p = lerp3(nb.clone().add(V(0, -Ry * 0.3, -Rx * 0.5)), ne, t);
    const r = THREE.MathUtils.lerp(nr[0], nr[1], Math.pow(t, 0.8));
    nRings.push({ p: arr(p), r: [r * 0.82, r], b: t < 0.3 ? 'chest' : B.along(['neck', 'head'], (t - 0.3) / 0.7 * 0.9) });
  }
  B.loft(nRings, { mat: M.skin, seg: q ? 14 : 6, color: s.neckColor ?? s.coat ?? 0xffffff, cap: false });

  // the head: skull to muzzle, pointing forward and down; the species adds ears, horns, nose
  const hd = s.head;
  const drop = hd.drop ?? 0.5;
  const dir = V(0, -Math.sin(drop), Math.cos(drop));
  const hRings = [];
  const HN = q ? 7 : 4;
  for (let i = 0; i <= HN; i++) {
    const t = i / HN;
    const p = ne.clone().add(dir.clone().multiplyScalar(-hd.r * 0.5 + t * hd.len));
    const k = t < 0.35 ? Math.sin((0.25 + t / 0.35 * 0.75) * Math.PI / 2) : 1 - (t - 0.35) / 0.65 * (1 - (hd.muzzle ?? 0.55));
    hRings.push({ p: arr(p), r: [hd.r * k * (hd.wide ?? 0.9), hd.r * k], b: 'head' });
  }
  B.loft(hRings, { mat: M.skin, seg: q ? 14 : 6, color: s.headColor ?? s.coat ?? 0xffffff });
  const head = { base: ne, dir, at: (f, up = 0, side = 0) => ne.clone().add(dir.clone().multiplyScalar(-hd.r * 0.5 + f * hd.len)).add(V(side, up, 0)) };

  // four legs, each a tube from the body down to the hoof, bending at the knee
  const [thigh, shin, hoof] = s.leg;
  const legs = [];
  [['FL', 1, 1], ['FR', -1, 1], ['BL', 1, -1], ['BR', -1, -1]].forEach(([n, sx, f]) => {
    const z = f > 0 ? chestZ * 0.86 : hipZ * 0.9;
    const top = V(sx * Rx * 0.55, mid, z);
    const knee = V(sx * Rx * 0.58, H * 0.48, z + (f > 0 ? -0.02 : -0.06) * H);
    const ankle = V(sx * Rx * 0.58, H * 0.14, z + (f > 0 ? 0 : 0.02) * H);
    const foot = V(sx * Rx * 0.58, 0, z + (f > 0 ? 0.03 : 0.04) * H);
    B.bone(n + '1', f > 0 ? 'chest' : 'hips', arr(top));
    B.bone(n + '2', n + '1', arr(knee));
    B.bone(n + '3', n + '2', arr(ankle));
    const rings2 = [
      { p: arr(top.clone().add(V(0, Ry * 0.3, 0))), r: thigh * 1.25, b: n + '1' },
      { p: arr(lerp3(top, knee, 0.45)), r: thigh, b: n + '1' },
      { p: arr(knee), r: thigh * 0.62, b: [[n + '1', 0.5], [n + '2', 0.5]] },
      { p: arr(lerp3(knee, ankle, 0.5)), r: shin, b: n + '2' },
      { p: arr(ankle), r: shin * 1.1, b: [[n + '2', 0.5], [n + '3', 0.5]] },
      { p: arr(lerp3(ankle, foot, 0.6)), r: shin * 0.9, b: n + '3' },
    ];
    B.loft(rings2, { mat: M.skin, seg: q ? 10 : 5, color: s.legColor ?? s.coat ?? 0xffffff, plain: !!s.plainLegs });
    // the hoof or paw
    B.add(new THREE.CylinderGeometry(hoof * 0.8, hoof, hoof * 1.1, q ? 10 : 5), { bone: n + '3', mat: M.skin, at: arr(foot.clone().add(V(0, hoof * 0.55, 0.01))), color: s.hoofColor ?? 0x2a2420 });
    legs.push({ n, f, sx });
  });

  // the tail
  const tl = s.tail;
  B.loft([
    { p: arr(t0.clone().add(V(0, 0, Rx * 0.25))), r: tl.r * 1.3, b: 'tail1' },
    { p: arr(t0), r: tl.r, b: 'tail1' },
    { p: arr(t0.clone().add(V(0, -tl.len * 0.45, -tl.len * 0.18))), r: tl.r * 0.7, b: 'tail2' },
    { p: arr(t0.clone().add(V(0, -tl.len, -tl.len * 0.22))), r: tl.r * (tl.tuft ?? 0.5), b: 'tail2' },
  ], { mat: M.skin, seg: q ? 8 : 4, color: tl.color ?? s.coat ?? 0xffffff });
  return { head, legs, neckBase: nb, neckEnd: ne, mid, back, hipZ, chestZ };
}

// The walk: legs swing in the order a four-legged animal walks; faster it becomes a trot or a
// gallop. phase advances with the distance actually covered, so the feet never skate.
export function quadPose(bones, st, { speed, dt, stride = 1.2, gallop = false, lift = 0.5 }) {
  st.phase = (st.phase || 0) + speed * dt / stride * Math.PI * 2;
  const amp = THREE.MathUtils.clamp(speed / 2.5, 0, 1);
  st.amp = damp(st.amp || 0, amp, 6, dt);
  const A = st.amp;
  const off = gallop ? { FL: 0, FR: 0.15, BL: 0.55, BR: 0.65 } : { BL: 0, FL: 0.25, BR: 0.5, FR: 0.75 };
  for (const n of ['FL', 'FR', 'BL', 'BR']) {
    const ph = st.phase + off[n] * Math.PI * 2;
    const front = n[0] === 'F';
    bones[n + '1'].rotation.x = Math.sin(ph) * 0.42 * A;
    const flex = Math.max(0, Math.cos(ph)) * lift * A;
    bones[n + '2'].rotation.x = front ? flex * 0.2 : -flex * 0.5;
    bones[n + '3'].rotation.x = front ? -flex * 1.1 : flex * 1.0;
  }
  bones.hips.position.y = bones.hips.userData.at.y + Math.abs(Math.sin(st.phase * 2)) * 0.03 * A * (gallop ? 3 : 1);
  bones.hips.rotation.x = gallop ? Math.sin(st.phase) * 0.06 * A : 0;
}

// ---- birds --------------------------------------------------------------------------------------
// s: { len, r: [side, up], neck, head: { r, len }, beak: { len, r, hook, color }, wing: { span, chord, color, tip },
//      tail: { len, w, color }, leg: { len, r, color }, coat, belly }
// Wings are modelled spread (along x); the folded pose is a bone pose, so one body does both.
export function bird(B, M, s) {
  const q = B.q;
  const L = s.len, [rx, ry] = s.r;
  const legH = s.leg.len;
  const y0 = legH + ry * 0.8;                          // the body sits on its legs
  B.bone('body', 'root', [0, y0, 0]);
  B.bone('neck', 'body', [0, y0 + ry * 0.5, L * 0.32]);
  const hp = V(0, y0 + ry * 0.5 + s.neck.len, L * 0.38 + s.neck.len * 0.35);
  B.bone('head', 'neck', arr(hp));
  B.bone('tail', 'body', [0, y0 + ry * 0.1, -L * 0.42]);
  // the body: an egg, wider at the breast
  const N = q ? 10 : 5, rings = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, z = THREE.MathUtils.lerp(-L * 0.5, L * 0.45, t);
    const k = Math.pow(Math.max(0, Math.sin(t * Math.PI)), 0.55) * (1 + 0.15 * t);
    rings.push({ p: [0, y0 + (t - 0.5) * ry * 0.5, z], r: [rx * k, ry * k], b: 'body' });
  }
  B.loft(rings, { mat: M.skin, seg: q ? 16 : 7, color: s.coat ?? 0xffffff });
  // the neck, then the head as a ball with a brow, and the beak
  B.loft([
    { p: [0, y0 + ry * 0.2, L * 0.25], r: [rx * 0.62, ry * 0.62], b: 'body' },
    { p: arr(lerp3(V(0, y0 + ry * 0.2, L * 0.25), hp, 0.5)), r: s.neck.r, b: 'neck' },
    { p: arr(hp.clone().add(V(0, -s.head.r * 0.3, -s.head.r * 0.3))), r: s.neck.r * 0.85, b: 'head' },
  ], { mat: M.skin, seg: q ? 12 : 6, color: s.neckColor ?? s.coat ?? 0xffffff, cap: false });
  const hr = s.head.r;
  B.loft([
    { p: arr(hp.clone().add(V(0, 0, -hr * 0.95))), r: hr * 0.2, b: 'head' },
    { p: arr(hp.clone().add(V(0, 0.02 * hr, -hr * 0.55))), r: [hr * 0.86, hr * 0.85], b: 'head' },
    { p: arr(hp.clone().add(V(0, 0.05 * hr, 0))), r: [hr * 0.95, hr * 0.95], b: 'head' },
    { p: arr(hp.clone().add(V(0, 0.02 * hr, hr * (s.head.len ?? 0.6)))), r: [hr * 0.62, hr * 0.6], b: 'head' },
    { p: arr(hp.clone().add(V(0, -0.05 * hr, hr * ((s.head.len ?? 0.6) + 0.25)))), r: hr * 0.3, b: 'head' },
  ], { mat: M.skin, seg: q ? 14 : 6, color: s.headColor ?? s.coat ?? 0xffffff });
  const bk = s.beak, bz = hp.z + hr * ((s.head.len ?? 0.6) + 0.15);
  const beakRings = [];
  const BN = q ? 6 : 3;
  for (let i = 0; i <= BN; i++) {
    const t = i / BN;
    const hook = bk.hook ? Math.pow(t, 3) * bk.hook : 0;
    beakRings.push({ p: [0, hp.y - hr * 0.08 + (bk.up ?? 0) * t - hook, bz + t * bk.len], r: [bk.r * (1 - t * 0.85) * 0.8, bk.r * (1 - t * 0.8)], b: 'head' });
  }
  B.loft(beakRings, { mat: M.skin, seg: q ? 10 : 5, color: bk.color ?? 0x3a332c, plain: true });
  const head = { at: hp, r: hr, beakAt: V(0, hp.y, bz) };

  // wings: shoulder, elbow, hand; each a stack of long feathers in sheets, darker at the tips
  const w = s.wing;
  [1, -1].forEach((sx) => {
    const n = sx > 0 ? 'L' : 'R';
    const sh = V(sx * rx * 0.75, y0 + ry * 0.45, L * 0.12);
    const el = sh.clone().add(V(sx * w.span * 0.3, 0, -w.chord * 0.1));
    const wr = el.clone().add(V(sx * w.span * 0.32, 0, 0.0));
    B.bone('arm' + n, 'body', arr(sh));
    B.bone('fore' + n, 'arm' + n, arr(el));
    B.bone('hand' + n, 'fore' + n, arr(wr));
    // the covert: a thick leading edge over the inner wing
    B.loft([
      { p: arr(sh), r: [w.chord * 0.18, w.chord * 0.08], b: 'arm' + n },
      { p: arr(el), r: [w.chord * 0.15, w.chord * 0.06], b: B.along(['arm' + n, 'fore' + n], 0.6) },
      { p: arr(wr), r: [w.chord * 0.08, w.chord * 0.04], b: 'hand' + n },
    ], { mat: M.skin, seg: q ? 8 : 4, up: [0, 0, 1], color: w.covert ?? s.coat ?? 0xffffff });
    // the flight feathers: inner (secondaries) on the arm, long primaries fanned on the hand
    const FN = q ? (w.feathers ?? 9) : 4;
    // flat feathers: draw them as quads in the wing plane, pointing back and out
    const quad = (base, ang, len, wid, bone, color) => {
      const d = V(Math.sin(ang) * sx, 0, -Math.cos(ang)), side = V(-d.z * sx, 0, d.x * sx).normalize();
      const pts = [base.clone().addScaledVector(side, -wid / 2), base.clone().addScaledVector(side, wid / 2),
        base.clone().addScaledVector(d, len).addScaledVector(side, wid * 0.32), base.clone().addScaledVector(d, len * 1.04),
        base.clone().addScaledVector(d, len).addScaledVector(side, -wid * 0.32)];
      const g = new THREE.BufferGeometry();
      const P = [], I = [0, 1, 2, 0, 2, 3, 0, 3, 4];
      pts.forEach((p) => P.push(p.x, p.y, p.z));
      // two-sided: a second copy wound the other way, a hair lower
      pts.forEach((p) => P.push(p.x, p.y - 0.006, p.z));
      I.push(...[0, 2, 1, 0, 3, 2, 0, 4, 3].map((i) => i + 5));
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(20), 2));
      g.setIndex(I);
      g.computeVertexNormals();
      B.add(g, { bone, mat: M.skin, color });
    };
    const tipC = new THREE.Color(w.tip ?? w.color), baseC = new THREE.Color(w.color);
    for (let i = 0; i < FN; i++) {              // secondaries along arm and forearm
      const t = (i + 0.5) / FN;
      const base = lerp3(sh, wr, t * 0.98);
      const bone = t < 0.45 ? 'arm' + n : 'fore' + n;
      quad(base, 0.08 * t, w.chord * (0.85 + 0.1 * Math.sin(t * 3)), (w.span * 0.62 / FN) * 1.5, bone, baseC.clone().lerp(tipC, 0.35).getHex());
    }
    const PN = q ? (w.primaries ?? 7) : 3;
    for (let i = 0; i < PN; i++) {              // primaries: long, fanned, separated at the tip like fingers
      const t = i / Math.max(1, PN - 1);
      const base = wr.clone().add(V(sx * w.span * 0.04 * t, 0, w.chord * 0.05));
      quad(base, 0.15 + t * (w.fan ?? 1.25), w.chord * (1.1 + 0.25 * Math.sin(t * Math.PI)) * (w.reach ?? 1), w.chord * 0.2, 'hand' + n, tipC.getHex());
    }
  });
  // the tail fan
  const tl = s.tail;
  const TN = q ? 7 : 3;
  for (let i = 0; i < TN; i++) {
    const t = TN === 1 ? 0.5 : i / (TN - 1);
    const a = (t - 0.5) * (tl.fan ?? 0.6);
    const base = V(0, y0 + ry * 0.05, -L * 0.42);
    const d = V(Math.sin(a), 0, -Math.cos(a));
    const side = V(-d.z, 0, d.x);
    const len = tl.len, wid = tl.w / TN * 1.6;
    const pts = [base.clone().addScaledVector(side, -wid / 3), base.clone().addScaledVector(side, wid / 3),
      base.clone().addScaledVector(d, len).addScaledVector(side, wid / 2), base.clone().addScaledVector(d, len * 1.03), base.clone().addScaledVector(d, len).addScaledVector(side, -wid / 2)];
    const g = new THREE.BufferGeometry();
    const P = [];
    pts.forEach((p) => P.push(p.x, p.y + i * 0.002, p.z));
    pts.forEach((p) => P.push(p.x, p.y + i * 0.002 - 0.005, p.z));
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(20), 2));
    g.setIndex([0, 2, 1, 0, 3, 2, 0, 4, 3, 5, 6, 7, 5, 7, 8, 5, 8, 9]);
    g.computeVertexNormals();
    B.add(g, { bone: 'tail', mat: M.skin, color: tl.color ?? s.coat ?? 0xffffff });
  }
  // legs: thigh in the feathers, a bare shank, toes
  const lg = s.leg;
  [1, -1].forEach((sx) => {
    const n = sx > 0 ? 'L' : 'R';
    const hip = V(sx * rx * 0.45, y0 - ry * 0.35, L * 0.02);
    const ankle = V(sx * rx * 0.5, legH * 0.18, L * 0.05);
    B.bone('leg' + n, 'body', arr(hip));
    B.bone('foot' + n, 'leg' + n, arr(ankle));
    B.loft([
      { p: arr(hip.clone().add(V(0, ry * 0.2, 0))), r: lg.r * 2.2, b: 'leg' + n },
      { p: arr(lerp3(hip, ankle, 0.35)), r: lg.r * 1.6, b: 'leg' + n, c: lg.thigh ?? s.belly ?? s.coat },
      { p: arr(lerp3(hip, ankle, 0.55)), r: lg.r, b: 'leg' + n, c: lg.color },
      { p: arr(ankle), r: lg.r * 0.9, b: 'foot' + n, c: lg.color },
    ], { mat: M.skin, seg: q ? 8 : 4, color: lg.thigh ?? s.belly ?? s.coat ?? 0xffffff, plain: true });
    if (q) [-0.5, 0, 0.5, Math.PI].forEach((a) => {
      const toeLen = lg.toe ?? legH * 0.3;
      const d = V(Math.sin(a), 0, Math.cos(a));
      B.loft([
        { p: arr(ankle), r: lg.r * 0.7, b: 'foot' + n },
        { p: arr(ankle.clone().addScaledVector(d, toeLen * (a === Math.PI ? 0.5 : 1)).setY(0.02)), r: lg.r * 0.4, b: 'foot' + n },
      ], { mat: M.skin, seg: 4, color: lg.color, plain: true });
    });
  });
  return { head, y0 };
}

// wings: 0 = folded against the body, 1 = spread; flap is the beat angle
export function wingPose(bones, open, flap = 0, sweep = 0) {
  for (const [n, sx] of [['L', 1], ['R', -1]]) {
    const fold = 1 - open;
    bones['arm' + n].rotation.set(0, sx * (fold * 1.25 - sweep * 0.3), sx * (flap - fold * 0.25));
    bones['fore' + n].rotation.set(0, -sx * fold * 2.4, sx * (flap * 0.5 + fold * 0.15));
    bones['hand' + n].rotation.set(0, sx * fold * 2.2, sx * flap * 0.6);
  }
}

// ---- swimmers -----------------------------------------------------------------------------------
// A spine of n bones from the head back; the wave runs down it. Returns the bone names.
export function spine(B, n, from, to, parent = 'root', prefix = 's') {
  const names = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const p = lerp3(V(...from), V(...to), t);
    B.bone(prefix + i, i ? prefix + (i - 1) : parent, arr(p));
    names.push(prefix + i);
  }
  return names;
}
export function swimWave(bones, names, t, { amp = 0.25, freq = 2, len = 1, axis = 'y', grow = 1.6 }) {
  names.forEach((n, i) => {
    const k = i / Math.max(1, names.length - 1);
    bones[n].rotation[axis] = Math.sin(t * freq - k * Math.PI * 2 * len) * amp * (0.25 + k * grow) / names.length * 3;
  });
}

// ---- jointed legs (insects, spiders, crustaceans) -------------------------------------------------
// a leg from a hip on the body out and down to the ground, in three segments
export function jointedLeg(B, M, { name, parent, hip, knee, foot, r, color, plain = true, seg }) {
  B.bone(name + '1', parent, hip);
  B.bone(name + '2', name + '1', knee);
  const k = V(...knee), h = V(...hip), f = V(...foot);
  const mid = lerp3(k, f, 0.55).add(V(0, (k.y - f.y) * 0.12, 0));
  B.bone(name + '3', name + '2', arr(mid));
  B.loft([
    { p: hip, r: r * 1.2, b: name + '1' },
    { p: arr(lerp3(h, k, 0.5)), r: r * 1.05, b: name + '1' },
    { p: knee, r: r * 0.95, b: name + '2' },
    { p: arr(mid), r: r * 0.7, b: name + '3' },
    { p: foot, r: r * 0.3, b: name + '3' },
  ], { mat: M.skin, seg: seg ?? (B.q ? 7 : 4), color, plain });
}
// the alternating tripod gait of six legs, or the wave of eight
export function legWave(bones, names, phase, amp) {
  names.forEach((n, i) => {
    const side = n.includes('L') ? 0 : Math.PI;
    const ph = phase + (i % 2) * Math.PI + side;
    if (!bones[n + '1']) return;
    bones[n + '1'].rotation.y = Math.sin(ph) * 0.35 * amp;
    bones[n + '1'].rotation.z = Math.max(0, Math.cos(ph)) * 0.3 * amp * (n.includes('L') ? 1 : -1);
  });
}

export { wrap };

// ---- the everyday life of a four-legged animal: walk with the ground it covers, graze, look at
// the van when curious, flick the ears and the tail, blink, breathe. o: { stride, gallopAt, graze }
export function quadLife(c, T, st, dt, env, o = {}) {
  const b = T.bones;
  const p = c.root.position;
  if (!st.last) { st.last = p.clone(); st.blink = blinker(); st.graze = 0; st.gT = 0; }
  const sp = p.distanceTo(st.last) / Math.max(dt, 1e-4) / (c.root.scale.x || 1);
  st.last.copy(p);
  st.speed = damp(st.speed || 0, Math.min(sp, 12), 8, dt);
  quadPose(b, st, { speed: st.speed, dt, stride: o.stride ?? 1.2, gallop: st.speed > (o.gallopAt ?? 3), lift: o.lift ?? 0.5 });
  // grazing comes and goes while it stands; eating a pellet is the same move
  st.gT -= dt;
  if (st.gT <= 0) { st.gT = 2 + Math.random() * 4; st.graze = o.graze !== false && c.state === 'idle' && Math.random() < 0.5 ? 1 : 0; }
  const down = (c.state === 'eat' && st.speed < 0.6) || (st.graze && c.state === 'idle') ? 1 : 0;
  st.down = damp(st.down || 0, down, 2.5, dt);
  b.neck.rotation.x = st.down * (o.reach ?? 0.9) + Math.sin(env.t * 1.3 + c.bob) * 0.02;
  const looking = c.state === 'curious' || (c.state === 'idle' && !st.graze && c.near < 45);
  lookAt(b.head, env.camPos, { yaw: o.yaw ?? 0.9, pitch: 0.5, k: 3, dt, on: looking && st.down < 0.3 });
  if (st.down > 0.3) b.head.rotation.x = damp(b.head.rotation.x, 0.2 + Math.sin(env.t * 9) * 0.05 * st.down, 4, dt);   // nibbling
  if (b.tail1) { b.tail1.rotation.y = Math.sin(env.t * 1.7 + c.bob) * 0.35; b.tail1.rotation.x = -0.15 + st.speed * 0.05; }
  if (b.tail2) b.tail2.rotation.y = Math.sin(env.t * 1.7 + c.bob - 0.8) * 0.4;
  if (b.earL) { const f = Math.sin(env.t * 0.9 + c.bob * 3) > 0.96 ? 0.5 : 0; b.earL.rotation.z = damp(b.earL.rotation.z, f, 12, dt); b.earR.rotation.z = damp(b.earR.rotation.z, -f * 0.6, 12, dt); }
  if (b.eyes) b.eyes.scale.y = st.blink(dt);
  b.chest.scale.x = 1 + Math.sin(env.t * 1.6 + c.bob) * 0.015;
  return st.speed;
}

// ---- one animal in the world: two bodies (near and far), a soft shadow, the shared behaviour, and
// the species' own animation, which only runs while the detailed body is the one on screen.
// o: everything makeCreature takes, plus make(q), radius (metres, at scale 1), scale, shadow, far(c, dt, env)
export function spawn(ctx, o) {
  const T = twoBodies(o.make, { radius: o.radius });
  const s = o.scale ?? 1;
  T.root.scale.setScalar(s);
  if (o.shadow !== false && !o.flyer) T.root.add(blob(ctx.keep, o.shadow ?? o.radius * 0.9));
  ctx.scene.add(T.root);
  const st = {};
  const c = makeCreature({
    ...o, root: T.root, radius: (o.photoRadius ?? o.radius) * s,
    eye: o.eye ? new THREE.Vector3(...o.eye) : undefined,
    ground: o.ground ?? ctx.ground,
    pose(c, dt, env) {
      const near = T.lod.step(env.dist, env.fov || 55);
      if (near) o.pose(c, T, st, dt, env);
      else if (o.far) o.far(c, T, st, dt, env);
    },
  });
  c.body = T; c.st = st;
  return c;
}
