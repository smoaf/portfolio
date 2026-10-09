// The forest: the jungle route's animals. Some live up in the trees (the route hands them a branch
// as `home`, and they stay on it), some walk the forest floor, and one only comes out at night.
//
//   tarsier         clings to a slanting stem, turns its head almost all the way round; leaps at night
//   giant-panda     sits eating bamboo, walks on all fours; tumbles over and rolls on its back
//   bongo-antelope  chestnut with thin white stripes, lyre horns, big ears; shy; stripes flare on alarm
//   giant-anteater  knuckle walker with a tube snout and a flag tail; rears up with its claws open
//   flower-mantis   sits on a flowering stem and sways like one; strikes, then fans its eyespot wings
//   treehopper      on a twig under a tall pitted helmet; the helmet lights up and it hops
//   eyespot-moth    flat on a trunk; flashes its eyespots and flutters (dusk)
//   poodle-moth     the secret: a white felt moth circling a glowing pod; comes to hover at the van
//
// Insects and the tarsier are scaled up (the research-station twist). Perched animals bring a short
// piece of their own perch (stem, twig, trunk or flower) so they never hang in the air; `opts.stub =
// false` (or `opts.perch = true` for the mantis) leaves it out when the route puts them on real wood.
import * as THREE from 'three';

export const SPECIES = {
  tarsier: { id: 'tarsier', name: 'Tarsier', points: 220, call: { hz: 5200, kind: 'trill' } },
  'giant-panda': { id: 'giant-panda', name: 'Giant panda', points: 200, call: { hz: 420, kind: 'hoot' } },
  'bongo-antelope': { id: 'bongo-antelope', name: 'Bongo', points: 240, call: { hz: 520, kind: 'noise' } },
  'giant-anteater': { id: 'giant-anteater', name: 'Giant anteater', points: 190, call: { hz: 260, kind: 'noise' } },
  'flower-mantis': { id: 'flower-mantis', name: 'Flower mantis', points: 230, call: { hz: 2600, kind: 'chirp' } },
  treehopper: { id: 'treehopper', name: 'Helmet treehopper', points: 210, call: { hz: 1500, kind: 'trill' } },
  'eyespot-moth': { id: 'eyespot-moth', name: 'Eyespot moth', points: 180, call: { hz: 4800, kind: 'noise' } },
  'poodle-moth': { id: 'poodle-moth', name: 'Poodle moth', points: 450, call: { hz: 6400, kind: 'chirp' } },
};

// ---- small shared helpers
const vA = new THREE.Vector3(), vB = new THREE.Vector3();
const PI = Math.PI;
const damp = (cur, to, k, dt) => cur + (to - cur) * Math.min(1, k * dt);
const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const mirror = (pts) => pts.map(([x, y]) => [-x, y]);

// a pair of eyes in one group (so both blink together and bake into few meshes). `dark` makes plain
// glossy mammal eyes (ball + catchlight); otherwise the kit's full eye with iris and pupil.
function eyePair(K, parent, pos, { dx, r, iris = 0x2a1a10, glow = 0, yaw = 0.35, pitch = 0, dark = false, slit = false }) {
  const g = K.group(pos, parent);
  for (const s of [-1, 1]) {
    if (dark) {
      K.mesh(K.sphere(1, 12, 9), K.sheen(0x0d0907, { roughness: 0.12 }), [s * dx, 0, 0], g, null, r);
      K.mesh(K.sphere(1, 6, 5), K.mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9 }),
        [s * dx + s * r * 0.3, r * 0.42, r * 0.82], g, null, r * 0.22);
      continue;
    }
    const e = K.eye(g, { pos: [s * dx, 0, 0], r, iris, glow, slit, dir: [s * Math.sin(yaw), pitch, Math.cos(yaw)] });
    e.updateMatrix();
    for (const m of [...e.children]) { m.applyMatrix4(e.matrix); g.add(m); }
    g.remove(e);
  }
  return g;
}

// a jointed leg: hip group -> upper capsule, knee group -> lower capsule (+ a foot callback)
function leg(K, parent, pos, { r1, l1, r2, l2, m1, m2 = m1, foot }) {
  const hip = K.group(pos, parent);
  K.mesh(K.capsule(r1, l1, 3, 7), m1, [0, -l1 / 2, 0], hip);
  const knee = K.group([0, -l1, 0], hip);
  K.mesh(K.capsule(r2, l2, 3, 7), m2, [0, -l2 / 2, 0], knee);
  if (foot) foot(knee, -l2);
  return { hip, knee };
}

// the meshes of a group that use a material (after the bake), so a pose can swap a glow in
const withMat = (group, mat) => group.children.filter((o) => o.isMesh && o.material === mat);
const swap = (list, mat) => { for (const m of list) if (m.material !== mat) m.material = mat; };

// say something once when the rare behaviour starts
function rareCue(c, env) {
  if (c.state === 'rare') { if (!c._cue) { c._cue = 1; if (env.call) env.call(c, 'rare'); } } else c._cue = 0;
}

// a percher stays exactly where it was put: the shared state machine still runs (it decides the
// moods), but the root never walks, turns or drops to the ground. Feed nearby sets off the show.
function perch(c) {
  const step = c.step;
  c.step = (dt, env) => {
    if (!c._p0) { c._p0 = c.root.position.clone(); c._y0 = c.root.rotation.y; }
    if (c.state === 'eat' && c.t > 1.4) {
      if (c.pellet) { c.pellet.eaten = true; c.pellet.eatenAt = env.t; }
      c.go(Math.random() < c.rareChance ? 'rare' : 'idle', 4.5 + Math.random());
    }
    step(dt, env);
    c.root.position.copy(c._p0); c.root.rotation.y = c._y0;
    c.root.updateMatrixWorld();
  };
  return c;
}

// a walk that was started without a goal (a forced state) gets one, so nothing reads a null target
function needTarget(c, state) {
  if ((state === 'wander' || state === 'flee') && !c.target) {
    const a = Math.random() * PI * 2;
    c.target = c.home.clone().add(vA.set(Math.cos(a), 0, Math.sin(a)).multiplyScalar(Math.max(4, c.roam)));
  }
}

// fold a still group's meshes into its parent (keeping where they are), so the bake can merge
// them with the parent's: one draw call per material instead of one per little group
function fold(g) {
  g.updateMatrix();
  for (const m of [...g.children]) if (m.isMesh) { m.applyMatrix4(g.matrix); g.parent.add(m); }
  return g;
}

// the gait: legs = [{ hip, knee, ph, front }]; w = how much they swing (smoothed by the caller)
function gait(legs, ph, w, amp = 0.5, bend = 0.7) {
  for (const L of legs) {
    const p = ph + L.ph, s = Math.sin(p);
    L.hip.rotation.x = s * amp * w + (L.base || 0);
    const lift = Math.max(0, Math.cos(p)) * bend * w;           // the foot folds on the way forward
    L.knee.rotation.x = (L.front ? lift : -lift) + (L.kbase || 0);
  }
}

// =============================================================================================
// Tarsier: a fist-sized primate scaled up to a small child, clinging upright to a slanting stem.
// Enormous amber eyes (they glow orange after dark), thin membranous ears, long fingers with
// round pads, a long naked tail with a tuft. The head swivels almost 180 degrees to follow the van.
export function buildTarsier(K, home, opts = {}) {
  // it sits in the canopy's deep shade, so the coat gives off a faint warmth of its own to read there
  const fur = K.mat(0x8c6c55, { roughness: 0.9, emissive: 0x2e2018 }), pale = K.mat(0xa8927f, { roughness: 0.92, emissive: 0x3a2e24 });
  const skin = K.mat(0xa9786a, { roughness: 0.7, emissive: 0x2a1814 }), face = K.mat(0x5e4436, { roughness: 0.85 });
  const bark = K.mat(0x5a4636, { roughness: 0.95 }), moss = K.mat(0x55703a, { roughness: 0.95 });
  const ear = K.fin(0xd58c5a, 0.88, 0.25);
  const flare = K.glow(0xff8a1c, 6, { roughness: 0.15 });

  const root = new THREE.Group(), near = K.group(null, root), far = K.group(null, root);
  const TX = -0.2, TZ = -0.13;                                  // the stem's axis, beside and behind
  if (opts.stub !== false) {
    const st = K.group([TX, 0.25, TZ], near, [-0.12, 0, 0.22]);
    K.mesh(K.cyl(0.085, 0.12, 3.2, 8), bark, [0, 0, 0], st);
    K.mesh(K.cyl(0.03, 0.05, 0.9, 6), bark, [0.25, 0.6, 0], st, [0, 0, -0.9]);
    K.mesh(K.sphere(1, 8, 6), moss, [0.05, -0.75, 0.05], st, null, [0.09, 0.18, 0.06]);
    fold(st);
    K.mesh(K.cyl(0.085, 0.12, 3.2, 6), bark, [TX, 0.25, TZ], far, [-0.12, 0, 0.22]);
  }
  // orbit: the body can scuttle round the stem to hide; b: the body itself (hops up the stem)
  const orbit = K.group([TX, 0, TZ], near);
  const b = K.group([-TX, 0, -TZ], orbit);
  K.mesh(K.sphere(1, 12, 9), fur, [0, 0.28, -0.01], b, null, [0.15, 0.2, 0.14]);
  K.mesh(K.sphere(1, 10, 8), pale, [0, 0.25, 0.06], b, null, [0.115, 0.15, 0.09]);
  for (const s of [-1, 1]) {
    // frog-like folded hind legs: big thighs, long shins and very long feet gripping the stem
    K.mesh(K.sphere(1, 10, 8), fur, [s * 0.1, 0.14, 0.04], b, [0.4, 0, 0], [0.075, 0.13, 0.12]);
    K.mesh(K.tube('tarShin' + s, [[s * 0.11, 0.06, 0.12], [s * 0.05, 0.02, 0.06], [-0.06 + s * 0.02, 0.04, -0.02]], 0.03, 0.022, 6, 6), skin, null, b);
    for (let i = 0; i < 3; i++) {
      K.mesh(K.capsule(0.011, 0.07, 2, 5), skin, [-0.1 + s * 0.01, 0.04 + (i - 1) * 0.035, -0.04 + i * 0.01], b, [0, 0, 1.35]);
      K.mesh(K.sphere(1, 6, 5), skin, [-0.14 + s * 0.01, 0.05 + (i - 1) * 0.038, -0.03 + i * 0.01], b, null, 0.018);
    }
  }
  // arms reaching to the stem, long thin fingers with round pads
  const hands = [[-0.13, 0.43, 0.0], [-0.12, 0.3, 0.03]];
  [[0.1, 0.4, 0.06], [-0.08, 0.38, 0.06]].forEach((sh, i) => {
    const h = hands[i];
    K.mesh(K.tube('tarArm' + i, [sh, [(sh[0] + h[0]) / 2 + 0.01, (sh[1] + h[1]) / 2 - 0.03, 0.1], h], 0.025, 0.018, 6, 6), fur, null, b);
    for (let f = 0; f < 4; f++) {
      const a = -0.9 + f * 0.55;
      K.mesh(K.capsule(0.008, 0.055, 2, 5), skin, [h[0] - 0.02, h[1] + Math.sin(a) * 0.035, h[2] + Math.cos(a) * 0.01], b, [0, 0, PI / 2 + a * 0.6]);
      K.mesh(K.sphere(1, 6, 5), skin, [h[0] - 0.05, h[1] + Math.sin(a) * 0.05, h[2] + 0.01], b, null, 0.014);
    }
  });
  // tail: a long naked rod hanging down the stem, with a tuft at the end
  const tail1 = K.group([0, 0.1, -0.11], b, [0.25, 0, 0]);
  K.mesh(K.capsule(0.016, 0.36, 2, 6), skin, [0, -0.19, 0], tail1);
  const tail2 = K.group([0, -0.38, 0], tail1, [0.15, 0, 0]);
  K.mesh(K.capsule(0.013, 0.32, 2, 6), skin, [0, -0.17, 0], tail2);
  K.mesh(K.sphere(1, 8, 6), fur, [0, -0.36, 0], tail2, null, [0.028, 0.09, 0.028]);

  // head: a round fuzzy ball with a flat dark face disc and two eyes each bigger than the brain
  const head = K.group([0, 0.5, 0.02], b);
  K.mesh(K.sphere(1, 14, 10), fur, [0, 0, -0.01], head, null, [0.155, 0.14, 0.135]);
  K.mesh(K.sphere(1, 12, 9), face, [0, 0.0, 0.07], head, null, [0.145, 0.105, 0.07]);
  K.mesh(K.sphere(1, 10, 8), skin, [0, -0.075, 0.125], head, null, [0.042, 0.032, 0.035]);
  K.mesh(K.sphere(1, 6, 5), face, [0, -0.06, 0.158], head, null, [0.014, 0.008, 0.008]);
  K.mesh(K.sphere(1, 8, 6), pale, [0, -0.1, 0.1], head, null, [0.06, 0.03, 0.04]);
  const eyes = eyePair(K, head, [0, 0.012, 0.1], { dx: 0.068, r: 0.064, iris: 0xc0862a, glow: 0.55, yaw: 0.22 });
  const irises = () => eyes.children.filter((o) => o.material && o.material.emissive && o.material.emissiveIntensity < 3 && o.material.color.getHex() === 0xc0862a);
  const earPts = [[0, 0], [0.05, 0.015], [0.09, 0.07], [0.085, 0.13], [0.04, 0.155], [-0.01, 0.12], [-0.025, 0.05]];
  const ears = [-1, 1].map((s) => {
    const g = K.group([s * 0.1, 0.085, -0.03], head, [-0.15, s * 0.55, -s * 0.35]);
    K.mesh(K.shape('tarEar' + s, s > 0 ? earPts : mirror(earPts)), ear, [0, 0, 0], g);
    return g;
  });
  // far: the same shape in four pieces
  K.mesh(K.sphere(1, 8, 6), fur, [0, 0.3, 0], far, null, [0.16, 0.24, 0.15]);
  K.mesh(K.sphere(1, 8, 6), fur, [0, 0.52, 0.02], far, null, 0.15);
  K.mesh(K.sphere(1, 8, 6), K.glow(0xc0862a, 0.55), [0, 0.53, 0.13], far, null, [0.13, 0.065, 0.04]);

  K.place(root, home);
  const irisMeshes = irises();
  const baseIris = irisMeshes[0] && irisMeshes[0].material;

  const c = K.makeCreature({
    species: SPECIES.tarsier, onState: needTarget, root, home, radius: 0.5, eye: new THREE.Vector3(0, 0.52, 0.08), flyer: true,
    speed: 0.0001, roam: 0, fleeAt: 5, curiousAt: 32, shy: 0.4, rareChance: 0.6, rareAt: 'night', yaw: opts.yaw,
    pose(c, dt, env) {
      rareCue(c, env);
      K.blink(c, [eyes], dt);
      // the head follows the van almost all the way round, quick and owl-like
      K.look(c, head, env, dt, { yaw: 2.75, pitch: 0.6, rate: 6, force: c.near < 45 && c.state !== 'flee' });
      const br = 1 + Math.sin(env.t * 2.4 + c.bob) * 0.02;
      b.scale.set(br, 1 + (br - 1) * 0.6, br);
      ears.forEach((e, i) => { e.rotation.x = -0.15 + Math.sin(env.t * 1.3 + i * 2 + c.bob) * 0.08 + (Math.sin(env.t * 0.7 + i) > 0.97 ? 0.4 : 0); });
      tail1.rotation.z = Math.sin(env.t * 0.6 + c.bob) * 0.12;
      tail2.rotation.z = Math.sin(env.t * 0.6 + c.bob - 0.8) * 0.18;
      // hiding: scuttle round the stem to the side away from the van
      let hide = 0;
      if (c.state === 'flee') {
        root.worldToLocal(vA.copy(env.camPos));
        hide = Math.atan2(vA.z - TZ, -(vA.x - TX));
      }
      orbit.rotation.y += (hide - orbit.rotation.y) * Math.min(1, dt * 4);
      // rare: a leap up the stem, then the eyes flare and pulse
      let up = 0, lean = 0;
      if (c.state === 'rare') {
        const u = smooth((c.t - 0.2) / 0.55);
        up = u * 0.7 + Math.sin(u * PI) * 0.35;
        lean = Math.sin(u * PI) * -0.5;
        const on = c.t > 0.7 && (Math.sin(c.t * 7) > -0.3 || K.night);
        swap(irisMeshes, on ? flare : baseIris);
        eyes.scale.x = eyes.scale.z = damp(eyes.scale.x, on ? 1.12 : 1, 8, dt);
      } else {
        swap(irisMeshes, baseIris);
        eyes.scale.x = eyes.scale.z = damp(eyes.scale.x, 1, 8, dt);
      }
      b.position.y = c.state === 'rare' ? up : damp(b.position.y, 0, 1.2, dt);   // climbs back down slowly
      b.rotation.x = damp(b.rotation.x, lean, 10, dt);
    },
  });
  return perch(K.lod(c, near, far, 40));
}

// =============================================================================================
// Giant panda: sits back on its rump eating bamboo held in a front paw, walks on all fours when it
// moves. Black eye patches, ears, legs and the band over the shoulders; everything else white.
export function buildGiantPanda(K, home, opts = {}) {
  const white = K.mat(0xeeebe2, { roughness: 0.95 }), black = K.mat(0x1c1a1a, { roughness: 0.9 });
  const cane = K.mat(0x8faa45, { roughness: 0.6 }), leafM = K.mat(0x4f7d2e, { roughness: 0.7, side: THREE.DoubleSide });
  const glowM = K.glow(0x7fe0d0, 0.6);

  const root = new THREE.Group(), near = K.group(null, root), far = K.group(null, root);
  K.shadow(root, 0.75, 1.0);
  const tum = K.group([0, 0.62, 0], near);                       // the tumble pivot
  const hip = K.group([0, 0, -0.38], tum);                      // sitting pivots here
  K.mesh(K.sphere(1, 14, 10), white, [0, 0.04, 0.05], hip, null, [0.36, 0.37, 0.36]);
  K.mesh(K.sphere(1, 14, 10), white, [0, 0.07, 0.4], hip, null, [0.37, 0.38, 0.42]);
  K.mesh(K.sphere(1, 14, 10), black, [0, 0.08, 0.7], hip, null, [0.385, 0.4, 0.21]);    // the shoulder band
  K.mesh(K.sphere(1, 10, 8), white, [0, 0.12, -0.3], hip, null, [0.08, 0.07, 0.06]);    // the stub tail
  for (const s of [-1, 1]) K.mesh(K.sphere(1, 10, 8), black, [s * 0.2, -0.04, 0.04], hip, null, [0.18, 0.26, 0.25]);
  // the twist: a faint glowing seam along the spine
  K.mesh(K.capsule(0.02, 0.4, 2, 5), glowM, [0, 0.43, 0.32], hip, [PI / 2, 0, 0]);

  const neck = K.group([0, 0.16, 0.84], hip);
  const head = K.group([0, 0.05, 0.12], neck);
  K.mesh(K.sphere(1, 14, 10), white, [0, 0, 0], head, null, [0.29, 0.26, 0.26]);
  K.mesh(K.sphere(1, 12, 9), white, [0, -0.08, 0.17], head, null, [0.15, 0.12, 0.14]);
  K.mesh(K.sphere(1, 10, 8), black, [0, -0.04, 0.3], head, null, [0.055, 0.035, 0.035]);
  K.mesh(K.box(0.006, 0.05, 0.01), black, [0, -0.1, 0.305], head);
  for (const s of [-1, 1]) {
    K.mesh(K.sphere(1, 10, 8), black, [s * 0.1, 0.03, 0.2], head, [0.15, -s * 0.5, s * 0.6], [0.06, 0.09, 0.05]);
    K.mesh(K.sphere(1, 10, 8), black, [s * 0.2, 0.2, -0.02], head, null, [0.085, 0.085, 0.05]);
  }
  const eyes = eyePair(K, head, [0, 0.045, 0.235], { dx: 0.1, r: 0.022, dark: true });

  // legs: all black. Front legs double as arms when it sits; the right paw holds the cane.
  const pawF = (g, y) => K.mesh(K.sphere(1, 10, 8), black, [0, y - 0.03, 0.04], g, null, [0.1, 0.07, 0.13]);
  const pawH = (g, y) => K.mesh(K.sphere(1, 10, 8), black, [0, y - 0.03, 0.06], g, null, [0.1, 0.06, 0.16]);
  const legs = [
    { ...leg(K, hip, [-0.21, -0.02, 0.72], { r1: 0.11, l1: 0.3, r2: 0.095, l2: 0.22, m1: black, foot: pawF }), ph: 0, front: true },
    { ...leg(K, hip, [0.21, -0.02, 0.72], { r1: 0.11, l1: 0.3, r2: 0.095, l2: 0.22, m1: black, foot: pawF }), ph: PI, front: true },
    { ...leg(K, hip, [-0.2, -0.06, 0.02], { r1: 0.12, l1: 0.26, r2: 0.1, l2: 0.2, m1: black, foot: pawH }), ph: PI },
    { ...leg(K, hip, [0.2, -0.06, 0.02], { r1: 0.12, l1: 0.26, r2: 0.1, l2: 0.2, m1: black, foot: pawH }), ph: 0 },
  ];
  // the bamboo cane in the right front paw: a jointed stalk with a spray of leaves at the top
  const bam = K.group([0, -0.26, 0.06], legs[1].knee, [PI - 0.3, 0, 0.35]);
  K.mesh(K.cyl(0.026, 0.03, 1.2, 7), cane, [0, 0.3, 0], bam);
  for (let i = 0; i < 4; i++) K.mesh(K.cyl(0.034, 0.034, 0.025, 7), cane, [0, -0.12 + i * 0.26, 0], bam);
  const leafPts = [[0, 0], [0.04, 0.1], [0.03, 0.3], [0, 0.38], [-0.02, 0.28], [-0.03, 0.1]];
  for (let i = 0; i < 5; i++) K.mesh(K.shape('pandaLeaf', leafPts), leafM, [0, 0.82 + (i % 2) * 0.06, 0], bam, [0.2 + (i % 3) * 0.3, i * 1.3, 0.6 + i * 0.25]);

  // far
  K.mesh(K.sphere(1, 10, 7), white, [0, 0.62, -0.05], far, null, [0.4, 0.4, 0.72]);
  K.mesh(K.sphere(1, 8, 6), white, [0, 0.84, 0.66], far, null, 0.28);
  K.mesh(K.sphere(1, 8, 6), black, [0, 0.66, 0.28], far, null, [0.42, 0.43, 0.22]);
  K.mesh(K.box(0.6, 0.5, 0.95), black, [0, 0.25, 0.0], far);
  K.place(root, home);

  let sit = 1, w = 0, ph = 0;
  const c = K.makeCreature({
    species: SPECIES['giant-panda'], onState: needTarget, root, home, radius: 0.95, eye: new THREE.Vector3(0, 1.0, 0.55), ground: K.groundY,
    speed: 0.85, roam: 5, fleeAt: 6, curiousAt: 26, shy: 0.25, rareChance: 0.7, yaw: opts.yaw,
    pose(c, dt, env) {
      rareCue(c, env);
      K.blink(c, [eyes], dt);
      const moving = c.state === 'wander' || c.state === 'flee' || (c.state === 'eat' && c.pellet && c.pellet.pos.distanceTo(root.position) > 0.4);
      const sitting = !moving && c.state !== 'curious' && c.state !== 'rare';
      sit = damp(sit, sitting ? 1 : 0, 2.2, dt);
      w = damp(w, moving ? 1 : 0, 4, dt);
      ph += dt * (c.state === 'flee' ? 9 : 5) * w;
      // tumble and roll on its back (rare); otherwise level
      let tx = 0, tz = 0, lift = 0, back = 0;
      if (c.state === 'rare') {
        const u = Math.min(1, c.t / 1.5);
        if (u < 1) { tx = smooth(u) * PI * 2; lift = Math.sin(u * PI) * 0.35; }
        else { back = smooth((c.t - 1.5) / 0.8); tz = Math.sin(c.t * 2.3) * 0.32 * back; }
      }
      if (c.state === 'rare' && c.t < 1.5) tum.rotation.x = tx;
      else tum.rotation.x = damp(tum.rotation.x > PI ? tum.rotation.x - PI * 2 : tum.rotation.x, -1.25 * back, 4, dt);
      tum.rotation.z = damp(tum.rotation.z, tz, 4, dt);
      tum.position.y = 0.62 - 0.32 * sit - 0.18 * back + lift + Math.abs(Math.sin(ph)) * 0.025 * w;
      hip.rotation.x = -1.15 * sit - 0.9 * back;
      hip.position.z = -0.38 + 0.12 * back;
      // neck: keeps the head level when sitting, dips to the cane when munching, sniffs when walking
      const munch = sitting ? Math.sin(env.t * 5.2 + c.bob) : 0;
      neck.rotation.x = damp(neck.rotation.x, 1.05 * sit + 0.1 * munch * sit + 0.95 * back + (moving ? 0.15 : 0), 5, dt);
      K.look(c, head, env, dt, { yaw: 0.8, pitch: 0.4, rate: 2.5 });
      const br = 1 + Math.sin(env.t * 1.6 + c.bob) * 0.012;
      hip.scale.set(br, br, 1);
      // legs: walking gait blended with the sitting pose (arms up to the mouth, hind legs forward)
      gait(legs, ph, w, 0.45, 0.6);
      const raise = 0.15 + 0.08 * Math.sin(env.t * 2.6 + c.bob);
      const wave = back ? Math.sin(c.t * 5) * 0.4 : 0;
      const sitPose = [[-0.05 + wave, 0.3], [-0.6 - raise, -1.5], [-0.2 - wave, 0], [-0.2 + wave, 0]];
      legs.forEach((L, i) => {
        const k = Math.max(sit, back);
        L.hip.rotation.x = L.hip.rotation.x * (1 - k) + sitPose[i][0] * k + (back ? -0.9 * back + (i < 2 ? -0.6 : 0.2) : 0);
        L.knee.rotation.x = L.knee.rotation.x * (1 - k) + sitPose[i][1] * k;
        L.hip.rotation.z = (i % 2 ? 1 : -1) * ((i === 1 ? 0.4 : 0.12) * sit + 0.35 * back);
      });
      bam.scale.setScalar(Math.max(0.001, smooth((sit - 0.35) / 0.5)));
    },
  });
  return K.lod(c, near, far, 45);
}

// =============================================================================================
// Bongo: a big forest antelope. Chestnut coat with a dozen thin white stripes, a white chevron
// between the eyes and a white crescent on the chest, lyre-shaped spiral horns, huge ears, black
// and white legs. Very shy. Rare: the alarm, head high, ears forward, a bark and the stripes flare.
export function buildBongoAntelope(K, home, opts = {}) {
  const coat = K.mat(0xa4471c, { roughness: 0.75 }), dark = K.mat(0x2a1a12, { roughness: 0.8 });
  const stripe = K.glow(0xf5efe2, 0.18, { roughness: 0.7 }), flash = K.glow(0xfff6dc, 2.6, { roughness: 0.4 });
  const horn = K.sheen(0x3b2b1e, { roughness: 0.45 });

  const root = new THREE.Group(), near = K.group(null, root), far = K.group(null, root);
  K.shadow(root, 0.6, 1.1);
  const body = K.group([0, 0, 0], near);
  const tor = K.group([0, 0.98, 0], body);
  const parts = [[0, 0, 0.27, 0.32, 0.62], [0.42, 0.02, 0.24, 0.3, 0.3], [-0.42, 0.02, 0.25, 0.31, 0.3]];   // z, y, rx, ry, rz
  for (const [z, y, rx, ry, rz] of parts) K.mesh(K.sphere(1, 14, 10), coat, [0, y, z], tor, null, [rx, ry, rz]);
  // the stripes: thin arcs over the back, fitted to the body's section at each point
  const sect = (z) => {
    let bx = 0, by = 0;
    for (const [pz, py, rx, ry, rz] of parts) {
      const k = 1 - ((z - pz) / rz) ** 2;
      if (k > 0) { bx = Math.max(bx, rx * Math.sqrt(k)); by = Math.max(by, py + ry * Math.sqrt(k)); }
    }
    return [bx, by];
  };
  for (let i = 0; i < 13; i++) {
    const z = 0.3 - i * 0.052 - (i % 3) * 0.006, [rx, ry] = sect(z);
    K.mesh(K.torus(1, 0.022, 3, 14, PI * 1.2), stripe, [0, 0.0, z], tor, [0, 0.1 - i * 0.012, -PI * 0.1], [rx * 1.01, ry * 0.99, 0.5]);
  }
  K.mesh(K.box(0.03, 0.03, 0.9), dark, [0, 0.315, -0.02], tor);                  // the dark spinal crest
  K.mesh(K.torus(1, 0.04, 3, 12, PI * 0.9), stripe, [0, 0.18, 0.62], tor, [-0.55, 0, PI * 1.05], [0.17, 0.15, 0.6]);  // chest crescent
  const strMesh = () => withMat(tor, stripe);

  // neck and head
  const neck = K.group([0, 1.12, 0.52], body);
  K.mesh(K.capsule(0.12, 0.38, 3, 8), coat, [0, 0.17, 0.08], neck, [0.55, 0, 0]);
  const hb = K.group([0, 0.38, 0.26], neck), head = K.group(null, hb);
  K.mesh(K.sphere(1, 12, 9), coat, [0, 0, 0], head, null, [0.12, 0.13, 0.16]);
  K.mesh(K.capsule(0.075, 0.14, 3, 8), coat, [0, -0.07, 0.15], head, [1.25, 0, 0]);
  K.mesh(K.sphere(1, 10, 8), dark, [0, -0.085, 0.27], head, null, [0.06, 0.05, 0.045]);
  K.mesh(K.sphere(1, 8, 6), dark, [0, -0.07, 0.305], head, null, [0.045, 0.025, 0.02]);
  K.mesh(K.box(0.022, 0.15, 0.02), stripe, [-0.035, 0.0, 0.17], head, [0.9, 0, -0.65]);    // the white chevron
  K.mesh(K.box(0.022, 0.15, 0.02), stripe, [0.035, 0.0, 0.17], head, [0.9, 0, 0.65]);
  for (const s of [-1, 1]) K.mesh(K.sphere(1, 8, 6), stripe, [s * 0.105, -0.045, 0.06], head, null, [0.012, 0.022, 0.022]);
  K.mesh(K.sphere(1, 8, 6), stripe, [0, -0.15, 0.2], head, null, [0.06, 0.02, 0.06]);
  const eyes = eyePair(K, head, [0, 0.03, 0.08], { dx: 0.1, r: 0.03, dark: true });
  for (const s of [-1, 1]) {
    const pts = [[s * 0.06, 0.1], [s * 0.1, 0.25], [s * 0.18, 0.42], [s * 0.12, 0.58], [s * 0.17, 0.72]];
    K.mesh(K.tube('bongoHorn' + s, pts.map(([x, y], i) => [x, y, -0.03 - i * 0.05]), 0.035, 0.012, 6, 14), horn, null, head);
    K.mesh(K.cone(0.012, 0.07, 5), stripe, [s * 0.17, 0.75, -0.24], head, [-0.4, 0, 0]);
  }
  const earPts = Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * PI * 2; return [0.035 + Math.sin(a) * 0.065 * (1 - 0.25 * Math.cos(a)), 0.14 - Math.cos(a) * 0.14]; });
  const ears = [-1, 1].map((s) => {
    const g = K.group([s * 0.1, 0.07, -0.04], head, [0.1, s * 0.25, -s * 1.15]);
    K.mesh(K.shape('bongoEar' + s, s > 0 ? earPts : mirror(earPts), 0.015), coat, [0, 0, 0], g);
    K.mesh(K.shape('bongoEarIn' + s, (s > 0 ? earPts : mirror(earPts)).map(([x, y]) => [x * 0.75, y * 0.82 + 0.02])), stripe, [0, 0, 0.009], g);
    return g;
  });
  // legs: chestnut above, black-brown below, small hooves
  const hoof = (g, y) => K.mesh(K.cone(0.05, 0.09, 6), dark, [0, y - 0.03, 0.015], g, [PI, 0, 0]);
  const L = (x, z, ph, front) => ({ ...leg(K, body, [x, 0.9, z], { r1: 0.07, l1: 0.32, r2: 0.04, l2: 0.36, m1: coat, m2: dark, foot: hoof }), ph, front });
  const legs = [L(-0.15, 0.45, 0, true), L(0.15, 0.45, PI, true), L(-0.15, -0.46, PI, false), L(0.15, -0.46, 0, false)];
  const tail = K.group([0, 1.08, -0.68], body, [0.3, 0, 0]);
  K.mesh(K.capsule(0.025, 0.3, 2, 6), coat, [0, -0.17, 0], tail);
  K.mesh(K.sphere(1, 8, 6), coat, [0, -0.36, 0], tail, null, [0.04, 0.08, 0.04]);

  // far
  K.mesh(K.sphere(1, 10, 7), coat, [0, 0.98, 0], far, null, [0.28, 0.34, 0.8]);
  K.mesh(K.capsule(0.1, 0.42, 2, 6), coat, [0, 1.42, 0.72], far, [0.7, 0, 0]);
  K.mesh(K.box(0.36, 0.8, 1.0), dark, [0, 0.4, 0], far);
  K.mesh(K.box(0.4, 0.04, 0.9), stripe, [0, 1.2, 0], far);
  K.place(root, home);
  const stripesNow = strMesh();

  let w = 0, ph = 0, alert = 0;
  const c = K.makeCreature({
    species: SPECIES['bongo-antelope'], onState: needTarget, root, home, radius: 1.0, eye: new THREE.Vector3(0, 1.55, 0.85), ground: K.groundY,
    speed: 1.7, roam: 8, fleeAt: 12, curiousAt: 30, shy: 0.85, rareChance: 0.5, yaw: opts.yaw,
    pose(c, dt, env) {
      rareCue(c, env);
      K.blink(c, [eyes], dt);
      const moving = c.state === 'wander' || c.state === 'flee' || (c.state === 'eat' && c.pellet && c.pellet.pos.distanceTo(root.position) > 0.4);
      const fleeing = c.state === 'flee';
      w = damp(w, moving ? 1 : 0, 5, dt);
      ph += dt * (fleeing ? 12 : 6.5) * w;
      gait(legs, ph, w, fleeing ? 0.75 : 0.45, fleeing ? 1.1 : 0.7);
      body.position.y = Math.abs(Math.sin(ph)) * (fleeing ? 0.09 : 0.03) * w;
      body.rotation.x = Math.sin(ph * 2) * 0.03 * w;
      alert = damp(alert, c.state === 'rare' ? 1 : 0, 5, dt);
      const grazing = (c.state === 'eat' && !moving) || (c.state === 'idle' && Math.sin(env.t * 0.21 + c.bob) > 0.35);
      neck.rotation.x = damp(neck.rotation.x, grazing ? 1.35 : (fleeing ? 0.35 : -0.45 * alert), 3, dt);
      hb.position.y = 0.38 + alert * 0.06;
      K.look(c, head, env, dt, { yaw: 0.9, pitch: 0.45, rate: 3, force: alert > 0.5 });
      // rare: a stamp and a bark (the head jerks), and the stripes flare
      if (c.state === 'rare') {
        const bark = Math.max(0, Math.sin(c.t * 4.5)) ** 8;
        hb.rotation.x = -bark * 0.25;
        legs[0].hip.rotation.x = -0.5 * smooth(Math.sin(c.t * 3) * 2);
        swap(stripesNow, Math.sin(c.t * 9) > -0.6 ? flash : stripe);
      } else { swap(stripesNow, stripe); hb.rotation.x = 0; }
      const br = 1 + Math.sin(env.t * 1.8 + c.bob) * 0.012;
      tor.scale.set(br, br, 1);
      ears.forEach((e, i) => {
        const s = i ? 1 : -1;
        const flick = Math.sin(env.t * 0.9 + i * 1.7 + c.bob) > 0.96 ? 0.5 : 0;
        e.rotation.z = damp(e.rotation.z, -s * (1.15 - alert * 0.6) + s * flick, 10, dt);
        e.rotation.x = damp(e.rotation.x, 0.1 - alert * 0.5, 6, dt);
      });
      tail.rotation.z = Math.sin(env.t * 3 + c.bob) * 0.25 * (fleeing ? 0 : 1);
      tail.rotation.x = damp(tail.rotation.x, fleeing || alert > 0.5 ? -1.0 : 0.3, 5, dt);   // a raised tail is the alarm
    },
  });
  return K.lod(c, near, far, 45);
}

// =============================================================================================
// Giant anteater: a long, low grey-brown body on knuckle-walking forelegs, a long tube of a snout,
// a huge brushy flag of a tail, and the black shoulder wedge edged in white. Eating: the tongue
// flicks. Rare: rears up on its hind legs with its claws open, braced on its tail.
export function buildGiantAnteater(K, home, opts = {}) {
  const fur = K.mat(0x6f665e, { roughness: 0.95 }), pale = K.mat(0xb3ada3, { roughness: 0.92 });
  const black = K.mat(0x161414, { roughness: 0.9 }), whiteB = K.glow(0xe8f0f4, 0.3, { roughness: 0.8 });   // the white edge glows a little after dark
  const tailM = K.mat(0x5f5349, { roughness: 1 });
  const tongueM = K.sheen(0xc4607a, { roughness: 0.3 });

  const root = new THREE.Group(), near = K.group(null, root), far = K.group(null, root);
  K.shadow(root, 0.55, 1.4);
  const body = K.group([0, 0, 0], near);
  const hip = K.group([0, 0.62, -0.38], body);                  // rearing pivots on the hind legs
  K.mesh(K.sphere(1, 14, 10), fur, [0, 0.05, 0.42], hip, null, [0.25, 0.31, 0.62]);
  K.mesh(K.sphere(1, 12, 9), fur, [0, 0.02, 0.02], hip, null, [0.24, 0.29, 0.3]);
  // the shoulder wedge: a black band slanting from the chest up and back, white on its rear edge
  K.mesh(K.torus(1, 0.14, 4, 18), black, [0, 0.0, 0.68], hip, [-1.0, 0, 0], [0.245, 0.33, 0.45]);
  K.mesh(K.torus(1, 0.05, 4, 18), whiteB, [0, 0.06, 0.55], hip, [-1.0, 0, 0], [0.262, 0.345, 0.4]);
  // neck tapering into the head and snout
  K.mesh(K.capsule(0.15, 0.3, 3, 8), fur, [0, 0.0, 0.95], hip, [1.75, 0, 0]);
  const nod = K.group([0, -0.02, 1.15], hip), head = K.group(null, nod);
  K.mesh(K.sphere(1, 12, 9), fur, [0, 0, 0], head, null, [0.1, 0.11, 0.14]);
  K.mesh(K.tube('antSnout', [[0, 0, 0.05], [0, -0.03, 0.25], [0, -0.09, 0.45], [0, -0.17, 0.6]], 0.085, 0.03, 8, 10), fur, null, head);
  K.mesh(K.sphere(1, 8, 6), black, [0, -0.17, 0.6], head, null, 0.032);
  for (const s of [-1, 1]) K.mesh(K.sphere(1, 8, 6), fur, [s * 0.075, 0.08, -0.04], head, null, [0.035, 0.04, 0.02]);
  const eyes = eyePair(K, head, [0, 0.03, 0.06], { dx: 0.085, r: 0.016, dark: true });
  const tongue = K.group([0, -0.17, 0.6], head, [0.45, 0, 0]);
  K.mesh(K.cyl(0.008, 0.012, 0.4, 5), tongueM, [0, 0, 0.2], tongue, [PI / 2, 0, 0]);
  tongue.scale.z = 0.001;
  // legs: pale forelegs with a black wrist band, walking on curled knuckles with the big claws in
  const fore = (g, y) => {
    K.mesh(K.sphere(1, 10, 8), black, [0, y + 0.02, 0.02], g, null, [0.09, 0.1, 0.1]);
    K.mesh(K.sphere(1, 10, 8), black, [0, y - 0.04, 0.04], g, null, [0.09, 0.06, 0.12]);
    for (const s of [-1, 0, 1]) K.mesh(K.cone(0.018, 0.12, 5), black, [s * 0.035, y - 0.02, -0.03], g, [-2.2, 0, 0]);
  };
  const hind = (g, y) => K.mesh(K.sphere(1, 10, 8), black, [0, y - 0.03, 0.05], g, null, [0.08, 0.05, 0.13]);
  const legs = [
    { ...leg(K, hip, [-0.17, -0.06, 0.7], { r1: 0.1, l1: 0.22, r2: 0.075, l2: 0.18, m1: pale, m2: pale, foot: fore }), ph: 0, front: true },
    { ...leg(K, hip, [0.17, -0.06, 0.7], { r1: 0.1, l1: 0.22, r2: 0.075, l2: 0.18, m1: pale, m2: pale, foot: fore }), ph: PI, front: true },
    { ...leg(K, hip, [-0.16, -0.06, 0.0], { r1: 0.11, l1: 0.22, r2: 0.08, l2: 0.18, m1: fur, m2: black, foot: hind }), ph: PI },
    { ...leg(K, hip, [0.16, -0.06, 0.0], { r1: 0.11, l1: 0.22, r2: 0.08, l2: 0.18, m1: fur, m2: black, foot: hind }), ph: 0 },
  ];
  // the flag tail: two segments of tall, flat, hanging brush
  const tail1 = K.group([0, 0.1, -0.24], hip, [-0.3, 0, 0]);
  K.mesh(K.sphere(1, 12, 9), tailM, [0, -0.05, -0.36], tail1, null, [0.075, 0.24, 0.42]);
  const tail2 = K.group([0, -0.06, -0.68], tail1, [-0.15, 0, 0]);
  K.mesh(K.sphere(1, 12, 9), tailM, [0, -0.08, -0.22], tail2, null, [0.06, 0.27, 0.36]);
  for (let i = 0; i < 3; i++) K.mesh(K.sphere(1, 8, 6), tailM, [0, -0.22 - i * 0.02, 0.3 - i * 0.3], tail2, [0.1, 0, 0], [0.035, 0.12, 0.3]);   // the hanging fringe
  // far
  K.mesh(K.sphere(1, 10, 7), fur, [0, 0.64, 0.1], far, null, [0.26, 0.32, 0.9]);
  K.mesh(K.cone(0.1, 0.8, 6), fur, [0, 0.48, 1.18], far, [2.0, 0, 0]);
  K.mesh(K.sphere(1, 8, 6), tailM, [0, 0.45, -0.95], far, null, [0.1, 0.3, 0.55]);
  K.mesh(K.box(0.36, 0.5, 0.85), black, [0, 0.25, 0.0], far);
  K.place(root, home);
  const clawsOpen = legs.slice(0, 2);

  let w = 0, ph = 0, rear = 0;
  const c = K.makeCreature({
    species: SPECIES['giant-anteater'], onState: needTarget, root, home, radius: 1.0, eye: new THREE.Vector3(0, 0.62, 0.85), ground: K.groundY,
    speed: 1.0, roam: 9, fleeAt: 7, curiousAt: 24, shy: 0.45, rareChance: 0.6, yaw: opts.yaw,
    pose(c, dt, env) {
      rareCue(c, env);
      K.blink(c, [eyes], dt);
      const moving = c.state === 'wander' || c.state === 'flee' || (c.state === 'eat' && c.pellet && c.pellet.pos.distanceTo(root.position) > 0.4);
      w = damp(w, moving ? 1 : 0, 4, dt);
      ph += dt * (c.state === 'flee' ? 8 : 4.2) * w;
      rear = damp(rear, c.state === 'rare' ? 1 : 0, 3, dt);
      gait(legs, ph, w * (1 - rear), 0.4, 0.8);
      body.position.y = Math.abs(Math.sin(ph)) * 0.025 * w;
      body.rotation.z = Math.sin(ph) * 0.025 * w;
      // rearing: the body tips up on the hind legs, the tail props it, the forelegs spread wide
      hip.rotation.x = -1.05 * rear;
      hip.position.y = 0.62 + 0.04 * rear;
      legs[2].hip.rotation.x += 1.05 * rear; legs[3].hip.rotation.x += 1.05 * rear;
      tail1.rotation.x = -0.3 + 1.0 * rear + Math.sin(env.t * 0.8 + c.bob) * 0.04;
      tail2.rotation.x = -0.15 + 0.2 * rear;
      tail1.rotation.y = Math.sin(env.t * 0.7 + c.bob) * 0.12 * (1 - rear) + Math.sin(ph) * 0.1 * w;
      const claws = c.state === 'rare' ? Math.sin(c.t * 3.2) * 0.25 : 0;
      clawsOpen.forEach((L, i) => {
        const s = i ? 1 : -1;
        L.hip.rotation.x += (-1.1 + claws) * rear;
        L.hip.rotation.z = s * 0.75 * rear;
        L.knee.rotation.x += (-0.9 - claws) * rear;
      });
      // the snout sweeps low over the ground; eating: nose down and the tongue flicks in and out
      const eating = c.state === 'eat' && !moving;
      const sniff = (c.state === 'wander' || c.state === 'idle') ? 0.25 + Math.sin(env.t * 1.3 + c.bob) * 0.15 : 0;
      K.look(c, head, env, dt, { yaw: 0.7, pitch: 0.35, rate: 2.5, force: rear > 0.5 });
      nod.rotation.x = damp(nod.rotation.x, (eating ? 0.55 : sniff) * (1 - rear) + 0.6 * rear, 4, dt);
      const flick = eating || (c.state === 'idle' && Math.sin(env.t * 0.5 + c.bob) > 0.6) ? Math.max(0, Math.sin(env.t * 11)) : 0;
      tongue.scale.z = Math.max(0.001, flick);
      const br = 1 + Math.sin(env.t * 1.7 + c.bob) * 0.012;
      hip.scale.set(br, br, 1);
    },
  });
  return K.lod(c, near, far, 45);
}

// =============================================================================================
// Flower mantis (scaled to a metre): pale cream and mint with pink petal lobes on the legs and a
// shield on the long neck, conical eyes, folded hunting arms. It sits on a flowering stem it brings
// along (or straight on the route's plant with `opts.perch`) and sways like a bloom. Rare: a strike
// (the arms snap out), then the arms open high and the wings fan behind it, eyespots glowing.
export function buildFlowerMantis(K, home, opts = {}) {
  const cream = K.mat(0xf1e8de, { roughness: 0.6 }), mint = K.mat(0xbfd9b8, { roughness: 0.6 });
  const petal = K.glow(0xeea0c6, 0.3, { roughness: 0.5, side: THREE.DoubleSide });
  const legM = K.mat(0x82303e, { roughness: 0.55, side: THREE.DoubleSide });
  const green = K.mat(0x436d36, { roughness: 0.8, side: THREE.DoubleSide }), eyeM = K.sheen(0xe7b3c8, { roughness: 0.2 });
  const wingM = K.fin(0xe6f0de, 0.72, 0.25), spotM = K.mat(0x3b1832, { side: THREE.DoubleSide }), spotG = K.glow(0xffd24a, 1.4, { side: THREE.DoubleSide });
  const bloom = K.mat(0xf3b6d2, { roughness: 0.55, side: THREE.DoubleSide }), bud = K.glow(0xffe07a, 0.5);

  const root = new THREE.Group(), near = K.group(null, root), far = K.group(null, root);
  const SEAT = opts.perch ? 0 : 1.25;
  if (!opts.perch) {
    // the plant: a curving stem, broad leaves, and orchid-pink blooms the mantis hides among
    K.mesh(K.tube('mantStem', [[0.12, 0, -0.15], [0.05, 0.5, -0.25], [-0.02, 1.0, -0.2], [0, 1.22, -0.05], [0, 1.23, 0.35]], 0.04, 0.022, 6, 12), green, null, near);
    const leafPts = [[0, 0], [0.12, 0.08], [0.16, 0.25], [0.08, 0.42], [0, 0.48], [-0.07, 0.38], [-0.11, 0.18]];
    for (let i = 0; i < 5; i++) K.mesh(K.shape('mantLeaf', leafPts), green, [0.08 - i * 0.02, 0.2 + i * 0.2, -0.22], near, [-0.6, i * 2.4, (i % 2 ? 1 : -1) * 0.9], 1.2 - i * 0.1);
    const petalPts = [[0, 0], [0.05, 0.05], [0.06, 0.13], [0, 0.18], [-0.06, 0.13], [-0.05, 0.05]];
    for (const [fx, fy, fz, fr] of [[0.28, 1.12, -0.12, 0.3], [-0.3, 1.3, -0.25, -0.4], [0.2, 1.38, -0.4, 0.8], [-0.22, 0.98, 0.1, -0.9]]) {
      const f = K.group([fx, fy, fz], near, [0.4, fr, 0]);
      for (let p = 0; p < 5; p++) K.mesh(K.shape('mantPetal', petalPts), bloom, [0, 0, 0], f, [0, 0, (p / 5) * PI * 2]);
      K.mesh(K.sphere(1, 6, 5), bud, [0, 0, 0.02], f, null, 0.035);
      fold(f);
      K.mesh(K.cyl(0.012, 0.012, Math.hypot(fx, fy - 1.15, fz + 0.1) + 0.05, 4), green, [fx / 2, (fy + 1.15) / 2, (fz - 0.1) / 2], near,
        [Math.atan2(fz + 0.1, fy - 1.15), 0, -Math.atan2(fx, fy - 1.15)]);
    }
    K.mesh(K.cyl(0.03, 0.04, 1.25, 5), green, [0.05, 0.62, -0.2], far);
    K.mesh(K.sphere(1, 6, 5), bloom, [0, 1.25, -0.2], far, null, [0.4, 0.25, 0.3]);
  }
  // the mantis: m sways (the whole insect), front holds the neck and head, arms and wings move
  const m = K.group([0, SEAT, 0], near);
  m.scale.setScalar(1.3);
  // abdomen: tilted up at the back, leafy side flaps with pink rims
  K.mesh(K.capsule(0.06, 0.3, 3, 8), cream, [0, 0.2, -0.2], m, [2.0, 0, 0]);
  K.mesh(K.capsule(0.045, 0.16, 3, 8), mint, [0, 0.32, -0.42], m, [2.5, 0, 0]);
  const flapPts = [[0, 0], [0.09, 0.03], [0.12, 0.1], [0.07, 0.16], [0, 0.14]];
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++)
    K.mesh(K.shape('mantFlap' + s, s > 0 ? flapPts : mirror(flapPts)), petal, [s * 0.04, 0.18 + i * 0.06, -0.12 - i * 0.12], m, [-PI / 2 + 0.5, 0, 0], 0.9 - i * 0.15);
  K.mesh(K.capsule(0.05, 0.12, 3, 8), cream, [0, 0.17, 0.02], m, [1.3, 0, 0]);           // mesothorax
  // walking legs: thin red-brown, each femur with a pink petal lobe (the orchid trick)
  const lobePts = [[0, 0], [0.04, 0.03], [0.06, 0.1], [0.03, 0.16], [0, 0.17], [-0.02, 0.1]];
  for (const [z, s] of [[0.04, -1], [0.04, 1], [-0.1, -1], [-0.1, 1]]) {
    const kx = s * 0.22, kz = z + (z > 0 ? 0.12 : -0.1);
    K.mesh(K.tube('mantFem' + s + z, [[s * 0.03, 0.16, z], [kx, 0.26, kz]], 0.012, 0.01, 5, 3), legM, null, m);
    K.mesh(K.tube('mantTib' + s + z, [[kx, 0.26, kz], [s * 0.3, 0.0, kz + (z > 0 ? 0.08 : -0.08)]], 0.009, 0.007, 5, 3), legM, null, m);
    K.mesh(K.shape('mantLobe' + s, s > 0 ? lobePts : mirror(lobePts)), petal, [s * 0.09, 0.22, (z + kz) / 2], m, [-0.5, s * 0.5, -s * 1.3], 1.8);
  }
  // wings: one fan for both, folded flat along the back (narrow) or raised and spread (rare)
  const wings = K.group([0, 0.22, -0.02], m, [-1.35, 0, 0]);
  const wingPts = [[0, 0], [0.12, 0.08], [0.3, 0.3], [0.34, 0.48], [0.22, 0.56], [0.08, 0.46], [0.01, 0.2]];
  for (const s of [-1, 1]) {
    K.mesh(K.shape('mantWing' + s, s > 0 ? wingPts : mirror(wingPts)), wingM, [0, 0, 0], wings);
    K.mesh(K.geo('mantSpot', () => new THREE.CircleGeometry(0.075, 14)), spotM, [s * 0.2, 0.34, 0.004], wings);
    K.mesh(K.geo('mantSpotC', () => new THREE.CircleGeometry(0.04, 12)), spotG, [s * 0.2, 0.34, 0.008], wings);
  }
  // neck (prothorax), shield and head
  const front = K.group([0, 0.2, 0.08], m, [-0.85, 0, 0]);
  K.mesh(K.capsule(0.03, 0.34, 3, 7), cream, [0, 0.2, 0], front);
  const shieldPts = [[0, -0.02], [0.1, 0.06], [0.13, 0.16], [0.07, 0.26], [0, 0.3], [-0.07, 0.26], [-0.13, 0.16], [-0.1, 0.06]];
  K.mesh(K.shape('mantShield', shieldPts, 0.02), cream, [0, 0.12, 0.03], front);
  K.mesh(K.shape('mantShieldIn', shieldPts.map(([x, y]) => [x * 0.6, y * 0.7 + 0.04])), mint, [0, 0.12, 0.042], front);
  const head = K.group(null, K.group([0, 0.42, 0.01], front, [0.85, 0, 0]));
  K.mesh(K.sphere(1, 10, 8), cream, [0, 0, 0.01], head, null, [0.07, 0.05, 0.04]);
  K.mesh(K.cone(0.04, 0.08, 6), mint, [0, -0.05, 0.03], head, [PI, 0, 0]);
  K.mesh(K.cone(0.012, 0.1, 5), legM, [0, 0.07, 0.0], head);                                    // the frontal horn
  for (const s of [-1, 1]) {
    K.mesh(K.cone(0.035, 0.09, 8), eyeM, [s * 0.065, 0.03, 0.0], head, [0, 0, -s * 0.35]);       // conical eyes
    K.mesh(K.tube('mantAnt' + s, [[s * 0.02, 0.04, 0.03], [s * 0.08, 0.2, 0.02], [s * 0.16, 0.34, -0.04]], 0.005, 0.003, 4, 6), legM, null, head);
  }
  for (const s of [-1, 1]) K.mesh(K.sphere(1, 6, 5), spotM, [s * 0.075, 0.035, 0.03], head, null, 0.013);   // the dark pseudopupils
  // the hunting arms: coxa, a femur with the petal lobe outside and the red shield inside, tibia folded
  const arms = [-1, 1].map((s) => {
    const a = K.group([s * 0.04, 0.3, 0.03], front, [0.4, 0, 0]);
    K.mesh(K.capsule(0.022, 0.14, 3, 6), cream, [s * 0.04, 0.3 - 0.08 * Math.cos(0.7), 0.03 + 0.08 * Math.sin(0.7)], front, [0.7, 0, 0]);
    const fem = K.group([0, -0.17, 0.05], a, [-2.6, 0, 0]);
    K.mesh(K.capsule(0.02, 0.2, 3, 6), cream, [0, 0.12, 0], fem);
    K.mesh(K.shape('mantArmLobe' + s, (s > 0 ? lobePts : mirror(lobePts)).map(([x, y]) => [x * 1.3, y * 1.4])), petal, [s * 0.03, 0.02, 0.01], fem, [0, s * 0.35, 0]);
    K.mesh(K.shape('mantArmRed' + s, [[0, 0], [s * -0.06, 0.06], [s * -0.07, 0.18], [0, 0.24]]), legM, [-s * 0.02, 0.02, 0.0], fem, [0, s * 1.2, 0]);
    K.mesh(K.capsule(0.013, 0.16, 3, 5), cream, [0, 0.2, 0.07], fem, [2.6, 0, 0]);
    return { a, fem };
  });

  fold(front);                                                  // the neck stays put; arms and head move
  // far
  K.mesh(K.capsule(0.07, 0.5, 2, 6), cream, [0, SEAT + 0.25, -0.05], far, [1.0, 0, 0]);
  K.mesh(K.box(0.4, 0.04, 0.3), petal, [0, SEAT + 0.2, 0], far);
  K.place(root, home);

  let strike = 0, fan = 0;
  const c = K.makeCreature({
    species: SPECIES['flower-mantis'], onState: needTarget, root, home, radius: 0.6, eye: new THREE.Vector3(0, SEAT + 0.7, 0.35), flyer: true,
    speed: 0.0001, roam: 0, fleeAt: 3, curiousAt: 20, shy: 0.2, rareChance: 0.7, yaw: opts.yaw,
    pose(c, dt, env) {
      rareCue(c, env);
      // swaying like a bloom in a breeze, with the rocking walk mantises do
      m.rotation.z = Math.sin(env.t * 1.1 + c.bob) * 0.07;
      m.rotation.x = Math.sin(env.t * 0.8 + c.bob * 2) * 0.04;
      m.position.z = Math.sin(env.t * 2.2 + c.bob) * 0.015;
      K.look(c, head, env, dt, { yaw: 1.2, pitch: 0.4, rate: 4 });
      // rare: the strike in the first half second, then the display
      let armX = 0, armZ = 0, femX = -2.6;
      if (c.state === 'rare') {
        const t = c.t;
        strike = t < 0.6 ? Math.sin(Math.min(1, t / 0.25) * PI * 0.5) * (t < 0.35 ? 1 : 1 - (t - 0.35) / 0.25) : 0;
        fan = damp(fan, t > 0.6 ? 1 : 0, 3, dt);
      } else { strike = damp(strike, 0, 8, dt); fan = damp(fan, 0, 2.5, dt); }
      armX = -1.3 * strike - 1.6 * fan; femX = -2.6 + 2.2 * strike + 1.0 * fan; armZ = 0.7 * fan;
      arms.forEach(({ a, fem }, i) => {
        const s = i ? 1 : -1;
        a.rotation.x = 0.4 + armX + Math.sin(env.t * 1.6 + i) * 0.03;
        a.rotation.z = s * armZ;
        fem.rotation.x = femX + (fan > 0.5 ? Math.sin(env.t * 3 + i) * 0.1 : 0);
      });
      wings.rotation.x = -1.35 + 1.15 * fan;
      wings.scale.x = 0.25 + 0.75 * fan;
      wings.scale.y = 0.8 + 0.2 * fan;
      // fleeing mantises flatten down onto the flower
      m.position.y = SEAT + damp(m.position.y - SEAT, c.state === 'flee' ? -0.08 : 0, 4, dt);
      m.scale.setScalar(1.3);
    },
  });
  return perch(K.lod(c, near, far, 40));
}

// =============================================================================================
// Treehopper (scaled to 0.6 m): a small sap-sucker under a tall, pitted helmet that sweeps up and
// forward like a horn: pale aqua, a red flame along it, an orange rim; red eyes; glassy veined wings.
// It sits on a twig (its own unless `opts.stub = false`). Rare: the helmet lights up and it hops.
export function buildTreehopper(K, home, opts = {}) {
  const aqua = K.sheen(0x9fd9cf, { roughness: 0.55 }), redM = K.sheen(0xc8241c, { roughness: 0.4, side: THREE.DoubleSide });
  const orange = K.sheen(0xf0a020, { roughness: 0.4, side: THREE.DoubleSide }), wingM = K.sheen(0xb9cad6, { roughness: 0.35, side: THREE.DoubleSide });
  const vein = K.mat(0x26303a, { roughness: 0.6 }), bodyM = K.mat(0x52685e, { roughness: 0.7 }), legM = K.mat(0xd9e6e0, { roughness: 0.8 });
  const bark = K.mat(0x7a6650, { roughness: 0.95 });
  const glowA = K.glow(0x6fe8d8, 1.3), glowR = K.glow(0xff3b2a, 2.0);

  const root = new THREE.Group(), near = K.group(null, root), far = K.group(null, root);
  if (opts.stub !== false) {
    K.mesh(K.cyl(0.04, 0.05, 1.5, 7), bark, [0, -0.04, 0], near, [PI / 2 - 0.08, 0, 0]);
    K.mesh(K.cyl(0.015, 0.025, 0.5, 5), bark, [0.1, 0.05, -0.45], near, [0.6, 0, -0.9]);
    K.mesh(K.cyl(0.04, 0.05, 1.5, 5), bark, [0, -0.04, 0], far, [PI / 2, 0, 0]);
  }
  const turn = K.group(null, near), b = K.group(null, turn);
  // body under the helmet, head with red eyes
  K.mesh(K.capsule(0.05, 0.22, 3, 8), bodyM, [0, 0.085, -0.02], b, [PI / 2, 0, 0]);
  K.mesh(K.sphere(1, 10, 8), aqua, [0, 0.09, 0.15], b, null, [0.07, 0.065, 0.05]);
  const eyes = eyePair(K, b, [0, 0.12, 0.15], { dx: 0.065, r: 0.028, iris: 0xd0201a, glow: 0.4, yaw: 0.9 });
  // six hairy pale legs gripping the twig
  for (const [z, s] of [[0.1, -1], [0.1, 1], [0.0, -1], [0.0, 1], [-0.1, -1], [-0.1, 1]]) {
    K.mesh(K.tube('hopLeg' + s + z, [[s * 0.03, 0.07, z], [s * 0.1, 0.06, z + 0.02], [s * 0.06, 0.0, z + 0.04]], 0.012, 0.007, 4, 4), legM, null, b);
  }
  // wings: tented along the sides, veined in dark cells, an orange line on top
  const wPts = [[0.12, 0.15], [0.0, 0.17], [-0.2, 0.1], [-0.29, 0.02], [-0.24, -0.01], [0.1, 0.04]];
  for (const s of [-1, 1]) {
    const wg = K.group([s * 0.062, 0, 0], b, [0, -PI / 2, s * 0.12]);
    K.mesh(K.shape('hopWing', wPts), wingM, [0, 0, 0], wg);
    for (let i = 0; i < 4; i++) K.mesh(K.box(0.3 - i * 0.04, 0.005, 0.004), vein, [-0.07 - i * 0.02, 0.05 + i * 0.025, -s * 0.003], wg, [0, 0, 0.2 + i * 0.05]);
    for (let i = 0; i < 4; i++) K.mesh(K.box(0.005, 0.08, 0.004), vein, [-0.18 + i * 0.07, 0.07, -s * 0.003], wg, [0, 0, 0.5]);
    K.mesh(K.box(0.3, 0.012, 0.004), orange, [-0.05, 0.13, -s * 0.004], wg, [0, 0, 0.3]);
  }
  // the helmet: a laterally flat slab sweeping up into a horn, with the red flame and orange rim
  const helm = K.group([0, 0, 0], b);
  const hPts = [[-0.3, 0.05], [-0.22, 0.12], [-0.05, 0.2], [0.04, 0.3], [0.12, 0.42], [0.2, 0.53], [0.27, 0.6], [0.33, 0.61], [0.36, 0.56], [0.32, 0.48], [0.25, 0.38], [0.2, 0.28], [0.18, 0.18], [0.17, 0.1], [0.12, 0.08], [-0.05, 0.11], [-0.25, 0.05]];
  K.mesh(K.shape('hopHelm', hPts, 0.075), aqua, [0, 0, 0], helm, [0, -PI / 2, 0]);
  const flame = [[-0.15, 0.15], [0.02, 0.21], [0.12, 0.35], [0.22, 0.5], [0.29, 0.57], [0.31, 0.52], [0.23, 0.4], [0.16, 0.27], [0.06, 0.17]];
  const rim = [[-0.27, 0.07], [-0.05, 0.135], [0.12, 0.115], [0.15, 0.13], [-0.05, 0.15], [-0.26, 0.085]];
  for (const s of [-1, 1]) {
    K.mesh(K.shape('hopFlame', flame), redM, [s * 0.039, 0, 0], helm, [0, -PI / 2, 0]);
    K.mesh(K.shape('hopRim', rim), orange, [s * 0.039, 0, 0], helm, [0, -PI / 2, 0]);
  }
  // far
  K.mesh(K.shape('hopHelm', hPts, 0.075), aqua, [0, 0, 0], far, [0, -PI / 2, 0]);
  K.mesh(K.capsule(0.06, 0.24, 2, 6), wingM, [0, 0.08, -0.04], far, [PI / 2, 0, 0]);
  K.place(root, home);
  const helmMeshes = withMat(helm, aqua), flameMeshes = withMat(helm, redM);

  const c = K.makeCreature({
    species: SPECIES.treehopper, onState: needTarget, root, home, radius: 0.4, eye: new THREE.Vector3(0, 0.2, 0.12), flyer: true,
    speed: 0.0001, roam: 0, fleeAt: 3.5, curiousAt: 20, shy: 0.35, rareChance: 0.7, yaw: opts.yaw,
    pose(c, dt, env) {
      rareCue(c, env);
      K.blink(c, [eyes], dt);
      // it turns a little on its twig to keep the van in view, and pumps its body (it 'sings' through the stem)
      K.look(c, turn, env, dt, { yaw: 0.45, pitch: 0.05, rate: 1.5, glance: false });
      const pump = Math.max(0, Math.sin(env.t * 9 + c.bob)) * (Math.sin(env.t * 0.7 + c.bob) > 0.3 ? 1 : 0);
      helm.rotation.x = -pump * 0.04;
      let hop = 0;
      if (c.state === 'rare') {
        const u = ((c.t - 0.5) % 1.6) / 0.55;
        hop = c.t > 0.5 && u < 1 ? Math.sin(u * PI) * 0.45 : 0;
        const on = c.t > 0.2;
        swap(helmMeshes, on ? glowA : aqua); swap(flameMeshes, on ? glowR : redM);
        b.position.z = Math.sin(Math.min(1, (c.t - 0.5) / 1.6) * PI) * 0.15;
      } else { swap(helmMeshes, aqua); swap(flameMeshes, redM); b.position.z = damp(b.position.z, 0, 3, dt); }
      b.position.y = hop;
      b.rotation.x = -hop * 0.5;
      // fleeing: it scuttles round to the far side of the twig
      b.rotation.z = damp(b.rotation.z, c.state === 'flee' ? 2.2 : 0, 3, dt);
    },
  });
  return perch(K.lod(c, near, far, 40));
}

// =============================================================================================
// Eyespot moth (1.5 m across): rests flat against a tree trunk, wings spread, dark teal with black
// scalloped wave bands and a huge eyespot in each wing: a pale ring, an amber crescent and a black
// pupil with a blue sheen. Rare (and by itself at dusk): the eyespots blaze and it flutters.
export function buildEyespotMoth(K, home, opts = {}) {
  const base = K.mat(0x2a4e56, { roughness: 0.85, side: THREE.DoubleSide }), wave = K.mat(0x0c1a1e, { roughness: 0.9, side: THREE.DoubleSide });
  const light = K.mat(0x7c9da0, { roughness: 0.9, side: THREE.DoubleSide }), amber = K.glow(0xd88e2a, 0.35, { side: THREE.DoubleSide });
  const pupil = K.sheen(0x06090c, { roughness: 0.2, side: THREE.DoubleSide }), blue = K.glow(0x4a7cff, 0.8, { side: THREE.DoubleSide });
  const furM = K.mat(0x22363b, { roughness: 1 }), bark = K.mat(0x5d4b3c, { roughness: 0.95 }), lichen = K.mat(0x8e9a72, { roughness: 1 });
  const amberHot = K.glow(0xff9a20, 1.5, { side: THREE.DoubleSide }), blueHot = K.glow(0x5a8cff, 2.2, { side: THREE.DoubleSide });

  const root = new THREE.Group(), near = K.group(null, root), far = K.group(null, root);
  if (opts.stub !== false) {
    K.mesh(K.cyl(0.3, 0.36, 3.4, 10), bark, [0, 0.2, -0.36], near);
    K.mesh(K.sphere(1, 8, 6), lichen, [0.2, -0.6, -0.15], near, null, [0.16, 0.22, 0.06]);
    K.mesh(K.sphere(1, 8, 6), lichen, [-0.22, 1.0, -0.14], near, null, [0.12, 0.16, 0.05]);
    K.mesh(K.cyl(0.3, 0.36, 3.4, 6), bark, [0, 0.2, -0.36], far);
  }
  const b = K.group([0, 0, 0], near);
  // the body: furry thorax, tapered abdomen, small head, long thin antennae swept back over the wings
  K.mesh(K.sphere(1, 10, 8), furM, [0, 0.06, 0.04], b, null, [0.075, 0.12, 0.06]);
  K.mesh(K.capsule(0.05, 0.22, 3, 7), furM, [0, -0.17, 0.035], b);
  K.mesh(K.sphere(1, 8, 6), furM, [0, 0.19, 0.05], b, null, 0.05);
  const eyes = eyePair(K, b, [0, 0.2, 0.07], { dx: 0.035, r: 0.022, dark: true });
  for (const s of [-1, 1]) K.mesh(K.tube('mothAnt' + s, [[s * 0.02, 0.22, 0.07], [s * 0.15, 0.32, 0.06], [s * 0.38, 0.32, 0.03]], 0.006, 0.003, 4, 8), wave, null, b);
  // a wing side: fore and hind wing with their markings, as flat layers on a hinge at the body
  const fore = [[0.0, 0.08], [0.25, 0.22], [0.55, 0.32], [0.74, 0.36], [0.7, 0.22], [0.66, 0.06], [0.5, -0.04], [0.2, -0.06], [0.04, -0.05]];
  const hind = [[0.02, -0.03], [0.3, -0.05], [0.5, -0.12], [0.52, -0.2], [0.46, -0.28], [0.4, -0.33], [0.3, -0.39], [0.2, -0.42], [0.1, -0.38], [0.02, -0.25]];
  const ell = (cx, cy, rx, ry, n = 16) => Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * PI * 2) * rx, cy + Math.sin((i / n) * PI * 2) * ry]);
  const band = (cx, cy, r, w, a0, a1, n = 10) => {
    const o = [], inn = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); inn.push([cx + Math.cos(a) * (r - w), cy + Math.sin(a) * (r - w)]); }
    return o.concat(inn.reverse());
  };
  const wingsG = [-1, 1].map((s) => {
    const g = K.group([s * 0.035, 0.04, 0.0], b);
    const M = (pts) => (s > 0 ? pts : mirror(pts));
    K.mesh(K.shape('mothFore' + s, M(fore)), base, [0, 0, 0.004], g);
    K.mesh(K.shape('mothHind' + s, M(hind)), base, [0, 0, 0], g);
    // scalloped wave bands, dark and pale, curving across both wings
    const waves = [[0.0, -0.1, 0.2], [0.0, -0.1, 0.28], [0.02, -0.1, 0.36], [0.04, -0.12, 0.43]];
    waves.forEach(([cx, cy, r], i) => {
      K.mesh(K.shape(`mothWave${s}${i}`, M(band(cx, cy, r, 0.022, -0.8 + i * 0.1, 0.35 + i * 0.1, 9))), wave, [0, 0, 0.008], g);
      K.mesh(K.shape(`mothPale${s}${i}`, M(band(cx, cy, r - 0.035, 0.012, -0.75 + i * 0.1, 0.3 + i * 0.1, 9))), light, [0, 0, 0.008], g);
    });
    for (let i = 0; i < 5; i++) K.mesh(K.shape(`mothDash${s}${i}`, M(ell(0.62 - i * 0.03, 0.26 - i * 0.06, 0.03, 0.011, 6))), wave, [0, 0, 0.008], g);
    // the eyespot: pale ring, amber crescent, black pupil, blue sheen
    K.mesh(K.shape('mothRing' + s, M(ell(0.45, 0.16, 0.14, 0.12))), light, [0, 0, 0.01], g);
    K.mesh(K.shape('mothAmb' + s, M(ell(0.45, 0.16, 0.12, 0.1))), amber, [0, 0, 0.013], g);
    K.mesh(K.shape('mothPup' + s, M(ell(0.465, 0.15, 0.095, 0.08))), pupil, [0, 0, 0.016], g);
    K.mesh(K.shape('mothBlue' + s, M(band(0.47, 0.15, 0.07, 0.02, 0.6, 2.4, 7))), blue, [0, 0, 0.019], g);
    // a smaller spot on the hindwing
    K.mesh(K.shape('mothHspot' + s, M(ell(0.32, -0.22, 0.05, 0.045, 10))), amber, [0, 0, 0.012], g);
    K.mesh(K.shape('mothHpup' + s, M(ell(0.32, -0.22, 0.03, 0.028, 10))), pupil, [0, 0, 0.015], g);
    return g;
  });
  // far
  K.mesh(K.shape('mothFarW', [...mirror(fore).reverse(), ...fore]), base, [0, 0.04, 0.004], far);
  K.mesh(K.shape('mothFarH', [...mirror(hind).reverse(), ...hind]), base, [0, 0.04, 0.0], far);
  K.mesh(K.shape('mothFarS', ell(0, 0, 0.12, 0.1)), amber, [0.45, 0.2, 0.012], far);
  K.mesh(K.shape('mothFarS', ell(0, 0, 0.12, 0.1)), amber, [-0.45, 0.2, 0.012], far);
  K.place(root, home);
  const spots = wingsG.map((g) => ({ amb: withMat(g, amber), blu: withMat(g, blue) }));

  const c = K.makeCreature({
    species: SPECIES['eyespot-moth'], onState: needTarget, root, home, radius: 0.75, eye: new THREE.Vector3(0, 0.1, 0.1), flyer: true,
    speed: 0.0001, roam: 0, fleeAt: 4, curiousAt: 18, shy: 0.3, rareChance: 0.8, rareAt: 'dusk', yaw: opts.yaw,
    pose(c, dt, env) {
      rareCue(c, env);
      K.blink(c, [eyes], dt);
      let flap = 0, lift = 0, hot = false;
      if (c.state === 'rare') {
        hot = c.t > 0.15 && (c.t < 1.2 || Math.sin(c.t * 6) > -0.5);       // a flash, then pulsing
        const flut = c.t > 1.0 && c.t < 3.6;
        flap = flut ? (0.5 + 0.5 * Math.sin(c.t * 22)) * 0.9 : (c.t < 1 ? -0.12 * Math.sin(c.t * PI) : 0);
        lift = flut ? 0.08 + Math.sin(c.t * 11) * 0.03 : 0;
      } else if (c.state === 'flee') flap = (0.5 + 0.5 * Math.sin(c.t * 20)) * 0.6 * Math.max(0, 1 - c.t / 1.5);
      // resting: the wings breathe a little, the antennae tremble
      const rest = Math.sin(env.t * 0.9 + c.bob) * 0.02;
      wingsG.forEach((g, i) => { const s = i ? 1 : -1; g.rotation.y = damp(g.rotation.y, -s * (flap + rest), 18, dt); });
      b.position.z = damp(b.position.z, lift, 8, dt);
      spots.forEach((p) => { swap(p.amb, hot ? amberHot : amber); swap(p.blu, hot ? blueHot : blue); });
    },
  });
  return perch(K.lod(c, near, far, 42));
}

// =============================================================================================
// Poodle moth: the secret one, out only at night. A felted white puffball of a body, big black
// eyes, brown feathery antennae like a rabbit's ears, rounded cream wings. It circles a glowing pod
// that hangs from the canopy (its own unless `opts.lamp = false`, then it circles `home`). Rare (or
// at night by itself): it drifts over to the van and hovers right in front of the lens.
export function buildPoodleMoth(K, home, opts = {}) {
  const felt = K.mat(0xf4f0e6, { roughness: 1 }), cream = K.mat(0xeee2cf, { roughness: 1, side: THREE.DoubleSide });
  const rim = K.mat(0xfbf8f2, { roughness: 1, side: THREE.DoubleSide }), brown = K.mat(0x4a3a2c, { roughness: 0.9, side: THREE.DoubleSide });
  const rib = K.mat(0xcab79a, { roughness: 0.9 }), tip = K.mat(0x1a1410, { roughness: 0.6 });
  const pod = K.glow(0xffd98a, 3.2), vine = K.mat(0x3d4a2e, { roughness: 0.9 });

  const root = new THREE.Group();
  // the glowing pod it circles stays put; the moth (mroot) flies
  if (opts.lamp !== false) {
    const lamp = K.group(null, root);
    K.mesh(K.sphere(1, 12, 9), pod, [0, 0, 0], lamp, null, [0.14, 0.2, 0.14]);
    K.mesh(K.cyl(0.012, 0.016, 3.2, 5), vine, [0, 1.75, 0], lamp);
    K.mesh(K.cone(0.09, 0.12, 6), vine, [0, 0.2, 0], lamp);
  }
  const mroot = K.group(null, root);
  const near = K.group(null, mroot), far = K.group(null, mroot);
  const b = K.group([0, 0, 0], near);
  // a felt puffball: overlapping tufts make the fluff
  const puffs = [[0, 0, 0, 0.11, 0.1, 0.12], [0, -0.02, -0.12, 0.09, 0.085, 0.11], [0, -0.03, -0.22, 0.065, 0.065, 0.08],
    [0.06, 0.03, 0.02, 0.06, 0.06, 0.07], [-0.06, 0.03, 0.02, 0.06, 0.06, 0.07], [0, 0.06, -0.06, 0.07, 0.06, 0.08]];
  for (const [x, y, z, rx, ry, rz] of puffs) K.mesh(K.sphere(1, 10, 8), felt, [x, y, z], b, null, [rx, ry, rz]);
  const head = K.group([0, 0.03, 0.12], b);
  K.mesh(K.sphere(1, 12, 9), felt, [0, 0, 0], head, null, [0.085, 0.08, 0.07]);
  K.mesh(K.sphere(1, 8, 6), felt, [0, -0.06, 0.03], head, null, [0.05, 0.04, 0.04]);
  const eyes = eyePair(K, head, [0, 0.02, 0.045], { dx: 0.045, r: 0.03, dark: true });
  // antennae: wide brown combs with pale ribs, swept out like ears
  const antPts = [[0, 0], [0.05, 0.04], [0.16, 0.11], [0.26, 0.17], [0.22, 0.1], [0.1, 0.02], [0.04, -0.01]];
  const ants = [-1, 1].map((s) => {
    const g = K.group([s * 0.035, 0.06, 0.02], head, [-0.4, 0, 0]);
    K.mesh(K.shape('poodAnt' + s, s > 0 ? antPts : mirror(antPts)), brown, [0, 0, 0], g, [0, -s * 0.3, 0]);
    for (let i = 0; i < 6; i++) K.mesh(K.box(0.004, 0.05, 0.004), rib, [s * (0.05 + i * 0.033), 0.035 + i * 0.019, 0.004 - s * 0.006 * i], g, [0, -s * 0.3, -s * 0.5]);
    return g;
  });
  // fluffy legs with dark tips, tucked under
  for (const [z, s] of [[0.06, -1], [0.06, 1], [-0.03, -1], [-0.03, 1]]) {
    K.mesh(K.capsule(0.022, 0.07, 2, 6), felt, [s * 0.06, -0.1, z], b, [0.3, 0, s * 0.3]);
    K.mesh(K.cone(0.008, 0.03, 4), tip, [s * 0.075, -0.16, z + 0.02], b, [PI, 0, 0]);
  }
  // wings: two rounded felt lobes a side, a paler rim, one hinge per side
  const fw = [[0, 0.02], [0.12, 0.08], [0.28, 0.12], [0.36, 0.06], [0.36, -0.04], [0.26, -0.1], [0.1, -0.06]];
  const hw = [[0, -0.03], [0.1, -0.06], [0.22, -0.12], [0.25, -0.2], [0.18, -0.26], [0.08, -0.2], [0.01, -0.1]];
  const big = (pts, k) => pts.map(([x, y]) => [x * k, y * k - 0.004]);
  const wings = [-1, 1].map((s) => {
    const g = K.group([s * 0.06, 0.05, -0.03], b), pl = K.group(null, g, [1.2, 0, 0]);
    const M = (p) => (s > 0 ? p : mirror(p));
    // the plane faces down, so the lowest layer is the one seen from above
    K.mesh(K.shape('poodFw' + s, M(fw)), cream, [0, 0, -0.009], pl);
    K.mesh(K.shape('poodFwR' + s, M(big(fw, 1.06))), rim, [0, 0, -0.006], pl);
    K.mesh(K.shape('poodHw' + s, M(hw)), cream, [0, 0, -0.003], pl, [0, 0, -s * 0.15]);
    K.mesh(K.shape('poodHwR' + s, M(big(hw, 1.07))), rim, [0, 0, 0], pl, [0, 0, -s * 0.15]);
    return g;
  });
  b.scale.setScalar(1.35);
  // far
  K.mesh(K.sphere(1, 8, 6), felt, [0, 0, -0.03], far, null, [0.15, 0.14, 0.22]);
  K.mesh(K.box(0.9, 0.02, 0.3), cream, [0, 0.06, -0.04], far);
  K.mesh(K.box(0.4, 0.02, 0.06), brown, [0, 0.15, 0.17], far);
  K.place(root, home);
  root.position.set(0, 0, 0);                                    // the world is the moth's frame now
  root.rotation.set(0, 0, 0);

  const pos = home.clone(), want = new THREE.Vector3(), vel = new THREE.Vector3();
  let ang = Math.random() * PI * 2, beat = 0;
  const c = K.makeCreature({
    species: SPECIES['poodle-moth'], root, home, radius: 0.45, eye: new THREE.Vector3(0, 0, 0), flyer: true,
    speed: 1.5, roam: 1.2, fleeAt: 2.5, curiousAt: 26, shy: 0.1, rareChance: 0.8, rareAt: 'night', yaw: 0,
    pose() {},
  });
  if (opts.lamp !== false) root.children[0].position.copy(home);
  c.photoPoint = (out) => head.getWorldPosition(out);
  c.forward = (out) => out.set(Math.sin(mroot.rotation.y), 0, Math.cos(mroot.rotation.y));
  c.step = (dt, env) => {
    root.position.set(0, 0, 0); root.rotation.set(0, 0, 0);    // the moth flies in world space
    c.t += dt;
    const d = env.dist;
    if (c.state !== 'flee' && c.state !== 'rare' && d < c.fleeAt) c.go('flee', 2.5);
    else if (c.state === 'idle' || c.state === 'wander') {
      const p = env.pellets.find((q) => q.landed && !q.eaten && q.pos.distanceTo(c.home) < 16);
      if (p) { p.eaten = true; p.eatenAt = env.t; c.go(Math.random() < c.rareChance ? 'rare' : 'curious', 6); }
      else if (d < c.curiousAt && c.t > 2 && Math.random() < dt * 0.15) c.go('curious', 4);
      else if (c.rareAt === env.tod && c.t > 3 && Math.random() < dt * 0.05) c.go('rare', 7);
    }
    if (c.t > c.hold && c.state !== 'idle') c.go('idle', 999);
    // where it wants to be
    ang += dt * (c.state === 'flee' ? 2.2 : 1.1);
    const R = 1.1 + Math.sin(env.t * 0.37 + c.bob) * 0.25;
    want.set(home.x + Math.cos(ang) * R, home.y + Math.sin(ang * 2.1) * 0.25 + 0.05, home.z + Math.sin(ang) * R);
    if (c.state === 'flee') want.y += 2.2;
    if (c.state === 'curious' || c.state === 'rare') {
      vA.subVectors(env.camPos, home);
      const L = vA.length();
      const stop = c.state === 'rare' ? Math.max(0, L - 4.5) : Math.min(2, L * 0.3);
      want.copy(home).addScaledVector(vA.normalize(), stop);
      want.y = c.state === 'rare' ? THREE.MathUtils.lerp(home.y, env.camPos.y, 0.85) : want.y;
      want.x += Math.sin(env.t * 2.3) * 0.25; want.y += Math.sin(env.t * 3.1) * 0.15;
    }
    // a soft spring towards it: moths drift and wobble rather than steer
    vB.subVectors(want, pos).multiplyScalar(c.state === 'rare' ? 1.6 : 2.4);
    vel.lerp(vB, Math.min(1, dt * 2.5));
    pos.addScaledVector(vel, dt);
    mroot.position.copy(pos);
    // facing: along its flight, or at the van while it hovers there
    let face;
    if (c.state === 'rare' || c.state === 'curious') face = Math.atan2(env.camPos.x - pos.x, env.camPos.z - pos.z);
    else face = Math.atan2(vel.x, vel.z);
    mroot.rotation.y += Math.atan2(Math.sin(face - mroot.rotation.y), Math.cos(face - mroot.rotation.y)) * Math.min(1, dt * 4);
    mroot.rotation.z = THREE.MathUtils.clamp(-vel.x * 0.1, -0.4, 0.4) * 0.5;
    // wings: fast beats, a glide now and then
    const hover = c.state === 'rare';
    beat += dt * (hover ? 26 : 19);
    const glide = !hover && Math.sin(env.t * 0.9 + c.bob) > 0.75;
    const f = glide ? 0.15 : Math.sin(beat);
    wings.forEach((g, i) => { const s = i ? 1 : -1; g.rotation.z = s * (f * 0.75 + 0.2); });
    b.rotation.x = hover ? -0.85 : -0.15;                          // upright to hover, level to fly
    ants.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * Math.sin(env.t * 4 + i) * 0.06; });
    K.blink(c, [eyes], dt);
    rareCue(c, env);
    c.near = env.camPos.distanceTo(pos);
    root.updateMatrixWorld();
  };
  c.step(0.016, { camPos: new THREE.Vector3(0, 2, 30), t: 0, tod: K.tod, pellets: [], dist: 30 });
  return K.lod(c, near, far, 40);
}

export const BUILDERS = {
  tarsier: buildTarsier,
  'giant-panda': buildGiantPanda,
  'bongo-antelope': buildBongoAntelope,
  'giant-anteater': buildGiantAnteater,
  'flower-mantis': buildFlowerMantis,
  treehopper: buildTreehopper,
  'eyespot-moth': buildEyespotMoth,
  'poodle-moth': buildPoodleMoth,
};
