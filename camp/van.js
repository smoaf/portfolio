// Inside the camp van: a lightweight procedural interior, loaded the first time someone gets in.
// After Smo's references (night run 06): a working research van in grey and silver panels, amber-orange
// leather seats on graphite pedestals, warm amber ceiling lights and teal accents on the displays.
// The van drives itself, so there is no steering wheel: in its place stands the screen, which is the
// start menu (a vintage amber terminal). A photo album lies on the fold-out table with loose polaroids
// on top of it, and the camera (long lens with hood, on a small tripod) stands at the table's edge.
// The back is fitted out as one plan: light grey built-in cabinets round the walls, a desk niche with
// small screens, papers and a laptop on the right, and a blue swivel seat in front of it.
//
// Coordinates are the van's own, as in 3d/scripts/vehicle.py: x forward, y to the left, z up, the
// ground at z = 0, the body floor at z = 0.95. The page places the group on the van in the model.
import * as THREE from 'three';
import { summary } from '../safari/fieldlog.js';

// `ready` says whether the route has its terrain yet; the screen shows COMING SOON for the others.
export const ROUTES = [
  { id: 'canyon', name: 'CANYON', line: 'RIVER · CLIFF PATH · DEEP POOL', ready: true },
  { id: 'jungle', name: 'JUNGLE', line: 'CANOPY · BRACKISH RIVER CROSSING', ready: true },
];
export const VIEWS = {
  seat: { eye: [-0.95, 0.0, 2.42], look: [1.35, 0.12, 2.08] },     // on the rear bench, looking forward
  album: { eye: [-0.1, 0.02, 2.4], look: [0.2, 0.0, 1.76] },        // above the table
};

const FLOOR = 1.0, ROOF = 2.98, HALF = 0.97;
function seeded(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

export function buildVanInterior({ polaroids = [], timeOfDay = () => 'day', onRoute = () => {} } = {}) {
  const root = new THREE.Group();
  root.name = 'van-interior';
  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };
  const mat = (o) => keep(new THREE.MeshStandardMaterial({ roughness: 0.8, ...o }));
  // textures: stitched leather for the seats, ribbed rubber mat, grey ceiling panels, clear tape
  const leatherTex = keep(canvasTex(256, 256, (g, w, h) => {
    const r = seeded(11);
    g.fillStyle = '#c98734'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 900; k++) { g.fillStyle = r() < 0.5 ? 'rgba(255,230,190,0.05)' : 'rgba(90,40,0,0.06)'; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 2); }
    // three padded channels with a seam and a row of stitches beside each seam, a welt round the edge
    for (const x of [w / 3, 2 * w / 3]) {
      g.fillStyle = 'rgba(80,36,0,0.45)'; g.fillRect(x - 2, 0, 4, h);
      g.fillStyle = 'rgba(255,214,160,0.18)'; g.fillRect(x - 10, 0, 6, h); g.fillRect(x + 4, 0, 6, h);
      g.fillStyle = 'rgba(255,236,200,0.75)'; for (let y = 3; y < h; y += 9) { g.fillRect(x - 8, y, 2, 5); g.fillRect(x + 6, y, 2, 5); }
    }
    g.strokeStyle = 'rgba(70,30,0,0.5)'; g.lineWidth = 5; g.strokeRect(2, 2, w - 4, h - 4);
    g.fillStyle = 'rgba(255,236,200,0.7)'; for (let x = 12; x < w - 12; x += 9) { g.fillRect(x, 10, 5, 2); g.fillRect(x, h - 12, 5, 2); }
  }));
  const rubber = keep(canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#3b3f43'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2b2e32'; for (let k = 0; k < 8; k++) { g.fillRect(k * 16 + 2, 0, 3, h); g.fillRect(0, k * 16 + 2, w, 3); }
  }, [8, 4]));
  const panels = keep(canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#9ba1a7'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(40,45,50,0.35)'; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 3, w, 2); g.fillRect(3, 0, 2, h);
    g.fillStyle = 'rgba(40,45,50,0.4)'; for (const [x, y] of [[14, 14], [w - 18, 14], [14, h - 18], [w - 18, h - 18]]) g.fillRect(x, y, 4, 4);   // screws
  }, [4, 2]));
  // clear tape: mostly see-through, the edges a little denser, the short ends torn
  const tapeTex = keep(canvasTex(128, 32, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(4, 0, w - 8, h);
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(4, 0, w - 8, 2); g.fillRect(4, h - 2, w - 8, 2);
    g.fillStyle = 'rgba(255,255,255,0.3)'; for (let y = 0; y < h; y += 4) { g.fillRect(y % 8 ? 1 : 3, y, 3, 3); g.fillRect(w - (y % 8 ? 4 : 6), y, 3, 3); }
  }));
  const M = {
    paint: mat({ color: 0x80878e, roughness: 0.5, metalness: 0.25 }),          // walls and pillars: silver grey
    trim: mat({ color: 0xaab0b6, roughness: 0.6 }),                           // lower linings: light grey
    dash: mat({ color: 0x3a3f45, roughness: 0.7 }),
    plastic: mat({ color: 0x555b62, roughness: 0.6 }),
    pedestal: mat({ color: 0x33373c, roughness: 0.55, metalness: 0.3 }),
    floor: mat({ color: 0xffffff, map: rubber, roughness: 0.95 }),
    ceiling: mat({ color: 0xffffff, map: panels, roughness: 0.7 }),
    fabric: mat({ color: 0xffffff, map: leatherTex, roughness: 0.5 }),       // the seats: amber-orange leather
    vinyl: mat({ color: 0x2b2f34, roughness: 0.55 }),
    wood: mat({ color: 0xc6cacd, roughness: 0.45 }),                          // table top: light grey laminate
    metal: mat({ color: 0xc3c7cb, roughness: 0.3, metalness: 0.7 }),
    cab: mat({ color: 0xd5d8db, roughness: 0.55 }),                           // built-ins in the back
    front: mat({ color: 0xc8ccd0, roughness: 0.5 }),
    case: mat({ color: 0x4e545b, roughness: 0.55 }),
    amber: mat({ color: 0xd88a2a, roughness: 0.45 }),
    blue: mat({ color: 0x2c5fb4, roughness: 0.55 }),
    black: mat({ color: 0x141619, roughness: 0.5 }),
    grip: mat({ color: 0x202226, roughness: 0.9 }),
    paper: mat({ color: 0xf1ede4, roughness: 0.95 }),
    red: mat({ color: 0xa8382c, roughness: 0.45 }),
    lamp: mat({ color: 0x2a2015, emissive: 0xffb04a, emissiveIntensity: 1.2 }),
    teal: mat({ color: 0x0b1d1d, emissive: 0x3fe0cf, emissiveIntensity: 1.1 }),
    led: [0x3ff0dc, 0xffb347, 0x4cc9ff, 0xb4fff2].map((c) => mat({ color: 0x111111, emissive: c, emissiveIntensity: 2.2 })),
  };
  const tapeM = () => keep(new THREE.MeshStandardMaterial({ map: tapeTex, transparent: true, depthWrite: false, roughness: 0.12, metalness: 0, color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -2 }));
  // one unit box and a few cylinders shared by every part: light on phones
  const unit = keep(new THREE.BoxGeometry(1, 1, 1));
  const cyls = new Map();
  const cylGeo = (rt, rb, h, seg = 16, open = false) => {
    const k = [rt, rb, h, seg, open].join();
    if (!cyls.has(k)) cyls.set(k, keep(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open)));
    return cyls.get(k);
  };
  const add = (geo, m, x, y, z, parent = root) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
  const box = (w, d, h, x, y, z, m, parent) => { const o = add(unit, m, x, y, z, parent); o.scale.set(w, d, h); return o; };
  // a cylinder along x, y or z
  const cyl = (r, len, axis, x, y, z, m, parent, seg = 16) => {
    const o = add(cylGeo(r, r, len, seg), m, x, y, z, parent);
    if (axis === 'x') o.rotation.z = Math.PI / 2; else if (axis === 'z') o.rotation.x = Math.PI / 2;
    return o;
  };
  // a box between two corners (min, max): the back is planned in these
  const span = (x0, x1, y0, y1, z0, z1, m, parent) => box(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, m, parent);

  // --- shell: floor, side walls with the window openings, ceiling, rear wall, windscreen pillars
  box(4.78, 2 * HALF, 0.04, -0.11, 0, FLOOR - 0.02, M.floor);
  const side = new THREE.Shape([[-2.5, FLOOR], [2.28, FLOOR], [2.28, 1.72], [1.98, 1.96], [1.56, ROOF - 0.01], [0.85, ROOF], [-2.5, ROOF]].map(([x, z]) => new THREE.Vector2(x, z)));
  const hole = (x0, x1, z0, z1) => side.holes.push(new THREE.Path([new THREE.Vector2(x0, z0), new THREE.Vector2(x1, z0), new THREE.Vector2(x1, z1), new THREE.Vector2(x0, z1)]));
  hole(0.92, 1.64, 2.07, 2.77); hole(-1.2, -0.3, 2.19, 2.81); hole(-2.275, -1.625, 2.19, 2.81);
  const sideGeo = keep(new THREE.ShapeGeometry(side)); sideGeo.rotateX(Math.PI / 2);
  const wallM = M.paint.clone(); keep(wallM); wallM.side = THREE.DoubleSide;
  for (const s of [-1, 1]) { const w = new THREE.Mesh(sideGeo, wallM); w.position.y = s * HALF; root.add(w); }
  // lower door and wall panels in light grey linings
  for (const s of [-1, 1]) {
    box(1.25, 0.03, 0.75, 1.25, s * (HALF - 0.03), 1.55, M.trim);
    box(3.2, 0.03, 0.95, -0.95, s * (HALF - 0.03), 1.55, M.trim);
    box(0.08, 0.06, 0.62, 0.82, s * (HALF - 0.04), 2.48, M.paint);           // B-pillar edge
  }
  box(4.1, 2 * HALF, 0.03, -0.45, 0, ROOF, M.ceiling);
  const rear = new THREE.Shape([[-HALF, FLOOR], [HALF, FLOOR], [HALF, ROOF], [-HALF, ROOF]].map(([y, z]) => new THREE.Vector2(y, z)));
  for (const s of [-1, 1]) rear.holes.push(new THREE.Path([[0.095, 2.14], [0.845, 2.14], [0.845, 2.76], [0.095, 2.76]].map(([y, z]) => new THREE.Vector2(s > 0 ? y : -y, z))));
  const rearGeo = keep(new THREE.ShapeGeometry(rear)); rearGeo.rotateX(Math.PI / 2); rearGeo.rotateZ(Math.PI / 2);
  const rw = new THREE.Mesh(rearGeo, wallM); rw.position.x = -2.48; root.add(rw);
  for (const s of [-1, 1]) {                                                   // A-pillars along the raked windscreen
    const a = new THREE.Vector3(1.98, s * (HALF - 0.04), 1.96), b = new THREE.Vector3(1.56, s * (HALF - 0.04), 2.97);
    const p = add(cylGeo(0.045, 0.045, a.distanceTo(b), 8), M.paint, (a.x + b.x) / 2, a.y, (a.z + b.z) / 2);
    p.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  }
  box(0.06, 2 * HALF, 0.07, 1.57, 0, 2.95, M.paint);                           // header above the windscreen
  box(0.2, 0.32, 0.03, 1.4, 0.48, 2.93, M.trim).rotation.y = -0.25;            // sun visors
  box(0.2, 0.32, 0.03, 1.4, -0.48, 2.93, M.trim).rotation.y = -0.25;
  box(0.04, 0.24, 0.07, 1.52, 0, 2.88, M.black);                               // rear-view mirror
  // warm amber ceiling lights in silver frames: two over the cab, two along the back
  for (const [x, y] of [[1.15, 0.42], [1.15, -0.42], [-0.45, 0], [-1.75, 0]]) {
    box(0.4, 0.26, 0.025, x, y, ROOF - 0.02, M.metal);
    box(0.34, 0.2, 0.02, x, y, ROOF - 0.035, M.lamp);
  }

  // --- dashboard: graphite, louvred vents, a switch panel, a small teal display on the passenger side
  box(0.42, 2 * HALF, 0.3, 1.82, 0, 1.97, M.dash);
  box(0.3, 2 * HALF, 0.9, 2.12, 0, 1.45, M.dash);
  box(0.05, 0.62, 0.2, 1.6, 0.48, 1.98, M.black);                              // where the gauges were
  box(0.03, 0.55, 0.16, 1.6, -0.5, 1.96, M.plastic);                           // glovebox
  box(0.012, 0.12, 0.02, 1.583, -0.5, 2.0, M.metal);                           // its latch
  for (const y of [0.88, -0.88, 0.15, -0.15]) {                                // vents: a frame and three slats
    box(0.03, 0.15, 0.08, 1.6, y, 2.04, M.black);
    for (let k = -1; k <= 1; k++) box(0.012, 0.13, 0.008, 1.585, y, 2.04 + k * 0.022, M.metal).rotation.y = 0.35;
  }
  // centre console between the seats (a tall engine hump), with a switch panel on its upper block
  box(0.6, 0.42, 0.5, 1.4, 0, FLOOR + 0.25, M.plastic);
  box(0.26, 0.36, 0.28, 1.6, 0, 1.62, M.dash);
  box(0.01, 0.3, 0.2, 1.466, 0, 1.62, M.vinyl);
  for (let k = 0; k < 5; k++) {                                                // toggle switches with silver levers
    const y = -0.1 + k * 0.05;
    cyl(0.009, 0.02, 'x', 1.458, y, 1.58, M.metal, root, 8);
    box(0.03, 0.006, 0.006, 1.445, y, 1.585, M.metal).rotation.y = -0.5;
  }
  box(0.006, 0.2, 0.05, 1.459, 0, 1.67, M.teal);                               // a strip display above them
  box(0.01, 1.7, 0.012, 1.605, 0, 2.115, M.led[0]);                            // teal line along the dash
  const leds = [];
  for (let k = 0; k < 8; k++) leds.push(box(0.012, 0.018, 0.012, 1.6, -0.08 + k * 0.022, 1.86, M.led[k % 4]));
  // passenger display standing on the dash: a bezel and a teal readout
  const dispTex = keep(canvasTex(256, 160, (g, w, h) => {
    g.fillStyle = '#051312'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(80,240,220,0.25)'; g.lineWidth = 1;
    for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.strokeStyle = '#5ff5e0'; g.lineWidth = 3; g.beginPath();
    for (let x = 0; x <= w; x += 4) g.lineTo(x, h * 0.55 + Math.sin(x * 0.05) * 22 + Math.sin(x * 0.17) * 7);
    g.stroke();
    g.fillStyle = '#5ff5e0'; g.font = '600 18px ui-monospace, monospace'; g.fillText('TERRAIN  0.42', 12, 24); g.fillText('HDG 214', w - 92, h - 12);
  }));
  const disp = new THREE.Group(); disp.position.set(1.7, -0.5, 2.23); disp.rotation.y = 0.3; root.add(disp);
  box(0.03, 0.32, 0.2, 0.012, 0, 0, M.black, disp);
  const dispGeo = keep(new THREE.PlaneGeometry(0.29, 0.17)); dispGeo.rotateY(-Math.PI / 2); dispGeo.rotateX(Math.PI / 2);
  add(dispGeo, keep(new THREE.MeshBasicMaterial({ map: dispTex, toneMapped: false })), -0.004, 0, 0, disp);
  box(0.06, 0.08, 0.1, 0.03, 0, -0.1, M.dash, disp);                           // its foot
  // everyday things: a mug on the console, a notebook and pen on the dash
  const mugM = mat({ color: 0x2f7f86, roughness: 0.4 });
  add(cylGeo(0.036, 0.032, 0.09), mugM, 1.56, 0.1, 1.805).rotation.x = Math.PI / 2;
  add(keep(new THREE.TorusGeometry(0.022, 0.006, 6, 12)), mugM, 1.56, 0.146, 1.805).rotation.y = Math.PI / 2;
  box(0.16, 0.22, 0.012, 1.74, -0.12, 2.126, M.amber).rotation.z = 0.25;
  box(0.15, 0.2, 0.008, 1.742, -0.118, 2.134, M.paper).rotation.z = 0.25;
  cyl(0.005, 0.14, 'y', 1.72, -0.1, 2.142, M.black, root, 6).rotation.z = -0.3;

  // --- door panels: an armrest, a pull handle, a pocket and a speaker grille on each front door
  for (const s of [-1, 1]) {
    const y = s * (HALF - 0.05);
    box(0.5, 0.07, 0.045, 1.22, y, 1.8, M.vinyl);
    box(0.5, 0.06, 0.012, 1.22, y - s * 0.004, 1.826, M.fabric);
    box(0.12, 0.03, 0.025, 1.55, s * (HALF - 0.045), 1.88, M.metal);
    box(0.55, 0.05, 0.14, 1.25, y + s * 0.005, 1.33, M.plastic);
    cyl(0.055, 0.012, 'y', 0.9, s * (HALF - 0.04), 1.3, M.plastic, root, 20);
  }

  // --- front seats: amber-orange stitched leather on graphite pedestals (their shape as before)
  const seat = (y) => {
    const g = new THREE.Group(); g.position.set(1.18, y, FLOOR); root.add(g);
    box(0.44, 0.5, 0.45, 0, 0, 0.225, M.pedestal, g);
    box(0.5, 0.56, 0.13, 0.02, 0, 0.51, M.fabric, g);
    const back = box(0.13, 0.54, 0.6, -0.24, 0, 0.86, M.fabric, g); back.rotation.y = -0.12;
    box(0.5, 0.58, 0.035, 0.02, 0, 0.44, M.vinyl, g);
    return g;
  };
  seat(0.52); seat(-0.52);

  // --- the screen, where the steering wheel would be: a stalk from the dash and a tilted panel
  const S = { w: 0.6, h: 0.38, c: new THREE.Vector3(1.5, 0.5, 2.36) };
  const stalk = add(cylGeo(0.035, 0.035, 0.34, 10), M.metal, 1.64, 0.5, 2.14);
  stalk.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-0.22, 0, 0.25).normalize());
  const scr = new THREE.Group(); scr.position.copy(S.c); root.add(scr);
  scr.rotation.y = 0.18;                                                     // faces back (-x), leans back a little
  const bezel = box(0.05, S.w + 0.06, S.h + 0.06, 0.03, 0, 0, M.black, scr);
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = Math.round(1024 * S.h / S.w);
  const ctx = canvas.getContext('2d');
  const screenTex = keep(new THREE.CanvasTexture(canvas)); screenTex.colorSpace = THREE.SRGBColorSpace; screenTex.anisotropy = 4;
  const faceGeo = keep(new THREE.PlaneGeometry(S.w, S.h));
  faceGeo.rotateY(-Math.PI / 2); faceGeo.rotateX(Math.PI / 2);                // the plane faces -x, its up is +z
  const face = new THREE.Mesh(faceGeo, keep(new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false })));
  face.position.x = -0.002; scr.add(face);
  face.userData.pick = 'screen'; bezel.userData.pick = 'screen';
  const glow = new THREE.PointLight(0xffb347, 0, 1.6, 2); glow.position.set(-0.25, 0, 0); scr.add(glow);

  // --- fold-out table between the seats and the back, with the album and the polaroids on it
  box(0.62, 0.8, 0.035, 0.18, 0, 1.73, M.wood);
  box(0.63, 0.81, 0.014, 0.18, 0, 1.718, M.metal);                             // its aluminium edge
  add(cylGeo(0.025, 0.025, 0.72, 8), M.metal, 0.18, 0, 1.36).rotation.x = Math.PI / 2;
  const album = new THREE.Group(); album.position.set(0.17, 0.02, 1.75); album.rotation.z = 0.2; root.add(album);
  const albumPaper = mat({ color: 0xefe7d6, roughness: 0.95 });               // its own paper: the album glows when hovered
  const albumLeather = mat({ color: 0x6b4530, roughness: 0.65 });
  box(0.3, 0.235, 0.008, 0, 0, 0.004, albumLeather, album);
  box(0.29, 0.225, 0.03, 0.004, 0, 0.022, albumPaper, album);
  box(0.3, 0.235, 0.008, 0, 0, 0.041, albumLeather, album);
  box(0.012, 0.235, 0.046, -0.148, 0, 0.022, albumLeather, album);
  const tapeGeo = keep(new THREE.PlaneGeometry(1, 1));
  const tape = (w, h, x, y, z, a, parent, m) => { const o = add(tapeGeo, m, x, y, z, parent); o.scale.set(w, h, 1); o.rotation.z = a; return o; };
  tape(0.09, 0.03, 0.1, -0.08, 0.0455, 0.35, album, tapeM());                 // a strip of clear tape on the cover
  // the polaroids lie loosely on top of the album: overlapping a little, each turned its own way
  const prints = [];
  const spots = [[-0.07, 0.04, 0.22], [0.035, 0.055, -0.3], [0.075, -0.04, 0.14], [-0.045, -0.045, -0.5], [0.005, 0.0, 0.62]];
  const loader = new THREE.TextureLoader();
  const printGeo = keep(new THREE.PlaneGeometry(0.085, 0.102));
  polaroids.slice(0, spots.length).forEach((src, i) => {
    const [x, y, a] = spots[i];
    const pc = document.createElement('canvas'); pc.width = 200; pc.height = 240;
    const pg = pc.getContext('2d'); pg.fillStyle = '#f4f1ea'; pg.fillRect(0, 0, 200, 240); pg.fillStyle = '#bdb6a8'; pg.fillRect(14, 14, 172, 172);
    const tex = keep(new THREE.CanvasTexture(pc)); tex.colorSpace = THREE.SRGBColorSpace;
    loader.load(src, (t) => {                                                // crop the thumb square into the print
      const im = t.image, s = Math.min(im.width, im.height);
      pg.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 14, 14, 172, 172);
      tex.needsUpdate = true; t.dispose();
    });
    const m = add(printGeo, keep(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })), x, y, 0.0465 + i * 0.0012, album);
    m.rotation.z = a;
    prints.push(m);
  });
  if (prints.length) {                                                       // the top print is taped down at one corner
    const top = prints[prints.length - 1];
    tape(0.045, 0.016, 0.034, 0.046, 0.0012, 0.75, top, tapeM());
  }
  album.traverse((o) => { if (o.isMesh) o.userData.pick = 'album'; });

  // --- the camera at the table's edge, on a small tripod, turned so its body and lens show
  const cam = new THREE.Group(); cam.position.set(0.31, -0.2, 1.748); cam.rotation.z = Math.PI + 0.45; root.add(cam);
  const camTop = new THREE.Group(); camTop.position.z = 0.115; camTop.rotation.y = 0.08; cam.add(camTop);    // on the tripod head, nose slightly down
  // tripod: a head, a short column and three splayed legs with rubber feet
  cyl(0.018, 0.03, 'z', 0, 0, 0.09, M.black, cam, 10);
  box(0.05, 0.04, 0.012, 0, 0, 0.106, M.black, cam);
  for (let k = 0; k < 3; k++) {
    const a = k * 2.094 + 0.5, foot = new THREE.Vector3(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0.006), top = new THREE.Vector3(0, 0, 0.08);
    const leg = add(cylGeo(0.006, 0.008, foot.distanceTo(top), 6), M.grip, (foot.x + top.x) / 2, (foot.y + top.y) / 2, (foot.z + top.z) / 2, cam);
    leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), foot.clone().sub(top).normalize());
    add(cylGeo(0.01, 0.01, 0.012, 8), M.grip, foot.x, foot.y, 0.006, cam).rotation.x = Math.PI / 2;
  }
  // body: x along the lens, y across (the grip on -y), z up
  box(0.072, 0.135, 0.085, -0.02, 0, 0.05, M.black, camTop);
  box(0.05, 0.035, 0.09, 0.002, -0.058, 0.048, M.grip, camTop);              // the deep grip
  box(0.05, 0.055, 0.035, -0.022, 0.012, 0.108, M.black, camTop);            // viewfinder hump
  box(0.02, 0.04, 0.018, -0.022, 0.012, 0.133, M.metal, camTop);             // accessory shoe
  box(0.012, 0.045, 0.03, -0.062, 0.012, 0.108, M.grip, camTop);             // eyecup
  cyl(0.013, 0.012, 'z', -0.025, -0.042, 0.099, M.metal, camTop, 14);         // dials
  cyl(0.011, 0.012, 'z', -0.012, 0.055, 0.098, M.metal, camTop, 14);
  cyl(0.006, 0.008, 'z', 0.004, -0.058, 0.096, M.metal, camTop, 8);           // shutter button
  for (const y of [-0.02, 0.0, 0.035]) box(0.012, 0.012, 0.004, -0.03, y, 0.094, M.dash, camTop);
  box(0.004, 0.08, 0.055, -0.0575, 0.012, 0.045, M.dash, camTop);             // rear display
  // lens: mount with an amber ring, barrel with grip rings, then the wide hood
  const lensAt = (len, r, x, m, seg = 24) => cyl(r, len, 'x', x, 0.012, 0.05, m, camTop, seg);
  lensAt(0.012, 0.034, 0.022, M.metal);
  lensAt(0.006, 0.035, 0.031, M.amber);
  lensAt(0.05, 0.036, 0.059, M.black);
  lensAt(0.035, 0.039, 0.1, M.grip);                                         // focus ring
  lensAt(0.04, 0.038, 0.138, M.black);
  lensAt(0.025, 0.04, 0.17, M.grip);                                         // zoom ring
  box(0.022, 0.01, 0.004, 0.06, 0.012, 0.087, M.paper, camTop);              // a small distance window, no writing
  const hoodM = keep(M.black.clone()); hoodM.side = THREE.DoubleSide;
  add(cylGeo(0.052, 0.043, 0.075, 24, true), hoodM, 0.218, 0.012, 0.05, camTop).rotation.z = Math.PI / 2;
  add(cylGeo(0.034, 0.034, 0.002, 24), M.dash, 0.183, 0.012, 0.05, camTop).rotation.z = Math.PI / 2;   // front glass, dark
  // strap: from both lugs it falls in a loose loop over the table edge
  const strapPts = [[-0.02, 0.07, 0.085], [-0.03, 0.095, 0.0], [-0.05, 0.085, -0.106], [-0.11, 0.02, -0.108], [-0.09, -0.07, -0.106], [-0.04, -0.095, 0.0], [-0.02, -0.075, 0.085]];
  add(keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(strapPts.map((p) => new THREE.Vector3(...p))), 40, 0.004, 4, false)), M.grip, 0, 0, 0, camTop);
  box(0.3, 0.22, 0.16, 1.25, -0.5, FLOOR + 0.6, M.case);                       // field case on the passenger seat

  // --- the back, planned as one fit-out. Built-ins (outer faces in van metres):
  //   rear wall:  base cabinets x -2.47..-2.02, y -0.50..0.97, worktop at 1.85
  //   left wall:  base cabinets x -2.02..-1.12, y 0.55..0.97, the same worktop, the windows above stay free
  //   right wall: tall cabinet x -2.47..-2.05, desk niche x -2.05..-1.08 (desk at 1.75, lockers above),
  //               tall shelf x -1.08..-0.84, all y -0.97..-0.50
  //   the blue swivel seat stands in the middle, in front of the niche; the floor between stays clear
  const BK = { x0: -2.47, xr: -2.02, yr: -0.5, yl: 0.55, xl: -1.12, top: 1.82, ws: 1.85 };
  // door or drawer fronts on a cabinet face: `face` is the axis the face looks along, `pos` the face plane,
  // `dir` which way it looks, a0..a1 the run along the face; each front gets a pull
  const fronts = (face, pos, dir, a0, a1, z0, z1, n, drawers = false) => {
    for (let k = 0; k < n; k++) {
      const a = a0 + (a1 - a0) * k / n + 0.006, b = a0 + (a1 - a0) * (k + 1) / n - 0.006;
      const p0 = Math.min(pos, pos + dir * 0.008), p1 = Math.max(pos, pos + dir * 0.008), q = pos + dir * 0.012;
      const pa = drawers ? (a + b) / 2 : (k % 2 ? a + 0.04 : b - 0.04), pl = drawers ? (b - a) * 0.4 : 0.016;
      const pz = drawers ? z1 - 0.05 : (z0 + z1) / 2 + 0.05, ph = drawers ? 0.016 : 0.12;
      if (face === 'x') { span(p0, p1, a, b, z0 + 0.01, z1 - 0.01, M.front); box(0.008, pl, ph, q, pa, pz, M.metal); }
      else { span(a, b, p0, p1, z0 + 0.01, z1 - 0.01, M.front); box(pl, 0.008, ph, pa, q, pz, M.metal); }
    }
  };
  // rear wall: base cabinets with a worktop, doors on the right, drawers on the left
  span(BK.x0, BK.xr, BK.yr, HALF, FLOOR, BK.top, M.cab);
  span(BK.x0, BK.xr + 0.02, BK.yr, HALF, BK.top, BK.ws, M.trim);
  span(BK.xr, BK.xr + 0.002, BK.yr, BK.yl, FLOOR, FLOOR + 0.08, M.dash);                    // toe kick
  fronts('x', BK.xr, 1, BK.yr + 0.01, 0.12, FLOOR + 0.08, BK.top, 2);
  for (let k = 0; k < 3; k++) fronts('x', BK.xr, 1, 0.12, BK.yl - 0.01, FLOOR + 0.08 + k * 0.247, FLOOR + 0.08 + (k + 1) * 0.247, 1, true);
  // left wall: the same cabinets under the windows
  span(BK.xr, BK.xl, BK.yl, HALF, FLOOR, BK.top, M.cab);
  span(BK.xr + 0.02, BK.xl + 0.02, BK.yl - 0.02, HALF, BK.top, BK.ws, M.trim);
  span(BK.xr, BK.xl, BK.yl - 0.002, BK.yl, FLOOR, FLOOR + 0.08, M.dash);
  fronts('y', BK.yl, -1, BK.xr + 0.01, BK.xl - 0.01, FLOOR + 0.08, BK.top, 3);
  // right wall: tall cabinet, desk niche with lockers above, a tall shelf
  const R = { y0: -HALF, y1: -0.5, desk: 1.72, nicheTop: 2.32 };
  span(BK.x0, -2.05, R.y0, R.y1, FLOOR, ROOF - 0.02, M.cab);
  fronts('y', R.y1, 1, BK.x0 + 0.01, -2.06, FLOOR + 0.08, 1.95, 1);
  fronts('y', R.y1, 1, BK.x0 + 0.01, -2.06, 1.95, ROOF - 0.03, 1);
  span(-2.05, -1.08, R.y0, R.y1, FLOOR, R.desk, M.cab);                                 // drawers under the desk
  for (let k = 0; k < 3; k++) fronts('y', R.y1, 1, -2.04, -1.09, FLOOR + 0.08 + k * 0.213, FLOOR + 0.08 + (k + 1) * 0.213, 2, true);
  span(-2.05, -1.08, R.y0, R.y1 + 0.04, R.desk, R.desk + 0.03, M.trim);                  // desk top
  span(-2.05, -1.08, R.y0, R.y0 + 0.02, R.desk + 0.03, R.nicheTop, M.front);              // niche back
  span(-2.05, -1.08, R.y0, R.y1, R.nicheTop, ROOF - 0.02, M.cab);                         // lockers above
  fronts('y', R.y1, 1, -2.04, -1.09, R.nicheTop + 0.04, ROOF - 0.03, 2);
  for (const [x0, x1] of [[-2.07, -2.03], [-1.1, -1.06]]) span(x0, x1, R.y1 - 0.012, R.y1 + 0.004, R.desk, R.nicheTop + 0.04, M.trim);   // a rim round the niche
  span(-2.05, -1.08, R.y1 - 0.012, R.y1 + 0.004, R.nicheTop, R.nicheTop + 0.04, M.trim);
  span(-2.0, -1.13, R.y1 - 0.06, R.y1 - 0.03, R.nicheTop - 0.012, R.nicheTop, M.led[3]);  // light strip under the lockers
  span(-1.08, -0.84, R.y0, R.y1, FLOOR, 1.5, M.cab);                                      // tall shelf: a cupboard below,
  fronts('y', R.y1, 1, -1.075, -0.845, FLOOR + 0.08, 1.5, 1);
  for (const [x0, x1] of [[-1.08, -1.06], [-0.86, -0.84]]) span(x0, x1, R.y0, R.y1, 1.5, ROOF - 0.02, M.cab);   // open shelves above
  span(-1.06, -0.86, R.y0, R.y0 + 0.02, 1.5, ROOF - 0.02, M.front);
  for (const z of [1.95, 2.4]) span(-1.06, -0.86, R.y0, R.y1, z, z + 0.02, M.trim);
  // binders on the shelves (grey, teal, amber spines), held by a bar
  const binderM = [M.case, mat({ color: 0x2f8a88, roughness: 0.5 }), M.amber, M.front];
  for (const [z, n] of [[1.5, 3], [1.97, 3]]) {
    for (let k = 0; k < n; k++) box(0.05, 0.36, 0.3, -1.03 + k * 0.056, -0.74, z + 0.15, binderM[(k + n) % 4]);
    box(0.2, 0.01, 0.01, -0.96, R.y1 - 0.01, z + 0.18, M.metal);
  }
  // in the niche: two small screens on the back, a laptop, papers, a pen pot
  const nicheScr = keep(canvasTex(128, 96, (g, w, h) => {
    g.fillStyle = '#041211'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(95,245,224,0.85)';
    for (let k = 0; k < 9; k++) g.fillRect(10 + k * 12, h - 14 - ((k * 37) % 50), 7, 4 + ((k * 37) % 50));
    g.fillRect(10, 10, 60, 5); g.fillRect(10, 20, 36, 4);
  }));
  const nicheM = keep(new THREE.MeshBasicMaterial({ map: nicheScr, toneMapped: false }));
  const scrGeo = keep(new THREE.PlaneGeometry(1, 1)); scrGeo.rotateX(Math.PI / 2); scrGeo.rotateZ(Math.PI);   // faces +y, its up is +z
  for (const x of [-1.78, -1.4]) {
    span(x - 0.13, x + 0.13, R.y0 + 0.02, R.y0 + 0.045, 2.0, 2.2, M.black);
    add(scrGeo, nicheM, x, R.y0 + 0.047, 2.1).scale.set(0.24, 1, 0.17);
  }
  const laptop = new THREE.Group(); laptop.position.set(-1.55, -0.72, R.desk + 0.03); laptop.rotation.z = 0.12; root.add(laptop);
  box(0.3, 0.21, 0.014, 0, 0, 0.007, M.metal, laptop);
  box(0.26, 0.1, 0.002, 0, 0.02, 0.015, M.dash, laptop);                         // keys
  const lid = new THREE.Group(); lid.position.set(0, -0.105, 0.014); lid.rotation.x = 0.32; laptop.add(lid);
  box(0.3, 0.008, 0.2, 0, -0.004, 0.1, M.metal, lid);
  add(scrGeo, M.teal, 0, 0.001, 0.1, lid).scale.set(0.27, 1, 0.17);
  for (let k = 0; k < 4; k++) box(0.21, 0.297, 0.003, -1.88 + k * 0.006, -0.73 + k * 0.012, R.desk + 0.033 + k * 0.003, M.paper).rotation.z = 0.1 - k * 0.07;
  for (let k = 0; k < 2; k++) box(0.21, 0.297, 0.003, -1.25, -0.73, R.desk + 0.033 + k * 0.003, M.paper).rotation.z = -0.25 + k * 0.18;
  add(cylGeo(0.03, 0.028, 0.09), M.case, -1.2, -0.88, R.desk + 0.075).rotation.x = Math.PI / 2;
  for (let k = 0; k < 3; k++) cyl(0.004, 0.13, 'z', -1.2 + (k - 1) * 0.01, -0.88 + (k - 1) * 0.008, R.desk + 0.12, [M.amber, M.black, M.metal][k], root, 6).rotation.y = (k - 1) * 0.15;
  // blue swivel seat at the desk, turned a little towards the cab
  const chair = new THREE.Group(); chair.position.set(-1.55, -0.12, FLOOR); chair.rotation.z = Math.PI + 0.45; root.add(chair);
  for (let k = 0; k < 5; k++) {                                                  // five-spoke base with castors
    const a = k * 1.2566;
    const sp = box(0.26, 0.04, 0.03, Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0.06, M.pedestal, chair); sp.rotation.z = a;
    add(cylGeo(0.022, 0.022, 0.025, 10), M.black, Math.cos(a) * 0.25, Math.sin(a) * 0.25, 0.025, chair);
  }
  cyl(0.03, 0.34, 'z', 0, 0, 0.24, M.metal, chair, 10);
  box(0.46, 0.46, 0.08, 0, 0, 0.45, M.blue, chair);                              // seat cushion
  box(0.46, 0.46, 0.02, 0, 0, 0.405, M.dash, chair);
  const cback = box(0.42, 0.06, 0.42, 0, -0.23, 0.76, M.blue, chair); cback.rotation.x = 0.12;   // backrest, its back to -y
  box(0.06, 0.08, 0.32, 0, -0.27, 0.5, M.pedestal, chair);
  for (const s of [-1, 1]) {                                                      // armrests
    box(0.05, 0.3, 0.03, s * 0.25, 0.0, 0.66, M.vinyl, chair);
    box(0.03, 0.04, 0.18, s * 0.25, -0.09, 0.57, M.pedestal, chair);
  }
  // stowed, strapped and fixed: a hard case strapped to the rear worktop, a coiled cable on a hook,
  // a fire extinguisher in its bracket on the side of the left cabinets
  const hc = new THREE.Group(); hc.position.set(-2.25, 0.42, BK.ws); root.add(hc);
  box(0.32, 0.46, 0.17, 0, 0, 0.085, M.case, hc);
  box(0.33, 0.47, 0.012, 0, 0, 0.12, M.dash, hc);                                // lid seam
  for (const y of [-0.12, 0.12]) box(0.035, 0.03, 0.03, 0.163, y, 0.12, M.amber, hc);   // latches
  for (const y of [-0.15, 0.15]) {                                               // two straps over it, down to rings
    box(0.34, 0.04, 0.004, 0, y, 0.172, M.amber, hc);
    box(0.004, 0.04, 0.17, 0.17, y, 0.085, M.amber, hc);
    box(0.004, 0.04, 0.17, -0.17, y, 0.085, M.amber, hc);
  }
  box(0.04, 0.025, 0.04, -1.42, HALF - 0.04, 2.48, M.metal);                    // hook on the wall between the windows
  const coilGeo = keep(new THREE.TorusGeometry(0.075, 0.009, 6, 20));
  for (let k = 0; k < 3; k++) { const c = add(coilGeo, M.black, -1.42 + (k - 1) * 0.008, HALF - 0.05 + k * 0.012, 2.37 - k * 0.006, root); c.rotation.set(Math.PI / 2, (k - 1) * 0.12, 0); c.scale.set(1, 1.35, 1); }
  const ext = new THREE.Group(); ext.position.set(BK.xl + 0.07, 0.86, FLOOR); root.add(ext);
  cyl(0.06, 0.4, 'z', 0, 0, 0.3, M.red, ext, 14);
  cyl(0.02, 0.06, 'z', 0, 0, 0.53, M.black, ext, 8);
  box(0.08, 0.03, 0.012, 0.02, 0, 0.56, M.black, ext);
  for (const z of [0.2, 0.42]) box(0.05, 0.14, 0.02, -0.05, 0, z, M.metal, ext);  // bracket bands
  // tie-down rail along the floor between the built-ins
  for (const y of [0.3, -0.42]) box(1.0, 0.025, 0.008, -1.55, y, FLOOR + 0.004, M.metal);

  // --- light: warm amber lamps; brighter at night, when the cab is otherwise dark
  const dome = new THREE.PointLight(0xffc887, 0, 5, 1.6); dome.position.set(0.2, 0, 2.85); root.add(dome);
  const fillL = new THREE.PointLight(0xffd29a, 0, 4, 1.6); fillL.position.set(-1.6, 0, 2.6); root.add(fillL);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  // --- the start menu on the screen: amber monospace text on a dark CRT, a slight glow and scanlines
  const UI = { state: 'home', hover: null, items: [], blink: true, route: null, log: [] };
  const TOD = { dawn: 'DAWN', day: 'DAY', dusk: 'DUSK', night: 'NIGHT' };
  function draw() {
    const W = canvas.width, H = canvas.height, g = ctx;
    const bg = g.createRadialGradient(W / 2, H / 2, H * 0.1, W / 2, H / 2, W * 0.7);
    bg.addColorStop(0, '#1d1606'); bg.addColorStop(1, '#070502');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const amber = '#ffbd3d', dim = 'rgba(255, 189, 61, 0.55)';
    g.textBaseline = 'middle';
    const text = (s, x, y, size, col = amber, weight = 600) => {
      g.font = `${weight} ${size}px "IBM Plex Mono", ui-monospace, Menlo, monospace`;
      g.shadowColor = 'rgba(255, 160, 30, 0.85)'; g.shadowBlur = size * 0.35;
      g.fillStyle = col; g.fillText(s, x, y); g.shadowBlur = 0;
      return g.measureText(s).width;
    };
    text('FIELD UNIT 07 · AUTOPILOT', 64, 58, 28, dim, 500);
    text('LIGHT: ' + (TOD[timeOfDay()] || 'DAY'), W - 64 - 230, 58, 28, dim, 500);
    g.fillStyle = dim; g.fillRect(64, 92, W - 128, 3);
    UI.items = [];
    const item = (id, label, y, size = 50, sub) => {
      const on = UI.hover === id;
      if (on) { g.fillStyle = amber; g.shadowColor = 'rgba(255,160,30,0.8)'; g.shadowBlur = 18; g.fillRect(52, y - size * 0.72, W - 104, size * 1.44 + (sub ? 34 : 0)); g.shadowBlur = 0; }
      const w = text(label, 72, y, size, on ? '#1a1204' : amber, 700);
      if (sub) text(sub, 112, y + size * 0.62 + 12, 24, on ? '#2a1d06' : dim, 500);
      if (!on && UI.blink && UI.items.length === 0) { g.fillStyle = amber; g.fillRect(72 + w + 14, y - size * 0.4, size * 0.5, size * 0.8); }
      UI.items.push({ id, label: label.replace(/^[<>] /, ''), y0: y - size * 0.72, y1: y + size * 0.72 + (sub ? 34 : 0) });
    };
    if (UI.state === 'home') {
      text('RESEARCH VEHICLE READY.', 72, 200, 34, dim, 500);
      text('NO STEERING REQUIRED.', 72, 248, 34, dim, 500);
      item('start', '> START EXPLORATION', 380, 56);
      item('log', '> FIELD LOG', 510, 42);
    } else if (UI.state === 'routes') {
      text('SELECT ROUTE', 72, 165, 38, dim, 600);
      ROUTES.forEach((r, i) => item(r.id, '> ' + r.name, 250 + i * 118, 46, r.line));
      item('back', '< BACK', 600, 38);
    } else if (UI.state === 'log') {
      // the checklist: one row of cells per route (a lit cell per species photographed), the
      // count, and the secret animals named once found, else only when they come out
      text('FIELD LOG · SPECIES PHOTOGRAPHED', 72, 150, 32, dim, 600);
      ROUTES.forEach((r, i) => {
        const y = 230 + i * 160, L = UI.log[i];
        text(r.name, 72, y, 44);
        if (!L) { text('NOT SURVEYED YET. DRIVE IT ONCE.', 72, y + 58, 26, dim, 500); return; }
        text(`${L.found}/${L.total}${L.rare ? ` · ${L.rare} RARE` : ''}`, 330, y, 32, L.found === L.total ? amber : dim, 600);
        const x0 = 72, w = (W - 144) / Math.max(1, L.total);
        for (let k = 0; k < L.total; k++) {
          g.fillStyle = k < L.found ? amber : 'rgba(255, 189, 61, 0.16)';
          g.fillRect(x0 + k * w + 2, y + 34, Math.max(2, w - 4), 16);
        }
        const sec = L.secrets.map((q) => (q.found ? q.name.toUpperCase() + ' *' : '??? AT ' + q.when)).join(' · ');
        if (sec) text('SECRET: ' + sec, 72, y + 82, 24, dim, 500);
      });
      item('back', '< BACK', 590, 38);
    } else if (UI.state === 'soon') {
      const r = ROUTES.find((q) => q.id === UI.route) || ROUTES[0];
      text('ROUTE: ' + r.name, 72, 190, 46);
      text('ROUTE DATA NOT LOADED.', 72, 280, 34, dim, 500);
      text('COMING SOON', 72, 350, 46);
      item('back', '< BACK', 540, 40);
    }
    // scanlines and a darker rim, like an old tube
    g.fillStyle = 'rgba(0, 0, 0, 0.26)';
    for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 2);
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    screenTex.needsUpdate = true;
  }
  const itemAt = (uv) => {
    if (!uv) return null;
    const y = (1 - uv.y) * canvas.height;
    const it = UI.items.find((q) => y >= q.y0 && y <= q.y1);
    return it ? it.id : null;
  };
  function press(id) {
    if (!id) return false;
    if (id === 'start') UI.state = 'routes';
    else if (id === 'log') { UI.state = 'log'; UI.log = ROUTES.map((r) => summary(r.id)); }
    else if (id === 'back') UI.state = UI.state === 'soon' ? 'routes' : 'home';
    else {
      const r = ROUTES.find((q) => q.id === id);
      if (!r) return false;
      UI.route = id;
      if (r.ready) onRoute(id, timeOfDay()); else UI.state = 'soon';
    }
    UI.hover = null; draw();
    return true;
  }
  let blinkTimer = 0, ledT = 0;
  draw();

  return {
    root,
    views: VIEWS,
    screen: {
      mesh: face, size: S,
      centre: (out) => face.getWorldPosition(out),
      normal: (out) => out.set(-1, 0, 0).applyQuaternion(face.getWorldQuaternion(new THREE.Quaternion())),
      hover(uv) { const id = itemAt(uv); if (id !== UI.hover) { UI.hover = id; draw(); } return id; },
      press: (uv) => press(itemAt(uv)),
      // the same choices for the keyboard and screen readers: the page lists them as buttons
      items: () => UI.items.map(({ id, label }) => ({ id, label })),
      pressId: (id) => press(id),
      reset() { UI.state = 'home'; UI.hover = null; draw(); },
      state: () => UI.state,
    },
    prints,
    // night 0..1: how much the lamps have to do
    setLight(night) {
      dome.intensity = 0.6 + 2.6 * night; fillL.intensity = 0.3 + 1.4 * night; glow.intensity = 0.15 + 0.6 * night;
      M.lamp.emissiveIntensity = 0.7 + 1.3 * night;
    },
    start() {                                  // while someone sits in the van: the cursor and the diodes blink
      clearInterval(blinkTimer);
      blinkTimer = setInterval(() => {
        UI.blink = !UI.blink; draw();
        ledT++; leds.forEach((l, i) => { l.visible = ((i * 7 + ledT) % 5) !== 0; });
      }, 530);
      draw();
    },
    stop() { clearInterval(blinkTimer); blinkTimer = 0; },
    dispose() {
      clearInterval(blinkTimer);
      root.removeFromParent();
      disposables.forEach((d) => d.dispose && d.dispose());
    },
  };
}
