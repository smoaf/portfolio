// Radio telescope (RELAY_PLAN phase R1): the big steerable dish on the hill tracks the sun or a moon.
// In its place, a click (touch: two taps) on the telescope turns it to whatever stands above the
// horizon, nearest to where it points now; it keeps following that target as the sky moves. A
// second click parks it again. With nothing in the sky it sweeps once, searching, and says so.
//
// The model is unchanged: radio_dish.py already exports the parts by name, so at load time the
// mount (props/dish_mount*) goes onto a turntable that turns about the plinth's centre (azimuth),
// and the dish itself (reflector, grid, backup, rim, feed, axle, gear) onto the elevation axle
// at the top of the mount. The plinth stays put. Motion: azimuth first, a short pause, then
// elevation, each with ease in and out, like a heavy machine.
//
// Host (index.html): { scene, camera, el, ray, setRay, sky() -> [{ name, dir }], reduceMotion,
// tweening(), inPlace() }. `sky()` lists the sun and the moons in the sky now (viewer coordinates,
// y up; `dir` is a unit vector, live).
import * as THREE from 'three';

// from 3d/scripts/radio_dish.py (model coordinates, z up): the pose the dish was built in
const FACE = THREE.MathUtils.degToRad(130);            // pointing direction in plan
const EL0 = THREE.MathUtils.degToRad(40);              // elevation
const H_AX = 22.0;                                     // elevation axle above the plinth top
const BACK = 5.0, F = 16.0, R = 20.0;                  // vertex in front of the axle, focal length, radius
const MIN_EL = THREE.MathUtils.degToRad(14);           // lower and the rim would hit the A-frames
const MAX_EL = THREE.MathUtils.degToRad(88);
const HORIZON = 0.035;                                 // sine of the lowest height that counts as "in view"
const TURN = THREE.MathUtils.degToRad(16);             // slew speed per second, at full speed
const FOLLOW = THREE.MathUtils.degToRad(5);            // while tracking: catch up at most this fast
const PAUSE = 450;                                     // ms between azimuth and elevation

const MOVING = /^propsdish_(mount|mount_steel)$/;
const TILTING = /^propsdish_(reflector|grid|backup|rim|feed|feed_braces|axle|gear)$/;
const GLOW = new THREE.Color(0xffa95e);

let host = null;
const t = {
  ready: false, az0: 0, el0: EL0, az: 0, el: EL0,      // park pose and current pose (az = atan2(x, z))
  azG: null, elG: null, upL: new THREE.Vector3(), axL: new THREE.Vector3(), sgn: 1,
  feed: new THREE.Vector3(), bore: new THREE.Vector3(), centre: new THREE.Vector3(),
  meshes: [], mats: [], plinth: null,
  mode: 'park',                                        // park | slew | track | search | parking
  target: null, queue: [], move: null, last: 0,
  hover: false, armed: false, label: null, tip: null, labelUntil: 0, rings: [], ringT: 0,
};
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), q1 = new THREE.Quaternion();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const deg = (r) => Math.round(THREE.MathUtils.radToDeg(r));
const easeIO = (u) => 0.5 - 0.5 * Math.cos(Math.PI * u);   // soft start and stop
const azOf = (d) => Math.atan2(d.x, d.z);
const elOf = (d) => Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
const clampEl = (e) => THREE.MathUtils.clamp(e, MIN_EL, MAX_EL);
function boreDir(az, el, out) { return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)); }

function setup(h, root) {
  host = h;
  const parts = {};
  root.traverse((o) => { if (o.isMesh && /^propsdish_/.test(o.name)) parts[o.name] = o; });
  const plinth = parts.propsdish_plinth;
  if (!plinth) { console.warn('telescope: no dish in the model'); return; }
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(plinth);
  const pivot = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
  // park pose in viewer coordinates (W2T: model (x, y, z) -> (x, z, -y))
  const P = new THREE.Vector3(Math.cos(FACE), 0, -Math.sin(FACE));              // pointing, in plan
  const A = new THREE.Vector3(Math.cos(FACE - Math.PI / 2), 0, -Math.sin(FACE - Math.PI / 2));   // the axle
  t.az0 = t.az = azOf(P); t.el = t.el0 = EL0;
  t.sgn = v1.crossVectors(A, P).y > 0 ? 1 : -1;        // which way round the axle lifts the dish
  // turntable: sits in the dish's own parent, turns about that parent's version of "up"
  const parent = plinth.parent;
  t.azG = new THREE.Group(); t.azG.name = 'telescope_azimuth';
  parent.add(t.azG);
  t.azG.position.copy(parent.worldToLocal(pivot.clone()));
  parent.getWorldQuaternion(q1).invert();
  t.upL.set(0, 1, 0).applyQuaternion(q1);
  t.azG.updateMatrixWorld(true);
  // elevation axle at the top of the mount
  t.elG = new THREE.Group(); t.elG.name = 'telescope_elevation';
  t.azG.add(t.elG);
  const axle = pivot.clone().add(v1.set(0, H_AX, 0));
  t.elG.position.copy(t.azG.worldToLocal(axle.clone()));
  t.azG.getWorldQuaternion(q1).invert();
  t.axL.copy(A).applyQuaternion(q1);
  t.elG.updateMatrixWorld(true);
  Object.values(parts).forEach((o) => {
    if (MOVING.test(o.name)) t.azG.attach(o);
    else if (TILTING.test(o.name)) t.elG.attach(o);
    else return;
    t.meshes.push(o);
    if (o.material.emissive) t.mats.push(o.material);   // the page gave every dish part its own material
  });
  t.plinth = plinth;
  // feed horn and boresight, in the tilting frame
  const b0 = boreDir(t.az0, t.el0, new THREE.Vector3());
  t.elG.getWorldQuaternion(q1).invert();
  t.bore.copy(b0).applyQuaternion(q1);
  t.centre.copy(t.elG.worldToLocal(axle.clone().addScaledVector(b0, BACK + 2.5)));
  t.feed.copy(t.elG.worldToLocal(axle.clone().addScaledVector(b0, BACK + F)));
  makeRings();
  makeLabels();
  t.ready = true;
}

// a faint signal coming in: rings that close in on the feed horn along the boresight
function makeRings() {
  const geo = new THREE.RingGeometry(0.92, 1, 48);
  const turn = new THREE.Quaternion().setFromUnitVectors(v1.set(0, 0, 1), t.bore);
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffd9a8, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.quaternion.copy(turn); m.visible = false; m.renderOrder = 3; m.name = 'telescope_ring';
    t.elG.add(m); t.rings.push(m);
  }
}
function makeLabels() {
  t.label = document.createElement('div');             // status line at the bottom, like the camp's hint
  t.label.className = 'camp-hint gone'; t.label.hidden = true; t.label.setAttribute('aria-live', 'polite');
  t.tip = document.createElement('div');               // hover label over the dish
  t.tip.className = 'tip'; t.tip.hidden = true;
  document.body.append(t.label, t.tip);
}
function say(text, ms) {
  const l = t.label; if (!l) return;
  l.textContent = text; l.hidden = false; l.classList.remove('gone');
  t.labelUntil = ms ? performance.now() + ms : Infinity;
}
function quiet() { if (t.label) { t.label.classList.add('gone'); t.labelUntil = 0; } }

// ---- what is in the sky
function pickTarget() {
  const cur = boreDir(t.az, t.el, v2);
  let best = null, d = Infinity;
  host.sky().forEach((s) => {
    if (s.dir.y < HORIZON) return;
    const a = s.dir.angleTo(cur);
    if (a < d) { d = a; best = s; }
  });
  return best;
}

// ---- moves: a queue of { key: 'az' | 'el', to } and { wait: ms }
function plan(steps, mode, done) {
  t.queue = steps; t.move = null; t.mode = mode; t.done = done || null;
}
function nextMove(now) {
  const s = t.queue.shift();
  if (!s) { t.move = null; const d = t.done; t.done = null; if (d) d(); return; }
  if (s.wait) { t.move = { wait: true, t0: now, ms: host.reduceMotion() ? 0 : s.wait }; return; }
  let to = typeof s.to === 'function' ? s.to() : s.to;
  if (s.key === 'az') to = t.az + wrap(to - t.az);     // the short way round
  const span = Math.abs(to - t[s.key]);
  const ms = host.reduceMotion() ? 0 : span < 1e-4 ? 0 : 700 + span / TURN * 1000;
  t.move = { key: s.key, from: t[s.key], to, t0: now, ms };
}
function track() {
  const s = pickTarget();
  if (!s) {                                            // nothing above the horizon: one searching sweep
    const sweep = THREE.MathUtils.degToRad(28);
    say('Nothing in view', 4200);
    plan([{ key: 'az', to: t.az0 + sweep }, { wait: 250 }, { key: 'az', to: t.az0 - sweep }, { wait: 250 }, { key: 'az', to: t.az0 }, { key: 'el', to: t.el0 }],
      'search', () => { t.mode = 'park'; });
    return;
  }
  t.target = s;
  say('Turning to the ' + (s.name === 'Sun' ? 'sun' : s.name.replace('Moon', 'moon')) + '…');
  plan([{ key: 'az', to: () => azOf(s.dir) }, { wait: PAUSE }, { key: 'el', to: () => clampEl(elOf(s.dir)) }], 'slew', () => { t.mode = 'track'; });
}
function park(why) {
  t.target = null;
  say(why || 'Parking', 3000);
  plan([{ key: 'az', to: t.az0 }, { wait: PAUSE }, { key: 'el', to: t.el0 }], 'parking', () => { t.mode = 'park'; });
}
function toggle() {
  if (!t.ready) return;
  if (t.mode === 'search') return;                     // let the sweep finish
  if (t.mode === 'slew' || t.mode === 'track') park(); else track();
}

function pose() {
  t.azG.quaternion.setFromAxisAngle(t.upL, t.az - t.az0);
  t.elG.quaternion.setFromAxisAngle(t.axL, t.sgn * (t.el - t.el0));
}
function step(now) {
  if (!t.ready) return;
  const dt = Math.min(0.1, (now - (t.last || now)) / 1000); t.last = now;
  if (!t.move && t.queue.length) nextMove(now);
  const m = t.move;
  if (m) {
    const u = m.ms ? Math.min(1, (now - m.t0) / m.ms) : 1;
    if (!m.wait) t[m.key] = m.from + (m.to - m.from) * easeIO(u);
    if (u >= 1) { t.move = null; if (!t.queue.length) nextMove(now); }
  } else if (t.mode === 'track' && t.target) {
    const d = t.target.dir;
    if (d.y < HORIZON * 0.5) park((t.target.name === 'Sun' ? 'The sun' : t.target.name) + ' has set. Parking');
    else {                                             // follow the sky, slowly
      const k = FOLLOW * dt;
      t.az += THREE.MathUtils.clamp(wrap(azOf(d) - t.az), -k, k);
      t.el += THREE.MathUtils.clamp(clampEl(elOf(d)) - t.el, -k, k);
    }
  }
  if (t.mode === 'track' && t.target && host.inPlace()) {
    const text = 'Tracking: ' + t.target.name + '  ·  az ' + ((deg(t.az) % 360 + 360) % 360) + '°  el ' + deg(t.el) + '°';
    if (text !== t.label.textContent || t.label.hidden || t.label.classList.contains('gone')) say(text);
  }
  if (t.labelUntil && now > t.labelUntil) quiet();
  pose();
  stepRings(dt);
  if (t.tip && !t.tip.hidden) placeTip();
}
function stepRings(dt) {
  const on = t.mode === 'track' && !host.reduceMotion();
  t.ringT = (t.ringT + dt * 0.45) % 1;
  t.rings.forEach((r, i) => {
    r.visible = on;
    if (!on) return;
    const u = (t.ringT + i / t.rings.length) % 1;      // 0 far out in the sky, 1 at the feed
    r.position.copy(t.feed).addScaledVector(t.bore, 60 * (1 - u));
    r.scale.setScalar(3 + 14 * (1 - u));
    r.material.opacity = 0.32 * Math.sin(Math.PI * u);
  });
}

// ---- picking: the dish's meshes, or close enough to the reflector (phones)
function hit(ev) {
  if (!t.ready) return false;
  host.setRay(ev);
  const r = host.ray;
  if (r.intersectObjects([...t.meshes, t.plinth], false).length) return true;
  const c = t.elG.localToWorld(v1.copy(t.centre));
  return r.ray.distanceSqToPoint(c) < R * R;
}
function glow(on) {
  t.mats.forEach((m) => {
    if (!m.userData.e0) m.userData.e0 = { c: m.emissive.clone(), i: m.emissiveIntensity };
    if (on) { m.emissive.copy(GLOW); m.emissiveIntensity = 0.3; } else { m.emissive.copy(m.userData.e0.c); m.emissiveIntensity = m.userData.e0.i; }
  });
}
function setHover(on) {
  if (on === t.hover) return;
  t.hover = on; glow(on);
  t.tip.hidden = !on;
  if (on) { t.tip.textContent = t.mode === 'slew' || t.mode === 'track' ? 'Park the telescope' : 'Track the sky'; placeTip(); }
  host.el.style.cursor = on ? 'pointer' : '';
}
function placeTip() {
  const p = t.elG.localToWorld(v1.copy(t.centre)).add(v2.set(0, R + 4, 0)).project(host.camera);
  t.tip.style.left = ((p.x + 1) / 2 * host.el.clientWidth) + 'px';
  t.tip.style.top = ((1 - p.y) / 2 * host.el.clientHeight) + 'px';
}
function hover(ev) {
  if (host.tweening()) return setHover(false);
  setHover(hit(ev));
}
function tap(ev) {
  const on = hit(ev);
  if (!on) { t.armed = false; setHover(false); return; }
  // touch and pen: the first tap only shows what it is, the second one acts
  if (ev.pointerType !== 'mouse' && !t.armed) { t.armed = true; setHover(true); return; }
  t.armed = false; setHover(false);
  toggle();
}
function key(ev) {
  if ((ev.key === 't' || ev.key === 'T') && !ev.ctrlKey && !ev.metaKey && !ev.altKey) { toggle(); return true; }
  return false;
}
function arrive() {
  const how = matchMedia('(hover: hover)').matches ? 'Click the telescope (or press T)' : 'Tap the telescope';
  if (t.mode !== 'track') say(how + ' to track the sun or a moon', 6000);
}
// leaving the place: labels go; the telescope keeps tracking (it can be seen from everywhere)
function reset() {
  t.armed = false;
  if (t.hover) setHover(false);
  if (t.label) { t.label.hidden = true; t.labelUntil = 0; }
}

export const telescope = {
  setup, step, hover, tap, key, arrive, reset, toggle,
  resume(now) { if (t.move && t.last) t.move.t0 += now - t.last; t.last = now; },   // after station.pause(): carry on where it was
  // R2 (moon bounce) asks what it is pointing at: the target's name while it tracks, else null
  tracking: () => (t.mode === 'track' && t.target ? t.target.name : null),
  state: () => ({ mode: t.mode, target: t.target && t.target.name, az: deg(t.az), el: deg(t.el), az0: deg(t.az0), el0: deg(t.el0), label: t.label && !t.label.hidden && !t.label.classList.contains('gone') ? t.label.textContent : '' }),
};
