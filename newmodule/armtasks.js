// New module, FEAT-025d: click or tap a robot arm to give it a task.
// The arm finishes its current small move (printloop.js / fitarm.js hold their loop at the next step where
// the arm may stop; mid-wall the print arm first goes up off the wall and folds), stands up and turns its
// tool head to the camera, as if looking at the visitor; a bubble offers three tasks (index.html, #arm-ask):
//   - swap tool and show it: a different head from the task rack, shown off (the nozzle prints a few
//     centimetres of bead, the laser draws a short cut line with sparks, the gripper opens and closes,
//     the welder flashes)
//   - laser-cut a part: from a panel offcut, a wall part or a window frame (in turn); the gripper puts it
//     on the pile
//   - print a module foot: the station's A-frame leg at small scale, printed layer by layer with the
//     glowing bead; the gripper lays it on the pile
// The tasks are done in a corner of their own beside the site (past the module's open end, in view from
// the place on a computer and a phone):
// a small task rack (a cradle to park the arm's own head, then nozzle, laser, gripper, welder), a stack of
// panel offcuts, a print plate and the pile for the next module. So a task never needs a head the other
// arm is working with, and it never enters the lanes the other arm works in: both arms drive there along
// the strip past the module's open end (the road; the print arm's own trips round the module use it too,
// so whoever has it goes first and the other waits). The clicked arm's loop waits for it; afterwards
// the arm drives back, takes its own head again, folds as it was and goes on where it stopped. The other
// arm keeps working. The pile goes only while the site is off screen.
// Coordinates as in worksite.js: the site frame (z up, the module's long axis along y, the open side +x).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---- the arm (worksite.js: keep in step)
const L1 = 3.0, L2 = 0.3 + 2.4, SH = 1.25, J1Z = 0.12, FLANGE = 0.18 + 0.09;
const KEYS = ['j1', 'j2', 'j3', 'j4', 'j5', 'j6'];
const UP = { j1: 0, j2: -0.1, j3: 0.35, j4: 0, j5: -0.25, j6: 0 };            // standing up tall, the head on top
const COMPACT = { j1: 0, j2: -0.1, j3: 2.9, j4: 0, j5: Math.PI - 2.8, j6: 0 };   // folded tight for driving and turning
const SPEED = 1.7, TURN = 1.4;

// ---- where (site frame)
const STRIP_Y = -6.6;                                      // past the module's open end (the print arm's END_Y)
const CORNER_X = 1.0;                                      // from the strip south to the corner
const K = { x: 1.0, y: -8.5 };                             // the task station: the base stops here facing -y
const STAND = { y: -10.75, top: 1.15, slots: [-0.2, 0.4, 1.0, 1.6, 2.2] };   // a small rack along x, its cradles facing the station; slot 0 parks the arm's own head
const KINDS = ['nozzle', 'laser', 'gripper', 'welder'];   // in slots 1..4
const WORK = { x: 3.1, y: -9.4, w: 0.9, d: 0.9, h: 0.06 };   // the print plate
const OFF = { x: -1.1, y: -9.75, w: 0.95, d: 0.85, h: 0.1, pw: 0.8, pd: 0.7, t: 0.05, n: 6 };   // pallet with panel offcuts
const PILE = { x: -1.3, y: -8.1, w: 1.1, d: 1.0, h: 0.1, max: 10 };
const SCRAP = { x: -2.2, y: -10.2 };                       // the trimmed strips drop here
// the dock's slab (construction.py): the bases ride up onto it
const SLAB = { x0: 6.4, x1: 9.2, y0: -4.9, y1: 0.9 };

const at = (x, y, z, v = new THREE.Vector3()) => v.set(x, z, -y);
const ss = (u) => u * u * (3 - 2 * u);
const heading = (hx, hy) => Math.atan2(hx, -hy);
const near = (a, b, e = 0.12) => Math.abs(a - b) < e;

export function createArmTasks(W, loops) {
  const T = { clock: 0, corner: null, pile: [], scrap: [], offLeft: OFF.n, cutN: 0, footN: 0, ask: -1, onScreen: false, swapN: [0, 0] };
  const mat = W.mats.plaster, line = W.mats.line;
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tq = new THREE.Quaternion();
  const named = (m, n, parent = W.root) => { m.name = 'futureworksite_task_' + n; m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  const flat = (gs) => mergeGeometries(gs.map((g) => (g.index ? g.toNonIndexed() : g)));

  // ---- the printed things glow warm at first and cool to plaster (like the print arm's walls)
  const uNow = { value: 0 };
  const glowMat = mat.clone();
  glowMat.name = 'plaster';
  glowMat.onBeforeCompile = (sh) => {
    sh.uniforms.uNow = uNow;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aBirth;\nuniform float uNow;\nvarying float vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = exp(-max(uNow - aBirth, 0.0) / 1.1);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.42, 0.12) * vGlow * 2.2;');
  };
  glowMat.customProgramCacheKey = () => 'taskglow';

  // ---- the corner: a small tool rack like the site's (plinth, posts, rails, cradles), the offcut pallet,
  // the print plate, the pile's pallet
  {
    const pl = [], st = [];
    const rod = (a, b, r) => {                               // a thin rod between two site points
      const A = at(...a), B = at(...b), d = B.clone().sub(A), g = new THREE.CylinderGeometry(r, r, d.length(), 6);
      g.applyQuaternion(tq.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
      return g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
    };
    const sbox = (w, d, h, x, y, z) => box(w, h, d, x, z, -y);   // a box in site measures (x, y, z up)
    const rx0 = STAND.slots[0] - 0.4, rx1 = STAND.slots[4] + 0.4, ry = STAND.y - 0.02, back = ry - 0.25;   // the posts on the far side
    pl.push(sbox(rx1 - rx0 + 0.4, 0.9, 0.1, (rx0 + rx1) / 2, ry, 0.05));
    for (const x of [rx0, rx1]) st.push(rod([x, back, 0.1], [x, back, 1.65], 0.04));
    st.push(rod([rx0 - 0.12, back, 1.6], [rx1 + 0.12, back, 1.6], 0.03));
    st.push(rod([rx0 - 0.12, back, 0.55], [rx1 + 0.12, back, 0.55], 0.025));
    for (const x of STAND.slots) {
      pl.push(sbox(0.46, 0.5, 0.06, x, ry + 0.02, 1.12));
      for (const dx of [-0.19, 0.19]) st.push(rod([x + dx, back, 1.16], [x + dx, ry + 0.26, 1.16], 0.018));
      st.push(rod([x, back, 1.15], [x, back, 1.6], 0.018));
    }
    pl.push(sbox(WORK.w, WORK.d, WORK.h, WORK.x, WORK.y, WORK.h / 2));                 // the print plate
    st.push(sbox(WORK.w + 0.02, 0.02, 0.012, WORK.x, WORK.y - WORK.d / 2, WORK.h));      // its edges
    st.push(sbox(WORK.w + 0.02, 0.02, 0.012, WORK.x, WORK.y + WORK.d / 2, WORK.h));
    pl.push(sbox(OFF.w, OFF.d, OFF.h, OFF.x, OFF.y, OFF.h / 2));                         // the offcuts' pallet
    pl.push(sbox(PILE.w, PILE.d, PILE.h, PILE.x, PILE.y, PILE.h / 2));                   // the pile's pallet
    named(new THREE.Mesh(flat(pl), mat), 'corner');
    named(new THREE.Mesh(flat(st), line), 'corner_steel');
  }
  // the panel offcuts, stacked
  const offs = named(new THREE.InstancedMesh(new THREE.BoxGeometry(OFF.pw, OFF.t, OFF.pd), mat, OFF.n), 'offcuts');
  const offTop = (k) => OFF.h + (k + 1) * OFF.t;           // the top of offcut k (0: the lowest)
  function placeOffcuts(left) {
    const d = new THREE.Object3D();
    for (let k = 0; k < OFF.n; k++) {
      at(OFF.x + (k % 2 ? 0.02 : -0.015), OFF.y + (k % 3) * 0.012, offTop(k) - OFF.t / 2, d.position);
      d.rotation.set(0, (k % 2 ? 0.03 : -0.02), 0);
      d.scale.setScalar(k < left ? 1 : 1e-4);
      d.updateMatrix(); offs.setMatrixAt(k, d.matrix);
    }
    offs.instanceMatrix.needsUpdate = true; offs.computeBoundingSphere();
    T.offLeft = left;
  }

  // ---- the task rack's heads (built like the site's; the gripper's fingers move)
  const homes = {};                                         // kind → { slot, p, q }
  const hang = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
  const slotAt = (s, kind) => at(STAND.slots[s], STAND.y, STAND.top + W.TOOL_LEN[kind] + 0.06);
  const heads = {};
  KINDS.forEach((k, i) => {
    let t;
    if (k === 'gripper') {
      const pl = [];
      pl.push(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 20).translate(0, 0.025, 0), new THREE.CylinderGeometry(0.08, 0.08, 0.02, 20).translate(0, 0.06, 0));
      pl.push(box(0.22, 0.1, 0.1, 0, 0.12, 0), box(0.24, 0.015, 0.02, 0, 0.17, 0), box(0.1, 0.07, 0.07, 0, 0.12, 0.1));
      t = new THREE.Group(); t.name = 'futureworksite_task_tool_gripper';
      named(new THREE.Mesh(flat(pl), line), 'gripper_body', t);
      t.userData.fingers = [-1, 1].map((sx) => { const f = named(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.2, 0.07), mat), 'gripper_finger', t); f.position.set(sx * 0.08, 0.27, 0); f.userData.sx = sx; return f; });
      t.userData.kind = 'gripper';
    } else {
      t = W.buildTool(k);
      t.name = 'futureworksite_task_tool_' + k;
    }
    t.userData.task = true;
    t.quaternion.copy(hang); t.position.copy(slotAt(i + 1, k));
    W.root.add(t);
    heads[k] = t;
    homes[k] = { slot: i + 1, p: t.position.clone(), q: hang.clone() };
  });
  function grip(open) {                                     // the gripper's fingers: 1 open, 0 closed
    heads.gripper.userData.fingers.forEach((f) => { f.position.x = f.userData.sx * (0.045 + 0.06 * open); });
  }
  grip(1);

  // ---- the effects: a beam, a glowing cut line, sparks, a flash, the nozzle's glow, one small light
  const FX = { cutPts: [], cutFade: 0, sp: [], spawn: 0, weld: 0 };
  const addFx = (o, n) => { o.name = 'futureworksite_task_fx_' + n; o.visible = false; o.frustumCulled = false; o.renderOrder = 5; W.root.add(o); return o; };
  const fxMat = (c, op) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  FX.beam = addFx(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 6, 1, true).translate(0, 0.5, 0), fxMat(0xffe2d0, 0.95)), 'beam');
  {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    FX.cut = addFx(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffa060, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })), 'cutline');
    const N = 24, sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage));
    FX.sparks = addFx(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffc890, size: 0.035, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })), 'sparks');
    FX.sp = Array.from({ length: N }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0 }));
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(200,225,255,0.8)'); gr.addColorStop(1, 'rgba(160,200,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    FX.flash = addFx(new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })), 'flash');
    FX.tip = addFx(new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb070 })), 'nozzleglow');
  }
  FX.light = new THREE.PointLight(0xffc8a0, 0, 6, 2);
  FX.light.name = 'futureworksite_tasklight';
  W.root.add(FX.light);
  FX.lightAt = new THREE.Vector3(); FX.lightCol = new THREE.Color(); FX.lvl = 0;

  // ---- the parts: laser-cut wall parts and window frames, printed module feet
  const PART = { w: 0.8, d: 0.55, t: OFF.t, strip: OFF.pd - 0.55, ow: 0.4, od: 0.28 };
  const partGeo = {
    wall: box(PART.w, PART.t, PART.d, 0, -PART.t / 2, 0),        // origin: the middle of its top face (where the gripper holds it)
    frame: flat([
      box(PART.w, PART.t, (PART.d - PART.od) / 2, 0, -PART.t / 2, -(PART.d + PART.od) / 4),
      box(PART.w, PART.t, (PART.d - PART.od) / 2, 0, -PART.t / 2, (PART.d + PART.od) / 4),
      box((PART.w - PART.ow) / 2, PART.t, PART.od, -(PART.w + PART.ow) / 4, -PART.t / 2, 0),
      box((PART.w - PART.ow) / 2, PART.t, PART.od, (PART.w + PART.ow) / 4, -PART.t / 2, 0),
    ]),
    strip: box(PART.w, PART.t, PART.strip, 0, -PART.t / 2, 0),
    hole: box(PART.ow, PART.t, PART.od, 0, -PART.t / 2, 0),
  };
  // the module foot: the station's A-frame leg (arrangement.py a_frame) at small scale, upright in its
  // plane (x across, y up, z its thickness); origin at the top (where the gripper holds it); built in
  // print order: layer by layer, each layer in small pieces along the nozzle's path
  const FOOT = { H: 0.72, spread: 0.42, top: 0.13, leg: 0.05, bar: [0.26, 0.32], cap: 0.65, capW: 0.17, t: 0.09, layers: 18, piece: 0.05 };
  function footGeo() {
    const pos = [], order = [], dz = FOOT.H / FOOT.layers;
    for (let L = 0; L < FOOT.layers; L++) {
      const y0 = L * dz, y1 = y0 + dz, ym = (y0 + y1) / 2;
      const xc = FOOT.spread - (FOOT.spread - FOOT.top) * (ym / FOOT.H);
      let iv;
      if (ym > FOOT.cap) iv = [[-FOOT.capW, FOOT.capW]];
      else if (ym > FOOT.bar[0] && ym < FOOT.bar[1]) iv = [[-xc - FOOT.leg, xc + FOOT.leg]];
      else iv = [[-xc - FOOT.leg, -xc + FOOT.leg], [xc - FOOT.leg, xc + FOOT.leg]];
      const bits = [];
      iv.forEach(([a, b]) => { const n = Math.max(1, Math.round((b - a) / FOOT.piece)); for (let k = 0; k < n; k++) bits.push([a + (b - a) * k / n, a + (b - a) * (k + 1) / n]); });
      if (L % 2) bits.reverse();
      bits.forEach(([a, b]) => {
        const g = box(b - a, dz, FOOT.t, (a + b) / 2, ym - FOOT.H, 0).toNonIndexed();
        pos.push(...g.attributes.position.array);
        order.push({ L, x: (a + b) / 2 });
      });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    const birth = new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3).fill(-1e4), 1);
    birth.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aBirth', birth);
    g.setDrawRange(0, 0);
    return { g, order };
  }
  // a short bead (the nozzle's show): a thin glowing line of small pieces
  function beadGeo(len) {
    const pos = [], order = [], n = 8;
    for (let k = 0; k < n; k++) {
      const g = box(len / n, 0.018, 0.022, -len / 2 + len * (k + 0.5) / n, 0.009, 0).toNonIndexed();
      pos.push(...g.attributes.position.array); order.push({ L: 0, x: k / n });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    const birth = new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3).fill(-1e4), 1);
    birth.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aBirth', birth); g.setDrawRange(0, 0);
    return { g, order };
  }
  function grow(item, n) {                                   // show the first n pieces, the new ones glowing
    if (n <= item.shown) return;
    const b = item.mesh.geometry.attributes.aBirth;
    for (let i = item.shown * 36; i < n * 36; i++) b.array[i] = T.clock;
    b.needsUpdate = true;
    item.shown = n; item.mesh.geometry.setDrawRange(0, n * 36);
  }
  const beads = [];

  // ---- per arm: its task state and its moves
  const R = W.arms.map((arm, i) => ({
    i, arm, loop: loops[i], state: 'free', steps: [], cur: null, q: null, stop: null, own: null, wps: [], road: false, track: loops[i].track, carry: null, moved: false, kind: null,
  }));
  const setQ = (r, q) => { for (const k of KEYS) r.q[k] = q[k]; r.arm.set(r.q); };
  function solve(r, tip, tau, len, q = {}) {                 // like printloop.js: the tool's tip at a point, tilted by tau from straight down
    const b = r.arm.base, ry = b.rotation.y, cs = Math.cos(ry), sn = Math.sin(ry);
    const dx = tip.x - b.position.x, dy = tip.y - b.position.y, dz = tip.z - b.position.z;
    const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs - J1Z, ly = dy;
    const psi = Math.atan2(lx, lz), rr = Math.hypot(lx, lz), h = ly - SH;
    const t3 = Math.PI - tau;
    const wr = rr - len * Math.sin(t3), wh = h - len * Math.cos(t3);
    const D = THREE.MathUtils.clamp(Math.hypot(wr, wh), Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-3);
    const c = THREE.MathUtils.clamp((D * D - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1);
    const j3 = Math.acos(c), beta = Math.atan2(L2 * Math.sin(j3), L1 + L2 * c), phi = Math.atan2(wr, wh);
    const j2 = phi - beta;
    q.j1 = psi; q.j2 = j2; q.j3 = j3; q.j4 = 0; q.j5 = t3 - j2 - j3; q.j6 = 0;
    return q;
  }
  const toolLen = (r) => FLANGE + (r.arm.tool ? W.TOOL_LEN[r.arm.tool.userData.kind] : 0);
  function tipNow(r, len = toolLen(r)) {
    r.arm.mount.updateWorldMatrix(true, false);
    return W.root.worldToLocal(tmp2.set(0, len - FLANGE, 0).applyMatrix4(r.arm.mount.matrixWorld)).clone();
  }
  const qa = new THREE.Quaternion(), qr = new THREE.Quaternion();
  function toolDir(r, out = new THREE.Vector3()) {
    r.arm.mount.updateWorldMatrix(true, false);
    r.arm.mount.getWorldQuaternion(qa); W.root.getWorldQuaternion(qr);
    return out.set(0, 1, 0).applyQuaternion(qa).applyQuaternion(qr.invert());
  }
  const mk = (dur, update, start, end) => ({ dur, update, start, end });
  const call = (fn) => mk(0, () => {}, fn);
  const wait = (sec) => mk(sec, () => {});
  const waitFor = (cond) => { const s = mk(1e6, () => {}); s.until = cond; return s; };
  function pose(r, target, dur) {
    let from, q;
    return mk(dur, (u) => { const e = ss(u), o = {}; for (const k of KEYS) o[k] = from[k] + (q[k] - from[k]) * e; setQ(r, o); },
      () => {
        from = { ...r.q }; q = { ...(typeof target === 'function' ? target() : target) };
        while (q.j1 - from.j1 > Math.PI) q.j1 -= 2 * Math.PI;     // the short way round
        while (q.j1 - from.j1 < -Math.PI) q.j1 += 2 * Math.PI;
      });
  }
  const slabH = (x, y) => W.DOCK_TOP * THREE.MathUtils.clamp(Math.min(x - SLAB.x0, SLAB.x1 - x, y - SLAB.y0, SLAB.y1 - y) / 0.25 + 0.5, 0, 1);
  function turnTo(r, fn) {                                  // fn(): the site direction (hx, hy) to face, or a heading (number)
    let from, to, last = 0;
    const s = mk(1, (u) => {
      const ry = from + (to - from) * ss(u), d = ry - last; last = ry;
      r.arm.base.rotation.y = ry;
      r.track[0] += d * 0.55; r.track[1] -= d * 0.55; r.moved = true;
    }, () => {
      from = r.arm.base.rotation.y;
      const h = fn(); to = typeof h === 'number' ? h : heading(h[0], h[1]);
      while (to - from > Math.PI) to -= 2 * Math.PI;
      while (to - from < -Math.PI) to += 2 * Math.PI;
      last = from;
      s.dur = Math.abs(to - from) < 0.01 ? 0 : Math.max(0.4, Math.abs(to - from) / TURN + 0.3);
    });
    return s;
  }
  function drive(r, x, y) {                                  // forward along the base's heading
    let fx, fy, dist, done = 0;
    const s = mk(1, (u) => {
      const e = ss(u), cx = fx + (x - fx) * e, cy = fy + (y - fy) * e;
      at(cx, cy, slabH(cx, cy), r.arm.base.position);
      const d = e * dist - done; done = e * dist;
      r.track[0] += d; r.track[1] += d; r.moved = true;
    }, () => {
      const p = r.arm.base.position; fx = p.x; fy = -p.z; dist = Math.hypot(x - fx, y - fy); done = 0;
      s.dur = dist < 0.01 ? 0 : Math.max(0.3, dist / SPEED + 0.8);
    });
    return s;
  }
  function goTo(r, x, y) {                                   // turn towards (x, y), drive there
    return [turnTo(r, () => { const p = r.arm.base.position, dx = x - p.x, dy = y + p.z; return Math.hypot(dx, dy) < 0.01 ? r.arm.base.rotation.y : [dx, dy]; }), drive(r, x, y)];
  }
  function tipMove(r, from, to, tau, dur, each, tau2 = tau) {   // the tool's tip in a straight line
    let a, b;
    return mk(dur, (u) => { const e = ss(u); tmp.lerpVectors(a, b, e); setQ(r, solve(r, tmp, tau + (tau2 - tau) * e, toolLen(r))); if (each) each(u, tmp); },
      () => { a = (typeof from === 'function' ? from() : from).clone(); b = (typeof to === 'function' ? to() : to).clone(); });
  }
  const up = (v, dz) => { const o = v.clone(); o.y += dz; return o; };
  const reach = (r, p, tau, dur) => pose(r, () => solve(r, typeof p === 'function' ? p() : p, tau, toolLen(r)), dur);

  // ---- heads: into a cradle and out of one (over it, down, click in or let go, up)
  function attach(r, t) { r.arm.mount.attach(t); r.arm.tool = t; t.traverse((o) => { if (o.isMesh) o.castShadow = false; }); }
  function release(r) { const t = r.arm.tool; W.root.attach(t); t.traverse((o) => { if (o.isMesh) o.castShadow = true; }); r.arm.tool = null; return t; }
  function putHead(r, slot) {
    let t, p;
    return [
      call(() => { t = r.arm.tool; p = slotAt(slot, t.userData.kind); }),
      pose(r, () => solve(r, up(p, 0.3), 0, FLANGE), 1.4),
      tipMove(r, () => up(p, 0.3), () => p, 0, 0.6),
      call(() => release(r)),
      mk(0.3, (u) => { t.position.lerp(p, u); t.quaternion.slerp(hang, u); }),
      tipMove(r, () => tipNow(r), () => up(tipNow(r), 0.3), 0, 0.45),
    ];
  }
  function takeHead(r, getT, slot) {
    let t, p;
    return [
      call(() => { t = getT(); p = slotAt(slot, t.userData.kind); }),
      pose(r, () => solve(r, up(p, 0.3), 0, FLANGE), 1.3),
      tipMove(r, () => up(p, 0.3), () => p, 0, 0.6),
      call(() => attach(r, t)),
      mk(0.3, (u) => { t.position.multiplyScalar(1 - u); t.quaternion.slerp(tq.identity(), u); }),
      mk(0.15, (u) => { r.arm.mount.position.y = 0.09 - 0.02 * Math.sin(u * Math.PI); }),   // the click-in
      tipMove(r, () => tipNow(r), () => up(tipNow(r), 0.4), 0, 0.55),
    ];
  }
  const fold = (r, dur = 1.6) => pose(r, COMPACT, dur);

  // ---- carried parts keep their own orientation (the wrist turns under them)
  function carry(r, obj, to) { r.carry = { obj, q: obj.quaternion.clone(), to, u: 0 }; }
  function placeCarry(r) {
    const c = r.carry;
    if (!c) return;
    c.obj.position.copy(tipNow(r)).addScaledVector(toolDir(r, tmp), 0.002);
    if (c.to) c.obj.quaternion.copy(c.q).slerp(c.to, ss(c.u)); else c.obj.quaternion.copy(c.q);
  }
  // where the next part lies on the pile: its top's middle, stacked
  function pileSpot(th, dy = 0, oz = 0) {                   // oz: the part's origin below its top
    const z = PILE.h + T.pile.reduce((s, o) => s + o.th, 0) + th - oz;
    return at(PILE.x + (T.pile.length % 2 ? 0.03 : -0.02), PILE.y + dy + (T.pile.length % 3) * 0.015, z);
  }
  function toPile(r, obj, th, dy = 0, oz = 0) {              // carry obj (held) to the pile and put it down
    let spot;
    return [
      call(() => { spot = pileSpot(th, dy, oz); }),
      tipMove(r, () => tipNow(r), () => up(tipNow(r), 0.5), 0, 0.6, () => placeCarry(r)),
      pose(r, () => solve(r, up(spot, 0.55), 0, toolLen(r)), 2.4),
      tipMove(r, () => up(spot, 0.55), () => spot, 0, 0.9),
      call(() => { r.carry = null; grip(1); obj.position.copy(spot); T.pile.push({ obj, th }); W.host.markShadows(); }),
      tipMove(r, () => tipNow(r), () => up(tipNow(r), 0.45), 0, 0.5),
    ];
  }
  function lift(r, obj, spot, to) {                          // the gripper down onto a part, close, lift
    return [
      reach(r, () => up(spot(), 0.4), 0, 1.6),
      tipMove(r, () => up(spot(), 0.4), spot, 0, 0.7),
      mk(0.35, (u) => grip(1 - u), null, () => carry(r, obj, to)),
      tipMove(r, spot, () => up(spot(), 0.5), 0, 0.6, () => placeCarry(r)),
    ];
  }

  // ---- the tasks (at the station, the arm folded, holding its own head or none)
  const workTop = () => at(WORK.x, WORK.y, WORK.h);
  function laserHit(p, on) {
    FX.laser = on ? p.clone() : null;
    if (!on) return;
    const last = FX.cutPts[FX.cutPts.length - 1];
    if (!last || last.distanceTo(p) > 0.03) { if (FX.cutPts.length < 64) FX.cutPts.push(p.clone()); }
    FX.cutFade = 1; FX.spawn += 0.6; FX.spawnAt = p.clone();
  }
  function laserPath(r, pts, top, speed = 0.45) {            // the beam's spot along a path on a surface at height top
    const segs = [], lens = [];
    let total = 0;
    for (let k = 1; k < pts.length; k++) { const l = pts[k].distanceTo(pts[k - 1]); segs.push([pts[k - 1], pts[k]]); lens.push(l); total += l; }
    return [
      reach(r, () => up(pts[0], 0.4), 0, 1.6),
      tipMove(r, () => up(pts[0], 0.4), () => up(pts[0], 0.16), 0, 0.5),
      call(() => { FX.cutPts = []; FX.cutFade = 0; }),
      mk(total / speed, (u) => {
        let d = u * total, k = 0;
        while (k < lens.length - 1 && d > lens[k]) { d -= lens[k]; k++; }
        tmp2.lerpVectors(segs[k][0], segs[k][1], Math.min(1, d / lens[k]));
        const spot = tmp2.clone();
        setQ(r, solve(r, up(spot, 0.16), 0, toolLen(r)));
        laserHit(spot.setY(top + 0.003), u > 0.01 && u < 0.99);
      }, null, () => { FX.laser = null; }),
      tipMove(r, () => tipNow(r), () => up(tipNow(r), 0.35), 0, 0.5),
    ];
  }
  function show(r, kind) {                                   // the head's little show over the print plate's corner
    const base = () => at(WORK.x - 0.25, WORK.y + 0.3, WORK.h);
    if (kind === 'nozzle') {                                   // a few centimetres of bead, in a new row each time
      let bead, row = 0;
      const p0 = () => at(WORK.x - 0.3, WORK.y + 0.32 - 0.06 * row, WORK.h + 0.012);
      return [
        call(() => { row = beads.length % 6; }),
        reach(r, () => up(p0(), 0.35), 0, 1.6),
        tipMove(r, () => up(p0(), 0.35), p0, 0, 0.6),
        call(() => {
          const { g, order } = beadGeo(0.12);
          const m = named(new THREE.Mesh(g, glowMat), 'bead');
          m.position.copy(p0()).setY(WORK.h); m.position.x += 0.06;
          bead = { mesh: m, order, shown: 0 }; beads.push(bead); FX.extrude = true;
        }),
        mk(1.4, (u) => { const p = p0(); p.x += 0.12 * u; setQ(r, solve(r, p, 0, toolLen(r))); grow(bead, Math.round(u * bead.order.length)); },
          null, () => { FX.extrude = false; W.host.markShadows(); }),
        tipMove(r, () => tipNow(r), () => up(tipNow(r), 0.35), 0, 0.5),
      ];
    }
    if (kind === 'laser') {
      const y = WORK.y - 0.3 + 0.05 * (T.swapN[r.i] % 4);
      return laserPath(r, [at(WORK.x - 0.3, y, 0), at(WORK.x + 0.2, y, 0)].map((v) => v.setY(WORK.h)), WORK.h, 0.4);
    }
    if (kind === 'gripper') {                                  // held up in front, the fingers open and close twice
      const p = () => at(K.x + 1.0, K.y - 1.6, 2.4);
      return [
        reach(r, p, Math.PI / 2 - 0.4, 1.6),
        mk(2.4, (u) => grip(0.5 + 0.5 * Math.cos(u * Math.PI * 4))),
        call(() => grip(1)),
      ];
    }
    // welder: down to the plate, two flashes
    const p = () => at(WORK.x + 0.2, WORK.y + 0.25, WORK.h);
    const flash = () => mk(0.45, (u) => { FX.weld = u < 0.55 ? 1 - u / 0.55 : 0; }, () => { FX.flashAt = up(p(), 0.03); FX.spawn = 10; FX.spawnAt = FX.flashAt.clone(); }, () => { FX.weld = 0; });
    return [
      reach(r, () => up(p(), 0.35), 0, 1.6),
      tipMove(r, () => up(p(), 0.35), () => up(p(), 0.02), 0, 0.6),
      flash(), wait(0.25), flash(),
      tipMove(r, () => tipNow(r), () => up(tipNow(r), 0.35), 0, 0.5),
    ];
  }
  // a different head than the arm's own, in turn
  function swapKind(r) {
    const own = r.own ? r.own.userData.kind : null;
    const list = KINDS.filter((k) => k !== own);
    return list[T.swapN[r.i]++ % list.length];
  }
  function taskSwap(r) {
    const kind = swapKind(r);
    r.kind = kind;
    return [...takeHead(r, () => heads[kind], homes[kind].slot), ...show(r, kind), ...putHead(r, homes[kind].slot)];
  }
  function taskCut(r) {
    const k = T.offLeft - 1, frame = T.cutN % 2 === 1, top = offTop(k);
    T.cutN++;
    const part = named(new THREE.Mesh(frame ? partGeo.frame : partGeo.wall, mat), frame ? 'part_frame' : 'part_wall');
    part.visible = false;
    const pc = () => at(OFF.x, OFF.y - OFF.pd / 2 + PART.d / 2, top);        // the part's top middle on the stack
    const y0 = OFF.y - OFF.pd / 2 + PART.d, x0 = OFF.x - OFF.pw / 2 - 0.05, x1 = OFF.x + OFF.pw / 2 + 0.05;
    const line1 = [at(x0, y0, top), at(x1, y0, top)];
    const c = pc(), hw = PART.ow / 2, hd = PART.od / 2;
    const ring = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd], [-hw, -hd]].map(([dx, dy]) => at(OFF.x + dx, -c.z + dy, top));
    const steps = [
      ...takeHead(r, () => heads.laser, homes.laser.slot),
      ...laserPath(r, line1, top),
      ...(frame ? laserPath(r, ring, top, 0.35) : []),
      call(() => {                                           // the offcut becomes the part; the strip (and the window's hole) drop beside the pallet
        placeOffcuts(k);
        part.visible = true; part.position.copy(pc()); part.quaternion.identity();
        drop(partGeo.strip, at(OFF.x, OFF.y + OFF.pd / 2 - PART.strip / 2, top), PART.t);
        if (frame) drop(partGeo.hole, pc(), PART.t);
        W.host.markShadows();
      }),
      ...putHead(r, homes.laser.slot),
      ...takeHead(r, () => heads.gripper, homes.gripper.slot),
      ...lift(r, part, pc),
      ...toPile(r, part, PART.t),
      ...putHead(r, homes.gripper.slot),
    ];
    return steps;
  }
  function drop(geo, from, th) {                             // a trimmed piece falls onto the scrap spot
    const m = named(new THREE.Mesh(geo, mat), 'scrap');
    m.position.copy(from);
    const h = T.scrap.reduce((s, o) => s + o.th, 0);
    T.scrap.push({ obj: m, th, f: { from: from.clone(), to: at(SCRAP.x + (T.scrap.length % 2 ? 0.04 : -0.03), SCRAP.y, h + th), t: 0, spin: (T.scrap.length % 2 ? 0.5 : -0.4) } });
  }
  function taskFoot(r) {
    const { g, order } = footGeo();
    const foot = named(new THREE.Mesh(g, glowMat), 'part_foot');
    const item = { mesh: foot, order, shown: 0 };
    const dz = FOOT.H / FOOT.layers;
    foot.position.copy(up(workTop(), FOOT.H));
    // in the plate's frame: across the plate (site x), up
    const tipAt = (L, x, out = new THREE.Vector3()) => at(WORK.x + x, WORK.y, WORK.h + (L + 1) * dz + 0.008, out);
    const layerSpan = (L) => { const xs = order.filter((o) => o.L === L).map((o) => o.x); return [Math.min(...xs) - 0.03, Math.max(...xs) + 0.03]; };
    const steps = [...takeHead(r, () => heads.nozzle, homes.nozzle.slot)];
    const s0 = layerSpan(0);
    steps.push(reach(r, () => up(tipAt(0, s0[0]), 0.35), 0, 1.6));
    steps.push(tipMove(r, () => up(tipAt(0, s0[0]), 0.35), () => tipAt(0, s0[0]), 0, 0.6));
    steps.push(call(() => { FX.extrude = true; }));
    let n0 = 0;
    for (let L = 0; L < FOOT.layers; L++) {
      const [a, b] = layerSpan(L), from = L % 2 ? b : a, to = L % 2 ? a : b, p = new THREE.Vector3();
      const first = n0, count = order.filter((o) => o.L === L).length;
      n0 += count;
      steps.push(mk(Math.abs(to - from) / 0.75 + 0.08, (u) => {
        const f = Math.min(1, u * 1.08), x = from + (to - from) * f;
        setQ(r, solve(r, tipAt(L, x, p), 0, toolLen(r)));
        let n = first;
        while (n < first + count && (L % 2 ? order[n].x >= x - 0.02 : order[n].x <= x + 0.02)) n++;
        grow(item, u >= 1 ? first + count : n);
      }));
    }
    steps.push(call(() => { FX.extrude = false; W.host.markShadows(); }));
    steps.push(tipMove(r, () => tipNow(r), () => up(tipNow(r), 0.35), 0, 0.5));
    steps.push(...putHead(r, homes.nozzle.slot));
    steps.push(...takeHead(r, () => heads.gripper, homes.gripper.slot));
    // the gripper takes it by the top, lifts it and lays it flat on the pile (the top towards +y)
    const flatQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    steps.push(...lift(r, foot, () => up(workTop(), FOOT.H), flatQ));
    steps.push(mk(1.4, (u) => { r.carry.u = u; placeCarry(r); }));
    steps.push(...toPile(r, foot, FOOT.t, FOOT.H / 2, FOOT.t / 2));
    steps.push(...putHead(r, homes.gripper.slot));
    return steps;
  }

  // ---- the trip: from where the arm stopped to the station, and back
  function route(r) {                                        // the waypoints from the stop to the station
    const { x, y } = r.stop, w = [];
    if (near(x, 5.0)) w.push([5.0, STRIP_Y]);
    else if (near(x, W.DOCK[0].x) && near(y, W.DOCK[0].y)) w.push([x, -6.1], [5.0, STRIP_Y]);   // clear of the floodlight
    else if (near(x, W.DOCK[1].x)) w.push([5.0, y], [5.0, STRIP_Y]);
    else if (x < -3) w.push([x, STRIP_Y]);
    w.push([CORNER_X, STRIP_Y], [K.x, K.y]);
    return w;
  }
  function tripOut(r) {
    const steps = [];
    steps.push(waitFor(() => W.road == null || W.road === r.i));
    steps.push(call(() => { r.road = W.road == null; W.road = r.i; }));
    r.wps = route(r);
    r.wps.forEach(([x, y]) => steps.push(...goTo(r, x, y)));
    steps.push(turnTo(r, () => [0, -1]));
    return steps;
  }
  function tripBack(r) {
    const steps = [], back = r.wps.slice(0, -1).reverse();
    back.forEach(([x, y]) => steps.push(...goTo(r, x, y)));
    steps.push(...goTo(r, r.stop.x, r.stop.y));
    steps.push(turnTo(r, () => r.stop.ry));
    steps.push(call(() => { if (r.road && W.road === r.i) W.road = null; r.road = false; }));
    return steps;
  }

  // ---- looking at the visitor: standing up tall, the head turned to the camera (it follows the camera)
  const camL = new THREE.Vector3();
  function aimQ(r) {
    const cam = W.host.camera, b = r.arm.base;
    cam.getWorldPosition(camL); W.root.worldToLocal(camL);
    const j = r.arm.joints.j2; j.updateWorldMatrix(true, false);
    const sh = W.root.worldToLocal(j.getWorldPosition(tmp2));
    const ry = b.rotation.y, cs = Math.cos(ry), sn = Math.sin(ry);
    const dx = camL.x - sh.x, dy = camL.y - (sh.y + 5.6), dz = camL.z - sh.z;
    const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
    const t = THREE.MathUtils.clamp(Math.atan2(Math.hypot(lx, lz), dy), 0.35, 1.9);
    return { ...UP, j1: Math.atan2(lx, lz), j5: t - UP.j2 - UP.j3 };
  }
  function lookIn(r) {
    return [
      ...(Math.abs(r.q.j1) > 0.03 ? [pose(r, { ...r.q, j1: 0 }, 1.2)] : []),
      pose(r, UP, 2.0),
      pose(r, () => aimQ(r), 1.4),
      call(() => { r.state = 'look'; openAsk(r); }),
    ];
  }
  const lookOut = (r) => [pose(r, { ...UP, j1: 0 }, 1.4)];

  // ---- the run
  function start(r) {                                        // the loop is held: the arm stands up and looks
    r.q = r.loop.q();
    const p = r.arm.base.position;
    r.stop = { x: p.x, y: -p.z, ry: r.arm.base.rotation.y, q: { ...r.q } };
    r.own = r.arm.tool;
    r.state = 'turn';
    r.steps = lookIn(r);
  }
  function goBack(r) {                                       // closed: folds as it was and goes on
    r.state = 'back';
    r.steps = [...lookOut(r), pose(r, { ...r.stop.q, j1: 0 }, 2.0), pose(r, r.stop.q, 1.2), call(() => finish(r))];
  }
  function finish(r) {
    setQ(r, r.stop.q);
    r.state = 'free'; r.steps = []; r.cur = null;
    r.loop.release();
    W.host.markShadows();
  }
  function runTask(r, id) {
    r.state = 'task';
    // the work is planned when the arm gets there (the other arm may have used the last offcut meanwhile)
    const work = () => (id === 'swap' ? taskSwap(r) : id === 'cut' ? (canCut() ? taskCut(r) : []) : (canFoot() ? taskFoot(r) : []));
    r.steps = [
      ...lookOut(r), fold(r),
      ...tripOut(r),
      call(() => { T.worker = r; }),
      ...(r.own ? putHead(r, 0) : []),
      { dyn: work },
      ...(r.own ? takeHead(r, () => r.own, 0) : []),
      fold(r),
      ...tripBack(r),
      pose(r, { ...r.stop.q, j1: 0 }, 1.6), pose(r, r.stop.q, 1.2),
      call(() => finish(r)),
    ];
  }
  function stepArm(r, dt) {
    if (r.state === 'free' || r.state === 'wait') return;
    let left = dt;
    while (left > 0 || (r.cur && r.cur.dur === 0)) {
      if (!r.cur) {
        if (!r.steps.length) break;
        r.cur = r.steps.shift(); r.cur.t = 0;
        if (r.cur.dyn) { r.steps.unshift(...r.cur.dyn()); r.cur = null; continue; }
        if (r.cur.start) r.cur.start();
        if (!r.cur) continue;                                // finish() ended the run
      }
      const c = r.cur;
      if (c.until && c.until()) c.t = c.dur;
      const use = Math.min(left, c.dur - c.t);
      c.t += use; left -= use;
      c.update(c.dur > 0 ? Math.min(1, c.t / c.dur) : 1);
      if (c.t >= c.dur - 1e-9) { if (c.end) c.end(); r.cur = null; } else break;
    }
    if (r.state === 'look' && !r.steps.length) {             // follow the camera
      const q = aimQ(r), o = { ...r.q }, k = Math.min(1, dt * 2.5);
      let d = q.j1 - o.j1; d = Math.atan2(Math.sin(d), Math.cos(d));
      o.j1 += d * k; o.j5 += (q.j5 - o.j5) * k;
      setQ(r, o);
    }
  }
  function advance(dt) {
    T.clock += dt; uNow.value = T.clock;
    R.forEach((r) => stepArm(r, dt));
    stepFx(dt);
    // the trimmed strips falling
    T.scrap.forEach((s) => {
      const f = s.f;
      if (!f || f.t >= 1) return;
      f.t = Math.min(1, f.t + dt / 0.55);
      s.obj.position.lerpVectors(f.from, f.to, f.t);
      s.obj.position.y = f.from.y + (f.to.y - f.from.y) * f.t * f.t + 0.12 * Math.sin(f.t * Math.PI);
      s.obj.rotation.set(0, f.spin * f.t, 0);
      if (f.t >= 1) W.host.markShadows();
    });
  }
  function afterMove() {
    R.forEach((r) => {
      if (r.carry) placeCarry(r);
      if (r.moved) { loops[0].placeCleats(r.i, r.track); loops[0].hoseDirty(); r.moved = false; }
    });
  }
  function stepFx(dt) {
    const night = W.host.night ? W.host.night() : 0, r = T.worker;
    let lvl = 0;
    if (FX.laser && r && r.arm.tool) {
      const lens = tipNow(r), d = FX.laser.clone().sub(lens), l = d.length();
      FX.beam.visible = l > 0.01; FX.beam.position.copy(lens);
      FX.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); FX.beam.scale.set(1, l, 1);
      lvl = 0.55; FX.lightAt.copy(FX.laser); FX.lightCol.setHex(0xffb890);
    } else FX.beam.visible = false;
    if (FX.cutPts.length > 1 && FX.cutFade > 0) {
      const a = FX.cut.geometry.attributes.position;
      FX.cutPts.forEach((p, k) => a.setXYZ(k, p.x, p.y + 0.004, p.z));
      a.needsUpdate = true; FX.cut.geometry.setDrawRange(0, FX.cutPts.length); FX.cut.geometry.computeBoundingSphere();
      FX.cut.visible = true;
      if (!FX.laser) FX.cutFade = Math.max(0, FX.cutFade - dt / 1.8);
      FX.cut.material.opacity = FX.cutFade;
    } else FX.cut.visible = false;
    if (FX.weld > 0 && FX.flashAt) {
      FX.flash.visible = true; FX.flash.position.copy(FX.flashAt);
      const s = 0.12 + 0.22 * FX.weld * (0.8 + 0.4 * Math.random());
      FX.flash.scale.set(s, s, s); FX.flash.material.opacity = Math.min(1, FX.weld * 1.4);
      lvl = Math.max(lvl, FX.weld); FX.lightAt.copy(FX.flashAt); FX.lightCol.setHex(0xcfe0ff);
    } else FX.flash.visible = false;
    if (FX.extrude && r && r.arm.tool) {
      FX.tip.visible = true; FX.tip.position.copy(tipNow(r));
      lvl = Math.max(lvl, 0.35); FX.lightAt.copy(FX.tip.position); FX.lightCol.setHex(0xffa060);
    } else FX.tip.visible = false;
    const pos = FX.sparks.geometry.attributes.position;
    while (FX.spawn >= 1 && FX.spawnAt) {
      FX.spawn -= 1;
      const s = FX.sp.find((o) => o.life <= 0);
      if (!s) break;
      s.p.copy(FX.spawnAt); s.v.set((Math.random() - 0.5) * 1.6, 0.4 + Math.random() * 1.1, (Math.random() - 0.5) * 1.6);
      s.life = 0.25 + Math.random() * 0.35;
    }
    let alive = 0;
    FX.sp.forEach((s, k) => {
      if (s.life > 0) {
        s.life -= dt; s.v.y -= 9.8 * dt; s.p.addScaledVector(s.v, dt);
        if (s.p.y < 0.02) { s.p.y = 0.02; s.v.y *= -0.3; s.v.x *= 0.5; s.v.z *= 0.5; }
        alive++; pos.setXYZ(k, s.p.x, s.p.y, s.p.z);
      } else pos.setXYZ(k, 0, -50, 0);
    });
    pos.needsUpdate = true; FX.sparks.visible = alive > 0;
    if (alive) FX.sparks.geometry.computeBoundingSphere();
    FX.lvl += (lvl - FX.lvl) * Math.min(1, dt * 30);
    FX.light.intensity = FX.lvl * (0.25 + 3.0 * night);
    if (FX.lvl > 0.01) { FX.light.position.copy(FX.lightAt).add(tmp.set(0.3, 0.25, 0)); FX.light.color.copy(FX.lightCol); }
  }

  // ---- the visitor's side: tap, hover, the bubble (index.html draws it: host.armAsk)
  const hitList = (r) => { const l = []; r.arm.base.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) l.push(o); }); return l; };
  function armAt(ev) {
    const h = W.host;
    if (!h.setRay) return -1;
    h.setRay(ev);
    let best = -1, bd = Infinity;
    R.forEach((r) => { const hit = h.ray.intersectObjects(hitList(r), false)[0]; if (hit && hit.distance < bd) { bd = hit.distance; best = r.i; } });
    return best;
  }
  function closeOthers(keep) {
    R.forEach((r) => {
      if (r.i === keep) return;
      if (r.state === 'wait') { r.loop.cancelHold(); r.state = 'free'; }
      else if (r.state === 'look') { closeAsk(); goBack(r); }
    });
  }
  function request(i) {
    const r = R[i];
    closeOthers(i);
    if (r.state !== 'free') return;
    r.state = 'wait';
    r.loop.hold(() => start(r));
  }
  function tap(ev) {
    const i = armAt(ev);
    if (i < 0) {                                             // a tap elsewhere: back to work
      if (R.some((r) => r.state === 'wait' || r.state === 'look')) closeOthers(-1);
      return false;
    }
    request(i);
    return true;
  }
  function hover(ev) {
    if (!ev) return false;
    const i = armAt(ev);
    return i >= 0;
  }
  const canCut = () => T.offLeft > 0 && T.pile.length < PILE.max;
  const canFoot = () => T.pile.length < PILE.max;
  function openAsk(r) {
    T.ask = r.i;
    if (!W.host.armAsk) return;
    W.host.armAsk({
      at: (v) => { r.arm.mount.updateWorldMatrix(true, false); return r.arm.mount.getWorldPosition(v).setY(v.y + 0.55); },
      tasks: { swap: true, cut: canCut(), foot: canFoot() },
      pick: (id) => { T.ask = -1; runTask(r, id); },
      close: () => { T.ask = -1; if (r.state === 'look') goBack(r); },
    });
  }
  function closeAsk() { T.ask = -1; if (W.host.armAskClose) W.host.armAskClose(); }

  // ---- the start state of the corner (only while the site is off screen and no arm is on a task)
  function reset() {
    T.pile.forEach((o) => { W.root.remove(o.obj); });
    T.scrap.forEach((o) => { W.root.remove(o.obj); });
    beads.forEach((b) => { W.root.remove(b.mesh); b.mesh.geometry.dispose(); });
    T.pile.forEach((o) => { if (o.obj.material === glowMat) o.obj.geometry.dispose(); });
    T.pile = []; T.scrap = []; beads.length = 0;
    placeOffcuts(OFF.n);
    T.cutN = 0;
    W.host.markShadows();
  }
  const busy = () => R.some((r) => r.state !== 'free');
  function offScreen() {
    if (busy()) return;
    if (T.pile.length || T.scrap.length || beads.length || T.offLeft < OFF.n) reset();
  }

  placeOffcuts(OFF.n);
  // the hose keeps out of the corner's things
  [[0.0, STAND.y, 0.55], [1.0, STAND.y, 0.55], [2.0, STAND.y, 0.55], [WORK.x, WORK.y, 0.7], [OFF.x, OFF.y, 0.7], [PILE.x, PILE.y, 0.8], [SCRAP.x, SCRAP.y, 0.4]]
    .forEach((c) => loops[0].keepOut(c));
  W.host.markShadows();

  return {
    advance, afterMove, busy, offScreen, tap, hover, request,
    close: () => { R.forEach((r) => { if (r.state === 'look') { closeAsk(); goBack(r); } else if (r.state === 'wait') { r.loop.cancelHold(); r.state = 'free'; } }); },
    pick: (i, id) => { const r = R[i]; if (r.state === 'look') { closeAsk(); runTask(r, id); } },
    sphere: (s) => { W.root.localToWorld(s.center.set(0.9, 1.5, 9.4)); s.radius = 3.4; return s; },
    // tests
    state: () => ({ arms: R.map((r) => ({ state: r.state, left: r.steps.length, base: [+r.arm.base.position.x.toFixed(2), +(-r.arm.base.position.z).toFixed(2)], tool: r.arm.tool ? r.arm.tool.userData.kind + (r.arm.tool.userData.task ? '*' : '') : null, own: r.own ? r.own.userData.kind : null })),
      road: W.road, pile: T.pile.length, scrap: T.scrap.length, offcuts: T.offLeft, ask: T.ask }),
    cam: () => W.host.camera,
    screen(i) {                                              // where on the page arm i's upper arm is
      const r = R[i], v = new THREE.Vector3();
      r.arm.joints.j3.getWorldPosition(v).project(W.host.camera);
      const rc = W.host.el.getBoundingClientRect();
      return [rc.left + (v.x + 1) / 2 * rc.width, rc.top + (1 - v.y) / 2 * rc.height];
    },
    K, STRIP_Y, CORNER_X, STAND, WORK, OFF, PILE,
  };
}
