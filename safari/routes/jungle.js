// The jungle: layered forest under a canopy, with light falling through it in still shafts, then a
// wide brackish river that the van floats across (the river mouth and the open sea are in view
// downstream, to the east), and the forest again on the far bank.
//
// The river runs along x (it flows to +x, into the sea); the van drives north along z and crosses
// it between z -150 and z 150, curving a little downstream on the way for the view of the mouth.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeKit } from '../kit.js';
import { seeded, smooth, lerp, noise2, roadIndex, heightGrid, instanced, addSway, shaftMaterial, motes } from '../terrain.js';
import * as FOREST from '../fauna/forest.js';
import * as ESTUARY from '../fauna/estuary.js';

const WATER = 0;
const N1 = noise2(5), N2 = noise2(17), N3 = noise2(29);
const ZC = (x) => 14 * Math.sin(x * 0.006 + 0.5) + 6 * Math.sin(x * 0.017);        // the river's middle
const HALFW = (x) => 132 + Math.max(0, x - 200) * 0.55;                               // its half width, wider to the mouth
const COAST = (z) => 470 + 50 * Math.sin(z * 0.008 + 1) + 20 * N1(z * 0.02, 3);       // where the land ends at the sea
// sandbanks and mangrove islands in the river: [x, z, radius]
const BARS = [[40, -62, 22], [138, 72, 22], [-40, 40, 30], [236, -150, 24], [300, 178, 26], [88, 8, 12], [-150, -40, 26]];

function raw(x, z) {
  const dz = z - ZC(x), a = Math.abs(dz), W = HALFW(x);
  // the forest floor: rolling, roots and hollows
  let land = 1.6 + 2.4 * N1(x * 0.012, z * 0.012) + 0.8 * N2(x * 0.05, z * 0.05) + smooth(W + 10, W + 140, a) * 3;
  // the banks drop to mudflats and then into the channel
  const bank = smooth(W - 34, W + 8, a);
  let y = lerp(-3.6 - 1.4 * N3(x * 0.01, z * 0.01), lerp(-0.25 + 0.45 * N2(x * 0.04, z * 0.04), land, smooth(W - 2, W + 14, a)), bank);
  for (const [bx, bz, r] of BARS) {
    const d = Math.hypot(x - bx, z - bz) / r;
    if (d < 1.6) y = Math.max(y, lerp(0.55 + 0.3 * N1(x * 0.1, z * 0.1), y, smooth(0.6, 1.6, d)));
  }
  // past the coast the land goes down to a beach and the sea floor
  const c = COAST(z);
  if (x > c - 40) y = lerp(y, lerp(0.6, -9, smooth(c, c + 90, x)), smooth(c - 40, c + 10, x));
  return y;
}

const ROAD = [
  // the forest on the south bank
  [-60, -540], [-34, -495], [4, -450], [-8, -404], [-38, -360], [-26, -312], [12, -268], [30, -224], [44, -186],
  // into the water and across, curving downstream for the view of the mouth
  [62, -156], [92, -122], [132, -86], [164, -44], [178, 2], [170, 46], [146, 88], [118, 124], [100, 156],
  // up the north bank and on through the forest
  [86, 190], [56, 232], [62, 280], [36, 326], [6, 372], [-14, 420], [-20, 470],
];

export const ROUTE = {
  id: 'jungle',
  name: 'Jungle',
  seconds: 96,
  eyeHeight: 2.05,
  yawLimit: 2.7,
  palette: {
    dawn: { top: 0x3c5a80, horizon: 0xe7b58e, ground: 0x4a4a32, fog: 0x9a9c84, near: 8, far: 150, sun: [0xffd6a8, 1.5, [0.9, 0.2, 0.2]], hemi: [0xd6e2d8, 0x3a3f26, 0.7], amb: 0.25 },
    day: { top: 0x7aa8d8, horizon: 0xd7e6df, ground: 0x4f5a34, fog: 0x8ea488, near: 10, far: 170, sun: [0xfff2d6, 2.3, [0.45, 0.85, 0.25]], hemi: [0xe2f0e4, 0x3c4a28, 0.85], amb: 0.2 },
    dusk: { top: 0x2b3762, horizon: 0xe59a68, ground: 0x3a3426, fog: 0x6e6658, near: 8, far: 140, sun: [0xffb070, 1.5, [-0.8, 0.25, -0.3]], hemi: [0xc8bcd0, 0x3a3424, 0.95], amb: 0.38 },
    night: { top: 0x060b19, horizon: 0x1b2d4f, ground: 0x343a40, fog: 0x13203a, near: 8, far: 140, sun: [0x9ab4e8, 1.45, [-0.3, 0.6, -0.6]], hemi: [0x5a72a8, 0x223024, 1.3], amb: 0.55 },   // moonlit, like the canyon
  },
  // under the canopy the far trees fade into the colour of the sky low down, so they melt into it
  // instead of standing against it as grey shapes; over the river the haze lifts and the sea shows
  canopy: { dawn: 0xc29f82, day: 0xaec4b6, dusk: 0xb27a58, night: 0x17263c },
  open: { dawn: [60, 900], day: [90, 1200], dusk: [50, 800], night: [40, 520] },
  ambience: {
    day: { wind: 0.03, windCut: 380, band: 0.024, bandHz: 3600 },          // leaves and insects
    dawn: { wind: 0.03, windCut: 340, band: 0.03, bandHz: 3100 },
    dusk: { wind: 0.03, windCut: 360, band: 0.026, bandHz: 4200 },
    night: { wind: 0.025, windCut: 300, band: 0.034, bandHz: 5400 },        // frogs and crickets
  },

  build({ scene, tod, keep }) {
    const rand = seeded(20261010);
    const night = tod === 'night', dim = tod !== 'day';
    const P = ROUTE.palette[tod] || ROUTE.palette.day;
    const T = { time: { value: 0 } };
    const lam = (o) => keep(new THREE.MeshLambertMaterial(o));
    const geo = (g) => keep(g);
    const dark = (hex, k = 0.25) => (night ? new THREE.Color(hex).lerp(new THREE.Color(0x24303a), k) : new THREE.Color(hex));

    // ---- the road: on land it sits on the ground, on the river it floats at the surface
    const ctrl = ROAD.map(([x, z]) => new THREE.Vector3(x, Math.max(raw(x, z) + 0.05, WATER - 0.35), z));
    const path = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
    const road = roadIndex(path, 2);
    const HALF = 3.2;
    function carved(x, z) {
      const r0 = raw(x, z);
      const n = road.at(x, z);
      if (n.d > HALF + 10 || n.y < WATER - 0.2) return r0;          // afloat: the river bed stays as it is
      if (n.d < HALF + 0.8) return n.y - 0.05;
      return lerp(n.y - 0.05, r0, smooth(HALF + 0.8, HALF + 10, n.d));
    }

    // ---- the ground
    const soil = dark(0x4b4128), moss = dark(0x40562c), litter = dark(0x6a5232), mud = dark(0x5a4a36), sand = dark(0xcdb68a), track = dark(0x7a6040), wetSand = dark(0x9a8664);
    const G = heightGrid({
      x0: -280, x1: 600, z0: -580, z1: 520, nx: 180, nz: 226,
      height: carved,
      colour(x, z, y, c) {
        c.copy(soil).lerp(moss, 0.5 + 0.5 * N2(x * 0.05, z * 0.05)).lerp(litter, 0.3 * (0.5 + 0.5 * N3(x * 0.11, z * 0.11)));
        if (y < 1.2) c.lerp(mud, smooth(1.2, 0.2, y));
        const cst = COAST(z);
        if (x > cst - 70) c.lerp(y > 0.2 ? sand : wetSand, smooth(cst - 70, cst - 20, x));
        for (const [bx, bz, r] of BARS) if (Math.hypot(x - bx, z - bz) < r * 1.2 && y > -0.6) c.lerp(sand, 0.55);
        const n = road.at(x, z, 1);
        if (n.d < HALF + 0.6 && y > WATER) c.lerp(track, 0.6 * smooth(HALF + 0.6, HALF - 1.2, n.d));
      },
    });
    const groundY = G.heightAt;
    const ground = new THREE.Mesh(geo(G.geometry), lam({ vertexColors: true }));
    ground.name = 'ground';
    scene.add(ground);

    // ---- the water: brown river water mixing into the green-blue sea, with a swell out at the mouth
    const wg = geo(new THREE.PlaneGeometry(3400, 3400, 110, 110));
    wg.rotateX(-Math.PI / 2);
    wg.translate(800, 0, 0);
    // the colours are worked out per pixel, so the front where the tea-brown river water meets the
    // salt is a crisp line: the fresh water stays in a tongue down the middle, the sea creeps up along
    // the banks, and a seam of pale scum marks where they meet
    const WC = { uRiver: dark(0x5c4524, 0.3), uBrack: dark(0x4d6a48, 0.3), uSea: dark(0x2a8aa0, 0.3), uDeep: dark(0x1d6a8e, 0.3), uFoam: dark(0xe6e2cc, 0.6) };
    // no reflections to speak of, so the sky's own colour is lent to the surface instead
    const waterMat = keep(new THREE.MeshStandardMaterial({ roughness: 0.26, metalness: 0, transparent: true, opacity: 0.92,
      emissive: new THREE.Color(P.horizon).convertSRGBToLinear(), emissiveIntensity: night ? 0.05 : 0.12 }));
    waterMat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = T.time;
      for (const k in WC) sh.uniforms[k] = { value: WC[k] };
      sh.uniforms.uGlow = { value: night ? 1 : tod === 'dusk' ? 0.45 : 0 };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vWp;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float sea = smoothstep(260.0, 620.0, position.x);
          transformed.y += sea * (0.55 * sin(position.x * 0.045 - uTime * 1.3) + 0.25 * sin(position.z * 0.07 + position.x * 0.02 - uTime * 0.9))
            + 0.05 * sin(position.x * 0.3 + position.z * 0.2 + uTime * 2.0);
          vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform float uTime, uGlow; uniform vec3 uRiver, uBrack, uSea, uDeep, uFoam;
          varying vec3 vWp;`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          if (uGlow > 0.0) {
            // glowing plankton: specks that twinkle in the water near the van (dusk and night)
            vec2 w = vWp.xz * 1.4, cell = floor(w), f = fract(w) - 0.5;
            float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
            float tw = 0.5 + 0.5 * sin(uTime * (1.5 + h * 2.0) + h * 40.0);
            float speck = (1.0 - smoothstep(0.04, 0.15, length(f))) * step(0.9, h) * tw;
            totalEmissiveRadiance += vec3(0.35, 0.95, 0.85) * speck * uGlow * 1.6 * (1.0 - smoothstep(15.0, 80.0, length(vWp - cameraPosition)));
          }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          {
            vec2 w = vWp.xz;
            float zc = 14.0 * sin(w.x * 0.006 + 0.5) + 6.0 * sin(w.x * 0.017);
            float sw = 38.0 * sin(w.x * 0.011 + w.y * 0.007) + 22.0 * sin(w.y * 0.023 - w.x * 0.017 + 1.3) + 9.0 * sin(w.x * 0.06 + w.y * 0.05) - abs(w.y - zc) * 0.25;
            float k = smoothstep(-60.0, 260.0, w.x + sw);
            vec3 col = mix(uRiver, uBrack, smoothstep(0.3, 0.38, k));
            col = mix(col, uSea, smoothstep(0.5, 1.0, k));
            col = mix(col, uDeep, smoothstep(700.0, 1600.0, w.x));
            float front = (1.0 - smoothstep(0.0, 0.0045, abs(k - 0.34 + 0.004 * sin(w.x * 0.7 + w.y * 0.5)))) * smoothstep(-0.3, 0.5, sin(w.x * 0.13 + w.y * 0.09) * sin(w.y * 0.05 - w.x * 0.02 + uTime * 0.05));
            // flow lines: long thin streaks drifting downstream on the river
            float st = sin(w.y * 1.3 + 2.0 * sin(w.x * 0.05 + w.y * 0.03));
            float streak = smoothstep(0.94, 1.0, st) * (0.5 + 0.5 * sin(w.x * 0.08 - uTime * 0.9)) * (1.0 - smoothstep(300.0, 600.0, w.x));
            col += uFoam * 0.08 * streak;
            diffuseColor.rgb = mix(col, uFoam, front * 0.4);
            // clearer right by the van, so a dolphin or a fish just under the surface still shows
            diffuseColor.a = mix(0.7, 0.94, smoothstep(6.0, 40.0, length(vWp - cameraPosition)));
          }`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          {
            // ripples: three wave trains bend the normal so the light glints, fading out with distance
            vec2 w = vWp.xz, g = vec2(0.0);
            g += 0.6 * vec2(0.9, 0.3) * cos(dot(w, vec2(0.9, 0.3)) * 1.1 - uTime * 1.7);
            g += 0.5 * vec2(-0.4, 1.0) * cos(dot(w, vec2(-0.4, 1.0)) * 1.7 - uTime * 2.1);
            g += 0.35 * vec2(0.7, -0.8) * cos(dot(w, vec2(0.7, -0.8)) * 2.9 - uTime * 2.9);
            float a = 0.22 * (1.0 + smoothstep(260.0, 620.0, w.x)) * (1.0 - smoothstep(30.0, 180.0, length(vWp - cameraPosition)));
            normal = normalize(normal + (viewMatrix * vec4(-g.x * a, 0.0, -g.y * a, 0.0)).xyz);
          }`);
    };
    const water = new THREE.Mesh(wg, waterMat);
    water.renderOrder = 2;
    scene.add(water);
    // the surf where the river meets the sea: a pale band of foam across the mouth
    const foamPts = [];
    for (let z = -360; z <= 360; z += 24) foamPts.push({ p: new THREE.Vector3(COAST(z) + 110 + 30 * N1(z * 0.02, 7), 0.12, z), s: [8 + rand() * 10, 1, 20], ry: rand() * 0.3 });
    const foam = instanced(geo(new THREE.CircleGeometry(1, 10).rotateX(-Math.PI / 2)), lam({ color: dark(0xe9f2f0, 0.6), transparent: true, opacity: 0.55, depthWrite: false }), foamPts);
    scene.add(foam);

    // the van's wake while it floats: churned foam round the hull and two arms opening out behind
    // (in the van's own frame: +z is behind it, like the rig)
    const wakeMat = keep(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { t: T.time, o: { value: 0 }, c: { value: dark(0xeef4f0, 0.5) } },
      vertexShader: 'varying vec2 vP; void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float t, o; uniform vec3 c; varying vec2 vP;
        void main() {
          float z = vP.y, x = abs(vP.x);
          float hull = 1.0 - smoothstep(0.0, 0.35, abs(length(vP / vec2(1.7, 3.1)) - 1.0));
          float arm = z > 0.0 ? (1.0 - smoothstep(0.0, 0.5 + z * 0.02, abs(x - (1.5 + z * 0.36)))) * (1.0 - smoothstep(6.0, 38.0, z)) : 0.0;
          float trail = z > 2.0 ? (1.0 - smoothstep(0.0, 1.0 + z * 0.03, x)) * (1.0 - smoothstep(4.0, 22.0, z)) * 0.5 : 0.0;
          float n = 0.55 + 0.45 * sin(vP.x * 3.1 + t * 2.3) * sin(vP.y * 2.3 - t * 3.0);
          gl_FragColor = vec4(c, max(max(hull * 0.55, arm * 0.6), trail * 0.35) * n * o);
        }`,
    }));
    const wake = new THREE.Mesh(geo(new THREE.PlaneGeometry(36, 50, 1, 1).rotateX(-Math.PI / 2).translate(0, 0, 20)), wakeMat);
    wake.renderOrder = 3; wake.frustumCulled = false; wake.visible = false;
    scene.add(wake);

    // ---- plants, instanced. First the places, away from the road and out of the water
    const items = (n, test) => {
      const out = [];
      let guard = 0;
      while (out.length < n && guard++ < n * 50) {
        const x = -270 + rand() * 860, z = -570 + rand() * 1080;
        const y = groundY(x, z), r = road.at(x, z);
        const it = test({ x, y, z, road: r.d, coast: COAST(z), a: Math.abs(z - ZC(x)), W: HALFW(x) });
        if (it) out.push({ p: new THREE.Vector3(x, y + (it.lift || 0), z), ry: rand() * 6.28, ...it });
      }
      return out;
    };
    // most of the planting goes where the van can see it: within a band either side of the road
    const near = (n, lo, hi, test) => {
      const out = [];
      let guard = 0;
      while (out.length < n && guard++ < n * 40) {
        const k = Math.floor(rand() * road.pts.length), p = road.pts[k], q = road.pts[Math.min(road.pts.length - 1, k + 1)];
        const t = new THREE.Vector3().subVectors(q, p).setY(0).normalize();
        const off = (rand() < 0.5 ? -1 : 1) * (lo + (hi - lo) * rand() ** 1.6);
        const x = p.x - t.z * off + (rand() - 0.5) * 3, z = p.z + t.x * off + (rand() - 0.5) * 3;
        const y = groundY(x, z), r = road.at(x, z);
        const it = test({ x, y, z, road: r.d, coast: COAST(z), a: Math.abs(z - ZC(x)), W: HALFW(x) });
        if (it) out.push({ p: new THREE.Vector3(x, y + (it.lift || 0), z), ry: rand() * 6.28, ...it });
      }
      return out;
    };
    const land = (q, min = 4.5) => q.y > 0.9 && q.road > min && q.x < q.coast - 40;
    const leafMat = (hex, sway) => {
      const m = lam({ color: dark(hex), side: THREE.DoubleSide });
      return sway ? addSway(m, T, sway) : m;
    };

    // tall forest trees: a trunk with buttress fins, and two or three layers of crown
    const trunkGeo = (() => {
      const parts = [new THREE.CylinderGeometry(0.4, 0.75, 18, 7).translate(0, 9, 0)];
      for (let i = 0; i < 4; i++) {
        const fin = new THREE.BoxGeometry(0.22, 3.2, 2.2).translate(0, 1.6, 1.0);
        fin.rotateY(i * Math.PI / 2 + 0.4);
        parts.push(fin.toNonIndexed());
      }
      return geo(mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)), false));
    })();
    const treeTest = (q) => (land(q, 8) ? { s: [0.8 + rand() * 0.6, 0.7 + rand() * 0.5, 0.8 + rand() * 0.6] } : null);
    const treeSpots = [...near(300, 8, 70, treeTest), ...items(160, treeTest)];
    const trunks = instanced(trunkGeo, lam({ color: dark(0x5e5040) }), treeSpots);
    // a crown is a cluster of lumps (one mesh), so it reads as foliage and not as a parasol
    const crownGeo = (() => {
      const lumps = [[0, 0.1, 0, 0.75], [0.55, -0.05, 0.2, 0.55], [-0.5, 0, 0.3, 0.55], [0.15, 0, -0.55, 0.55], [-0.3, 0.25, -0.3, 0.5], [0.3, 0.3, 0.35, 0.45], [0, -0.25, 0, 0.6]];
      const g = mergeGeometries(lumps.map(([x, y, z, r]) => new THREE.IcosahedronGeometry(r, 0).translate(x, y, z)), false);
      g.deleteAttribute('uv'); g.scale(1, 0.75, 1);
      return geo(g);
    })();
    const crownA = instanced(crownGeo, lam({ color: dark(0x2f5a2a), flatShading: true }),
      treeSpots.map((t) => ({ p: t.p.clone().setY(t.p.y + 18 * t.s[1] + 0.5), s: [8 + rand() * 5, 3.6 + rand() * 2, 8 + rand() * 5], ry: rand() * 6 })));
    const crownB = instanced(crownGeo, lam({ color: dark(0x3e6e2e), flatShading: true }),
      treeSpots.flatMap((t) => [0, 1].map(() => ({ p: t.p.clone().add(new THREE.Vector3((rand() - 0.5) * 9, 18 * t.s[1] - 2 - rand() * 4, (rand() - 0.5) * 9)), s: [4 + rand() * 3.5, 2.2 + rand() * 1.2, 4 + rand() * 3.5], ry: rand() * 6 }))));
    // shrubs: the dark green mass that fills the gaps between the trunks
    const shrubs = instanced(geo(new THREE.IcosahedronGeometry(1, 0).scale(1, 0.75, 1)), lam({ color: dark(0x2c4f26), flatShading: true }),
      near(520, 5, 60, (q) => (land(q, 5) ? { s: [1.4 + rand() * 2.2, 1.2 + rand() * 1.8, 1.4 + rand() * 2.2], lift: 0.4 } : null)));

    // palms: a leaning trunk and a crown of fronds that sway
    const palmTrunkGeo = geo(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.4, 5, 0), new THREE.Vector3(1.6, 10, 0)), 8, 0.28, 6));
    const frondGeo = (() => {
      const parts = [];
      for (let i = 0; i < 11; i++) {
        const sh = new THREE.Shape();
        sh.moveTo(0, 0); sh.quadraticCurveTo(1.6, 0.35, 4.6, -0.9); sh.quadraticCurveTo(1.6, -0.25, 0, 0);
        const f = new THREE.ShapeGeometry(sh, 3);
        f.rotateX(-Math.PI / 2 + 0.2);
        f.rotateZ(-0.25 - (i % 3) * 0.12);
        f.rotateY((i / 11) * Math.PI * 2);
        parts.push(f.toNonIndexed());
      }
      const g = mergeGeometries(parts, false);
      g.translate(1.6, 10, 0);
      return geo(g);
    })();
    const palmTest = (q) => (q.y > 0.4 && q.road > 5 && q.x < q.coast + 20 ? { s: 0.8 + rand() * 0.6 } : null);
    const palmSpots = [...near(220, 5, 50, palmTest), ...items(90, palmTest)];
    const palmTrunks = instanced(palmTrunkGeo, lam({ color: dark(0x6f5f48) }), palmSpots);
    const fronds = instanced(frondGeo, leafMat(0x4d7a34, { amp: 0.35, speed: 1.1, height: 12 }), palmSpots);

    // the understorey: ferns, big leaves and bamboo
    const fernGeo = (() => {
      const parts = [];
      for (let i = 0; i < 9; i++) {
        const f = new THREE.PlaneGeometry(0.5, 2.2, 1, 2).translate(0, 1.1, 0);
        const p = f.attributes.position;
        for (let k = 0; k < p.count; k++) { const y = p.getY(k); p.setZ(k, y * y * 0.18); p.setX(k, p.getX(k) * (1 - y / 2.6)); }
        f.rotateX(-0.6); f.rotateY((i / 9) * Math.PI * 2);
        parts.push(f.toNonIndexed());
      }
      return geo(mergeGeometries(parts, false));
    })();
    const ferns = instanced(fernGeo, leafMat(0x5d8a3a, { amp: 0.12, speed: 1.6, height: 2 }), near(900, 4, 40, (q) => (land(q, 4) ? { s: 0.7 + rand() * 0.9 } : null)));
    const bigLeafGeo = (() => {
      const parts = [];
      for (let i = 0; i < 5; i++) {
        const sh = new THREE.Shape();
        sh.moveTo(0, 0); sh.bezierCurveTo(0.9, 0.3, 0.8, 1.6, 0, 2.1); sh.bezierCurveTo(-0.8, 1.6, -0.9, 0.3, 0, 0);
        const f = new THREE.ShapeGeometry(sh, 4);
        f.rotateX(-1.0); f.translate(0, 1.2, 0.2); f.rotateY((i / 5) * Math.PI * 2 + i);
        parts.push(f.toNonIndexed());
        parts.push(new THREE.CylinderGeometry(0.03, 0.04, 1.3, 3).translate(0, 0.65, 0).toNonIndexed());
      }
      return geo(mergeGeometries(parts.map((g) => { g.deleteAttribute('uv'); return g; }), false));
    })();
    const bigLeaves = instanced(bigLeafGeo, leafMat(0x2f6a34, { amp: 0.1, speed: 1.3, height: 2.5 }), near(420, 4.2, 36, (q) => (land(q, 4.2) ? { s: 0.8 + rand() * 0.9 } : null)));
    // bamboo: a grove in the panda's clearing and clumps elsewhere
    const bambooItems = [];
    const grove = (x, z, n, r) => { for (let i = 0; i < n; i++) { const a = rand() * 6.28, d = Math.sqrt(rand()) * r; const bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d; if (road.at(bx, bz).d < 5) continue; bambooItems.push({ p: new THREE.Vector3(bx, groundY(bx, bz), bz), s: [1, 0.7 + rand() * 0.6, 1], rx: (rand() - 0.5) * 0.15, rz: (rand() - 0.5) * 0.15 }); } };
    grove(-28, -392, 70, 16); grove(18, -404, 40, 9); grove(62, 300, 50, 12);
    items(30, (q) => (land(q, 7) ? q : null)).forEach((q) => grove(q.p.x, q.p.z, 8, 3));
    const bamboo = instanced(geo(new THREE.CylinderGeometry(0.09, 0.11, 9, 5).translate(0, 4.5, 0)), addSway(lam({ color: dark(0x7f9a3e) }), T, { amp: 0.4, speed: 0.9, height: 9 }), bambooItems);
    const bambooLeaves = instanced(geo(new THREE.ConeGeometry(0.9, 3, 5).translate(0, 7.8, 0)), addSway(lam({ color: dark(0x6a9a3a), flatShading: true }), T, { amp: 0.4, speed: 0.9, height: 9 }), bambooItems);

    // lianas hanging from the canopy over the road
    const lianaItems = near(220, 2.5, 18, (q) => (land(q, 2.5) ? { s: [1, 0.5 + rand() * 0.6, 1], lift: 9 + rand() * 6 } : null));
    const lianas = instanced(geo(new THREE.CylinderGeometry(0.05, 0.05, 14, 3).translate(0, 7, 0)), addSway(lam({ color: dark(0x4a5a2a) }), T, { amp: 0.3, speed: 0.6, height: 14 }), lianaItems.map((l) => ({ ...l, rx: Math.PI })));

    // mangroves: a crown on arching prop roots, on the banks, the mudflats and the islands
    const mangroveRootGeo = (() => {
      const parts = [new THREE.CylinderGeometry(0.22, 0.3, 3.4, 6).translate(0, 3.6, 0).toNonIndexed()];
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + (i % 2) * 0.2, r = 1.8 + (i % 3) * 0.6;
        const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 2.6 + (i % 3) * 0.4, 0), new THREE.Vector3(Math.cos(a) * r * 0.5, 3.4, Math.sin(a) * r * 0.5), new THREE.Vector3(Math.cos(a) * r, -0.6, Math.sin(a) * r));
        parts.push(new THREE.TubeGeometry(c, 4, 0.08, 3).toNonIndexed());
      }
      return geo(mergeGeometries(parts.map((g) => { g.deleteAttribute('uv'); return g; }), false));
    })();
    const mangroveSpots = items(150, (q) => {
      const nearBank = Math.abs(q.a - q.W) < 26 || BARS.some(([bx, bz, r]) => Math.hypot(q.x - bx, q.z - bz) < r * 1.05);
      return nearBank && q.y > -1.6 && q.y < 1.4 && q.road > 7 && q.x < q.coast + 30 ? { s: 0.9 + rand() * 0.6, lift: 0 } : null;
    });
    mangroveSpots.forEach((m) => { m.p.y = Math.max(m.p.y, WATER - 0.6); });
    const mangroveRoots = instanced(mangroveRootGeo, lam({ color: dark(0x5a4a3a) }), mangroveSpots);
    const mangroveCrowns = instanced(crownGeo, lam({ color: dark(0x3b6634), flatShading: true }),
      mangroveSpots.map((m) => ({ p: m.p.clone().setY(m.p.y + 5.6 * m.s), s: [3.4 * m.s, 2.8 * m.s, 3.4 * m.s], ry: rand() * 6 })));
    // the river's banks: a wall of forest behind the mangroves, as seen from the water
    const bankWall = [];
    for (let i = 0; i < 380; i++) {
      const x = -280 + rand() * 760, side = rand() < 0.5 ? -1 : 1, off = 8 + rand() ** 1.5 * 70;
      const z = ZC(x) + side * (HALFW(x) + off);
      if (x > COAST(z) - 50 || road.at(x, z).d < 14) continue;
      const y = groundY(x, z);
      bankWall.push({ p: new THREE.Vector3(x, y + 4 + rand() * 9, z), s: [7 + rand() * 7, 4 + rand() * 4, 7 + rand() * 7], ry: rand() * 6 });
    }
    const bankCrowns = instanced(crownGeo, lam({ color: dark(0x2e5a2a), flatShading: true }), bankWall);
    // half-sunk logs in the shallows
    const logs = instanced(geo(new THREE.CylinderGeometry(0.35, 0.45, 9, 6).rotateZ(Math.PI / 2)), lam({ color: dark(0x6b5a46) }),
      items(26, (q) => (q.y < 0.2 && q.y > -2.2 && q.road > 8 && q.x < q.coast ? { lift: 0, rx: 0.1, s: [0.7 + rand() * 0.6, 1, 1] } : null)).map((l) => ({ ...l, p: l.p.setY(WATER - 0.12) })));

    // the far shore of the sea: low hills in the haze, so the horizon is not empty
    const hills = [];
    for (let i = 0; i < 9; i++) hills.push({ p: new THREE.Vector3(1500 + rand() * 300, -4, -700 + i * 160 + rand() * 60), s: [160 + rand() * 160, 10 + rand() * 18, 90 + rand() * 80], ry: rand() });
    // and sea stacks off the mouth, with surf round their feet, for a sense of how far the sea goes
    const stacks = [], surf = [];
    for (let i = 0; i < 9; i++) {
      const x = 640 + rand() * 520, z = -420 + rand() * 840, h = 10 + rand() * 26;
      stacks.push({ p: new THREE.Vector3(x, -3, z), s: [5 + rand() * 7, h, 5 + rand() * 7], ry: rand() * 6 });
      surf.push({ p: new THREE.Vector3(x, 0.15, z), s: [9 + rand() * 6, 1, 9 + rand() * 6], ry: rand() * 6 });
    }
    for (let i = 0; i < 70; i++) surf.push({ p: new THREE.Vector3(560 + rand() * 900, 0.2, -700 + rand() * 1400), s: [3 + rand() * 9, 1, 0.6 + rand()], ry: (rand() - 0.5) * 0.4 });
    scene.add(instanced(geo(new THREE.CylinderGeometry(0.7, 1, 1, 6).translate(0, 0.5, 0)), lam({ color: dark(0x6f6658, 0.5), flatShading: true }), stacks));
    scene.add(instanced(geo(new THREE.CircleGeometry(1, 8).rotateX(-Math.PI / 2)), lam({ color: dark(0xf2f7f4, 0.6), transparent: true, opacity: 0.5, depthWrite: false }), surf));
    scene.add(instanced(geo(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)), lam({ color: dark(0x5f7a5a, 0.6), flatShading: true }), hills));

    // ---- light through the canopy: still shafts, warm by day and cool at night
    const shaftGeo = geo(new THREE.CylinderGeometry(1, 0.6, 1, 8, 1, true).translate(0, -0.5, 0));
    const shafts = items(46, (q) => (land(q, 3) && q.road < 26 ? { s: [0.8 + rand() * 1.5, 26, 0.8 + rand() * 1.5], lift: 25, rx: 0.22 + (rand() - 0.5) * 0.1, rz: 0.15 } : null));
    const shaftMesh = instanced(shaftGeo, keep(shaftMaterial(night ? 0x8fb0e0 : tod === 'day' ? 0xfff0c0 : 0xffc890, night ? 0.035 : 0.09)), shafts);
    // drifting things in the air: pollen by day, fireflies at night
    const air = motes({ n: night ? 320 : 220, box: 40, color: night ? 0xd8ff8a : 0xfff2c8, size: night ? 0.14 : 0.06, opacity: night ? 0.85 : 0.5, drift: [0.15, 0.06, 0.1] });
    keep(air.geometry); keep(air.material);

    [trunks, crownA, crownB, shrubs, bankCrowns, palmTrunks, fronds, ferns, bigLeaves, bamboo, bambooLeaves, lianas, mangroveRoots, mangroveCrowns, logs, shaftMesh, air].forEach((m) => scene.add(m));

    // ---- where the route is what
    const ts = path.getSpacedPoints(1200);
    const wet = ts.map((p) => p.y < WATER - 0.2);
    const uIn = wet.indexOf(true) / 1200, uOut = wet.lastIndexOf(true) / 1200;
    const uNear = (x, z) => { let best = 0, bd = Infinity; ts.forEach((p, i) => { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = i / 1200; } }); return best; };
    const sections = [
      { u: 0, title: 'Jungle', line: 'canopy · ferns · light' },
      { u: uIn - 0.025, title: 'The brackish river', line: 'mangroves · mudflats · the sea downstream' },
      { u: uOut + 0.01, title: 'The far bank', line: 'back under the canopy' },
    ];
    const SETS = [
      { u: uNear(-24, -392), k: 0.62, w: 0.03 },            // the panda's bamboo clearing
      { u: uNear(110, -104), k: 0.55, w: 0.035 },           // the mudflat and the herons
      { u: uNear(178, 2), k: 0.6, w: 0.04 },                // mid river: dolphins, the sea in view
      { u: uNear(56, 236), k: 0.55, w: 0.03 },              // the giant tree with its night shift
    ];

    // ---- the animals
    const K = makeKit({ scene, keep, tod, groundY, waterY: () => WATER, seed: 808 });
    const B = { ...FOREST.BUILDERS, ...ESTUARY.BUILDERS };
    const creatures = [];
    // everything starts out turned towards the road (give or take), so a perched animal never
    // shows the van its back for the whole drive
    const facing = (h) => { const q = path.getPointAt(uNear(h.x, h.z)); return Math.atan2(q.x - h.x, q.z - h.z); };
    const spawn = (id, home, opts = {}, extra = {}) => {
      if (!B[id]) return null;
      if (opts.yaw === undefined) opts = { ...opts, yaw: facing(home) + (rand() - 0.5) * 0.8 };
      const c = B[id](K, home, opts);
      if (!c) return null;
      Object.assign(c, extra);
      creatures.push(c);
      return c;
    };
    // a point beside the road at progress u: `side` metres to the right (negative: left)
    const beside = (u, side, lift = 0) => {
      const p = path.getPointAt(u), t = path.getTangentAt(u);
      const s = new THREE.Vector3(-t.z, 0, t.x).normalize();
      const q = p.clone().addScaledVector(s, side);
      q.y = groundY(q.x, q.z) + lift;
      return q;
    };
    const onWater = (u, side, lift = 0) => { const q = beside(u, side); q.y = WATER + lift; return q; };
    // a spot on the mudflats or a sandbank near the point `side` metres beside u: the nearest place
    // whose ground lies between lo and hi (so the waders stand in the shallows, not on the river bed)
    const shore = (u, side, lo = -0.25, hi = 0.8) => {
      const q0 = beside(u, side);
      for (let r = 0; r < 60; r += 1.5) {
        const n = Math.max(1, Math.round(r * 0.8));
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + r, x = q0.x + Math.cos(a) * r, z = q0.z + Math.sin(a) * r;
          const y = groundY(x, z);
          if (y > lo && y < hi && road.at(x, z).d > 6) return new THREE.Vector3(x, y, z);
        }
      }
      return q0;
    };
    // shore animals stay where their feet reach the bottom; a fleeing heron lands back on it
    const wade = (c, deep = -0.45) => {
      if (!c) return c;
      c.keep = (x, z) => groundY(x, z) > deep;
      const on = c.onState;
      c.onState = (c, st) => {
        if (on) on(c, st);
        if (st === 'flee' && c.target) {
          const from = c.root.position.clone(), to = c.target.clone();
          for (let k = 10; k >= 0; k--) { c.target.lerpVectors(from, to, k / 10); if (c.keep(c.target.x, c.target.z)) break; }
        }
      };
      return c;
    };
    const small = { seeAt: 80 };

    // perches: a tree right by the road with a bare branch reaching out over it, at the height
    // the tree-dwellers sit; the branch is part of the scene, the animal sits on its tip
    const perchItems = [], branchItems = [];
    const perch = (u, side, h) => {
      const foot = beside(u, side * 1.0), tip = beside(u, side * 0.45, h);
      tip.y = foot.y + h;
      perchItems.push({ p: foot, s: [0.9, 1, 0.9] });
      const dir = new THREE.Vector3().subVectors(tip, foot.clone().setY(tip.y)), len = dir.length();
      branchItems.push({ p: foot.clone().setY(tip.y).addScaledVector(dir, 0.5), s: [1, len, 1], rz: Math.PI / 2, ry: Math.atan2(-dir.z, dir.x) });
      return tip.clone().setY(tip.y + 0.16);
    };
    // a tree right by the road and a spot on its bark, on the side that faces the road, h up
    const onTrunk = (u, side, h) => {
      const foot = beside(u, side), q = path.getPointAt(u);
      perchItems.push({ p: foot, s: [0.9, 1, 0.9] });
      const dir = new THREE.Vector3(q.x - foot.x, 0, q.z - foot.z).normalize();
      return foot.clone().addScaledVector(dir, 0.9 * (0.6 - 0.2 * h / 12) + 0.02).setY(foot.y + h);
    };

    // the south forest
    const uA = (k) => lerp(0.02, uIn - 0.04, k);
    spawn('tarsier', perch(uA(0.12), -6.5, 3.4), {}, small);
    spawn('treehopper', perch(uA(0.2), 6.5, 2.9), {}, small);
    spawn('giant-panda', beside(uNear(-24, -392), -12));
    spawn('giant-panda', beside(uNear(-24, -392) + 0.012, -17));
    spawn('flower-mantis', beside(uA(0.33), 6.5, 0.9), { perch: true }, small);
    spawn('bongo-antelope', beside(uA(0.48), 13)); spawn('bongo-antelope', beside(uA(0.52), 16));
    spawn('giant-anteater', beside(uA(0.6), -11));
    spawn('eyespot-moth', onTrunk(uA(0.7), -6, 3.2), { stub: false }, small);
    spawn('tarsier', perch(uA(0.8), 6.5, 3.6), {}, small);
    spawn('flower-mantis', beside(uA(0.9), -6.5, 0.9), { perch: true }, small);
    if (night) { spawn('poodle-moth', beside(uA(0.4), -5, 3), {}, small); spawn('poodle-moth', beside(uA(0.75), 6, 3.4), {}, small); }

    // the river: the mudflat by the south bank, the open water, the islands, the north bank
    const uR = (k) => lerp(uIn, uOut, k);
    wade(spawn('heron', shore(uR(0.08), 14, -0.4, 0.3))); wade(spawn('heron', shore(uR(0.14), 22, -0.4, 0.3))); wade(spawn('heron', shore(uR(0.86), -16, -0.4, 0.3)));
    wade(spawn('mudskipper', shore(uR(0.1), -15, 0.02, 0.6)), -0.05); wade(spawn('mudskipper', shore(uR(0.9), 14, 0.02, 0.6)), -0.05);
    wade(spawn('fiddler-crab', shore(uR(0.05), 11, 0.05, 0.7)), 0); wade(spawn('fiddler-crab', shore(uR(0.95), -12, 0.05, 0.7)), 0);
    spawn('crocodile', onWater(uR(0.22), -16)); wade(spawn('crocodile', shore(uR(0.62), -30, 0.1, 0.8), { bask: true }), -1.2);
    spawn('crocodile', onWater(uR(0.74), 20));
    spawn('river-dolphin', onWater(uR(0.38), 12, -1.2)); spawn('river-dolphin', onWater(uR(0.5), -14, -1.2)); spawn('river-dolphin', onWater(uR(0.56), 18, -1.2));
    spawn('archerfish', onWater(uR(0.3), 9, -0.3)); spawn('archerfish', onWater(uR(0.8), -9, -0.3));
    spawn('frigatebird', onWater(uR(0.45), 30, 22), {}, { seeAt: 320 });
    spawn('frigatebird', onWater(uR(0.6), -40, 28), {}, { seeAt: 320 });
    // sea birds coming in from the coast: a few riding one thermal over the mouth
    { const g = ESTUARY.GROUPS.frigatebird(K, new THREE.Vector3(300, 0, 10), { n: 5, r: 40, alt: 34 }); g.seeAt = 420; creatures.push(g); }

    // the north forest
    const uC = (k) => lerp(uOut + 0.04, 0.98, k);
    spawn('giant-anteater', beside(uC(0.1), 12));
    spawn('tarsier', perch(uNear(56, 236), -6.5, 3.8), {}, small);
    spawn('eyespot-moth', onTrunk(uNear(56, 236) + 0.006, 6, 2.8), { stub: false }, small);
    spawn('treehopper', perch(uC(0.35), -6, 3), {}, small);
    spawn('bongo-antelope', beside(uC(0.5), -14));
    spawn('giant-panda', beside(uNear(62, 300), 13));
    spawn('flower-mantis', beside(uC(0.7), 6.5, 0.9), { perch: true }, small);
    spawn('giant-anteater', beside(uC(0.85), -13));
    if (night) spawn('poodle-moth', beside(uC(0.6), 5, 3.2), {}, small);

    const perchTrunks = instanced(geo(new THREE.CylinderGeometry(0.4, 0.6, 12, 7).translate(0, 6, 0)), lam({ color: dark(0x5a4c3c) }), perchItems);
    const branches = instanced(geo(new THREE.CylinderGeometry(0.11, 0.2, 1, 5)), lam({ color: dark(0x5a4c3c) }), branchItems);
    scene.add(perchTrunks, branches);

    // clear lines of sight: no fern, leaf, shrub or trunk stands between the road and an animal in
    // the forest (or right round it), so the photo moments are not lost behind a leaf
    const lanes = [], pathLen = path.getLength();
    for (const c of creatures) {
      if (c.flock || c.species.id === 'frigatebird') continue;            // the sea birds are up in the open sky
      const h = c.home, u = uNear(h.x, h.z);
      if (path.getPointAt(u).y < WATER - 0.2 && groundY(h.x, h.z) < WATER) continue;   // out on the water there is nothing to clear
      // a fan of sight lines: from where the van is level with it, and from 15 and 30 m before and after
      for (const m of [-30, -15, 0, 15, 30]) {
        const p = path.getPointAt(THREE.MathUtils.clamp(u + m / pathLen, 0, 1));
        lanes.push({ ax: p.x, az: p.z, bx: h.x, bz: h.z, r: (m ? 0.9 : 1.4) + (c.radius || 0.6) * 1.4 });
      }
    }
    const blocked = (x, z, pad) => lanes.some((l) => {
      const dx = l.bx - l.ax, dz = l.bz - l.az, L = dx * dx + dz * dz || 1;
      const k = Math.max(0, Math.min(1, ((x - l.ax) * dx + (z - l.az) * dz) / L));
      return Math.hypot(x - l.ax - dx * k, z - l.az - dz * k) < l.r + pad;
    });
    const m4 = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0), at = new THREE.Vector3();
    // hides the instances in a lane; `per` links meshes that share one placement list (n per spot)
    const clear = (mesh, pad, linked = []) => {
      const gone = [];
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, m4); at.setFromMatrixPosition(m4);
        if (blocked(at.x, at.z, pad)) { mesh.setMatrixAt(i, zero); gone.push(i); }
      }
      mesh.instanceMatrix.needsUpdate = true;
      for (const [m, per] of linked) { for (const i of gone) for (let k = 0; k < per; k++) m.setMatrixAt(i * per + k, zero); m.instanceMatrix.needsUpdate = true; }
    };
    clear(ferns, 2); clear(bigLeaves, 2); clear(shrubs, 2.5); clear(bamboo, 0.3, [[bambooLeaves, 1]]);
    clear(trunks, 3, [[crownA, 1], [crownB, 2]]); clear(palmTrunks, 0.5, [[fronds, 1]]); clear(lianas, 0.2);

    const colliders = [ground, trunks, crownA, crownB, shrubs, palmTrunks, bigLeaves, mangroveRoots, mangroveCrowns, perchTrunks];
    const open = ROUTE.open[tod] || ROUTE.open.day;
    const AMB = {
      river: { every: 3.2, kind: 'chirp', hz: 2600, vol: 0.14 },          // gulls and terns off the sea
      forest: { day: { every: 2.6, kind: 'trill', hz: 2300, vol: 0.16 }, dawn: { every: 2, kind: 'trill', hz: 1900, vol: 0.2 },
        dusk: { every: 2.8, kind: 'hoot', hz: 520, vol: 0.18 }, night: { every: 1.8, kind: 'chirp', hz: 4200, vol: 0.12 } },
    };
    const fogForest = new THREE.Color(ROUTE.canopy[tod] ?? P.fog).convertSRGBToLinear(), fogOpen = new THREE.Color(P.fog).convertSRGBToLinear();
    const openness = (u) => smooth(uIn - 0.05, uIn + 0.04, u) * (1 - smooth(uOut - 0.04, uOut + 0.05, u));

    return {
      path, groundY, creatures, colliders, palette: P,
      waterY: () => WATER,
      floats: true,
      sections,
      ambience: ROUTE.ambience[tod] || ROUTE.ambience.day,
      ambient(u, t) { return openness(u) > 0.5 ? AMB.river : AMB.forest[t] || AMB.forest.day; },
      swayAt(u) { return smooth(uIn - 0.012, uIn + 0.01, u) * (1 - smooth(uOut - 0.01, uOut + 0.012, u)); },
      speedAt(u) {
        let k = 1;
        for (const s of SETS) k = Math.min(k, 1 - s.k * Math.exp(-((u - s.u) * (u - s.u)) / (s.w * s.w)));
        if (u > uIn && u < uOut) k *= 0.85;                            // afloat the van paddles along
        return Math.max(0.18, k);
      },
      poi(u) {
        // out on the river the lens drifts downstream, to the mouth and the sea
        if (openness(u) > 0.5) return new THREE.Vector3(560, 4, 0);
        return null;
      },
      update(dt, env) {
        T.time.value = env.t;
        const k = openness(env.u);
        scene.fog.color.copy(fogForest).lerp(fogOpen, k);
        scene.fog.near = lerp(P.near, open[0], k);
        scene.fog.far = lerp(P.far, open[1], k);
        air.step(dt, env.camPos, env.t);
        shaftMesh.visible = k < 0.9;
        const afloat = smooth(uIn - 0.004, uIn + 0.01, env.u) * (1 - smooth(uOut - 0.01, uOut + 0.004, env.u));
        wake.visible = afloat > 0.01;
        if (wake.visible) {
          const tg = path.getTangentAt(Math.min(1, env.u));
          wake.position.set(env.camPos.x, WATER + 0.14, env.camPos.z);
          wake.rotation.y = Math.atan2(-tg.x, -tg.z);
          wakeMat.uniforms.o.value = afloat;
        }
      },
    };
  },
};
