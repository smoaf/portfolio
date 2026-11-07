// New module worksite (FEAT-025a): two robot arms will build the module instead of scaffolds.
// This part sets the site up; the print arm's loop (FEAT-025b) is in printloop.js; the second
// arm's work (FEAT-025c) in fitarm.js; clicking an arm gives it a task (FEAT-025d, armtasks.js).
//   - the fixed equipment is in the station model (3d/scripts/construction.py, worksite_equipment):
//     tool rack, material silo and drums, offcuts by the panel stacks, charging dock with two spots,
//     cable reel and control console
//   - built here, so the later parts can move them: two slim 6-axis arms, each on its own small
//     tracked base, parked at the dock on the open side facing the module; the four spare tool heads
//     in the rack's cradles (print nozzle, laser cutter, gripper with a small scanning head, spot
//     welder); the material hose from the silo's pump behind the module, lying in loose loops round
//     the module's open end to the print arm (long enough to follow the arm along the whole module)
//   - each arm is an articulated rig: base → j1 (turn, y) → j2 (shoulder, x) → j3 (elbow, x) →
//     j4 (forearm roll, y) → j5 (wrist, x) → j6 (flange roll, y) → mount (where a tool head docks).
//     Upper arm 3.0 m, forearm 2.7 m, wrist and tool ~0.5 m: about 6 m of reach from the shoulder,
//     enough to reach the module's roof (5.9 m) from the ground without a lifting column.
//   - plaster model style: the station's own plaster and black linework materials (plaster links,
//     black joints, tracks and steel tool heads), no colours, no names or logos; most parts are one
//     mesh, so both arms, the four heads and the hose cost 23 draw calls
// Coordinates: the site's frame from the model (z up, long axis along y, the finished end at +y,
// the open side at +x), placed like the model does it (turned 30°, see SITE).
// The area pattern: setup(host), step(now).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createPrintLoop } from './printloop.js';
import { createFitLoop } from './fitarm.js';
import { createArmTasks } from './armtasks.js';

// where the model puts the site (3d/scripts/arrangement_v5.py: rot = phi + 90°, d_fut along phi)
const SITE = { x: -6.777112, y: -27.839059, rot: Math.PI / 6 };
// from construction.py (keep in step): the dock's two spots and the rack's four cradles, site frame
// (both on the open side, +x; the arms face the module, -x)
const DOCK = [{ x: 7.7, y: -3.4 }, { x: 7.7, y: -0.6 }];
const DOCK_TOP = 0.08;
const RACK = { x: 6.78, top: 1.15, slots: [1.85, 2.683, 3.517, 4.35] };
const PUMP = { x: -5.55, y: -3.0, z: 0.3 };               // the silo's feed pump outlet, behind the module

// the arm's measures (metres)
const SHOULDER = 1.25, UPPER = 3.0, FORE0 = 0.3, FORE = 2.4, WRIST = 0.18;
// parked: upper arm leaning back a little, forearm folded down in front, the flange pointing at the deck
const PARK = { j1: 0, j2: -0.25, j3: 2.85, j4: 0, j5: 0.54, j6: 0 };

const S = { host: null, ready: false, root: null, arms: [], tools: {}, hose: null, mats: null, loop: null, fit: null, tasks: null };

// ---- small helpers
const tr = (g, x, y, z) => { g.translate(x, y, z); return g; };
const boxG = (w, h, d, x = 0, y = 0, z = 0) => tr(new THREE.BoxGeometry(w, h, d), x, y, z);
const cylY = (r0, r1, h, x = 0, y = 0, z = 0, n = 20) => tr(new THREE.CylinderGeometry(r0, r1, h, n), x, y, z);
const cylX = (r, h, x = 0, y = 0, z = 0, n = 20) => { const g = new THREE.CylinderGeometry(r, r, h, n); g.rotateZ(Math.PI / 2); return tr(g, x, y, z); };
const cylZ = (r, h, x = 0, y = 0, z = 0, n = 20) => { const g = new THREE.CylinderGeometry(r, r, h, n); g.rotateX(Math.PI / 2); return tr(g, x, y, z); };
const flat = (gs) => mergeGeometries(gs.map((g) => (g.index ? g.toNonIndexed() : g)));
// a site point (z up) in the root's frame (y up)
const at = (x, y, z, v = new THREE.Vector3()) => v.set(x, z, -y);

// one part of a rig: its plaster and its linework merged into (at most) two meshes
function part(name, plaster, line) {
  const g = new THREE.Group(); g.name = name;
  if (plaster.length) g.add(mesh(name + '_body', flat(plaster), S.mats.plaster));
  if (line.length) g.add(mesh(name + '_steel', flat(line), S.mats.line));
  return g;
}
function mesh(name, geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.name = 'futureworksite_' + name;                     // 'future…' belongs to the New module place
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// ---- the tracked base (forward is +z)
function trackShape(len, h) {
  const s = new THREE.Shape(), r = h / 2, a = len / 2 - r;
  s.moveTo(-a, -r); s.lineTo(a, -r); s.absarc(a, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-a, r); s.absarc(-a, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  return s;
}
function buildBase() {
  const pl = [], ln = [];
  for (const sx of [-1, 1]) {
    const t = new THREE.ExtrudeGeometry(trackShape(1.7, 0.42), { depth: 0.26, bevelEnabled: false, curveSegments: 10 });
    t.rotateY(-Math.PI / 2);                             // the profile in (z, y), the width along x
    ln.push(tr(t, sx * 0.42 + (sx > 0 ? 0.26 : 0), 0.21, 0));
    for (const z of [-0.64, -0.21, 0.21, 0.64]) pl.push(cylX(z === -0.64 || z === 0.64 ? 0.15 : 0.1, 0.02, sx * 0.69, 0.21, z, 16));   // the wheels on the outside
  }
  pl.push(boxG(0.66, 0.26, 1.4, 0, 0.42, 0));            // the chassis between the tracks
  pl.push(boxG(0.9, 0.08, 1.5, 0, 0.58, 0));             // its deck
  pl.push(boxG(0.7, 0.22, 0.36, 0, 0.73, -0.52));        // the battery pack at the back
  ln.push(cylZ(0.06, 0.12, 0.2, 0.7, -0.75, 12));         // the hose port
  ln.push(boxG(0.92, 0.02, 0.02, 0, 0.62, 0.75));         // the deck's front edge
  ln.push(cylY(0.38, 0.38, 0.04, 0, 0.64, 0.12, 32));     // the turn ring
  return part('base', pl, ln);
}
// ---- the arm's joints and links (each joint housing is black, each link plaster)
function buildArm(id) {
  const base = buildBase();
  const j1 = new THREE.Group(); j1.position.set(0, 0.66, 0.12); base.add(j1);
  j1.add(part(id + '_turret', [cylY(0.34, 0.36, 0.2, 0, 0.1, 0, 28), boxG(0.42, 0.5, 0.4, 0, 0.44, 0)],
    [cylY(0.345, 0.345, 0.03, 0, 0.2, 0, 28), cylX(0.21, 0.56, 0, SHOULDER - 0.66, 0, 24)]));
  const j2 = new THREE.Group(); j2.position.set(0, SHOULDER - 0.66, 0); j1.add(j2);
  // a housing that only turns about its own axis sits in the next joint's mesh, so most links are
  // one mesh: plaster links, black joints (fewer draw calls, the same look)
  j2.add(part(id + '_upper', [cylY(0.1, 0.14, UPPER - 0.42, 0, UPPER / 2, 0, 20), cylX(0.17, 0.44, 0, 0, 0, 24)], []));
  const j3 = new THREE.Group(); j3.position.set(0, UPPER, 0); j2.add(j3);
  j3.add(part(id + '_elbow', [], [cylX(0.16, 0.4, 0, 0, 0, 24), cylY(0.105, 0.105, FORE0, 0, FORE0 / 2, 0, 20), cylY(0.112, 0.112, 0.04, 0, FORE0, 0, 20)]));
  const j4 = new THREE.Group(); j4.position.set(0, FORE0, 0); j3.add(j4);
  j4.add(part(id + '_fore', [cylY(0.07, 0.1, FORE - 0.16, 0, (FORE - 0.16) / 2 + 0.03, 0, 18)], []));
  const j5 = new THREE.Group(); j5.position.set(0, FORE, 0); j4.add(j5);
  j5.add(part(id + '_wrist', [], [cylX(0.095, 0.26, 0, 0, 0, 18), cylY(0.06, 0.065, WRIST, 0, WRIST / 2, 0, 16)]));
  const j6 = new THREE.Group(); j6.position.set(0, WRIST, 0); j5.add(j6);
  j6.add(part(id + '_flange', [], [cylY(0.075, 0.075, 0.04, 0, 0.02, 0, 20), cylY(0.1, 0.1, 0.05, 0, 0.065, 0, 20)]));
  const mount = new THREE.Group(); mount.name = id + '_mount'; mount.position.set(0, 0.09, 0); j6.add(mount);   // a tool head docks here
  const joints = { j1, j2, j3, j4, j5, j6 };
  const set = (q) => {                                    // a pose: the six joint angles (radians)
    j1.rotation.y = q.j1; j2.rotation.x = q.j2; j3.rotation.x = q.j3;
    j4.rotation.y = q.j4; j5.rotation.x = q.j5; j6.rotation.y = q.j6;
  };
  return { id, base, joints, mount, set, tool: null };
}

// ---- the tool heads: the mount plate at the origin, the tool pointing along +y
function plate(pl, ln) { pl.push(cylY(0.1, 0.1, 0.05, 0, 0.025, 0, 20)); ln.push(cylY(0.08, 0.08, 0.02, 0, 0.06, 0, 20)); }
const TOOLS = {
  nozzle(pl, ln) {                                        // print nozzle: a heated barrel, a cone, the feed fitting at its side
    plate(pl, ln);
    pl.push(cylY(0.08, 0.08, 0.26, 0, 0.2, 0, 20));
    ln.push(cylY(0.085, 0.085, 0.02, 0, 0.13, 0, 20), cylY(0.085, 0.085, 0.02, 0, 0.27, 0, 20));
    ln.push(tr(new THREE.ConeGeometry(0.06, 0.16, 16).rotateX(Math.PI), 0, 0.41, 0));
    ln.push(cylX(0.03, 0.12, 0.12, 0.2, 0, 10));
  },
  laser(pl, ln) {                                          // laser cutter: a slim head, a focusing tube, its lens
    plate(pl, ln);
    pl.push(boxG(0.14, 0.24, 0.12, 0, 0.18, 0));
    pl.push(cylY(0.035, 0.045, 0.2, 0, 0.4, 0, 16));
    ln.push(cylY(0.03, 0.03, 0.02, 0, 0.51, 0, 16), boxG(0.145, 0.02, 0.125, 0, 0.12, 0));
  },
  gripper(pl, ln) {                                        // gripper: a palm, two parallel fingers; the small scanning head on its side
    plate(pl, ln);
    pl.push(boxG(0.22, 0.1, 0.1, 0, 0.12, 0));
    for (const sx of [-1, 1]) pl.push(boxG(0.035, 0.2, 0.07, sx * 0.08, 0.27, 0));
    ln.push(boxG(0.24, 0.015, 0.02, 0, 0.17, 0));
    pl.push(boxG(0.1, 0.07, 0.07, 0, 0.12, 0.1));          // the scanning head
    ln.push(cylZ(0.016, 0.01, -0.025, 0.12, 0.137, 10), cylZ(0.016, 0.01, 0.025, 0.12, 0.137, 10));   // its two lenses
  },
  welder(pl, ln) {                                         // spot welder: a C-shaped yoke with two electrodes facing each other
    plate(pl, ln);
    pl.push(boxG(0.14, 0.12, 0.14, 0, 0.12, 0));
    ln.push(boxG(0.04, 0.34, 0.04, 0, 0.33, -0.12));       // the yoke's back
    ln.push(boxG(0.04, 0.04, 0.16, 0, 0.18, -0.06), boxG(0.04, 0.04, 0.16, 0, 0.48, -0.06));
    pl.push(cylY(0.018, 0.018, 0.08, 0, 0.24, 0, 10), cylY(0.018, 0.018, 0.08, 0, 0.42, 0, 10));   // the electrodes
  },
};
const TOOL_LEN = { nozzle: 0.49, laser: 0.52, gripper: 0.37, welder: 0.5 };
function buildTool(kind) {
  const pl = [], ln = [];
  TOOLS[kind](pl, ln);
  const g = part('tool_' + kind, [], [...pl, ...ln]);      // a steel tool head: one black linework mesh
  g.userData.kind = kind;
  return g;
}

// ---- the hose: from the silo's pump behind the module, round its open end, to the print arm's port
function buildHose(arm) {
  arm.base.updateMatrixWorld(true);
  const port = arm.base.localToWorld(new THREE.Vector3(0, 0.7, -0.85));
  S.root.worldToLocal(port);
  const g = 0.06;                                          // lying on the ground (its radius)
  const pts = [
    at(PUMP.x, PUMP.y, PUMP.z), at(PUMP.x + 0.35, PUMP.y - 0.3, g), at(-5.0, -4.6, g), at(-4.6, -6.0, g),
    at(-2.8, -6.6, g), at(-0.4, -6.3, g), at(1.8, -6.8, g), at(4.0, -6.4, g), at(5.6, -5.6, g),
    at(7.2, -6.0, g), at(8.9, -5.6, g), at(9.5, -4.6, g), at(9.1, -3.8, g), port,
  ];
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const geo = new THREE.TubeGeometry(curve, 220, 0.055, 8, false);
  const m = mesh('hose', geo, S.mats.line);
  m.userData.length = curve.getLength(); m.userData.curve = curve;
  return m;
}

function findMats(model) {
  let plaster = null, line = null;
  model.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    if (!plaster && o.material.name === 'plaster' && /^future/.test(o.name)) plaster = o.material;
    if (!line && o.material.name === 'linework' && /^future/.test(o.name)) line = o.material;
  });
  return { plaster, line };
}

function setup(host, model) {
  S.host = host;
  S.mats = findMats(model);
  if (!S.mats.plaster || !S.mats.line) return;            // the model has no worksite: nothing to add
  const root = new THREE.Group(); root.name = 'futureworksite';
  root.position.copy(new THREE.Vector3(SITE.x, 0, -SITE.y)); root.rotation.y = SITE.rot;
  S.root = root;
  // the two arms, parked on their spots facing the module (site +y)
  DOCK.forEach((d, i) => {
    const arm = buildArm(i === 0 ? 'print' : 'fit');
    arm.base.position.copy(at(d.x, d.y, DOCK_TOP));
    arm.base.rotation.y = -Math.PI / 2;                   // its forward (+z) turned to the site's -x: towards the module
    arm.set(PARK);
    root.add(arm.base);
    S.arms.push(arm);
  });
  // the spare tool heads in the rack, hanging tool down, the mount plate up
  ['nozzle', 'laser', 'gripper', 'welder'].forEach((k, i) => {
    const t = buildTool(k);
    t.rotation.x = Math.PI;
    t.position.copy(at(RACK.x, RACK.slots[i], RACK.top + TOOL_LEN[k] + 0.06));
    root.add(t);
    S.tools[k] = t;
  });
  host.scene.add(root);
  root.updateMatrixWorld(true);
  S.hose = buildHose(S.arms[0]);
  root.add(S.hose);
  // FEAT-025b: the print arm's loop (newmodule/printloop.js)
  const toolHome = {};
  for (const k in S.tools) toolHome[k] = { p: S.tools[k].position.clone(), q: S.tools[k].quaternion.clone() };
  const W = { root, arms: S.arms, tools: S.tools, hose: S.hose, mats: S.mats, host, DOCK, DOCK_TOP, TOOL_LEN, toolHome, buildTool, road: null };
  S.loop = createPrintLoop(W);
  // FEAT-025c: the second arm works alongside in the same loop (newmodule/fitarm.js)
  S.fit = createFitLoop(W, S.loop);
  W.partner = S.fit;
  // FEAT-025d: click an arm to give it a task (newmodule/armtasks.js)
  S.tasks = createArmTasks(W, [S.loop, S.fit]);
  W.tasks = S.tasks;
  S.ready = true;
  host.markShadows();
}
function step(now) { if (S.loop) S.loop.step(now); }

// FEAT-025d: a tap on an arm (true when it was one); a tap elsewhere sends an asking arm back to work
const tap = (ev) => (S.tasks ? S.tasks.tap(ev) : false);
const hover = (ev) => (S.tasks ? S.tasks.hover(ev) : false);
const reset = () => { if (S.tasks) S.tasks.close(); };    // leaving the place: the bubble closes, the arm goes back to work

export const worksite = { setup, step, tap, hover, reset,
  get loop() { return S.loop; }, get fit() { return S.fit; }, get tasks() { return S.tasks; },
  // tests and the later parts
  get arms() { return S.arms; }, get tools() { return S.tools; }, get root() { return S.root; },
  state: () => ({ ready: S.ready, arms: S.arms.length, tools: Object.keys(S.tools), hose: S.hose ? +S.hose.userData.length.toFixed(1) : 0,
    meshes: S.root ? (() => { let n = 0; S.root.traverse((o) => { if (o.isMesh) n++; }); return n; })() : 0 }),
};
