// The largetooth sawfish (FEAT-013): a big, prehistoric-looking ray with a shark's body, cruising
// the brackish river just below the surface near the road, with a shoal of small silver fish it hunts.
//
//   largetooth-sawfish   about 4.5 m from the tip of its saw to the tail. A shark-like body, flattened
//                        at the front, olive-grey to brown on top, pale underneath; the saw is a long
//                        flat blade (a quarter of the length) with evenly spaced teeth along both
//                        edges; two tall dorsal fins, broad pectoral fins and a shark-like tail. It
//                        swims slowly, the body undulating, the saw leading. Hunting (most runs, as
//                        the van passes): it turns to the shoal and swings the saw sharply sideways
//                        through it; the fish scatter in a flash, then come together again. Rare pose
//                        (about half the runs, `near` in the route's POSES): it rises so the saw
//                        breaks the surface and slashes it from side to side with a splash, then
//                        sinks back. Night: it lies still on the bottom of the shallows, breathing.
//
// The twist: faint glowing lines along the saw's teeth and along its sides (barely there by day,
// clear at night), and the shoal glows faintly after dark, so the pair can be found in the dark water.
//
// The still parts of each moving group are merged into one mesh coloured per face (`paint`), and
// the shoal is instanced (three draws for all the fish), so it stays cheap on a phone.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const SPECIES = {
  'largetooth-sawfish': { id: 'largetooth-sawfish', name: 'Largetooth sawfish', points: 240, call: { hz: 420, kind: 'noise' } },
};

const PI = Math.PI, TAU = PI * 2;
const damp = (a, b, k, dt) => a + (b - a) * Math.min(1, k * dt);
const clamp = THREE.MathUtils.clamp;
const ss = (e0, e1, x) => { const u = clamp((x - e0) / (e1 - e0), 0, 1); return u * u * (3 - 2 * u); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
const qA = new THREE.Quaternion(), eA = new THREE.Euler(), mA = new THREE.Matrix4(), mB = new THREE.Matrix4(), mInv = new THREE.Matrix4();
const sOne = new THREE.Vector3(1, 1, 1);
const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };

// The body, one smooth surface: its width and height along its length (z, in the trunk's frame:
// the snout at 1.42, the tail stalk at -2.27), flattened at the front and pale underneath. Each
// moving part gets the stretch [z0, z1] of it in its own frame (its origin at `at`), the stretches
// overlapping a little at the joints so a bend leaves no gap.
const PROFILE = [[1.42, 0.12, 0.05], [1.3, 0.2, 0.07], [1.12, 0.29, 0.1], [0.9, 0.37, 0.13], [0.6, 0.44, 0.17], [0.2, 0.47, 0.2],
  [-0.3, 0.42, 0.2], [-0.66, 0.33, 0.18], [-1.1, 0.24, 0.155], [-1.52, 0.15, 0.115], [-1.9, 0.095, 0.085], [-2.2, 0.06, 0.07], [-2.27, 0.03, 0.04]];
function shapeAt(z) {
  for (let i = 1; i < PROFILE.length; i++) {
    const [za, wa, ha] = PROFILE[i - 1], [zb, wb, hb] = PROFILE[i];
    if (z <= za && z >= zb) { const k = (za - z) / (za - zb), e = k * k * (3 - 2 * k) * 0.5 + k * 0.5; return [wa + (wb - wa) * e, ha + (hb - ha) * e]; }
  }
  return z > PROFILE[0][0] ? [PROFILE[0][1], PROFILE[0][2]] : [0.03, 0.04];
}
function loft(K, z0, z1, at) {
  return K.geo(`sfLoft${z0},${z1}`, () => {
    const R = 18, L = Math.max(4, Math.round((z1 - z0) / 0.07));
    const pos = [], col = [], idx = [];
    const topC = new THREE.Color(0x635f4e), bellyC = new THREE.Color(0xd9d2bd), c = new THREE.Color();
    for (let i = 0; i <= L; i++) {
      const z = z0 + (z1 - z0) * (i / L), [w, h] = shapeAt(z);
      for (let j = 0; j <= R; j++) {
        const a = (j / R) * TAU, sa = Math.sin(a), ca = Math.cos(a);
        // a flat belly and a gently domed back; the edges of the flattened front a little sharper
        const y = sa > 0 ? h * Math.pow(sa, 0.85) : -h * 0.62 * Math.pow(-sa, 0.6);
        pos.push(w * Math.sign(ca) * Math.pow(Math.abs(ca), 0.8), y, z - at);
        c.copy(bellyC).lerp(topC, ss(-0.35, 0.05, sa));
        col.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < L; i++) for (let j = 0; j < R; j++) {
      const a = i * (R + 1) + j, b = a + R + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    // caps, so an open end never shows at a joint
    for (const [i, flip] of [[0, true], [L, false]]) {
      const z = z0 + (z1 - z0) * (i / L), cI = pos.length / 3;
      pos.push(0, 0, z - at); col.push(topC.r, topC.g, topC.b);
      for (let j = 0; j < R; j++) { const a = i * (R + 1) + j; flip ? idx.push(cI, a + 1, a) : idx.push(cI, a, a + 1); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  });
}

// =============================================================================================
// opts:
//   path    [a, b]: the two ends of the line it cruises along beside the road (by day)
//   yaw     its heading at the start
//   keep    (x, z) => false where it must not swim (the road, water too shallow)
//   hunt    false: no hunt this run (the route rolls it; most runs have one)
//   rest    true: night, it lies on the bottom where it was placed
export function buildSawfish(K, home, opts = {}) {
  const night = !!opts.rest;
  const surf = () => (K.waterY ? K.waterY(home.x, home.z) : 0);

  // the colours (painted per face; `mottle` gives the skin a little unevenness)
  const top = K.mat(0x635f4e), topD = K.mat(0x57543f), finM = K.mat(0x625e48);
  const sawM = K.mat(0x8a8268), tooth = K.mat(0xe4dccb), eyeM = K.sheen(0x0d0c0a, { roughness: 0.12 });
  const glow = K.glow(0x9ff3df, night ? 0.85 : 0.5, { color: 0x6f6d5c });
  const mot = (m) => { m.userData.mottle = true; return m; };
  const part = (geo, mat, p, parent, r, s) => mot(K.mesh(geo, mat, p, parent, r, s));
  const skin = K.mat(0xffffff);                               // the body's own colours are in its geometry (`loft`)

  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  // D: its depth and the pose's rise (a child, so the pose blend smooths it), B: the pitch
  const D = K.group([0, 0, 0], near);
  const B = K.group(null, D);

  // ---- the trunk: wide and flattened at the front, the first dorsal fin over it
  const S1 = K.group([0, 0, 0], B);
  part(loft(K, -0.72, 0.84, 0), skin, null, S1);
  part(K.shape('sfDorsal1', [[0, 0], [0.5, 0], [0.24, 0.5], [0.12, 0.52], [0.04, 0.3]]), finM, [0, 0.17, -0.42], S1, [0, -PI / 2, 0]);
  // the pectoral fins: broad and shark-like, set low on the flattened front
  const pecs = [-1, 1].map((s) => {
    const g = K.group([s * 0.36, -0.06, 0.38], S1);
    part(K.shape('sfPec', [[0, 0.28], [0.5, 0.0], [0.7, -0.22], [0.58, -0.28], [0.12, -0.18], [0, -0.1]]), finM, [0, 0, 0], g, s > 0 ? [PI / 2, 0, 0] : [-PI / 2, 0, PI]);
    return { g, s };
  });
  // the pelvic fins, smaller, behind the first dorsal
  for (const s of [-1, 1]) part(K.shape('sfPelv', [[0, 0.12], [0.28, -0.04], [0.22, -0.14], [0, -0.1]]), finM, [s * 0.2, -0.1, -0.6], S1, s > 0 ? [PI / 2, 0, 0] : [-PI / 2, 0, PI]);

  // ---- the head: flattened, the small eyes on top, the spiracles behind them; the saw in front
  const S0 = K.group([0, 0.0, 0.78], S1);
  part(loft(K, 0.72, 1.42, 0.78), skin, null, S0);
  for (const s of [-1, 1]) {
    const e = K.mesh(K.sphere(1, 10, 8), eyeM, [s * 0.14, 0.085, 0.24], S0, null, [0.024, 0.02, 0.03]); e.userData.wet = true;
    part(K.sphere(1, 8, 6), topD, [s * 0.13, 0.08, 0.1], S0, null, [0.03, 0.012, 0.04]);           // spiracle
  }
  // the saw: a long flat blade, slightly narrower towards the blunt tip, the teeth evenly spaced
  // along both edges (largetooth sawfish: about twenty a side)
  const SAW = 1.1, W0 = 0.12, W1 = 0.075;                                   // length, half widths at base and tip
  const SAWZ = 0.62;                                                         // where it leaves the head
  const blade = K.shape('sfSaw', [[-W0, 0], [W0, 0], [W1, SAW - 0.04], [W1 * 0.6, SAW], [-W1 * 0.6, SAW], [-W1, SAW - 0.04]], 0.028);
  part(blade, sawM, [0, 0.005, SAWZ], S0, [PI / 2, 0, 0]);
  part(K.sphere(1, 8, 6), sawM, [0, 0.0, SAWZ - 0.02], S0, null, [W0 * 1.2, 0.04, 0.12]);            // blends the saw into the snout
  const TEETH = 20, teeth = K.cone(0.012, 0.06, 5);
  for (let i = 0; i < TEETH; i++) {
    const k = (i + 0.5) / TEETH, z = SAWZ + 0.04 + k * (SAW - 0.1), hw = W0 + (W1 - W0) * (z - SAWZ) / SAW;
    for (const s of [-1, 1]) K.mesh(teeth, tooth, [s * (hw + 0.024), 0.005, z], S0, [0, 0, -s * PI / 2 + s * 0.12]);
  }
  // the glow along the teeth: a thin line just inside each edge, on top of the blade
  for (const s of [-1, 1]) K.mesh(K.tube('sfSawGlow' + s, [[s * (W0 - 0.012), 0.022, SAWZ + 0.02], [s * ((W0 + W1) / 2 - 0.012), 0.022, SAWZ + SAW / 2], [s * (W1 - 0.012), 0.022, SAWZ + SAW - 0.05]], 0.0055, 0.004, 4, 8), glow, null, S0);

  // ---- the tail: the second dorsal, the slim stalk, the shark-like tail fin (small lower lobe)
  const S2 = K.group([0, 0.0, -0.66], S1);
  part(loft(K, -1.58, -0.6, -0.66), skin, null, S2);
  part(K.shape('sfDorsal2', [[0, 0], [0.42, 0], [0.2, 0.42], [0.1, 0.44], [0.03, 0.25]]), finM, [0, 0.13, -0.42], S2, [0, -PI / 2, 0]);
  const S3 = K.group([0, 0.0, -0.86], S2);
  part(loft(K, -2.27, -1.46, -1.52), skin, null, S3);
  const S4 = K.group([0, 0.02, -0.66], S3);
  part(K.shape('sfTail', [[0, -0.02], [0.06, 0.12], [-0.38, 0.62], [-0.48, 0.6], [-0.3, 0.2], [-0.32, -0.02], [-0.22, -0.2], [-0.14, -0.22]]), finM, [0, 0, 0.02], S4, [0, -PI / 2, 0]);
  // the glowing lines along the sides: one each side of the trunk, running on down the tail
  const side = (g, key, pts) => { for (const s of [-1, 1]) K.mesh(K.tube('sfSide' + key + s, pts.map(([x, y, z]) => [s * x, y, z]), 0.006, 0.005, 4, 8), glow, null, g); };
  side(S1, 'a', [[0.4, 0.03, 0.4], [0.455, 0.03, 0.0], [0.38, 0.035, -0.5], [0.24, 0.04, -0.72]]);
  side(S2, 'b', [[0.23, 0.04, -0.05], [0.25, 0.04, -0.42], [0.15, 0.035, -0.86]]);
  side(S3, 'c', [[0.115, 0.035, -0.02], [0.12, 0.03, -0.3], [0.05, 0.025, -0.64]]);

  // ---- the splash where the saw breaks the surface (the pose); kept level in the root
  const SPL = K.group(null, root);
  const sprayM = K.fin(0xeef6f4, 0.8, 0.5);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU, r = 0.45 + (i % 3) * 0.12;
    K.mesh(K.sphere(1, 6, 5), sprayM, [Math.cos(a) * r, 0.18 + (i % 4) * 0.1, Math.sin(a) * r * 0.6], SPL, null, 0.045 + (i % 2) * 0.02);
  }
  K.mesh(K.torus(0.55, 0.03, 3, 20), K.fin(0xeef6f4, 0.45, 0.3), [0, 0.01, 0], SPL, [PI / 2, 0, 0], [1, 0.6, 0.4]);
  SPL.visible = false;

  // ---- far: a long flat body, the saw, the dorsal fins
  K.mesh(K.sphere(1, 8, 6), top, [0, 0, -0.4], far, null, [0.42, 0.18, 1.8]);
  K.mesh(K.box(0.2, 0.03, 1.1), sawM, [0, 0, 1.95], far);
  K.mesh(K.box(0.03, 0.42, 0.45), finM, [0, 0.3, -0.2], far);
  K.mesh(K.box(0.03, 0.55, 0.35), finM, [0, 0.15, -2.3], far);
  far.position.y = night ? 0 : -0.55;

  paint(K, near);
  // the shoal: small silver fish, instanced (body, tail and a faint glowing line: three draws)
  const shoal = buildShoal(K, root, opts.shoal ?? 22);
  K.place(root, home);

  // ---- the behaviour, decided here:
  //   idle/wander   cruising slowly along its line beside the road (the shoal milling about near it)
  //   hunt          (most runs, as the van passes) turns to the shoal and swipes the saw through it
  //   rare          the pose: rises, the saw breaks the surface, slashes side to side, sinks again
  //   rest          night: lying on the bottom of the shallows
  const ends = (opts.path || [home, home]).map((p) => p.clone());
  const S = {
    ph: 0, spd: 0.55, end: 1, yaw: opts.yaw ?? 0, huntRun: opts.hunt !== false, hunted: false, hT: 0,
    swY: 0, splash: -1,
    p: { depth: night ? 0 : -0.55, pitch: 0 },
  };
  const c = K.makeCreature({
    species: SPECIES['largetooth-sawfish'], root, home, radius: 1.5, eye: new THREE.Vector3(0, 0, 0.9), flyer: true,
    speed: 0.55, roam: 0, fleeAt: 0, curiousAt: 0, shy: 1, rareChance: 0, yaw: opts.yaw, poseLen: 5.6,
  });
  c.state = night ? 'rest' : 'wander';
  c.hold = 1e9;
  c.air = night;                                      // resting on the bottom: no pose
  c.shoal = shoal;
  c.setHunt = (on) => { S.huntRun = on; S.hunted = false; };   // tests
  c.huntInfo = () => ({ run: S.huntRun, done: S.hunted, shoal: +shoal.C.distanceTo(c.root.position).toFixed(1) });

  const rp = c.root.position;
  const fwd = (out) => out.set(Math.sin(c.root.rotation.y), 0, Math.cos(c.root.rotation.y));
  const sawTip = (out) => { S0.updateWorldMatrix(true, false); return S0.localToWorld(out.set(0, 0, SAWZ + SAW)); };

  c.step = (dt, env) => {
    c.t += dt;
    const d = env.dist;
    const sy = surf();
    // the hunt: once a run, as the van passes (close and not behind it), the shoal in reach
    const coming = d < (S.lastD ?? 1e9) || d < 11;          // the van is still coming, or right beside it
    S.lastD = d;
    if (S.huntRun && !S.hunted && !night && (c.state === 'wander' || c.state === 'idle') && d < 17 && coming) {
      vA.subVectors(shoal.C, rp).setY(0);
      if (vA.length() < 6) { S.hunted = true; c.go('hunt', 4.2); S.hT = 0; S.swiped = false; }
    }
    // steering: it always swims (a fish can't stop), turning smoothly towards where it is heading
    let want = c.root.rotation.y, speed = 0.55, turn = 0.38;
    switch (c.state) {
      case 'rest':
        speed = 0;
        break;
      case 'idle':
      case 'wander': {
        const tg = ends[S.end];
        vA.subVectors(tg, rp).setY(0);
        if (vA.length() < 2.2) S.end = 1 - S.end;
        want = Math.atan2(vA.x, vA.z);
        break;
      }
      case 'hunt': {
        S.hT = c.t;
        // a burst towards the shoal, then the swipe (two quick sideways swings of the saw), then on
        if (c.t < 1.3) {
          vA.subVectors(shoal.C, rp).setY(0);
          want = Math.atan2(vA.x, vA.z); speed = 1.5; turn = 1.1;
        } else { speed = 0.7; turn = 0.3; }
        if (c.t > c.hold) c.go('wander', 1e9);
        break;
      }
      case 'rare':
        speed = 0.25; turn = 0.15;
        if (c.t > c.hold) c.go('wander', 1e9);
        break;
      default:
        c.go('wander', 1e9);
    }
    if (speed > 0) {
      S.spd = damp(S.spd, speed, 1.6, dt);
      const dy = clamp(wrap(want - c.root.rotation.y), -turn * dt, turn * dt);
      c.root.rotation.y += dy;
      fwd(vB);
      const nx = rp.x + vB.x * S.spd * dt, nz = rp.z + vB.z * S.spd * dt;
      // never onto the road or into water too shallow: turn away instead
      if (!opts.keep || opts.keep(nx, nz)) { rp.x = nx; rp.z = nz; } else c.root.rotation.y += 1.2 * dt;
    } else S.spd = 0;
    rp.y = night ? K.groundY(rp.x, rp.z) + 0.2 : sy;
    pose(dt, env, sy);
    c.root.updateMatrixWorld();
    shoal.step(dt, env, c, S, sawTip);
  };

  function pose(dt, env, sy) {
    const st = c.state, t = env.t, P = S.p;
    const rk = st === 'rare' ? ss(0, 1.2, c.t) * (1 - ss(c.hold - 1.3, c.hold, c.t)) : 0;   // in and out of the pose
    P.depth = damp(P.depth, night ? 0 : -0.55 + rk * 0.38, 3, dt);
    P.pitch = damp(P.pitch, night ? 0 : -0.36 * rk, 4, dt);
    D.position.y = P.depth + (night ? Math.sin(t * 0.9 + c.bob) * 0.006 : Math.sin(t * 0.7 + c.bob) * 0.03);
    B.rotation.x = P.pitch;
    // swimming: a slow wave runs down the body, bigger towards the tail; faster when it hurries
    S.ph += dt * (night ? 0.6 : 1.4 + S.spd * 2.4);
    const A = night ? 0.15 : 1;
    // the swipe (hunt, 1.3 s to 2.3 s): the head throws the saw sharply sideways and back, twice
    let sw = 0;
    if (st === 'hunt' && c.t > 1.3 && c.t < 2.3) {
      const k = (c.t - 1.3) / 1.0;
      sw = Math.sin(k * TAU * 2) * Math.sin(k * PI) * 0.75;
      if (!S.swiped && k > 0.1) { S.swiped = true; shoal.scatter(sawTip(vC)); if (env.call && d2(env) < 40) env.call(c, 'eat'); }
    }
    // the slashing (pose, 1.2 s in, until 1.3 s before the end): the saw swings above the water
    let sl = 0;
    if (st === 'rare' && c.t > 1.2 && c.t < c.hold - 1.3) {
      const k = (c.t - 1.2) * 1.5;
      sl = Math.sin(k * PI) * 0.62;
      const sideNow = Math.sign(Math.cos(k * PI));
      if (sideNow !== S.lastSlash) { S.lastSlash = sideNow; S.splash = 0; if (env.call && d2(env) < 40 && !S.called) { S.called = true; env.call(c, 'rare'); } }
    } else { S.lastSlash = 0; S.called = false; }
    S.swY = damp(S.swY, sw + sl, 18, dt);
    S0.rotation.y = Math.sin(S.ph) * 0.05 * A + S.swY;
    S1.rotation.y = -S.swY * 0.25;
    S2.rotation.y = Math.sin(S.ph - 1.1) * 0.1 * A - S.swY * 0.3;
    S3.rotation.y = Math.sin(S.ph - 2.0) * 0.18 * A - S.swY * 0.2;
    S4.rotation.y = Math.sin(S.ph - 2.8) * 0.3 * A;
    S0.rotation.x = -rk * 0.12;
    for (const f of pecs) { f.g.rotation.z = f.s * (Math.sin(S.ph * 0.5) * 0.06 * A - rk * 0.15); f.g.rotation.y = -f.s * S.swY * 0.2; }
    // breathing at rest: the gills under the head (the spiracles) open and close
    if (night) S1.scale.set(1 + Math.sin(t * 1.1 + c.bob) * 0.012, 1, 1);
    // the splash: at the saw where it cuts the surface
    if (S.splash >= 0) {
      S.splash += dt / 0.8;
      if (S.splash > 1) S.splash = -1;
    }
    SPL.visible = S.splash >= 0;
    if (SPL.visible) {
      c.root.updateMatrixWorld();
      sawTip(vA).lerp(S0.getWorldPosition(vB), 0.35);
      c.root.worldToLocal(vA);
      SPL.position.set(vA.x, sy - rp.y, vA.z);
      const k = S.splash, s = 0.4 + 1.1 * Math.sqrt(k);
      SPL.scale.set(s, Math.max(0.01, Math.sin(k * PI) * 1.3), s);
    }
    // the photo point: the head (it comes up with the pose)
    c.root.updateMatrixWorld();
    S0.getWorldPosition(vA);
    c.eye.copy(c.root.worldToLocal(vA));
  }
  const d2 = (env) => (env.dist ?? 99);

  pose(0, { t: 0, dist: 99, camPos: new THREE.Vector3(0, 0, 1e4), pellets: [] }, surf());
  c.root.updateMatrixWorld(true);
  shoal.reset(c, night);
  K.lod(c, near, far, 45);
  const setLod = c.lod;
  c.lod = (dd) => { setLod(dd); shoal.mesh.forEach((m) => { m.visible = !c.far; }); };
  return c;
}

// =============================================================================================
// The shoal: small silver fish (a bit over a hand long), each with a faint glowing line along its
// flank. They mill about near the sawfish, a little way off; the swipe scatters them in a flash and
// they come back together. At night they hover quietly over the sawfish where it rests.
function buildShoal(K, root, N) {
  let seed = 4513;                                                   // its own numbers: the run's others stay as they were
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const silver = K.sheen(0xcfd8dc, { roughness: 0.22, metalness: 0.55 }), finM = K.fin(0xdfe8ea, 0.55, 0.15);
  const line = K.glow(0x9ff3df, 0.6, { color: 0xb8c4c4 });
  const Lf = 0.26;
  const bodyG = K.geo('sfFishBody', () => {
    const parts = [new THREE.SphereGeometry(1, 10, 6).scale(0.028, 0.05, Lf * 0.5),
      new THREE.ShapeGeometry(new THREE.Shape([[0, 0], [0.06, 0], [0.025, 0.04]].map(([x, y]) => new THREE.Vector2(x, y)))).rotateY(-PI / 2).translate(0, 0.04, -0.02)];
    const g = mergeGeometries(parts.map((p) => { p.deleteAttribute('uv'); return p.index ? p.toNonIndexed() : p; }), false);
    parts.forEach((p) => p.dispose());
    return g;
  });
  const tailG = K.geo('sfFishTail', () => new THREE.ShapeGeometry(new THREE.Shape([[0, 0], [0.07, 0.05], [0.055, 0], [0.07, -0.05]].map(([x, y]) => new THREE.Vector2(x, y)))).rotateY(PI / 2));
  const lineG = K.geo('sfFishLine', () => new THREE.SphereGeometry(1, 6, 3).scale(0.0295, 0.006, Lf * 0.36).translate(0, 0.006, 0.0));
  const inst = (g, m) => {
    const im = new THREE.InstancedMesh(g, m, N);
    im.frustumCulled = false;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    root.add(im);
    return im;
  };
  const body = inst(bodyG, silver), tails = inst(tailG, finM), lines = inst(lineG, line);
  const F = [];
  for (let i = 0; i < N; i++) {
    const th = rnd() * TAU, ph = Math.acos(2 * rnd() - 1), r = 0.35 + Math.cbrt(rnd()) * 0.75;
    F.push({ o: new THREE.Vector3(Math.sin(ph) * Math.cos(th) * r * 1.2, Math.cos(ph) * r * 0.35, Math.sin(ph) * Math.sin(th) * r * 1.2),
      w: rnd() * TAU, f: 0.7 + rnd() * 0.7, pos: new THREE.Vector3(), vel: new THREE.Vector3(), off: new THREE.Vector3(), yaw: 0 });
  }
  const C = new THREE.Vector3(), V = new THREE.Vector3(0, 0, 1);
  let around = rnd() * TAU, flash = 0, scatterT = 99, quiet = false;
  const sh = {
    C, mesh: [body, tails, lines],
    reset(c, night) {
      quiet = night;
      c.forward(vA);
      C.copy(c.root.position).addScaledVector(vA, 2.6).add(vB.set(vA.z, 0, -vA.x).multiplyScalar(1.6));
      if (night) C.set(Math.cos(around) * 0.5, 0.75, Math.sin(around) * 0.5).add(c.root.position);
      else C.y = (K.waterY ? K.waterY(C.x, C.z) : 0) - 0.5;
      F.forEach((f) => f.pos.copy(C).add(f.o));
    },
    // the swipe went through them: each fish darts away from the saw, the closest the fastest
    scatter(at) {
      scatterT = 0; flash = 1;
      for (const f of F) {
        vA.subVectors(f.pos, at); vA.y *= 0.3;
        const dd = Math.max(0.3, vA.length());
        f.vel.copy(vA.normalize()).multiplyScalar(2.6 + 3.2 / dd + rnd());
      }
    },
    step(dt, env, c, S, sawTip) {
      const rp = c.root.position;
      // where the shoal heads: round and about the sawfish, a few metres off, drifting slowly
      around += dt * (quiet ? 0.05 : 0.14);
      if (quiet) vA.set(Math.cos(around) * 0.5, 0.75, Math.sin(around) * 0.5).add(rp);
      else {
        c.forward(vB);
        const r = 2.7 + Math.sin(around * 1.7) * 0.5;
        vA.copy(rp).addScaledVector(vB, 1.2 + Math.cos(around) * r).add(vC.set(vB.z, 0, -vB.x).multiplyScalar(Math.sin(around) * r * 0.8));
        vA.y = (K.waterY ? K.waterY(vA.x, vA.z) : 0) - 0.5;
      }
      // they keep clear of the saw while it is being swung, and drift back together afterwards
      const sp = scatterT < 3 ? 0.35 : quiet ? 0.12 : 0.65;
      vB.subVectors(vA, C);
      const dd = vB.length();
      if (dd > 0.02) { V.lerp(vB.multiplyScalar(1 / dd), Math.min(1, dt * 1.2)).normalize(); C.addScaledVector(V, Math.min(dd, sp * dt)); }
      scatterT += dt;
      flash = damp(flash, 0, 2.2, dt);
      const heading = Math.atan2(V.x, V.z), sy = K.waterY ? K.waterY(C.x, C.z) : 0, floor = K.groundY(C.x, C.z);
      mInv.copy(c.root.matrixWorld).invert();
      for (let i = 0; i < N; i++) {
        const f = F[i];
        // the slot in the loose shoal, turned with its heading, a wobble each; scattered fish coast
        // out on their own and are pulled back to their slot as they slow
        vA.copy(f.o).applyAxisAngle(vC.set(0, 1, 0), heading);
        vA.x += Math.sin(env.t * f.f + f.w) * 0.12; vA.y += Math.sin(env.t * f.f * 1.3 + f.w) * 0.06;
        f.off.addScaledVector(f.vel, dt);
        f.vel.multiplyScalar(Math.max(0, 1 - dt * 2.4));
        f.off.multiplyScalar(Math.max(0, 1 - dt * (scatterT < 1 ? 0.15 : 0.55)));
        const ox = f.pos.x, oz = f.pos.z;
        f.pos.copy(C).add(vA).add(f.off);
        f.pos.y = clamp(f.pos.y, floor + 0.15, sy - 0.12);
        const vx = f.pos.x - ox, vz = f.pos.z - oz, moving = Math.abs(vx) + Math.abs(vz) > dt * 0.4;
        const want = f.vel.lengthSq() > 0.4 ? Math.atan2(f.vel.x, f.vel.z) : moving ? Math.atan2(vx, vz) : heading;
        f.yaw += wrap(want - f.yaw) * Math.min(1, dt * (f.vel.lengthSq() > 0.4 ? 14 : 3));
        const fast = f.vel.length();
        const beat = Math.sin(env.t * (10 + fast * 8) * f.f + f.w);
        qA.setFromEuler(eA.set(0, f.yaw + beat * 0.07, Math.sin(env.t * 0.8 + f.w) * 0.05 + flash * Math.sin(f.w * 7) * 0.9, 'YXZ'));   // the flash: they roll and glint
        mA.compose(f.pos, qA, sOne).premultiply(mInv);
        body.setMatrixAt(i, mA); lines.setMatrixAt(i, mA);
        mB.makeRotationY(beat * 0.5).setPosition(0, 0, -Lf * 0.5);
        tails.setMatrixAt(i, mB.premultiply(mA));
      }
      body.instanceMatrix.needsUpdate = true; tails.instanceMatrix.needsUpdate = true; lines.instanceMatrix.needsUpdate = true;
    },
  };
  return sh;
}

// Merge every group's still meshes into one mesh coloured per face, whatever their material; skin
// parts (`mottle`) get a slightly uneven shade per face. The glowing lines and the wet eyes keep
// their own materials (K.bake merges those).
const glows = (m) => m.emissiveIntensity > 0 && (m.emissive.r + m.emissive.g + m.emissive.b) > 0;
function paint(K, root) {
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
      const vc = g.attributes.color;
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      g.applyMatrix4(ch.matrix);
      const pos = g.attributes.position, n = pos.count, out = new Float32Array(n * 3);
      for (let i = 0; i < n; i += 3) {
        col.copy(ch.material.color);
        if (vc) col.setRGB((vc.getX(i) + vc.getX(i + 1) + vc.getX(i + 2)) / 3, (vc.getY(i) + vc.getY(i + 1) + vc.getY(i + 2)) / 3, (vc.getZ(i) + vc.getZ(i + 1) + vc.getZ(i + 2)) / 3);
        if (ch.userData.mottle) {
          cen.fromBufferAttribute(pos, i).add(vA.fromBufferAttribute(pos, i + 1)).add(vA.fromBufferAttribute(pos, i + 2)).multiplyScalar(1 / 3);
          const h = hash(cen.x * 41, cen.y * 41, cen.z * 41);
          col.multiplyScalar(0.95 + h * 0.08);
        }
        // the body keeps its smooth shading from the back to the pale belly (per vertex), a touch uneven
        if (vc) for (let j = 0; j < 3 && i + j < n; j++) { const k = col.r / Math.max(1e-4, (vc.getX(i) + vc.getX(i + 1) + vc.getX(i + 2)) / 3); out[(i + j) * 3] = vc.getX(i + j) * k; out[(i + j) * 3 + 1] = vc.getY(i + j) * k; out[(i + j) * 3 + 2] = vc.getZ(i + j) * k; }
        else for (let j = 0; j < 3 && i + j < n; j++) { out[(i + j) * 3] = col.r; out[(i + j) * 3 + 1] = col.g; out[(i + j) * 3 + 2] = col.b; }
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
  'largetooth-sawfish': buildSawfish,
};
