// Inside the camp van: a lightweight procedural interior, loaded the first time someone gets in.
// After Smo's references: an old, worn, boxy cab (red-orange paint, patterned seat covers, a plain
// dark dashboard, a light board ceiling) retrofitted with research tech. The van drives itself, so
// there is no steering wheel: in its place stands the screen, which is the start menu (a vintage
// amber terminal). A photo album lies on the fold-out table with loose polaroids round it, and the
// camera (long lens on a small tripod) lies on the passenger seat.
//
// Coordinates are the van's own, as in 3d/scripts/vehicle.py: x forward, y to the left, z up, the
// ground at z = 0, the body floor at z = 0.95. The page places the group on the van in the model.
import * as THREE from 'three';

export const ROUTES = [
  { id: 'canyon', name: 'CANYON', line: 'RIVER · CLIFF PATH · DEEP POOL', ready: false },
  { id: 'jungle', name: 'JUNGLE', line: 'CANOPY · BRACKISH RIVER CROSSING', ready: false },
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
  // textures: woven seat cover with coloured flecks, ribbed rubber mat, board ceiling
  const fabric = keep(canvasTex(256, 256, (g, w, h) => {
    const r = seeded(11);
    g.fillStyle = '#596170'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) { g.fillStyle = y % 8 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'; g.fillRect(0, y, w, 2); }
    const cols = ['#c9475a', '#2fa39a', '#e2b33c', '#4f7fd0', '#9a5fb8', '#d9d2c3'];
    for (let k = 0; k < 420; k++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.globalAlpha = 0.55 + r() * 0.4; g.fillRect(r() * w, r() * h, 3 + r() * 7, 2 + r() * 3); }
    g.globalAlpha = 1;
  }, [2, 2]));
  const rubber = keep(canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#2a2a2a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1b1b1b'; for (let k = 0; k < 8; k++) { g.fillRect(k * 16 + 2, 0, 3, h); g.fillRect(0, k * 16 + 2, w, 3); }
  }, [8, 4]));
  const boards = keep(canvasTex(256, 256, (g, w, h) => {
    const r = seeded(5);
    g.fillStyle = '#d8bd94'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 160; k++) { g.fillStyle = `rgba(120,80,40,${0.04 + r() * 0.08})`; g.fillRect(r() * w, r() * h, 2 + r() * 40, 1 + r() * 2); }
    g.fillStyle = 'rgba(90,60,30,0.35)'; g.fillRect(0, 0, w, 2); g.fillRect(0, h / 2, w, 2);
  }, [2, 1]));
  const M = {
    paint: mat({ color: 0x9c4630, roughness: 0.6 }),
    trim: mat({ color: 0x8d877d, roughness: 0.75 }),
    dash: mat({ color: 0x2e2f32, roughness: 0.85 }),
    plastic: mat({ color: 0x45464a, roughness: 0.7 }),
    floor: mat({ color: 0xffffff, map: rubber, roughness: 0.95 }),
    ceiling: mat({ color: 0xffffff, map: boards, roughness: 0.9 }),
    fabric: mat({ color: 0xffffff, map: fabric, roughness: 0.95 }),
    vinyl: mat({ color: 0x3a3b3f, roughness: 0.6 }),
    wood: mat({ color: 0xa47b55, roughness: 0.7 }),
    metal: mat({ color: 0x9a9da2, roughness: 0.35, metalness: 0.6 }),
    olive: mat({ color: 0x55573f, roughness: 0.7 }),
    sand: mat({ color: 0xa69a78, roughness: 0.8 }),
    black: mat({ color: 0x18191b, roughness: 0.5 }),
    leather: mat({ color: 0x3d4a3e, roughness: 0.65 }),
    paper: mat({ color: 0xefe7d6, roughness: 0.95 }),
    led: [0x5dff8a, 0xffb02e, 0xff4a3a, 0x63c7ff].map((c) => mat({ color: 0x111111, emissive: c, emissiveIntensity: 2.2 })),
  };
  const add = (geo, m, x, y, z, parent = root) => { keep(geo); const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
  const box = (w, d, h, x, y, z, m, parent) => add(new THREE.BoxGeometry(w, d, h), m, x, y, z, parent);

  // --- shell: floor, side walls with the window openings, ceiling, rear wall, windscreen pillars
  box(4.78, 2 * HALF, 0.04, -0.11, 0, FLOOR - 0.02, M.floor);
  const side = new THREE.Shape([[-2.5, FLOOR], [2.28, FLOOR], [2.28, 1.72], [1.98, 1.96], [1.56, ROOF - 0.01], [0.85, ROOF], [-2.5, ROOF]].map(([x, z]) => new THREE.Vector2(x, z)));
  const hole = (x0, x1, z0, z1) => side.holes.push(new THREE.Path([new THREE.Vector2(x0, z0), new THREE.Vector2(x1, z0), new THREE.Vector2(x1, z1), new THREE.Vector2(x0, z1)]));
  hole(0.92, 1.64, 2.07, 2.77); hole(-1.2, -0.3, 2.19, 2.81); hole(-2.275, -1.625, 2.19, 2.81);
  const sideGeo = keep(new THREE.ShapeGeometry(side)); sideGeo.rotateX(Math.PI / 2);
  const wallM = M.paint.clone(); keep(wallM); wallM.side = THREE.DoubleSide;
  for (const s of [-1, 1]) { const w = new THREE.Mesh(sideGeo, wallM); w.position.y = s * HALF; root.add(w); }
  // lower door and wall panels in grey trim, like the cab's plastic linings
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
    const p = add(new THREE.CylinderGeometry(0.045, 0.045, a.distanceTo(b), 8), M.paint, (a.x + b.x) / 2, a.y, (a.z + b.z) / 2);
    p.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  }
  box(0.06, 2 * HALF, 0.07, 1.57, 0, 2.95, M.paint);                           // header above the windscreen
  box(0.2, 0.32, 0.03, 1.4, 0.48, 2.93, M.trim).rotation.y = -0.25;            // sun visors
  box(0.2, 0.32, 0.03, 1.4, -0.48, 2.93, M.trim).rotation.y = -0.25;
  box(0.18, 0.08, 0.04, 1.2, 0, 2.95, M.paper);                                // dome lamp lens
  box(0.04, 0.24, 0.07, 1.52, 0, 2.88, M.black);                               // rear-view mirror

  // --- dashboard: plain dark plastic, vents, the old instrument recess, a glovebox lid
  box(0.42, 2 * HALF, 0.3, 1.82, 0, 1.97, M.dash);
  box(0.3, 2 * HALF, 0.9, 2.12, 0, 1.45, M.dash);
  box(0.05, 0.62, 0.2, 1.6, 0.48, 1.98, M.black);                              // where the gauges were
  box(0.03, 0.55, 0.16, 1.6, -0.5, 1.96, M.plastic);                           // glovebox
  for (const y of [0.88, -0.88, 0.15, -0.15]) add(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 16), M.black, 1.6, y, 2.04).rotation.z = Math.PI / 2;
  // center console between the seats (the 208's tall engine hump), worn plastic
  box(0.6, 0.42, 0.5, 1.4, 0, FLOOR + 0.25, M.plastic);
  box(0.26, 0.36, 0.28, 1.6, 0, 1.62, M.dash);
  // retrofit: an amber LED line along the dash, a small status display, blinking diodes
  box(0.01, 1.7, 0.012, 1.605, 0, 2.115, M.led[1]);
  const leds = [];
  for (let k = 0; k < 8; k++) leds.push(box(0.012, 0.018, 0.012, 1.6, -0.08 + k * 0.022, 1.86, M.led[k % 4]));

  // --- front seats with the patterned covers, on red pedestals
  const seat = (y) => {
    const g = new THREE.Group(); g.position.set(1.18, y, FLOOR); root.add(g);
    box(0.44, 0.5, 0.45, 0, 0, 0.225, M.paint, g);
    box(0.5, 0.56, 0.13, 0.02, 0, 0.51, M.fabric, g);
    const back = box(0.13, 0.54, 0.6, -0.24, 0, 0.86, M.fabric, g); back.rotation.y = -0.12;
    box(0.5, 0.58, 0.035, 0.02, 0, 0.44, M.vinyl, g);
    return g;
  };
  seat(0.52); seat(-0.52);

  // --- the screen, where the steering wheel would be: a stalk from the dash and a tilted panel
  const S = { w: 0.6, h: 0.38, c: new THREE.Vector3(1.5, 0.5, 2.36) };
  const stalk = add(new THREE.CylinderGeometry(0.035, 0.035, 0.34, 10), M.metal, 1.64, 0.5, 2.14);
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

  // --- fold-out table between the seats and the bench, with the album and loose polaroids
  box(0.62, 0.8, 0.035, 0.18, 0, 1.73, M.wood);
  add(new THREE.CylinderGeometry(0.025, 0.025, 0.72, 8), M.metal, 0.18, 0, 1.36).rotation.x = Math.PI / 2;
  const album = new THREE.Group(); album.position.set(0.17, 0.02, 1.75); album.rotation.z = 0.2; root.add(album);
  box(0.3, 0.235, 0.008, 0, 0, 0.004, M.leather, album);
  box(0.29, 0.225, 0.03, 0.004, 0, 0.022, mat({ color: 0xefe7d6, roughness: 0.95 }), album);   // its own paper: the album glows when hovered
  box(0.3, 0.235, 0.008, 0, 0, 0.041, M.leather, album);
  box(0.012, 0.235, 0.046, -0.148, 0, 0.022, M.leather, album);
  box(0.09, 0.03, 0.002, 0.04, 0.05, 0.046, keep(new THREE.MeshStandardMaterial({ color: 0xe8d9a8, roughness: 0.9 })), album).rotation.z = 0.35;   // a strip of tape on the cover
  album.traverse((o) => { if (o.isMesh) o.userData.pick = 'album'; });
  const prints = [];
  const spots = [[0.42, 0.25, 1.752, 0.5], [-0.02, -0.28, 1.752, -0.35], [0.36, -0.22, 1.752, 0.9], [-0.04, 0.3, 1.752, 2.6], [1.24, -0.38, 1.585, 0.25]];
  const loader = new THREE.TextureLoader();
  polaroids.slice(0, spots.length).forEach((src, i) => {
    const [x, y, z, a] = spots[i];
    const pc = document.createElement('canvas'); pc.width = 200; pc.height = 240;
    const pg = pc.getContext('2d'); pg.fillStyle = '#f4f1ea'; pg.fillRect(0, 0, 200, 240); pg.fillStyle = '#bdb6a8'; pg.fillRect(14, 14, 172, 172);
    const tex = keep(new THREE.CanvasTexture(pc)); tex.colorSpace = THREE.SRGBColorSpace;
    loader.load(src, (t) => {                                                // crop the thumb square into the print
      const im = t.image, s = Math.min(im.width, im.height);
      pg.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 14, 14, 172, 172);
      tex.needsUpdate = true; t.dispose();
    });
    const g = keep(new THREE.PlaneGeometry(0.085, 0.102));
    const m = new THREE.Mesh(g, keep(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })));
    m.position.set(x, y, z + i * 0.0005); m.rotation.z = a;
    m.userData.pick = 'album';
    root.add(m); prints.push(m);
  });

  // --- the camera on the passenger seat: long lens with hood on a small tripod, a field case beside it
  const cam = new THREE.Group(); cam.position.set(1.52, 0.02, 1.765); cam.rotation.z = 0.35; root.add(cam);   // on the console between the seats
  box(0.1, 0.15, 0.12, -0.12, 0, 0.12, M.black, cam);
  box(0.06, 0.12, 0.04, -0.12, 0, 0.2, M.black, cam);
  const lens = add(new THREE.CylinderGeometry(0.05, 0.042, 0.3, 18), M.olive, 0.09, 0, 0.12, cam); lens.rotation.z = Math.PI / 2;
  const hood = add(new THREE.CylinderGeometry(0.068, 0.058, 0.12, 18, 1, true), M.olive, 0.29, 0, 0.12, cam); hood.rotation.z = Math.PI / 2;
  hood.material = M.olive.clone(); hood.material.side = THREE.DoubleSide; keep(hood.material);
  box(0.06, 0.06, 0.06, 0.02, 0, 0.04, M.sand, cam);
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1 + 0.3, leg = add(new THREE.CylinderGeometry(0.012, 0.016, 0.2, 6), M.sand, 0.02 + Math.cos(a) * 0.07, Math.sin(a) * 0.07, 0.015, cam);
    leg.rotation.set(Math.PI / 2, 0, a + Math.PI / 2); leg.rotation.order = 'ZXY';
  }
  box(0.3, 0.22, 0.16, 1.25, -0.5, FLOOR + 0.6, M.olive);                      // field case on the passenger seat

  // --- rear: bench, an equipment rack with blinking diodes, cases, cables
  box(0.55, 1.9, 0.42, -2.18, 0, FLOOR + 0.21, M.paint);
  box(0.58, 1.9, 0.12, -2.15, 0, FLOOR + 0.48, M.fabric);
  box(0.12, 1.9, 0.6, -2.42, 0, FLOOR + 0.86, M.fabric).rotation.y = -0.1;
  box(0.6, 0.34, 1.55, -1.55, -0.78, FLOOR + 0.78, M.dash);                    // rack, its front towards the cab
  for (let r = 0; r < 4; r++) {
    box(0.005, 0.28, 0.24, -1.247, -0.78, FLOOR + 0.5 + r * 0.32, M.plastic);
    for (let k = 0; k < 5; k++) leds.push(box(0.012, 0.014, 0.014, -1.24, -0.88 + k * 0.045, FLOOR + 0.6 + r * 0.32, M.led[(r + k) % 4]));
  }
  box(0.5, 0.36, 0.3, -1.6, 0.72, FLOOR + 0.15, M.olive);
  box(0.42, 0.3, 0.22, -1.62, 0.7, FLOOR + 0.41, M.black);
  add(new THREE.CylinderGeometry(0.04, 0.05, 0.4, 10), M.metal, -1.0, 0, FLOOR + 0.2).rotation.x = Math.PI / 2;   // a swivel stool: the visitor's seat
  add(new THREE.CylinderGeometry(0.2, 0.2, 0.09, 20), M.fabric, -1.0, 0, FLOOR + 0.44).rotation.x = Math.PI / 2;
  box(0.36, 0.5, 0.26, -0.5, -0.7, FLOOR + 0.13, M.sand);

  // --- light: a warm dome lamp; brighter at night, when the cab is otherwise dark
  const dome = new THREE.PointLight(0xffd9a8, 0, 5, 1.6); dome.position.set(0.2, 0, 2.85); root.add(dome);
  const fillL = new THREE.PointLight(0xffe2c0, 0, 4, 1.6); fillL.position.set(-1.6, 0, 2.6); root.add(fillL);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  // --- the start menu on the screen: amber monospace text on a dark CRT, a slight glow and scanlines
  const UI = { state: 'home', hover: null, items: [], blink: true, route: null };
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
      UI.items.push({ id, y0: y - size * 0.72, y1: y + size * 0.72 + (sub ? 34 : 0) });
    };
    if (UI.state === 'home') {
      text('RESEARCH VEHICLE READY.', 72, 200, 34, dim, 500);
      text('NO STEERING REQUIRED.', 72, 248, 34, dim, 500);
      item('start', '> START EXPLORATION', 400, 56);
    } else if (UI.state === 'routes') {
      text('SELECT ROUTE', 72, 165, 38, dim, 600);
      ROUTES.forEach((r, i) => item(r.id, '> ' + r.name, 268 + i * 140, 54, r.line));
      item('back', '< BACK', 560, 40);
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
      reset() { UI.state = 'home'; UI.hover = null; draw(); },
      state: () => UI.state,
    },
    prints,
    // night 0..1: how much the lamps have to do
    setLight(night) {
      dome.intensity = 0.6 + 2.6 * night; fillL.intensity = 0.3 + 1.4 * night; glow.intensity = 0.15 + 0.6 * night;
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
