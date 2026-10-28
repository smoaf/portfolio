// The canyon's plants (FEAT-005): dry grass tufts, twisted junipers, dragon's blood trees, cacti and
// succulents. Noticeably greener on the cliff path and along the top, a sparse spot now and then on
// the rest of the route above water, nothing in the deep pool.
//
// Cheap on purpose: every type is a few shapes built once, each shape one instanced mesh with vertex
// colours (one draw call each, ten in all). The plants have their own random numbers, so the route's
// animals and rocks stay exactly where they were, and the same plants grow at every time of day.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seeded, smooth, lerp, instanced, addSway } from '../terrain.js';

const C = (hex) => new THREE.Color(hex);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---- shapes: everything is merged into plain triangles with position, normal and colour
function prep(g, colour) {
  if (g.index) g = g.toNonIndexed();
  g.deleteAttribute('uv');
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    colour(c, pos.getX(i), pos.getY(i), pos.getZ(i), i);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
const flat = (hex) => { const k = C(hex); return (c) => c.copy(k); };
const merge = (parts) => mergeGeometries(parts, false);

// a tapered tube through points, r0 at the start, r1 at the end
function tube(points, r0, r1, radial = 5, segs = 8) {
  const curve = new THREE.CatmullRomCurve3(points);
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const pos = g.attributes.position;
  for (let i = 0; i <= segs; i++) {
    const c = curve.getPointAt(i / segs), r = lerp(r0, r1, i / segs);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      pos.setXYZ(k, c.x + (pos.getX(k) - c.x) * r, c.y + (pos.getY(k) - c.y) * r, c.z + (pos.getZ(k) - c.z) * r);
    }
  }
  return g;
}
// a lumpy clump of foliage (or a rounded crown), squashed by s
function clump(rng, s, detail = 1, rough = 0.18) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const pos = g.attributes.position, seen = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!seen.has(key)) seen.set(key, 1 + (rng() - 0.5) * 2 * rough);
    const k = seen.get(key);                                   // the same push for a shared corner: no cracks
    pos.setXYZ(i, pos.getX(i) * k * s[0], pos.getY(i) * k * s[1], pos.getZ(i) * k * s[2]);
  }
  return g;
}

// dry grass: thin blades bending out from a clump, olive at the foot, golden at the tips
function grassShape(rng, blades, h) {
  const v = [], col = [];
  const foot = C(0x6b6538), mid = C(0xa39550), tip = C(0xd9c47e), green = C(0x8e9a50), c = new THREE.Color();
  for (let b = 0; b < blades; b++) {
    const a = rng() * Math.PI * 2, out = 0.25 + rng() * 0.55, hh = h * (0.55 + rng() * 0.45), w = 0.03 + rng() * 0.025;
    const r0 = rng() * 0.09, dx = Math.cos(a), dz = Math.sin(a), px = -dz * w, pz = dx * w;
    const B = v3(dx * r0, 0, dz * r0), M = v3(dx * (r0 + out * hh * 0.3), hh * 0.55, dz * (r0 + out * hh * 0.3)), T = v3(dx * (r0 + out * hh), hh, dz * (r0 + out * hh));
    const g = rng() < 0.3;
    // two quads' worth: foot to middle, middle to the tip
    const tri = (p, q, r, cp, cq, cr) => { v.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z); [cp, cq, cr].forEach((k) => col.push(k.r, k.g, k.b)); };
    const cf = foot, cm = g ? green : mid, ct = c.copy(g ? green : tip).lerp(tip, g ? 0.4 : 0).clone();
    const Bl = B.clone().add(v3(px, 0, pz)), Br = B.clone().sub(v3(px, 0, pz));
    const Ml = M.clone().add(v3(px * 0.7, 0, pz * 0.7)), Mr = M.clone().sub(v3(px * 0.7, 0, pz * 0.7));
    tri(Bl, Br, Mr, cf, cf, cm); tri(Bl, Mr, Ml, cf, cm, cm); tri(Ml, Mr, T, cm, cm, ct);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// a twisted juniper: a gnarled leaning trunk, two crooked limbs, flat dark clumps of needles
function juniperShape(rng) {
  const bark = C(0x6a5444), pale = C(0xa59682), c1 = C(0x4d5d3c), c2 = C(0x6c7a4c);
  const lean = (rng() - 0.5) * 1.6, h = 2.3 + rng() * 1.3;
  const trunk = [v3(0, -0.3, 0), v3(0.25 + lean * 0.2, h * 0.3, (rng() - 0.5) * 0.4), v3(lean * 0.6 - 0.2, h * 0.6, (rng() - 0.5) * 0.6), v3(lean, h, (rng() - 0.5) * 0.5)];
  const parts = [tube(trunk, 0.2, 0.06, 5, 8)];
  const tops = [trunk[3]];
  for (let i = 0; i < 2; i++) {
    const s = trunk[1 + i], a = rng() * Math.PI * 2, L = 0.9 + rng() * 0.8;
    const e = v3(s.x + Math.cos(a) * L, s.y + 0.5 + rng() * 0.7, s.z + Math.sin(a) * L);
    parts.push(tube([s, v3((s.x + e.x) / 2 + (rng() - 0.5) * 0.3, (s.y + e.y) / 2 + 0.2, (s.z + e.z) / 2), e], 0.09, 0.035, 4, 5));
    tops.push(e);
  }
  const barkG = prep(merge(parts), (c, x, y, z) => c.copy(bark).lerp(pale, 0.25 + 0.3 * Math.sin(x * 9 + y * 5 + z * 7) ** 2));
  const leaves = tops.flatMap((t, i) => {
    const n = i === 0 ? 2 : 1;
    return Array.from({ length: n }, (_, k) => clump(rng, [0.75 + rng() * 0.45, 0.32 + rng() * 0.12, 0.6 + rng() * 0.4], 1, 0.22)
      .rotateY(rng() * 3).translate(t.x + (k ? (rng() - 0.5) * 0.7 : 0), t.y + 0.1 + k * 0.25, t.z + (k ? (rng() - 0.5) * 0.7 : 0)));
  });
  const leafG = prep(merge(leaves), (c, x, y) => c.copy(c1).lerp(c2, smooth(-0.2, 0.25, y - h * 0.9) * 0.8));
  return merge([barkG, leafG]);
}

// a dragon's blood tree: a thick pale trunk splitting again and again into stout branches, under a
// dense flat crown that turns up at the top like an umbrella blown inside out (a dome)
function dragonShape(rng) {
  const bark = C(0x9c9180), barkDark = C(0x7a7064), leafTop = C(0x6f8a44), leafUnder = C(0x3f5530);
  const H = 2.2 + rng() * 0.5;
  const parts = [tube([v3(0, -0.4, 0), v3(0, H * 0.5, 0), v3(0.05, H, 0)], 0.48, 0.36, 7, 4)];
  const ends = [];
  const grow = (from, dir, len, r, depth) => {
    const to = from.clone().addScaledVector(dir, len);
    parts.push(tube([from, from.clone().lerp(to, 0.5).add(v3(0, 0.06, 0)), to], r, r * 0.72, 6, 3));
    if (depth === 0) { ends.push(to); return; }
    const a = Math.atan2(dir.z, dir.x), spread = 0.55 + rng() * 0.2;
    for (const s of [-1, 1]) {
      const aa = a + s * spread, up = 0.8 + rng() * 0.25;
      const d = v3(Math.cos(aa) * Math.sin(up), Math.cos(up), Math.sin(aa) * Math.sin(up)).normalize();
      grow(to, d, len * 0.8, r * 0.7, depth - 1);
    }
  };
  const n = 4 + Math.floor(rng() * 2), top = v3(0.05, H, 0);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.5, up = 0.62 + rng() * 0.2;
    grow(top, v3(Math.cos(a) * Math.sin(up), Math.cos(up), Math.sin(a) * Math.sin(up)), 0.95 + rng() * 0.2, 0.24, 2);
  }
  const barkG = prep(merge(parts), (c, x, y) => c.copy(barkDark).lerp(bark, smooth(-0.4, 1.2, y)));
  // the crown: a wide dome resting on the branch ends, its rim lumpy, its underside flat and dark
  let reach = 0, base = Infinity;
  ends.forEach((e) => { reach = Math.max(reach, Math.hypot(e.x, e.z)); base = Math.min(base, e.y); });
  const R = reach + 0.55;
  const dome = new THREE.SphereGeometry(1, 20, 7, 0, Math.PI * 2, 0, Math.PI / 2);
  { const p = dome.attributes.position; for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
    const k = 1 + 0.06 * Math.sin(a * 7 + 1) + 0.04 * Math.sin(a * 13);
    p.setXYZ(i, x * R * k, y * (0.85 + 0.15 * Math.sin(a * 5)) * 1.15, z * R * k);
  } }
  const under = new THREE.CircleGeometry(1, 20).rotateX(Math.PI / 2);
  { const p = under.attributes.position; for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + 0.06 * Math.sin(a * 7 + 1) + 0.04 * Math.sin(a * 13);
    p.setXYZ(i, x * R * k, 0, z * R * k);
  } }
  const crown = merge([prep(dome, (c, x, y) => c.copy(leafUnder).lerp(leafTop, smooth(0, 0.9, y))), prep(under, flat(0x34482a))])
    .translate(0, base - 0.12, 0);
  return merge([barkG, crown]);
}

// ---- cacti and succulents
const sand = C(0xb08a62);
// a ribbed column with a rounded top
function column(h, r, ribs = 8) {
  const prof = [[r * 1.05, 0], [r, h * 0.85], [r * 0.85, h * 0.95], [r * 0.45, h * 0.995], [0.001, h]].map(([a, b]) => new THREE.Vector2(a, b));
  const g = new THREE.LatheGeometry(prof, ribs * 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 - 0.13 * (0.5 - 0.5 * Math.cos(a * ribs));
    p.setX(i, x * k); p.setZ(i, z * k);
  }
  return g;
}
const cactusCol = (top, h) => (c, x, y) => c.copy(C(0x5f7a4c)).lerp(C(0x93a26e), smooth(h * 0.7, h, y) * top).lerp(sand, smooth(0.25, 0, y) * 0.5);
// a rosette of thick pointed leaves (aloe, agave), blue-grey green with reddish tips
function rosette(rng, n, L) {
  const leaves = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.3, tilt = 0.35 + (i % 3) * 0.28 + rng() * 0.15, l = L * (0.75 + rng() * 0.35);
    leaves.push(new THREE.ConeGeometry(0.07 * L / 0.6, l, 4).translate(0, l / 2, 0).scale(1.7, 1, 0.55).rotateZ(-tilt).rotateY(a));
  }
  return prep(merge(leaves.map((g) => (g.index ? g.toNonIndexed() : g))), (c, x, y) => c.copy(C(0x7f9478)).lerp(C(0xa5704f), smooth(L * 0.45, L * 0.8, y)).lerp(C(0x5d7050), smooth(0.12, 0, y) * 0.5));
}
function succulentShapes(rng) {
  // 1: a group of columnar cacti, one with an arm, a small aloe at their feet
  const g1 = [];
  [[0, 0, 2.2, 0.2], [0.55, 0.3, 1.5, 0.16], [-0.35, 0.45, 1.0, 0.14]].forEach(([x, z, h, r], i) => {
    g1.push(prep(column(h, r).translate(x, -0.05, z), cactusCol(1, h)));
    if (i === 0) {
      const arm = tube([v3(x + 0.12, h * 0.42, z), v3(x + 0.5, h * 0.48, z), v3(x + 0.55, h * 0.75, z), v3(x + 0.55, h * 0.88, z)], 0.12, 0.11, 7, 6);
      g1.push(prep(arm, cactusCol(0, h)));
    }
  });
  g1.push(rosette(rng, 9, 0.45).translate(-0.5, 0, -0.35));
  // 2: barrel cacti of three sizes, yellow flowers on the biggest, two small rosettes
  const g2 = [];
  [[0, 0, 0.42], [0.62, -0.2, 0.3], [0.2, 0.55, 0.24], [-0.45, 0.3, 0.2]].forEach(([x, z, r]) => {
    g2.push(prep(column(r * 1.5, r, 10).scale(1, 1, 1).translate(x, -0.03, z), (c, xx, y) => c.copy(C(0x6d8550)).lerp(C(0xb7a463), smooth(r * 1.1, r * 1.5, y))));
  });
  g2.push(prep(clump(rng, [0.12, 0.06, 0.12], 0, 0.1).translate(0, 0.64, 0), flat(0xd9b648)));
  g2.push(rosette(rng, 7, 0.32).translate(-0.6, 0, -0.35), rosette(rng, 6, 0.28).translate(0.75, 0, 0.4));
  // 3: agave and aloe rosettes, one sending up a tall flower stalk
  const g3 = [rosette(rng, 13, 0.75), rosette(rng, 10, 0.5).translate(0.8, 0, 0.35), rosette(rng, 8, 0.38).translate(-0.6, 0, 0.5)];
  g3.push(prep(tube([v3(0, 0.3, 0), v3(0.05, 1.1, 0.02), v3(0.12, 1.9, 0)], 0.04, 0.025, 4, 4), flat(0x7d7448)));
  g3.push(prep(clump(rng, [0.1, 0.22, 0.1], 0, 0.15).translate(0.12, 2.0, 0), flat(0xc7743a)));
  return [g1, g2, g3].map((parts) => merge(parts.map((g) => (g.index ? g.toNonIndexed() : g))));
}

// ---- where they grow
// `path` the road, `road` its index, `groundY` the ground, `zone(u, p)` 'top' | 'climb' | 'rest' | null
// (null: no plants), `away(p, side)` true when that side of the road points away from the river (where
// a tree hides no view), `clearOf` the spots that stay free ({ p, r }: animals, the acacia), `keep`,
// `lam` and `T` from the route, `rim` the height of the top, `dragons` [u, offset, size] per tree.
export function plantCanyon({ scene, path, road, groundY, water, flatRoad, roadEdge, zone, away, clearOf, keep, lam, T, night, rim, dragons }) {
  const rng = seeded(20261028);
  const tilt = 0.7;
  const slope = (x, z) => {
    const h = groundY(x, z);
    return Math.max(Math.abs(groundY(x + tilt, z) - h), Math.abs(groundY(x - tilt, z) - h), Math.abs(groundY(x, z + tilt) - h), Math.abs(groundY(x, z - tilt) - h));
  };
  const clear = (x, z, r) => clearOf.every((k) => Math.hypot(k.p.x - x, k.p.z - z) > (k.r || 0) + r);
  // a spot for one plant: on the ground above water, off every leg of the road, not too steep, not by
  // an animal. Returns the foot (sunk a little where the ground slopes) or null.
  const spot = (x, z, { steep, r, lift = 0, edge = flatRoad + 0.3 }) => {
    const y = groundY(x, z);
    if (y < water + 0.35) return null;
    if (road.at(x, z).d < edge) return null;
    const s = slope(x, z);
    if (s > steep) return null;
    if (!clear(x, z, r)) return null;
    return v3(x, y - s * 0.6 + lift, z);
  };

  const G = { grass: [[], []], juniper: [[], [], []], dragon: [[], []], succ: [[], [], []] };
  const grassAt = (x, z, big = 1) => {
    const p = spot(x, z, { steep: 1.05, r: 1.6, edge: roadEdge });
    if (p) G.grass[rng() < 0.5 ? 0 : 1].push({ p, ry: rng() * 6.28, s: big * (0.75 + rng() * 0.6) });
    return !!p;
  };
  const tuft = (x, z, n, spread, big) => { for (let i = 0; i < n; i++) grassAt(x + (rng() - 0.5) * spread, z + (rng() - 0.5) * spread, big); };

  // walk the road; each step, each side may get a group of plants
  const len = path.getLength(), STEP = 3, steps = Math.floor(len / STEP);
  const P = new THREE.Vector3(), Q = new THREE.Vector3();
  const RATE = { top: 0.42, climb: 0.34, rest: 0.07 };
  for (let i = 1; i < steps; i++) {
    const u = i / steps;
    path.getPointAt(u, P); path.getPointAt(Math.min(1, u + 0.001), Q);
    const z0 = zone(u, P);
    if (!z0) continue;
    const t = Q.sub(P).setY(0).normalize();
    for (const sd of [-1, 1]) {
      if (rng() > RATE[z0]) continue;
      const side = v3(-t.z * sd, 0, t.x * sd), far = away(P, side);
      // on the wall most ground is a sheer step: try a few spots across it for a ledge
      let x, z, along, k = 0;
      for (; k < 8; k++) {
        const off = 5.2 + rng() * (z0 === 'rest' ? 12 : 13);
        along = (rng() - 0.5) * STEP;
        x = P.x + side.x * off + t.x * along; z = P.z + side.z * off + t.z * along;
        if (slope(x, z) < 0.6) break;
      }
      if (k === 8) { x = P.x + side.x * (roadEdge + 0.4) + t.x * along; z = P.z + side.z * (roadEdge + 0.4) + t.z * along; }   // no ledge: by the road
      // grass in every group: in the cracks, on the ledges, by the road edge
      tuft(x, z, z0 === 'rest' ? 2 + Math.floor(rng() * 3) : 3 + Math.floor(rng() * 5), 3.2, 1);
      // and along the outer edge of the road's shelf, where the wall gives no ledge
      if (rng() < (z0 === 'rest' ? 0.4 : 0.75)) { const e = roadEdge + 0.05 + rng() * 0.45; tuft(P.x + side.x * e + t.x * along, P.z + side.z * e + t.z * along, 1 + Math.floor(rng() * 3), 0.8, 0.85); }
      const roll = rng(), jx = (rng() - 0.5) * 3, jz = (rng() - 0.5) * 3;
      const ox = slope(x + jx, z + jz) < 0.6 ? x + jx : x, oz = ox === x ? z : z + jz;
      if (z0 !== 'rest' && far && roll < (z0 === 'climb' ? 0.6 : 0.38)) {
        // a juniper on the uphill side or back from the lip: it hides no view
        // (it clings to whatever ledge it finds on the wall beside the group)
        let p = spot(ox, oz, { steep: 0.9, r: 5 });
        for (let k = 0; !p && k < 6; k++) {
          const off = 5.5 + rng() * 10;
          p = spot(P.x + side.x * off + t.x * along, P.z + side.z * off + t.z * along, { steep: 0.9, r: 5 });
        }
        if (p) G.juniper[Math.floor(rng() * 3)].push({ p, ry: rng() * 6.28, s: 0.8 + rng() * 0.45 });
      } else if (roll < (z0 === 'rest' ? 0.45 : 0.62)) {
        // cacti and succulents; the tall columns only where they hide no view
        const k = far || z0 === 'rest' ? Math.floor(rng() * 3) : 1 + Math.floor(rng() * 2);
        const p = spot(ox, oz, { steep: 0.55, r: 3, edge: roadEdge + 0.4 });
        if (p) G.succ[k].push({ p, ry: rng() * 6.28, s: 0.75 + rng() * 0.5 });
      }
    }
  }
  // the top seen from the lookout: grass and a few junipers scattered back from the road on the plateau
  for (let i = 0; i < 900; i++) {
    const u = rng();
    path.getPointAt(u, P);
    if (zone(u, P) !== 'top' || P.y < rim - 2) continue;
    path.getPointAt(Math.min(1, u + 0.001), Q);
    const t = Q.sub(P).setY(0).normalize();
    let side = v3(-t.z, 0, t.x);
    if (!away(P, side)) side.negate();
    const off = 16 + rng() * 45, x = P.x + side.x * off + (rng() - 0.5) * 8, z = P.z + side.z * off + (rng() - 0.5) * 8;
    if (rng() < 0.12) {
      const p = spot(x, z, { steep: 0.75, r: 6 });
      if (p) G.juniper[Math.floor(rng() * 3)].push({ p, ry: rng() * 6.28, s: 0.8 + rng() * 0.5 });
    } else if (rng() < 0.2) {
      const p = spot(x, z, { steep: 0.55, r: 3 });
      if (p) G.succ[Math.floor(rng() * 3)].push({ p, ry: rng() * 6.28, s: 0.8 + rng() * 0.5 });
    } else tuft(x, z, 2 + Math.floor(rng() * 3), 3, 1.1);
  }
  // the dragon's blood trees: two eye-catchers near the road on the top, a few more back on the plateau
  const dragonAt = (u, off, s) => {
    for (let k = 0; k < 40; k++) {
      const uu = u + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.002;
      path.getPointAt(uu, P); path.getPointAt(Math.min(1, uu + 0.001), Q);
      const t = Q.sub(P).setY(0).normalize();
      let side = v3(-t.z, 0, t.x);
      if (!away(P, side)) side.negate();
      const p = spot(P.x + side.x * off, P.z + side.z * off, { steep: 0.5, r: 10 });
      if (p) { G.dragon[G.dragon[0].length > G.dragon[1].length ? 1 : 0].push({ p, ry: rng() * 6.28, s }); clearOf.push({ p, r: 6 }); return; }
    }
  };
  dragons.forEach(([u, off, s]) => dragonAt(u, off, s));

  // ---- the meshes
  const tintNight = night ? 0x6c7484 : 0xffffff;              // after dark only shapes against the moonlit rock
  const grassMat = addSway(lam({ vertexColors: true, side: THREE.DoubleSide, color: tintNight }), T, { amp: 0.06, speed: 1.3, height: 0.9 });
  const plantMat = lam({ vertexColors: true, flatShading: true, color: tintNight });
  const shapes = {
    grass: [grassShape(rng, 16, 0.75), grassShape(rng, 11, 0.55)],
    juniper: [juniperShape(rng), juniperShape(rng), juniperShape(rng)],
    dragon: [dragonShape(rng), dragonShape(rng)],
    succ: succulentShapes(rng),
  };
  Object.values(shapes).flat().forEach(keep);
  // each shape in chunks of ground, so what is behind the van or far off is not drawn at all
  const CELL = 150, FAR = { grass: 170, succ: 200, juniper: 300, dragon: 520 };
  const meshes = [];
  const tints = [C(0xffffff), C(0xf2eccf), C(0xe4ead0), C(0xfff4dc)];
  for (const kind of Object.keys(G)) {
    G[kind].forEach((items, k) => {
      const cells = new Map();
      items.forEach((it) => {
        const key = Math.floor(it.p.x / CELL) + ',' + Math.floor(it.p.z / CELL);
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(it);
      });
      for (const list of cells.values()) {
        const m = instanced(shapes[kind][k], kind === 'grass' ? grassMat : plantMat, list);
        m.userData.scenery = false;                            // already in chunks
        // a little colour difference from plant to plant, so no two look copied
        list.forEach((_, i) => m.setColorAt(i, tints[Math.floor(rng() * tints.length)]));
        m.instanceColor.needsUpdate = true;
        m.name = 'plants-' + kind + k;
        m.userData.far = FAR[kind];
        scene.add(m);
        meshes.push(m);
      }
    });
  }
  const count = Object.fromEntries(Object.entries(G).map(([k, v]) => [k, v.reduce((n, a) => n + a.length, 0)]));
  // hide the chunks that lie wholly beyond the distance their plants still read at
  const cull = (eye) => { for (const m of meshes) m.visible = m.boundingSphere.center.distanceTo(eye) - m.boundingSphere.radius < m.userData.far; };
  return { meshes, count, cull };
}
