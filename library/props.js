// Library props (LIBRARY_PLAN phase L1): Simon's three shelf items and the monstera, built in code.
// Every prop is a few draw calls: solid parts carry their colour as vertex colours and are merged into
// one mesh; painted surfaces (the cat's face and coin, the vase) share a small canvas texture.
// Local frames: y up, the front looks to -z (towards the open side of the room), origin on the floor
// or shelf under the prop's centre, sizes in metres.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();
const C = new THREE.Color(), C2 = new THREE.Color();

// collect geometries with a colour each (or a colour function of the local position), merge into one
function solid() {
  const list = [];
  return {
    add(geo, color, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], tint = null } = {}) {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      geo.dispose();
      ['uv1', 'uv2'].forEach((a) => g.deleteAttribute(a));
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.applyMatrix4(M4.compose(V.set(...pos), Q.setFromEuler(E.set(...rot)), S.set(...scale)));
      const p = g.attributes.position, n = p.count, col = new Float32Array(n * 3);
      C.set(color);
      for (let i = 0; i < n; i++) {
        if (tint) { C2.copy(C); tint(C2, p.getX(i), p.getY(i), p.getZ(i)); col.set([C2.r, C2.g, C2.b], i * 3); } else col.set([C.r, C.g, C.b], i * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      list.push(g);
      return g;
    },
    build() { const g = mergeGeometries(list); list.forEach((x) => x.dispose()); return g; },
  };
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function texture(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
// a seeded random, so the props look the same on every visit
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---------------------------------------------------------------- the waving lucky cat (lucky-cat.jpg)
// White glazed ceramic, red ears and collar, green bib with a gold bell, calico patches, a gold coin in
// its left paw (the characters are a pattern, not text); the right paw (towards +x) is raised and waves.
// About 24 cm tall. Returns { group, arm (the waving part, pivot at the shoulder), pick: meshes }.
const WHITE = 0xf3eee3, RED = 0xc8281f, GREEN = 0x4f8a2e, GOLD = 0xb98a3a;
// calico: airbrushed patches, dark in the middle with an orange-brown halo
const PATCHES = [[0.035, 0.232, 0.01, 0.03], [-0.075, 0.06, 0.005, 0.034], [0.06, 0.09, 0.04, 0.04], [0.02, 0.27, -0.035, 0.024], [-0.05, 0.03, -0.045, 0.02]];
function calico(c, x, y, z) {
  let k = 0, dark = 0;
  PATCHES.forEach(([px, py, pz, r]) => {
    const d = Math.hypot(x - px, y - py, z - pz) / r;
    k = Math.max(k, 1 - smooth(0.55, 1.15, d)); dark = Math.max(dark, 1 - smooth(0.15, 0.6, d));
  });
  if (k <= 0) return;
  c.lerp(C2.set(0xd39a4c), k * 0.85); c.lerp(C2.set(0x2b2019), dark * 0.85);
}
function catAtlas() {                                  // 1024 x 512: the face on the left half, the coin on the right
  const [cv, g] = canvas(1024, 512);
  // face: drawn as seen from the front; the patch spans 2 rad round the head and 1.8 rad top to bottom
  const fy = (th) => (th - 0.6) / 1.8 * 512;
  g.lineCap = 'round'; g.lineJoin = 'round';
  [[-1, 175], [1, 337]].forEach(([s, x]) => {
    const y = fy(1.36);
    g.save(); g.translate(x, y); g.rotate(s * 0.12);
    g.fillStyle = '#f4c21b'; g.beginPath(); g.ellipse(0, 0, 40, 27, 0, 0, Math.PI * 2); g.fill();   // yellow iris
    g.fillStyle = '#111'; g.beginPath(); g.ellipse(-s * 6, 3, 26, 24, 0, 0, Math.PI * 2); g.fill();   // big black pupil
    g.strokeStyle = '#111'; g.lineWidth = 6; g.beginPath(); g.ellipse(0, 0, 40, 27, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.moveTo(-s * 46, -6); g.quadraticCurveTo(-s * 54, -24, -s * 40, -38); g.stroke();   // outer lash line
    g.restore();
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 3;                                   // brows and cheek lines
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x - s * 10 + s * i * 8, fy(1.12) - i * 4); g.lineTo(x + s * 28 + s * i * 8, fy(1.06) - i * 4); g.stroke(); }
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x + s * 30, fy(1.55) + i * 12); g.quadraticCurveTo(x + s * 55, fy(1.6) + i * 14, x + s * 70, fy(1.75) + i * 14); g.stroke(); }
    g.strokeStyle = '#c8281f'; g.lineWidth = 5;                                    // red whisker marks
    for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(256 + s * 42, fy(1.62) + i * 16); g.lineTo(256 + s * 72, fy(1.58) + i * 22); g.stroke(); }
  });
  g.fillStyle = '#e57a8e'; g.beginPath(); g.moveTo(240, fy(1.55)); g.lineTo(272, fy(1.55)); g.lineTo(256, fy(1.64)); g.closePath(); g.fill();   // nose
  g.strokeStyle = '#c8281f'; g.lineWidth = 4; g.beginPath(); g.moveTo(256, fy(1.64)); g.lineTo(256, fy(1.7));
  g.moveTo(236, fy(1.74)); g.quadraticCurveTo(246, fy(1.71), 256, fy(1.7)); g.quadraticCurveTo(266, fy(1.71), 276, fy(1.74)); g.stroke();
  // coin (koban): gold-brown oval, ribbed ends, dark blocky strokes that read as a pattern, not as writing
  g.save(); g.translate(768, 256);
  g.fillStyle = '#8f6a35'; g.beginPath(); g.ellipse(0, 0, 250, 250, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(60,40,15,0.45)'; g.lineWidth = 7;
  for (let i = -10; i <= 10; i++) { const y = i * 23; const w = Math.sqrt(Math.max(0, 250 * 250 - y * y)); g.beginPath(); g.moveTo(-w, y); g.lineTo(-w * 0.62, y); g.moveTo(w * 0.62, y); g.lineTo(w, y); g.stroke(); }
  g.fillStyle = '#17120d';
  const R = rng(11);
  for (let k = 0; k < 3; k++) {                         // three abstract glyph blocks down the middle
    const cy = -120 + k * 120;
    g.fillRect(-60, cy - 6, 120, 16);
    for (let j = 0; j < 3; j++) { const x = -50 + R() * 90; g.fillRect(x, cy - 40 + R() * 20, 14, 50 + R() * 20); }
    g.fillRect(-40 + R() * 20, cy + 26, 80, 12);
  }
  g.restore();
  return texture(cv);
}
export function makeCat() {
  const group = new THREE.Group(); group.name = 'library_cat';
  const s = solid();
  const HEAD = [0, 0.19, -0.004], HS = [0.077, 0.066, 0.064];
  // body: a sitting bell shape, a little flatter front to back
  s.add(lathe([[0, 0], [0.062, 0], [0.071, 0.012], [0.074, 0.045], [0.07, 0.085], [0.06, 0.12], [0.045, 0.145], [0, 0.15]], 28), WHITE, { scale: [1, 1, 0.82], tint: calico });
  s.add(new THREE.SphereGeometry(1, 28, 20), WHITE, { pos: HEAD, scale: HS, tint: calico });                  // head
  [-1, 1].forEach((sx) => {
    s.add(new THREE.SphereGeometry(1, 12, 10), WHITE, { pos: [sx * 0.034, 0.014, -0.05], scale: [0.026, 0.016, 0.03], tint: calico });   // front feet
    s.add(new THREE.ConeGeometry(0.026, 0.04, 14), WHITE, { pos: [sx * 0.05, 0.25, 0.0], rot: [0, 0, -sx * 0.42], tint: calico });   // ears
    s.add(new THREE.ConeGeometry(0.019, 0.03, 12), RED, { pos: [sx * 0.05, 0.247, -0.009], rot: [0.12, 0, -sx * 0.42], scale: [1, 1, 0.4] });
  });
  s.add(new THREE.TorusGeometry(0.047, 0.008, 8, 28), RED, { pos: [0, 0.135, -0.002], rot: [Math.PI / 2 + 0.12, 0, 0], scale: [1, 0.85, 1] });   // collar
  s.add(new THREE.SphereGeometry(1, 16, 10), GREEN, { pos: [0, 0.112, -0.05], rot: [0.25, 0, 0], scale: [0.034, 0.028, 0.012] });   // bib
  s.add(new THREE.SphereGeometry(0.011, 12, 8), GOLD, { pos: [0, 0.118, -0.062] });                            // bell
  // left paw (towards -x) low on the belly, holding the coin; the coin's rim
  s.add(new THREE.SphereGeometry(1, 12, 10), WHITE, { pos: [-0.04, 0.072, -0.05], rot: [0, 0, 0.5], scale: [0.022, 0.034, 0.02], tint: calico });
  s.add(new THREE.CylinderGeometry(1, 1, 1, 28), 0x7a5a2c, { pos: [-0.012, 0.06, -0.062], rot: [Math.PI / 2, 0, 0], scale: [0.03, 0.007, 0.043] });
  s.add(new THREE.SphereGeometry(1, 10, 8), WHITE, { pos: [-0.032, 0.078, -0.072], scale: [0.015, 0.013, 0.012] });   // the paw over the coin's edge
  const body = new THREE.Mesh(s.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.26, metalness: 0 }));
  body.name = 'library_cat_body';
  body.castShadow = true; body.receiveShadow = true;
  group.add(body);

  // painted face and coin: one texture, one mesh
  const atlas = catAtlas();
  const face = new THREE.SphereGeometry(1, 24, 18, Math.PI * 1.5 - 1.0, 2.0, 0.6, 1.8);
  face.applyMatrix4(M4.compose(V.set(...HEAD), Q.identity(), S.set(HS[0] * 1.006, HS[1] * 1.006, HS[2] * 1.006)));
  const fu = face.attributes.uv; for (let i = 0; i < fu.count; i++) fu.setX(i, fu.getX(i) * 0.5);
  const coin = new THREE.CircleGeometry(1, 28);
  coin.applyMatrix4(M4.compose(V.set(-0.012, 0.06, -0.0656), Q.setFromEuler(E.set(0, Math.PI, 0)), S.set(0.029, 0.042, 1)));
  const cu = coin.attributes.uv; for (let i = 0; i < cu.count; i++) cu.setX(i, 0.5 + cu.getX(i) * 0.5);
  const paint = new THREE.Mesh(mergeGeometries([face.toNonIndexed(), coin.toNonIndexed()]), new THREE.MeshStandardMaterial({
    map: atlas, transparent: true, alphaTest: 0.4, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -2 }));
  face.dispose(); coin.dispose();
  paint.name = 'library_cat_paint';
  group.add(paint);

  // the raised right paw (towards +x): its own mesh on a pivot at the shoulder, so waving is one rotation
  const arm = new THREE.Group(); arm.position.set(0.052, 0.125, -0.02);
  const a = solid();
  const at = (x, y, z) => [x - 0.052, y - 0.125, z + 0.02];
  a.add(new THREE.CapsuleGeometry(1, 2.2, 6, 12), WHITE, { pos: at(0.072, 0.19, -0.03), rot: [0.15, 0, -0.18], scale: [0.019, 0.021, 0.018], tint: calico });
  a.add(new THREE.SphereGeometry(1, 14, 10), WHITE, { pos: at(0.078, 0.245, -0.036), scale: [0.024, 0.022, 0.018], tint: calico });   // the paw
  [-1, 0, 1].forEach((k) => a.add(new THREE.SphereGeometry(0.0045, 8, 6), GOLD, { pos: at(0.078 + k * 0.009, 0.258 - Math.abs(k) * 0.003, -0.052) }));   // toe pads
  const armMesh = new THREE.Mesh(a.build(), body.material);
  armMesh.name = 'library_cat_arm';
  armMesh.castShadow = false; armMesh.receiveShadow = true;   // it moves: no shadow redraws for it
  arm.add(armMesh); group.add(arm);
  return { group, arm, pick: [body, paint, armMesh] };
}

// ---------------------------------------------------------------- painted porcelain vase (vase.jpg)
// Tall baluster: deep blue body with a white panel of flowers and a bird, gold and orange bands, a gold
// neck with small handles. About 30 cm tall.
function vaseTexture() {
  const [cv, g] = canvas(1024, 512), H = 512, Y = (h) => H - h / 0.3 * H;   // canvas row for a height on the vase
  const R = rng(5);
  const band = (h0, h1, color) => { g.fillStyle = color; g.fillRect(0, Y(h1), 1024, Y(h0) - Y(h1)); };
  const dots = (h0, h1, color, n) => { g.fillStyle = color; for (let i = 0; i < n; i++) g.fillRect(R() * 1024, Y(h0) - R() * (Y(h0) - Y(h1)), 2, 2); };
  band(0, 0.3, '#c99a3b');                                     // gold ground
  dots(0.012, 0.072, '#8a5d1d', 1400); dots(0.22, 0.3, '#8a5d1d', 1600);
  band(0, 0.008, '#ece6da'); band(0.008, 0.011, '#1f2b56');
  band(0.07, 0.086, '#6b2e1d'); g.strokeStyle = '#d9b456'; g.lineWidth = 2;   // brown band with a gold fret
  for (let x = 0; x < 1024; x += 32) { g.beginPath(); g.moveTo(x, Y(0.074)); g.lineTo(x + 16, Y(0.083)); g.lineTo(x + 32, Y(0.074)); g.stroke(); }
  band(0.086, 0.205, '#1d2c6e'); dots(0.086, 0.205, '#3c56a8', 2600);        // deep blue body
  band(0.205, 0.222, '#4f8f4a');                                              // green collar
  band(0.296, 0.3, '#1f2b56');
  const motif = (x, h, s) => {                                               // small blue/red ornaments on the gold
    g.fillStyle = '#2e4fae'; g.beginPath(); g.ellipse(x, Y(h), 18 * s, 22 * s, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c0412a'; g.beginPath(); g.ellipse(x, Y(h) + 4 * s, 9 * s, 10 * s, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f0ece2'; g.fillRect(x - 3 * s, Y(h) - 10 * s, 6 * s, 6 * s);
  };
  for (let i = 0; i < 8; i++) { motif(64 + i * 128, 0.04, 1); motif(i * 128, 0.26, 1.1); }
  // the white panels: front (u = 0.5, -z) and back (u = 0 / 1)
  const panel = (cx) => {
    const x0 = cx - 150, x1 = cx + 150, y0 = Y(0.198), y1 = Y(0.094), r = 50;
    g.fillStyle = '#4a74d0'; g.beginPath(); g.roundRect(x0 - 8, y0 - 8, x1 - x0 + 16, y1 - y0 + 16, r + 6); g.fill();
    g.fillStyle = '#f4f1ea'; g.beginPath(); g.roundRect(x0, y0, x1 - x0, y1 - y0, r); g.fill();
    g.save(); g.beginPath(); g.roundRect(x0, y0, x1 - x0, y1 - y0, r); g.clip();
    const leaf = (x, y, a) => { g.fillStyle = '#2f6a35'; g.beginPath(); g.ellipse(x, y, 16, 7, a, 0, Math.PI * 2); g.fill(); };
    g.strokeStyle = '#5a3324'; g.lineWidth = 5; g.beginPath(); g.moveTo(x0 + 20, y1 - 30); g.quadraticCurveTo(cx - 40, y0 + 90, cx - 20, y0 + 20); g.stroke();   // branch
    for (let i = 0; i < 9; i++) leaf(x0 + 40 + R() * 260, y0 + 30 + R() * (y1 - y0 - 50), R() * 3);
    const peony = (x, y, r, c) => { for (let k = 0; k < 7; k++) { g.fillStyle = k % 2 ? c : '#f6d3e4'; g.beginPath(); g.arc(x + Math.cos(k) * r * 0.3, y + Math.sin(k * 1.3) * r * 0.3, r * (1 - k * 0.1), 0, Math.PI * 2); g.fill(); } };
    peony(cx + 70, y1 - 60, 34, '#d58bbd'); peony(cx + 60, y0 + 70, 26, '#c0412a'); peony(cx - 90, y0 + 50, 20, '#d58bbd');
    for (let i = 0; i < 6; i++) { g.fillStyle = '#e48fb0'; g.beginPath(); g.arc(cx - 60 + R() * 60, y0 + 30 + R() * 80, 7, 0, Math.PI * 2); g.fill(); }
    // the bird: a body, a head and a long tail sweeping down
    g.fillStyle = '#2c7a6a'; g.beginPath(); g.ellipse(cx - 25, y0 + 75, 22, 13, -0.6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1d3a7a'; g.beginPath(); g.arc(cx - 8, y0 + 56, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#d4552e'; g.beginPath(); g.moveTo(cx - 40, y0 + 85); g.quadraticCurveTo(cx - 70, y0 + 130, cx - 95, y1 - 10); g.lineTo(cx - 85, y1 - 12); g.quadraticCurveTo(cx - 55, y0 + 120, cx - 30, y0 + 88); g.fill();
    g.strokeStyle = '#d9b456'; g.lineWidth = 1.5; g.strokeRect(-10, -10, 1, 1);
    g.restore();
  };
  panel(512); panel(0); panel(1024);
  return texture(cv);
}
export function makeVase() {
  const group = new THREE.Group(); group.name = 'library_vase';
  const H = 0.3;
  const geo = lathe([[0.001, 0], [0.046, 0], [0.047, 0.006], [0.043, 0.014], [0.038, 0.035], [0.037, 0.06], [0.041, 0.072], [0.046, 0.08],
    [0.052, 0.088], [0.061, 0.11], [0.066, 0.14], [0.065, 0.165], [0.058, 0.19], [0.046, 0.207], [0.034, 0.222], [0.03, 0.24], [0.032, 0.262],
    [0.04, 0.284], [0.05, 0.298], [0.047, 0.3], [0.04, 0.295], [0.03, 0.27]], 36);
  const uv = geo.attributes.uv, p = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setY(i, Math.min(1, Math.max(0, p.getY(i) / H)));   // texture rows by height
  const vase = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: vaseTexture(), roughness: 0.28, metalness: 0.02 }));
  vase.castShadow = true; vase.receiveShadow = true; vase.name = 'library_vase_body';
  group.add(vase);
  const s = solid();
  [-1, 1].forEach((sx) => s.add(new THREE.TorusGeometry(0.014, 0.0045, 6, 12, Math.PI * 1.2), 0xd2a43c, { pos: [sx * 0.034, 0.238, 0], rot: [0, 0, sx > 0 ? -0.6 * Math.PI : 0.4 * Math.PI], scale: [1, 1.2, 1] }));   // loops bulging outwards
  const handles = new THREE.Mesh(s.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.6 }));
  handles.castShadow = true; handles.name = 'library_vase_handles';
  group.add(handles);
  return { group };
}

// ---------------------------------------------------------------- terrarium in a glass carafe (terrarium-carafe.jpg)
// A carafe with a waist and a bamboo lid; dark soil, a layer of moss and a small spiky plant inside.
export function makeTerrarium() {
  const group = new THREE.Group(); group.name = 'library_terrarium';
  const glass = new THREE.Mesh(lathe([[0.001, 0], [0.058, 0], [0.065, 0.01], [0.066, 0.06], [0.06, 0.115], [0.049, 0.165], [0.045, 0.2],
    [0.049, 0.235], [0.056, 0.262], [0.058, 0.27]], 32), new THREE.MeshStandardMaterial({
    name: 'glass', color: 0xe8f1ee, transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0, side: THREE.DoubleSide, depthWrite: false }));
  glass.renderOrder = 2; glass.name = 'library_terrarium_glass';
  const s = solid(), R = rng(3);
  s.add(new THREE.CylinderGeometry(0.06, 0.06, 0.016, 32), 0xc9a16a, { pos: [0, 0.278, 0] });                  // bamboo lid
  s.add(new THREE.CylinderGeometry(0.062, 0.057, 0.068, 24), 0x2a221b, { pos: [0, 0.036, 0] });                // soil
  s.add(new THREE.CylinderGeometry(0.063, 0.063, 0.012, 24), 0x8d9b3c, { pos: [0, 0.076, 0], tint: (c, x, y, z) => { c.offsetHSL(0, 0, (Math.sin(x * 260) * Math.cos(z * 230)) * 0.06); } });   // moss
  for (let i = 0; i < 8; i++) {                                                // narrow pointed leaves splaying upwards
    const a = (i / 8) * Math.PI * 2 + R() * 0.5, tilt = 0.25 + R() * 0.45, L = 0.1 + R() * 0.07;
    const leaf = new THREE.PlaneGeometry(1, 1, 1, 6), lp = leaf.attributes.position;
    for (let k = 0; k < lp.count; k++) {
      const v = lp.getY(k) + 0.5, w = 0.013 * Math.sin(Math.PI * Math.min(1, v * 0.95 + 0.05)) * (1 - v * 0.6);
      lp.setXYZ(k, lp.getX(k) * w * 2, v * L, -0.4 * L * v * v * tilt);
    }
    s.add(leaf, 0x4d7a3a, { pos: [Math.cos(a) * 0.008, 0.08, Math.sin(a) * 0.008], rot: [tilt, a + Math.PI / 2, 0], tint: (c, x, y) => c.offsetHSL(0, 0, (y - 0.12) * 0.6) });
  }
  const inner = new THREE.Mesh(s.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide }));
  inner.castShadow = true; inner.receiveShadow = true; inner.name = 'library_terrarium_inside';
  group.add(inner, glass);
  return { group };
}

// ---------------------------------------------------------------- monstera in a terracotta pot and a woven basket (monstera.jpg)
// Leaves and stems are one mesh with one alpha-cut leaf texture; they sway in the vertex shader (a time
// uniform, nothing else per frame). The pot and the basket are one vertex-coloured mesh.
function leafTexture() {
  const [cv, g] = canvas(512, 512), W = 448, cx = W / 2;
  const half = (t) => 205 * Math.pow(Math.sin(Math.PI * (0.1 + 0.9 * t)), 0.75) * (1 - 0.12 * t);   // half-width along the midrib
  const yAt = (t) => 500 - t * 488;
  const grad = g.createLinearGradient(0, 512, 0, 0); grad.addColorStop(0, '#2b6a2a'); grad.addColorStop(1, '#3f8a36');
  g.fillStyle = grad; g.beginPath();
  g.moveTo(cx, yAt(0.09));
  for (let i = 0; i <= 40; i++) { const t = i / 40; g.lineTo(cx - half(t), yAt(t)); }
  for (let i = 40; i >= 0; i--) { const t = i / 40; g.lineTo(cx + half(t), yAt(t)); }
  g.closePath(); g.fill();
  // the cuts: slits from the edge towards the midrib and a row of holes, cut out of the alpha
  g.globalCompositeOperation = 'destination-out';
  const R = rng(9);
  [-1, 1].forEach((s) => {
    for (let k = 0; k < 7; k++) {
      const t = 0.14 + k * 0.115 + (R() - 0.5) * 0.03, hw = half(t), inner = 0.28 + R() * 0.12;
      const x0 = cx + s * (hw + 4), y0 = yAt(t + 0.02), x1 = cx + s * hw * inner, y1 = yAt(t - 0.05);
      g.beginPath(); g.moveTo(x0, y0 - 9); g.lineTo(x1, y1); g.lineTo(x0, y0 + 9); g.closePath(); g.fill();
      if (k < 6 && R() < 0.8) { g.beginPath(); g.ellipse(cx + s * hw * (inner * 0.75), yAt(t + 0.06), 4 + R() * 4, 10 + R() * 6, s * 0.5, 0, Math.PI * 2); g.fill(); }
    }
  });
  // veins and midrib, only on the leaf that is left
  g.globalCompositeOperation = 'source-atop';
  g.strokeStyle = 'rgba(190,225,150,0.5)'; g.lineWidth = 6; g.beginPath(); g.moveTo(cx, yAt(0.08)); g.lineTo(cx, yAt(0.98)); g.stroke();
  g.lineWidth = 2.5;
  for (let k = 0; k < 14; k++) { const t = 0.12 + k * 0.058; [-1, 1].forEach((s) => { g.beginPath(); g.moveTo(cx, yAt(t)); g.quadraticCurveTo(cx + s * half(t) * 0.5, yAt(t + 0.03), cx + s * half(t + 0.06), yAt(t + 0.08)); g.stroke(); }); }
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#4c7d31'; g.fillRect(480, 0, 32, 512);                     // stems sample this strip
  return texture(cv);
}
export function makeMonstera() {
  const group = new THREE.Group(); group.name = 'library_monstera';
  const R = rng(21);
  // basket (woven straw, a belly and a rolled rim) and the terracotta pot standing in it
  const s = solid();
  const weave = (c, x, y, z) => {
    const row = Math.floor(y / 0.016), col = Math.floor((Math.atan2(z, x) + Math.PI) / (Math.PI * 2) * 56);
    c.offsetHSL(0, 0, ((row + col) % 2 ? 0.05 : -0.05) + (row % 4 === 0 ? -0.06 : 0) + (Math.sin(col * 1.7 + row) * 0.02));
  };
  const basket = [];
  for (let i = 0; i <= 20; i++) { const t = i / 20; basket.push([0.18 + 0.05 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 0.02 * t, 0.015 + t * 0.29]); }
  basket.unshift([0.17, 0], [0.001, 0]);
  basket.push([0.226, 0.312], [0.218, 0.322], [0.205, 0.31]);
  s.add(new THREE.LatheGeometry(basket.map(([r, y]) => new THREE.Vector2(r, y)), 56), 0xc8a26c, { tint: weave });
  [-1, 1].forEach((sx) => s.add(new THREE.TorusGeometry(0.03, 0.006, 6, 14, Math.PI), 0xb8925d, { pos: [sx * 0.226, 0.29, 0], rot: [0, Math.PI / 2, 0] }));   // rope handles
  s.add(lathe([[0.001, 0.2], [0.16, 0.2], [0.185, 0.3], [0.2, 0.38], [0.215, 0.385], [0.218, 0.44], [0.205, 0.445], [0.195, 0.43]], 36), 0xb5603a,
    { tint: (c, x, y, z) => { const n = Math.sin(x * 40 + y * 23) * Math.cos(z * 37 - y * 11); if (n > 0.55) c.lerp(C2.set(0xd9c2a8), (n - 0.55) * 1.6); } });   // terracotta, a little weathered
  s.add(new THREE.CircleGeometry(0.195, 24), 0x2e241c, { pos: [0, 0.425, 0], rot: [-Math.PI / 2, 0, 0] });   // soil
  const pot = new THREE.Mesh(s.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
  pot.castShadow = true; pot.receiveShadow = true; pot.name = 'library_monstera_pot';
  group.add(pot);

  // leaves on stems: yaw round the plant (0 = towards the viewer, -z), the height of the leaf base,
  // how far out it stands, pitch of the blade, its length
  const LEAVES = [[0.15, 1.62, 0.22, 0.35, 0.56], [-0.75, 1.5, 0.3, 0.25, 0.6], [0.95, 1.42, 0.32, 0.2, 0.55], [-1.6, 1.22, 0.3, 0.15, 0.5],
    [1.75, 1.15, 0.28, 0.2, 0.5], [0.4, 1.02, 0.34, -0.05, 0.48], [-0.35, 0.9, 0.3, -0.12, 0.42], [2.6, 1.32, 0.18, 0.3, 0.46], [-2.5, 1.05, 0.2, 0.2, 0.44]];
  const geos = [];
  const up = new THREE.Vector3(0, 1, 0);
  LEAVES.forEach(([a, h, out, pitch, L], li) => {
    const yaw = Math.PI + a;                                // a = 0 points to -z
    const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const base = new THREE.Vector3(dir.x * out, h, dir.z * out);
    const phase = li * 1.9 + R();
    // stem: from the soil up to the leaf base, bowing outwards
    const st = new THREE.Vector3((R() - 0.5) * 0.06, 0.43, (R() - 0.5) * 0.06);
    const curve = new THREE.CatmullRomCurve3([st, st.clone().lerp(base, 0.5).add(new THREE.Vector3(dir.x * 0.04, 0.05, dir.z * 0.04)), base]);
    const stem = new THREE.TubeGeometry(curve, 10, 0.009, 5, false);
    const su = stem.attributes.uv; for (let i = 0; i < su.count; i++) su.setXY(i, 0.97, 0.5);
    geos.push([stem, phase]);
    // the blade: a plane with its base at the stem top, droop along its length and a slight fold
    const leaf = new THREE.PlaneGeometry(1, 1, 4, 8), lp = leaf.attributes.position, lu = leaf.attributes.uv, W = L * 0.86;
    const d = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const side = new THREE.Vector3().crossVectors(up, d).normalize(), n = new THREE.Vector3().crossVectors(d, side).normalize();
    const twist = (R() - 0.5) * 0.5; side.applyAxisAngle(d, twist); n.applyAxisAngle(d, twist);
    for (let k = 0; k < lp.count; k++) {
      const u = lp.getX(k), v = lp.getY(k) + 0.5;
      const x = u * W, y = (v - 0.09) * L, z = -0.28 * L * v * v + 0.08 * W * Math.abs(u);   // droop and fold
      V.copy(base).addScaledVector(side, x).addScaledVector(d, y).addScaledVector(n, z);
      lp.setXYZ(k, V.x, V.y, V.z);
      lu.setX(k, lu.getX(k) * 448 / 512);
    }
    leaf.computeVertexNormals();
    geos.push([leaf, phase]);
  });
  const parts = geos.map(([g, ph]) => { const x = g.toNonIndexed(); g.dispose(); x.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(x.attributes.position.count).fill(ph), 1)); return x; });
  const tex = leafTexture();
  const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5 });
  const sway = { value: 0 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSway = sway;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uSway;\nattribute float aPhase;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float hh = max(0.0, position.y - 0.45);
        float sw = sin(uSway * 1.1 + aPhase) * 0.018 + sin(uSway * 2.3 + aPhase * 1.7) * 0.006;
        transformed.x += sw * hh * hh;
        transformed.z += sin(uSway * 0.9 + aPhase * 1.3) * 0.012 * hh * hh;
        transformed.y += sin(uSway * 1.7 + aPhase) * 0.004 * hh;`);
  };
  const leaves = new THREE.Mesh(mergeGeometries(parts), mat);
  parts.forEach((g) => g.dispose());
  leaves.name = 'library_monstera_leaves';
  leaves.castShadow = true; leaves.receiveShadow = true;
  leaves.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
  leaves.customDistanceMaterial = new THREE.MeshDistanceMaterial({ map: tex, alphaTest: 0.5 });
  group.add(leaves);
  return { group, sway };
}
