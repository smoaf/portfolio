// Hub guide robot (FEAT-020): a friendly robot that lives on the hub floor. Later it will guide
// visitors round the station; for now it walks, follows the visitor with its lens and greets them.
// An original design in homage to two film machines (the glowing lens of a ship's computer, a
// walking robot of four slabs); no names, lettering or logos anywhere.
//   - the body: four upright brushed-metal slabs side by side, ~1.5 m tall, the two middle ones a
//     little wider, fine vertical grooves and panel lines; the middle face is a dark panel with one
//     round lens (metal ring, dark glass dome, soft glowing centre) and a speaker grille below it
//   - it walks slowly between set spots on the free floor in front of the round table, pausing at
//     each and turning to the visitor; on tall screens (phones) only the spots that are in the
//     hub's view are used, so it always stays in sight from the top of the stairs
//   - walking: the outer slabs swing forward as legs while the middle ones carry the body
//   - the lens: its glowing centre and highlight turn towards the camera; warm amber with a slow
//     breathing glow while resting, brighter when greeting
//   - hover (computer): it stops, turns to the visitor, the lens brightens and a short line shows in a
//     small speech label next to it; a few seconds later it walks on
//   - click or tap (FEAT-024): the same stop, and its greeting asks "Tour or leave a message?" with two
//     buttons (the question is index.html's, host.ask); once it is closed, it walks on as before
// The routes were checked against the hub's furniture (stools, table, curved bench), the glass wall
// and the hanging screens (their lower edges hang below the robot's top), with half a metre to spare.
// The area pattern: setup(host), step(now), tap(ev), hover(ev), arrive(), reset(), resume(now).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// PLACEHOLDER text (Smo supplies the real one)
const GREETING = 'Hello. I’ll be your guide here soon.';

const FLOOR_Y = 3.013;                                   // the hub's floor (viewer coordinates)
const EYE = new THREE.Vector3(-27.7, 4.65, 0.0);         // the hub's view in index.html: the top of the stairs
const LOOK = Math.atan2(-0.4, -21.0 + 27.7);             // its view direction on the floor (radians from +x)
const ROOM = new THREE.Vector3(-22.85, 3.8, 0.0);        // the hub's middle, for the view test
const SEE_FAR = 30;
// the walk: a chain of floor points (x, z) in front of the table, from the left of the view to the
// right; spot: it pauses there. 'turn' is only a waypoint round the stools.
const CHAIN = [
  { id: 'left', x: -23.4, z: -2.95, spot: true },
  { id: 'near-left', x: -24.95, z: -0.95, spot: true },
  { id: 'middle', x: -25.2, z: -0.15, spot: true },
  { id: 'near-right', x: -25.25, z: 0.6, spot: true },
  { id: 'turn', x: -25.1, z: 2.2, spot: false },
  { id: 'right', x: -23.1, z: 3.15, spot: true },
];
const START = 1;
const SPEED = 0.32;                                      // m/s while walking
const TURN = 0.75;                                       // rad/s turning on the spot
const PAUSE = [4.5, 8.5];                                // seconds at a spot
const GREET = 4.5;                                       // seconds the greeting stays after the last hover or tap

// ---- the body's measures (metres)
const H = 1.5, PIVOT = 1.0, DEPTH = 0.2, GAP = 0.016;
const W_OUT = 0.2, W_MID = 0.26;
const SWING = 0.27;                                      // the outer slabs' swing (radians) at full stride
const STRIDE = 1.1;                                      // metres per full gait cycle
const AMBER = new THREE.Color(0xffa043);

const S = { host: null, ready: false, last: 0, t: 0, on: false,
  root: null, outer: null, mid: null, lens: null, core: null, halo: null, spark: null, mats: null, box: new THREE.Box3(),
  pos: new THREE.Vector2(), heading: 0, node: START, dir: 1, path: [], mode: 'pause', wait: 3, phase: 0, amp: 0,
  hovered: false, greetLeft: 0, asking: false, glow: 0, label: null, labelOn: false };
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), mInv = new THREE.Matrix4(), frustum = new THREE.Frustum(), pm = new THREE.Matrix4(), sph = new THREE.Sphere();

// ---- building the robot
function box(w, h, d, x, y, z) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; }
// grooves and panel lines on a slab: thin dark strips standing a hair proud of its faces
function slabLines(w, kind) {
  const g = [], t = 0.006, p = 0.0025, fz = DEPTH / 2 + p / 2;
  const hLine = (y) => { for (const s of [-1, 1]) g.push(box(w + 0.002, t, p, 0, y, s * fz)); g.push(box(p, t, DEPTH, w / 2 + p / 2, y, 0), box(p, t, DEPTH, -w / 2 - p / 2, y, 0)); };
  const vGroove = (x, y0, y1) => { for (const s of [-1, 1]) g.push(box(0.0035, y1 - y0, p, x, (y0 + y1) / 2, s * fz)); };
  if (kind === 'outer') {                                // stacked grooved blocks
    const cuts = [0.04, 0.4, 0.76, 1.12, 1.46];
    cuts.forEach(hLine);
    for (let k = 0; k < cuts.length - 1; k++) for (const x of [-w / 4, 0, w / 4]) vGroove(x, cuts[k] + 0.04, cuts[k + 1] - 0.04);
  } else {                                               // panel lines near top and bottom, fine grooves between
    [0.04, 0.3, 1.36, 1.46].forEach(hLine);
    for (const x of [-w / 3, w / 3]) vGroove(x, 0.34, 1.32);
  }
  return mergeGeometries(g);
}
function grilleTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#1a1b1e'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#050506';
  for (let y = 12; y < 128; y += 14) for (let x = 12 + ((y / 14) % 2) * 7; x < 250; x += 14) { g.beginPath(); g.arc(x, y, 3.6, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function build() {
  const metal = new THREE.MeshStandardMaterial({ name: 'guide_metal', color: 0xd3d1cc, metalness: 0.2, roughness: 0.45, envMapIntensity: 0.45 });
  const line = new THREE.MeshStandardMaterial({ name: 'guide_line', color: 0x1d1b18, roughness: 0.7, envMapIntensity: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ name: 'guide_face', color: 0x16171a, metalness: 0.2, roughness: 0.38, envMapIntensity: 0.45 });
  const ring = new THREE.MeshStandardMaterial({ name: 'guide_ring', color: 0xe4e2dd, metalness: 0.85, roughness: 0.22, envMapIntensity: 0.9 });
  const glass = new THREE.MeshStandardMaterial({ name: 'guide_glass', color: 0x0a0a0c, metalness: 0.1, roughness: 0.08, envMapIntensity: 1.2,
    emissive: AMBER.clone(), emissiveIntensity: 0.04, transparent: true, opacity: 0.88 });
  const grille = new THREE.MeshStandardMaterial({ name: 'guide_grille', map: grilleTexture(), roughness: 0.6, envMapIntensity: 0.3 });
  S.mats = { metal, line, dark, ring, glass };

  const root = new THREE.Group(); root.name = 'hub_guide';
  const xo = W_MID + 1.5 * GAP + W_OUT / 2, xm = W_MID / 2 + GAP / 2;
  const xs = [-xo, -xm, xm, xo];                          // slab centres, left to right
  // the outer pair: one swinging group (both legs move together), pivot near the top
  const outer = new THREE.Group(); outer.position.y = PIVOT; outer.name = 'guide_outer';
  const outerSlab = box(W_OUT, H, DEPTH, 0, H / 2 - PIVOT, 0), outerLines = slabLines(W_OUT, 'outer');
  outerLines.translate(0, -PIVOT, 0);
  for (const x of [xs[0], xs[3]]) {
    const m = new THREE.Mesh(outerSlab, metal); m.position.x = x;
    const l = new THREE.Mesh(outerLines, line); l.position.x = x;
    outer.add(m, l);
  }
  // the middle pair carries the face
  const mid = new THREE.Group(); mid.position.y = PIVOT; mid.name = 'guide_mid';
  const midSlab = box(W_MID, H, DEPTH, 0, H / 2 - PIVOT, 0), midLines = slabLines(W_MID, 'mid');
  midLines.translate(0, -PIVOT, 0);
  for (const x of [xs[1], xs[2]]) {
    const m = new THREE.Mesh(midSlab, metal); m.position.x = x;
    const l = new THREE.Mesh(midLines, line); l.position.x = x;
    mid.add(m, l);
    for (const y of [0.17, 1.4]) {                         // small dark square panels near top and bottom (front and back)
      for (const s of [-1, 1]) { const q = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.004), dark); q.position.set(x, y - PIVOT, s * (DEPTH / 2 + 0.002)); mid.add(q); }
    }
  }
  // the face: one dark panel across the two middle slabs, framed in linework
  const fw = 2 * W_MID + GAP - 0.07, fh = 0.86, fy = 0.92 - PIVOT, fz = DEPTH / 2;
  const face = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 0.012), dark); face.position.set(0, fy, fz + 0.006); mid.add(face);
  const frame = new THREE.Mesh(mergeGeometries([box(fw + 0.02, 0.01, 0.014, 0, fh / 2, 0), box(fw + 0.02, 0.01, 0.014, 0, -fh / 2, 0),
    box(0.01, fh, 0.014, fw / 2 + 0.005, 0, 0), box(0.01, fh, 0.014, -fw / 2 - 0.005, 0, 0)]), line);
  frame.position.set(0, fy, fz + 0.007); mid.add(frame);
  // the lens: polished ring, dark glass dome, soft glowing centre
  const lens = new THREE.Group(); lens.position.set(0, 1.12 - PIVOT, fz + 0.013); lens.name = 'guide_lens';
  const R = 0.072;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.009, 0.011, 12, 40), ring);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), glass); dome.rotation.x = Math.PI / 2; dome.scale.z = 0.55;
  const tex = glowTexture();
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: AMBER, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
  core.scale.setScalar(0.07); core.renderOrder = 2;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: AMBER, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.25 }));
  halo.scale.setScalar(0.32); halo.position.z = 0.03; halo.renderOrder = 2;
  const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
  spark.scale.setScalar(0.018); spark.renderOrder = 3;
  lens.add(rim, dome, core, halo, spark);
  mid.add(lens);
  // the speaker grille below the lens
  const gr = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), grille); gr.position.set(0, 0.7 - PIVOT, fz + 0.0125); mid.add(gr);

  root.add(outer, mid);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  S.root = root; S.outer = outer; S.mid = mid; S.lens = lens; S.core = core; S.halo = halo; S.spark = spark;
  return root;
}

// ---- where it may go
const node = (i) => CHAIN[i];
// the spots in the hub's view from the top of the stairs at this screen's shape (phones: the middle ones)
function allowed() {
  const r = S.host.el.getBoundingClientRect(), aspect = r.width / Math.max(1, r.height);
  const vfov = THREE.MathUtils.degToRad(S.host.portrait() ? 84 : 72);
  const half = Math.atan(Math.tan(vfov / 2) * aspect) - THREE.MathUtils.degToRad(4);
  const out = [];
  CHAIN.forEach((n, i) => {
    if (!n.spot) return;
    const a = Math.atan2(n.z - EYE.z, n.x - EYE.x);
    if (Math.abs(a - LOOK) <= half) out.push(i);
  });
  return out.length >= 2 ? out : [1, 2, 3];
}
function nextSpot() {
  const ok = allowed();
  if (!ok.includes(S.node)) {                            // the screen changed shape: the nearest spot in view
    let best = ok[0];
    for (const i of ok) if (Math.abs(i - S.node) < Math.abs(best - S.node)) best = i;
    return best;
  }
  let k = ok.indexOf(S.node) + S.dir;
  if (k < 0 || k >= ok.length) { S.dir = -S.dir; k = ok.indexOf(S.node) + S.dir; }
  return ok[Math.max(0, Math.min(ok.length - 1, k))];
}
function walkTo(target) {
  S.path = [];
  const d = target > S.node ? 1 : -1;
  for (let i = S.node + d; d > 0 ? i <= target : i >= target; i += d) S.path.push(i);
  S.mode = 'walk';
}
const faceCamera = () => { const c = S.host.camera.position; return Math.atan2(c.x - S.pos.x, c.z - S.pos.y); };
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
// turn towards a heading; true once it is there
function turnTo(h, dt) {
  const d = wrap(h - S.heading), s = TURN * dt;
  if (Math.abs(d) <= s) { S.heading = h; return true; }
  S.heading = wrap(S.heading + Math.sign(d) * s);
  return false;
}

// ---- the speech label
function makeLabel() {
  const b = document.createElement('div');
  b.className = 'bubble guide-say'; b.hidden = true;
  b.setAttribute('role', 'status'); b.setAttribute('aria-live', 'polite');
  b.dataset.placeholder = 'true';                        // placeholder text, see GREETING
  const p = document.createElement('p'); p.textContent = GREETING; p.style.margin = '0';
  b.appendChild(p);
  b.style.pointerEvents = 'none';
  document.body.appendChild(b);
  return b;
}
function showLabel(on) {
  const b = S.label;
  if (on === S.labelOn) return;
  S.labelOn = on;
  if (!on) { b.classList.remove('on'); b.hidden = true; return; }
  b.hidden = false; requestAnimationFrame(() => { if (S.labelOn) b.classList.add('on'); });
  placeLabel();
}
function placeLabel() {
  const b = S.label;
  if (!S.labelOn) return;
  vA.set(S.pos.x, FLOOR_Y + H + 0.12, S.pos.y).project(S.host.camera);
  const r = S.host.el.getBoundingClientRect(), bw = b.offsetWidth, bh = b.offsetHeight;
  const x = r.left + (vA.x + 1) / 2 * r.width, y = r.top + (1 - vA.y) / 2 * r.height;
  const top = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hh')) || 77) + 12;
  const cx = Math.max(16 + bw / 2, Math.min(window.innerWidth - 16 - bw / 2, x)), cy = Math.max(top + bh, y);
  b.style.left = cx + 'px'; b.style.top = cy + 'px';
  b.style.setProperty('--tail', Math.max(18, Math.min(bw - 18, bw / 2 + x - cx)) + 'px');
}

// ---- is the hub on screen?
function inView() {
  if (S.host.inPlace()) return true;
  const cam = S.host.camera;
  if (cam.position.distanceTo(ROOM) > SEE_FAR) return false;
  pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); frustum.setFromProjectionMatrix(pm);
  return frustum.intersectsSphere(sph.set(ROOM, 5.5));
}

// ---- every frame
function stepBody(dt) {
  const calm = S.host.reduceMotion();
  let walking = false, turning = false;
  if (S.asking || S.greetLeft > 0 || S.hovered) {        // greeting or asking: stop, turn to the visitor
    if (S.asking) S.greetLeft = Math.max(S.greetLeft, 0.01);
    else if (!S.hovered) S.greetLeft -= dt;
    turnTo(faceCamera(), dt * 1.6);
    if (!S.hovered && S.greetLeft <= 0) { S.greetLeft = 0; S.wait = Math.min(S.wait, 1.2); }
  } else if (S.mode === 'pause') {
    turnTo(faceCamera(), dt);
    S.wait -= dt;
    if (S.wait <= 0) { const t = nextSpot(); if (t !== S.node) walkTo(t); else S.wait = PAUSE[0]; }
  } else if (S.mode === 'walk') {
    const n = node(S.path[0]), dx = n.x - S.pos.x, dz = n.z - S.pos.y, d = Math.hypot(dx, dz);
    const h = Math.atan2(dx, dz);
    if (Math.abs(wrap(h - S.heading)) > 0.12 && d > 0.05) { turnTo(h, dt); walking = turning = true; }   // turning on the spot: small shuffling steps
    else {
      turnTo(h, dt);
      const s = Math.min(d, SPEED * dt * (0.55 + 0.45 * S.amp));
      S.pos.x += dx / (d || 1) * s; S.pos.y += dz / (d || 1) * s;
      walking = true;
      if (d - s < 0.01) {
        S.node = S.path.shift();
        if (!S.path.length) { S.mode = 'pause'; S.wait = PAUSE[0] + Math.random() * (PAUSE[1] - PAUSE[0]); }
      }
    }
  }
  // the gait: the outer slabs swing as legs, the middle ones carry the body (a smaller counter-swing)
  const want = walking ? (turning ? 0.35 : 1) * (calm ? 0.5 : 1) : 0;
  S.amp += (want - S.amp) * Math.min(1, dt * 2.5);
  if (S.amp > 0.002 || Math.abs(Math.sin(S.phase * Math.PI * 2)) > 0.01) {
    S.phase += (walking ? SPEED * dt / STRIDE : dt * 0.5);
    if (!walking && S.amp < 0.01) S.phase = Math.round(S.phase * 2) / 2;   // settle upright
  }
  const s0 = Math.sin(S.phase * Math.PI * 2), s = Math.sign(s0) * Math.pow(Math.abs(s0), 0.75);   // a little mechanical: dwell at the ends
  const aO = SWING * S.amp * s, aM = -0.45 * SWING * S.amp * s;
  S.outer.rotation.x = aO; S.mid.rotation.x = aM;
  const drop = PIVOT * (1 - Math.cos(Math.min(Math.abs(aO), Math.abs(aM))));   // the body dips as both sides lean
  S.root.position.set(S.pos.x, FLOOR_Y - drop, S.pos.y);
  S.root.rotation.y = S.heading;
}
function stepLens(dt, now) {
  const greet = S.asking || S.greetLeft > 0 || S.hovered ? 1 : 0;
  S.glow += (greet - S.glow) * Math.min(1, dt * 4);
  const breathe = S.host.reduceMotion() ? 0.5 : 0.5 + 0.5 * Math.sin(now / 1000 * Math.PI * 2 / 4.6);
  const night = S.host.night();
  const k = (0.55 + 0.3 * breathe) * (1 - S.glow) + 1.35 * S.glow;
  S.core.material.opacity = Math.min(1, 0.55 + 0.4 * k);
  S.core.scale.setScalar(0.05 + 0.025 * k);
  S.halo.material.opacity = (0.12 + 0.16 * k) * (1 + 0.5 * night);
  S.halo.scale.setScalar(0.22 + 0.16 * k);
  S.mats.glass.emissiveIntensity = 0.03 + 0.09 * k;
  // the glowing centre and the highlight turn towards the camera
  S.lens.updateMatrixWorld(true);
  mInv.copy(S.lens.matrixWorld).invert();
  vA.copy(S.host.camera.position).applyMatrix4(mInv).normalize();
  if (vA.z < 0.35) { vA.z = 0.35; vA.normalize(); }
  S.core.position.set(vA.x * 0.03, vA.y * 0.03, 0.01 + vA.z * 0.012);
  S.spark.position.set(vA.x * 0.045 - 0.016, vA.y * 0.045 + 0.018, 0.04);
  // the station's light: the metal reads darker at night, like the plaster round it
  const e = 0.45 - 0.25 * night;
  S.mats.metal.envMapIntensity = e; S.mats.dark.envMapIntensity = e; S.mats.ring.envMapIntensity = e * 2;
}

function setup(host) {
  S.host = host;
  host.scene.add(build());
  S.label = makeLabel();
  const n = node(START);
  S.pos.set(n.x, n.z); S.node = START; S.heading = Math.atan2(EYE.x - n.x, EYE.z - n.z);
  S.mode = 'pause'; S.wait = 2 + Math.random() * 3;
  stepBody(0);
  S.ready = true;
}
function step(now) {
  if (!S.ready) return;
  const dt = S.last ? Math.min(0.1, Math.max(0, (now - S.last) / 1000)) : 0; S.last = now;
  S.on = inView();
  S.root.visible = true;
  if (!S.host.inPlace()) { S.hovered = false; S.greetLeft = 0; S.asking = false; showLabel(false); }
  if (!S.on) return;                                     // out of sight: it waits where it is
  stepBody(dt);
  stepLens(dt, now);
  showLabel(S.host.inPlace() && !S.asking && (S.hovered || S.greetLeft > 0));   // while asking, the question shows instead
  placeLabel();
}
function hit(ev) {
  if (!S.ready || !S.host.inPlace()) return false;
  S.host.setRay(ev);
  S.root.updateMatrixWorld(true);
  S.box.setFromObject(S.root).expandByScalar(0.06);
  return S.host.ray.ray.intersectsBox(S.box);
}
function hover(ev) {
  const on = !!ev && hit(ev);
  if (S.hovered && !on) S.greetLeft = GREET;            // after the pointer leaves it stays a few seconds
  S.hovered = on;
  return on;
}
function tap(ev) {
  if (!hit(ev)) return false;
  S.host.ask({ lead: GREETING, at: (v) => v.set(S.pos.x, FLOOR_Y + H + 0.12, S.pos.y),
    done: () => { S.asking = false; S.greetLeft = Math.min(S.greetLeft, 0.01); } });   // walks on as before
  S.asking = true;
  return true;
}
function arrive() { S.last = 0; }
function reset() { S.hovered = false; S.greetLeft = 0; S.asking = false; if (S.label) showLabel(false); }
function resume(now) { S.last = now; }

export const guide = { setup, step, tap, hover, arrive, reset, resume,
  // tests
  state: () => ({ ready: S.ready, on: S.on, mode: S.mode, node: CHAIN[S.node].id, path: S.path.map((i) => CHAIN[i].id), pos: [+S.pos.x.toFixed(2), +S.pos.y.toFixed(2)],
    heading: +S.heading.toFixed(2), amp: +S.amp.toFixed(2), hovered: S.hovered, asking: S.asking, greet: +S.greetLeft.toFixed(2), glow: +S.glow.toFixed(2), label: S.labelOn,
    allowed: S.ready ? allowed().map((i) => CHAIN[i].id) : [] }),
  screen() {                                             // where on the page the lens is
    S.lens.getWorldPosition(vB).project(S.host.camera);
    const r = S.host.el.getBoundingClientRect();
    return [r.left + (vB.x + 1) / 2 * r.width, r.top + (1 - vB.y) / 2 * r.height, vB.z];
  },
  wait(sec) { S.wait = sec; },
  chain: CHAIN,
};
