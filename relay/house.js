// The relay station's hut (RELAY_PLAN phase R2). It gets a window on the side the relay view looks
// at, with warm light behind it at night. A click on the hut (touch: two taps) flies the camera to
// the window, fades, and the visitor sits inside, in the radio room (relay/room.js), at the receiver
// that plays "Tune in" (relay/radio.js). Back or Esc returns outside, the same way the van works.
//
// In the room: drag the big tuning dial (or the scale) to tune; press the Morse key (or hold Space);
// the box of QSL cards on the desk shows the stations found; the postcard on the wall explains the
// moon bounce. Dragging anywhere else looks round a little. Keys: ← → tune (Shift: faster), Space
// Morse key, C cards, M mute, Esc back. The room and the game load the first time someone goes in;
// leaving closes the sound. While inside, the page skips what can't be seen (as for a workshop
// station); the sky and the telescope go on (the window, the moon bounce).
//
// Host (index.html): { scene, camera, el, ray, setRay, flyTo, jump(pos, target, fov), fade(on),
// portrait, reduceMotion, closePanel, tweening(), inPlace(), holdView(), releaseView(h), fixedFov(f),
// night() 0..1, hours() 0..24, telescope, moonsUp() }.
import * as THREE from 'three';

// the hut, from 3d/scripts/props.py (relay_station at x 46, y -30: hut box 3.4 × 2.4 × 2.6 m at
// x + 4.4, y - 2.4, from z 0.2 to 2.8), in viewer coordinates: the bottom of its walls, centred
const HUT = new THREE.Vector3(50.4, 0.2, 32.4), HALF = { x: 1.7, z: 1.2, h: 2.6 };
const WIN = { x0: -0.3, x1: 0.7, y0: 1.0, y1: 1.85 };                 // the same opening as the room's (room.js)
const GLOW = new THREE.Color(0xffa95e);
const CSS = `
  body.relay-sub .nav, body.relay-sub .gear, body.relay-sub .controls, body.relay-sub .skypanel, body.relay-sub .markers { display: none !important; }
  body.relay-sub .camp-hint { bottom: calc(var(--rl-bar, 16px) + 12px + env(safe-area-inset-bottom, 0px)); }
  .rl-bar { width: min(560px, calc(100vw - 32px)); }
  .rl-bar .rl-f { font: 600 15px/1 var(--font-display); font-variant-numeric: tabular-nums; letter-spacing: 0.04em; min-width: 92px; text-align: center; padding: 0 2px; }
  .rl-bar .btn { min-width: 44px; touch-action: none; user-select: none; -webkit-user-select: none; }
  .rl-bar .btn.held { box-shadow: inset 0 -2px 0 currentColor; border-color: currentColor; }
  .rl-bar .msg { min-height: 2.75em; display: flex; flex-direction: column; justify-content: center; gap: 2px; }
  .rl-bar .rl-head { font: 600 12.5px/1.25 var(--font-display); letter-spacing: 0.06em; text-transform: uppercase; color: var(--glass-ink); }
  .rl-bar .rl-line { font: 400 13px/1.35 var(--font-display); color: var(--glass-soft); min-height: 1.35em; overflow-wrap: anywhere; }
`;

let host = null;
const S = {
  ready: false, hover: false, armed: false, inside: false, entering: false, seq: 0, home: null,
  win: null, winMat: null, frameMat: null, groundGlow: null, box: new THREE.Box3(), last: 0, lightAt: 0,
  room: null, radio: null, mods: null, cards: null, look: { yaw: 0, pitch: 0, base: null, eye: null, at: null },
  drag: null, inertia: 0, meter: 0, movedAt: 0, roomHover: null, keyDown: false, keySrc: null, ui: '', els: null, found: 0, tune: 0,
};
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
const world = (x, y, z, out = new THREE.Vector3()) => out.set(HUT.x + x, HUT.y + y, HUT.z + z);

// ---- outside: the window
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildWindow(root) {
  const g = new THREE.Group(); g.name = 'relay_window';
  const ww = WIN.x1 - WIN.x0, wh = WIN.y1 - WIN.y0, cx = (WIN.x0 + WIN.x1) / 2, cy = (WIN.y0 + WIN.y1) / 2, z = -HALF.z;
  // what shows through it: warm lamplight, the curtain at the side, the shapes of the gear on the desk
  const tex = canvasTex(256, 216, (c, w, h) => {
    const gr = c.createRadialGradient(w * 0.45, h * 0.25, 10, w * 0.5, h * 0.4, w * 0.75);
    gr.addColorStop(0, '#ffe2b0'); gr.addColorStop(0.55, '#e79a52'); gr.addColorStop(1, '#6b3a1c');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(40,22,10,0.55)'; c.fillRect(0, h * 0.78, w, h * 0.22);                  // the desk's far end
    c.fillStyle = 'rgba(30,18,10,0.6)'; c.fillRect(w * 0.02, h * 0.5, w * 0.16, h * 0.3); c.fillRect(w * 0.0, h * 0.38, w * 0.14, h * 0.14);
    c.fillStyle = 'rgba(35,70,100,0.85)'; for (let x = 0; x < w * 0.16; x += 6) c.fillRect(w - w * 0.16 + x, 0, 4, h);   // the blue curtain
    c.fillStyle = 'rgba(30,18,10,0.55)'; c.beginPath(); c.arc(w * 0.5, h * 0.06, 16, 0, Math.PI); c.fill();          // the lamp shade
  });
  S.winMat = new THREE.MeshStandardMaterial({ color: 0x27323a, roughness: 0.12, metalness: 0.1, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.05, envMapIntensity: 1.2 });
  S.frameMat = new THREE.MeshStandardMaterial({ color: 0x1d1b18, roughness: 0.6 });
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(ww - 0.04, wh - 0.04), S.winMat);
  pane.position.set(cx, cy, z - 0.004); pane.rotation.y = Math.PI; g.add(pane);       // faces out (-z); from inside it is seen from behind, so culled
  const bar = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), S.frameMat); m.position.set(x, y, z - 0.02); g.add(m); };
  bar(ww + 0.08, 0.05, cx, WIN.y1 + 0.015); bar(ww + 0.08, 0.05, cx, WIN.y0 - 0.015); bar(0.05, wh + 0.08, WIN.x0 - 0.015, cy); bar(0.05, wh + 0.08, WIN.x1 + 0.015, cy);
  bar(0.03, wh, cx, cy); bar(ww, 0.03, cx, cy);
  const sill = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.2, 0.05, 0.14), new THREE.MeshStandardMaterial({ color: 0xe9e4da, roughness: 0.8 }));
  sill.position.set(cx, WIN.y0 - 0.06, z - 0.07); g.add(sill);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  g.position.copy(HUT);
  host.scene.add(g); S.win = g;
  // a soft pool of light on the ground in front of it at night (one quad, no extra light source)
  let ground = 0;
  const r = new THREE.Raycaster(world(cx, 6, z - 1.2), new THREE.Vector3(0, -1, 0), 0, 12);
  const hit = r.intersectObject(root, true).find((h) => h.object.material && /ground/.test(h.object.material.name));
  if (hit) ground = hit.point.y;
  const glowTex = canvasTex(128, 128, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,190,120,0.9)'); gr.addColorStop(1, 'rgba(255,190,120,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
  });
  S.groundGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.2), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  S.groundGlow.rotation.x = -Math.PI / 2; world(cx, 0, z - 1.0, S.groundGlow.position).setY(ground + 0.03); S.groundGlow.renderOrder = 2;
  host.scene.add(S.groundGlow);
  S.box.set(world(-HALF.x - 0.2, -0.2, -HALF.z - 0.3), world(HALF.x + 0.2, HALF.h + 0.4, HALF.z + 0.2));
}

// ---- DOM: hover label, hint, Back, sound, the radio's bar, a keyboard button outside
function buildDom() {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const mk = (tag, cls, attrs = {}) => { const e = document.createElement(tag); e.className = cls; Object.assign(e, attrs); e.hidden = true; document.body.appendChild(e); return e; };
  const els = {
    tip: mk('div', 'tip'), hint: mk('div', 'camp-hint'),
    back: mk('button', 'btn campback', { type: 'button', textContent: '‹ Back' }),
    mute: mk('button', 'btn ws-mute', { type: 'button' }),
    bar: mk('div', 'ws-bar rl-bar'), keys: mk('div', 'camp-keys'),
  };
  els.hint.setAttribute('role', 'status'); els.hint.setAttribute('aria-live', 'polite');
  els.bar.setAttribute('role', 'group'); els.bar.setAttribute('aria-label', 'Receiver');
  els.bar.innerHTML = `<button class="btn" type="button" data-k="down" aria-label="Tune down">‹</button><output class="rl-f" aria-label="Frequency">7.60 MHz</output>
    <button class="btn" type="button" data-k="up" aria-label="Tune up">›</button><button class="btn" type="button" data-k="key" aria-label="Morse key (Space)">Key</button>
    <button class="btn" type="button" data-k="cards">QSL 0 / 12</button><div class="msg" aria-live="polite"><span class="rl-head"></span><span class="rl-line"></span></div>`;
  els.freq = els.bar.querySelector('.rl-f'); els.head = els.bar.querySelector('.rl-head'); els.line = els.bar.querySelector('.rl-line');
  els.cardsBtn = els.bar.querySelector('[data-k=cards]'); els.keyBtn = els.bar.querySelector('[data-k=key]');
  // ‹ › tune while held; Key keys while held; QSL opens the box
  els.bar.querySelectorAll('[data-k]').forEach((b) => {
    const k = b.dataset.k;
    if (k === 'cards') { b.addEventListener('click', openCards); return; }
    const down = (e) => { e.preventDefault(); wake(); b.classList.add('held'); if (k === 'key') keyOn(true, 'bar'); else S.tune = k === 'up' ? 1 : -1; };
    const up = () => { b.classList.remove('held'); if (k === 'key') keyOn(false, 'bar'); else S.tune = 0; };
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    b.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { down(e); e.stopPropagation(); } });
    b.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') { up(); if (k !== 'key') nudge(k === 'up' ? 0.01 : -0.01); e.stopPropagation(); } });
  });
  els.back.addEventListener('click', () => back());
  els.mute.addEventListener('click', () => mute());
  els.keys.setAttribute('role', 'group'); els.keys.setAttribute('aria-label', 'Relay station');
  const go = document.createElement('button'); go.type = 'button'; go.className = 'btn'; go.textContent = 'Go into the radio room';
  go.addEventListener('click', () => enter()); els.keys.appendChild(go);
  return els;
}
function say(text, ms = 6000) {
  const h = S.els.hint;
  h.textContent = text; h.hidden = !text; h.classList.remove('gone');
  clearTimeout(say.t); if (text) say.t = setTimeout(() => h.classList.add('gone'), ms);
}
function paintMute() {
  const on = S.radio && S.radio.audio ? S.radio.audio.muted : (S.mods ? S.mods.muted() : false);
  S.els.mute.textContent = on ? 'Muted' : 'Sound'; S.els.mute.setAttribute('aria-pressed', String(on)); S.els.mute.title = (on ? 'Sound on' : 'Mute') + ' (M)';
}
function mute() { const A = S.radio && S.radio.audio; if (A) { A.mute(!A.muted); paintMute(); } }
function fitBar() { document.body.style.setProperty('--rl-bar', S.els.bar.hidden ? '16px' : (S.els.bar.offsetHeight + 16) + 'px'); }

// ---- outside: hover, tap, keyboard row
function hitHut(ev) { host.setRay(ev); return !!host.ray.ray.intersectBox(S.box, v1); }
function setHover(on) {
  if (on === S.hover) return;
  S.hover = on;
  S.frameMat.emissive.copy(on ? GLOW : new THREE.Color(0)); S.frameMat.emissiveIntensity = on ? 0.6 : 0;
  S.els.tip.hidden = !on; if (on) S.els.tip.textContent = 'Go inside';
  host.el.style.cursor = on ? 'pointer' : '';
}
function placeTip() {
  world((WIN.x0 + WIN.x1) / 2, HALF.h + 0.6, -HALF.z, v1).project(host.camera);
  S.els.tip.style.left = ((v1.x + 1) / 2 * host.el.clientWidth) + 'px'; S.els.tip.style.top = ((1 - v1.y) / 2 * host.el.clientHeight) + 'px';
}
function loadMods() {
  return S.mods || (S.mods = Promise.all([import('./room.js'), import('./radio.js'), import('./cards.js'), import('../safari/audio.js')]).then(([room, radio, cards, au]) => {
    S.mods = { room, radio, cards, muted: au.mutedByDefault }; return S.mods;
  }));
}

// ---- in and out
function eyeFor(view) {                                 // the seat: `size` metres of the desk in frame, phones closer
  const portrait = host.portrait(), fov = portrait ? 62 : 50;
  const at = new THREE.Vector3(...view.at); if (portrait) at.y -= 0.08;
  const el = host.el, aspect = el.clientWidth / Math.max(1, el.clientHeight);
  const vf = THREE.MathUtils.degToRad(fov), hf = 2 * Math.atan(Math.tan(vf / 2) * aspect), size = portrait ? view.sizePhone : view.size;
  const d = Math.min(1.75, Math.max((size * 0.55) / Math.tan(hf / 2), (size * 0.4) / Math.tan(vf / 2)));
  const dir = new THREE.Vector3(...view.from).normalize();
  return { eye: world(...at.clone().addScaledVector(dir, d).toArray()), at: world(...at.toArray()), fov };
}
function outsidePose() {
  const c = world((WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, -HALF.z);
  return { eye: c.clone().add(v1.set(-0.2, 0.25, -2.6)), at: c };
}
async function enter() {
  if (!S.ready || S.inside || S.entering || !host.inPlace() || host.tweening()) return;
  const tok = ++S.seq; S.entering = true;
  setHover(false); S.armed = false; S.els.keys.hidden = true; S.els.hint.hidden = true;
  host.closePanel();
  S.home = host.holdView();
  const ready = loadMods();
  const o = outsidePose();
  host.fixedFov(host.portrait() ? 50 : 36);
  host.flyTo(o.eye, o.at, host.portrait() ? 50 : 36, async () => {
    if (tok !== S.seq) return;
    await host.fade(true);
    const m = await ready;
    if (tok !== S.seq) { host.fade(false); return; }
    if (!S.room) {
      S.room = m.room.buildRoom(); S.room.root.position.copy(HUT); host.scene.add(S.room.root);
    }
    if (!S.radio) {
      S.radio = m.radio.createRadio({ moon: moonTracked, clock: () => clock(host.hours()), sky: skyLine });
      S.radio.onLog(logged);
    }
    S.room.root.visible = true; S.win.visible = false;
    S.room.setMarks(markList(), null); S.room.setCards(foundCount());
    S.radio.start(); paintMute();
    const p = eyeFor(m.room.VIEW);
    S.look = { yaw: 0, pitch: 0, eye: p.eye, at: p.at, fov: p.fov };
    host.jump(p.eye, p.at, p.fov); host.fixedFov(p.fov);
    S.inside = true; S.entering = false;
    document.body.classList.add('relay-sub');
    S.els.back.hidden = false; S.els.mute.hidden = false; S.els.bar.hidden = false; fitBar();
    S.ui = ''; updateBar(true);
    host.fade(false);
    const how = matchMedia('(hover: hover)').matches ? 'Drag' : 'Turn';
    say(how + ' the big dial to tune. Find the stations hidden on the band', 7000);
  });
}
async function back() {
  if (!S.inside) return;
  if (S.cards) { S.cards.close(); return; }
  const tok = ++S.seq;
  keyOn(false); S.drag = null; S.inertia = 0; S.tune = 0;
  await host.fade(true);
  if (tok !== S.seq) return;
  leaveRoom();
  const o = outsidePose();
  host.jump(o.eye, o.at, host.portrait() ? 50 : 36);
  host.fade(false);
  const h = S.home;
  host.flyTo(h.pos.clone(), h.target.clone(), h.fov, () => { if (tok === S.seq) { host.releaseView(h); S.home = null; S.els.keys.hidden = false; } });
}
function leaveRoom() {                                  // out of the room at once: sound off, room hidden, controls gone
  S.inside = false; S.entering = false;
  if (S.cards) { const c = S.cards; S.cards = null; c.close(); }
  if (S.radio) { S.radio.key(false); S.radio.stop(); }
  if (S.room) S.room.root.visible = false;
  if (S.win) S.win.visible = true;
  setRoomHover(null);
  document.body.classList.remove('relay-sub');
  S.els.back.hidden = true; S.els.mute.hidden = true; S.els.bar.hidden = true; S.els.hint.hidden = true; fitBar();
}

// ---- the game's helpers
const moonTracked = () => { const t = host.telescope.tracking(); return t && /^Moon/.test(t) ? t : null; };
const clock = (h) => { const m = Math.floor(h * 60) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
const NUMW = ['no', 'one', 'two', 'three'];
function skyLine() {
  const n = host.moonsUp(), night = host.night() > 0.5;
  return (night ? 'A clear night' : 'Sky clear') + ', ' + (NUMW[n] || n) + (n === 1 ? ' moon' : ' moons') + ' above the horizon.';
}
function markList() {
  const log = S.radio ? S.radio.log : {};
  return S.mods.radio.STATIONS.filter((s) => log[s.id]).map((s) => ({ f: s.f, call: s.call }));
}
const foundCount = () => (S.radio ? S.mods.radio.ALL.filter((s) => S.radio.log[s.id]).length : 0);
function logged(s) {
  S.room.setMarks(markList(), S.radio.log.eme ? { f: s.f } : null); S.room.setCards(foundCount());
  const n = foundCount(), total = S.mods.radio.ALL.length;
  say('QSL card: ' + s.name + ' · ' + n + ' / ' + total + (n === total ? ' · All stations heard!' : ''), 4500);
  const A = S.radio.audio;
  if (A) { const t = A.now; [880, 1320].forEach((f, i) => S.mods.radio.chime(A, t + i * 0.12, f)); }
  updateBar(true);
}
function openCards() {
  if (!S.inside || S.cards || !S.mods) return;
  keyOn(false);
  S.cards = S.mods.cards.openCards(S.mods.radio.ALL, S.radio.log, { onClose: () => { S.cards = null; } });
}
function nudge(df) { if (S.radio) { S.radio.set(S.radio.f + df); S.movedAt = performance.now(); } }
function wake() { if (S.radio) { const A = S.radio.start(); if (A) paintMute(); } }
function keyOn(down, src) {
  if (!S.radio) return;
  if (down) { if (S.keyDown) return; S.keyDown = true; S.keySrc = src; wake(); }
  else { if (!S.keyDown || (src && S.keySrc && src !== S.keySrc)) return; S.keyDown = false; S.keySrc = null; }
  S.radio.key(down); S.room.setKey(down, down);
  S.els.keyBtn.classList.toggle('held', down);
}
function updateBar(force) {
  if (!S.radio) return;
  const r = S.radio.readout(), f = S.radio.f.toFixed(2) + ' MHz', n = foundCount(), total = S.mods.radio.ALL.length;
  const sig = f + '|' + r.head + '|' + r.line + '|' + n;
  if (!force && sig === S.ui) return;
  S.ui = sig;
  S.els.freq.textContent = f; S.els.head.textContent = r.head; S.els.line.textContent = r.line;
  S.els.cardsBtn.textContent = 'QSL ' + n + ' / ' + total;
}

// ---- in the room: pointer (capture phase, before the page's camera), hover, keys
function roomPick(ev) {
  host.setRay(ev);
  const h = host.ray.intersectObjects(S.room.picks, false)[0];
  return h ? { id: h.object.userData.pick, point: h.point } : null;
}
function setRoomHover(id, ev) {
  if (id !== S.roomHover) {
    if (S.roomHover && S.room) S.room.glowMats[S.roomHover].forEach((m) => { if (m.userData.e0) { m.emissive.copy(m.userData.e0.c); m.emissiveIntensity = m.userData.e0.i; } });
    S.roomHover = id;
    if (id) S.room.glowMats[id].forEach((m) => { if (!m.userData.e0) m.userData.e0 = { c: m.emissive.clone(), i: m.emissiveIntensity }; m.emissive.copy(GLOW); m.emissiveIntensity = id === 'dial' ? 0.22 : 0.35; });
    S.els.tip.hidden = !id;
    if (id) S.els.tip.textContent = { dial: 'Tuning dial', key: 'Morse key', box: 'QSL cards', hint: 'Moon bounce?' }[id];
  }
  if (id && ev) { S.els.tip.style.left = ev.clientX + 'px'; S.els.tip.style.top = (ev.clientY - 30) + 'px'; }
  host.el.style.cursor = id ? (id === 'dial' ? 'grab' : 'pointer') : (S.drag && S.drag.look ? 'grabbing' : '');
}
function knobScreen() {                                 // the tuning knob's centre and radius on screen (px)
  const r = host.el.getBoundingClientRect();
  const c = S.room.knobAt(v1).add(HUT).project(host.camera);
  const e = S.room.knobAt(v2).add(HUT).add(v3.set(0, S.room.knobR, 0)).project(host.camera);
  const cx = r.left + (c.x + 1) / 2 * r.width, cy = r.top + (1 - c.y) / 2 * r.height;
  return { x: cx, y: cy, r: Math.hypot(cx - (r.left + (e.x + 1) / 2 * r.width), cy - (r.top + (1 - e.y) / 2 * r.height)) };
}
function dialScreenWidth() {                            // the scale window's width on screen (px): 1.5 MHz across
  const r = host.el.getBoundingClientRect(), d = S.room.dialMesh;
  const a = d.localToWorld(v1.set(-0.2, 0, 0)).project(host.camera), b = d.localToWorld(v2.set(0.2, 0, 0)).project(host.camera);
  return Math.max(40, Math.hypot((a.x - b.x) / 2 * r.width, (a.y - b.y) / 2 * r.height));
}
function onPointer(type, ev) {
  if (!S.inside || host.tweening() || S.cards) return false;
  if (type === 'down') {
    wake();
    const p = roomPick(ev);
    if (p && p.id === 'dial') {
      const k = knobScreen(), dx = ev.clientX - k.x, dy = ev.clientY - k.y, d = Math.hypot(dx, dy);
      S.drag = d < k.r * 1.7 && d > k.r * 0.25 ? { mode: 'knob', a: Math.atan2(dy, dx), k } : { mode: 'scale', x: ev.clientX, y: ev.clientY, w: dialScreenWidth(), k };
      S.drag.t = performance.now(); S.drag.v = 0; S.inertia = 0;
      host.el.style.cursor = 'grabbing';
    } else if (p && p.id === 'key') { keyOn(true, 'pointer'); S.drag = { mode: 'key' }; }
    else if (p && p.id === 'box') { S.drag = { mode: 'tap', id: 'box' }; }
    else if (p && p.id === 'hint') { S.drag = { mode: 'tap', id: 'hint' }; }
    else S.drag = { look: true, x: ev.clientX, y: ev.clientY };
    return true;
  }
  if (type === 'move') {
    const D = S.drag;
    if (!D) { if (ev.pointerType === 'mouse') { const p = roomPick(ev); setRoomHover(p ? p.id : null, ev); } return true; }
    const now = performance.now(), dt = Math.max(1, now - D.t) / 1000;
    let df = 0;
    if (D.mode === 'knob') {
      const a = Math.atan2(ev.clientY - D.k.y, ev.clientX - D.k.x);
      if (Math.hypot(ev.clientX - D.k.x, ev.clientY - D.k.y) > D.k.r * 0.25) { df = Math.atan2(Math.sin(a - D.a), Math.cos(a - D.a)) / (Math.PI * 2) * S.mods.room.BAND.span; D.a = a; }
    } else if (D.mode === 'scale') { df = -(ev.clientX - D.x) / D.w * S.mods.room.BAND.span; D.x = ev.clientX; }
    else if (D.look) {
      const k = THREE.MathUtils.degToRad(host.camera.fov) / host.el.clientHeight;
      S.look.yaw = THREE.MathUtils.clamp(S.look.yaw + (ev.clientX - D.x) * k, -1.2, 1.2);
      S.look.pitch = THREE.MathUtils.clamp(S.look.pitch + (ev.clientY - D.y) * k, -0.6, 0.55);
      D.x = ev.clientX; D.y = ev.clientY;
    }
    if (df) { nudge(df); D.v = D.v * 0.6 + (df / dt) * 0.4; D.t = now; }
    return true;
  }
  if (type === 'up') {
    const D = S.drag; S.drag = null;
    if (!D) return true;
    if (D.mode === 'key') keyOn(false, 'pointer');
    if ((D.mode === 'knob' || D.mode === 'scale') && performance.now() - D.t < 80 && Math.abs(D.v) > 0.4) S.inertia = THREE.MathUtils.clamp(D.v, -6, 6);
    if (D.mode === 'tap') {
      const p = roomPick(ev);
      if (p && p.id === D.id) { if (D.id === 'box') openCards(); else hintCard(); }
    }
    host.el.style.cursor = '';
    return true;
  }
  return false;
}
function hintCard() {
  const m = moonTracked();
  say('Moon bounce: radio amateurs send signals to the moon and hear them come back 2.5 seconds later. Point the radio telescope at a moon, tune to 7.05 MHz and press the Morse key. '
    + (m ? 'Right now the telescope is on ' + m + '.' : 'Right now the telescope is not on a moon.'), 12000);
}
function onKey(e) {
  if (!S.inside) return;
  if (e.target.closest && e.target.closest('input, textarea')) return;
  if (S.cards) { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); S.cards.close(); } return; }
  const k = e.key;
  if (k === 'Escape') { e.stopImmediatePropagation(); back(); return; }
  if ((k === 'Enter' || k === ' ') && e.target.closest && e.target.closest('button')) return;   // a focused button acts
  if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') {
    e.preventDefault(); e.stopImmediatePropagation(); wake();
    nudge((k === 'ArrowRight' || k === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 0.1 : 0.01)); S.inertia = 0; return;
  }
  if (k === ' ') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) keyOn(true, 'space'); return; }
  if ((k === 'm' || k === 'M') && !e.metaKey && !e.ctrlKey) { e.stopImmediatePropagation(); wake(); mute(); return; }
  if ((k === 'c' || k === 'C') && !e.metaKey && !e.ctrlKey) { e.stopImmediatePropagation(); openCards(); }
}
function onKeyUp(e) { if (S.inside && e.key === ' ') { e.preventDefault(); keyOn(false, 'space'); } }

// ---- every frame
function stepRoom(dt, now) {
  const R = S.radio, room = S.room;
  if (S.tune) { nudge(S.tune * dt * 0.35); S.inertia = 0; }
  if (S.inertia) {
    nudge(S.inertia * dt); S.inertia *= Math.exp(-dt / 0.35);
    if (Math.abs(S.inertia) < 0.05 || R.f <= S.mods.room.BAND.lo || R.f >= S.mods.room.BAND.hi) S.inertia = 0;
  }
  if (!S.drag && !S.inertia && !S.tune && now - S.movedAt > 450) {   // let go near a station: it settles on it (fine tuning on a phone is hard)
    const list = moonTracked() ? S.mods.radio.ALL : S.mods.radio.STATIONS;
    const near = list.find((s) => Math.abs(R.f - s.f) < 0.06);
    if (near) R.set(R.f + (near.f - R.f) * Math.min(1, dt * 2.5));
  }
  R.step(dt);
  room.setFreq(R.f);
  const target = R.signal > 0.05 ? R.signal * (0.92 + Math.random() * 0.08) : 0.04 + Math.random() * 0.05;
  S.meter += (target - S.meter) * Math.min(1, dt * 7);
  room.setMeter(S.meter);
  room.setClock(host.hours());
  if (now - S.lightAt > 250) { S.lightAt = now; room.setLight(host.night(), R.signal); }
  updateBar();
  // the camera: the seat, turned by the look drag
  if (!host.tweening()) {
    const L = S.look, base = v1.copy(L.at).sub(L.eye);
    const dist = base.length(); base.normalize();
    const yaw = Math.atan2(base.x, base.z) + L.yaw, pitch = Math.asin(base.y) + L.pitch;   // as the page's own look-round: the view follows the finger
    v2.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(dist).add(L.eye);
    host.camera.position.copy(L.eye); host.camera.lookAt(v2);
  }
}

export const relay = {
  setup(h, root) {
    host = h; S.els = buildDom();
    buildWindow(root);
    const el = host.el;
    el.addEventListener('pointerdown', (ev) => { if (onPointer('down', ev)) { ev.stopImmediatePropagation(); el.setPointerCapture(ev.pointerId); } }, true);
    el.addEventListener('pointermove', (ev) => { if (onPointer('move', ev)) ev.stopImmediatePropagation(); }, true);
    el.addEventListener('pointerup', (ev) => { if (onPointer('up', ev)) ev.stopImmediatePropagation(); }, true);
    el.addEventListener('pointercancel', (ev) => { if (S.inside) { onPointer('up', ev); ev.stopImmediatePropagation(); } }, true);
    el.addEventListener('wheel', (ev) => {
      if (!S.inside) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      S.look.fov = THREE.MathUtils.clamp(host.camera.fov * Math.exp(ev.deltaY * 0.001), 30, 75);
      host.camera.fov = S.look.fov; host.camera.updateProjectionMatrix(); host.fixedFov(S.look.fov);
    }, { passive: false, capture: true });
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', () => keyOn(false));
    window.addEventListener('resize', fitBar);
    document.addEventListener('visibilitychange', () => {
      const A = S.radio && S.radio.audio; if (!A) return;
      if (document.hidden) { keyOn(false); A.suspend(); } else if (S.inside) A.resume();
    });
    S.ready = true;
    if (S.early && host.inPlace()) this.arrive();
  },
  step(now) {
    if (!S.ready) return;
    const dt = S.last ? Math.min(0.1, (now - S.last) / 1000) : 0; S.last = now;
    if (S.inside && S.room) { stepRoom(dt, now); return; }
    if (now - S.lightAt > 400) {                        // the window glows at night
      S.lightAt = now;
      const n = host.night();
      S.winMat.emissiveIntensity = 0.05 + 1.5 * n; S.groundGlow.material.opacity = 0.42 * n; S.groundGlow.visible = n > 0.02;
    }
    if (S.hover && !S.els.tip.hidden) placeTip();
    const want = host.inPlace() && !host.tweening() && !S.entering;
    if (S.els.keys.hidden === want) S.els.keys.hidden = !want;
  },
  hover(ev) {
    if (S.inside || host.tweening()) return setHover(false);
    setHover(hitHut(ev));
  },
  tap(ev) {
    if (S.inside || !S.ready) return;
    const on = hitHut(ev);
    if (!on) { S.armed = false; setHover(false); return; }
    // touch and pen: the first tap only shows what it is, the second one acts
    if (ev.pointerType !== 'mouse' && !S.armed) { S.armed = true; setHover(true); placeTip(); return; }
    S.armed = false;
    enter();
  },
  arrive() {
    if (!S.ready) { S.early = true; return; }
    loadMods();
    say((matchMedia('(hover: hover)').matches ? 'Click' : 'Tap') + ' the hut to go into the radio room', 6000);
  },
  // leaving the place some other way (menu, browser back, another place): everything back at once
  reset() {
    if (!S.ready) return;
    S.seq++;
    if (S.inside || S.entering) leaveRoom();
    S.armed = false; setHover(false); S.home = null;
    S.els.hint.hidden = true; S.els.keys.hidden = true;
  },
  resume(now) { S.last = now; },
  get inside() { return S.inside; },
  // tests
  enter, back, state: () => ({ inside: S.inside, keyDown: S.keyDown, keySrc: S.keySrc, moon: moonTracked(), sent: S.radio ? S.radio.readout().line : '', f: S.radio ? +S.radio.f.toFixed(3) : null, found: foundCount(), bar: S.ui, cards: !!S.cards, look: { ...S.look } }),
  tune: (f) => { if (S.radio) { S.radio.set(f); S.inertia = 0; } },
  key: (down) => keyOn(down, 'test'),
  screen(what) {                                         // where on screen a thing is (CSS px)
    const r = host.el.getBoundingClientRect();
    let p;
    if (what === 'hut') p = world((WIN.x0 + WIN.x1) / 2, 1.4, -HALF.z, v1);
    else if (what === 'knob') { const k = knobScreen(); return [k.x, k.y, k.r]; }
    else { const m = S.room.picks.find((o) => o.userData.pick === what); p = m.getWorldPosition(v1); }
    p.project(host.camera);
    return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height];
  },
};
