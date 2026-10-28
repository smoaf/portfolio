// The superb bird-of-paradise (FEAT-007): a male and a brown female on a mossy low branch right by
// the jungle road, at eye height, in the first stretch of forest.
//
//   superb-bird-of-paradise          the male: velvet black, a blue-green breast shield (the "smile")
//                                    and two blue spots above the eyes. He hops along the branch,
//                                    twitches and calls; as the van passes (most runs) he snaps his
//                                    black cape open into a round fan round his head, the smile below
//                                    it, and bounces side to side in front of the female. His rare
//                                    pose is the full dance: fast bouncing and clicking, the female
//                                    leaning in.
//   superb-bird-of-paradise-female   plain brown, the underside pale with dark bars. She watches.
//
// After dark both roost on the branch, fluffed up; the male's shield and eye spots glow faintly.
// A little over real size (the male ~32 cm instead of ~25 cm, `SIZE`), so the long lens can frame them
// from the road.
import * as THREE from 'three';
import { perch } from './forest.js';

export const SPECIES = {
  'superb-bird-of-paradise': { id: 'superb-bird-of-paradise', name: 'Superb bird-of-paradise (male)', points: 240, call: { hz: 2600, kind: 'trill' } },
  'superb-bird-of-paradise-female': { id: 'superb-bird-of-paradise-female', name: 'Superb bird-of-paradise (female)', points: 160, call: { hz: 1900, kind: 'chirp' } },
};

const PI = Math.PI;
const SIZE = 1.3;
const damp = (a, b, k, dt) => a + (b - a) * Math.min(1, k * dt);

// the moss on the branch they sit on (the route builds the branch): a few pads of moss and a fern
// frond hanging off it, laid along local x (the birds sit on it facing +z)
function mossyPerch(K, g, len) {
  const moss = K.mat(0x4f6e32, { roughness: 1 }), mossDark = K.mat(0x3a5626, { roughness: 1 });
  [[-0.42, 0.7], [-0.1, 1], [0.25, 0.8], [0.55, 0.6]].forEach(([x, s], i) => K.mesh(K.sphere(1, 8, 5), i % 2 ? moss : mossDark, [x * len / 1.4, -0.012, (i % 2 ? 0.012 : -0.01)], g, [0, i, 0], [0.09 * s, 0.025, 0.05 * s]));
  // a hanging fern frond and a few tufts of moss dangling from the underside
  const frond = K.mat(0x3d6b2c, { roughness: 0.8, side: THREE.DoubleSide });
  K.mesh(K.shape('bop-frond', [[0, 0], [0.03, -0.06], [0.02, -0.18], [0.0, -0.26], [-0.02, -0.18], [-0.03, -0.06]]), frond, [-0.3 * len / 1.4, -0.08, 0.02], g, [0.2, 0.5, 0]);
  for (let i = 0; i < 4; i++) K.mesh(K.cone(0.012, 0.07, 4), mossDark, [(-0.5 + i * 0.33) * len / 1.4, -0.12, 0], g, [PI, 0, 0]);
}

// two small feet gripping the branch
function feet(K, g, mat, w = 0.016) {
  for (const s of [-1, 1]) {
    K.mesh(K.capsule(0.004, 0.022, 2, 4), mat, [s * w, 0.012, 0], g, [0.25, 0, 0]);
    K.mesh(K.capsule(0.003, 0.02, 2, 4), mat, [s * w, 0.0, 0.008], g, [PI / 2, 0, 0]);
  }
}

// =============================================================================================
// The male. opts: yaw (towards the female, half turned to the road), moss (true: moss and a frond on
// the branch round him), along (the branch's heading), len (how far along it the moss reaches).
export function buildBirdOfParadise(K, home, opts = {}) {
  const velvet = K.mat(0x040405, { roughness: 1 });                       // black that swallows light
  const gloss = K.sheen(0x0e1014, { roughness: 0.35, metalness: 0.2 });   // the cape and the crown, a faint blue sheen
  const lum = Math.max(0.04, K.glowLevel - 0.25);                         // barely there by day, clear at night
  const shieldM = K.mat(0x27c9c0, { roughness: 0.25, metalness: 0.45, emissive: 0x2ff0e0, emissiveIntensity: lum * 0.55 });
  const spotM = K.mat(0x3fa8ff, { roughness: 0.3, metalness: 0.3, emissive: 0x52c8ff, emissiveIntensity: lum * 0.7 });
  const billM = K.mat(0x111111, { roughness: 0.5 }), footM = K.mat(0x2a2522, { roughness: 0.8 });

  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  if (opts.moss) {                                                      // turned to lie along the branch
    const g = K.group(null, near);
    g.rotation.y = (opts.along ?? 0) - (opts.yaw ?? 0) - PI / 2;
    mossyPerch(K, g, opts.len || 1.6);
  }
  const off = K.group(null, near);                                       // hops move this along the branch
  feet(K, off, footM);
  const body = K.group([0, 0.03, 0], off);                               // tilts and bounces
  // the body: a compact, upright bird, the short tail hanging behind
  K.mesh(K.sphere(1, 12, 9), velvet, [0, 0.05, -0.005], body, [-0.35, 0, 0], [0.042, 0.06, 0.05]);
  K.mesh(K.capsule(0.012, 0.07, 2, 5), velvet, [0, 0.0, -0.06], body, [0.55, 0, 0]);
  for (const s of [-1, 1]) K.mesh(K.sphere(1, 8, 6), gloss, [s * 0.035, 0.06, -0.012], body, [-0.4, s * 0.15, 0], [0.012, 0.042, 0.04]);   // folded wings
  // the breast shield: a wide crescent, its tips turned up (the "smile"); it spreads in the display
  const shield = K.group([0, 0.07, 0.04], body);
  shield.rotation.x = -0.25;
  const smile = [];
  for (let i = 0; i <= 12; i++) { const a = PI * (1.08 + 0.84 * i / 12); smile.push([Math.cos(a) * 0.05, Math.sin(a) * 0.032 + 0.028]); }
  for (let i = 12; i >= 0; i--) { const a = PI * (1.08 + 0.84 * i / 12); smile.push([Math.cos(a) * 0.036, Math.sin(a) * 0.016 + 0.03]); }
  K.mesh(K.shape('bop-smile', smile, 0.004), shieldM, [0, 0, 0], shield);
  // the head: round, a short black bill, the blue spots above the eyes
  const head = K.group([0, 0.115, 0.022], body);
  K.mesh(K.sphere(1, 10, 8), velvet, [0, 0, 0], head, null, [0.028, 0.027, 0.03]);
  K.mesh(K.cone(0.008, 0.026, 6), billM, [0, -0.004, 0.038], head, [PI / 2, 0, 0]);
  for (const s of [-1, 1]) {
    K.mesh(K.sphere(1, 6, 5), K.sheen(0x050505, { roughness: 0.1 }), [s * 0.019, 0.004, 0.017], head, null, 0.0045);
    K.mesh(K.sphere(1, 6, 5), spotM, [s * 0.016, 0.017, 0.016], head, null, [0.0065, 0.004, 0.006]);
  }
  // the cape: folded, a dark mantle over the nape and back; open, a wide rounded fan that rises
  // from behind the head and frames it, slightly cupped forward
  const cape = K.group([0, 0.1, -0.005], body);
  const fan = [];
  for (let i = 0; i <= 24; i++) {
    const a = -PI * 0.5 + PI * 2 * i / 24;
    const r = 1 + 0.06 * Math.cos(a * 9);                                   // a soft scalloped rim of feathers
    fan.push([Math.cos(a) * 0.105 * r, Math.sin(a) * 0.085 * r + 0.035]);
  }
  K.mesh(K.shape('bop-cape', fan, 0.006), gloss, [0, 0, 0], cape);
  cape.userData.open = 0;

  // far: a plain dark shape with a hint of the shield
  K.mesh(K.sphere(1, 8, 6), velvet, [0, 0.09, 0], far, null, [0.045, 0.065, 0.05]);
  off.scale.setScalar(SIZE); far.scale.setScalar(SIZE);
  K.place(root, home);

  // the display state, decided once per run: most runs he opens his cape as the van passes
  const displays = Math.random() < 0.85;
  const S = { open: 0, hopT: 0, hopFrom: 0, hopTo: 0, twitch: 0, call: 2 + Math.random() * 3, shown: false, rest: 0 };
  const c = perch(K.makeCreature({
    species: SPECIES['superb-bird-of-paradise'], root, home, radius: 0.12 * SIZE, eye: new THREE.Vector3(0, 0.14 * SIZE, 0.02),
    ground: K.groundY, speed: 0, roam: 0, fleeAt: 0, curiousAt: 0, shy: 1, rareChance: 0, yaw: opts.yaw,
    pose(c, dt, env) {
      const t = env.t, dist = env.dist;
      const rare = c.state === 'rare';
      // the display: as the van comes close (or while the dance lasts)
      const show = !K.night && (rare || (displays && dist < 30));
      S.open = damp(S.open, show ? 1 : 0, show ? 9 : 3, dt);              // it snaps open, folds slowly
      // the cape: from lying on the back (rotated back, small) to standing round the head, cupped
      const o = S.open;
      cape.rotation.x = -1.35 * (1 - o) - 0.15 * o;
      cape.position.set(0, 0.1 + 0.02 * o, -0.005 + 0.02 * o);
      cape.scale.set(0.45 + 0.55 * o, 0.35 + 0.65 * o, 1);
      shield.scale.setScalar(1 + 0.45 * o);
      shield.rotation.x = -0.25 + 0.35 * o;
      body.rotation.x = 0.12 * o;                                           // upright and leaning in
      if (K.night) {
        // roosting: fluffed up, the head sunk into the shoulders, now and then a slow look round
        body.position.set(0, 0.02, 0);
        body.scale.set(1.12, 0.9, 1.08);
        head.position.y = 0.1;
        head.rotation.y = 0.5 * Math.sin(t * 0.2 + c.bob);
        return;
      }
      body.scale.set(1, 1, 1);
      head.position.y = 0.115;
      if (o > 0.2) {
        // the bounce: quick hops side to side in front of her; the full dance is faster and higher,
        // with clicks
        const rate = rare ? 9.5 : 5.5, amp = rare ? 0.075 : 0.05;
        const ph = t * rate;
        body.position.set(Math.sin(ph) * amp * o, 0.03 + Math.abs(Math.cos(ph)) * (rare ? 0.035 : 0.018) * o, 0);
        body.rotation.z = Math.sin(ph) * 0.18 * o;
        head.rotation.set(0, 0, -Math.sin(ph) * 0.12);
        if (rare) { S.call -= dt; if (S.call <= 0 && env.call) { env.call(c, 'rare'); S.call = 0.5 + Math.random() * 0.3; } }
        S.shown = true;
        return;
      }
      body.rotation.z = damp(body.rotation.z, 0, 6, dt);
      // the rest of the time: a hop along the branch now and then, twitches, a call
      if (S.hopT > 0) {
        S.hopT -= dt;
        const k = 1 - S.hopT / 0.28;
        const h = S.hopFrom + (S.hopTo - S.hopFrom) * Math.min(1, k), a = (opts.along ?? opts.yaw ?? 0) - (opts.yaw ?? 0);
        off.position.set(Math.sin(a) * h, 0, Math.cos(a) * h);                // along the branch
        body.position.set(0, 0.03 + Math.sin(Math.min(1, k) * PI) * 0.05, 0);
      } else {
        body.position.set(0, 0.03, 0);
        if (Math.random() < dt * 0.35) { S.hopFrom = S.hopTo; S.hopTo = (Math.random() - 0.6) * 0.3; S.hopT = 0.28; }
      }
      S.twitch -= dt;
      if (S.twitch <= 0) { head.rotation.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 1.2, 0); S.twitch = 0.4 + Math.random() * 1.4; }
      S.call -= dt;
      if (S.call <= 0) { if (env.call && dist < 45) env.call(c, 'idle'); S.call = 3 + Math.random() * 4; }
    },
  }));
  c.display = () => S.open;
  c.rareOff = K.night;                                                 // roosting after dark: no dance
  return K.lod(c, near, far, 26);
}

// =============================================================================================
// The female: plain brown, a pale underside with dark bars, a little smaller. opts: yaw, mate (the
// male: she leans in while he dances).
export function buildBirdOfParadiseFemale(K, home, opts = {}) {
  const brown = K.mat(0x6a4a2e, { roughness: 0.95 }), cap = K.mat(0x4a3322, { roughness: 0.95 });
  const pale = K.mat(0xd8c49c, { roughness: 0.95 }), bar = K.mat(0x3e2c1e, { roughness: 0.95 });
  const billM = K.mat(0x1c1a18, { roughness: 0.5 }), footM = K.mat(0x3a3330, { roughness: 0.8 });

  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  const off = K.group(null, near);
  feet(K, off, footM, 0.014);
  const body = K.group([0, 0.03, 0], off);
  K.mesh(K.sphere(1, 12, 9), brown, [0, 0.048, -0.008], body, [-0.3, 0, 0], [0.038, 0.055, 0.048]);
  K.mesh(K.sphere(1, 10, 8), pale, [0, 0.042, 0.012], body, [-0.3, 0, 0], [0.032, 0.048, 0.036]);   // the pale underside
  for (let i = 0; i < 5; i++) K.mesh(K.torus(0.031 - Math.abs(i - 2) * 0.003, 0.0022, 3, 12, PI), bar, [0, 0.016 + i * 0.013, 0.02], body, [0, PI, PI + 0.25]);   // dark bars across it
  K.mesh(K.capsule(0.011, 0.075, 2, 5), brown, [0, 0.0, -0.062], body, [0.55, 0, 0]);
  for (const s of [-1, 1]) K.mesh(K.sphere(1, 8, 6), brown, [s * 0.032, 0.056, -0.014], body, [-0.4, s * 0.15, 0], [0.011, 0.04, 0.038]);
  const head = K.group([0, 0.105, 0.02], body);
  K.mesh(K.sphere(1, 10, 8), brown, [0, 0, 0], head, null, [0.025, 0.025, 0.028]);
  K.mesh(K.sphere(1, 8, 6), cap, [0, 0.01, -0.002], head, null, [0.024, 0.016, 0.026]);
  K.mesh(K.cone(0.007, 0.024, 6), billM, [0, -0.004, 0.034], head, [PI / 2, 0, 0]);
  for (const s of [-1, 1]) K.mesh(K.sphere(1, 6, 5), K.sheen(0x0a0806, { roughness: 0.1 }), [s * 0.017, 0.004, 0.015], head, null, 0.0042);
  K.mesh(K.sphere(1, 8, 6), brown, [0, 0.085, 0], far, null, [0.04, 0.06, 0.048]);
  off.scale.setScalar(SIZE); far.scale.setScalar(SIZE);
  K.place(root, home);

  let look = 0;
  // (her framing radius is a little larger than his: her tail is the longer one, and she sits further
  // from the road, so aimed at her she wins the frame)
  const c = perch(K.makeCreature({
    species: SPECIES['superb-bird-of-paradise-female'], root, home, radius: 0.14 * SIZE, eye: new THREE.Vector3(0, 0.13 * SIZE, 0.02),
    ground: K.groundY, speed: 0, roam: 0, fleeAt: 0, curiousAt: 0, shy: 1, rareChance: 0, yaw: opts.yaw,
    pose(c, dt, env) {
      const t = env.t, m = opts.mate;
      if (K.night) {
        body.position.set(0, 0.02, 0); body.scale.set(1.12, 0.9, 1.08); head.position.y = 0.09;
        head.rotation.y = 0.4 * Math.sin(t * 0.17 + c.bob);
        return;
      }
      body.scale.set(1, 1, 1); head.position.y = 0.105;
      // she watches him: leans in while he dances, sits up while he displays, otherwise looks about
      const dance = m && m.state === 'rare' ? 1 : 0, shown = m && m.display ? m.display() : 0;
      body.rotation.x = damp(body.rotation.x, dance * 0.45 + shown * 0.1, 4, dt);
      body.position.z = damp(body.position.z, dance * 0.02, 4, dt);
      look -= dt;
      if (shown > 0.2) head.rotation.set(0.15 * dance, Math.sin(t * 2.2) * 0.12 * shown, 0);
      else if (look <= 0) { head.rotation.set((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 1.1, 0); look = 0.6 + Math.random() * 1.8; }
    },
  }));
  return K.lod(c, near, far, 26);
}

export const BUILDERS = {
  'superb-bird-of-paradise': buildBirdOfParadise,
  'superb-bird-of-paradise-female': buildBirdOfParadiseFemale,
};
