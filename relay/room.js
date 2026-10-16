// Inside the relay station's hut: a small radio room (RELAY_PLAN phase R2), built here in code and
// loaded the first time someone goes in. After Smo's references: a pine desk against the wall where
// the antenna cables come in, a stack of vintage gear on it (a black receiver with a big tuning dial,
// a slide-rule scale and an S-meter; a grey transmitter on top; a speaker; a teal amplifier with two
// meters), a Morse key, a desk microphone with a coiled cable, headphones, a box of QSL cards, a map,
// a wooden wall clock, a band chart and a postcard pinned to the wall. A blue curtain by the window.
//
// Coordinates: the hut's own, with the page's axes (y up). The origin is the middle of the hut at the
// bottom of its walls; the desk stands against the -x wall (the tower side), the window is in the -z
// wall (the side the relay view looks at), the door in the +z wall. The hut in the model is a solid
// box of 3.4 × 2.6 × 2.4 m (3d/scripts/props.py, relay_station); this room fits just inside it.
import * as THREE from 'three';
import { kit, cable } from '../workshop/stations.js';

export const X0 = -1.64, X1 = 1.64, Z0 = -1.14, Z1 = 1.14, FL = 0.04, CE = 2.5;
export const WIN = { x0: -0.3, x1: 0.7, y0: 1.0, y1: 1.85 };          // the window opening in the -z wall
const DESK = 0.8;                                                      // desk top
export const BAND = { lo: 3.0, hi: 12.0, span: 1.5 };                 // MHz; `span` is what the scale window shows
// where the visitor sits, and what they look at (the receiver's dial); phones sit closer and a little
// to the right, so the Morse key, the card box and the moon-bounce postcard are in view too
export const VIEW = { at: [-1.2, 1.1, 0.02], atPhone: [-1.2, 1.02, -0.26], from: [1, 0.2, 0], size: 1.9, sizePhone: 1.25 };

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.userData.redraw = (fn) => { fn(g, w, h); t.needsUpdate = true; };
  return t;
}
function seeded(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
const FONT = '"Archivo", "Helvetica Neue", Arial, sans-serif';
function txt(g, s, x, y, size, color, { weight = 600, align = 'center', track = 0.08 } = {}) {
  g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle';
  if ('letterSpacing' in g) g.letterSpacing = (track * size).toFixed(1) + 'px';
  g.fillText(s, x, y);
}
function crackle(g, w, h, base, seed, k = 0.12) {                      // the wrinkled finish of old gear
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const r = seeded(seed);
  for (let i = 0; i < w * h / 90; i++) { g.fillStyle = r() < 0.5 ? `rgba(255,255,255,${k * r()})` : `rgba(0,0,0,${k * 1.6 * r()})`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 2); }
}
function meterFace(g, x, y, w, h, { label = 'S', scale = ['1', '3', '5', '7', '9', '+20', '+40'], red = 0.72 } = {}) {
  g.fillStyle = '#1a1a1a'; g.fillRect(x - 6, y - 6, w + 12, h + 12);
  const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, '#f6efd9'); gr.addColorStop(1, '#e2d6b4');
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  const cx = x + w / 2, cy = y + h * 0.92, r = h * 0.7;
  g.lineWidth = 2; g.strokeStyle = '#2a2622';
  g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2 - 0.9, -Math.PI / 2 + 0.9); g.stroke();
  g.strokeStyle = '#b3402d'; g.lineWidth = 4;
  g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2 - 0.9 + 1.8 * red, -Math.PI / 2 + 0.9); g.stroke();
  scale.forEach((s, i) => {
    const a = -Math.PI / 2 - 0.9 + 1.8 * i / (scale.length - 1);
    g.strokeStyle = '#2a2622'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.lineTo(cx + Math.cos(a) * (r + 9), cy + Math.sin(a) * (r + 9)); g.stroke();
    txt(g, s, cx + Math.cos(a) * (r + 22), cy + Math.sin(a) * (r + 22), Math.round(h * 0.11), i / (scale.length - 1) >= red ? '#b3402d' : '#2a2622', { weight: 600, track: 0 });
  });
  txt(g, label, cx, y + h * 0.62, Math.round(h * 0.13), '#2a2622', { weight: 700 });
}
function knobScale(g, x, y, r, labels, color = '#d8d2c4') {
  g.strokeStyle = color; g.lineWidth = 2.5;
  for (let i = 0; i < 11; i++) {
    const a = Math.PI * 0.75 + Math.PI * 1.5 * i / 10;
    g.beginPath(); g.moveTo(x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 1.2); g.lineTo(x + Math.cos(a) * r * (i % 5 ? 1.32 : 1.42), y + Math.sin(a) * r * (i % 5 ? 1.32 : 1.42)); g.stroke();
  }
  if (labels) txt(g, labels, x, y + r * 1.9, Math.max(14, r * 0.42), color, { weight: 600 });
}

export function buildRoom() {
  const root = new THREE.Group(); root.name = 'relay-room';
  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };
  const M = (o) => keep(new THREE.MeshStandardMaterial({ roughness: 0.75, ...o }));
  // textures: pine boards, painted plywood walls, floor planks
  const pine = keep(canvasTex(512, 256, (g, w, h) => {
    const r = seeded(3);
    g.fillStyle = '#d3a46b'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(${120 + r() * 40},${70 + r() * 30},30,${0.08 + r() * 0.12})`; g.lineWidth = 1 + r() * 2; const y = r() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 20, w * 0.7, y + (r() - 0.5) * 20, w, y + (r() - 0.5) * 10); g.stroke(); }
    for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(110,60,25,0.35)'; g.beginPath(); g.ellipse(r() * w, r() * h, 6 + r() * 6, 3 + r() * 3, 0, 0, Math.PI * 2); g.fill(); }
  }));
  const planks = keep(canvasTex(256, 512, (g, w, h) => {
    const r = seeded(9);
    for (let k = 0; k < 4; k++) { g.fillStyle = ['#7d5b3d', '#856143', '#76563a', '#80603f'][k]; g.fillRect(k * w / 4, 0, w / 4, h); }
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(40,25,10,${0.05 + r() * 0.1})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 10 + r() * 60); }
    g.fillStyle = 'rgba(25,15,5,0.6)'; for (let k = 0; k <= 4; k++) g.fillRect(k * w / 4 - 1, 0, 2, h);
  }));
  planks.wrapS = planks.wrapT = THREE.RepeatWrapping; planks.repeat.set(3, 1.5);
  const ply = keep(canvasTex(256, 256, (g, w, h) => {
    const r = seeded(21);
    g.fillStyle = '#e6dfd2'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(120,100,70,${r() * 0.05})`; g.fillRect(r() * w, r() * h, 2 + r() * 20, 1); }
  }));
  ply.wrapS = ply.wrapT = THREE.RepeatWrapping; ply.repeat.set(2, 2);
  const MAT = {
    wall: M({ color: 0xffffff, map: ply, roughness: 0.9 }),
    floor: M({ color: 0xffffff, map: planks, roughness: 0.85 }),
    pine: M({ color: 0xffffff, map: pine, roughness: 0.6 }),
    darkwood: M({ color: 0x6b4a30, roughness: 0.6 }),
    black: M({ color: 0x1c1b1a, roughness: 0.55 }),
    grey: M({ color: 0x7a7d78, roughness: 0.5, metalness: 0.2 }),
    beige: M({ color: 0xd8ccb0, roughness: 0.55 }),
    teal: M({ color: 0x3e8a84, roughness: 0.5 }),
    chrome: M({ color: 0xc9ccd0, roughness: 0.22, metalness: 0.85 }),
    brass: M({ color: 0xc1963e, roughness: 0.3, metalness: 0.8 }),
    rubber: M({ color: 0x141414, roughness: 0.8 }),
    cord: M({ color: 0x1e1e1e, roughness: 0.6 }),
    redcord: M({ color: 0x9c3326, roughness: 0.6 }),
    curtain: M({ color: 0x2f5878, roughness: 0.95, side: THREE.DoubleSide }),
    paper: M({ color: 0xf1ead8, roughness: 0.95 }),
    enamel: M({ color: 0x2f4f45, roughness: 0.4, side: THREE.DoubleSide }),
    red: M({ color: 0xb3302a, roughness: 0.45 }),
    glass: keep(new THREE.MeshStandardMaterial({ color: 0xcfe2ea, transparent: true, opacity: 0.12, roughness: 0.05, depthWrite: false })),
    bulb: M({ color: 0xfff0d0, emissive: 0xffd9a0, emissiveIntensity: 1.5 }),
  };
  const add = (geo, m, x, y, z, parent = root) => { keep(geo); const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
  const K = kit('relay-room');                                         // static parts: merged per material
  const kb = (w, h, d, x, y, z, m, rot) => K.add(new THREE.BoxGeometry(w, h, d), m, [x, y, z], rot);

  // ---- shell: four walls (the window wall with its opening), floor, ceiling
  const W = X1 - X0, D = Z1 - Z0, H = CE - FL;
  const floor = add(new THREE.PlaneGeometry(W, D), MAT.floor, 0, FL, 0); floor.rotation.x = -Math.PI / 2;
  const ceil = add(new THREE.PlaneGeometry(W, D), MAT.wall, 0, CE, 0); ceil.rotation.x = Math.PI / 2;
  const wallAt = (w, x, z, ry) => { const m = add(new THREE.PlaneGeometry(w, H), MAT.wall, x, FL + H / 2, z); m.rotation.y = ry; return m; };
  wallAt(D, X0, 0, Math.PI / 2); wallAt(D, X1, 0, -Math.PI / 2); wallAt(W, 0, Z1, Math.PI);
  const ws = new THREE.Shape([[X0, FL], [X1, FL], [X1, CE], [X0, CE]].map(([x, y]) => new THREE.Vector2(x, y)));
  ws.holes.push(new THREE.Path([[WIN.x0, WIN.y0], [WIN.x1, WIN.y0], [WIN.x1, WIN.y1], [WIN.x0, WIN.y1]].map(([x, y]) => new THREE.Vector2(x, y))));
  add(new THREE.ShapeGeometry(ws), MAT.wall, 0, 0, Z0);
  // skirting and the window: reveal, frame, cross bar, sill, glass
  kb(W, 0.08, 0.02, 0, FL + 0.04, Z1 - 0.01, MAT.darkwood); kb(0.02, 0.08, D, X0 + 0.01, FL + 0.04, 0, MAT.darkwood); kb(0.02, 0.08, D, X1 - 0.01, FL + 0.04, 0, MAT.darkwood);
  kb(W, 0.08, 0.02, 0, FL + 0.04, Z0 + 0.01, MAT.darkwood);
  const wx = (WIN.x0 + WIN.x1) / 2, wy = (WIN.y0 + WIN.y1) / 2, ww = WIN.x1 - WIN.x0, wh = WIN.y1 - WIN.y0;
  kb(ww, 0.01, 0.06, wx, WIN.y0, Z0 - 0.03, MAT.wall); kb(ww, 0.01, 0.06, wx, WIN.y1, Z0 - 0.03, MAT.wall);
  kb(0.01, wh, 0.06, WIN.x0, wy, Z0 - 0.03, MAT.wall); kb(0.01, wh, 0.06, WIN.x1, wy, Z0 - 0.03, MAT.wall);
  for (const [w, h, x, y] of [[ww, 0.05, wx, WIN.y0 + 0.025], [ww, 0.05, wx, WIN.y1 - 0.025], [0.05, wh, WIN.x0 + 0.025, wy], [0.05, wh, WIN.x1 - 0.025, wy], [0.03, wh, wx, wy], [ww, 0.03, wx, wy]]) kb(w, h, 0.04, x, y, Z0 - 0.04, MAT.darkwood);
  kb(ww + 0.12, 0.03, 0.12, wx, WIN.y0 - 0.015, Z0 + 0.04, MAT.darkwood);              // sill
  add(new THREE.PlaneGeometry(ww - 0.06, wh - 0.06), MAT.glass, wx, wy, Z0 - 0.045).renderOrder = 2;
  // curtain on a rod, gathered on the desk side
  kb(ww + 0.5, 0.015, 0.015, wx - 0.1, WIN.y1 + 0.1, Z0 + 0.07, MAT.chrome);
  {
    const cw = 0.34, ch = WIN.y1 + 0.1 - (WIN.y0 - 0.22), g = keep(new THREE.PlaneGeometry(cw, ch, 24, 1)), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) / cw * Math.PI * 7) * 0.025);
    g.computeVertexNormals();
    const c = new THREE.Mesh(g, MAT.curtain); c.position.set(WIN.x0 - 0.12, WIN.y1 + 0.1 - ch / 2, Z0 + 0.08); root.add(c);
  }
  // the door in the +z wall (the model's black door is outside, at x = +0.7)
  kb(0.9, 2.0, 0.04, 0.7, FL + 1.0, Z1 - 0.02, MAT.darkwood);
  for (const y of [0.55, 1.45]) kb(0.7, 0.62, 0.012, 0.7, FL + y, Z1 - 0.045, MAT.pine);
  K.add(new THREE.SphereGeometry(0.03, 12, 8), MAT.brass, [0.32, FL + 1.0, Z1 - 0.07]);
  // coat hook with an old field jacket
  kb(0.3, 0.04, 0.03, -0.35, 1.7, Z1 - 0.02, MAT.darkwood);
  { const jk = add(new THREE.CylinderGeometry(0.12, 0.2, 0.75, 10, 1, false, 0, Math.PI), M({ color: 0x5b6142, roughness: 0.95, side: THREE.DoubleSide }), -0.35, 1.3, Z1 - 0.03); jk.rotation.y = Math.PI / 2; }

  // ---- +x wall: a shelf of binders and spare parts, a small heater, an extinguisher
  kb(0.24, 0.025, 1.6, X1 - 0.12, 1.55, -0.1, MAT.pine);
  const bc = [0x2f4f8a, 0xb3402d, 0x2f6b4f, 0xd9b44a, 0x4a4a4a, 0x2f4f8a, 0x8a5a2f];
  bc.forEach((c, i) => kb(0.2, 0.3, 0.06, X1 - 0.13, 1.71, -0.8 + i * 0.075, M({ color: c, roughness: 0.7 })));
  kb(0.2, 0.16, 0.3, X1 - 0.13, 1.645, 0.3, MAT.grey); kb(0.2, 0.1, 0.26, X1 - 0.13, 1.6, 0.58, MAT.beige);
  for (let i = 0; i < 9; i++) kb(0.06, 0.42, 0.035, X1 - 0.06, FL + 0.32, -0.6 + i * 0.05, MAT.wall);   // radiator
  K.add(new THREE.CylinderGeometry(0.06, 0.06, 0.42, 14), MAT.red, [X1 - 0.12, FL + 0.21, 0.8]);
  K.add(new THREE.CylinderGeometry(0.015, 0.015, 0.06, 8), MAT.black, [X1 - 0.12, FL + 0.45, 0.8]);
  // a rag rug where the chair would stand
  { const rug = add(new THREE.PlaneGeometry(1.1, 1.4), M({ color: 0xffffff, roughness: 0.95, map: keep(canvasTex(128, 160, (g, w, h) => {
    const r = seeded(4); for (let y = 0; y < h; y += 4) { g.fillStyle = ['#7d3a2c', '#a4573a', '#3d4a5a', '#c9a46a', '#5c3a2c'][Math.floor(r() * 5)]; g.fillRect(0, y, w, 4); }
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
  })) }), -0.25, FL + 0.003, 0.05); rug.rotation.x = -Math.PI / 2; }
  // ceiling lamp: an enamel shade on a cord
  K.add(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 6), MAT.cord, [-0.55, CE - 0.11, 0]);
  K.add(new THREE.ConeGeometry(0.17, 0.12, 20, 1, true), MAT.enamel, [-0.55, CE - 0.27, 0]);
  K.add(new THREE.SphereGeometry(0.045, 12, 8), MAT.bulb, [-0.55, CE - 0.34, 0]);

  // ---- the desk: pine top on square legs, an apron, a drawer
  const dx0 = X0, dx1 = -0.9, dz = 1.02, dcx = (dx0 + dx1) / 2;
  kb(dx1 - dx0, 0.04, 2 * dz, dcx, DESK - 0.02, 0, MAT.pine);
  for (const [x, z] of [[dx0 + 0.05, -dz + 0.05], [dx0 + 0.05, dz - 0.05], [dx1 - 0.05, -dz + 0.05], [dx1 - 0.05, dz - 0.05]]) kb(0.06, DESK - 0.04 - FL, 0.06, x, (DESK - 0.04 + FL) / 2, z, MAT.pine);
  kb(0.02, 0.1, 2 * dz - 0.12, dx1 - 0.04, DESK - 0.09, 0, MAT.pine);
  kb(0.03, 0.09, 0.4, dx1 - 0.03, DESK - 0.09, -0.6, MAT.darkwood); K.add(new THREE.BoxGeometry(0.02, 0.015, 0.1), MAT.chrome, [dx1 - 0.01, DESK - 0.09, -0.6]);

  // ---- gear: boxes with drawn front panels (canvas), real knobs and needles where they move
  const faces = [];
  function face(w, h, px, x, y, z, draw, { emissive = 0.08 } = {}) {   // a front panel facing +x: canvas right = -z
    const t = keep(canvasTex(px, Math.round(px * h / w), draw));
    const m = M({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: emissive, roughness: 0.5 });
    const f = add(new THREE.PlaneGeometry(w, h), m, x, y, z); f.rotation.y = Math.PI / 2;
    f.userData.px = { W: px, H: Math.round(px * h / w), w, h };
    faces.push(f); return f;
  }
  const at = (f, u, v, off = 0, out = new THREE.Vector3()) => {         // canvas pixel on a face -> room coordinates
    const { W: pw, H: ph, w, h } = f.userData.px;
    return out.set(f.position.x + off, f.position.y + (0.5 - v / ph) * h, f.position.z - (u / pw - 0.5) * w);
  };
  const knobGeo = (r, d, n = 28) => keep(new THREE.CylinderGeometry(r, r * 1.04, d, n).rotateZ(Math.PI / 2).translate(d / 2, 0, 0));
  function knob(f, u, v, r, m = MAT.black, skirt = MAT.chrome) {        // a knob on a face; its group turns about x
    const g = new THREE.Group(); at(f, u, v, 0, g.position); root.add(g);
    g.add(new THREE.Mesh(knobGeo(r * 1.25, r * 0.18), skirt));
    const b = new THREE.Mesh(knobGeo(r, r * 0.75), m); g.add(b);
    const mark = new THREE.Mesh(keep(new THREE.BoxGeometry(0.002, r * 0.6, r * 0.12)), MAT.wall); mark.position.set(r * 0.76, r * 0.5, 0); g.add(mark);
    return g;
  }
  function needle(f, u, v, len, color = 0x1a1a1a) {                    // a meter needle pivoting on a face
    const g = new THREE.Group(); at(f, u, v, 0.003, g.position); root.add(g);
    const n = new THREE.Mesh(keep(new THREE.BoxGeometry(0.0015, len, 0.0015).translate(0, len / 2, 0)), M({ color, roughness: 0.5 })); g.add(n);
    return g;
  }

  // the receiver: black crackle, slide-rule dial across the top, S-meter, the big tuning knob
  const RX = { x: X0 + 0.04 + 0.2, y: DESK + 0.15, z: 0.02, w: 0.56, h: 0.3, d: 0.4 };
  kb(RX.d, RX.h, RX.w, RX.x, RX.y, RX.z, MAT.black);
  for (const s of [-1, 1]) kb(RX.d + 0.01, RX.h + 0.01, 0.012, RX.x, RX.y, RX.z + s * (RX.w / 2), MAT.grey);   // side cheeks
  const rxFace = face(RX.w, RX.h, 1024, RX.x + RX.d / 2 + 0.001, RX.y, RX.z, (g, w, h) => {
    crackle(g, w, h, '#1d1c1a', 7);
    g.strokeStyle = '#4a4740'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#9c9a94'; g.fillRect(50, 30, 750, 210);                         // the dial window's chrome bezel
    g.fillStyle = '#111'; g.fillRect(58, 38, 734, 194);
    meterFace(g, 830, 44, 160, 150, { label: 'S' });
    g.fillStyle = '#9c2a22'; g.fillRect(840, 228, 140, 40); txt(g, 'RS-1', 910, 249, 26, '#f3e9d2', { weight: 700 });
    knobScale(g, 420, 400, 100, null);
    txt(g, 'TUNING', 420, 530, 22, '#d8d2c4');
    knobScale(g, 160, 420, 42, 'VOLUME'); knobScale(g, 690, 420, 42, 'BAND'); knobScale(g, 860, 420, 34, 'MODE');
    g.fillStyle = '#b9bcc0'; g.beginPath(); g.arc(960, 480, 16, 0, Math.PI * 2); g.fill(); g.fillStyle = '#0d0d0d'; g.beginPath(); g.arc(960, 480, 8, 0, Math.PI * 2); g.fill();
    txt(g, 'PHONES', 960, 515, 14, '#d8d2c4');
  });
  rxFace.userData.pick = 'dial';
  // the slide-rule scale: a backlit strip that scrolls under a fixed red pointer
  const DIAL = { w: 0.4, h: 0.104 };
  const dialTex = keep(canvasTex(1024, 266, () => {}));
  const dialMat = M({ map: dialTex, emissive: 0xffffff, emissiveMap: dialTex, emissiveIntensity: 0.55, roughness: 0.35 });
  const dial = add(new THREE.PlaneGeometry(DIAL.w, DIAL.h), dialMat, 0, 0, 0); dial.rotation.y = Math.PI / 2;
  at(rxFace, 425, 135, 0.002, dial.position); dial.userData.pick = 'dial';
  let marks = [], eme = null, lastF = null;
  function drawDial(f) {
    dialTex.userData.redraw((g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f7dca2'); gr.addColorStop(0.5, '#fbe7bc'); gr.addColorStop(1, '#eccb86');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const pxPer = w / BAND.span, x = (fq) => w / 2 + (fq - f) * pxPer;
      const a = Math.max(BAND.lo, f - BAND.span), b = Math.min(BAND.hi, f + BAND.span);
      g.fillStyle = 'rgba(60,40,20,0.12)';                                  // the ends of the band
      if (x(BAND.lo) > 0) g.fillRect(0, 0, x(BAND.lo), h);
      if (x(BAND.hi) < w) g.fillRect(x(BAND.hi), 0, w - x(BAND.hi), h);
      g.strokeStyle = '#3a2a18'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(Math.max(0, x(BAND.lo)), h * 0.62); g.lineTo(Math.min(w, x(BAND.hi)), h * 0.62); g.stroke();
      for (let t = Math.ceil(a * 20) / 20; t <= b + 1e-6; t += 0.05) {
        const k = Math.round(t * 20), big = k % 5 === 0, xx = x(t);
        g.lineWidth = big ? 3 : 1.5;
        g.beginPath(); g.moveTo(xx, h * 0.62); g.lineTo(xx, h * (big ? 0.42 : 0.52)); g.stroke();
        if (big) txt(g, t.toFixed(2), xx, h * 0.28, 30, '#3a2a18', { weight: 600, track: 0.02 });
      }
      txt(g, 'MHz', 70, h * 0.84, 22, 'rgba(58,42,24,0.7)', { weight: 600 });
      marks.forEach((m) => {                                                // logged stations: an amber dot and the call sign
        const xx = x(m.f); if (xx < -60 || xx > w + 60) return;
        g.fillStyle = '#c4661f'; g.beginPath(); g.arc(xx, h * 0.72, 7, 0, Math.PI * 2); g.fill();
        txt(g, m.call, xx, h * 0.86, 19, '#8a3f12', { weight: 700, track: 0.04 });
      });
      if (eme) {                                                            // the moon-bounce channel: a small moon
        const xx = x(eme.f);
        if (xx > -40 && xx < w + 40) { g.fillStyle = '#5b5f6e'; g.beginPath(); g.arc(xx, h * 0.72, 10, 0, Math.PI * 2); g.fill(); g.fillStyle = '#f9e3b3'; g.beginPath(); g.arc(xx + 5, h * 0.7, 9, 0, Math.PI * 2); g.fill(); }
      }
      g.fillStyle = '#b81d12'; g.fillRect(w / 2 - 3, 0, 6, h);              // the pointer
      const sh = g.createLinearGradient(0, 0, w, 0);                        // curved glass: darker ends
      sh.addColorStop(0, 'rgba(40,25,10,0.45)'); sh.addColorStop(0.18, 'rgba(40,25,10,0)'); sh.addColorStop(0.82, 'rgba(40,25,10,0)'); sh.addColorStop(1, 'rgba(40,25,10,0.45)');
      g.fillStyle = sh; g.fillRect(0, 0, w, h);
    });
  }
  const tuneKnob = knob(rxFace, 420, 400, 0.05, MAT.black, MAT.chrome);
  tuneKnob.children.forEach((c) => { c.userData.pick = 'dial'; });
  { const dimple = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.009, 0.009, 0.006, 14).rotateZ(Math.PI / 2)), MAT.rubber); dimple.position.set(0.0395, 0.03, 0); tuneKnob.add(dimple); }
  const volKnob = knob(rxFace, 160, 420, 0.022); knob(rxFace, 690, 420, 0.022); knob(rxFace, 860, 420, 0.018);
  volKnob.rotation.x = -0.6;
  const sNeedle = needle(rxFace, 910, 182, 0.055);

  // the transmitter on top: grey hammertone, a plate meter, three knobs, a pilot lamp that lights while keying
  const TX = { x: X0 + 0.04 + 0.18, y: DESK + RX.h + 0.11, z: 0.0, w: 0.5, h: 0.22, d: 0.36 };
  kb(TX.d, TX.h, TX.w, TX.x, TX.y, TX.z, MAT.grey);
  const txFace = face(TX.w, TX.h, 1024, TX.x + TX.d / 2 + 0.001, TX.y, TX.z, (g, w, h) => {
    crackle(g, w, h, '#6f736e', 13, 0.1);
    g.strokeStyle = '#4b4e4a'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
    meterFace(g, 70, 50, 220, 170, { label: 'PLATE', scale: ['0', '100', '200', '300', '400'], red: 0.8 });
    txt(g, 'TRANSMITTER', 640, 60, 26, '#e9e5da', { weight: 700, track: 0.22 });
    knobScale(g, 470, 270, 52, 'DRIVE', '#e9e5da'); knobScale(g, 680, 270, 52, 'TUNE', '#e9e5da'); knobScale(g, 890, 270, 52, 'LOAD', '#e9e5da');
    g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(330, 330, 22, 0, Math.PI * 2); g.fill();
    txt(g, 'ON AIR', 330, 380, 15, '#e9e5da');
  });
  knob(txFace, 470, 270, 0.024, MAT.black, MAT.chrome); knob(txFace, 680, 270, 0.024, MAT.black, MAT.chrome); knob(txFace, 890, 270, 0.024, MAT.black, MAT.chrome);
  const tNeedle = needle(txFace, 180, 206, 0.055);
  const pilotMat = M({ color: 0x5a1a12, emissive: 0xff3a1a, emissiveIntensity: 0.05 });
  { const p = add(new THREE.SphereGeometry(0.008, 12, 8), pilotMat, 0, 0, 0); at(txFace, 330, 330, 0.002, p.position); }

  // speaker on the left, a small beige meter unit on it
  const SP = { x: X0 + 0.04 + 0.16, y: DESK + 0.15, z: 0.64, w: 0.34, h: 0.3, d: 0.32 };
  kb(SP.d, SP.h, SP.w, SP.x, SP.y, SP.z, MAT.black);
  face(SP.w, SP.h, 512, SP.x + SP.d / 2 + 0.001, SP.y, SP.z, (g, w, h) => {
    crackle(g, w, h, '#232220', 17);
    g.fillStyle = '#3b3833'; g.beginPath(); g.arc(w / 2, h / 2, h * 0.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#121110'; for (let y = h * 0.12; y < h * 0.9; y += 9) for (let x = w * 0.1; x < w * 0.9; x += 9) if (Math.hypot(x - w / 2, y - h / 2) < h * 0.38) { g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fill(); }
  });
  kb(0.24, 0.12, 0.24, X0 + 0.04 + 0.13, DESK + SP.h + 0.06, SP.z, MAT.beige);
  face(0.24, 0.12, 512, X0 + 0.04 + 0.25 + 0.001, DESK + SP.h + 0.06, SP.z, (g, w, h) => {
    crackle(g, w, h, '#d6c9ab', 23, 0.06);
    meterFace(g, 150, 30, 210, 160, { label: 'SWR', scale: ['1', '1.5', '2', '3', '∞'], red: 0.6 });
  });
  // teal amplifier on the right with two meters, a small power supply on top
  const AM = { x: X0 + 0.04 + 0.18, y: DESK + 0.13, z: -0.64, w: 0.42, h: 0.26, d: 0.36 };
  kb(AM.d, AM.h, AM.w, AM.x, AM.y, AM.z, MAT.beige);
  const amFace = face(AM.w, AM.h, 1024, AM.x + AM.d / 2 + 0.001, AM.y, AM.z, (g, w, h) => {
    crackle(g, w, h, '#3c8580', 29, 0.07);
    g.strokeStyle = '#2b605c'; g.lineWidth = 8; g.strokeRect(12, 12, w - 24, h - 24);
    meterFace(g, 560, 50, 180, 150, { label: 'GRID', scale: ['0', '50', '100'], red: 0.85 });
    meterFace(g, 780, 50, 180, 150, { label: 'PLATE', scale: ['0', '0.5', '1'], red: 0.85 });
    txt(g, 'LINEAR AMPLIFIER', 260, 90, 26, '#eaf2ee', { weight: 700, track: 0.14 });
    [[140, 'BAND'], [330, 'TUNE'], [520, 'LOAD'], [720, 'GAIN'], [880, 'POWER']].forEach(([u, l]) => knobScale(g, u, 420, u === 880 ? 34 : 56, l, '#eaf2ee'));
  });
  [[140, 0.028], [330, 0.028], [520, 0.028], [720, 0.02], [880, 0.017]].forEach(([u, r]) => knob(amFace, u, 420, r, MAT.black, MAT.wall));
  kb(0.22, 0.13, 0.26, X0 + 0.04 + 0.12, DESK + AM.h + 0.065, AM.z + 0.04, MAT.beige);
  face(0.26, 0.13, 512, X0 + 0.04 + 0.23 + 0.001, DESK + AM.h + 0.065, AM.z + 0.04, (g, w, h) => {
    crackle(g, w, h, '#d9ccad', 31, 0.06);
    meterFace(g, 40, 40, 200, 150, { label: 'VOLTS', scale: ['0', '5', '10', '15'], red: 0.9 });
    knobScale(g, 390, 130, 40, 'ADJ', '#2a2622');
  });

  // ---- the Morse key: brass lever on a wooden base, a black knob at the operator's end
  const KEY = { x: -1.0, z: -0.32 };
  kb(0.17, 0.02, 0.09, KEY.x, DESK + 0.01, KEY.z, MAT.darkwood);
  K.add(new THREE.CylinderGeometry(0.008, 0.008, 0.035, 10), MAT.brass, [KEY.x - 0.045, DESK + 0.037, KEY.z]);
  K.add(new THREE.CylinderGeometry(0.006, 0.006, 0.02, 10), MAT.brass, [KEY.x + 0.03, DESK + 0.03, KEY.z]);   // contact
  const lever = new THREE.Group(); lever.position.set(KEY.x - 0.045, DESK + 0.055, KEY.z); root.add(lever);
  const keyMeshes = [];
  { const bar = new THREE.Mesh(keep(new THREE.BoxGeometry(0.14, 0.008, 0.016).translate(0.06, 0, 0)), MAT.brass); lever.add(bar); keyMeshes.push(bar);
    const kn = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.019, 0.017, 0.012, 20)), MAT.black); kn.position.set(0.125, 0.01, 0); lever.add(kn); keyMeshes.push(kn);
    const sp = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.004, 0.004, 0.02, 8)), MAT.chrome); sp.position.set(0.03, -0.012, 0); lever.add(sp); }
  keyMeshes.forEach((m) => { m.userData.pick = 'key'; });
  const keyBase = new THREE.Mesh(keep(new THREE.BoxGeometry(0.2, 0.07, 0.12)), new THREE.MeshBasicMaterial({ visible: false }));   // a bigger target for fingers
  keyBase.position.set(KEY.x + 0.01, DESK + 0.035, KEY.z); keyBase.userData.pick = 'key'; root.add(keyBase); disposables.push(keyBase.material);

  // ---- desk microphone (chrome bullet on a stand) with a coiled cable, headphones, a mug
  const MIC = { x: -1.07, z: 0.38 };
  K.add(new THREE.CylinderGeometry(0.045, 0.055, 0.025, 24), MAT.black, [MIC.x, DESK + 0.0125, MIC.z]);
  K.add(new THREE.CylinderGeometry(0.007, 0.007, 0.12, 10), MAT.chrome, [MIC.x, DESK + 0.085, MIC.z]);
  K.add(new THREE.CapsuleGeometry(0.024, 0.07, 6, 16), MAT.chrome, [MIC.x + 0.015, DESK + 0.16, MIC.z], [0, 0, 1.25]);
  K.add(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 16), MAT.rubber, [MIC.x + 0.055, DESK + 0.175, MIC.z], [0, 0, 1.25]);
  {
    const pts = [], n = 260, a0 = new THREE.Vector3(MIC.x - 0.03, DESK + 0.012, MIC.z - 0.02), a1 = new THREE.Vector3(TX.x + TX.d / 2 - 0.05, DESK + 0.006, 0.18);
    for (let i = 0; i <= n; i++) {                                           // a coiled cord: a helix along a sagging line
      const t = i / n, p = a0.clone().lerp(a1, t); p.y += Math.sin(Math.PI * t) * 0.01;
      const ang = t * 46 * Math.PI, r = 0.009;
      pts.push([p.x + Math.cos(ang) * r * 0.3, p.y + 0.01 + Math.sin(ang) * r, p.z + Math.cos(ang) * r]);
    }
    K.add(keep(cable(pts, 0.0028, MAT.cord, 520)), MAT.cord);
  }
  // headphones lying on the desk
  { const hx = -1.02, hz = 0.78;
    K.add(new THREE.CylinderGeometry(0.042, 0.042, 0.03, 20), MAT.black, [hx - 0.02, DESK + 0.015, hz - 0.08]);
    K.add(new THREE.CylinderGeometry(0.042, 0.042, 0.03, 20), MAT.black, [hx + 0.02, DESK + 0.015, hz + 0.08]);
    K.add(new THREE.TorusGeometry(0.1, 0.008, 6, 24, Math.PI), MAT.grey, [hx, DESK + 0.025, hz], [-Math.PI / 2, 0, 1.85]); }
  K.add(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 18), M({ color: 0xe9e4d8, roughness: 0.4 }), [-0.98, DESK + 0.045, 0.93]);   // mug
  K.add(new THREE.TorusGeometry(0.022, 0.006, 6, 12), M({ color: 0xe9e4d8, roughness: 0.4 }), [-0.98, DESK + 0.05, 0.975], [0, Math.PI / 2, 0]);
  // a map on the desk, a pencil
  { const mp = add(new THREE.PlaneGeometry(0.21, 0.3), M({ map: keep(canvasTex(256, 360, (g, w, h) => drawMap(g, w, h, 5))), roughness: 0.9 }), -1.03, DESK + 0.002, 0.08); mp.rotation.set(-Math.PI / 2, 0, 0.08); }
  K.add(new THREE.CylinderGeometry(0.004, 0.004, 0.16, 6), M({ color: 0xd9a52a }), [-0.97, DESK + 0.006, -0.08], [Math.PI / 2, 0, 0.4]);
  // cables at the back: from the gear up to where the antenna feed comes through the wall
  const feed = [X0 + 0.02, 2.12, -0.4];
  kb(0.03, 0.14, 0.14, X0 + 0.015, feed[1], feed[2], MAT.grey);
  [[RX.z - 0.12, MAT.cord], [TX.z + 0.12, MAT.cord], [AM.z + 0.1, MAT.redcord], [SP.z - 0.1, MAT.cord]].forEach(([z, m], i) => {
    K.add(cable([[X0 + 0.03 + 0.01 * i, DESK + 0.03, z], [X0 + 0.03, DESK + 0.4, z * 0.6 + feed[2] * 0.4], [X0 + 0.035, 1.75, feed[2] + (i - 1.5) * 0.02], [X0 + 0.04, feed[1] - 0.03, feed[2] + (i - 1.5) * 0.02]], 0.007, m, 24), m);
  });
  K.add(cable([[KEY.x - 0.08, DESK + 0.01, KEY.z], [KEY.x - 0.15, DESK + 0.006, KEY.z + 0.05], [RX.x + RX.d / 2 - 0.02, DESK + 0.006, RX.z - 0.2]], 0.003, MAT.cord, 16), MAT.cord);

  // ---- the box of QSL cards: a little wooden index box; one card stands in it per station found
  const BOXP = { x: -1.02, z: -0.74 };
  const boxMeshes = [];
  { const g = new THREE.Group(); g.position.set(BOXP.x, DESK, BOXP.z); g.rotation.y = 0.12; root.add(g);
    const bm = MAT.darkwood;
    for (const [w, h, d, x, y, z] of [[0.17, 0.008, 0.12, 0, 0.004, 0], [0.17, 0.07, 0.008, 0, 0.035, -0.056], [0.17, 0.07, 0.008, 0, 0.035, 0.056], [0.008, 0.07, 0.12, -0.081, 0.035, 0], [0.008, 0.05, 0.12, 0.081, 0.025, 0]]) {
      const m = new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, d)), bm); m.position.set(x, y, z); g.add(m); boxMeshes.push(m);
    }
    const lab = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.06, 0.025)), M({ map: keep(canvasTex(128, 54, (c, w, h) => { c.fillStyle = '#f1ead8'; c.fillRect(0, 0, w, h); txt(c, 'QSL', w / 2, h / 2 + 2, 30, '#3a2a18', { weight: 700 }); })) }));
    lab.position.set(0.0855, 0.028, 0); lab.rotation.y = Math.PI / 2; g.add(lab); boxMeshes.push(lab);
    root.userData.boxGroup = g; }
  const cardGeo = keep(new THREE.BoxGeometry(0.004, 0.075, 0.1));
  const CARD_COLS = [0xf1ead8, 0xe8c66a, 0x9cc7c0, 0xe3a48d, 0xb9c6e6, 0xf3e1b5, 0xc8dca8, 0xe6b8d0];
  const cardMats = CARD_COLS.map((c) => M({ color: c, roughness: 0.9 }));
  const cards = [];
  for (let i = 0; i < 12; i++) {
    const c = new THREE.Mesh(cardGeo, cardMats[i % cardMats.length]); c.position.set(-0.07 + i * 0.012, 0.05, 0); c.rotation.z = -0.12; c.visible = false;
    root.userData.boxGroup.add(c); cards.push(c); boxMeshes.push(c);
  }
  boxMeshes.forEach((m) => { m.userData.pick = 'box'; });

  // ---- wall: the clock, a map, the band chart, and the moon-bounce postcard
  const wall = (w, h, z, y, tex, pick) => { const m = add(new THREE.PlaneGeometry(w, h), M({ map: tex, roughness: 0.9 }), X0 + 0.004, y, z); m.rotation.y = Math.PI / 2; if (pick) m.userData.pick = pick; return m; };
  wall(0.54, 0.36, 0.6, 1.66, keep(canvasTex(540, 360, (g, w, h) => drawMap(g, w, h, 2, true))));
  wall(0.2, 0.28, -0.3, 1.64, keep(canvasTex(200, 280, (g, w, h) => {
    g.fillStyle = '#efd25a'; g.fillRect(0, 0, w, h);
    txt(g, 'BAND PLAN', w / 2, 22, 17, '#2a2418', { weight: 800, track: 0.12 });
    const r = seeded(77);
    for (let y = 44; y < h - 12; y += 11) { g.fillStyle = `rgba(42,36,24,${0.35 + r() * 0.4})`; g.fillRect(12, y, 30 + r() * 40, 4); g.fillRect(96, y, 20 + r() * 70, 4); if (r() < 0.25) { g.fillStyle = 'rgba(179,64,45,0.75)'; g.fillRect(12, y, w - 24, 4); } }
  })));
  const hintTex = keep(canvasTex(320, 220, (g, w, h) => {
    g.fillStyle = '#f6efdf'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#20263a'; g.beginPath(); g.arc(w - 64, 70, 40, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f2ddb0'; g.beginPath(); g.arc(w - 54, 64, 36, 0, Math.PI * 2); g.fill();
    txt(g, 'MOON', 26, 48, 34, '#20263a', { weight: 800, align: 'left', track: 0.1 });
    txt(g, 'BOUNCE', 26, 86, 34, '#20263a', { weight: 800, align: 'left', track: 0.1 });
    txt(g, 'EARTH – MOON – EARTH', 26, 130, 16, '#b3402d', { weight: 700, align: 'left' });
    txt(g, '7.05 MHz · telescope on a moon', 26, 162, 17, '#20263a', { weight: 500, align: 'left', track: 0.02 });
    txt(g, 'key it · wait for the echo', 26, 190, 17, '#20263a', { weight: 500, align: 'left', track: 0.02 });
  }));
  const hint = wall(0.17, 0.117, -0.66, 1.6, hintTex, 'hint'); hint.rotation.z = 0.05;
  K.add(new THREE.SphereGeometry(0.008, 8, 6), MAT.red, [X0 + 0.01, 1.65, -0.66]);
  // the clock: a wooden ring, a printed face, three hands that keep the station's time
  const CL = { y: 1.92, z: 0.02, r: 0.15 };
  K.add(new THREE.CylinderGeometry(CL.r + 0.015, CL.r + 0.015, 0.035, 40), MAT.pine, [X0 + 0.018, CL.y, CL.z], [0, 0, Math.PI / 2]);
  wall(2 * CL.r, 2 * CL.r, CL.z, CL.y, keep(canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c39058'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2e9d6'; g.beginPath(); g.arc(w / 2, h / 2, w * 0.47, 0, Math.PI * 2); g.fill();
    for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI * 2 - Math.PI / 2; txt(g, String(i), w / 2 + Math.cos(a) * w * 0.37, h / 2 + Math.sin(a) * h * 0.37 + 2, 26, '#3a2a18', { weight: 600, track: 0 }); }
  }))).position.x = X0 + 0.037;
  const hand = (len, wd, m, z) => { const g = new THREE.Group(); g.position.set(X0 + 0.04 + z, CL.y, CL.z); root.add(g); g.add(new THREE.Mesh(keep(new THREE.BoxGeometry(0.002, len, wd).translate(0, len / 2 - 0.015, 0)), m)); return g; };
  const hH = hand(0.085, 0.009, MAT.black, 0.002), hM = hand(0.12, 0.006, MAT.black, 0.004), hS = hand(0.13, 0.002, MAT.red, 0.006);

  K.build(root, false);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  // ---- light: a warm lamp from the ceiling and the dial's glow; brighter at night
  const lamp = new THREE.PointLight(0xffd2a0, 0, 5.5, 1.5); lamp.position.set(-0.55, CE - 0.4, 0); root.add(lamp);
  const glow = new THREE.PointLight(0xffb347, 0, 1.6, 2); glow.position.set(RX.x + RX.d / 2 + 0.45, RX.y - 0.05, RX.z); root.add(glow);

  // ---- picking: every clickable mesh carries userData.pick ('dial' | 'key' | 'box' | 'hint')
  const picks = []; root.traverse((o) => { if (o.isMesh && o.userData.pick) picks.push(o); });
  const glowMats = { dial: [rxFace.material], key: [MAT.brass], box: [MAT.darkwood], hint: [hint.material] };
  const v = new THREE.Vector3();

  return {
    root, picks, glowMats,
    // the tuning knob's centre (room coordinates) and the dial window, for the pointer
    knobAt: (out) => out.copy(tuneKnob.position),
    knobR: 0.05,
    dialMesh: dial,
    setFreq(f) {                                                     // the scale scrolls; the knob turns with it (one turn = 1.5 MHz)
      if (lastF !== null && Math.abs(f - lastF) < 0.0004) return;
      lastF = f; drawDial(f);
      tuneKnob.rotation.x = -(f - BAND.lo) / BAND.span * Math.PI * 2;
    },
    setMarks(list, emeMark) { marks = list; eme = emeMark; lastF = null; },
    setMeter(s) { sNeedle.rotation.x = 0.85 - 1.7 * Math.max(0, Math.min(1, s)); },      // left (+z) to right (-z) in the face's plane
    setKey(down, tx) {                                               // the lever goes down; the transmitter's lamp and needle answer
      lever.rotation.z = down ? -0.07 : 0;
      pilotMat.emissiveIntensity = tx ? 2.4 : 0.05;
      tNeedle.rotation.x = 0.85 - 1.7 * (tx ? 0.72 : 0.04);
    },
    setCards(n) { cards.forEach((c, i) => { c.visible = i < n; }); },
    setClock(hours) {                                                // 0..24, the station's time of day
      const h = hours % 12, m = (hours * 60) % 60, s = (hours * 3600) % 60;
      hH.rotation.x = -h / 12 * Math.PI * 2; hM.rotation.x = -m / 60 * Math.PI * 2; hS.rotation.x = -Math.floor(s) / 60 * Math.PI * 2;
    },
    setLight(night, signal = 0) {                                    // night 0..1
      lamp.intensity = 0.8 + 3.2 * night; glow.intensity = (0.04 + 0.4 * night) * (1 + 0.6 * signal);
      dialMat.emissiveIntensity = 0.45 + 0.35 * night + 0.2 * signal;
    },
    pickAt: (o) => o && o.userData.pick,
    dispose() {
      root.removeFromParent();
      disposables.forEach((d) => d.dispose && d.dispose());
      root.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
    },
    v,
  };
}

// a made-up map: coastlines from a few noisy blobs, a grid, a route in red (no real places)
function drawMap(g, w, h, seed, wallMap) {
  const r = seeded(seed);
  g.fillStyle = wallMap ? '#cfe0e3' : '#d9e6e2'; g.fillRect(0, 0, w, h);
  for (let k = 0; k < (wallMap ? 6 : 3); k++) {
    const cx = r() * w, cy = r() * h, R = (0.12 + r() * 0.2) * Math.min(w, h) * (wallMap ? 1.1 : 1.4);
    g.fillStyle = ['#e7d9b0', '#d8cf9e', '#e2cfa4'][k % 3]; g.beginPath();
    for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2, rr = R * (0.7 + 0.3 * Math.sin(a * 3 + k) + 0.15 * (r() - 0.5)); g.lineTo(cx + Math.cos(a) * rr * 1.3, cy + Math.sin(a) * rr); }
    g.closePath(); g.fill(); g.strokeStyle = 'rgba(80,90,80,0.5)'; g.lineWidth = 1.5; g.stroke();
  }
  g.strokeStyle = 'rgba(40,70,90,0.22)'; g.lineWidth = 1;
  for (let x = 0; x < w; x += w / 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = 0; y < h; y += h / 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.strokeStyle = 'rgba(179,64,45,0.8)'; g.lineWidth = 2; g.setLineDash([6, 4]); g.beginPath();
  for (let i = 0; i < 5; i++) g.lineTo(w * (0.15 + 0.17 * i), h * (0.3 + 0.4 * r())); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#b3402d'; g.beginPath(); g.arc(w * 0.15, h * 0.5, 4, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(30,30,30,0.6)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
}
