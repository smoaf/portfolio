// The coconut crab (FEAT-015): the biggest crab on land, at the foot of a leaning palm on the river's
// south bank, among fallen coconuts and torn husk fibre.
//
//   coconut-crab   real size: the body about 40 cm (a broad shell over the front, the soft abdomen
//                  curled and tucked under the back like a hermit crab's), the legs spanning about a
//                  metre. Orange-red with paler joints; two massive, uneven front claws (the left
//                  one bigger), three pairs of long walking legs (the small last pair stays tucked
//                  away), long antennae and eyes on short stalks. By day it sits at the foot of the
//                  palm: it tears husk fibre off a coconut on the ground with its big claw, or climbs
//                  a short way up the trunk, legs gripping the bark, and back down. Cracking (most
//                  runs, as the van comes along): it holds a husked coconut and hammers and squeezes
//                  it with the big claw until the shell splits, then picks at the white flesh (the
//                  photo counts it as feeding). Rare pose (about half the runs, its own roll): it
//                  rears up and raises both claws high and wide at the van. Night (coconut crabs are
//                  out at night): it climbs high up the trunk to the coconuts under the crown.
//
// The twist: faint glowing seams along the shell and at the claws' joints (barely there by day, clear
// at night), so it can be made out up the palm after dark.
//
// The palm itself is the route's own (its trunk and its swaying fronds); this file adds the coconuts
// under its crown and the ones lying round its foot. Every moving part is a group; the still meshes in
// each are merged into one mesh coloured per face (`paint`), so the whole crab is ~25 draws up close.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const SPECIES = {
  'coconut-crab': { id: 'coconut-crab', name: 'Coconut crab', points: 210, call: { hz: 520, kind: 'noise' } },
};

const PI = Math.PI, TAU = PI * 2;
const damp = (a, b, k, dt) => a + (b - a) * Math.min(1, k * dt);
const clamp = THREE.MathUtils.clamp;
const ss = (e0, e1, x) => { const u = clamp((x - e0) / (e1 - e0), 0, 1); return u * u * (3 - 2 * u); };
const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), vD = new THREE.Vector3();
const qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), mA = new THREE.Matrix4();
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);

// colours: orange-red, the joints paler, the claw tips dark
const C = {
  shell: 0xb8452a, shellD: 0x9a3a24, leg: 0xc0532e, joint: 0xeab98f, claw: 0xb04629, tip: 0x2e1b14,
  belly: 0xc98a62, abd: 0xc7744c, eye: 0x120d0b, husk: 0x8a6a3e, huskD: 0x6e5230, nut: 0x5a3b22, flesh: 0xf3eee2,
  green: 0x6e7a34,
};
const STAND = 0.12;                          // m, the body's middle above the ground it stands on
// the walking legs: where each joins the body (x, z), its two lengths, its swing phase
const LEGS = [[0.1, 0.055, 0.18, 0.25, 0], [0.108, -0.01, 0.19, 0.27, 2.1], [0.098, -0.075, 0.18, 0.25, 4.2]];

// =============================================================================================
// opts:
//   palm    { foot, dir, S }: the foot of the route's leaning palm, the way it leans (towards the
//           road), its scale (the route's palm trunk is a curve 10 m tall, leaning 1.6 m, r 0.28)
//   yaw     ignored (the crab is turned with its palm)
//   crack   false: no cracking this run (the route rolls it; most runs have it)
//   pose    true: the rare pose this run (the route rolls it, about half the runs)
//   night   true: night, it climbs high up the trunk
export function buildCoconutCrab(K, home, opts = {}) {
  const night = !!opts.night;
  const palm = opts.palm;
  const S = palm.S, R = 0.28 * S;            // the trunk's radius
  // the trunk in the root's frame: the root stands on the palm's foot, +z the way it leans (to the road)
  const P0 = new THREE.Vector3(0, 0, 0), P1 = new THREE.Vector3(0, 5 * S, 0.4 * S), P2 = new THREE.Vector3(0, 10 * S, 1.6 * S);
  const trunk = new THREE.QuadraticBezierCurve3(P0, P1, P2);
  const TLEN = trunk.getLength();

  const shell = K.mat(C.shell), shellD = K.mat(C.shellD), legM = K.mat(C.leg), joint = K.mat(C.joint), clawM = K.mat(C.claw);
  const tipM = K.mat(C.tip), belly = K.mat(C.belly), abdM = K.mat(C.abd), eyeM = K.sheen(C.eye, { roughness: 0.15 });
  const glow = K.glow(0x9ff3df, night ? 0.9 : 0.45, { color: 0xd8c2a8 });
  const mot = (m) => { m.userData.mottle = true; return m; };
  const part = (g, m, p, parent, r, s) => mot(K.mesh(g, m, p, parent, r, s));

  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  const BODY = K.group(null, near);           // placed every frame: on the ground or on the trunk
  const LIFT = K.group(null, BODY);           // how high it stands (the pose rears it up)

  // ---- the body: a broad shell over the front, the branchial bulges at its back sides, a narrow
  // front with the eye stalks; the curled abdomen tucked under the back
  const B = K.group(null, LIFT);
  part(K.sphere(1, 16, 12), shell, [0, 0.015, -0.012], B, null, [0.12, 0.068, 0.14]);
  for (const s of [-1, 1]) part(K.sphere(1, 12, 9), shell, [s * 0.063, 0.005, -0.056], B, null, [0.075, 0.062, 0.094]);
  part(K.sphere(1, 12, 9), shellD, [0, 0.0, 0.108], B, null, [0.072, 0.045, 0.062]);
  part(K.cone(0.022, 0.055, 6), shellD, [0, 0.01, 0.165], B, [PI / 2, 0, 0]);                        // the rostrum
  part(K.sphere(1, 12, 8), belly, [0, -0.038, 0.0], B, null, [0.106, 0.038, 0.125]);                      // the underside
  // the abdomen: soft, curled forward under the back (as a hermit crab's would sit in its shell)
  part(K.sphere(1, 12, 9), abdM, [0, -0.056, -0.15], B, null, [0.088, 0.068, 0.094]);
  for (let i = 0; i < 3; i++) part(K.torus(0.075 - i * 0.015, 0.007, 4, 14), shellD, [0, -0.056 - i * 0.015, -0.15 - i * 0.027], B, [0.4 + i * 0.5, 0, 0], [1, 1, 0.8]);
  // small mouthparts under the front
  for (const s of [-1, 1]) part(K.box(0.022, 0.036, 0.014), joint, [s * 0.017, -0.025, 0.14], B, [0.3, 0, 0]);
  // eyes on short stalks
  for (const s of [-1, 1]) {
    part(K.cyl(0.007, 0.009, 0.035, 5), joint, [s * 0.027, 0.038, 0.15], B, [0.5, 0, -s * 0.3]);
    const e = K.mesh(K.sphere(1, 8, 6), eyeM, [s * 0.033, 0.056, 0.16], B, null, 0.013); e.userData.wet = true;
  }
  // the glowing seams: the groove across the shell and its two side edges
  K.mesh(K.tube('ccSeamX', [[-0.1, 0.045, 0.025], [-0.05, 0.077, 0.05], [0, 0.084, 0.056], [0.05, 0.077, 0.05], [0.1, 0.045, 0.025]], 0.0035, 0.0035, 4, 12), glow, null, B);
  for (const s of [-1, 1]) K.mesh(K.tube('ccSeam' + s, [[s * 0.112, 0.015, 0.075], [s * 0.13, 0.015, -0.025], [s * 0.118, 0.012, -0.1], [s * 0.075, 0.01, -0.145]], 0.003, 0.003, 4, 12), glow, null, B);

  // ---- the antennae: long, thin, swept forward and out; they flick
  const ants = [-1, 1].map((s) => {
    const g = K.group([s * 0.015, 0.025, 0.165], B);
    part(K.tube('ccAnt' + s, [[0, 0, 0], [s * 0.04, 0.05, 0.12], [s * 0.11, 0.07, 0.26], [s * 0.18, 0.06, 0.38]], 0.0045, 0.0015, 4, 10), legM, null, g);
    return { g, s };
  });

  // ---- the walking legs: two-bone, posed by IK every frame (see `legs`)
  const legs = [];
  for (const s of [-1, 1]) for (const [lx, lz, L1, L2, ph] of LEGS) {
    const hip = K.group([s * lx, -0.005, lz], B);
    part(K.capsule(0.016, L1 - 0.03, 3, 6), legM, [L1 / 2, 0, 0], hip, [0, 0, -PI / 2]);
    part(K.sphere(1, 7, 5), joint, [0, 0, 0], hip, null, 0.019);
    part(K.box(L1 * 0.7, 0.006, 0.02), shellD, [L1 * 0.5, 0.014, 0], hip);                          // a darker ridge on top
    const knee = K.group([L1, 0, 0], hip);
    part(K.sphere(1, 7, 5), joint, [0, 0, 0], knee, null, 0.017);
    part(K.cone(0.014, L2 * 0.8, 6), legM, [L2 * 0.4, 0, 0], knee, [0, 0, -PI / 2]);
    part(K.cone(0.006, L2 * 0.25, 5), tipM, [L2 * 0.88, 0, 0], knee, [0, 0, -PI / 2]);
    part(K.sphere(1, 6, 4), joint, [L2 * 0.62, 0, 0], knee, null, [0.014, 0.012, 0.012]);         // the pale band of the last joint
    legs.push({ hip, knee, s, lx, lz, L1, L2, ph });
  }
  // the small last pair, tucked up against the back
  for (const s of [-1, 1]) part(K.capsule(0.009, 0.07, 2, 5), legM, [s * 0.075, -0.025, -0.125], B, [0.2, 0, s * 1.1]);

  // ---- the front claws: the left (s = 1) much bigger than the right
  const claws = [1, -1].map((s) => {
    const k = s > 0 ? 1 : 0.72;
    const sh = K.group([s * 0.08, -0.015, 0.11], B);
    part(K.sphere(1, 7, 5), joint, [0, 0, 0], sh, null, 0.02 * k + 0.004);
    part(K.capsule(0.022 * k, 0.09 * k, 3, 7), clawM, [0, 0, 0.055 * k], sh, [PI / 2, 0, 0]);         // the arm (merus)
    const el = K.group([0, 0, 0.11 * k], sh);
    part(K.sphere(1, 7, 5), joint, [0, 0, 0], el, null, 0.022 * k);
    part(K.capsule(0.022 * k, 0.04 * k, 3, 7), clawM, [0, 0, 0.035 * k], el, [PI / 2, 0, 0]);         // the wrist (carpus)
    K.mesh(K.torus(0.024 * k, 0.0028, 4, 14), glow, [0, 0, 0.0], el);
    const wr = K.group([0, 0, 0.07 * k], el);
    part(K.sphere(1, 7, 5), joint, [0, 0, 0], wr, null, 0.026 * k);
    K.mesh(K.torus(0.03 * k, 0.003, 4, 14), glow, [0, 0, 0.004], wr);
    // the palm: massive, swollen, a little knobbly; the fixed finger below, the movable one above
    part(K.sphere(1, 12, 9), clawM, [0, 0, 0.07 * k], wr, null, [0.042 * k, 0.055 * k, 0.08 * k]);
    for (let i = 0; i < 6; i++) part(K.sphere(1, 5, 4), shellD, [Math.sin(i * 2.4) * 0.03 * k, 0.03 * k + (i % 2) * 0.01 * k, 0.04 * k + i * 0.012 * k], wr, null, 0.008 * k);
    part(K.cone(0.022 * k, 0.085 * k, 7), clawM, [0, -0.022 * k, 0.175 * k], wr, [PI / 2, 0, 0], [1, 1, 0.75]);
    part(K.cone(0.008 * k, 0.03 * k, 5), tipM, [0, -0.022 * k, 0.225 * k], wr, [PI / 2, 0, 0]);
    const fi = K.group([0, 0.024 * k, 0.13 * k], wr);
    K.mesh(K.torus(0.016 * k, 0.003, 4, 12), glow, [0, 0, 0], fi, [0, PI / 2, 0]);
    part(K.cone(0.019 * k, 0.1 * k, 7), clawM, [0, 0, 0.05 * k], fi, [PI / 2, 0, 0], [1, 1, 0.75]);
    part(K.cone(0.007 * k, 0.03 * k, 5), tipM, [0, 0, 0.105 * k], fi, [PI / 2, 0, 0]);
    return { sh, el, wr, fi, s, k, a: { y: 0, x: 0, e: 0, w: 0, f: 0 } };
  });

  // ---- the coconut it cracks: husked (bare brown shell with its three eyes); two halves that part
  const NUT = K.group(null, root);
  const halves = [1, -1].map((s) => {
    const g = K.group(null, NUT);
    const sh = K.geo('ccHalf', () => new THREE.SphereGeometry(1, 14, 8, 0, TAU, 0, PI / 2));
    K.mesh(sh, K.mat(C.nut, { side: THREE.DoubleSide, roughness: 0.85 }), [0, 0, 0], g, [s > 0 ? 0 : PI, 0, 0], [0.068, 0.075, 0.068]);
    K.mesh(K.geo('ccFlesh', () => new THREE.CircleGeometry(1, 14)), K.mat(C.flesh, { roughness: 0.6 }), [0, s * 0.001, 0], g, [s > 0 ? PI / 2 : -PI / 2, 0, 0], 0.06);
    if (s > 0) for (let i = 0; i < 3; i++) { const a = i * TAU / 3; K.mesh(K.sphere(1, 5, 4), K.mat(0x2a1a10), [Math.cos(a) * 0.012, 0.072, Math.sin(a) * 0.012], g, null, 0.006); }
    return { g, s };
  });
  const crackLine = K.mesh(K.torus(0.069, 0.0025, 3, 20), K.mat(0x1a100a), [0, 0, 0], NUT, [PI / 2, 0, 0]);
  crackLine.userData.keep = true;
  NUT.rotation.z = PI / 2;                    // lying on its side, the halves split left and right

  // ---- the fibres it tears off (a few strands that fly and fall), in the root's frame
  const fibM = K.mat(C.husk, { roughness: 0.95 });
  const fibres = [];
  for (let i = 0; i < 5; i++) {
    const m = K.mesh(K.box(0.008, 0.004, 0.13), fibM, [0, 0, 0], root);
    m.userData.keep = true; m.visible = false;
    fibres.push({ m, t: -1, v: new THREE.Vector3(), spin: 0 });
  }

  // ---- far: a body, two claws, the leg span
  K.mesh(K.sphere(1, 8, 6), shell, [0, 0.01, 0], far, null, [0.1, 0.06, 0.13]);
  K.mesh(K.sphere(1, 6, 5), clawM, [0.07, 0, 0.17], far, null, [0.05, 0.06, 0.09]);
  K.mesh(K.sphere(1, 6, 5), clawM, [-0.06, 0, 0.15], far, null, [0.035, 0.045, 0.065]);
  K.mesh(K.box(0.8, 0.02, 0.18), legM, [0, -0.04, -0.01], far);
  const FAR = far;

  paint(K, near);
  K.place(root, home);
  root.rotation.y = Math.atan2(palm.dir.x, palm.dir.z);
  root.updateMatrixWorld(true);
  // the ground in front of the trunk, in the root's frame (where it sits, and where the nut lies)
  const groundAt = (z, x = 0) => { vA.set(x, 0, z); root.localToWorld(vA); return K.groundY(vA.x, vA.z) - root.position.y; };
  const G = { z: 0.5, y: groundAt(0.5) };                 // where it sits at the foot, facing the road
  const NUTZ = 0.8;                                        // where the coconut lies in front of it
  const tearAt = new THREE.Vector3(0.08, groundAt(1.0, 0.08) + 0.08, 1.0);   // the husked one it tears at (scenery)

  // the coconuts: under the crown, and lying round the foot (one with its husk torn ragged), plus
  // loose fibre on the ground. Scenery: in the scene itself, so they never go when the crab is culled.
  const props = new THREE.Group();
  {
    const top = trunk.getPointAt(0.97);
    const husk = K.mat(C.green, { roughness: 0.7 }), huskB = K.mat(C.husk, { roughness: 0.9 }), huskD = K.mat(C.huskD, { roughness: 0.95 });
    for (let i = 0; i < 6; i++) {
      const a = i * 1.1 + 0.4, r = 0.2 + (i % 2) * 0.05;
      K.mesh(K.sphere(1, 10, 8), i % 3 === 2 ? huskB : husk, [top.x + Math.cos(a) * r, top.y - 0.25 - (i % 3) * 0.08, top.z + Math.sin(a) * r], props, [0.3, a, 0], [0.11, 0.13, 0.11]);
    }
    const lying = [[0.75, -0.5, huskB, 0.3], [-0.55, -0.15, husk, 1.2], [0.35, -0.75, huskD, 2]];
    for (const [x, z, m, ry] of lying) K.mesh(K.sphere(1, 10, 8), m, [x, groundAt(z, x) + 0.09, z], props, [PI / 2, ry, 0], [0.1, 0.13, 0.1]);
    // the one it tears at: ragged, half its husk gone
    K.mesh(K.sphere(1, 10, 8), huskB, [tearAt.x, tearAt.y, tearAt.z], props, [PI / 2, 0.6, 0], [0.095, 0.12, 0.095]);
    K.mesh(K.sphere(1, 10, 8), huskD, [tearAt.x + 0.03, tearAt.y + 0.02, tearAt.z - 0.02], props, [PI / 2, 0.6, 0], [0.08, 0.1, 0.085]);
    // loose fibre and torn husk strips
    for (let i = 0; i < 16; i++) {
      const a = i * 2.39, r = 0.25 + (i % 5) * 0.14, x = Math.cos(a) * r, z = 0.35 + Math.sin(a) * r * 0.8;
      K.mesh(K.box(0.012, 0.004, 0.12 + (i % 3) * 0.04), i % 2 ? huskB : huskD, [x, groundAt(z, x) + 0.004, z], props, [0, a, 0]);
    }
    // two old split shells
    for (const [x, z] of [[-0.35, 0.75], [0.5, 0.3]]) {
      const g = K.group([x, groundAt(z, x) + 0.01, z], props, [0, x * 5, 0]);
      K.mesh(K.geo('ccHalf', () => new THREE.SphereGeometry(1, 14, 8, 0, TAU, 0, PI / 2)), K.mat(C.nut, { side: THREE.DoubleSide, roughness: 0.85 }), [0, 0.06, 0], g, [PI, 0, 0], [0.068, 0.065, 0.068]);
      K.mesh(K.geo('ccHalf', () => new THREE.SphereGeometry(1, 14, 8, 0, TAU, 0, PI / 2)), K.mat(C.flesh, { side: THREE.DoubleSide, roughness: 0.6 }), [0, 0.062, 0], g, [PI, 0, 0], [0.06, 0.055, 0.06]);
    }
    props.position.copy(root.position); props.rotation.copy(root.rotation);
    paint(K, props, true);
    K.scene.add(props);
  }

  // ---- the behaviour, decided here (its own, not the shared state machine):
  //   idle    sitting at the foot of the palm, facing the road, antennae flicking
  //   tear    tearing fibre off the husked coconut on the ground with the big claw
  //   climb   a short way up the trunk and back down (day); high up to the coconuts (night)
  //   eat     the cracking: hammers and squeezes a coconut until it splits, picks at the flesh
  //   rare    the pose: rears up and raises both claws high and wide at the van
  const st = {
    face: 0, mount: 0, t: 0.02, tWant: 0.02, cp: 'turn', cT: 0, crack: 0, open: 0, ph: 0, moving: 0,
    crackRun: opts.crack !== false, poseRun: !!opts.pose, cracked: false, posed: false, lastD: 1e9, seq: 0,
    hitT: -9,
  };
  const c = K.makeCreature({
    species: SPECIES['coconut-crab'], root, home, radius: 0.5, eye: new THREE.Vector3(0, 0.15, 0.4), flyer: true,
    speed: 0, roam: 0, fleeAt: 0, curiousAt: 0, shy: 1, rareChance: 0, yaw: root.rotation.y, poseLen: 5.5,
  });
  c.air = true;                                  // on the palm: it neither turns round to feed nor takes part in the shared poses
  c.state = night ? 'climb' : 'idle';
  c.hold = night ? 1e9 : 3;
  if (night) { st.t = st.tWant = 0.3; st.face = 1; st.mount = 1; }
  c.setRun = (o) => { if ('crack' in o) { st.crackRun = o.crack; st.cracked = false; } if ('pose' in o) { st.poseRun = o.pose; st.posed = false; } if ('t' in o) st.t = o.t; };   // tests
  c.info = () => ({ state: c.state, t: +st.t.toFixed(3), up: +(trunk.getPointAt(st.t).y).toFixed(2), crack: +st.crack.toFixed(2), open: +st.open.toFixed(2), crackRun: st.crackRun, poseRun: st.poseRun });
  const go = (s, hold) => { c.state = s; c.t = 0; c.hold = hold; };
  c.go = go;

  const cycle = ['tear', 'climb', 'idle', 'tear', 'idle', 'climb'];
  c.step = (dt, env) => {
    c.t += dt;
    const d = env.dist;
    const coming = d < st.lastD || d < 12;
    st.lastD = d;
    const down = st.mount < 0.02 && st.face < 0.02;           // sitting on the ground, facing the road
    // the van coming: the pose (if this run has it), then the cracking as it passes
    if (!night && coming) {
      if (st.poseRun && !st.posed && d < 34 && c.state !== 'rare') {
        if (down) { st.posed = true; go('rare', 5.5); if (env.call) env.call(c, 'rare'); } else if (c.state !== 'descend') go('descend', 1e9);
      } else if (st.crackRun && !st.cracked && d < 42 && c.state !== 'rare' && (!st.poseRun || st.posed)) {
        if (down) { st.cracked = true; go('eat', 24); st.crack = 0; st.open = 0; } else if (c.state !== 'descend') go('descend', 1e9);
      }
    }
    switch (c.state) {
      case 'idle':
        st.tWant = 0.02; st.face = damp(st.face, 0, 2.5, dt);
        if (c.t > c.hold && !night) {
          // the van near: it stays on the ground (so the cracking can start); otherwise its round
          let n = cycle[st.seq++ % cycle.length];
          if (n === 'climb' && d < 70) n = 'tear';
          go(n, n === 'tear' ? 7 + (st.seq % 3) : 13);
        }
        break;
      case 'tear':
        st.tWant = 0.02;
        if (c.t > c.hold) go('idle', 2 + (st.seq % 3));
        break;
      case 'descend':
        // back down at once and turn to the road
        st.tWant = 0.02;
        if (st.t < 0.03) { st.mount = damp(st.mount, 0, 3, dt); if (st.mount < 0.05) { st.mount = 0; st.face = damp(st.face, 0, 3.5, dt); if (st.face < 0.03) { st.face = 0; go('idle', 0.2); } } }
        break;
      case 'climb': {
        // turn to the trunk, onto it, up, a pause, down, off, turn back (day); at night up and up
        if (night) {
          st.tWant = 0.8;
          if (st.t > 0.79) go('high', 1e9);
          break;
        }
        if (c.t < dt * 1.5) { st.cp = 'turn'; st.cT = 0; }
        st.cT += dt;
        const ph = st.cp;
        if (ph === 'turn') { st.face = damp(st.face, 1, 3, dt); if (st.face > 0.97) { st.face = 1; st.cp = 'on'; st.cT = 0; } }
        else if (ph === 'on') { st.mount = ss(0, 1, st.cT); if (st.cT > 1) { st.mount = 1; st.cp = 'up'; st.cT = 0; } }
        else if (ph === 'up') { st.tWant = 0.16; if (st.t > 0.155) { st.cp = 'wait'; st.cT = 0; } }
        else if (ph === 'wait') { if (st.cT > 2.2) { st.cp = 'down'; st.cT = 0; } }
        else if (ph === 'down') { st.tWant = 0.02; if (st.t < 0.025) { st.cp = 'off'; st.cT = 0; } }
        else if (ph === 'off') { st.mount = 1 - ss(0, 1, st.cT); if (st.cT > 1) { st.mount = 0; st.cp = 'back'; st.cT = 0; } }
        else { st.face = damp(st.face, 0, 3, dt); if (st.face < 0.03) { st.face = 0; go('idle', 2); } }
        break;
      }
      case 'high':
        st.tWant = 0.8;                                         // up at the coconuts, tugging at one
        break;
      case 'eat':
        if (c.t > c.hold) go('idle', 3);
        break;
      case 'rare':
        if (c.t > c.hold) go('idle', 0.5);
        break;
      default:
        go('idle', 1);
    }
    // climbing: along the trunk at a crab's pace (~0.18 m/s, slower high up at night)
    const v = (night ? 0.14 : 0.2) / TLEN;
    const dtT = clamp(st.tWant - st.t, -v * dt, v * dt);
    if (st.mount > 0.98 || dtT < 0) st.t += dtT;
    st.t = Math.max(0.02, st.t);
    const shuffling = (c.state === 'climb' && (st.cp === 'turn' || st.cp === 'back' || st.cp === 'on' || st.cp === 'off')) || (c.state === 'descend' && st.t < 0.03);
    st.moving = damp(st.moving, Math.abs(dtT) > 1e-6 ? 1 : shuffling ? 0.6 : 0, 6, dt);
    place(dt);
    pose(dt, env);
    stepFibres(dt);
    c.root.updateMatrixWorld();
  };

  // where the body is: on the ground (facing the road, or turned to the trunk), or on the trunk
  const mG = new THREE.Matrix4(), pG = new THREE.Vector3(), pC = new THREE.Vector3(), nC = new THREE.Vector3(), tC = new THREE.Vector3();
  function place() {
    // on the ground: turned from the road (face 0) to the trunk (face 1), a little nearer the trunk when turned
    const yaw = st.face * PI;
    pG.set(0, G.y + STAND, G.z - st.face * 0.12);
    qA.setFromAxisAngle(Y, yaw);
    // on the trunk at t: the belly against the bark on the side facing the road, the head up
    trunk.getPointAt(st.t, pC); trunk.getTangentAt(st.t, tC);
    nC.copy(Z).addScaledVector(tC, -Z.dot(tC)).normalize();
    pC.addScaledVector(nC, R + STAND * 0.85);
    vB.crossVectors(nC, tC);                                   // the body's x: up × forward
    mA.makeBasis(vB, nC, tC);
    qB.setFromRotationMatrix(mA);
    const m = st.mount;
    BODY.position.lerpVectors(pG, pC, m);
    // over the edge: lifted a little at mid-mount, so the belly never cuts the bark
    BODY.position.addScaledVector(nC, Math.sin(m * PI) * 0.05);
    BODY.quaternion.copy(qA).slerp(qB, m);
  }

  // the legs: the tips on the ground plane (or round the trunk), stepping while it moves
  function legsPose(dt, env, grip, rise) {
    st.ph += dt * (2 + st.moving * 7);
    for (const L of legs) {
      const sw = st.moving * Math.sin(st.ph + L.ph + (L.s > 0 ? 0 : PI));
      // the tip: out to the side, a little forward or back with the step, down on the surface
      const outX = THREE.MathUtils.lerp(0.45, 0.22, grip) + rise * 0.02;
      const downY = -STAND - rise + THREE.MathUtils.lerp(0, -0.11, grip) + Math.max(0, Math.cos(st.ph + L.ph + (L.s > 0 ? 0 : PI))) * st.moving * 0.04;
      vA.set(L.s * outX, downY, L.lz * 2.6 + sw * 0.05 + (L.lz > 0 ? 0.08 : -0.02));
      // a little breathing shift at rest
      vA.z += Math.sin(env.t * 0.7 + L.ph) * 0.006;
      // to the hip's frame
      const dx = vA.x - L.s * L.lx, dy = vA.y + 0.005, dz = vA.z - L.lz;
      const r = Math.hypot(dx, dz), D = clamp(Math.hypot(r, dy), 0.05, L.L1 + L.L2 - 0.005);
      const psi = Math.atan2(-dz, dx), beta = Math.atan2(dy, r);
      const a1 = beta + Math.acos(clamp((L.L1 * L.L1 + D * D - L.L2 * L.L2) / (2 * L.L1 * D), -1, 1));
      const g = Math.acos(clamp((L.L1 * L.L1 + L.L2 * L.L2 - D * D) / (2 * L.L1 * L.L2), -1, 1));
      L.hip.rotation.set(0, psi, a1);
      L.knee.rotation.set(0, 0, -(PI - g));
    }
  }

  // the claws: each from its own few angles (y: out, x: up, e: elbow in, w: wrist, f: finger open)
  function clawSet(cl, dt, to, k = 8) {
    const a = cl.a;
    for (const key of ['y', 'x', 'e', 'w', 'f']) a[key] = damp(a[key], to[key], k, dt);
    cl.sh.rotation.set(-a.x, cl.s * a.y, 0, 'YXZ');
    cl.el.rotation.set(0, -cl.s * a.e, 0);
    cl.wr.rotation.set(-a.w, 0, 0);
    cl.fi.rotation.set(-a.f, 0, 0);
  }
  const REST = { y: 0.55, x: 0.15, e: 1.5, w: 0.1, f: 0.05 };
  const big = claws[0], small = claws[1];

  function pose(dt, env) {
    const T = c.t, s = c.state, t = env.t;
    let rise = 0, grip = st.mount, bigTo = REST, smallTo = REST, bodyPitch = 0, antUp = 0;
    if (s === 'tear' && st.mount < 0.05) {
      // reach out to the coconut, close on the husk, tear back, flick the strand away (2.2 s a pull)
      const k = (T % 2.2) / 2.2;
      const reach = ss(0, 0.3, k) * (1 - ss(0.45, 0.75, k));
      bigTo = { y: 0.4 - reach * 0.15, x: 0.25 - reach * 0.38, e: 1.3 - reach * 1.1, w: 0.2 - reach * 0.5, f: k < 0.3 ? 0.55 : 0.05 };
      smallTo = { y: 0.5, x: 0.05, e: 1.3, w: 0.2, f: 0.1 };
      bodyPitch = reach * 0.12;
      if (k > 0.55 && st.lastPull !== Math.floor(T / 2.2)) { st.lastPull = Math.floor(T / 2.2); throwFibre(); }
    } else if (s === 'eat') {
      // the nut: picked up from the ground (0-1.4 s), held in front, hammered (1.4-9 s), squeezed
      // until it splits (9-11.5 s), then the flesh picked at with the small claw
      rise = 0.015;
      if (T < 1.4) {
        bigTo = { y: 0.25, x: 0.4, e: 0.6, w: -0.9, f: 0.4 };
        smallTo = { y: 0.3, x: 0.35, e: 1.0, w: -0.8, f: 0.3 };
      } else if (T < 9) {
        const k = ((T - 1.4) % 1.08) / 1.08;                   // raise, strike, rest
        const up = ss(0, 0.5, k) * (1 - ss(0.62, 0.7, k));
        bigTo = { y: 0.2, x: 0.35 + up * 0.95, e: 0.6, w: -1.1 + up * 1.0, f: 0.08 };
        smallTo = { y: 0.3, x: 0.35, e: 1.0, w: -0.8, f: 0.05 };
        if (k > 0.68 && st.lastHit !== Math.floor((T - 1.4) / 1.08)) {
          st.lastHit = Math.floor((T - 1.4) / 1.08); st.hitT = t; st.crack = Math.min(1, st.crack + 0.16);
          if (env.call && env.dist < 35 && st.lastHit % 2 === 0) env.call(c, 'eat');
        }
        bodyPitch = up * -0.06;
      } else if (T < 11.5) {
        const sq = ss(9, 9.6, T);
        bigTo = { y: 0.25, x: 0.35, e: 0.6, w: -1.05, f: 0.35 - sq * 0.33 };
        smallTo = { y: 0.3, x: 0.35, e: 1.0, w: -0.8, f: 0.05 };
        st.crack = 1;
        st.open = ss(10.2, 11.4, T);
      } else {
        // picking: the small claw dips into the open nut and comes back to the mouth
        const k = ((T - 11.5) % 1.6) / 1.6, dip = Math.sin(k * PI);
        bigTo = { y: 0.7, x: 0.75, e: 1.3, w: 0.1, f: 0.1 };
        smallTo = { y: 0.3, x: 0.1 + dip * 0.25, e: 1.6 - dip * 0.6, w: 0.4 - dip * 1.2, f: 0.05 + dip * 0.15 };
        st.open = 1;
      }
    } else if (s === 'rare') {
      // rears up high on its legs, both claws raised high and wide, open, towards the van; a quiver
      const k = ss(0, 0.8, T) * (1 - ss(c.hold - 0.8, c.hold, T));
      rise = k * 0.08;
      bodyPitch = -k * 0.32;
      antUp = k;
      const q = Math.sin(t * 17) * 0.04 * k;
      bigTo = { y: 0.55 + k * 0.75, x: 0.15 + k * 1.05 + q, e: 1.5 - k * 1.25, w: 0.1 - k * 0.3, f: 0.05 + k * 0.65 };
      smallTo = { y: 0.55 + k * 0.75, x: 0.15 + k * 1.0 - q, e: 1.5 - k * 1.2, w: 0.1 - k * 0.3, f: 0.05 + k * 0.65 };
    } else if (st.mount > 0.3) {
      // on the trunk: the claws grip the bark ahead, in turn as it climbs
      const g = st.moving * Math.sin(st.ph * 0.5);
      bigTo = { y: 0.75, x: 0.35 + g * 0.2, e: 0.95, w: -0.1, f: 0.25 };
      smallTo = { y: 0.8, x: 0.35 - g * 0.2, e: 0.95, w: -0.1, f: 0.25 };
      if (s === 'high') {
        // up at the coconuts: tugs at one with the big claw
        const k = (t % 3.2) / 3.2, pull = Math.sin(k * PI) * (k < 0.5 ? 1 : 0.4);
        bigTo = { y: 0.45, x: 0.9 + pull * 0.25, e: 0.6, w: -0.3 - pull * 0.2, f: k < 0.25 ? 0.5 : 0.05 };
      }
    }
    LIFT.position.y = rise + Math.sin(t * 1.3 + c.bob) * 0.002;
    LIFT.rotation.x = damp(LIFT.rotation.x, bodyPitch, 6, dt);
    legsPose(dt, env, grip, rise);
    clawSet(big, dt, bigTo, s === 'eat' && T > 1.4 && T < 9 ? 14 : 8);
    clawSet(small, dt, smallTo);
    // the antennae: a slow sweep and now and then a quick flick; raised in the pose
    for (const a of ants) {
      const flick = Math.max(0, Math.sin(t * 0.9 + a.s * 1.7 + c.bob)) ** 12;
      a.g.rotation.x = damp(a.g.rotation.x, -0.15 - antUp * 0.7 + Math.sin(t * 1.7 + a.s) * 0.12 - flick * 0.5, 10, dt);
      a.g.rotation.y = damp(a.g.rotation.y, a.s * (Math.sin(t * 1.1 + a.s * 2) * 0.2 + flick * 0.3), 10, dt);
    }
    // the coconut on the ground in front of it: held while it cracks it (jolting at each strike), then
    // split open; left lying split after it is done (by day; at night it is up the palm)
    NUT.visible = !night;
    crackLine.visible = st.crack > 0.3 && st.open < 0.05;
    if (NUT.visible) {
      const jolt = Math.max(0, 1 - (t - st.hitT) / 0.12);
      const gy = groundAt(NUTZ);
      NUT.position.set(0.03 - st.open * 0.07, gy + 0.07 - jolt * 0.012 - st.open * 0.03, NUTZ - st.open * 0.04);
      for (const h of halves) { h.g.rotation.x = h.s * st.open * 1.05; h.g.position.y = h.s * st.open * 0.035; }
    }
    // the photo point: the middle of the body
    c.root.updateMatrixWorld();
    B.getWorldPosition(vA);
    c.eye.copy(c.root.worldToLocal(vA));
  }

  // a strand torn off: from the big claw, flicked out to the side, falls and lies a moment
  function throwFibre() {
    const f = fibres.find((x) => x.t < 0) || fibres[0];
    big.fi.updateWorldMatrix(true, false);
    big.fi.getWorldPosition(vA); c.root.worldToLocal(vA);
    f.m.position.copy(vA); f.t = 0; f.m.visible = true;
    f.v.set(0.5 + Math.random() * 0.4, 0.9, 0.2 + Math.random() * 0.3);
    f.spin = 4 + Math.random() * 4;
    f.y0 = groundAt(vA.z, vA.x) + 0.004;
  }
  function stepFibres(dt) {
    for (const f of fibres) {
      if (f.t < 0) continue;
      f.t += dt;
      if (f.m.position.y > f.y0) {
        f.v.y -= 6 * dt;
        f.m.position.addScaledVector(f.v, dt);
        f.m.rotation.y += f.spin * dt; f.m.rotation.x += f.spin * 0.5 * dt;
        if (f.m.position.y <= f.y0) { f.m.position.y = f.y0; f.m.rotation.x = 0; }
      }
      if (f.t > 4) { f.t = -1; f.m.visible = false; }
    }
  }

  place(0);
  pose(0, { t: 0, dist: 99 });
  c.root.updateMatrixWorld(true);
  K.lod(c, near, FAR, 34);
  // the far body follows the near one's place
  const setLod = c.lod;
  c.lod = (dd) => { setLod(dd); if (c.far) { FAR.position.copy(BODY.position); FAR.quaternion.copy(BODY.quaternion); } };
  return c;
}

// Merge every group's still meshes into one mesh coloured per face, whatever their material; skin
// parts (`mottle`) get a slightly uneven shade per face. The glowing seams and the wet eyes keep
// their own materials (K.bake merges those).
const glows = (m) => m.emissiveIntensity > 0 && (m.emissive.r + m.emissive.g + m.emissive.b) > 0;
function paint(K, root, all = false) {
  const mat = K.mat(0xffffff, { vertexColors: true, roughness: 0.62, side: THREE.DoubleSide });
  const groups = [];
  root.traverse((o) => { if (!o.isMesh) groups.push(o); });
  const col = new THREE.Color(), cen = new THREE.Vector3();
  for (const gr of groups) {
    const list = gr.children.filter((ch) => ch.isMesh && !ch.userData.keep && !ch.userData.wet && !ch.children.length && !glows(ch.material) && !ch.material.transparent);
    if (!list.length) continue;
    const parts = list.map((ch) => {
      ch.updateMatrix();
      const g = ch.geometry.index ? ch.geometry.toNonIndexed() : ch.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      g.applyMatrix4(ch.matrix);
      const pos = g.attributes.position, n = pos.count, out = new Float32Array(n * 3);
      for (let i = 0; i < n; i += 3) {
        col.copy(ch.material.color);
        if (ch.userData.mottle || all) {
          cen.fromBufferAttribute(pos, i).add(vA.fromBufferAttribute(pos, i + 1)).add(vA.fromBufferAttribute(pos, i + 2)).multiplyScalar(1 / 3);
          col.multiplyScalar(0.92 + hash(cen.x * 53, cen.y * 53, cen.z * 53) * 0.14);
        }
        for (let j = 0; j < 3 && i + j < n; j++) { out[(i + j) * 3] = col.r; out[(i + j) * 3 + 1] = col.g; out[(i + j) * 3 + 2] = col.b; }
      }
      g.setAttribute('color', new THREE.BufferAttribute(out, 3));
      return g;
    });
    const merged = parts.length > 1 ? mergeGeometries(parts, false) : parts[0];
    if (parts.length > 1) parts.forEach((g) => g.dispose());
    if (!merged) continue;
    K.keep(merged);
    list.forEach((ch) => gr.remove(ch));
    gr.add(new THREE.Mesh(merged, mat));
  }
}

export const BUILDERS = {
  'coconut-crab': buildCoconutCrab,
};
