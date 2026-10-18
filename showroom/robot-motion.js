// Showroom robot, the motion (night run 07). Everything moves procedurally, in the robot's own units
// (the ball's radius is 0.3), on a floor at y = 0 of the `stage` group the showroom places and scales.
//
// How it works
//   - A pose is: the body's place and turn (relative to `root`, the robot's spot and heading on the
//     floor), per leg either a foot target on the floor (solved by IK each frame, so planted feet never
//     slide) or three joint angles, the six petal angles, the mast (0 down, 1 up) and a ground flag.
//   - A clip writes a pose every frame. When a clip starts, the last pose is kept and blended into the
//     new clip's poses over its `blend` time: feet that are on the floor in both stay where they are,
//     everything else blends joint by joint. So any clip can follow any other.
//   - ground 1: after posing, the whole robot is moved up or down so its lowest point touches the floor
//     (the ball, the bloom, the flip); ground 2: only lifted, never pushed into the floor.
//   - The gait (tripod: legs 0, 2, 4 and 1, 3, 5) places each swing foot where its home spot will be
//     when it lands, so walking, turning and stepping back into stance are one mechanism.
// To add an animation: write a clip object { name, blend, big, start(M, o), update(M, dt, P) -> done }
// and add it to CLIPS. Helpers: stance(), lerpAngles(), env(), the gait, M.footHome().
import * as THREE from 'three';
import { R, LEG, psi, ballAngles } from './robot-model.js';

const V3 = THREE.Vector3, Q = THREE.Quaternion;
const UP = new V3(0, 1, 0), ONE = new V3(1, 1, 1), ZERO = new V3();
export const H = 0.385, RH = 0.455;                          // standing body height and foot radius
const H_CROUCH = 0.245, R_CROUCH = 0.4, H_CROWN = 0.5, R_CROWN = 0.33;
const BALL = ballAngles();

// ---- easing
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const smooth = (t) => { t = clamp01(t); return t * t * t * (t * (6 * t - 15) + 10); };
const inOut = (t) => { t = clamp01(t); return 0.5 - 0.5 * Math.cos(Math.PI * t); };
const outBack = (t, s = 1.6) => { t = clamp01(t) - 1; return 1 + t * t * ((s + 1) * t + s); };
const seg = (t, a, b) => clamp01((t - a) / (b - a));              // 0..1 while t runs from a to b
const env = (t, a, b, c, d) => smooth(seg(t, a, b)) * (1 - smooth(seg(t, c, d)));   // up a..b, hold, down c..d
const wobble = (t, f, damp) => (t <= 0 ? 0 : Math.exp(-damp * t) * Math.sin(2 * Math.PI * f * t));
const lerp = THREE.MathUtils.lerp;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---- poses
function makePose() {
  const p = { bpos: new V3(0, H, 0), bq: new Q(), ik: [], foot: [], q: new Float32Array(18), petal: new Float32Array(6), mast: 0, ground: 0 };
  for (let k = 0; k < 6; k++) { p.ik.push(true); p.foot.push(new V3()); p.q.set(BALL, k * 3); }
  return p;
}
function copyPose(a, b) {
  a.bpos.copy(b.bpos); a.bq.copy(b.bq); a.q.set(b.q); a.petal.set(b.petal); a.mast = b.mast; a.ground = b.ground;
  for (let k = 0; k < 6; k++) { a.ik[k] = b.ik[k]; a.foot[k].copy(b.foot[k]); }
}
export const lerpAngles = (P, k, a, b, t) => { for (let i = 0; i < 3; i++) P.q[k * 3 + i] = lerp(a[i], b[i], t); P.ik[k] = false; };

// ---- scratch (nothing is allocated per frame)
const vA = new V3(), vB = new V3(), vC = new V3(), qA = new Q(), qB = new Q();
const mBody = new THREE.Matrix4(), mBS = new THREE.Matrix4(), mInv = new THREE.Matrix4(), mRootInv = new THREE.Matrix4();
const qTmp = new Float32Array(3), qIK = new Float32Array(3), gA = new V3();

// ---- the motion controller
export class Motion {
  constructor(rig) {
    this.rig = rig; this.root = rig.root; this.body = rig.body;
    this.heading = 0;
    this.P = makePose(); this.O = makePose(); this.F = makePose();
    this.blend = 1; this.blendDur = 0.3; this.clip = null; this.clipName = ''; this.queue = [];
    this.feet = []; for (let k = 0; k < 6; k++) this.feet.push(new V3());
    this.state = 'stand';
    this.look = new V3();                                   // where the visitor is (stage units), set by the showroom
    this.region = null;                                     // keeps the rolling ball inside the room
    this.gait = new Gait(this);
    this.samples = contactSamples(rig);
    this.coxa = []; for (let k = 0; k < 6; k++) { const a = psi(k); this.coxa.push(new V3(LEG.rc * Math.cos(a), LEG.yc, -LEG.rc * Math.sin(a))); }
    this.STAND = new Float32Array(3); this.solveLocal(0, vA.set(RH, -H, 0), this.STAND);   // one leg's angles when standing
  }
  // foot k's home spot on the floor (stage units) for a robot at (x, z) facing heading, radius r
  footHome(k, x, z, heading, r, out) { const a = psi(k) + heading; return out.set(x + r * Math.cos(a), 0, z - r * Math.sin(a)); }
  // start the robot as a standing robot or a ball at (x, z)
  place(x, z, heading, ball) {
    this.root.position.set(x, 0, z); this.heading = heading; this.root.rotation.y = heading;
    const O = this.O;
    O.bpos.set(0, ball ? R : H, 0); O.bq.identity(); O.petal.fill(0); O.mast = 0; O.ground = 0;
    for (let k = 0; k < 6; k++) {
      this.footHome(k, x, z, heading, ball ? 0 : RH, O.foot[k]);
      O.ik[k] = !ball; O.q.set(BALL, k * 3);
    }
    this.state = ball ? 'ball' : 'stand';
    if (!ball) { this.bodyMatrix(O); for (let k = 0; k < 6; k++) { this.solve(k, O.foot[k], qIK); O.q.set(qIK, k * 3); } }
    copyPose(this.P, O); copyPose(this.F, O); this.blend = 1; this.clip = null; this.queue.length = 0;
    this.apply(O, 0);
  }
  play(name, opts) {
    const c = CLIPS[name]; if (!c) return;
    copyPose(this.F, this.O);
    for (let k = 0; k < 6; k++) this.F.foot[k].copy(this.feet[k]);
    copyPose(this.P, this.O);
    this.clip = c; this.clipName = name; this.clipT = 0; this.blend = 0; this.blendDur = opts && opts.blend !== undefined ? opts.blend : c.blend;
    c.start(this, opts || {});
  }
  then(list) { this.queue.push(...list); }                 // [[name, opts], ...] to play after the current clip
  get big() { return !!(this.clip && this.clip.big); }
  update(dt) {
    if (!this.clip && this.queue.length) { const [n, o] = this.queue.shift(); this.play(n, o); }
    if (!this.clip) this.play(this.state === 'ball' ? 'rest' : 'idle', { dur: 0.6 });
    this.clipT += dt;
    const done = this.clip.update(this, dt, this.P);
    this.blend = this.blendDur > 0 ? Math.min(1, this.blend + dt / this.blendDur) : 1;
    this.mix(this.F, this.P, smooth(this.blend), this.O);
    this.apply(this.O, dt);
    if (done) { this.clip = null; }
  }
  // blend the kept pose F into the clip's pose P by w
  mix(F, P, w, O) {
    O.bpos.lerpVectors(F.bpos, P.bpos, w); O.bq.slerpQuaternions(F.bq, P.bq, w);
    for (let i = 0; i < 6; i++) O.petal[i] = lerp(F.petal[i], P.petal[i], w);
    O.mast = lerp(F.mast, P.mast, w); O.ground = w < 0.5 && F.ground ? F.ground : P.ground;
    this.bodyMatrix(O);
    for (let k = 0; k < 6; k++) {
      if (P.ik[k]) {
        if (F.ik[k] || w >= 1) { O.foot[k].lerpVectors(F.foot[k], P.foot[k], w); this.solve(k, O.foot[k], qIK); for (let i = 0; i < 3; i++) O.q[k * 3 + i] = qIK[i]; }
        else { this.solve(k, P.foot[k], qIK); for (let i = 0; i < 3; i++) O.q[k * 3 + i] = lerp(F.q[k * 3 + i], qIK[i], w); O.foot[k].copy(P.foot[k]); }
        O.ik[k] = true;
      } else {
        for (let i = 0; i < 3; i++) O.q[k * 3 + i] = lerp(F.q[k * 3 + i], P.q[k * 3 + i], w);
        O.ik[k] = false;
      }
    }
  }
  bodyMatrix(O) {
    this.root.rotation.y = this.heading; this.root.updateMatrix();
    mBody.compose(O.bpos, O.bq, ONE); mBS.multiplyMatrices(this.root.matrix, mBody); mInv.copy(mBS).invert();
  }
  // IK: joint angles for leg k so its foot (plate tip) reaches `target` (stage units)
  solve(k, target, out) { vC.copy(target).applyMatrix4(mInv); return this.solveLocal(k, vC, out); }
  solveLocal(k, p, out) {
    const a = psi(k), c = this.coxa[k] || vB.set(LEG.rc * Math.cos(a), LEG.yc, -LEG.rc * Math.sin(a));
    const dx = p.x - c.x, dy = p.y - c.y, dz = p.z - c.z;
    const rad = dx * Math.cos(a) - dz * Math.sin(a), lat = dx * Math.sin(a) + dz * Math.cos(a);
    let q0, h;
    if (Math.abs(rad) < 1e-6) { q0 = 0; h = 0; } else { q0 = Math.atan(-lat / rad); h = Math.sign(rad) * Math.hypot(rad, lat); }
    q0 = Math.max(-1.35, Math.min(1.35, q0));
    const u = h - LEG.lc, v = dy, lf = LEG.lf, lt = LEG.lt;
    const L = Math.max(lt - lf + 1e-3, Math.min(lf + lt - 1e-3, Math.hypot(u, v)));
    const b = Math.atan2(v, u);
    const ca = Math.max(-1, Math.min(1, (lf * lf + L * L - lt * lt) / (2 * lf * L)));
    const ck = Math.max(-1, Math.min(1, (lf * lf + lt * lt - L * L) / (2 * lf * lt)));
    out[0] = q0; out[1] = b + Math.acos(ca); out[2] = -(Math.PI - Math.acos(ck));
    return out;
  }
  // write a pose to the bones, then the ground contact, then where the feet are now
  apply(O, dt) {
    const { body, legs, petals, mast } = this.rig;
    this.root.rotation.y = this.heading;
    body.position.copy(O.bpos); body.quaternion.copy(O.bq);
    for (let k = 0; k < 6; k++) {
      const L = legs[k];
      L.coxa.rotation.y = L.a + O.q[k * 3]; L.femur.rotation.z = O.q[k * 3 + 1]; L.tibia.rotation.z = O.q[k * 3 + 2];
      petals[k].rotation.z = -O.petal[k];
    }
    mast.position.y = O.mast * 0.13 - 0.03; mast.visible = O.mast > 0.02;
    this.root.updateMatrixWorld(true);
    if (O.ground) {
      mRootInv.copy(this.root.matrixWorld).invert();
      let low = Infinity;
      for (const s of this.samples) {
        const m = s.bone.matrixWorld;
        for (const p of s.pts) { vA.copy(p).applyMatrix4(m).applyMatrix4(mRootInv); if (vA.y < low) low = vA.y; }
      }
      const dy = O.ground === 1 ? -low : Math.max(0, -low);
      if (Math.abs(dy) > 1e-5) { O.bpos.y += dy; body.position.y = O.bpos.y; this.root.updateMatrixWorld(true); }
    }
    const stage = this.root.parent;
    for (let k = 0; k < 6; k++) { legs[k].foot.getWorldPosition(this.feet[k]); stage.worldToLocal(this.feet[k]); }
  }
  // move the body's turn about the vertical into the heading (after a roll, the body is turned freely)
  rebase() {
    const O = this.O;
    const yaw = twistY(O.bq);
    if (Math.abs(yaw) < 1e-4) return;
    this.heading = wrap(this.heading + yaw);
    qA.setFromAxisAngle(UP, -yaw);
    [this.O, this.P, this.F].forEach((p) => { p.bq.premultiply(qA); p.bpos.applyQuaternion(qA); });
    this.bodyMatrix(O);
  }
  bodyUp(out) { return out.copy(UP).applyQuaternion(this.O.bq); }
}
function twistY(q) { return 2 * Math.atan2(q.y, q.w); }    // the turn of q about the vertical

// the points that can touch the floor: plate tips and outlines, petal outlines, the body's bottom
function contactSamples(rig) {
  const out = [];
  const tmp = new THREE.Vector3();
  rig.root.updateMatrixWorld(true);
  const toLocal = (bone, pts) => { const inv = new THREE.Matrix4().copy(bone.matrixWorld).invert(); return pts.map((p) => p.clone().applyMatrix4(rig.body.matrixWorld).applyMatrix4(inv)); };
  const S = (lat, lon, r = R) => new V3(r * Math.cos(lat) * Math.cos(lon), r * Math.sin(lat), -r * Math.cos(lat) * Math.sin(lon));
  rig.legs.forEach((L) => {
    const a = L.a, w = Math.PI / 6 - 0.02, pts = [];
    for (const lat of [-1.5707, -1.2, -0.8, -0.4, -0.02]) pts.push(S(lat, a));
    for (const lat of [-0.9, -0.4, -0.02]) { pts.push(S(lat, a - w)); pts.push(S(lat, a + w)); }
    out.push({ bone: L.tibia, pts: toLocal(L.tibia, pts) });
    out.push({ bone: L.femur, pts: toLocal(L.femur, [tmp.set(0, 0, 0).applyMatrix4(L.femur.matrixWorld).applyMatrix4(new THREE.Matrix4().copy(rig.body.matrixWorld).invert()).clone()]) });
  });
  rig.petals.forEach((p, k) => {
    const a = psi(k), w = Math.PI / 6 - 0.02, pts = [];
    for (const lat of [0.02, 0.4, 0.8, 1.2, 1.5707]) pts.push(S(lat, a));
    for (const lat of [0.02, 0.5, 1.0]) { pts.push(S(lat, a - w)); pts.push(S(lat, a + w)); }
    out.push({ bone: p, pts: toLocal(p, pts) });
  });
  out.push({ bone: rig.body, pts: [new V3(0, -0.13, 0)] });
  return out;
}

// ---- tripod gait: feet stay planted until their group swings; a swing lands where home will be
class Gait {
  constructor(M) { this.M = M; this.phase = 0; this.on = [0, 0, 0, 0, 0, 0]; this.from = []; this.to = []; for (let k = 0; k < 6; k++) { this.from.push(new V3()); this.to.push(new V3()); } this.radius = RH; this.lift = 0.05; this.active = false; }
  reset(radius) { this.radius = radius || RH; this.on.fill(0); this.active = false; }
  // feet far from home make the gait step even when the robot stands still
  far(k, x, z, h) { const g = this.M.footHome(k, x, z, h, this.radius, gA); return Math.hypot(g.x - this.M.feet[k].x, g.z - this.M.feet[k].z); }
  // advance by dt with root speed `speed` (stage units/s along vel) and turn rate `omega`; writes P's feet.
  // Returns true while any foot is still swinging or out of place.
  step(dt, vel, omega, P, freq) {
    const M = this.M, x = M.root.position.x, z = M.root.position.z, h = M.heading;
    const speed = vel.length();
    let need = speed > 0.004 || Math.abs(omega) > 0.02;
    if (!need) for (let k = 0; k < 6; k++) if (this.far(k, x, z, h) > 0.02) { need = true; break; }
    const swinging = this.on.some((v) => v);
    if (!need && !swinging) { this.active = false; for (let k = 0; k < 6; k++) { P.ik[k] = true; P.foot[k].copy(M.feet[k]).setY(0); } return false; }
    this.active = true;
    const f = freq || Math.min(2.6, 1.5 + speed * 3 + Math.abs(omega) * 0.6);
    const p0 = this.phase; this.phase = (this.phase + dt * f) % 1;
    const T = 0.75 / f;                                     // a foot lands about this much ahead
    for (let k = 0; k < 6; k++) {
      const start = k % 2 ? 0.5 : 0;
      const s = ((this.phase - start + 1) % 1) / 0.42;      // 0..1 during the swing window
      const s0 = ((p0 - start + 1) % 1) / 0.42;
      if (!this.on[k] && s < 1 && s0 > s && (need || this.far(k, x, z, h) > 0.01)) { this.on[k] = 1; this.from[k].copy(M.feet[k]).setY(0); }
      if (this.on[k]) {
        M.footHome(k, x + vel.x * T, z + vel.z * T, h + omega * T, this.radius, this.to[k]);
        // swing round the body (angle and distance), so a fast turn never pulls a foot under it
        const e = inOut(Math.min(1, s)), f0 = this.from[k], f1 = this.to[k];
        const a0 = Math.atan2(f0.z - z, f0.x - x), a1 = a0 + wrap(Math.atan2(f1.z - z, f1.x - x) - a0);
        const r = lerp(Math.hypot(f0.x - x, f0.z - z), Math.hypot(f1.x - x, f1.z - z), e), an = lerp(a0, a1, e);
        P.foot[k].set(x + r * Math.cos(an), 0, z + r * Math.sin(an));
        P.foot[k].y = this.lift * Math.sin(Math.PI * Math.min(1, s)) * (0.6 + 0.4 * Math.min(1, speed * 6 + Math.abs(omega)));
        if (s >= 1) { this.on[k] = 0; P.foot[k].y = 0; }
      } else { P.foot[k].copy(M.feet[k]); P.foot[k].y = 0; }
      P.ik[k] = true;
    }
    return true;
  }
  bob() { return Math.cos(this.phase * 4 * Math.PI); }     // two bobs per cycle (one per tripod)
}

// the body standing still at height h, with breathing; feet stay where they are
function stance(M, P, h) {
  P.bpos.set(0, h, 0); P.bq.identity(); P.ground = 0; P.mast = 0;
  for (let k = 0; k < 6; k++) { P.ik[k] = true; P.foot[k].copy(M.feet[k]).setY(0); }
}
const eul = new THREE.Euler();
const tilt = (P, pitch, roll, yaw = 0) => { eul.set(roll, yaw, pitch, 'YXZ'); P.bq.setFromEuler(eul); };   // pitch: front (+x) down when < 0

// ---- the clips
const rnd = Math.random;
const CLIPS = {};

// a closed ball resting (also the default while nothing else runs in ball state)
CLIPS.rest = {
  blend: 0.3, big: false,
  start(M, o) { this.dur = o.dur || 1; this.t = 0; },
  update(M, dt, P) { this.t += dt; ballPose(M, P); return this.t > this.dur; },
};
function ballPose(M, P) {
  for (let k = 0; k < 6; k++) { P.ik[k] = false; P.q.set(BALL, k * 3); }
  P.petal.fill(0); P.mast = 0; P.ground = 0; P.bpos.set(0, R, 0);
}

// 1. idle, alive: breathing, weight shifts, now and then a tapping leg or the petals opening a crack
CLIPS.idle = {
  blend: 0.35, big: false,
  start(M, o) {
    this.t = 0; this.dur = o.dur || 3 + rnd() * 4; this.seed = rnd() * 10;
    this.tap = rnd() < 0.45 ? { k: (rnd() * 6) | 0, at: 0.6 + rnd() * (this.dur - 2) } : null;
    this.crack = rnd() < 0.5 ? 0.4 + rnd() * (this.dur - 1.6) : -9;
    M.gait.reset(RH);
  },
  update(M, dt, P) {
    const t = (this.t += dt), s = this.seed;
    const settling = M.gait.step(dt, ZERO, 0, P);
    P.bpos.set(0.012 * Math.sin(t * 0.7 + s) , H + 0.004 * Math.sin(t * 2 * Math.PI / 3.4) - 0.003, 0.012 * Math.sin(t * 0.53 + s * 2));
    tilt(P, -0.035 * Math.sin(t * 0.7 + s), 0.035 * Math.sin(t * 0.53 + s * 2), 0.02 * Math.sin(t * 0.31 + s));
    P.ground = 0; P.mast = 0;
    if (this.tap && !settling) {                            // lift, two taps, back down
      const u = t - this.tap.at, k = this.tap.k;
      if (u > 0 && u < 1.6) {
        M.footHome(k, M.root.position.x, M.root.position.z, M.heading, RH + 0.03, vA);
        const lift = env(u, 0, 0.3, 1.25, 1.6);
        const tapY = 0.045 * lift - 0.03 * Math.max(0, Math.sin((u - 0.35) * Math.PI * 2 / 0.42)) * (u > 0.35 && u < 1.2 ? 1 : 0);
        P.foot[k].lerpVectors(M.feet[k], vA, lift * 0.5); P.foot[k].y = Math.max(0, tapY);
        P.bpos.x -= 0.012 * lift * Math.cos(psi(k)); P.bpos.z += 0.012 * lift * Math.sin(psi(k));
      }
    }
    const c = env(t - this.crack, 0, 0.7, 1.2, 1.9);
    for (let k = 0; k < 6; k++) P.petal[k] = c * (0.1 + 0.03 * Math.sin(k * 2.1 + s));
    return t > this.dur && !settling;
  },
};

// 2. walk to a spot: tripod gait, smooth speed, body bob and sway; 3. turn on the spot uses it too
CLIPS.walk = {
  blend: 0.3, big: false,
  start(M, o) { this.target = new V3(o.x, 0, o.z); this.speed = 0; this.omega = 0; this.t = 0; this.max = o.speed || 0.2; this.face = o.face; this.arrived = false; this.vel = this.vel || new V3(); M.gait.reset(RH); },
  update(M, dt, P) {
    this.t += dt;
    const pos = M.root.position;
    vA.subVectors(this.target, pos); vA.y = 0;
    const d = vA.length();
    let want = this.face !== undefined && d < 0.04 ? this.face : Math.atan2(-vA.z, vA.x);
    const err = wrap(want - M.heading);
    // slow down to turn when facing away, arrive smoothly
    const vWant = d < 0.03 ? 0 : this.max * Math.min(1, d / 0.35) * Math.max(0, Math.cos(err)) ** 2;
    this.speed += (vWant - this.speed) * Math.min(1, dt * 2.2);
    const wWant = Math.max(-1.1, Math.min(1.1, err * 2.2));
    this.omega += (wWant - this.omega) * Math.min(1, dt * 4);
    if (d < 0.03 && (this.face === undefined || Math.abs(err) < 0.05)) { this.speed *= 0.8; this.omega *= 0.8; }
    M.heading = wrap(M.heading + this.omega * dt);
    this.vel.set(Math.cos(M.heading), 0, -Math.sin(M.heading)).multiplyScalar(this.speed);
    pos.addScaledVector(this.vel, dt);
    const moving = M.gait.step(dt, this.vel, this.omega, P);
    const b = M.gait.bob() * Math.min(1, this.speed * 8 + Math.abs(this.omega));
    P.bpos.set(0.01 * this.speed * 4, H - 0.006 * b - 0.004, 0); P.ground = 0; P.mast = 0; P.petal.fill(0);
    tilt(P, -0.12 * this.speed - 0.01 * b, -0.05 * this.omega * Math.min(1, this.speed * 6) + 0.012 * Math.sin(M.gait.phase * 2 * Math.PI) * Math.min(1, this.speed * 8));
    return d < 0.04 && Math.abs(this.speed) < 0.01 && Math.abs(this.omega) < 0.05 && !moving && this.t > 0.3;
  },
};
CLIPS.turn = {
  blend: 0.3, big: false,
  start(M, o) { this.to = o.heading; this.omega = 0; this.t = 0; this.fast = o.fast || 1; M.gait.reset(RH); },
  update(M, dt, P) {
    this.t += dt;
    const err = wrap(this.to - M.heading);
    const wWant = Math.max(-1.3 * this.fast, Math.min(1.3 * this.fast, err * 3));
    this.omega += (wWant - this.omega) * Math.min(1, dt * 5);
    M.heading = wrap(M.heading + this.omega * dt);
    const moving = M.gait.step(dt, ZERO, this.omega, P);
    const b = M.gait.bob() * Math.min(1, Math.abs(this.omega));
    P.bpos.set(0, H - 0.005 * b - 0.003, 0); P.bq.identity(); P.ground = 0; P.mast = 0; P.petal.fill(0);
    return Math.abs(err) < 0.02 && Math.abs(this.omega) < 0.05 && !moving;
  },
};

// 4. look and lean: turn the front (leg 0) to the visitor, lean in, tilt the body to one side
CLIPS.look = {
  blend: 0.35, big: false,
  start(M, o) { this.t = 0; this.hold = o.hold || 1.8 + rnd() * 1.2; this.side = rnd() < 0.5 ? -1 : 1; this.omega = 0; this.leanT = -1; this.until = o.until || null; this.around = !!o.around; M.gait.reset(RH); },
  update(M, dt, P) {
    const t = (this.t += dt);
    vA.subVectors(M.look, M.root.position);
    let want = Math.atan2(-vA.z, vA.x);
    if (this.around) want = this.base === undefined ? (this.base = M.heading) : this.base + 0.55 * Math.sin(t * 1.3);
    const err = wrap(want - M.heading);
    const turning = !this.around && Math.abs(err) > 0.12 && this.leanT < 0;
    const wWant = turning ? Math.max(-1.4, Math.min(1.4, err * 3)) : 0;
    this.omega += (wWant - this.omega) * Math.min(1, dt * 5);
    M.heading = wrap(M.heading + this.omega * dt);
    const moving = M.gait.step(dt, ZERO, this.omega, P);
    if (!turning && !moving && this.leanT < 0) this.leanT = t;
    const lt = this.leanT < 0 ? 0 : t - this.leanT;
    const holding = this.until ? this.until() : lt < this.hold + 0.5;
    if (this.leanT >= 0 && !holding && this.outT === undefined) this.outT = lt;
    const outU = this.outT === undefined ? 0 : lt - this.outT;
    const k = smooth(lt / 0.5) * (1 - smooth(outU / 0.6));
    const swap = smooth((lt - 1.4) / 0.5) * (this.until ? 0 : 1);   // the head tilt changes side once
    const side = this.side * (1 - 2 * swap) * (this.around ? 0.5 : 1);
    const lean = this.around ? 0.3 : 1;
    P.bpos.set(0.04 * k * lean, H - 0.018 * k * lean + 0.004 * Math.sin(t * 2), 0.006 * side * k);
    tilt(P, -0.17 * k * lean, 0.13 * side * k, this.around ? wrap(want - M.heading) * k : 0);
    P.ground = 0; P.mast = 0;
    for (let i = 0; i < 6; i++) P.petal[i] = k * (i === 0 || i === 1 || i === 5 ? 0.08 : 0.03);
    return this.outT !== undefined && outU > 0.65;
  },
};

// 5. crouch and hide: legs pulled in fast, body down into the bud, slowly up again and a peek
CLIPS.crouch = {
  blend: 0.15, big: true,
  start(M, o) { this.t = 0; for (let k = 0; k < 6; k++) { this.from = this.from || []; this.from[k] = (this.from[k] || new V3()).copy(M.feet[k]); } this.stepping = false; M.gait.reset(R_CROUCH); },
  update(M, dt, P) {
    const t = (this.t += dt), x = M.root.position.x, z = M.root.position.z;
    const pull = smooth(seg(t, 0.06, 0.34));
    const rise = smooth(seg(t, 2.1, 3.3)), up = smooth(seg(t, 4.5, 5.2));
    for (let k = 0; k < 6; k++) {
      M.footHome(k, x, z, M.heading, lerp(R_CROUCH, RH, up), vA);
      P.ik[k] = true; P.foot[k].lerpVectors(this.from[k], vA, t < 4.5 ? pull : 1);
      if (t < 4.5) P.foot[k].y = 0.035 * Math.sin(Math.PI * pull) * (k % 2 ? 1 : 0.7);
      else { P.foot[k].copy(M.feet[k]); }
    }
    if (t >= 4.5) { M.gait.radius = RH; M.gait.step(dt, ZERO, 0, P); }
    const tremble = 0.0015 * Math.sin(t * 37) * env(t, 0.4, 0.6, 1.6, 2.0);
    const peekH = lerp(H_CROUCH, H * 0.92, rise);
    P.bpos.set(0, lerp(H, H_CROUCH, smooth(seg(t, 0.02, 0.3))) + 0.012 * Math.sin(Math.PI * seg(t, 0, 0.08)) + tremble, 0);
    if (t > 2.1) P.bpos.y = lerp(peekH, H, up);
    const peekYaw = env(t, 3.1, 3.5, 4.2, 4.6) * 0.18 * Math.sin((t - 3.1) * 3.2);
    tilt(P, -0.06 * env(t, 3.0, 3.4, 4.4, 4.8), 0, peekYaw);
    for (let i = 0; i < 6; i++) P.petal[i] = env(t, 2.9, 3.3, 4.3, 4.8) * (i < 2 || i === 5 ? 0.16 : 0.05);
    P.ground = 0; P.mast = 0;
    return t > 5.3 && !M.gait.active;
  },
};

// 6. fold into the ball: anticipation, the legs draw in one after another, plates swing under, petals close
CLIPS.fold = {
  blend: 0.25, big: true,
  start(M, o) {
    this.t = 0; this.from = this.from || []; for (let k = 0; k < 6; k++) this.from[k] = (this.from[k] || new V3()).copy(M.feet[k]);
    this.order = [0, 3, 1, 4, 2, 5].map((k) => (k + ((rnd() * 6) | 0)) % 6);   // a wave, opposite legs in turn
    this.slow = o.slow || 1;
  },
  update(M, dt, P) {
    const t = (this.t += dt / this.slow);
    const x = M.root.position.x, z = M.root.position.z;
    const ant = env(t, 0, 0.25, 0.3, 0.55);
    const hb = lerp(H, R, smooth(seg(t, 0.4, 1.9)));
    P.bpos.set(0, hb - 0.025 * ant + 0.006 * wobble(t - 2.2, 3, 5), 0);
    tilt(P, 0.04 * Math.sin(t * 2.6) * env(t, 0.5, 0.8, 1.6, 2.0), 0.04 * Math.cos(t * 2.1) * env(t, 0.5, 0.8, 1.6, 2.0));
    for (let i = 0; i < 6; i++) {
      const k = this.order[i], a = 0.45 + i * 0.22, s = smooth(seg(t, a, a + 0.6));
      vA.set(x, 0, z);
      P.ik[k] = true; P.foot[k].lerpVectors(this.from[k], vA, s);
      P.foot[k].y = 0.06 * Math.sin(Math.PI * s);
      if (t > 2.15) { P.ik[k] = false; P.q.set(BALL, k * 3); }
    }
    const crack = env(t, 0.1, 0.4, 1.5, 2.1);
    for (let i = 0; i < 6; i++) P.petal[i] = crack * 0.12;
    P.ground = 0; P.mast = 0;
    if (t > 2.15) { ballPose(M, P); P.bpos.y = R; }
    if (t > 2.6) { M.state = 'ball'; return true; }
    return false;
  },
};

// 7. roll: a path across the floor, worked out in advance: straight runs, curves, soft bounces off the
// walls and benches, slowing down, rocking, and coming to rest tilted, plates upward (for the bloom).
// The ball turns by exactly the distance it travels (angle = distance / radius) about the axis at right
// angles to the travel.
const PATH_MAX = 60 * 16;
const REST_UP = -0.8;                                      // at rest the dome faces down and sideways, the plates up (pose-bloom)
CLIPS.roll = {
  blend: 0.2, big: true,
  start(M, o) {
    if (!this.buf) { this.buf = new Float32Array(PATH_MAX * 6); this.tq = new Q(); this.v = new V3(); this.p = new V3(); }
    // the body's turn about the vertical goes into the ball; the heading is 0 while it rolls
    const q0 = qB.setFromAxisAngle(UP, M.heading).multiply(M.O.bq);
    M.heading = 0; M.root.rotation.y = 0; M.O.bq.copy(q0); M.F.bq.copy(q0); M.P.bq.copy(q0);
    this.n = planRoll(M, this.buf, q0, o.dir !== undefined ? o.dir : rnd() * Math.PI * 2);
    this.t = 0;
  },
  update(M, dt, P) {
    this.t += dt;
    const f = Math.min(this.n - 1.001, this.t * 60), i = Math.floor(f), w = f - i, b = this.buf;
    M.root.position.set(lerp(b[i * 6], b[i * 6 + 6], w), 0, lerp(b[i * 6 + 1], b[i * 6 + 7], w));
    qA.set(b[i * 6 + 2], b[i * 6 + 3], b[i * 6 + 4], b[i * 6 + 5]); qB.set(b[i * 6 + 8], b[i * 6 + 9], b[i * 6 + 10], b[i * 6 + 11]);
    ballPose(M, P); P.bq.slerpQuaternions(qA, qB, w);
    return f >= this.n - 1.01;
  },
};
// simulate the roll at 60 Hz into buf (x, z, quaternion); returns the number of steps. The distance it
// takes to slow down is chosen so that it comes to rest lying on its side.
function planRoll(M, buf, q0, dir) {
  let steps = 0;
  const reg = M.region, dt = 1 / 60, vmax = 0.75, free = 1.8 + rnd() * 1.4, vEnd = 0.07, w = 2 * Math.PI / 0.75;
  const run = (decelDist, write) => {
    const p = vA.set(M.root.position.x, 0, M.root.position.z), v = vB, q = qA.copy(q0);
    let speed = 0, a = dir, n = 0, phase = 0, t = 0, decel = 0, rockDir = 0, rock = 0, tr = 0;
    while (n < PATH_MAX) {
      t += dt;
      let dx, dz;
      if (phase < 2) {
        if (phase === 0) {                                  // tips over and gathers speed, curving gently
          speed = Math.min(vmax, speed + dt * (0.2 + 1.1 * Math.min(1, t * 1.2)));
          a += dt * 0.55 * Math.sin(t * 0.9 + dir * 3);
          if (t > free) { phase = 1; decel = (speed * speed - vEnd * vEnd) / (2 * decelDist); }
        } else {                                            // slows down evenly
          a += dt * 0.25 * Math.sin(t * 0.9 + dir * 3);
          speed = Math.max(vEnd, speed - decel * dt);
          if (speed <= vEnd + 1e-4) { phase = 2; rockDir = a; }
        }
        v.set(Math.cos(a), 0, -Math.sin(a)).multiplyScalar(speed);
        if (reg && reg.bounce(p, v)) {                      // soft bounce: reflected, some speed lost
          a = Math.atan2(-v.z, v.x); speed = v.length();
          if (phase === 1) decel = Math.max(0.04, (speed * speed - vEnd * vEnd) / (2 * Math.max(0.2, decelDist * 0.6)));
        }
        dx = v.x * dt; dz = v.z * dt;
      } else {                                              // rocks about its resting spot and settles
        tr += dt;
        const r = (vEnd / w) * Math.exp(-tr * 3.2) * Math.sin(w * tr), dd = r - rock; rock = r;
        dx = Math.cos(rockDir) * dd; dz = -Math.sin(rockDir) * dd;
        if (tr > 1.7) break;
      }
      p.x += dx; p.z += dz;
      const dist = Math.hypot(dx, dz);
      if (dist > 1e-7) { qB.setFromAxisAngle(vC.set(dz / dist, 0, -dx / dist), dist / R); q.premultiply(qB); }
      if (write) { const o = n * 6; buf[o] = p.x; buf[o + 1] = p.z; buf[o + 2] = q.x; buf[o + 3] = q.y; buf[o + 4] = q.z; buf[o + 5] = q.w; }
      n++;
    }
    steps = n;
    return vC.copy(UP).applyQuaternion(q).y;
  };
  let best = 0.6, bestErr = 9;
  for (let d = 0.3; d < 0.35 + Math.PI * R; d += 0.02) { const e = Math.abs(run(d, false) - REST_UP); if (e < bestErr) { bestErr = e; best = d; } }
  run(best, true);
  return steps;
}

// 8. bloom out of the ball: lying on its side the plates open like petals, the legs reach out, push
// against the floor and flip the body upright, then it shakes itself once. From an upright ball
// (after sleeping) it unfolds straight up instead.
CLIPS.bloom = {
  blend: 0.2, big: true,
  start(M, o) {
    this.t = 0; this.slow = o.slow || 1;
    M.bodyUp(vA); this.upright = vA.y > 0.7;
    this.qs = (this.qs || new Q()).copy(M.O.bq);
    // first a short roll (no sliding: distance = radius x angle) into the resting tilt, dome down, plates up
    this.h = (this.h || new V3()).set(vA.x, 0, vA.z);
    const hl = this.h.length();
    this.roll = 0;
    if (!this.upright && hl > 0.05) { this.h.divideScalar(hl); this.roll = Math.asin(REST_UP) - Math.atan2(vA.y, hl); }
    this.n = (this.n || new V3()).crossVectors(this.h, UP);
    this.p0 = (this.p0 || new V3()).copy(M.root.position);
    this.q0 = (this.q0 || new Q()).copy(qA.setFromAxisAngle(this.n, this.roll)).multiply(this.qs);
    vA.copy(UP).applyQuaternion(this.q0);
    // upright target: the smallest turn that brings the body's up to the vertical
    qA.setFromUnitVectors(vA, UP); this.q1 = (this.q1 || new Q()).copy(qA).multiply(this.q0);
    this.pre = (this.pre || new Q()).setFromAxisAngle(vB.crossVectors(vA, UP).normalize(), -0.14).multiply(this.q0);
    this.order = this.order || [0, 1, 2, 3, 4, 5];
    this.feet = this.feet || [0, 1, 2, 3, 4, 5].map(() => new V3());
    this.planted = false; this.flipped = false;
    M.gait.reset(RH);
  },
  update(M, dt, P) {
    const t = (this.t += dt / this.slow);
    if (this.upright) return this.unfold(M, dt, P, t);
    const r = smooth(seg(t, 0, 0.7));
    if (t < 0.75) {                                         // the settling roll
      ballPose(M, P); P.ground = 1;
      P.bq.setFromAxisAngle(this.n, this.roll * r).multiply(this.qs);
      M.root.position.copy(this.p0).addScaledVector(this.h, -R * this.roll * r);
      return false;
    }
    return this.side(M, dt, P, t - 0.75);
  },
  side(M, dt, P, t) {
    // open: plates swing out like petals, each a little after the last, with a small overshoot
    for (let k = 0; k < 6; k++) {
      const s = outBack(seg(t, 0.15 + k * 0.07, 1.05 + k * 0.07), 1.3);
      const reach = env(t, 1.3, 1.6, 1.9, 2.3);
      const qq = qTmp;
      qq[0] = 0.12 * Math.sin(k * 1.7) * reach;
      qq[1] = lerp(BALL[1], -0.2, s) - 0.12 * reach;
      qq[2] = lerp(BALL[2], -0.85, s) + 0.3 * reach;
      const flip = smooth(seg(t, 2.2, 3.1));
      for (let i = 0; i < 3; i++) P.q[k * 3 + i] = lerp(qq[i], M.STAND[i], flip);
      P.ik[k] = false;
    }
    P.petal.fill(0); P.mast = 0; P.ground = 1;
    // flip upright: a small lean back first, then over, with an overshoot that settles
    const f = seg(t, 2.25, 3.15);
    if (t < 2.25) P.bq.slerpQuaternions(this.q0, this.pre, env(t, 1.7, 2.1, 2.2, 2.4));
    else { P.bq.slerpQuaternions(this.q0, this.q1, outBack(f, 1.2)); }
    P.bpos.set(0, R, 0);
    if (t > 3.15) {
      if (!this.flipped) { this.flipped = true; P.bq.copy(this.q1); M.O.bq.copy(this.q1); M.rebase(); P.bq.identity(); }
      // standing: feet planted where they came down, a shake, then steps back into stance
      if (!this.planted) { this.planted = true; for (let k = 0; k < 6; k++) this.feet[k].copy(M.feet[k]).setY(0); M.F.ground = 0; copyPose(M.F, M.O); for (let k = 0; k < 6; k++) M.F.foot[k].copy(M.feet[k]); M.blend = 0; M.blendDur = 0.25; }
      const u = t - 3.15;
      for (let k = 0; k < 6; k++) { P.ik[k] = true; P.foot[k].copy(this.feet[k]); }
      if (u > 1.0) { M.gait.step(dt, ZERO, 0, P); }
      const sh = wobble(u - 0.25, 6.5, 4.5);
      P.ground = 0; P.bpos.set(0, H + 0.01 * wobble(u, 2, 5), 0);
      tilt(P, 0.02 * sh, 0.1 * sh, 0.05 * wobble(u - 0.3, 5, 5));
      for (let i = 0; i < 6; i++) P.petal[i] = 0.07 * Math.max(0, wobble(u - 0.3, 9, 5) * (i % 2 ? 1 : -1));
      if (u > 1.2 && !M.gait.active) { M.state = 'stand'; return true; }
    }
    return false;
  },
  // upright: the feet spread from under the ball, the body dips and rises, then steps out into stance
  unfold(M, dt, P, t) {
    const x = M.root.position.x, z = M.root.position.z;
    if (!this.flipped) { this.flipped = true; M.rebase(); }
    P.bq.identity(); P.ground = 0; P.mast = 0;
    for (let k = 0; k < 6; k++) {
      const s = outBack(seg(t, 0.2 + this.order[k] * 0.09, 1.3 + this.order[k] * 0.09), 1.2);
      M.footHome(k, x, z, M.heading, lerp(0, R_CROUCH, s), vA);
      P.ik[k] = true; P.foot[k].copy(vA); P.foot[k].y = 0.02 * Math.sin(Math.PI * clamp01(s));
    }
    P.bpos.set(0, lerp(R, H_CROUCH, smooth(seg(t, 0.25, 1.4))), 0);
    for (let i = 0; i < 6; i++) P.petal[i] = env(t, 0.2, 0.7, 1.2, 1.9) * 0.1;
    if (t > 1.9) {
      if (!this.planted) { this.planted = true; M.gait.reset(RH); M.state = 'stand'; }
      P.bpos.y = lerp(H_CROUCH, H, outBack(seg(t, 1.9, 2.7), 1.4));
      M.gait.step(dt, ZERO, 0, P);
      if (t > 2.8 && !M.gait.active) return true;
    }
    return false;
  },
};

// 9. crown: steps in, rises tall on nearly straight legs, the dome opens upward round a rising mast
CLIPS.crown = {
  blend: 0.3, big: true,
  start(M, o) { this.t = 0; M.gait.reset(R_CROWN); this.stepT = -1; this.hold = o.hold || 2.2; this.dir = rnd() < 0.5 ? -1 : 1; },
  update(M, dt, P) {
    const t = (this.t += dt);
    // first the feet step in under the body, then the show
    if (this.stepT < 0) {
      M.gait.radius = R_CROWN;
      const moving = M.gait.step(dt, ZERO, 0, P, 2.4);
      P.bpos.set(0, H - 0.004 * M.gait.bob(), 0); P.bq.identity(); P.petal.fill(0); P.mast = 0; P.ground = 0;
      if (!moving && t > 0.3) this.stepT = t;
      return false;
    }
    const u = t - this.stepT, hold = this.hold;
    stance(M, P, H);
    const dip = env(u, 0, 0.3, 0.35, 0.55);
    const rise = smooth(seg(u, 0.35, 1.35)), fall = smooth(seg(u, 1.6 + hold, 2.5 + hold));
    const tall = rise * (1 - fall);
    P.bpos.y = lerp(H, H_CROWN, tall) - 0.035 * dip + 0.012 * wobble(u - 1.35, 1.6, 3) - 0.025 * Math.sin(Math.PI * seg(u, 2.45 + hold, 2.85 + hold));
    const sway = env(u, 1.3, 1.8, 1.2 + hold, 1.7 + hold);
    tilt(P, 0.025 * Math.sin(u * 1.7) * sway, 0.025 * Math.cos(u * 1.3) * sway, this.dir * 0.22 * Math.sin((u - 1.3) * 1.1) * sway);
    for (let i = 0; i < 6; i++) {
      const o = outBack(seg(u, 0.75 + i * 0.07, 1.55 + i * 0.07), 1.5) * (1 - smooth(seg(u, 1.45 + hold + i * 0.04, 2.15 + hold + i * 0.04)));
      P.petal[i] = o * (0.78 + 0.04 * Math.sin(u * 2.1 + i * 1.3) * sway);
    }
    P.mast = smooth(seg(u, 0.9, 1.6)) * (1 - smooth(seg(u, 1.4 + hold, 2.0 + hold)));
    if (u > 2.9 + hold) {
      M.gait.radius = RH; const moving = M.gait.step(dt, ZERO, 0, P, 2.2);
      P.bpos.y = H - 0.004 * M.gait.bob() * (moving ? 1 : 0);
      return !moving && u > 3.2 + hold;
    }
    return false;
  },
};

// 10. stretch: each leg in turn reaches out and up, a wave round the body, the body leaning away
CLIPS.stretch = {
  blend: 0.3, big: true,
  start(M, o) { this.t = 0; this.first = (rnd() * 6) | 0; this.dir = rnd() < 0.5 ? 1 : 5; this.base = this.base || []; for (let k = 0; k < 6; k++) this.base[k] = (this.base[k] || new V3()).copy(M.feet[k]); },
  update(M, dt, P) {
    const t = (this.t += dt);
    const x = M.root.position.x, z = M.root.position.z;
    stance(M, P, H);
    let lx = 0, lz = 0;
    for (let i = 0; i < 6; i++) {
      const k = (this.first + i * this.dir) % 6, a0 = 0.3 + i * 0.42, u = t - a0;
      const e = env(u, 0, 0.38, 0.62, 0.95);
      P.foot[k].copy(this.base[k]);
      if (e > 0) {
        M.footHome(k, x, z, M.heading, 0.7, vA);
        P.foot[k].lerp(vA, e); P.foot[k].y = 0.15 * e + 0.05 * Math.sin(Math.PI * seg(u, 0, 0.38)) * (1 - e) + 0.008 * Math.sin(u * 30) * env(u, 0.38, 0.45, 0.55, 0.62);
        lx -= Math.cos(psi(k)) * e; lz += Math.sin(psi(k)) * e;
      }
    }
    const all = env(t, 0, 0.3, 2.7, 3.1);
    P.bpos.set(0.025 * lx, H + 0.02 * all, 0.025 * lz);
    tilt(P, 0.09 * lx, 0.09 * lz);
    for (let i = 0; i < 6; i++) P.petal[i] = all * 0.06;
    return t > 3.2;
  },
};

// 11. spin: a happy quick turn on the spot, then a small hop with the petals popping open
CLIPS.spin = {
  blend: 0.25, big: true,
  start(M, o) { this.t = 0; this.h0 = M.heading; this.dir = rnd() < 0.5 ? -1 : 1; this.omega = 0; M.gait.reset(RH); this.hopT = -1; this.base = this.base || []; },
  update(M, dt, P) {
    const t = (this.t += dt);
    if (this.hopT < 0) {
      const turned = smooth(seg(t, 0.15, 3.0));
      const want = this.h0 + this.dir * 2 * Math.PI * turned;
      const prev = M.heading; M.heading = wrap(want);
      this.omega = wrap(M.heading - prev) / Math.max(dt, 1e-3);
      const moving = M.gait.step(dt, ZERO, this.omega, P, 3.6);
      P.bpos.set(0, H - 0.008 * M.gait.bob() * Math.min(1, Math.abs(this.omega) / 3) - 0.01 * env(t, 0, 0.12, 0.15, 0.3), 0);
      tilt(P, 0, -0.06 * this.dir * Math.min(1, Math.abs(this.omega) / 4)); P.petal.fill(0); P.mast = 0; P.ground = 0;
      if (t > 3.0 && !moving) { this.hopT = t; for (let k = 0; k < 6; k++) this.base[k] = (this.base[k] || new V3()).copy(M.feet[k]); }
      return false;
    }
    // the hop: squash, up, petals pop open, down with a squash
    const u = t - this.hopT, air = 0.3, j0 = 0.18;
    stance(M, P, H);
    let y = H - 0.035 * env(u, 0, j0, j0, j0 + 0.01);
    const a = seg(u, j0, j0 + air);
    if (u > j0 && u < j0 + air) y = H + 0.07 * 4 * a * (1 - a);
    const land = u - j0 - air;
    if (land > 0) y = H - 0.04 * Math.exp(-land * 7) * Math.sin(Math.min(Math.PI, land * 12)) + 0.008 * wobble(land - 0.25, 2.5, 5);
    P.bpos.y = y;
    for (let k = 0; k < 6; k++) { P.foot[k].copy(this.base[k]); if (u > j0 && u < j0 + air) P.foot[k].y = Math.max(0, y - H - 0.012) * 0.85; }
    tilt(P, 0.03 * Math.sin(Math.PI * a) * (u < j0 + air ? 1 : 0), 0);
    for (let i = 0; i < 6; i++) P.petal[i] = 0.42 * env(u, j0 + 0.02, j0 + 0.12, j0 + air, j0 + air + 0.35) * (0.85 + 0.15 * Math.sin(i * 2.4));
    return u > j0 + air + 0.8;
  },
};

// 12. wave: weight back, the front leg lifts high and waves its plate
CLIPS.wave = {
  blend: 0.3, big: true,
  start(M, o) { this.t = 0; this.k = o.leg || 0; this.base = (this.base || new V3()).copy(M.feet[this.k]); },
  update(M, dt, P) {
    const t = (this.t += dt), k = this.k;
    stance(M, P, H);
    const up = env(t, 0.35, 0.85, 2.6, 3.1), shift = env(t, 0, 0.45, 2.75, 3.25);
    const a = psi(k) + M.heading, ca = Math.cos(a), sa = -Math.sin(a);
    P.bpos.set(-0.035 * shift * Math.cos(psi(k)), H + 0.012 * shift, 0.035 * shift * Math.sin(psi(k)));
    tilt(P, 0.13 * shift * Math.cos(psi(k)), 0);
    const w = Math.sin((t - 0.85) * 2 * Math.PI * 2.1) * env(t, 0.85, 1.0, 2.4, 2.6);
    const r = lerp(RH, 0.43, up), side = 0.11 * w * up;
    vA.set(M.root.position.x + r * ca - side * sa, 0.2 * up + 0.02 * Math.sin(Math.PI * seg(t, 0.35, 0.85)), M.root.position.z + r * sa + side * ca);
    P.foot[k].lerpVectors(this.base, vA, up > 0 ? 1 : 0); if (up <= 0) P.foot[k].copy(this.base);
    if (t > 2.6) { P.foot[k].lerpVectors(this.base, vA, up); P.foot[k].y = Math.max(0, P.foot[k].y); }
    for (let i = 0; i < 6; i++) P.petal[i] = up * (i === k ? 0.14 : 0.04);
    return t > 3.4;
  },
};

// 13. peek out of the ball: still closed, one leg pokes out, feels around, pulls back in
CLIPS.peek = {
  blend: 0.2, big: true,
  start(M, o) {
    this.t = 0;
    // the leg whose plate faces most upwards
    let best = 0, by = -9;
    for (let k = 0; k < 6; k++) { const a = psi(k); vA.set(Math.cos(a) * 0.7, -0.7, -Math.sin(a) * 0.7).applyQuaternion(M.O.bq); if (vA.y > by) { by = vA.y; best = k; } }
    this.k = best;
  },
  update(M, dt, P) {
    const t = (this.t += dt);
    ballPose(M, P); P.bq.copy(M.O.bq); P.ground = 1;
    const k = this.k, out = outBack(seg(t, 0.4, 0.9), 1.4) * (1 - smooth(seg(t, 2.5, 2.9)));
    const feel = env(t, 0.9, 1.1, 2.3, 2.5);
    P.q[k * 3] = 0.3 * Math.sin((t - 0.9) * 4.2) * feel;
    P.q[k * 3 + 1] = BALL[1] + 0.35 * out + 0.1 * Math.sin((t - 0.9) * 6.1) * feel;
    P.q[k * 3 + 2] = BALL[2] + 1.25 * out + 0.25 * Math.sin((t - 0.9) * 3.3) * feel;
    // its neighbours open a crack, a twitch before
    const tw = 0.05 * wobble(t - 0.1, 6, 6);
    P.q[((k + 1) % 6) * 3 + 2] = BALL[2] + 0.1 * out + tw; P.q[((k + 5) % 6) * 3 + 2] = BALL[2] + 0.1 * out - tw;
    return t > 3.1;
  },
};

// 14. sleep: a closed ball, only a very slow breathing in the seams. Stops when M.wake is set.
CLIPS.sleep = {
  blend: 0.6, big: false,
  start(M, o) { this.t = 0; M.wake = false; },
  update(M, dt, P) {
    const t = (this.t += dt);
    ballPose(M, P); P.bq.copy(M.F.bq); P.ground = 1;
    const b = 0.5 - 0.5 * Math.cos(t * 2 * Math.PI / 5.2);
    for (let k = 0; k < 6; k++) { P.q[k * 3 + 2] = BALL[2] + 0.035 * b; P.q[k * 3 + 1] = BALL[1] + 0.012 * b; }
    for (let i = 0; i < 6; i++) P.petal[i] = 0.025 * b;
    return M.wake;
  },
};

// 15. wake up: a few small twitches, then a slow bloom (the stretch and the look round follow)
CLIPS.twitch = {
  blend: 0.3, big: true,
  start(M, o) { this.t = 0; this.a = (rnd() * 6) | 0; this.b = (this.a + 2 + ((rnd() * 2) | 0)) % 6; },
  update(M, dt, P) {
    const t = (this.t += dt);
    ballPose(M, P); P.bq.copy(M.F.bq); P.ground = 1;
    P.q[this.a * 3 + 2] = BALL[2] + 0.22 * Math.max(0, wobble(t - 0.3, 5, 7));
    P.q[this.b * 3 + 2] = BALL[2] + 0.28 * Math.max(0, wobble(t - 1.0, 4, 6));
    P.petal[(this.a + 3) % 6] = 0.25 * Math.max(0, wobble(t - 1.5, 5, 6));
    const roll = 0.03 * wobble(t - 1.9, 1.6, 2.5);
    qA.setFromAxisAngle(vA.set(0, 0, 1), roll); P.bq.premultiply(qA);
    return t > 2.6;
  },
};

export { CLIPS };
