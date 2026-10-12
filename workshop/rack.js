// --- The server rack: Mind reader (WORKSHOP_PLAN phase W4). The existing bank of racks on the left of
// the workshop (`workshopservers`, three racks behind the glass partition) gets screens, rows of LEDs
// and fans, and plays rock, paper, scissors against the visitor: "Can you beat me over 20 rounds?"
// The game itself is in workshop/rack-mind.js (predictors, a tiny network, the remarks).
//
// Middle rack, top to bottom: the main screen (round, both moves, score, the "how well I know you"
// meter, the rack's guess for the round just played with confidence bars, its remark), the three big
// buttons ROCK / PAPER / SCISSORS and FORGET ME, two rows of LEDs. Side racks: two fans at the top
// (they spin up as the rack gets confident), a small screen (left: which habit it listens to, with
// each predictor's hit rate; right: the visitor's last moves and the network's hidden units), rows
// of LEDs that flicker while it "thinks" after each round.
// The rack's move is decided before the visitor picks and shown at the same moment as theirs; its
// guess is only shown after the round, so it can't be read in advance. Nothing is stored or sent:
// it all runs in the browser and is forgotten when the visitor leaves the workshop.
// Keys: 1/2/3 or R/P/S play, F forgets. Test hook: `__workshop.get('rack')` → `{ mind, play(move), forget() }`.
import * as THREE from 'three';
import { register, makePanel, bar } from './stations.js';
import { createMind, MOVES, ROUNDS, PREDICTORS } from './rack-mind.js';

const FRONT = 14.07;                                   // in front of the racks' faces (x 14.1) and grille bars
const MID = 1.17, PITCH = 1.0;                         // middle rack's centre (z) and the rack spacing
const SCR = { y: 4.55, w: 0.7, h: 0.92 };              // main screen
const CTL = { y: 3.835, w: 0.7, h: 0.37 };             // the button panel
const SIDE = { y: 4.3, w: 0.56, h: 0.34 };             // the side racks' small screens
const FAN = { y: 4.75, r: 0.105, gap: 0.27 };
const INK = { bg: '#0a0f12', line: '#1d2a30', soft: '#6f8790', text: '#d8e6ea', you: '#ffb347', rack: '#57d3ff', good: '#7dff9a', bad: '#ff6b5e' };
const MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';
const R = {
  ws: null, mind: createMind(), last: null, screen: null, ctl: null, left: null, right: null, parts: [], bar: null,
  leds: null, ledInfo: [], fans: [], fanSpin: 0, think: 0, flash: 0, press: -1, pressT: 0, ledT: 0, paintT: 0, hide: null,
};

// ---- drawing helpers
function glyph(g, move, x, y, s, color) {              // simple pictures: a stone, a sheet, a pair of scissors
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = color; g.strokeStyle = color; g.lineWidth = 0.09; g.lineJoin = g.lineCap = 'round';
  if (move === 0) {
    g.beginPath();
    [[-0.86, 0.1], [-0.6, -0.55], [-0.05, -0.8], [0.55, -0.6], [0.9, -0.05], [0.7, 0.55], [0.1, 0.75], [-0.55, 0.62]].forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b)));
    g.closePath(); g.fill();
    g.strokeStyle = INK.bg; g.lineWidth = 0.06; g.beginPath(); g.moveTo(-0.35, -0.2); g.lineTo(0.1, -0.35); g.moveTo(0.05, 0.25); g.lineTo(0.45, 0.1); g.stroke();
  } else if (move === 1) {
    g.beginPath(); g.moveTo(-0.6, -0.8); g.lineTo(0.3, -0.8); g.lineTo(0.6, -0.5); g.lineTo(0.6, 0.8); g.lineTo(-0.6, 0.8); g.closePath(); g.fill();
    g.strokeStyle = INK.bg; g.lineWidth = 0.06; g.beginPath();
    [-0.3, -0.05, 0.2, 0.45].forEach((v) => { g.moveTo(-0.4, v); g.lineTo(0.4, v); });
    g.moveTo(0.3, -0.8); g.lineTo(0.3, -0.5); g.lineTo(0.6, -0.5); g.stroke();
  } else {
    g.lineWidth = 0.13;
    g.beginPath(); g.moveTo(-0.15, 0.2); g.lineTo(0.55, -0.85); g.moveTo(0.15, 0.2); g.lineTo(-0.55, -0.85); g.stroke();
    g.lineWidth = 0.11;
    [-0.33, 0.33].forEach((cx) => { g.beginPath(); g.arc(cx, 0.52, 0.24, 0, Math.PI * 2); g.stroke(); });
  }
  g.restore();
}
function wrap(g, text, x, y, maxW, lh, font, color, maxLines = 3) {
  g.font = font; g.fillStyle = color; g.textAlign = 'left'; g.textBaseline = 'top';
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  const words = text.split(' '), lines = [];
  let cur = '';
  words.forEach((w) => { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
  if (cur) lines.push(cur);
  lines.slice(0, maxLines).forEach((l, i) => g.fillText(l, x, y + i * lh));
}
const pct = (v) => Math.round(v * 100) + '%';
const flick = () => R.think > 0 && (performance.now() / 70 | 0) % 2;

// ---- the main screen
function mainFace(g, P) {
  const { W, H } = P, L = R.last, m = R.mind.match, k = R.mind.knowledge(), t = (s, x, y, o) => P.text(s, x, y, { font: MONO, ...o });
  g.fillStyle = INK.bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = INK.line; g.lineWidth = 2; g.strokeRect(14, 14, W - 28, H - 28);
  t('MIND READER', 40, 52, { size: 30, color: INK.text, align: 'left', weight: 700, track: 0.12 });
  t(m.round ? `ROUND ${m.round} / ${ROUNDS}` : `${ROUNDS} ROUNDS`, W - 40, 52, { size: 24, color: INK.soft, align: 'right', weight: 600 });
  g.fillStyle = INK.line; g.fillRect(40, 84, W - 80, 2);
  // the two moves
  const cy = 236;
  t('YOU', 190, 118, { size: 22, color: INK.you, weight: 700, track: 0.2 });
  t('RACK', W - 190, 118, { size: 22, color: INK.rack, weight: 700, track: 0.2 });
  [[190, INK.you, L && L.you], [W - 190, INK.rack, L && L.rack]].forEach(([x, c, mv]) => {
    g.strokeStyle = INK.line; g.lineWidth = 3; g.strokeRect(x - 110, cy - 96, 220, 196);
    if (mv == null) t('?', x, cy + 4, { size: 110, color: INK.line, weight: 700 });
    else { glyph(g, mv, x, cy - 12, 62, c); t(MOVES[mv].toUpperCase(), x, cy + 74, { size: 20, color: c, weight: 600, track: 0.15 }); }
  });
  if (L) {
    const [word, col] = L.res === 0 ? ['YOU WIN', INK.good] : L.res === 1 ? ['I WIN', INK.bad] : ['DRAW', INK.soft];
    t(word, W / 2, cy - 6, { size: 26, color: col, weight: 800, track: 0.08 });
  } else t('VS', W / 2, cy - 6, { size: 26, color: INK.soft, weight: 700 });
  // the score
  const sy = 396;
  [['YOU', m.you, INK.you, 150], ['DRAWS', m.draw, INK.soft, W / 2], ['RACK', m.rack, INK.rack, W - 150]].forEach(([lab, v, c, x]) => {
    t(String(v), x, sy, { size: 64, color: c, weight: 700, track: 0 });
    t(lab, x, sy + 50, { size: 17, color: INK.soft, weight: 600, track: 0.2 });
  });
  g.fillStyle = INK.line; g.fillRect(40, 482, W - 80, 2);
  // how well I know you: the leading habit's recent hit rate; chance is a third
  t('HOW WELL I KNOW YOU', 40, 520, { size: 19, color: INK.soft, align: 'left', weight: 600, track: 0.14 });
  const acc = R.mind.history.length ? k.acc : 0, bx = 40, bw = W - 80, by = 544;
  t(R.mind.history.length ? pct(acc) : '—', W - 40, 520, { size: 22, color: INK.text, align: 'right', weight: 700 });
  g.fillStyle = '#121c21'; g.fillRect(bx, by, bw, 30);
  const fill = flick() ? INK.text : acc > 0.45 ? INK.rack : '#3c8fae';
  g.fillStyle = fill; g.fillRect(bx, by, bw * acc, 30);
  g.fillStyle = INK.text; g.fillRect(bx + bw / 3 - 1, by - 6, 3, 42);
  t('chance', bx + bw / 3 + 8, by + 52, { size: 15, color: INK.soft, align: 'left', weight: 500 });
  t(k.lead && k.acc > 0.4 ? 'watching ' + PREDICTORS[k.lead] : m.round || R.mind.history.length ? 'no pattern yet' : 'learning starts with your first move', W - 40, by + 52, { size: 15, color: INK.soft, align: 'right', weight: 500 });
  // the guess for the round just played (shown after it, so it can't be read in advance)
  t('MY GUESS FOR THAT ROUND', 40, 650, { size: 19, color: INK.soft, align: 'left', weight: 600, track: 0.14 });
  [0, 1, 2].forEach((i) => {
    const y = 682 + i * 50, p = L ? L.guess[i] : 0;
    t(MOVES[i].toUpperCase(), 40, y + 16, { size: 18, color: L && L.you === i ? INK.you : INK.text, align: 'left', weight: 600, track: 0.1 });
    g.fillStyle = '#121c21'; g.fillRect(190, y, W - 340, 32);
    g.fillStyle = L && L.you === i ? INK.you : '#3c8fae'; g.fillRect(190, y, (W - 340) * p, 32);
    t(L ? pct(p) : '—', W - 40, y + 16, { size: 20, color: INK.text, align: 'right', weight: 600 });
  });
  g.fillStyle = INK.line; g.fillRect(40, 846, W - 80, 2);
  // the remark, or the verdict at the end of a match
  if (L && L.verdict) {
    t(L.verdict.title.toUpperCase(), 40, 884, { size: 30, color: L.verdict.title.startsWith('I win') ? INK.bad : L.verdict.title.startsWith('You') ? INK.good : INK.text, align: 'left', weight: 800 });
    wrap(g, L.verdict.text + ' Play again?', 40, 910, W - 80, 30, `500 22px ${MONO}`, INK.text, 2);
  } else wrap(g, R.think > 0 ? 'Thinking' + '.'.repeat(1 + (performance.now() / 160 | 0) % 3) : (L ? L.comment : 'Can you beat me over 20 rounds? Pick rock, paper or scissors. I learn your habits as we play.'), 40, 868, W - 80, 32, `500 23px ${MONO}`, INK.text, 4);
}

// ---- the button panel: three big keys and FORGET ME, drawn on the face (hit areas only)
const KEYS = [0, 1, 2].map((i) => ({ kind: 'key', move: i, x: 128 + i * 256, y: 176, w: 216, h: 236 }));
const FORGET = { kind: 'key', move: -1, x: 640, y: 372, w: 216, h: 40 };
function ctlFace(g, P) {
  const { W, H } = P;
  g.fillStyle = '#1b2124'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#262e32'; g.fillRect(8, 8, W - 16, H - 16);
  [...KEYS, FORGET].forEach((c) => {
    const down = R.press === c.move && R.pressT > 0, d = down ? 4 : 0;
    g.fillStyle = '#0c0f10'; g.fillRect(c.x - c.w / 2 + 3, c.y - c.h / 2 + 8, c.w, c.h);           // shadow
    g.fillStyle = c.move < 0 ? '#3a4247' : down ? '#e9e4da' : '#d8d2c6';
    g.fillRect(c.x - c.w / 2 + d * 0.5, c.y - c.h / 2 + d, c.w, c.h);
    if (c.move < 0) { P.text('FORGET ME', c.x, c.y + d, { size: 18, color: '#d8d2c6', weight: 700, track: 0.14 }); return; }
    glyph(g, c.move, c.x, c.y - 26 + d, 52, '#2a2f33');
    P.text(MOVES[c.move].toUpperCase(), c.x, c.y + 66 + d, { size: 24, color: '#2a2f33', weight: 800, track: 0.12 });
    P.text(String(c.move + 1), c.x - c.w / 2 + 18, c.y - c.h / 2 + 22 + d, { size: 16, color: '#7a756c', weight: 600 });
  });
  P.text('NOTHING IS STORED', 128, 372, { size: 15, color: '#7a8a90', weight: 600, track: 0.14 });
}

// ---- side screens: which habit it listens to; the visitor's last moves and the network
function leftFace(g, P) {
  const { W, H } = P, sc = R.mind.scores(), lead = R.mind.history.length ? R.mind.knowledge().lead : null;
  g.fillStyle = INK.bg; g.fillRect(0, 0, W, H);
  P.text('WHAT I WATCH', 30, 36, { font: MONO, size: 22, color: INK.text, align: 'left', weight: 700, track: 0.12 });
  P.text('hit rate', W - 30, 36, { font: MONO, size: 16, color: INK.soft, align: 'right', weight: 500 });
  sc.forEach((s, i) => {
    const y = 78 + i * 50, on = s.id === lead && s.acc > 0.4, c = on ? INK.rack : INK.soft;
    P.text(s.label, 30, y + 2, { font: MONO, size: 19, color: on ? INK.text : INK.soft, align: 'left', weight: on ? 700 : 500, track: 0 });
    g.fillStyle = '#121c21'; g.fillRect(30, y + 16, W - 150, 14);
    g.fillStyle = flick() && on ? INK.text : c; g.fillRect(30, y + 16, (W - 150) * (R.mind.history.length ? s.acc : 0), 14);
    P.text(R.mind.history.length ? pct(s.acc) : '—', W - 30, y + 22, { font: MONO, size: 17, color: c, align: 'right', weight: 600 });
  });
}
function rightFace(g, P) {
  const { W, H } = P, h = R.mind.history.slice(-10), hid = R.mind.hidden();
  g.fillStyle = INK.bg; g.fillRect(0, 0, W, H);
  P.text('YOUR LAST MOVES', 30, 36, { font: MONO, size: 22, color: INK.text, align: 'left', weight: 700, track: 0.12 });
  const cw = (W - 60) / 10;
  for (let i = 0; i < 10; i++) {
    const r = h[i], x = 30 + cw * i + cw / 2;
    g.strokeStyle = INK.line; g.lineWidth = 2; g.strokeRect(x - cw / 2 + 4, 66, cw - 8, 112);
    if (!r) continue;
    glyph(g, r.you, x, 104, 17, INK.you);
    g.fillStyle = r.res === 0 ? INK.good : r.res === 1 ? INK.bad : INK.soft; g.fillRect(x - cw / 2 + 10, 150, cw - 20, 8);
  }
  P.text('NETWORK', 30, 214, { font: MONO, size: 18, color: INK.soft, align: 'left', weight: 600, track: 0.14 });
  hid.forEach((v, i) => {
    const x = 30 + cw * i + cw / 2, a = Math.min(1, Math.abs(v)) * (R.mind.history.length >= 3 ? 1 : 0.15);
    g.fillStyle = v >= 0 ? `rgba(87, 211, 255, ${0.12 + 0.88 * a})` : `rgba(255, 179, 71, ${0.12 + 0.88 * a})`;
    g.beginPath(); g.arc(x, 262, cw * 0.32, 0, Math.PI * 2); g.fill();
  });
}

// ---- building it on the racks
function build(ws) {
  R.ws = ws;
  const racks = ['workshopservers', 'workshopserver_grilles'].map(ws.mesh).filter(Boolean);
  ws.own(racks);
  const G = new THREE.Group();                         // local x = along the racks (towards +z), z = out of their faces (-x)
  G.position.set(FRONT, 0, MID); G.rotation.y = -Math.PI / 2;
  const glass = { color: 0x000000, roughness: 0.7, metalness: 0, emissiveIntensity: 1 };   // lit from inside only
  const bezelM = new THREE.MeshStandardMaterial({ color: 0x15191b, roughness: 0.5, metalness: 0.3 });
  const bezel = (u, y, w, h) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, h + 0.03, 0.02), bezelM); b.position.set(u, y, -0.009); b.castShadow = true; G.add(b); return b; };
  const panel = (u, y, w, h, px, draw, fm) => { const P = makePanel(ws, { w, h, px, draw, faceMat: fm }); P.group.position.set(u, y, 0.002); G.add(P.group); P.build(); return P; };
  const parts = [...racks];
  parts.push(bezel(0, SCR.y, SCR.w, SCR.h), bezel(0, CTL.y, CTL.w, CTL.h));
  R.screen = panel(0, SCR.y, SCR.w, SCR.h, 768, mainFace, glass);
  R.ctl = panel(0, CTL.y, CTL.w, CTL.h, 768, ctlFace, { roughness: 0.6, emissiveIntensity: 0.12 });
  [-1, 1].forEach((sd) => { parts.push(bezel(sd * PITCH, SIDE.y, SIDE.w, SIDE.h)); });
  R.left = panel(-PITCH, SIDE.y, SIDE.w, SIDE.h, 512, leftFace, glass);
  R.right = panel(PITCH, SIDE.y, SIDE.w, SIDE.h, 512, rightFace, glass);
  parts.push(R.screen.face, R.ctl.face, R.left.face, R.right.face);
  // fans: a dark housing, a ring and five blades turning in front of it
  const houseM = new THREE.MeshStandardMaterial({ color: 0x1d2224, roughness: 0.7, metalness: 0.2 });
  const bladeM = new THREE.MeshStandardMaterial({ color: 0x3a4246, roughness: 0.5, metalness: 0.3 });
  const ringM = new THREE.MeshStandardMaterial({ color: 0x5c666b, roughness: 0.4, metalness: 0.6 });
  const blade = new THREE.BoxGeometry(FAN.r * 0.42, FAN.r * 0.82, 0.004).translate(0, FAN.r * 0.5, 0);
  [-1, 1].forEach((sd) => {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(SIDE.w + 0.03, FAN.r * 2 + 0.06, 0.02), houseM);
    plate.position.set(sd * PITCH, FAN.y, -0.009); plate.castShadow = true; G.add(plate); parts.push(plate);
    [-1, 1].forEach((k) => {
      const u = sd * PITCH + k * FAN.gap / 2;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(FAN.r, 0.007, 8, 32), ringM); ring.position.set(u, FAN.y, 0.006); G.add(ring);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(FAN.r * 0.28, FAN.r * 0.28, 0.012, 16).rotateX(Math.PI / 2), ringM); hub.position.set(u, FAN.y, 0.01); G.add(hub);
      const rot = new THREE.Group(); rot.position.set(u, FAN.y, 0.006);
      for (let b = 0; b < 5; b++) { const m = new THREE.Mesh(blade, bladeM); m.rotation.z = b * Math.PI * 2 / 5; m.rotation.y = 0.35; rot.add(m); }
      G.add(rot); R.fans.push(rot);
    });
  });
  // LEDs: in the gaps between the grille bars (side racks, below the screens) and below the buttons
  const led = new THREE.BoxGeometry(0.013, 0.007, 0.004);
  const ledM = new THREE.MeshBasicMaterial({ toneMapped: false });
  const spots = [];
  const gap = (k) => 3.335 + 0.15 * k;
  [-1, 1].forEach((sd) => { for (let k = 0; k <= 4; k++) for (let i = 0; i < 12; i++) spots.push([sd * PITCH - 0.25 + i * (0.5 / 11), gap(k), k * 12 + i]); });
  for (let k = 0; k <= 2; k++) for (let i = 0; i < 16; i++) spots.push([-0.27 + i * (0.54 / 15), gap(k) - (k === 2 ? 0.05 : 0), 200 + k * 16 + i]);
  R.leds = new THREE.InstancedMesh(led, ledM, spots.length);
  const M = new THREE.Matrix4();
  spots.forEach(([u, y, id], n) => {
    M.makeTranslation(u, y, 0.003); R.leds.setMatrixAt(n, M);
    const col = id % 12 === 0 ? 0xffb347 : id % 7 === 3 ? 0x57d3ff : 0x7dff9a;   // a power LED per row, a few blue
    R.ledInfo.push({ c: new THREE.Color(col), rate: 0.6 + Math.random() * 2.4, ph: Math.random() * 10, mid: id >= 200, i: id >= 200 ? (id - 200) % 16 : 0 });
    R.leds.setColorAt(n, new THREE.Color(0));
  });
  R.leds.frustumCulled = false; G.add(R.leds);
  ws.scene.add(G);
  R.parts = parts;
  R.bar = makeBar();
  ws.markShadows();
}

function makeBar() {
  const b = bar('ws-rack');
  b.el.setAttribute('aria-label', 'Mind reader');
  b.el.innerHTML = MOVES.map((m, i) => `<button type="button" class="btn" data-m="${i}">${m[0].toUpperCase() + m.slice(1)} <span class="k">${i + 1}</span></button>`).join('')
    + '<button type="button" class="btn" data-f>Forget me</button><div class="msg" aria-live="polite"></div>';
  const st = document.createElement('style');
  st.textContent = '.ws-rack .msg { max-width: 520px; margin: 0 auto; } .ws-rack .btn[data-m] { min-width: 88px; } .ws-rack .k { opacity: 0.5; font-size: 10px; margin-left: 4px; } @media (hover: none) { .ws-rack .k { display: none; } .ws-rack .btn[data-m] { min-width: 0; } }';
  document.head.appendChild(st);
  b.el.querySelectorAll('[data-m]').forEach((e) => e.addEventListener('click', () => play(+e.dataset.m)));
  b.el.querySelector('[data-f]').addEventListener('click', forget);
  return b;
}
function caption(text) { const m = R.bar.el.querySelector('.msg'); m.textContent = text; R.bar.fit(); }
const intro = () => `Can you beat me over ${ROUNDS} rounds? Pick rock, paper or scissors. I learn your habits as we play.`;

// ---- playing
function play(move) {
  if (!R.screen || R.ws.open() !== 'rack') return;
  const now = performance.now();
  if (now - (R.lastPlay || 0) < 220) return;           // a double tap is not two rounds
  R.lastPlay = now;
  R.last = R.mind.play(move);
  R.press = move; R.pressT = 0.18; R.think = 0.7; R.flash = 1;
  caption(R.last.verdict ? `${R.last.verdict.title}. ${R.last.verdict.text} Pick a move to play again.` : `${MOVES[R.last.you]} vs ${MOVES[R.last.rack]}: ${R.last.res === 0 ? 'you win' : R.last.res === 1 ? 'I win' : 'draw'}. ${R.last.comment}`.replace(/^./, (c) => c.toUpperCase()));
  paintAll();
}
function forget() {
  R.mind.reset(); R.last = null; R.press = -1; R.think = 0.4;
  if (R.screen) { caption('Forgotten. ' + intro()); paintAll(); }
}
function paintAll() { [R.screen, R.ctl, R.left, R.right].forEach((P) => P && P.paint()); }

function update(dt, now, s) {
  if (!R.screen) return;
  if (!s.inside) { if (R.mind.history.length) { R.mind.reset(); R.last = null; paintAll(); } return; }   // forgotten on leaving
  if (s.focus && !s.open) return;                      // another station is open
  const conf = R.mind.history.length ? R.mind.knowledge().conf : 0;
  // fans: idle hum, faster with confidence and while thinking
  const target = 0.6 + conf * 9 + (R.think > 0 ? 3 : 0);
  R.fanSpin += (target - R.fanSpin) * Math.min(1, dt * 1.5);
  if (!R.ws.reduceMotion()) R.fans.forEach((f, i) => { f.rotation.z -= R.fanSpin * dt * (i % 2 ? 1.07 : 1); });
  // the button press and the thinking time
  if (R.pressT > 0) { R.pressT -= dt; if (R.pressT <= 0) R.ctl.paint(); }
  const thinking = R.think > 0;
  if (thinking) R.think -= dt;
  if (thinking && (R.paintT -= dt) <= 0) { R.paintT = 0.12; R.screen.paint(); R.left.paint(); }
  if (thinking && R.think <= 0) paintAll();
  R.flash = Math.max(0, R.flash - dt * 2);
  // LEDs, ~20 times a second: sparse slow blinking at rest, a busy flicker while thinking; the middle
  // rows show the network's hidden units
  if ((R.ledT -= dt) > 0) return;
  R.ledT = 0.05;
  const t = now / 1000, hid = R.mind.hidden(), C = new THREE.Color();
  R.ledInfo.forEach((L, n) => {
    let on;
    if (thinking) on = Math.random() < 0.55;
    else if (L.mid) { const v = hid[L.i % 10] || 0; on = (L.i < 10 ? Math.abs(v) : 0.15 + conf * 0.5) > (0.35 + 0.25 * Math.sin(t * L.rate + L.ph)); }
    else on = Math.sin(t * L.rate * (1 + conf * 2) + L.ph) > 0.55 - conf * 0.5 || L.ph < 0.9;   // a few always on
    R.leds.setColorAt(n, C.copy(L.c).multiplyScalar(on ? 1.4 + R.flash : 0.06));
  });
  R.leds.instanceColor.needsUpdate = true;
}

// the glass partition stands between the desk and the racks; while the game is open the camera looks
// through where its glass would be, so its frame steps aside
function partition(show) { const p = R.ws && R.ws.mesh('workshopglass_partition'); if (p) p.visible = show; }

register({
  id: 'rack', label: 'Server rack',
  pick: () => R.parts,
  get view() {
    return innerWidth < innerHeight ? { at: [FRONT, 4.21, MID], from: [-1, 0.1, 0], size: 1.12 }   // phones: the middle rack
      : { at: [FRONT, 4.12, MID], from: [-1, 0.12, 0], size: 3.0 };
  },
  hint: `Rock, paper, scissors: can you beat me over ${ROUNDS} rounds?`,
  setup: build,
  enter() { partition(false); R.bar.show(true); caption(R.last ? R.last.comment : intro()); },
  exit() { partition(true); R.bar.show(false); },
  update,
  pointer(type, ev) {
    if (type !== 'down') return false;
    const c = R.ctl.hit(ev, [...KEYS, FORGET]);
    if (!c) return false;
    if (c.move >= 0) play(c.move);
    else { forget(); R.pressT = 0.18; R.ctl.paint(); }
    return true;
  },
  key(ev) {
    const k = ev.key.toLowerCase(), i = ['1', '2', '3'].indexOf(k), j = ['r', 'p', 's'].indexOf(k);
    if (i >= 0 || j >= 0) { play(i >= 0 ? i : j); return true; }
    if (k === 'f') { forget(); return true; }
    return false;
  },
  // tests
  get mind() { return R.mind; },
  play, forget,
});
