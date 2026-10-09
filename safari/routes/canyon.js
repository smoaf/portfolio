// The canyon: red rock walls with a green river between them. The van rolls along the canyon floor
// past boulders and grazing herds, climbs a cliff path cut into the wall (a hairpin, narrow ledges,
// overhangs) up to a lookout over the whole canyon where the birds circle below and above, comes
// back down the wall, and then drives into the deep pool at the bend and on along its bottom as a
// submersible, before it climbs out onto the floor again.
//
// The canyon runs along z. Everything is placed in canyon terms: `z` along it and `d` across it
// (metres from the middle of the river, negative is the left bank where the cliff path is).
import * as THREE from 'three';
import { makeKit } from '../kit.js';
import { seeded, smooth, lerp, noise2, roadIndex, heightGrid, roadBand, instanced, addCaustics, addSway, shaftMaterial, motes } from '../terrain.js';
import * as FLOOR from '../fauna/floor.js';
import * as CLIFFS from '../fauna/cliffs.js';
import * as DEEP from '../fauna/deep.js';
import * as WATERFOLK from '../fauna/pool.js';

const WATER = -0.7;                                        // the river's surface
const RIM = 74;                                            // the plateau above the walls
const XC = (z) => 55 * Math.sin(z * 0.0075) + 18 * Math.sin(z * 0.019 + 1);   // the river's middle
const POOL = { z0: 262, z1: 482, floor: -16 };
const N1 = noise2(3), N2 = noise2(11);

// the walls climb in bands: a sheer step, then a narrow ledge, eight times over (the layered rock
// of the reference cliffs)
const BAND = RIM / 8;
function wallY(t) {
  const y = RIM * THREE.MathUtils.clamp(t, 0, 1);
  const k = y / BAND, f = k - Math.floor(k);
  return BAND * (Math.floor(k) + smooth(0.42, 1, f));
}
// where the wall starts and how wide it is, at z (it wanders a little so the walls are not parallel)
const wallStart = (z) => 38 + 5 * N1(z * 0.012, 1.3) + 10 * poolness(z);
const WALL = 57;
function poolness(z) { return smooth(POOL.z0, POOL.z0 + 46, z) * (1 - smooth(POOL.z1 - 46, POOL.z1, z)); }

function raw(x, z) {
  const d = x - XC(z), a = Math.abs(d);
  const w0 = wallStart(z);
  let y;
  if (a < w0) {
    // the floor: the river channel in the middle, sand and gravel either side
    const river = -2.6 * Math.max(0, 1 - (a / 12) ** 2);
    y = river + smooth(10, 18, a) * (0.35 + 0.35 * N2(x * 0.06, z * 0.06)) + smooth(w0 - 8, w0, a) * 1.2;
  } else {
    const t = (a - w0) / WALL;
    y = 1.2 + wallY(t) * (RIM - 1.2) / RIM + N1(x * 0.08, z * 0.08) * 0.9 * (1 - smooth(0.98, 1, t));
    if (t > 1) y = RIM + 2.2 * N2(x * 0.015, z * 0.015) + 1.4 * N1(x * 0.05, z * 0.05);
  }
  // the canyon is closed at both ends: the floor rises into the walls
  const cap = Math.max(smooth(536, 590, z), smooth(-486, -540, z));
  if (cap > 0) y = lerp(y, RIM - 4 + 4 * smooth(0.5, 1, cap), cap * cap * (3 - 2 * cap));
  // the deep pool at the bend: a bowl dug into the floor
  const p = poolness(z);
  if (p > 0) {
    const bowl = lerp(POOL.floor + 1.2 * N2(x * 0.08, z * 0.08), WATER - 0.8, smooth(16, w0 + 2, a));
    y = Math.min(y, lerp(y, bowl, p));
  }
  return y;
}

// a point on the wall at height y on the left bank at z (inverts the wall profile)
function dAtHeight(z, y) {
  let lo = 0, hi = WALL * 1.4;
  for (let i = 0; i < 26; i++) {
    const m = (lo + hi) / 2;
    if (1.2 + wallY(m / WALL) * (RIM - 1.2) / RIM < y) lo = m; else hi = m;
  }
  return -(wallStart(z) + (lo + hi) / 2);
}

// The van's road, as points in canyon terms. `y: null` sits on the ground; `wall: y` puts the road
// at that height on the left wall; `d` is an explicit offset (in addition to the wall offset).
const ROAD = [
  // the canyon floor, on the left bank
  { z: -470, d: -24 }, { z: -430, d: -21 }, { z: -385, d: -26 }, { z: -340, d: -20 }, { z: -295, d: -25 }, { z: -255, d: -29 },
  // the cliff path: up the left wall, a hairpin, and up again above itself
  { z: -222, wall: 2.5 }, { z: -190, wall: 7.5 }, { z: -158, wall: 13 }, { z: -126, wall: 19 }, { z: -96, wall: 24.5 }, { z: -72, wall: 29 },
  // the hairpin: a tight half circle, then the second leg runs back above the first, well inside it
  { z: -56, hair: 0, y: 31.6 }, { z: -40, hair: 3.2, y: 32.2 }, { z: -31, hair: 11, y: 33 }, { z: -40, hair: 18.8, y: 33.8 }, { z: -56, hair: 22, y: 34.6 },
  { z: -78, wall: 39, inside: 22 }, { z: -104, wall: 46, inside: 21 }, { z: -132, wall: 53, inside: 20 }, { z: -160, wall: 61, inside: 19 }, { z: -186, wall: 69, inside: 16 },
  // over the top and along the rim to the lookout
  { z: -204, d: -122, y: RIM + 0.6 }, { z: -180, d: -128, y: RIM + 0.5 }, { z: -146, d: -120, y: RIM + 0.4 }, { z: -108, d: -110, y: RIM + 0.3 },
  { z: -72, d: -103, y: RIM + 0.3 }, { z: -40, d: -97, y: RIM + 0.2 }, { z: -16, d: -95.5, y: RIM + 0.2 }, { z: 8, d: -99, y: RIM + 0.3 },
  { z: 36, d: -108, y: RIM + 0.4 },
  // down the wall again, one long ledge
  { z: 66, wall: 70 }, { z: 96, wall: 61 }, { z: 126, wall: 50 }, { z: 156, wall: 38 }, { z: 186, wall: 26 }, { z: 212, wall: 15 },
  { z: 236, wall: 5 },
  // the floor, then into the pool and along its bottom
  { z: 256, d: -33 }, { z: 276, d: -26 }, { z: 298, d: -18 }, { z: 322, d: -12 }, { z: 352, d: -7 }, { z: 384, d: -2 },
  { z: 414, d: 3 }, { z: 442, d: 7 }, { z: 466, d: 11 }, { z: 488, d: 16 },
  // and out onto the floor for the last stretch
  { z: 508, d: 22 }, { z: 530, d: 25 },
];

export const ROUTE = {
  id: 'canyon',
  name: 'Canyon',
  seconds: 92,
  eyeHeight: 2.05,
  yawLimit: 2.7,
  palette: {
    dawn: { top: 0x3a5584, horizon: 0xf0aa78, ground: 0x8a5a44, fog: 0xd6a184, near: 120, far: 760, sun: [0xffcf9c, 1.7, [-0.55, 0.22, 0.9]], hemi: [0xd9dff0, 0x7a4a34, 0.6], amb: 0.25 },
    day: { top: 0x6c9cd6, horizon: 0xcfe0ee, ground: 0xb06a44, fog: 0xd8c2ad, near: 160, far: 900, sun: [0xfff1dc, 2.5, [0.55, 0.78, 0.3]], hemi: [0xdce8f5, 0x9a5a3c, 0.8], amb: 0.2 },
    dusk: { top: 0x27345f, horizon: 0xe8885a, ground: 0x6b3e2e, fog: 0xb07a62, near: 90, far: 640, sun: [0xffa860, 1.4, [0.8, 0.14, -0.45]], hemi: [0xc2b2cc, 0x5a3426, 0.55], amb: 0.24 },
    night: { top: 0x060b19, horizon: 0x1b2d4f, ground: 0x4a4650, fog: 0x14203a, near: 50, far: 420, sun: [0x9ab4e8, 0.8, [-0.3, 0.6, -0.6]], hemi: [0x4d6397, 0x231d24, 1.0], amb: 0.5 },
  },
  // below the surface of the pool, per time of day
  under: {
    dawn: { fog: 0x1f5a62, near: 1, far: 62 },
    day: { fog: 0x1e6a6c, near: 2, far: 78 },
    dusk: { fog: 0x173f52, near: 1, far: 56 },
    night: { fog: 0x061624, near: 0.5, far: 44 },
  },
  ambience: {
    day: { wind: 0.06, windCut: 520, band: 0.012, bandHz: 900 },          // wind in the canyon and the river
    dawn: { wind: 0.045, windCut: 420, band: 0.014, bandHz: 850 },
    dusk: { wind: 0.05, windCut: 440, band: 0.012, bandHz: 800 },
    night: { wind: 0.04, windCut: 320, band: 0.02, bandHz: 4800 },
  },

  build({ scene, tod, keep }) {
    const rand = seeded(20261009);
    const night = tod === 'night', dim = tod !== 'day';
    const P = ROUTE.palette[tod] || ROUTE.palette.day;
    const T = { time: { value: 0 } };
    const lam = (o) => keep(new THREE.MeshLambertMaterial(o));
    const geo = (g) => keep(g);

    // ---- the road, as a 3D curve: walls and the floor give the height where none is set
    const at = (z, d) => new THREE.Vector3(XC(z) + d, 0, z);
    // the first leg of the climb, so the second can keep its distance from it
    const leg1 = ROAD.filter((r) => r.wall !== undefined && r.z < -60 && r.z > -230 && !r.inside);
    const leg1Y = (z) => {
      for (let i = 0; i < leg1.length - 1; i++) {
        const a = leg1[i], b = leg1[i + 1];
        if ((z - a.z) * (z - b.z) <= 0) return lerp(a.wall, b.wall, (z - a.z) / (b.z - a.z));
      }
      return 31.6;
    };
    const d0 = dAtHeight(-56, 31.6);
    const ctrl = ROAD.map((r) => {
      let d = r.d ?? 0, y = r.y;
      if (r.wall !== undefined) {
        d = dAtHeight(r.z, r.wall); y = r.wall;
        if (r.inside) d = Math.min(d, dAtHeight(r.z, leg1Y(r.z)) - r.inside);
      }
      if (r.hair !== undefined) d = d0 - r.hair;
      const p = at(r.z, d);
      p.y = y ?? Math.max(raw(p.x, p.z), POOL.floor + 1);
      return p;
    });
    const path = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
    const road = roadIndex(path, 2);
    const HALF = 3.4, FLAT = HALF + 1.4;
    // the ground with the road carved in: a flat shelf, a steep cut where the wall is higher and a
    // steep drop where it is lower (on the floor the two hardly differ, on the wall it is a ledge)
    function carved(x, z) {
      const r0 = raw(x, z);
      const n = road.at(x, z);
      if (n.d > FLAT + 9) return r0;
      if (n.d < FLAT) return n.y - 0.05;
      const k = r0 > n.y ? smooth(FLAT, FLAT + 3.2, n.d) : smooth(FLAT, FLAT + 9, n.d);
      return lerp(n.y - 0.05, r0, k);
    }

    // ---- the ground mesh, coloured in bands like the layered rock
    const strata = [0xe7d3b3, 0xcf8a5c, 0xb1593a, 0xe4cfb2, 0x9b4a30, 0xd79b6c, 0xc06a44].map((c) => new THREE.Color(c));
    const sand = new THREE.Color(0xc9a074), green = new THREE.Color(0x6f8748), wet = new THREE.Color(0x6e5c44), bed = new THREE.Color(0x6b7556),
      top = new THREE.Color(0xc4865a), track = new THREE.Color(0xd2b38c), nightTint = new THREE.Color(0x5d6478);
    const G = heightGrid({
      x0: -232, x1: 232, z0: -540, z1: 600, nx: 186, nz: 372,
      height: carved,
      colour(x, z, y, c) {
        const a = Math.abs(x - XC(z)), w0 = wallStart(z);
        if (y < WATER - 0.4) c.copy(bed).lerp(wet, smooth(-6, WATER, y) * 0.6);
        else if (a < w0 + 1 && y < 3) c.copy(sand).lerp(green, smooth(20, 12, a) * 0.8).lerp(wet, smooth(0.4, -0.3, y) * 0.7);
        else if (y > RIM - 1.5) c.copy(top).lerp(strata[0], 0.25 + 0.25 * N2(x * 0.03, z * 0.03));
        else {
          const b = Math.floor((y + N1(x * 0.05, z * 0.05) * 1.6) / 4.3);
          c.copy(strata[((b % strata.length) + strata.length) % strata.length]);
          c.lerp(strata[0], 0.12 + 0.1 * N2(x * 0.2, y * 0.2));
        }
        const n = road.at(x, z, 1);
        if (n.d < HALF + 0.8 && y > WATER) c.lerp(track, 0.65 * smooth(HALF + 0.8, HALF - 1, n.d));
        if (night) c.lerp(nightTint, 0.3);
      },
    });
    const groundY = G.heightAt;
    const groundMat = addCaustics(lam({ vertexColors: true }), T, { level: WATER, strength: dim ? (night ? 0.08 : 0.14) : 0.24 });
    const ground = new THREE.Mesh(geo(G.geometry), groundMat);
    ground.name = 'ground';
    scene.add(ground);
    // the plateau beyond the grid, out to the horizon
    const plateauMat = lam({ color: night ? 0x6b5a58 : 0xc4865a });
    [[-1600, -232, -540, 600], [232, 1600, -540, 600], [-1600, 1600, -1600, -540], [-1600, 1600, 600, 1600]].forEach(([x0, x1, z0, z1]) => {
      const m = new THREE.Mesh(geo(new THREE.PlaneGeometry(x1 - x0, z1 - z0)), plateauMat);
      m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, RIM - 0.4, (z0 + z1) / 2);
      scene.add(m);
    });

    // ---- the river and the pool: one sheet of green water, seen from below as a bright ceiling
    const water = new THREE.Mesh(geo(new THREE.PlaneGeometry(500, 1100)), keep(new THREE.MeshStandardMaterial({
      color: night ? 0x15343a : 0x2f6b55, roughness: 0.12, metalness: 0.4, transparent: true, opacity: 0.84, side: THREE.DoubleSide,
      emissive: night ? 0x0a2230 : 0x0c2a22, emissiveIntensity: 0.5,
    })));
    water.rotation.x = -Math.PI / 2; water.position.set(0, WATER, 30);
    water.renderOrder = 2;
    scene.add(water);

    // ---- rock and plants, instanced
    const items = (n, test) => {
      const out = [];
      let guard = 0;
      while (out.length < n && guard++ < n * 60) {
        const z = -500 + rand() * 1060, d = (rand() * 2 - 1) * 170;
        const x = XC(z) + d, y = groundY(x, z);
        const r = road.at(x, z);
        const it = test({ x, y, z, d, a: Math.abs(d), road: r.d, w0: wallStart(z) });
        if (it) out.push({ p: new THREE.Vector3(x, y + (it.lift || 0), z), ry: rand() * 6.28, ...it });
      }
      return out;
    };
    const rockMat = lam({ color: night ? 0x6e5654 : 0xa8583a, flatShading: true });
    const paleRock = lam({ color: night ? 0x7a7068 : 0xd8b892, flatShading: true });
    const boulderGeo = geo(new THREE.IcosahedronGeometry(1, 1));
    const boulders = instanced(boulderGeo, rockMat, items(150, (q) => (q.y > WATER - 4 && q.a < q.w0 + 6 && q.a > 9 && q.road > 6
      ? { s: [1 + rand() * 3.2, 0.7 + rand() * 2.2, 1 + rand() * 3], lift: -0.4 } : null)));
    const slabs = instanced(geo(new THREE.DodecahedronGeometry(1, 0)), paleRock, items(90, (q) => ((q.y > RIM - 2 || (q.a < q.w0 && q.y > WATER)) && q.road > 6
      ? { s: [1.5 + rand() * 4, 0.6 + rand() * 1.2, 1.5 + rand() * 3.4], lift: -0.3 } : null)));
    // hoodoos on the rim: stacked pillars of the pale and the red rock
    const hoodooSpots = items(60, (q) => (q.y > RIM - 2 && q.road > 12 && q.a < 210 ? { s: [1.4 + rand() * 1.8, 4 + rand() * 9, 1.4 + rand() * 1.8] } : null));
    const hoodoos = instanced(geo(new THREE.CylinderGeometry(0.8, 1, 1, 7).translate(0, 0.5, 0)), rockMat, hoodooSpots);
    const caps = instanced(geo(new THREE.CylinderGeometry(1.25, 1.1, 0.5, 7)), paleRock,
      hoodooSpots.map((h) => ({ p: h.p.clone().setY(h.p.y + h.s[1] - 0.1), s: [h.s[0], 1.6, h.s[2]], ry: h.ry })));
    // the overhangs over the cliff path: slabs jutting from the uphill side, above the van's roof
    const over = [];
    for (let i = 0; i < road.pts.length; i += 9) {
      const p = road.pts[i];
      if (p.y < 4 || p.y > RIM - 3) continue;
      const q = road.pts[Math.min(road.pts.length - 1, i + 1)], t = new THREE.Vector3().subVectors(q, p).setY(0).normalize();
      // the uphill side is the one further from the river
      let s = new THREE.Vector3(-t.z, 0, t.x);
      if (Math.abs(p.x + s.x * 4 - XC(p.z)) < Math.abs(p.x - XC(p.z))) s.negate();
      if (rand() < 0.45) continue;
      // find the cut face on that side and let the slab stick out of it over the road
      const y0 = p.y + 5.2 + rand() * 1.8;
      let o = 5;
      while (o < 16 && groundY(p.x + s.x * o, p.z + s.z * o) < y0) o += 0.5;
      if (o >= 16) continue;
      over.push({ p: p.clone().addScaledVector(s, o + 0.6).setY(y0), s: [3.4 + rand() * 1.2, 0.9 + rand() * 0.7, 3.5 + rand() * 3], ry: Math.atan2(s.x, s.z) + (rand() - 0.5) * 0.3 });
    }
    const overhangs = instanced(geo(new THREE.DodecahedronGeometry(1, 0)), rockMat, over);
    // the floor's plants: sage bushes, flat-crowned trees by the water, reeds on the banks
    const bushGeo = geo(new THREE.IcosahedronGeometry(1, 1).scale(1, 0.62, 1));
    const bushes = instanced(bushGeo, lam({ color: night ? 0x3d4a3a : 0x7b8a5a, flatShading: true }), items(320, (q) => (q.y > WATER + 0.2 && q.road > 4.5 && (q.a < q.w0 || q.y > RIM - 2) && q.a > 11
      ? { s: [0.6 + rand() * 1.2, 0.5 + rand() * 1, 0.6 + rand() * 1.2], lift: 0.1 } : null)));
    const treeSpots = items(70, (q) => (q.y > WATER + 0.2 && q.y < 3 && q.a > 11 && q.a < 26 && q.road > 8 ? { s: 1 } : null));
    const trunks = instanced(geo(new THREE.CylinderGeometry(0.2, 0.38, 4.4, 6).translate(0, 2.2, 0)), lam({ color: night ? 0x3f3630 : 0x6b4f38 }),
      treeSpots.map((t) => ({ ...t, s: [1, 0.8 + rand() * 0.6, 1], rz: (rand() - 0.5) * 0.25 })));
    const crownGeo = geo(new THREE.SphereGeometry(1, 10, 6).scale(1, 0.4, 1));
    const crowns = instanced(crownGeo, lam({ color: night ? 0x34452f : 0x6a8240, flatShading: true }),
      treeSpots.map((t) => ({ p: t.p.clone().setY(t.p.y + 4.6 + rand() * 1.2), s: [2.8 + rand() * 2, 1.8 + rand() * 1, 2.8 + rand() * 2], ry: rand() * 6 })));
    const reedMat = addSway(lam({ color: night ? 0x4c5a3f : 0x8f9a52 }), T, { amp: 0.12, speed: 1.6, height: 1.6 });
    const reeds = instanced(geo(new THREE.ConeGeometry(0.16, 1.8, 4).translate(0, 0.9, 0)), reedMat, items(420, (q) => (Math.abs(q.y - WATER) < 0.7 && q.road > 4 ? { s: [1, 0.6 + rand() * 0.9, 1] } : null)));
    // under water: weed that sways, and pale rock
    const kelpMat = addSway(lam({ color: night ? 0x2c5a48 : 0x4f8a52, side: THREE.DoubleSide }), T, { amp: 0.7, speed: 0.7, height: 6 });
    const kelpGeo = geo(new THREE.PlaneGeometry(0.7, 6, 1, 6).translate(0, 3, 0));
    const kelp = instanced(kelpGeo, kelpMat, items(260, (q) => (q.y < WATER - 3 && q.road > 3.5 ? { s: [1 + rand(), 0.5 + rand() * 1.1, 1] } : null)));
    const poolRocks = instanced(boulderGeo, paleRock, items(70, (q) => (q.y < WATER - 3 && q.road > 5 ? { s: [1 + rand() * 2.5, 0.6 + rand() * 1.4, 1 + rand() * 2], lift: -0.2 } : null)));
    [boulders, slabs, hoodoos, caps, overhangs, bushes, trunks, crowns, reeds, kelp, poolRocks].forEach((m) => scene.add(m));

    // ---- the pool's light: shafts from the surface, and drifting particles in the water
    const shafts = [];
    for (let i = 0; i < 16; i++) {
      const z = lerp(POOL.z0 + 50, POOL.z1 - 40, rand()), d = (rand() - 0.5) * 50;
      shafts.push({ p: new THREE.Vector3(XC(z) + d, WATER - 0.2, z), s: [1.5 + rand() * 2.5, 16, 1.5 + rand() * 2.5], rx: 0.16, rz: 0.1, ry: 0 });
    }
    const shaftGeo = geo(new THREE.CylinderGeometry(1, 0.35, 1, 10, 1, true).translate(0, -0.5, 0));
    // uv.y: 1 at the top (surface), 0 deep down; the cylinder's own uv runs the other way
    { const uv = shaftGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i)); }
    const shaftMesh = instanced(shaftGeo, keep(shaftMaterial(night ? 0x3d6a8a : 0xbff6ff, night ? 0.05 : 0.12)), shafts);
    shaftMesh.visible = false;
    scene.add(shaftMesh);
    const motesWater = motes({ n: 360, box: 34, color: night ? 0x9fd8ff : 0xdff6ea, size: 0.09, opacity: 0.5, drift: [0.05, 0.12, 0.08] });
    const motesAir = motes({ n: dim ? 220 : 120, box: 40, color: night ? 0xbfe6ff : 0xffe2b8, size: dim ? 0.07 : 0.05, opacity: 0.45, drift: [0.4, 0.05, 0.2] });
    motesWater.visible = false;
    scene.add(motesWater, motesAir);
    keep(motesWater.geometry); keep(motesWater.material); keep(motesAir.geometry); keep(motesAir.material);

    // ---- a waterfall down the far wall into the pool: a ribbon laid over the rock bands, its
    // streaks scrolling down, and a cloud of spray where it lands
    const fallTex = (() => {
      const c = document.createElement('canvas'); c.width = 64; c.height = 256;
      const g = c.getContext('2d');
      g.fillStyle = 'rgba(210, 238, 240, 0.55)'; g.fillRect(0, 0, 64, 256);
      for (let i = 0; i < 90; i++) {
        g.fillStyle = `rgba(255, 255, 255, ${0.25 + rand() * 0.6})`;
        g.fillRect(rand() * 64, rand() * 256, 1 + rand() * 3, 12 + rand() * 60);
      }
      const t = keep(new THREE.CanvasTexture(c));
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 6); t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const FALL_Z = 318, fv = [], fuv = [], fi = [];
    const dTop = wallStart(FALL_Z) + WALL + 3, dBot = wallStart(FALL_Z) - 6, STEPS = 48;
    for (let i = 0; i <= STEPS; i++) {
      const d = lerp(dTop, dBot, i / STEPS);
      for (const [j, w] of [[0, -4.5], [1, 4.5]]) {
        const z = FALL_Z + w * (1 - i / STEPS * 0.3), x = XC(z) + d;
        fv.push(x, Math.max(groundY(x, z), WATER) + 0.6, z);
        fuv.push(j, 1 - i / STEPS);
      }
      if (i < STEPS) { const k = i * 2; fi.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const fg = geo(new THREE.BufferGeometry());
    fg.setAttribute('position', new THREE.Float32BufferAttribute(fv, 3));
    fg.setAttribute('uv', new THREE.Float32BufferAttribute(fuv, 2));
    fg.setIndex(fi); fg.computeVertexNormals();
    const fall = new THREE.Mesh(fg, keep(new THREE.MeshBasicMaterial({ map: fallTex, transparent: true, opacity: night ? 0.55 : 0.85, depthWrite: false, side: THREE.DoubleSide, color: night ? 0x7a9ab0 : 0xffffff })));
    scene.add(fall);
    const spray = motes({ n: 160, box: 1, color: 0xf2fbff, size: 0.5, opacity: night ? 0.25 : 0.45, drift: [0, 0, 0] });
    { const pa = spray.geometry.attributes.position; for (let i = 0; i < pa.count; i++) pa.setXYZ(i, (rand() - 0.5) * 18, rand() * 7, (rand() - 0.5) * 16); }
    spray.position.set(XC(FALL_Z) + dBot + 6, WATER, FALL_Z);
    keep(spray.geometry); keep(spray.material);
    scene.add(spray);

    // ---- the road band (not under water: there the van drives on the pool's own floor)
    const band = new THREE.Mesh(geo(roadBand(path, HALF - 0.4, 0.07)), lam({ color: night ? 0x6a5c52 : 0xc9a881 }));
    band.visible = false;                                      // the track is painted into the ground colours instead
    scene.add(band);

    // ---- distant mesas around the plateau, for the horizon from the lookout
    const mesas = [];
    for (let i = 0; i < 40; i++) {
      const a = rand() * Math.PI * 2, r = 520 + rand() * 520;
      mesas.push({ p: new THREE.Vector3(Math.cos(a) * r, RIM - 1, Math.sin(a) * r + 30), s: [30 + rand() * 70, 12 + rand() * 40, 30 + rand() * 60], ry: rand() * 6 });
    }
    scene.add(instanced(geo(new THREE.CylinderGeometry(0.9, 1, 1, 7).translate(0, 0.5, 0)), lam({ color: night ? 0x3d3a48 : 0xb87855, flatShading: true }), mesas));

    // ---- where the route is what: the dive, the stretches, the set pieces
    const ts = path.getSpacedPoints(1600);
    const uOf = (z) => { let best = 0, bd = Infinity; ts.forEach((p, i) => { const d = Math.abs(p.z - z) + (i / 1600 < 0.5 && z > 240 ? 1e4 : 0); if (d < bd) { bd = d; best = i / 1600; } }); return best; };
    let dive0 = 1, dive1 = 0;
    ts.forEach((p, i) => { if (p.y < WATER + 0.8) { dive0 = Math.min(dive0, i / 1600); } if (p.y < WATER - 2.1) dive1 = Math.max(dive1, i / 1600); });
    const uClimb = ts.findIndex((p) => p.y > 3) / 1600;
    const uRim = ts.findIndex((p) => p.y > RIM - 1) / 1600;
    let uDown = uRim; ts.forEach((p, i) => { if (p.y > RIM - 1) uDown = i / 1600; });
    const uLook = (() => { let best = 0, bd = Infinity; ts.forEach((p, i) => { const d = Math.abs(p.x - (XC(p.z) - 95.5)) + Math.abs(p.z + 16) * 0.5; if (d < bd && p.y > RIM - 2) { bd = d; best = i / 1600; } }); return best; })();
    const uHairpin = (() => { let best = 0, bd = Infinity; ts.forEach((p, i) => { const d = Math.abs(p.z + 31) + Math.abs(p.y - 33) * 2; if (d < bd) { bd = d; best = i / 1600; } }); return best; })();
    const sections = [
      { u: 0, title: 'Canyon floor', line: 'river · boulders · herds' },
      { u: uClimb, title: 'Cliff path', line: 'switchbacks · ledges · birds' },
      { u: uLook - 0.035, title: 'The lookout', line: 'the whole canyon below' },
      { u: uDown, title: 'Down the wall', line: 'markhor country' },
      { u: dive0 - 0.03, title: 'The deep pool', line: 'dive · the van goes under' },
      { u: dive1 + 0.005, title: 'Back on the floor', line: 'last stretch' },
    ];
    const SETS = [
      { u: 0.06, k: 0.6, w: 0.03 }, { u: 0.15, k: 0.55, w: 0.03 },
      { u: uHairpin, k: 0.55, w: 0.02 }, { u: uLook, k: 0.85, w: 0.035 },
      { u: (dive0 + dive1) / 2 - 0.05, k: 0.55, w: 0.04 }, { u: (dive0 + dive1) / 2 + 0.06, k: 0.5, w: 0.03 },
    ];

    // ---- the animals
    const K = makeKit({ scene, keep, tod, groundY, waterY: () => WATER, seed: 404 });
    const B = { ...FLOOR.BUILDERS, ...CLIFFS.BUILDERS, ...DEEP.BUILDERS, ...WATERFOLK.BUILDERS };
    const creatures = [];
    const spawn = (id, home, opts = {}, extra = {}) => {
      if (!B[id]) return null;
      const c = B[id](K, home, opts);
      if (!c) return null;
      Object.assign(c, extra);
      creatures.push(c);
      return c;
    };
    const P3 = (z, d, lift = 0) => { const p = at(z, d); p.y = groundY(p.x, p.z) + lift; return p; };
    const jit = (v) => (rand() - 0.5) * 2 * v;
    const small = { seeAt: 90 };

    // the floor: herds by the river, lizards and spiders on the boulders, beetles in the scrub
    for (let i = 0; i < 5; i++) spawn('saiga-antelope', P3(-405 + jit(14), -9 + jit(4)));
    for (let i = 0; i < 3; i++) spawn('saiga-antelope', P3(-150 + jit(10), 18 + jit(4)));
    spawn('cape-buffalo', P3(-338, -13)); spawn('cape-buffalo', P3(-326, -9)); spawn('cape-buffalo', P3(-316, 16));
    spawn('giant-tortoise', P3(-372, -33)); spawn('giant-tortoise', P3(-262, -15)); spawn('giant-tortoise', P3(512, 34));
    spawn('frilled-lizard', P3(-446, -33)); spawn('frilled-lizard', P3(-358, -15)); spawn('frilled-lizard', P3(-282, -35));
    spawn('fennec-fox', P3(-424, -36)); spawn('fennec-fox', P3(-300, -16)); spawn('fennec-fox', P3(522, 30));
    spawn('peacock-spider', P3(-392, -33, 0.2), {}, small); spawn('peacock-spider', P3(-268, -19, 0.2), {}, small);
    spawn('stag-beetle', P3(-348, -31), {}, small); spawn('stag-beetle', P3(-236, -34), {}, small); spawn('stag-beetle', P3(500, 31), {}, small);
    spawn('picasso-bug', P3(-436, -16, 0.4), {}, small); spawn('picasso-bug', P3(-310, -31, 0.4), {}, small);
    spawn('ladybird', P3(-380, -17, 1.2), {}, small); spawn('ladybird', P3(-245, -20, 1.2), {}, small); spawn('ladybird', P3(518, 18, 1.2), {}, small);
    // the twilight secret: fire salamanders come out on the wet banks only at dawn and dusk
    if (tod === 'dawn' || tod === 'dusk') {
      spawn('fire-salamander', P3(-418, -14.5), {}, small); spawn('fire-salamander', P3(-334, -15), {}, small);
      spawn('fire-salamander', P3(-268, -14), {}, small); spawn('fire-salamander', P3(516, 14), {}, small);
    }

    // the cliff path: goats on the wall, raptors on the spires, flocks below and above the van
    const wallSpot = (z, y, dd = 0) => { const d = dAtHeight(z, y) + dd; return P3(z, d); };
    spawn('markhor', wallSpot(-176, 16, -3)); spawn('markhor', wallSpot(-110, 29, -2)); spawn('markhor', wallSpot(-70, 49, 3));
    spawn('markhor', wallSpot(120, 40, -3)); spawn('markhor', wallSpot(170, 24, 4));
    spawn('harpy-eagle', P3(-36, -116, 6), { perch: true });
    spawn('harpy-eagle', P3(150, -112, 4), { perch: true });
    spawn('crested-caracara-perched', wallSpot(-140, 40, -2)); spawn('crested-caracara-perched', wallSpot(-60, 24, -4));
    spawn('crested-caracara', new THREE.Vector3(XC(-120) - 10, 38, -120), {}, { seeAt: 260 });
    spawn('crested-caracara', new THREE.Vector3(XC(60) + 6, 104, 60), {}, { seeAt: 260 });
    spawn('argentavis-giant-bird', new THREE.Vector3(XC(-18) + 10, 92, -18), { radius: 70 }, { seeAt: 420 });
    spawn('fallow-deer', P3(-176, -150)); spawn('fallow-deer', P3(-120, -146)); spawn('fallow-deer', P3(-30, -128)); spawn('fallow-deer', P3(20, -132));

    // the deep pool: the floor dwellers on the bottom, the drifters in the open water
    const PD = (z, d, above) => { const p = at(z, d); p.y = Math.min(WATER - 1.2, groundY(p.x, p.z) + above); return p; };
    const zs = (k) => lerp(POOL.z0 + 50, POOL.z1 - 30, k);
    spawn('coconut-octopus-glowing', PD(zs(0.12), -14, 0)); spawn('coconut-octopus-glowing', PD(zs(0.62), 10, 0));
    spawn('nautilus', PD(zs(0.2), 4, 5)); spawn('nautilus', PD(zs(0.7), -6, 6));
    spawn('leafy-seadragon', PD(zs(0.3), -12, 3)); spawn('leafy-seadragon', PD(zs(0.82), 14, 3.5));
    spawn('jellyfish-swarm', PD(zs(0.42), 8, 8)); spawn('jellyfish', PD(zs(0.1), 6, 9)); spawn('jellyfish', PD(zs(0.9), -4, 9));
    spawn('giant-isopod', PD(zs(0.25), -8, 0)); spawn('giant-isopod', PD(zs(0.74), 16, 0));
    spawn('sea-slug-nudibranch', PD(zs(0.16), 8, 0), {}, small); spawn('sea-slug-nudibranch', PD(zs(0.52), -12, 0), {}, small); spawn('sea-slug-nudibranch', PD(zs(0.86), 2, 0), {}, small);
    spawn('feather-duster-worm', PD(zs(0.05), -10, 0)); spawn('feather-duster-worm', PD(zs(0.45), 13, 0)); spawn('feather-duster-worm', PD(zs(0.78), -9, 0));
    spawn('sea-pen', PD(zs(0.34), 10, 0)); spawn('sea-pen', PD(zs(0.58), -16, 0)); spawn('sea-pen', PD(zs(0.95), 9, 0));
    spawn('deep-sea-cucumber', PD(zs(0.38), -4, 6)); spawn('deep-sea-cucumber', PD(zs(0.66), 4, 4));
    // the salamanders of the pool (walking its floor, gills glowing) and shoals of tetras above them
    spawn('axolotl', PD(zs(0.08), 3, 0), {}, small); spawn('axolotl', PD(zs(0.47), -5, 0), {}, small); spawn('axolotl', PD(zs(0.8), 6, 0), {}, small);
    spawn('lantern-tetra', PD(zs(0.18), -2, 4.5)); spawn('lantern-tetra', PD(zs(0.5), 4, 5.5), { count: 36 }); spawn('lantern-tetra', PD(zs(0.88), -4, 4));
    // the secret: the goblin shark only comes up from the deep at night
    if (night) spawn('goblin-shark', PD(zs(0.55), 0, 5));

    const colliders = [ground, boulders, slabs, hoodoos, overhangs, crowns, poolRocks];
    const AMB = {
      under: { every: 2.2, kind: 'noise', hz: 260, vol: 0.12 },
      cliff: { day: { every: 3.4, kind: 'chirp', hz: 2100, vol: 0.16 }, night: { every: 5, kind: 'hoot', hz: 380, vol: 0.14 } },
    };

    return {
      path, groundY, creatures, colliders, palette: P,
      under: ROUTE.under[tod] || ROUTE.under.day,
      waterY: () => WATER,
      dive: [dive0, dive1],
      sections,
      ambience: ROUTE.ambience[tod] || ROUTE.ambience.day,
      ambient(u, t, under) {
        if (under > 0.5) return AMB.under;
        if (u > uClimb && u < uDown + 0.05) return t === 'night' ? AMB.cliff.night : AMB.cliff.day;
        return null;
      },
      speedAt(u) {
        let k = 1;
        for (const s of SETS) k = Math.min(k, 1 - s.k * Math.exp(-((u - s.u) * (u - s.u)) / (s.w * s.w)));
        if (u > uClimb && u < uRim) k *= 0.9;                         // the ledges are taken carefully
        else if (u > uRim + 0.02 && u < uDown) k *= 1.25;               // the rim is open and quick
        if (u > dive0 && u < dive1) k *= 0.85;                          // and the pool is worth the time
        return Math.max(0.16, k);
      },
      poi(u) {
        if (Math.abs(u - uLook) < 0.05) return new THREE.Vector3(XC(40), 20, 40);   // down into the canyon
        return null;
      },
      update(dt, env) {
        T.time.value = env.t;
        fallTex.offset.y = env.t * 0.9;
        const under = env.under > 0.5;
        spray.visible = !under;
        shaftMesh.visible = under || env.camPos.y < 6;
        motesWater.visible = under; motesAir.visible = !under;
        (under ? motesWater : motesAir).step(dt, env.camPos, env.t);
      },
    };
  },
};
