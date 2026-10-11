// --- Solder station and the fuzz pedal (WORKSHOP_PLAN phase W2, front of the desk). The pedal is
// already built; the bench tells how: the printed schematic, the breadboard prototype with the
// multimeter's probes clipped to it, the soldering station with the iron in its holder, spare parts.
//
// The finished pedal is playable: a footswitch (on/off, with a red lamp), FUZZ and VOLUME (drag to
// turn). A small audio interface beside it plays a guitar loop into the pedal's IN (PLAY, LEVEL);
// SYNTH instead lets the modular synth through (the shared chain: synth ─► fuzz ─► delay ─► amp).
// The pedal sits in the chain's 'fuzz' slot: switched off it is bypassed, so the synth stays clean
// elsewhere; until a visitor stomps on it, it is on only while this station is open. From the
// pedal's OUT a cable runs over the desk's front edge, towards the delay and the amp.
//
// Views inside the station (bar along the bottom, or click a thing): Pedal (the start), Multimeter
// (turn the dial), Schematic (readable), Breadboard, Iron, Bench. Each has a short caption about the
// build (placeholder texts).
// Keys: Space footswitch, P play/stop, ← → fuzz, ↑ ↓ volume, G guitar, S synth, 1-6 views.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { register, makePanel, bar } from './stations.js';
import * as audio from './audio.js';
import { createFuzz, guitarLoop } from './fuzz-audio.js';
import { kit, cable, mat, solderStation, breadboard, battery, spares, schematic, BOARD, SHEET } from './solder-props.js';

const PED = { x: 0.36, z: 0.03, r: 0.075, h: 0.04 };   // bench-local (x to the visitor's right, z towards them)
const IFC = { x: 0.6, z: 0.0, w: 0.11, d: 0.15 };
const MTR = { x: 0.13, z: 0.0, w: 0.085, h: 0.17, t: 0.04, tilt: 1.12 };
const F = {
  ws: null, bench: null, C: null, parts: [], props: [], view: 'pedal', bar: null, active: null, tap: null,
  on: false, touched: false, live: false, fuzz: 0.7, volume: 0.65, level: 0.8, source: 'guitar', playing: true, mode: 1,
  fx: null, src: null, inGain: null, inMeter: null, buf: new Float32Array(1024), lcdT: 0, lcdText: '', ringLevel: 0, fsDown: 0,
};
const MODES = [['OFF', ''], ['V⎓', 'dc'], ['V~', 'ac'], ['Ω', 'ohm']];

// ---- views: the bench's own frame to the world (the bench is turned to face the visitor)
const W = (x, y, z) => [F.C[0] - x, F.C[1] + y, F.C[2] - z];
const D = (x, y, z) => [-x, y, -z];
const tall = () => innerWidth < innerHeight;
// phones: the bar along the bottom is tall, so the subject sits higher (the target moves down the screen)
function frame(v) {
  if (!tall()) return v;
  const dir = new THREE.Vector3(...v.from).normalize(), up = new THREE.Vector3(0, 1, 0).addScaledVector(dir, -dir.y).normalize();
  return { ...v, at: new THREE.Vector3(...v.at).addScaledVector(up, -v.size * 0.17).toArray() };
}
const VIEWS = {
  pedal: { label: 'Pedal', get v() { return { at: W(0.47, 0.025, 0.02), from: D(0, 1.25, 1), size: tall() ? 0.4 : 0.5 }; },
    text: 'The finished fuzz: two transistors, two knobs, one footswitch. Stomp it on and off, turn FUZZ and VOLUME.' },
  meter: { label: 'Multimeter', get v() { return { at: F.meterAt, from: F.meterN, size: tall() ? 0.2 : 0.26 }; },
    text: 'Setting the bias: the probes sit on the second transistor. About 4.5 V, half the battery, is where this fuzz sounds best. Turn the dial.' },
  sheet: { label: 'Schematic', get v() { return { at: W(SHEET.x, 0, SHEET.z), from: D(0, 1, 0.1), size: tall() ? 0.31 : 0.36 }; },
    text: 'The plan: the classic two-transistor fuzz, the layout of the box next to it, and pencil notes from testing.' },
  board: { label: 'Breadboard', get v() { return { at: W(BOARD.x, 0.01, BOARD.z), from: D(-0.2, 1, 0.6), size: tall() ? 0.17 : 0.22 }; },
    text: 'The prototype: every part was tried and measured on a breadboard before anything was soldered.' },
  iron: { label: 'Iron', get v() { return { at: W(-0.47, 0.07, -0.04), from: D(0.25, 0.45, 1), size: tall() ? 0.3 : 0.42 }; },
    text: 'Then soldered, part by part, onto a small board inside the round box.' },
  bench: { label: 'Bench', get v() { return { at: W(0, 0.04, 0.02), from: D(0, 0.95, 1), size: tall() ? 1.0 : 1.55 }; },
    text: 'From plan to pedal: schematic, breadboard, meter, iron, and the finished fuzz.' },
};
const ORDER = ['pedal', 'meter', 'sheet', 'board', 'iron', 'bench'];

// ---- the pedal: round turquoise hammered body, black ribbed wedge with the footswitch, two knobs
function pedalFace(g, P) {
  const { W: w, H: h } = P, cx = w / 2, cy = h / 2, R = w / 2 - 3;
  g.clearRect(0, 0, w, h);
  g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
  g.fillStyle = '#45b8b4'; g.fillRect(0, 0, w, h);
  let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {                     // the hammertone finish
    const x = rnd() * w, y = rnd() * h, r = 1 + rnd() * 3.2;
    g.fillStyle = rnd() < 0.5 ? 'rgba(18,90,92,0.35)' : 'rgba(210,250,246,0.4)';
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  const sh = g.createRadialGradient(cx, cy * 0.8, R * 0.2, cx, cy, R); sh.addColorStop(0, 'rgba(255,255,255,0.08)'); sh.addColorStop(1, 'rgba(0,40,40,0.28)');
  g.fillStyle = sh; g.fillRect(0, 0, w, h);
  // the black ribbed wedge from the middle down to the edge
  g.fillStyle = '#151515'; g.beginPath(); g.moveTo(cx, h * 0.47); g.lineTo(cx + w * 0.36, h); g.lineTo(cx - w * 0.36, h); g.closePath(); g.fill();
  g.strokeStyle = '#2c2c2c'; g.lineWidth = 2;
  for (let x = cx - w * 0.36; x < cx + w * 0.36; x += 7) { g.beginPath(); g.moveTo(x, h * 0.47 + Math.abs(x - cx) * 1.45); g.lineTo(x, h); g.stroke(); }
  // knob wells
  [[0.21, 0.4], [0.79, 0.4]].forEach(([u, v]) => { g.fillStyle = 'rgba(10,70,72,0.55)'; g.beginPath(); g.arc(u * w, v * h, 66, 0, 7); g.fill(); });
  g.restore();
  g.strokeStyle = 'rgba(10,60,60,0.6)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, R - 1, 0, 7); g.stroke();
  P.text('VOLUME', w * 0.2, h * 0.56, { size: 22, color: '#163a3a', weight: 800 });
  P.text('FUZZ', w * 0.8, h * 0.56, { size: 22, color: '#163a3a', weight: 800 });
  P.text('OUT', w * 0.19, h * 0.15, { size: 20, color: '#163a3a', weight: 800 });
  P.text('IN', w * 0.81, h * 0.15, { size: 20, color: '#163a3a', weight: 800 });
  g.fillStyle = '#8a8e88'; g.beginPath(); g.arc(cx, h * 0.38, 12, 0, 7); g.fill();   // the lamp's bezel
}
function buildPedal(group) {
  const g = new THREE.Group(); g.position.set(PED.x, 0, PED.z); group.add(g);
  const R = PED.r, body = mat(0x3aa9a5, { roughness: 0.5, metalness: 0.25 });
  const lathe = new THREE.LatheGeometry([new THREE.Vector2(0.001, 0), new THREE.Vector2(R - 0.003, 0), new THREE.Vector2(R, 0.004), new THREE.Vector2(R, PED.h - 0.006), new THREE.Vector2(R - 0.004, PED.h)], 48);
  const shell = new THREE.Mesh(lathe, body); shell.castShadow = shell.receiveShadow = true; g.add(shell);
  const P = makePanel(F.ws, { w: R * 2, h: R * 2, px: 512, draw: pedalFace, faceMat: { alphaTest: 0.5, roughness: 0.45, metalness: 0.2, emissiveIntensity: 0.05 } });
  P.group.rotation.x = -Math.PI / 2; P.group.position.y = PED.h + 0.0003; g.add(P.group);
  F.vol = P.knob({ x: 0.21 * 512, y: 0.4 * 512, r: 50, value: F.volume, color: 0x0e0e0f, mark: 0xf4f4f4, tall: 1.1, span: 160, onChange: (v) => { F.volume = v; applyFx(); } });
  F.fz = P.knob({ x: 0.79 * 512, y: 0.4 * 512, r: 50, value: F.fuzz, color: 0x0e0e0f, mark: 0xf4f4f4, tall: 1.1, span: 160, onChange: (v) => { F.fuzz = v; applyFx(); } });
  F.lamp = P.led({ x: 256, y: 0.38 * 512, r: 10, color: 0xff2a1f });
  P.build();
  // the footswitch: hex nut, threaded collar, the cap that moves down when stomped
  const steel = mat(0xd2d4d6, { metalness: 0.9, roughness: 0.25 });
  const fs = new THREE.Group(); P.local(256, 0.8 * 512, 0, fs.position); P.group.add(fs);
  const add = (geo, y) => { const m = new THREE.Mesh(geo, steel); m.rotation.x = Math.PI / 2; m.position.z = y; m.castShadow = true; fs.add(m); return m; };
  add(new THREE.CylinderGeometry(0.0105, 0.0105, 0.004, 6), 0.002);
  add(new THREE.CylinderGeometry(0.0078, 0.0078, 0.009, 20), 0.008);
  F.fsCap = add(new THREE.CylinderGeometry(0.0062, 0.0066, 0.008, 20), 0.016);
  F.fsCtl = { kind: 'fs', x: 256, y: 0.8 * 512, r: 46 };
  // the IN and OUT jacks on the sides (nuts), with plugs in them
  const nut = mat(0xc9cbcd, { metalness: 0.85, roughness: 0.3 }), plug = mat(0x1a1a1b, { roughness: 0.5 });
  const K = kit('pedal-jacks'), jacks = {};
  [['out', -1], ['in', 1]].forEach(([id, sx]) => {
    const a = Math.atan2(-0.36, sx * 0.93), dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const at = (d) => dir.clone().multiplyScalar(R + d).setY(0.024);
    const rot = [0, -a, Math.PI / 2];
    K.add(new THREE.CylinderGeometry(0.0065, 0.0065, 0.004, 6), nut, at(0.001).toArray(), rot);
    K.add(new THREE.CylinderGeometry(0.0055, 0.0055, 0.024, 16), plug, at(0.015).toArray(), rot);
    K.add(new THREE.CylinderGeometry(0.0035, 0.0045, 0.01, 12), plug, at(0.032).toArray(), rot);
    jacks[id] = at(0.036).add(g.position);
    jacks[id + 'Dir'] = dir;
  });
  const jm = K.build(g);
  F.ped = { P, group: g, jacks, meshes: [shell, P.face, ...P.meshes, ...fs.children, ...jm] };
  return F.ped;
}

// ---- the audio interface: black, low sloped front with a ring of LEDs round a big knob, a raised
// block at the back (no logo). PLAY starts the guitar loop; GUITAR / SYNTH choose what goes in.
function ifaceFace(g, P) {
  const { W: w, H: h } = P;
  g.fillStyle = '#242426'; g.fillRect(0, 0, w, h);
  const pad = (x, y, rx, ry) => { g.fillStyle = '#1b1b1d'; g.beginPath(); g.ellipse(x, y + 3, rx, ry, 0, 0, 7); g.fill(); g.fillStyle = '#2d2d30'; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); };
  pad(256, 215, 92, 92);
  [[78, 120], [78, 300], [434, 120], [434, 300]].forEach(([x, y]) => pad(x, y, 40, 40));
  g.fillStyle = '#2d2d30'; g.beginPath(); g.roundRect(166, 26, 180, 54, 27); g.fill();
  P.text('PLAY', 256, 98, { size: 15, color: '#8e8c88', weight: 600 });
  P.text('GUITAR', 78, 172, { size: 15, color: '#8e8c88', weight: 600 });
  P.text('SYNTH', 78, 352, { size: 15, color: '#8e8c88', weight: 600 });
  P.text('LEVEL', 256, 345, { size: 15, color: '#8e8c88', weight: 600 });
  // pictograms on the decorative pads: headphones, crossfade
  g.strokeStyle = '#77756f'; g.lineWidth = 4;
  g.beginPath(); g.arc(434, 124, 15, Math.PI, 0); g.stroke(); g.fillStyle = '#77756f'; g.fillRect(416, 122, 7, 14); g.fillRect(445, 122, 7, 14);
  g.beginPath(); g.moveTo(416, 292); g.bezierCurveTo(430, 292, 438, 308, 452, 308); g.moveTo(416, 308); g.bezierCurveTo(430, 308, 438, 292, 452, 292); g.stroke();
}
function buildIface(group) {
  const g = new THREE.Group(); g.position.set(IFC.x, 0, IFC.z); group.add(g);
  const sh = new THREE.Shape();                         // side profile: x = towards the visitor, y = up
  sh.moveTo(0.075, 0); sh.lineTo(0.075, 0.009); sh.quadraticCurveTo(0.074, 0.0115, 0.07, 0.0118); sh.lineTo(0.0, 0.0165);
  sh.bezierCurveTo(-0.02, 0.018, -0.026, 0.03, -0.034, 0.046); sh.lineTo(-0.04, 0.05); sh.lineTo(-0.072, 0.05); sh.lineTo(-0.075, 0.046); sh.lineTo(-0.075, 0); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: IFC.w, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0015, bevelSegments: 2, curveSegments: 10 });
  geo.rotateY(-Math.PI / 2); geo.translate(IFC.w / 2, 0, 0);
  const body = new THREE.Mesh(geo, mat(0x1c1c1e, { roughness: 0.55 })); body.castShadow = body.receiveShadow = true; g.add(body);
  const gloss = new THREE.Mesh(new THREE.PlaneGeometry(IFC.w - 0.01, 0.024), mat(0x070708, { roughness: 0.12, metalness: 0.3 }));
  gloss.rotation.x = -Math.PI / 2; gloss.position.set(0, 0.0502, -0.057); g.add(gloss);
  const P = makePanel(F.ws, { w: 0.1, h: 0.072, px: 512, draw: ifaceFace, faceMat: { roughness: 0.6, emissiveIntensity: 0.06 } });
  P.group.rotation.x = -Math.PI / 2 + 0.067; P.group.position.set(0, 0.0161, 0.036); g.add(P.group);
  F.play = P.button({ x: 256, y: 53, w: 150, h: 34, color: 0x2f2f32, litColor: 0x3ecf72, lit: F.playing, depth: 0.5, onPress: () => setPlaying(!F.playing) });
  F.bGuitar = P.button({ x: 78, y: 120, w: 52, h: 52, color: 0x2f2f32, litColor: 0x3ecf72, lit: true, depth: 0.5, onPress: () => setSource('guitar') });
  F.bSynth = P.button({ x: 78, y: 300, w: 52, h: 52, color: 0x2f2f32, litColor: 0x3ecf72, lit: false, depth: 0.5, onPress: () => setSource('synth') });
  F.lvl = P.knob({ x: 256, y: 215, r: 62, value: F.level, color: 0x242427, mark: 0x9a9890, tall: 0.45, span: 200, onChange: (v) => { F.level = v; applyLevel(); } });
  F.ring = [];
  for (let i = 0; i < 22; i++) {                        // the LED ring round the knob
    const a = Math.PI * 0.72 + (i / 21) * Math.PI * 1.56;
    F.ring.push(P.led({ x: 256 + Math.cos(a) * 112, y: 215 + Math.sin(a) * 112, r: 5.5, color: i < 15 ? 0xf2f0e8 : i < 19 ? 0xf2b630 : 0xff4a2e }));
  }
  P.build();
  F.ifc = { P, group: g, meshes: [body, gloss, P.face, ...P.meshes], outAt: new THREE.Vector3(IFC.x - IFC.w / 2 - 0.002, 0.012, IFC.z - 0.03) };
  return F.ifc;
}

// ---- the multimeter: yellow rubber case, grey face, LCD, the big dial, probe leads to the board
function meterFace(g, P) {
  const { W: w, H: h } = P;
  g.fillStyle = '#4a4c50'; g.beginPath(); g.roundRect(0, 0, w, h, 34); g.fill();
  g.fillStyle = '#3c3e42'; g.beginPath(); g.roundRect(26, 30, w - 52, 300, 18); g.fill();
  [['#3d6fc4', 70], ['#2c2d30', 180], ['#2c2d30', 290], ['#e9c21d', 400]].forEach(([c, x]) => { g.fillStyle = c; g.beginPath(); g.roundRect(x - 44, 360, 88, 40, 8); g.fill(); });
  P.text('HOLD', 70, 380, { size: 19, color: '#eef1f6', weight: 700 });
  P.text('RANGE', 180, 380, { size: 17, color: '#cfd1d4', weight: 700 });
  P.text('MIN MAX', 290, 380, { size: 15, color: '#cfd1d4', weight: 700 });
  g.fillStyle = '#404246'; g.beginPath(); g.arc(256, 650, 178, 0, 7); g.fill();
  const labs = ['OFF', 'V⎓', 'V~', 'Ω'];
  labs.forEach((t, i) => { const a = -Math.PI / 2 - 0.75 * Math.PI + 1.5 * Math.PI * (i / 3); P.text(t, 256 + Math.cos(a) * 205, 650 + Math.sin(a) * 205, { size: t === 'OFF' ? 26 : 34, color: i === 2 ? '#e9c21d' : '#eceae4', weight: 700 }); });
  P.drawJack(130, 990, 34, { ring: '#2a2a2a' }); P.drawJack(382, 990, 34, { ring: '#2a2a2a' });
  g.fillStyle = '#b2222f'; g.beginPath(); g.roundRect(300, 900, 70, 44, 6); g.fill(); P.text('V Ω', 335, 922, { size: 22, color: '#ffffff', weight: 700 });
  g.fillStyle = '#121212'; g.beginPath(); g.roundRect(150, 900, 80, 44, 6); g.fill(); P.text('COM', 190, 922, { size: 21, color: '#ffffff', weight: 700 });
}
function buildMeter(group) {
  const g = new THREE.Group(); group.add(g);
  const inner = new THREE.Group(); inner.rotation.x = -MTR.tilt; g.add(inner);
  const yellow = mat(0xf0c21a, { roughness: 0.75 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(MTR.w, MTR.h, MTR.t, 3, 0.01), yellow); body.castShadow = body.receiveShadow = true; inner.add(body);
  const P = makePanel(F.ws, { w: MTR.w - 0.012, h: MTR.h - 0.016, px: 512, draw: meterFace, faceMat: { roughness: 0.6, emissiveIntensity: 0.06 } });
  P.group.position.z = MTR.t / 2 + 0.0004; inner.add(P.group);
  F.dial = P.knob({ x: 256, y: 650, r: 118, steps: 4, value: F.mode / 3, color: 0x2e3034, mark: 0xdddddd, tall: 0.45, span: 120, onChange: (v) => { F.mode = Math.round(v * 3); F.lcdT = 0; meterCaption(); } });
  P.build();
  // the LCD: its own little canvas, redrawn a few times a second
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  F.lcd = { g: c.getContext('2d'), tex: new THREE.CanvasTexture(c) }; F.lcd.tex.colorSpace = THREE.SRGBColorSpace;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry((512 - 92) * P.k, 250 * P.k), new THREE.MeshBasicMaterial({ map: F.lcd.tex, toneMapped: false }));
  P.local(256, 180, 0.0006, scr.position); P.group.add(scr);
  // stand it on the desk: lowest point at y = 0
  g.position.set(MTR.x, 0, MTR.z); g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner);   // (the bench is not placed yet: this is bench-local)
  g.position.y = -box.min.y + 0.0005;
  F.mtr = { P, group: g, inner, scr, meshes: [body, P.face, scr, ...P.meshes] };
  return F.mtr;
}
function drawLcd() {
  const { g, tex } = F.lcd, w = 256, h = 128;
  g.fillStyle = '#aab5a1'; g.fillRect(0, 0, w, h);
  const [unit, kind] = MODES[F.mode];
  let txt = '';
  if (kind === 'dc') txt = (4.5 + 0.02 * Math.sin(performance.now() / 900) + (Math.random() - 0.5) * 0.012).toFixed(2);
  else if (kind === 'ac') txt = (F.fx && F.live && soundIn() ? Math.min(9.99, F.fx.rms() * 2.2) : 0).toFixed(2);
  else if (kind === 'ohm') txt = '0L';
  g.fillStyle = '#1b201a'; g.textBaseline = 'middle';
  g.font = '700 70px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace'; g.textAlign = 'right';
  g.fillText(txt, 196, 62);
  g.font = '700 26px system-ui, Arial, sans-serif'; g.textAlign = 'left';
  if (unit !== 'OFF') g.fillText(kind === 'ohm' ? 'MΩ' : unit, 204, 48);
  if (unit !== 'OFF') { g.font = '600 15px system-ui, Arial, sans-serif'; g.fillText('AUTO', 14, 18); g.fillRect(14, 108, 180 * (kind === 'dc' ? 0.45 : kind === 'ac' ? Math.min(1, F.fx && F.live ? F.fx.rms() * 3 : 0) : 1), 6); }
  tex.needsUpdate = true;
  F.lcdText = txt;
}
const CAPTIONS = {
  OFF: 'Turn the dial to see what the meter measured.',
  'V⎓': 'DC volts on the second transistor: about 4.5 V, half the battery. That is where this fuzz sounds fattest.',
  'V~': 'AC volts: the signal itself. Play the guitar and watch it move with the sound.',
  'Ω': 'Resistance on a live circuit makes no sense: the meter just says 0L. Measure parts with the power off.',
};
function meterCaption() { if (F.view === 'meter') caption(CAPTIONS[MODES[F.mode][0]]); }

// ---- building the whole bench
function build(ws) {
  F.ws = ws;
  const s = ws.SPOTS.solder;
  if (s.pad) s.pad.visible = false;
  F.C = [s.at[0], s.at[1], s.at[2]];
  const bench = new THREE.Group(); bench.position.set(...F.C); bench.rotation.y = Math.PI; F.bench = bench;
  const props = {};
  props.iron = solderStation(bench);
  const bb = breadboard(bench); props.board = [...bb.meshes, ...battery(bench, bb)];
  props.sheet = schematic(bench);
  props.spare = spares(bench);
  const ped = buildPedal(bench); props.pedal = ped.meshes;
  const ifc = buildIface(bench); props.iface = ifc.meshes;
  const mtr = buildMeter(bench); props.meter = mtr.meshes;
  ws.scene.add(bench); bench.updateMatrixWorld(true);
  // cables: interface OUT ─► pedal IN, pedal OUT ─► over the front edge, interface ─► laptop, probes
  const K = kit('solder-cables'), black = mat(0x18181a, { roughness: 0.6 });
  const pin = ped.jacks.in, pout = ped.jacks.out, io = ifc.outAt, di = ped.jacks.inDir, dout = ped.jacks.outDir;
  K.add(new THREE.CylinderGeometry(0.0045, 0.0045, 0.02, 14), black, [io.x - 0.008, io.y, io.z], [0, 0, Math.PI / 2]);
  K.add(cable([[io.x - 0.018, io.y, io.z], [io.x - 0.03, 0.006, io.z - 0.005], [pin.x + di.x * 0.03, 0.0035, pin.z + di.z * 0.03 - 0.02], [pin.x + di.x * 0.012, 0.012, pin.z + di.z * 0.012], [pin.x, pin.y, pin.z]], 0.0028, black), black);
  K.add(cable([[pout.x, pout.y, pout.z], [pout.x + dout.x * 0.02, 0.01, pout.z + dout.z * 0.02], [pout.x - 0.035, 0.0035, pout.z + 0.06], [pout.x - 0.04, 0.0035, 0.24], [pout.x - 0.04, -0.012, 0.293], [pout.x - 0.043, -0.2, 0.3], [pout.x - 0.05, -0.6, 0.31], [pout.x - 0.06, -0.925, 0.34], [pout.x + 0.1, -0.928, 0.42], [pout.x + 0.6, -0.928, 0.45]], 0.0028, black, 90), black);
  K.add(cable([[IFC.x + 0.01, 0.03, IFC.z - 0.077], [IFC.x + 0.012, 0.004, IFC.z - 0.11], [IFC.x - 0.02, 0.004, -0.22], [0.47, 0.004, -0.3], [0.44, 0.01, -0.33]], 0.0017, black, 30), black);
  // the probe leads: from the meter's jacks to clips on the board
  const P = mtr.P, red = mat(0xc4262b, { roughness: 0.5 });
  const jackPt = (x) => bench.worldToLocal(P.group.localToWorld(P.local(x, 990, 0.004)));
  [[130, black, bb.clipBlack], [382, red, bb.clipRed]].forEach(([x, m, clip]) => {
    const a = jackPt(x), n = bench.worldToLocal(P.group.localToWorld(P.local(x, 990, 0.03))).sub(a).normalize();
    K.add(cable([a.toArray(), a.clone().addScaledVector(n, 0.02).toArray()], 0.0042, m, 4), m);
    const c0 = a.clone().addScaledVector(n, 0.02);
    K.add(cable([c0.toArray(), [c0.x - 0.004, 0.003, c0.z + 0.03], [c0.x - 0.03, 0.003, c0.z + 0.02], [0.02, 0.003, 0.0], [clip.x + 0.035, 0.003, clip.z + 0.03], [clip.x + 0.008, clip.y + 0.012, clip.z + 0.01], [clip.x, clip.y + 0.006, clip.z]], 0.0013, m, 48), m);   // round the back of the schematic
    K.add(new RoundedBoxGeometry(0.006, 0.005, 0.02, 1, 0.0015), m, [clip.x, clip.y + 0.004, clip.z + 0.006], [0.3, 0, 0]);   // the alligator clip
  });
  props.cables = K.build(bench);
  props.board.push(...props.cables);
  F.props = props;
  F.parts = Object.values(props).flat();
  // the meter's view: straight at its face
  const ctr = P.group.localToWorld(new THREE.Vector3(0, -0.01, 0)), nrm = new THREE.Vector3(0, 0, 1).transformDirection(P.group.matrixWorld);
  F.meterAt = ctr.toArray(); F.meterN = nrm.add(new THREE.Vector3(0, 0.25, 0)).toArray();
  F.bar = makeBar(ws);
  setLamp(); drawLcd();
  ws.markShadows();
}

// ---- the bar: the views and their captions
function makeBar(ws) {
  const b = bar('ws-solder');
  b.el.setAttribute('aria-label', 'Solder bench views');
  b.el.innerHTML = ORDER.map((id) => `<button type="button" class="btn" data-v="${id}">${VIEWS[id].label}</button>`).join('') + '<div class="msg" aria-live="polite"></div>';
  b.el.addEventListener('click', (e) => { const t = e.target.closest('button'); if (t && t.dataset.v) { ws.sound(); show(t.dataset.v); } });
  const st = document.createElement('style');
  st.textContent = '.ws-solder .msg { max-width: 560px; margin: 0 auto; } .ws-solder .msg .ph { opacity: 0.6; font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; margin-left: 6px; white-space: nowrap; }';
  document.head.appendChild(st);
  return b;
}
function caption(text) {
  const m = F.bar.el.querySelector('.msg');
  m.innerHTML = ''; if (text) { const t = document.createElement('span'); t.textContent = text; const ph = document.createElement('span'); ph.className = 'ph'; ph.textContent = 'Placeholder text'; m.append(t, ph); }
  F.bar.fit();
}
function show(id, fly = true) {
  F.view = id;
  F.bar.el.querySelectorAll('[data-v]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === id)));
  caption(VIEWS[id].text);
  if (fly) F.ws.fly(frame(VIEWS[id].v));
}

// ---- sound
function effectiveOn() { return F.touched ? F.on : F.live; }
function setLamp() {
  const on = effectiveOn();
  F.lamp.set(on ? 1 : 0); F.ped.P.syncLeds();
  if (audio.running()) audio.slot('fuzz').bypass(!on);
}
function stomp() {
  F.on = !effectiveOn(); F.touched = true;
  F.fsDown = 0.14;
  setLamp();
  if (F.fx) click();
}
function click() {                                      // the switch's mechanical click (quiet, dry)
  const ctx = audio.context(); if (!ctx) return;
  const n = ctx.createBufferSource(), b = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.02), ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 6) * 0.25;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 1.2;
  n.buffer = b; n.connect(f); f.connect(audio.slot('amp').in); n.start();
}
function applyFx() { if (F.fx) F.fx.set(F.fuzz, F.volume); }
function applyLevel() { if (F.inGain) F.inGain.gain.setTargetAtTime(F.level * F.level * 1.4, F.inGain.context.currentTime, 0.02); }
function soundIn() { return F.source === 'synth' || (F.playing && F.src); }
audio.onStart((ctx) => {
  F.fx = createFuzz(ctx);
  const s = audio.slot('fuzz');
  s.insert(F.fx.input, F.fx.output); s.bypass(!effectiveOn());
  F.inGain = ctx.createGain(); F.inGain.connect(s.in);
  F.inMeter = ctx.createAnalyser(); F.inMeter.fftSize = 1024; F.inGain.connect(F.inMeter);
  applyFx(); applyLevel();
  F.src = null;
  if (F.live) route();
});
audio.onDispose(() => { F.fx = null; F.src = null; F.inGain = null; F.inMeter = null; });
// what goes into the pedal: the guitar loop (and the synth held back), or the synth
function route() {
  const ctx = audio.context(); if (!ctx || !F.inGain) return;
  const guitar = F.live && F.source === 'guitar';
  audio.slot('synth').in.gain.setTargetAtTime(guitar ? 0 : 1, ctx.currentTime, 0.03);
  if (guitar && F.playing && !F.src) {
    const src = ctx.createBufferSource(); src.buffer = guitarLoop(ctx); src.loop = true;
    src.connect(F.inGain); src.start(ctx.currentTime + 0.03); F.src = src;
  } else if ((!guitar || !F.playing) && F.src) { const s = F.src; F.src = null; try { s.stop(); } catch (e) { /* already stopped */ } s.disconnect(); }
}
function setPlaying(on) { F.playing = on; F.play.light(on); if (on && F.source !== 'guitar') setSource('guitar'); else route(); }
function setSource(id) {
  F.source = id; F.bGuitar.light(id === 'guitar'); F.bSynth.light(id === 'synth');
  if (id === 'synth') { F.playing = false; F.play.light(false); }
  route();
  if (F.bar && !F.bar.el.hidden && F.view === 'pedal') caption(id === 'synth' ? 'Now the modular synth plays through the pedal. Try the fuzz on its bleeps.' : VIEWS.pedal.text);
}

// ---- pointer: the three panels' controls, the footswitch, and a click on a prop flies to it
// only the devices of the current view take the pointer (in the other views a click flies to a thing)
const PANELS = () => (F.view === 'pedal' ? [F.ped.P, F.ifc.P] : F.view === 'meter' ? [F.mtr.P] : []);
function pointer(type, ev, ws) {
  if (type === 'down') {
    ws.sound();
    if (F.view === 'pedal' && F.ped.P.hit(ev, [F.fsCtl])) { stomp(); F.active = null; return true; }
    F.tap = { x: ev.clientX, y: ev.clientY };
    for (const P of PANELS()) if (P.pointer('down', ev)) { F.active = P; return true; }
    return false;
  }
  if (type === 'move') {
    if (F.active) return F.active.pointer('move', ev);
    const over = (F.view === 'pedal' && F.ped.P.hit(ev, [F.fsCtl])) || PANELS().some((P) => P.hit(ev, [...P.knobs, ...P.buttons]));
    ws.el.style.cursor = over ? 'pointer' : propAt(ev, ws) ? 'zoom-in' : '';
    return false;
  }
  if (type === 'up') {
    const still = F.tap && Math.hypot(ev.clientX - F.tap.x, ev.clientY - F.tap.y) < 8;
    if (F.active) {
      const P = F.active; F.active = null;
      if (still && P.drag && P.drag.c === F.dial) F.dial.set(((F.mode + 1) % 4) / 3);   // a tap on the dial turns it one step
      F.tap = null; return P.pointer('up', ev);
    }
    if (still) { const id = propAt(ev, ws); if (id && id !== F.view) show(id); }
    F.tap = null;
    return false;
  }
  return false;
}
const PROP_VIEW = { iron: 'iron', board: 'board', sheet: 'sheet', meter: 'meter', pedal: 'pedal', iface: 'pedal', spare: 'board' };
function propAt(ev, ws) {
  const r = ws.ray(ev);
  let best = null, d = Infinity;
  Object.entries(F.props).forEach(([id, ms]) => { if (!PROP_VIEW[id]) return; const h = r.intersectObjects(ms, false)[0]; if (h && h.distance < d) { d = h.distance; best = PROP_VIEW[id]; } });
  return best;
}

// ---- every frame
function update(dt, now, s) {
  if (!F.ped) return;
  const live = s.inside && s.focus === 'solder';
  if (live !== F.live) { F.live = live; setLamp(); route(); }
  if (!s.inside) return;
  if (F.fsDown > 0) F.fsDown = Math.max(0, F.fsDown - dt);
  F.fsCap.position.z = 0.016 - (F.fsDown > 0 ? 0.0025 : 0);
  // the LED ring: the input level while something plays, otherwise a dim arc for the LEVEL knob
  let lvl = 0;
  if (F.inMeter && F.live && F.source === 'guitar' && F.src) {
    F.inMeter.getFloatTimeDomainData(F.buf);
    let pk = 0; for (let i = 0; i < F.buf.length; i++) pk = Math.max(pk, Math.abs(F.buf[i]));
    lvl = Math.min(1, pk * 1.6);
  }
  F.ringLevel = Math.max(lvl, F.ringLevel - dt * 1.8);
  const n = F.ring.length;
  F.ring.forEach((l, i) => l.set(i / n < F.ringLevel ? 1 : i / n < F.level ? 0.18 : 0));
  F.ifc.P.syncLeds();
  if (s.open && (F.lcdT -= dt) <= 0) { F.lcdT = F.view === 'meter' ? 0.25 : 0.6; drawLcd(); }
}

register({
  id: 'solder', label: 'Solder bench & fuzz pedal', sound: true,
  pick: () => F.parts,
  get view() { return F.C ? frame(VIEWS.pedal.v) : { at: [10.6, 4.0, -1.35], from: [0, 1.2, -1], size: 0.5 }; },
  hint: 'Stomp the footswitch, turn FUZZ. Below: the story of how it was built',
  setup: build,
  enter(ws) { F.view = 'pedal'; F.bar.show(true); show('pedal', false); },
  exit() { F.bar.show(false); F.active = null; F.tap = null; PANELS().forEach((P) => { P.drag = null; }); },
  update,
  pointer,
  key(ev) {
    const k = ev.key.toLowerCase();
    if (k === ' ') { stomp(); return true; }
    if (k === 'p' || k === 'enter') { setPlaying(!F.playing); return true; }
    if (k === 'g') { setSource('guitar'); if (!F.playing) setPlaying(true); return true; }
    if (k === 's') { setSource('synth'); return true; }
    if (k === 'arrowup') { F.vol.set(F.vol.value + 0.05); return true; }
    if (k === 'arrowdown') { F.vol.set(F.vol.value - 0.05); return true; }
    if (k === 'arrowright') { F.fz.set(F.fz.value + 0.05); return true; }
    if (k === 'arrowleft') { F.fz.set(F.fz.value - 0.05); return true; }
    if (k >= '1' && k <= '6') { show(ORDER[+k - 1]); return true; }
    if (k === 'd' && F.view === 'meter') { F.dial.set(((F.mode + 1) % 4) / 3); return true; }
    return false;
  },
  state: F, show, stomp, setSource, setPlaying,         // test hooks
});
