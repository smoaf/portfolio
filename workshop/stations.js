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
//   update(dt, now, s)   every frame; s = { open: this station is open, inside: the visitor is in
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
  reduceMotion: () => S.host.reduceMotion(),
  timeOfDay: () => S.host.timeOfDay(),
};

// ---- DOM: hover label, Back, hint, mute toggle, and the keyboard row (the camp's classes)
const CSS = `
  body.ws-sub .nav, body.ws-sub .gear, body.ws-sub .controls, body.ws-sub .skypanel, body.ws-sub .markers { display: none !important; }
  .ws-mute { position: fixed; z-index: 22; right: 16px; top: calc(var(--hh, 77px) + 12px); color: var(--glass-ink); background: var(--glass-strong);
             border: 1px solid var(--glass-line); -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur); font-size: 11px; }
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
  },
  // every frame (replaces the page's old stepPrinter)
  step(now) {
    if (!S.ready) return;
    const dt = S.last ? Math.min(0.1, (now - S.last) / 1000) : 0; S.last = now;
    const inside = S.host.inPlace();
    defs.forEach((def) => { if (def.update) def.update(dt, now, { open: S.focus === def.id && !S.opening, inside, focus: S.focus }); });
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
