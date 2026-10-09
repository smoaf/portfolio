// The deep pool: the creatures the van meets when it dives into the canyon's flooded shaft as a
// submersible. Swimmers hang in the tinted water between the floor and the surface; the bottom
// dwellers crawl the silt. Almost all of them carry light of their own (the research-station twist),
// faint by day and strong at dusk and night.
//
// Soft bodies (arms, tentacles, tails, fronds) are skinned: one mesh per material bends over a
// small skeleton, so an octopus with eight curling arms or a swarm of five jellies stays a handful of
// draw calls. The skeleton's bones are the moving parts (the kit's "groups"); the meshes never move
// on their own.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const SPECIES = {
  'coconut-octopus-glowing': { id: 'coconut-octopus-glowing', name: 'Glowing coconut octopus', points: 190, call: { hz: 320, kind: 'noise' } },
  nautilus: { id: 'nautilus', name: 'Chambered nautilus', points: 170, call: { hz: 260, kind: 'hoot' } },
  'leafy-seadragon': { id: 'leafy-seadragon', name: 'Leafy seadragon', points: 210, call: { hz: 1300, kind: 'trill' } },
  jellyfish: { id: 'jellyfish', name: 'Lantern jellyfish', points: 140, call: { hz: 520, kind: 'hoot' } },
  'goblin-shark': { id: 'goblin-shark', name: 'Goblin shark', points: 420, call: { hz: 110, kind: 'noise' } },
  'giant-isopod': { id: 'giant-isopod', name: 'Giant isopod', points: 150, call: { hz: 780, kind: 'chirp' } },
  'sea-slug-nudibranch': { id: 'sea-slug-nudibranch', name: 'Nudibranch', points: 160, call: { hz: 1600, kind: 'chirp' } },
  'feather-duster-worm': { id: 'feather-duster-worm', name: 'Feather duster worms', points: 120, call: { hz: 2100, kind: 'trill' } },
  'sea-pen': { id: 'sea-pen', name: 'Sea pens', points: 130, call: { hz: 1800, kind: 'trill' } },
  'deep-sea-cucumber': { id: 'deep-sea-cucumber', name: 'Swimming sea cucumber', points: 200, call: { hz: 420, kind: 'hoot' } },
};

const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const ease = (cur, to, k) => cur + (to - cur) * Math.min(1, k);
const _m4 = new THREE.Matrix4(), _n3 = new THREE.Matrix3(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(),
  _s = new THREE.Vector3(), _e = new THREE.Euler(), _w = new THREE.Vector3();
let uid = 0;

// ---------------------------------------------------------------------------------------------
// geometry helpers

// a copy of g, moved / turned / scaled, with only position and normal kept (so pieces merge)
function xf(g, p, r, s = 1, order = 'XYZ') {
  p = p || [0, 0, 0]; r = r || [0, 0, 0];
  const o = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(o.attributes)) if (k !== 'position' && k !== 'normal') o.deleteAttribute(k);
  if (!o.attributes.normal) o.computeVertexNormals();
  _m4.compose(_v.set(p[0], p[1], p[2]), _q.setFromEuler(_e.set(r[0], r[1], r[2], order)),
    typeof s === 'number' ? _s.setScalar(s) : _s.set(s[0], s[1], s[2]));
  o.applyMatrix4(_m4);
  return o;
}
// many placed pieces as one geometry: [[geo, pos, rot, scale], ...]
const merge = (items) => mergeGeometries(items.map((it) => xf(...it)), false);

// a tube along +z from 0 to len; radius from prof(t), an elliptic section (sx, sy), lifted by dy
function tubeGeo(len, segs, radial, prof, sx = 1, sy = 1, dy = 0) {
  const pos = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, r = prof(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * TAU;
      pos.push(Math.cos(a) * r * sx, Math.sin(a) * r * sy + dy, t * len);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// a flat comb: a blade along +y with teeth on both sides (feather-duster radioles, frills)
function combPts(len, w, teeth, tooth) {
  const R = [], L = [];
  for (let k = 0; k < teeth; k++) {
    const y0 = (k / teeth) * len, y1 = ((k + 0.6) / teeth) * len, f = 1 - (k / teeth) * 0.6;
    R.push([w * f, y0], [w * f + tooth * f, y1]);
    L.unshift([-w * f, y0], [-w * f - tooth * f, y1]);
  }
  return [...R, [0, len], ...L];
}

// ---------------------------------------------------------------------------------------------
// The rig: bones plus skinned meshes, one per material. Geometry is cached per species key, the
// bones are new for every animal (they are what its pose moves).
class Rig {
  constructor(K, key) { this.K = K; this.key = key; this.bones = []; this.parts = []; }
  bone(parent = -1, p = [0, 0, 0], r = [0, 0, 0], order = 'XYZ') {
    const b = new THREE.Bone();
    b.position.set(p[0], p[1], p[2]);
    b.rotation.order = order; b.rotation.set(r[0], r[1], r[2]);
    if (parent >= 0) this.bones[parent].add(b);
    b.userData.r0 = b.rotation.clone(); b.userData.p0 = b.position.clone();
    this.bones.push(b);
    return this.bones.length - 1;
  }
  // geometry in the bone's own space; `weigh(v)` -> [boneA, boneB, wB] bends it over two bones
  add(mat, b, make, weigh = null) { this.parts.push({ mat, b, make, weigh }); return this; }
  // weights along a straight chain of bones (each len/n apart along +z)
  along(ids, len) {
    const n = ids.length, s = len / n;
    return (v) => { const f = v.z / s, j = clamp(Math.floor(f), 0, n - 1); return [ids[j], ids[Math.min(n - 1, j + 1)], clamp(f - j, 0, 1)]; };
  }
  // a chain of n bones along +z (from p, turned by r) with a tapered tube skinned over it
  chain(mat, parent, p, r, { len = 1, n = 4, r0 = 0.1, r1 = 0.02, prof = null, sx = 1, sy = 1, radial = 6, segs = n * 3, order = 'YXZ' } = {}) {
    const ids = [];
    let at = parent;
    for (let j = 0; j < n; j++) { at = this.bone(at, j ? [0, 0, len / n] : p, j ? [0, 0, 0] : r, order); ids.push(at); }
    ids.w = this.along(ids, len);
    ids.len = len;
    if (mat) this.add(mat, ids[0], () => tubeGeo(len, segs, radial, prof || ((t) => r0 + (r1 - r0) * t), sx, sy), ids.w);
    return ids;
  }
  build(parent) {
    const K = this.K, holder = K.group(null, parent), bind = [];
    this.bones.forEach((b, i) => {
      const pi = this.bones.indexOf(b.parent);
      b.updateMatrix();
      bind[i] = (pi >= 0 ? bind[pi].clone() : new THREE.Matrix4()).multiply(b.matrix);
      if (pi < 0) holder.add(b);
    });
    const skel = new THREE.Skeleton(this.bones, bind.map((m) => m.clone().invert()));
    const mats = [];
    for (const p of this.parts) if (!mats.includes(p.mat)) mats.push(p.mat);
    mats.forEach((mat, mi) => {
      const geo = K.geo(`rig:${this.key}:${mi}`, () => {
        const P = [], N = [], SI = [], SW = [];
        for (const pt of this.parts) {
          if (pt.mat !== mat) continue;
          const g0 = typeof pt.make === 'function' ? pt.make() : pt.make;
          const g = g0.index ? g0.toNonIndexed() : g0.clone();
          if (!g.attributes.normal) g.computeVertexNormals();
          const pos = g.attributes.position, nor = g.attributes.normal, M = bind[pt.b];
          _n3.getNormalMatrix(M);
          for (let i = 0; i < pos.count; i++) {
            _v.fromBufferAttribute(pos, i);
            const w = pt.weigh ? pt.weigh(_v) : null;
            if (w) { SI.push(w[0], w[1], 0, 0); SW.push(1 - w[2], w[2], 0, 0); } else { SI.push(pt.b, 0, 0, 0); SW.push(1, 0, 0, 0); }
            _v.applyMatrix4(M); P.push(_v.x, _v.y, _v.z);
            _w.fromBufferAttribute(nor, i).applyMatrix3(_n3).normalize(); N.push(_w.x, _w.y, _w.z);
          }
          g.dispose();
        }
        const out = new THREE.BufferGeometry();
        out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
        out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
        out.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
        out.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
        return out;
      });
      const sm = new THREE.SkinnedMesh(geo, mat);
      sm.bind(skel, new THREE.Matrix4());
      sm.userData.keep = true;
      sm.frustumCulled = false;
      holder.add(sm);
    });
    this.holder = holder;
    return this.bones;
  }
}

// a per-animal glowing material, so one animal can flare without lighting up its neighbours
function flash(K, color, k = 1, o = {}) {
  const m = K.glow(color, k, { name: 'deep' + ++uid, ...o });
  m.userData.base = m.emissiveIntensity;
  return m;
}
function flashFin(K, color, opacity, k) {
  const m = K.fin(color, opacity, k, { name: 'deep' + ++uid });
  m.userData.base = m.emissiveIntensity;
  return m;
}
const lit = (m, extra) => { m.emissiveIntensity = m.userData.base + extra; };

// K.eye's look (wet ball, iris, pupil, catchlight) built into a rig: both eyes share four skinned
// meshes instead of four meshes each. The bone is what blinks (K.blink scales it).
function rigEye(K, R, parent, { pos = [0, 0, 0], r = 0.05, iris = 0x7a5a2a, dir = [0, 0, 1], glow = 0, white = false } = {}) {
  _m4.lookAt(_v.set(dir[0], dir[1], dir[2]), _w.set(0, 0, 0), _s.set(0, 1, 0));
  _e.setFromRotationMatrix(_m4);
  const id = R.bone(parent, pos, [_e.x, _e.y, _e.z]);
  R.add(K.sheen(white ? 0xe9e4da : 0x0c0a09, { roughness: 0.12 }), id, () => xf(K.sphere(1, 14, 10), null, null, r));
  R.add(glow ? K.glow(iris, glow, { roughness: 0.15 }) : K.sheen(iris, { roughness: 0.15 }), id, () => xf(K.sphere(1, 12, 8), [0, 0, r * 0.52], null, [r * 0.72, r * 0.72, r * 0.5]));
  R.add(K.sheen(0x040404, { roughness: 0.1 }), id, () => xf(K.sphere(1, 10, 8), [0, 0, r * 0.82], null, [r * 0.4, r * 0.4, r * 0.22]));
  R.add(K.mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9 }), id, () => xf(K.sphere(1, 6, 5), [-r * 0.32, r * 0.34, r * 0.9], null, r * 0.16));
  return id;
}

// put a bone back towards its rest turn plus an offset (x, y, z), smoothly
function turn(b, x, y, z, k) {
  const r = b.userData.r0;
  b.rotation.x = ease(b.rotation.x, r.x + x, k);
  b.rotation.y = ease(b.rotation.y, r.y + y, k);
  b.rotation.z = ease(b.rotation.z, r.z + z, k);
}

// Swimmers keep their own depth: a slow bob around the depth they were placed at, down or up to a
// feed pellet, a little dive when fleeing; never above the surface, never into the floor.
// Returns the vertical speed (for pitching the body).
function swimDepth(K, c, dt, env, { clear = 0.8, top = 0.6, amp = 0.35, f = 0.4, rate = 1.2 } = {}) {
  const p = c.root.position;
  if (c.cruise === undefined) c.cruise = c.home.y;
  let ty = c.cruise + Math.sin(env.t * f + c.bob) * amp, k = rate;
  if (c.state === 'eat' && c.pellet && !c.pellet.eaten) { ty = c.pellet.pos.y; k = 2.5; }
  else if (c.state === 'flee') ty = c.cruise - 1.2;
  const lo = K.groundY(p.x, p.z) + clear, hi = K.waterY ? K.waterY(p.x, p.z) - top : Infinity;
  ty = clamp(ty, lo, Math.max(lo, hi));
  const y0 = p.y;
  p.y = clamp(p.y + (ty - p.y) * Math.min(1, dt * k), lo, Math.max(lo, hi));
  return dt > 0 ? (p.y - y0) / dt : 0;
}

// clusters (worms, sea pens) never walk or turn: they stay put and react where they stand. Feed that
// sinks close enough counts as eaten.
function anchor(c, reach = 2.5) {
  const step = c.step;
  c.step = (dt, env) => {
    const ry = c.root.rotation.y, x = c.root.position.x, z = c.root.position.z;
    if (c.state === 'eat' && c.pellet && !c.pellet.eaten && c.t > 1.2) {
      _v.copy(c.pellet.pos).sub(c.root.position).setY(0);
      if (_v.length() < reach) {
        c.pellet.eaten = true; c.pellet.eatenAt = env.t;
        if (env.call) env.call(c, 'eat');
        c.go(Math.random() < c.rareChance ? 'rare' : 'idle', 4.5);
      }
    }
    step(dt, env);
    c.root.rotation.y = ry; c.root.position.x = x; c.root.position.z = z;
    c.root.updateMatrixWorld();
  };
  return c;
}

const moving = (c) => c.state === 'wander' || c.state === 'flee' || c.state === 'eat' || (c.state === 'curious' && c.near > c.fleeAt * 1.6);

// ---------------------------------------------------------------------------------------------
// Coconut octopus: a dark-red mantle, big eyes on top, eight curling arms with a rim of glowing
// suckers. It keeps a half coconut shell beside it; the rare show is hoisting the shell over itself
// like a shield and flaring every light it has.
export function buildCoconutOctopus(K, home, opts = {}) {
  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  const skin = K.sheen(0x7a2226, { roughness: 0.5 }), dark = K.sheen(0x541619, { roughness: 0.5 });
  const web = K.mat(0xd8782c, { roughness: 0.6, side: THREE.DoubleSide });
  const dots = flash(K, 0x2aa8ff, 0.45), stripes = flash(K, 0x40d0ff, 0.2);
  const husk = K.mat(0x6b4426, { roughness: 0.95, side: THREE.DoubleSide }), flesh = K.mat(0xe9dfc6, { roughness: 0.8, side: THREE.BackSide });

  const R = new Rig(K, 'octo');
  const bodyB = R.bone(-1, [0, 0, 0]);
  // the mantle rises up and back behind the head, like the reference; glowing rings for the show
  const mant = R.bone(bodyB, [0, 0.28, -0.1], [-0.9, 0, 0]);
  R.add(skin, mant, () => merge([[K.sphere(1, 12, 9), [0, 0.13, 0], null, [0.26, 0.33, 0.26]], [K.sphere(1, 8, 6), [0, 0.3, -0.03], null, [0.17, 0.12, 0.17]]]));
  R.add(stripes, mant, () => merge([0, 1, 2].map((i) => [K.torus(1, 0.03, 3, 18), [0, 0.04 + i * 0.12, 0], [Math.PI / 2, 0, 0], [0.265 - i * 0.02, 0.265 - i * 0.02, 0.3]])));
  const head = R.bone(bodyB, [0, 0.3, 0.13]);
  R.add(skin, head, () => merge([
    [K.sphere(1, 12, 9), null, null, [0.2, 0.15, 0.17]],
    [K.cone(0.035, 0.12, 6), [0.16, -0.06, -0.02], [0, 0, -1.2], 1],                      // the siphon
    ...[-1, 1].map((s) => [K.sphere(1, 8, 6), [s * 0.1, 0.09, 0.03], null, 0.07]),           // the eye turrets
  ]));
  const eyes = [-1, 1].map((s) => rigEye(K, R, head, { pos: [s * 0.115, 0.125, 0.05], r: 0.055, iris: 0xd9b24a, dir: [s, 0.7, 0.5], glow: 0.6 }));
  R.add(web, bodyB, () => xf(K.lathe('octoweb', [[0.1, 0.2], [0.25, 0.13], [0.45, 0.05]], 12), [0, 0, 0.12]));
  // eight broad arms with rows of glowing suckers along both edges
  const arms = [];
  const N = 5, LEN = 0.95, r0 = 0.1, r1 = 0.016;
  for (let i = 0; i < 8; i++) {
    const yaw = (i / 8) * TAU + Math.PI / 8;
    const ids = R.chain(dark, bodyB, [Math.sin(yaw) * 0.1, 0.2, 0.12 + Math.cos(yaw) * 0.1], [0.5, yaw, 0],
      { len: LEN, n: N, r0, r1, sx: 1.35, sy: 0.7, radial: 6, segs: 15 });
    R.add(dots, ids[0], () => {
      const it = [];
      for (let k = 0; k < 6; k++) {
        const t = 0.14 + k * 0.145, r = (r0 + (r1 - r0) * t) * 1.35 + 0.006;
        for (const s of [-1, 1]) it.push([K.sphere(1, 4, 3), [s * r, 0.01, t * LEN], null, 0.026 - t * 0.012]);
      }
      return merge(it);
    }, ids.w);
    arms.push(ids);
  }
  const bones = R.build(near);
  const rest = [];
  arms.forEach((ids, i) => {                                   // rest curl: flat on the silt, tips rolled up
    const up = i === 0 || i === 7 ? -0.35 : 0, roll = 0.35 + (i % 3) * 0.2;
    [0, -0.35 + up, -0.2, -roll, -roll * 1.4].forEach((x, j) => { if (j) bones[ids[j]].userData.r0.x = x; });
  });
  const hd = bones[head], mt = bones[mant], bd = bones[bodyB];

  // the half coconut, lying open beside it
  const shell = K.group([0.62, 0.28, -0.42], root, [Math.PI, 0, 0]);
  K.mesh(K.geo('coco', () => new THREE.SphereGeometry(0.34, 12, 6, 0, TAU, 0, Math.PI / 2)), husk, [0, 0, 0], shell);
  K.mesh(K.geo('cocoIn', () => new THREE.SphereGeometry(0.325, 12, 6, 0, TAU, 0, Math.PI / 2)), flesh, [0, 0, 0], shell);
  K.mesh(K.torus(0.335, 0.016, 3, 18), husk, [0, 0.002, 0], shell, [Math.PI / 2, 0, 0]);
  K.shadow(root, 0.95, 0.95);

  // far: mantle, head, the spread of arms, the glowing rim
  K.mesh(K.sphere(0.27, 8, 6), skin, [0, 0.42, -0.12], far, [-0.55, 0, 0], [1, 1.25, 1]);
  K.mesh(K.sphere(0.18, 8, 6), skin, [0, 0.3, 0.13], far);
  K.mesh(K.cyl(0.9, 0.5, 0.12, 10), dark, [0, 0.08, 0.1], far);
  K.mesh(K.torus(0.85, 0.025, 3, 16), dots, [0, 0.1, 0.1], far, [Math.PI / 2, 0, 0]);

  K.place(root, home);
  let hide = 0, flare = 0;
  const c = K.makeCreature({
    species: SPECIES['coconut-octopus-glowing'], root, home, radius: 0.9, eye: new THREE.Vector3(0, 0.45, 0.15),
    ground: K.groundY, speed: 0.7, roam: 4, fleeAt: 6, curiousAt: 20, shy: 0.45, rareChance: 0.6, rareAt: 'night',
    pose(c, dt, env) {
      const mov = moving(c);
      c.bob += dt * (mov ? (c.state === 'flee' ? 7 : 3.5) : 1);
      const breathe = Math.sin(env.t * 1.3 + c.bob * 0.1);
      K.blink(c, eyes.map((e) => bones[e]), dt);
      K.look(c, hd, env, dt, { yaw: 0.5, pitch: 0.3 });
      const rare = c.state === 'rare';
      hide = ease(hide, rare && c.t < 4.2 ? 1 : 0, dt * 2.2);
      flare = ease(flare, rare && c.t > 1 ? 1 : 0, dt * 3);
      const eat = c.state === 'eat' ? 1 : 0;
      bd.position.y = mov ? Math.abs(Math.sin(c.bob)) * 0.04 : 0;
      // rare: it pulls the shell over itself (the mantle squeezes in under it) and flares
      mt.scale.set(1 + breathe * 0.04, (1 + breathe * 0.05) * (1 - hide * 0.5), 1 + breathe * 0.04);
      turn(mt, hide * 0.45 + eat * 0.25, 0, 0, dt * 3);
      arms.forEach((ids, i) => {
        const ph = c.bob + i * 0.8, a = (i / 8) * TAU;
        const fwd = Math.cos(a + Math.PI / 8);                   // front arms reach when eating
        for (let j = 1; j < N; j++) {
          const wave = mov ? Math.sin(ph - j * 0.9) * 0.22 : Math.sin(env.t * 0.9 + i + j) * 0.05;
          const curl = (j >= 3 ? -0.3 : 0.05) * flare * (1 + Math.sin(env.t * 3 + i)) + (fwd > 0.5 ? -0.3 * eat * Math.sin(env.t * 5 + i) : 0);
          turn(bones[ids[j]], wave + curl, 0, 0, dt * 6);
        }
        turn(bones[ids[0]], (mov ? Math.sin(ph) * 0.12 : 0) + hide * 0.1, 0, 0, dt * 6);
      });
      const u = smooth(hide);
      shell.position.set(lerp(0.62, 0, u), lerp(0.28, 0.24, u) + Math.sin(u * Math.PI) * 0.45, lerp(-0.42, -0.12, u));
      shell.rotation.set(lerp(Math.PI, -0.12, u), 0, 0);
      lit(dots, flare * (0.5 + 0.4 * Math.sin(env.t * 9)) + (mov ? 0.1 : 0));
      lit(stripes, flare * (0.9 + 0.6 * Math.sin(env.t * 6 + 1)));
    },
  });
  return K.lod(c, near, far, 40);
}

// ---------------------------------------------------------------------------------------------
// Nautilus: a cream shell coiled behind it with brown tiger stripes, a spotted hood, a pale pinhole
// eye and a beard of tentacles; it bobs along on jets. Rare: a slow spin while light runs round the
// chambers (glowing spiral seams on the shell flanks).
export function buildNautilus(K, home, opts = {}) {
  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  const shellM = K.sheen(0xefe3cc, { roughness: 0.35 }), stripeM = K.sheen(0x9a5226, { roughness: 0.4 });
  const hoodM = K.mat(0x7c4a25, { roughness: 0.75 }), spotM = K.mat(0xe7d4ad, { roughness: 0.7 });
  const flesh = K.mat(0xe4d9c8, { roughness: 0.65 }), tentM = K.mat(0xdccfb8, { roughness: 0.6 }), navel = K.sheen(0x1c140e);
  const seam = flash(K, 0xffb04a, 0.45);

  const spin = K.group([0, 0, 0], near);                 // the rare spin turns everything
  const jet = K.group([0, 0, 0], spin);                  // the jet surge rocks this one
  const shellG = K.group([0, 0.2, -0.12], jet, null);
  const b = Math.log(3) / TAU, rho = (a) => 0.07 * Math.exp(b * a), A0 = 0.35, A1 = 3 * Math.PI;
  const at = (a, k = 1) => new THREE.Vector3(0, rho(a) * Math.cos(a) * k, -rho(a) * Math.sin(a) * k);
  const spiral = [];
  for (let i = 0; i <= 26; i++) spiral.push(at(A0 + (A1 - A0) * (i / 26)));
  K.mesh(K.tube('naut', spiral, rho(A0) * 0.76, rho(A1) * 0.76, 10, 40), shellM, [0, 0, 0], shellG);
  shellG.scale.set(0.72, 1, 1);
  // tiger stripes: half rings round the outer side of the whorl, fading out before the aperture
  for (let i = 0; i < 15; i++) {
    const a = 1.0 * Math.PI + i * 0.118 * Math.PI, rr = rho(a) * 0.75;
    const p = at(a), n = p.clone().normalize(), xAx = new THREE.Vector3(1, 0, 0), t = new THREE.Vector3().crossVectors(xAx, n);
    const m = K.mesh(K.torus(rr, rr * 0.045, 3, 10, Math.PI * 1.1), stripeM, [p.x, p.y, p.z], shellG);
    m.quaternion.setFromRotationMatrix(_m4.makeBasis(xAx, n, t)).multiply(_q.setFromAxisAngle(_v.set(0, 0, 1), -Math.PI * 0.075));
    m.scale.set(1, 1, 2.5 + (i % 2) * 1.5);
  }
  // the chamber seams that light up: a glowing spiral on each flank
  for (const s of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 18; i++) { const a = 0.9 * Math.PI + (2.85 * Math.PI - 0.9 * Math.PI) * (i / 18); const p = at(a); p.x = s * rho(a) * 0.72; p.multiplyScalar(1); p.y *= 0.82; p.z *= 0.82; pts.push(p); }
    K.mesh(K.tube('nautSeam' + s, pts, 0.006, 0.016, 4, 30), seam, [0, 0, 0], shellG);
    K.mesh(K.sphere(0.05, 8, 6), navel, [s * 0.075, 0, 0], shellG, null, [0.5, 1, 1]);
  }
  // the hood and body at the aperture (bottom front of the coil)
  const R = new Rig(K, 'naut');
  const hoodB = R.bone(-1, [0, -0.16, -0.02]);
  R.add(hoodM, hoodB, () => xf(K.sphere(1, 12, 8), [0, 0.1, 0.07], [0.25, 0, 0], [0.19, 0.13, 0.26]));
  R.add(spotM, hoodB, () => merge(Array.from({ length: 10 }, (_, i) => [K.sphere(1, 5, 4), [Math.sin(i * 2.4) * 0.1, 0.205 + (i % 3) * 0.006 - (i % 5) * 0.022, -0.06 + (i % 5) * 0.06], null, [0.03, 0.014, 0.036]])));
  R.add(flesh, hoodB, () => merge([
    [K.sphere(1, 12, 8), [0, -0.04, 0.09], null, [0.17, 0.19, 0.22]],
    [K.cyl(0.04, 0.06, 0.16, 6), [0, -0.2, 0.12], [1.1, 0, 0], 1],                           // the siphon
    ...[-1, 1].map((s) => [K.sphere(1, 8, 6), [s * 0.14, 0.0, 0.1], null, 0.06]),
  ]));
  const eyes = [-1, 1].map((s) => rigEye(K, R, hoodB, { pos: [s * 0.165, 0.0, 0.12], r: 0.055, iris: 0xbab4a6, dir: [s, 0.1, 0.25], white: true, glow: 0.5 }));
  const tents = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU, rr = 0.06 + (i % 3) * 0.025;
    const ids = R.chain(tentM, hoodB, [Math.cos(a) * rr * 1.2, Math.sin(a) * rr - 0.04, 0.24], [-Math.sin(a) * 0.45 + 0.15, Math.cos(a) * 0.5, 0],
      { len: 0.32 + (i % 4) * 0.07, n: 3, r0: 0.017, r1: 0.006, radial: 4, segs: 6 });
    tents.push(ids);
  }
  const bones = R.build(jet);
  tents.forEach((ids, i) => { bones[ids[1]].userData.r0.x = (i % 2 ? 0.3 : -0.2); bones[ids[2]].userData.r0.x = (i % 3 ? 0.45 : -0.35); });
  const hood = bones[hoodB];

  K.mesh(K.sphere(0.48, 10, 8), shellM, [0, 0.1, -0.22], far, null, [0.6, 1, 1]);
  K.mesh(K.torus(0.36, 0.05, 3, 12, Math.PI), stripeM, [0, 0.1, -0.22], far, [0, Math.PI / 2, 0]);
  K.mesh(K.sphere(0.2, 8, 6), hoodM, [0, -0.15, 0.12], far);
  K.mesh(K.cone(0.14, 0.5, 6), tentM, [0, -0.24, 0.42], far, [Math.PI / 2, 0, 0]);

  K.place(root, home);
  let pulse = 0;
  const c = K.makeCreature({
    species: SPECIES.nautilus, root, home, radius: 0.75, eye: new THREE.Vector3(0, -0.2, 0.2), flyer: true,
    speed: 0.9, roam: 9, fleeAt: 6, curiousAt: 24, shy: 0.4, rareChance: 0.6, rareAt: 'dusk',
    pose(c, dt, env) {
      c.ph = (c.ph ?? c.bob) + dt * (c.state === 'flee' ? 3.4 : 1.6);
      const p = Math.pow(Math.max(0, Math.sin(c.ph)), 3);                    // the jet: a squeeze and a surge
      c.speed = (c.state === 'flee' ? 1.6 : 0.6) * (0.35 + p * 1.6);
      const vy = swimDepth(K, c, dt, env, { clear: 0.9, amp: 0.3 });
      jet.position.y = Math.sin(c.ph - 0.6) * 0.06;
      jet.rotation.x = ease(jet.rotation.x, -p * 0.12 + clamp(-vy * 0.25, -0.3, 0.3), dt * 4);
      hood.scale.set(1 - p * 0.08, 1 - p * 0.05, 1 + p * 0.06);
      K.blink(c, eyes.map((e) => bones[e]), dt);
      const trail = moving(c) ? p * 0.5 : 0;
      tents.forEach((ids, i) => {
        for (let j = 0; j < 3; j++) turn(bones[ids[j]], Math.sin(env.t * 1.6 + i * 0.7 + j) * 0.12 + (j ? 0.05 : 0) + (c.state === 'eat' ? -0.15 : 0), Math.cos(env.t * 1.3 + i) * 0.1 * (1 - trail), 0, dt * 5);
        bones[ids[0]].scale.setScalar(1 - trail * 0.25);
      });
      // rare: one slow turn round while light runs along the chambers
      if (c.state === 'rare') spin.rotation.y = smooth(c.t / 4.4) * TAU;
      else { spin.rotation.y %= TAU; spin.rotation.y = ease(spin.rotation.y, spin.rotation.y > Math.PI ? TAU : 0, dt * 2); }
      pulse = ease(pulse, c.state === 'rare' ? 1 : 0, dt * 2);
      lit(seam, pulse * (1.1 + 0.8 * Math.sin(env.t * 5)) + p * 0.15);
    },
  });
  return K.lod(c, near, far, 42);
}

// ---------------------------------------------------------------------------------------------
// Leafy seadragon: an orange pipe of a body with a long snout, draped in branching leaf-like
// appendages (yellow below, pink-lilac above), the tail curled down. It drifts. Rare: every leaf
// flutters and the whole animal lights up.
export function buildLeafySeadragon(K, home, opts = {}) {
  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  const bodyM = K.mat(0xd8892e, { roughness: 0.6 }), stalkM = K.mat(0xb33358, { roughness: 0.6 });
  const yel = flashFin(K, 0xd8d040, 0.85, 0.4), pink = flashFin(K, 0xcf7ad6, 0.8, 0.5);
  const spikeM = flash(K, 0xffe46a, 0.45);

  const swim = K.group([0, 0, 0], near);
  const R = new Rig(K, 'dragon');
  const trunk = R.bone(-1, [0, 0, 0]);
  // body and tail from the chest backwards, curling down at the end
  const spine = R.chain(bodyM, trunk, [0, 0.03, 0.3], [0, Math.PI, 0],
    { len: 1.25, n: 6, prof: (t) => 0.075 * Math.pow(1 - t, 0.75) + 0.008, sx: 0.75, sy: 1.15, radial: 7, segs: 18 });
  R.add(bodyM, trunk, () => xf(K.sphere(1, 10, 7), [0, 0.03, 0.29], null, [0.058, 0.088, 0.08]));     // the chest closes the tube
  R.add(spikeM, spine[0], () => {
    const it = [];
    for (let k = 0; k < 14; k++) {
      const t = 0.04 + k * 0.05, r = 0.075 * Math.pow(1 - t, 0.75);
      it.push([K.cone(0.012, 0.06, 3), [0, r * 1.1 + 0.02, t * 1.25], [0, 0, 0], 1], [K.cone(0.012, 0.05, 3), [0, -r * 1.1 - 0.015, t * 1.25], [Math.PI, 0, 0], 1]);
    }
    return merge(it);
  }, spine.w);
  // the neck rises to the head; the head itself is level again (it looks around)
  const neck = R.chain(bodyM, trunk, [0, 0.04, 0.27], [-0.75, 0, 0], { len: 0.22, n: 1, r0: 0.06, r1: 0.045, sx: 0.8, radial: 7, segs: 3 });
  const hb = R.bone(neck[0], [0, 0, 0.22], [0.75, 0, 0]);
  const head = R.bone(hb, [0, 0, 0]);
  R.add(bodyM, head, () => merge([
    [K.sphere(1, 10, 7), [0, 0.01, 0.02], null, [0.045, 0.055, 0.085]],
    [tubeGeo(0.38, 4, 6, (t) => 0.02 - t * 0.006, 0.8, 1), [0, -0.01, 0.06], [0.08, 0, 0], 1],
    [K.sphere(1, 6, 4), [0, -0.04, 0.44], null, [0.022, 0.02, 0.025]],
  ]));
  // a leaf appendage: a magenta stalk that forks into flat leaves (on its own bone, so it can wave)
  const LEAF = [[0, 0], [0.035, 0.03], [0.045, 0.08], [0.03, 0.13], [0.0, 0.15], [-0.02, 0.11], [-0.025, 0.05]];
  const leafG = (len, n) => {
    const it = [];
    for (let k = 0; k < n; k++) {
      const y = len * (0.3 + 0.7 * (k / Math.max(1, n - 1))) - 0.02, s = k % 2 ? 1 : -1, sz = 1.5 + k * 0.25;
      it.push([K.shape('dleaf', LEAF), [0, y, s * 0.01], [s * 0.75, 0, 0], [sz, sz, 1]]);
    }
    it.push([K.shape('dleaf', LEAF), [0, len - 0.01, 0], null, [2.1, 2.1, 1]]);
    return merge(it).rotateY(Math.PI / 2);                     // the leaves face sideways, flat to the viewer
  };
  const stalkG = (len) => merge([[K.cyl(0.007, 0.016, len, 4), [0, len / 2, 0], null, 1], [K.cyl(0.004, 0.008, len * 0.4, 3), [0, len * 0.6, 0.03], [0.7, 0, 0], 1]]);
  const apps = [];
  const app = (parent, p, r, len, n, m) => {
    const id = R.bone(parent, p, r);
    R.add(stalkM, id, () => stalkG(len));
    R.add(m, id, () => leafG(len, n));
    apps.push(id);
  };
  // upper (pink) and lower (yellow) appendages along the body, the tail tip and the head
  [[0, 0.06, 0.38, 3], [1, 0.0, 0.42, 3], [2, 0.08, 0.34, 3], [4, 0.0, 0.26, 2]].forEach(([j, z, len, n], k) => app(spine[j], [0, 0.07, z], [0.2, 0, k % 2 ? 0.35 : -0.35], len, n, pink));
  [[0, 0.04, 0.4, 3], [1, 0.0, 0.42, 3], [2, 0.05, 0.36, 3], [3, 0.0, 0.3, 2]].forEach(([j, z, len, n], k) => app(spine[j], [0, -0.07, z], [Math.PI - 0.25, 0, k % 2 ? 0.3 : -0.3], len, n, yel));
  [-1, 1].forEach((s) => app(spine[1], [s * 0.05, 0, 0.1], [0, 0, -s * 1.6], 0.26, 2, yel));
  app(spine[5], [0, 0, 0.18], [-1.4, 0, 0], 0.28, 3, pink);
  app(head, [0, 0.05, -0.01], [-0.3, 0, 0.3], 0.16, 2, pink);
  app(head, [0, 0.05, -0.02], [-0.25, 0, -0.35], 0.14, 2, yel);
  app(neck[0], [0, 0.05, 0.08], [0.6, 0, 0], 0.22, 2, pink);
  const eyeIds = [-1, 1].map((s) => rigEye(K, R, head, { pos: [s * 0.04, 0.025, 0.04], r: 0.024, iris: 0xe0a030, dir: [s, 0.2, 0.3], glow: 0.5 }));
  const bones = R.build(swim);
  [0, 0.05, 0.12, 0.25, 0.4, 0.6].forEach((x, j) => { bones[spine[j]].userData.r0.x = x; });
  const hd = bones[head], eyes = eyeIds.map((e) => bones[e]);

  K.mesh(K.capsule(0.07, 0.75, 3, 6), bodyM, [0, 0, -0.1], far, [Math.PI / 2, 0, 0]);
  K.mesh(K.cone(0.03, 0.42, 5), bodyM, [0, 0.2, 0.55], far, [1.2, 0, 0]);
  K.mesh(K.box(0.04, 0.5, 0.7), pink, [0, 0.25, -0.05], far);
  K.mesh(K.box(0.04, 0.45, 0.7), yel, [0, -0.25, -0.05], far);

  K.place(root, home);
  let glow = 0;
  const c = K.makeCreature({
    species: SPECIES['leafy-seadragon'], root, home, radius: 0.8, eye: new THREE.Vector3(0, 0.25, 0.4), flyer: true,
    speed: 0.45, roam: 6, fleeAt: 5, curiousAt: 18, shy: 0.55, rareChance: 0.65, rareAt: 'dawn',
    pose(c, dt, env) {
      const vy = swimDepth(K, c, dt, env, { clear: 1.0, amp: 0.25, f: 0.3 });
      swim.rotation.x = ease(swim.rotation.x, clamp(-vy * 0.4, -0.35, 0.35), dt * 2);
      swim.rotation.z = Math.sin(env.t * 0.5 + c.bob) * 0.05;
      const rare = c.state === 'rare';
      glow = ease(glow, rare ? 1 : 0, dt * 2);
      spine.forEach((id, j) => turn(bones[id], Math.sin(env.t * 0.8 - j * 0.6 + c.bob) * 0.04 * j, Math.sin(env.t * 0.6 - j * 0.5) * 0.05 * j, 0, dt * 4));
      const fl = rare ? 0.35 : 0.08, hz = rare ? 11 : 1.3;
      apps.forEach((id, i) => turn(bones[id], Math.sin(env.t * hz + i * 1.7) * fl, 0, Math.cos(env.t * hz * 0.8 + i) * fl * 0.6, dt * 8));
      K.look(c, hd, env, dt, { yaw: 0.6, pitch: 0.35, rate: 1.5 });
      if (c.state === 'eat') hd.rotation.x = ease(hd.rotation.x, 0.3 + Math.sin(env.t * 8) * 0.05, dt * 4);
      K.blink(c, eyes, dt);
      const pulse = glow * (0.8 + 0.5 * Math.sin(env.t * 4));
      lit(yel, pulse); lit(pink, pulse * 1.1); lit(spikeM, pulse * 1.2);
    },
  });
  return K.lod(c, near, far, 40);
}

// ---------------------------------------------------------------------------------------------
// Jellyfish: a translucent pulsing bell with a glowing green-gold core, a ring of thick arms with
// pink knobs, frilly oral arms and long thin trailing tentacles. One builder makes a single jelly,
// the swarm builder several smaller ones on one skeleton. Rare: synchronised bright light pulses.
function jellyRig(K, key, n, bodies) {
  const bellM = K.fin(0xb9c6ff, 0.4, 0.3), armM = K.fin(0xdfe6ff, 0.7, 0.25), tentM = K.fin(0xb4bcff, 0.5, 0.4), frill = K.fin(0xe2d4ff, 0.45, 0.3);
  const core = flash(K, 0x9cff8a, 0.6, { transparent: true, opacity: 0.85 }), tips = flash(K, 0xff7a9a, 0.7);
  const R = new Rig(K, key);
  const J = [];
  for (let b = 0; b < n; b++) {
    const full = n === 1;
    const body = R.bone(-1, bodies[b]);
    const bell = R.bone(body, [0, 0, 0]);
    R.add(bellM, bell, () => xf(K.lathe('jbell' + full, [[0.47, -0.02], [0.45, 0.08], [0.4, 0.2], [0.3, 0.32], [0.16, 0.4], [0.0, 0.42]], full ? 14 : 10)));
    R.add(core, bell, () => merge([[K.sphere(1, full ? 10 : 8, full ? 7 : 5), [0, 0.16, 0], null, [0.2, 0.14, 0.2]], [K.sphere(1, 6, 5), [0, 0.32, 0.12], null, [0.07, 0.05, 0.07]]]));
    const nr = full ? 14 : 6;
    R.add(armM, bell, () => {
      const it = [];
      for (let k = 0; k < nr; k++) {
        const a = (k / nr) * TAU, l = 0.26 + (k % 3) * 0.08;
        it.push([K.capsule(0.03, l, 2, full ? 5 : 4), [Math.cos(a) * (0.42 + l * 0.25), -0.02 - l * 0.35, Math.sin(a) * (0.42 + l * 0.25)], [0, -a, 0.6 + (k % 2) * 0.5], 1]);
      }
      return merge(it);
    });
    R.add(tips, bell, () => {
      const it = [];
      for (let k = 0; k < nr; k++) {
        // the knob at the outer end of each arm, along the arm's own (tilted) axis
        const a = (k / nr) * TAU, l = 0.26 + (k % 3) * 0.08, ang = 0.6 + (k % 2) * 0.5, d = l / 2 + 0.03, rr = 0.42 + l * 0.25;
        it.push([K.sphere(1, 5, 4), [Math.cos(a) * (rr + d * Math.sin(ang)), -0.02 - l * 0.35 - d * Math.cos(ang), Math.sin(a) * (rr + d * Math.sin(ang))], null, 0.04]);
      }
      return merge(it);
    });
    // four frilly oral arms under the bell
    const oral = [];
    const no = full ? 4 : 3;
    for (let k = 0; k < no; k++) {
      const a = (k / no) * TAU + 0.4;
      const ids = R.chain(frill, body, [Math.cos(a) * 0.08, -0.05, Math.sin(a) * 0.08], [Math.PI / 2 - 0.15, Math.atan2(Math.cos(a), Math.sin(a)), 0],
        { len: full ? 0.9 : 0.6, n: 3, prof: (t) => 0.045 * (1 - t * 0.6) * (1 + 0.35 * Math.sin(t * 40)), sx: 1.7, sy: 0.6, radial: 4, segs: full ? 12 : 7 });
      oral.push(ids);
    }
    // long trailing tentacles from the rim
    const tent = [];
    const nt = full ? 8 : 5;
    for (let k = 0; k < nt; k++) {
      const a = (k / nt) * TAU + 0.2;
      const ids = R.chain(tentM, body, [Math.cos(a) * 0.4, -0.03, Math.sin(a) * 0.4], [Math.PI / 2 - 0.12, Math.atan2(Math.cos(a), Math.sin(a)), 0],
        { len: full ? 2.8 : 1.8, n: 5, r0: 0.012, r1: 0.004, radial: 3, segs: full ? 15 : 8 });
      tent.push(ids);
    }
    J.push({ body, bell, oral, tent });
  }
  return { R, J, core, tips, bellM };
}

function poseJellies(K, c, dt, env, jr, bones, offs, sizes) {
  const rare = c.state === 'rare';
  c.glowK = ease(c.glowK ?? 0, rare ? 1 : 0, dt * 3);
  let sync = 0;
  jr.J.forEach((j, i) => {
    const ph = rare ? env.t * 3.2 : env.t * (1.6 + i * 0.13) + i * 1.9;
    const s = Math.sin(ph), squeeze = Math.max(0, s);
    sync += squeeze;
    const bell = bones[j.bell], body = bones[j.body];
    bell.scale.set(1 + 0.1 * s, 1 - 0.14 * s, 1 + 0.1 * s);
    const o = offs[i];
    body.position.set(o[0] + Math.sin(env.t * 0.21 + i * 2) * 0.4, o[1] + Math.sin(ph - 1.2) * 0.1 + Math.sin(env.t * 0.17 + i) * 0.3, o[2] + Math.cos(env.t * 0.19 + i) * 0.4);
    body.rotation.z = Math.sin(env.t * 0.3 + i) * 0.12;
    body.scale.setScalar(sizes[i]);
    j.tent.forEach((ids, k) => ids.forEach((id, m) => turn(bones[id], Math.sin(env.t * 1.3 - m * 0.9 + k) * 0.12 * (m ? 1 : 0.3) + squeeze * 0.06, Math.cos(env.t * 0.9 - m * 0.7 + k * 2) * 0.12 * m * 0.5, 0, dt * 5)));
    j.oral.forEach((ids, k) => ids.forEach((id, m) => turn(bones[id], Math.sin(env.t * 0.9 - m + k) * 0.1, 0, Math.cos(env.t * 0.7 - m * 1.3 + k) * 0.25, dt * 5)));
  });
  sync /= jr.J.length;
  lit(jr.core, c.glowK * (0.3 + sync * 2.2) + sync * 0.15);
  lit(jr.tips, c.glowK * (0.3 + sync * 1.8));
}

export function buildJellyfish(K, home, opts = {}) {
  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  const jr = jellyRig(K, 'jelly1', 1, [[0, 0, 0]]);
  const bones = jr.R.build(near);
  K.mesh(K.sphere(0.8, 10, 6), jr.bellM, [0, 0.25, 0], far, null, [1, 0.75, 1]);
  K.mesh(K.sphere(0.32, 8, 6), jr.core, [0, 0.3, 0], far);
  K.mesh(K.cone(0.55, 3.5, 6, true), K.fin(0xd0d6ff, 0.3, 0.6), [0, -1.8, 0], far, [Math.PI, 0, 0]);
  K.place(root, home);
  const offs = [[0, 0, 0]], sizes = [1.7];
  const c = K.makeCreature({
    species: SPECIES.jellyfish, root, home, radius: 1.2, eye: new THREE.Vector3(0, 0.4, 0), flyer: true,
    speed: 0.35, roam: 6, fleeAt: 4, curiousAt: 0, shy: 0.2, rareChance: 0.8, rareAt: 'night',
    pose(c, dt, env) { swimDepth(K, c, dt, env, { clear: 4.2, top: 1, amp: 0.4, f: 0.25, rate: 0.8 }); poseJellies(K, c, dt, env, jr, bones, offs, sizes); },
  });
  return K.lod(c, near, far, 45);
}

// a swarm: several jellies drifting together (one creature for the camera; the centre is the subject)
export function buildJellyfishSwarm(K, home, opts = {}) {
  const n = clamp(opts.n ?? 5, 2, 7);
  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  const offs = [], sizes = [];
  for (let i = 0; i < n; i++) {
    const a = i * 2.4, r = i ? 1.3 + (i % 3) * 0.6 : 0;
    offs.push([Math.cos(a) * r, (i % 2 ? 0.8 : -0.5) * (i ? 1 : 0), Math.sin(a) * r]);
    sizes.push(i ? 0.8 + (i % 3) * 0.2 : 1.25);
  }
  const jr = jellyRig(K, 'jellyS' + n, n, offs);
  const bones = jr.R.build(near);
  offs.slice(0, 4).forEach((o, i) => K.mesh(K.sphere(0.5 * sizes[i], 8, 5), i ? jr.bellM : jr.core, [o[0], o[1] + 0.15, o[2]], far, null, [1, 0.8, 1]));
  K.place(root, home);
  const c = K.makeCreature({
    species: SPECIES.jellyfish, root, home, radius: 2.4, eye: new THREE.Vector3(0, 0.4, 0), flyer: true,
    speed: 0.3, roam: 7, fleeAt: 4, curiousAt: 0, shy: 0.2, rareChance: 0.8, rareAt: 'night',
    pose(c, dt, env) { swimDepth(K, c, dt, env, { clear: 3.6, top: 1.6, amp: 0.4, f: 0.2, rate: 0.6 }); poseJellies(K, c, dt, env, jr, bones, offs, sizes); },
  });
  return K.lod(c, near, far, 50);
}

// ---------------------------------------------------------------------------------------------
// Goblin shark (the secret one, out at night): a soft pink body, a long flat blade of a snout over a
// jaw full of needle teeth, small rounded fins and a long low tail. Rare: the jaw slingshots forward.
export function buildGoblinShark(K, home, opts = {}) {
  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  const skin = K.sheen(0xd7a3ad, { roughness: 0.5 }), finM = K.mat(0xa995b5, { roughness: 0.55, side: THREE.DoubleSide });
  const snoutM = K.sheen(0xe3b7bd, { roughness: 0.45 }), gum = K.mat(0xd27c86, { roughness: 0.5 }), tooth = K.sheen(0xf3efe6);
  const mouth = K.mat(0x1b0b10, { roughness: 0.9 }), lateral = flash(K, 0xa98bff, 0.7);

  const swim = K.group([0, 0, 0], near);
  const R = new Rig(K, 'goblin');
  const trunk = R.bone(-1, [0, 0, 0]);
  // the front of the body (rigid) and the snout
  R.add(skin, trunk, () => merge([
    [tubeGeo(1.2, 9, 10, (t) => [0.27, 0.27, 0.26, 0.245, 0.225, 0.2, 0.175, 0.15, 0.12, 0.07][Math.round(t * 9)], 0.82, 1), [0, 0, -0.06], null, 1],
    [K.sphere(1, 8, 6), [0, -0.02, 1.1], null, [0.1, 0.08, 0.1]],
  ]));
  R.add(snoutM, trunk, () => xf(tubeGeo(0.72, 7, 8, (t) => (0.13 - t * 0.025) * Math.sqrt(Math.max(0.03, 1 - Math.pow(t, 5))), 1, 0.36), [0, 0.04, 0.8], [-0.1, 0, 0], 1));
  R.add(mouth, trunk, () => xf(K.sphere(1, 8, 6), [0, -0.12, 0.93], null, [0.12, 0.06, 0.12]));
  // gill slits
  R.add(mouth, trunk, () => {
    const it = [];
    for (const s of [-1, 1]) for (let k = 0; k < 5; k++) it.push([K.box(0.01, 0.13, 0.012), [s * 0.205, -0.02, 0.48 + k * 0.055], [0, 0, s * 0.1], 1]);
    return merge(it);
  });
  // pectoral and pelvic fins on the trunk
  const pec = K.shape('gobPec', [[0, 0], [0.24, -0.03], [0.3, -0.12], [0.16, -0.12], [0.02, -0.06]]);
  R.add(finM, trunk, () => merge([-1, 1].map((s) => [pec, [s * 0.18, -0.15, 0.42], [-0.5, s * Math.PI / 2, s * 0.6], 1])));
  // the body and tail behind the head, bending as it swims
  const tail = R.chain(skin, trunk, [0, 0, 0.02], [0, Math.PI, 0], { len: 2.0, n: 5, prof: (t) => 0.25 * Math.pow(1 - t, 0.9) + 0.02, sx: 0.8, sy: 1, radial: 10, segs: 15 });
  R.add(lateral, tail[0], () => {
    const it = [];
    for (let k = 0; k < 9; k++) { const t = 0.05 + k * 0.08, r = 0.27 * Math.pow(1 - t, 0.9) + 0.025; for (const s of [-1, 1]) it.push([K.sphere(1, 4, 3), [s * r * 0.8, 0.02, t * 2], null, 0.018]); }
    return merge(it);
  }, tail.w);
  const dors = K.shape('gobDors', [[0, 0], [0.26, 0], [0.18, 0.08], [0.05, 0.17], [-0.03, 0.13]]);
  R.add(finM, tail[1], () => xf(dors, [0, 0.19, 0.0], [0, -Math.PI / 2, 0], 1));
  R.add(finM, tail[2], () => xf(dors, [0, 0.13, 0.05], [0, -Math.PI / 2, 0], 0.85));
  R.add(finM, tail[2], () => xf(dors, [0, -0.12, 0.1], [Math.PI, -Math.PI / 2, 0], 0.9));      // the anal fin
  R.add(finM, tail[1], () => merge([-1, 1].map((s) => [K.shape('gobPel', [[0, 0], [0.16, -0.02], [0.2, -0.1], [0.06, -0.08]]), [s * 0.12, -0.16, 0.1], [-0.4, -s * Math.PI / 2 + Math.PI, s * 0.5], 1])));
  // the long, low caudal fin: an upper rim along the tail and a broad web underneath
  R.add(finM, tail[0], () => xf(K.shape('gobCaud', [[0, 0], [0.8, 0.06], [0.84, -0.02], [0.66, -0.12], [0.45, -0.24], [0.32, -0.16], [0.05, -0.05]]), [0, 0, 1.3], [0, -Math.PI / 2, 0], 1), tail.w);
  // the jaw: its own bone, so it can shoot forward
  const jaw = R.bone(trunk, [0, -0.13, 0.86]);
  R.add(gum, jaw, () => merge([
    [K.torus(0.12, 0.028, 4, 12, Math.PI), [0, 0.02, 0.05], [Math.PI / 2 + 0.2, 0, 0], [1, 1.1, 1]],
    [K.torus(0.11, 0.03, 4, 12, Math.PI), [0, -0.07, 0.04], [Math.PI / 2 - 0.2, 0, 0], [1, 1.1, 1]],
  ]));
  R.add(tooth, jaw, () => {
    const it = [];
    for (let k = 0; k < 11; k++) {
      const a = (k / 10) * Math.PI;
      it.push([K.cone(0.014, 0.1, 3), [Math.cos(a) * 0.115, -0.03, 0.05 + Math.sin(a) * 0.115], [Math.PI - 0.5, 0, Math.cos(a) * 0.4], 1]);
      it.push([K.cone(0.014, 0.1, 3), [Math.cos(a) * 0.105, -0.05, 0.04 + Math.sin(a) * 0.105], [0.5, 0, Math.cos(a) * 0.4], 1]);
    }
    return merge(it);
  });
  R.add(mouth, jaw, () => xf(K.sphere(1, 8, 5), [0, -0.03, 0.08], null, [0.09, 0.05, 0.07]));
  const eyeIds = [-1, 1].map((s) => rigEye(K, R, trunk, { pos: [s * 0.15, 0.05, 0.84], r: 0.034, iris: 0x4a5cc8, dir: [s, 0.15, 0.3], glow: 0.8 }));
  const bones = R.build(swim);
  const eyes = eyeIds.map((e) => bones[e]);
  const J = bones[jaw];

  K.mesh(K.capsule(0.25, 2.3, 3, 8), skin, [0, 0, -0.1], far, [Math.PI / 2, 0, 0], [0.82, 1, 1]);
  K.mesh(K.box(0.18, 0.05, 0.7), snoutM, [0, 0.06, 1.3], far);
  K.mesh(K.cone(0.22, 0.9, 4), finM, [0, -0.05, -1.75], far, [-Math.PI / 2, 0, 0], [0.2, 1, 1]);
  K.mesh(K.cone(0.1, 0.25, 4), finM, [0, 0.27, -0.35], far, null, [0.3, 1, 1]);

  K.place(root, home);
  let lastYaw = 0, bank = 0, strikeGlow = 0;
  const c = K.makeCreature({
    species: SPECIES['goblin-shark'], root, home, radius: 1.7, eye: new THREE.Vector3(0, 0.05, 0.95), flyer: true,
    speed: 1.1, roam: 14, fleeAt: 7, curiousAt: 26, shy: 0.6, rareChance: 0.7, rareAt: 'night',
    pose(c, dt, env) {
      const vy = swimDepth(K, c, dt, env, { clear: 1.4, top: 1.2, amp: 0.5, f: 0.18 });
      const fast = c.state === 'flee' ? 2.2 : 1;
      c.ph = (c.ph ?? 0) + dt * 2.2 * fast;
      tail.forEach((id, j) => turn(bones[id], 0, Math.sin(c.ph - j * 0.7) * (0.06 + j * 0.05) * (moving(c) ? 1.2 : 0.7), 0, dt * 8));
      bones[trunk].rotation.y = Math.sin(c.ph + 0.8) * 0.04;
      const yawRate = dt > 0 ? (c.root.rotation.y - lastYaw) / dt : 0;
      lastYaw = c.root.rotation.y;
      bank = ease(bank, clamp(-yawRate * 0.5, -0.4, 0.4), dt * 2);
      swim.rotation.set(ease(swim.rotation.x, clamp(-vy * 0.3, -0.3, 0.3), dt * 2), 0, bank);
      // the jaw: resting tucked under the snout; rare = three slingshot strikes
      let out = c.state === 'eat' ? 0.25 + Math.max(0, Math.sin(env.t * 4)) * 0.3 : 0, open = out * 0.4;
      if (c.state === 'rare') {
        const k = (c.t % 1.4) / 1.4;
        const s = k < 0.12 ? smooth(k / 0.12) : Math.pow(1 - smooth((k - 0.12) / 0.6), 1.5);
        out = s; open = k < 0.25 ? s * 0.9 : s * 0.4;
      }
      J.position.z = ease(J.position.z, 0.86 + out * 0.3, dt * (c.state === 'rare' ? 30 : 6));
      J.position.y = ease(J.position.y, -0.13 - out * 0.08, dt * 20);
      J.rotation.x = ease(J.rotation.x, open * 0.6, dt * 20);
      strikeGlow = ease(strikeGlow, c.state === 'rare' ? out : 0, dt * 10);
      lit(lateral, strikeGlow * 3);
      K.blink(c, eyes, dt);
    },
  });
  return K.lod(c, near, far, 48);
}

// ---------------------------------------------------------------------------------------------
// Giant isopod: a pale lilac armoured dome of overlapping plates, a head shield with dark compound
// eyes, long antennae and seven pairs of jointed legs; a fan tail. Rare: it curls up partly, waves
// its antennae and its plate seams light up.
export function buildGiantIsopod(K, home, opts = {}) {
  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  const shellM = K.sheen(0xcfc5d6, { roughness: 0.42 }), legM = K.mat(0xdcd2de, { roughness: 0.6 }), belly = K.mat(0x9d8f9e, { roughness: 0.8 });
  const eyeM = K.sheen(0x17141c, { roughness: 0.1 }), shine = K.mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9 });
  const seams = flash(K, 0x76f0e2, 0.7);

  const R = new Rig(K, 'isopod');
  const mid = R.bone(-1, [0, 0.27, 0]);
  const front = R.bone(mid, [0, 0, 0.12]);
  const rear1 = R.bone(mid, [0, 0, -0.12]);
  const rear2 = R.bone(rear1, [0, 0, -0.2]);
  const rear3 = R.bone(rear2, [0, 0, -0.16]);
  const plate = K.geo('isoPlate', () => new THREE.CylinderGeometry(1, 1, 1, 12, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2));
  const edge = K.torus(1, 0.035, 3, 12, Math.PI);
  // thoracic plates over the three middle bones, the pleon and tail fan behind
  const plates = [[front, 0.17, 0.27, 0.19], [front, 0.08, 0.28, 0.2], [front, -0.01, 0.285, 0.205], [mid, 0.0, 0.29, 0.21], [mid, -0.09, 0.29, 0.21], [rear1, 0.0, 0.285, 0.205], [rear1, -0.09, 0.275, 0.2],
    [rear2, 0.0, 0.25, 0.17], [rear2, -0.06, 0.23, 0.15], [rear2, -0.12, 0.21, 0.13], [rear3, 0.0, 0.19, 0.11]];
  plates.forEach(([b, z, w, h]) => {
    R.add(shellM, b, () => xf(plate, [0, -0.04, z], [-0.08, 0, 0], [w, h, 0.11]));
    R.add(seams, b, () => xf(edge, [0, -0.04, z - 0.052], [0, 0, 0], [w * 1.01, h * 1.01, 0.4]));
  });
  R.add(shellM, rear3, () => merge([[K.sphere(1, 12, 6), [0, -0.05, -0.1], null, [0.19, 0.06, 0.16]], ...[-0.12, -0.06, 0, 0.06, 0.12].map((x) => [K.cone(0.015, 0.06, 3), [x, -0.06, -0.26 + Math.abs(x) * 0.4], [-Math.PI / 2, 0, 0], 1])]));
  R.add(legM, rear3, () => merge([-1, 1].map((s) => [K.shape('isoUro', [[0, 0], [0.05, -0.04], [0.06, -0.18], [0.0, -0.2]]), [s * 0.17, -0.07, -0.02], [Math.PI / 2, 0, s * 0.3], 1])));
  R.add(belly, mid, () => merge([[K.sphere(1, 10, 6), [0, -0.1, 0.0], null, [0.24, 0.07, 0.5]]]));
  // the head shield and its eyes
  R.add(shellM, front, () => merge([[K.sphere(1, 12, 7), [0, -0.05, 0.25], null, [0.2, 0.13, 0.11]], [K.sphere(1, 6, 5), [0, -0.12, 0.33], null, [0.06, 0.04, 0.04]]]));
  R.add(eyeM, front, () => merge([-1, 1].map((s) => [K.sphere(1, 8, 6), [s * 0.13, -0.04, 0.3], [0, s * 0.5, 0], [0.055, 0.04, 0.06]])));
  R.add(shine, front, () => merge([-1, 1].map((s) => [K.sphere(1, 5, 4), [s * 0.15, -0.01, 0.335], null, 0.01])));
  // antennae (long) and antennules (short)
  const ant = [-1, 1].map((s) => R.chain(legM, front, [s * 0.05, -0.1, 0.33], [0.25, s * 0.55, 0], { len: 0.8, n: 4, r0: 0.016, r1: 0.005, radial: 4, segs: 12 }));
  const antl = [-1, 1].map((s) => R.chain(legM, front, [s * 0.03, -0.09, 0.34], [-0.2, s * 0.3, 0], { len: 0.18, n: 2, r0: 0.012, r1: 0.006, radial: 4, segs: 4 }));
  // seven pairs of legs, each hip + knee
  const legs = [];
  for (let k = 0; k < 7; k++) for (const s of [-1, 1]) {
    const z = 0.22 - k * 0.075, b = z > 0.07 ? front : z > -0.07 ? mid : rear1, bz = z - (b === front ? 0.12 : b === rear1 ? -0.12 : 0);
    const ids = R.chain(legM, b, [s * 0.2, -0.12, bz], [0.35, s * (Math.PI / 2 - 0.35 + k * 0.12), 0], { len: 0.34, n: 2, r0: 0.026, r1: 0.012, radial: 5, segs: 6 });
    R.add(legM, ids[1], () => xf(K.cone(0.012, 0.06, 4), [0, 0, 0.19], [Math.PI / 2, 0, 0], 1));
    legs.push({ ids, s, k });
  }
  const bones = R.build(near);
  legs.forEach(({ ids }) => { bones[ids[1]].userData.r0.x = 1.15; });
  ant.forEach((ids) => { bones[ids[1]].userData.r0.x = 0.1; bones[ids[2]].userData.r0.x = -0.15; bones[ids[3]].userData.r0.x = -0.2; });
  K.shadow(root, 0.42, 0.7);

  K.mesh(K.sphere(0.3, 10, 6), shellM, [0, 0.22, -0.05], far, null, [1, 0.65, 1.9]);
  K.mesh(K.cyl(0.36, 0.36, 0.12, 8), legM, [0, 0.08, -0.05], far, null, [1, 1, 1.6]);
  K.mesh(K.cone(0.04, 0.8, 4), legM, [0, 0.18, 0.75], far, [1.4, 0, 0], [6, 1, 1]);

  K.place(root, home);
  let roll = 0;
  const c = K.makeCreature({
    species: SPECIES['giant-isopod'], root, home, radius: 0.65, eye: new THREE.Vector3(0, 0.25, 0.4),
    ground: K.groundY, speed: 0.55, roam: 5, fleeAt: 5, curiousAt: 18, shy: 0.35, rareChance: 0.55, rareAt: 'dusk',
    pose(c, dt, env) {
      const mov = moving(c);
      c.bob += dt * (mov ? (c.state === 'flee' ? 9 : 5) : 0);
      const rare = c.state === 'rare';
      roll = ease(roll, rare && c.t < 4 ? 1 : 0, dt * 2);
      const br = Math.sin(env.t * 1.1) * 0.012;
      bones[mid].position.y = 0.27 + (mov ? Math.abs(Math.sin(c.bob * 2)) * 0.012 : br) - roll * 0.03;
      turn(bones[front], roll * 0.45 + (c.state === 'eat' ? 0.25 + Math.sin(env.t * 6) * 0.05 : 0), 0, 0, dt * 4);
      turn(bones[rear1], -roll * 0.25, 0, 0, dt * 4);
      turn(bones[rear2], -roll * 0.4, 0, 0, dt * 4);
      turn(bones[rear3], -roll * 0.6, 0, 0, dt * 4);
      // a metachronal wave down each side; the legs tuck in when it rolls
      legs.forEach(({ ids, s, k }) => {
        const ph = c.bob - k * 0.9 + (s > 0 ? Math.PI : 0);
        const sw = mov ? Math.sin(ph) * 0.3 : 0, up = mov ? Math.max(0, Math.cos(ph)) * 0.35 : 0;
        turn(bones[ids[0]], -up - roll * 0.6, sw * -s, 0, dt * 10);
        turn(bones[ids[1]], roll * 0.6, 0, 0, dt * 10);
      });
      const wave = rare ? 1 : 0.25;
      ant.forEach((ids, i) => ids.forEach((id, j) => turn(bones[id], Math.sin(env.t * (rare ? 4 : 1.2) + j + i) * 0.12 * wave * (j + 1) - roll * 0.3 * (j === 0), Math.cos(env.t * (rare ? 3 : 0.8) + i * 2 + j) * 0.15 * wave, 0, dt * 6)));
      antl.forEach((ids, i) => turn(bones[ids[1]], Math.sin(env.t * 5 + i * 2) * 0.3, 0, 0, dt * 6));
      lit(seams, roll * (2 + 1.5 * Math.sin(env.t * 5)));
    },
  });
  return K.lod(c, near, far, 38);
}

// ---------------------------------------------------------------------------------------------
// Nudibranch: a navy slug spattered with orange spots on a violet-blue foot, two tall ridged
// rhinophores, curling oral tentacles and a frilly gill plume on its back. Rare: the plume flares
// open and glows.
export function buildNudibranch(K, home, opts = {}) {
  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  const bodyM = K.sheen(0x1d1a4e, { roughness: 0.35 }), footM = K.sheen(0x4b5ae6, { roughness: 0.35 });
  const spotM = K.glow(0xffa21c, 0.6), rhinoM = K.sheen(0x6f5cf2, { roughness: 0.35 }), tipM = K.glow(0xc8c0ff, 0.6);
  const gillM = flash(K, 0x8a6cff, 0.5), gillTip = flash(K, 0xffb03a, 0.7);

  const R = new Rig(K, 'nudi');
  const body = R.chain(bodyM, -1, [0, 0.09, -0.32], [0, 0, 0], { len: 0.66, n: 4, prof: (t) => 0.025 + 0.075 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), 0.55), sx: 1.15, sy: 0.95, radial: 9, segs: 16 });
  R.add(footM, body[0], () => tubeGeo(0.7, 16, 9, (t) => 0.02 + 0.105 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.02)), 0.5), 1.2, 0.22, -0.065), body.w);
  R.add(spotM, body[0], () => {
    const it = [];
    for (let k = 0; k < 26; k++) {
      const t = 0.08 + ((k * 0.37) % 0.84), a = 0.3 + ((k * 1.7) % 2.5), r = 0.025 + 0.075 * Math.pow(Math.sin(Math.PI * t), 0.55);
      it.push([K.sphere(1, 4, 3), [Math.cos(a) * r * 1.15, Math.sin(a) * r * 0.95, t * 0.66], null, [0.016, 0.016, 0.022]]);
    }
    return merge(it);
  }, body.w);
  const head = body[3];
  const rhino = [-1, 1].map((s) => {
    const id = R.bone(head, [s * 0.04, 0.06, 0.08], [-0.35, 0, -s * 0.38]);
    R.add(rhinoM, id, () => {
      const it = [[K.cyl(0.006, 0.02, 0.3, 6), [0, 0.15, 0], null, 1]];
      for (let k = 0; k < 7; k++) it.push([K.cyl(0.021 - k * 0.0018, 0.021 - k * 0.0018, 0.012, 6), [0, 0.1 + k * 0.026, 0], null, 1]);
      return merge(it);
    });
    R.add(tipM, id, () => xf(K.sphere(1, 5, 4), [0, 0.3, 0], null, 0.01));
    return id;
  });
  const oral = [-1, 1].map((s) => R.chain(footM, head, [s * 0.05, -0.04, 0.13], [0.1, s * 0.9, 0], { len: 0.17, n: 2, r0: 0.018, r1: 0.008, radial: 5, segs: 5 }));
  // the gill plume: feathery fronds in a ring on the back, each on its own bone so they can fan out
  const gill = R.bone(body[1], [0, 0.08, 0.05]);
  const fronds = [];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * TAU;
    const id = R.bone(gill, [Math.cos(a) * 0.035, 0, Math.sin(a) * 0.035], [Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45]);
    R.add(gillM, id, () => {
      const it = [[K.cyl(0.004, 0.009, 0.14, 4), [0, 0.07, 0], null, 1]];
      for (let m = 0; m < 4; m++) for (const s of [-1, 1]) it.push([K.cyl(0.002, 0.005, 0.05, 3), [s * 0.016, 0.04 + m * 0.025, 0], [0, 0, -s * 1.0], 1]);
      return merge(it);
    });
    R.add(gillTip, id, () => xf(K.sphere(1, 4, 3), [0, 0.145, 0], null, 0.012));
    fronds.push(id);
  }
  const bones = R.build(near);
  K.shadow(root, 0.18, 0.4);

  K.mesh(K.capsule(0.08, 0.5, 3, 6), bodyM, [0, 0.08, 0.01], far, [Math.PI / 2, 0, 0], [1.2, 1, 1]);
  K.mesh(K.box(0.24, 0.025, 0.66), footM, [0, 0.03, 0.01], far);
  K.mesh(K.cone(0.03, 0.3, 4), rhinoM, [0, 0.33, 0.28], far, null, [3, 1, 1]);
  K.mesh(K.cone(0.07, 0.14, 5), gillM, [0, 0.22, -0.18], far);

  K.place(root, home);
  let flare = 0;
  const c = K.makeCreature({
    species: SPECIES['sea-slug-nudibranch'], root, home, radius: 0.36, eye: new THREE.Vector3(0, 0.18, 0.28),
    ground: K.groundY, speed: 0.22, roam: 2.5, fleeAt: 4, curiousAt: 14, shy: 0.3, rareChance: 0.65, rareAt: 'day',
    pose(c, dt, env) {
      const mov = moving(c);
      c.bob += dt * (mov ? 4 : 0.6);
      body.forEach((id, j) => turn(bones[id], mov ? Math.sin(c.bob - j * 1.2) * 0.05 : 0, Math.sin(env.t * 0.5 - j * 0.8 + c.bob) * 0.06, 0, dt * 4));
      bones[body[0]].scale.set(1, 1 + Math.sin(c.bob) * (mov ? 0.04 : 0.015), 1);
      K.look(c, bones[head], env, dt, { yaw: 0.35, pitch: 0.2, rate: 1.2 });
      if (c.state === 'eat') bones[head].rotation.x = ease(bones[head].rotation.x, 0.35, dt * 3);
      rhino.forEach((id, i) => turn(bones[id], Math.sin(env.t * 0.9 + i) * 0.08 - flare * 0.15, 0, Math.cos(env.t * 0.7 + i * 2) * 0.08 + (i ? -1 : 1) * flare * 0.2, dt * 4));
      oral.forEach((ids, i) => ids.forEach((id, j) => turn(bones[id], Math.sin(env.t * 1.4 + i + j) * 0.15, (i ? 1 : -1) * (0.2 + Math.sin(env.t * 1.1 + i) * 0.2) * j, 0, dt * 4)));
      flare = ease(flare, c.state === 'rare' ? 1 : 0, dt * 2.5);
      const g = bones[gill];
      g.scale.setScalar(1 + flare * 0.7 + Math.sin(env.t * 1.5) * 0.03);
      g.rotation.y += dt * (0.15 + flare * 1.2);
      fronds.forEach((id, k) => {
        const a = (k / 7) * TAU, o = 0.45 + flare * 0.55 + Math.sin(env.t * 2 + k) * 0.06;
        bones[id].rotation.set(Math.sin(a) * o, 0, -Math.cos(a) * o);
      });
      lit(gillM, flare * (2.5 + Math.sin(env.t * 6) * 1.2));
      lit(gillTip, flare * 3.5);
    },
  });
  return K.lod(c, near, far, 32);
}

// ---------------------------------------------------------------------------------------------
// Feather duster worms: a clump of leathery tubes, each opening into a funnel crown of feathery
// radioles, orange with white tips. They snap shut into the tubes when the van comes close and
// slowly open again. Rare: the crowns spin and glow.
export function buildFeatherDusterWorms(K, home, opts = {}) {
  const n = clamp(opts.n ?? 5, 3, 7);
  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  const tubeM = K.mat(0x7a5d45, { roughness: 0.95 }), collar = K.mat(0xc8324a, { roughness: 0.5 });
  const rad = K.fin(0xff8a3a, 0.92, 0.35), tips = flashFin(K, 0xf4f2ff, 0.95, 0.7);
  const R = new Rig(K, 'duster' + n);
  const worms = [];
  const NR = 16, L = 0.34;
  const comb = K.shape('radC', combPts(L * 0.62, 0.007, 6, 0.016)), combT = K.shape('radT', combPts(L * 0.38, 0.006, 4, 0.013).map(([x, y]) => [x, y + L * 0.6]));
  for (let i = 0; i < n; i++) {
    const a = i * 2.4, r = i ? 0.35 + (i % 3) * 0.22 : 0, h = 0.55 + ((i * 7) % 5) * 0.09;
    const base = R.bone(-1, [Math.cos(a) * r, 0, Math.sin(a) * r], [Math.sin(a) * 0.15 * (i ? 1 : 0), 0, -Math.cos(a) * 0.15 * (i ? 1 : 0)]);
    R.add(tubeM, base, () => merge([[K.cyl(0.05, 0.065, h, 7), [0, h / 2, 0], null, 1], [K.torus(0.055, 0.012, 3, 8), [0, h, 0], [Math.PI / 2, 0, 0], 1], [K.sphere(0.08, 7, 5), [0, 0.02, 0], null, [1, 0.5, 1]]]));
    const crown = R.bone(base, [0, h, 0]);
    R.add(collar, crown, () => xf(K.torus(0.045, 0.016, 4, 10), [0, 0.01, 0], [Math.PI / 2, 0, 0], 1));
    // radioles in a funnel: tilted out, the blade turned edge-on round the ring; white tips beyond
    const ring = (g) => merge(Array.from({ length: NR }, (_, k) => {
      const ang = (k / NR) * TAU;
      return [g, [Math.cos(ang) * 0.035, 0.01, Math.sin(ang) * 0.035], [0.75 + (k % 2) * 0.12, Math.PI / 2 - ang, 0.15], 1, 'YXZ'];
    }));
    R.add(rad, crown, () => ring(comb));
    R.add(tips, crown, () => ring(combT));
    worms.push({ base, crown, h, open: 1, delay: i * 0.35 });
  }
  const bones = R.build(near);

  K.mesh(K.cyl(0.4, 0.5, 0.5, 7), tubeM, [0, 0.25, 0], far);
  K.mesh(K.cone(0.55, 0.45, 8, true), rad, [0, 0.85, 0], far, [Math.PI, 0, 0]);
  K.mesh(K.torus(0.5, 0.05, 3, 12), tips, [0, 1.05, 0], far, [Math.PI / 2, 0, 0]);
  K.shadow(root, 0.85, 0.85);

  K.place(root, home);
  let glow = 0;
  const c = anchor(K.makeCreature({
    species: SPECIES['feather-duster-worm'], root, home, radius: 0.8, eye: new THREE.Vector3(0, 0.8, 0),
    ground: K.groundY, speed: 0, roam: 0, fleeAt: 7, curiousAt: 0, shy: 0.8, rareChance: 0.7, rareAt: 'dusk',
    pose(c, dt, env) {
      const scared = c.state === 'flee' || (c.near !== undefined && c.near < 6);
      if (scared) c.calm = 0; else c.calm = (c.calm ?? 9) + dt;
      glow = ease(glow, c.state === 'rare' ? 1 : 0, dt * 2);
      worms.forEach((w, i) => {
        const want = scared ? 0 : c.calm > 1.5 + w.delay ? 1 : w.open;
        w.open = want < w.open ? ease(w.open, want, dt * 10) : ease(w.open, want, dt * 0.7);     // snap shut, open slowly
        const o = smooth(w.open), cr = bones[w.crown];
        cr.scale.set(0.12 + 0.88 * o, 0.35 + 0.65 * o, 0.12 + 0.88 * o);
        cr.position.y = w.h - (1 - o) * 0.16;
        cr.rotation.y += dt * (0.05 + glow * 2.5) * (i % 2 ? 1 : -1);
        cr.rotation.x = Math.sin(env.t * 0.8 + i * 1.3) * 0.06 * o;
        cr.rotation.z = Math.cos(env.t * 0.7 + i) * 0.06 * o;
        bones[w.base].rotation.z = bones[w.base].userData.r0.z + Math.sin(env.t * 0.5 + i) * 0.03;
      });
      lit(tips, glow * (2 + 1.5 * Math.sin(env.t * 5)));
    },
  }), 3);
  return K.lod(c, near, far, 40);
}

// ---------------------------------------------------------------------------------------------
// Sea pens: tall feathery magenta quills standing in the silt, rows of curved polyp leaves either
// side of the stalk with glowing frilled edges. They sway; frightened, they sink into the floor.
// Rare: waves of light run up them, segment by segment.
export function buildSeaPens(K, home, opts = {}) {
  const n = clamp(opts.n ?? 4, 3, 6);
  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  const stalkM = K.mat(0xb2367c, { roughness: 0.55 }), leafM = K.fin(0xe7a2d4, 0.88, 0.35), bulb = K.mat(0x8a2e66, { roughness: 0.8 });
  const SEG = 5, edges = Array.from({ length: SEG }, () => flash(K, 0xffd4f4, 0.8));
  const R = new Rig(K, 'pen' + n);
  const pens = [];
  const LEN = 1.35;
  const leaf = K.shape('penLeaf', [[0, -0.018], [0.12, -0.03], [0.2, -0.012], [0.22, 0.012], [0.12, 0.022], [0, 0.016]]);
  for (let i = 0; i < n; i++) {
    const a = i * 2.2 + 0.4, r = i ? 0.55 + (i % 2) * 0.35 : 0;
    const base = R.bone(-1, [Math.cos(a) * r, 0, Math.sin(a) * r], [0, -a, 0]);
    R.add(bulb, base, () => xf(K.sphere(1, 8, 6), [0, 0.04, 0], null, [0.07, 0.12, 0.07]));
    const ids = R.chain(stalkM, base, [0, 0.12, 0], [-Math.PI / 2, 0, 0], { len: LEN, n: SEG, r0: 0.024, r1: 0.01, radial: 6, segs: 10, order: 'XYZ' });
    // leaves in pairs up the rachis, biggest in the middle
    ids.forEach((id, j) => {
      const it = [], ed = [];
      for (let k = 0; k < 3; k++) {
        const t = (j * 3 + k + 0.5) / (SEG * 3), z = (k + 0.5) * (LEN / SEG / 3), sz = 0.55 + Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.75;
        if (t < 0.08) continue;
        for (const s of [-1, 1]) {
          const rot = [0, s > 0 ? -0.35 : Math.PI + 0.35, s * 0.25];
          it.push([leaf, [0, 0, z], rot, [sz, 1.4, 1]]);
          const ex = 0.21 * sz;
          ed.push([K.box(0.025, 0.07, 0.025), [s * ex * Math.cos(0.35), 0, z + ex * Math.sin(0.35)], [0, 0, 0], 1]);
        }
      }
      if (it.length) { R.add(leafM, id, () => merge(it)); R.add(edges[j], id, () => merge(ed)); }
    });
    pens.push({ base, ids, sink: 0, sc: 0.85 + ((i * 5) % 4) * 0.12 });
  }
  const bones = R.build(near);
  pens.forEach((p) => bones[p.base].scale.setScalar(p.sc));

  K.mesh(K.cyl(0.03, 0.03, 1.4, 4), stalkM, [0, 0.7, 0], far);
  K.mesh(K.box(0.42, 1.0, 0.06), leafM, [0, 0.85, 0], far);
  K.mesh(K.box(0.42, 0.9, 0.06), leafM, [0.7, 0.75, 0.3], far, [0, 1, 0]);
  K.mesh(K.box(0.4, 0.8, 0.06), leafM, [-0.6, 0.7, -0.4], far, [0, 2, 0]);

  K.place(root, home);
  let wave = 0;
  const c = anchor(K.makeCreature({
    species: SPECIES['sea-pen'], root, home, radius: 0.9, eye: new THREE.Vector3(0, 1.0, 0),
    ground: K.groundY, speed: 0, roam: 0, fleeAt: 4, curiousAt: 0, shy: 0.5, rareChance: 0.7, rareAt: 'night',
    pose(c, dt, env) {
      wave = ease(wave, c.state === 'rare' ? 1 : 0, dt * 2);
      pens.forEach((p, i) => {
        p.sink = c.state === 'flee' ? ease(p.sink, 1, dt * 1.5) : ease(p.sink, 0, dt * 0.3);
        bones[p.base].position.y = -p.sink * 0.55 * p.sc;
        p.ids.forEach((id, j) => {
          const sw = Math.sin(env.t * 0.7 + i * 1.1 - j * 0.5) * (0.03 + j * 0.015), sw2 = Math.cos(env.t * 0.55 + i * 2 - j * 0.4) * (0.02 + j * 0.01);
          bones[id].rotation.set((j ? 0 : -Math.PI / 2) + sw, 0, sw2);
        });
      });
      // light climbs the pens segment by segment; a slow shimmer at night even without a show
      edges.forEach((m, j) => {
        const run = Math.pow(Math.max(0, Math.sin(env.t * 3.5 - j * 0.9)), 6);
        const idle = Math.pow(Math.max(0, Math.sin(env.t * 0.8 - j * 0.6)), 4) * 0.25 * K.glowLevel;
        lit(m, wave * run * 4 + idle);
      });
    },
  }), 3);
  return K.lod(c, near, far, 42);
}

// ---------------------------------------------------------------------------------------------
// Swimming sea cucumber: a translucent pink sac with its coiled gut showing through, a webbed veil
// over the front, a flower of glowing oral tentacles and a fringe of little feet at the back. It
// drifts nose-up. Rare: an undulating swim with a pink glow.
export function buildDeepSeaCucumber(K, home, opts = {}) {
  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  const bodyM = flashFin(K, 0xf1a2b6, 0.5, 0.35), veilM = K.fin(0xf3b0c2, 0.55, 0.35), feetM = K.fin(0xe46c8a, 0.75, 0.4);
  const gutM = K.mat(0xc68b52, { roughness: 0.7 }), oralM = flash(K, 0xff5a7a, 1.0), ringM = K.fin(0xffd8e2, 0.7, 0.5);

  const tilt = K.group([0, 0, 0], near, [-0.35, 0, 0]);
  const R = new Rig(K, 'cucumber');
  const prof = (t) => 0.3 * Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.42) / 0.6, 2))) + 0.03;
  const body = R.chain(bodyM, -1, [0, 0, 0.45], [0, Math.PI, 0], { len: 1.0, n: 3, prof, sx: 0.85, sy: 1, radial: 12, segs: 12 });
  R.add(bodyM, body[0], () => xf(K.geo('cucCap', () => new THREE.CircleGeometry(1, 12)), [0, 0, 0.0], null, [prof(0) * 0.85, prof(0), 1]));
  // the gut: a coiled tube inside
  R.add(gutM, body[0], () => K.tube('cucGut', [[0, 0, 0.02], [0.02, 0.0, 0.15], [-0.04, -0.03, 0.3], [0.08, -0.06, 0.42], [-0.08, -0.05, 0.52], [0.05, -0.1, 0.6], [-0.06, -0.1, 0.7], [0.03, -0.06, 0.8]], 0.022, 0.05, 6, 24), body.w);
  // little pointed feet round the back end
  R.add(feetM, body[2], () => merge(Array.from({ length: 9 }, (_, k) => {
    const a = Math.PI * (0.15 + 0.7 * (k / 8)) + Math.PI;
    return [K.cone(0.025, 0.12, 4), [Math.cos(a) * 0.13, Math.sin(a) * 0.15 - 0.02, 0.33], [Math.PI / 2 + 0.6, 0, -Math.cos(a) * 0.6], 1];
  })));
  // oral tentacles: a ring of glassy loops round a glowing red mouth on the front face
  R.add(ringM, body[0], () => merge(Array.from({ length: 12 }, (_, k) => { const a = (k / 12) * TAU; return [K.torus(0.035, 0.007, 3, 8), [Math.cos(a) * 0.12, Math.sin(a) * 0.12, -0.02], [0, 0, a], [1.3, 1, 1]]; })));
  R.add(oralM, body[0], () => merge([[K.sphere(1, 8, 6), [0, 0, -0.02], null, [0.09, 0.09, 0.03]], ...Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * TAU; return [K.sphere(1, 4, 3), [Math.cos(a) * 0.075, Math.sin(a) * 0.075, -0.025], null, 0.025]; })]));
  // the veil: two webbed halves over the front, curling down at the sides
  const veil = [-1, 1].map((s) => {
    const id = R.bone(-1, [0, 0, 0.2]);
    const g = K.geo('cucVeil' + s, () => new THREE.CylinderGeometry(0.4, 0.22, 0.36, 7, 2, true, s > 0 ? Math.PI * 0.42 : Math.PI, Math.PI * 0.58));
    R.add(veilM, id, () => xf(g, [0, 0.02, 0.17], [Math.PI / 2 - 0.2, 0, 0], 1));
    return id;
  });
  const bones = R.build(tilt);

  K.mesh(K.sphere(0.32, 10, 7), bodyM, [0, 0.1, -0.05], far, null, [0.85, 1, 1.6]);
  K.mesh(K.sphere(0.1, 6, 5), gutM, [0, 0.05, -0.1], far, null, [1, 1, 2.5]);
  K.mesh(K.cone(0.38, 0.3, 8, true), veilM, [0, 0.2, 0.42], far, [-Math.PI / 2 + 0.3, 0, 0]);
  K.mesh(K.sphere(0.1, 6, 5), oralM, [0, 0.12, 0.5], far);

  K.place(root, home);
  let show = 0;
  const c = K.makeCreature({
    species: SPECIES['deep-sea-cucumber'], root, home, radius: 0.6, eye: new THREE.Vector3(0, 0.15, 0.45), flyer: true,
    speed: 0.35, roam: 6, fleeAt: 5, curiousAt: 16, shy: 0.4, rareChance: 0.7, rareAt: 'dawn',
    pose(c, dt, env) {
      const vy = swimDepth(K, c, dt, env, { clear: 1.0, amp: 0.3, f: 0.3 });
      show = ease(show, c.state === 'rare' ? 1 : 0, dt * 2);
      const hz = 1.1 + show * 2 + (c.state === 'flee' ? 1.5 : 0);
      c.ph = (c.ph ?? c.bob) + dt * hz;
      tilt.rotation.x = ease(tilt.rotation.x, -0.35 - clamp(vy * 0.3, -0.3, 0.3) + show * 0.25, dt * 2);
      body.forEach((id, j) => turn(bones[id], Math.sin(c.ph - j * 1.1) * (0.06 + show * 0.18) * (j ? 1 : 0.4), 0, 0, dt * 6));
      veil.forEach((id, i) => turn(bones[id], Math.sin(c.ph * 1.0) * (0.15 + show * 0.25), 0, (i ? -1 : 1) * Math.sin(c.ph + 0.5) * (0.1 + show * 0.2), dt * 6));
      bones[body[0]].scale.set(1 + Math.sin(c.ph) * 0.03, 1 + Math.sin(c.ph) * 0.03, 1);
      lit(bodyM, show * (0.9 + 0.6 * Math.sin(env.t * 4)));
      lit(oralM, show * (2.5 + 1.5 * Math.sin(env.t * 4 + 1)) + (c.state === 'eat' ? 1 : 0));
    },
  });
  return K.lod(c, near, far, 40);
}

export const BUILDERS = {
  'coconut-octopus-glowing': buildCoconutOctopus,
  nautilus: buildNautilus,
  'leafy-seadragon': buildLeafySeadragon,
  jellyfish: buildJellyfish,
  'jellyfish-swarm': buildJellyfishSwarm,
  'goblin-shark': buildGoblinShark,
  'giant-isopod': buildGiantIsopod,
  'sea-slug-nudibranch': buildNudibranch,
  'feather-duster-worm': buildFeatherDusterWorms,
  'sea-pen': buildSeaPens,
  'deep-sea-cucumber': buildDeepSeaCucumber,
};
