// Showroom robot (night run 07): a small six-legged robot that lives on the showroom floor.
//   - the model: robot-model.js (from Smo's assets/robot/orbweaver.glb), the motion: robot-motion.js
//   - it chooses what to do from a weighted list, never the same twice in a row: idling, walking and
//     looking round are common; crouching, stretching and turning less so; the crown, rolling as a
//     ball, the spin and the wave are rare
//   - it keeps to the free floor: an oval inside the ring screen, away from the speaker towers, the
//     bench and the visitor's spot; the rolling ball bounces softly off the same edges
//   - night: it folds into a ball and sleeps; a click wakes it for a moment; at dawn it wakes up
//   - hover: it stops, turns to the visitor and leans in, and glows a little (no light on the robot)
//   - click or tap: the next big animation of a short story (crown; fold and roll, bloom; spin; wave;
//     stretch); a click during a big animation doesn't cut it off
//   - it only runs while the showroom is the open place and pauses with the rest of the site
// The area pattern: setup(host), step(now), tap(ev), hover(ev), arrive(), reset(), resume(now).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildRobot, R } from './robot-model.js';
import { Motion, H } from './robot-motion.js';

const SCALE = 1.5;                                  // the real robot is 0.6 m across; 0.9 m reads from the showroom's view
const FLOOR = { x: -14.75, y: 3.013, z: 14.05 };    // the middle of the showroom floor (viewer coordinates)
const OVAL = { a: 4.2, b: 5.8 };                    // where its middle may go: inside the ring screen, metres
const KEEP_OUT = [                                  // x, z, radius in metres: speaker towers, the bench, the visitor
  [-12.5, 10.5, 0.85], [-10.5, 19.75, 0.85], [-17.0, 17.5, 0.85], [-19.0, 8.5, 0.85],
  [-16.35, 16.6, 1.25], [-14.6, 9.6, 1.1],
];
const START = { x: -14.3, z: 13.2 };
const GLOW = new THREE.Color(0xffa95e);
const STORY = [['crown'], ['fold', 'roll', 'bloom'], ['spin'], ['wave'], ['stretch']];
const CHOICES = [                                   // [what, weight] while standing
  ['idle', 30], ['walk', 28], ['look', 12], ['turn', 8], ['crouch', 5], ['stretch', 4],
  ['wave', 2.5], ['spin', 2.5], ['crown', 2.5], ['roll', 2.5],
];

const S = { host: null, M: null, rig: null, stage: null, ready: false, last: 0, prev: '', story: 0, hovered: false, glow: 0, pulse: 0,
  blob: null, shell: null, sleeping: false, night: false, wakeAt: 0 };
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), sph = new THREE.Sphere();

// ---- the floor it may use, in the stage's units (metres / SCALE, from the floor's middle)
const region = {
  a: OVAL.a / SCALE, b: OVAL.b / SCALE,
  keep: KEEP_OUT.map(([x, z, r]) => [(x - FLOOR.x) / SCALE, (z - FLOOR.z) / SCALE, r / SCALE]),
  // is (x, z) free for a robot of radius m?
  free(x, z, m) {
    const ea = this.a - m * 0.3, eb = this.b - m * 0.3;
    if ((x * x) / (ea * ea) + (z * z) / (eb * eb) > 1) return false;
    for (const [kx, kz, kr] of this.keep) if (Math.hypot(x - kx, z - kz) < kr + m) return false;
    return true;
  },
  // the rolling ball: reflect its velocity off an edge it runs into, losing some speed (soft bounce)
  bounce(p, v) {
    const ra = this.a + 0.15, rb = this.b + 0.15;    // the ball may roll a little closer to the screen than the robot walks
    const e = (p.x * p.x) / (ra * ra) + (p.z * p.z) / (rb * rb);
    if (e > 1) {
      vB.set(p.x / (ra * ra), 0, p.z / (rb * rb)).normalize();
      if (v.dot(vB) > 0) { v.addScaledVector(vB, -1.6 * v.dot(vB)).multiplyScalar(0.7); return true; }
    }
    for (const [kx, kz, kr] of this.keep) {
      const dx = p.x - kx, dz = p.z - kz, d = Math.hypot(dx, dz), lim = kr * 0.8 + R;
      if (d < lim && d > 1e-4) {
        vB.set(dx / d, 0, dz / d);
        if (v.dot(vB) < 0) { v.addScaledVector(vB, -1.6 * v.dot(vB)).multiplyScalar(0.7); return true; }
      }
    }
    return false;
  },
  // a spot it can walk to in a straight line from (x, z)
  pick(x, z) {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.9;
      const tx = Math.cos(a) * this.a * r, tz = Math.sin(a) * this.b * r;
      const d = Math.hypot(tx - x, tz - z);
      if (d < 0.6 || d > 3.2 || !this.free(tx, tz, 0.5)) continue;
      let ok = true;
      for (let s = 1; s < 12 && ok; s++) ok = this.free(x + (tx - x) * s / 12, z + (tz - z) * s / 12, 0.45);
      if (ok) return { x: tx, z: tz };
    }
    return null;
  },
};

function load() {
  new GLTFLoader().load('assets/robot/orbweaver.glb', (g) => {
    const rig = buildRobot(g.scene);
    const stage = new THREE.Group(); stage.name = 'robotstage';
    stage.position.set(FLOOR.x, FLOOR.y, FLOOR.z); stage.scale.setScalar(SCALE);
    stage.add(rig.root);
    // the showroom's own darkening when its roof is closed, and the hover glow on the white shell
    const made = new Map();
    rig.root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false; o.receiveShadow = true;
      const wrap = (m) => { if (!made.has(m)) made.set(m, S.host.darken ? S.host.darken(m) : m); return made.get(m); };
      o.material = Array.isArray(o.material) ? o.material.map(wrap) : wrap(o.material);
    });
    S.shell = [made.get(rig.mats.shell) || rig.mats.shell, made.get(rig.mats.inner) || rig.mats.inner];
    S.blob = blobShadow(); stage.add(S.blob);
    S.host.scene.add(stage);
    S.rig = rig; S.stage = stage;
    const M = new Motion(rig);
    M.region = region;
    S.M = M;
    M.place((START.x - FLOOR.x) / SCALE, (START.z - FLOOR.z) / SCALE, Math.PI / 2, false);
    S.ready = true;
    if (S.host.inPlace()) arrive();
  });
}

function blobShadow() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 3, 32, 32, 32);
  r.addColorStop(0, 'rgba(0,0,0,0.5)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, opacity: 0.75 }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.004; m.renderOrder = 1;
  return m;
}

// ---- what it does next
function choose() {
  const M = S.M;
  if (S.night) {                                       // at night it sleeps as a ball
    if (M.state === 'stand') M.then([['fold', { slow: 1.3 }], ['sleep']]); else M.then([['sleep']]);
    S.prev = 'sleep'; return;
  }
  if (M.state === 'ball') { M.then(Math.random() < 0.5 ? [['peek'], ['bloom']] : [['bloom']]); S.prev = 'bloom'; return; }
  const calm = S.host.reduceMotion();
  let sum = 0;
  for (const [n, w] of CHOICES) if (n !== S.prev && !(calm && (n === 'roll' || n === 'spin'))) sum += w;
  let r = Math.random() * sum, pick = 'idle';
  for (const [n, w] of CHOICES) { if (n === S.prev || (calm && (n === 'roll' || n === 'spin'))) continue; r -= w; if (r <= 0) { pick = n; break; } }
  S.prev = pick;
  const x = M.root.position.x, z = M.root.position.z;
  if (pick === 'walk') { const t = region.pick(x, z); if (t) M.then([['walk', { x: t.x, z: t.z, speed: 0.14 + Math.random() * 0.1 }]]); else M.then([['turn', { heading: M.heading + Math.PI * (0.5 + Math.random()) }]]); return; }
  if (pick === 'turn') { M.then([['turn', { heading: M.heading + (Math.random() < 0.5 ? -1 : 1) * (0.8 + Math.random() * 1.6) }]]); return; }
  if (pick === 'idle') { M.then([['idle', { dur: 2.5 + Math.random() * 4 }]]); return; }
  M.then(sequence(pick));
}
// a big animation, with what has to come before and after it
function sequence(name) {
  const M = S.M, x = M.root.position.x, z = M.root.position.z;
  if (name === 'roll' || name === 'fold') {
    // roll away from the edges: towards the middle, give or take
    const dir = Math.atan2(z, -x) + (Math.random() - 0.5) * 1.6;
    return [['fold'], ['roll', { dir }], ...(Math.random() < 0.5 ? [['peek']] : []), ['bloom']];
  }
  if (name === 'wave') return [['turn', { heading: facing() }], ['wave', { leg: 0 }]];
  if (name === 'bloom') return [['bloom'], ['spin']];
  return [[name]];
}
const facing = () => Math.atan2(-(S.M.look.z - S.M.root.position.z), S.M.look.x - S.M.root.position.x);

// ---- the page calls these
function setup(host) { S.host = host; setTimeout(load, 1500); }   // after the station has loaded
function step(now) {
  if (!S.ready || !S.host.inPlace()) { S.last = now; return; }
  const dt = Math.min(0.05, Math.max(0, (now - (S.last || now)) / 1000)); S.last = now;
  const M = S.M, host = S.host;
  // where the visitor is: the camera, on the floor, in stage units
  S.stage.worldToLocal(M.look.copy(host.camera.position)); M.look.y = 0;
  // day and night: sleeps at night, wakes up at dawn (and for a moment when clicked)
  const night = host.timeOfDay() === 'night';
  if (night !== S.night) { S.night = night; if (!night && M.clipName === 'sleep') wake(); }
  if (S.wakeAt && now > S.wakeAt) { S.wakeAt = 0; }
  if (M.clipName === 'sleep' && !M.wake && !night) wake();
  if (!M.clip && !M.queue.length) choose();
  if (S.hovered && !M.big && M.state === 'stand' && M.clipName !== 'look') { M.queue.length = 0; M.play('look', { until: () => S.hovered }); }
  M.update(dt);
  // the glow: eases in on hover, a short pulse on a tap
  S.pulse = Math.max(0, S.pulse - dt);
  const want = S.hovered || S.pulse > 0 ? 1 : 0;
  S.glow += (want - S.glow) * Math.min(1, dt * 8);
  S.shell.forEach((m) => { m.emissive.copy(GLOW); m.emissiveIntensity = 0.3 * S.glow; });
  // the soft shadow follows the body, wider when it stands
  const b = S.rig.body.position, spread = THREE.MathUtils.clamp((b.y - R) / (H - R), 0, 1);
  vA.copy(b).applyMatrix4(M.root.matrix);
  S.blob.position.set(vA.x, 0.004, vA.z);
  const w = M.state === 'ball' && spread < 0.1 ? 0.75 : 0.75 + 0.45 * spread;
  S.blob.scale.set(w, w, 1);
}
function wake() {
  const M = S.M;
  M.wake = true;
  M.queue.length = 0;
  M.then([['twitch'], ['bloom', { slow: 1.35 }], ['stretch'], ['look', { around: true, hold: 1.6 }]]);
}
function hit(ev) {
  if (!S.ready || !S.host.inPlace()) return false;
  S.host.setRay(ev);
  S.rig.body.getWorldPosition(vA);
  const r = (S.M.state === 'ball' ? R * 1.15 : 0.55) * SCALE;
  return S.host.ray.ray.intersectsSphere(sph.set(vA, r));
}
function hover(ev) {
  const on = !!ev && hit(ev);
  S.hovered = on;
  return on;
}
function tap(ev) {
  if (!hit(ev)) return false;
  const M = S.M;
  S.pulse = 0.6;
  if (M.clipName === 'sleep' || (S.night && M.state === 'ball')) { wake(); return true; }
  if (M.big || M.queue.some(([n]) => n === 'roll' || n === 'bloom' || n === 'twitch')) return true;   // never cut a big one short
  M.queue.length = 0;
  if (M.state === 'ball') { M.then([['peek'], ['bloom'], ['spin']]); S.story = 2; return true; }
  const part = STORY[S.story % STORY.length]; S.story++;
  M.then(part.length === 1 ? sequence(part[0]) : sequence('roll'));
  S.prev = part[0];
  return true;
}
// arriving in the showroom: asleep at night, otherwise as it was
function arrive() {
  if (!S.ready) return;
  S.last = 0;
  S.night = S.host.timeOfDay() === 'night';
  if (S.night && S.M.clipName !== 'sleep') {
    const M = S.M; M.place(M.root.position.x, M.root.position.z, M.heading, true); M.play('sleep');
  }
}
function reset() { S.hovered = false; }
function resume(now) { S.last = now; }

export const robot = { setup, step, tap, hover, arrive, reset, resume, get M() { return S.M; }, get ready() { return S.ready; }, region };
