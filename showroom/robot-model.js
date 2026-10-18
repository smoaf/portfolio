// Showroom robot, the model (night run 07). Built at load from Smo's base model
// `assets/robot/orbweaver.glb`, changed to match the five pose screenshots:
//   - kept from the base model: the skeleton (Body, Coxa_n, Femur_n, Tibia_n, Foot_n, n = 0..5, its
//     names, the body height and the coxa directions) and the material set (Shell, Frame, Metal, Rubber)
//   - removed: its skinned mesh (an eye on the dome, a ring on top, orange Glow stripes, two plates per
//     leg on thin sticks) and its five clips (the motion is procedural, robot-motion.js)
//   - new: the dome is six petal segments, each on its own bone `Petal_n` hinged at the dome's rim, so
//     it can open like a crown; each leg carries one plate, the exact lower-hemisphere lune it fills in
//     the ball, its tip being the foot; a dark frame with servos, brackets and wires between dome and
//     legs; a short mast in the middle that rises when the crown opens
//   - leg lengths are changed so that, folded, the six plates and six petals close into one sphere
// Units are the robot's own (the base model's metres); the showroom scales the whole robot up.
// Nothing here runs per frame.
import * as THREE from 'three';

export const R = 0.3;                       // radius of the closed ball (the base model is 0.6 m across)
const T = 0.011;                            // shell thickness
const SEAM = THREE.MathUtils.degToRad(0.75);   // half the angular gap at each seam
export const LEG = {
  n: 6,
  rc: 0.075, yc: -0.07,                     // coxa servo: radius and height in the body
  lc: 0.03,                                 // coxa to femur joint
  knee: new THREE.Vector2(0.245, -0.04),    // where the knee sits in the closed ball (leg plane: radial, up)
};
LEG.lf = Math.hypot(LEG.knee.x - LEG.rc - LEG.lc, LEG.knee.y - LEG.yc);   // femur length (0.143)
LEG.lt = Math.hypot(LEG.knee.x, LEG.knee.y + R);                        // tibia length to the plate tip (0.357)
// leg k points along azimuth psi(k); the base model's coxa directions (0, 60, ... degrees)
export const psi = (k) => (k * Math.PI) / 3;

// ---- shell geometry: a thick spherical lune (lat0..lat1, lon0..lon1), outer radius R, closed by side walls
const sph = (lat, lon, r, out) => out.set(r * Math.cos(lat) * Math.cos(lon), r * Math.sin(lat), -r * Math.cos(lat) * Math.sin(lon));
function lune(lat0, lat1, lon0, lon1, nLat, nLon) {
  const pos = [], nor = [], uv = [], idx = [];
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  const grid = (r, flip, u0) => {
    const base = pos.length / 3;
    for (let i = 0; i <= nLat; i++) {
      const lat = lat0 + (lat1 - lat0) * (i / nLat);
      for (let j = 0; j <= nLon; j++) {
        const lon = lon0 + (lon1 - lon0) * (j / nLon);
        sph(lat, lon, r, v); n.copy(v).normalize(); if (flip) n.negate();
        pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z); uv.push(u0 + j / nLon * 0.5, i / nLat);
      }
    }
    for (let i = 0; i < nLat; i++) for (let j = 0; j < nLon; j++) {
      const a = base + i * (nLon + 1) + j, b = a + 1, c = a + nLon + 1, d = c + 1;
      if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
  };
  grid(R, false, 0);
  const nOuter = idx.length;
  grid(R - T, true, 0.5);
  // side walls: a strip of quads along each edge of the outer grid, joined to the inner one
  const wall = (pts) => {                    // pts: [lat, lon] along the edge, outward normal side on the right
    const base = pos.length / 3, a = new THREE.Vector3(), b = new THREE.Vector3(), e = new THREE.Vector3();
    for (let i = 0; i < pts.length; i++) {
      const [lat, lon] = pts[i], [lat2, lon2] = pts[Math.min(i + 1, pts.length - 1)], [lat1, lon1] = pts[Math.max(i - 1, 0)];
      sph(lat, lon, R, a); sph(lat2, lon2, R, b).sub(sph(lat1, lon1, R, e)); n.copy(a).normalize().cross(b).normalize();
      pos.push(a.x, a.y, a.z); nor.push(n.x, n.y, n.z); uv.push(0, 0);
      sph(lat, lon, R - T, a); pos.push(a.x, a.y, a.z); nor.push(n.x, n.y, n.z); uv.push(0, 0);
    }
    for (let i = 0; i < pts.length - 1; i++) { const o = base + i * 2; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
  };
  const edge = [];
  for (let j = 0; j <= nLon; j++) edge.push([lat0, lon0 + (lon1 - lon0) * (j / nLon)]); wall(edge.slice().reverse()); edge.length = 0;
  for (let j = 0; j <= nLon; j++) edge.push([lat1, lon0 + (lon1 - lon0) * (j / nLon)]); wall(edge.slice()); edge.length = 0;
  for (let i = 0; i <= nLat; i++) edge.push([lat0 + (lat1 - lat0) * (i / nLat), lon0]); wall(edge.slice()); edge.length = 0;
  for (let i = 0; i <= nLat; i++) edge.push([lat0 + (lat1 - lat0) * (i / nLat), lon1]); wall(edge.slice().reverse());
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.addGroup(0, nOuter, 0); g.addGroup(nOuter, idx.length - nOuter, 1);   // outer face; inside and edges
  return g;
}

// faint wear on the white plastic: a small noise map with a few scuffs, made once
function wearTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), img = g.createImageData(128, 128);
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 128 * 128; i++) { const v = 238 + rnd() * 17; img.data.set([v, v, v - 2, 255], i * 4); }
  g.putImageData(img, 0, 0);
  g.strokeStyle = 'rgba(120,112,100,0.10)'; g.lineWidth = 1;
  for (let i = 0; i < 26; i++) { const x = rnd() * 128, y = rnd() * 128, a = rnd() * 6.3, l = 3 + rnd() * 9; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// materials after the base model's set, tuned to the screenshots and the station's plaster look
function materials(base) {
  const by = {}; base.traverse((o) => { if (o.isMesh) [].concat(o.material).forEach((m) => { by[m.name] = m; }); });
  const from = (name, fallback) => { const m = by[name] ? by[name].clone() : new THREE.MeshStandardMaterial(); Object.assign(m, fallback); m.name = 'robot' + name; return m; };
  const shell = from('Shell', { roughness: 0.78, metalness: 0, map: wearTexture() }); shell.color.set(0xefebe3);
  const inner = shell.clone(); inner.map = null; inner.color.set(0x9d988f); inner.roughness = 0.9; inner.name = 'robotShellInner';
  const frame = from('Frame', { roughness: 0.62, metalness: 0.15 }); frame.color.set(0x15171a);
  const metal = from('Metal', { roughness: 0.42, metalness: 0.55 }); metal.color.set(0x5d6166);
  const rubber = from('Rubber', { roughness: 0.92, metalness: 0 }); rubber.color.set(0x111111);
  const part = shell.clone(); part.map = null; part.color.set(0xdcd8cf); part.name = 'robotPart';   // the small white parts in the frame
  [shell, inner, frame, metal, rubber, part].forEach((m) => { m.envMapIntensity = 0.45; m.emissive = new THREE.Color(0); });
  return { shell, inner, frame, metal, rubber, part };
}

// a merged mesh per material for each moving part: few draw calls, nothing to update per frame
function partMesh(group, list, mats) {
  const by = new Map();
  list.forEach(([geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0]) => {
    geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (!by.has(mat)) by.set(mat, []);
    by.get(mat).push(g);
  });
  by.forEach((geos, mat) => {
    const m = new THREE.Mesh(mergeGeos(geos), mats[mat]);
    group.add(m);
  });
}
function mergeGeos(geos) {
  let n = 0; geos.forEach((g) => { n += g.attributes.position.count; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  geos.forEach((g) => { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const ring = (r0, r1, h) => { const s = new THREE.Shape(); s.absarc(0, 0, r1, 0, Math.PI * 2); const hole = new THREE.Path(); hole.absarc(0, 0, r0, 0, Math.PI * 2, true); s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 36 }); g.rotateX(-Math.PI / 2); g.translate(0, -h / 2, 0); return g; };
const cyl = (r, h, n = 12) => new THREE.CylinderGeometry(r, r, h, n);
const tube = (pts, r) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 16, r, 5, false);

// ---- build: returns the rig. `base` is the loaded orbweaver.glb scene.
export function buildRobot(base) {
  const mats = materials(base);
  const bones = {}; base.traverse((o) => { bones[o.name] = o; });
  const bodyY = bones.Body ? bones.Body.position.y : R;   // the base model's body sits at the ball's centre (0.3)

  const root = new THREE.Group(); root.name = 'robot';
  const body = new THREE.Group(); body.name = 'Body'; body.position.y = bodyY; root.add(body);

  // the frame: a dark body ring under the dome, full of servos, brackets, wires and small white parts
  const frameParts = [
    [cyl(0.135, 0.07, 6), 'frame', 0, -0.06, 0],                 // the hexagonal body
    [ring(0.2, 0.262, 0.014), 'frame', 0, -0.015, 0],             // a dark ring under the dome's rim
    [cyl(0.17, 0.008, 24), 'frame', 0, -0.012, 0],               // deck under the dome
    [cyl(0.11, 0.012, 6), 'metal', 0, -0.1, 0],                  // battery plate below
    [box(0.1, 0.025, 0.06), 'frame', 0, -0.118, 0],               // battery
    [cyl(0.03, 0.02, 12), 'metal', 0, -0.006, 0],                 // mast collar
    [box(0.05, 0.03, 0.03), 'part', 0.06, -0.0, 0.05],            // small white boards on the deck
    [box(0.035, 0.012, 0.05), 'part', -0.07, -0.003, -0.02],
    [box(0.03, 0.02, 0.025), 'metal', -0.02, 0.0, 0.08],
  ];
  for (let k = 0; k < 6; k++) {                                   // a wire from the middle to each coxa servo, a bracket over it
    const a = psi(k) + 0.25, c = Math.cos(a), s = -Math.sin(a);
    frameParts.push([tube([[0.03 * c, -0.03, 0.03 * s], [0.08 * c, -0.02, 0.08 * s], [0.12 * c, -0.04, 0.12 * s]], 0.0035), k % 2 ? 'rubber' : 'metal']);
    const b = psi(k) + Math.PI / 6;
    frameParts.push([box(0.03, 0.018, 0.012), 'part', 0.13 * Math.cos(b), -0.03, -0.13 * Math.sin(b), 0, b, 0]);
  }
  partMesh(body, frameParts, mats);

  // the mast in the middle: hidden under the closed dome, rises when the crown opens
  const mast = new THREE.Group(); mast.name = 'Mast'; body.add(mast);
  partMesh(mast, [
    [cyl(0.016, 0.14, 10), 'metal', 0, 0.07, 0],
    [cyl(0.045, 0.018, 6), 'frame', 0, 0.145, 0],
    [box(0.07, 0.01, 0.02), 'part', 0, 0.158, 0],
    [box(0.02, 0.01, 0.07), 'frame', 0, 0.158, 0],
  ], mats);

  // dome petals: six lunes of the upper hemisphere, each hinged on the rim at its middle
  const petals = [];
  for (let k = 0; k < 6; k++) {
    const p = new THREE.Group(); p.name = 'Petal_' + k;
    const a = psi(k);
    p.position.set(R * Math.cos(a), 0, -R * Math.sin(a)); p.rotation.y = a;   // local +x radial, local z along the rim
    body.add(p);
    const g = lune(SEAM, Math.PI / 2, a - Math.PI / 6 + SEAM, a + Math.PI / 6 - SEAM, 14, 8);
    g.translate(-p.position.x, 0, -p.position.z); g.applyMatrix4(new THREE.Matrix4().makeRotationY(-a));
    const shell = new THREE.Mesh(g, [mats.shell, mats.inner]); p.add(shell);
    // the dark rib and hinge on the inside (seen when the crown is open)
    const rib = [];
    for (let i = 0; i <= 5; i++) { const lat = 0.12 + i * 0.26; rib.push([R * 0.93 * Math.cos(lat) - R, R * 0.93 * Math.sin(lat), 0]); }
    partMesh(p, [[tube(rib, 0.006), 'frame'], [box(0.03, 0.014, 0.05), 'frame', -0.022, 0.006, 0]], mats);
    petals.push(p);
  }

  // legs: Coxa (yaw) -> Femur (pitch) -> Tibia (pitch) -> Foot, rest pose is the closed ball
  const legs = [];
  const ball = ballAngles();
  for (let k = 0; k < 6; k++) {
    const a = psi(k);
    const coxa = new THREE.Group(); coxa.name = 'Coxa_' + k; coxa.position.set(LEG.rc * Math.cos(a), LEG.yc, -LEG.rc * Math.sin(a)); coxa.rotation.y = a;
    const femur = new THREE.Group(); femur.name = 'Femur_' + k; femur.position.x = LEG.lc; femur.rotation.z = ball[1];
    const tibia = new THREE.Group(); tibia.name = 'Tibia_' + k; tibia.position.x = LEG.lf; tibia.rotation.z = ball[2];
    const foot = new THREE.Group(); foot.name = 'Foot_' + k; foot.position.x = LEG.lt;
    body.add(coxa); coxa.add(femur); femur.add(tibia); tibia.add(foot);
    partMesh(coxa, [[box(0.045, 0.035, 0.04), 'frame', 0.012, 0, 0], [cyl(0.011, 0.006, 10), 'part', 0.012, 0.02, 0]], mats);
    const lf = LEG.lf;
    partMesh(femur, [
      [box(lf, 0.024, 0.014), 'frame', lf / 2, 0, 0.013], [box(lf, 0.024, 0.014), 'frame', lf / 2, 0, -0.013],   // twin brackets
      [box(0.03, 0.03, 0.04), 'frame', lf, 0, 0],                                                                // knee servo
      [cyl(0.012, 0.05, 10), 'part', lf, 0, 0, Math.PI / 2, 0, 0],                                               // white servo horns
      [cyl(0.004, lf * 0.8, 6), 'metal', lf / 2, 0.016, 0, 0, 0, Math.PI / 2],
    ], mats);
    legs.push({ coxa, femur, tibia, foot, a });
  }
  // the plates: built where they sit in the ball, then moved into each tibia's frame
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4(), bodyInv = new THREE.Matrix4().copy(body.matrixWorld).invert();
  legs.forEach((L) => {
    const g = lune(-Math.PI / 2, -SEAM, L.a - Math.PI / 6 + SEAM, L.a + Math.PI / 6 - SEAM, 16, 8);
    inv.copy(L.tibia.matrixWorld).invert().multiply(body.matrixWorld);
    g.applyMatrix4(inv);
    const plate = new THREE.Mesh(g, [mats.shell, mats.inner]); plate.name = 'Plate'; L.tibia.add(plate);
    // the tibia's dark spar along the plate's inside, brackets to the plate, a rubber tip
    const lt = LEG.lt;
    const mid = new THREE.Vector3(), mid2 = new THREE.Vector3();
    sph(-0.35, L.a, R - T - 0.012, mid).applyMatrix4(bodyInv.copy(L.tibia.matrixWorld).invert().multiply(body.matrixWorld));
    sph(-0.95, L.a, R - T - 0.01, mid2).applyMatrix4(bodyInv);
    partMesh(L.tibia, [
      [box(lt * 0.62, 0.022, 0.016), 'frame', lt * 0.31, 0, 0],
      [tube([[0.0, 0, 0], [mid.x * 0.6, mid.y * 0.6 - 0.01, 0], [mid.x, mid.y, mid.z]], 0.007), 'frame'],
      [tube([[lt * 0.55, 0, 0], [mid2.x, mid2.y, mid2.z]], 0.006), 'frame'],
      [box(0.03, 0.012, 0.02), 'part', mid.x, mid.y, mid.z],
    ], mats);
    L.plate = plate;
  });
  body.position.y = bodyY;
  return { root, body, legs, petals, mast, mats, ball };
}

// joint angles of one leg in the closed ball: yaw 0, femur up to the knee, tibia down to the south pole
export function ballAngles() {
  const fx = LEG.rc + LEG.lc, fy = LEG.yc;
  const q1 = Math.atan2(LEG.knee.y - fy, LEG.knee.x - fx);
  const t = Math.atan2(-R - LEG.knee.y, 0 - LEG.knee.x);
  return [0, q1, t - q1];
}
