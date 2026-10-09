// The creature kit: what every species body in safari/fauna/*.js is built with. A route makes one
// kit per run (`makeKit`) and hands it to the species builders; the kit knows the time of day (so
// the glowing markings know how bright to be), the ground and the water, and it shares geometry and
// materials between all the animals of a run so that twenty bodies do not cost twenty of everything.
//
// The rules the builders follow, so the safari stays light enough for a phone:
//   - anything a pose() moves is a THREE.Group; the meshes inside it never move on their own.
//     `K.bake(root)` then merges the still meshes of every group into one mesh per material.
//   - every animal has a near body and a far body (`K.lod`): the far one is a handful of primitives.
//   - no negative scales, no textures: colour, sheen and emissive markings carry the look.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeCreature, makeFlock } from './creature.js';

const vA = new THREE.Vector3(), vB = new THREE.Vector3(), qA = new THREE.Quaternion();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const GLOW = { day: 0.3, dawn: 1.1, dusk: 1.6, night: 2.4 };   // how bright the markings are, per time of day

export function makeKit({ scene, keep = (x) => x, tod = 'day', groundY = () => 0, waterY = null, seed = 1 }) {
  const dim = tod !== 'day', night = tod === 'night';
  let s = seed >>> 0 || 1;
  const rand = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const mats = new Map(), geos = new Map();

  const K = {
    THREE, scene, keep, tod, dim, night, rand, groundY, waterY,
    glowLevel: GLOW[tod] ?? 0.3,
    makeCreature, makeFlock,

    // ---- materials, shared by key: the same colour and finish is one material for the whole run
    mat(color, o = {}) {
      const key = 'm' + color + JSON.stringify(o);
      if (!mats.has(key)) mats.set(key, keep(new THREE.MeshStandardMaterial({ color, roughness: 0.68, metalness: 0, ...o })));
      return mats.get(key);
    },
    // a wet or polished surface: eyes, shells, beetle wing cases, scales
    sheen(color, o = {}) { return K.mat(color, { roughness: 0.22, metalness: 0.1, ...o }); },
    // bioluminescent markings: faint by day, strong at dusk and night. `k` scales it per species.
    glow(color, k = 1, o = {}) { return K.mat(color, { emissive: color, emissiveIntensity: K.glowLevel * k, roughness: 0.4, ...o }); },
    // fins, wings, frills and jelly: see-through, both sides, a little light of their own
    fin(color, opacity = 0.6, glowK = 0.3, o = {}) {
      return K.mat(color, { transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, roughness: 0.35,
        emissive: color, emissiveIntensity: K.glowLevel * glowK, ...o });
    },
    // the dark soft shadow disc under an animal (the safari has no moving shadows)
    shadeMat() { return K.mat(0x000000, { transparent: true, opacity: 0.24, depthWrite: false, roughness: 1 }); },

    // ---- geometry, shared by key: `K.geo('leg', () => new THREE.CapsuleGeometry(...))`
    geo(key, make) {
      if (!geos.has(key)) geos.set(key, keep(make()));
      return geos.get(key);
    },
    sphere: (r = 1, w = 12, h = 9) => K.geo(`sph${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h)),
    capsule: (r, len, c = 4, rs = 8) => K.geo(`cap${r},${len},${c},${rs}`, () => new THREE.CapsuleGeometry(r, len, c, rs)),
    cone: (r, h, rs = 8) => K.geo(`cone${r},${h},${rs}`, () => new THREE.ConeGeometry(r, h, rs)),
    cyl: (r0, r1, h, rs = 8) => K.geo(`cyl${r0},${r1},${h},${rs}`, () => new THREE.CylinderGeometry(r0, r1, h, rs)),
    box: (x, y, z) => K.geo(`box${x},${y},${z}`, () => new THREE.BoxGeometry(x, y, z)),
    torus: (r, t, rs = 6, ts = 16, arc = Math.PI * 2) => K.geo(`tor${r},${t},${rs},${ts},${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc)),
    // a body of revolution from a profile of [radius, y] pairs (bottom to top), e.g. a shell or a torso
    lathe(key, profile, segs = 12) {
      return K.geo('lathe' + key, () => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)), segs));
    },
    // a tapered tube through points: tails, necks, tentacles, horns. r0 at the start, r1 at the end.
    tube(key, points, r0, r1, radial = 7, segs = 14) {
      return K.geo('tube' + key, () => {
        const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))));
        const g = new THREE.TubeGeometry(curve, segs, 1, radial, false);
        const pos = g.attributes.position, c = new THREE.Vector3();
        for (let i = 0; i <= segs; i++) {
          curve.getPointAt(i / segs, c);
          const r = THREE.MathUtils.lerp(r0, r1, i / segs);
          for (let j = 0; j <= radial; j++) {
            const k = i * (radial + 1) + j;
            vA.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c);
            pos.setXYZ(k, vA.x, vA.y, vA.z);
          }
        }
        g.computeVertexNormals();
        return g;
      });
    },
    // a flat outline (wing, frill, fin, leaf, ear) in the XY plane from [x, y] points; depth > 0 extrudes it
    shape(key, pts, depth = 0) {
      return K.geo('shape' + key, () => {
        const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
        const g = depth > 0 ? new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }) : new THREE.ShapeGeometry(sh);
        if (depth > 0) g.translate(0, 0, -depth / 2);
        return g;
      });
    },

    // ---- assembling
    // K.mesh(geometry, material, [x, y, z], parent, [rx, ry, rz], scale) -> the mesh
    mesh(g, m, p, parent, r, sc) {
      const o = new THREE.Mesh(g, m);
      if (p) o.position.set(p[0], p[1], p[2]);
      if (r) o.rotation.set(r[0] || 0, r[1] || 0, r[2] || 0);
      if (sc !== undefined) (typeof sc === 'number' ? o.scale.setScalar(sc) : o.scale.set(sc[0], sc[1], sc[2]));
      if (parent) parent.add(o);
      return o;
    },
    group(p, parent, r) {
      const g = new THREE.Group();
      if (p) g.position.set(p[0], p[1], p[2]);
      if (r) g.rotation.set(r[0] || 0, r[1] || 0, r[2] || 0);
      if (parent) parent.add(g);
      return g;
    },
    // a soft shadow disc under the animal, on its root (so it stays on the ground when the body hops)
    shadow(root, rx = 0.6, rz = rx, y = 0.03) {
      const m = K.mesh(K.geo('shadeDisc', () => new THREE.CircleGeometry(1, 16)), K.shadeMat(), [0, y, 0], root, [-Math.PI / 2, 0, 0]);
      m.scale.set(rx, rz, 1);
      m.userData.keep = true;
      return m;
    },

    // An eye that reads at a distance: a wet dark ball, a coloured iris, a pupil and a catchlight.
    // Returns its group (blink scales it). `glow` makes the iris light up after dark (the twist).
    //   K.eye(head, { pos: [x, y, z], r: 0.05, iris: 0xd9a03a, dir: [x, y, z], slit: false, glow: 0 })
    eye(parent, { pos = [0, 0, 0], r = 0.05, iris = 0x7a5a2a, dir = null, slit = false, glow = 0, white = false } = {}) {
      const g = K.group(pos, parent);
      if (dir) g.lookAt(vA.set(...dir).normalize().add(g.position));  // point the eye outward along dir (local)
      else g.rotation.y = 0;
      K.mesh(K.sphere(1, 14, 10), K.sheen(white ? 0xe9e4da : 0x0c0a09, { roughness: 0.12 }), [0, 0, 0], g, null, r);
      const irisMat = glow ? K.glow(iris, glow, { roughness: 0.15 }) : K.sheen(iris, { roughness: 0.15 });
      K.mesh(K.sphere(1, 12, 8), irisMat, [0, 0, r * 0.52], g, null, [r * 0.72, r * 0.72, r * 0.5]);
      K.mesh(K.sphere(1, 10, 8), K.sheen(0x040404, { roughness: 0.1 }), [0, 0, r * 0.82], g, null, slit ? [r * 0.14, r * 0.6, r * 0.22] : [r * 0.4, r * 0.4, r * 0.22]);
      K.mesh(K.sphere(1, 6, 5), K.mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9 }), [-r * 0.32, r * 0.34, r * 0.9], g, null, r * 0.16);
      g.userData.eye = true;
      return g;
    },
    // blinking: call every frame with the creature's eyes; each blink closes them for ~0.12 s
    blink(c, eyes, dt) {
      c._blink = (c._blink ?? 1 + K.rand() * 3) - dt;
      const closed = c._blink < 0.12 && c._blink > 0;
      if (c._blink <= 0) c._blink = 1.8 + K.rand() * 3.5;
      for (const e of eyes) e.scale.y = closed ? 0.12 : 1;
    },
    // Turn a head group towards the van (curious), or let it glance around (otherwise). The head's
    // rest pose looks along +z. Limits are radians.
    look(c, head, env, dt, { yaw = 0.9, pitch = 0.45, rate = 3, glance = true, force = false } = {}) {
      let ty = 0, tp = 0;
      const watching = force || c.state === 'curious' || (c.near !== undefined && c.near < 30 && c.state === 'idle');
      if (watching) {
        head.parent.updateWorldMatrix(true, false);
        head.getWorldPosition(vA);
        vB.copy(env.camPos).sub(vA);
        head.parent.getWorldQuaternion(qA);
        vB.applyQuaternion(qA.invert()).normalize();
        ty = THREE.MathUtils.clamp(Math.atan2(vB.x, vB.z), -yaw, yaw);
        tp = THREE.MathUtils.clamp(-Math.asin(THREE.MathUtils.clamp(vB.y, -1, 1)), -pitch, pitch);
      } else if (glance) {
        ty = Math.sin(env.t * 0.37 + c.bob) * yaw * 0.5;
        tp = Math.sin(env.t * 0.23 + c.bob * 2) * pitch * 0.25;
      }
      const k = Math.min(1, dt * rate);
      head.rotation.y += wrap(ty - head.rotation.y) * k;
      head.rotation.x += (tp - head.rotation.x) * k;
    },
    // near and far bodies: the engine calls c.lod(distance) every frame
    lod(c, near, far, at = 42) {
      c.far = false;
      c.lod = (d) => {
        const f = d > at;
        if (f === c.far) return;
        c.far = f; near.visible = !f; if (far) far.visible = f;
      };
      if (far) far.visible = false;
      return c;
    },

    // Merge the still meshes of every group into one mesh per material (draw calls drop a lot).
    // Meshes marked userData.keep stay as they are.
    bake(root) {
      const groups = [];
      root.traverse((o) => { if (!o.isMesh) groups.push(o); });
      for (const gr of groups) {
        const byMat = new Map();
        for (const ch of gr.children) {
          if (!ch.isMesh || ch.userData.keep || ch.isInstancedMesh || ch.children.length) continue;
          if (!byMat.has(ch.material)) byMat.set(ch.material, []);
          byMat.get(ch.material).push(ch);
        }
        for (const [m, list] of byMat) {
          if (list.length < 2) continue;
          const parts = list.map((ch) => {
            ch.updateMatrix();
            let g = ch.geometry.index ? ch.geometry.toNonIndexed() : ch.geometry.clone();
            for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
            if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
            if (!g.attributes.normal) g.computeVertexNormals();
            g.applyMatrix4(ch.matrix);
            if (ch.matrix.determinant() < 0) {                 // mirrored: turn the triangles back round
              for (const k of ['position', 'normal', 'uv']) {
                const a = g.attributes[k], n = a.itemSize;
                for (let t = 0; t < a.count; t += 3) for (let j = 0; j < n; j++) {
                  const x = a.array[(t + 1) * n + j]; a.array[(t + 1) * n + j] = a.array[(t + 2) * n + j]; a.array[(t + 2) * n + j] = x;
                }
              }
            }
            return g;
          });
          const merged = mergeGeometries(parts, false);
          parts.forEach((g) => g.dispose());
          if (!merged) continue;
          keep(merged);
          const mm = new THREE.Mesh(merged, m);
          list.forEach((ch) => gr.remove(ch));
          gr.add(mm);
        }
      }
      return root;
    },

    // add a finished body to the scene (and bake it)
    place(root, home) {
      K.bake(root);
      if (home) root.position.copy(home);
      scene.add(root);
      return root;
    },
  };
  return K;
}
