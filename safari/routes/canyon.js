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
import { seeded, smooth, lerp, noise2, roadIndex, heightGrid, roadBand, instanced, addCaustics, addSway, shaftMaterial, motes, pacing } from '../terrain.js';
import * as FLOOR from '../fauna/floor.js';
import * as CLIFFS from '../fauna/cliffs.js';
import * as DEEP from '../fauna/deep.js';
import * as WATERFOLK from '../fauna/pool.js';
import { planPoses } from '../poses.js';
import { plantCanyon } from './canyon-plants.js';

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

// What sets off each species' rare pose (see safari/poses.js). The pose is the species' own:
const POSES = {
  // the floor
  'saiga-antelope': 'near',          // stotting: stiff-legged leaps, the nose flared
  'cape-buffalo': 'near',            // snorts, tosses its head and paws the ground at the van
  'giant-tortoise': 'feed',          // after eating it stretches its neck right up to browse
  'frilled-lizard': 'startle',       // feed landing close startles it: it jumps and opens its frill
  'fennec-fox': 'near',              // hears prey: ears flick, a crouch, a pounce, then it digs
  'peacock-spider': 'near',          // the courtship dance: the striped fan up and shaking
  'stag-beetle': 'startle',          // rears up and opens its jaws at the food that dropped by it
  'picasso-bug': 'feed',             // after feeding, its markings pulse with light
  ladybird: 'feed',                  // feed sets the swarm spiralling up
  'fire-salamander': 'near',         // rears up, its yellow markings flaring (dawn and dusk only)
  // the cliffs and the rim
  markhor: 'near',                   // rears up on its hind legs
  'fallow-deer': 'near',             // the buck groans: head up, neck stretched
  'harpy-eagle': 'near',             // raises its crest and mantles its wings
  'crested-caracara': 'near',        // perched: the head-throw, head flung back, calling
  'crested-caracara:flock': 'feed',  // the circling flock: feed on the ground makes it dive for it
  'argentavis-giant-bird': 'near',   // a low pass over the van, everything spread
  'secretary-bird': 'near',          // stretches, wings half open and the crest up
  cassowary: 'feed',                 // after eating it stretches up, fluffs its coat and booms
  'crowned-eagle': 'always',         // its wing spread as the van passes (FEAT-002), every run
  'himalayan-griffon': 'always',     // the take-off run, the close pass and the stretch (FEAT-001), every run
  // the deep pool
  'coconut-octopus-glowing': 'startle',  // sinking feed: it pulls its shell over itself and flares
  nautilus: 'near',                  // one slow turn while light runs along its chambers
  'leafy-seadragon': 'near',         // its leafy fins flutter fast and glow
  jellyfish: 'near',                 // the bells pulse bright
  'goblin-shark': 'feed',            // after feeding, three slingshot strikes of its jaw (night only)
  'giant-isopod': 'startle',         // rolls up at the food that sank by it, antennae waving
  'sea-slug-nudibranch': 'near',     // its gills and horns flare
  'feather-duster-worm': 'feed',     // after feeding, the crowns glow
  'sea-pen': 'near',                 // the colony waves and lights up
  'deep-sea-cucumber': 'near',       // lifts off and shows its glowing veil
  axolotl: 'feed',                   // after eating it hovers and rears, gills flaring
  'lantern-tetra': 'feed',           // after feeding the shoal balls up and flashes
  'sea-anemone': 'feed',             // after feeding the crowns open wide and light runs along them
};

export const ROUTE = {
  id: 'canyon',
  name: 'Canyon',
  seconds: 125,                                           // the cruising pace; the stretches in PACE slow it down and speed it up
  // the animals that only come out at one time of day (the van's field log hints at them)
  secrets: [
    { id: 'goblin-shark', name: 'Goblin shark', when: 'NIGHT' },
    { id: 'fire-salamander', name: 'Fire salamander', when: 'DAWN OR DUSK' },
  ],
  eyeHeight: 2.05,
  yawLimit: 2.7,
  palette: {
    dawn: { top: 0x3a5584, horizon: 0xf0aa78, ground: 0x8a5a44, fog: 0xd6a184, near: 120, far: 760, sun: [0xffcf9c, 1.7, [-0.55, 0.22, 0.9]], hemi: [0xd9dff0, 0x7a4a34, 0.6], amb: 0.25 },
    day: { top: 0x6c9cd6, horizon: 0xcfe0ee, ground: 0xb06a44, fog: 0xd8c2ad, near: 160, far: 900, sun: [0xfff1dc, 2.5, [0.55, 0.78, 0.3]], hemi: [0xdce8f5, 0x9a5a3c, 0.8], amb: 0.2 },
    dusk: { top: 0x27345f, horizon: 0xe8885a, ground: 0x6b3e2e, fog: 0xb07a62, near: 90, far: 640, sun: [0xffa860, 1.4, [0.8, 0.14, -0.45]], hemi: [0xc2b2cc, 0x5a3426, 0.55], amb: 0.24 },
    night: { top: 0x060b19, horizon: 0x1b2d4f, ground: 0x4a4650, fog: 0x14203a, near: 60, far: 480, sun: [0x9ab4e8, 1.5, [-0.3, 0.6, -0.6]], hemi: [0x5a72a8, 0x2a2430, 1.35], amb: 0.55 },   // a bright moon: the canyon reads from the lookout
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
      // (past the first ledge: the slab's back end has to sit in rock that rises above it, or it
      // floats off the lip of a step)
      let o = 5;
      while (o < 20 && groundY(p.x + s.x * o, p.z + s.z * o) < y0 + 1.6) o += 0.5;
      if (o >= 20) continue;
      over.push({ p: p.clone().addScaledVector(s, o + 0.4).setY(y0), s: [3.4 + rand() * 1.2, 0.9 + rand() * 0.7, 3.5 + rand() * 3], ry: Math.atan2(s.x, s.z) + (rand() - 0.5) * 0.3 });
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
    let uDown = 0; ts.forEach((p, i) => { if (p.y > RIM - 1) uDown = i / 1600; });
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
    // the pace: slow where an animal is worth the time or needs the long lens, quicker where the
    // view is the point. u is progress along the road (the stretches above, the dive from 0.80 to 0.96)
    const PACE = [
      { u: 0.04, w: 0.035, k: 0.6 },                         // the saiga herd on the bank, lizards and spiders on the boulders
      { u: 0.097, w: 0.03, k: 0.5 },                         // the cape buffalo by the river, a giant tortoise
      { u: 0.14, w: 0.02, k: 0.75 },                         // a tortoise, beetles and a spider close to the road
      { u: 0.185, w: 0.03, k: 0.6, zoom: true },             // the second herd below the foot of the cliff path: long lens
      { u: 0.25, w: 0.02, k: 0.6 },                          // a markhor on the ledge right above the road
      { u: uHairpin, w: 0.02, k: 0.5 },                      // the hairpin, a caracara strutting on the ledge
      { u: 0.346, w: 0.018, k: 0.65 },                       // a markhor on the upper leg
      { u: 0.415, w: 0.03, k: 1.3 },                         // the top of the climb: the drop is the point
      { u: 0.525, w: 0.03, k: 0.75, zoom: true },            // fallow deer grazing far out on the plateau
      { u: uLook, w: 0.04, k: 0.4, zoom: true },             // the lookout: the giant bird far out (by day), a harpy eagle, the deer
      { u: 0.65, w: 0.02, k: 0.6 },                          // a harpy eagle on the rim where the road drops off it
      { u: 0.735, w: 0.025, k: 0.6 },                        // two markhor on the wall beside the road
      { u: 0.775, w: 0.015, k: 1.25 },                       // the last of the wall down to the pool: nothing close
      { u: 0.855, w: 0.025, k: 0.55 },                       // the pool: octopus, nautilus, seadragon, anemones, axolotls
      { u: 0.878, w: 0.01, k: 1.2 },                         // straight through the jellyfish swarm
      { u: 0.92, w: 0.025, k: 0.55 },                        // the far half of the pool: isopods, sea pens, seadragon
      { u: 0.985, w: 0.02, k: 0.65 },                        // back on the floor: tortoise, fox, beetle by the road
    ];
    if (night) PACE.push({ u: 0.9, w: 0.02, k: 0.6 });       // the goblin shark comes up at night

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
    for (let i = 0; i < 5; i++) spawn('saiga-antelope', P3(-405 + jit(14), -15 + jit(3)));          // on the bank, not standing in the river
    for (let i = 0; i < 3; i++) spawn('saiga-antelope', P3(-225 + jit(10), -16 + jit(4)));          // below the foot of the cliff path (further on they were out of reach)
    spawn('cape-buffalo', P3(-338, -13)); spawn('cape-buffalo', P3(-326, -9)); spawn('cape-buffalo', P3(-316, 16));
    spawn('giant-tortoise', P3(-372, -33)); spawn('giant-tortoise', P3(-262, -15)); spawn('giant-tortoise', P3(512, 34));
    spawn('frilled-lizard', P3(-425, -14)); spawn('frilled-lizard', P3(-358, -15)); spawn('frilled-lizard', P3(-282, -35));
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
    spawn('markhor', wallSpot(-200, 3, 8)); spawn('markhor', wallSpot(-110, 29, -2)); spawn('markhor', wallSpot(-70, 49, 3));
    spawn('markhor', wallSpot(120, 40, -3)); spawn('markhor', wallSpot(176, 40, 0));
    // the eagles sit on the cap of the hoodoo behind their spot: the nearest one farther from the road
    const onHoodoo = (z, d) => {
      const p = at(z, d), out = road.at(p.x, p.z).d;
      let best = null, bestD = Infinity;
      for (const h of hoodooSpots) {
        const dd = Math.hypot(h.p.x - p.x, h.p.z - p.z);
        if (dd < bestD && road.at(h.p.x, h.p.z).d > out) { best = h; bestD = dd; }
      }
      return best.p.clone().setY(best.p.y + best.s[1] + 0.3);      // the top face of its cap
    };
    spawn('harpy-eagle', onHoodoo(-36, -116), { perch: true });
    spawn('harpy-eagle', onHoodoo(60, -118), { perch: true });
    spawn('crested-caracara-perched', wallSpot(-140, 40, -2)); spawn('crested-caracara-perched', wallSpot(-60, 24, -4));
    // the birds that only fly roost after dark: against the night sky they could not be made out
    if (!night) {
      spawn('crested-caracara', new THREE.Vector3(XC(-120) - 10, 38, -120), {}, { seeAt: 260 });
      spawn('crested-caracara', new THREE.Vector3(XC(60) + 6, 94, 60), {}, { seeAt: 260 });
      spawn('argentavis-giant-bird', new THREE.Vector3(XC(-18) + 10, 92, -18), { radius: 70 }, { seeAt: 420 });
    }
    // the vultures (Himalayan griffons), on the quiet stretch along the rim before the deer: by day one
    // stands at the lip ahead of the van, runs off it as the van comes up, circles in front of it and
    // rises on the air over the canyon; one passes the lens close on the upper leg of the climb; three
    // circle high above the climb. After dark all five roost on ledges and the lip, seen by their glow.
    const lipD = (z) => {                                    // just short of where the plateau breaks into the wall
      const d0 = -(wallStart(z) + WALL) - 10, p0 = at(z, d0), y0 = groundY(p0.x, p0.z);
      for (let d = d0; d < d0 + 20; d += 0.25) { const p = at(z, d); if (groundY(p.x, p.z) < y0 - 1.2) return d - 0.8; }
      return d0 + 10;
    };
    const RUN_Z = -128, runStand = P3(RUN_Z, lipD(RUN_Z) - 4), runEdge = P3(RUN_Z + 1, lipD(RUN_Z + 1));
    if (!night) {
      const th = at(RUN_Z + 24, lipD(RUN_Z + 24) + 18);
      spawn('himalayan-griffon', runStand, { mode: 'run', from: 0.46, near: 34, edge: runEdge, thermal: th.setY(RIM + 38), yaw: Math.atan2(runEdge.x - runStand.x, runEdge.z - runStand.z) - 2 });
      const pc = path.getPointAt(0.415);
      spawn('himalayan-griffon', new THREE.Vector3(pc.x + 16, pc.y + 14, pc.z), { mode: 'pass', at: 0.374, side: 1, radius: 12 }, { seeAt: 300 });
      spawn('himalayan-griffon', at(-190, -40).setY(96), { radius: 24, spin: 1 }, { seeAt: 300 });
      spawn('himalayan-griffon', at(-118, -34).setY(108), { radius: 30, spin: -1 }, { seeAt: 300 });
      spawn('himalayan-griffon', at(-64, -46).setY(90), { radius: 19, spin: 1 }, { seeAt: 300 });
    } else {
      // the roosts: one on a ledge above the first leg, three together on the lip above the top of the
      // climb, one where the runner stands by day (spots found by sampling the wall for flat ground in
      // clear view of the road)
      spawn('himalayan-griffon', runStand, { mode: 'roost', yaw: 1.9 });
      spawn('himalayan-griffon', P3(-125, -61), { mode: 'roost', yaw: 1.3 });
      spawn('himalayan-griffon', P3(-185, lipD(-185)), { mode: 'roost', yaw: 2.0 });
      spawn('himalayan-griffon', P3(-170, lipD(-170)), { mode: 'roost', yaw: 1.7 });
      spawn('himalayan-griffon', P3(-200, -98.5), { mode: 'roost', yaw: 1.2 });
    }
    spawn('fallow-deer', P3(-176, -150)); spawn('fallow-deer', P3(-120, -146)); spawn('fallow-deer', P3(-30, -128)); spawn('fallow-deer', P3(20, -132));

    // the deep pool: the floor dwellers on the bottom, the drifters in the open water
    const PD = (z, d, above) => { const p = at(z, d); p.y = Math.min(WATER - 1.2, groundY(p.x, p.z) + above); return p; };
    const zs = (k) => lerp(POOL.z0 + 50, POOL.z1 - 30, k);
    spawn('coconut-octopus-glowing', PD(zs(0.12), -14, 0)); spawn('coconut-octopus-glowing', PD(zs(0.62), 10, 0));
    spawn('nautilus', PD(zs(0.2), 4, 5)); spawn('nautilus', PD(zs(0.7), -6, 6));
    spawn('leafy-seadragon', PD(zs(0.3), -12, 3)); spawn('leafy-seadragon', PD(zs(0.82), 14, 3.5));
    spawn('jellyfish-swarm', PD(zs(0.42), 8, 8)); spawn('jellyfish', PD(zs(0.1), 6, 9)); spawn('jellyfish', PD(zs(0.9), -4, 9));
    spawn('giant-isopod', PD(zs(0.25), -8, 0)); spawn('giant-isopod', PD(zs(0.74), 16, 0));
    spawn('sea-slug-nudibranch', PD(zs(0.16), -4, 0), {}, small); spawn('sea-slug-nudibranch', PD(zs(0.52), -12, 0), {}, small); spawn('sea-slug-nudibranch', PD(zs(0.86), 2, 0), {}, small);
    spawn('feather-duster-worm', PD(zs(0.05), -10, 0)); spawn('feather-duster-worm', PD(zs(0.45), 13, 0)); spawn('feather-duster-worm', PD(zs(0.78), -9, 0));
    spawn('sea-pen', PD(zs(0.34), 10, 0)); spawn('sea-pen', PD(zs(0.58), -16, 0)); spawn('sea-pen', PD(zs(0.95), 9, 0));
    spawn('deep-sea-cucumber', PD(zs(0.38), -4, 6)); spawn('deep-sea-cucumber', PD(zs(0.66), 4, 4));
    // the salamanders of the pool (walking its floor, gills glowing) and shoals of tetras above them
    spawn('axolotl', PD(zs(0.1), -4, 0), {}, small); spawn('axolotl', PD(zs(0.47), -5, 0), {}, small); spawn('axolotl', PD(zs(0.8), 6, 0), {}, small);
    spawn('lantern-tetra', PD(zs(0.18), -2, 4.5)); spawn('lantern-tetra', PD(zs(0.5), 4, 5.5), { count: 36 }); spawn('lantern-tetra', PD(zs(0.88), -4, 4));
    // gardens of sea anemones on the floor beside them, at every time of day (their tips glow after dark)
    spawn('sea-anemone', PD(zs(0.12), 7, 0), {}, small); spawn('sea-anemone', PD(zs(0.44), -9, 0), { count: 8 }, small); spawn('sea-anemone', PD(zs(0.76), 10, 0), {}, small);
    // the secret: the goblin shark only comes up from the deep at night
    if (night) spawn('goblin-shark', PD(zs(0.55), 0, 5));

    // the acacia on the rim, shortly before the road goes down the wall: a gnarled umbrella tree on the
    // plateau side of the road (the view down the canyon stays open), next to the harpy eagle's pillar.
    // A crowned eagle on a bare branch towards the road, a secretary bird on the branch reaching out to
    // the right, a cassowary at its foot. Built in the tree's own frame: +z towards the road, +y up.
    const acacia = (() => {
      const u = 0.641, rp = path.getPointAt(u), tq = path.getPointAt(u + 0.002).sub(rp).setY(0).normalize();
      const side = new THREE.Vector3(-tq.z, 0, tq.x);
      if (Math.abs(rp.x + side.x * 4 - XC(rp.z)) < Math.abs(rp.x - XC(rp.z))) side.negate();    // away from the river
      const base = rp.clone().addScaledVector(side, 13);
      base.y = groundY(base.x, base.z) - 0.15;
      const yaw = Math.atan2(-side.x, -side.z);
      const tree = K.group();
      const bark = lam({ color: night ? 0x3f3630 : 0x5e4a3a }), leaf = lam({ color: night ? 0x34452f : 0x6f7f43, flatShading: true });
      // trunk and limbs: tapered tubes through a few bent points, each limb forking at its end
      const LIMBS = [
        [[[0, -0.3, 0], [0.25, 1.0, 0.1], [-0.12, 1.9, 0.06], [0.05, 2.5, 0]], 0.3, 0.2],               // the trunk, leaning and twisted
        [[[0.05, 2.4, 0], [0.45, 3.2, 1.2], [0.55, 3.9, 2.6], [0.2, 4.3, 4.2]], 0.15, 0.05],               // bare, out towards the road: the eagle's branch
        [[[0.05, 2.4, 0], [1.3, 3.5, -0.2], [2.8, 4.6, 0.3], [4.4, 5.1, 0.9]], 0.15, 0.05],                // bare, reaching out right: the secretary bird's
        [[[0, 2.4, 0], [-1.2, 3.4, -0.6], [-2.6, 4.6, -1.4], [-3.6, 5.4, -1.8]], 0.15, 0.06],
        [[[0, 2.4, 0], [-0.3, 3.8, 0.3], [-0.2, 5.0, 0.4], [0.1, 5.7, 0.2]], 0.14, 0.06],
        [[[0, 2.4, 0], [-1.0, 3.4, 0.9], [-2.2, 4.5, 1.8], [-3.0, 5.3, 2.6]], 0.13, 0.05],
        [[[0.05, 2.4, 0], [0.9, 3.3, -1.3], [1.4, 4.4, -2.6], [1.6, 5.4, -3.4]], 0.13, 0.05],
        // twigs off the limb ends, and a few dead ones poking out of the crown
        [[[-3.6, 5.4, -1.8], [-4.5, 5.6, -1.4], [-5.2, 5.9, -1.5]], 0.07, 0.025],
        [[[-3.0, 5.3, 2.6], [-3.4, 5.6, 3.6], [-3.3, 5.9, 4.3]], 0.07, 0.025],
        [[[1.6, 5.4, -3.4], [2.6, 5.7, -3.9], [3.2, 6.0, -4.0]], 0.07, 0.025],
        [[[0.1, 5.7, 0.2], [0.8, 6.3, 0.5], [1.1, 6.9, 0.4]], 0.06, 0.02],
        [[[0.4, 4.0, 2.9], [1.0, 4.2, 3.5], [1.5, 4.6, 3.8]], 0.05, 0.02],
        [[[3.5, 4.85, 0.6], [3.9, 5.5, 0.3], [4.0, 6.1, 0.1]], 0.05, 0.02],
      ];
      LIMBS.forEach(([pts, r0, r1], i) => K.mesh(K.tube('acacia' + i, pts, r0, r1, 7, 12), bark, [0, 0, 0], tree));
      // the flat umbrella crown: wide, thin clumps laid in two tiers over the left and back limbs
      const CROWN = [[-3.4, 5.6, -1.6, 2.6, 2.2], [-2.7, 5.5, 2.3, 2.4, 2.1], [0, 5.9, 0.3, 2.9, 2.6], [1.5, 5.6, -3.0, 2.3, 2.0],
        [-1.2, 6.1, -0.6, 2.6, 2.3], [-4.6, 5.8, 0.6, 1.8, 1.6], [0.9, 6.0, 2.1, 1.9, 1.6], [-0.8, 5.7, -3.3, 2.0, 1.7]];
      CROWN.forEach(([x, y, z, sx, sz], i) => K.mesh(K.geo('acacia-crown', () => new THREE.IcosahedronGeometry(1, 1)), leaf, [x, y, z], tree, [0, i * 0.9, 0], [sx, 0.42 + 0.05 * (i % 3), sz]));
      K.place(tree, base);
      tree.rotation.y = yaw;
      tree.updateMatrixWorld(true);
      const W = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(tree.matrixWorld);
      // a point on top of limb i, t of the way along it (the tube's radius tapers the same way)
      const onLimb = (i, t) => {
        const [pts, r0, r1] = LIMBS[i], q = new THREE.CatmullRomCurve3(pts.map((v) => new THREE.Vector3(...v))).getPointAt(t);
        return W(q.x, q.y + lerp(r0, r1, t) * 0.9, q.z);
      };
      return { tree, base, yaw, W, onLimb };
    })();
    spawn('crowned-eagle', acacia.onLimb(1, 0.72), { yaw: acacia.yaw - 0.5 });
    spawn('secretary-bird', acacia.onLimb(2, 0.8), { yaw: acacia.yaw + 0.9 });
    {
      const foot = acacia.W(1.4, 0, 2.3);
      foot.y = groundY(foot.x, foot.z);
      const tx = acacia.base.x, tz = acacia.base.z;
      spawn('cassowary', foot, { roam: 3, keep: (x, z) => Math.hypot(x - tx, z - tz) > 1 });
    }

    // the plants (FEAT-005): greener up the cliff path and along the top, sparse spots elsewhere above
    // water. They keep clear of every animal's spot, also of those that are only there at some times of
    // day, so the same plants grow at every time of day.
    const onGround = creatures.filter((c) => c.home.y - groundY(c.home.x, c.home.z) < 3).map((c) => ({ p: c.home, r: 2 }));
    const sometimes = [runStand, runEdge, P3(-125, -61), P3(-185, lipD(-185)), P3(-170, lipD(-170)), P3(-200, -98.5),
      P3(-418, -14.5), P3(-334, -15), P3(-268, -14), P3(516, 14)].map((p) => ({ p, r: 2 }));
    const plants = plantCanyon({
      scene, path, road, groundY, water: WATER, flatRoad: FLAT, roadEdge: HALF + 1, keep, lam, T, night, rim: RIM,
      zone: (u, p) => (p.y < WATER - 0.3 ? null : u > uClimb && u < uDown ? (p.y > 40 ? 'top' : 'climb') : 'rest'),
      away: (p, side) => Math.abs(p.x + side.x * 4 - XC(p.z)) > Math.abs(p.x - XC(p.z)),
      clearOf: [...onGround, ...sometimes, { p: acacia.base, r: 12 }],
      dragons: [[uLook - 0.025, 13, 1.15], [0.47, 12, 1], [uLook + 0.03, 34, 1.2], [0.5, 40, 1.1], [0.585, 30, 0.95]],
    });

    // the rare poses: each species shows its own in about half of the runs (safari/poses.js)
    const poses = planPoses({ creatures, path, plan: POSES });

    const colliders = [ground, boulders, slabs, hoodoos, overhangs, crowns, poolRocks, ...acacia.tree.children];
    const AMB = {
      under: { every: 2.2, kind: 'noise', hz: 260, vol: 0.12 },
      cliff: { day: { every: 3.4, kind: 'chirp', hz: 2100, vol: 0.16 }, night: { every: 5, kind: 'hoot', hz: 380, vol: 0.14 } },
    };

    return {
      path, groundY, creatures, colliders, palette: P, poses,
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
      speedAt: pacing(PACE),
      zoomHint: (() => { const z = PACE.find((p) => p.zoom); return [z.u - z.w * 0.9, z.u + z.w * 1.1]; })(),
      poi(u) {
        if (Math.abs(u - uLook) < 0.05) return new THREE.Vector3(XC(40), 20, 40);   // down into the canyon
        return null;
      },
      update(dt, env) {
        T.time.value = env.t;
        fallTex.offset.y = env.t * 0.9;
        plants.cull(env.camPos);
        const under = env.under > 0.5;
        spray.visible = !under;
        shaftMesh.visible = under || env.camPos.y < 6;
        motesWater.visible = under; motesAir.visible = !under;
        (under ? motesWater : motesAir).step(dt, env.camPos, env.t);
      },
    };
  },
};
