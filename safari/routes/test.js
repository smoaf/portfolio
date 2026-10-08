// The test range: the placeholder terrain Phase 2 uses to prove the safari loop end to end. It is a
// loop of open ground with a pond, scattered rock and trees, and three placeholder species so that
// driving, looking, photographing, feeding and scoring can all be played through. The canyon and the
// jungle (Phase 3 and 4) are built as route modules exactly like this one; what a route has to hand
// back is listed under `build` below.
import * as THREE from 'three';
import { makeCreature, makeFlock } from '../creature.js';

// --- deterministic ground, so the same range comes back every time
const seeded = (seed) => () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const smooth = (e0, e1, x) => THREE.MathUtils.smoothstep(x, e0, e1);

// large, gentle shapes: the road follows these, so the van never climbs a bump it should not
const base = (x, z) => 3.4 * Math.sin(x * 0.0112) * Math.cos(z * 0.0097) + 2.1 * Math.sin((x + z) * 0.0138 + 0.7);
// the detail on top: small hills and dips the road is flattened out of
const detail = (x, z) => 1.5 * Math.sin(x * 0.047 + 1.3) * Math.sin(z * 0.041) + 0.8 * Math.cos(x * 0.082 - 0.4) * Math.sin(z * 0.075 + 1.1);

// the loop the van drives, and the pond beside its second set piece
const RING = [[0, -150], [92, -128], [140, -56], [120, 34], [52, 92], [-40, 108], [-124, 72], [-152, -12], [-108, -104], [-54, -144]];
const POND = { x: 2, z: 56, r: 30, deep: 3.4 };      // the low ground the water sits in, 45 m off the road

function raw(x, z) {
  const r = Math.hypot(x, z);
  let h = base(x, z) + detail(x, z);
  h -= POND.deep * Math.max(0, 1 - Math.hypot(x - POND.x, z - POND.z) / POND.r) ** 1.6;   // the bowl
  h += Math.max(0, (r - 165) * 0.17) ** 1.25;         // the ground lifts into hills around the range
  return h;
}

export const ROUTE = {
  id: 'test',
  name: 'Test range',
  seconds: 120,
  eyeHeight: 2.05,
  yawLimit: 2.7,                                       // the visitor can look almost straight back
  // the look of each time of day: sky, fog and the fixed lights (Global rule 4, nothing moves)
  palette: {
    dawn: { top: 0x2d4a74, horizon: 0xe6a173, ground: 0x6b5f54, fog: 0xc9a089, near: 40, far: 330, sun: [0xffd0a0, 1.5, [-0.5, 0.18, 1]], hemi: [0xcfd9ef, 0x6c5a44, 0.55], amb: 0.25 },
    day: { top: 0x5b8fd0, horizon: 0xc9dbe8, ground: 0x8d7f6d, fog: 0xc3cfd6, near: 70, far: 430, sun: [0xfff0d8, 2.4, [0.6, 0.72, 0.35]], hemi: [0xdce8f5, 0x8a7c63, 0.75], amb: 0.2 },
    dusk: { top: 0x24335c, horizon: 0xe08a5a, ground: 0x59493c, fog: 0xa9775f, near: 35, far: 300, sun: [0xffb070, 1.3, [0.75, 0.14, -0.5]], hemi: [0xb9b0c9, 0x5a4636, 0.5], amb: 0.22 },
    night: { top: 0x070c1a, horizon: 0x1b2e4d, ground: 0x6a6f78, fog: 0x15213a, near: 25, far: 230, sun: [0x9ab4e8, 0.9, [-0.3, 0.6, -0.6]], hemi: [0x4d6397, 0x1d2029, 1.0], amb: 0.5 },
  },
  ambience: {
    day: { wind: 0.05, windCut: 480, band: 0.016, bandHz: 2600 },
    dawn: { wind: 0.04, windCut: 380, band: 0.02, bandHz: 2900 },
    dusk: { wind: 0.045, windCut: 420, band: 0.014, bandHz: 2200 },
    night: { wind: 0.035, windCut: 300, band: 0.022, bandHz: 5200 },     // insects instead of birds
  },

  // What a route hands back to the engine:
  //   path        a CatmullRomCurve3 the van drives along (closed or open)
  //   speedAt(u)  0..1, the pace at that point of the route: dips make a set piece
  //   groundY     height of the ground at x,z (creatures walk on it)
  //   creatures   from makeCreature / makeFlock
  //   colliders   meshes the photo scoring tests for things in the way
  //   calls       optional: the sound a creature makes, per species and behaviour
  build({ scene, tod, keep }) {
    const rand = seeded(20261008);
    const night = tod === 'night', dim = night || tod === 'dusk';
    const P = ROUTE.palette[tod] || ROUTE.palette.day;
    const mat = (o) => keep(new THREE.MeshStandardMaterial({ roughness: 0.92, ...o }));
    // the ground, the rock and the plants cover the whole screen, so they use the cheap lit material;
    // the creatures keep the standard one, where the sheen and the glowing markings are worth it
    const lam = (o) => keep(new THREE.MeshLambertMaterial(o));
    const geo = (g) => keep(g);

    // ---- the road: a loop around the range, laid out first so the ground can be flattened under it
    const ring = RING;
    const road = new THREE.CatmullRomCurve3(ring.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'catmullrom', 0.5);
    const online = road.getSpacedPoints(220);           // for the distance test below

    const nearRoad = (x, z) => {                       // metres to the middle of the road
      let d = Infinity;
      for (let i = 0; i < online.length; i++) {
        const p = online[i], k = (x - p.x) * (x - p.x) + (z - p.z) * (z - p.z);
        if (k < d) d = k;
      }
      return Math.sqrt(d);
    };
    const groundY = (x, z) => {
      const d = nearRoad(x, z), k = smooth(7, 22, d);
      return THREE.MathUtils.lerp(base(x, z), raw(x, z), k);
    };

    // ---- ground mesh
    const SIZE = 460, SEG = 120;
    const gg = geo(new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG));
    gg.rotateX(-Math.PI / 2);
    const pos = gg.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const H = new Float32Array(pos.count);              // the heights, kept for the fast lookup below
    const sand = new THREE.Color(P.ground), green = new THREE.Color(night ? 0x47523c : 0x6d7a4a), wet = new THREE.Color(night ? 0x2c3b47 : 0x5d6b5a);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const y = groundY(x, z);
      pos.setY(i, y); H[i] = y;
      const d = nearRoad(x, z);
      c.copy(sand).lerp(green, smooth(4, 26, d) * 0.75);                                  // the track is bare, the verges grow
      if (y < 0.4 && Math.hypot(x - POND.x, z - POND.z) < POND.r * 1.15) c.lerp(wet, smooth(1.2, -1.4, y));
      c.toArray(col, i * 3);
    }
    // the creatures ask for the ground height every frame, so they read the grid instead of the
    // road distance: a bilinear lookup in the mesh's own heights
    const STEP = SIZE / SEG;
    const heightAt = (x, z) => {
      const cx = THREE.MathUtils.clamp((x + SIZE / 2) / STEP, 0, SEG - 0.001), cz = THREE.MathUtils.clamp((z + SIZE / 2) / STEP, 0, SEG - 0.001);
      const c0 = Math.floor(cx), r0 = Math.floor(cz), fx = cx - c0, fz = cz - r0, w = SEG + 1;
      const h00 = H[r0 * w + c0], h10 = H[r0 * w + c0 + 1], h01 = H[(r0 + 1) * w + c0], h11 = H[(r0 + 1) * w + c0 + 1];
      return (h00 * (1 - fx) + h10 * fx) * (1 - fz) + (h01 * (1 - fx) + h11 * fx) * fz;
    };
    gg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    gg.computeVertexNormals();
    const ground = new THREE.Mesh(gg, lam({ vertexColors: true }));
    ground.name = 'ground';
    scene.add(ground);

    // ---- the pond: a flat sheet with a little shine, brighter at night where the sky is in it
    const water = new THREE.Mesh(geo(new THREE.CircleGeometry(POND.r * 0.92, 40)), mat({
      color: night ? 0x1d3550 : 0x3f6f82, roughness: 0.16, metalness: 0.35, transparent: true, opacity: 0.86,
      emissive: night ? 0x0a1a2c : 0x000000, emissiveIntensity: night ? 0.6 : 0,
    }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(POND.x, -1.35, POND.z);
    scene.add(water);

    // ---- rock, trees and bushes, instanced: one draw call each
    const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), sc = new THREE.Vector3(), pt = new THREE.Vector3();
    const place = (n, { minRoad = 10, maxRoad = 150, wet: allowWet = false, minR = 0, maxR = 210 }) => {
      const out = [];
      let guard = 0;
      while (out.length < n && guard++ < n * 40) {
        const a = rand() * Math.PI * 2, r = minR + Math.sqrt(rand()) * (maxR - minR);
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        const d = nearRoad(x, z);
        if (d < minRoad || d > maxRoad) continue;
        const y = groundY(x, z);
        if (!allowWet && y < 0.3 && Math.hypot(x - POND.x, z - POND.z) < POND.r) continue;
        out.push(new THREE.Vector3(x, y, z));
      }
      return out;
    };
    const instance = (g, m, spots, size) => {
      const im = new THREE.InstancedMesh(geo(g), m, spots.length);
      spots.forEach((p, i) => {
        const s = size(rand(), p);
        qt.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28);
        m4.compose(pt.copy(p).setY(p.y + (s.lift || 0)), qt, sc.set(s.x, s.y, s.z));
        im.setMatrixAt(i, m4);
      });
      im.instanceMatrix.needsUpdate = true;
      im.frustumCulled = false;
      scene.add(im);
      return im;
    };
    const rockSpots = place(110, { minRoad: 7, maxR: 220 });
    const rocks = instance(new THREE.IcosahedronGeometry(1, 0), lam({ color: night ? 0x6c7076 : 0x9b8e7d, flatShading: true }),
      rockSpots, (r) => ({ x: 0.7 + r * 2.6, y: 0.5 + r * 1.9, z: 0.8 + r * 2.4, lift: -0.3 }));
    const treeSpots = place(64, { minRoad: 12, maxR: 215 });
    const trunks = instance(new THREE.CylinderGeometry(0.22, 0.42, 4.6, 6), lam({ color: night ? 0x4a4038 : 0x6b543c }),
      treeSpots, () => ({ x: 1, y: 0.8 + rand() * 0.6, z: 1, lift: 1.9 }));
    // flat, wide crowns, after the watercolour tree sheet in the references
    const crownGeo = new THREE.SphereGeometry(1, 10, 6);
    crownGeo.scale(1, 0.42, 1);
    const crowns = instance(crownGeo, lam({ color: night ? 0x3c4a35 : 0x6f8046, flatShading: true }),
      treeSpots, () => ({ x: 3 + rand() * 2.6, y: 2.4 + rand() * 1.4, z: 3 + rand() * 2.6, lift: 5.1 }));
    const bushSpots = place(170, { minRoad: 5, maxR: 215 });
    const bushGeo = new THREE.IcosahedronGeometry(1, 1);
    bushGeo.scale(1, 0.62, 1);
    const bushes = instance(bushGeo, lam({ color: night ? 0x36432f : 0x5f7342, flatShading: true }),
      bushSpots, () => ({ x: 0.6 + rand() * 1.1, y: 0.5 + rand() * 0.9, z: 0.6 + rand() * 1.1, lift: 0.1 }));
    // reeds in a band at the water's edge, so the pond is not a bare disc
    const reedSpots = [];
    for (let i = 0; i < 110; i++) {
      const a = rand() * Math.PI * 2, r = POND.r * (0.9 + rand() * 0.22);
      const x = POND.x + Math.cos(a) * r, z = POND.z + Math.sin(a) * r;
      if (nearRoad(x, z) < 8) continue;
      reedSpots.push(new THREE.Vector3(x, groundY(x, z), z));
    }
    const reeds = instance(new THREE.ConeGeometry(0.22, 1.5, 5), lam({ color: night ? 0x4c5641 : 0x8c9452 }),
      reedSpots, () => ({ x: 0.7 + rand() * 0.7, y: 0.5 + rand() * 0.8, z: 0.7 + rand() * 0.7, lift: 0.7 }));

    // ---- the road itself, laid on the ground as a pale band
    const bandPts = road.getSpacedPoints(240).map((p) => p.setY(groundY(p.x, p.z)));
    const band = new THREE.BufferGeometry();
    const bv = [], bi = [];
    bandPts.forEach((p, i) => {
      const n = bandPts[(i + 1) % bandPts.length], t = new THREE.Vector3().subVectors(n, p).setY(0).normalize();
      const s = new THREE.Vector3(-t.z, 0, t.x).multiplyScalar(3.2);
      bv.push(p.x - s.x, p.y + 0.06, p.z - s.z, p.x + s.x, p.y + 0.06, p.z + s.z);
      if (i < bandPts.length - 1) { const a = i * 2; bi.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    band.setAttribute('position', new THREE.Float32BufferAttribute(bv, 3));
    band.setIndex(bi); band.computeVertexNormals();
    const track = new THREE.Mesh(geo(band), lam({ color: night ? 0x6a6257 : 0xb5a68d }));
    scene.add(track);

    // ---- the path the van drives: the road, lifted to the ground height
    const path = new THREE.CatmullRomCurve3(ring.map(([x, z]) => new THREE.Vector3(x, groundY(x, z), z)), true, 'catmullrom', 0.5);

    // ---- the three placeholder species. Phase 3 and 4 replace them with the real animals.
    const SPECIES = {
      hopper: { id: 'hopper', name: 'Dust hopper', points: 110, call: { hz: 620, kind: 'chirp' } },
      drifter: { id: 'drifter', name: 'Glass drifter', points: 150, call: { hz: 240, kind: 'hoot' } },
      glider: { id: 'glider', name: 'Ridge glider', points: 130, call: { hz: 900, kind: 'trill' } },
    };
    const creatures = [];
    const body = (color, o = {}) => mat({ color, flatShading: true, roughness: 0.75, ...o });
    const eyeMat = mat({ color: 0x120f0c, roughness: 0.35, emissive: dim ? 0x2a2318 : 0x000000, emissiveIntensity: 0.6 });
    const mesh = (g, m, p, parent) => { const o = new THREE.Mesh(geo(g), m); if (p) o.position.set(...p); parent.add(o); return o; };

    // a ground animal: round body, long ears, big dark eyes; it hops when it moves
    const hopperFur = body(0xb98b5e), hopperBelly = body(0xe3cfae);
    const hopperGlow = mat({ color: 0x6fd2c0, emissive: 0x6fd2c0, emissiveIntensity: dim ? 2.2 : 0.35, roughness: 0.4 });
    function buildHopper(home) {
      const root = new THREE.Group();
      const g = new THREE.Group(); root.add(g);                                 // the part that hops
      const torso = mesh(new THREE.SphereGeometry(0.42, 12, 9), hopperFur, [0, 0.46, 0], g);
      torso.scale.set(1, 0.92, 1.25);
      mesh(new THREE.SphereGeometry(0.3, 10, 8), hopperBelly, [0, 0.33, 0.12], g).scale.set(0.8, 0.6, 1.0);
      const head = new THREE.Group(); head.position.set(0, 0.86, 0.34); g.add(head);
      mesh(new THREE.SphereGeometry(0.26, 12, 9), hopperFur, [0, 0, 0], head).scale.set(0.95, 0.95, 1.05);
      mesh(new THREE.ConeGeometry(0.12, 0.26, 8), hopperFur, [0, -0.03, 0.26], head).rotation.x = Math.PI / 2;    // muzzle
      const ears = [-1, 1].map((s) => {
        const e = mesh(new THREE.CapsuleGeometry(0.055, 0.42, 3, 6), hopperFur, [s * 0.13, 0.33, -0.04], head);
        e.rotation.set(-0.2, 0, s * 0.18);
        return e;
      });
      [-1, 1].forEach((s) => mesh(new THREE.SphereGeometry(0.062, 8, 6), eyeMat, [s * 0.16, 0.05, 0.19], head));
      [-1, 1].forEach((s) => mesh(new THREE.SphereGeometry(0.03, 6, 5), hopperGlow, [s * 0.2, 0.44, 0], g));        // the twist: lit dots
      mesh(new THREE.SphereGeometry(0.028, 6, 5), hopperGlow, [0, 0.62, 0.1], g);
      [-1, 1].forEach((s) => { const l = mesh(new THREE.CapsuleGeometry(0.08, 0.26, 3, 6), hopperFur, [s * 0.2, 0.2, -0.16], g); l.rotation.x = 0.5; });
      const tail = mesh(new THREE.SphereGeometry(0.13, 8, 6), hopperBelly, [0, 0.48, -0.5], g);
      // the shadow: a soft dark disc, because the safari has no moving shadows (Global rule 4)
      const shade = mesh(new THREE.CircleGeometry(0.5, 14), mat({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }), [0, 0.03, 0], root);
      shade.rotation.x = -Math.PI / 2;
      root.scale.setScalar(1.5);                                               // waist-high, so it reads from the road
      scene.add(root);
      return makeCreature({
        species: SPECIES.hopper, root, home, radius: 1.05, eye: new THREE.Vector3(0, 0.88, 0.22),   // the head, in its own (1.5x) scale
        ground: heightAt, speed: 2.4, roam: 9, fleeAt: 5.5, curiousAt: 28, shy: 0.3, rareChance: 0.6, rareAt: 'dawn',
        pose(c, dt, env) {
          const moving = c.state === 'wander' || c.state === 'flee' || c.state === 'eat';
          c.bob += dt * (moving ? 9 : 2.2);
          const hop = moving ? Math.abs(Math.sin(c.bob)) : 0;
          g.position.y = hop * 0.28;
          g.rotation.x = -hop * 0.22 + (c.state === 'eat' ? 0.35 : 0);
          ears.forEach((e, i) => { e.rotation.x = -0.2 - hop * 0.5 + Math.sin(env.t * 1.7 + i * 2) * 0.12; });
          tail.position.y = 0.48 + hop * 0.04;
          if (c.state === 'rare') {                                        // stands tall and looks around
            const u = Math.min(1, c.t / 0.6);
            g.rotation.x = -0.75 * u; g.position.y = 0.3 * u;
            head.rotation.y = Math.sin(c.t * 2.2) * 0.7;
          } else head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, c.state === 'curious' ? 0 : Math.sin(env.t * 0.6 + c.bob * 0.1) * 0.3, dt * 2);
        },
      });
    }

    // a floating one: a translucent bell with tentacles that drifts over the water and glows
    const bellMat = mat({ color: 0xcfe6ff, transparent: true, opacity: 0.55, roughness: 0.25, metalness: 0,
      emissive: 0x7fd7ff, emissiveIntensity: dim ? 1.6 : 0.25, side: THREE.DoubleSide });
    const tentMat = mat({ color: 0xa8d6ef, transparent: true, opacity: 0.5, roughness: 0.4, emissive: 0x6ec6ef, emissiveIntensity: dim ? 1.1 : 0.15 });
    function buildDrifter(home) {
      const root = new THREE.Group();
      const g = new THREE.Group(); root.add(g);
      const bell = mesh(new THREE.SphereGeometry(0.75, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), bellMat, [0, 0, 0], g);
      const crest = mesh(new THREE.TorusGeometry(0.62, 0.06, 6, 18), bellMat, [0, -0.18, 0], g);
      crest.rotation.x = Math.PI / 2;
      const tents = [];
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2, t = mesh(new THREE.CapsuleGeometry(0.045, 1.5, 3, 5), tentMat, [Math.cos(a) * 0.52, -0.85, Math.sin(a) * 0.52], g);
        tents.push(t);
      }
      [-1, 1].forEach((s) => mesh(new THREE.SphereGeometry(0.07, 8, 6), eyeMat, [s * 0.26, -0.1, 0.62], g));
      root.scale.setScalar(1.4);
      scene.add(root);
      return makeCreature({
        species: SPECIES.drifter, root, home, radius: 1.35, eye: new THREE.Vector3(0, 0, 0), flyer: true,
        ground: heightAt, speed: 1.1, roam: 11, fleeAt: 5, curiousAt: 32, shy: 0.2, rareChance: 0.8, rareAt: 'night',
        pose(c, dt, env) {
          c.bob += dt * 1.6;
          const pulse = 0.5 + 0.5 * Math.sin(c.bob * 2.4);
          const big = c.state === 'rare' ? 1 + 0.55 * Math.sin(c.t * 3.4) : 0;
          g.scale.set(1 + pulse * 0.1 + big * 0.3, 1 - pulse * 0.14 - big * 0.1, 1 + pulse * 0.1 + big * 0.3);
          root.position.y = home.y + Math.sin(c.bob) * 0.5;
          bell.material.emissiveIntensity = (dim ? 1.6 : 0.25) + pulse * 0.4 + big * 2.2;
          tents.forEach((t, i) => { t.rotation.x = Math.sin(c.bob * 1.4 + i) * 0.22; t.rotation.z = Math.cos(c.bob * 1.1 + i) * 0.22; });
          crest.rotation.z = c.bob * 0.2;
        },
      });
    }

    // and a flock that circles over the ridge: the one you have to wait and zoom for
    const birdMat = body(0x4a4a52, { roughness: 0.6 }), wingMat = body(0x7d8794, { roughness: 0.7 });
    const beakMat = body(0xd8a24a);
    function buildFlock(centre, n = 11) {
      const root = new THREE.Group();
      const bodies = [];
      for (let i = 0; i < n; i++) {
        const b = new THREE.Group();
        const t = mesh(new THREE.CapsuleGeometry(0.22, 0.75, 4, 7), birdMat, [0, 0, 0], b);
        t.rotation.x = Math.PI / 2;
        mesh(new THREE.SphereGeometry(0.17, 8, 6), birdMat, [0, 0.06, 0.52], b);
        mesh(new THREE.ConeGeometry(0.07, 0.3, 6), beakMat, [0, 0.04, 0.76], b).rotation.x = Math.PI / 2;
        [-1, 1].forEach((s) => mesh(new THREE.SphereGeometry(0.035, 6, 5), eyeMat, [s * 0.1, 0.1, 0.6], b));
        const wings = [-1, 1].map((s) => {
          const w = new THREE.Group(); w.position.set(s * 0.16, 0.05, 0.05); b.add(w);
          const m = mesh(new THREE.BoxGeometry(1.5, 0.05, 0.55), wingMat, [s * 0.75, 0, 0], w);
          m.rotation.z = s * 0.06;
          return w;
        });
        const tail = mesh(new THREE.BoxGeometry(0.42, 0.04, 0.5), wingMat, [0, 0, -0.62], b);
        b.userData.wings = wings; b.userData.tail = tail;
        root.add(b); bodies.push(b);
      }
      scene.add(root);
      return makeFlock({
        species: SPECIES.glider, root, bodies, centre, radius: 24, height: 15, speed: 0.2, climb: 4,
        pose(b, i, t, state) {
          const flap = state === 'rare' ? 0.1 : 0.55;
          b.userData.wings.forEach((w, s) => { w.rotation.z = (s ? 1 : -1) * Math.sin(t * 2.6 + i) * flap; });
          b.userData.tail.rotation.x = Math.sin(t * 1.2 + i) * 0.2;
        },
      });
    }

    // ---- where everything stands: three set pieces along the loop, plus strays in between
    const at = (u, side = 0, back = 0) => {
      const p = path.getPointAt(u % 1), t = path.getTangentAt(u % 1);
      const s = new THREE.Vector3(-t.z, 0, t.x).normalize();
      return p.clone().addScaledVector(s, side).addScaledVector(t, back).setY(0).setY(groundY(p.x + s.x * side + t.x * back, p.z + s.z * side + t.z * back));
    };
    const SETS = [0.17, 0.46, 0.78];                                   // the van slows down here
    const side = (lo, hi) => (rand() > 0.5 ? 1 : -1) * (lo + rand() * (hi - lo));
    // 1. a colony of hoppers on the open ground, close enough to the track to fill a frame
    for (let i = 0; i < 8; i++) creatures.push(buildHopper(at(SETS[0] + (rand() - 0.5) * 0.05, side(7, 22))));
    // 2. drifters between the road and the pond, and a few more out over the water
    for (let i = 0; i < 5; i++) {
      const home = at(SETS[1] + (rand() - 0.5) * 0.035, side(9, 26));
      home.y += 4.2 + rand() * 3.2;                                 // high enough that the tentacles clear the grass
      creatures.push(buildDrifter(home));
    }
    for (let i = 0; i < 3; i++) {
      const a = rand() * Math.PI * 2, r = POND.r * (0.2 + rand() * 0.6);
      creatures.push(buildDrifter(new THREE.Vector3(POND.x + Math.cos(a) * r, 3.4 + rand() * 3, POND.z + Math.sin(a) * r)));
    }
    // 3. the flock circling over the rise, the one that wants the long lens
    const ridge = at(SETS[2], 14);
    creatures.push(buildFlock(ridge.clone().setY(ridge.y + 8), 11));
    // and strays in between, so no stretch of the drive is empty
    for (const u of [0.05, 0.3, 0.63, 0.9]) creatures.push(buildHopper(at(u, side(8, 24))));
    for (const u of [0.36, 0.92]) { const h = at(u, side(10, 22)); h.y += 4.5 + rand() * 2.5; creatures.push(buildDrifter(h)); }

    return {
      path, groundY: heightAt, creatures,
      colliders: [ground, rocks, crowns, trunks, bushes],
      ambience: ROUTE.ambience[tod] || ROUTE.ambience.day,
      palette: P,
      water: [water],
      // the van crawls past the set pieces and rolls on in between
      speedAt(u) {
        let k = 1;
        for (const s of SETS) k = Math.min(k, 1 - 0.68 * Math.exp(-((u - s) * (u - s)) / 0.0016));
        return Math.max(0.3, k);
      },
      // what the lens drifts towards when nobody is dragging, if no creature is nearer
      poi(u) { const s = SETS.reduce((a, b) => (Math.abs(b - u) < Math.abs(a - u) ? b : a)); return Math.abs(s - u) < 0.08 ? at(s, 18) : null; },
    };
  },
};
