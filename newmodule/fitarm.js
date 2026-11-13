// New module, FEAT-025c: the second arm (arm B, the fit arm) works alongside the print arm in the same loop.
// For each of the three open bays, in order:
//   1. scan: a thin red laser fan from the gripper's scanning head sweeps over the bay
//   2. laser: at the tool rack it swaps to the laser cutter and cuts a floor panel from the panel stack
//      beside the rack (a thin bright beam, small sparks, a glowing cut line that fades); the offcut drops
//      beside the stack
//   3. fit: it swaps to the gripper, lifts the cut panel and sets it into the bay as floor deck (on the
//      floor beams, on the open side)
//   4. weld: it swaps to the spot welder and welds the panel's joints to the ribs (short bright flashes)
//   5. check: it swaps back to the gripper and scans the bay once more (then scans the next bay)
// Window bay (the middle one, where the print arm left the opening): once the print arm is back at the
// dock, arm B ducks under the module to the lane behind it, laser-cuts the opening clean from outside,
// then fetches a window frame (like the other modules' windows) from the stack and fits it.
// Every tool swap is shown at the rack: the old head into its cradle, the new one docked with a short
// click-in. At the end it drives back to the dock and plugs in; the reset follows the print loop
// (only while the site is off screen, see printloop.js).
// Where it works: the lane in front of the module (the open side, +x). The rack, the panel stack and the
// bays are all reached from there, so it never meets the print arm, which prints from the lane behind the
// module; where the lanes meet (the dock end of the front lane) the arms wait for each other.
// Coordinates as in worksite.js: the site frame (z up, the module's long axis along y, the open side +x).
import * as THREE from 'three';
import { holdCheck, folded } from './hold.js';

// ---- the module (printloop.js, construction.py: keep in step)
const Z0 = 4.1;
const FLOOR_Z = Z0 - 1.8 + 0.95 * 0.75;                    // the floor deck's top (3.01)
const RIBS = [-4.6, -3.0, -1.4, 0.2], RIB_T = 0.16;
const BAYS = RIBS.slice(0, -1).map((r, i) => ({ y0: r + RIB_T / 2, y1: RIBS[i + 1] - RIB_T / 2, c: (r + RIBS[i + 1]) / 2 }));
const WINDOW = { bay: 1, w: 0.65, h: 0.85, zc: FLOOR_Z + 1.35, x: -(2.9 - 0.18 / 2) };   // the frame sits in the wall's middle

// ---- the arm (worksite.js) and its moves
const L1 = 3.0, L2 = 0.3 + 2.4, SH = 1.25, J1Z = 0.12, FLANGE = 0.18 + 0.09;
const KEYS = ['j1', 'j2', 'j3', 'j4', 'j5', 'j6'];
const TUCK = { j1: 0, j2: -0.2, j3: 2.5, j4: 0, j5: 1.0, j6: 0 };
const PARK = { j1: 0, j2: -0.25, j3: 2.85, j4: 0, j5: 0.54, j6: 0 };
const SPEED = 1.8, TURN = 1.5;                              // m/s, rad/s (brisker than the print arm: it has more to do)

// ---- where it works (site frame)
const LANE_X = 5.0;                                         // the front lane (the print arm uses it only to leave and to come home)
const STATION_Y = 2.4;                                      // in front of the rack's cradles, the panel stack just behind it
const SOUTH = -1.5;                                         // the front lane's dock end: the print arm comes home through it
const BAY_Y = BAYS.map((b) => b.c + J1Z);                  // the base's stop per bay (heading -y): the shoulder level with the bay's middle
const CROSS_Y = -1.75;                                      // where it ducks under the module to the lane behind it (between the ribs' feet)
const BACK_X = -4.0;                                        // its stop behind the module, by the window bay
const PALLET = { x: 5.0, y: 4.55, w: 1.5, d: 1.5, h: 0.12 };
const BLANK = { x: 5.0, y: 4.55, w: 1.3, d: 1.3, t: 0.07, n: 4 };
const TILE = { w: 1.3, d: 1.2, x: 1.45 };                   // a floor panel: across the bay's open side, on the beams at x 0.7 and 2.0
const FRAME_REST = { x: -5.15, y: -0.25, w: 1.0, d: 0.8, h: 0.1 };   // a small pallet behind the module, clear of the drums and the arm's turn

const at = (x, y, z, v = new THREE.Vector3()) => v.set(x, z, -y);
const ss = (u) => u * u * (3 - 2 * u);
const heading = (hx, hy) => Math.atan2(hx, -hy);

export function createFitLoop(W, A) {
  // W: the worksite (root, arms, tools, mats, host, DOCK, DOCK_TOP, TOOL_LEN, toolHome); A: the print loop
  const arm = W.arms[1];
  const B = {
    phase: 'idle', steps: [], cur: null, q: { ...PARK }, track: [0, 0], clock: 0,
    tiles: [], offcuts: [], frame: null, carry: null, fx: null, light: null, south: false, task: '', reach: 0,
  };
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tq = new THREE.Quaternion();

  // ---- the things it handles: a pallet with panel blanks, the cut panels, the offcuts, a window frame
  const mat = W.mats.plaster, line = W.mats.line;
  const named = (m, n) => { m.name = 'futureworksite_' + n; m.castShadow = true; m.receiveShadow = true; W.root.add(m); return m; };
  const pallet = named(new THREE.Mesh(new THREE.BoxGeometry(PALLET.w, PALLET.h, PALLET.d), mat), 'fit_pallet');
  at(PALLET.x, PALLET.y, PALLET.h / 2, pallet.position);
  const pallet2 = named(new THREE.Mesh(new THREE.BoxGeometry(FRAME_REST.w, FRAME_REST.h, FRAME_REST.d), mat), 'fit_framepallet');
  at(FRAME_REST.x, FRAME_REST.y, FRAME_REST.h / 2, pallet2.position);
  const blankGeo = new THREE.BoxGeometry(BLANK.w, BLANK.t, BLANK.d);
  const blanks = new THREE.InstancedMesh(blankGeo, mat, BLANK.n);
  named(blanks, 'fit_blanks');
  const blankTop = (k) => PALLET.h + (k + 1) * BLANK.t;     // the top of blank k (0: the lowest)
  function placeBlanks(left) {
    const d = new THREE.Object3D();
    for (let k = 0; k < BLANK.n; k++) {
      at(BLANK.x, BLANK.y, blankTop(k) - BLANK.t / 2, d.position);
      d.scale.setScalar(k < left ? 1 : 1e-4);
      d.updateMatrix(); blanks.setMatrixAt(k, d.matrix);
    }
    blanks.instanceMatrix.needsUpdate = true; blanks.computeBoundingSphere();
    B.blanksLeft = left;
  }
  // a cut panel: its origin at the middle of its top face (where the gripper holds it)
  const tileGeo = new THREE.BoxGeometry(TILE.w, BLANK.t, TILE.d).translate(0, -BLANK.t / 2, 0);
  const offGeo = new THREE.BoxGeometry(BLANK.w, BLANK.t, BLANK.d - TILE.d).translate(0, -BLANK.t / 2, 0);
  for (let i = 0; i < 3; i++) {
    const t = named(new THREE.Mesh(tileGeo, mat), 'fit_panel' + i); t.visible = false; B.tiles.push(t);
    const o = named(new THREE.Mesh(offGeo, mat), 'fit_offcut' + i); o.visible = false; B.offcuts.push(o);
  }
  // the window frame: like the other modules' (build_station_v4.py frame(): 0.65 × 0.85, 0.05 deep, 0.035 bars,
  // a mullion), black linework; built standing in the wall (its plane y-z), origin at its middle
  {
    const fw = WINDOW.w, fh = WINDOW.h, dp = 0.05, bar = 0.035, gs = [];
    const bx = (sx, sy, sz, x, y, z) => { const g = new THREE.BoxGeometry(sx, sy, sz); g.translate(x, y, z); return g; };
    // in the root frame: x across the wall (depth), y up, z = -site y
    gs.push(bx(dp, bar, fw, 0, fh / 2 - bar / 2, 0), bx(dp, bar, fw, 0, -fh / 2 + bar / 2, 0));
    gs.push(bx(dp, fh, bar, 0, 0, fw / 2 - bar / 2), bx(dp, fh, bar, 0, 0, -fw / 2 + bar / 2), bx(dp, fh, bar * 0.8, 0, 0, 0));
    const g = mergeBoxes(gs);
    B.frame = named(new THREE.Mesh(g, line), 'fit_frame');
  }
  const FRAME_FLAT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);   // lying on the pallet
  const FRAME_UP = new THREE.Quaternion();                                                          // standing in the wall
  function restFrame() {
    B.frame.position.copy(at(FRAME_REST.x, FRAME_REST.y, FRAME_REST.h + 0.025));
    B.frame.quaternion.copy(FRAME_FLAT);
  }

  // ---- the effects: small and short (a few lines, sprites and points, one light without shadows)
  const FX = {};
  const add = (o, n) => { o.name = 'futureworksite_fx_' + n; o.visible = false; o.frustumCulled = false; o.renderOrder = 5; W.root.add(o); return o; };
  const glowMat = (c, op) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  // the beam: a thin cylinder between the lens and the cut, scaled each frame
  FX.beam = add(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 6, 1, true).translate(0, 0.5, 0), glowMat(0xffe2d0, 0.95)), 'beam');
  // the scan fan: one triangle, from the scanning head to a line across the bay
  {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3).setUsage(THREE.DynamicDrawUsage));
    FX.fan = add(new THREE.Mesh(g, glowMat(0xff3a2a, 0.22)), 'scanfan');
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3).setUsage(THREE.DynamicDrawUsage));
    FX.scanLine = add(new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xff5040, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })), 'scanline');
  }
  // the glowing cut line: a polyline that grows behind the beam and fades
  {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    FX.cut = add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffa060, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })), 'cutline');
    FX.cutPts = []; FX.cutFade = 0;
  }
  // sparks: a few points thrown from the cut or the weld, falling
  {
    const N = 28, g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage));
    FX.sparks = add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffc890, size: 0.035, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })), 'sparks');
    FX.sp = Array.from({ length: N }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0 }));
    FX.spawn = 0;
  }
  // the weld flash: a small soft sprite
  {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(200,225,255,0.8)'); gr.addColorStop(1, 'rgba(160,200,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    FX.flash = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })), 'flash');
    FX.flashT = 0;
  }
  B.light = new THREE.PointLight(0xffd8c0, 0, 6, 2);
  B.light.name = 'futureworksite_fitlight';
  W.root.add(B.light);
  FX.lightAt = new THREE.Vector3(); FX.lightCol = new THREE.Color(); FX.lightLvl = 0;

  // ---- the arm: inverse kinematics like the print arm (printloop.js solve), for arm B; tau: the tool's tilt
  // from straight down, away from the arm (pi/2: pointing horizontally away, -pi/2: back towards the arm)
  function solve(tip, tau, len, q = {}) {
    const b = arm.base, ry = b.rotation.y, cs = Math.cos(ry), sn = Math.sin(ry);
    const dx = tip.x - b.position.x, dy = tip.y - b.position.y, dz = tip.z - b.position.z;
    const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs - J1Z, ly = dy;
    const psi = Math.atan2(lx, lz), r = Math.hypot(lx, lz), h = ly - SH;
    const t3 = Math.PI - tau;
    const wr = r - len * Math.sin(t3), wh = h - len * Math.cos(t3);
    const D = THREE.MathUtils.clamp(Math.hypot(wr, wh), Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-3);
    const c = THREE.MathUtils.clamp((D * D - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1);
    const j3 = Math.acos(c), beta = Math.atan2(L2 * Math.sin(j3), L1 + L2 * c), phi = Math.atan2(wr, wh);
    const j2 = phi - beta;
    q.j1 = psi; q.j2 = j2; q.j3 = j3; q.j4 = 0; q.j5 = t3 - j2 - j3; q.j6 = 0;
    B.reach = Math.hypot(wr, wh);
    return q;
  }
  // a point in the base's own frame (fwd along its heading, side to its left, up) → root frame
  function local(fwd, side, up, out = new THREE.Vector3()) {
    const ry = arm.base.rotation.y, fx = Math.sin(ry), fz = Math.cos(ry);
    return out.set(arm.base.position.x + fx * fwd + fz * side, up, arm.base.position.z + fz * fwd - fx * side);
  }
  const setQ = (q) => { for (const k of KEYS) B.q[k] = q[k]; arm.set(B.q); };
  // in the front lane the folded arm faces the module, so it never swings past a rib on its way into a bay
  const SIDE = () => ({ ...TUCK, j1: solve(local(J1Z, -3, 2.0), 0, toolLen()).j1 });
  const toolLen = () => FLANGE + (arm.tool ? W.TOOL_LEN[arm.tool.userData.kind] : 0);
  function tipNow(len = toolLen()) {
    arm.mount.updateWorldMatrix(true, false);
    return W.root.worldToLocal(tmp2.set(0, len - FLANGE, 0).applyMatrix4(arm.mount.matrixWorld)).clone();
  }
  // where the tool points (root frame, unit)
  const qa = new THREE.Quaternion(), qr = new THREE.Quaternion();
  function toolDir(out = new THREE.Vector3()) {
    arm.mount.updateWorldMatrix(true, false);
    arm.mount.getWorldQuaternion(qa); W.root.getWorldQuaternion(qr);
    return out.set(0, 1, 0).applyQuaternion(qa).applyQuaternion(qr.invert());
  }

  // ---- the program's steps (as in printloop.js)
  const mk = (dur, update, start, end) => ({ dur, update, start, end });
  const call = (fn) => mk(0, () => {}, fn);
  const waitFor = (cond) => { const s = mk(1e6, () => {}); s.until = cond; return s; };
  const wait = (sec) => mk(sec, () => {});
  function pose(target, dur) {
    let from, q;
    return mk(dur, (u) => { const e = ss(u), o = {}; for (const k of KEYS) o[k] = from[k] + (q[k] - from[k]) * e; setQ(o); },
      () => {
        from = { ...B.q }; q = { ...(typeof target === 'function' ? target() : target) };
        while (q.j1 - from.j1 > Math.PI) q.j1 -= 2 * Math.PI;   // the short way round
        while (q.j1 - from.j1 < -Math.PI) q.j1 += 2 * Math.PI;
      });
  }
  function turnTo(hx, hy) {
    let from, to, last = 0;
    const s = mk(1, (u) => {
      const ry = from + (to - from) * ss(u), d = ry - last; last = ry;
      arm.base.rotation.y = ry;
      B.track[0] += d * 0.55; B.track[1] -= d * 0.55;
      B.moved = true;
    }, () => {
      from = arm.base.rotation.y; to = heading(hx, hy);
      while (to - from > Math.PI) to -= 2 * Math.PI;
      while (to - from < -Math.PI) to += 2 * Math.PI;
      last = from;
      s.dur = Math.max(0.4, Math.abs(to - from) / TURN + 0.3);
    });
    return s;
  }
  function drive(x, y) {                                     // forward or in reverse, whichever way the base faces (y: a number or a function)
    let fx, fy, dist, done = 0, reverse = false;
    const yTo = y;
    const s = mk(1, (u) => {
      const e = ss(u), cx = fx + (x - fx) * e, cy = fy + (y - fy) * e;
      at(cx, cy, cx > W.DOCK[1].x - 1.4 ? W.DOCK_TOP : 0, arm.base.position);
      const d = e * dist - done; done = e * dist;
      B.track[0] += d * (reverse ? -1 : 1); B.track[1] += d * (reverse ? -1 : 1);
      B.moved = true;
    }, () => {
      const p = arm.base.position; fx = p.x; fy = -p.z; if (typeof yTo === 'function') y = yTo(fx, fy);
      dist = Math.hypot(x - fx, y - fy); done = 0;
      const ry = arm.base.rotation.y;                        // heading (site): (sin ry, cos ry) in (x, -y)
      reverse = (x - fx) * Math.sin(ry) + (y - fy) * -Math.cos(ry) < 0;
      s.dur = Math.max(0.3, dist / SPEED + 0.8);
    });
    return s;
  }
  // the tool's tip in a straight line (root-frame points or functions), the tool at tilt tau
  function tipMove(from, to, tau, dur, lenFn = toolLen, each) {
    let a, b;
    return mk(dur, (u) => { const e = ss(u); tmp.lerpVectors(a, b, e); setQ(solve(tmp, tau, lenFn())); if (each) each(u, tmp); },
      () => { a = (typeof from === 'function' ? from() : from).clone(); b = (typeof to === 'function' ? to() : to).clone(); });
  }
  // along a path of points at a steady speed (the laser's cut)
  function tipPath(pts, tau, speed, each) {
    const segs = [], lens = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) { const l = pts[i].distanceTo(pts[i - 1]); segs.push([pts[i - 1], pts[i]]); lens.push(l); total += l; }
    return mk(total / speed, (u) => {
      let d = u * total, i = 0;
      while (i < lens.length - 1 && d > lens[i]) { d -= lens[i]; i++; }
      tmp.lerpVectors(segs[i][0], segs[i][1], Math.min(1, d / lens[i]));
      setQ(solve(tmp, tau, toolLen()));
      if (each) each(u, tmp);
    });
  }

  // ---- the south end of the front lane: the print arm drives home through it
  const aInfo = () => A.info();
  const inSouthAt = (y) => y < SOUTH;
  // BUG-030: the hose the print arm leaves lying at the lane's south end; the base stops short of it (it never
  // touches or pushes the hose). CLEAR: from the base's middle, half its length with the tracks' round ends,
  // the hose's radius and a margin
  const CLEAR = 1.25;
  function hoseClear(x, y0, y1) {                            // the base along the lane from y0 to y1 keeps clear of the hose
    const lo = Math.min(y0, y1), hi = Math.max(y0, y1);
    for (const p of A.hosePts()) {
      const px = p.x, py = -p.z, cy = Math.max(lo, Math.min(hi, py));
      if (Math.hypot(px - x, py - cy) < CLEAR) return false;
    }
    return true;
  }
  function clearStop(y) {                                    // the stop at y, or as close to it as the hose allows
    return (fx, fy) => {
      let s = y;
      const dir = Math.sign(fy - y);
      while (dir && (s - fy) * dir < 0 && !hoseClear(LANE_X, fy, s)) s += dir * 0.05;
      return s;
    };
  }
  function goLane(y) {                                       // along the front lane to y (heading -y: forward to the bays, back to the rack)
    const steps = [];
    if (inSouthAt(y)) steps.push(waitFor(() => { const s = aInfo().stage; return s !== 'return'; }));
    steps.push(call(() => { if (inSouthAt(y)) B.south = true; }));
    steps.push(drive(LANE_X, inSouthAt(y) ? clearStop(y) : y));
    steps.push(call(() => { B.south = inSouthAt(y); }));
    return steps;
  }

  // ---- tool swaps at the rack (from the station: base at (LANE_X, STATION_Y), heading -y)
  const SLOT = { nozzle: 0, laser: 1, gripper: 2, welder: 3 };
  const plateAt = (k) => W.toolHome[k].p.clone();
  const up = (v, dz) => { const o = v.clone(); o.y += dz; return o; };
  function putBack() {                                       // the held head into its cradle
    const steps = [];
    let k;
    steps.push(call(() => { k = arm.tool ? arm.tool.userData.kind : null; }));
    steps.push(pose(() => (k ? solve(up(plateAt(k), 0.3), 0, FLANGE) : B.q), 1.3));
    steps.push(tipMove(() => (k ? up(plateAt(k), 0.3) : tipNow(FLANGE)), () => (k ? plateAt(k) : tipNow(FLANGE)), 0, 0.6, () => FLANGE));
    steps.push(call(() => { if (k) release(); }));
    steps.push(mk(0.3, (u) => { if (!k) return; const t = W.tools[k]; t.position.lerp(W.toolHome[k].p, u); t.quaternion.slerp(W.toolHome[k].q, u); }));
    steps.push(tipMove(() => tipNow(FLANGE), () => up(tipNow(FLANGE), 0.3), 0, 0.45, () => FLANGE));
    return steps;
  }
  function take(kind) {                                      // a head from its cradle: over it, down, click in, lift out
    const steps = [];
    steps.push(pose(() => solve(up(plateAt(kind), 0.3), 0, FLANGE), 1.1));
    steps.push(tipMove(() => up(plateAt(kind), 0.3), () => plateAt(kind), 0, 0.6, () => FLANGE));
    steps.push(call(() => attach(kind)));
    steps.push(mk(0.3, (u) => { const t = arm.tool; t.position.multiplyScalar(1 - u); t.quaternion.slerp(tq.identity(), u); }));
    steps.push(mk(0.15, (u) => { arm.mount.position.y = 0.09 - 0.02 * Math.sin(u * Math.PI); }));   // the click-in
    steps.push(tipMove(() => tipNow(FLANGE), () => up(tipNow(FLANGE), 0.4), 0, 0.55, () => FLANGE));
    return steps;
  }
  function swap(kind) { return [...putBack(), ...take(kind), pose(SIDE, 1.1)]; }
  function attach(kind) {
    const t = W.tools[kind];
    arm.mount.attach(t);
    arm.tool = t;
    t.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  }
  function release() {
    const t = arm.tool;
    W.root.attach(t);
    t.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    arm.tool = null;
  }

  // ---- carried parts keep their own orientation (the wrist turns under them); rot: towards another one
  function carry(obj, off = 0) { B.carry = { obj, off, q: obj.quaternion.clone(), to: null, u: 0 }; obj.visible = true; }
  function drop() { B.carry = null; }
  function placeCarry() {
    const c = B.carry;
    if (!c) return;
    const tip = tipNow(), dir = toolDir(tmp);
    c.obj.position.copy(tip).addScaledVector(dir, c.off);
    if (c.to) c.obj.quaternion.copy(c.q).slerp(c.to, ss(c.u)); else c.obj.quaternion.copy(c.q);
  }

  // ---- the bays (from the front lane)
  const BEAM_TOP = FLOOR_Z - 0.16;                          // the floor beams' top (construction.py: floor_z - 0.26 + 0.1)
  const bayTile = (k) => at(TILE.x, BAYS[k].c, BEAM_TOP + BLANK.t, new THREE.Vector3());   // the panel's top middle, laid on the beams
  function scan(k, dur) {                                    // the fan sweeps across the bay and back
    const bay = BAYS[k], above = at(TILE.x, bay.c, Z0 + 0.7, new THREE.Vector3());
    return [
      pose(() => solve(above, 0, toolLen()), 1.5),
      mk(dur, (u) => {
        const ys = bay.c + (bay.y1 - bay.y0 - 0.1) / 2 * Math.sin(u * Math.PI * 2);
        FX.scan = { y: ys, a: Math.min(1, Math.min(u, 1 - u) * 8) };
      }, () => { B.task = 'scan'; }, () => { FX.scan = null; B.task = ''; }),
      pose(SIDE, 1.3),
    ];
  }
  function fitTile(k) {
    const t = B.tiles[k], bay = BAYS[k];
    const outside = at(3.75, bay.c, FLOOR_Z + 0.4, new THREE.Vector3()), over = at(TILE.x, bay.c, FLOOR_Z + 0.35, new THREE.Vector3());
    return [
      pose(() => solve(outside, 0, toolLen()), 1.9),
      tipMove(outside, over, 0, 1.4),
      tipMove(over, () => bayTile(k), 0, 0.7),
      call(() => { drop(); t.position.copy(bayTile(k)); t.quaternion.identity(); B.task = 'fit'; W.host.markShadows(); }),
      tipMove(() => bayTile(k), over, 0, 0.5),
      tipMove(over, outside, 0, 1.1),
      pose(SIDE, 1.5),
      call(() => { B.task = ''; }),
    ];
  }
  function weld(k) {                                         // two spots on each of the panel's joints with the ribs
    const bay = BAYS[k], steps = [], spots = [];
    for (const sy of [-1, 1]) for (const x of [TILE.x - 0.3, TILE.x + 0.3]) spots.push(at(x, bay.c + sy * (TILE.d / 2 + 0.05), BEAM_TOP + BLANK.t + 0.005, new THREE.Vector3()));
    const outside = at(3.75, bay.c, FLOOR_Z + 0.6, new THREE.Vector3());   // in from outside the bay, over the floor
    steps.push(pose(() => solve(outside, 0, toolLen()), 1.5));
    steps.push(tipMove(outside, up(spots[0], 0.25), 0, 1.0));
    spots.forEach((p, i) => {
      if (i) steps.push(tipMove(() => tipNow(), up(p, 0.25), 0, 0.45));
      steps.push(tipMove(up(p, 0.25), p, 0, 0.3));
      steps.push(mk(0.4, (u) => { FX.weld = u < 0.55 ? 1 - u / 0.55 : 0; }, () => { B.task = 'weld'; FX.flashAt = tipNow(toolLen() - 0.12); FX.spawn = 10; FX.spawnAt = FX.flashAt.clone(); }, () => { FX.weld = 0; B.task = ''; }));
      steps.push(tipMove(p, up(p, 0.25), 0, 0.25));
    });
    steps.push(tipMove(() => tipNow(), outside, 0, 0.9));
    steps.push(pose(SIDE, 1.3));
    return steps;
  }

  // ---- the panel stack beside the rack (from the station)
  function cutTile(k) {                                      // the laser cuts a panel off the top blank; the strip drops beside the stack
    const steps = [];
    let top;
    steps.push(call(() => { top = blankTop(B.blanksLeft - 1); }));
    const yCut = BLANK.y - BLANK.d / 2 + (BLANK.d - TILE.d);
    const a = () => at(BLANK.x - BLANK.w / 2 - 0.05, yCut, top + 0.16, new THREE.Vector3()), b = () => at(BLANK.x + BLANK.w / 2 + 0.05, yCut, top + 0.16, new THREE.Vector3());
    steps.push(pose(() => solve(up(a(), 0.25), 0, toolLen()), 1.5));
    steps.push(tipMove(() => up(a(), 0.25), a, 0, 0.4));
    steps.push(call(() => { FX.cutPts = []; FX.cutFade = 0; B.task = 'laser'; }));
    let path;
    steps.push(mk(2.3, (u) => {
      tmp.lerpVectors(path[0], path[1], ss(u));
      setQ(solve(tmp, 0, toolLen()));
      laserHit(tmp.clone().setY(top), u > 0.04 && u < 0.96);
    }, () => { path = [a(), b()]; }, () => { FX.laser = null; B.task = ''; }));
    steps.push(call(() => {                                  // the blank becomes the panel and the strip
      placeBlanks(B.blanksLeft - 1);
      const t = B.tiles[k]; t.visible = true; t.quaternion.identity();
      at(BLANK.x, yCut + TILE.d / 2, top, t.position);
      const o = B.offcuts[k]; o.visible = true; o.quaternion.identity();
      at(BLANK.x, BLANK.y - BLANK.d / 2 + (BLANK.d - TILE.d) / 2, top, o.position);
      B.falling = { o, from: o.position.clone(), to: at(BLANK.x - 0.35 + 0.35 * k, BLANK.y - BLANK.d / 2 - 0.32 - 0.04 * k, 0.07 + 0.012 * k, new THREE.Vector3()), t: 0, spin: 0.5 - 0.4 * k };
      W.host.markShadows();
    }));
    steps.push(tipMove(() => tipNow(), () => up(tipNow(), 0.4), 0, 0.5));
    steps.push(pose(SIDE, 1.2));
    return steps;
  }
  function lift(obj, at0, off = 0) {                         // the gripper down onto a part, close, lift it
    return [
      pose(() => solve(up(at0(), 0.4), 0, toolLen()), 1.4),
      tipMove(() => up(at0(), 0.4), at0, 0, 0.6),
      mk(0.25, () => {}, null, () => carry(obj, off)),
      tipMove(at0, () => up(at0(), 0.5), 0, 0.5, toolLen, () => placeCarry()),
    ];
  }
  // driving with a panel: the arm folded, the panel high beside the base on the module's side
  const CARRY = () => solve(local(0.12, -1.3, 2.3), 0, toolLen());

  // ---- the window bay from behind the module (after the print arm is home)
  // the arm stretched low in front, the forearm folded back over it, the tool pointing ahead: below the floor
  // beams (2.65 m) and the ribs' feet (2.3 m) while the base drives under the module
  const DUCK = { j1: 0, j2: 1.4, j3: 2.95, j4: 0, j5: Math.PI / 2 - 1.4 - 2.95, j6: 0 };
  // behind the module, facing away from it: the arm reaches back over its shoulder to the wall, the
  // elbow out over the open ground (REAR: turned round, leaning away from the wall, the tool hanging down)
  const REAR = { j1: Math.PI, j2: -0.7, j3: 1.9, j4: 0, j5: Math.PI - 1.2, j6: 0 };
  function under(fn) {                                       // under the module to the lane behind it, fn(), and back
    return [
      ...goLane(CROSS_Y),
      pose(TUCK, 1.0),
      turnTo(-1, 0),
      pose(DUCK, 2.3),
      drive(BACK_X, CROSS_Y),
      pose(TUCK, 2.3),
      ...fn(),
      pose(REAR, 1.6),
      pose(TUCK, 2.0),
      pose(DUCK, 2.3),
      drive(LANE_X, CROSS_Y),
      pose(TUCK, 2.3),
      turnTo(0, -1),
      pose(SIDE, 1.2),
    ];
  }
  const win = (dy, dz, dx = 0) => at(WINDOW.x - 0.32 + dx, BAYS[WINDOW.bay].c + dy, WINDOW.zc + dz, new THREE.Vector3());
  function cutOpening() {                                    // the laser runs round the opening, the beam on the wall's outer face
    const hw = WINDOW.w / 2, hh = WINDOW.h / 2;
    const pts = [win(-hw, -hh), win(hw, -hh), win(hw, hh), win(-hw, hh), win(-hw, -hh)];
    return [
      pose(REAR, 2.4),
      pose(() => solve(win(-hw, -hh, -0.2), Math.PI / 2, toolLen()), 1.8),
      tipMove(() => win(-hw, -hh, -0.2), () => pts[0], Math.PI / 2, 0.6),
      call(() => { FX.cutPts = []; FX.cutFade = 0; B.task = 'laser'; }),
      tipPath(pts, Math.PI / 2, 0.55, (u, p) => laserHit(tmp2.copy(p).setX(p.x + 0.32 - 0.09), u > 0.01 && u < 0.99)),
      call(() => { FX.laser = null; B.task = ''; }),
      tipMove(() => tipNow(), () => win(0, 0, -0.5), Math.PI / 2, 0.8),
    ];
  }
  const framePlace = () => at(WINDOW.x, BAYS[WINDOW.bay].c, WINDOW.zc, new THREE.Vector3());
  function fitFrame() {                                      // from the pallet behind the module; from outside: in front of the opening, then in
    const front = () => framePlace().setX(WINDOW.x - 0.6), inPlace = () => framePlace().setX(WINDOW.x - 0.03);
    return [
      ...lift(B.frame, () => at(FRAME_REST.x, FRAME_REST.y, FRAME_REST.h + 0.05, new THREE.Vector3())),
      call(() => { B.carry.to = FRAME_UP; B.carry.u = 0; }),
      mk(1.2, (u) => { B.carry.u = u; }),                    // the frame turned upright in the gripper
      pose(TUCK, 1.6),
      pose(REAR, 2.4),
      pose(() => solve(front(), Math.PI / 2, toolLen()), 1.8),
      tipMove(front, inPlace, Math.PI / 2, 1.4, toolLen, () => placeCarry()),
      mk(0.3, () => {}, null, () => { drop(); B.frame.position.copy(framePlace()); B.frame.quaternion.copy(FRAME_UP); B.task = 'fit'; W.host.markShadows(); }),
      tipMove(inPlace, front, Math.PI / 2, 0.8),
      call(() => { B.task = ''; }),
    ];
  }

  function program() {
    const steps = [];
    const S = (a) => steps.push(...(Array.isArray(a) ? a : [a]));
    S(call(() => { shadows(false); B.south = false; }));
    S(pose(TUCK, 2.6));                                        // unplug, fold up (with the print arm)
    S(waitFor(() => aInfo().stage === 'back' || aInfo().phase === 'done'));   // the print arm has left the front lane
    S(drive(LANE_X, W.DOCK[1].y));
    S(turnTo(0, -1));
    S(goLane(STATION_Y));
    S(take('gripper')); S(pose(SIDE, 1.3));
    S(goLane(BAY_Y[0])); S(scan(0, 2.4));
    for (let k = 0; k < 3; k++) {
      // laser: cut a panel at the stack
      S(goLane(STATION_Y)); S(swap('laser')); S(cutTile(k));
      // fit: the gripper lifts it and sets it into the bay
      S(swap('gripper'));
      S(lift(B.tiles[k], () => B.tiles[k].position.clone()));
      S(pose(CARRY, 1.5));
      S(goLane(BAY_Y[k])); S(fitTile(k));
      // weld: the spot welder on the joints
      S(goLane(STATION_Y)); S(swap('welder'));
      S(goLane(BAY_Y[k])); S(weld(k));
      // check: the gripper's scanner once more (and on to the next bay)
      S(goLane(STATION_Y)); S(swap('gripper'));
      S(goLane(BAY_Y[k])); S(scan(k, 1.6));
      if (k < 2) { S(goLane(BAY_Y[k + 1])); S(scan(k + 1, 2.4)); }
    }
    // the window bay: once the print arm is home, from behind the module
    S(goLane(STATION_Y)); S(swap('laser'));
    S(waitFor(() => aInfo().phase === 'done'));
    S(under(cutOpening));
    S(goLane(STATION_Y)); S(swap('gripper'));
    S(under(fitFrame));
    // back to the dock and plug in
    S(goLane(W.DOCK[1].y));
    S(turnTo(-1, 0));
    S(drive(W.DOCK[1].x, W.DOCK[1].y));
    S(pose(PARK, 2.6));
    S(call(() => { shadows(true); B.phase = 'done'; B.south = false; }));
    return steps;
  }
  function shadows(on) {
    arm.base.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) o.castShadow = on; });
    W.host.markShadows();
  }

  // ---- the effects each frame
  function laserHit(p, on) {
    FX.laser = on ? { at: p.clone() } : null;
    if (on) {
      const last = FX.cutPts[FX.cutPts.length - 1];
      if (!last || last.distanceTo(p) > 0.04) { if (FX.cutPts.length < 64) FX.cutPts.push(p.clone()); }
      FX.cutFade = 1;
      FX.spawn += 0.6; FX.spawnAt = p.clone();
    }
  }
  function stepFx(dt) {
    const night = W.host.night ? W.host.night() : 0;
    let lvl = 0;
    // the beam
    if (FX.laser && arm.tool) {
      const lens = tipNow(), d = FX.laser.at.clone().sub(lens), l = d.length();
      FX.beam.visible = l > 0.01;
      FX.beam.position.copy(lens);
      FX.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      FX.beam.scale.set(1, l, 1);
      lvl = Math.max(lvl, 0.55); FX.lightAt.copy(FX.laser.at); FX.lightCol.setHex(0xffb890);
    } else FX.beam.visible = false;
    // the cut line: drawn while cutting, fading after
    if (FX.cutPts.length > 1 && FX.cutFade > 0) {
      const a = FX.cut.geometry.attributes.position;
      FX.cutPts.forEach((p, i) => a.setXYZ(i, p.x, p.y + 0.004, p.z));
      a.needsUpdate = true; FX.cut.geometry.setDrawRange(0, FX.cutPts.length);
      FX.cut.visible = true;
      if (!FX.laser) FX.cutFade = Math.max(0, FX.cutFade - dt / 1.8);
      FX.cut.material.opacity = FX.cutFade;
      FX.cut.material.color.setRGB(1, 0.45 + 0.35 * FX.cutFade, 0.2 + 0.2 * FX.cutFade);
    } else FX.cut.visible = false;
    // the scan fan
    if (FX.scan && arm.tool) {
      const t = arm.tool; t.updateWorldMatrix(true, false);
      const head = W.root.worldToLocal(new THREE.Vector3(0, 0.12, 0.1).applyMatrix4(t.matrixWorld));
      const p0 = at(-2.55, FX.scan.y, FLOOR_Z + 0.01, new THREE.Vector3()), p1 = at(2.75, FX.scan.y, FLOOR_Z + 0.01, new THREE.Vector3());
      const a = FX.fan.geometry.attributes.position;
      a.setXYZ(0, head.x, head.y, head.z); a.setXYZ(1, p0.x, p0.y, p0.z); a.setXYZ(2, p1.x, p1.y, p1.z); a.needsUpdate = true;
      FX.fan.geometry.computeBoundingSphere();
      const la = FX.scanLine.geometry.attributes.position;
      la.setXYZ(0, p0.x, p0.y, p0.z); la.setXYZ(1, p1.x, p1.y, p1.z); la.needsUpdate = true;
      FX.fan.visible = FX.scanLine.visible = true;
      FX.fan.material.opacity = 0.2 * FX.scan.a; FX.scanLine.material.opacity = 0.9 * FX.scan.a;
      lvl = Math.max(lvl, 0.12 * FX.scan.a); FX.lightAt.copy(head); FX.lightCol.setHex(0xff5040);
    } else FX.fan.visible = FX.scanLine.visible = false;
    // the weld flash
    if (FX.weld > 0 && FX.flashAt) {
      FX.flash.visible = true; FX.flash.position.copy(FX.flashAt);
      const s = 0.12 + 0.22 * FX.weld * (0.8 + 0.4 * Math.random());
      FX.flash.scale.set(s, s, s);
      FX.flash.material.opacity = Math.min(1, FX.weld * 1.4);
      lvl = Math.max(lvl, FX.weld); FX.lightAt.copy(FX.flashAt); FX.lightCol.setHex(0xcfe0ff);
    } else FX.flash.visible = false;
    // sparks
    const sp = FX.sp, pos = FX.sparks.geometry.attributes.position;
    while (FX.spawn >= 1 && FX.spawnAt) {
      FX.spawn -= 1;
      const s = sp.find((o) => o.life <= 0);
      if (!s) break;
      s.p.copy(FX.spawnAt);
      s.v.set((Math.random() - 0.5) * 1.6, 0.4 + Math.random() * 1.1, (Math.random() - 0.5) * 1.6);
      s.life = 0.25 + Math.random() * 0.35;
    }
    let alive = 0;
    sp.forEach((s, i) => {
      if (s.life > 0) {
        s.life -= dt; s.v.y -= 9.8 * dt; s.p.addScaledVector(s.v, dt);
        if (s.p.y < 0.02) { s.p.y = 0.02; s.v.y *= -0.3; s.v.x *= 0.5; s.v.z *= 0.5; }
        alive++;
        pos.setXYZ(i, s.p.x, s.p.y, s.p.z);
      } else pos.setXYZ(i, 0, -50, 0);
    });
    pos.needsUpdate = true;
    FX.sparks.visible = alive > 0;
    if (alive) FX.sparks.geometry.computeBoundingSphere();
    // one small light for all of it: subtle by day, it lights the site at night
    FX.lightLvl += (lvl - FX.lightLvl) * Math.min(1, dt * 30);
    B.light.intensity = FX.lightLvl * (0.25 + 3.2 * night);
    if (FX.lightLvl > 0.01) { B.light.position.copy(FX.lightAt).add(tmp.set(0.3, 0.25, 0)); B.light.color.copy(FX.lightCol); }
    // the falling offcut
    if (B.falling) {
      const f = B.falling;
      f.t = Math.min(1, f.t + dt / 0.55);
      f.o.position.lerpVectors(f.from, f.to, f.t);
      f.o.position.y = f.from.y + (f.to.y - f.from.y) * f.t * f.t + 0.12 * Math.sin(f.t * Math.PI);
      f.o.rotation.set(0, f.spin * f.t, 0);
      if (f.t >= 1) { B.falling = null; W.host.markShadows(); }
    }
  }

  // ---- run
  // FEAT-025d: where the arm may stop for a task: folded and empty-handed, in the front lane or at its dock
  // (not while it carries a panel or works behind the module)
  function breakInfo() {
    const x = arm.base.position.x;
    if (B.carry || !(Math.abs(x - LANE_X) < 0.05 || Math.abs(x - W.DOCK[1].x) < 0.05)) return null;
    return folded(B.q) ? { exit: [], enter: [] } : null;
  }
  function advance(dt) {
    B.clock += dt;
    B.dt = dt;
    if (B.held) return;
    if (B.phase !== 'running' && B.hold) { const r = B.hold; B.hold = null; B.held = true; r(); return; }   // parked: at once
    if (B.phase === 'idle') { B.steps = program(); B.cur = null; B.phase = 'running'; }
    if (B.phase !== 'running') return;
    let left = dt;
    while (left > 0 || (B.cur && B.cur.dur === 0)) {
      if (B.held) break;
      if (!B.cur) {
        if (holdCheck(B, false, breakInfo)) continue;
        if (!B.steps.length) break;
        B.cur = B.steps.shift(); B.cur.t = 0;
        if (B.cur.start) B.cur.start();
        if (B.held) { B.cur = null; break; }
      }
      const c = B.cur;
      if (c.until && !c.until() && holdCheck(B, true, breakInfo)) continue;
      if (c.until && c.until()) c.t = c.dur;
      const need = c.dur - c.t, use = Math.min(left, need);
      c.t += use; left -= use;
      c.update(c.dur > 0 ? Math.min(1, c.t / c.dur) : 1);
      if (c.t >= c.dur - 1e-9) { if (c.end) c.end(); B.cur = null; if (B.phase !== 'running') break; }
      else break;
    }
    B.dt = dt;
  }
  function afterMove() {
    if (B.carry) placeCarry();
    if (B.moved) { A.placeCleats(1, B.track); A.hoseDirty(); B.moved = false; }
    stepFx(B.dt || 0);
  }

  // ---- the start state, restored only while the site is off screen (with the print loop's reset)
  function reset() {
    if (arm.tool) {
      const t = arm.tool, k = t.userData.kind; W.root.attach(t);
      t.position.copy(W.toolHome[k].p); t.quaternion.copy(W.toolHome[k].q);
      t.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      arm.tool = null;
    }
    arm.mount.position.y = 0.09;
    at(W.DOCK[1].x, W.DOCK[1].y, W.DOCK_TOP, arm.base.position); arm.base.rotation.y = -Math.PI / 2;
    setQ(PARK);
    B.tiles.forEach((t) => { t.visible = false; });
    B.offcuts.forEach((o) => { o.visible = false; });
    placeBlanks(BLANK.n);
    restFrame();
    B.carry = null; B.falling = null;
    FX.laser = null; FX.scan = null; FX.weld = 0; FX.cutPts = []; FX.cutFade = 0;
    FX.sp.forEach((s) => { s.life = 0; });
    stepFx(0);
    shadows(true);
    B.south = false; B.task = '';
    B.phase = 'idle';
    B.hold = null; B.held = false;
  }

  placeBlanks(BLANK.n);
  restFrame();
  W.host.markShadows();

  return {
    advance, afterMove, reset,
    done: () => B.phase === 'done',
    inSouth: () => B.south,
    // FEAT-025d: the arm's tasks (newmodule/armtasks.js)
    hold: (ready) => { B.hold = ready; },
    cancelHold: () => { B.hold = null; },
    release: () => { B.held = false; },
    held: () => B.held,
    q: () => ({ ...B.q }),
    get track() { return B.track; },
    moved: () => { B.moved = true; },
    state: () => ({ phase: B.phase, clock: +B.clock.toFixed(1), left: B.steps.length, task: B.task, tool: arm.tool ? arm.tool.userData.kind : null,
      base: [+arm.base.position.x.toFixed(2), +(-arm.base.position.z).toFixed(2)], reach: +B.reach.toFixed(2), blanks: B.blanksLeft,
      tiles: B.tiles.map((t) => (t.visible ? [+t.position.x.toFixed(2), +(-t.position.z).toFixed(2), +t.position.y.toFixed(2)] : null)),
      frame: [+B.frame.position.x.toFixed(2), +(-B.frame.position.z).toFixed(2), +B.frame.position.y.toFixed(2)], south: B.south }),
    BAYS,
  };
}

// a few boxes into one geometry (no index)
function mergeBoxes(gs) {
  const arrs = gs.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0; arrs.forEach((g) => { n += g.attributes.position.count; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  arrs.forEach((g) => { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}
