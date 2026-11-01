// The golden silk orb-weaver (FEAT-011): a big spider in a giant golden web beside the road.
//
//   golden-silk-orb-weaver  the female, larger than life like the frogs and the ants (5× real size):
//                a body about 25 cm long, legs spanning about 60 cm. A long, slim, silvery-yellow
//                abdomen with pale spots, a silvery head-and-chest, dark legs with orange-yellow bands
//                and black feathery tufts at the joints. She sits head down in the middle of the web.
//                The male is much smaller (also 5×) and reddish-brown, near the edge of the web.
//
// The web is about 3.5 m across, hung between a tree and a vine that hangs from one of its boughs,
// beside the road and turned towards the oncoming van. Its silk is golden: every thread is drawn as a
// thin line that always faces the lens, lit like a fibre, so the glints run along the threads as the
// van's angle changes. It sways gently in the air. Now and then she shifts a leg, plucks a strand or
// turns towards the van; when the van passes close she pulls the web taut and it shivers. Rare pose
// (about half of the runs): an insect flies into the web, she rushes to it and wraps it in silk,
// spinning it with her legs. Night: dew on the threads catches the glow, so the web's outline shimmers
// faintly in the dark, with her faint glowing dots in the middle.
//
// The web, the tree's bough and the vine are scenery (one draw for all the silk); the spiders and the
// insect are the creature. The behaviour is its own (not the shared state machine): she never leaves
// her web, the van never sends her off and she leaves feed alone.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const SPECIES = {
  'golden-silk-orb-weaver': { id: 'golden-silk-orb-weaver', name: 'Golden silk orb-weaver', points: 230, call: { hz: 6200, kind: 'noise' } },
};

const PI = Math.PI;
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const damp = (a, b, k, dt) => a + (b - a) * Math.min(1, k * dt);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = THREE.MathUtils.clamp;
const LIFT = 0.035;                                       // her body's middle in front of the silk
const POSE = 6;                                           // s the rare pose (the catch) lasts
// the catch, in s from its start: the insect hits, she runs to it, she wraps it
const HIT = 0.6, RUN0 = 0.85, RUN1 = 1.6, WRAP0 = 1.6, WRAP1 = 4.9;
const PULL_AT = 7.5;                                      // m: the van this close, she pulls the web taut
const CATCH_AT = 22;                                      // m: in a run with the catch, it starts from this close

// the web's outline in its own plane (x along it, y up, the hub at 0,0): an oval hung low, so the hub
// sits in its upper part as in a real orb-weaver's web
const EX = 1.75, EY = 1.62, EC = -0.36;
function ovalAt(a) {
  const c = Math.cos(a), s = Math.sin(a);
  const A = (c / EX) ** 2 + (s / EY) ** 2, B = 2 * s * EC / (EY * EY), C = (EC / EY) ** 2 - 1;
  return (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A);
}

// ---------------------------------------------------------------- the silk

// One line per thread segment, drawn as a thin strip that turns to face the lens. Each strip is at
// least about a pixel wide; a thread thinner than that on screen is drawn a pixel wide and fainter
// (so the far web is a golden haze, not a flicker). Lit as a fibre: the highlight sits where the
// thread runs square to the half-way vector between the light and the lens, so the glints slide
// along the spiral as the van moves. `flex` is how much a point moves with the web (1 at the hub,
// 0 where it is tied on). Night: dew drops along the threads catch the glow.
const SILK_VS = `
  attribute vec3 aTan; attribute float aSide, aW, aS, aFlex;
  uniform float uTime, uPx, uSway, uBuzz, uVib; uniform vec2 uVibAt;
  varying vec3 vT, vWp; varying float vCov, vS;
  #include <fog_pars_vertex>
  void main() {
    vec3 p = position;
    float r = length(p.xy);
    float sway = uSway * (0.7 * sin(uTime * 1.1 + p.x * 0.6) + 0.3 * sin(uTime * 1.9 + p.y * 1.2));
    float buzz = uBuzz * sin(uTime * 36.0 + r * 9.0);
    float dv = length(p.xy - uVibAt);
    float vib = uVib * sin(uTime * 48.0 - dv * 12.0) * exp(-dv * 1.8);
    p.z += (sway + buzz + vib) * aFlex;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vec3 T = normalize(mat3(modelMatrix) * aTan);
    vec3 V = normalize(cameraPosition - wp.xyz);
    vec3 side = cross(T, V);
    float sl = length(side);
    side = sl > 1e-4 ? side / sl : vec3(0.0, 1.0, 0.0);
    float depth = max(0.1, -(viewMatrix * wp).z);
    float w = max(aW, uPx * depth);
    vCov = aW / w;
    wp.xyz += side * aSide * w * 0.5;
    vWp = wp.xyz; vT = T; vS = aS;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const SILK_FS = `
  uniform vec3 uGold, uSunDir, uSunCol, uDew;
  uniform float uAmb, uSun, uGlow, uTime;
  varying vec3 vT, vWp; varying float vCov, vS;
  #include <fog_pars_fragment>
  void main() {
    vec3 T = normalize(vT), V = normalize(cameraPosition - vWp), L = normalize(uSunDir);
    float tl = dot(T, L);
    float diff = sqrt(max(0.0, 1.0 - tl * tl));
    vec3 H = normalize(L + V);
    float th = dot(T, H);
    float sh = sqrt(max(0.0, 1.0 - th * th));
    float spec = pow(sh, 110.0), sheen = pow(sh, 14.0);
    vec3 glint = mix(uSunCol, uGold * 1.5, 0.45);              // gold silk tints its own highlights
    vec3 col = uGold * (uAmb + 0.5 * diff) + glint * uSun * (1.4 * spec + 0.22 * sheen);
    float a = vCov * (0.42 + 0.58 * max(spec, sheen * 0.6));
    // dew: a drop every 11 cm or so, each twinkling on its own
    float k = abs(fract(vS * 9.0) - 0.5) * 2.0;
    float dew = (1.0 - smoothstep(0.0, 0.32, 1.0 - k)) * (0.55 + 0.45 * sin(uTime * 1.3 + floor(vS * 9.0) * 2.7)) * uGlow;
    col += uDew * dew;
    a = clamp(max(a, vCov * dew * 0.9 + dew * 0.25), 0.0, 1.0);
    gl_FragColor = vec4(col, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

// The threads of the web, in the web's own plane. `ties`: where the frame is tied on (in the web's
// frame): [frame corner index, point]. Returns the geometry and the corners of the frame.
function webGeometry(ties) {
  const segs = [];                                        // [ax, ay, az, bx, by, bz, width, flexA, flexB]
  const line = (a, b, w, fa, fb) => segs.push([a.x, a.y, a.z, b.x, b.y, b.z, w, fa, fb]);
  // the frame: seven corners round the oval, a little irregular
  const NF = 7, corners = [];
  for (let k = 0; k < NF; k++) {
    const a = (k / NF) * PI * 2 + 0.25 + 0.12 * Math.sin(k * 2.3);
    const r = ovalAt(a) * (1.02 + 0.06 * Math.sin(k * 1.7 + 0.4));
    corners.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
  }
  // where a ray from the hub meets the frame
  const frameAt = (a) => {
    const dx = Math.cos(a), dy = Math.sin(a);
    let best = Infinity;
    for (let k = 0; k < NF; k++) {
      const p = corners[k], q = corners[(k + 1) % NF], ex = q.x - p.x, ey = q.y - p.y;
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const t = (p.x * ey - p.y * ex) / den, u = (p.x * dy - p.y * dx) / den;
      if (t > 0 && u >= -1e-6 && u <= 1 + 1e-6) best = Math.min(best, t);
    }
    return best;
  };
  const flex = (x, y) => {                                // 1 at the hub, a little at the frame
    const a = Math.atan2(y, x), R = frameAt(a);
    return clamp(1 - Math.hypot(x, y) / R, 0, 1) ** 0.85 * 0.92 + 0.08;
  };
  for (let k = 0; k < NF; k++) line(corners[k], corners[(k + 1) % NF], 0.006, 0.08, 0.08);
  // the radii: 34, not quite evenly spaced, each from the hub out to the frame in eight pieces
  const NR = 34, radii = [];
  for (let i = 0; i < NR; i++) {
    const a = (i / NR) * PI * 2 + 0.05 * Math.sin(i * 3.7);
    const R = frameAt(a) - 0.005;
    radii.push({ a, R });
    for (let j = 0; j < 8; j++) {
      const r0 = (R * j) / 8, r1 = (R * (j + 1)) / 8;
      const p = new THREE.Vector3(Math.cos(a) * r0, Math.sin(a) * r0, 0), q = new THREE.Vector3(Math.cos(a) * r1, Math.sin(a) * r1, 0);
      line(p, q, 0.0038, flex(p.x, p.y + 1e-4), flex(q.x, q.y));
    }
  }
  const at = (i, f) => { const { a, R } = radii[((i % NR) + NR) % NR]; return new THREE.Vector3(Math.cos(a) * R * f, Math.sin(a) * R * f, 0); };
  // the hub: a few tight, uneven rings
  for (const f of [0.035, 0.06, 0.085, 0.11]) {
    for (let i = 0; i < NR; i++) {
      const p = at(i, f * (1 + 0.15 * Math.sin(i * 1.3 + f * 50))), q = at(i + 1, f * (1 + 0.15 * Math.sin((i + 1) * 1.3 + f * 50)));
      line(p, q, 0.0032, flex(p.x, p.y), flex(q.x, q.y));
    }
  }
  // the sticky spiral: from a fifth of the way out to near the frame, one long line round and round,
  // not quite even (as spun by a spider): the spacing wavers, and here and there a piece is missing
  const TURNS = 30, F0 = 0.19, F1 = 0.95, NS = TURNS * NR;
  const fr = (s) => F0 + ((F1 - F0) * s) / NS + 0.006 * Math.sin(s * 0.37) * Math.sin(s * 0.051 + 1);
  for (let s = 0; s < NS; s++) {
    if (Math.sin(s * 12.9898) * 43758.5453 % 1 > 0.94) continue;
    const p = at(s, fr(s)), q = at(s + 1, fr(s + 1));
    line(p, q, 0.0026, flex(p.x, p.y), flex(q.x, q.y));
  }
  // the lines that hold the frame up
  for (const [k, to] of ties) line(corners[k], to, 0.008, 0.08, 0);

  // the strips: four corners per segment, the two ends each pushed out to either side in the shader
  const n = segs.length, pos = new Float32Array(n * 12), tan = new Float32Array(n * 12), side = new Float32Array(n * 4);
  const wid = new Float32Array(n * 4), arc = new Float32Array(n * 4), flx = new Float32Array(n * 4), idx = new Uint32Array(n * 6);
  let run = 0;
  segs.forEach(([ax, ay, az, bx, by, bz, w, fa, fb], i) => {
    const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz) || 1e-6;
    const ends = [[ax, ay, az, fa, run], [ax, ay, az, fa, run], [bx, by, bz, fb, run + len], [bx, by, bz, fb, run + len]];
    run += len;
    ends.forEach(([x, y, z, f, s], k) => {
      const v = i * 4 + k;
      pos.set([x, y, z], v * 3); tan.set([dx / len, dy / len, dz / len], v * 3);
      side[v] = k % 2 ? 1 : -1; wid[v] = w; arc[v] = s; flx[v] = f;
    });
    idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aTan', new THREE.BufferAttribute(tan, 3));
  g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  g.setAttribute('aW', new THREE.BufferAttribute(wid, 1));
  g.setAttribute('aS', new THREE.BufferAttribute(arc, 1));
  g.setAttribute('aFlex', new THREE.BufferAttribute(flx, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  g.boundingSphere.radius += 0.3;
  return { geometry: g, corners, flex };
}

// ---------------------------------------------------------------- the spider

// A spider in its own frame: +y towards the head, +z its back, the legs reaching back to the silk
// at z = -LIFT (times `size`). Legs are two pieces each (thigh, and shin to foot), set every frame
// from where the foot is (`setLegs`). `look`: colours; `tufts`: the black brushes at the joints.
function spiderBody(K, parent, { size = 1, look, tufts = true, dots = null }) {
  const sp = K.group(null, parent);
  const S = size;
  const M = { abd: K.mat(look.abd, { roughness: 0.5 }), spot: K.mat(look.spot, { roughness: 0.6 }), ceph: K.sheen(look.ceph, { roughness: 0.35, metalness: 0.25 }),
    leg: K.mat(look.leg, { roughness: 0.7 }), band: K.mat(look.band, { roughness: 0.6 }), tuft: K.mat(0x0d0b09, { roughness: 1 }), dark: K.sheen(0x16110c, { roughness: 0.3 }) };
  const body = K.group(null, sp);
  // the abdomen: long and slim, rounded at both ends, with two rows of pale spots and a fine band pattern
  K.mesh(K.capsule(0.031 * S, 0.11 * S, 4, 10), M.abd, [0, -0.085 * S, 0.004 * S], body, null, [1, 1, 1.08]);
  for (let i = 0; i < 6; i++) {
    const y = (-0.035 - i * 0.021) * S;
    for (const s of [-1, 1]) K.mesh(K.sphere(1, 6, 5), M.spot, [s * 0.016 * S, y, 0.029 * S], body, null, [0.006 * S, 0.0075 * S, 0.004 * S]);
  }
  K.mesh(K.sphere(1, 8, 6), M.spot, [0, -0.15 * S, 0.012 * S], body, null, [0.018 * S, 0.012 * S, 0.016 * S]);
  K.mesh(K.cone(0.008 * S, 0.016 * S, 6), M.dark, [0, -0.162 * S, -0.004 * S], body, [PI, 0, 0]);      // the spinnerets
  // the head-and-chest: silvery, flat; the jaws and the palps in front, the eyes on top
  K.mesh(K.sphere(1, 12, 8), M.ceph, [0, 0.03 * S, 0], body, null, [0.026 * S, 0.036 * S, 0.016 * S]);
  K.mesh(K.sphere(1, 8, 6), M.leg, [0, 0.022 * S, -0.008 * S], body, null, [0.02 * S, 0.026 * S, 0.008 * S]);   // the breast plate
  for (const s of [-1, 1]) {
    K.mesh(K.capsule(0.0045 * S, 0.012 * S, 2, 6), M.dark, [s * 0.006 * S, 0.068 * S, -0.002 * S], body, [0.3, 0, s * 0.15]);
    K.mesh(K.capsule(0.003 * S, 0.02 * S, 2, 5), M.leg, [s * 0.014 * S, 0.075 * S, 0.002 * S], body, [0.2, 0, s * 0.5]);
    for (const [x, y] of [[0.005, 0.06], [0.011, 0.056]]) K.mesh(K.sphere(1, 6, 5), M.dark, [s * x * S, y * S, 0.012 * S], body, null, 0.0028 * S);
  }
  if (dots) {                                             // the faint glowing dots along the abdomen
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) K.mesh(K.sphere(1, 6, 5), dots, [s * 0.009 * S, (-0.045 - i * 0.022) * S, 0.031 * S], body, null, 0.0042 * S);
  }
  // the legs: I longest, reaching forward; II forward and out; III short, to the side; IV back
  const LEGS = [[0.30, 0.05, 0.32], [0.26, 0.04, 0.74], [0.15, 0.025, 1.65], [0.25, 0.012, 2.72]];
  const legs = [];
  for (const s of [-1, 1]) {
    LEGS.forEach(([reach, cy, ang], i) => {
      const coxa = new THREE.Vector3(s * 0.02 * S, cy * S, 0);
      const base = coxa.clone().add(vA.set(s * Math.sin(ang) * reach * S, Math.cos(ang) * reach * S, -LIFT * S));
      const L = coxa.distanceTo(base) * 0.58;
      const r = (i === 2 ? 0.0048 : 0.0062) * S;
      const thigh = K.group(null, sp), shin = K.group(null, sp);
      K.mesh(K.capsule(r, L - r * 2, 2, 6), M.leg, [0, L / 2, 0], thigh);
      K.mesh(K.cyl(r * 1.15, r * 1.15, L * 0.12, 6), M.band, [0, L * 0.78, 0], thigh);
      K.mesh(K.capsule(r * 0.8, L * 0.5, 2, 6), M.leg, [0, L * 0.3, 0], shin);
      K.mesh(K.cyl(r * 0.95, r * 0.95, L * 0.1, 6), M.band, [0, L * 0.5, 0], shin);
      K.mesh(K.capsule(r * 0.55, L * 0.44, 2, 5), M.leg, [0, L * 0.76, 0], shin);
      K.mesh(K.cyl(r * 0.7, r * 0.7, L * 0.08, 5), M.band, [0, L * 0.9, 0], shin);
      if (tufts && i !== 2) {                             // the feathery black "gaiters" at the knee
        K.mesh(K.sphere(1, 7, 5), M.tuft, [0, L * 0.94, 0], thigh, null, [r * 2.3, L * 0.13, r * 2.3]);
        K.mesh(K.sphere(1, 7, 5), M.tuft, [0, L * 0.08, 0], shin, null, [r * 2, L * 0.1, r * 2]);
      }
      legs.push({ s, i, coxa, base, tip: base.clone(), L, thigh, shin, out: new THREE.Vector3(s, 0, 0) });
    });
  }
  // a two-piece leg from the hip to the foot, the knee bowed up and out
  const knee = new THREE.Vector3(), bend = new THREE.Vector3(), d = new THREE.Vector3();
  const setLegs = () => {
    for (const l of legs) {
      d.subVectors(l.tip, l.coxa);
      let len = d.length();
      if (len > l.L * 1.98) { d.multiplyScalar((l.L * 1.98) / len); len = l.L * 1.98; l.tip.copy(l.coxa).add(d); }
      d.normalize();
      bend.set(l.s * 0.3, 0, 1).addScaledVector(d, -(l.s * 0.3 * d.x + d.z)).normalize();
      const h = Math.sqrt(Math.max(0, l.L * l.L - (len / 2) ** 2));
      knee.copy(l.coxa).addScaledVector(d, len / 2).addScaledVector(bend, h);
      l.thigh.position.copy(l.coxa);
      l.thigh.quaternion.setFromUnitVectors(Y, vB.subVectors(knee, l.coxa).normalize());
      l.shin.position.copy(knee);
      l.shin.quaternion.setFromUnitVectors(Y, vB.subVectors(l.tip, knee).normalize());
    }
  };
  setLegs();
  return { sp, body, legs, setLegs };
}

// Fold every group's still pieces into one vertex-coloured mesh (one draw per moving part); the
// glowing dots keep their own material (K.bake merges those).
const glows = (m) => m.emissiveIntensity > 0 && (m.emissive.r + m.emissive.g + m.emissive.b) > 0;
function paint(K, root) {
  const groups = [], mats = {};
  root.traverse((o) => { if (!o.isMesh) groups.push(o); });
  for (const gr of groups) {
    const list = gr.children.filter((ch) => ch.isMesh && !ch.userData.keep && !glows(ch.material));
    if (list.length < 2) continue;
    const parts = list.map((ch) => {
      ch.updateMatrix();
      const g = ch.geometry.index ? ch.geometry.toNonIndexed() : ch.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      g.applyMatrix4(ch.matrix);
      const c = ch.material.color, n = g.attributes.position.count, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    });
    const merged = mergeGeometries(parts, false);
    parts.forEach((g) => g.dispose());
    if (!merged) continue;
    K.keep(merged);
    const sheen = list.some((ch) => ch.material.metalness > 0.1);
    const key = sheen ? 'sheen' : 'matt';
    mats[key] = mats[key] || K.mat(0xffffff, { vertexColors: true, roughness: sheen ? 0.45 : 0.62, metalness: sheen ? 0.12 : 0 });
    list.forEach((ch) => gr.remove(ch));
    gr.add(new THREE.Mesh(merged, mats[key]));
  }
}
// pin a posed spider's legs where they are: every piece moved into its body group, so it is one mesh
function freeze(spider) {
  spider.setLegs();
  spider.sp.updateMatrixWorld(true);
  for (const l of spider.legs) for (const g of [l.thigh, l.shin]) {
    [...g.children].forEach((m) => spider.sp.attach(m));
    spider.sp.remove(g);
  }
}

// the prey: a big fly (5× too), its wings beating
function insectBody(K, parent) {
  const g = K.group(null, parent);
  const dark = K.mat(0x3a3530, { roughness: 0.6 }), eye = K.sheen(0x7a2a1c, { roughness: 0.3 }), wingM = K.fin(0xdfe6ea, 0.45, 0.1);
  const body = K.group(null, g);
  K.mesh(K.sphere(1, 9, 7), dark, [0, 0, 0], body, null, [0.016, 0.018, 0.02]);
  K.mesh(K.sphere(1, 9, 7), dark, [0, -0.005, -0.03], body, null, [0.014, 0.013, 0.026]);
  K.mesh(K.sphere(1, 8, 6), dark, [0, 0.002, 0.024], body, null, 0.011);
  for (const s of [-1, 1]) K.mesh(K.sphere(1, 7, 5), eye, [s * 0.008, 0.005, 0.03], body, null, 0.0075);
  const wings = [-1, 1].map((s) => {
    const w = K.group([s * 0.008, 0.014, 0.004], g);
    K.mesh(K.shape('ow-wing', [[0, 0], [0.012, 0.012], [0.04, 0.008], [0.05, -0.006], [0.035, -0.016], [0.01, -0.01]]), wingM, [0, 0, 0], w, [-PI / 2, 0, s > 0 ? -0.35 : PI + 0.35]);
    return w;
  });
  paint(K, g);
  return { g, wings };
}

// ---------------------------------------------------------------- the creature

// opts:
//   yaw      the web's heading: its face (+z) looks this way, towards the oncoming van
//   ties     points (world) the frame is tied to: { trunk: [a, b], vine: [a, b], ground, bough }
//   vine     { top, foot } (world): the vine the near side of the web hangs on
//   sun      [colour, intensity, direction] of the route's light
//   dimmer   (hex, k) => colour: the route's night shading for scenery colours
export function buildOrbWeaver(K, home, opts = {}) {
  const night = K.night, tod = K.tod;
  const yaw = opts.yaw ?? 0;
  const frame = new THREE.Object3D();
  frame.position.copy(home); frame.rotation.y = yaw; frame.updateMatrixWorld(true);
  const inv = frame.matrixWorld.clone().invert();
  const local = (p) => p.clone().applyMatrix4(inv);

  // ---- the web (scenery)
  const ties = [];
  const T = opts.ties || {};
  // tie each frame corner to whatever is nearest it: the trunk, the vine, the ground, the bough
  const cornersOf = webGeometry([]).corners;
  const nearest = (p) => { let k = 0, bd = Infinity; cornersOf.forEach((c, i) => { const d = c.distanceTo(p); if (d < bd) { bd = d; k = i; } }); return k; };
  for (const w of [...(T.trunk || []), ...(T.vine || []), T.ground, T.bough].filter(Boolean)) { const p = local(w); ties.push([nearest(p), p]); }
  const web = webGeometry(ties);
  K.keep(web.geometry);
  const sun = opts.sun || [0xfff2d6, 2, [0.4, 0.8, 0.3]];
  const gold = new THREE.Color(night ? 0x8a7a40 : tod === 'day' ? 0xf2b934 : 0xe0a83c);
  const U = {
    uTime: { value: 0 }, uPx: { value: 0.002 }, uSway: { value: 0.03 }, uBuzz: { value: 0 }, uVib: { value: 0 }, uVibAt: { value: new THREE.Vector2() },
    uGold: { value: gold }, uSunDir: { value: new THREE.Vector3(...sun[2]).normalize() }, uSunCol: { value: new THREE.Color(sun[0]) },
    uSun: { value: night ? 0.35 : tod === 'day' ? 0.9 : 0.7 }, uAmb: { value: night ? 0.28 : tod === 'day' ? 0.4 : 0.34 },
    uGlow: { value: night ? 1 : tod === 'day' ? 0 : tod === 'dusk' ? 0.35 : 0.15 }, uDew: { value: new THREE.Color(0xbaf5dc).multiplyScalar(night ? 0.85 : 0.6) },
  };
  const silk = K.keep(new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]), vertexShader: SILK_VS, fragmentShader: SILK_FS,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
  }));
  Object.assign(silk.uniforms, U);
  const webMesh = new THREE.Mesh(web.geometry, silk);
  webMesh.position.copy(home); webMesh.rotation.y = yaw;
  webMesh.renderOrder = 4;
  const buf = new THREE.Vector2();
  // a pixel at one metre, for the lens of the moment (the zoom changes it)
  webMesh.onBeforeRender = (renderer, scene, camera) => {
    renderer.getDrawingBufferSize(buf);
    U.uPx.value = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / Math.max(1, buf.y) * 1.1;
  };
  K.scene.add(webMesh);
  // the vine the near side hangs on: from the bough down to the ground, bowed a little
  if (opts.vine) {
    const { top, foot } = opts.vine;
    const mid = top.clone().lerp(foot, 0.5).add(vA.set(0.25, 0, 0.15));
    const vg = K.keep(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(top.clone(), mid, foot.clone()), 16, 0.05, 5));
    vg.deleteAttribute('uv');
    K.scene.add(new THREE.Mesh(vg, K.mat(opts.vineColour ?? 0x4a5a2a, { roughness: 0.9 })));
  }

  // ---- the spiders and the prey (the creature)
  const root = K.group();
  const near = K.group(null, root), far = K.group(null, root);
  const dots = K.glow(0x9ff5d0, 1.5);
  const female = spiderBody(K, near, { look: { abd: 0xe3d47c, spot: 0xf3efd9, ceph: 0xc9c7bb, leg: 0x1d1813, band: 0xe0a032 }, dots });
  const male = spiderBody(K, near, { size: 0.17, look: { abd: 0x7a3a22, spot: 0xa8643c, ceph: 0x8a4a2c, leg: 0x4a2414, band: 0x8a4a22 }, tufts: false });
  freeze(male);
  const MALE = new THREE.Vector2(-0.95, 0.5);              // near the edge, up and to the side of the hub
  male.sp.rotation.z = PI - 0.5;
  const bug = insectBody(K, root);
  bug.g.visible = false;
  const bundle = K.mesh(K.sphere(1, 10, 8), K.sheen(0xf1e3b4, { roughness: 0.35 }), [0, 0, 0], root, null, 0.001);
  bundle.visible = false;
  bundle.userData.keep = true;
  // far: a still spider (one mesh)
  const farSp = spiderBody(K, far, { look: { abd: 0xe3d47c, spot: 0xf3efd9, ceph: 0xc9c7bb, leg: 0x1d1813, band: 0xe0a032 }, tufts: false });
  freeze(farSp);
  farSp.sp.position.set(0, 0, LIFT); farSp.sp.rotation.z = PI;
  paint(K, root);
  K.place(root, home);
  root.rotation.y = yaw;

  const c = K.makeCreature({
    species: SPECIES['golden-silk-orb-weaver'], root, home, flyer: true, radius: 0.35, eye: new THREE.Vector3(0, 0, LIFT),
    speed: 0, roam: 0, fleeAt: 0, curiousAt: 0, shy: 1, rareChance: 0, poseLen: POSE, yaw,
  });
  c.state = 'idle'; c.hold = 99; c.air = false;
  // The catch is her own set piece, rolled here for about half of the runs (the route marks her
  // `always`, so safari/poses.js leaves her be). It starts once the van is within CATCH_AT and she is
  // inside what the wide lens takes in where it looks now: the shared gate asks for 7% of the wide
  // frame and a narrow cone ahead, which a spider this size beside the road never meets at once on a
  // phone held upright.
  c.poseRun = Math.random() < 0.5;
  const wideHalf = Math.tan(THREE.MathUtils.degToRad(62) / 2);
  const inLens = (env) => {
    if (!env.look) return true;
    c.photoPoint(vA).sub(env.camPos).setY(0);
    vB.copy(env.look).setY(0);
    if (vA.lengthSq() < 1e-6 || vB.lengthSq() < 1e-6) return true;
    return vA.normalize().dot(vB.normalize()) > Math.cos(Math.atan(wideHalf * (env.aspect || 1.5)));
  };
  let glow = 0;
  // the lens aims at her, wherever she is on the web
  c.photoPoint = (out) => out.set(m.x, m.y, LIFT + m.z).applyMatrix4(root.matrixWorld);

  // her place on the web (x, y in its plane), her heading in it (0: head down), the web's own motion
  const m = { x: 0, y: 0, z: 0, turn: 0, want: 0, ph: 'sit', t: 0, next: 2 + Math.random() * 3, act: null, at: 0, leg: 0, pulled: false, buzz: 0, vib: 0, vibAt: new THREE.Vector2(), gait: 0 };
  const P = new THREE.Vector2(), from = new THREE.Vector2();
  const prey = { from: new THREE.Vector3(), mid: new THREE.Vector3(), at: new THREE.Vector3(), t: -1, stuck: false, done: false };
  // how far a point of the web moves out of its plane just now (the shader does the same)
  const disp = (x, y, t) => {
    const r = Math.hypot(x, y), f = web.flex(x, y);
    const sway = U.uSway.value * (0.7 * Math.sin(t * 1.1 + x * 0.6) + 0.3 * Math.sin(t * 1.9 + y * 1.2));
    const dv = Math.hypot(x - U.uVibAt.value.x, y - U.uVibAt.value.y);
    return (sway + U.uBuzz.value * Math.sin(t * 36 + r * 9) + U.uVib.value * Math.sin(t * 48 - dv * 12) * Math.exp(-dv * 1.8)) * f;
  };
  // the catch: the insect hits the web here (below and to one side of the hub, on the lower part)
  const pickSpot = () => {
    const a = -PI / 2 + (Math.random() < 0.5 ? -1 : 1) * (0.45 + Math.random() * 0.35), r = 0.6 + Math.random() * 0.25;
    P.set(Math.cos(a) * r, Math.sin(a) * r);
  };
  // the turn that points her head at (x, y): head down is 0, her head then points along (sin, -cos)
  const headTo = (x, y) => Math.atan2(x - m.x, -(y - m.y));
  const to = new THREE.Vector2();

  c.step = (dt, env) => {
    c._env = env; c.t += dt; m.t += dt;
    const t = env.t;
    U.uTime.value = t;
    // ---- the van close by: she pulls the web taut, it shivers (once)
    if (c.poseRun && !prey.done && c.state === 'idle' && m.ph === 'sit' && env.dist < CATCH_AT && env.dist > 6 && inLens(env)) c.go('rare', POSE);
    if (!m.pulled && env.dist < PULL_AT && c.state !== 'rare') { m.pulled = true; m.buzz = 1; m.act = { kind: 'pull', t: 0 }; if (env.call) env.call(c, 'idle'); }
    m.buzz = Math.max(0, m.buzz - dt / 2.2);
    U.uBuzz.value = 0.022 * m.buzz * m.buzz;
    m.vib = Math.max(0, m.vib - dt / 1.4);
    U.uVib.value = 0.03 * m.vib;
    U.uVibAt.value.copy(m.vibAt);
    U.uSway.value = damp(U.uSway.value, m.buzz > 0.2 ? 0.012 : 0.03, 2, dt);

    // ---- before the catch: in a run with the pose, the insect is already buzzing about in front of
    // the web as the van comes, so it can fly straight in once the lens is close enough to see it
    if (c.poseRun && m.ph === 'sit' && !prey.done && c.state !== 'rare' && env.dist < 40) {
      if (!bug.g.visible) { bug.g.visible = true; bug.g.scale.setScalar(1); bug.g.rotation.order = 'XYZ'; }
      const a = t * 1.7;
      bug.g.position.set(0.35 + Math.cos(a) * 0.55, -0.35 + Math.sin(a * 1.3) * 0.3, 1.2 + Math.sin(a * 0.8) * 0.35);
      vA.set(0.35 + Math.cos(a + 0.3) * 0.55, -0.35 + Math.sin((a + 0.3) * 1.3) * 0.3, 1.2 + Math.sin((a + 0.3) * 0.8) * 0.35);
      bug.g.lookAt(vA.applyMatrix4(root.matrixWorld));
      for (const w of bug.wings) w.rotation.z = Math.sin(t * 90) * 0.9;
    }

    // ---- the catch (the rare pose)
    if (c.state === 'rare') {
      if (m.ph !== 'catch') { m.ph = 'catch'; m.t = 0; pickSpot(); prey.t = 0; prey.stuck = false; prey.done = true; from.set(m.x, m.y);
        prey.at.set(P.x, P.y, 0.012);
        if (bug.g.visible) prey.from.copy(bug.g.position); else prey.from.set(P.x + 0.5, P.y + 0.6, 1.4);
        prey.mid.set((prey.from.x + P.x) / 2 - 0.25, (prey.from.y + P.y) / 2 + 0.2, (prey.from.z + 0.012) / 2 + 0.2);
        bug.g.visible = true; bug.g.scale.setScalar(1); bug.g.rotation.order = 'XYZ'; bundle.visible = false; m.act = null; }
      const k = m.t;
      if (k < HIT) {                                      // the insect flies in
        const u = k / HIT, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), cc = u * u;
        bug.g.position.set(prey.from.x * a + prey.mid.x * b + prey.at.x * cc, prey.from.y * a + prey.mid.y * b + prey.at.y * cc + Math.sin(k * 17) * 0.03 * (1 - u), prey.from.z * a + prey.mid.z * b + prey.at.z * cc);
        bug.g.lookAt(vA.set(prey.at.x, prey.at.y, prey.at.z).applyMatrix4(root.matrixWorld));
      } else if (!prey.stuck) {
        // it hits: the web trembles there; she turns to it and rushes down, stopping with her jaws at it
        prey.stuck = true; m.vib = 1; m.vibAt.copy(P); if (env.call) env.call(c, 'rare');
        from.set(m.x, m.y);
        to.set(P.x - from.x, P.y - from.y).normalize();
        m.want = Math.atan2(to.x, -to.y);
        to.set(P.x - to.x * 0.11, P.y - to.y * 0.11);
      }
      if (k > RUN0 && k < RUN1) {
        const u = ease((k - RUN0) / (RUN1 - RUN0));
        m.x = from.x + (to.x - from.x) * u; m.y = from.y + (to.y - from.y) * u;
        m.gait += dt * 22;
      } else if (k >= RUN1) { m.x = to.x; m.y = to.y; }
      if (prey.stuck) {                                    // stuck: it struggles, then she wraps it, spinning it
        const wrapK = clamp((k - WRAP0) / 1.8, 0, 1);
        bug.g.position.set(P.x, P.y, 0.012 + disp(P.x, P.y, t));
        // flat in the web, struggling, then spun round and round as she wraps it
        const spin = clamp(k - WRAP0, 0, WRAP1 - WRAP0) * 9;
        bug.g.rotation.order = 'ZYX';
        bug.g.rotation.set(PI / 2, 0, 0.6 + (k < WRAP0 ? Math.sin(k * 31) * 0.12 : 0) + spin);
        bug.g.scale.setScalar(1 - 0.45 * wrapK);
        bug.g.visible = wrapK < 0.98;
        bundle.visible = k > WRAP0 + 0.05;
        bundle.position.copy(bug.g.position);
        bundle.rotation.set(0, 0, bug.g.rotation.z);
        bundle.scale.set(0.024, 0.046, 0.022).multiplyScalar(0.3 + 0.7 * ease(wrapK));
      }
      for (const w of bug.wings) w.rotation.z = prey.stuck ? (m.t < WRAP0 + 0.3 ? Math.sin(t * 70) * 0.5 : 0) : Math.sin(t * 90) * 0.9;
      if (c.t > c.hold) { c.go('idle', 99); m.ph = 'home'; m.t = 0; from.set(m.x, m.y); }
    } else if (m.ph === 'home') {                          // back up to the hub, leaving the parcel in the web
      m.want = Math.hypot(m.x, m.y) > 0.06 ? headTo(0, 0) : 0;   // she climbs back head first, then turns head down
      if (m.t > 0.6) {
        const u = ease((m.t - 0.6) / 2.6);
        m.x = from.x * (1 - u); m.y = from.y * (1 - u);
        m.gait += dt * 12;
        if (u >= 1) { m.ph = 'sit'; m.t = 0; m.next = 3 + Math.random() * 3; }
      }
      bundle.position.z = 0.012 + disp(bundle.position.x, bundle.position.y, t) * 0.95;
    } else {
      // ---- sitting at the hub: now and then a leg shifts, a strand is plucked; she turns towards the van
      if (bundle.visible) bundle.position.z = 0.012 + disp(bundle.position.x, bundle.position.y, t) * 0.95;
      m.want = 0;
      if (env.dist < 24 && !m.act) {                       // the van's rumble: she turns a little towards it
        root.worldToLocal(vA.copy(env.camPos));
        m.want = clamp(headTo(vA.x, vA.y) * 0.35, -0.35, 0.35);
      }
      if (!m.act && m.t > m.next) {
        m.act = { kind: Math.random() < 0.45 ? 'pluck' : 'shift', t: 0, leg: Math.floor(Math.random() * 16) };
        m.next = m.t + 3 + Math.random() * 4;
      }
    }
    m.turn += wrap(m.want - m.turn) * Math.min(1, dt * 6);

    // ---- the legs
    const busy = c.state === 'rare' ? m.t : -1;
    const wrapping = busy > WRAP0 && busy < WRAP1, running = (busy > RUN0 && busy < RUN1) || (m.ph === 'home' && m.t > 0.6 && m.t < 3.2);
    for (let j = 0; j < female.legs.length; j++) {
      const l = female.legs[j];
      l.tip.copy(l.base);
      if (running) {                                       // walking: legs in two alternating sets of four
        const ph = m.gait + ((j + l.i) % 2) * PI;
        l.tip.y += Math.sin(ph) * 0.035; l.tip.z += Math.max(0, Math.cos(ph)) * 0.03;
      }
      if (wrapping && l.i >= 2) {                          // the back legs comb silk round the parcel, the front ones hold it
        const ph = t * 16 + l.s * 1.6 + l.i;
        l.tip.lerp(vA.set(l.s * 0.02, 0.13, -0.01), 0.55).add(vB.set(Math.sin(ph) * 0.025, Math.cos(ph) * 0.02, Math.max(0, Math.sin(ph)) * 0.03));
      } else if (wrapping && l.i <= 1) l.tip.lerp(vA.set(l.s * 0.035, 0.17, -LIFT), 0.45);
    }
    if (m.act) {
      m.act.t += dt;
      const a = m.act;
      if (a.kind === 'pull') {                             // all eight pull in, then let go
        const k = Math.sin(clamp(a.t / 0.9, 0, 1) * PI);
        for (const l of female.legs) l.tip.lerp(l.coxa, 0.16 * k);
        if (a.t > 0.9) m.act = null;
      } else if (a.kind === 'pluck') {                     // a front leg tugs a strand: it twangs
        const l = female.legs[a.leg % 2 ? 0 : 4];
        const k = a.t < 0.25 ? ease(a.t / 0.25) : 1 - ease((a.t - 0.25) / 0.12);
        l.tip.lerp(l.coxa, 0.22 * k);
        if (a.t > 0.25 && !a.done) { a.done = true; m.vib = 0.35; m.vibAt.set(m.x, m.y - 0.25); }
        if (a.t > 0.45) m.act = null;
      } else {                                             // a leg lifts and is set down again a little further on
        const l = female.legs[a.leg % female.legs.length], k = Math.sin(clamp(a.t / 0.7, 0, 1) * PI);
        l.tip.z += 0.05 * k; l.tip.x += l.s * 0.015 * k;
        if (a.t > 0.7) m.act = null;
      }
    }
    female.setLegs();

    // ---- on the web: her body, the male, all moving with the silk
    const zHere = disp(m.x, m.y, t);
    m.z = zHere;
    female.sp.position.set(m.x, m.y, LIFT + zHere);
    female.sp.rotation.set(0, 0, PI + m.turn + (wrapping ? Math.sin(t * 5) * 0.08 : 0));
    female.body.position.z = wrapping ? Math.sin(t * 9) * 0.006 : 0;
    const breathe = 1 + Math.sin(t * 1.4 + c.bob) * 0.012;
    female.body.scale.set(breathe, 1, breathe);
    // the male creeps a few centimetres now and then
    const creep = Math.max(0, Math.sin(t * 0.21 + 1.3)) * 0.06;
    male.sp.position.set(MALE.x + creep, MALE.y - creep * 0.4, LIFT * 0.17 + disp(MALE.x, MALE.y, t));
    farSp.sp.position.z = LIFT + zHere;
    glow += ((c.state === 'rare' ? 1 : 0) - glow) * Math.min(1, dt * 3);          // half again as bright in the catch
    dots.emissiveIntensity = K.glowLevel * 1.5 * (0.85 + 0.15 * Math.sin(t * 0.8 + c.bob)) * (1 + 0.5 * glow);
    root.updateMatrixWorld();
  };
  c.web = { mesh: webMesh, uniforms: U, spot: P, phase: () => ({ ph: m.ph, x: m.x, y: m.y, pulled: m.pulled, prey: prey.stuck }) };   // tests
  return K.lod(c, near, far, 42);
}

export const BUILDERS = {
  'golden-silk-orb-weaver': buildOrbWeaver,
};
