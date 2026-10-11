// --- Power amp (WORKSHOP_PLAN phase W1, electronics station at the back of the desk): the last stage
// of the shared chain before the speakers. A power switch with a lamp, two VU meters (left and
// right) whose needles follow the level, and a big VOLUME knob (the chain's master volume). It sits
// in the 'amp' slot of workshop/audio.js: the switch cuts the signal, the meters read it.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { register, makePanel, feet } from './stations.js';
import * as audio from './audio.js';

const SIZE = { w: 0.44, h: 0.13, d: 0.32 };
const A = { P: null, group: null, parts: [], on: true, volume: 0.7, needles: [], vu: [0, 0], nodes: null, buf: null };
const VU = [{ x: 345, y: 150 }, { x: 600, y: 150 }];   // meter windows on the face (canvas px), 210 × 170

function face(g, P) {
  const { W, H } = P;
  g.fillStyle = '#2c2d2f'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#3a3b3e'; g.fillRect(0, 0, W, 10); g.fillRect(0, H - 10, W, 10);
  [24, W - 24].forEach((x) => { g.fillStyle = '#16171a'; g.beginPath(); g.arc(x, 34, 8, 0, 7); g.arc(x, H - 34, 8, 0, 7); g.fill(); });   // rack screws
  P.text('POWER', 110, 236, { size: 17, color: '#d9d4ca' });
  P.text('POWER AMP', 110, 50, { size: 15, color: '#8d8a84', weight: 500 });
  VU.forEach((m, i) => {
    g.fillStyle = '#121214'; g.fillRect(m.x - 112, m.y - 92, 224, 184);
    const grd = g.createLinearGradient(0, m.y - 85, 0, m.y + 85); grd.addColorStop(0, '#f6ead0'); grd.addColorStop(1, '#e6d4ad');
    g.fillStyle = grd; g.fillRect(m.x - 104, m.y - 84, 208, 168);
    const px = m.x, py = m.y + 62, R = 118;          // the needle's pivot, below the scale
    g.lineWidth = 3;
    for (let k = 0; k <= 10; k++) {
      const a = -Math.PI / 2 + (k / 10 - 0.5) * 1.6, red = k >= 7;
      g.strokeStyle = red ? '#c4372b' : '#2a2620';
      g.beginPath(); g.moveTo(px + Math.cos(a) * (R - 22), py + Math.sin(a) * (R - 22)); g.lineTo(px + Math.cos(a) * (R - (k % 5 ? 10 : 2)), py + Math.sin(a) * (R - (k % 5 ? 10 : 2))); g.stroke();
    }
    g.strokeStyle = '#2a2620'; g.lineWidth = 2; g.beginPath(); g.arc(px, py, R - 22, -Math.PI / 2 - 0.8, -Math.PI / 2 + 0.3); g.stroke();
    g.strokeStyle = '#c4372b'; g.lineWidth = 5; g.beginPath(); g.arc(px, py, R - 26, -Math.PI / 2 + 0.3, -Math.PI / 2 + 0.8); g.stroke();
    P.text('VU', px, m.y + 22, { size: 22, color: '#2a2620', weight: 700 });
    P.text(i ? 'R' : 'L', m.x + 84, m.y + 66, { size: 16, color: '#5a5247' });
  });
  P.drawScale(870, 140, 66, { color: '#bdb8ae', ticks: 11, labels: ['0', '', '', '', '', '5', '', '', '', '', '10'], size: 15 });
  P.text('VOLUME', 870, 258, { size: 17, color: '#d9d4ca' });
}

function build(ws) {
  const s = ws.SPOTS.amp;
  if (s.pad) s.pad.visible = false;
  const g = new THREE.Group();
  g.position.set(s.at[0], s.at[1] + SIZE.h / 2, s.at[2] - SIZE.d / 2 - 0.002);
  g.rotation.y = Math.PI;                             // the face looks to -z, towards the front of the desk
  const body = new THREE.Mesh(new RoundedBoxGeometry(SIZE.w, SIZE.h, SIZE.d, 2, 0.008), new THREE.MeshStandardMaterial({ color: 0x232426, roughness: 0.6, metalness: 0.3 }));
  body.position.z = -SIZE.d / 2; body.castShadow = body.receiveShadow = true;
  g.add(body);
  // rack handles either side of the face
  const hm = new THREE.MeshStandardMaterial({ color: 0x8e9196, roughness: 0.35, metalness: 0.8 });
  [-1, 1].forEach((sx) => {
    const hnd = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.0055, 8, 16, Math.PI), hm);
    hnd.rotation.set(0, Math.PI / 2, Math.PI / 2); hnd.position.set(sx * (SIZE.w / 2 - 0.018), 0, 0.001);
    hnd.castShadow = true; g.add(hnd);
  });
  feet(g, SIZE);
  const P = makePanel(ws, { w: SIZE.w - 0.004, h: SIZE.h - 0.004, px: 1024, draw: face });
  P.group.position.z = 0.001; g.add(P.group);
  A.power = P.button({ x: 110, y: 160, w: 76, h: 52, color: 0x55585e, litColor: 0xc9c3b8, lit: true, depth: 2, onPress: () => setPower(!A.on) });
  A.lamp = P.led({ x: 110, y: 96, r: 13, color: 0xff9a3c });
  A.vol = P.knob({ x: 870, y: 140, r: 60, value: A.volume, color: 0x1a1a1b, span: 220, onChange: (v) => { A.volume = v; audio.setVolume(v); } });
  P.build();
  // the needles: thin dark lines turning round the pivot below each window
  const nm = new THREE.MeshBasicMaterial({ color: 0x1a1612 });
  VU.forEach((m) => {
    const piv = new THREE.Group(); P.local(m.x, m.y + 62, 0.003, piv.position);
    const n = new THREE.Mesh(new THREE.BoxGeometry(0.0009, 112 * P.k, 0.0006), nm); n.position.y = 56 * P.k;
    piv.add(n); P.group.add(piv); A.needles.push(piv);
  });
  ws.scene.add(g);
  A.P = P; A.group = g; A.parts = [body, P.face, ...P.meshes];
  setPower(true, true); setNeedles(0, 0);
  audio.setVolume(A.volume);
  ws.markShadows();
}

function setPower(on, quiet) {
  A.on = on; A.power.light(on); A.lamp.set(on ? 1 : 0);
  if (A.nodes) A.nodes.gate.gain.setTargetAtTime(on ? 1 : 0, A.nodes.ctx.currentTime, on ? 0.05 : 0.02);
  if (!quiet && A.P) A.P.syncLeds();
}
// in the chain: input -> on/off -> (to stereo) -> out, the meters read the two channels
audio.onStart((ctx) => {
  const gate = ctx.createGain(); gate.gain.value = A.on ? 1 : 0;
  const st = ctx.createGain(); st.channelCount = 2; st.channelCountMode = 'explicit'; st.channelInterpretation = 'speakers';
  const split = ctx.createChannelSplitter(2), an = [ctx.createAnalyser(), ctx.createAnalyser()];
  an.forEach((a, i) => { a.fftSize = 1024; split.connect(a, i); });
  gate.connect(st); st.connect(split);
  audio.slot('amp').insert(gate, st);
  A.nodes = { ctx, gate, an };
  A.buf = new Float32Array(1024);
});
audio.onDispose(() => { A.nodes = null; });

function rms(a) {
  a.getFloatTimeDomainData(A.buf);
  let s = 0; for (let i = 0; i < A.buf.length; i++) s += A.buf[i] * A.buf[i];
  return Math.sqrt(s / A.buf.length);
}
function setNeedles(l, r) {
  [l, r].forEach((v, i) => { A.needles[i].rotation.z = 0.8 - Math.min(1.08, v) * 1.6; });
}
function update(dt, now, s) {
  if (!A.P || !s.inside) return;
  // VU ballistics: about 300 ms to settle; the level in dB maps onto the scale (-20 .. +3)
  [0, 1].forEach((i) => {
    let target = 0;
    if (A.nodes && A.on) {
      const db = 20 * Math.log10(rms(A.nodes.an[i]) * A.volume * 3 + 1e-6);
      target = Math.max(0, Math.min(1.1, (db + 20) / 23));
    }
    A.vu[i] += (target - A.vu[i]) * Math.min(1, dt * 7);
  });
  setNeedles(A.vu[0], A.vu[1]);
  A.P.syncLeds();
}

register({
  id: 'amp', label: 'Power amp', sound: true,
  pick: () => A.parts,
  view: { at: [10.1, 3.94 + 0.075, -0.76], from: [0, 0.32, -1], size: 0.6 },
  hint: 'Turn VOLUME, switch the power. The synth plays through here',
  setup: build,
  update,
  pointer: (type, ev, ws) => { if (type === 'down') ws.sound(); return A.P.pointer(type, ev); },
  key(ev) {
    if (ev.key === ' ' || ev.key === 'Enter') { setPower(!A.on); return true; }
    if (ev.key === 'ArrowUp' || ev.key === '+') { A.vol.set(A.vol.value + 0.05); return true; }
    if (ev.key === 'ArrowDown' || ev.key === '-') { A.vol.set(A.vol.value - 0.05); return true; }
    return false;
  },
});
