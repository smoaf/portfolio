// The far bank: the jungle route's last stretch, after the brackish river. Three species that live
// nowhere else on the run, two of them with a moment of their own:
//
//   jaguar                  steps out onto the road ahead of the van, stops and looks at it, then
//                           walks off, climbs the tree beside the road and lies down on a branch
//   rhinoceros-hornbill     a pair crosses low over the road ahead of the van on loud, whooshing
//                           wingbeats and lands in a tall tree (after dark they roost on its branch)
//   strawberry-poison-frog  a few sit on a mossy log and a broad leaf right by the road
//
// The set pieces are laid out by the route (safari/routes/jungle.js): it hands each one the points
// on the ground and in the trees, and the road progress `at` where it happens. They are timed by how
// far the van still has to go to that point, so they play out the same at any pace.
//
// The twist, as everywhere: a faint glow of their own (the jaguar's rosette lines, the hornbill's
// casque and wing edges, the frogs' speckles), barely there by day and clearly lit after dark.
import * as THREE from 'three';
import { eyePair, leg, perch } from './forest.js';
import { wing, fanTail, birdState, birdPose, eyePair as birdEyes, two } from './cliffs.js';

export const SPECIES = {
  jaguar: { id: 'jaguar', name: 'Jaguar', points: 260, call: { hz: 150, kind: 'noise' } },
  'rhinoceros-hornbill': { id: 'rhinoceros-hornbill', name: 'Rhinoceros hornbill', points: 230, call: { hz: 260, kind: 'noise' } },
  'strawberry-poison-frog': { id: 'strawberry-poison-frog', name: 'Strawberry poison frog', points: 210, call: { hz: 3600, kind: 'trill' } },
};

const PI = Math.PI;
const vA = new THREE.Vector3(), vB = new THREE.Vector3();
const Z = new THREE.Vector3(0, 0, 1);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (a, b, k, dt) => a + (b - a) * Math.min(1, k * dt);
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp = THREE.MathUtils.clamp;
const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

// =============================================================================================
// Jaguar: a heavy, muscular big cat, ~1.7 m plus the tail. Golden-yellow coat with black rosettes
// (rings with a spot or two inside), a pale belly, a broad head, short thick legs and big paws.
// The twist: the rosette rings carry a faint line of light.
//
// The set piece (opts): from (where it waits, in the forest beside the road), cross (the middle of
// the road), foot (the foot of the tree on the other side), bough (the branch it lies on:
// { start, dir, y: the height of its top where it climbs on }), at (the road progress of `cross`),
// length (the road's length); `home` is its spot on the branch.
//   wait -> out (onto the road) -> look (stands and looks at the van) -> off (to the tree) ->
//   climb (up the trunk) -> onto (turns onto the branch, walks out) -> lie
export function buildJaguar(K, home, opts = {}) {
  const coat = K.mat(0xc8913a, { roughness: 0.88 }), cream = K.mat(0xeee0c2, { roughness: 0.92 });
  const ink = K.mat(0x17110c, { roughness: 0.9 });
  // the rosette lines: no glow to speak of by day, a clear thin line of light after dark
  const ring = K.mat(0x1a130d, { roughness: 0.85, emissive: 0x9af2d6, emissiveIntensity: Math.max(0, K.glowLevel - 0.25) * 0.3 });
  const inner = K.mat(0xa66b26, { roughness: 0.9 });                // the darker gold inside a rosette
  const noseM = K.mat(0x7a4e44, { roughness: 0.6 }), mouthM = K.mat(0x2a1a14, { roughness: 0.8 });

  const root = new THREE.Group();
  const shade = K.shadow(root, 0.5, 1.05);
  const pivot = K.group([0, 0, -0.48], root);                     // at the hind feet: it rears up on them to climb
  const near = K.group([0, 0, 0.48], pivot), far = K.group([0, 0, 0.48], pivot);
  const body = K.group(null, near);
  const tor = K.group([0, 0.6, 0], body);
  // the torso: haunch, barrel and a deep chest; the pale belly under it
  const PARTS = [[0, 0.02, -0.4, 0.21, 0.24, 0.3], [0, 0, 0, 0.22, 0.24, 0.46], [0, 0.02, 0.4, 0.23, 0.27, 0.3]];   // x y z rx ry rz
  for (const [x, y, z, rx, ry, rz] of PARTS) K.mesh(K.sphere(1, 16, 11), coat, [x, y, z], tor, null, [rx, ry, rz]);
  K.mesh(K.sphere(1, 12, 8), cream, [0, -0.09, 0.02], tor, null, [0.18, 0.16, 0.6]);
  K.mesh(K.sphere(1, 12, 8), cream, [0, -0.06, 0.48], tor, null, [0.17, 0.2, 0.16]);              // the throat and chest
  // the rosettes, fitted onto whichever part of the torso is outermost at that spot
  const q = new THREE.Quaternion(), n = new THREE.Vector3();
  const skin = (a, z) => {
    let best = null;
    for (const [, py, pz, rx, ry, rz] of PARTS) {
      const t = (z - pz) / rz;
      if (Math.abs(t) >= 0.97) continue;
      const k = Math.sqrt(1 - t * t), ca = Math.cos(a), sa = Math.sin(a);
      const r = 1 / Math.sqrt((ca / (rx * k)) ** 2 + (sa / (ry * k)) ** 2);
      const y = py + sa * r;
      const out = r + py * sa;                                   // how far out from the torso's axis
      if (!best || out > best.out) {
        n.set((ca * r) / (rx * rx), (sa * r) / (ry * ry), (0.6 * t) / rz).normalize();
        best = { out, p: new THREE.Vector3(ca * r, y, z), n: n.clone() };
      }
    }
    return best;
  };
  // a rosette is a broken ring: an arc of four fifths, turned a different way each time
  const ringGeo = K.torus(1, 0.16, 3, 9, PI * 1.6), dotGeo = K.sphere(1, 6, 4), discGeo = K.geo('fb-disc', () => new THREE.CircleGeometry(1, 9));
  for (let row = 0; row < 13; row++) {
    const z = -0.66 + row * 0.108;
    for (let i = 0; i < 8; i++) {
      const a = -0.35 + (i + (row % 2) * 0.5) * ((PI + 0.7) / 8) + (K.rand() - 0.5) * 0.2;
      if (a > PI + 0.35) continue;
      const s = skin(a, z + (K.rand() - 0.5) * 0.05);
      if (!s) continue;
      const size = 0.034 + K.rand() * 0.016 - Math.abs(z) * 0.015;
      q.setFromUnitVectors(Z, s.n).multiply(new THREE.Quaternion().setFromAxisAngle(Z, K.rand() * PI * 2));
      const at = (k) => [s.p.x + s.n.x * k, s.p.y + s.n.y * k, s.p.z + s.n.z * k];
      K.mesh(ringGeo, ring, at(0.004), tor, null, [size, size * (0.7 + K.rand() * 0.35), size * 0.3]).quaternion.copy(q);
      K.mesh(discGeo, inner, at(0.003), tor, null, [size * 0.85, size * 0.62, 1]).quaternion.copy(q);
      if (K.rand() < 0.6) K.mesh(dotGeo, ink, at(0.005), tor, null, [size * 0.2, size * 0.2, size * 0.08]).quaternion.copy(q);
    }
  }
  // the spine: a line of solid black spots along the back
  for (let i = 0; i < 9; i++) K.mesh(dotGeo, ink, [0, 0.262 - Math.abs(i - 4) * 0.004, -0.5 + i * 0.12], tor, null, [0.028, 0.012, 0.045]);

  // neck and head: a short thick neck, a broad round head with small rounded ears
  const neck = K.group([0, 0.68, 0.5], body);
  K.mesh(K.capsule(0.15, 0.2, 3, 9), coat, [0, 0.0, 0.08], neck, [1.2, 0, 0]);
  K.mesh(K.sphere(1, 10, 8), cream, [0, -0.08, 0.1], neck, null, [0.12, 0.12, 0.14]);
  const head = K.group([0, 0.06, 0.24], neck);
  head.scale.set(1.22, 1.15, 1.1);                               // a broad, heavy head: the jaguar's mark
  K.mesh(K.sphere(1, 16, 11), coat, [0, 0, 0], head, null, [0.165, 0.15, 0.16]);
  K.mesh(K.sphere(1, 12, 9), coat, [0, -0.05, 0.11], head, null, [0.12, 0.085, 0.09]);             // the muzzle, short and wide
  for (const s of [-1, 1]) K.mesh(K.sphere(1, 10, 8), cream, [s * 0.045, -0.07, 0.17], head, null, [0.055, 0.045, 0.05]);   // whisker pads
  K.mesh(K.sphere(1, 10, 8), cream, [0, -0.115, 0.1], head, null, [0.07, 0.035, 0.07]);            // chin
  K.mesh(K.sphere(1, 8, 6), noseM, [0, -0.025, 0.215], head, null, [0.035, 0.022, 0.02]);
  K.mesh(K.box(0.004, 0.035, 0.01), mouthM, [0, -0.06, 0.22], head);
  for (const s of [-1, 1]) {
    K.mesh(K.sphere(1, 10, 8), coat, [s * 0.11, 0.12, -0.03], head, [0, 0, s * -0.4], [0.05, 0.05, 0.022]);
    K.mesh(K.sphere(1, 8, 6), ink, [s * 0.11, 0.12, -0.05], head, [0, 0, s * -0.4], [0.045, 0.045, 0.01]);   // dark backs to the ears
    K.mesh(K.sphere(1, 6, 4), cream, [s * 0.064, 0.055, 0.12], head, null, [0.025, 0.012, 0.02]);   // pale brows
  }
  // small solid spots over the forehead and cheeks
  [[0, 0.12, 0.07], [-0.05, 0.13, 0.04], [0.05, 0.13, 0.04], [-0.03, 0.15, -0.01], [0.03, 0.15, -0.01], [-0.12, 0.0, 0.07], [0.12, 0.0, 0.07], [-0.13, 0.04, 0.02], [0.13, 0.04, 0.02]]
    .forEach(([x, y, z]) => K.mesh(dotGeo, ink, [x, y, z], head, null, [0.012, 0.012, 0.008]));
  const eyes = eyePair(K, head, [0, 0.035, 0.125], { dx: 0.06, r: 0.024, iris: 0xc8b23c, glow: 0.45, yaw: 0.22 });

  // legs: short and thick, big round paws, spotted
  const paw = (g, y) => K.mesh(K.sphere(1, 10, 8), coat, [0, y - 0.02, 0.04], g, null, [0.075, 0.05, 0.095]);
  const spotLeg = (L) => { for (let i = 0; i < 3; i++) K.mesh(dotGeo, ink, [(i % 2 ? 1 : -1) * 0.05, -0.06 - i * 0.07, 0.05], L.knee, null, [0.014, 0.016, 0.01]); return L; };
  const front = (x, ph) => ({ ...spotLeg(leg(K, body, [x, 0.58, 0.4], { r1: 0.085, l1: 0.26, r2: 0.066, l2: 0.25, m1: coat, foot: paw })), ph, front: true });
  const hind = (x, ph) => ({ ...spotLeg(leg(K, body, [x, 0.6, -0.42], { r1: 0.1, l1: 0.28, r2: 0.064, l2: 0.27, m1: coat, foot: paw })), ph, front: false });
  // the walk: a lateral sequence, left hind, left fore, right hind, right fore
  const legs = [front(-0.14, PI / 2), front(0.14, PI * 1.5), hind(-0.13, 0), hind(0.13, PI)];
  // the tail: long and thick, in three pieces so it can swing, curl and hang; black rings to the tip
  const tails = [];
  let parent = body, at = [0, 0.66, -0.62];
  for (let i = 0; i < 3; i++) {
    const g = K.group(at, parent, [[-0.75, -0.25, 0.45][i], 0, 0]);
    const r = 0.05 - i * 0.008;
    K.mesh(K.capsule(r, 0.22, 3, 7), coat, [0, 0, -0.13], g, [PI / 2, 0, 0]);
    K.mesh(K.torus(1, 0.25, 3, 9), ink, [0, 0, -0.2], g, null, [r * 1.02, r * 1.02, r * 1.4]);
    tails.push(g); parent = g; at = [0, 0, -0.26];
  }
  K.mesh(K.sphere(1, 8, 6), ink, [0, 0, -0.06], tails[2], null, [0.04, 0.04, 0.07]);

  // far: barrel, head, legs and tail in a handful of pieces
  K.mesh(K.sphere(1, 10, 7), coat, [0, 0.6, 0], far, null, [0.26, 0.29, 0.72]);
  K.mesh(K.sphere(1, 8, 6), coat, [0, 0.76, 0.76], far, null, [0.17, 0.15, 0.17]);
  K.mesh(K.box(0.36, 0.5, 0.95), coat, [0, 0.26, 0], far);
  K.mesh(K.capsule(0.045, 0.6, 2, 6), coat, [0, 0.5, -0.9], far, [0.6, 0, 0]);
  K.place(root, home);

  // ---- the set piece
  const S = { ph: 'wait', t: 0, w: 0, gph: 0, lie: 0, climb: 0, rear: 0, look: 0 };
  const from = opts.from ? opts.from.clone() : home.clone(), cross = opts.cross ? opts.cross.clone() : home.clone();
  const foot = opts.foot ? opts.foot.clone() : home.clone(), bough = opts.bough;
  const at0 = opts.at ?? 0, len = opts.length ?? 1;
  // where it climbs: on the road side of the trunk, facing it, and the spot it lies on along the branch
  const trunkYaw = yawTo(cross, foot);
  // it walks up until its chest nearly touches the bark, then rears and closes in as it climbs
  const toTrunk = new THREE.Vector3(Math.sin(trunkYaw), 0, Math.cos(trunkYaw));
  const climbAt = foot.clone().addScaledVector(toTrunk, -(opts.trunkR ?? 0.6) - 0.75);
  const CLOSE = 0.98;                                            // how far it closes in on the trunk as it rears
  const lieAt = home.clone();                                    // home is its spot on the branch
  const lieYaw = bough ? Math.atan2(bough.dir.x, bough.dir.z) : 0;
  const crossYaw = yawTo(from, cross);

  const c = K.makeCreature({
    species: SPECIES.jaguar, root, home, radius: 0.9, eye: new THREE.Vector3(0, 0.82, 0.78),
    flyer: true,                                                  // it climbs: the engine must not turn it round on the ground
    speed: 2.4, roam: 0, fleeAt: 0, curiousAt: 60, shy: 0, rareChance: 0,
    pose(c, dt, env) {
      K.blink(c, [eyes], dt);
      const moving = S.ph === 'out' || S.ph === 'off' || (S.ph === 'onto' && S.t > 0.7);
      S.w = damp(S.w, moving ? 1 : 0, 5, dt);
      S.gph += dt * 5.2 * S.w + (S.ph === 'climb' ? dt * 7 : 0);
      S.lie = damp(S.lie, S.ph === 'lie' ? 1 : S.ph === 'wait' ? 0.55 : 0, S.ph === 'lie' ? 2 : 3, dt);
      S.rear = damp(S.rear, S.ph === 'climb' ? 1 : 0, S.ph === 'climb' ? 6 : 3.5, dt);
      // the walk: a heavy, rolling gait, the shoulders working, the head carried low
      const climbing = S.rear > 0.05;
      legs.forEach((L) => {
        const p = S.gph + L.ph, s = Math.sin(p);
        const amp = climbing ? 0.95 : 0.42;
        let hx = s * amp * Math.max(S.w, S.rear), kx = Math.max(0, Math.cos(p)) * 0.8 * Math.max(S.w, S.rear) * (L.front ? 1 : -1);
        if (climbing && L.front) hx -= 1.1 * S.rear;             // the forelegs reach up the bark
        if (climbing && !L.front) hx += 0.6 * S.rear;
        // lying: forelegs out in front (on the ground) or both pairs hanging down either side of the branch
        const onBranch = S.ph === 'lie' || S.ph === 'onto';
        const lx = onBranch ? (L.front ? 0.25 : 0.15) : (L.front ? -1.35 : 1.25);
        const lk = onBranch ? (L.front ? 0.45 : -0.4) : (L.front ? 0.2 : -2.2);
        L.hip.rotation.x = hx * (1 - S.lie) + lx * S.lie;
        L.knee.rotation.x = kx * (1 - S.lie) + lk * S.lie;
        L.hip.rotation.z = onBranch ? (L.hip.position.x > 0 ? 1 : -1) * 0.62 * S.lie : 0;
      });
      tor.rotation.z = Math.sin(S.gph) * 0.04 * S.w;
      tor.rotation.y = Math.sin(S.gph) * 0.05 * S.w;
      body.position.y = -0.36 * S.lie + Math.abs(Math.sin(S.gph * 2)) * 0.015 * S.w;
      pivot.rotation.x = -1.35 * S.rear;
      // the head: low while it walks, raised and turned to the van when it stops on the road and on the branch
      S.look = damp(S.look, S.ph === 'look' || S.ph === 'lie' || S.ph === 'wait' ? 1 : 0, 3, dt);
      neck.rotation.x = damp(neck.rotation.x, (S.w > 0.5 ? 0.2 : -0.1) - 0.15 * S.lie + (climbing ? 0.9 : 0), 4, dt);
      if (S.look > 0.3 && c.near < 90) K.look(c, head, env, dt, { yaw: 1.55, pitch: 0.6, rate: 2.6, force: true });
      else { head.rotation.y = damp(head.rotation.y, Math.sin(env.t * 0.4 + c.bob) * 0.2 * (1 - S.w), 3, dt); head.rotation.x = damp(head.rotation.x, 0, 3, dt); }
      const br = 1 + Math.sin(env.t * (S.w > 0.5 ? 2.6 : 1.4) + c.bob) * 0.014;
      tor.scale.set(br, br, 1);
      // the tail: swings with the walk, hangs from the branch with the tip twitching
      const hang = S.ph === 'lie' || S.ph === 'onto' ? S.lie : 0;
      tails.forEach((g, i) => {
        g.rotation.y = Math.sin(env.t * 1.1 - i * 0.7 + c.bob) * (0.18 + 0.1 * i) * (1 - hang) + Math.sin(S.gph - i * 0.6) * 0.12 * S.w;
        const rest = [-0.75, -0.25, 0.45][i] * (1 - hang) + [-1.35, -0.1, 0.25][i] * hang;   // low with the tip curled up; straight down from the branch
        g.rotation.x = rest + (i === 2 ? Math.max(0, Math.sin(env.t * 1.9 + c.bob)) * 0.5 * hang : 0) + (climbing && i === 0 ? -0.6 : 0);
      });
      shade.visible = S.ph !== 'climb' && S.ph !== 'onto' && S.ph !== 'lie';
    },
  });

  // walks towards p at speed v; true when it is there
  const walk = (p, v, dt) => {
    const r = c.root.position;
    vA.subVectors(p, r).setY(0);
    const d = vA.length();
    if (d < 0.08) return true;
    c.root.rotation.y += wrap(Math.atan2(vA.x, vA.z) - c.root.rotation.y) * Math.min(1, dt * 6);
    r.addScaledVector(vA.normalize(), Math.min(d, v * dt));
    r.y = K.groundY(r.x, r.z);
    return false;
  };
  // it starts out in the undergrowth beside the road, not at home (the branch it ends up on)
  root.position.copy(from); root.rotation.y = crossYaw + 0.5;
  const to = (ph, state) => { S.ph = ph; S.t = 0; if (state) c.go(state, 999); };
  const settle = () => { c.root.position.copy(lieAt); c.root.rotation.y = lieYaw; S.lie = 1; to('lie', 'idle'); };

  c.step = (dt, env) => {
    c._env = env; c.t += dt; S.t += dt;
    const ahead = (at0 - env.u) * len;                            // how far the van still has to go to the crossing
    const r = c.root.position;
    switch (S.ph) {
      case 'wait':
        // crouched in the undergrowth, watching the road
        r.y = K.groundY(r.x, r.z);
        if (ahead < 8) settle();                                  // the van is already past (a test skip)
        else if (ahead < (opts.lead ?? 62)) { to('out', 'rare'); if (env.call) env.call(c, 'rare'); }
        break;
      case 'out':
        if (walk(cross, 2.3, dt)) to('look');
        break;
      case 'look': {
        // stops in the middle of the road, turns the head (and a little of the body) to the van
        const want = yawTo(r, env.camPos);
        const turn = clamp(wrap(want - crossYaw), -0.55, 0.55);
        c.root.rotation.y += wrap(crossYaw + turn - c.root.rotation.y) * Math.min(1, dt * 1.5);
        if (S.t > 1.6 && (ahead < (opts.leave ?? 22) || S.t > 7)) to('off');
        break;
      }
      case 'off':
        if (walk(climbAt, 2.6, dt)) { to('climb'); S.y0 = r.y; }
        break;
      case 'climb': {
        // up the road side of the trunk, in bounds
        c.root.rotation.y += wrap(trunkYaw - c.root.rotation.y) * Math.min(1, dt * 8);
        const k = ease((S.t - 0.35) / 1.5);
        r.set(climbAt.x, S.y0 + (bough.y - S.y0) * k, climbAt.z).addScaledVector(toTrunk, CLOSE * ease(S.t / 0.45));
        if (S.t > 1.9) { to('onto', 'idle'); S.p0 = r.clone(); }
        break;
      }
      case 'onto': {
        // turns along the branch and walks out to its spot
        c.root.rotation.y += wrap(lieYaw - c.root.rotation.y) * Math.min(1, dt * 4);
        const k = ease((S.t - 0.5) / 1.3);
        r.lerpVectors(S.p0, lieAt, k);
        if (S.t > 1.9) to('lie');
        break;
      }
      case 'lie':
        r.copy(lieAt);
        break;
    }
    c.pose(c, dt, env);
    c.root.updateMatrixWorld();
  };
  // the lens aims for the head, wherever the set piece has put it (on the road, up the trunk, on the branch)
  c.photoPoint = (out) => head.getWorldPosition(out);
  return K.lod(c, near, far, 45);
}

// =============================================================================================
// Rhinoceros hornbill: a large black bird (~1 m with the tail) with a white belly, a white tail
// crossed by a black band, a long curved yellow-white bill and on top of it the big upturned casque,
// orange-red fading to yellow. Red eyes. The twist: a line of light along the casque and the wing edges.
//
// opts.mode: 'cross' (day: waits on a branch in the forest at the start of opts.path, flies the path
// low over the road once the van is opts.lead metres from opts.at, lands at its end) or 'roost'
// (night: sits on the branch at `home`). Wingbeats whoosh; the broad wings of a hornbill are loud.
const HORN_UP = 0.36;                                             // the body's centre above the feet
export function buildRhinocerosHornbill(K, home, opts = {}) {
  const mode = opts.mode || 'roost';
  const black = K.mat(0x121010, { roughness: 0.7 }), white = K.mat(0xeee9df, { roughness: 0.85 });
  const night = Math.max(0, K.glowLevel - 0.25);                  // 0 by day, ~2 at night
  const billM = K.sheen(0xf1e2a8, { roughness: 0.35 });
  const casqueM = K.sheen(0xe2501e, { roughness: 0.32, emissive: 0xff5a1e, emissiveIntensity: night * 0.35 }), casqueY = K.sheen(0xf2b437, { roughness: 0.32, emissive: 0xffb43a, emissiveIntensity: night * 0.3 });
  const legM = K.mat(0x5b5c56, { roughness: 0.8 }), skinM = K.mat(0x2a2422, { roughness: 0.7 });
  const feather = two(K, 0x141212, { roughness: 0.65 }), cov = two(K, 0x1d1a19, { roughness: 0.7 }), tailW = two(K, 0xf0ece4, { roughness: 0.8 });
  // the glow along the casque and the wing edges: dark by day (the wings are all black), lit after dark
  const lum = K.mat(0x1c1612, { emissive: 0xffbe6a, emissiveIntensity: Math.max(0.03, night) * 1.1, roughness: 0.5, side: THREE.DoubleSide });
  const lumBase = lum.emissiveIntensity;

  const root = K.group();
  const near = K.group(null, root), far = K.group(null, root);
  const body = K.group([0, HORN_UP, 0], near);
  // body (+z along the spine): black above, the white belly and vent below
  K.mesh(K.sphere(0.17, 14, 10), black, [0, 0.02, 0.02], body, null, [1.0, 0.92, 1.65]);
  K.mesh(K.sphere(0.14, 12, 8), black, [0, -0.02, 0.2], body, null, [1.02, 1.0, 1.0]);
  K.mesh(K.sphere(0.13, 12, 8), white, [0, -0.08, -0.12], body, null, [0.85, 0.65, 1.25]);
  // neck and head
  const neck = K.group([0, 0.06, 0.3], body);
  K.mesh(K.capsule(0.06, 0.1, 3, 8), black, [0, 0.05, 0.02], neck, [-0.6, 0, 0]);
  const head = K.group([0, 0.12, 0.06], neck);
  K.mesh(K.sphere(0.075, 12, 9), black, [0, 0, 0], head, null, [0.9, 0.95, 1.1]);
  // the bill: long, deep at the base and curving down to the tip, yellow-white with a reddish base
  K.mesh(K.tube('fb-bill', [[0, -0.01, 0.05], [0, -0.02, 0.17], [0, -0.06, 0.28], [0, -0.13, 0.36]], 0.04, 0.008, 8, 10), billM, null, head);
  K.mesh(K.tube('fb-billbase', [[0, -0.005, 0.04], [0, -0.012, 0.09]], 0.045, 0.04, 8, 3), casqueM, null, head);
  // the casque: a horn lying on the upper bill, its front end swept up and back
  K.mesh(K.tube('fb-casque', [[0, 0.04, 0.03], [0, 0.065, 0.12], [0, 0.07, 0.2], [0, 0.11, 0.25], [0, 0.15, 0.22]], 0.035, 0.012, 8, 12), casqueM, null, head);
  K.mesh(K.tube('fb-casqueY', [[0, 0.035, 0.12], [0, 0.04, 0.2], [0, 0.07, 0.25]], 0.028, 0.012, 7, 8), casqueY, null, head);
  K.mesh(K.tube('fb-casqueLum', [[0, 0.09, 0.05], [0, 0.103, 0.13], [0, 0.107, 0.2], [0, 0.145, 0.25], [0, 0.18, 0.22]], 0.011, 0.006, 5, 12), lum, null, head);
  for (const s of [-1, 1]) K.mesh(K.sphere(0.02, 8, 6), skinM, [s * 0.05, 0.012, 0.035], head);   // the bare skin round the eye
  const eyes = birdEyes(K, head, { x: 0.058, y: 0.014, z: 0.038, r: 0.012, iris: 0xd0261a, glow: 0.4, dir: 0.9 });
  // broad wings, black with the glowing edge; the white tail with a black band
  const WS = { at: [0.13, 0.08, 0.17], arm: 0.36, hand: 0.42, chord: 0.3, bone: 0.03, sec: 7, prim: 7, primLen: 0.34, primW: 0.075,
    mats: { wing: feather, cov, prim: feather, tip: lum, edge: lum } };
  const wings = [wing(K, body, -1, WS), wing(K, body, 1, WS)];
  const tail = fanTail(K, body, [0, 0.0, -0.22], 8, 0.42, 0.085, 0.4, tailW, feather, [0.42], 0.24);
  // legs: short and grey, tucked away in flight
  const legs = [-1, 1].map((s) => {
    const g = K.group([s * 0.06, 0.24, 0.04], near);
    K.mesh(K.capsule(0.018, 0.14, 3, 6), legM, [0, -0.12, 0], g);
    for (const a of [-0.45, 0, 0.45, PI]) K.mesh(K.capsule(0.011, 0.05, 2, 5), legM, [Math.sin(a) * 0.035, -0.215, Math.cos(a) * 0.035], g, [PI / 2, a, 0]);
    return g;
  });
  const R = { body, wings, tail, P: birdState({ fold: mode === 'cross' || mode === 'roost' ? 1 : 0, pitch: -0.5, legs: 0 }) };

  // far: body, head, bill and casque, one wing slab
  const fb = K.group([0, HORN_UP, 0], far);
  K.mesh(K.sphere(0.17, 8, 6), black, [0, 0.02, 0.02], fb, null, [1, 0.92, 1.7]);
  K.mesh(K.sphere(0.13, 8, 6), white, [0, -0.08, -0.15], fb, null, [0.8, 0.6, 1.2]);
  K.mesh(K.sphere(0.08, 6, 5), black, [0, 0.2, 0.38], fb);
  K.mesh(K.cone(0.04, 0.3, 6), billM, [0, 0.15, 0.58], fb, [PI / 2 + 0.3, 0, 0]);
  K.mesh(K.capsule(0.03, 0.12, 2, 6), casqueM, [0, 0.25, 0.5], fb, [1.2, 0, 0]);
  const fw = K.group([0, 0.07, 0.12], fb);
  K.mesh(K.box(1.5, 0.03, 0.34), feather, [0, 0, -0.1], fw);
  K.mesh(K.box(0.2, 0.02, 0.4), tailW, [0, -0.02, -0.5], fb);

  K.place(root, home);
  const T = {};
  // the flight: along a curve through opts.path, quick off the branch, slowing to land
  const curve = mode === 'cross' && opts.path ? new THREE.CatmullRomCurve3(opts.path.map((p) => p.clone()), false, 'centripetal') : null;
  const flen = curve ? curve.getLength() : 1;
  const F = { ph: curve ? 'wait' : 'perch', t: 0, s: 0, v: 0, yr: 0, climb: 0, beat: 0 };
  const at0 = opts.at ?? 0, len = opts.length ?? 1;

  const c = K.makeCreature({
    species: SPECIES['rhinoceros-hornbill'], root, home, flyer: true, radius: 0.55, eye: new THREE.Vector3(0, HORN_UP + 0.2, 0.38),
    fleeAt: 0, curiousAt: 40, shy: 0.3,
    pose(c, dt, env) {
      const flying = F.ph === 'fly';
      if (!flying) {
        // on the branch: wings folded, upright; after dark it sits low with the head drawn in
        const sleepy = mode === 'roost' && c.near > 26 ? 1 : 0;
        Object.assign(T, { fold: 1, mantle: 0, amp: 0, rate: 0, dihedral: 0, sweep: 0, pitch: -0.5 + 0.15 * sleepy, bank: 0, legs: 0, fan: 1, tailUp: -0.15 });
        if (F.ph === 'landed' && F.t < 0.9) Object.assign(T, { fold: ease(F.t / 0.9), mantle: 0.4 * (1 - F.t / 0.9), fan: 1.4 });   // folding up after the landing
      } else {
        const u = F.s / flen;
        const landing = u > 0.8, start = F.t < 1.1;
        const flap = start || landing || Math.sin(F.t * 1.6 + c.bob) > -0.2;   // a few heavy beats, a short glide
        Object.assign(T, { fold: 0, mantle: 0, amp: flap ? 0.85 : 0.06, rate: flap ? 6.2 : 2, dihedral: 0.12, sweep: landing ? -0.3 : 0.05,
          pitch: landing ? -0.55 : clamp(-F.climb * 0.08, -0.35, 0.35), bank: clamp(-F.yr * 0.9, -0.6, 0.6), legs: landing ? -0.3 : 1.3,
          fan: landing ? 1.5 : 1.05, tailUp: landing ? 0.2 : 0 });
      }
      const was = Math.sin(R.P.phase);
      birdPose(R, dt, T, flying ? 4 : 2.5);
      // the whoosh of each downstroke (the engine plays one call at a time)
      if (flying && R.P.amp > 0.4 && was > 0 && Math.sin(R.P.phase) <= 0 && env.call) env.call(c, 'rare');
      neck.rotation.x = -R.body.rotation.x * (flying ? 0.3 : 0.6) + (flying ? 0.25 : -0.05);
      K.look(c, head, env, dt, { yaw: 1.4, pitch: 0.5, rate: 2.5, force: !flying && c.near < 40 });
      K.blink(c, [eyes], dt);
      const breathe = 1 + Math.sin(env.t * 1.5 + c.bob) * 0.015;
      body.scale.set(breathe, breathe, 1);
      for (const l of legs) { l.rotation.x = R.P.legs; l.visible = !flying || F.s / flen > 0.85; }
      lum.emissiveIntensity = lumBase * (0.9 + 0.1 * Math.sin(env.t * 0.8 + c.bob));
      fb.rotation.x = R.body.rotation.x; fb.rotation.z = R.body.rotation.z;
      fw.scale.x = 0.25 + 0.75 * (1 - R.P.fold);
      fw.rotation.z = Math.sin(R.P.phase) * R.P.amp * 0.5;
    },
  });

  // a crossing bird waits at the start of its flight (its home is where it lands)
  if (curve) { root.position.copy(opts.path[0]); curve.getTangentAt(0.02, vA); root.rotation.y = Math.atan2(vA.x, vA.z); }
  else root.rotation.y = opts.yaw ?? root.rotation.y;

  c.step = (dt, env) => {
    c._env = env; c.t += dt; F.t += dt;
    const p = c.root.position;
    if (F.ph === 'wait') {
      const ahead = (at0 - env.u) * len;
      if (ahead < -10) { p.copy(curve.getPointAt(1)); F.ph = 'landed'; F.t = 9; c.root.rotation.y = opts.landYaw ?? c.root.rotation.y; }   // a test skip: already there
      else if (ahead < (opts.lead ?? 52) && F.t > (opts.delay ?? 0)) { F.ph = 'fly'; F.t = 0; c.go('rare', 999); }
      else if (ahead >= (opts.lead ?? 52)) F.t = 0;               // the delay counts from the moment the pair sets off
    } else if (F.ph === 'fly') {
      // off the branch quickly, cruising at ~10 m/s, braking for the last few metres
      const u = F.s / flen;
      const want = u > 0.82 ? 3 + 7 * (1 - u) / 0.18 : 10;
      F.v = damp(F.v, want, F.t < 0.8 ? 4 : 2.5, dt);
      F.s = Math.min(flen, F.s + F.v * dt);
      vB.copy(p);
      curve.getPointAt(F.s / flen, p);
      vB.subVectors(p, vB);
      F.climb = damp(F.climb, vB.y / Math.max(dt, 1e-3), 3, dt);
      if (Math.hypot(vB.x, vB.z) > 1e-4) {
        const d = wrap(Math.atan2(vB.x, vB.z) - c.root.rotation.y) * Math.min(1, dt * 6);
        c.root.rotation.y += d;
        F.yr = damp(F.yr, d / Math.max(dt, 1e-3), 3, dt);
      }
      if (F.s >= flen - 0.01) { F.ph = 'landed'; F.t = 0; c.go('idle', 999); }
    } else if (F.ph === 'landed' && opts.landYaw !== undefined) {
      c.root.rotation.y += wrap(opts.landYaw - c.root.rotation.y) * Math.min(1, dt * 2);
    }
    c.pose(c, dt, env);
    c.root.updateMatrixWorld();
  };
  return K.lod(c, near, far, 45);
}

// =============================================================================================
// Strawberry poison frog: shiny bright red with blue-black legs and small dark speckles. The real
// frog is about 2 cm; like the insects of the run it is scaled up (to ~14 cm here), so the long lens
// can still make it out at the road side. The twist: some of the speckles on the back glow faintly.
// opts.bed: 'log' (a mossy log under it), 'leaf' (a broad leaf on a stalk) or nothing (the route
// sets it on another frog's log).
export function buildPoisonFrog(K, home, opts = {}) {
  const red = K.sheen(0xd9221c, { roughness: 0.25 }), blue = K.sheen(0x1d3a8c, { roughness: 0.3 });
  const dot = K.mat(0x1a0d0c, { roughness: 0.5 }), lumDot = K.mat(0x2a1210, { roughness: 0.4, emissive: 0x7ff3ff, emissiveIntensity: Math.max(0.03, K.glowLevel - 0.25) * 0.9 });
  const throatM = K.sheen(0xb81a18, { roughness: 0.3 });
  const bark = K.mat(0x4b3b2b, { roughness: 1 }), moss = K.mat(0x3f5e2c, { roughness: 1 }), leafM = K.mat(0x2f6a34, { roughness: 0.7, side: THREE.DoubleSide });

  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  let bedY = 0;
  if (opts.bed === 'log') {
    bedY = 0.44;
    K.mesh(K.cyl(0.24, 0.27, 2.2, 9), bark, [0.3, 0.22, 0], near, [0, 0, PI / 2]);
    K.mesh(K.cyl(0.245, 0.245, 0.03, 9), K.mat(0x7a5e40, { roughness: 1 }), [1.41, 0.22, 0], near, [0, 0, PI / 2]);
    K.mesh(K.sphere(1, 9, 6), moss, [0.15, 0.42, 0.02], near, null, [0.45, 0.04, 0.18]);
    K.mesh(K.sphere(1, 7, 5), moss, [0.9, 0.4, 0.06], near, null, [0.32, 0.07, 0.16]);
    K.mesh(K.cyl(0.24, 0.27, 2.2, 5), bark, [0.3, 0.22, 0], far, [0, 0, PI / 2]);
  } else if (opts.bed === 'leaf') {
    bedY = 0.62;
    K.mesh(K.cyl(0.012, 0.018, 0.64, 5), leafM, [0, 0.31, -0.06], near, [0.1, 0, 0]);
    const leafPts = [[0, -0.05], [0.13, 0.0], [0.2, 0.14], [0.16, 0.3], [0, 0.4], [-0.16, 0.3], [-0.2, 0.14], [-0.13, 0.0]];
    K.mesh(K.shape('fb-frogleaf', leafPts), leafM, [0, bedY - 0.01, -0.12], near, [-PI / 2 + 0.06, 0, 0]);
    K.mesh(K.shape('fb-frogleaf', leafPts), leafM, [0.08, bedY - 0.12, -0.2], near, [-PI / 2 + 0.5, 0.9, 0], 0.8);
  }
  const body = K.group([0, bedY, 0], near);
  // the frog (+z forward): a plump body, a blunt head with big dark eyes, legs folded under it
  const trunk = K.group([0, 0.035, 0], body);
  K.mesh(K.sphere(1, 14, 10), red, [0, 0, -0.01], trunk, [0.25, 0, 0], [0.038, 0.032, 0.055]);
  K.mesh(K.sphere(1, 12, 9), red, [0, 0.008, 0.04], trunk, null, [0.034, 0.026, 0.032]);
  const throat = K.mesh(K.sphere(1, 10, 8), throatM, [0, -0.012, 0.045], trunk, null, [0.024, 0.016, 0.022]);
  throat.userData.keep = true;
  for (const s of [-1, 1]) {
    K.mesh(K.sphere(1, 10, 8), K.sheen(0x0a0808, { roughness: 0.1 }), [s * 0.022, 0.024, 0.048], trunk, null, 0.0105);
    K.mesh(K.sphere(1, 5, 4), K.mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9 }), [s * 0.025, 0.031, 0.055], trunk, null, 0.003);
  }
  // speckles over the back, a few of them faintly glowing
  for (let i = 0; i < 16; i++) {
    const z = -0.05 + ((i * 0.618) % 1) * 0.085, a = 0.35 + ((i * 0.382) % 1) * (PI - 0.7);
    const k = Math.sqrt(Math.max(0, 1 - ((z + 0.01) / 0.058) ** 2));
    K.mesh(K.sphere(1, 5, 4), i % 3 ? dot : lumDot, [Math.cos(a) * 0.038 * k, Math.sin(a) * 0.032 * k, z], trunk, null, [0.0055, 0.003, 0.0055]);
  }
  // the blue legs: forelegs splayed out in front, hind legs folded in a Z beside the body, round toe pads
  const pads = (x, y, z, yaw) => { for (let t = -1; t <= 1; t++) K.mesh(K.sphere(1, 6, 4), blue, [x + Math.sin(yaw + t * 0.5) * 0.014, y, z + Math.cos(yaw + t * 0.5) * 0.014], body, null, [0.0055, 0.003, 0.0055]); };
  for (const s of [-1, 1]) {
    K.mesh(K.capsule(0.0075, 0.03, 2, 6), blue, [s * 0.03, 0.016, 0.042], body, [0.75, 0, s * 0.75]);           // foreleg
    pads(s * 0.042, 0.002, 0.056, s * 0.5);
    K.mesh(K.sphere(1, 9, 7), blue, [s * 0.034, 0.022, -0.035], body, [0, s * 0.35, 0], [0.016, 0.017, 0.034]);   // thigh
    K.mesh(K.capsule(0.008, 0.042, 2, 6), blue, [s * 0.05, 0.01, -0.02], body, [PI / 2 + 0.2, s * 0.5, 0]);       // shin, folded forward
    K.mesh(K.capsule(0.006, 0.03, 2, 5), blue, [s * 0.058, 0.003, 0.005], body, [PI / 2, s * -0.4, 0]);           // foot
    pads(s * 0.062, 0.002, 0.024, s * -0.2);
  }
  K.mesh(K.sphere(1, 8, 6), red, [0, bedY + 0.035, 0], far, null, [0.04, 0.032, 0.06]);
  near.scale.setScalar(1.25); far.scale.setScalar(1.25);
  K.place(root, home);

  let hop = 0;
  const c = perch(K.makeCreature({
    species: SPECIES['strawberry-poison-frog'], root, home, radius: 0.12, eye: new THREE.Vector3(0, (bedY + 0.05) * 1.25, 0.04),
    ground: K.groundY, speed: 0, roam: 0, fleeAt: 0, curiousAt: 10, shy: 0, rareChance: 0, yaw: opts.yaw,
    pose(c, dt, env) {
      // the throat pumps, the body breathes; now and then a little hop on the spot
      const pump = Math.max(0, Math.sin(env.t * 9 + c.bob)) * (Math.sin(env.t * 0.6 + c.bob) > 0.2 ? 1 : 0.2);
      throat.scale.set(0.024 * (1 + 0.5 * pump), 0.016 * (1 + 0.7 * pump), 0.022 * (1 + 0.4 * pump));
      trunk.scale.y = 1 + Math.sin(env.t * 3.1 + c.bob) * 0.04;
      if (hop <= 0 && Math.random() < dt * 0.05) hop = 0.4;
      if (hop > 0) {
        hop -= dt;
        const k = 1 - hop / 0.4;
        body.position.y = bedY + Math.sin(k * PI) * 0.04;
      } else body.position.y = bedY;
    },
  }));
  return K.lod(c, near, far, 16);
}

export const BUILDERS = {
  jaguar: buildJaguar,
  'rhinoceros-hornbill': buildRhinocerosHornbill,
  'strawberry-poison-frog': buildPoisonFrog,
};
