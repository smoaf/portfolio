// The creature workshop: what the route modules use to build animals that hold up in a close photo
// and still cost little on a phone. Phase 3 (canyon) built it; the jungle can use the same tools.
//
// A body is modelled in its own rest pose, in metres, facing +z:
//
//   const B = body(q)                     q: 1 = the close-up body, 0 = the far one (fewer segments)
//   B.bone('neck', 'spine', [0, 1, 0.6])  joints, in model space, with a parent
//   B.loft(rings, { bone, mat, seg })     a smooth tube along a spine (torso, tail, neck, legs...)
//   B.add(geo, { bone, mat, at, rot, scale, color, glow })   a rigid part (horn, claw, scale, eye)
//   B.build()                             -> { root, bones, meshes }: skinned, one draw call per material
//   B.bake()                              -> a plain static Group of the same body (for the far LOD)
//
// Every part carries a vertex colour; the body material multiplies it with a painted pattern (map)
// and lights the glowing markings with an emissive map. Rigid parts sample two reserved corners of
// that pattern: plain, or glowing. So a whole animal is one body material, plus eyes and any thin
// membrane (fins, frills, wings) that wants to be see-through.
import * as THREE from 'three';

const UV_PLAIN = [6 / 512, 1 - 6 / 256], UV_GLOW = [22 / 512, 1 - 6 / 256];   // reserved corners
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), m4 = new THREE.Matrix4();
const qA = new THREE.Quaternion();

// --- patterns ------------------------------------------------------------------------------------
// paint(g, w, h) draws the coat; glow(g, w, h) draws the markings that light up (white on black).
// u runs around the body (0 = belly, 0.5 = back), v runs along it (0 = the first ring, the nose).
export function pattern({ paint, glow, w = 512, h = 256, keep = (x) => x }) {
  const make = (draw, base) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    if (draw) draw(g, w, h);
    return c;
  };
  const col = make(paint, '#ffffff');
  const em = make(glow, '#000000');
  // the reserved corners: plain white for rigid parts, and white in both for the glowing ones
  let g = col.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 32, 12);
  g = em.getContext('2d'); g.fillStyle = '#000000'; g.fillRect(0, 0, 14, 12); g.fillStyle = '#ffffff'; g.fillRect(16, 0, 16, 12);
  const map = keep(new THREE.CanvasTexture(col));
  map.colorSpace = THREE.SRGBColorSpace; map.wrapS = THREE.RepeatWrapping;
  map.anisotropy = 2;
  const emissiveMap = keep(new THREE.CanvasTexture(em));
  emissiveMap.colorSpace = THREE.SRGBColorSpace; emissiveMap.wrapS = THREE.RepeatWrapping;
  return { map, emissiveMap };
}

// the usual material set for one species
export function materials({ keep = (x) => x, paint, glow, glowColor = 0x66e0ff, glowAt = 0.2, rough = 0.62, sheen = 0, eyeGlow = null, membrane = null }) {
  const P = pattern({ paint, glow, keep });
  const skin = keep(new THREE.MeshStandardMaterial({
    vertexColors: true, map: P.map, emissiveMap: P.emissiveMap, emissive: new THREE.Color(glowColor), emissiveIntensity: glowAt,
    roughness: rough, metalness: sheen,
  }));
  const eyes = keep(new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.08, metalness: 0.1, vertexColors: true,
    emissive: new THREE.Color(eyeGlow || 0x000000), emissiveIntensity: eyeGlow ? 1 : 0,
  }));
  const film = membrane ? keep(new THREE.MeshStandardMaterial({
    vertexColors: true, transparent: true, opacity: membrane.opacity ?? 0.62, side: THREE.DoubleSide, depthWrite: false,
    roughness: 0.35, emissive: new THREE.Color(membrane.glow ?? glowColor), emissiveIntensity: membrane.glowAt ?? glowAt * 0.6,
  })) : null;
  return { skin, eyes, film, glowBase: glowAt };
}

// --- the body builder ----------------------------------------------------------------------------
export function body(q = 1) {
  const bones = [], byName = {};
  const parts = [];                                     // { geo, mat, skinIndex fn }
  const B = { q, bones: byName };

  B.bone = (name, parent, at) => {
    const b = new THREE.Bone();
    b.name = name;
    b.userData.at = new THREE.Vector3(...at);
    b.userData.parent = parent;
    b.userData.index = bones.length;
    bones.push(b); byName[name] = b;
    return b;
  };
  const idx = (n) => {
    const b = byName[n];
    if (!b) throw new Error('no bone ' + n);
    return b.userData.index;
  };
  // a ring's weights: 'neck', or [['neck', 0.6], ['head', 0.4]], or a function of the ring
  const weights = (spec) => {
    if (typeof spec === 'string') return [[idx(spec), 1]];
    return spec.map(([n, w]) => [idx(n), w]);
  };
  // blend along a chain of bones: t = 0 is the first bone, t = n - 1 the last
  B.along = (names, t) => {
    const i = THREE.MathUtils.clamp(Math.floor(t), 0, names.length - 1), f = t - i;
    if (i >= names.length - 1 || f < 0.001) return [[names[Math.min(i, names.length - 1)], 1]];
    return [[names[i], 1 - f], [names[i + 1], f]];
  };

  function push(geo, mat, ringWeights, colorOf, uvOf) {
    const n = geo.attributes.position.count;
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const w = ringWeights(i);
      for (let k = 0; k < Math.min(4, w.length); k++) { si[i * 4 + k] = w[k][0]; sw[i * 4 + k] = w[k][1]; }
      colorOf(i, col);
    }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    if (uvOf) {
      const uv = geo.attributes.uv || new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2);
      for (let i = 0; i < n; i++) uv.setXY(i, uvOf[0], uvOf[1]);
      geo.setAttribute('uv', uv);
    }
    if (!geo.index) {
      const ix = []; for (let i = 0; i < n; i++) ix.push(i);
      geo.setIndex(ix);
    }
    parts.push({ geo, mat });
  }

  // A smooth tube. rings: [{ p: [x,y,z], r: radius or [side, up], b: bone weights, c: colour }]
  // opts.profile(a, v) shapes the cross-section (a: angle, 0 = belly), e.g. a flat belly or a keel.
  // opts.up: the "up" of the cross-section when the spine is vertical (legs).
  B.loft = (rings, { mat, seg, profile, up = [0, 1, 0], color = 0xffffff, cap = true, uv = 1, glow = false, plain = false } = {}) => {
    const S = seg ?? Math.max(5, Math.round((q ? 14 : 6)));
    const n = rings.length;
    const P = rings.map((r) => new THREE.Vector3(...r.p));
    const pos = [], nor = [], uvs = [], wts = [], cols = [];
    const upV = new THREE.Vector3(...up);
    const base = new THREE.Color(color);
    // arc length for v
    const len = [0];
    for (let i = 1; i < n; i++) len.push(len[i - 1] + P[i].distanceTo(P[i - 1]));
    const total = len[n - 1] || 1;
    let prevN = null;
    for (let i = 0; i < n; i++) {
      const t = vA.subVectors(P[Math.min(n - 1, i + 1)], P[Math.max(0, i - 1)]).normalize();
      // the ring's frame: keep "up" as steady as the spine allows (parallel transport)
      let nn;
      if (prevN) nn = prevN.clone().sub(vB.copy(t).multiplyScalar(prevN.dot(t))).normalize();
      else {
        nn = upV.clone().sub(vB.copy(t).multiplyScalar(upV.dot(t)));
        if (nn.lengthSq() < 1e-6) nn.set(0, 0, 1).sub(vB.copy(t).multiplyScalar(t.z));
        nn.normalize();
      }
      prevN = nn;
      const side = vC.crossVectors(nn, t).normalize().clone();
      const R = rings[i].r;
      const rx = Array.isArray(R) ? R[0] : R, ry = Array.isArray(R) ? R[1] : R;
      const w = weights(rings[i].b);
      const c = rings[i].c != null ? new THREE.Color(rings[i].c) : base;
      for (let s = 0; s <= S; s++) {
        const a = (s / S) * Math.PI * 2;                // 0 = belly (-up), pi = back
        const k = profile ? profile(a, len[i] / total, i) : 1;
        const cx = Math.sin(a), cy = -Math.cos(a);
        pos.push(
          P[i].x + (side.x * cx * rx + nn.x * cy * ry) * k,
          P[i].y + (side.y * cx * rx + nn.y * cy * ry) * k,
          P[i].z + (side.z * cx * rx + nn.z * cy * ry) * k);
        uvs.push(glow ? UV_GLOW[0] : plain ? UV_PLAIN[0] : s / S, glow ? UV_GLOW[1] : plain ? UV_PLAIN[1] : (1 - (len[i] / total)) * uv);
        wts.push(w);
        cols.push(c.r, c.g, c.b);
      }
    }
    const idxs = [];
    for (let i = 0; i < n - 1; i++) for (let s = 0; s < S; s++) {
      const a = i * (S + 1) + s, b = a + S + 1;
      idxs.push(a, a + 1, b, a + 1, b + 1, b);         // wound outwards
    }
    // caps: a fan to the end point, so a tube is never open
    if (cap) [0, n - 1].forEach((i, e) => {
      const ci = pos.length / 3;
      pos.push(P[i].x, P[i].y, P[i].z);
      uvs.push(uvs[i * (S + 1) * 2], uvs[i * (S + 1) * 2 + 1]);
      wts.push(weights(rings[i].b));
      cols.push(cols[i * (S + 1) * 3], cols[i * (S + 1) * 3 + 1], cols[i * (S + 1) * 3 + 2]);
      for (let s = 0; s < S; s++) {
        const a = i * (S + 1) + s;
        if (e === 0) idxs.push(ci, a + 1, a); else idxs.push(ci, a, a + 1);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idxs);
    geo.computeVertexNormals();
    push(geo, mat, (i) => wts[i], (i, out) => { out[i * 3] = cols[i * 3]; out[i * 3 + 1] = cols[i * 3 + 1]; out[i * 3 + 2] = cols[i * 3 + 2]; });
    return geo;
  };

  // A rigid part, placed in model space. at/rot/scale move it; bone is what carries it.
  B.add = (geo, { bone, mat, at = [0, 0, 0], rot = [0, 0, 0], scale = 1, color = 0xffffff, glow = false, keepUV = false } = {}) => {
    const g = geo;
    const s = Array.isArray(scale) ? scale : [scale, scale, scale];
    m4.compose(new THREE.Vector3(...at), qA.setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')), new THREE.Vector3(...s));
    g.applyMatrix4(m4);
    const w = weights(bone);
    const c = new THREE.Color(color);
    push(g, mat, () => w, (i, out) => { out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b; }, keepUV ? null : (glow ? UV_GLOW : UV_PLAIN));
    return g;
  };

  // a flat membrane (fin, frill, wing, ear) from an outline in its own x/y plane, extruded a hair
  B.sheet = (outline, { bone, mat, at, rot, scale, color, glow, thick = 0.01, keepUV = true, weightsOf } = {}) => {
    const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
    const geo = thick > 0
      ? new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 4 })
      : new THREE.ShapeGeometry(shape, 4);
    if (thick > 0) geo.translate(0, 0, -thick / 2);
    // uv from the outline's own box so a membrane can carry a painted vein pattern
    if (keepUV) {
      geo.computeBoundingBox();
      const bb = geo.boundingBox, p = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, 0.04 + 0.92 * (p.getX(i) - bb.min.x) / Math.max(1e-4, bb.max.x - bb.min.x), 0.06 + 0.88 * (p.getY(i) - bb.min.y) / Math.max(1e-4, bb.max.y - bb.min.y));
    }
    if (weightsOf) {                                    // a membrane that bends with several bones
      const g2 = B.add(geo, { bone: 'root', mat, at, rot, scale, color, glow, keepUV });
      const p = g2.attributes.position, si = g2.attributes.skinIndex, sw = g2.attributes.skinWeight;
      for (let i = 0; i < p.count; i++) {
        const w = weights(weightsOf(p.getX(i), p.getY(i), p.getZ(i)));
        si.setXYZW(i, w[0] ? w[0][0] : 0, w[1] ? w[1][0] : 0, w[2] ? w[2][0] : 0, 0);
        sw.setXYZW(i, w[0] ? w[0][1] : 1, w[1] ? w[1][1] : 0, w[2] ? w[2][1] : 0, 0);
      }
      return g2;
    }
    return B.add(geo, { bone, mat, at, rot, scale, color, glow, keepUV });
  };

  // An eye: a glossy ball, a coloured iris ring and a tiny catch-light so it reads as alive.
  // The ball goes on the eye material, the ring and the light on the skin (the light glows a little).
  B.eye = ({ bone, at, r = 0.05, look = [0, 0, 1], iris = 0x3a2a14, ball = 0x0c0a08, mat, skin, ring = true }) => {
    const sg = q ? 12 : 6;
    B.add(new THREE.SphereGeometry(r, sg, Math.max(4, sg - 4)), { bone, mat, at, color: ball });
    const L = new THREE.Vector3(...look).normalize();
    if (ring && q) {
      const tor = new THREE.TorusGeometry(r * 0.72, r * 0.16, 5, 14);
      const o = new THREE.Object3D(); o.lookAt(L);
      B.add(tor, { bone, mat, at: [at[0] + L.x * r * 0.66, at[1] + L.y * r * 0.66, at[2] + L.z * r * 0.66], rot: [o.rotation.x, o.rotation.y, o.rotation.z], color: iris });
    }
    if (q && skin) B.add(new THREE.SphereGeometry(r * 0.17, 5, 4), { bone, mat: skin, glow: true, color: 0xffffff,
      at: [at[0] + L.x * r * 0.92 + 0.0, at[1] + L.y * r * 0.92 + r * 0.38, at[2] + L.z * r * 0.92 + r * 0.12] });
  };

  // Finish: bones into a hierarchy, the parts merged per material into skinned meshes
  B.build = () => {
    const root = new THREE.Group();
    bones.forEach((b) => {
      const p = b.userData.parent ? byName[b.userData.parent] : null;
      b.position.copy(b.userData.at);
      if (p) { b.position.sub(p.userData.at); p.add(b); } else root.add(b);
    });
    root.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(bones);
    const meshes = [];
    let radius = 0;
    for (const [mat, geo] of mergeByMat(parts)) {
      const m = new THREE.SkinnedMesh(geo, mat);
      root.add(m);
      m.bind(skeleton);
      geo.computeBoundingSphere();
      radius = Math.max(radius, geo.boundingSphere.radius + geo.boundingSphere.center.length());
      meshes.push(m);
    }
    // the bounds of a moving body: generous, so a stretched neck never gets culled
    meshes.forEach((m) => { m.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius * 1.35); });
    return { root, bones: byName, meshes, skeleton, radius };
  };
  // the far body: the same parts, still and merged, no skeleton at all
  B.bake = () => {
    const root = new THREE.Group();
    for (const [mat, geo] of mergeByMat(parts)) {
      geo.deleteAttribute('skinIndex'); geo.deleteAttribute('skinWeight');
      root.add(new THREE.Mesh(geo, mat));
    }
    return root;
  };
  B.bone('root', null, [0, 0, 0]);
  return B;
}

// glue the parts of one material together (same attributes everywhere, so a plain concat)
function mergeByMat(parts) {
  const by = new Map();
  parts.forEach((p) => { if (!by.has(p.mat)) by.set(p.mat, []); by.get(p.mat).push(p.geo); });
  const out = [];
  for (const [mat, geos] of by) {
    const names = ['position', 'normal', 'uv', 'color', 'skinIndex', 'skinWeight'];
    geos.forEach((g) => { if (!g.attributes.normal) g.computeVertexNormals(); });
    let count = 0, icount = 0;
    geos.forEach((g) => { count += g.attributes.position.count; icount += g.index.count; });
    const merged = new THREE.BufferGeometry();
    for (const n of names) {
      const s = geos[0].attributes[n].itemSize;
      const arr = n === 'skinIndex' ? new Uint16Array(count * s) : new Float32Array(count * s);
      let o = 0;
      geos.forEach((g) => {
        const a = g.attributes[n];
        for (let i = 0; i < a.count; i++) for (let k = 0; k < s; k++) arr[(o + i) * s + k] = a.array[i * s + k] ?? 0;
        o += a.count;
      });
      merged.setAttribute(n, n === 'skinIndex' ? new THREE.Uint16BufferAttribute(arr, s) : new THREE.Float32BufferAttribute(arr, s));
    }
    const ix = new Uint32Array(icount);
    let o = 0, base = 0;
    geos.forEach((g) => { for (let i = 0; i < g.index.count; i++) ix[o + i] = g.index.array[i] + base; o += g.index.count; base += g.attributes.position.count; g.dispose(); });
    merged.setIndex(new THREE.BufferAttribute(ix, 1));
    out.push([mat, merged]);
  }
  return out;
}

// --- one creature, two bodies --------------------------------------------------------------------
// make(q) returns a finished builder; the close one is skinned and animated, the far one is baked.
// lod.step(camPos, fov) swaps them on how big the animal is on screen, not on distance alone, so
// the long lens still gets the detailed one.
export function twoBodies(make, { radius = 1 } = {}) {
  const hiB = make(1), loB = make(0);
  const hi = hiB.build();
  const lo = loB.bake();
  const root = new THREE.Group();
  root.add(hi.root, lo);
  lo.visible = false;
  const lod = {
    near: true,
    step(dist, fov) {
      const screen = radius / (Math.max(0.1, dist) * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
      const want = screen > (lod.near ? 0.045 : 0.06);  // a little hysteresis
      if (want !== lod.near) { lod.near = want; hi.root.visible = want; lo.visible = !want; }
      return want;
    },
  };
  return { root, bones: hi.bones, hi, lo, lod, radius: Math.max(radius, hi.radius * 0.6) };
}

// --- small motion helpers ------------------------------------------------------------------------
export const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const damp = (a, b, k, dt) => a + (b - a) * Math.min(1, k * dt);

// turn a head bone towards a world point, within limits (yaw, pitch), smoothly
const _w = new THREE.Vector3(), _inv = new THREE.Matrix4();
export function lookAt(bone, target, { yaw = 1, pitch = 0.6, k = 4, dt = 0.016, on = true } = {}) {
  let y = 0, p = 0;
  if (on && target) {
    const parent = bone.parent;
    _inv.copy(parent.matrixWorld).invert();
    _w.copy(target).applyMatrix4(_inv).sub(bone.position);
    y = THREE.MathUtils.clamp(Math.atan2(_w.x, _w.z), -yaw, yaw);
    p = THREE.MathUtils.clamp(-Math.atan2(_w.y, Math.hypot(_w.x, _w.z)), -pitch, pitch);
  }
  bone.rotation.y = damp(bone.rotation.y, y, k, dt);
  bone.rotation.x = damp(bone.rotation.x, p, k, dt);
}

// blinking: eyes bone scale y, closed for a few frames now and then
export function blinker() {
  let next = 1 + Math.random() * 3, t = 0;
  return (dt) => {
    t += dt;
    if (t > next) { t = 0; next = 1.6 + Math.random() * 4; }
    return t < 0.12 ? 0.12 : 1;
  };
}

// a soft dark disc under a ground animal, because the safari has no moving shadows (rule 4)
let blobGeo = null, blobMat = null;
export function blob(keep, r = 0.5) {
  if (!blobGeo) {
    blobGeo = keep(new THREE.CircleGeometry(1, 16));
    blobGeo.rotateX(-Math.PI / 2);
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    blobMat = keep(new THREE.MeshBasicMaterial({ map: keep(new THREE.CanvasTexture(c)), transparent: true, depthWrite: false, fog: true }));
    keep({ dispose() { blobGeo = null; blobMat = null; } });
  }
  const m = new THREE.Mesh(blobGeo, blobMat);
  m.scale.setScalar(r); m.position.y = 0.04; m.renderOrder = -1;
  return m;
}
