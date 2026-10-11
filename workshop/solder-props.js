// The solder bench's props (WORKSHOP_PLAN phase W2), decoration only: the soldering station with the
// iron in its coiled holder and the sponge, the breadboard prototype with its parts and jumper wires,
// the printed schematic, a 9 V battery, a few spare parts, and the cable helper. The playable devices
// (pedal, audio interface, multimeter) are in workshop/solder.js.
//
// Everything here is built in the bench's local frame: x to the visitor's right, y up from the desk
// top, z towards the visitor. Small parts are merged per material (one draw call each) by `kit()`.
// No lettering from real products: the station's panel carries only a switch, a fuse and a socket.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S1 = new THREE.Vector3(1, 1, 1);
export const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });

// collect small geometries per material, merge them into one mesh each
export function kit(name) {
  const parts = new Map();
  return {
    add(geo, m, pos = [0, 0, 0], rot = [0, 0, 0]) {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      ['uv1', 'uv2'].forEach((a) => g.deleteAttribute(a));
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.applyMatrix4(M4.compose(V(...pos), Q.setFromEuler(E.set(...rot)), S1));
      if (!parts.has(m)) parts.set(m, []);
      parts.get(m).push(g);
    },
    build(group, shadow = true) {
      const out = [];
      parts.forEach((list, m) => {
        const mesh = new THREE.Mesh(mergeGeometries(list), m);
        list.forEach((g) => g.dispose());
        mesh.name = name; mesh.castShadow = shadow; mesh.receiveShadow = true;
        group.add(mesh); out.push(mesh);
      });
      return out;
    },
  };
}

// a cable along points (bench-local), as a tube
export function cable(points, r, m, seg = 40) {
  const c = new THREE.CatmullRomCurve3(points.map((p) => V(...p)), false, 'centripetal');
  return new THREE.TubeGeometry(c, seg, r, 6, false);
}

// ---- the soldering station: pale turquoise base unit, black face with a red rocker switch, a blue
// solder reel on top; the iron rests in a coiled holder beside it, with a damp sponge in a tray
export function solderStation(group) {
  const K = kit('solder-station');
  const teal = mat(0xa9d9cf, { roughness: 0.45 }), black = mat(0x1f2022, { roughness: 0.7 }), red = mat(0xd8262a, { roughness: 0.35, emissive: 0x550000, emissiveIntensity: 0.4 });
  const steel = mat(0xc4c7ca, { metalness: 0.85, roughness: 0.3 }), blue = mat(0x2f62c7, { roughness: 0.5 }), beige = mat(0xd9c7a2, { roughness: 0.7 });
  const sponge = mat(0xc0913f, { roughness: 1 }), tip = mat(0x6a6c70, { metalness: 0.7, roughness: 0.4 });
  const U = { x: -0.56, z: -0.07, w: 0.13, h: 0.1, d: 0.15 };
  K.add(new RoundedBoxGeometry(U.w, U.h, U.d, 2, 0.01), teal, [U.x, U.h / 2, U.z]);
  K.add(new THREE.BoxGeometry(U.w - 0.014, U.h - 0.014, 0.003), black, [U.x, U.h / 2, U.z + U.d / 2 + 0.0005]);
  K.add(new THREE.BoxGeometry(0.016, 0.022, 0.006), red, [U.x - 0.036, 0.072, U.z + U.d / 2 + 0.003], [-0.12, 0, 0]);   // the rocker switch
  K.add(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 16), black, [U.x - 0.036, 0.04, U.z + U.d / 2 + 0.003], [Math.PI / 2, 0, 0]);   // fuse holder
  K.add(new THREE.CylinderGeometry(0.0105, 0.0105, 0.012, 18), black, [U.x - 0.036, 0.017, U.z + U.d / 2 + 0.007], [Math.PI / 2, 0, 0]);  // iron socket
  K.add(new THREE.CylinderGeometry(0.003, 0.003, 0.004, 12), steel, [U.x + 0.01, 0.02, U.z + U.d / 2 + 0.003], [Math.PI / 2, 0, 0]);    // earth socket
  for (let i = 0; i < 7; i++) K.add(new THREE.BoxGeometry(0.002, 0.004, 0.05), black, [U.x - U.w / 2 - 0.0005, 0.06 + i * 0.0045, U.z - 0.02]);   // vents
  // the solder reel on top
  const reel = new THREE.LatheGeometry([V(0.008, 0, 0), V(0.024, 0, 0), V(0.024, 0.003, 0), V(0.017, 0.003, 0), V(0.017, 0.015, 0), V(0.024, 0.015, 0), V(0.024, 0.018, 0), V(0.008, 0.018, 0)], 28);
  K.add(reel, blue, [U.x, U.h, U.z - 0.01]);
  K.add(new THREE.CylinderGeometry(0.0195, 0.0195, 0.011, 28, 1, true), steel, [U.x, U.h + 0.009, U.z - 0.01]);
  K.add(cable([[U.x + 0.019, U.h + 0.012, U.z - 0.01], [U.x + 0.03, U.h + 0.03, U.z + 0.005], [U.x + 0.02, U.h + 0.045, U.z + 0.02], [U.x + 0.004, U.h + 0.036, U.z + 0.012]], 0.0007, steel, 16), steel);
  // tray and sponge
  const T = { x: -0.4, z: -0.02 };
  K.add(new RoundedBoxGeometry(0.075, 0.016, 0.11, 2, 0.004), black, [T.x, 0.008, T.z]);
  K.add(new RoundedBoxGeometry(0.058, 0.012, 0.064, 2, 0.003), sponge, [T.x, 0.017, T.z + 0.016]);
  // the coiled holder: a helix along the iron's axis, rising back and up from the tray
  const base = V(T.x - 0.002, 0.02, T.z - 0.035), axis = V(0.12, 0.62, -0.78).normalize();
  const side = new THREE.Vector3().crossVectors(axis, V(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(side, axis).normalize();
  const helix = [];
  for (let i = 0; i <= 120; i++) {
    const t = i / 120, a = t * Math.PI * 2 * 6.5, r = 0.009 + t * 0.012;
    helix.push(base.clone().addScaledVector(axis, 0.012 + t * 0.075).addScaledVector(side, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r));
  }
  K.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helix), 360, 0.0011, 5, false), steel);
  K.add(new THREE.CylinderGeometry(0.004, 0.004, 0.04, 8), steel, base.clone().addScaledVector(axis, 0.0).toArray(), [0, 0, 0]);   // the holder's foot
  // the iron: tip down in the coil, handle out of the top, a beige cable to the station's socket
  const along = (d) => base.clone().addScaledVector(axis, d);
  const orient = (geo, from, to) => {                 // a cylinder geometry stood between two points
    const dir = to.clone().sub(from), len = dir.length();
    const g = geo(len); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.normalize()));
    g.translate(...from.clone().add(to).multiplyScalar(0.5).toArray());
    return g;
  };
  K.add(orient((l) => new THREE.CylinderGeometry(0.0012, 0.0004, l, 8), along(0.0), along(0.03)), tip);
  K.add(orient((l) => new THREE.CylinderGeometry(0.0028, 0.0028, l, 10), along(0.03), along(0.085)), steel);
  K.add(orient((l) => new THREE.CylinderGeometry(0.0095, 0.0075, l, 18), along(0.085), along(0.098)), black);
  K.add(orient((l) => new THREE.CylinderGeometry(0.0085, 0.0095, l, 18), along(0.098), along(0.2)), teal);
  K.add(orient((l) => new THREE.CylinderGeometry(0.0045, 0.006, l, 12), along(0.2), along(0.225)), black);
  const end = along(0.225), sock = V(U.x - 0.036, 0.017, U.z + U.d / 2 + 0.013);
  K.add(cable([end.toArray(), along(0.27).add(V(0, 0.02, 0)).toArray(), [T.x - 0.02, 0.2, T.z - 0.12], [T.x + 0.05, 0.12, T.z - 0.05], [T.x + 0.06, 0.004, T.z + 0.11],
    [T.x - 0.03, 0.004, T.z + 0.2], [U.x + 0.02, 0.004, U.z + 0.19], [sock.x, 0.008, sock.z + 0.04], sock.toArray()], 0.0024, beige, 80), beige);
  return K.build(group);
}

// ---- the breadboard prototype: white board, two metal-can transistors, resistors, caps, a trimmer,
// the fuzz pot hanging off the edge, jumper wires, battery leads; after the photo of the real one
export const BOARD = { x: -0.1, z: -0.1, w: 0.085, d: 0.13, h: 0.009, rot: 0.08 };
export function breadboard(group) {
  const g = new THREE.Group(); g.position.set(BOARD.x, 0, BOARD.z); g.rotation.y = BOARD.rot; group.add(g);
  // the top: holes and the + / - rails, drawn on a canvas
  const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 * BOARD.d / BOARD.w);
  const x = c.getContext('2d'), W = c.width, H = c.height;
  x.fillStyle = '#f1efe9'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#e2ded5'; x.fillRect(W / 2 - 5, 0, 10, H);   // the middle channel
  const hole = (px, py) => { x.fillStyle = '#3b3934'; x.fillRect(px - 2.5, py - 2.5, 5, 5); };
  const rows = 30, top = 24, step = (H - 48) / (rows - 1);
  for (let r = 0; r < rows; r++) { for (let k = 0; k < 5; k++) { hole(58 + k * 13, top + r * step); hole(W - 58 - k * 13, top + r * step); } }
  [[14, 27], [W - 27, W - 14]].forEach(([a, b]) => { for (let r = 0; r < rows; r++) if (r % 6 !== 5) { hole(a, top + r * step); hole(b, top + r * step); } });
  x.lineWidth = 2;
  [[8, '#d9466d'], [33, '#4d8fd1'], [W - 33, '#d9466d'], [W - 8, '#4d8fd1']].forEach(([lx, col]) => { x.strokeStyle = col; x.beginPath(); x.moveTo(lx, 10); x.lineTo(lx, H - 10); x.stroke(); });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const K = kit('breadboard');
  const white = mat(0xf1efe9, { roughness: 0.8 }), topMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
  K.add(new RoundedBoxGeometry(BOARD.w, BOARD.h, BOARD.d, 1, 0.0015), white, [0, BOARD.h / 2, 0]);
  K.add(new THREE.PlaneGeometry(BOARD.w - 0.002, BOARD.d - 0.002), topMat, [0, BOARD.h + 0.0002, 0], [-Math.PI / 2, 0, 0]);
  // board coordinates: column 0..1 across, row 0..1 down the board (row 0 at the back)
  const at = (u, v, y = BOARD.h) => [(u - 0.5) * BOARD.w, y, (v - 0.5) * BOARD.d];
  const can = mat(0xd4d6d8, { metalness: 0.8, roughness: 0.3 }), resBody = mat(0x4f86c6, { roughness: 0.5 }), capMat = mat(0x2d55b4, { roughness: 0.45 });
  const lead = mat(0xb9bcc0, { metalness: 0.8, roughness: 0.35 }), dark = mat(0x161616, { roughness: 0.5 });
  const wires = { red: mat(0xb8262c, { roughness: 0.5 }), yellow: mat(0xe2b923, { roughness: 0.5 }), green: mat(0x3fa548, { roughness: 0.5 }), black: mat(0x1b1b1b, { roughness: 0.5 }) };
  [[0.63, 0.22], [0.66, 0.36]].forEach(([u, v]) => {    // the two transistors (metal cans)
    K.add(new THREE.CylinderGeometry(0.0042, 0.0042, 0.0055, 16), can, at(u, v, BOARD.h + 0.006));
    K.add(new THREE.CylinderGeometry(0.0048, 0.0048, 0.0008, 16), can, at(u, v, BOARD.h + 0.0034));
  });
  const resistor = (u, v, a, len = 0.008) => {          // body + two bent legs into the holes
    const [px, , pz] = at(u, v);
    K.add(new THREE.CapsuleGeometry(0.0011, 0.0045, 3, 8), resBody, [px, BOARD.h + 0.004, pz], [0, a, Math.PI / 2]);
    const dx = Math.cos(a) * len / 2, dz = -Math.sin(a) * len / 2;
    K.add(cable([[px - dx, BOARD.h, pz - dz], [px - dx, BOARD.h + 0.004, pz - dz], [px, BOARD.h + 0.004, pz], [px + dx, BOARD.h + 0.004, pz + dz], [px + dx, BOARD.h, pz + dz]], 0.00028, lead, 10), lead);
  };
  resistor(0.58, 0.48, 0.2); resistor(0.72, 0.5, 1.4); resistor(0.6, 0.62, -1.2); resistor(0.84, 0.72, 0.4); resistor(0.62, 0.76, 2.2);
  [[0.76, 0.06], [0.88, 0.62]].forEach(([u, v]) => { K.add(new THREE.CylinderGeometry(0.0032, 0.0032, 0.008, 14), capMat, at(u, v, BOARD.h + 0.004)); K.add(new THREE.CylinderGeometry(0.0026, 0.0026, 0.0003, 12), can, at(u, v, BOARD.h + 0.0082)); });
  K.add(new THREE.BoxGeometry(0.006, 0.004, 0.006), capMat, at(0.68, 0.56, BOARD.h + 0.002));   // the trimmer
  // the fuzz pot lying at the left edge, shaft pointing out
  const pot = at(0.12, 0.42, BOARD.h + 0.0075);
  K.add(new THREE.CylinderGeometry(0.0085, 0.0085, 0.008, 22), dark, pot, [0, 0, Math.PI / 2]);
  K.add(new THREE.CylinderGeometry(0.0045, 0.0045, 0.006, 14), can, [pot[0] - 0.007, pot[1], pot[2]], [0, 0, Math.PI / 2]);
  K.add(new THREE.CylinderGeometry(0.003, 0.003, 0.012, 12), can, [pot[0] - 0.016, pot[1], pot[2]], [0, 0, Math.PI / 2]);
  // jumper wires: arcs between holes
  const jump = (m, a, b, h = 0.012) => {
    const pa = at(...a), pb = at(...b), mid = [(pa[0] + pb[0]) / 2, BOARD.h + h, (pa[2] + pb[2]) / 2];
    K.add(cable([pa, [pa[0], BOARD.h + h * 0.6, pa[2]], mid, [pb[0], BOARD.h + h * 0.6, pb[2]], pb], 0.0006, m, 20), m);
  };
  jump(wires.red, [0.32, 0.03], [0.3, 0.4], 0.016); jump(wires.yellow, [0.18, 0.3], [0.36, 0.2]); jump(wires.red, [0.6, 0.12], [0.86, 0.45], 0.02);
  jump(wires.red, [0.56, 0.3], [0.62, 0.7], 0.018); jump(wires.yellow, [0.68, 0.18], [0.7, 0.3], 0.01); jump(wires.green, [0.75, 0.26], [0.93, 0.2]);
  jump(wires.red, [0.5, 0.5], [0.9, 0.48], 0.014); jump(wires.green, [0.1, 0.95], [0.9, 0.95], 0.004); jump(wires.red, [0.54, 0.42], [0.66, 0.85], 0.022);
  // the off-board wires from the photo: input (yellow) and output (green), out over the back edge
  K.add(cable([at(0.46, 0.06), at(0.4, -0.05, BOARD.h + 0.01), at(0.2, -0.25, 0.004), at(0.05, -0.55, 0.002)], 0.0007, wires.yellow, 16), wires.yellow);
  K.add(cable([at(0.92, 0.04), at(0.98, -0.08, BOARD.h + 0.012), at(1.2, -0.3, 0.004), at(1.35, -0.5, 0.002)], 0.0007, wires.green, 16), wires.green);
  const meshes = K.build(g);
  g.updateMatrix();
  const local = (u, v, y) => V(...at(u, v, y)).applyMatrix4(g.matrix);   // a board point in the bench's frame
  // the anchor points for the meter's probe clips: Q2's collector and the ground rail
  return { group: g, meshes, clipRed: local(0.73, 0.38, BOARD.h + 0.004), clipBlack: local(0.95, 0.9, BOARD.h + 0.002), local, tex };
}

// ---- the 9 V battery with its snap leads into the board's rails
export function battery(group, boardInfo) {
  const K = kit('battery');
  const body = mat(0x2a2a2c, { roughness: 0.5 }), band = mat(0xd59a2c, { roughness: 0.45 }), steel = mat(0xc4c7ca, { metalness: 0.85, roughness: 0.3 });
  const red = mat(0xc22b2b, { roughness: 0.5 }), blk = mat(0x161616, { roughness: 0.5 });
  const B = [-0.19, 0.0085, -0.15];
  K.add(new RoundedBoxGeometry(0.026, 0.017, 0.048, 2, 0.002), body, B, [0, 0.3, 0]);
  K.add(new RoundedBoxGeometry(0.0262, 0.0172, 0.012, 2, 0.002), band, [B[0] - 0.003, B[1], B[2] + 0.009], [0, 0.3, 0]);
  K.add(new RoundedBoxGeometry(0.022, 0.006, 0.01, 1, 0.002), blk, [B[0] - 0.0085, B[1], B[2] - 0.027], [0, 0.3, 0]);
  K.add(new THREE.CylinderGeometry(0.0022, 0.0022, 0.004, 10), steel, [B[0] - 0.004, B[1] + 0.006, B[2] - 0.024], [Math.PI / 2, 0, 0]);
  const p = (v) => v.toArray();
  const plus = boardInfo.local(0.08, 0.92), minus = boardInfo.local(0.2, 0.92);
  const from = [B[0] - 0.012, 0.009, B[2] - 0.03];
  K.add(cable([from, [from[0] - 0.01, 0.004, from[2] - 0.03], [-0.25, 0.003, 0.0], [-0.2, 0.004, 0.04], p(plus)], 0.0009, red, 24), red);
  K.add(cable([[from[0] + 0.004, 0.009, from[2]], [from[0] - 0.004, 0.003, from[2] - 0.034], [-0.245, 0.003, 0.005], [-0.18, 0.004, 0.045], p(minus)], 0.0009, blk, 24), blk);
  return K.build(group);
}

// ---- a few spare parts on the desk: resistors, caps, a transistor, an LED, a snip of solder
export function spares(group) {
  const K = kit('spare-parts');
  const resBody = mat(0x4f86c6, { roughness: 0.5 }), lead = mat(0xb9bcc0, { metalness: 0.8, roughness: 0.35 }), capMat = mat(0x2d55b4, { roughness: 0.45 });
  const can = mat(0xd4d6d8, { metalness: 0.8, roughness: 0.3 }), led = mat(0xd8362e, { roughness: 0.2, transparent: true, opacity: 0.85 }), ceramic = mat(0xd9a33a, { roughness: 0.5 });
  [[0.02, 0.17, 0.4], [0.035, 0.185, 0.55], [-0.005, 0.2, 2.6]].forEach(([x, z, a]) => {
    K.add(new THREE.CapsuleGeometry(0.0011, 0.0045, 3, 8), resBody, [x, 0.0012, z], [0, a, Math.PI / 2]);
    K.add(new THREE.CylinderGeometry(0.00025, 0.00025, 0.028, 5), lead, [x, 0.0003, z], [0, a, Math.PI / 2]);
  });
  K.add(new THREE.CylinderGeometry(0.0032, 0.0032, 0.008, 14), capMat, [0.075, 0.0032, 0.19], [0, 0.4, Math.PI / 2]);
  K.add(new THREE.CylinderGeometry(0.0021, 0.0021, 0.001, 12), ceramic, [0.065, 0.0021, 0.21], [Math.PI / 2, 0, 0.3]);
  K.add(new THREE.CylinderGeometry(0.0042, 0.0042, 0.0055, 16), can, [0.095, 0.0028, 0.165]);
  K.add(new THREE.CapsuleGeometry(0.0022, 0.003, 4, 10), led, [0.05, 0.0022, 0.155], [0, 0.8, Math.PI / 2]);
  K.add(cable([[0.11, 0.0005, 0.2], [0.13, 0.0006, 0.205], [0.145, 0.0005, 0.19], [0.155, 0.0006, 0.205]], 0.0005, lead, 12), lead);
  return K.build(group, false);
}

// ---- the printed schematic: the circuit and the box layout, drawn (not copied) on a sheet of paper,
// with a pencil note. Read on the zoomed view.
export const SHEET = { x: -0.17, z: 0.115, w: 0.297, d: 0.21, rot: -0.05 };
export function schematic(group) {
  const c = document.createElement('canvas'); c.width = 2048; c.height = Math.round(2048 * SHEET.d / SHEET.w);
  drawSchematic(c.getContext('2d'), c.width, c.height);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(SHEET.w, SHEET.d), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  m.rotation.set(-Math.PI / 2, 0, SHEET.rot); m.position.set(SHEET.x, 0.0006, SHEET.z);
  m.receiveShadow = true; m.name = 'schematic';
  group.add(m);
  return [m];
}
function drawSchematic(g, W, H) {
  g.fillStyle = '#fbf8f1'; g.fillRect(0, 0, W, H);
  const ink = '#3c3c3c'; g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
  const s = W / 2000;                                   // drawn on a 2000-wide grid
  g.save(); g.scale(s, s);
  const line = (...p) => { g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.stroke(); };
  const font = (px, w = 500) => { g.font = `${w} ${px}px system-ui, -apple-system, "Segoe UI", Arial, sans-serif`; };
  const label = (t, x, y, px = 34, align = 'center') => { font(px); g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = ink; g.fillText(t, x, y); };
  const term = (t, x, y) => { g.fillStyle = '#fbf8f1'; g.beginPath(); g.arc(x, y, 34, 0, 7); g.fill(); g.stroke(); label(t, x, y, 26); };
  const res = (t, x, y, vertical) => {                  // a resistor: dark pill with its value
    g.save(); g.translate(x, y); if (vertical) g.rotate(Math.PI / 2);
    g.fillStyle = ink; g.beginPath(); g.roundRect(-50, -18, 100, 36, 7); g.fill();
    font(26, 600); g.fillStyle = '#fbf8f1'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 0, 1);
    g.restore();
  };
  const cap = (t, x, y, vertical, pol, lx = 0, ly = -60) => {
    g.save(); g.translate(x, y); if (vertical) g.rotate(Math.PI / 2);
    g.lineWidth = 12; line(-8, -32, -8, 32);
    if (pol) { g.beginPath(); g.arc(40, 0, 44, Math.PI * 0.8, Math.PI * 1.2); g.stroke(); } else line(8, -32, 8, 32);
    g.restore(); g.lineWidth = 9; label(t, x + lx, y + ly);
  };
  const ground = (x, y) => { line(x, y, x, y + 20); line(x - 50, y + 20, x + 50, y + 20); line(x - 32, y + 38, x + 32, y + 38); line(x - 14, y + 56, x + 14, y + 56); };
  const npn = (t, x, y) => {                           // circle, base bar, collector up, emitter down with arrow
    g.beginPath(); g.arc(x, y, 62, 0, 7); g.stroke();
    g.lineWidth = 12; line(x - 22, y - 32, x - 22, y + 32); g.lineWidth = 9;
    line(x - 62, y, x - 22, y); line(x - 22, y - 14, x + 20, y - 46, x + 20, y - 62); line(x - 22, y + 14, x + 20, y + 46, x + 20, y + 62);
    g.beginPath(); g.moveTo(x + 22, y + 48); g.lineTo(x + 2, y + 46); g.lineTo(x + 12, y + 30); g.closePath(); g.fill();
    label(t, x + 40, y, 28, 'left');
  };
  const pot = (t, x, y, ax, ay) => { res(t, x, y, true); g.beginPath(); g.moveTo(ax, ay); g.lineTo(x + 26, y); g.stroke(); g.beginPath(); g.moveTo(x + 22, y); g.lineTo(x + 40, y - 12); g.lineTo(x + 40, y + 12); g.closePath(); g.fill(); };
  // title and the circuit
  font(54, 700); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText('FUZZ', 80, 110);
  font(30, 400); g.fillText('two transistors, 9 V', 80, 155);
  term('IN', 110, 560); line(144, 560, 285, 560); cap('2.2µF', 300, 560, false, true, 20); line(330, 560, 470, 560);
  npn('Q1', 532, 560); line(400, 560, 400, 745, 680, 745);
  line(552, 622, 552, 650); ground(552, 650);
  term('9V+', 552, 115); line(552, 149, 552, 260);
  line(552, 260, 552, 330); res('33kΩ', 552, 380, true); line(552, 430, 552, 498);
  line(552, 260, 690, 260); res('470Ω', 740, 260); line(790, 260, 810, 260);
  line(552, 458, 640, 458, 660, 478, 660, 540, 680, 560, 730, 560); npn('Q2', 792, 560);
  line(812, 260, 812, 330); res('8.2kΩ', 812, 380, true); line(812, 430, 812, 498);
  line(812, 260, 900, 260); cap('10nF', 920, 260, false, false, 0, -60); line(940, 260, 1030, 260, 1030, 520);
  line(812, 622, 812, 745); line(680, 745, 760, 745); res('100kΩ', 690, 745); line(740, 745, 812, 745);
  line(812, 745, 812, 820); pot('1kB', 812, 870, 940, 870); line(940, 870, 940, 930); cap('22µF', 940, 945, true, true, 80, 10);
  line(940, 990, 940, 1040, 812, 1040); line(812, 920, 812, 1040); line(870, 1040, 870, 1080); ground(870, 1080);
  label('FUZZ', 700, 870, 28);
  pot('500kA', 1030, 560, 1200, 560); line(1030, 610, 1030, 640); ground(1030, 640);
  line(1080, 560, 1170, 560); term('OUT', 1210, 560); label('VOLUME', 1030, 470, 28);
  // the box layout on the right: two pots, jacks either side, the footswitch at the bottom
  g.lineWidth = 8; g.beginPath(); g.roundRect(1360, 140, 520, 970, 50); g.stroke();
  [[1490, 310], [1745, 310]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 70, 0, 7); g.stroke(); });
  label('VOLUME', 1490, 410, 26); label('FUZZ', 1745, 410, 26);
  g.fillStyle = ink; [[1505, 590], [1735, 590]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 46, 0, 7); g.fill(); });
  label('Q1', 1505, 665, 24); label('Q2', 1735, 665, 24);
  g.strokeRect(1325, 700, 70, 110); g.strokeRect(1845, 700, 70, 110); label('OUT', 1360, 840, 24); label('IN', 1880, 840, 24);
  g.strokeRect(1545, 880, 150, 150); [0, 1, 2].forEach((i) => [0, 1].forEach((j) => g.fillRect(1572 + i * 45, 925 + j * 55, 14, 10)));
  line(1505, 590, 1505, 760, 1395, 760); line(1735, 590, 1735, 760, 1845, 760); line(1620, 140 + 60, 1620, 880); line(1490, 380, 1600, 470, 1735, 545);
  // pencil notes in the margin
  g.fillStyle = '#6d6f86'; g.strokeStyle = '#6d6f86'; g.lineWidth = 4;
  g.font = 'italic 400 40px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive'; g.textAlign = 'left';
  g.fillText('Q2 collector ≈ 4.5 V  ✓', 1010, 1010);
  g.fillText('germanium? → silicon, more gain', 120, 1210);
  g.beginPath(); g.ellipse(812, 400, 90, 80, 0, 0, 7); g.stroke();
  g.restore();
}
