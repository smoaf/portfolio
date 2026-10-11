// --- Oscilloscope (WORKSHOP_PLAN phase W1, electronics station at the back of the desk): a bench
// scope with a white body and a blue handle. The screen shows the live waveform at one point of the
// shared chain (SYNTH, FUZZ, ECHO or AMP: the buttons move the probe), triggered on a rising zero
// crossing so a steady tone stands still. TIME/DIV and VOLTS/DIV zoom the trace across and up/down.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { register, makePanel, feet } from './stations.js';
import * as audio from './audio.js';

const SIZE = { w: 0.4, h: 0.2, d: 0.16 };
const TIME = [0.1, 0.2, 0.5, 1, 2, 5];                 // ms per division (10 across)
const VOLT = [0.05, 0.1, 0.2, 0.5, 1, 2];              // "volts" (full scale = 1) per division (8 up and down)
const PROBES = [['synth', 'SYNTH'], ['fuzz', 'FUZZ'], ['delay', 'ECHO'], ['amp', 'AMP']];
const SCR = { x0: 36, y0: 64, x1: 626, y1: 444 };      // the screen on the face (canvas px)
const O = { P: null, parts: [], t: 3, v: 2, probe: 'synth', btns: [], scr: null, g: null, tex: null, buf: null, frame: 0 };

function face(g, P) {
  const { W, H } = P;
  const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#f1f2f1'); grd.addColorStop(1, '#e2e4e3');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  g.fillStyle = '#d4d7d6'; g.fillRect(SCR.x0 - 14, SCR.y0 - 14, SCR.x1 - SCR.x0 + 28, SCR.y1 - SCR.y0 + 28);
  g.fillStyle = '#c9cdcc'; g.fillRect(652, 40, W - 680, H - 80);
  P.text('DIGITAL OSCILLOSCOPE', SCR.x0, 36, { size: 15, color: '#8d9190', align: 'left', weight: 500 });
  P.text('INPUT', 820, 66, { size: 15, color: '#55595a' });
  PROBES.forEach(([, name], i) => P.text(name, 700 + i * 82, 160, { size: 14, color: '#3d4142' }));
  g.fillStyle = '#3d4142'; g.fillRect(668, 196, 304, 2);
  P.text('TIME / DIV', 740, 226, { size: 15, color: '#3d4142' });
  P.text('VOLTS / DIV', 900, 226, { size: 15, color: '#3d4142' });
  P.drawScale(740, 320, 46, { color: '#55595a', ticks: TIME.length });
  P.drawScale(900, 320, 46, { color: '#55595a', ticks: VOLT.length });
  P.drawJack(740, 430, 20, { ring: '#c6a74a' }); P.drawJack(900, 430, 20, { ring: '#5aa9d6' });
  P.text('1', 706, 430, { size: 15, color: '#55595a' }); P.text('2', 866, 430, { size: 15, color: '#55595a' });
}

function build(ws) {
  const s = ws.SPOTS.scope;
  if (s.pad) s.pad.visible = false;
  const g = new THREE.Group();
  g.position.set(s.at[0], s.at[1] + SIZE.h / 2, s.at[2] - SIZE.d / 2 + 0.02);
  g.rotation.y = Math.PI;
  const body = new THREE.Mesh(new RoundedBoxGeometry(SIZE.w, SIZE.h, SIZE.d, 3, 0.012), new THREE.MeshStandardMaterial({ color: 0xe6e8e7, roughness: 0.55 }));
  body.position.z = -SIZE.d / 2; body.castShadow = body.receiveShadow = true; g.add(body);
  // the blue handle, folded back over the top
  const hm = new THREE.MeshStandardMaterial({ color: 0x2f8fcf, roughness: 0.5 });
  const arm = new THREE.BoxGeometry(0.022, 0.016, 0.1), bar = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.016, 0.03, 2, 0.006), hm);
  const handle = new THREE.Group();
  [-1, 1].forEach((sx) => { const a = new THREE.Mesh(arm, hm); a.position.set(sx * 0.12, 0, -0.05); handle.add(a); });
  bar.position.set(0, 0, -0.1); handle.add(bar);
  handle.position.set(0, SIZE.h / 2 + 0.008, -0.03); handle.rotation.x = 0.12;
  handle.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.add(handle);
  feet(g, SIZE);
  const P = makePanel(ws, { w: SIZE.w - 0.012, h: SIZE.h - 0.012, px: 1024, draw: face });
  P.group.position.z = 0.0015; g.add(P.group);
  O.btns = PROBES.map(([id], i) => P.button({ x: 700 + i * 82, y: 116, w: 60, h: 36, color: 0xb8bcbb, litColor: 0xf2d33c, lit: id === O.probe, onPress: () => setProbe(id) }));
  O.time = P.knob({ x: 740, y: 320, r: 38, steps: TIME.length, value: O.t / (TIME.length - 1), color: 0xd8dbda, mark: 0x2a2d2e, span: 140, onChange: (v) => { O.t = Math.round(v * (TIME.length - 1)); } });
  O.volt = P.knob({ x: 900, y: 320, r: 38, steps: VOLT.length, value: O.v / (VOLT.length - 1), color: 0x5aa9d6, mark: 0xf2f2f2, span: 140, onChange: (v) => { O.v = Math.round(v * (VOLT.length - 1)); } });
  P.build();
  // the screen: its own small canvas, redrawn while the workshop is in view
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * (SCR.y1 - SCR.y0) / (SCR.x1 - SCR.x0));
  O.g = c.getContext('2d'); O.tex = new THREE.CanvasTexture(c); O.tex.colorSpace = THREE.SRGBColorSpace;
  const sw = (SCR.x1 - SCR.x0) * P.k, sh = (SCR.y1 - SCR.y0) * P.k;
  O.scr = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: O.tex, toneMapped: false }));
  P.local((SCR.x0 + SCR.x1) / 2, (SCR.y0 + SCR.y1) / 2, 0.0008, O.scr.position);
  P.group.add(O.scr);
  ws.scene.add(g);
  O.P = P; O.parts = [body, P.face, O.scr, ...P.meshes];
  O.buf = new Float32Array(audio.scopeSize());
  draw(ws);
  ws.markShadows();
}

function setProbe(id) {
  O.probe = id;
  O.btns.forEach((b, i) => b.light(PROBES[i][0] === id));
  audio.probe(id);
}
audio.onStart(() => audio.probe(O.probe));

// one sweep: find a rising zero crossing, then draw the next 10 divisions of time
function draw(ws) {
  const g = O.g, W = g.canvas.width, H = g.canvas.height;
  g.fillStyle = '#0a0d0c'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(160,170,165,0.22)'; g.lineWidth = 1;
  for (let i = 1; i < 10; i++) { g.beginPath(); g.moveTo(i * W / 10, 0); g.lineTo(i * W / 10, H); g.stroke(); }
  for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(0, i * H / 8); g.lineTo(W, i * H / 8); g.stroke(); }
  g.strokeStyle = 'rgba(190,200,195,0.45)';
  g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
  const ctx = audio.context();
  const buf = O.buf;
  let n = 0, start = 0, peak = 0;
  if (ctx) {
    if (buf.length !== audio.scopeSize()) O.buf = new Float32Array(audio.scopeSize());
    audio.scope(O.buf);
    n = Math.min(O.buf.length - 2, Math.round(TIME[O.t] * 10 * ctx.sampleRate / 1000));
    for (let i = 0; i < O.buf.length; i++) peak = Math.max(peak, Math.abs(O.buf[i]));
    const lvl = peak * 0.05;
    for (let i = 1; i < O.buf.length - n; i++) if (O.buf[i - 1] < lvl && O.buf[i] >= lvl) { start = i; break; }
  }
  const vs = (H / 8) / VOLT[O.v], mid = H / 2;
  const y = (v) => Math.max(-4, Math.min(H + 4, mid - v * vs));
  g.lineJoin = 'round';
  const path = () => {
    g.beginPath();
    if (!n || peak < 1e-4) { const t = performance.now() / 1000; for (let x = 0; x <= W; x += 4) g.lineTo(x, mid + Math.sin(x * 0.7 + t * 40) * 0.6); return; }
    const per = n / W;
    for (let x = 0; x <= W; x++) {
      const a = start + Math.floor(x * per), b = Math.max(a + 1, start + Math.floor((x + 1) * per));
      if (per <= 1.5) { g.lineTo(x, y(O.buf[a])); continue; }
      let lo = Infinity, hi = -Infinity; for (let i = a; i < b; i++) { const v = O.buf[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
      g.lineTo(x, y(hi)); if (hi - lo > 1e-3) g.lineTo(x, y(lo));
    }
  };
  path(); g.strokeStyle = 'rgba(242,211,60,0.25)'; g.lineWidth = 6; g.stroke();
  g.strokeStyle = '#f6dc55'; g.lineWidth = 2; g.stroke();
  g.font = '600 15px ui-monospace, Menlo, monospace'; g.textBaseline = 'top';
  g.fillStyle = '#f2d33c'; g.fillRect(8, 8, 34, 20); g.fillStyle = '#0a0d0c'; g.fillText('1', 19, 10);
  g.fillStyle = '#f2d33c'; g.fillText(PROBES.find((p) => p[0] === O.probe)[1], 50, 10);
  g.fillStyle = '#d8dcda'; g.textAlign = 'right';
  g.fillText((ctx && peak >= 1e-4) ? 'TRIG ' + (start ? '↑' : 'AUTO') : 'NO SIGNAL', W - 8, 10);
  g.textAlign = 'left'; g.textBaseline = 'bottom';
  g.fillText(VOLT[O.v] + ' V/div', 8, H - 8);
  g.textAlign = 'right'; g.fillText(TIME[O.t] + ' ms/div', W - 8, H - 8); g.textAlign = 'left';
  O.tex.needsUpdate = true;
}

register({
  id: 'scope', label: 'Oscilloscope', sound: true,
  pick: () => O.parts,
  view: { at: [11.55, 3.94 + 0.11, -0.66], from: [0, 0.3, -1], size: 0.52 },
  hint: 'This is the sound as a wave. Try the knobs and the INPUT buttons',
  setup: build,
  update(dt, now, s, ws) {
    if (!O.P || !s.inside) return;
    if (!s.open && (++O.frame % 3)) return;            // in passing: every third frame is enough
    draw();
  },
  pointer: (type, ev, ws) => { if (type === 'down') ws.sound(); return O.P.pointer(type, ev); },
  key(ev) {
    const k = ev.key;
    if (k >= '1' && k <= '4') { setProbe(PROBES[+k - 1][0]); return true; }
    if (k === 'ArrowLeft') { O.time.set(O.time.value - 0.2); return true; }
    if (k === 'ArrowRight') { O.time.set(O.time.value + 0.2); return true; }
    if (k === 'ArrowUp') { O.volt.set(O.volt.value + 0.2); return true; }
    if (k === 'ArrowDown') { O.volt.set(O.volt.value - 0.2); return true; }
    return false;
  },
});
