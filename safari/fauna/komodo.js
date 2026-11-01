// The Komodo dragon (FEAT-012): the biggest living lizard, patrolling the last stretch of the canyon
// floor ("Back on the floor"), on the side of the road away from the river.
//
//   komodo-dragon   about 2.7 m from snout to tail tip, the tail as long as the body. Rough, bead-like
//                   grey-brown scales (every facet its own shade), loose folds of skin on the neck and
//                   throat, a long flat head with small eyes, serrated teeth hidden behind the lips
//                   (they show only when the mouth opens), strong curved claws, a massive tail. It walks
//                   slowly with a heavy, swaying gait: the legs bowed out to the sides, the body low and
//                   bending from side to side with each step, the head swinging, the thick tail dragging
//                   and curving behind. Every few seconds its long yellow forked tongue flicks out to
//                   taste the air; as the van passes it turns its head towards it. Feed: it walks to it,
//                   sniffs at it with quick tongue flicks and gulps it down. Rare pose (about half the
//                   runs, one of the two per run): it rears up on its hind legs, propped on its tail, and
//                   looks around; or it raises itself high, puffs up its throat, opens its mouth wide and
//                   hisses at the van.
//
// By day it patrols a line beside the road, walking towards the oncoming van, now and then stopping
// to taste the air. At night it lies flat in a shallow scrape under a rock overhang (`buildDen`), its
// head out towards the road, resting. The twist: faint glowing dots along the back and the tail,
// barely there by day, clear at night.
//
// The still parts of each moving group are merged into one mesh coloured per face (`paint`), so the
// whole animal is about thirty draws up close and one far off.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FEED_REACH } from '../creature.js';

export const SPECIES = {
  'komodo-dragon': { id: 'komodo-dragon', name: 'Komodo dragon', points: 240, call: { hz: 2400, kind: 'noise' } },
};

const PI = Math.PI;
const damp = (a, b, k, dt) => a + (b - a) * Math.min(1, k * dt);
const clamp = THREE.MathUtils.clamp;
const vA = new THREE.Vector3();
const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };

// the skin: an icosphere with every vertex pushed in or out a little, drawn flat-shaded, so the
// surface reads as rows of small rough beads (shared positions move together: no cracks)
function beadGeo(K, detail = 3) {
  return K.geo('kd-bead' + detail, () => {
    const g = new THREE.IcosahedronGeometry(1, detail);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      vA.fromBufferAttribute(p, i);
      const k = 1 + (hash(vA.x * 9.1, vA.y * 9.1, vA.z * 9.1) - 0.5) * 0.06;
      p.setXYZ(i, vA.x * k, vA.y * k, vA.z * k);
    }
    g.computeVertexNormals();
    return g;
  });
}

// a tapered, beaded tube along -z from 0 to -len (r0 at the start, r1 at the end), for the tail
function beadTube(K, key, r0, r1, len) {
  return K.geo('kd-tube' + key, () => {
    const g = new THREE.CylinderGeometry(r1, r0, len, 14, 5, true);
    g.rotateX(-PI / 2).translate(0, 0, -len / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      vA.fromBufferAttribute(p, i);
      const k = 1 + (hash(vA.x * 31, vA.y * 31, vA.z * 31) - 0.5) * 0.08;
      p.setXYZ(i, vA.x * k, vA.y * k * 1.06, vA.z);
    }
    g.computeVertexNormals();
    return g;
  });
}

// =============================================================================================
// Its den for the night: a flat slab of rock propped on two boulders over a shallow scrape, the open
// side towards the road (`toRoad`, a direction on the ground). Static: baked into a few draws.
export function buildDen(K, base, toRoad, rockMat, slabMat) {
  const sand = K.mat(K.night ? 0x4a3f3c : 0x8e6446, { roughness: 1, flatShading: true });
  const scrape = K.mat(K.night ? 0x3a3130 : 0x74503a, { roughness: 1 });
  const ico = K.geo('den-rock', () => new THREE.IcosahedronGeometry(1, 1)), dod = K.geo('den-slab', () => new THREE.DodecahedronGeometry(1, 0));
  const g = K.group();
  // the scrape: a dish of darker, dug earth, the loose earth thrown up round its back and sides
  K.mesh(K.sphere(1, 16, 6), scrape, [0, -0.03, -0.1], g, null, [1.15, 0.05, 1.45]);
  for (let i = 0; i < 9; i++) {
    const a = PI * 0.15 + (i / 8) * PI * 1.7;                    // round the back, open towards the road
    K.mesh(ico, sand, [Math.sin(a) * 1.2, 0.02, -0.25 + Math.cos(a) * 1.35], g, [i, i * 2, 0], [0.32, 0.09 + (i % 3) * 0.02, 0.26]);
  }
  // the supports and the back wall, then the slab over them (its underside ~0.8 m above the scrape)
  K.mesh(ico, rockMat, [1.12, 0.28, -0.45], g, [0.3, 0.7, 0], [0.45, 0.56, 0.7]);
  K.mesh(ico, rockMat, [-1.15, 0.26, -0.6], g, [0.1, 2.2, 0.2], [0.5, 0.52, 0.65]);
  K.mesh(ico, rockMat, [0.1, 0.34, -1.45], g, [0.2, 1.1, 0.1], [1.35, 0.62, 0.5]);
  K.mesh(dod, slabMat, [0, 0.94, -0.5], g, [0.06, 0.4, -0.04], [1.6, 0.21, 1.15]);
  K.mesh(ico, rockMat, [0.5, 1.16, -0.95], g, [0.4, 0.2, 0], [0.6, 0.24, 0.48]);
  g.name = 'komodo-den';
  K.place(g, base);
  g.rotation.y = Math.atan2(toRoad.x, toRoad.z);
  g.updateMatrixWorld(true);
  return g;
}

// =============================================================================================
// The Komodo dragon. opts:
//   path      [a, b]: the two ends of its patrol line beside the road (day; it starts at `a`)
//   den       where it lies at night (the scrape under the slab), `denYaw` its heading there
//   yaw       its heading at the start
//   keep      (x, z) => false where it must not walk (the road)
export function buildKomodo(K, home, opts = {}) {
  const night = K.night;
  // the colours (painted per face; `mottle` gives each facet its own shade)
  const skin = K.mat(0x6b6152), skinD = K.mat(0x544b40), belly = K.mat(0x8a7e66), lip = K.mat(0x7b705c);
  const mouthM = K.mat(0xb3786e), toothM = K.mat(0xd9d0b5), tongueM = K.mat(0xd8b23e), forkM = K.mat(0xb08a2a);
  const claw = K.mat(0x2a2420, { roughness: 0.55 }), eyeM = K.sheen(0x0b0907, { roughness: 0.1 });
  const iris = K.sheen(0x6a4a22, { roughness: 0.15 });
  const glow = K.glow(0xa6f2d6, 0.7, { color: 0x6f6a5a });
  const bead = beadGeo(K, 3), bead2 = beadGeo(K, 2);
  const mot = (m) => { m.userData.mottle = true; return m; };
  const skinPart = (geo, mat, p, parent, r, s) => mot(K.mesh(geo, mat, p, parent, r, s));

  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  K.shadow(root, 0.5, 1.45, 0.025);

  // ---- the trunk: hips → belly → chest, each bending a little (sideways while it walks)
  const H = K.group([0, 0.3, -0.42], near);
  skinPart(bead, skin, [0, 0, -0.02], H, null, [0.165, 0.135, 0.27]);
  skinPart(bead2, belly, [0, -0.06, 0.0], H, null, [0.13, 0.08, 0.17]);
  const F1 = K.group([0, 0, 0.24], H);
  skinPart(bead, skin, [0, -0.005, 0.11], F1, null, [0.2, 0.155, 0.31]);
  skinPart(bead2, belly, [0, -0.07, 0.1], F1, null, [0.16, 0.095, 0.22]);
  const F2 = K.group([0, 0.005, 0.27], F1);
  skinPart(bead, skin, [0, 0, 0.06], F2, null, [0.172, 0.145, 0.25]);
  skinPart(bead2, belly, [0, -0.065, 0.06], F2, null, [0.13, 0.085, 0.17]);

  // ---- the neck: thick, with loose folds of skin round the throat
  const N = K.group([0, 0.03, 0.2], F2);
  skinPart(bead, skin, [0, 0, 0.08], N, null, [0.115, 0.11, 0.17]);
  skinPart(bead2, lip, [0, -0.07, 0.07], N, null, [0.09, 0.06, 0.15]);         // the slack throat
  for (let i = 0; i < 4; i++) {                                                // folds across the sides and the throat
    const z = 0.0 + i * 0.055;
    skinPart(K.torus(1, 0.06, 4, 14, PI * 1.1), i % 2 ? lip : skin, [0, -0.004, z], N, [0, 0, PI * 0.95], [0.106, 0.102, 0.1]);
  }
  const throat = K.group([0, -0.075, 0.08], N);                                // puffs up while it hisses
  skinPart(bead2, lip, [0, 0, 0], throat, null, [0.085, 0.05, 0.12]);
  // ---- the head: long, flat and broad at the back, the snout tapering; small eyes under a brow ridge
  const Hd = K.group([0, 0.005, 0.2], N);
  const HL = K.group(null, Hd);                                                // the look (towards the van)
  skinPart(bead, skin, [0, 0.01, 0.04], HL, null, [0.088, 0.066, 0.12]);      // the back of the head
  skinPart(bead, skin, [0, -0.004, 0.16], HL, [0.07, 0, 0], [0.06, 0.044, 0.15]);   // the snout, long and tapering
  skinPart(bead2, lip, [0, -0.028, 0.155], HL, null, [0.058, 0.02, 0.135]);    // the upper lip
  for (const s of [-1, 1]) {
    skinPart(bead2, skin, [s * 0.056, 0.043, 0.07], HL, [0, 0, s * 0.35], [0.024, 0.01, 0.055]);   // brow ridge
    K.mesh(K.sphere(1, 6, 5), eyeM, [s * 0.03, 0.004, 0.262], HL, null, [0.003, 0.0035, 0.006]);       // nostril
  }
  const eyes = [-1, 1].map((s) => {
    const e = K.group([s * 0.064, 0.03, 0.08], HL);
    const ball = K.mesh(K.sphere(1, 10, 8), eyeM, [0, 0, 0], e, null, 0.0135); ball.userData.wet = true;
    const ir = K.mesh(K.sphere(1, 8, 6), iris, [s * 0.007, 0.001, 0.003], e, null, [0.006, 0.009, 0.009]); ir.userData.wet = true;
    return e;
  });
  // the mouth inside and the teeth: within the closed jaws, seen only when the mouth opens
  skinPart(K.sphere(1, 10, 6), mouthM, [0, -0.034, 0.15], HL, null, [0.05, 0.011, 0.115]);
  for (const s of [-1, 1]) for (let i = 0; i < 9; i++) {
    const z = 0.04 + i * 0.026, x = s * (0.05 - i * 0.0035);
    K.mesh(K.cone(0.004, 0.016, 4), toothM, [x, -0.04, z], HL, [PI, 0, 0]);
  }
  // the lower jaw, hinged at the back of the head
  const jaw = K.group([0, -0.04, 0.0], HL);
  skinPart(bead, lip, [0, -0.012, 0.13], jaw, [-0.04, 0, 0], [0.066, 0.024, 0.135]);
  skinPart(K.sphere(1, 10, 6), mouthM, [0, 0.004, 0.13], jaw, null, [0.052, 0.01, 0.12]);
  for (const s of [-1, 1]) skinPart(bead2, lip, [s * 0.05, 0.012, 0.03], jaw, [0.5, 0, 0], [0.028, 0.04, 0.05]);   // the jowls at the corners
  for (const s of [-1, 1]) for (let i = 0; i < 8; i++) K.mesh(K.cone(0.0035, 0.013, 4), toothM, [s * (0.046 - i * 0.0035), 0.008, 0.05 + i * 0.026], jaw);
  // the tongue: long, yellow and forked; its group's z scale is how far it is out
  const tongue = K.group([0, -0.03, 0.27], HL);
  K.mesh(K.cyl(0.0045, 0.006, 0.85, 5), tongueM, [0, 0, 0.425], tongue, [PI / 2, 0, 0]);
  for (const s of [-1, 1]) K.mesh(K.cone(0.004, 0.17, 4), forkM, [s * 0.012, 0, 0.92], tongue, [PI / 2, 0, -s * 0.14]);
  tongue.scale.set(1, 1, 0.001);
  tongue.visible = false;

  // ---- the tail: as long as the body, thick at the base, a little higher than wide further out
  const TAIL = [0.22, 0.23, 0.23, 0.22, 0.2, 0.18];
  const T = [];
  let parent = H;
  TAIL.forEach((len, i) => {
    const g = K.group([0, 0, i ? -TAIL[i - 1] : -0.14], parent);
    const k = i / (TAIL.length - 1), r = 0.135 - k * 0.1;
    const r1 = 0.135 - ((i + 1) / (TAIL.length - 1)) * 0.1;
    skinPart(beadTube(K, i, r, Math.max(0.022, r1), len + 0.01), skin, [0, 0, 0], g, null, [1, 1.08, 1]);
    skinPart(bead, skin, [0, 0, 0], g, null, [r * 0.99, r * 1.07, r]);                 // the joint, so a bend leaves no gap
    if (i === TAIL.length - 1) skinPart(K.cone(1, 1, 7), skin, [0, 0, -len - 0.04], g, [-PI / 2, 0, 0], [0.022, 0.1, 0.026]);
    T.push(g); parent = g;
  });

  // ---- the glowing dots: two faint rows along the back, on down the tail
  const dot = K.sphere(1, 6, 4);
  const dots = (g, z0, z1, n, y, x, r) => { for (let i = 0; i < n; i++) for (const s of [-1, 1]) K.mesh(dot, glow, [s * x, y - r * 0.5, z0 + (z1 - z0) * (n === 1 ? 0.5 : i / (n - 1))], g, null, r); };
  dots(H, -0.2, 0.16, 3, 0.125, 0.05, 0.009);
  dots(F1, -0.04, 0.26, 3, 0.148, 0.055, 0.01);
  dots(F2, -0.04, 0.17, 2, 0.136, 0.05, 0.009);
  dots(N, 0.02, 0.14, 2, 0.1, 0.038, 0.008);
  T.forEach((g, i) => { if (i < 5) { const r = 0.135 - i / 5 * 0.1; dots(g, -0.06, -TAIL[i] + 0.06, 2, r * 1.04, r * 0.3, 0.009 - i * 0.001); } });

  // ---- the legs: bowed out to the sides, the elbows and knees out, big flat feet with five long claws
  const legs = [];
  const leg = (seg, z, s, front) => {
    const sz = front ? 1 : 1.12;
    const hip = K.group([s * 0.13, -0.05, z], seg);
    skinPart(bead, skin, [s * 0.095, -0.035, 0], hip, [0, 0, -s * 0.36], [0.115 * sz, 0.064 * sz, 0.07 * sz]);
    const knee = K.group([s * 0.19, -0.075, 0], hip);
    skinPart(bead, skin, [0, -0.08, front ? 0.01 : -0.01], knee, [front ? -0.12 : 0.12, 0, 0], [0.05 * sz, 0.105, 0.054 * sz]);
    // the foot, flat on the ground, the toes fanned forward, each with a dark curved claw
    skinPart(bead2, skinD, [s * 0.01, -0.165, 0.04], knee, null, [0.055 * sz, 0.022, 0.07 * sz]);
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.32 * s + s * 0.15, L = (i === 0 || i === 4 ? 0.05 : 0.075) * sz;
      const tx = Math.sin(a) * L, tz = 0.06 * sz + Math.cos(a) * L;
      skinPart(K.capsule(0.011, L, 2, 5), skinD, [s * 0.01 + tx * 0.5, -0.172, 0.04 + tz * 0.55], knee, [PI / 2, 0, -a], [1, 1, 1]);
      K.mesh(K.cone(0.008, 0.045, 5), claw, [s * 0.01 + tx * 1.05, -0.18, 0.045 + tz * 1.08], knee, [PI / 2 + 0.55, -a, 0]);
    }
    legs.push({ hip, knee, s, front, ph: (front ? 0 : PI) + (s > 0 ? 0 : PI) });   // diagonal pairs step together
  };
  for (const s of [-1, 1]) { leg(F2, 0.07, s, true); leg(H, 0.0, s, false); }

  // ---- far: a long low body, a tapering tail, four stubs
  K.mesh(K.sphere(1, 8, 6), skin, [0, 0.3, 0.0], far, null, [0.19, 0.15, 0.62]);
  K.mesh(K.sphere(1, 8, 6), skin, [0, 0.32, 0.72], far, null, [0.09, 0.07, 0.24]);
  K.mesh(K.cone(1, 1, 6), skin, [0, 0.16, -1.18], far, [-PI / 2 + 0.2, 0, 0], [0.12, 1.3, 0.12]);
  for (const [x, z] of [[0.24, 0.25], [-0.24, 0.25], [0.26, -0.42], [-0.26, -0.42]]) K.mesh(K.box(0.1, 0.3, 0.12), skin, [x, 0.13, z], far);

  paint(K, root);
  K.place(root, home);

  // ---- the behaviour, decided here (not by the shared state machine):
  //   idle     standing on the patrol line, tasting the air, watching the van (the first while: waits)
  //   wander   walking slowly along its patrol line
  //   eat      feed: walking briskly to it, sniffing with quick tongue flicks, then the gulp
  //   rare     the pose (planPoses `near`): rears up on its tail, or puffs up and hisses at the van
  //   rest     night: lying flat in the scrape under the overhang
  const ends = (opts.path || [home, home]).map((p) => p.clone());
  const S = {
    ph: 0, flick: 1.2, out: 0, fl: 0, call: 3, eat: null, eatT: 0, leg: 0, end: 1,
    rare: Math.random() < 0.5 ? 'rear' : 'hiss',
    p: { h: night ? 0.165 : 0.3, lean: 0, neck: 0, head: 0, jaw: 0, puff: 0, rear: 0, rest: night ? 1 : 0, sniff: 0, lift: 0, gulp: 0 },
  };
  const c = K.makeCreature({
    species: SPECIES['komodo-dragon'], root, home, radius: 1.0, eye: new THREE.Vector3(0, 0.32, 0.25),
    ground: K.groundY, keep: opts.keep, speed: 0.5, roam: 0, fleeAt: 0, curiousAt: 0, shy: 1, rareChance: 0, yaw: opts.yaw, poseLen: 5.6,
  });
  c.state = night ? 'rest' : 'idle';
  c.hold = night ? 99 : 1e9;
  c.air = night;                                       // resting under the rock: it doesn't turn round to feed
  c.rareKind = S.rare;
  c.setRare = (k) => { S.rare = c.rareKind = k; };          // tests: pick the pose

  const pelletNear = (env) => (env.pellets || []).find((p) => p.landed && !p.eaten && p.pos.distanceTo(c.root.position) < 14 * FEED_REACH);

  c.step = (dt, env) => {
    c.t += dt;
    const d = env.dist, rp = c.root.position;
    if (!night && (c.state === 'idle' || c.state === 'wander')) {
      const p = pelletNear(env);
      if (p) { S.eat = p; S.eatT = 0; c.go('eat', 6 * FEED_REACH + 3); }
    }
    switch (c.state) {
      case 'rest':
        break;
      case 'idle':
        // it waits until the van comes along, then sets off down the line towards it
        if (c.hold > 1e8 && d < 140) c.hold = 1.2;
        if (c.t > c.hold) { c.target = ends[S.end]; c.go('wander', 60); }
        break;
      case 'wander': {
        const done = c.walkTo(c.target, dt);
        if (done || c.t > c.hold) { S.end = 1 - S.end; c.go('idle', 2.5 + Math.random() * 2); }
        else if (c.t > 4 && Math.random() < dt * 0.05) c.go('idle', 1.6 + Math.random());   // a pause to taste the air
        break;
      }
      case 'eat': {
        const p = S.eat;
        if (!p || (p.eaten && S.eatT === 0)) { c.go('idle', 1.5); break; }
        if (S.eatT === 0) {
          // walks briskly to it, the head reaching just short of it
          c.turnTo(p.pos.x, p.pos.z, dt, 1.6);
          vA.subVectors(p.pos, rp).setY(0);
          if (vA.length() < 0.95) { S.eatT = dt; S.reach = true; break; }
          // it stops at the road's edge: feed on the road it only sniffs at from there
          if (c.walkTo(vA.setLength(vA.length() - 0.94).add(rp), dt, 3.6)) { S.eatT = dt; S.reach = p.pos.distanceTo(rp) < 1.4; }
          if (c.t > c.hold) c.go('idle', 1.5);
        } else {
          // sniffs with fast flicks (1.1 s), then the gulp (it is gone at 1.45 s), then swallows
          S.eatT += dt;
          c.turnTo(p.pos.x, p.pos.z, dt, 1.2);
          if (!S.reach && S.eatT > 1.1) { S.eat = null; S.eatT = 0; c.go('idle', 2); break; }
          if (S.eatT > 1.45 && !p.eaten) { p.eaten = true; p.eatenAt = env.t; if (env.call) env.call(c, 'eat'); }
          if (S.eatT > 2.8) { S.eat = null; S.eatT = 0; c.go('idle', 1.5 + Math.random()); }
        }
        break;
      }
      case 'rare':
        // faces the van; the hiss gets a sound
        c.turnTo(env.camPos.x, env.camPos.z, dt, S.rare === 'hiss' ? 1.2 : 0.6);
        if (S.rare === 'hiss' && c.t > 0.9 && !S.hissed) { S.hissed = true; if (env.call) env.call(c, 'rare'); }
        if (c.t > c.hold) { S.hissed = false; c.go('idle', 2); }
        break;
      default:
        c.go('idle', 2);
    }
    rp.y = K.groundY(rp.x, rp.z);
    pose(dt, env);
    c.root.updateMatrixWorld();
  };

  function pose(dt, env) {
    const st = c.state, t = env.t, P = S.p;
    const spd = motion(dt);
    const eating = st === 'eat' && S.eatT > 0, sniffing = eating && S.eatT < 1.1, gulping = eating && S.eatT >= 1.1;
    const rearing = st === 'rare' && S.rare === 'rear', hissing = st === 'rare' && S.rare === 'hiss';
    const rk = st === 'rare' ? clamp(c.t / 1.1, 0, 1) * clamp((c.hold - c.t) / 0.9, 0, 1) : 0;    // in and out of the pose
    // the targets
    const W = {
      h: st === 'rest' ? 0.165 : rearing ? 0.3 : hissing ? 0.37 : 0.3,
      lean: rearing ? -1.12 * rk : hissing ? -0.14 * rk : 0,
      neck: rearing ? 0.62 * rk : hissing ? -0.28 * rk : sniffing ? 0.32 : gulping ? 0.18 : st === 'rest' ? -0.04 : 0.04,
      head: rearing ? 0.42 * rk : hissing ? 0.5 * rk : sniffing ? 0.36 : gulping ? 0.2 : st === 'rest' ? 0.02 : 0.05,
      jaw: hissing ? 0.66 * rk : 0,
      puff: hissing ? rk : 0,
      rear: rearing ? rk : 0,
      rest: st === 'rest' ? 1 : 0,
      lift: hissing ? rk : 0,
    };
    for (const k of Object.keys(W)) P[k] = damp(P[k], W[k], st === 'rare' ? 6 : 3, dt);
    // the gulp: a lunge with the jaws open, a snap, the head thrown up, a swallow down the throat
    let gulpJaw = 0, gulpHead = 0, gulpNeck = 0, swallow = 0;
    if (gulping) {
      const g = S.eatT - 1.1;
      gulpJaw = g < 0.35 ? Math.sin((g / 0.35) * PI) * 0.5 : 0;
      gulpNeck = g < 0.35 ? 0.12 * Math.sin((g / 0.35) * PI) : 0;
      gulpHead = g > 0.4 && g < 1.4 ? -0.45 * Math.sin(((g - 0.4) / 1.0) * PI) : 0;
      swallow = g > 0.6 && g < 1.6 ? Math.sin(((g - 0.6) / 1.0) * PI) : 0;
    }
    // walking: diagonal pairs step together, the spine bends from side to side, the head swings
    S.ph += dt * (spd / (st === 'eat' ? 0.75 : 0.62)) * PI * 2;
    const w = clamp(spd / 0.3, 0, 1) * (1 - P.rest) * (1 - P.rear);
    const sw = Math.sin(S.ph);
    const breathe = Math.sin(t * (st === 'rest' ? 1.1 : 1.6) + c.bob);
    H.position.y = P.h + Math.abs(Math.cos(S.ph)) * 0.012 * w + breathe * 0.003;
    H.rotation.x = P.lean;
    H.rotation.y = sw * 0.11 * w;
    H.rotation.z = -sw * 0.035 * w;
    F1.rotation.y = -sw * 0.09 * w;
    F2.rotation.y = -sw * 0.1 * w;
    F1.scale.set(1 + P.puff * 0.08 + breathe * 0.012, 1 + breathe * 0.012, 1);
    // the neck and head: level while it walks (the head swinging side to side), down to sniff
    N.rotation.x = P.neck + gulpNeck;
    N.rotation.y = sw * 0.12 * w + (rearing ? Math.sin(t * 0.7) * 0.35 * rk : 0);
    Hd.rotation.x = P.head + gulpHead;
    Hd.rotation.y = sw * 0.2 * w + (sniffing ? Math.sin(t * 2.3) * 0.25 : 0) + (rearing ? Math.sin(t * 0.9 + 1) * 0.3 * rk : 0);
    // it turns its head to the van as it passes (not while it eats or rests)
    const watch = (st === 'idle' || st === 'wander' || st === 'rare') && c.near !== undefined && c.near < 26;
    K.look(c, HL, env, dt, { yaw: 0.85, pitch: 0.2, rate: 2.2, glance: false, force: watch });
    if (!watch) HL.rotation.y = damp(HL.rotation.y, 0, 2, dt);
    HL.rotation.x = damp(HL.rotation.x, 0, 3, dt);
    jaw.rotation.x = P.jaw + gulpJaw + Math.max(0, Math.sin(t * 17)) * 0.04 * P.jaw;
    throat.scale.set(1 + P.puff * 0.55 + swallow * 0.25, 1 + P.puff * 0.9 + swallow * 0.5, 1 + P.puff * 0.2);
    throat.position.z = 0.08 + swallow * 0.04;
    // the tail: drags on the ground and curves behind, waving with the walk; a prop for the rear; it
    // lashes slowly while it hisses; curled round alongside it at rest
    const TX = [-0.17, -0.08, 0.02, 0.06, 0.06, 0.04];
    T.forEach((g, i) => {
      const rearX = i === 0 ? 0.82 : i === 1 ? 0.22 : 0.02;
      g.rotation.x = TX[i] * (1 - P.rear) + rearX * P.rear + (i === 0 ? P.lift * 0.1 : 0) + (i === 0 ? -P.rest * 0.02 : P.rest * -0.02);
      g.rotation.y = Math.sin(S.ph - 0.9 - i * 0.7) * (0.1 + i * 0.03) * w
        + (P.rest * 0.2 + P.puff * 0.12) * (i > 0 ? 1 : 0.5) + Math.sin(t * 0.6 + c.bob + i * 0.5) * 0.03
        + (hissing ? Math.sin(t * 2.2 - i * 0.6) * 0.1 * rk : 0);
    });
    // the legs: the upper limbs swing forwards and back about the shoulder, the foot lifts as it comes
    // forward; the lower leg stays upright. At rest they lie folded back along the body; reared up the
    // hind legs stay under it and the front legs hang
    for (const L of legs) {
      const s = L.s, ph = S.ph + L.ph, step = Math.sin(ph), up = Math.max(0, Math.cos(ph));
      let ry = -s * step * 0.5 * w, rz = s * up * 0.32 * w, rx = 0, kz = 0, ky = 0, kx = 0;
      if (P.rest > 0.01) {
        const k = P.rest;
        ry = ry * (1 - k) + s * (L.front ? 0.55 : 0.95) * k;
        rz = rz * (1 - k) + s * 0.35 * k;
        kz = s * (L.front ? 0.45 : 0.6) * k;
      }
      if (L.front && P.rear > 0.01) { rx += 0.75 * P.rear; rz += -s * 0.25 * P.rear; ry += -s * 0.25 * P.rear; kx = -0.45 * P.rear; }
      if (!L.front) rx += -H.rotation.x;               // the hind legs stay upright under the hips
      if (L.front) rx += 0;                             // (the chest follows the hips)
      rz += -s * 0.18 * P.lift;                         // up on straightened legs to hiss
      L.hip.rotation.set(rx, ry, rz);
      L.knee.rotation.set(kx, ky - ry * 0.75, kz - rz);
    }
    // the eyes: half shut at rest, open as the van comes close
    const lid = st === 'rest' ? (c.near !== undefined && c.near < 14 ? 1 : 0.25) : 1;
    for (const e of eyes) e.scale.y = damp(e.scale.y, lid, 4, dt);
    // the tongue: a flick now and then, more often near the van, many while sniffing at the feed
    S.flick -= dt;
    if (S.fl <= 0 && S.flick <= 0) {
      S.fl = 0.5;
      const busy = sniffing ? 0.15 : st === 'rare' ? 0.8 : c.near !== undefined && c.near < 30 ? 1.1 : 2.4;
      S.flick = st === 'rest' ? (c.near !== undefined && c.near < 16 ? 2.5 + Math.random() * 2 : 99) : busy + Math.random() * busy;
      if (gulping || (hissing && P.jaw > 0.2)) S.flick = 0.5, S.fl = 0;
    }
    if (S.fl > 0) {
      S.fl -= dt;
      const k = 1 - S.fl / 0.5;
      S.out = Math.pow(Math.max(0, Math.sin(k * PI)), 0.6) * (sniffing ? 0.75 : 1);
    } else S.out = 0;
    tongue.visible = S.out > 0.02;
    tongue.scale.z = 0.001 + S.out * 0.34;
    tongue.rotation.x = Math.sin(t * 38) * 0.12 * S.out + (sniffing ? 0.25 : 0);
    tongue.rotation.y = Math.sin(t * 29) * 0.08 * S.out;
    // the photo point: its shoulders; higher when reared up
    c.eye.set(0, 0.32 + P.rear * 0.4 + P.lift * 0.06 - P.rest * 0.14, 0.25 - P.rear * 0.2);
    c.radius = 1.0 - P.rear * 0.1;
    // a low hiss now and then while it eats
    S.call -= dt;
    if (S.call <= 0) { if (env.call && eating && env.dist < 40) env.call(c, 'idle'); S.call = 5 + Math.random() * 5; }
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

  pose(0, { t: 0, dist: 99, camPos: new THREE.Vector3(0, 0, 1e4), pellets: [] });
  return K.lod(c, near, far, 30);
}

// Merge every group's still meshes into one mesh coloured per face, whatever their material; skin
// parts (`mottle`) get a shade of their own per facet, so the scales read as beads of grey and brown.
// The glowing dots and the wet eyes keep their own materials (K.bake merges those).
const glows = (m) => m.emissiveIntensity > 0 && (m.emissive.r + m.emissive.g + m.emissive.b) > 0;
function paint(K, root) {
  const mat = K.mat(0xffffff, { vertexColors: true, roughness: 0.9, flatShading: true });
  const groups = [];
  root.traverse((o) => { if (!o.isMesh) groups.push(o); });
  const col = new THREE.Color(), cen = new THREE.Vector3();
  for (const gr of groups) {
    const list = gr.children.filter((ch) => ch.isMesh && !ch.userData.keep && !ch.userData.wet && !ch.children.length && !glows(ch.material) && ch.material.roughness > 0.5);
    if (list.length < 1) continue;
    const parts = list.map((ch) => {
      ch.updateMatrix();
      const g = ch.geometry.index ? ch.geometry.toNonIndexed() : ch.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      g.applyMatrix4(ch.matrix);
      const pos = g.attributes.position, n = pos.count, out = new Float32Array(n * 3);
      for (let i = 0; i < n; i += 3) {
        col.copy(ch.material.color);
        if (ch.userData.mottle) {
          cen.fromBufferAttribute(pos, i).add(vA.fromBufferAttribute(pos, i + 1)).add(vA.fromBufferAttribute(pos, i + 2)).multiplyScalar(1 / 3);
          const h = hash(cen.x * 61 + root.id, cen.y * 61, cen.z * 61);
          col.multiplyScalar(h < 0.1 ? 0.72 : h > 0.93 ? 1.22 : 0.88 + h * 0.22);
          // soft darker blotches over the back and the flanks
          const bl = Math.sin(cen.x * 23 + 1.3) * Math.sin(cen.z * 15 + cen.y * 9);
          if (bl > 0.5) col.multiplyScalar(0.84);
          if (h > 0.97) col.lerp(new THREE.Color(0x9a8a62), 0.4);       // a few yellowish beads
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
  'komodo-dragon': buildKomodo,
};
