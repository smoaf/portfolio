// --- 3D printer in the workshop (Smo): a bed-slinger printer that prints a small model from the
// bottom up. The part above the current layer is cut off with a clip plane; the head and the bed move
// so that the nozzle runs along the outline of the layer being printed (the model is sliced into
// layers in the browser). Moved here from index.html in phase W0; phase W1 (WORKSHOP_PLAN) adds:
//   - a choice of five small prints (robot, vase, rocket, boat, cat) or the visitor's own .glb / .stl
//     (stays in the browser, nothing is sent anywhere; friendly errors for bad files). Since BUG-017 an
//     own .stl or .glb of up to 150 MB is read and simplified in the background (printer-reader.js)
//   - a speed slider and Cancel; a finished print stays on the bed until the next one
// Until a visitor prints something, the printer keeps printing the robot in a loop as before.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { register, bar } from './stations.js';

const MAX_MB = 150, GLTF_MB = 10, MAX_TRIS = 400000;   // own .stl / .glb; a .gltf is read on the page as before
const FIT = { w: 0.17, h: 0.2 };                       // the build volume a print is scaled into (m)
const LAYERS = 48, PATH = 40;                          // layers per print, points per layer outline
export const PRN = { bed: null, toy: null, xbar: null, head: null, b0: null, x0: null, h0: null, plane: new THREE.Plane(new THREE.Vector3(0, -1, 0), 0),
  printS: 48, holdS: 7, t: 0, last: 0, speed: 1,
  mode: 'loop',                                        // 'loop' (the robot, again and again) | 'print' | 'done' | 'idle'
  print: null, name: 'Robot', slices: [], note: null, reader: null, bedTop: new THREE.Vector3(), nozzle: new THREE.Vector3(), headAxis: null, bedAxis: null, bar: null };
let parts = [];
const MODELS = { Robot: null, Vase: vase, Rocket: rocket, Boat: boat, Cat: cat };   // Robot: the toy from the station model

function setupPrinter(ws) {
  ws.root.traverse((o) => {
    if (o.name === 'workshopprinter_bed') PRN.bed = o;
    if (o.name === 'workshopprinter_toy') PRN.toy = o;
    if (o.name === 'workshopprinter_xbar') PRN.xbar = o;
    if (o.name === 'workshopprinter_head') PRN.head = o;
  });
  if (!PRN.toy) return;
  ws.renderer.localClippingEnabled = true;
  PRN.toy.material.clippingPlanes = [PRN.plane];        // the accent setup already gave the toy its own material
  PRN.toy.material.side = THREE.DoubleSide;           // the cut shows the inside instead of nothing
  PRN.toy.castShadow = false;
  [PRN.bed, PRN.xbar, PRN.head].forEach((o) => { if (o) o.castShadow = false; });
  PRN.b0 = PRN.bed.position.clone(); PRN.x0 = PRN.xbar.position.clone(); PRN.h0 = PRN.head.position.clone();
  // where things are in the world: the bed's top centre, the nozzle, and which way head and bed move
  ws.root.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(PRN.bed), hb = new THREE.Box3().setFromObject(PRN.head);
  const bedWorld = PRN.bed.getWorldPosition(new THREE.Vector3());
  PRN.bedOff = new THREE.Vector3((bb.min.x + bb.max.x) / 2, bb.max.y, (bb.min.z + bb.max.z) / 2).sub(bedWorld);
  PRN.nozzle.set((hb.min.x + hb.max.x) / 2, hb.min.y, (hb.min.z + hb.max.z) / 2);
  PRN.headAxis = axis(PRN.head, 'x'); PRN.bedAxis = axis(PRN.bed, 'z');
  // the robot becomes the first print: its geometry in world space, centred on the bed
  const robot = PRN.toy.geometry.clone().applyMatrix4(PRN.toy.matrixWorld);
  MODELS.Robot = () => robot.clone();
  PRN.toy.visible = false;
  PRN.print = new THREE.Mesh(new THREE.BufferGeometry(), PRN.toy.material);
  PRN.print.name = 'workshop-print'; PRN.print.castShadow = false;
  ws.scene.add(PRN.print);
  load('Robot', MODELS.Robot());
  // what a click hits; own materials for the frame parts so only the printer glows
  const own = ['workshopprinter_frame', 'workshopprinter_frame_black', 'workshopprinter_bed', 'workshopprinter_xbar', 'workshopprinter_head'].map(ws.mesh).filter(Boolean);
  ws.own(own);
  parts = [...own, ws.mesh('workshopprinter_spool'), PRN.print].filter(Boolean);
  PRN.bar = makeBar(ws);
}
function axis(o, k) {                                  // the world direction a node moves in when its local `k` grows
  const p0 = o.getWorldPosition(new THREE.Vector3());
  o.position[k] += 0.01; o.updateMatrixWorld(true);
  const d = o.getWorldPosition(new THREE.Vector3()).sub(p0).multiplyScalar(100);
  o.position[k] -= 0.01; o.updateMatrixWorld(true);
  return d;
}

// ---- a model onto the bed: centred, scaled into the build volume, bottom on the bed, then sliced
function load(name, geo) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  Object.keys(geo.attributes).forEach((k) => { if (k !== 'position') geo.deleteAttribute(k); });
  geo.computeBoundingBox();
  const b = geo.boundingBox, size = b.getSize(new THREE.Vector3());
  const s = Math.min(FIT.w / Math.max(size.x, size.z, 1e-6), FIT.h / Math.max(size.y, 1e-6));
  geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2).scale(s, s, s);
  geo.computeVertexNormals(); geo.computeBoundingBox(); geo.computeBoundingSphere();
  PRN.print.geometry.dispose(); PRN.print.geometry = geo;
  PRN.name = name; PRN.h = geo.boundingBox.max.y; PRN.slices = new Array(LAYERS);
}
// the outline of one layer: where the triangles cross the layer's height, in order round the middle
function slice(i) {
  if (PRN.slices[i]) return PRN.slices[i];
  const pos = PRN.print.geometry.attributes.position.array, y = PRN.h * (i + 0.5) / LAYERS, pts = [];
  for (let t = 0; t < pos.length; t += 9) {
    let cut = 0;
    for (let e = 0; e < 3 && cut < 2; e++) {
      const a = t + e * 3, b = t + ((e + 1) % 3) * 3, ya = pos[a + 1], yb = pos[b + 1];
      if ((ya - y) * (yb - y) < 0) { const f = (y - ya) / (yb - ya); pts.push([pos[a] + (pos[b] - pos[a]) * f, pos[a + 2] + (pos[b + 2] - pos[a + 2]) * f]); cut++; }
    }
    if (pts.length > 6000) break;                      // enough to see the shape
  }
  if (!pts.length) return (PRN.slices[i] = [[0, 0]]);
  pts.sort((p, q) => Math.atan2(p[1], p[0]) - Math.atan2(q[1], q[0]));
  const out = [];
  for (let k = 0; k < PATH; k++) out.push(pts[Math.floor(k * pts.length / PATH)]);
  out.push(out[0]);
  return (PRN.slices[i] = out);
}

// ---- every frame: where the print is, the clip plane, the head over the outline
const vB = new THREE.Vector3();
function stepPrinter(now, dt) {
  if (!PRN.print) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const total = PRN.printS + (PRN.mode === 'loop' ? PRN.holdS : 0);
  if (PRN.mode === 'loop' || PRN.mode === 'print') PRN.t += dt * (reduced && PRN.mode === 'loop' ? 0 : PRN.speed);
  if (reduced && PRN.mode === 'loop') PRN.t = PRN.printS * 0.6;
  if (PRN.mode === 'loop') PRN.t %= total;
  if (PRN.mode === 'print' && PRN.t >= PRN.printS) { PRN.t = PRN.printS; PRN.mode = 'done'; status(); }
  const printing = (PRN.mode === 'loop' || PRN.mode === 'print') && PRN.t < PRN.printS;
  const u = PRN.mode === 'idle' ? 0 : Math.min(1, PRN.t / PRN.printS);
  const layer = PRN.h * u;
  // the nozzle runs along this layer's outline
  let hx = 0.08, by = -0.06;                           // parked: head to the side, bed forward
  if (printing) {
    const L = Math.min(LAYERS - 1, Math.floor(u * LAYERS)), f = u * LAYERS - L, path = slice(L);
    const k = f * (path.length - 1), i = Math.floor(k), p = path[i], q = path[Math.min(path.length - 1, i + 1)], w = k - i;
    const px = p[0] + (q[0] - p[0]) * w, pz = p[1] + (q[1] - p[1]) * w;
    // bed rest centre + bed offset + point = nozzle  (along each axis the parts move on)
    const bedC = PRN.bedOff.clone().add(PRN.bed.parent.localToWorld(PRN.b0.clone()));
    hx = (bedC.x + px - PRN.nozzle.x) / (PRN.headAxis.x || 1);
    by = (PRN.nozzle.z - bedC.z - pz) / (PRN.bedAxis.z || 1);
  }
  PRN.bed.position.set(PRN.b0.x, PRN.b0.y, PRN.b0.z + by);
  const z = layer + (printing ? 0.002 : 0.05);
  PRN.xbar.position.set(PRN.x0.x, PRN.x0.y + z, PRN.x0.z);
  PRN.head.position.set(PRN.h0.x + hx, PRN.h0.y + z, PRN.h0.z);
  PRN.bed.updateMatrixWorld(true);
  PRN.print.position.copy(PRN.bed.getWorldPosition(vB)).add(PRN.bedOff);
  PRN.plane.constant = PRN.print.position.y + layer;    // keep what lies below the current layer
  PRN.print.visible = u > 0.002;
  if (printing && PRN.bar && !PRN.bar.el.hidden && (now - (PRN.shown || 0) > 250)) { PRN.shown = now; status(); }
}

// ---- starting, cancelling, uploading
function start(name, geo) {
  stopReading();
  load(name, geo);
  PRN.mode = 'print'; PRN.t = 0; status();
}
function cancel() { stopReading(); if (PRN.mode === 'print') { PRN.mode = 'idle'; PRN.t = 0; } status(); }
// a notice that stays in the bar until the next choice: reading progress, or why a file can't be used
function note(text, kind = 'error') { PRN.note = text ? { text, kind } : null; status(); }
function stopReading() { if (PRN.reader) { PRN.reader.terminate(); PRN.reader = null; } PRN.note = null; }
async function upload(file) {
  if (!file) return;
  stopReading();
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!['glb', 'gltf', 'stl'].includes(ext)) return note('That is not a 3D model the printer knows. Try a .glb or an .stl file.');
  const mb = (file.size / 1048576).toFixed(1), max = ext === 'gltf' ? GLTF_MB : MAX_MB;
  if (file.size > max * 1024 * 1024) return note(`That file is ${mb} MB; the printer takes ${ext === 'gltf' ? '.gltf files' : 'files'} up to ${max} MB.`);
  if (!file.size) return note('That file is empty.');
  const name = file.name.replace(/\.[^.]+$/, '').slice(0, 24);
  if (ext !== 'gltf') return read(file, name);
  note('Reading ' + file.name + ' …', 'busy');
  try {
    const buf = await file.arrayBuffer();
    let geo;
    if (ext === 'stl') { geo = new STLLoader().parse(buf); geo.rotateX(-Math.PI / 2); }   // STL files are z-up
    else {
      const gltf = await new Promise((ok, fail) => new GLTFLoader().parse(buf, '', ok, fail));
      const list = [];
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((o) => { if (o.isMesh && o.geometry.attributes.position) { let g = o.geometry.clone(); g = g.index ? g.toNonIndexed() : g; Object.keys(g.attributes).forEach((k) => { if (k !== 'position') g.deleteAttribute(k); }); list.push(g.applyMatrix4(o.matrixWorld)); } });
      if (!list.length) return say('There is no model in that file.');
      geo = list.length === 1 ? list[0] : mergeGeometries(list);
      if (!geo) return say('Could not put the parts of that model together. Try another file.');
    }
    const tris = (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
    if (tris > MAX_TRIS) return say(`That model is very detailed (${Math.round(tris).toLocaleString('en')} triangles); the printer takes up to ${MAX_TRIS.toLocaleString('en')}.`);
    if (!tris) return say('That model is empty.');
    start(name, geo);
  } catch (e) {
    note('Could not read that file. Is it a working .glb or .stl?');
  }
}
// .stl and .glb: read and simplified in a worker, piece by piece; the page keeps running meanwhile
function read(file, name) {
  const w = PRN.reader = new Worker(new URL('./printer-reader.js', import.meta.url));
  const label = file.name.length > 32 ? file.name.slice(0, 30) + '…' : file.name;
  const done = () => { w.terminate(); if (PRN.reader === w) PRN.reader = null; };
  note(`Reading ${label} … 0 %`, 'busy');
  w.onmessage = (e) => {
    if (PRN.reader !== w) return;
    const d = e.data;
    if (d.p !== undefined) return note(`Reading ${label} … ${Math.floor(d.p * 100)} %`, 'busy');
    done();
    if (d.error) return note(d.error);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(d.pos, 3));
    if (/\.stl$/i.test(file.name)) geo.rotateX(-Math.PI / 2);   // STL files are z-up
    start(name, geo);
  };
  w.onerror = (e) => {                                 // e.g. the phone ran out of memory for this file
    e.preventDefault(); if (PRN.reader !== w) return;
    done(); note('This device could not read that file (it may be too big for it). Try a smaller one.');
  };
  w.postMessage({ file });
}

// ---- the bar: what to print, upload, speed, cancel, and how far it is
function makeBar(ws) {
  const b = bar('ws-printer');
  b.el.setAttribute('aria-label', '3D printer');
  b.el.innerHTML = `<span class="lbl">Print</span>${Object.keys(MODELS).map((n) => `<button type="button" class="btn" data-m="${n}">${n}</button>`).join('')}
    <button type="button" class="btn" data-up>Your own…</button><input type="file" accept=".glb,.gltf,.stl,model/gltf-binary" hidden>
    <label class="lbl">Speed <input type="range" min="1" max="8" step="1" value="1" aria-label="Print speed"></label>
    <button type="button" class="btn" data-cancel>Cancel</button>
    <div class="msg" aria-live="polite"></div>`;
  b.el.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.m) start(t.dataset.m, MODELS[t.dataset.m]());
    else if (t.dataset.cancel !== undefined) cancel();
    else if (t.dataset.up !== undefined) file.click();
  });
  const file = b.el.querySelector('input[type=file]');
  file.addEventListener('change', () => { upload(file.files[0]); file.value = ''; });
  const speed = b.el.querySelector('input[type=range]');
  speed.addEventListener('input', () => { PRN.speed = +speed.value; status(); });
  return b;
}
function say(text) { if (!PRN.bar) return; PRN.bar.el.querySelector('.msg').textContent = text; PRN.bar.fit(); }
function status() {
  if (!PRN.bar) return;
  const c = PRN.bar.el.querySelector('[data-cancel]');
  c.disabled = PRN.mode !== 'print' && !PRN.reader;
  const msg = PRN.bar.el.querySelector('.msg');
  msg.classList.toggle('note', !!PRN.note); msg.classList.toggle('err', !!PRN.note && PRN.note.kind === 'error');
  if (PRN.note) return say(PRN.note.text);
  PRN.bar.el.querySelectorAll('[data-m]').forEach((b) => b.setAttribute('aria-pressed', String(PRN.mode !== 'idle' && b.dataset.m === PRN.name)));
  const left = Math.max(0, (PRN.printS - PRN.t) / PRN.speed);
  if (PRN.mode === 'print') say(`Printing ${PRN.name}: ${Math.floor(PRN.t / PRN.printS * 100)} %, about ${Math.ceil(left)} s to go (speed ×${PRN.speed})`);
  else if (PRN.mode === 'done') say(`${PRN.name} is done. It stays on the bed until the next print.`);
  else if (PRN.mode === 'idle') say('Bed cleared. Pick something to print.');
  else say('Pick something to print, or upload your own model. It stays in your browser.');
}

// ---- the ready-made prints (y up, metres; load() scales them into the build volume)
function vase() {
  const pts = [];
  for (let i = 0; i <= 24; i++) { const y = i / 24; pts.push(new THREE.Vector2(0.03 + 0.022 * Math.sin(y * Math.PI * 1.1 + 0.3) + (i === 0 ? -0.03 : 0), y * 0.18)); }
  const g = new THREE.LatheGeometry(pts, 48), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {                  // a twisted, fluted wall
    const x = p.getX(i), z = p.getZ(i), y = p.getY(i), a = Math.atan2(z, x), r = Math.hypot(x, z) * (1 + 0.1 * Math.cos(8 * a + y * 30));
    p.setXYZ(i, Math.cos(a) * r, y, Math.sin(a) * r);
  }
  return g;
}
function rocket() {
  const body = new THREE.LatheGeometry([[0, 0.02], [0.022, 0.02], [0.026, 0.06], [0.026, 0.12], [0.02, 0.16], [0.008, 0.19], [0, 0.2]].map(([r, y]) => new THREE.Vector2(r, y)), 32);
  const nozzle = new THREE.CylinderGeometry(0.016, 0.02, 0.02, 24).translate(0, 0.01, 0);
  const fins = [0, 1, 2].map((k) => new THREE.BoxGeometry(0.004, 0.05, 0.03).translate(0, 0.045, 0.033).rotateY(k * Math.PI * 2 / 3));
  const port = new THREE.TorusGeometry(0.008, 0.003, 8, 20).translate(0, 0.12, 0.026);
  return merge([body, nozzle, ...fins, port]);
}
function boat() {
  const s = new THREE.Shape(); s.moveTo(-0.07, 0); s.lineTo(0.05, 0); s.quadraticCurveTo(0.085, 0.01, 0.09, 0.04); s.lineTo(-0.08, 0.04); s.lineTo(-0.07, 0);
  const hull = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 }).translate(0, 0, -0.025);
  const cabin = new THREE.BoxGeometry(0.06, 0.04, 0.04).translate(-0.02, 0.06, 0);
  const roof = new THREE.BoxGeometry(0.07, 0.006, 0.05).translate(-0.02, 0.083, 0);
  const stack = new THREE.CylinderGeometry(0.009, 0.011, 0.04, 16).translate(0.025, 0.07, 0);
  return merge([hull, cabin, roof, stack]);
}
function cat() {
  const body = new THREE.SphereGeometry(0.04, 24, 16).scale(1, 1.15, 0.85).translate(0, 0.045, 0);
  const head = new THREE.SphereGeometry(0.03, 24, 16).translate(0, 0.115, 0.004);
  const ears = [-1, 1].map((s) => new THREE.ConeGeometry(0.011, 0.022, 4).translate(s * 0.016, 0.145, 0.004));
  const tail = new THREE.TorusGeometry(0.035, 0.007, 8, 24, Math.PI * 1.1).rotateY(Math.PI / 2).translate(0, 0.04, -0.03);
  const paws = [-1, 1].map((s) => new THREE.SphereGeometry(0.012, 12, 8).translate(s * 0.018, 0.008, 0.028));
  return merge([body, head, ...ears, tail, ...paws]);
}
function merge(list) { return mergeGeometries(list.map((g) => { g = g.index ? g.toNonIndexed() : g; Object.keys(g.attributes).forEach((k) => { if (k !== 'position') g.deleteAttribute(k); }); return g; })); }

register({
  id: 'printer', label: '3D printer',
  pick: () => parts,
  get view() {                                         // a little lower and wider than before: the bar of choices sits along the bottom
    return innerWidth < innerHeight ? { at: [12.08, 4.15, 2.3], from: [0.12, 0.38, -1], size: 0.75 } : { at: [12.08, 4.19, 2.3], from: [0.12, 0.38, -1], size: 1.1 };
  },
  hint: 'Pick something to print, or upload your own model',
  setup: setupPrinter,
  arrive: () => { if (PRN.mode === 'loop') PRN.t = 0; },   // a new print starts when you arrive
  enter: () => { PRN.bar.show(true); status(); },
  exit: () => { PRN.bar.show(false); },
  update: (dt, now) => stepPrinter(now, dt),
  resume: (now) => { PRN.last = now; },
  print: (u) => { PRN.t = u * PRN.printS; },            // test hook
  start: (n) => start(n, MODELS[n]()), upload,          // test hooks
});
