// The gelada troop (FEAT-008): five geladas on the shelf and the foot of the slope beside the road on
// the way down the wall, grazing on a patch of dry grass.
//
//   gelada   a big grass-eating monkey of the high cliffs. Long brown-tan fur; the male much bigger,
//            with a heavy cape-like mane over his shoulders and back; a dark face with a long
//            muzzle and close-set eyes; a bare, bright red hourglass-shaped patch on the chest (paler
//            on the females); a long tail with a dark tuft. They sit upright and shuffle forward on
//            their bottoms while they pluck grass with both hands. Two females groom each other, the
//            young one climbs on its mother's back and jumps off to play. As the van passes, the male
//            looks at it and yawns wide, showing his long canines. Rare pose: the lip flip, the upper
//            lip curled up over his nose showing pink gums and teeth, the red patch on his chest
//            flushing bright.
//
// After dark the troop sleeps huddled together on a narrow ledge of the cliff above the road. The
// twist: the chest patches glow faintly, barely there by day, clear at night.
//
// The behaviour is their own (not the shared state machine): they stay where they are, the van
// never sends them off, and they leave feed alone.
import * as THREE from 'three';

export const SPECIES = {
  gelada: { id: 'gelada', name: 'Gelada', points: 200, call: { hz: 300, kind: 'hoot' } },
};

const PI = Math.PI;
const vA = new THREE.Vector3();
const damp = (a, b, k, dt) => a + (b - a) * Math.min(1, k * dt);
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp = THREE.MathUtils.clamp;

// the bare patch on the chest: two triangles meeting at a narrow waist, the corners rounded
const HOURGLASS = [[-0.05, 0.1], [0, 0.104], [0.05, 0.1], [0.062, 0.088], [0.02, 0.012], [0.016, 0], [0.02, -0.012], [0.06, -0.086],
  [0.05, -0.098], [0, -0.102], [-0.05, -0.098], [-0.06, -0.086], [-0.02, -0.012], [-0.016, 0], [-0.02, 0.012], [-0.062, 0.088]];

// sizes: the male is the measure; the females a good deal smaller, the young one half his size
const SIZE = { male: 1, female: 0.8, young: 0.5 };

// =============================================================================================
// One gelada. opts:
//   role     'male' | 'female' | 'young'
//   act      by day: 'graze' (the male and the mother), 'groom' (grooming `partner`), 'groomed',
//            'young' (on `mother`'s back or playing round her)
//   yaw      its heading; sleep: true for the night ledge
//   keep     (x, z) => false where it must not shuffle to (the road)
export function buildGelada(K, home, opts = {}) {
  const role = opts.role || 'female', male = role === 'male', young = role === 'young';
  const s = SIZE[role];
  const night = K.night;
  const fur = K.mat(young ? 0x5a4632 : 0x8a6a48, { roughness: 0.95 });
  const furLight = K.mat(young ? 0x6e5840 : 0xb08d62, { roughness: 0.95 });
  const cape = K.mat(0xa2804f, { roughness: 0.95 });
  const skin = K.mat(0x3b2b25, { roughness: 0.7 }), nose = K.mat(0x1c1411, { roughness: 0.5 });
  const pink = K.mat(0xd36e7c, { roughness: 0.45 }), mouth = K.mat(0x5a1f24, { roughness: 0.6 });
  const tooth = K.sheen(0xf1e8cf, { roughness: 0.3 });
  // the patch: the male's is his own material, so only his flushes; the females' are paler
  const patchMat = male ? K.glow(0xc8242c, 0.55, { roughness: 0.5 }) : K.glow(0xc8686a, 0.4, { roughness: 0.55 });
  const PATCH = male ? { c: new THREE.Color(0xc8242c), hot: new THREE.Color(0xff2a3a) } : null;

  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  near.scale.setScalar(s); far.scale.setScalar(s);
  K.shadow(root, 0.3 * s, 0.34 * s);

  // ---- the seat: haunches and the folded legs, feet flat in front (all still, one bake)
  const seat = K.group(null, near);
  K.mesh(K.sphere(1, 12, 9), fur, [0, 0.1, -0.02], seat, null, [0.17, 0.11, 0.17]);
  for (const sd of [-1, 1]) {
    K.mesh(K.capsule(0.055, 0.16, 2, 7), fur, [sd * 0.095, 0.15, 0.1], seat, [1.21, 0, 0]);       // the thigh, knee up
    K.mesh(K.capsule(0.04, 0.12, 2, 6), fur, [sd * 0.098, 0.12, 0.225], seat, [2.84, 0, 0]);      // the shin, down to the foot
    K.mesh(K.sphere(1, 8, 6), skin, [sd * 0.092, 0.02, 0.28], seat, null, [0.036, 0.02, 0.07]);
  }
  // the tail: lying out behind on the ground, a dark tuft at the end
  const tail = K.group([0, 0.06, -0.16], seat);
  K.mesh(K.tube('gl-tail', [[0, 0, 0], [0, -0.04, -0.15], [0.03, -0.054, -0.32], [0.07, -0.055, -0.46]], 0.03, 0.016, 6, 10), fur, [0, 0, 0], tail);
  K.mesh(K.cone(1, 1, 7), skin, [0.08, -0.05, -0.5], tail, [-PI / 2, 0.2, 0], [0.026, 0.1, 0.022]);

  // a lock of long hair: hangs from its top at p, tilted out by `tilt` and turned to face `a` (0 is
  // the front); flat, so many of them overlap like a shaggy coat
  const lockGeo = K.geo('gl-lock', () => new THREE.SphereGeometry(1, 7, 5).translate(0, -1, 0));
  const lock = (parent, mat, p, a, tilt, len, w, dd = w * 0.45) => {
    const m = K.mesh(lockGeo, mat, p, parent, null, [w, len / 2, dd]);
    m.rotation.order = 'YXZ'; m.rotation.set(-tilt, a, 0);
    return m;
  };
  // a ring of locks round the body at height y (radii rx, rz), from angle a0 to a1 (0 is the front)
  const ring = (parent, y, rx, rz, a0, a1, n, len, w, tilt, mats) => {
    for (let i = 0; i < n; i++) {
      const a = a0 + (a1 - a0) * (n === 1 ? 0.5 : i / (n - 1)), j = ((i * 7) % 5) / 4;
      lock(parent, mats[i % mats.length], [Math.sin(a) * rx, y, Math.cos(a) * rz], a, tilt, len * (0.88 + j * 0.24), w);
    }
  };

  // ---- the body: upright from the hips with a rounded back, leans forward to graze or groom
  const body = K.group([0, 0.12, -0.02], seat);
  K.mesh(K.lathe('gl-torso', [[0.001, -0.02], [0.13, 0.0], [0.165, 0.08], [0.16, 0.2], [0.15, 0.3], [0.15, 0.38], [0.11, 0.45], [0.001, 0.48]], 14), fur, [0, 0, 0], body, null, [1, 1, 0.82]);
  K.mesh(K.sphere(1, 12, 9), fur, [0, 0.33, -0.03], body, null, [0.17, 0.14, 0.13]);              // the rounded back
  // the chest: pale fur round the patch, the patch itself kept apart (it glows and the male's flushes)
  K.mesh(K.sphere(1, 10, 8), furLight, [0, 0.27, 0.08], body, [-0.1, 0, 0], [0.1, 0.14, 0.05]);
  const patch = K.mesh(K.shape('gl-patch', HOURGLASS, 0.01), patchMat, [0, 0.275, 0.124], body, [-0.14, 0, 0], [1, 1, 1]);
  patch.userData.keep = true;
  // long shaggy fur down the back and the sides
  ring(body, 0.42, 0.13, 0.1, 0.9, 2 * PI - 0.9, 11, 0.22, 0.055, 0.22, [fur, furLight, fur]);
  ring(body, 0.26, 0.155, 0.12, 1.2, 2 * PI - 1.2, 9, 0.17, 0.05, 0.15, [fur, fur, furLight]);
  // the male's cape: a heavy mane of long, lighter hair over the shoulders, down the back and sides
  if (male) {
    K.mesh(K.sphere(1, 12, 9), cape, [0, 0.43, -0.03], body, null, [0.19, 0.1, 0.15]);
    ring(body, 0.5, 0.15, 0.12, 0.85, 2 * PI - 0.85, 17, 0.4, 0.07, 0.32, [cape, cape, furLight]);
    ring(body, 0.4, 0.175, 0.14, 1.1, 2 * PI - 1.1, 13, 0.3, 0.065, 0.22, [cape, furLight, cape]);
  }

  // ---- arms: shoulder → elbow → hand; the hands pluck grass, part fur, rest on the knees
  const arms = [-1, 1].map((sd) => {
    const sh = K.group([sd * 0.135, 0.36, 0.02], body);
    K.mesh(K.capsule(0.038, 0.14, 2, 7), male ? cape : fur, [0, -0.1, 0], sh);
    const el = K.group([0, -0.2, 0], sh);
    K.mesh(K.capsule(0.03, 0.13, 2, 6), fur, [0, -0.09, 0], el);
    K.mesh(K.sphere(1, 8, 6), skin, [0, -0.185, 0.01], el, null, [0.028, 0.04, 0.022]);
    return { sh, el, sd };
  });

  // ---- the head: a fur cap, a dark face with a long muzzle and close-set eyes, cheek fur
  const neck = K.group([0, 0.45, 0.02], body);
  const head = K.group([0, 0.06, 0.03], neck);
  const hs = young ? 1.25 : 1;                                 // the young one's head is big for its size
  head.scale.setScalar(hs);
  K.mesh(K.sphere(1, 12, 9), fur, [0, 0.035, -0.012], head, null, [0.072, 0.07, 0.07]);
  K.mesh(K.sphere(1, 12, 9), skin, [0, 0.012, 0.042], head, null, [0.052, 0.055, 0.036]);
  K.mesh(K.sphere(1, 10, 8), skin, [0, 0.043, 0.066], head, null, [0.043, 0.011, 0.018]);          // the brow ridge
  K.mesh(K.sphere(1, 12, 9), skin, [0, -0.018, 0.098], head, null, [0.033, 0.03, 0.062]);          // the muzzle
  K.mesh(K.sphere(1, 10, 8), skin, [0, 0.0, 0.112], head, null, [0.024, 0.02, 0.05]);              // the bridge of the nose
  K.mesh(K.sphere(1, 8, 6), nose, [0, -0.002, 0.156], head, null, [0.022, 0.016, 0.012]);
  for (const sd of [-1, 1]) K.mesh(K.sphere(1, 6, 5), mouth, [sd * 0.008, -0.004, 0.166], head, null, [0.005, 0.004, 0.003]);
  // cheek fur swept back, and (the male) the mane framing the face and falling onto the shoulders
  for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) lock(head, furLight, [sd * 0.05, 0.02 - i * 0.022, 0.03], sd * (PI / 2 + 0.5), 0.9 + i * 0.2, 0.08, 0.022);
  if (male) {
    K.mesh(K.sphere(1, 12, 9), cape, [0, 0.015, -0.05], head, null, [0.095, 0.1, 0.06]);
    ring(head, 0.05, 0.07, 0.055, PI / 2 + 0.2, 3 * PI / 2 - 0.2, 9, 0.2, 0.045, 0.45, [cape, furLight]);
  }
  const eyes = [-1, 1].map((sd) => K.eye(head, { pos: [sd * 0.021, 0.03, 0.079], r: 0.011, iris: 0x7a4a24, dir: [sd * 0.25, 0, 1] }));
  // the teeth and the gums, hidden under the upper lip and behind the lower jaw until the mouth opens
  K.mesh(K.box(0.034, 0.011, 0.01), tooth, [0, -0.047, 0.142], head);
  K.mesh(K.sphere(1, 8, 6), pink, [0, -0.04, 0.118], head, null, [0.04, 0.012, 0.04]);
  for (const sd of [-1, 1]) K.mesh(K.cone(male ? 0.0065 : 0.0045, male ? 0.036 : 0.018, 6), tooth, [sd * 0.021, male ? -0.066 : -0.056, 0.118], head, [PI, 0, 0]);
  K.mesh(K.sphere(1, 8, 6), mouth, [0, -0.052, 0.09], head, null, [0.03, 0.022, 0.05]);
  // the upper lip, hinged at the nose: up over the nose for the lip flip (its pink inside then faces out)
  const lip = K.group([0, -0.035, 0.088], head);
  K.mesh(K.sphere(1, 10, 8), skin, [0, -0.004, 0.044], lip, null, [0.038, 0.017, 0.058]);
  K.mesh(K.sphere(1, 10, 8), pink, [0, -0.011, 0.044], lip, null, [0.031, 0.008, 0.05]);
  // the lower jaw, hinged at the back: drops for the yawn
  const jaw = K.group([0, -0.045, 0.03], head);
  K.mesh(K.sphere(1, 10, 8), skin, [0, -0.03, 0.068], jaw, null, [0.035, 0.02, 0.062]);
  K.mesh(K.sphere(1, 8, 6), pink, [0, -0.015, 0.07], jaw, null, [0.024, 0.008, 0.045]);
  // the inside of the mouth and the cheeks, so the open jaw stays joined to the face
  K.mesh(K.sphere(1, 8, 6), mouth, [0, 0.0, 0.055], jaw, null, [0.026, 0.035, 0.045]);
  for (const sd of [-1, 1]) K.mesh(K.sphere(1, 8, 6), skin, [sd * 0.029, 0.004, 0.05], jaw, null, [0.011, 0.04, 0.045]);
  for (const sd of [-1, 1]) K.mesh(K.cone(0.004, 0.014, 5), tooth, [sd * 0.017, -0.006, 0.11], jaw);

  // ---- far: body, head, the patch (it still shows at night from far off), the male's cape
  K.mesh(K.sphere(1, 8, 6), fur, [0, 0.3, 0], far, null, [0.17, 0.27, 0.15]);
  K.mesh(K.sphere(1, 8, 6), skin, [0, 0.6, 0.06], far, null, [0.07, 0.075, 0.08]);
  K.mesh(K.sphere(1, 6, 5), patchMat, [0, 0.4, 0.12], far, null, [0.055, 0.09, 0.03]);
  if (male) K.mesh(K.cone(0.24, 0.42, 7), cape, [0, 0.42, -0.04], far);
  else K.mesh(K.cone(0.05, 0.4, 5), fur, [0, 0.04, -0.3], far, [PI / 2 + 0.1, 0, 0]);

  K.place(root, home);
  const patches = [];
  root.traverse((o) => { if (o.isMesh && o.material === patchMat) patches.push(o); });

  const c = K.makeCreature({
    species: SPECIES.gelada, root, home, radius: 0.42 * s, eye: new THREE.Vector3(0, 0.56 * s, 0.07 * s),
    ground: K.groundY, speed: 0.1, roam: 0, fleeAt: 0, curiousAt: 0, shy: 1, rareChance: 0, yaw: opts.yaw,
  });
  c.state = 'idle'; c.hold = 99;
  const act = night || opts.sleep ? 'sleep' : opts.act || 'graze';
  // a pose: the lean of the body, the bow of the neck, the mouth and the arms; blended to each frame
  const P = { lean: 0.2, bow: 0.1, jaw: 0, lip: 0, seat: 0, arms: [[-0.3, 0, -0.5], [-0.3, 0, -0.5]], flush: 0 };
  const S = {
    pluck: Math.random() * 3, hand: Math.random() < 0.5 ? 0 : 1, shuffle: 2 + Math.random() * 5, hop: 0, from: null, to: null,
    yawned: false, yawn: -1, flip: 0, call: 3 + Math.random() * 6, play: 'ride', playT: 3 + Math.random() * 3, jump: 0, jumpFrom: null,
    breath: Math.random() * 6, minD: Infinity, turn: 0,
  };
  const keep = opts.keep || (() => true);

  c.step = (dt, env) => {
    c.t += dt;
    const d = env.dist, rp = c.root.position, t = env.t;
    S.minD = Math.min(S.minD, d);
    const W = { lean: 0.15, bow: 0.15, jaw: 0, lip: 0, seat: 0, arms: [[-0.3, 0, -0.5], [-0.3, 0, -0.5]], flush: 0 };
    let watch = false, eyesShut = false, chew = 0;

    if (act === 'sleep') {
      // huddled: leaning forward, the head sunk on the chest, the arms folded in, slow breathing
      const br = Math.sin(t * 1.1 + S.breath);
      W.lean = 0.42 + br * 0.02; W.bow = 0.75; eyesShut = true;
      W.arms = [[-0.5, 0, -1.5], [-0.5, 0, -1.5]];
      c.air = true;
    } else if (act === 'young') {
      youngStep(dt, env, W);
    } else {
      c.air = act !== 'graze';
      // the male: watches the van as it comes, yawns wide as it passes, the lip flip when posing
      if (male) {
        watch = d < 34;
        if (c.state === 'rare') {
          // the lip flip, three times over: up over the nose, held, down; the patch flushes red
          const k = c.t % 1.9, up = ease(k / 0.25) * ease((1.6 - k) / 0.3);
          W.lip = -1.05 * up; W.jaw = 0.12 * up; W.flush = Math.min(1, c.t / 0.6) * (c.t > c.hold - 0.6 ? (c.hold - c.t) / 0.6 : 1);
          W.lean = 0.02; W.bow = -0.15;
          S.flip = 1;
          if (c.t > c.hold) { c.go('idle', 99); }
        } else if (S.yawn >= 0) {
          S.yawn += dt;
          const k = ease(S.yawn / 0.55) * ease((2.3 - S.yawn) / 0.6);
          W.jaw = 0.7 * k; W.lip = -0.35 * k; W.bow = -0.2 * k; W.lean = 0.08; eyesShut = k > 0.6;
          if (S.yawn > 2.3) S.yawn = -1;
        } else if (!S.yawned && d < 15 && c.t > 0.5) {
          S.yawned = true; S.yawn = 0;
          if (env.call) env.call(c, 'rare');
        }
      }
      const busy = c.state === 'rare' || S.yawn >= 0;
      if (act === 'graze' && !busy) {
        // plucking: one hand down to the grass in front, then up to the mouth, chewing; the head down
        S.pluck += dt;
        const cyc = 2.6, ph = (S.pluck % cyc) / cyc;
        if (S.pluck >= cyc) { S.pluck -= cyc; S.hand = 1 - S.hand; }
        const reach = ph < 0.35 ? ease(ph / 0.3) : ph < 0.5 ? 1 : 0, toMouth = ph >= 0.5 && ph < 0.78 ? ease((ph - 0.5) / 0.15) : 0;
        const A = W.arms[S.hand];
        A[0] = -0.3 - 0.55 * reach - 0.95 * toMouth; A[1] = -0.3 * toMouth; A[2] = -0.4 + 0.4 * reach - 1.75 * toMouth;
        W.arms[1 - S.hand] = [-0.55, 0, -0.75];                                  // the other hand on the ground by the knee
        W.lean = 0.32 + 0.12 * reach - 0.12 * toMouth; W.bow = 0.45 * (1 - toMouth) + 0.05;
        chew = ph > 0.7 ? 1 : 0;
        // now and then a shuffle forward on the bottom, to fresh grass
        S.shuffle -= dt;
        if (S.shuffle <= 0 && S.hop <= 0) {
          const f = c.forward(vA).clone();
          const to = rp.clone().addScaledVector(f, 0.14 * s);
          // stays near home and off the road: else it turns a little first
          if (to.distanceTo(c.home) < 0.9 * s + 0.3 && keep(to.x, to.z)) { S.from = rp.clone(); S.to = to; S.hop = 0.001; }
          else S.turn = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.5) * (to.distanceTo(c.home) > 1 ? 2 : 1);
          S.shuffle = 3 + Math.random() * 5;
        }
      } else if (act === 'groom') {
        // parting the partner's fur with both hands in turns, now and then a pick to the mouth
        const a = Math.sin(t * 3.2), pick = Math.sin(t * 0.5 + S.breath) > 0.85 ? 1 : 0;
        W.lean = 0.38; W.bow = 0.55;
        W.arms = [[-1.25 + a * 0.16, 0.12, -0.75 - a * 0.25], [-1.25 - a * 0.16 - pick * 0.3, -0.12 - pick * 0.2, -0.75 + a * 0.25 - pick * 0.9]];
        chew = pick;
        if (opts.partner) c.turnTo(opts.partner.root.position.x, opts.partner.root.position.z, dt, 1);
      } else if (act === 'groomed') {
        // being groomed: relaxed, the head bowed, the eyes half shut, the hands on the knees
        W.lean = 0.3; W.bow = 0.5 + Math.sin(t * 0.4 + S.breath) * 0.08;
        W.arms = [[-0.65, 0.05, -0.55], [-0.65, -0.05, -0.55]];
        eyesShut = Math.sin(t * 0.7 + S.breath) > 0.2;
      }
      // the van close: the others look up at it for a moment
      if (!male && d < 22 && act !== 'groomed') watch = Math.sin(t * 0.6 + S.breath) > 0.3;
    }

    // the shuffle: a little hop forward on the bottom
    if (S.hop > 0) {
      S.hop += dt / 0.5;
      const k = Math.min(1, S.hop);
      rp.lerpVectors(S.from, S.to, ease(k));
      W.seat = Math.sin(k * PI) * 0.035;
      if (k >= 1) S.hop = 0;
    }
    if (S.turn) { const st = clamp(S.turn, -dt * 0.8, dt * 0.8); c.root.rotation.y += st; S.turn -= st; if (Math.abs(S.turn) < 1e-3) S.turn = 0; }
    if (act !== 'young' || S.play !== 'ride') rp.y = K.groundY(rp.x, rp.z);

    // ---- blend to the pose
    const k = act === 'sleep' ? 2 : 6;
    P.lean = damp(P.lean, W.lean, k, dt); P.bow = damp(P.bow, W.bow, k, dt);
    P.jaw = damp(P.jaw, W.jaw + chew * Math.max(0, Math.sin(t * 14)) * 0.12, 12, dt); P.lip = damp(P.lip, W.lip, 9, dt);
    P.seat = W.seat; P.flush = damp(P.flush, W.flush, 4, dt);
    seat.position.y = P.seat;
    body.rotation.x = P.lean;
    body.scale.y = 1 + Math.sin(t * (act === 'sleep' ? 1.1 : 1.6) + S.breath) * 0.012;
    neck.rotation.x = P.bow;
    jaw.rotation.x = P.jaw; lip.rotation.x = P.lip;
    arms.forEach((A, i) => {
      const w = W.arms[A.sd > 0 ? 1 : 0];
      A.sh.rotation.x = damp(A.sh.rotation.x, w[0], 8, dt);
      A.sh.rotation.z = damp(A.sh.rotation.z, w[1] * A.sd * -1 + A.sd * 0.08, 8, dt);
      A.el.rotation.x = damp(A.el.rotation.x, w[2], 8, dt);
    });
    tail.rotation.y = Math.sin(t * 0.3 + S.breath) * 0.12;
    // the head: watches the van (the male from far off), otherwise looks about now and then
    K.look(c, head, env, dt, { yaw: 1.1, pitch: 0.5, rate: 2.5, force: watch, glance: act !== 'sleep' && act !== 'groomed' });
    if (act === 'sleep') { head.rotation.x = damp(head.rotation.x, 0, 2, dt); head.rotation.y = damp(head.rotation.y, 0.2, 2, dt); }
    if (eyesShut) eyes.forEach((e) => { e.scale.y = 0.12; }); else K.blink(c, eyes, dt);
    // the male's patch flushes bright red during the lip flip (the copy planPoses made, too)
    if (PATCH) {
      patchMat.emissiveIntensity = K.glowLevel * 0.55 * (1 + 2.2 * P.flush);
      for (const m of patches) { m.material.color.copy(PATCH.c).lerp(PATCH.hot, P.flush); m.material.emissive.copy(m.material.color); }
    }
    // a contact grunt now and then while the van is near
    S.call -= dt;
    if (S.call <= 0) { if (env.call && act !== 'sleep' && d < 40) env.call(c, 'idle'); S.call = 6 + Math.random() * 8; }
    c.root.updateMatrixWorld();
  };

  // ---- the young one: rides on its mother's back, jumps down and plays round her, climbs back up
  const mother = opts.mother;
  const back = new THREE.Vector3();
  function onBack(out) {
    // a point on the mother's back, between the shoulders
    const mb = mother._body;
    mb.updateWorldMatrix(true, false);
    return out.set(0, 0.2, -0.16).applyMatrix4(mb.matrixWorld);
  }
  function youngStep(dt, env, W) {
    const rp = c.root.position;
    S.playT -= dt;
    if (!mother) { S.play = 'play'; }
    if (S.play === 'ride') {
      // lying along her back, clinging, looking about
      onBack(back);
      rp.copy(back);
      c.root.rotation.y = damp(c.root.rotation.y, mother.root.rotation.y, 8, dt);
      W.lean = 0.45; W.bow = -0.2; W.arms = [[-1.2, 0.3, -0.9], [-1.2, -0.3, -0.9]];
      c.air = true;
      if (S.playT <= 0) { S.play = 'jump'; S.jump = 0; S.jumpFrom = rp.clone(); S.jumpTo = spotNear(); }
    } else if (S.play === 'jump' || S.play === 'climb') {
      // an arc down off her back, or up onto it
      S.jump += dt / 0.6;
      const k = Math.min(1, S.jump), to = S.play === 'climb' ? onBack(back) : S.jumpTo;
      rp.lerpVectors(S.jumpFrom, to, ease(k));
      rp.y += Math.sin(k * PI) * 0.25;
      c.turnTo(to.x, to.z, dt, 6);
      W.lean = 0.6; W.bow = -0.3; W.arms = [[-1.5, 0, -0.3], [-1.5, 0, -0.3]];
      c.air = true;
      if (k >= 1) {
        if (S.play === 'climb') { S.play = 'ride'; S.playT = 5 + Math.random() * 4; }
        else { S.play = 'play'; S.playT = 6 + Math.random() * 4; S.hopT = 0; S.hopTo = null; }
      }
    } else {
      // play: quick bouncing hops round the mother, a spin now and then, sitting up between hops
      c.air = false;
      S.hopT -= dt;
      if (S.hopT <= 0 && S.hop <= 0) {
        const to = spotNear();
        if (keep(to.x, to.z)) { S.from = rp.clone(); S.to = to; S.hop = 0.001; }
        S.hopT = 0.7 + Math.random() * 0.9;
      }
      if (S.hop > 0 && S.to) c.turnTo(S.to.x, S.to.z, dt, 7);
      if (S.hop > 0) {
        S.hop += dt / 0.35;
        const k = Math.min(1, S.hop);
        rp.lerpVectors(S.from, S.to, k);
        W.seat = Math.sin(k * PI) * 0.12; W.lean = 0.7; W.arms = [[-1.1, 0.3, -0.2], [-1.1, -0.3, -0.2]];
        if (k >= 1) S.hop = 0;
      } else {
        W.lean = 0.1; W.bow = 0; W.arms = [[-0.6 + Math.sin(env.t * 5) * 0.4, 0.2, -0.9], [-0.6 - Math.sin(env.t * 5) * 0.4, -0.2, -0.9]];
      }
      if (S.playT <= 0 && S.hop <= 0 && mother) { S.play = 'climb'; S.jump = 0; S.jumpFrom = rp.clone(); }
    }
  }
  // a spot to hop to: round the mother, 0.4 to 0.9 m from her
  function spotNear() {
    const m = mother ? mother.root.position : c.home;
    const a = Math.random() * PI * 2, r = 0.4 + Math.random() * 0.5;
    const p = new THREE.Vector3(m.x + Math.cos(a) * r, 0, m.z + Math.sin(a) * r);
    if (!keep(p.x, p.z)) p.set(m.x - Math.cos(a) * r, 0, m.z - Math.sin(a) * r);
    p.y = K.groundY(p.x, p.z);
    return p;
  }

  c._body = body;
  // start in the right shape
  if (act === 'sleep') { P.lean = 0.42; P.bow = 0.75; arms.forEach((A) => { A.sh.rotation.x = -0.5; A.el.rotation.x = -1.5; }); }
  return K.lod(c, near, far, 30);
}

export const BUILDERS = {
  gelada: buildGelada,
};
