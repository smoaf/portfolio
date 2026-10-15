// Library (LIBRARY_PLAN phase L1): room details and the lucky cat.
//   - Simon's three things on the bookshelf (the lucky cat, the terrarium in its carafe, the painted
//     vase); the books where they stand are taken out of the shelf mesh (index only, the per-book
//     colours of the page's accents stay as they are)
//   - a monstera in a terracotta pot and a woven basket by the window, its leaves swaying
//   - the cat waves its raised paw while the library is open or in view; otherwise nothing runs
//   - click the cat (touch: a first tap shows it, a second zooms): the camera flies close to it;
//     Back or Esc returns
//   - the all-in-one computer is turned square on the desk, facing the chair
// Built from the workshop's patterns (workshop/stations.js): hover glow and label, two-tap, Back/Esc,
// a hidden keyboard button, holdView/releaseView on the page.
import * as THREE from 'three';
import { makeCat, makeVase, makeTerrarium, makeMonstera } from './props.js';

// where things stand (viewer coordinates: y up, the room's open side faces -z, +x is to the left
// in the default view). Shelf boards: tops at 3.09 + k * 0.43; bays 1.02 m wide, centres below.
const SHELF_Y = (k) => 3.09 + k * 0.43, SHELF_Z = 2.47;
const SPOTS = {
  cat: { x: -12.3, k: 3, clear: [-12.58, -12.02] },            // eye level, right of the desk
  vase: { x: -14.25, k: 2, clear: [-14.5, -14.0] },            // above the reading corner
  terrarium: { x: -10.05, k: 2, clear: [-10.3, -9.8] },        // towards the window, clear of the computer
};
const MONSTERA = { x: -8.75, z: 1.85, floor: 3.01, yaw: 0.2 }; // left of the room, in front of the window
const GLOW = new THREE.Color(0xffa95e);
const WAVE = { period: 1.5, swing: 0.32 };                     // seconds per beckon, radians either way
const SEE_FAR = 26;                                            // further than this the cat is a few pixels: it rests
const ROOM = new THREE.Vector3(-11.6, 4.4, 1.2);               // the room's middle, for the view test

const S = { host: null, ready: false, cat: null, monstera: null, zoomed: false, opening: false, hover: false, armed: false,
  home: null, seq: 0, t: 0, last: 0, waving: false, els: null, kbd: false, keySig: '' };
const vT = new THREE.Vector3(), sph = new THREE.Sphere(), frustum = new THREE.Frustum(), pm = new THREE.Matrix4();

// ---- DOM: the camp's classes (hover label, Back, the keyboard row)
function buildDom() {
  const style = document.createElement('style');
  style.textContent = 'body.lib-sub .nav, body.lib-sub .gear, body.lib-sub .controls, body.lib-sub .skypanel, body.lib-sub .markers { display: none !important; }';
  document.head.appendChild(style);
  const mk = (tag, cls, attrs = {}) => { const e = document.createElement(tag); e.className = cls; Object.assign(e, attrs); e.hidden = true; document.body.appendChild(e); return e; };
  const els = { tip: mk('div', 'tip'), back: mk('button', 'btn campback', { type: 'button', textContent: '‹ Back' }), keys: mk('div', 'camp-keys') };
  els.tip.textContent = 'Lucky cat';
  els.keys.setAttribute('role', 'group'); els.keys.setAttribute('aria-label', 'Library');
  els.back.addEventListener('click', back);
  return els;
}

// ---- the room: books out, things in, computer square
function clearBooks(root) {
  const books = root.getObjectByName('librarybooks');
  if (!books || !books.geometry.index) return;
  const g = books.geometry, pos = g.attributes.position, ix = g.index.array, n = pos.count;
  // one book = the vertices joined by shared positions and faces (as the page's accents do it)
  const parent = new Int32Array(n).map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const join = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
  const seen = new Map();
  for (let i = 0; i < n; i++) { const k = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`; if (seen.has(k)) join(i, seen.get(k)); else seen.set(k, i); }
  for (let f = 0; f < ix.length; f += 3) { join(ix[f], ix[f + 1]); join(ix[f], ix[f + 2]); }
  // each book's centre in the viewer's frame
  books.updateMatrixWorld(true);
  const sum = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i); vT.fromBufferAttribute(pos, i).applyMatrix4(books.matrixWorld);
    const s = sum.get(r) || [0, 0, 0, 0]; s[0] += vT.x; s[1] += vT.y; s[2] += vT.z; s[3]++; sum.set(r, s);
  }
  const gone = new Set();
  sum.forEach((s, r) => {
    const x = s[0] / s[3], y = s[1] / s[3];
    Object.values(SPOTS).forEach((sp) => { if (x > sp.clear[0] && x < sp.clear[1] && y > SHELF_Y(sp.k) && y < SHELF_Y(sp.k) + 0.38) gone.add(r); });
  });
  const keep = [];
  for (let f = 0; f < ix.length; f += 3) if (!gone.has(find(ix[f]))) keep.push(ix[f], ix[f + 1], ix[f + 2]);
  g.setIndex(keep);
  S.booksRemoved = gone.size;
}
// the all-in-one stood at an angle; turn it (body and screen together) about its stand until the
// screen is square to the room, facing the chair
function straightenComputer(root) {
  const body = root.getObjectByName('librarycomputer'), face = root.getObjectByName('librarycomputer_screen');
  if (!body || !face) return;
  root.updateMatrixWorld(true);
  const pts = [], box = new THREE.Box3().setFromObject(body), pivot = box.getCenter(new THREE.Vector3());
  const p = face.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) pts.push(vT.fromBufferAttribute(p, i).applyMatrix4(face.matrixWorld).clone());
  const depth = (a) => {                                // how deep the screen is front to back, turned by a
    let lo = Infinity, hi = -Infinity; const c = Math.cos(a), s = Math.sin(a);
    pts.forEach((q) => { const dx = q.x - pivot.x, dz = q.z - pivot.z, z = -s * dx + c * dz; lo = Math.min(lo, z); hi = Math.max(hi, z); });
    return hi - lo;
  };
  let best = 0, bd = Infinity;
  for (let a = -1.2; a <= 1.2; a += 0.0025) { const d = depth(a); if (d < bd) { bd = d; best = a; } }
  const turn = new THREE.Matrix4().makeTranslation(pivot.x, 0, pivot.z)
    .multiply(new THREE.Matrix4().makeRotationY(best)).multiply(new THREE.Matrix4().makeTranslation(-pivot.x, 0, -pivot.z));
  [body, face].forEach((m) => {
    const w = turn.clone().multiply(m.matrixWorld);
    const local = new THREE.Matrix4().copy(m.parent.matrixWorld).invert().multiply(w);
    local.decompose(m.position, m.quaternion, m.scale);
    m.updateMatrixWorld(true);
  });
  // the screen must face the chair (towards -z): if the turn left it facing the shelves, half a turn more
  const fc = new THREE.Box3().setFromObject(face).getCenter(new THREE.Vector3()), bc = new THREE.Box3().setFromObject(body).getCenter(new THREE.Vector3());
  if (fc.z > bc.z + 0.002) {
    const half = new THREE.Matrix4().makeTranslation(pivot.x, 0, pivot.z).multiply(new THREE.Matrix4().makeRotationY(Math.PI)).multiply(new THREE.Matrix4().makeTranslation(-pivot.x, 0, -pivot.z));
    [body, face].forEach((m) => { const w = half.clone().multiply(m.matrixWorld); new THREE.Matrix4().copy(m.parent.matrixWorld).invert().multiply(w).decompose(m.position, m.quaternion, m.scale); m.updateMatrixWorld(true); });
  }
  S.computerTurn = best;
}
function place(group, x, y, z, yaw = 0) { group.position.set(x, y, z); group.rotation.y = yaw; group.updateMatrixWorld(true); }

// ---- glow and picking (the cat only)
function catMats() { return S.cat.pick.map((m) => m.material).filter((m, i, a) => a.indexOf(m) === i); }
function setHover(on) {
  if (on === S.hover) return;
  S.hover = on;
  catMats().forEach((m) => {
    if (!m.userData.e0) m.userData.e0 = { c: m.emissive.clone(), i: m.emissiveIntensity };
    if (on) { m.emissive.copy(GLOW); m.emissiveIntensity = 0.3; } else { m.emissive.copy(m.userData.e0.c); m.emissiveIntensity = m.userData.e0.i; }
  });
  S.els.tip.hidden = !on;
  S.host.el.style.cursor = on ? 'pointer' : '';
}
function catAnchor(out) { return out.set(S.cat.group.position.x, S.cat.group.position.y + 0.3, S.cat.group.position.z); }
function screenOf(v) { const r = S.host.el.getBoundingClientRect(); v.project(S.host.camera); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }
function hitCat(ev) {
  const r = S.host.ray; S.host.setRay(ev);
  const h = r.intersectObjects(S.cat.pick, false)[0];
  if (!h) return false;
  const b = r.intersectObjects(S.blockers, false)[0];        // the shelves and the room in front of it
  return !(b && b.distance < h.distance - 0.03);
}
function nearCat(ev, reach) {                                  // fingers: a near miss counts
  const [x, y] = screenOf(catAnchor(vT).setY(vT.y - 0.18));
  return Math.hypot(x - ev.clientX, y - ev.clientY) < reach;
}

// ---- camera: close to the cat and back
function catPose() {
  const portrait = S.host.portrait(), fov = portrait ? 55 : 40, size = 0.42;
  const at = new THREE.Vector3(S.cat.group.position.x, S.cat.group.position.y + 0.13, S.cat.group.position.z);
  const el = S.host.el, aspect = el.clientWidth / Math.max(1, el.clientHeight);
  const vf = THREE.MathUtils.degToRad(fov), hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
  const d = Math.max((size * 0.55) / Math.tan(hf / 2), (size * 0.45) / Math.tan(vf / 2));
  return { eye: at.clone().addScaledVector(vT.set(0, 0.22, -1).normalize(), d), at, fov };
}
function zoom() {
  if (!S.ready || !S.host.inPlace() || S.zoomed || S.host.tweening()) return;
  const tok = ++S.seq;
  S.host.closePanel();
  S.home = S.host.holdView();
  S.zoomed = true; S.opening = true; S.armed = false; setHover(false);
  document.body.classList.add('lib-sub');
  S.els.back.hidden = false;
  const p = catPose();
  S.host.fixedFov(p.fov);
  S.host.flyTo(p.eye, p.at, p.fov, () => { if (tok === S.seq) S.opening = false; });
}
function back() {
  if (!S.zoomed) return;
  const tok = ++S.seq, h = S.home;
  if (S.kbd) S.refocus = true;
  S.zoomed = false; S.opening = false;
  document.body.classList.remove('lib-sub');
  S.els.back.hidden = true;
  S.host.flyTo(h.pos.clone(), h.target.clone(), h.fov, () => { if (tok === S.seq) { S.host.releaseView(h); S.home = null; } });
}

// ---- keyboard: Esc goes back; a hidden button (shown on focus, as at the camp) zooms to the cat
function onKey(e) {
  if (!S.host || !S.host.inPlace() || !S.zoomed) return;
  if (e.target.closest && e.target.closest('input, textarea')) return;
  if (e.key === 'Escape') { e.stopImmediatePropagation(); back(); return; }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.stopImmediatePropagation();   // no place switching while zoomed
}
function stepKeys() {
  const on = S.host.inPlace() && !S.zoomed && !S.host.tweening();
  const sig = on ? 'cat' : '';
  if (sig === S.keySig) return;
  S.keySig = sig; S.els.keys.innerHTML = ''; S.els.keys.hidden = !on;
  if (!on) return;
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'btn'; b.textContent = 'Lucky cat';
  b.addEventListener('click', zoom);
  S.els.keys.appendChild(b);
  const lost = !document.activeElement || document.activeElement === document.body || !document.activeElement.offsetParent;
  if (S.refocus && lost) b.focus({ preventScroll: true });
  S.refocus = false;
}

// ---- is the room on screen? (the library is the open place, or the camera is near and sees the cat)
function inView() {
  if (S.host.inPlace()) return true;
  const cam = S.host.camera;
  if (cam.position.distanceTo(S.cat.group.position) > SEE_FAR) return false;
  pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); frustum.setFromProjectionMatrix(pm);
  return frustum.intersectsSphere(sph.set(ROOM, 4.5));
}

export const library = {
  // index.html: once the model is loaded. host = the page's camera, pointer and view helpers
  setup(host, root) {
    S.host = host; S.els = buildDom();
    clearBooks(root);
    straightenComputer(root);
    const items = new THREE.Group(); items.name = 'library_items';
    S.cat = makeCat(); place(S.cat.group, SPOTS.cat.x, SHELF_Y(SPOTS.cat.k), SHELF_Z, 0);
    const vase = makeVase(); place(vase.group, SPOTS.vase.x, SHELF_Y(SPOTS.vase.k), SHELF_Z, 0.3);
    const terra = makeTerrarium(); place(terra.group, SPOTS.terrarium.x, SHELF_Y(SPOTS.terrarium.k), SHELF_Z, 0);
    S.monstera = makeMonstera(); place(S.monstera.group, MONSTERA.x, MONSTERA.floor, MONSTERA.z, MONSTERA.yaw);
    items.add(S.cat.group, vase.group, terra.group, S.monstera.group);
    host.scene.add(items);
    S.blockers = [];
    root.traverse((o) => { if (o.isMesh && /^library(shell|shelves|books|desk|computer|floor_lamp)$/.test(o.name)) S.blockers.push(o); });
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keydown', () => { S.kbd = true; }, true);          // how the visitor moves: keys or a pointer
    window.addEventListener('pointerdown', () => { S.kbd = false; }, true);
    S.ready = true;
  },
  // every frame while the station runs: the cat waves and the monstera sways only while the room is seen
  step(now) {
    if (!S.ready) return;
    const dt = S.last ? Math.min(0.1, (now - S.last) / 1000) : 0; S.last = now;
    stepKeys();
    if (S.hover && !S.els.tip.hidden) {
      const [x, y] = screenOf(catAnchor(vT)), r = S.host.el.getBoundingClientRect();
      S.els.tip.style.left = (x - r.left) + 'px'; S.els.tip.style.top = (y - r.top) + 'px';
    }
    const on = inView();
    S.waving = on;
    if (!on) return;                                    // out of view: the paw rests where it is, nothing else runs
    if (S.host.reduceMotion()) { S.cat.arm.rotation.x = 0; return; }
    S.t += dt;
    S.cat.arm.rotation.x = -WAVE.swing * (0.5 - 0.5 * Math.cos(S.t * Math.PI * 2 / WAVE.period));   // beckons forward and back
    S.monstera.sway.value = S.t;
  },
  tap(ev) {
    if (S.zoomed || S.host.tweening()) return;
    const on = hitCat(ev) || (ev.pointerType !== 'mouse' && nearCat(ev, 28));
    if (!on) { S.armed = false; setHover(false); return; }
    if (ev.pointerType !== 'mouse' && !S.armed) { S.armed = true; setHover(true); return; }
    zoom();
  },
  hover(ev) {
    if (S.zoomed || S.host.tweening()) return setHover(false);
    setHover(hitCat(ev));
  },
  // leaving the library some other way (menu, browser back, another place): put everything back at once
  reset() {
    if (!S.ready) return;
    S.seq++;
    S.zoomed = false; S.opening = false; S.home = null; S.armed = false; setHover(false);
    document.body.classList.remove('lib-sub');
    S.els.back.hidden = true;
  },
  resume(now) { S.last = now; },
  get zoomed() { return S.zoomed; },
  zoom, back,
  // tests
  state: () => ({ zoomed: S.zoomed, opening: S.opening, waving: S.waving, paw: S.cat ? +S.cat.arm.rotation.x.toFixed(3) : null, booksRemoved: S.booksRemoved, computerTurn: S.computerTurn, hover: S.hover, armed: S.armed }),
  screen: () => screenOf(catAnchor(vT).setY(vT.y - 0.18)),
};
