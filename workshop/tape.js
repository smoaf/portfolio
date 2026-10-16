// --- The tape delay (WORKSHOP_PLAN phase W3, front of the desk): Simon's own instrument, after his
// prototype poster. Clear acrylic plates on standoffs show everything: a tape loop, the motor and
// capstan, the erase head, the record head and five playback heads in a row, boards and wires
// (workshop/tape-props.js). A card beside it tells where it comes from (the EPOCH installation).
//
// Controls on the top plate:
//   POWER          on/off (off: the tape runs down and the delay lets the sound through clean)
//   HEADS 1-5      each playback head on/off (also a click on the head itself); panned left to right
//   ERASE          the erase head on/off: off, every turn of the tape is recorded over the last one
//                  (sound on sound); the saturation keeps it from ever getting loud
//   SPEED          motor speed: delay time and pitch, like real tape (the echoes bend while it moves)
//   FEEDBACK, MIX  repeats; dry/wet
// Wear (wow and flutter, hiss, dropouts, a duller tone) grows the longer the tape runs (48 hours in
// about four minutes; the counter on the plate shows the hours); "Fresh tape" and "Run 48 h" in the bar.
// Input: a demo loop made in the browser (until Simon's own recording is there), or the shared chain
// (synth ─► fuzz ─► delay ─► amp). The delay sits in the chain's 'delay' slot; until a visitor
// switches it, it is on only while this station is open, so the synth stays dry elsewhere.
// The recorded sound shows on the tape as an amber glow: written at the record head, wiped at the
// erase head, heard each time it passes a playback head that is on.
// Keys: 1-5 heads, E erase, O power, ← → speed, ↑ ↓ feedback, P play/stop the demo, S synth, N fresh tape.
import * as THREE from 'three';
import { register, makePanel, bar, kit, cable, mat, workshop } from './stations.js';
import * as audio from './audio.js';
import { createTape, demoLoop } from './tape-audio.js';
import { CASE, BASE, TAPE, HEADS, CARD, acrylicCase, tapeLoop, mechanics, card } from './tape-props.js';

const DEV = { x: 0.1, z: -0.02 };                      // the device on the bench (bench-local: x to the visitor's right, z towards them)
const WEAR_SECONDS = 240;                              // running time to a fully worn tape ("48 hours")
const F = {
  ws: null, bench: null, dev: null, C: null, P: null, parts: [], props: {}, bar: null, view: 'delay', active: null, tap: null,
  power: true, touched: false, live: false, speedK: 0.5, feedback: 0.4, mix: 0.5, erase: true, on: [true, false, true, false, true],
  wear: 0, source: 'demo', playing: true, fx: null, src: null, gate: null, buf: new Float32Array(512),
  vis: 0, p: 0, lastIdx: null, lastErase: null, ledT: 0, wearSent: 0, counterT: 0, levelHold: 0,
};
const speedOf = (k) => Math.pow(2, (k - 0.5) * 2.4); // knob 0..1 → ×0.44 .. ×2.3

// ---- views (bench frame → world: the bench is turned to face the visitor)
const W = (x, y, z) => [F.C[0] - x, F.C[1] + y, F.C[2] - z];
const D = (x, y, z) => [-x, y, -z];
const tall = () => innerWidth < innerHeight;
function frame(v) {                                    // phones: the subject sits higher, above the bar
  if (!tall()) return v;
  const dir = new THREE.Vector3(...v.from).normalize(), up = new THREE.Vector3(0, 1, 0).addScaledVector(dir, -dir.y).normalize();
  return { ...v, at: new THREE.Vector3(...v.at).addScaledVector(up, -v.size * 0.17).toArray() };
}
const VIEWS = {
  delay: { label: 'Tape delay', get v() { return { at: W(DEV.x, 0.07, DEV.z + 0.01), from: D(0, 1.2, 1), size: tall() ? 0.46 : 0.56 }; },
    text: 'A loop of tape runs past a record head and five playback heads. Every head you switch on adds an echo, from left to right across the stereo field.' },
  heads: { label: 'Heads', get v() { return { at: W(DEV.x - 0.03, TAPE.y, DEV.z + TAPE.z - 0.01), from: D(0, 0.75, 1), size: tall() ? 0.2 : 0.26 }; },
    text: 'Left to right: erase head, record head, five playback heads. The glow on the tape is the recorded sound: you hear an echo each time it passes a head that is on.' },
  card: { label: 'Story', get v() { return { at: F.cardAt, from: F.cardN, size: tall() ? 0.18 : 0.3 }; },
    text: 'Simon built it for the video installation EPOCH, where the tape ran nonstop for two days.' },
};
const ORDER = ['delay', 'heads', 'card'];

// ---- the top plate: labels on the clear acrylic (label-maker strips, thin green guide lines);
// canvas pixels map onto the plate: x along its width, y from the back edge to the front
const PX = 1024, PH = Math.round(PX * CASE.d / CASE.w);
const cx = (x) => (x / CASE.w + 0.5) * PX, cy = (z) => (z / CASE.d + 0.5) * PH;
const LAYOUT = {
  power: [-0.168, -0.112], heads: [-0.075, -0.03, 0.015, 0.06, 0.105], headsZ: -0.112, ledZ: -0.134,
  erase: [0.168, -0.112], speed: [0.163, -0.03], feedback: [0.163, 0.062], mix: [0.098, 0.118], counter: [0.072, -0.048],
};
function plateFace(g, P) {
  g.clearRect(0, 0, P.W, P.H);
  const tapeLabel = (s, x, y, size = 15) => {
    g.font = `700 ${size}px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`;
    const w = g.measureText(s).width + size * 1.1, h = size * 1.6;
    g.fillStyle = '#121212'; g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, 3); g.fill();
    g.fillStyle = '#f4f2ec'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, x, y + 1);
  };
  g.strokeStyle = 'rgba(46,160,96,0.85)'; g.lineWidth = 3;
  // the heads' bracket
  const hx0 = cx(LAYOUT.heads[0]) - 24, hx1 = cx(LAYOUT.heads[4]) + 24, hy = cy(LAYOUT.headsZ) + 40;
  g.beginPath(); g.moveTo(hx0, hy - 12); g.lineTo(hx0, hy); g.lineTo(hx1, hy); g.lineTo(hx1, hy - 12); g.stroke();
  tapeLabel('PLAYBACK HEADS', (hx0 + hx1) / 2, hy + 4, 14);
  LAYOUT.heads.forEach((x, i) => { g.font = '700 17px ui-monospace, Menlo, Consolas, monospace'; g.fillStyle = 'rgba(46,160,96,1)'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), cx(x) + 26, cy(LAYOUT.ledZ)); });
  tapeLabel('POWER', cx(LAYOUT.power[0]), cy(LAYOUT.power[1]) + 46);
  tapeLabel('ERASE', cx(LAYOUT.erase[0]), cy(LAYOUT.erase[1]) + 46);
  tapeLabel('SPEED', cx(LAYOUT.speed[0]), cy(LAYOUT.speed[1]) + 78);
  tapeLabel('FEEDBACK', cx(LAYOUT.feedback[0]), cy(LAYOUT.feedback[1]) + 78);
  tapeLabel('MIX', cx(LAYOUT.mix[0]) - 66, cy(LAYOUT.mix[1]));
  tapeLabel('TAPE HOURS', cx(LAYOUT.counter[0]), cy(LAYOUT.counter[1]) + 34, 13);
  tapeLabel('IN', cx(-0.168), cy(0.12), 13); tapeLabel('OUT', cx(-0.132), cy(0.12), 13);
  // speed scale: slow ─ fast
  P.drawScale(cx(LAYOUT.speed[0]), cy(LAYOUT.speed[1]), 58, { color: 'rgba(46,160,96,1)', ticks: 9 });
  P.drawScale(cx(LAYOUT.feedback[0]), cy(LAYOUT.feedback[1]), 58, { color: 'rgba(46,160,96,1)', ticks: 9 });
  P.drawScale(cx(LAYOUT.mix[0]), cy(LAYOUT.mix[1]), 38, { color: 'rgba(46,160,96,1)', ticks: 5 });
  g.font = '700 13px ui-monospace, Menlo, Consolas, monospace'; g.fillStyle = 'rgba(46,160,96,1)'; g.textAlign = 'center';
  g.fillText('SLOW', cx(LAYOUT.speed[0]) - 62, cy(LAYOUT.speed[1]) + 74); g.fillText('FAST', cx(LAYOUT.speed[0]) + 62, cy(LAYOUT.speed[1]) + 74);
  g.fillText('ON', cx(LAYOUT.power[0]), cy(LAYOUT.power[1]) - 38); g.fillText('ON', cx(LAYOUT.erase[0]), cy(LAYOUT.erase[1]) - 38);
}

// toggle switches: hex nut, threaded collar, a bat lever that flips (up = towards the back = on)
function toggle(P, x, z, onFlip) {
  const steel = mat(0xd8dadd, { metalness: 0.9, roughness: 0.22 });
  const t = new THREE.Group(); P.local(cx(x), cy(z), 0, t.position); P.group.add(t);
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.003, 6), steel); nut.rotation.x = Math.PI / 2; nut.position.z = 0.0015; t.add(nut);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.005, 16), steel); col.rotation.x = Math.PI / 2; col.position.z = 0.0055; t.add(col);
  const piv = new THREE.Group(); piv.position.z = 0.008; t.add(piv);
  const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.0013, 0.0019, 0.017, 10), steel); bat.rotation.x = -Math.PI / 2; bat.position.z = 0.0085; piv.add(bat);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0019, 10, 8), steel); tip.position.z = 0.017; piv.add(tip);
  [nut, col, bat, tip].forEach((m) => { m.castShadow = true; });
  const c = { kind: 'toggle', x: cx(x), y: cy(z), r: 30, on: true, piv, meshes: [nut, col, bat, tip], onFlip };
  c.set = (on) => { c.on = on; piv.rotation.x = on ? -0.45 : 0.45; };   // tilted to the back (the plate's +y) = on
  c.set(true);
  return c;
}

// ---- building it
function build(ws) {
  F.ws = ws;
  const s = ws.SPOTS.tape;
  if (s.pad) s.pad.visible = false;
  F.C = [s.at[0], s.at[1], s.at[2]];
  const bench = new THREE.Group(); bench.position.set(...F.C); bench.rotation.y = Math.PI; F.bench = bench;
  const dev = new THREE.Group(); dev.position.set(DEV.x, 0, DEV.z); bench.add(dev); F.dev = dev;
  const box = acrylicCase(dev);
  const loop = tapeLoop(dev); F.loop = loop;
  const mech = mechanics(dev, loop); F.mech = mech;
  // where the heads sit along the loop (metres from its start), and the delay geometry for the sound
  const z = TAPE.z;
  F.sRec = loop.sAt(HEADS.rec, z); F.sErase = loop.sAt(HEADS.erase, z);
  F.sPlay = HEADS.play.map((x) => loop.sAt(x, z));
  F.geo = { heads: F.sPlay.map((sp) => ((sp - F.sRec) + loop.L) % loop.L), loop: loop.L, v0: TAPE.v0 };
  // the top plate's controls
  const P = makePanel(ws, { w: CASE.w, h: CASE.d, px: PX, draw: plateFace, faceMat: { transparent: true, depthWrite: false, roughness: 0.4, emissiveIntensity: 0.08 } });
  P.group.rotation.x = -Math.PI / 2; P.group.position.y = CASE.top + CASE.t + 0.0004; P.face.renderOrder = 2; dev.add(P.group);
  F.P = P;
  const red = 0xc8231f;
  F.kSpeed = P.knob({ x: cx(LAYOUT.speed[0]), y: cy(LAYOUT.speed[1]), r: 58, value: F.speedK, color: red, mark: 0xf6f2ea, tall: 0.9, span: 200, onChange: (v) => { F.speedK = v; apply(); } });
  F.kFb = P.knob({ x: cx(LAYOUT.feedback[0]), y: cy(LAYOUT.feedback[1]), r: 58, value: F.feedback, color: red, mark: 0xf6f2ea, tall: 0.9, span: 200, onChange: (v) => { F.feedback = v; apply(); } });
  F.kMix = P.knob({ x: cx(LAYOUT.mix[0]), y: cy(LAYOUT.mix[1]), r: 38, value: F.mix, color: 0x161616, mark: 0xf6f2ea, tall: 0.9, span: 170, onChange: (v) => { F.mix = v; apply(); } });
  F.bHeads = LAYOUT.heads.map((x, i) => P.button({ x: cx(x), y: cy(LAYOUT.headsZ), w: 40, h: 40, color: 0x2a2a2c, litColor: 0xf0a020, lit: F.on[i], depth: 1.2, onPress: () => setHead(i, !F.on[i]) }));
  F.leds = LAYOUT.heads.map((x) => P.led({ x: cx(x), y: cy(LAYOUT.ledZ), r: 8, color: 0xff8a1a }));
  F.eraseLed = P.led({ x: cx(LAYOUT.erase[0]) + 34, y: cy(LAYOUT.erase[1]) - 20, r: 7, color: 0xff2a1f });
  F.powerLed = P.led({ x: cx(LAYOUT.power[0]) + 34, y: cy(LAYOUT.power[1]) - 20, r: 7, color: 0x3ee070 });
  P.build();
  F.tPower = toggle(P, LAYOUT.power[0], LAYOUT.power[1], () => setPower(!effectiveOn()));
  F.tErase = toggle(P, LAYOUT.erase[0], LAYOUT.erase[1], () => setErase(!F.erase));
  F.toggles = [F.tPower, F.tErase];
  // the tape-hours counter: a small red LED display on its own board
  const cc = document.createElement('canvas'); cc.width = 256; cc.height = 72;
  F.counter = { g: cc.getContext('2d'), tex: new THREE.CanvasTexture(cc) }; F.counter.tex.colorSpace = THREE.SRGBColorSpace;
  const cw = 0.056, ch = cw * 72 / 256;
  const cboard = new THREE.Mesh(new THREE.BoxGeometry(cw + 0.008, 0.0016, ch + 0.008), mat(0x1f6b3a)); P.local(cx(LAYOUT.counter[0]), cy(LAYOUT.counter[1]), 0.001, cboard.position); cboard.rotation.x = Math.PI / 2; P.group.add(cboard);
  const cscr = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch), new THREE.MeshBasicMaterial({ map: F.counter.tex, toneMapped: false }));
  P.local(cx(LAYOUT.counter[0]), cy(LAYOUT.counter[1]), 0.0021, cscr.position); P.group.add(cscr);
  drawCounter();
  // the card
  const cd = card(bench); F.cardMeshes = cd.meshes;
  ws.scene.add(bench); bench.updateMatrixWorld(true);
  const n = new THREE.Vector3(0, 0, 1).transformDirection(cd.face.matrixWorld);
  F.cardAt = cd.face.localToWorld(new THREE.Vector3(0, 0, 0)).toArray(); F.cardN = n.add(new THREE.Vector3(0, 0.15, 0)).toArray();
  // cables: IN from below the desk's front edge (from the pedal), OUT across the desk to the amp,
  // and the power lead off the back
  F.cables = buildCables(bench, mech);
  F.props = {
    device: [...box.meshes, P.face, ...P.meshes, ...F.toggles.flatMap((t) => t.meshes), cboard, cscr, ...mech.meshes, ...mech.spin.map((s) => s.mesh), loop.mesh, mech.heads.erase, mech.heads.rec],
    heads: mech.heads.play,
    card: cd.meshes,
  };
  F.parts = [...F.props.device, ...F.props.heads, ...F.props.card];   // (not the cables: they reach the floor and the amp)
  F.bar = makeBar(ws);
  paintState();
  ws.markShadows();
}
function buildCables(bench, mech) {
  const K = kit('tape-cables'), black = mat(0x18181a, { roughness: 0.6 }), red = mat(0xb8262a, { roughness: 0.5 });
  const toBench = (v) => v.clone().add(new THREE.Vector3(DEV.x, 0, DEV.z));
  const jin = toBench(mech.jacks.in), jout = toBench(mech.jacks.out);
  const front = F.C[2] - (-1.6);                       // the desk's front edge, in bench z (DESK.front)
  // where the pedal's cable lies on the floor, if the solder bench is there (else from below the edge)
  let floor = [-0.78, -0.928, front + 0.17];
  const sol = workshop.get('solder'), ped = sol && sol.state && sol.state.ped;
  if (ped && sol.state.C) {
    const o = ped.jacks.out, wx = sol.state.C[0] - (o.x + 0.6), wz = sol.state.C[2] - 0.45;   // the end of its cable (see solder.js)
    floor = [F.C[0] - wx, -0.928, F.C[2] - wz];
  }
  const plug = (p) => { K.add(new THREE.CylinderGeometry(0.0055, 0.0055, 0.024, 16), black, [p.x, p.y, p.z + 0.012], [Math.PI / 2, 0, 0]); K.add(new THREE.CylinderGeometry(0.0035, 0.0045, 0.01, 12), black, [p.x, p.y, p.z + 0.029], [Math.PI / 2, 0, 0]); };
  plug(jin); plug(jout);
  K.add(cable([[jin.x, jin.y, jin.z + 0.034], [jin.x, 0.006, jin.z + 0.07], [jin.x - 0.08, 0.0035, front - 0.06], [jin.x - 0.2, 0.0035, front - 0.02], [jin.x - 0.24, -0.012, front + 0.012], [jin.x - 0.25, -0.3, front + 0.03], [floor[0] + 0.12, -0.8, floor[2] - 0.05], [floor[0] + 0.03, -0.925, floor[2] - 0.01], floor], 0.0028, black, 80), black);
  // OUT: round the left side and back across the desk to the amp's side
  const ampSide = [F.C[0] - 9.86, 0.03, F.C[2] - (-0.7)];
  K.add(cable([[jout.x, jout.y, jout.z + 0.034], [jout.x + 0.01, 0.005, jout.z + 0.08], [jout.x - 0.09, 0.0035, jout.z + 0.05], [-0.2, 0.0035, -0.1], [-0.3, 0.0035, -0.32], [ampSide[0] + 0.03, 0.0035, ampSide[2] + 0.04], [ampSide[0] + 0.004, 0.018, ampSide[2]], ampSide], 0.0028, red, 70), red);
  // power lead from the DC socket at the back left, off the desk's back edge between synth and amp
  const back = F.C[2] - (-0.35);
  const dc = toBench(new THREE.Vector3(-0.17, BASE + 0.006, -0.142));
  K.add(cable([[dc.x, dc.y, dc.z], [dc.x, 0.004, dc.z - 0.03], [dc.x - 0.1, 0.0035, dc.z - 0.12], [-0.37, 0.0035, -0.5], [-0.39, 0.0035, back + 0.03], [-0.39, -0.012, back - 0.004], [-0.39, -0.3, back - 0.01]], 0.0022, black, 60), black);
  return K.build(bench);
}

// ---- the bar: views, input, tape
function makeBar(ws) {
  const b = bar('ws-tape');
  b.el.setAttribute('aria-label', 'Tape delay');
  b.el.innerHTML = ORDER.map((id) => `<button type="button" class="btn" data-v="${id}">${VIEWS[id].label}</button>`).join('')
    + '<span class="grp"><span class="lbl">Input</span><button type="button" class="btn" data-a="demo">Demo loop</button><button type="button" class="btn" data-a="synth">Synth</button></span>'
    + '<span class="grp"><span class="lbl">Tape</span><button type="button" class="btn" data-a="fresh">Fresh tape</button><button type="button" class="btn" data-a="age">Run 48 h</button></span>'
    + '<div class="msg" aria-live="polite"></div>';
  b.el.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    ws.sound();
    if (t.dataset.v) show(t.dataset.v);
    const a = t.dataset.a;
    if (a === 'demo') setPlaying(!(F.source === 'demo' && F.playing));
    if (a === 'synth') setSource('synth');
    if (a === 'fresh') setWear(0, 'A fresh loop of tape: clean, steady, quiet.');
    if (a === 'age') setWear(1, 'Two days later: the tape wobbles (wow and flutter), hisses and drops out, like the loop at EPOCH.');
  });
  const st = document.createElement('style');
  st.textContent = '.ws-tape .grp { display: inline-flex; align-items: center; gap: 6px; } .ws-tape .msg { max-width: 600px; margin: 0 auto; } .ws-tape .msg .ph { opacity: 0.6; font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; margin-left: 6px; white-space: nowrap; }';
  document.head.appendChild(st);
  return b;
}
function caption(text, mark = 'Placeholder text') {
  const m = F.bar.el.querySelector('.msg');
  m.innerHTML = '';
  if (text) { const t = document.createElement('span'); t.textContent = text; const ph = document.createElement('span'); ph.className = 'ph'; ph.textContent = mark; m.append(t, ph); }
  F.bar.fit();
}
function show(id, fly = true) {
  F.view = id;
  F.bar.el.querySelectorAll('[data-v]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === id)));
  caption(VIEWS[id].text);
  if (fly) F.ws.fly(frame(VIEWS[id].v));
}
function paintBar() {
  if (!F.bar) return;
  const q = (a) => F.bar.el.querySelector(`[data-a="${a}"]`);
  q('demo').setAttribute('aria-pressed', String(F.source === 'demo' && F.playing));
  q('demo').textContent = F.source === 'demo' && F.playing ? 'Demo loop ■' : 'Demo loop ▶';
  q('synth').setAttribute('aria-pressed', String(F.source === 'synth'));
}

// ---- state → sound and lights
function effectiveOn() { return F.touched ? F.power : F.live; }
function apply() {
  if (F.fx) F.fx.set({ speed: speedOf(F.speedK), run: effectiveOn(), power: effectiveOn(), feedback: F.feedback, mix: F.mix, erase: F.erase, on: F.on });
}
function paintState() {
  const on = effectiveOn();
  F.tPower.set(on); F.tErase.set(F.erase);
  F.powerLed.set(on ? 1 : 0); F.eraseLed.set(F.erase && on ? 1 : 0);
  F.bHeads.forEach((b, i) => b.light(F.on[i]));
  F.P.syncLeds();
  const em = F.mech.heads.erase.material; em.emissive.setHex(F.erase && on ? 0x7a1208 : 0x000000);
  paintBar();
}
function setHead(i, on) { F.on[i] = on; apply(); paintState(); }
function setErase(on) {
  F.erase = on; apply(); paintState();
  caption(on ? 'Erase head on: the tape is wiped before each new recording, so the echoes fade away.' : 'Erase head off: nothing is wiped, every turn of the tape is recorded over the last one. Sound on sound: let it build, then switch it back on.');
}
function setPower(on) { F.power = on; F.touched = true; apply(); paintState(); if (F.fx) clickSound(); }
function setWear(w, text) { F.wear = w; F.wearSent = -1; if (F.fx) F.fx.set({ wear: F.wear }); drawCounter(); if (text) caption(text); }
function clickSound() {
  const ctx = audio.context(); if (!ctx) return;
  const n = ctx.createBufferSource(), b = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.015), ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 5) * 0.2;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 1.4;
  n.buffer = b; n.connect(f); f.connect(audio.slot('amp').in); n.start();
}
function drawCounter() {
  const { g, tex } = F.counter;
  g.fillStyle = '#190404'; g.fillRect(0, 0, 256, 72);
  g.font = '700 54px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace'; g.textAlign = 'right'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,40,30,0.12)'; g.fillText('88.8', 200, 38);
  g.fillStyle = '#ff3b2a'; g.fillText((F.wear * 48).toFixed(1), 200, 38);
  g.font = '700 26px system-ui, Arial, sans-serif'; g.textAlign = 'left'; g.fillText('h', 210, 44);
  tex.needsUpdate = true;
}

// ---- sound: the delay in the chain's 'delay' slot, the demo loop straight into it
audio.onStart((ctx) => {
  F.fx = createTape(ctx, F.geo || { heads: [0.03, 0.055, 0.08, 0.105, 0.13], loop: 0.95, v0: TAPE.v0 });
  F.gate = ctx.createGain(); F.gate.connect(F.fx.input);
  audio.slot('delay').insert(F.gate, F.fx.output);
  F.fx.set({ wear: F.wear });
  apply();
  F.src = null;
  if (F.live) route();
});
audio.onDispose(() => { if (F.fx) F.fx.stop(); F.fx = null; F.src = null; F.gate = null; F.live = false; });
// what goes in: the demo loop (the chain held back at the delay), or the chain (the synth)
function route() {
  const ctx = audio.context(); if (!ctx || !F.fx) return;
  const demo = F.live && F.source === 'demo';
  F.gate.gain.setTargetAtTime(demo ? 0 : 1, ctx.currentTime, 0.03);
  if (demo && F.playing && !F.src) {
    const src = ctx.createBufferSource(); src.buffer = demoLoop(ctx); src.loop = true;
    const g = ctx.createGain(); g.gain.value = 0.9; src.connect(g); g.connect(F.fx.input);
    src.start(ctx.currentTime + 0.05); F.src = src;
  } else if ((!demo || !F.playing) && F.src) { const s = F.src; F.src = null; try { s.stop(); } catch (e) { /* already stopped */ } s.disconnect(); }
}
function setPlaying(on) { F.playing = on; if (on) F.source = 'demo'; route(); paintBar(); }
function setSource(id) {
  F.source = id;
  if (id === 'synth') { F.playing = false; caption('Now the modular synth (through the fuzz pedal, if it is on) plays into the tape. Try the heads on its bleeps.'); }
  route(); paintBar();
}

// ---- pointer: toggles, the plate's knobs and buttons, the heads themselves; a click on a thing flies to it
function pointer(type, ev, ws) {
  const P = F.P;
  if (type === 'down') {
    ws.sound();
    F.tap = { x: ev.clientX, y: ev.clientY };
    if (F.view === 'card') return false;
    const t = P.hit(ev, F.toggles);
    if (t) { t.onFlip(); F.active = null; return true; }
    if (P.pointer('down', ev)) { F.active = P; return true; }
    const h = headAt(ev, ws);
    if (h >= 0) { setHead(h, !F.on[h]); return true; }
    return false;
  }
  if (type === 'move') {
    if (F.active) return F.active.pointer('move', ev);
    if (F.view !== 'card') {
      const c = P.hit(ev, [...F.toggles, ...P.knobs, ...P.buttons]);
      if (c) { ws.el.style.cursor = c.kind === 'knob' ? 'ns-resize' : 'pointer'; return false; }
      if (headAt(ev, ws) >= 0) { ws.el.style.cursor = 'pointer'; return false; }
    }
    ws.el.style.cursor = propAt(ev, ws) ? 'zoom-in' : '';
    return false;
  }
  if (type === 'up') {
    const still = F.tap && Math.hypot(ev.clientX - F.tap.x, ev.clientY - F.tap.y) < 8;
    F.tap = null;
    if (F.active) { const p = F.active; F.active = null; return p.pointer('up', ev); }
    if (still) { const id = propAt(ev, ws); if (id && id !== F.view) show(id); }
    return false;
  }
  return false;
}
function headAt(ev, ws) {
  const r = ws.ray(ev).intersectObjects(F.mech.heads.play, false)[0];
  return r ? F.mech.heads.play.indexOf(r.object) : -1;
}
function propAt(ev, ws) {
  const r = ws.ray(ev);
  const hc = r.intersectObjects(F.props.card, false)[0], hd = r.intersectObjects([...F.props.device, ...F.props.heads], false)[0];
  if (hc && (!hd || hc.distance < hd.distance)) return 'card';
  return hd ? 'delay' : null;
}

// ---- every frame: motor, tape, rollers, the sound on the tape, lights, wear
function update(dt, now, s) {
  if (!F.P) return;
  const live = s.inside && s.focus === 'tape';
  if (live !== F.live) { F.live = live; apply(); paintState(); route(); }
  if (!s.inside) return;
  const on = effectiveOn() && audio.running();
  // the motor: ramps up and runs down like the audio (time constants as in tape-audio.js)
  const target = on ? speedOf(F.speedK) : 0;
  F.vis += (target - F.vis) * (1 - Math.exp(-dt / (on ? 0.25 : 0.4)));
  const ds = TAPE.v0 * F.vis * dt, L = F.loop.L;
  F.p = (F.p + ds) % L;
  F.mech.spin.forEach((r) => { r.mesh.rotation.y -= ds / r.r; });
  const off = -F.p / L;
  F.loop.base.offset.x = off; F.loop.sig.offset.x = off;
  // write what the record head records; wipe at the erase head
  const N = F.loop.N, d = F.loop.data;
  const at = (sv) => Math.floor((((sv - F.p) / L) % 1 + 1) % 1 * N) % N;
  let lvl = 0;
  if (F.fx && on) { const r = F.fx.level(F.buf); lvl = Math.min(1, Math.pow(r * 3.2, 1.6)); }
  F.levelHold = Math.max(lvl, F.levelHold - dt * 6);
  const idx = at(F.sRec), ie = at(F.sErase);
  const span = (from, to, fn) => {                    // texels the head passed this frame (the tape moves towards lower indices)
    if (from === null) { fn(to); return; }
    let n = (from - to + N) % N; if (n > N / 2) n = 0;
    for (let k = 0; k <= n; k++) fn((to + k) % N);
  };
  if (ds > 0) {
    if (F.erase) span(F.lastErase, ie, (i) => { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 0; });
    const v = F.levelHold;
    span(F.lastIdx, idx, (i) => {
      const old = d[i * 4] / 255, nv = F.erase ? v : Math.max(v, old * 0.8);
      d[i * 4] = Math.round(255 * Math.min(1, nv * 1.0)); d[i * 4 + 1] = Math.round(255 * Math.min(1, nv * 0.55)); d[i * 4 + 2] = Math.round(255 * nv * 0.12);
    });
    F.loop.sig.needsUpdate = true;
  }
  F.lastIdx = idx; F.lastErase = ie;
  // the head LEDs show what each playback head hears
  F.leds.forEach((l, i) => l.set(F.on[i] && on ? 0.3 + 0.7 * (d[at(F.sPlay[i]) * 4] / 255) : 0));
  F.P.syncLeds();
  // wear grows while it runs; dropouts get likelier
  if (on && F.vis > 0.1) {
    F.wear = Math.min(1, F.wear + dt / WEAR_SECONDS);
    if (F.fx && Math.random() < F.wear * F.wear * 0.9 * dt) F.fx.dropout(0.04 + Math.random() * 0.12, 0.05 + Math.random() * 0.25);
  }
  if (F.fx && Math.abs(F.wear - F.wearSent) > 0.02) { F.wearSent = F.wear; F.fx.set({ wear: F.wear }); }
  if ((F.counterT -= dt) <= 0) { F.counterT = 0.5; drawCounter(); }
  // a worn tape looks it: duller, a little lighter
  F.loop.mat.roughness = 0.35 + F.wear * 0.4;
}

register({
  id: 'tape', label: 'Tape delay', sound: true,
  pick: () => F.parts,
  get view() { return F.C ? frame(VIEWS.delay.v) : { at: [9.25, 4.0, -1.3], from: [0, 1.2, -1], size: 0.56 }; },
  hint: 'Switch the heads 1-5 on and off, turn SPEED. Flip ERASE off for endless layers',
  keys: '1-5 heads, E erase, O power, ← → speed, ↑ ↓ feedback, P demo, S synth, N fresh tape',
  setup: build,
  enter() { F.bar.show(true); show('delay', false); paintBar(); },
  exit() { F.bar.show(false); F.active = null; F.tap = null; if (F.P) F.P.drag = null; },
  update,
  pointer,
  key(ev) {
    const k = ev.key.toLowerCase();
    if (k >= '1' && k <= '5') { setHead(+k - 1, !F.on[+k - 1]); return true; }
    if (k === 'e') { setErase(!F.erase); return true; }
    if (k === 'o') { setPower(!effectiveOn()); return true; }
    if (k === 'p') { setPlaying(!(F.source === 'demo' && F.playing)); return true; }
    if (k === 's') { setSource('synth'); return true; }
    if (k === 'n') { setWear(0, 'A fresh loop of tape: clean, steady, quiet.'); return true; }
    if (k === 'arrowright') { F.kSpeed.set(F.kSpeed.value + 0.05); return true; }
    if (k === 'arrowleft') { F.kSpeed.set(F.kSpeed.value - 0.05); return true; }
    if (k === 'arrowup') { F.kFb.set(F.kFb.value + 0.05); return true; }
    if (k === 'arrowdown') { F.kFb.set(F.kFb.value - 0.05); return true; }
    return false;
  },
  state: F, show, setHead, setErase, setPower, setWear, setSource, setPlaying,   // test hooks
});
