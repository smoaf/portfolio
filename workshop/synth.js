// --- Modular synth (WORKSHOP_PLAN phase W1, electronics station at the back of the desk): a small
// two-row case of modules in a wooden skiff, after the reference photo (mixed panel colours, coloured
// patch cables). The sound lives in workshop/synth-audio.js; this file is the case, the panel, the
// cables and the controls.
//   Top row (sound sources and movement): SEQUENCER (8 steps), OSC 1, OSC 2, NOISE, LFO, ENVELOPE
//   Bottom row (shaping it): MIXER, FILTER, VCA, CHORUS, REVERB, OUTPUT (into the shared chain)
// Knobs turn by dragging up/down. Cables: drag from any jack to another (OUT = dark square, IN =
// plain); pull a cable off an IN and drop it anywhere to remove it. Presets and "Clear" sit in a bar
// along the bottom. It plays while any electronics station is open and falls silent in the overview.
// Phones (portrait): the view shows half the case; swipe the panel or use ‹ › to slide along.
import * as THREE from 'three';
import { register, makePanel, bar } from './stations.js';
import * as audio from './audio.js';
import { createEngine, SEQ_NOTES } from './synth-audio.js';

const PW = 0.64, PH = 0.4, TILT = THREE.MathUtils.degToRad(32);
const CANVAS = 2048, ROW = 640;                         // canvas: 2048 × 1280, two rows of 640
const LISTEN = new Set(['synth', 'amp', 'scope', 'solder', 'tape']);   // stations the synth keeps playing for
const INK = { dark: '#1d1b18', light: '#ece8df' };
const PANEL = { black: ['#1e1e20', INK.light], silver: ['#d5d6d4', INK.dark], white: ['#eceae4', INK.dark], pink: ['#d6559a', '#fff4fa'], mint: ['#8fcfbd', INK.dark], navy: ['#26364f', INK.light] };

// ---- the modules: width in units, panel colour and controls (x as a fraction of the module, y in px within the row)
const MODS = [
  [
    { id: 'seq', name: 'SEQUENCER', w: 2.0, panel: 'black', ctl: [
      ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap((i) => {
        const x = 0.075 + i * 0.121;
        return [{ t: 'knob', id: 'seq.n' + i, x, y: 185, r: 30, steps: SEQ_NOTES, label: String(i + 1) },
          { t: 'step', id: 'seq.s' + i, i, x, y: 296 }, { t: 'led', id: 'seq.l' + i, x, y: 356 }];
      }),
      { t: 'knob', id: 'seq.tempo', x: 0.1, y: 470, r: 40, label: 'TEMPO' },
      { t: 'knob', id: 'seq.len', x: 0.27, y: 470, r: 32, label: 'LENGTH' },
      { t: 'run', id: 'seq.run', x: 0.44, y: 470, label: 'RUN' },
      { t: 'jack', id: 'seq.pitch', dir: 'out', x: 0.71, y: 560, label: 'PITCH' },
      { t: 'jack', id: 'seq.gate', dir: 'out', x: 0.88, y: 560, label: 'GATE' },
    ] },
    { id: 'osc1', name: 'OSC 1', w: 1, panel: 'silver', ctl: oscCtl('osc1') },
    { id: 'osc2', name: 'OSC 2', w: 1, panel: 'silver', ctl: oscCtl('osc2') },
    { id: 'noise', name: 'NOISE', w: 0.65, panel: 'black', ctl: [
      { t: 'knob', id: 'noise.color', x: 0.5, y: 260, r: 36, label: 'COLOUR', ends: ['DARK', 'BRIGHT'] },
      { t: 'jack', id: 'noise.out', dir: 'out', x: 0.5, y: 560, label: 'OUT' },
    ] },
    { id: 'lfo', name: 'LFO', w: 0.9, panel: 'pink', ctl: [
      { t: 'knob', id: 'lfo.rate', x: 0.5, y: 165, r: 40, label: 'RATE', ends: ['SLOW', 'FAST'] },
      { t: 'knob', id: 'lfo.shape', x: 0.5, y: 315, r: 30, steps: 4, label: 'SHAPE', marks: ['SIN', 'TRI', 'SAW', 'SQR'] },
      { t: 'knob', id: 'lfo.depth', x: 0.5, y: 440, r: 30, label: 'DEPTH' },
      { t: 'led', id: 'lfo', x: 0.84, y: 70, color: 0xff4d6d },
      { t: 'jack', id: 'lfo.out', dir: 'out', x: 0.5, y: 560, label: 'OUT' },
    ] },
    { id: 'env', name: 'ENVELOPE', w: 1.05, panel: 'silver', ctl: [
      { t: 'knob', id: 'env.a', x: 0.3, y: 180, r: 33, label: 'ATTACK' },
      { t: 'knob', id: 'env.d', x: 0.7, y: 180, r: 33, label: 'DECAY' },
      { t: 'knob', id: 'env.s', x: 0.3, y: 345, r: 33, label: 'SUSTAIN' },
      { t: 'knob', id: 'env.r', x: 0.7, y: 345, r: 33, label: 'RELEASE' },
      { t: 'led', id: 'env', x: 0.5, y: 450, color: 0xffb02e },
      { t: 'jack', id: 'env.gate', dir: 'in', x: 0.28, y: 560, label: 'GATE' },
      { t: 'jack', id: 'env.out', dir: 'out', x: 0.72, y: 560, label: 'OUT' },
    ] },
  ],
  [
    { id: 'mix', name: 'MIXER', w: 1, panel: 'white', ctl: [
      ...[1, 2, 3].flatMap((i) => [{ t: 'jack', id: 'mix.in' + i, dir: 'in', x: 0.28, y: 70 + i * 115, label: 'IN ' + i },
        { t: 'knob', id: 'mix.l' + i, x: 0.7, y: 70 + i * 115, r: 32 }]),
      { t: 'jack', id: 'mix.out', dir: 'out', x: 0.5, y: 560, label: 'OUT' },
    ] },
    { id: 'filter', name: 'FILTER', w: 1.15, panel: 'black', ctl: [
      { t: 'knob', id: 'filter.cut', x: 0.5, y: 180, r: 54, label: 'CUTOFF', ends: ['DARK', 'BRIGHT'] },
      { t: 'knob', id: 'filter.res', x: 0.27, y: 360, r: 32, label: 'RESONANCE' },
      { t: 'knob', id: 'filter.amt', x: 0.73, y: 360, r: 32, label: 'CV AMOUNT' },
      { t: 'jack', id: 'filter.in', dir: 'in', x: 0.2, y: 560, label: 'IN' },
      { t: 'jack', id: 'filter.cv', dir: 'in', x: 0.5, y: 560, label: 'CV' },
      { t: 'jack', id: 'filter.out', dir: 'out', x: 0.8, y: 560, label: 'OUT' },
    ] },
    { id: 'vca', name: 'VCA', w: 0.8, panel: 'silver', ctl: [
      { t: 'knob', id: 'vca.level', x: 0.5, y: 200, r: 40, label: 'LEVEL' },
      { t: 'jack', id: 'vca.in', dir: 'in', x: 0.3, y: 400, label: 'IN' },
      { t: 'jack', id: 'vca.cv', dir: 'in', x: 0.7, y: 400, label: 'CV' },
      { t: 'jack', id: 'vca.out', dir: 'out', x: 0.5, y: 560, label: 'OUT' },
    ] },
    { id: 'chorus', name: 'CHORUS', w: 1, panel: 'mint', ctl: [
      { t: 'knob', id: 'chorus.rate', x: 0.3, y: 180, r: 32, label: 'RATE' },
      { t: 'knob', id: 'chorus.depth', x: 0.7, y: 180, r: 32, label: 'DEPTH' },
      { t: 'knob', id: 'chorus.mix', x: 0.5, y: 350, r: 38, label: 'MIX', ends: ['DRY', 'WET'] },
      { t: 'jack', id: 'chorus.in', dir: 'in', x: 0.28, y: 560, label: 'IN' },
      { t: 'jack', id: 'chorus.out', dir: 'out', x: 0.72, y: 560, label: 'OUT' },
    ] },
    { id: 'reverb', name: 'REVERB', w: 1, panel: 'navy', ctl: [
      { t: 'knob', id: 'reverb.size', x: 0.5, y: 180, r: 38, steps: 3, label: 'SPACE', marks: ['ROOM', 'HALL', 'CAVE'] },
      { t: 'knob', id: 'reverb.mix', x: 0.5, y: 360, r: 38, label: 'MIX', ends: ['DRY', 'WET'] },
      { t: 'jack', id: 'reverb.in', dir: 'in', x: 0.28, y: 560, label: 'IN' },
      { t: 'jack', id: 'reverb.out', dir: 'out', x: 0.72, y: 560, label: 'OUT' },
    ] },
    { id: 'out', name: 'OUTPUT', w: 1, panel: 'silver', ctl: [
      { t: 'knob', id: 'out.level', x: 0.5, y: 190, r: 46, label: 'LEVEL' },
      { t: 'led', id: 'out', x: 0.5, y: 330, r: 12, color: 0x42d36b },
      { t: 'jack', id: 'out.in', dir: 'in', x: 0.28, y: 470, label: 'IN 1' },
      { t: 'jack', id: 'out.in2', dir: 'in', x: 0.72, y: 470, label: 'IN 2' },
    ] },
  ],
];
function oscCtl(id) {
  return [
    { t: 'knob', id: id + '.wave', x: 0.5, y: 160, r: 30, steps: 4, label: 'WAVE', marks: ['SIN', 'TRI', 'SAW', 'SQR'] },
    { t: 'knob', id: id + '.pitch', x: 0.5, y: 315, r: 50, steps: 49, label: 'PITCH', ends: ['LOW', 'HIGH'] },
    { t: 'knob', id: id + '.fine', x: 0.5, y: 450, r: 26, label: 'FINE' },
    { t: 'jack', id: id + '.cv', dir: 'in', x: 0.28, y: 560, label: 'PITCH' },
    { t: 'jack', id: id + '.out', dir: 'out', x: 0.72, y: 560, label: 'OUT' },
  ];
}
// place the modules: each row fills the width
MODS.forEach((row, r) => {
  const unit = CANVAS / row.reduce((s, m) => s + m.w, 0);
  let x = 0;
  row.forEach((m) => {
    m.x0 = x; m.x1 = x + m.w * unit; m.y0 = r * ROW; x = m.x1;
    m.ctl.forEach((c) => { c.cx = m.x0 + c.x * (m.x1 - m.x0); c.cy = m.y0 + c.y; c.mod = m; });
  });
});
const CTL = MODS.flat().flatMap((m) => m.ctl);

// ---- presets: knob values (0..1; anything left out takes DEFAULTS), sequencer steps and cables
const semis = (s) => (s + 24) / 48;                       // PITCH knob for s semitones
const note = (k) => k / (SEQ_NOTES - 1);                  // sequencer knob for note k of the scale
const DEFAULTS = {
  'seq.tempo': 0.45, 'seq.len': 0.45, 'osc1.wave': 2 / 3, 'osc1.pitch': 0.5, 'osc1.fine': 0.5, 'osc2.wave': 1, 'osc2.pitch': 0.5, 'osc2.fine': 0.5,
  'noise.color': 0.7, 'lfo.rate': 0.4, 'lfo.shape': 0, 'lfo.depth': 0.5, 'env.a': 0.15, 'env.d': 0.45, 'env.s': 0.4, 'env.r': 0.4,
  'mix.l1': 0.75, 'mix.l2': 0.75, 'mix.l3': 0.75, 'filter.cut': 0.6, 'filter.res': 0.3, 'filter.amt': 0.4, 'vca.level': 0.8,
  'chorus.rate': 0.35, 'chorus.depth': 0.5, 'chorus.mix': 0.5, 'reverb.size': 0.5, 'reverb.mix': 0.35, 'out.level': 0.7,
  ...Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7].map((i) => ['seq.n' + i, note([0, 2, 4, 3, 5, 4, 7, 6][i])])),
};
const PRESETS = {
  Bleeps: { knobs: { 'osc1.wave': 1, 'osc1.pitch': semis(12), 'seq.tempo': 0.62, 'seq.len': 0.3, 'env.a': 0.05, 'env.d': 0.35, 'env.s': 0.15, 'env.r': 0.3,
    'filter.cut': 0.42, 'filter.res': 0.55, 'filter.amt': 0.55, 'reverb.size': 0.5, 'reverb.mix': 0.4,
    ...Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7].map((i) => ['seq.n' + i, note([0, 7, 4, 9, 2, 7, 5, 10][i])])) },
    steps: [1, 1, 0, 1, 1, 0, 1, 1],
    cables: [['seq.pitch', 'osc1.cv'], ['seq.gate', 'env.gate'], ['osc1.out', 'filter.in'], ['filter.out', 'vca.in'], ['env.out', 'vca.cv'], ['env.out', 'filter.cv'], ['vca.out', 'reverb.in'], ['reverb.out', 'out.in']] },
  Bass: { knobs: { 'osc1.wave': 2 / 3, 'osc1.pitch': semis(-12), 'osc2.wave': 1, 'osc2.pitch': semis(-12), 'osc2.fine': 0.58, 'seq.tempo': 0.38, 'seq.len': 0.55,
    'env.a': 0.08, 'env.d': 0.5, 'env.s': 0.3, 'env.r': 0.3, 'filter.cut': 0.3, 'filter.res': 0.55, 'filter.amt': 0.55, 'mix.l1': 0.7, 'mix.l2': 0.55,
    ...Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7].map((i) => ['seq.n' + i, note([0, 0, 5, 0, 3, 0, 4, 2][i])])) },
    steps: [1, 0, 1, 1, 1, 0, 1, 1],
    cables: [['seq.pitch', 'osc1.cv'], ['seq.pitch', 'osc2.cv'], ['seq.gate', 'env.gate'], ['osc1.out', 'mix.in1'], ['osc2.out', 'mix.in2'], ['mix.out', 'filter.in'],
      ['filter.out', 'vca.in'], ['env.out', 'vca.cv'], ['env.out', 'filter.cv'], ['vca.out', 'out.in']] },
  Siren: { knobs: { 'osc1.wave': 2 / 3, 'osc1.pitch': semis(7), 'lfo.shape': 1 / 3, 'lfo.rate': 0.32, 'lfo.depth': 0.85, 'chorus.mix': 0.6, 'chorus.depth': 0.6, 'out.level': 0.55 },
    steps: [1, 1, 1, 1, 1, 1, 1, 1],
    cables: [['lfo.out', 'osc1.cv'], ['osc1.out', 'chorus.in'], ['chorus.out', 'out.in']] },
  Wind: { knobs: { 'noise.color': 0.85, 'filter.cut': 0.45, 'filter.res': 0.85, 'filter.amt': 0.5, 'lfo.shape': 0, 'lfo.rate': 0.12, 'lfo.depth': 0.9,
    'reverb.size': 1, 'reverb.mix': 0.55, 'out.level': 0.75 },
    steps: [1, 1, 1, 1, 1, 1, 1, 1],
    cables: [['noise.out', 'filter.in'], ['lfo.out', 'filter.cv'], ['filter.out', 'reverb.in'], ['reverb.out', 'out.in']] },
};
const COLORS = [0xe0443a, 0x2f6fd6, 0x3fb56b, 0xf08a2c, 0x8b5cc7, 0xe8c63a, 0xe46aa6, 0x34b3c4];

// ---- state: lives as long as the page (the sound is rebuilt from it whenever audio starts)
const S = { values: { ...DEFAULTS }, steps: new Array(8).fill(true), run: true, cables: [], preset: 'Bleeps',
  P: null, case: null, parts: [], ctl: {}, leds: {}, engine: null, playing: false, drag: null, colorI: 0,
  wire: null, cableGroup: null, down: new THREE.Vector3(), pan: -1, panTo: -1, base: null, bar: null, view: null };

// ---- the panel face
function face(g, P) {
  g.fillStyle = '#1b1b1c'; g.fillRect(0, 0, P.W, P.H);
  MODS.flat().forEach((m) => {
    const [bg, ink] = PANEL[m.panel];
    g.fillStyle = bg; g.fillRect(m.x0 + 3, m.y0 + 4, m.x1 - m.x0 - 6, ROW - 8);
    [[m.x0 + 22, m.y0 + 22], [m.x1 - 22, m.y0 + 22], [m.x0 + 22, m.y0 + ROW - 22], [m.x1 - 22, m.y0 + ROW - 22]].forEach(([x, y]) => {   // panel screws
      g.fillStyle = '#9a9c9e'; g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill(); g.fillStyle = '#5c5e60'; g.fillRect(x - 6, y - 1.5, 12, 3);
    });
    P.text(m.name, (m.x0 + m.x1) / 2, m.y0 + 58, { size: 26, color: ink, weight: 700, track: 0.12 });
    m.ctl.forEach((c) => {
      if (c.t === 'knob') {
        P.drawScale(c.cx, c.cy, c.r, { color: ink, ticks: c.steps && c.steps <= 11 ? c.steps : 11, labels: c.marks, size: 13 });
        if (c.label) P.text(c.label, c.cx, c.cy + c.r * 1.55 + (c.marks ? 14 : 12), { size: 16, color: ink, weight: 600 });
        if (c.ends) { P.text(c.ends[0], c.cx - c.r * 1.4, c.cy + c.r * 1.35, { size: 11, color: ink, weight: 500, align: 'right' }); P.text(c.ends[1], c.cx + c.r * 1.4, c.cy + c.r * 1.35, { size: 11, color: ink, weight: 500, align: 'left' }); }
      } else if (c.t === 'jack') {
        P.drawJack(c.cx, c.cy, 24, { out: c.dir === 'out' });
        P.text(c.label, c.cx, c.cy - 46, { size: 15, color: c.dir === 'out' && m.panel !== 'black' && m.panel !== 'navy' ? INK.dark : ink, weight: 600 });
      } else if (c.t === 'run') P.text(c.label, c.cx, c.cy + 46, { size: 16, color: ink });
    });
    if (m.id === 'seq') {
      P.text('NOTES', m.x0 + 18, m.y0 + 120, { size: 13, color: ink, align: 'left', weight: 500 });
      P.text('STEP ON / OFF', m.x0 + 18, m.y0 + 254, { size: 13, color: ink, align: 'left', weight: 500 });
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(m.x0 + 20, m.y0 + 400, m.x1 - m.x0 - 40, 2);
    }
    if (m.id === 'out') { P.text('TO THE AMP', (m.x0 + m.x1) / 2, m.y0 + 570, { size: 15, color: ink, weight: 600 }); }
  });
  // the rails across the top, middle and bottom
  [0, ROW, 2 * ROW].forEach((y) => {
    const grd = g.createLinearGradient(0, y - 10, 0, y + 10); grd.addColorStop(0, '#8d9092'); grd.addColorStop(0.5, '#d9dbdc'); grd.addColorStop(1, '#8d9092');
    g.fillStyle = grd; g.fillRect(0, Math.max(0, y - 6), P.W, 12);
  });
}

// ---- the case: wooden cheeks, bottom and back, the panel tilted back between them
function build(ws) {
  const s = ws.SPOTS.synth;
  if (s.pad) s.pad.visible = false;
  const root = new THREE.Group();
  root.position.set(s.at[0], s.at[1], -0.82); root.rotation.y = Math.PI;
  const wood = new THREE.MeshStandardMaterial({ color: 0xc89a5e, roughness: 0.75 });
  const D = 0.27, rise = PH * Math.cos(TILT), run = PH * Math.sin(TILT), y0 = 0.035, T = 0.018;
  const prof = new THREE.Shape([new THREE.Vector2(-0.012, 0), new THREE.Vector2(D, 0), new THREE.Vector2(D, y0 + rise + 0.012),
    new THREE.Vector2(run - 0.01, y0 + rise + 0.012), new THREE.Vector2(-0.012, y0 - 0.004)]);
  const cheekG = new THREE.ExtrudeGeometry(prof, { depth: T, bevelEnabled: false }); cheekG.rotateY(Math.PI / 2);
  const meshes = [];
  [-1, 1].forEach((sx) => { const c = new THREE.Mesh(cheekG, wood); c.position.x = sx > 0 ? PW / 2 : -PW / 2 - T; meshes.push(c); });
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(PW, 0.012, D), wood); bottom.position.set(0, 0.006, -D / 2); meshes.push(bottom);
  const back = new THREE.Mesh(new THREE.BoxGeometry(PW, y0 + rise, 0.012), wood); back.position.set(0, (y0 + rise) / 2, -D + 0.006); meshes.push(back);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(PW, 0.012, D - run + 0.01), wood); lid.position.set(0, y0 + rise + 0.006, -(run + D) / 2 + 0.005); meshes.push(lid);
  meshes.forEach((m) => { m.castShadow = m.receiveShadow = true; root.add(m); });
  // the panel
  const P = makePanel(ws, { w: PW, h: PH, px: CANVAS, draw: face, faceMat: { roughness: 0.5, metalness: 0.15 } });
  P.group.position.set(0, y0 + rise / 2, -run / 2); P.group.rotation.x = -TILT;
  root.add(P.group);
  CTL.forEach((c) => {
    if (c.t === 'knob') {
      const light = ['black', 'navy', 'pink'].includes(c.mod.panel);
      S.ctl[c.id] = P.knob({ x: c.cx, y: c.cy, r: c.r, steps: c.steps, value: S.values[c.id], color: light ? 0xe9e6df : 0x1d1d1f, mark: light ? 0x1d1d1f : 0xf3f0ea,
        span: c.steps > 11 ? 320 : 170, onChange: (v) => knob(c.id, v) });
    } else if (c.t === 'step') {
      S.ctl[c.id] = P.button({ x: c.cx, y: c.cy, w: 50, h: 34, color: 0x55575a, litColor: 0xf3efe6, lit: S.steps[c.i], onPress: () => toggleStep(c.i) });
    } else if (c.t === 'run') {
      S.ctl[c.id] = P.button({ x: c.cx, y: c.cy, w: 74, h: 50, color: 0x55575a, litColor: 0x42d36b, lit: S.run, onPress: () => setRun(!S.run) });
    } else if (c.t === 'led') {
      S.leds[c.id] = P.led({ x: c.cx, y: c.cy, r: c.r || 9, color: c.color || 0xff3b2f });
    } else if (c.t === 'jack') {
      S.ctl[c.id] = P.jack({ x: c.cx, y: c.cy, r: 24, id: c.id, dir: c.dir, label: c.label });
    }
  });
  P.build();
  S.cableGroup = new THREE.Group(); P.group.add(S.cableGroup);
  ws.scene.add(root);
  root.updateMatrixWorld(true);
  // world down, seen from the panel (cables hang towards the desk)
  S.down.set(0, -1, 0).applyQuaternion(P.group.getWorldQuaternion(new THREE.Quaternion()).invert());
  S.P = P; S.case = root; S.parts = [...meshes, ...P.meshes];
  S.centre = P.group.getWorldPosition(new THREE.Vector3());
  S.normal = new THREE.Vector3(0, 0, 1).transformDirection(P.group.matrixWorld);
  S.right = new THREE.Vector3(1, 0, 0).transformDirection(P.group.matrixWorld);
  S.bar = makeBar(ws);
  loadPreset('Bleeps', true);
  ws.markShadows();
}

// ---- knobs, steps, run
function knob(id, v) {
  S.values[id] = v;
  if (S.engine) S.engine.set(id, v);
  if (id.endsWith('.wave') || id === 'lfo.shape' || id === 'reverb.size') markPreset(null);
}
function toggleStep(i) { S.steps[i] = !S.steps[i]; S.ctl['seq.s' + i].light(S.steps[i]); if (S.engine) S.engine.setOn(i, S.steps[i]); }
function setRun(on) {
  S.run = on; S.ctl['seq.run'].light(on);
  if (S.engine) { S.engine.seq.run = on; if (!on) S.engine.seq.stop(); else if (S.playing) { S.engine.seq.playing = false; S.engine.seq.start(); } }
}

// ---- cables: a sagging tube between two jacks, plugs at both ends
const tubeMats = new Map();
const plugGeo = new THREE.CylinderGeometry(0.0052, 0.0052, 0.016, 12).rotateX(Math.PI / 2).translate(0, 0, 0.008);
const sleeveGeo = new THREE.CylinderGeometry(0.0034, 0.0034, 0.006, 10).rotateX(Math.PI / 2).translate(0, 0, 0.003);
const sleeveMat = new THREE.MeshStandardMaterial({ color: 0xb9bcc0, metalness: 0.8, roughness: 0.3 });
function matFor(color) { if (!tubeMats.has(color)) tubeMats.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.55 })); return tubeMats.get(color); }
const va = new THREE.Vector3(), vb = new THREE.Vector3();
function cableMesh(a, b, color, loose) {                // a, b: panel-local points on the face; loose: b is the hand
  const g = new THREE.Group(), m = matFor(color), n = new THREE.Vector3(0, 0, 1);
  const d = a.distanceTo(b);
  const a1 = a.clone().addScaledVector(n, 0.024), b1 = b.clone().addScaledVector(n, loose ? 0.03 : 0.024);
  const mid = a1.clone().add(b1).multiplyScalar(0.5).addScaledVector(n, 0.02 + d * 0.22).addScaledVector(S.down, 0.02 + d * 0.32);
  const curve = new THREE.CatmullRomCurve3([a.clone().addScaledVector(n, 0.014), a1, mid, b1, b.clone().addScaledVector(n, loose ? 0.02 : 0.014)], false, 'centripetal');
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 36, 0.0026, 6, false), m);
  g.add(tube);
  [[a, false], [b, loose]].forEach(([p, hand]) => {
    const plug = new THREE.Mesh(plugGeo, m); plug.position.copy(p).addScaledVector(n, hand ? 0.008 : 0.004); g.add(plug);
    if (!hand) { const sl = new THREE.Mesh(sleeveGeo, sleeveMat); sl.position.copy(p); g.add(sl); }
  });
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}
function disposeMesh(g) { if (!g) return; g.parent && g.parent.remove(g); g.traverse((o) => { if (o.isMesh && o.geometry !== plugGeo && o.geometry !== sleeveGeo) o.geometry.dispose(); }); }
function jackAt(id, out) { const c = S.ctl[id]; return S.P.local(c.x, c.y, 0, out); }
function addCable(a, b, color, quiet) {                 // a: output id, b: input id
  if (S.engine && !S.engine.fits(a, b)) { if (!quiet) msg('GATE inputs take a GATE: patch the sequencer’s GATE there'); return false; }
  const old = S.cables.find((c) => c.b === b);
  if (old) removeCable(old);
  const c = { a, b, color, mesh: cableMesh(jackAt(a, va), jackAt(b, vb), color) };
  S.cableGroup.add(c.mesh); S.cables.push(c);
  if (S.engine) S.engine.connect(a, b);
  return true;
}
function removeCable(c) {
  S.cables.splice(S.cables.indexOf(c), 1); disposeMesh(c.mesh);
  if (S.engine) S.engine.disconnect(c.a, c.b);
}
function clearCables() { [...S.cables].forEach(removeCable); }

// ---- presets
function loadPreset(name, quiet) {
  const p = PRESETS[name];
  clearCables();
  const vals = { ...DEFAULTS, ...(p ? p.knobs : {}) };
  Object.entries(vals).forEach(([id, v]) => { S.values[id] = v; if (S.ctl[id]) S.ctl[id].set(v, true); if (S.engine) S.engine.set(id, v); });
  const steps = p ? p.steps : [1, 1, 1, 1, 1, 1, 1, 1];
  steps.forEach((on, i) => { S.steps[i] = !!on; S.ctl['seq.s' + i].light(!!on); if (S.engine) S.engine.setOn(i, !!on); });
  if (p) p.cables.forEach(([a, b], i) => addCable(a, b, COLORS[i % COLORS.length], true));
  S.colorI = S.cables.length;
  markPreset(p ? name : null);
  if (!quiet) msg(p ? name + ': try the knobs, or move a cable' : 'Empty. Drag from OSC 1 OUT to OUTPUT IN 1 to hear a tone');
}
function markPreset(name) {
  S.preset = name;
  if (S.bar) S.bar.el.querySelectorAll('[data-p]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.p === name)));
}

// ---- the bar: presets, clear, and on phones the slide buttons
function makeBar(ws) {
  const b = bar('ws-synth');
  b.el.setAttribute('aria-label', 'Synth patches');
  b.el.innerHTML = `<span class="lbl">Patch</span>${Object.keys(PRESETS).map((n) => `<button type="button" class="btn" data-p="${n}">${n}</button>`).join('')}
    <button type="button" class="btn" data-clear>Clear</button>
    <button type="button" class="btn ws-pan" data-pan="-1" aria-label="Slide left">‹</button><button type="button" class="btn ws-pan" data-pan="1" aria-label="Slide right">›</button>
    <div class="msg" aria-live="polite"></div>`;
  b.el.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    ws.sound();
    if (t.dataset.p) loadPreset(t.dataset.p);
    else if (t.dataset.clear !== undefined) loadPreset(null);
    else if (t.dataset.pan) S.panTo = +t.dataset.pan;
  });
  const st = document.createElement('style');
  st.textContent = '.ws-synth .ws-pan { display: none; } @media (orientation: portrait) { .ws-synth .ws-pan { display: inline-block; min-width: 44px; } }';
  document.head.appendChild(st);
  return b;
}
function msg(text) { if (!S.bar) return; S.bar.el.querySelector('.msg').textContent = text || ''; S.bar.fit(); }

// ---- the sound: built from the state whenever the workshop's audio starts
audio.onStart((ctx) => {
  S.engine = createEngine(ctx, audio.slot('synth').in);
  Object.entries(S.values).forEach(([id, v]) => S.engine.set(id, v));
  S.steps.forEach((on, i) => S.engine.setOn(i, on));
  S.engine.seq.run = S.run;
  S.cables.forEach((c) => S.engine.connect(c.a, c.b));
  S.playing = false;
});
audio.onDispose(() => { if (S.engine) S.engine.dispose(); S.engine = null; S.playing = false; });

// ---- pointer while open: knobs and buttons via the panel; cables; swipe to slide on phones
function pointer(type, ev, ws) {
  if (type === 'down') ws.sound();
  const P = S.P;
  if (S.swipe) {
    if (type === 'move') { S.panTo = S.pan = Math.max(-1, Math.min(1, S.swipe.p0 - (ev.clientX - S.swipe.x0) / (ws.el.clientWidth * 0.55))); return true; }
    if (type === 'up') { S.panTo = Math.round(S.pan); S.swipe = null; return true; }
  }
  const took = P.pointer(type, ev, { jack: (t, j, e) => onJack(t, j, e, ws), jackDrag: !!S.drag });
  if (!took && type === 'down' && ws.portrait() && P.over(ev)) { S.swipe = { x0: ev.clientX, p0: S.pan }; return true; }
  return took;
}
function onJack(type, j, ev, ws) {
  if (type === 'down') {
    const plugged = j.dir === 'in' && S.cables.find((c) => c.b === j.id);
    if (plugged) { removeCable(plugged); S.drag = { from: plugged.a, dir: 'out', color: plugged.color }; }
    else { S.drag = { from: j.id, dir: j.dir, color: COLORS[S.colorI++ % COLORS.length] }; }
    msg(S.drag.dir === 'out' ? 'Drop it on an IN' : 'Drop it on an OUT (dark square)');
    dragTo(ev);
    return true;
  }
  if (type === 'move') {
    dragTo(ev);
    // near the edge on a phone: slide along
    if (ws.portrait()) { const x = ev.clientX / ws.el.clientWidth; if (x < 0.1) S.panTo = Math.max(-1, S.pan - 0.04); else if (x > 0.9) S.panTo = Math.min(1, S.pan + 0.04); }
    return true;
  }
  if (type === 'up') {
    const d = S.drag; S.drag = null; disposeMesh(S.wire); S.wire = null;
    if (j && j.dir !== d.dir && j.id !== d.from) {
      const [a, b] = d.dir === 'out' ? [d.from, j.id] : [j.id, d.from];
      if (addCable(a, b, d.color)) { markPreset(null); msg(''); }
    } else msg(j ? '' : 'Cable removed');
    return true;
  }
  return false;
}
const plane = new THREE.Plane(), hitP = new THREE.Vector3();
function dragTo(ev) {
  const P = S.P;
  plane.setFromNormalAndCoplanarPoint(S.normal, S.centre).translate(S.normal.clone().multiplyScalar(0.02));
  const r = P.over(ev);
  let local;
  if (r) local = P.group.worldToLocal(r.point.clone());
  else { const ray = P.group && S.P && S.rayOf(ev); if (!ray || !ray.ray.intersectPlane(plane, hitP)) return; local = P.group.worldToLocal(hitP.clone()); local.z = 0; }
  disposeMesh(S.wire);
  const from = jackAt(S.drag.from, va);
  S.wire = cableMesh(from, local, S.drag.color, true);
  S.cableGroup.add(S.wire);
}

// ---- every frame: LEDs, play/stop with the stations that listen, phone sliding
function update(dt, now, s, ws) {
  if (!S.P) return;
  const want = !!(s.inside && s.focus && LISTEN.has(s.focus));
  if (S.engine && want !== S.playing) { S.playing = want; S.engine.play(want); }
  if (!s.inside) return;
  const e = S.engine && S.playing ? S.engine : null;
  const cur = e && S.run ? e.seq.current() : -1;
  for (let i = 0; i < 8; i++) S.leds['seq.l' + i].set(i === cur ? 1 : 0);
  S.leds.lfo.set(e ? Math.max(0, e.level('lfo') * 1.4) : 0);
  S.leds.env.set(e ? Math.min(1, e.level('env')) : 0);
  S.leds.out.set(e ? e.level('out') : 0);
  S.P.syncLeds();
  // sliding along the case on a phone
  if (s.open && S.base && ws.portrait()) {
    if (Math.abs(S.panTo - S.pan) > 0.001 && !S.swipe) S.pan += (S.panTo - S.pan) * Math.min(1, dt * 8);
    const off = (S.pan - S.base.pan) * PW * 0.27;
    ws.camera.position.copy(S.base.eye).addScaledVector(S.right, off);
    ws.camera.lookAt(vb.copy(S.base.at).addScaledVector(S.right, off));
  }
}

const VIEW = {                                          // filled in at setup: straight at the panel
  get at() { const at = S.centre.clone(); if (S.ws && S.ws.portrait()) at.addScaledVector(S.right, S.pan * PW * 0.27).y -= 0.035; return at.toArray(); },   // phones: the case sits higher, above the bar
  get from() { return S.normal.toArray(); },
  get size() { return S.ws && S.ws.portrait() ? PW * 0.56 : PW + 0.08; },
};
register({
  id: 'synth', label: 'Modular synth', sound: true,
  state: S, preset: (n) => loadPreset(n), cable: (a, b) => addCable(a, b, COLORS[S.colorI++ % COLORS.length]),   // test hooks
  pick: () => S.parts,
  view: { at: [9.2, 4.1, -0.7], from: [0, 0.5, -1], size: 0.75 },
  hint: 'Drag the knobs up and down. Drag a cable from an OUT to an IN',
  setup(ws) {
    S.ws = ws; S.rayOf = (ev) => ws.ray(ev);
    build(ws);
    this.view = VIEW;
  },
  enter(ws) {
    S.base = { eye: ws.camera.position.clone(), at: new THREE.Vector3(...VIEW.at), pan: S.pan };
    S.panTo = S.pan;
    S.bar.show(true); msg(S.preset ? S.preset + ' is playing. Try the CUTOFF knob' : '');
  },
  exit() { S.bar.show(false); S.base = null; S.drag = null; S.swipe = null; disposeMesh(S.wire); S.wire = null; S.P.drag = null; },
  update,
  pointer,
  key(ev) {
    if (ev.key === ' ') { setRun(!S.run); return true; }
    const k = Object.keys(PRESETS)[+ev.key - 1];
    if (k) { loadPreset(k); return true; }
    if (ev.key === '0') { loadPreset(null); return true; }
    return false;
  },
});
