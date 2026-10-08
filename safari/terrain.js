// Ground-building helpers shared by the routes: a height grid with a fast lookup, a road carved into
// it (cut on the uphill side, filled on the downhill side), instanced scatter, the road band, and
// two small shader patches: caustics on the floor below the water line and plants that sway.
import * as THREE from 'three';

export const seeded = (seed) => () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
// smoothstep that also runs downhill (e0 > e1)
export const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
export const lerp = THREE.MathUtils.lerp;

// value noise, cheap and smooth enough for rock and sand
export function noise2(seed = 1) {
  const h = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); };
  return (x, z) => {
    const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
    const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
    return lerp(lerp(h(i, j), h(i + 1, j), u), lerp(h(i, j + 1), h(i + 1, j + 1), u), v) * 2 - 1;
  };
}

// The road: samples of the van's path in a spatial hash, so the nearest stretch of road to any
// point is found quickly. `at(x, z)` gives { d, y, i } (distance, road height, sample index).
export function roadIndex(path, step = 2) {
  const n = Math.max(40, Math.round(path.getLength() / step));
  const pts = path.getSpacedPoints(n);
  const CELL = 12, map = new Map();
  const key = (i, j) => i * 100003 + j;
  pts.forEach((p, k) => {
    const i = Math.floor(p.x / CELL), j = Math.floor(p.z / CELL);
    const kk = key(i, j);
    if (!map.has(kk)) map.set(kk, []);
    map.get(kk).push(k);
  });
  const out = { d: Infinity, y: 0, i: -1 };
  return {
    pts,
    at(x, z, reach = 2) {
      out.d = Infinity; out.i = -1;
      const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
      for (let a = -reach; a <= reach; a++) for (let b = -reach; b <= reach; b++) {
        const list = map.get(key(ci + a, cj + b));
        if (!list) continue;
        for (const k of list) {
          const p = pts[k], d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
          if (d < out.d) { out.d = d; out.i = k; }
        }
      }
      if (out.i >= 0) { out.d = Math.sqrt(out.d); out.y = pts[out.i].y; }
      return out;
    },
  };
}

// The ground: a grid of heights from `height(x, z)`, coloured by `colour(x, z, y, out)`. The heights
// are kept, so `heightAt` is a bilinear lookup (creatures ask for it every frame).
export function heightGrid({ x0, x1, z0, z1, nx, nz, height, colour }) {
  const w = nx + 1, H = new Float32Array(w * (nz + 1));
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz);
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  // PlaneGeometry rows run from -z to +z after the rotation (row 0 is z0)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = height(x, z);
    pos.setY(i, y);
    const col_i = i % w, row = Math.floor(i / w);
    H[row * w + col_i] = y;
    colour(x, z, y, c);
    c.toArray(col, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const sx = (x1 - x0) / nx, sz = (z1 - z0) / nz;
  const heightAt = (x, z) => {
    const cx = THREE.MathUtils.clamp((x - x0) / sx, 0, nx - 0.001), cz = THREE.MathUtils.clamp((z - z0) / sz, 0, nz - 0.001);
    const c0 = Math.floor(cx), r0 = Math.floor(cz), fx = cx - c0, fz = cz - r0;
    const h00 = H[r0 * w + c0], h10 = H[r0 * w + c0 + 1], h01 = H[(r0 + 1) * w + c0], h11 = H[(r0 + 1) * w + c0 + 1];
    return (h00 * (1 - fx) + h10 * fx) * (1 - fz) + (h01 * (1 - fx) + h11 * fx) * fz;
  };
  return { geometry: g, heightAt };
}

// The road surface as a band laid on the ground, a little above it
export function roadBand(path, half, lift = 0.06, n = 400) {
  const pts = path.getSpacedPoints(n);
  const v = [], idx = [], t = new THREE.Vector3(), s = new THREE.Vector3();
  pts.forEach((p, i) => {
    const q = pts[Math.min(i + 1, pts.length - 1)], r = pts[Math.max(i - 1, 0)];
    t.subVectors(q, r).setY(0).normalize();
    s.set(-t.z, 0, t.x).multiplyScalar(half);
    v.push(p.x - s.x, p.y + lift, p.z - s.z, p.x + s.x, p.y + lift, p.z + s.z);
    if (i < pts.length - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// One InstancedMesh from a list of { p: Vector3, s: [x, y, z] | number, ry, rx, rz }
const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), eu = new THREE.Euler(), sc = new THREE.Vector3();
export function instanced(geo, mat, items) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
  items.forEach((it, i) => {
    eu.set(it.rx || 0, it.ry || 0, it.rz || 0);
    qt.setFromEuler(eu);
    const s = it.s ?? 1;
    if (typeof s === 'number') sc.setScalar(s); else sc.set(s[0], s[1], s[2]);
    m4.compose(it.p, qt, sc);
    im.setMatrixAt(i, m4);
  });
  im.count = items.length;
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  return im;
}

// Caustics: a moving net of light on everything below the water line (a texture effect, so no
// shadows move). Patches a Lambert or Standard material; `u.time` drives it.
export function addCaustics(mat, u, { level = -0.7, strength = 0.5, scale = 0.16 } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = u.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWp; uniform float uTime;
        float caust(vec2 p, float t) {
          vec2 i = p; float c = 1.0; float inten = 0.005;
          for (int n = 0; n < 3; n++) {
            float tt = t * (1.0 - (3.5 / float(n + 1)));
            i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
            c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
          }
          c /= 3.0; c = 1.17 - pow(c, 1.4);
          return clamp(pow(abs(c), 8.0), 0.0, 2.0);
        }`)
      .replace('#include <opaque_fragment>', `
        float deep = smoothstep(${(level - 0.3).toFixed(2)}, ${(level - 2.2).toFixed(2)}, vWp.y);
        if (deep > 0.0) {
          float k = min(caust(mod(vWp.xz * ${scale.toFixed(3)}, 6.2831), uTime * 0.6), 1.2);
          // water swallows the red first: the deeper, the greener and darker
          outgoingLight *= mix(vec3(1.0), vec3(0.42, 0.7, 0.74) * (0.55 + 0.45 * smoothstep(-24.0, -3.0, vWp.y)), deep);
          outgoingLight += vec3(0.55, 0.9, 1.0) * k * deep * ${strength.toFixed(2)} * (0.4 + 0.6 * smoothstep(-26.0, -4.0, vWp.y));
        }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'caustics' + level + strength;
  return mat;
}

// Plants that sway: the higher a vertex is above the plant's foot, the further it moves
export function addSway(mat, u, { amp = 0.25, speed = 1.2, height = 2 } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = u.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 foot = instanceMatrix[3].xyz;
        #else
          vec3 foot = vec3(0.0);
        #endif
        float hk = clamp(position.y / ${height.toFixed(2)}, 0.0, 1.0);
        float ph = foot.x * 0.37 + foot.z * 0.21;
        transformed.x += sin(uTime * ${speed.toFixed(2)} + ph) * ${amp.toFixed(2)} * hk * hk;
        transformed.z += cos(uTime * ${(speed * 0.8).toFixed(2)} + ph * 1.3) * ${amp.toFixed(2)} * 0.6 * hk * hk;`);
  };
  mat.customProgramCacheKey = () => 'sway' + amp + speed + height;
  return mat;
}

// Soft light shafts: tall open cones, bright at the top, fading out below (additive, static)
export function shaftMaterial(color, opacity = 0.14) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { c: { value: new THREE.Color(color) }, o: { value: opacity } },
    vertexShader: 'varying float vY; void main() { vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 c; uniform float o; varying float vY; void main() { gl_FragColor = vec4(c * o * pow(vY, 1.6), 1.0); }',
  });
}

// Drifting motes around the lens (dust in the air, particles in the water), wrapped in a box that
// follows the camera so there are always some in view. `step(dt, camPos)` moves them.
export function motes({ n = 300, box = 36, color = 0xffffff, size = 0.08, opacity = 0.6, drift = [0.1, 0.05, 0] }) {
  const p = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) p[i] = (Math.random() - 0.5) * box;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const m = new THREE.PointsMaterial({ color, size, transparent: true, opacity, depthWrite: false, sizeAttenuation: true });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  const off = new THREE.Vector3();
  pts.step = (dt, cam, t) => {
    off.x += drift[0] * dt; off.y += drift[1] * dt + Math.sin(t * 0.7) * 0.02 * dt; off.z += drift[2] * dt;
    const h = box / 2;
    pts.position.set(
      cam.x - ((cam.x - off.x) % box + box) % box + h,
      cam.y - ((cam.y - off.y) % box + box) % box + h,
      cam.z - ((cam.z - off.z) % box + box) % box + h);
  };
  return pts;
}
