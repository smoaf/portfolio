// Leafcutter ants (FEAT-009): a long column crossing the jungle road on the far bank, from a tree
// with chewed leaves on one side to a low earthen nest mound on the other.
//
//   leafcutter-ant   hundreds of reddish-brown workers on a worn, cleared trail. The loaded ones come
//                    down the trunk from the chewed leaves and walk to the mound, each with a cut
//                    half-moon of green leaf held high over its head like a sail, bobbing as it walks;
//                    others walk back empty. Bigger soldiers with huge heart-shaped heads and strong
//                    jaws patrol along the sides. The van drives over them; they simply carry on.
//                    The rare pose: a soldier by the road rears up, jaws wide open, facing the van.
//
// One species for the photo: a frame of the column counts once (its subject is the stretch of
// column the lens is aimed at). They work at night too.
//
// The ants are drawn with instancing (a handful of draw calls for the whole column) and moved along
// a precomputed trail every frame; on phones there are fewer of them. Like the frogs they are larger
// than life (`SIZE`: workers ~4 cm instead of ~1 cm), so the long lens can make them out from the van.
//
// The twist: the leaf pieces carry faint glowing veins and the soldiers' heads a faint glow; barely
// there by day, at night the column shows as a moving glowing line.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { perch } from './forest.js';

export const SPECIES = {
  'leafcutter-ant': { id: 'leafcutter-ant', name: 'Leafcutter ants', points: 190, call: { hz: 5200, kind: 'chirp' } },
};

const PI = Math.PI;
const SIZE = 4;                                     // × real size
const WORKER = 0.011 * SIZE, SOLDIER = 0.017 * SIZE; // body lengths, metres
const STEP = 0.01;                                  // the trail is sampled every centimetre
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => a + (b - a) * Math.min(1, k * dt);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---- geometry helpers: parts placed in an ant's own frame (unit body length, +z forward, +y up,
// feet at y 0), merged into one geometry per material
function part(g, p = [0, 0, 0], r = [0, 0, 0], s = 1) {
  g = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  const sc = Array.isArray(s) ? s : [s, s, s], rot = Array.isArray(r) ? r : [0, 0, 0];
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...sc)));
  return g;
}
function merge(parts) {
  const g = mergeGeometries(parts, false);
  parts.forEach((q) => q.dispose());
  g.computeBoundingSphere();
  return g;
}
const tube = (pts, r, seg = 4, rad = 3) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), seg, r, rad, false);

// The parts of an ant, by role: `rest` (gaster, waist, hind legs: they stay put when a soldier
// rears), `front` (thorax, spines, front and middle legs), `head` (the head capsule, coloured
// apart on soldiers for their glow), `face` (antennae), `jaws` ([left, right] mandibles, each
// pointing +z from its own hinge at `hinge`).
function antParts(soldier, detail) {
  const S = 1, sph = (w, h) => new THREE.SphereGeometry(1, w, h);
  const hd = soldier ? 1.55 : 1;                    // the head: much bigger on a soldier
  const rest = [], front = [], head = [], face = [];
  // gaster (the round rear) and the two waist nodes
  rest.push(part(sph(detail ? 7 : 4, detail ? 5 : 3), [0, 0.17, -0.31], [0.25, 0, 0], [0.15, 0.13, 0.18]));
  if (detail) { rest.push(part(sph(5, 3), [0, 0.18, -0.1], 0, 0.045)); rest.push(part(sph(5, 3), [0, 0.19, -0.04], 0, 0.05)); }
  // the thorax, with its paired spines (leafcutters are spiny)
  front.push(part(sph(detail ? 6 : 4, detail ? 5 : 3), [0, 0.21, 0.08], [-0.25, 0, 0], [0.075, 0.08, 0.15]));
  if (detail) for (const x of [-1, 1]) {
    front.push(part(new THREE.ConeGeometry(0.018, 0.08, 3), [x * 0.04, 0.3, 0.13], [-0.5, 0, x * 0.45]));
    front.push(part(new THREE.ConeGeometry(0.015, 0.07, 3), [x * 0.03, 0.28, 0.01], [-0.95, 0, x * 0.3]));
  }
  // the head: two lobes at the back (the heart shape) and the face in front
  const hy = 0.22 + (hd - 1) * 0.06, hz = 0.28 + (hd - 1) * 0.06;
  if (detail || soldier) for (const x of [-1, 1]) head.push(part(sph(detail ? 6 : 4, detail ? 5 : 3), [x * 0.05 * hd, hy + 0.01 * hd, hz - 0.02 * hd], 0, [0.075 * hd, 0.085 * hd, 0.085 * hd]));
  head.push(part(sph(detail ? 6 : 4, detail ? 5 : 3), [0, hy - 0.01, hz + 0.03 * hd], 0, detail || soldier ? [0.08 * hd, 0.072 * hd, 0.075 * hd] : [0.11, 0.09, 0.1]));
  const hinge = [0.035 * hd, hy - 0.04 * hd, hz + 0.09 * hd];
  const jaw = (x) => part(new THREE.ConeGeometry(0.024 * hd, 0.11 * hd, 4), [0, 0, 0.05 * hd], [PI / 2, 0, x * 0.45]);
  const jaws = [jaw(1), jaw(-1)];                   // [the one on +x, the one on -x], each at its hinge
  if (detail) for (const x of [-1, 1]) {
    // antennae: the long scape up and out, then the bent tip forward
    face.push(part(tube([[x * 0.04 * hd, hy + 0.05 * hd, hz + 0.06 * hd], [x * 0.13, hy + 0.15, hz + 0.1], [x * 0.17, hy + 0.12, hz + 0.28]], 0.011, 3, 3)));
    // six legs: hip under the thorax, knee up and out, foot on the ground
    for (const [z, fz] of [[0.14, 0.18], [0.07, 0.02], [0.0, -0.2]]) {
      (z === 0 ? rest : front).push(part(tube([[x * 0.04, 0.16, z], [x * 0.17, 0.25, z + fz * 0.35], [x * 0.27, 0.0, z + fz]], 0.014, 2, 3)));
    }
  } else {
    // far away: the legs as one flat bar each side
    front.push(part(new THREE.BoxGeometry(0.5, 0.02, 0.3), [0, 0.07, 0.04]));
  }
  return { rest, front, head, face, jaws, hinge, S };
}

// a cut leaf piece, held up in the jaws like a sail: a rough half-moon standing in the ant's own
// plane (x 0), its straight edge leaning back over the body from the jaws. Returns the leaf and its
// veins (thin strips on both faces).
function leafPiece() {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * PI;
    const r = 1 + 0.1 * Math.sin(a * 3 + 1) + 0.05 * Math.sin(a * 7);
    pts.push([0.55 * (1 - Math.cos(a)), 0.62 * Math.sin(a) * r]);
  }
  for (let i = 1; i < 8; i++) { const s = 1.1 - (i / 8) * 1.1; pts.push([s, 0.025 * Math.sin(s * 11)]); }
  const at = (s, t) => [0, 0.24 + t + 0.28 * s, 0.4 - s];          // from the shape's plane to the ant's frame
  const shape = new THREE.Shape(pts.map(([s, t]) => new THREE.Vector2(s, t)));
  const g = new THREE.ShapeGeometry(shape);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const v = at(p.getX(i), p.getY(i)); p.setXYZ(i, ...v); }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  // veins: the old leaf's midrib along one side and the side veins branching off it
  const strips = [];
  const strip = (a, b, w) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L * w, ny = dx / L * w;
    for (const x of [-0.006, 0.006]) {
      const q = [[a[0] + nx, a[1] + ny], [a[0] - nx, a[1] - ny], [b[0] - nx, b[1] - ny], [b[0] + nx, b[1] + ny]].map(([s, t]) => { const v = at(s, t); v[0] = x; return v; });
      strips.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
    }
  };
  strip([0.1, 0.06], [1.0, 0.24], 0.016);
  for (const [s, k] of [[0.22, 0.42], [0.42, 0.52], [0.62, 0.5], [0.82, 0.34]]) {
    const t0 = 0.06 + (s - 0.1) / 0.9 * 0.18;
    strip([s, t0], [s + 0.24 * k, t0 + k], 0.009);                     // the side veins run off towards the tip
  }
  const v = new THREE.BufferGeometry();
  v.setAttribute('position', new THREE.Float32BufferAttribute(strips, 3));
  v.computeVertexNormals();
  return { leaf: g, veins: v };
}

// a whole leaf on the tree, ~22 cm, in its own plane (x right, y along the leaf from the stalk);
// `bites` are half-moons cut out of its edge: [y along the leaf, side -1/1, radius]
function treeLeaf(bites) {
  const out = [];
  const N = 48;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * PI * 2;
    let x = Math.sin(a) * 0.065, y = 0.11 - Math.cos(a) * 0.11;
    x *= 0.6 + 0.4 * Math.sin(Math.min(PI, (y / 0.22) * PI * 1.1));           // broad in the middle, a pointed tip
    for (const [by, side, r] of bites) {
      const cx = side * 0.075, cy = by, dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
      if (d < r) { x = cx + (dx / (d || 1)) * r; y = cy + (dy / (d || 1)) * r; }
    }
    out.push(new THREE.Vector2(x, y));
  }
  const g = new THREE.ShapeGeometry(new THREE.Shape(out));
  g.deleteAttribute('uv');
  return g;
}

// =============================================================================================
// The colony. home: where the soldier that rears up stands (the route puts it by the road edge).
// opts: path ([Vector3] on the ground from the tree's foot across the road to the mound), tree
// ({ foot, r: trunk radius at the foot, taper: radius lost per metre up }), mound ({ at, r }).
export function buildLeafcutters(K, home, opts) {
  const phone = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const N = phone ? { loaded: 140, empty: 50, soldiers: 12 } : { loaded: 300, empty: 110, soldiers: 28 };
  let seed = 9091;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const lum = Math.max(0.03, K.glowLevel - 0.25);                         // ~0.05 by day, ~2.2 at night
  const groundY = K.groundY;

  // ---- materials
  const bodyM = K.mat(0x7a3418, { roughness: 0.45, metalness: 0.05 });            // reddish-brown, a dull sheen
  const legM = bodyM;
  const headS = K.mat(0x6e2c14, { roughness: 0.45, metalness: 0.05, emissive: 0x8af0ff, emissiveIntensity: lum * 0.22 });
  const leafM = K.mat(0xffffff, { roughness: 0.75, side: THREE.DoubleSide, emissive: 0x3a8a3a, emissiveIntensity: lum * 0.05 });
  const veinM = K.mat(0x9fd890, { roughness: 0.6, side: THREE.DoubleSide, emissive: 0xa8ffcf, emissiveIntensity: lum * 0.55, polygonOffset: true, polygonOffsetFactor: -2 });
  const soilM = K.mat(0xffffff, { vertexColors: true, roughness: 1 });
  const holeM = K.mat(0x1a120c, { roughness: 1 });
  const treeLeafM = K.mat(0x3f7a2c, { roughness: 0.7, side: THREE.DoubleSide });
  const barkM = K.mat(0x5a4c3c, { roughness: 0.95 });

  // ---- the mound: a low dome of loose orange-brown earth with entrance holes
  const M = opts.mound, MR = M.r, MH = 0.32;
  const moundH = (x, z) => {
    const dx = x - M.at.x, dz = z - M.at.z, r = Math.hypot(dx, dz) / MR;
    if (r >= 1) return 0;
    const a = Math.atan2(dz, dx);
    return MH * Math.pow(0.5 + 0.5 * Math.cos(PI * r), 1.3) * (1 + 0.1 * Math.sin(a * 5 + 1) + 0.06 * Math.sin(a * 11 + r * 9));
  };
  const height = (x, z) => groundY(x, z) + moundH(x, z);
  const normalAt = (x, z, out) => {
    const e = 0.04;
    return out.set(height(x - e, z) - height(x + e, z), 2 * e, height(x, z - e) - height(x, z + e)).normalize();
  };
  const holes = [];
  {
    const last = opts.path[opts.path.length - 1], toRoad = Math.atan2(last.z - M.at.z, last.x - M.at.x);
    [[0, 0.42], [1.4, 0.3], [2.6, 0.55], [3.7, 0.2], [4.9, 0.5]].forEach(([a, r]) => {
      const x = M.at.x + Math.cos(toRoad + a) * r * MR, z = M.at.z + Math.sin(toRoad + a) * r * MR;
      holes.push(new THREE.Vector3(x, height(x, z), z));
    });
  }
  const statics = K.group();
  {
    const RINGS = 12, SEG = 30, pos = [], col = [], idx = [];
    const cA = new THREE.Color(0x7a5030), cB = new THREE.Color(0x5a3c24), cC = new THREE.Color(0x8e5e36);
    for (let i = 0; i <= RINGS; i++) for (let j = 0; j < SEG; j++) {
      const r = (i / RINGS) * MR * 1.04, a = (j / SEG) * PI * 2;
      const x = M.at.x + Math.cos(a) * r, z = M.at.z + Math.sin(a) * r;
      pos.push(x, height(x, z) + (i === RINGS ? -0.02 : 0.006), z);
      const n = 0.5 + 0.5 * Math.sin(x * 23 + z * 17) * Math.sin(x * 7 - z * 11);
      const c = cA.clone().lerp(cB, n * 0.6).lerp(cC, (1 - i / RINGS) * 0.35);
      col.push(c.r, c.g, c.b);
    }
    for (let i = 0; i < RINGS; i++) for (let j = 0; j < SEG; j++) {
      const a = i * SEG + j, b = i * SEG + (j + 1) % SEG, c = a + SEG, d = b + SEG;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    statics.add(new THREE.Mesh(K.keep(g), soilM));
    // the entrance holes: dark mouths with a little crater of excavated earth round each
    const n = new THREE.Vector3(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
    const holeG = K.geo('ant-hole', () => new THREE.CircleGeometry(1, 10).rotateX(-PI / 2));
    const rimG = K.geo('ant-rim', () => new THREE.TorusGeometry(1, 0.35, 4, 12).rotateX(PI / 2));
    const rimM = K.mat(0x8a5a34, { roughness: 1 });
    holes.forEach((h, i) => {
      normalAt(h.x, h.z, n);
      q.setFromUnitVectors(Y, n);
      const s = i === 0 ? 0.05 : 0.03 + 0.012 * (i % 2);
      const hole = new THREE.Mesh(holeG, holeM); hole.position.copy(h).addScaledVector(n, 0.012); hole.quaternion.copy(q); hole.scale.set(s, 1, s * 0.8);
      const rim = new THREE.Mesh(rimG, rimM); rim.position.copy(h).addScaledVector(n, 0.006); rim.quaternion.copy(q); rim.scale.set(s * 1.35, s * 0.5, s * 1.1);
      statics.add(hole, rim);
    });
    // loose crumbs of earth round the mound
    const crumbG = K.geo('ant-crumb', () => new THREE.IcosahedronGeometry(1, 0));
    for (let i = 0; i < 40; i++) {
      const a = rand() * PI * 2, r = MR * (0.85 + rand() * 0.35), x = M.at.x + Math.cos(a) * r, z = M.at.z + Math.sin(a) * r;
      const cr = new THREE.Mesh(crumbG, rimM); cr.position.set(x, height(x, z) + 0.004, z); cr.scale.setScalar(0.012 + rand() * 0.02); cr.rotation.set(rand() * 3, rand() * 3, 0);
      statics.add(cr);
    }
  }

  // ---- the tree: a low branch off the trunk, on the road side, its leaves chewed into half-moons
  const T = opts.tree, toRoad0 = new THREE.Vector3(opts.path[1].x - T.foot.x, 0, opts.path[1].z - T.foot.z).normalize();
  const rAt = (h) => T.r - T.taper * h;
  const BH = 1.45;                                                        // the branch's height
  const side0 = new THREE.Vector3(-toRoad0.z, 0, toRoad0.x);
  const bDir = toRoad0.clone().multiplyScalar(0.75).addScaledVector(side0, 0.66).normalize();   // reaching out, half along the road
  const bStart = T.foot.clone().addScaledVector(bDir, rAt(BH) * 0.9).setY(T.foot.y + BH);
  const bLen = 1.1, bEnd = bStart.clone().addScaledVector(bDir, bLen).setY(bStart.y + 0.18);
  {
    const twig = (a, b, r0, r1) => {
      const d = new THREE.Vector3().subVectors(b, a), L = d.length();
      const g = new THREE.CylinderGeometry(r1, r0, L, 6).translate(0, L / 2, 0);
      const m = new THREE.Mesh(K.keep(g), barkM); m.position.copy(a); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      statics.add(m);
    };
    twig(bStart.clone().addScaledVector(bDir, -0.2), bEnd, 0.05, 0.022);
    const forks = [];
    for (let i = 0; i < 4; i++) {
      const a = bStart.clone().lerp(bEnd, 0.35 + i * 0.2);
      const b = a.clone().add(new THREE.Vector3((rand() - 0.5) * 0.7, 0.15 + rand() * 0.3, (rand() - 0.5) * 0.7));
      twig(a, b, 0.018, 0.008); forks.push([a, b]);
    }
    // the leaves: a few whole, most with one to four bites taken out of the edge
    const shapes = [treeLeaf([]), treeLeaf([[0.12, 1, 0.035]]), treeLeaf([[0.08, -1, 0.04], [0.16, 1, 0.03]]),
      treeLeaf([[0.06, 1, 0.035], [0.12, -1, 0.04], [0.17, 1, 0.032], [0.1, 1, 0.03]]), treeLeaf([[0.14, -1, 0.05], [0.07, 1, 0.045]])];
    const parts = [], m4 = new THREE.Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
    const spots = [];
    for (const [a, b] of forks) for (let k = 0; k < 4; k++) spots.push(a.clone().lerp(b, 0.3 + k * 0.23));
    for (let k = 0; k < 6; k++) spots.push(bStart.clone().lerp(bEnd, 0.25 + k * 0.15));
    spots.forEach((p, i) => {
      const g = shapes[i % 7 === 0 ? 0 : 1 + (i % 4)].clone();
      e.set(-0.9 + rand() * 1.6, rand() * PI * 2, (rand() - 0.5) * 0.8);
      m4.compose(p, q.setFromEuler(e), s.setScalar(0.8 + rand() * 0.4));
      g.applyMatrix4(m4);
      parts.push(g);
    });
    const leaves = merge(parts);
    leaves.computeVertexNormals();
    statics.add(new THREE.Mesh(K.keep(leaves), treeLeafM));
  }

  // ---- the trail: from the leaves along the branch, down the trunk, across the ground to the mound
  // hole, sampled every centimetre with its frame (forward, up, right)
  const raw = [], ups = [];
  const pushPt = (p, up) => { raw.push(p); ups.push(up); };
  const Y = new THREE.Vector3(0, 1, 0);
  for (let k = 0; k <= 20; k++) pushPt(bEnd.clone().lerp(bStart, k / 20).setY(bEnd.y + (bStart.y - bEnd.y) * k / 20 + 0.03), Y);
  const out0 = toRoad0.clone();                                           // round the trunk to its road side, then down
  const a0 = Math.atan2(bDir.z, bDir.x), a1 = Math.atan2(out0.z, out0.x), da = wrap(a1 - a0);
  for (let k = 1; k < 8; k++) {
    const a = a0 + da * k / 8, o = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    pushPt(T.foot.clone().addScaledVector(o, rAt(BH) * 0.92 + 0.012).setY(T.foot.y + BH + 0.02), o);
  }
  for (let k = 0; k <= 30; k++) {
    const h = BH * (1 - k / 30);
    pushPt(T.foot.clone().addScaledVector(out0, rAt(h) * 0.92 + 0.012).setY(T.foot.y + h), out0);
  }
  const ground = new THREE.CatmullRomCurve3(opts.path.map((p, i) => (i === 0 ? T.foot.clone().addScaledVector(out0, rAt(0) + 0.02) : p.clone())).concat([holes[0].clone()]), false, 'centripetal');
  const gN = Math.ceil(ground.getLength() / 0.05);
  for (let k = 1; k <= gN; k++) { const p = ground.getPointAt(k / gN); p.y = height(p.x, p.z) + 0.004; pushPt(p, null); }
  pushPt(holes[0].clone().setY(holes[0].y - 0.08), null);                 // and down into the hole
  // resample at STEP with the frames
  const segL = [0];
  for (let i = 1; i < raw.length; i++) segL.push(segL[i - 1] + raw[i].distanceTo(raw[i - 1]));
  const LEN = segL[segL.length - 1], NS = Math.ceil(LEN / STEP) + 1;
  const PA = new Float32Array(NS * 3), FA = new Float32Array(NS * 3), UA = new Float32Array(NS * 3), XA = new Float32Array(NS * 3);
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), vD = new THREE.Vector3();
  let seg = 0;
  for (let i = 0; i < NS; i++) {
    const s = Math.min(LEN, i * STEP);
    while (seg < raw.length - 2 && segL[seg + 1] < s) seg++;
    const k = (s - segL[seg]) / Math.max(1e-6, segL[seg + 1] - segL[seg]);
    vA.copy(raw[seg]).lerp(raw[seg + 1], k);
    vB.subVectors(raw[seg + 1], raw[seg]).normalize();                    // forward
    const up = ups[seg] || normalAt(vA.x, vA.z, vC);
    vD.crossVectors(up, vB).normalize();                                   // right
    vC.crossVectors(vB, vD).normalize();                                   // up, square to forward
    vA.toArray(PA, i * 3); vB.toArray(FA, i * 3); vC.toArray(UA, i * 3); vD.toArray(XA, i * 3);
  }
  const groundFrom = segL[raw.length - gN - 2] || 0;                      // where the trail meets the ground (the trunk's foot)

  // the worn trail on the ground: a strip of bare, packed earth, ragged at its edges
  {
    const pos = [], col = [], idx = [], c0 = new THREE.Color(0x684a30), c1 = new THREE.Color(0x56432c);
    const i0 = Math.floor(groundFrom / STEP), i1 = NS - 10;
    let n = 0;
    for (let i = i0; i <= i1; i += 4) {
      const w = 0.075 + 0.02 * Math.sin(i * 0.031) + 0.012 * Math.sin(i * 0.11);
      for (const sd of [-1, 0, 1]) {
        const x = PA[i * 3] + XA[i * 3] * w * sd, z = PA[i * 3 + 2] + XA[i * 3 + 2] * w * sd;
        pos.push(x, height(x, z) + 0.008 + (sd ? 0 : 0.002), z);
        const c = sd ? c1 : c0; col.push(c.r, c.g, c.b);
      }
      if (n > 0) { const a = (n - 1) * 3, b = n * 3; idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2); }
      n++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    statics.add(new THREE.Mesh(K.keep(g), K.mat(0xffffff, { vertexColors: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 })));
  }
  K.bake(statics);
  K.scene.add(statics);

  // ---- the column: instanced bodies, leaves, veins and soldiers
  const W = { near: antParts(false, true), far: antParts(false, false) };
  const S = { near: antParts(true, true), far: antParts(true, false) };
  const jawsAt = (P, open = 0) => P.jaws.map((g, i) => part(g, [P.hinge[0] * (i ? -1 : 1), P.hinge[1], P.hinge[2]], [0, (i ? -1 : 1) * open, 0]));
  const workerNear = K.keep(merge([...W.near.rest, ...W.near.front, ...W.near.head, ...W.near.face, ...jawsAt(W.near)]));
  const workerFar = K.keep(merge([...W.far.rest, ...W.far.front, ...W.far.head]));
  const soldierNear = K.keep(merge([...S.near.rest, ...S.near.front, ...S.near.face, ...jawsAt(S.near, 0.15)]));
  const soldierHead = K.keep(merge([...S.near.head]));
  const soldierFar = K.keep(merge([...S.far.rest, ...S.far.front]));
  const soldierHeadFar = K.keep(merge([...S.far.head]));
  const LP = leafPiece(), leafG = K.keep(LP.leaf), veinG = K.keep(LP.veins);
  const NW = N.loaded + N.empty;
  const inst = (g, m, n) => { const im = new THREE.InstancedMesh(g, m, n); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); return im; };
  const mesh = {
    wNear: inst(workerNear, bodyM, NW), wFar: inst(workerFar, bodyM, NW),
    leaf: inst(leafG, leafM, N.loaded), vein: inst(veinG, veinM, N.loaded),
    sNear: inst(soldierNear, legM, N.soldiers), sHead: inst(soldierHead, headS, N.soldiers),
    sFar: inst(soldierFar, legM, N.soldiers), sHeadFar: inst(soldierHeadFar, headS, N.soldiers),
  };
  // every mesh covers the whole column (the ants move inside it): one sphere for the frustum test
  const box = new THREE.Box3();
  for (let i = 0; i < NS; i += 10) box.expandByPoint(vA.fromArray(PA, i * 3));
  const ball = box.getBoundingSphere(new THREE.Sphere());
  ball.radius += 0.3;
  const colony = new THREE.Group();
  for (const m of Object.values(mesh)) { m.boundingSphere = ball.clone(); colony.add(m); }
  colony.visible = false;                                                 // until the first step has placed them
  K.scene.add(colony);
  // the leaf pieces in many greens, fresh to a little yellowed
  const greens = [0x4f9a34, 0x5aa83c, 0x3f8a2e, 0x6aae3e, 0x78b444, 0x4a8f3a, 0x8fb84a];
  const cA = new THREE.Color();
  for (let i = 0; i < N.loaded; i++) mesh.leaf.setColorAt(i, cA.setHex(greens[i % greens.length]).offsetHSL(0, 0, (rand() - 0.5) * 0.06));
  mesh.leaf.instanceColor.needsUpdate = true;

  // each ant: where it is on the trail at t 0, its pace, how far off the middle it walks, its phase
  const ants = [];
  for (let i = 0; i < N.loaded; i++) ants.push({ s0: ((i + rand() * 0.8) / N.loaded) * LEN, v: 0.075 + rand() * 0.02, lat: (rand() - 0.5) * 0.06, ph: rand() * 6.28, sc: 0.9 + rand() * 0.2, ls: 0.85 + rand() * 0.35 });
  for (let i = 0; i < N.empty; i++) ants.push({ s0: ((i + rand()) / N.empty) * LEN, v: -(0.1 + rand() * 0.03), lat: 0.035 * (rand() < 0.5 ? -1 : 1) + (rand() - 0.5) * 0.03, ph: rand() * 6.28, sc: 0.85 + rand() * 0.2 });
  const soldiers = [];
  for (let i = 0; i < N.soldiers; i++) soldiers.push({ s0: ((i + rand()) / N.soldiers) * LEN, v: (rand() < 0.5 ? -1 : 1) * (0.02 + rand() * 0.035), lat: (i % 2 ? -1 : 1) * (0.075 + rand() * 0.035), ph: rand() * 6.28, sc: 0.9 + rand() * 0.2, pause: rand() * 10 });

  // the frame at trail position s (metres), into `o` (an array of 16, column-major)
  const fr = { x: [0, 0, 0], u: [0, 0, 0], f: [0, 0, 0], p: [0, 0, 0] };
  function frameAt(s, back) {
    const f = Math.min(NS - 1.001, Math.max(0, s / STEP)), i = Math.floor(f), k = f - i, b = back ? -1 : 1;
    for (let a = 0; a < 3; a++) {
      fr.p[a] = PA[i * 3 + a] + (PA[i * 3 + 3 + a] - PA[i * 3 + a]) * k;
      fr.f[a] = FA[i * 3 + a] * b; fr.x[a] = XA[i * 3 + a] * b; fr.u[a] = UA[i * 3 + a];
    }
    return fr;
  }
  const put = (arr, j, X, U, F, P, sc) => {
    const o = j * 16;
    arr[o] = X[0] * sc; arr[o + 1] = X[1] * sc; arr[o + 2] = X[2] * sc; arr[o + 3] = 0;
    arr[o + 4] = U[0] * sc; arr[o + 5] = U[1] * sc; arr[o + 6] = U[2] * sc; arr[o + 7] = 0;
    arr[o + 8] = F[0] * sc; arr[o + 9] = F[1] * sc; arr[o + 10] = F[2] * sc; arr[o + 11] = 0;
    arr[o + 12] = P[0]; arr[o + 13] = P[1]; arr[o + 14] = P[2]; arr[o + 15] = 1;
  };
  const P0 = [0, 0, 0], X1 = [0, 0, 0], U1 = [0, 0, 0], F1 = [0, 0, 0], PIV = [0, 0.24, 0.4];
  let far = false;
  function stepColumn(t, dt) {
    const wArr = (far ? mesh.wFar : mesh.wNear).instanceMatrix.array, lArr = mesh.leaf.instanceMatrix.array, vArr = mesh.vein.instanceMatrix.array;
    for (let j = 0; j < ants.length; j++) {
      const a = ants[j], back = a.v < 0;
      const s = ((a.s0 + a.v * t) % LEN + LEN) % LEN;
      const F = frameAt(s, back);
      // in and out at the ends: they come out of the leaves and go down into the hole
      const sc = WORKER * a.sc * smooth(0, 0.06, s) * smooth(LEN, LEN - 0.07, s);
      const st = t * (back ? 19 : 15) + a.ph;                              // the stride
      const wob = Math.sin(st) * 0.004, bob = Math.abs(Math.sin(st)) * 0.0012;
      for (let k = 0; k < 3; k++) P0[k] = F.p[k] + F.x[k] * (a.lat + wob) + F.u[k] * bob;
      put(wArr, j, F.x, F.u, F.f, P0, sc);
      if (back) continue;
      // the leaf: held at the jaws (PIV), rocking side to side and nodding with the stride
      const roll = 0.16 * Math.sin(st * 0.5 + a.ph) + 0.05 * Math.sin(st), pitch = 0.07 * Math.sin(st + 1.3) - 0.05;
      const cr = Math.cos(roll), sr = Math.sin(roll), cp = Math.cos(pitch), sp = Math.sin(pitch);
      // columns of Rz(roll)·Rx(pitch) in the ant's frame, then into the world
      const c0 = [cr, sr, 0], c1 = [-sr * cp, cr * cp, sp], c2 = [sr * sp, -cr * sp, cp];
      const ls = a.ls;
      for (let k = 0; k < 3; k++) {
        X1[k] = F.x[k] * c0[0] + F.u[k] * c0[1] + F.f[k] * c0[2];
        U1[k] = (F.x[k] * c1[0] + F.u[k] * c1[1] + F.f[k] * c1[2]) * ls;
        F1[k] = (F.x[k] * c2[0] + F.u[k] * c2[1] + F.f[k] * c2[2]) * ls;
      }
      // the pivot stays at the jaws: p - R·p, in the ant's frame
      const qx = PIV[0] - (c0[0] * PIV[0] + c1[0] * PIV[1] * ls + c2[0] * PIV[2] * ls);
      const qy = PIV[1] - (c0[1] * PIV[0] + c1[1] * PIV[1] * ls + c2[1] * PIV[2] * ls);
      const qz = PIV[2] - (c0[2] * PIV[0] + c1[2] * PIV[1] * ls + c2[2] * PIV[2] * ls);
      for (let k = 0; k < 3; k++) P0[k] += (F.x[k] * qx + F.u[k] * qy + F.f[k] * qz) * sc;
      put(lArr, j, X1, U1, F1, P0, sc);
      put(vArr, j, X1, U1, F1, P0, sc);
    }
    const sArr = (far ? mesh.sFar : mesh.sNear).instanceMatrix.array, hArr = (far ? mesh.sHeadFar : mesh.sHead).instanceMatrix.array;
    for (let j = 0; j < soldiers.length; j++) {
      const a = soldiers[j];
      // soldiers stroll, stop now and then to stand guard, and stroll on
      const walk = t - Math.floor((t + a.pause) / 9) * 9 > 2.5 ? 1 : 0;
      a.s = a.s ?? a.s0;
      a.s = ((a.s + a.v * walk * dt) % LEN + LEN) % LEN;
      const s = Math.min(LEN - 0.3, Math.max(0.3, a.s));
      const F = frameAt(s, a.v < 0);
      const sc = SOLDIER * a.sc, st = t * 9 + a.ph;
      for (let k = 0; k < 3; k++) P0[k] = F.p[k] + F.x[k] * a.lat * (a.v < 0 ? -1 : 1) + F.u[k] * Math.abs(Math.sin(st)) * 0.0015 * walk;
      put(sArr, j, F.x, F.u, F.f, P0, sc);
      put(hArr, j, F.x, F.u, F.f, P0, sc);
    }
    for (const m of Object.values(mesh)) m.instanceMatrix.needsUpdate = true;
  }

  // ---- the soldier by the road that rears up at the van (the rare pose); its own body, so its jaws
  // and its front can move
  const root = K.group(), near = K.group(null, root);
  const iH = (() => { let best = 0, bd = Infinity; for (let i = 0; i < NS; i++) { const d = (PA[i * 3] - home.x) ** 2 + (PA[i * 3 + 2] - home.z) ** 2; if (d < bd) { bd = d; best = i; } } return best; })();
  const hF = new THREE.Vector3().fromArray(FA, iH * 3), hX = new THREE.Vector3().fromArray(XA, iH * 3);
  const spot = new THREE.Vector3().fromArray(PA, iH * 3).addScaledVector(hX, 0.13);
  const restYaw = Math.atan2(hX.x + hF.x * 0.6, hX.z + hF.z * 0.6);      // facing out from the column, half along it
  const turn = K.group(null, near);                                       // turns it towards the van
  const body = K.group(null, turn);
  body.scale.setScalar(SOLDIER * 1.08);
  const PIVOT = [0, 0.18, -0.08];
  for (const g of S.near.rest) K.mesh(g, bodyM, [0, 0, 0], body);
  const fore = K.group(PIVOT, body);                                      // thorax, head and front legs: they rear
  const back = (g) => { g.translate(-PIVOT[0], -PIVOT[1], -PIVOT[2]); return g; };
  for (const g of S.near.front) K.mesh(back(g.clone()), bodyM, [0, 0, 0], fore);
  for (const g of S.near.face) K.mesh(back(g.clone()), bodyM, [0, 0, 0], fore);
  for (const g of S.near.head) K.mesh(back(g.clone()), headS, [0, 0, 0], fore);
  const jawG = S.near.jaws.map((g, i) => {
    const j = K.group([S.near.hinge[0] * (i ? -1 : 1) - PIVOT[0], S.near.hinge[1] - PIVOT[1], S.near.hinge[2] - PIVOT[2]], fore);
    K.mesh(g, bodyM, [0, 0, 0], j);
    return j;
  });
  K.place(root, spot);
  const headLocal = new THREE.Vector3(0, S.near.hinge[1] + 0.06 - PIVOT[1], S.near.hinge[2] - PIVOT[2]);

  const c = perch(K.makeCreature({
    species: SPECIES['leafcutter-ant'], root, home: spot, radius: 0.32, eye: new THREE.Vector3(0, 0.05, 0),
    ground: K.groundY, speed: 0, roam: 0, fleeAt: 0, curiousAt: 0, shy: 1, rareChance: 0, yaw: restYaw,
    pose(c, dt, env) {
      const rare = c.state === 'rare';
      R.up = damp(R.up, rare ? 1 : 0, rare ? 5 : 2.5, dt);
      R.open = damp(R.open, rare ? 1 : 0, rare ? 7 : 3, dt);
      // reared up on the hind legs, jaws wide, the front swaying a little
      fore.rotation.x = -1.0 * R.up + 0.06 * R.up * Math.sin(env.t * 5);
      const jo = 0.12 + 0.75 * R.open + 0.08 * R.open * Math.sin(env.t * 14);
      jawG[0].rotation.y = jo * 0.9; jawG[1].rotation.y = -jo * 0.9;
      // facing the van while it rears, otherwise a slow look along the column
      const want = rare ? wrap(Math.atan2(env.camPos.x - spot.x, env.camPos.z - spot.z) - restYaw) : 0.35 * Math.sin(env.t * 0.4 + c.bob);
      turn.rotation.y += wrap(want - turn.rotation.y) * Math.min(1, dt * (rare ? 6 : 1.5));
    },
  }));
  const R = { up: 0, open: 0 };
  K.lod(c, near, null, 30);
  const lod = c.lod;
  c.lod = (d) => { lod(d); far = d > 10; mesh.wNear.visible = mesh.sNear.visible = mesh.sHead.visible = !far; mesh.wFar.visible = mesh.sFar.visible = mesh.sHeadFar.visible = far; };
  c.lod(100);
  c.seeAt = 130;
  // the subject of a frame: while the soldier rears, its head; otherwise the stretch of column the
  // lens is aimed at (the point nearest the middle of the view, worked out once per frame)
  const aim = new THREE.Vector3().copy(spot), look = new THREE.Vector3();
  c.photoPoint = (out) => (c.state === 'rare' && near.visible ? out.copy(headLocal).applyMatrix4(fore.matrixWorld) : out.copy(aim));
  const inner = c.step;
  const calm = { pellets: [] };
  c.step = (dt, env) => {
    // the ants pay no heed to feed
    Object.assign(calm, env); calm.pellets = [];
    inner(dt, calm);
    colony.visible = env.dist < c.seeAt * 0.92;
    if (!colony.visible) return;
    stepColumn(env.t, dt);
    // which bit of the column the lens is on: the trail point closest to the line of sight
    if (env.look) look.copy(env.look); else look.subVectors(spot, env.camPos).normalize();
    let best = -2, bi = iH;
    for (let i = 0; i < NS; i += 6) {
      vA.fromArray(PA, i * 3).sub(env.camPos);
      const d = vA.length(), k = vA.dot(look) / (d || 1) - d * 0.0004;
      if (k > best) { best = k; bi = i; }
    }
    aim.fromArray(PA, bi * 3).addScaledVector(vB.fromArray(UA, bi * 3), 0.06);
  };
  c.colony = { mesh, LEN, length: LEN, count: ants.length + soldiers.length, ball, trail: [opts.tree.foot, M.at] };
  return c;
}

export const BUILDERS = { 'leafcutter-ant': buildLeafcutters };
