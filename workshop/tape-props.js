// The tape delay's body (WORKSHOP_PLAN phase W3), after Simon's prototype poster: two clear acrylic
// plates on standoffs, and between them all the mechanics in view: a tape loop round guide rollers,
// a motor driving the capstan by a belt, the erase head, the record head and five playback heads in
// a row, two small circuit boards, a terminal strip, wires, the jacks and the power lead. The
// controls on the top plate and the sound are in workshop/tape.js.
//
// Built in the device's own frame: x to the visitor's right, y up from the desk top, z towards the
// visitor; the origin is the middle of the device on the desk. Small parts are merged per material.
// No lettering from real products.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { kit, cable, mat } from './stations.js';

export const CASE = { w: 0.42, d: 0.3, low: 0.022, top: 0.112, t: 0.005, post: [0.19, 0.13] };
export const BASE = CASE.low + CASE.t;                 // top of the bottom plate
export const TAPE = { y: 0.05, w: 0.0064, z: 0.075, v0: 0.23 };   // v0: m/s at speed 1
// the head row on the front run of the tape, left to right in the direction the tape runs
export const HEADS = { erase: -0.11, rec: -0.085, play: [-0.055, -0.03, -0.005, 0.02, 0.045] };
const CAPSTAN = [-0.14, TAPE.z - 0.003];
// the loop, seen from above (x, z), anticlockwise; the front run is straight past the heads
const PATH = [
  [-0.165, 0.075], [-0.12, 0.075], [-0.06, 0.075], [0, 0.075], [0.06, 0.075], [0.1, 0.074],
  [0.124, 0.064], [0.136, 0.04], [0.14, 0], [0.14, -0.05], [0.13, -0.085], [0.105, -0.103],
  [0.05, -0.108], [-0.03, -0.106], [-0.1, -0.098], [-0.145, -0.08], [-0.172, -0.045], [-0.18, 0],
  [-0.178, 0.045], [-0.172, 0.068],
];
const ROLLERS = [[0.112, 0.05], [0.108, -0.076], [-0.1, -0.082], [-0.158, 0.0]];   // centres; radius from the path
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const acrylic = (o = {}) => new THREE.MeshPhysicalMaterial({ color: 0xe4f6f3, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.16,
  clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false, side: THREE.DoubleSide, ...o });

// ---- the case: two plates, four standoffs with cap nuts, rubber feet
export function acrylicCase(group) {
  const out = [];
  const plates = [];
  [[CASE.low, 0.26], [CASE.top, 0.16]].forEach(([y, op], i) => {
    const geo = new RoundedBoxGeometry(CASE.w, CASE.t, CASE.d, 2, 0.004);
    const m = new THREE.Mesh(geo, acrylic({ opacity: op }));
    m.position.y = y + CASE.t / 2; m.renderOrder = 1; m.castShadow = false; m.receiveShadow = i === 0;
    // the cut edges show greenish, as acrylic does
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(CASE.w - 0.002, CASE.t, CASE.d - 0.002)), new THREE.LineBasicMaterial({ color: 0x8fcfc6, transparent: true, opacity: 0.85 }));
    m.add(e);
    group.add(m); out.push(m); plates.push(m);
  });
  const K = kit('tape-case');
  const alu = mat(0xd5d8dc, { metalness: 0.35, roughness: 0.35 }), rubber = mat(0x151515, { roughness: 0.9 });
  const [px, pz] = CASE.post;
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => {
    const x = sx * px, z = sz * pz;
    K.add(new THREE.CylinderGeometry(0.0055, 0.0055, CASE.top - CASE.low - CASE.t, 6), alu, [x, (CASE.top + CASE.low + CASE.t) / 2, z]);   // hex standoff
    K.add(new THREE.CylinderGeometry(0.0045, 0.0045, CASE.low - 0.004, 6), alu, [x, (CASE.low + 0.004) / 2, z]);                         // leg
    K.add(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 14), rubber, [x, 0.002, z]);                                                   // foot
    const cap = new THREE.SphereGeometry(0.0055, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    K.add(cap, alu, [x, CASE.top + CASE.t, z]);                                                                                            // cap nut
  }));
  out.push(...K.build(group));
  return { meshes: out, plates };
}

// ---- the tape loop: a ribbon along the path; the recorded sound shows on it as an amber glow
// (a data texture written at the record head, wiped at the erase head) and both textures scroll
// as the tape runs, so the sound visibly travels from head to head
export function tapeLoop(group) {
  const curve = new THREE.CatmullRomCurve3(PATH.map(([x, z]) => V(x, TAPE.y, z)), true, 'centripetal');
  const M = 600, L = curve.getLength();
  const pos = [], uv = [], idx = [];
  const pts = curve.getSpacedPoints(M);
  for (let i = 0; i <= M; i++) {
    const p = pts[i % M];
    pos.push(p.x, TAPE.y - TAPE.w / 2, p.z, p.x, TAPE.y + TAPE.w / 2, p.z);
    uv.push(i / M, 0, i / M, 1);
    if (i < M) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  // the tape's own look: dark brown oxide, a splice and faint streaks, so its motion shows
  const c = document.createElement('canvas'); c.width = 1024; c.height = 8;
  const g = c.getContext('2d');
  g.fillStyle = '#3b271b'; g.fillRect(0, 0, 1024, 8);
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 140; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(20,10,6,0.5)' : 'rgba(120,86,60,0.35)'; g.fillRect(rnd() * 1024, 0, 1 + rnd() * 4, 8); }
  g.fillStyle = '#c9c3b6'; g.fillRect(500, 0, 9, 8);   // the splice
  const base = new THREE.CanvasTexture(c); base.colorSpace = THREE.SRGBColorSpace; base.wrapS = THREE.RepeatWrapping;
  // the recorded sound: one texel per 1/N of the loop
  const N = 1024, data = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) data[i * 4 + 3] = 255;
  const sig = new THREE.DataTexture(data, N, 1, THREE.RGBAFormat);
  sig.wrapS = THREE.RepeatWrapping; sig.magFilter = THREE.LinearFilter; sig.minFilter = THREE.LinearFilter; sig.needsUpdate = true;
  const m = new THREE.MeshStandardMaterial({ map: base, emissive: 0xffffff, emissiveMap: sig, emissiveIntensity: 1, roughness: 0.35, metalness: 0.1, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, m); mesh.name = 'tape-loop'; mesh.castShadow = false; mesh.receiveShadow = true;
  group.add(mesh);
  // where a point (x, z) of the device lies along the loop, in metres from the start
  const sAt = (x, z) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < M; i++) { const d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2; if (d < bd) { bd = d; best = i; } }
    return (best / M) * L;
  };
  return { mesh, curve, L, N, data, sig, base, mat: m, sAt, pts };
}

// ---- the mechanics: rollers, capstan and pinch roller, motor and belt, the heads, boards, wires
export function mechanics(group, loop) {
  const K = kit('tape-mech');
  const steel = mat(0xcfd2d6, { metalness: 0.9, roughness: 0.22 }), nylon = mat(0xece8de, { roughness: 0.45 });
  const rubber = mat(0x141414, { roughness: 0.85 }), brass = mat(0xc8a24a, { metalness: 0.8, roughness: 0.3 });
  const pcb = mat(0x1f6b3a, { roughness: 0.6 }), ic = mat(0x161616, { roughness: 0.5 }), capBlue = mat(0x2c58b8, { roughness: 0.4 });
  const capBlk = mat(0x22252a, { roughness: 0.4 }), resistor = mat(0xd9c8a0, { roughness: 0.6 }), trim = mat(0x2d6cd6, { roughness: 0.5 });
  const white = mat(0xf0eee8, { roughness: 0.5 }), copper = mat(0xb87333, { metalness: 0.7, roughness: 0.35 });
  const spin = [];
  const spinner = (geo, m, x, y, z, r) => { const s = new THREE.Mesh(geo, m); s.position.set(x, y, z); s.castShadow = true; group.add(s); spin.push({ mesh: s, r }); return s; };
  const mark = (s, r, h, m = rubber) => { const t = new THREE.Mesh(new THREE.BoxGeometry(r * 0.9, 0.0008, 0.0014), m); t.position.set(r * 0.45, h / 2 + 0.0004, 0); s.add(t); };
  // guide rollers: white nylon on steel posts, radius to just touch the tape
  ROLLERS.forEach(([x, z]) => {
    let d = Infinity; loop.pts.forEach((p) => { d = Math.min(d, Math.hypot(p.x - x, p.z - z)); });
    const r = Math.max(0.005, Math.min(0.024, d - 0.0006));
    K.add(new THREE.CylinderGeometry(0.0018, 0.0018, TAPE.y + 0.012 - BASE, 10), steel, [x, (TAPE.y + 0.012 + BASE) / 2, z]);
    const s = spinner(new THREE.CylinderGeometry(r, r, TAPE.w + 0.003, 28), nylon, x, TAPE.y, z, r);
    mark(s, r, TAPE.w + 0.003);
    K.add(new THREE.CylinderGeometry(r + 0.0012, r + 0.0012, 0.0012, 28), nylon, [x, TAPE.y + TAPE.w / 2 + 0.002, z]);   // flanges
    K.add(new THREE.CylinderGeometry(r + 0.0012, r + 0.0012, 0.0012, 28), nylon, [x, TAPE.y - TAPE.w / 2 - 0.002, z]);
  });
  // capstan, flywheel on top, pinch roller in front of the tape
  const [cx, cz] = CAPSTAN;
  const capstan = spinner(new THREE.CylinderGeometry(0.0025, 0.0025, 0.045, 12), steel, cx, BASE + 0.0225, cz, 0.0025);
  mark(capstan, 0.0025, 0.045, steel);
  const fly = spinner(new THREE.CylinderGeometry(0.013, 0.013, 0.004, 32), brass, cx, 0.066, cz, 0.0025);
  mark(fly, 0.013, 0.004);
  const pinch = spinner(new THREE.CylinderGeometry(0.0068, 0.0068, TAPE.w + 0.002, 22), rubber, cx, TAPE.y, TAPE.z + 0.0072, 0.0068);
  mark(pinch, 0.0068, TAPE.w + 0.002, steel);
  K.add(new THREE.BoxGeometry(0.004, 0.003, 0.016), steel, [cx, TAPE.y + 0.006, TAPE.z + 0.011]);   // the pinch arm
  K.add(new THREE.CylinderGeometry(0.0015, 0.0015, TAPE.y + 0.006 - BASE, 8), steel, [cx, (TAPE.y + 0.006 + BASE) / 2, TAPE.z + 0.018]);
  // the motor: a silver can on a bracket, a small pulley; the belt runs round pulley and flywheel
  const MO = [-0.112, 0.022];
  K.add(new THREE.CylinderGeometry(0.016, 0.016, 0.028, 28), steel, [MO[0], BASE + 0.016, MO[1]]);
  K.add(new THREE.CylinderGeometry(0.0165, 0.0165, 0.004, 28), rubber, [MO[0], BASE + 0.003, MO[1]]);
  K.add(new THREE.CylinderGeometry(0.006, 0.006, 0.003, 18), steel, [MO[0], BASE + 0.0315, MO[1]]);
  K.add(new THREE.CylinderGeometry(0.0012, 0.0012, 0.032, 8), steel, [MO[0], BASE + 0.044, MO[1]]);
  const pulley = spinner(new THREE.CylinderGeometry(0.0045, 0.0045, 0.005, 18), brass, MO[0], 0.066, MO[1], 0.0045 * 0.0025 / 0.013);
  mark(pulley, 0.0045, 0.005);
  {
    // belt: the outside of both wheels joined by their tangents
    const a = V(MO[0], 0.066, MO[1]), b = V(cx, 0.066, cz), ra = 0.0047, rb = 0.0132;
    const dir = b.clone().sub(a).normalize(), n = V(-dir.z, 0, dir.x), pts = [];
    for (let i = 0; i <= 16; i++) { const t = Math.PI / 2 + (i / 16) * Math.PI; pts.push(a.clone().addScaledVector(dir, Math.cos(t) * ra).addScaledVector(n, Math.sin(t) * ra)); }
    for (let i = 0; i <= 24; i++) { const t = -Math.PI / 2 + (i / 24) * Math.PI; pts.push(b.clone().addScaledVector(dir, Math.cos(t) * rb).addScaledVector(n, Math.sin(t) * rb)); }
    K.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 60, 0.0009, 5, true), rubber);
  }
  // the heads: brackets on the bottom plate, chrome bodies against the tape from inside the loop
  const headGeo = new RoundedBoxGeometry(0.011, 0.011, 0.009, 2, 0.0015);
  const hz = TAPE.z - 0.0045 - 0.0004;
  const heads = {};
  const one = (x, m, id) => {
    K.add(new THREE.BoxGeometry(0.015, TAPE.y - 0.0055 - BASE, 0.013), mat(0x8d9197, { metalness: 0.6, roughness: 0.4 }), [x, (TAPE.y - 0.0055 + BASE) / 2, hz - 0.001]);
    K.add(new THREE.BoxGeometry(0.0006, 0.007, 0.0004), ic, [x, TAPE.y, hz + 0.0047]);       // the gap
    const h = new THREE.Mesh(headGeo, m); h.position.set(x, TAPE.y, hz); h.castShadow = true; h.name = 'tape-head-' + id; group.add(h);
    heads[id] = h; return h;
  };
  one(HEADS.erase, mat(0x4a4d52, { metalness: 0.7, roughness: 0.35, emissive: 0x000000 }), 'erase');
  one(HEADS.rec, mat(0xc0c4c9, { metalness: 0.9, roughness: 0.2 }), 'rec');
  K.add(new THREE.BoxGeometry(0.0115, 0.002, 0.0094), copper, [HEADS.rec, TAPE.y + 0.003, hz]);   // the record head's copper band
  heads.play = HEADS.play.map((x, i) => one(x, mat(0xd6d9dd, { metalness: 0.9, roughness: 0.18, emissive: 0x000000 }), 'p' + (i + 1)));
  // the main board inside the loop: head amplifiers (ICs, caps, trimmers, resistors)
  const board = (x, z, w, d, n, seedv) => {
    K.add(new THREE.BoxGeometry(w, 0.0016, d), pcb, [x, BASE + 0.006, z]);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => K.add(new THREE.CylinderGeometry(0.002, 0.002, 0.005, 6), brass, [x + sx * (w / 2 - 0.004), BASE + 0.0025, z + sz * (d / 2 - 0.004)]));
    let s = seedv; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const top = BASE + 0.0068;
    for (let i = 0; i < n; i++) {
      const px = x + (r() - 0.5) * (w - 0.012), pz = z + (r() - 0.5) * (d - 0.012), k = r();
      if (k < 0.22) K.add(new THREE.BoxGeometry(0.01, 0.0035, 0.0065), ic, [px, top + 0.0018, pz], [0, Math.round(r()) * Math.PI / 2, 0]);
      else if (k < 0.45) { const h = 0.006 + r() * 0.007; K.add(new THREE.CylinderGeometry(0.0028, 0.0028, h, 12), r() < 0.5 ? capBlue : capBlk, [px, top + h / 2, pz]); }
      else if (k < 0.55) K.add(new THREE.BoxGeometry(0.006, 0.005, 0.006), trim, [px, top + 0.0025, pz]);
      else K.add(new THREE.CylinderGeometry(0.0011, 0.0011, 0.0065, 8), resistor, [px, top + 0.0012, pz], [0, 0, Math.PI / 2]);
    }
  };
  board(-0.005, -0.032, 0.13, 0.07, 34, 7);
  board(0.178, 0.0, 0.034, 0.2, 18, 19);               // the control board under the knobs
  // the terminal strip at the front, and the jack bracket on the left
  K.add(new THREE.BoxGeometry(0.1, 0.009, 0.012), white, [0.04, BASE + 0.0045, 0.118]);
  for (let i = 0; i < 8; i++) K.add(new THREE.CylinderGeometry(0.0022, 0.0022, 0.0012, 10), steel, [-0.005 + i * 0.0128, BASE + 0.0096, 0.118]);
  K.add(new THREE.BoxGeometry(0.07, 0.03, 0.0025), mat(0xb7bbc0, { metalness: 0.7, roughness: 0.35 }), [-0.15, BASE + 0.015, 0.138]);
  K.add(new THREE.BoxGeometry(0.07, 0.0025, 0.016), mat(0xb7bbc0, { metalness: 0.7, roughness: 0.35 }), [-0.15, BASE + 0.00125, 0.13]);
  const jacks = { in: V(-0.168, BASE + 0.016, 0.14), out: V(-0.132, BASE + 0.016, 0.14) };
  Object.values(jacks).forEach((p) => {
    K.add(new THREE.CylinderGeometry(0.0055, 0.0055, 0.003, 6), steel, [p.x, p.y, p.z + 0.0015], [Math.PI / 2, 0, 0]);
    K.add(new THREE.CylinderGeometry(0.0045, 0.0045, 0.014, 14), ic, [p.x, p.y, p.z - 0.0085], [Math.PI / 2, 0, 0]);
  });
  // the DC socket at the back left
  K.add(new THREE.BoxGeometry(0.012, 0.012, 0.014), ic, [-0.17, BASE + 0.006, -0.135]);
  // wires: heads to the board, board to the controls above, terminal strip to the board
  const colors = [0xc8302a, 0xe8c01e, 0x2f66c7, 0x2f9a4a, 0xf2f0ea, 0x1a1a1a, 0xe07a1f];
  const wm = colors.map((c) => mat(c, { roughness: 0.55 }));
  const all = [HEADS.erase, HEADS.rec, ...HEADS.play];
  all.forEach((x, i) => {
    K.add(cable([[x, TAPE.y + 0.002, hz - 0.0045], [x, TAPE.y + 0.004, hz - 0.012], [x * 0.7 - 0.005, BASE + 0.016, 0.0], [x * 0.55 - 0.005, BASE + 0.008, -0.004]], 0.0006, wm[i % 7], 16), wm[i % 7]);
  });
  for (let i = 0; i < 6; i++) {                        // board → the head switches on the top plate (over the tape)
    const x = -0.05 + i * 0.008;
    K.add(cable([[x, BASE + 0.008, -0.066], [x - 0.004, 0.075, -0.09], [x * 1.6, CASE.top - 0.004, -0.11]], 0.0006, wm[(i + 2) % 7], 14), wm[(i + 2) % 7]);
  }
  for (let i = 0; i < 4; i++) {                        // control board → the knobs
    const z = -0.04 + i * 0.03;
    K.add(cable([[0.163, BASE + 0.008, z], [0.155, 0.07, z + 0.004], [0.165, CASE.top - 0.004, z + 0.01]], 0.0006, wm[i % 7], 12), wm[i % 7]);
  }
  for (let i = 0; i < 5; i++) {                        // terminal strip → the main board, round the motor side
    const x = -0.005 + i * 0.0128 * 1.5;
    K.add(cable([[x, BASE + 0.009, 0.112], [x, BASE + 0.012, 0.1], [x - 0.004, TAPE.y + 0.012, TAPE.z], [x * 0.8, BASE + 0.012, 0.02], [x * 0.8, BASE + 0.008, 0.0]], 0.0006, wm[(i + 4) % 7], 18), wm[(i + 4) % 7]);
  }
  [[jacks.in, 0], [jacks.out, 1]].forEach(([p, i]) => K.add(cable([[p.x, p.y, p.z - 0.016], [p.x + 0.01, BASE + 0.012, 0.11], [-0.005 + i * 0.0128, BASE + 0.01, 0.118]], 0.0007, wm[i * 5], 14), wm[i * 5]));
  const meshes = K.build(group);
  return { meshes, spin, heads, jacks, flywheel: fly, capstan };
}

// ---- the card beside the device: Simon's text from his poster, shortened and translated
export const CARD = { x: -0.36, z: 0.04, w: 0.13, h: 0.17, tilt: 1.05 };
export function card(group) {
  const c = document.createElement('canvas'); c.width = 780; c.height = 1020;
  const g = c.getContext('2d');
  g.fillStyle = '#f6f3ec'; g.fillRect(0, 0, c.width, c.height);
  const font = 'system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
  const text = (s, x, y, size, weight = 400, color = '#1d1b18') => { g.font = `${weight} ${size}px ${font}`; g.fillStyle = color; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText(s, x, y); };
  const wrap = (s, x, y, size, maxW, lh, weight = 400) => {
    g.font = `${weight} ${size}px ${font}`;
    let line = '';
    s.split(' ').forEach((w) => { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW) { text(line, x, y, size, weight); y += lh; line = w; } else line = t; });
    if (line) { text(line, x, y, size, weight); y += lh; }
    return y;
  };
  text('TAPE DELAY PROTOTYPE', 52, 92, 40, 800);
  text('Simon Winkler', 52, 138, 28, 400, '#55504a');
  g.fillStyle = '#1d1b18'; g.fillRect(52, 162, 676, 3);
  let y = 214;
  CARD_TEXT.forEach(([head, body]) => {
    text(head.toUpperCase(), 52, y, 21, 700, '#6b655d'); y += 36;
    y = wrap(body, 52, y, 27, 676, 38) + 22;
  });
  text('Draft translation from the poster', 52, 988, 19, 500, '#8a847a');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const K = kit('tape-card');
  const holder = acrylic({ opacity: 0.3, depthWrite: true });
  const grp = new THREE.Group(); grp.position.set(CARD.x, 0, CARD.z); group.add(grp);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(CARD.w, CARD.h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.12 }));
  // a bent acrylic stand: the card leans back on it
  const lean = new THREE.Group(); lean.rotation.x = -(Math.PI / 2 - CARD.tilt); grp.add(lean);
  face.position.set(0, CARD.h / 2 + 0.006, 0.0012); lean.add(face);
  K.add(new THREE.BoxGeometry(CARD.w + 0.008, CARD.h + 0.006, 0.002), holder, [0, CARD.h / 2 + 0.004, 0]);
  const meshes = K.build(lean, false);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(CARD.w + 0.008, 0.002, 0.06), holder); foot.position.set(0, 0.001, -0.02); grp.add(foot);
  face.castShadow = true;
  return { meshes: [face, ...meshes, foot], face, group: grp };
}
const CARD_TEXT = [
  ['Origin', 'Made for the video installation “EPOCH” in the exhibition “LUCID DREAMS – STONE AGE”. The tape ran in a loop for two days without a break and changed through constant mechanical wear. Visitors could listen to it as a parallel layer of sound to the film.'],
  ['How it works', 'An experimental analogue tape echo: five playback heads make complex stereo echoes, and the motor speed changes the pitch. At its centre is the erase head that can be switched off, for dense, endlessly overlapping layers of sound (sound on sound).'],
  ['Design', 'The clear construction puts the technology on show. A deliberately DIY prototype: not a perfect studio tool but a “learning” instrument that uses the flaws of the analogue medium.'],
];
