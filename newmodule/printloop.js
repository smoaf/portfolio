// New module, FEAT-025b: the print arm (arm A) builds the module bay by bay in a loop of about 5 minutes.
//   1. it unplugs from the charging dock, drives to the tool rack and docks the print nozzle
//   2. it drives round the module's open end to the lane behind the module (the material hose from the
//      silo's pump is dragged along behind it, see HOSE)
//   3. it prints the back wall of each of the three open bays (between the four bare ribs), layer by
//      layer from the floor deck up to the roof chamfer, following the module's chamfered profile; the
//      fresh bead glows warm at the nozzle and cools to plaster a short way behind it; the middle bay
//      keeps its window opening free (the second arm cuts it clean and fits the frame, FEAT-025c)
//   4. it drives back round the end and plugs in at the dock again
// The open side of the module (+x, facing the visitors) stays open like the finished bays' cutaway:
// the arm prints the wall you look at through it. No roof: printed without supports.
// It runs only while the site is on screen (from the overview too) and pauses otherwise. After a loop
// the site goes back to the start state only while it is off screen, then the loop starts again, so
// the printed walls never vanish in view.
// Coordinates as in worksite.js: the site frame (z up, the module's long axis along y, the open side +x).
import * as THREE from 'three';

// ---- the module's section (3d/scripts/construction.py, build_station_v4.py P: keep in step)
const Z0 = 4.1;                                             // the module's middle above the ground (lift 2.3 + height/2)
const OUT = { b: 2.9, h: 1.8, ct: 0.55, cb: 0.95 };         // outer body: half width, half height, chamfers
const INN = { b: 2.72, h: 1.62, ct: 0.495, cb: 0.855 };     // inner body (wall 0.18, chamfers × 0.9)
const half = (s, z) => (z > s.h - s.ct ? s.b - (z - (s.h - s.ct)) : z < -s.h + s.cb ? s.b - (-s.h + s.cb - z) : s.b);
const FLOOR = -1.8 + 0.95 * 0.75;                           // floor_z in the module's frame
const WALL_Z0 = FLOOR, WALL_Z1 = 1.8;                       // from the floor deck up to the top of the roof chamfer
const LAYERS = 38, DZ = (WALL_Z1 - WALL_Z0) / LAYERS;
const RIBS = [-4.6, -3.0, -1.4, 0.2], RIB_T = 0.16;
const SEGS = 18;                                            // pieces per layer (the bead appears piece by piece behind the nozzle)
const WINDOW = { bay: 1, w: 0.65, zc: FLOOR + 1.35, h: 0.85 };   // like the other modules' windows (build_station_v4.py)
const BAYS = RIBS.slice(0, -1).map((r, i) => ({ y0: r + RIB_T / 2, y1: RIBS[i + 1] - RIB_T / 2, c: (r + RIBS[i + 1]) / 2 }));

// ---- the routes (site frame): a lane in front of the module (between it and the rack and dock) and one behind it
const FRONT_X = 5.0, BACK_X = -3.75, END_Y = -6.6;
const RACK_STOP = { x: FRONT_X, y: 1.85 };                  // in front of the nozzle's cradle
const SPEED = 1.0, TURN = 1.15;                             // m/s, rad/s
const PRINT_V = 0.74, PRINT_TURN = 0.12;                    // the nozzle along a layer (m/s), the pause at each end (s)
const END = 0.2;                                            // the nozzle turns this far from a rib (the bead still fills up to it)

// the arm (worksite.js: keep in step)
const L1 = 3.0, L2 = 0.3 + 2.4, SH = 1.25, J1Z = 0.12, FLANGE = 0.18 + 0.09;
const TUCK = { j1: 0, j2: -0.2, j3: 2.5, j4: 0, j5: 1.0, j6: 0 };     // travelling: folded, the tool pointing down in front
const PARK = { j1: 0, j2: -0.25, j3: 2.85, j4: 0, j5: 0.54, j6: 0 };
const SIDE = { j1: -Math.PI / 2, j2: -0.35, j3: 2.75, j4: 0, j5: 0.9, j6: 0 };   // folded, turned to the module (in the lane behind it)

const at = (x, y, z, v = new THREE.Vector3()) => v.set(x, z, -y);
const ss = (u) => u * u * (3 - 2 * u);
const KEYS = ['j1', 'j2', 'j3', 'j4', 'j5', 'j6'];
const heading = (hx, hy) => Math.atan2(hx, -hy);           // base.rotation.y facing that site direction

export function createPrintLoop(W) {
  // W: the worksite's state (root, arms, tools, hose, mats, host, at, DOCK, DOCK_TOP, RACK, TOOL_LEN)
  const arm = W.arms[0];
  const P = {
    clock: 0, phase: 'idle', steps: [], cur: null, done: 0, q: { ...PARK }, baseH: 0,
    walls: [], bay: -1, layer: -1, hoseDirty: false, light: null, glowTip: null,
    frustum: new THREE.Frustum(), m4: new THREE.Matrix4(), sphere: new THREE.Sphere(), onScreen: false,
    track: [0, 0], cleats: [],
  };
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

  // ---- the printed walls: one mesh per bay, its pieces in print order, shown with the draw range
  const wallMat = W.mats.plaster.clone();
  wallMat.name = 'plaster';
  const uNow = { value: 0 };
  wallMat.onBeforeCompile = (sh) => {
    sh.uniforms.uNow = uNow;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aBirth;\nuniform float uNow;\nvarying float vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = exp(-max(uNow - aBirth, 0.0) / 1.1);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.42, 0.12) * vGlow * 2.2;');
  };
  wallMat.customProgramCacheKey = () => 'printwall';

  function buildWall(bi) {
    const bay = BAYS[bi], pos = [], order = [];
    const seg = (bay.y1 - bay.y0) / SEGS;
    for (let L = 0; L < LAYERS; L++) {
      const za = WALL_Z0 + L * DZ, zb = za + DZ;
      const ks = [...Array(SEGS).keys()];
      if (L % 2) ks.reverse();
      for (const k of ks) {
        const ya = bay.y0 + k * seg, yb = ya + seg;
        if (bi === WINDOW.bay) {                              // the window opening stays free
          const yc = (ya + yb) / 2, zc = (za + zb) / 2;
          if (Math.abs(yc - bay.c) < WINDOW.w / 2 && Math.abs(zc - WINDOW.zc) < WINDOW.h / 2) continue;
        }
        piece(pos, ya, yb, za, zb);
        order.push({ L, k, y: (ya + yb) / 2 });
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    const birth = new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3).fill(-1e4), 1);
    birth.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aBirth', birth);
    g.setDrawRange(0, 0);
    const m = new THREE.Mesh(g, wallMat);
    m.name = 'futureworksite_wall' + bi;
    m.castShadow = true; m.receiveShadow = true;
    m.frustumCulled = false;                                   // its bounds are the whole wall; drawn with the site anyway
    W.root.add(m);
    return { mesh: m, order, shown: 0, seg };
  }
  // one piece of the back wall (site x < 0): the section between the inner and the outer profile, from za to zb
  function piece(out, ya, yb, za, zb) {
    const c = [
      [-half(OUT, za), za], [-half(INN, za), za], [-half(INN, zb), zb], [-half(OUT, zb), zb],
    ];
    const v = (i, y) => { at(c[i][0], y, Z0 + c[i][1], tmp); return [tmp.x, tmp.y, tmp.z]; };
    const quad = (a, b, cc, d) => out.push(...a, ...b, ...cc, ...a, ...cc, ...d);
    const A = [0, 1, 2, 3].map((i) => v(i, ya)), B = [0, 1, 2, 3].map((i) => v(i, yb));
    quad(A[0], A[1], A[2], A[3]); quad(B[3], B[2], B[1], B[0]);    // the two ends
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad(A[j], A[i], B[i], B[j]); }   // the four sides
  }

  // ---- the tracks' cleats: small plaster bars running round each track as the base drives
  const PER = 2 * 1.28 + 2 * Math.PI * 0.21, NCL = 14;
  function buildCleats(a) {
    const geo = new THREE.BoxGeometry(0.27, 0.03, 0.07);
    const im = new THREE.InstancedMesh(geo, W.mats.plaster, 2 * NCL);
    im.name = 'futureworksite_cleats_' + a.id;
    im.castShadow = false; im.receiveShadow = true;
    im.frustumCulled = false;
    a.base.add(im);
    return im;
  }
  const dummy = new THREE.Object3D();
  function trackPoint(s, out) {                               // a point on the track's loop at arc length s: (z, y, angle)
    const a = 0.64, r = 0.21 + 0.012, top = 1.28;
    s = ((s % PER) + PER) % PER;
    if (s < top) return out.set(a - s, 0.21 + r, 0);                                   // along the top, backwards
    s -= top;
    if (s < Math.PI * 0.21) { const t = s / 0.21; return out.set(-a - Math.sin(t) * r, 0.21 + Math.cos(t) * r, t); }
    s -= Math.PI * 0.21;
    if (s < top) return out.set(-a + s, 0.21 - r, Math.PI);                             // along the bottom, forwards
    s -= top;
    const t = s / 0.21;
    return out.set(a + Math.sin(t) * r, 0.21 - Math.cos(t) * r, Math.PI + t);
  }
  function placeCleats(im, track) {
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < NCL; i++) {
        trackPoint(track[side] + i * PER / NCL, tmp2);
        dummy.position.set(side ? 0.55 : -0.55, tmp2.y, tmp2.x);
        dummy.rotation.set(-tmp2.z, 0, 0);
        dummy.updateMatrix();
        im.setMatrixAt(side * NCL + i, dummy.matrix);
      }
    }
    im.instanceMatrix.needsUpdate = true;
  }

  // ---- the hose: a chain lying on the ground, the pump's end fixed, the other end on the arm; when
  // the arm pulls, the chain follows it (the slack stays where it lies), kept out of the equipment
  const HOSE = { n: 48, pts: [], rest: 0, init: [], segs: 160, rad: 8, r: 0.055 };
  const KEEP_OUT = [                                          // site frame circles: x, y, r
    [-6.4, -3.0, 1.0], [-5.85, -3.0, 0.45], [-6.07, -0.67, 0.85], [-5.0, 1.45, 0.75], [-5.5, 3.0, 1.0], [-5.5, 4.8, 1.0],
    [6.78, 1.6, 0.6], [6.78, 2.6, 0.6], [6.78, 3.6, 0.6], [6.78, 4.6, 0.6], [9.0, -2.55, 0.3], [9.0, 0.25, 0.3],
    [9.35, -2.0, 0.45], [8.8, 1.55, 0.55], [6.6, -8.0, 0.45],
    [-2.15, -3.1, 0.35], [2.15, -3.1, 0.35], [-2.15, 3.1, 0.35], [2.15, 3.1, 0.35],
  ];
  function setupHose() {
    const old = W.hose;
    const curve = old.userData.curve;
    HOSE.init = curve.getSpacedPoints(HOSE.n - 1).map((p) => p.clone());
    HOSE.pts = HOSE.init.map((p) => p.clone());
    HOSE.rest = curve.getLength() / (HOSE.n - 1);
    // the tube, updated in place
    const S = HOSE.segs, R = HOSE.rad;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((S + 1) * (R + 1) * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array((S + 1) * (R + 1) * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < S; i++) for (let j = 0; j < R; j++) {
      const a = i * (R + 1) + j, b = (i + 1) * (R + 1) + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    g.setIndex(idx);
    HOSE.geo = g;
    HOSE.curve = new THREE.CatmullRomCurve3(HOSE.pts, false, 'centripetal');
    HOSE.oldGeo = old.geometry;
  }
  const hp = [], tg = new THREE.Vector3(), nm = new THREE.Vector3(), bn = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  function drawHose() {
    const S = HOSE.segs, R = HOSE.rad, pos = HOSE.geo.attributes.position.array, nor = HOSE.geo.attributes.normal.array;
    HOSE.curve.points = HOSE.pts;
    for (let i = 0; i <= S; i++) {
      const u = i / S;
      HOSE.curve.getPoint(u, tmp);
      HOSE.curve.getTangent(u, tg).normalize();
      nm.crossVectors(tg, up);
      if (nm.lengthSq() < 1e-4) nm.set(1, 0, 0); else nm.normalize();
      bn.crossVectors(nm, tg).normalize();
      for (let j = 0; j <= R; j++) {
        const a = j / R * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a);
        const k = (i * (R + 1) + j) * 3;
        const nx = nm.x * cs + bn.x * sn, ny = nm.y * cs + bn.y * sn, nz = nm.z * cs + bn.z * sn;
        pos[k] = tmp.x + HOSE.r * nx; pos[k + 1] = tmp.y + HOSE.r * ny; pos[k + 2] = tmp.z + HOSE.r * nz;
        nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz;
      }
    }
    HOSE.geo.attributes.position.needsUpdate = true; HOSE.geo.attributes.normal.needsUpdate = true;
    HOSE.geo.computeBoundingSphere();
    if (W.hose.geometry !== HOSE.geo) W.hose.geometry = HOSE.geo;
  }
  function portAt(out) { arm.base.updateMatrix(); return out.set(0, 0.7, -0.85).applyMatrix4(arm.base.matrix); }   // root frame
  function pullHose() {
    const p = HOSE.pts, n = p.length, rest = HOSE.rest, g = 0.06;
    portAt(p[n - 1]);
    // from the arm back towards the pump: a piece only moves when it is pulled
    for (let i = n - 2; i >= 2; i--) {
      const d = tmp.subVectors(p[i], p[i + 1]); d.y = 0;
      const len = d.length();
      if (len > rest) { d.multiplyScalar(rest / len); p[i].x = p[i + 1].x + d.x; p[i].z = p[i + 1].z + d.z; }
      p[i].y = g;
      for (const [cx, cy, r] of KEEP_OUT) {                 // never across the equipment: pushed out sideways
        const dx = p[i].x - cx, dz = p[i].z + cy, l = Math.hypot(dx, dz);
        if (l < r) { const s = r / Math.max(l, 1e-3); p[i].x = cx + dx * s; p[i].z = -cy + dz * s; }
      }
    }
  }

  // ---- inverse kinematics: the tool's tip at a point (root frame), the tool tilted by tau from straight down,
  // tilted away from the arm; len: from the wrist joint to the tip
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
    P.reach = Math.hypot(wr, wh);
    return q;
  }
  const setQ = (q) => { for (const k of KEYS) P.q[k] = q[k]; arm.set(P.q); };

  // ---- the program: a list of steps, each with a duration; made at the loop's start
  const site = (x, y) => at(x, y, 0, new THREE.Vector3());
  const toolTipLen = () => FLANGE + (arm.tool ? W.TOOL_LEN[arm.tool.userData.kind] : 0);
  function baseHeight(x) { return x > W.DOCK[0].x - 1.4 ? W.DOCK_TOP : 0; }   // on the dock's slab or on the ground
  const mk = (dur, update, start, end) => ({ dur, update, start, end });
  function pose(target, dur) {
    let from, q;
    return mk(dur, (u) => { const e = ss(u), o = {}; for (const k of KEYS) o[k] = from[k] + (q[k] - from[k]) * e; setQ(o); },
      () => { from = { ...P.q }; q = { ...(typeof target === 'function' ? target() : target) }; });
  }
  function turnTo(hx, hy) {
    let from, to, last = 0;
    const s = mk(1, (u) => {
      const e = ss(u), ry = from + (to - from) * e;
      const d = (ry - last); last = ry;
      arm.base.rotation.y = ry;
      P.track[0] += d * 0.55; P.track[1] -= d * 0.55;          // turning on the spot: the tracks run opposite ways
      P.hoseDirty = true;
    }, () => {
      from = arm.base.rotation.y; to = heading(hx, hy);
      while (to - from > Math.PI) to -= 2 * Math.PI;
      while (to - from < -Math.PI) to += 2 * Math.PI;
      last = from;
      s.dur = Math.max(0.4, Math.abs(to - from) / TURN + 0.3);
    });
    return s;
  }
  function drive(x, y, reverse = false) {
    let fx, fy, dist, done = 0;
    const s = mk(1, (u) => {
      const e = ss(u), cx = fx + (x - fx) * e, cy = fy + (y - fy) * e;
      at(cx, cy, baseHeight(cx), arm.base.position);
      const d = e * dist - done; done = e * dist;
      const sg = reverse ? -1 : 1;
      P.track[0] += d * sg; P.track[1] += d * sg;
      P.hoseDirty = true;
    }, () => {
      const p = arm.base.position; fx = p.x; fy = -p.z; dist = Math.hypot(x - fx, y - fy); done = 0;
      s.dur = Math.max(0.3, dist / SPEED + 0.9);
    });
    return s;
  }
  function tipMove(from, to, tau, dur, lenFn = toolTipLen) {   // the tool's tip in a straight line (root-frame points or functions)
    let a, b;
    return mk(dur, (u) => { const e = ss(u); tmp2.lerpVectors(a, b, e); setQ(solve(tmp2, tau, lenFn())); },
      () => { a = (typeof from === 'function' ? from() : from).clone(); b = (typeof to === 'function' ? to() : to).clone(); });
  }
  const call = (fn) => mk(0, () => {}, fn);
  
  // where the tool's tip is now (root frame)
  function tipNow(len) {
    arm.mount.updateWorldMatrix(true, false);
    const v = new THREE.Vector3(0, len - FLANGE, 0).applyMatrix4(arm.mount.matrixWorld);
    return W.root.worldToLocal(v);
  }
  // the nozzle's tip on a layer: on top of layer L at site y
  function layerTip(L, y, out = new THREE.Vector3()) {
    const z = WALL_Z0 + (L + 1) * DZ;
    const x = -(half(OUT, z) + half(INN, z)) / 2;
    return at(x, y, Z0 + z + 0.012, out);
  }
  // the nozzle's tilt: low down it leans in over the wall (the elbow stays clear of the silo), high up it
  // leans out (the arm stays outside the fresh wall)
  const tauAt = (L) => { const v = Math.max(0, (L / (LAYERS - 1) - 0.35) / 0.65); return -0.45 + 1.65 * Math.pow(v, 1.2); };

  function printBay(bi) {
    const bay = BAYS[bi], w = P.walls[bi], len = bay.y1 - bay.y0 - 2 * END;
    const tLayer = len / PRINT_V + PRINT_TURN;
    const y0 = bay.y0 + END, y1 = bay.y1 - END;
    const p = new THREE.Vector3();
    return mk(LAYERS * tLayer, (u) => {
      const t = u * LAYERS * tLayer;
      const L = Math.min(LAYERS - 1, Math.floor(t / tLayer));
      const f = Math.min(1, (t - L * tLayer) / (len / PRINT_V));
      const y = L % 2 ? y1 + (y0 - y1) * f : y0 + (y1 - y0) * f;
      layerTip(L, y, p);
      const yb = L % 2 ? bay.y1 + (bay.y0 - bay.y1) * f : bay.y0 + (bay.y1 - bay.y0) * f;   // the bead reaches the ribs
      setQ(solve(p, tauAt(L), toolTipLen()));
      P.bay = bi; P.layer = L;
      reveal(w, L, yb, u >= 1);
    }, () => { P.bay = bi; P.layer = 0; P.extruding = true; }, () => { P.extruding = false; finishWall(w); });
  }
  function reveal(w, L, y, all) {
    let n = w.shown;
    const o = w.order;
    while (n < o.length && (all || o[n].L < L || (o[n].L === L && (L % 2 ? o[n].y + w.seg / 2 >= y : o[n].y - w.seg / 2 <= y)))) n++;
    if (n === w.shown) return;
    const b = w.mesh.geometry.attributes.aBirth;
    for (let i = w.shown * 36; i < n * 36; i++) b.array[i] = P.clock;
    b.addUpdateRange(w.shown * 36, (n - w.shown) * 36);
    b.needsUpdate = true;
    w.shown = n;
    w.mesh.geometry.setDrawRange(0, n * 36);
  }
  function finishWall(w) { reveal(w, LAYERS, 0, true); W.host.markShadows(); }

  function program() {
    const steps = [];
    const plate = () => { const t = W.tools.nozzle; t.updateWorldMatrix(true, false); return W.root.worldToLocal(t.getWorldPosition(new THREE.Vector3())); };
    const flangeLen = () => FLANGE;
    const above = (fn, dy, dx = 0) => () => { const v = fn().clone(); v.y += dy; v.x += dx; return v; };
    steps.push(call(() => { shadows(false); }));
    steps.push(pose(TUCK, 2.6));                                         // unplug, fold up for the drive
    steps.push(drive(FRONT_X, W.DOCK[0].y));
    steps.push(turnTo(0, 1));
    steps.push(drive(RACK_STOP.x, RACK_STOP.y));
    steps.push(turnTo(1, 0));
    // the print nozzle from its cradle: over it, down onto its plate, click in, lift it out
    steps.push(pose(() => solve(above(plate, 0.35)(), 0, flangeLen()), 2.2));
    steps.push(tipMove(above(plate, 0.35), plate, 0, 1.0, flangeLen));
    steps.push(call(() => attachTool()));
    steps.push(mk(0.5, (u) => { const t = arm.tool; t.position.multiplyScalar(1 - u); t.quaternion.slerp(new THREE.Quaternion(), u); }));
    steps.push(tipMove(() => tipNow(FLANGE), above(() => tipNow(FLANGE), 0.4), 0, 1.0, flangeLen));
    steps.push(pose(TUCK, 2.2));
    // round the module's open end to the lane behind it
    steps.push(turnTo(0, -1));
    steps.push(drive(FRONT_X, END_Y));
    steps.push(turnTo(-1, 0));
    steps.push(drive(BACK_X, END_Y));
    steps.push(turnTo(0, 1));
    BAYS.forEach((bay, bi) => {
      steps.push(drive(BACK_X, bay.c - J1Z));                        // the shoulder level with the bay's middle
      steps.push(pose(SIDE, 1.8));
      steps.push(pose(() => solve(above(() => layerTip(0, bay.y0 + END), 0.4)(), tauAt(0), toolTipLen()), 2.6));
      steps.push(tipMove(above(() => layerTip(0, bay.y0 + END), 0.4), () => layerTip(0, bay.y0 + END), tauAt(0), 0.8));
      steps.push(printBay(bi));
      // up off the wall, out over the lane, turn along it, then fold (never back down through the module)
      steps.push(tipMove(() => tipNow(toolTipLen()), above(() => tipNow(toolTipLen()), 0.4), tauAt(LAYERS - 1), 0.7));
      steps.push(tipMove(() => tipNow(toolTipLen()), () => at(-3.4, bay.c, Z0 + WALL_Z1 + 0.5, new THREE.Vector3()), tauAt(LAYERS - 1), 1.4));
      steps.push(pose(() => ({ ...P.q, j1: 0 }), 1.4));               // high up the arm turns along the lane
      steps.push(pose(TUCK, 2.4));
    });
    // back to the dock and plug in
    steps.push(turnTo(0, -1));
    steps.push(drive(BACK_X, END_Y));
    steps.push(turnTo(1, 0));
    steps.push(drive(FRONT_X, END_Y));
    steps.push(turnTo(0, 1));
    steps.push(drive(FRONT_X, W.DOCK[0].y));
    steps.push(turnTo(-1, 0));
    steps.push(drive(W.DOCK[0].x, W.DOCK[0].y, true));
    steps.push(pose(PARK, 2.6));
    steps.push(call(() => { shadows(true); P.phase = 'done'; }));
    return steps;
  }
  function attachTool() {
    const t = W.tools.nozzle;
    arm.mount.attach(t);
    arm.tool = t;
    t.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  }
  function shadows(on) {
    arm.base.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) o.castShadow = on; });
    W.hose.castShadow = on;
    W.host.markShadows();
  }

  // ---- the start state (the site as FEAT-025a left it), restored only while the site is off screen
  function reset() {
    P.walls.forEach((w) => {
      w.shown = 0; w.mesh.geometry.setDrawRange(0, 0);
      const b = w.mesh.geometry.attributes.aBirth; b.array.fill(-1e4); b.clearUpdateRanges(); b.needsUpdate = true;
    });
    if (arm.tool) {                                           // the nozzle back in its cradle
      const t = arm.tool; W.root.attach(t);
      t.position.copy(W.toolHome.nozzle.p); t.quaternion.copy(W.toolHome.nozzle.q);
      t.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      arm.tool = null;
    }
    at(W.DOCK[0].x, W.DOCK[0].y, W.DOCK_TOP, arm.base.position); arm.base.rotation.y = -Math.PI / 2;
    setQ(PARK);
    HOSE.pts.forEach((p, i) => p.copy(HOSE.init[i]));
    W.hose.geometry = HOSE.oldGeo;
    shadows(true);
    P.bay = -1; P.layer = -1; P.extruding = false;
    P.phase = 'idle';
  }

  function onScreen() {
    const cam = W.host.camera;
    if (!cam) return true;
    P.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    P.frustum.setFromProjectionMatrix(P.m4);
    W.root.localToWorld(P.sphere.center.set(0, 3, 0));
    P.sphere.radius = 8.5;
    return P.frustum.intersectsSphere(P.sphere);
  }

  function advance(dt) {
    P.clock += dt; uNow.value = P.clock;
    if (P.phase === 'idle') { P.steps = program(); P.cur = null; P.phase = 'running'; }
    if (P.phase !== 'running') return;
    let left = dt;
    while (left > 0 || (P.cur && P.cur.dur === 0)) {
      if (!P.cur) {
        if (!P.steps.length) break;
        P.cur = P.steps.shift(); P.cur.t = 0;
        if (P.cur.start) P.cur.start();
      }
      const c = P.cur, need = c.dur - c.t, use = Math.min(left, need);
      c.t += use; left -= use;
      c.update(c.dur > 0 ? Math.min(1, c.t / c.dur) : 1);
      if (c.t >= c.dur - 1e-9) { if (c.end) c.end(); P.cur = null; if (P.phase !== 'running') break; }
      else break;
    }
  }

  function step(now) {
    const dt = P.last ? Math.min(0.05, Math.max(0, (now - P.last) / 1000)) : 0;
    P.last = now;
    P.onScreen = onScreen();
    if (!P.onScreen) {
      if (P.phase === 'done') reset();                        // the walls go only while nobody sees them
      return;
    }
    advance(dt);
    afterMove();
  }
  function afterMove() {
    if (P.hoseDirty) { pullHose(); drawHose(); P.hoseDirty = false; }
    placeCleats(P.cleats[0], P.track);
    // the glow at the nozzle: a small warm light (night) and a glowing tip
    const glow = P.extruding ? 1 : 0;
    if (P.glowTip) {
      P.glowTip.visible = glow > 0;
      if (glow) { P.glowTip.position.copy(tipNow(toolTipLen())); }
    }
    if (P.light) {
      const night = W.host.night ? W.host.night() : 0;
      P.light.intensity = glow * (0.35 + 2.6 * night);
      if (glow) P.light.position.copy(P.glowTip.position).add(tmp.set(0.25, 0.15, 0));
    }
  }

  // ---- set up
  P.walls = BAYS.map((_, i) => buildWall(i));
  P.cleats = W.arms.map((a) => buildCleats(a));
  W.arms.forEach((a, i) => placeCleats(P.cleats[i], [0, 0]));
  setupHose();
  // the glowing nozzle tip and its light (in the scene from the start, so no shader changes later)
  const tipGeo = new THREE.SphereGeometry(0.035, 10, 8);
  P.glowTip = new THREE.Mesh(tipGeo, new THREE.MeshBasicMaterial({ color: 0xffb070 }));
  P.glowTip.name = 'futureworksite_nozzleglow'; P.glowTip.visible = false;
  W.root.add(P.glowTip);
  P.light = new THREE.PointLight(0xffa060, 0, 7, 2);
  P.light.name = 'futureworksite_printlight';
  W.root.add(P.light);

  return {
    step,
    // tests: run the loop forward by sec seconds (as if on screen), and the state
    run(sec, dt = 1 / 30) { for (let t = 0; t < sec; t += dt) { if (P.phase === 'done') break; advance(dt); afterMove(); } return this.state(); },
    reset,
    state: () => ({ phase: P.phase, clock: +P.clock.toFixed(1), left: P.steps.length, bay: P.bay, layer: P.layer, onScreen: P.onScreen,
      shown: P.walls.map((w) => `${w.shown}/${w.order.length}`), tool: arm.tool ? arm.tool.userData.kind : null, extruding: !!P.extruding,
      base: [+arm.base.position.x.toFixed(2), +(-arm.base.position.z).toFixed(2)], reach: P.reach ? +P.reach.toFixed(2) : null }),
    get walls() { return P.walls; }, BAYS, solve, half: (z) => [half(OUT, z), half(INN, z)], Z0, RIBS,
  };
}
