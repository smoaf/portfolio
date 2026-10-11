// Workshop stations: the framework every workshop station plugs into (WORKSHOP_PLAN phase W0).
// Built from the camp's patterns: hovering a station shows a glow and its label, a click zooms the
// camera to it (touch: the first tap shows it, a second tap on the same one acts), Back or Esc
// returns to the workshop view. While a station is open, its own controls take over and the page
// skips everything outside the workshop (figure, fire, turbine, projectors ...).
//
// A station is one file in workshop/ that calls `register({...})` when it is imported; index.html
// imports each station with one line. A station is:
//   id, label            name for the hover label and the keyboard buttons
//   pick()               the meshes a click hits (their materials glow on hover; give them own
//                        materials with ws.own() in setup so the glow stays on the station)
//   view                 camera pose when open: { at: [x, y, z], from: [dx, dy, dz], size } (viewer
//                        coordinates; `size` metres of width are kept in frame, phones step back)
//                        or { eye, at, fov }
//   setup(ws)            once, when the model has loaded (cheap: build heavy things on first enter)
//   enter(ws), exit(ws)  the station opens / closes
//   update(dt, now, s, ws)  every frame; s = { open: this station is open, inside: the visitor is in
//                        the workshop, focus: id of the open station or null }
//   pointer(type, ev, ws)  while open: 'down' | 'move' | 'up' with the pointer event; return true to
//                        take it (no camera move, no tap)
//   key(ev, ws)          while open: return true to take a key
//   hint                 one line shown when the station opens ("Drag the knobs" ...)
//   sound                true: the station makes sound, so the mute toggle shows while it is open
//   placeholder          an empty spot (layout.js); a real station with the same id replaces it
// Shared code for stations: workshop/audio.js (the signal chain) and workshop/layout.js (the desk
// and the spots).
import * as THREE from 'three';
import * as audio from './audio.js';
import { setupLayout, SPOTS } from './layout.js';

const defs = new Map();                                // id -> station, in registration order
export function register(def) {
  const old = defs.get(def.id);
  if (old && !old.placeholder && !def.placeholder) console.warn('workshop: station registered twice', def.id);
  if (old && def.placeholder) return;                  // a real station already took this spot
  defs.set(def.id, def);
}

const GLOW = new THREE.Color(0xffa95e);
const S = { host: null, root: null, ready: false, focus: null, hover: null, armed: null, home: null, seq: 0, last: 0, els: null, keySig: '' };
const vT = new THREE.Vector3(), vU = new THREE.Vector3(), sph = new THREE.Sphere(), bx = new THREE.Box3();

// ---- what stations get to work with
const ws = {
  THREE, audio, SPOTS,
  get scene() { return S.host.scene; }, get camera() { return S.host.camera; }, get renderer() { return S.host.renderer; },
  get el() { return S.host.el; }, get root() { return S.root; },
  mesh: (name) => S.root.getObjectByName(name),        // glTF node names drop the '/': 'workshopprinter_bed'
  own(meshes) {                                        // give meshes their own materials (glow, colour changes)
    meshes.forEach((m) => { if (m && m.material && !m.userData.wsOwn) { m.material = m.material.clone(); m.userData.wsOwn = true; } });
  },
  ray(ev) { S.host.setRay(ev); return S.host.ray; },  // the page's raycaster, aimed at the pointer
  open: () => S.focus,
  go: (id) => go(id),
  back: () => back(),
  say: (text) => say(text),
  markShadows: () => S.host.markShadows(),
  fly(view, done) { const p = poseFor(view); S.host.fixedFov(p.fov); S.host.flyTo(p.eye, p.at, p.fov, done); },   // move the camera inside a station
  portrait: () => S.host.portrait(),
  sound() { const c = audio.start(); if (c && c.state === 'suspended') c.resume(); return c; },   // from a click: make or wake the audio
  reduceMotion: () => S.host.reduceMotion(),
  timeOfDay: () => S.host.timeOfDay(),
};

// ---- DOM: hover label, Back, hint, mute toggle, and the keyboard row (the camp's classes)
const CSS = `
  body.ws-sub .nav, body.ws-sub .gear, body.ws-sub .controls, body.ws-sub .skypanel, body.ws-sub .markers { display: none !important; }
  .ws-mute { position: fixed; z-index: 22; right: 16px; top: calc(var(--hh, 77px) + 12px); color: var(--glass-ink); background: var(--glass-strong);
             border: 1px solid var(--glass-line); -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur); font-size: 11px; }
  /* a station's own row of controls along the bottom (presets, print choices ...) */
  .ws-bar { position: fixed; z-index: 22; left: 50%; transform: translateX(-50%); bottom: calc(16px + env(safe-area-inset-bottom, 0px));
            display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 6px; width: max-content; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 6px;
            color: var(--glass-ink); background: var(--glass-strong); border: 1px solid var(--glass-line); -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur); }
  .ws-bar[hidden] { display: none; }
  .ws-bar .btn { font-size: 11px; padding: 10px 12px; min-height: 40px; border-color: var(--glass-line); }
  .ws-bar .btn[aria-pressed="true"] { box-shadow: inset 0 -2px 0 currentColor; border-color: currentColor; }   /* the site's pressed look, a little stronger */
  .ws-bar .lbl { font: 500 10.5px/1 var(--font-data); letter-spacing: 0.1em; text-transform: uppercase; color: var(--glass-soft); padding: 0 4px; }
  .ws-bar .msg { flex-basis: 100%; text-align: center; font: 400 12px/1.35 var(--font-display); color: var(--glass-soft); padding: 2px 4px 0; }
  .ws-bar .msg:empty { display: none; }
  .ws-bar input[type=range] { width: 110px; accent-color: var(--glass-ink); }
  body.ws-sub .camp-hint { bottom: calc(var(--ws-bar, 16px) + 12px + env(safe-area-inset-bottom, 0px)); }
`;
function buildDom() {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const mk = (tag, cls, attrs = {}) => { const e = document.createElement(tag); e.className = cls; Object.assign(e, attrs); e.hidden = true; document.body.appendChild(e); return e; };
  const els = {
    tip: mk('div', 'tip'),
    hint: mk('div', 'camp-hint'),
    back: mk('button', 'btn campback', { type: 'button', textContent: '‹ Back' }),
    mute: mk('button', 'btn ws-mute', { type: 'button' }),
    keys: mk('div', 'camp-keys'),
  };
  els.keys.setAttribute('role', 'group'); els.keys.setAttribute('aria-label', 'Workshop');
  els.back.addEventListener('click', back);
  els.mute.addEventListener('click', () => audio.mute(!audio.isMuted()));
  const paintMute = (on) => { els.mute.textContent = on ? 'Muted' : 'Sound'; els.mute.setAttribute('aria-pressed', String(on)); };
  audio.onMute(paintMute); paintMute(audio.isMuted());
  return els;
}

// ---- glow
function mats(def) { return (def.pick ? def.pick() : []).filter(Boolean).flatMap((m) => (Array.isArray(m.material) ? m.material : [m.material])); }
function setGlow(def, on) {
  if (!def) return;
  mats(def).forEach((m) => {
    if (!m || !m.emissive) return;
    if (!m.userData.wsE0) m.userData.wsE0 = { c: m.emissive.clone(), i: m.emissiveIntensity };
    if (on) { m.emissive.copy(GLOW); m.emissiveIntensity = 0.3; } else { m.emissive.copy(m.userData.wsE0.c); m.emissiveIntensity = m.userData.wsE0.i; }
  });
}

// ---- picking: the nearest station mesh under the pointer
function pickAt(ev) {
  const r = ws.ray(ev);
  let best = null, d = Infinity;
  defs.forEach((def) => {
    const ms = def.pick ? def.pick().filter((m) => m && m.visible) : [];
    if (!ms.length) return;
    const h = r.intersectObjects(ms, false)[0];
    if (h && h.distance < d) { d = h.distance; best = def; }
  });
  // the shell, walls and furniture hide what stands behind them
  if (best && S.blockers.length) { const b = r.intersectObjects(S.blockers, false)[0]; if (b && b.distance < d - 0.05) return null; }
  return best;
}
function setHover(def) {
  if (def === S.hover) return;
  setGlow(S.hover, false);
  S.hover = def;
  setGlow(def, true);
  S.els.tip.hidden = !def;
  if (def) S.els.tip.textContent = def.label;
  S.host.el.style.cursor = def ? 'pointer' : '';
}
function anchor(def, out) {                            // where the label sits: above the station
  const ms = def.pick ? def.pick().filter(Boolean) : [];
  if (!ms.length) return out.set(...def.view.at);
  bx.makeEmpty(); ms.forEach((m) => bx.expandByObject(m));
  bx.getCenter(out); out.y = bx.max.y + 0.08;
  return out;
}

// ---- camera: fly to a station and back
function poseFor(v) {
  const portrait = S.host.portrait();
  const fov = v.fov || (portrait ? 55 : 40);
  const at = new THREE.Vector3(...v.at);
  if (v.eye) return { eye: new THREE.Vector3(...v.eye), at, fov };
  const el = S.host.el, aspect = el.clientWidth / Math.max(1, el.clientHeight);
  const vf = THREE.MathUtils.degToRad(fov), hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
  // keep `size` metres across and `size * 0.7` up and down in frame, with a little air
  const d = Math.max((v.size * 0.55) / Math.tan(hf / 2), (v.size * 0.4) / Math.tan(vf / 2));
  const dir = vT.set(...v.from).normalize();
  return { eye: at.clone().addScaledVector(dir, d), at, fov };
}
function go(id) {
  const def = defs.get(id);
  if (!def || !S.ready || !S.host.inPlace() || S.focus === id) return;
  const tok = ++S.seq;
  if (def.sound) ws.sound();                           // still inside the click: browsers only allow audio from one
  S.host.closePanel();
  const h = S.host.holdView();                         // the camera is ours now
  if (!S.home) S.home = h;                             // the workshop view to return to (kept while flying back)
  if (S.focus) close(false);
  S.armed = null; setHover(null);
  S.focus = id; S.opening = true;
  document.body.classList.add('ws-sub');
  S.els.back.hidden = false; S.els.mute.hidden = !def.sound;
  S.els.hint.hidden = true;
  const p = poseFor(def.view);
  S.host.fixedFov(p.fov);
  S.host.flyTo(p.eye, p.at, p.fov, () => {
    if (tok !== S.seq) return;
    S.opening = false;
    if (def.enter) def.enter(ws);
    if (def.hint) say(def.hint);
  });
}
function close(fly) {                                  // close the open station (and fly back if asked)
  const def = defs.get(S.focus);
  if (def && def.exit && !S.opening) def.exit(ws);
  S.focus = null; S.opening = false; S.drag = false;
  S.els.hint.hidden = true;
  if (!fly) return;
  const tok = ++S.seq, h = S.home;
  document.body.classList.remove('ws-sub');
  S.els.back.hidden = true; S.els.mute.hidden = true;
  S.host.flyTo(h.pos.clone(), h.target.clone(), h.fov, () => { if (tok === S.seq) { S.host.releaseView(h); S.home = null; } });
}
function back() { if (S.focus) close(true); }
// a station's bar of HTML controls along the bottom, shown while it is open (the hint moves above it)
export function bar(cls = '') {
  const e = document.createElement('div');
  e.className = 'ws-bar ' + cls; e.hidden = true; e.setAttribute('role', 'group');
  document.body.appendChild(e);
  const fit = () => document.body.style.setProperty('--ws-bar', e.hidden ? '16px' : (e.offsetHeight + 16) + 'px');
  return { el: e, show(on) { e.hidden = !on; fit(); }, fit };
}
function say(text) {
  const h = S.els.hint;
  h.textContent = text; h.hidden = !text; h.classList.remove('gone');
  clearTimeout(say.t); if (text) say.t = setTimeout(() => h.classList.add('gone'), 6000);
}

// ---- keyboard: Esc goes back; the open station may take keys; a hidden row of buttons (shown on
// focus, as at the camp) opens the stations without a pointer
function onKey(e) {
  if (!S.host || !S.host.inPlace()) return;
  if (e.target.closest && e.target.closest('input, textarea')) return;
  if (!S.focus) return;
  const def = defs.get(S.focus);
  if (def && def.key && !S.opening && def.key(e, ws)) { e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (e.key === 'Escape') { e.stopImmediatePropagation(); back(); return; }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.stopImmediatePropagation();   // no place switching from inside a station
}
function stepKeys() {
  const ids = S.host.inPlace() && !S.focus && !S.host.tweening() ? [...defs.keys()] : [];
  const sig = ids.join(',');
  if (sig === S.keySig) return;
  const had = S.els.keys.contains(document.activeElement);
  S.keySig = sig; S.els.keys.innerHTML = ''; S.els.keys.hidden = !ids.length;
  ids.forEach((id) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn'; b.textContent = defs.get(id).label;
    b.addEventListener('click', () => go(id));
    S.els.keys.appendChild(b);
  });
  if (had && S.els.keys.firstChild) S.els.keys.firstChild.focus({ preventScroll: true });
}

// ---- pointer while a station is open: the station's own controls come first
function onPointer(type, ev) {
  if (!S.focus || S.opening || S.host.tweening()) return false;
  const def = defs.get(S.focus);
  if (!def.pointer) return false;
  if (type === 'down') { S.drag = !!def.pointer('down', ev, ws); return S.drag; }
  if (type === 'up') { const was = S.drag; S.drag = false; def.pointer('up', ev, ws); return was; }
  return !!def.pointer('move', ev, ws) || S.drag;
}

export const workshop = {
  // index.html: once the model is loaded. host = the page's camera, pointer and view helpers
  setup(host, root) {
    S.host = host; S.root = root; S.els = buildDom();
    S.blockers = [];
    root.traverse((o) => { if (o.isMesh && /^workshop(shell|bench|table|glass_partition|pegboard)$/.test(o.name)) S.blockers.push(o); });
    setupLayout(ws);                                   // wider desk, drone on the wall, the empty spots
    defs.forEach((def) => { if (def.setup) def.setup(ws); });
    const el = host.el;
    // capture phase: a station's drag wins over the camera, taps never reach the place picker
    el.addEventListener('pointerdown', (ev) => { if (onPointer('down', ev)) { ev.stopImmediatePropagation(); el.setPointerCapture(ev.pointerId); } }, true);
    el.addEventListener('pointermove', (ev) => { if (onPointer('move', ev)) ev.stopImmediatePropagation(); }, true);
    el.addEventListener('pointerup', (ev) => { if (onPointer('up', ev)) ev.stopImmediatePropagation(); }, true);
    window.addEventListener('keydown', onKey, true);
    S.ready = true;
    if (S.early && host.inPlace()) this.arrive();
  },
  // every frame (replaces the page's old stepPrinter)
  step(now) {
    if (!S.ready) return;
    const dt = S.last ? Math.min(0.1, (now - S.last) / 1000) : 0; S.last = now;
    const inside = S.host.inPlace();
    defs.forEach((def) => { if (def.update) def.update(dt, now, { open: S.focus === def.id && !S.opening, inside, focus: S.focus }, ws); });
    if (S.hover && !S.els.tip.hidden) {
      anchor(S.hover, vU).project(S.host.camera);
      const el = S.host.el;
      S.els.tip.style.left = ((vU.x + 1) / 2 * el.clientWidth) + 'px'; S.els.tip.style.top = ((1 - vU.y) / 2 * el.clientHeight) + 'px';
    }
    stepKeys();
  },
  // a tap on the canvas while the visitor is in the workshop
  tap(ev) {
    if (S.focus || S.host.tweening()) return;
    const def = pickAt(ev);
    if (!def) { S.armed = null; setHover(null); return; }
    if (ev.pointerType !== 'mouse' && S.armed !== def.id) { S.armed = def.id; setHover(def); return; }
    go(def.id);
  },
  hover(ev) {
    if (S.focus || S.host.tweening()) return setHover(null);
    setHover(pickAt(ev));
  },
  // arriving in the workshop (place onEnter)
  arrive() {
    if (!S.ready) { S.early = true; return; }          // arrived by URL before the model loaded: setup() calls it again
    defs.forEach((def) => { if (def.arrive) def.arrive(ws); });
    const h = S.els.hint;
    h.textContent = (matchMedia('(hover: hover)').matches ? 'Click' : 'Tap') + ' a station to try it';
    h.hidden = false; h.classList.remove('gone');
    clearTimeout(say.t); say.t = setTimeout(() => h.classList.add('gone'), 6000);
  },
  // leaving the workshop some other way (menu, browser back, another place): put everything back at once
  reset() {
    if (!S.ready) return;
    S.seq++;
    if (S.focus) close(false);
    S.home = null; S.armed = null; setHover(null);
    document.body.classList.remove('ws-sub');
    S.els.back.hidden = true; S.els.mute.hidden = true; S.els.hint.hidden = true;
    audio.dispose();                                   // Web Audio is released on leaving
  },
  resume(now) { S.last = now; defs.forEach((def) => { if (def.resume) def.resume(now); }); },
  get focused() { return S.focus; },
  get(id) { return defs.get(id); },
  list: () => [...defs.values()].map((d) => ({ id: d.id, label: d.label, placeholder: !!d.placeholder })),
  go, back, ws,
  screen(id) {                                         // tests: where on screen a station is
    const def = defs.get(id); anchor(def, vU); vU.y -= 0.1; vU.project(S.host.camera);
    const r = S.host.el.getBoundingClientRect();
    return [r.left + (vU.x + 1) / 2 * r.width, r.top + (1 - vU.y) / 2 * r.height];
  },
};

// ---- shared: front panels (the amp, the scope, the synth, later the pedal and the delay)
// A panel is a flat face drawn on a canvas (silkscreen, labels, jacks) in a group whose local frame
// is x right, y up and z out of the face; everything on it is placed in canvas pixels. Knobs, buttons
// and LEDs are instanced meshes on the face, so a whole panel is a few draw calls and turning a knob
// never re-uploads the texture. Knobs turn by dragging up/down (or left/right); buttons act on press.
//   const P = makePanel(ws, { w: 0.4, h: 0.2, px: 1024, draw(g, P) { ... } })
//   P.knob({ x, y, r, value, steps, color, onChange }), P.button({ x, y, w, h, color, lit, litColor, onPress }),
//   P.led({ x, y, r, color }).set(0..1), P.jack({ x, y, ...anything }) (hit test only; draw it with P.drawJack)
//   P.build() once after adding controls; P.paint() redraws the face; P.pointer(type, ev, { jack }) while open
const KNOB_GEO = (() => {
  const body = new THREE.CylinderGeometry(1, 1.08, 1, 28, 1); body.rotateX(Math.PI / 2); body.translate(0, 0, 0.5);
  return body;
})();
const KNOB_MARK = (() => { const m = new THREE.BoxGeometry(0.16, 0.78, 0.08); m.translate(0, 0.5, 1.02); return m; })();
const BOX = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
const DISC = new THREE.CylinderGeometry(1, 1, 0.3, 14).rotateX(Math.PI / 2).translate(0, 0, 0.15);
const KM = new THREE.Matrix4(), KQ = new THREE.Quaternion(), KP = new THREE.Vector3(), KS = new THREE.Vector3(), KZ = new THREE.Vector3(0, 0, 1), KC = new THREE.Color();
export function makePanel(wsx, { w, h, px = 1024, draw, faceMat = {} }) {
  const W = px, H = Math.round(px * h / w), k = w / W;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.05,
    emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.1, ...faceMat }));
  const group = new THREE.Group(); group.add(face);
  const P = { group, face, canvas, g, W, H, k, w, h, tex, knobs: [], buttons: [], leds: [], jacks: [], drag: null, meshes: [face] };
  P.local = (x, y, z = 0, out = new THREE.Vector3()) => out.set((x / W - 0.5) * w, (0.5 - y / H) * h, z);
  P.world = (x, y, z = 0, out = new THREE.Vector3()) => group.localToWorld(P.local(x, y, z, out));
  P.knob = (o) => { const c = { kind: 'knob', value: 0.5, r: 24, color: 0x1c1c1c, mark: 0xf2efe8, ...o }; c.set = (v, quiet) => setKnob(c, v, quiet); P.knobs.push(c); return c; };
  P.button = (o) => { const c = { kind: 'button', w: 40, h: 26, color: 0xd9d4ca, litColor: 0xff8a3d, lit: false, ...o }; c.light = (on) => { c.lit = !!on; syncButtons(); }; P.buttons.push(c); return c; };
  P.led = (o) => { const c = { kind: 'led', r: 7, color: 0xff3b2f, level: 0, ...o }; c.set = (l) => { if (Math.abs(l - c.level) > 0.02) { c.level = l; P.ledsDirty = true; } }; P.leds.push(c); return c; };
  P.jack = (o) => { const c = { kind: 'jack', r: 22, ...o }; P.jacks.push(c); return c; };
  function setKnob(c, v, quiet) {
    v = Math.max(0, Math.min(1, v));
    if (c.steps) v = Math.round(v * (c.steps - 1)) / (c.steps - 1);
    if (v === c.value && quiet !== false) { return; }
    c.value = v; syncKnob(c);
    if (!quiet && c.onChange) c.onChange(v, c);
  }
  // instanced meshes for every control
  let knobI, markI, btnI, ledI;
  const knobMat = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.2 }), markMat = new THREE.MeshBasicMaterial();
  const btnMat = new THREE.MeshStandardMaterial({ roughness: 0.5 }), ledMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  function syncKnob(c) {
    if (!knobI) return;
    const a = (c.steps ? 0.75 : 0.75) * Math.PI * (1 - 2 * c.value);   // -135° .. +135°
    KQ.setFromAxisAngle(KZ, a); P.local(c.x, c.y, 0, KP); KS.set(c.r * k, c.r * k, c.r * k * (c.tall || 0.8));
    KM.compose(KP, KQ, KS); knobI.setMatrixAt(c.i, KM); markI.setMatrixAt(c.i, KM);
    knobI.instanceMatrix.needsUpdate = markI.instanceMatrix.needsUpdate = true;
  }
  function syncButtons() {
    if (!btnI) return;
    P.buttons.forEach((c, i) => {
      KQ.identity(); P.local(c.x, c.y, 0, KP); KS.set(c.w * k, c.h * k, (c.lit ? 0.004 : 0.007) * (c.depth || 1));
      KM.compose(KP, KQ, KS); btnI.setMatrixAt(i, KM);
      btnI.setColorAt(i, KC.set(c.lit ? c.litColor : c.color));
    });
    btnI.instanceMatrix.needsUpdate = true; if (btnI.instanceColor) btnI.instanceColor.needsUpdate = true;
  }
  P.syncLeds = () => {
    if (!ledI || !P.ledsDirty) return;
    P.ledsDirty = false;
    P.leds.forEach((c, i) => { KC.set(c.color).multiplyScalar(0.12 + 0.88 * c.level); if (c.level > 0.6) KC.lerp(new THREE.Color(1, 1, 1), (c.level - 0.6) * 0.5); ledI.setColorAt(i, KC); });
    ledI.instanceColor.needsUpdate = true;
  };
  P.build = () => {
    if (P.knobs.length) {
      knobI = new THREE.InstancedMesh(KNOB_GEO, knobMat, P.knobs.length); markI = new THREE.InstancedMesh(KNOB_MARK, markMat, P.knobs.length);
      P.knobs.forEach((c, i) => { c.i = i; knobI.setColorAt(i, KC.set(c.color)); markI.setColorAt(i, KC.set(c.mark)); syncKnob(c); });
      group.add(knobI, markI); P.meshes.push(knobI);
    }
    if (P.buttons.length) { btnI = new THREE.InstancedMesh(BOX, btnMat, P.buttons.length); P.buttons.forEach((c, i) => btnI.setColorAt(i, KC.set(c.color))); syncButtons(); group.add(btnI); P.meshes.push(btnI); }
    if (P.leds.length) {
      ledI = new THREE.InstancedMesh(DISC, ledMat, P.leds.length);
      P.leds.forEach((c, i) => { KQ.identity(); P.local(c.x, c.y, 0.0005, KP); KS.set(c.r * k, c.r * k, c.r * k); KM.compose(KP, KQ, KS); ledI.setMatrixAt(i, KM); ledI.setColorAt(i, KC.set(0)); });
      P.ledsDirty = true; P.syncLeds(); group.add(ledI);
    }
    [knobI, markI, btnI, ledI].forEach((m) => { if (m) { m.frustumCulled = false; m.castShadow = false; } });
    P.paint();
  };
  P.paint = () => { if (draw) draw(g, P); tex.needsUpdate = true; };
  // drawing helpers for the face
  P.text = (str, x, y, { size = 16, color = '#1d1b18', align = 'center', weight = 600, base = 'middle', font = 'system-ui, -apple-system, "Segoe UI", Arial, sans-serif', track = 0.06 } = {}) => {
    g.font = `${weight} ${size}px ${font}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = base;
    if ('letterSpacing' in g) g.letterSpacing = (track * size).toFixed(1) + 'px';
    g.fillText(str, x, y);
  };
  P.drawJack = (x, y, r = 22, { ring = '#b9bcc0', out = false } = {}) => {
    if (out) { g.fillStyle = '#2a2a2a'; g.beginPath(); g.roundRect ? g.roundRect(x - r * 1.35, y - r * 1.35, r * 2.7, r * 2.7, r * 0.4) : g.rect(x - r * 1.35, y - r * 1.35, r * 2.7, r * 2.7); g.fill(); }
    g.fillStyle = ring; g.beginPath();
    for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    g.closePath(); g.fill();
    g.fillStyle = '#0d0d0d'; g.beginPath(); g.arc(x, y, r * 0.52, 0, Math.PI * 2); g.fill();
  };
  P.drawScale = (x, y, r, { color = '#1d1b18', ticks = 11, labels = null, size = 11 } = {}) => {   // ticks round a knob
    g.strokeStyle = color; g.lineWidth = Math.max(1.5, r * 0.06);
    for (let i = 0; i < ticks; i++) {
      const a = -Math.PI / 2 - 0.75 * Math.PI + 1.5 * Math.PI * (i / (ticks - 1)), r0 = r * 1.25, r1 = r * (i % ((ticks - 1) / 2 || 1) === 0 ? 1.48 : 1.38);
      g.beginPath(); g.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); g.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); g.stroke();
    }
    if (labels) labels.forEach((t, i) => { const a = -Math.PI / 2 - 0.75 * Math.PI + 1.5 * Math.PI * (i / (labels.length - 1)); P.text(t, x + Math.cos(a) * r * 1.85, y + Math.sin(a) * r * 1.85, { size, color, weight: 500 }); });
  };
  // where a canvas point is on screen (CSS px), for hit tests that feel the same at any zoom
  const sv = new THREE.Vector3();
  P.screen = (x, y) => {
    const cam = wsx.camera, el = wsx.el, r = el.getBoundingClientRect();
    P.world(x, y, 0, sv).project(cam);
    return [r.left + (sv.x + 1) / 2 * r.width, r.top + (1 - sv.y) / 2 * r.height];
  };
  P.scale = () => { const a = P.screen(0, H / 2), b = P.screen(W, H / 2); return Math.hypot(b[0] - a[0], b[1] - a[1]) / W; };   // screen px per canvas px
  P.hit = (ev, list) => {                              // the control nearest the pointer, within reach
    const s = P.scale(), touch = ev.pointerType && ev.pointerType !== 'mouse', reach = touch ? 20 : 8;
    let best = null, bd = Infinity;
    list.forEach((c) => {
      if (c.hidden) return;
      const [sx, sy] = P.screen(c.x, c.y), size = (c.r || Math.max(c.w, c.h) / 2) * s;
      const d = Math.hypot(ev.clientX - sx, ev.clientY - sy) - size;
      if (d < reach && d < bd) { bd = d; best = c; }
    });
    return best;
  };
  P.over = (ev) => { const r = wsx.ray(ev).intersectObject(face, false)[0]; return r ? { x: r.uv.x * W, y: (1 - r.uv.y) * H, point: r.point } : null; };
  // pointer: knobs and buttons here, jacks go to hooks.jack(type, jack, ev)
  P.pointer = (type, ev, hooks = {}) => {
    if (type === 'down') {
      const c = P.hit(ev, [...P.knobs, ...P.buttons, ...(hooks.jack ? P.jacks : [])]);
      if (!c) return false;
      if (c.kind === 'knob') { P.drag = { c, x0: ev.clientX, y0: ev.clientY, v0: c.value }; if (hooks.touch) hooks.touch(c); return true; }
      if (c.kind === 'button') { if (c.onPress) c.onPress(c); if (hooks.touch) hooks.touch(c); return true; }
      return hooks.jack('down', c, ev);
    }
    if (type === 'move') {
      if (P.drag) {
        const d = P.drag, span = d.c.span || 170;
        d.c.set(d.v0 + ((d.y0 - ev.clientY) + (ev.clientX - d.x0) * 0.6) / span);
        return true;
      }
      if (hooks.jackDrag) return hooks.jack('move', null, ev);
      const c = P.hit(ev, [...P.knobs, ...P.buttons, ...(hooks.jack ? P.jacks : [])]);
      wsx.el.style.cursor = c ? (c.kind === 'knob' ? 'ns-resize' : 'pointer') : '';
      return false;
    }
    if (type === 'up') {
      if (P.drag) { P.drag = null; return true; }
      if (hooks.jackDrag) return hooks.jack('up', P.hit(ev, P.jacks), ev);
      return false;
    }
    return false;
  };
  P.dispose = () => { tex.dispose(); face.geometry.dispose(); face.material.dispose(); };
  return P;
}

export function feet(g, size) {                        // four small rubber feet under a device box (group centred on its face)
  const fm = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const fg = new THREE.CylinderGeometry(0.012, 0.012, 0.006, 10);
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => { const f = new THREE.Mesh(fg, fm); f.position.set(sx * (size.w / 2 - 0.03), -size.h / 2 - 0.001, -size.d / 2 + sz * (size.d / 2 - 0.03)); g.add(f); }));
  g.position.y += 0.004;
}
