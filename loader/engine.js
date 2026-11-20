// FEAT-045: the startup loader of the 3D page, ported from Smo's reference build (brandbook 4.13a,
// variation 18; the spec's other variations are not used). An ASCII field turns into a galaxy, star clouds fly
// to the header, and once the model is ready the name builds as bit blocks and bends into the mark, while the
// clouds become the name and the menu; then the station appears and the real header takes over.
// Times in s from the loader's start; tR = max(model ready, 8.6). The spec's stage is 1440 × 779 px: here the
// stage is the screen, positions follow it (galaxy, mark and loading line keep their place relative to the
// screen); the header targets are measured from the real header. Phones get two clouds: the name and MENU.
// It only runs when the inline script at the top of index.html set html.ldr (a fresh visit, without reduce motion).
import { W5, val, cl, e, eo, lerp, menuFold, letterBoxes, wordTransform } from './bits.js';

const NAME = 'SIMON WINKLER';
const INK = [29, 27, 24], RID = [121, 128, 114], PAP = [240, 237, 231];
const rgb = (c) => 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
const mixc = (a, b, k) => { k = cl(k); return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * k) + ',' + Math.round(a[1] + (b[1] - a[1]) * k) + ',' + Math.round(a[2] + (b[2] - a[2]) * k) + ')'; };
const INKs = rgb(INK), RIDs = rgb(RID);
const rnd = (i) => { const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const gauss = (i) => { const u = Math.max(1e-6, rnd(i)), v = rnd(i + 0.5); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const MINMID = 8.6, TMOVE = 5.5, SPD = 1.5, SMK = 1.8;

// ------------------------------------------------------------------ the mark (brandbook 1.5), made once
const B = (() => {
  const bit = (k, r) => (NAME[k] !== ' ' && (val(NAME[k]) & W5[r])) ? 1 : 0;
  const C = 150, S = 0.8, PHI = Math.PI / 3, SUN = 22, MR = 31.5, K = 0.4, LX = 24, LY = 15, NP = 22 * 14 / 13;
  const dsz = (r) => (18.75 - r * 2.75) * S;
  const BR = [110]; for (let r = 1; r < 5; r++) BR.push(BR[r - 1] - (dsz(r - 1) + dsz(r)) / 2 - 8);
  const ang = (k) => -Math.PI / 2 + PHI + (k + 1) * 2 * Math.PI / 14;
  const deg = (a) => a * 180 / Math.PI;
  let FAR = 0; for (let k = 0; k < 13; k++) for (let r = 0; r < 5; r++) if (bit(k, r)) { const a = ang(k), h = dsz(r) / 2; FAR = Math.max(FAR, Math.abs(BR[r] * Math.cos(a)) + h, Math.abs(BR[r] * Math.sin(a)) + h); }
  const COLS = []; for (let k = 0; k < 13; k++) if (NAME[k] !== ' ') COLS.push(k);
  const BITS = []; COLS.forEach((k) => { for (let r = 0; r < 5; r++) if (bit(k, r)) BITS.push({ k, r }); });
  const board = (mx, my) => [LX + K * mx, LY + K * my];
  const colX = (k) => LX + k * NP + NP / 2;
  const M = { C, S, PHI, SUN, MR, K, LX, LY, NP, dsz, BR, ang, deg, FAR, COLS, BITS, board, colX };
  // the 1.6 hover, p = 0 mark, 1 name (only its block layout at p = 0.54 is used: the name built as blocks)
  const TT = { pf: 0.08, gs: 0, gd: 0.28, ws: 0.06, st: 0.015, wd: 0.26, ss: 0.54, sd: 0.18, ls: 0.72, lst: 0.01, ld: 0.12 };
  const CS = 7, RP = 9, BY = 51;
  M.hover = (p) => {
    const pl = 1 - e(p / TT.pf), g = 1 - e((p - TT.gs) / TT.gd), sp = e((p - TT.ss) / TT.sd);
    const blockAt = (k, r) => { const c0 = board(C + (k - 6) * 21, C + (r - 2.5) * 21 + (r === 5 ? -6 : 0)), w0 = [colX(k), BY + r * RP - (r === 5 ? 1 : 0)]; return [lerp(c0[0], w0[0], sp), lerp(c0[1], w0[1], sp)]; };
    const startOf = (k) => TT.ws + k * TT.st, letterOf = (k) => e((p - TT.ls - k * TT.lst) / TT.ld);
    const bits = BITS.map(({ k, r }) => { const a = ang(k), b = 1 - e((p - startOf(k)) / TT.wd); const rp = board(C + BR[r] * Math.cos(a), C + BR[r] * Math.sin(a)), bp = blockAt(k, r); const cell = 15 * K + (CS - 15 * K) * sp, s = cell + (dsz(r) * K - cell) * b; return { x: lerp(bp[0], rp[0], b), y: lerp(bp[1], rp[1], b), w: s, h: s, rf: b, rot: (deg(a) - 90) * b, op: 1 - letterOf(k), k, r }; });
    const marks = COLS.map((k) => { if (g > 0.001) return null; const a = ang(k), mb = 1 - e((p - Math.max(startOf(k), TT.gs + TT.gd)) / TT.wd); const rp = board(C + MR * S * Math.cos(a), C + MR * S * Math.sin(a)), bp = blockAt(k, 5); const bw = 13 * K + (12 - 13 * K) * sp, bh = 6 * K + (3 - 6 * K) * sp; return { x: lerp(bp[0], rp[0], mb), y: lerp(bp[1], rp[1], mb), w: bw + (6 * S * K - bw) * mb, h: bh + (6 * S * K - bh) * mb, rf: mb, rot: (deg(a) - 90) * mb, op: 1 - letterOf(k), k }; });
    return { pl, sp, bits, marks };
  };
  M.nameT = (X, Y, s, sp) => ({ ax: X - (84 + 94 * sp) * s, ay: Y - 74 * s, s });
  // the name in Morse timing (the reference's letter clock: each letter's sparks follow its symbols), 1.8 s
  const MO = { E: '.', I: '..', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', R: '.-.', S: '...', W: '.--' };
  let u = 0; const raw = [];
  for (let k = 0; k < 13; k++) {
    if (NAME[k] === ' ') { u += 4; continue; }
    const code = MO[NAME[k]], syms = [];
    for (let i = 0; i < code.length; i++) { const d = code[i] === '.' ? 1 : 3; syms.push(u); u += d + 1; }
    u += 2; raw.push({ k, syms });
  }
  M.nMorse = raw.map((L) => ({ k: L.k, syms: L.syms.map((s) => ({ t0: s * 1.8 / u })) }));
  M.nDur = 1.8;
  return M;
})();

// ------------------------------------------------------------------ the stage for this screen
export function geometry() {
  const W = Math.max(320, window.innerWidth || 1440), H = Math.max(320, window.innerHeight || 779);
  const phone = !!(window.matchMedia && matchMedia('(max-width: 720px)').matches);
  const gs = phone ? Math.min(0.8, Math.max(0.45, W / 700)) : Math.max(W / 1440, H / 779);   // galaxy scale
  const ms = Math.min(1, (W - 32) / 330);                                                     // name and mark scale
  const ADX = 1440 / 172, ADY = 16;
  return {
    W, H, phone, gs, ms, ADX, ADY, AC: Math.ceil(W / ADX), AR: Math.ceil(H / ADY),
    G0: phone ? [W / 2, H / 2] : [W * 596 / 1440, H * 426 / 779],     // galaxy centre
    NC: [W / 2, phone ? H / 2 : H * 400 / 779],                       // where the name builds
    MK: [W / 2, phone ? H / 2 - 8 : H * 392 / 779],                   // where the mark forms
    LD: [W / 2, H - 34],                                             // the loading line
  };
}

export function prep(g) {
  const { W, H, gs, G0 } = g, P = { words: g.phone ? ['MENU'] : ['WORK', 'PLAY', 'ABOUT', 'CONTACT'] };
  const dust = [];
  for (let i = 0; i < 4600; i++) {
    const kind = rnd(i * 7 + 1), arm = i % 2;
    let R, th;
    if (kind < 0.55) { R = 36 + 780 * Math.pow(rnd(i * 5 + 3), 0.9); th = arm * Math.PI + Math.log(R / 40) / Math.tan(0.36) + gauss(i * 5 + 8) * 0.24; }
    else if (kind < 0.85) { R = 40 + 820 * Math.sqrt(rnd(i * 5 + 2)); th = 2 * Math.PI * rnd(i * 5 + 4); }
    else { R = 8 + Math.abs(gauss(i * 5 + 6)) * 110; th = 2 * Math.PI * rnd(i * 5 + 9); }
    const big = rnd(i * 13 + 5);
    dust.push({ R: R * gs, th, om: 0.2 * (250 / (R + 120)), rad: 0.55 + 1.5 * Math.pow(big, 3), al: 0.4 + 0.55 * rnd(i * 17 + 3), delay: rnd(i * 19 + 7) * 0.9 });
  }
  // the small field stars over the whole screen: 3,400 on the spec's stage, the same density on other screens
  const NF = Math.round(Math.min(4200, Math.max(900, 3400 * (W * H) / (1440 * 779))));
  for (let i = 0; i < NF; i++) {
    const x = -80 + (W + 160) * rnd(i * 3 + 7001), y = -60 + (H + 120) * rnd(i * 3 + 7002), dx = x - G0[0], dy = (y - G0[1]) / 0.78, R = Math.hypot(dx, dy);
    dust.push({ R, th: Math.atan2(dy, dx), om: 0.2 * (250 / (R / gs + 120)), rad: 0.4 + 0.5 * Math.pow(rnd(i * 3 + 7003), 2) + (rnd(i * 3 + 7006) < 0.04 ? 0.6 : 0), al: 0.18 + 0.37 * rnd(i * 5 + 7004), delay: rnd(i * 7 + 7005) * 0.9 });
  }
  P.dust = dust;
  // five denser clouds (four menu, one name) riding the galaxy; on a phone two: MENU and the name
  const BL = [{ R: 420, th: -2.25 }, { R: 455, th: -0.62 }, { R: 405, th: 0.95 }, { R: 470, th: 2.55 }, { R: 445, th: -1.45 }];
  const cloud = (bi, word, nx, sR, sT) => {
    const b0 = BL[bi], bl = { R: b0.R * gs, th: b0.th, om: 0.2 * (250 / (b0.R + 120)) }, pts = [];
    const n = word ? word.length + [...word].reduce((a, ch) => a + W5.filter((w) => val(ch) & w).length, 0) + nx : nx;
    for (let i = 0; i < n; i++) {
      const sd = bi * 900 + i * 7, dR = gauss(sd + 1) * sR, dT = gauss(sd + 2) * sT, R0 = b0.R + dR, R = R0 * gs;
      pts.push({ R, th: b0.th + dT / R0, om: 0.2 * (250 / (R0 + 120)), lx: gauss(sd + 3) * 15, ly: gauss(sd + 4) * 11, size: 0.5 + 1.25 * Math.pow(rnd(sd + 5), 3), al: 0.45 + 0.5 * rnd(sd + 6), delay: rnd(sd + 0.3) * 0.9 });
    }
    return { bl, pts };
  };
  P.clouds = g.phone ? [cloud(0, 'MENU', 150, 20, 30), cloud(4, null, 300, 26, 40)]
    : [0, 1, 2, 3].map((j) => cloud(j, P.words[j], 150, 20, 30)).concat([cloud(4, null, 300, 26, 40)]);
  return P;
}

// ------------------------------------------------------------------ the loader
class Loader {
  constructor(root) {
    this.root = root;
    this.cv = root.querySelector('canvas'); this.bg = root.querySelector('.ldr-bg'); this.gl = root.querySelector('.ldr-gl');
    this.ld = root.querySelector('.ldr-line'); this.tx = root.querySelector('.ldr-tx');
    this.time = 0; this.last = performance.now(); this.vis = true;
    this.loadReady = Infinity; this.tR = null; this.mc = 0; this.ldOp = 0; this.finished = false;
    this.layout();
    addEventListener('resize', () => this.layout());
    if (document.fonts) document.fonts.ready.then(() => { this.siteOk = false; });
    try { this.io = new IntersectionObserver((es) => { for (const en of es) this.vis = en.isIntersecting; }); this.io.observe(this.cv); } catch (err) { this.io = null; }
    this.done = new Promise((res) => { this.resolve = res; });
    const loop = (n) => {
      if (this.finished) return;
      const dt = Math.min(0.05, Math.max(0, (n - this.last) / 1000)); this.last = n;
      if (!this.siteOk || ++this.mc % 15 === 0) this.measureSite();   // again now and then: the page fits the name (fitName) after this starts
      if (this.vis) {
        if (!this.held) this.time += dt;
        const S = this.compute(this.time);
        this.draw(S); this.paint(S);
        if (S.done) { this.finish(); return; }
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  layout() { this.g = geometry(); this.P = prep(this.g); this.siteOk = false; this.srcKey = null; }
  // where every letter of the real header sits (the header is laid out but hidden while the loader runs)
  measureSite() {
    const site = document.getElementById('site'); if (!site) return;
    const name = letterBoxes(site.querySelector('.name'));
    const sel = this.g.phone ? ['#menu-toggle'] : ['#menu > :nth-child(1)', '#menu > :nth-child(2)', '#menu > :nth-child(3)', '#menu > :nth-child(4)'];
    const menu = sel.map((s) => { const el = site.querySelector(s); return el ? letterBoxes(el) : []; });
    if (name.length !== 12 || menu.some((L, j) => L.length !== this.P.words[j].length)) return;
    this.siteN = name; this.siteM = menu;
    this.siteH = site.getBoundingClientRect().height;
    this.siteOk = !document.fonts || document.fonts.status === 'loaded';
  }
  modelReady() { if (this.loadReady === Infinity) this.loadReady = this.time; }

  // ---------------------------------------------------------------- one frame
  compute(t) {
    const g = this.g, P = this.P, { K } = B, G0 = g.G0, NW = P.words.length, NJ = NW + 1;
    const out = { sh: [], tx: [], bgOp: 1, glassOp: eo((t - 0.6) / 1.0), done: false, ldOp: 0 };
    const sh = out.sh;
    const siteN = this.siteN || NAME.replace(' ', '').split('').map((c, i) => ({ t: c, x: 50 + (i < 5 ? i * 30 : (i - 5) * 20), y: i < 5 ? 24 : 45, ls: 0, fs: 23 }));
    const siteM = this.siteM || P.words.map((w, j) => w.split('').map((c, i) => ({ t: c, x: g.W - 300 + j * 70 + i * 11, y: 36, ls: 2, fs: 12 })));
    const TMs = siteM.map(wordTransform);
    if (this.tR == null && t >= Math.max(this.loadReady, MINMID)) this.tR = Math.max(this.loadReady, MINMID);
    const tR = this.tR;
    // the line from the website: three dots on their 5.1 s loop and LOADING MODEL…, small, at the bottom; it leaves once the model is ready
    const ldOp = eo((t - 0.8) / 0.8) * (tR == null ? 1 : 1 - e((t - tR) / 0.7));
    out.ldOp = ldOp; this.ldOp = ldOp;
    if (ldOp > 0.003) {
      const A3 = [-Math.PI / 2, Math.PI / 6, 5 * Math.PI / 6], sm = (x) => { x = cl(x); return x * x * (3 - 2 * x); }, u = (t % 5.1) / 5.1, sc = 0.38, cx = g.LD[0] - 66, cy = g.LD[1];
      for (let i = 0; i < 3; i++) {
        let px, py;
        if (u < 0.52941) { const st = Math.min(5, Math.floor(u / 0.088235)), f = sm((u - st * 0.088235) / 0.07451), a0 = A3[(i + st) % 3], a1 = A3[(i + st + 1) % 3]; px = 16 * lerp(Math.cos(a0), Math.cos(a1), f); py = 16 * lerp(Math.sin(a0), Math.sin(a1), f); }
        else { let a = A3[i], r = 16; if (u < 0.59804) r = 16 + 8 * sm((u - 0.52941) / 0.06863); else if (u < 0.91176) { r = 24; a += 4 * Math.PI * (u - 0.59804) / 0.31372; } else r = 24 - 8 * sm((u - 0.91176) / 0.06863); px = r * Math.cos(a); py = r * Math.sin(a); }
        sh.push({ k: 'c', x: cx + px * sc, y: cy + py * sc, r: 1.7, c: 'rgb(94,88,80)', a: 0.85 * ldOp });
      }
    }
    const R = (x, y, w, h, rf, rot, c, a) => sh.push({ k: 'r', x, y, w, h, rf, rot, c, a });
    let invK = 0;
    const ckc = (arr) => invK > 0 ? mixc(arr, PAP, invK) : rgb(arr);
    const emitName = (G, T, alpha) => {
      const bk = cl(1 - G.pl), bc = ckc([0, 1, 2].map((i) => Math.round(INK[i] + (RID[i] - INK[i]) * bk)));
      G.bits.forEach((el) => R(T.ax + el.x * T.s, T.ay + el.y * T.s, el.w * T.s, el.h * T.s, el.rf, el.rot, bc, el.op * alpha));
      G.marks.forEach((el) => { if (el) R(T.ax + el.x * T.s, T.ay + el.y * T.s, el.w * T.s, el.h * T.s, el.rf, el.rot, ckc(INK), el.op * alpha); });
      G.circ.forEach((c) => sh.push({ k: 'c', x: T.ax + c.x * T.s, y: T.ay + c.y * T.s, r: c.r * T.s, c: ckc(INK), a: c.op * alpha }));
      const fo = G.pl * alpha;
      if (fo > 0.003) { const a0 = 150 - B.FAR - 16, bx = B.LX + K * a0, by = B.LY + K * a0, sz = K * (300 - 2 * a0); sh.push({ k: 'f', x: T.ax + bx * T.s, y: T.ay + by * T.s, w: sz * T.s, h: sz * T.s, r: 60 * K * T.s, lw: 6 * K * T.s, c: INKs, a: fo }); }
    };
    const emitMenu = (j, q, T, alpha) => {
      const M = menuFold(P.words[j], q);
      M.cells.forEach((c) => R(T.ax + c.x * T.s, T.ay + c.y * T.s, c.w * T.s, c.h * T.s, 0, 0, c.mk ? INKs : RIDs, c.o * alpha));
      M.letters.forEach((l, k) => { if (l.o * alpha < 0.003) return; const q5 = siteM[j][k]; out.tx.push({ t: l.t, x: q5.x, y: q5.y, fs: q5.fs, fw: 400, st: 108, ls: q5.ls, o: l.o * alpha }); });
    };

    const tN = tR == null ? Infinity : tR + 0.4;
    const nAbs = (s) => tN + s;
    const tMorph = tN + B.nDur + 0.35 + 0.9;      // the bend begins: tR + 3.45
    const tFly = tMorph + 3.4 / SPD;              // tR + 5.72: the name cloud is drawn into the letters
    const tEnd = tMorph + 2.6 + 5.6 / SPD;        // tR + 9.78: done
    if (t >= tEnd) {
      out.done = true; out.bgOp = 0; out.glassOp = 1;
      for (let j = 0; j < NW; j++) emitMenu(j, 1, TMs[j], 1);
      siteN.forEach((q5) => out.tx.push({ t: q5.t, x: q5.x, y: q5.y, fs: q5.fs, fw: 700, st: 116, ls: q5.ls, o: 1 }));
      return out;
    }
    const markTat = (T0b, tau) => { const mcx = B.LX + K * B.C, mcy = B.LY + K * B.C, f = e(tau / 2.4), cx = lerp(T0b.ax + mcx * T0b.s, g.MK[0], f), cy = lerp(T0b.ay + mcy * T0b.s, g.MK[1], f), sk = lerp(T0b.s, SMK * g.ms, f); return { ax: cx - mcx * sk, ay: cy - mcy * sk, s: sk }; };
    // the 1.5 motion: blocks bend onto their spokes, the markers spiral into the sun, the plate appears
    const m15 = (tau) => {
      const { C, S, SUN, MR, BR, dsz, ang, deg, board } = B, CELL = 15, B0 = 0, BD = 2.4, T0 = B0 + BD + 0.2, DUR = 1.9, TRN = Math.PI * 0.9;
      const pol = (r, a) => board(C + r * Math.cos(a), C + r * Math.sin(a)), blk = (k, r) => board(C + (k - 6) * 21, C + (r - 2.5) * 21 + (r === 5 ? -6 : 0));
      const bend = e((tau - B0) / BD), m = bend, live = tau >= T0;
      const bits = B.BITS.map(({ k, r }) => { const a = ang(k), q = pol(BR[r], a), bp = blk(k, r), sz = (CELL + (dsz(r) - CELL) * m) * K; return { x: lerp(bp[0], q[0], bend), y: lerp(bp[1], q[1], bend), w: sz, h: sz, rf: m, rot: (deg(a) - 90) * bend, op: 1, k, r }; });
      const marks = B.COLS.map((k) => { if (live) return null; const a = ang(k), q = pol(MR * S, a), bp = blk(k, 5); return { x: lerp(bp[0], q[0], bend), y: lerp(bp[1], q[1], bend), w: (CELL - (CELL - 6 * S) * m) * K, h: (6 - (6 - 6 * S) * m) * K, rf: m, rot: (deg(a) - 90) * bend, op: 1, k }; });
      const gg0 = e((tau - T0) / DUR), circ = [];
      if (live) {
        const dn = cl((tau - (T0 + DUR - 0.1)) / 0.1);
        if (dn >= 1) circ.push({ x: board(C, C)[0], y: board(C, C)[1], r: SUN * K, op: 1 });
        else {
          const rr = MR * S * (1 - gg0), rd = Math.min(3 + (SUN - 3) * gg0, Math.max(3, SUN - rr));
          B.COLS.forEach((k) => {
            const q = pol(rr, ang(k) + gg0 * TRN); circ.push({ x: q[0], y: q[1], r: rd * K, op: 1 });
            [0.1, 0.2].forEach((lag, j) => { const gg = e((tau - T0 - lag * DUR) / DUR); if (gg <= 0 || gg0 >= 0.98) return; const q2 = pol(MR * S * (1 - gg), ang(k) + gg * TRN); circ.push({ x: q2[0], y: q2[1], r: (2 + 3 * gg) * K, op: (j === 0 ? 0.45 : 0.22) * (1 - gg0) }); });
          });
          if (dn > 0) circ.push({ x: board(C, C)[0], y: board(C, C)[1], r: SUN * K, op: dn });
        }
      }
      const pl = e((tau - (T0 + DUR - 0.2)) / 0.9);
      return { pl, sp: 0, bits, marks, circ };
    };

    // ---- ASCII field, fading as its characters become the galaxy
    const LET = 'SIMONWINKLERWORKPLAYABOUTCONTACT', ramp = ' .:-=+*#%@', fr = Math.floor(t * 14);
    const aA = eo(t / 0.4) * (1 - e((t - 3.2) / 4.4));
    const blobs = P.clouds.map((c) => c.bl);
    const armDen = (px, py) => {
      const dx = (px - G0[0]) / g.gs, dy = (py - G0[1]) / 0.78 / g.gs, Rr = Math.hypot(dx, dy), th = Math.atan2(dy, dx), om = 0.2 * (250 / (Rr + 120));
      let best = 9; for (let arm = 0; arm < 2; arm++) { const ta = arm * Math.PI + Math.log(Math.max(Rr, 40) / 40) / Math.tan(0.36) + om * t; const dth = Math.atan2(Math.sin(th - ta), Math.cos(th - ta)); best = Math.min(best, Math.abs(dth)); }
      let mb = 0; for (let j = 0; j < Math.min(4, blobs.length); j++) { const bl = blobs[j], ab = bl.th + bl.om * t, mx = G0[0] + bl.R * Math.cos(ab), my = G0[1] + bl.R * Math.sin(ab) * 0.78; mb += 0.5 * Math.exp(-(Math.pow(px - mx, 2) + Math.pow(py - my, 2)) / (34 * 34)); }
      return Math.exp(-Math.pow(best / 0.3, 2)) * (Rr < 820 ? 0.55 + 0.45 * Math.exp(-Rr / 320) : 0) + 0.95 * Math.exp(-Math.pow(Rr / 85, 2)) + 0.14 * Math.exp(-Rr / 520) + mb;
    };
    if (aA > 0.003) {
      const kS = 0.72 * e((t - 0.6) / 5.4), rows = [], hx = g.AC / 2, hy = g.AR / 2;
      for (let y = 0; y < g.AR; y++) { let s = ''; for (let x = 0; x < g.AC; x++) { const v = Math.sin(x * 0.07 + t * 1.2) + Math.sin(y * 0.16 - t * 0.9) + Math.sin((x + y) * 0.05 + t * 0.7) + Math.sin(Math.hypot(x - hx, (y - hy) * 2) * 0.11 - t * 2); const nz = rnd(x * 31 + y * 7 + fr * 13) - 0.5; const d0 = (v + 4) / 8 + nz * 0.35; const d1 = Math.min(1, armDen((x + 0.5) * g.ADX, (y + 0.5) * g.ADY) * 1.05) + nz * 0.12; const d = d0 * (1 - kS) + d1 * kS; const ki = Math.max(0, Math.min(9, Math.floor(d * 10))); s += ki === 9 && kS < 0.6 ? LET[(x + y * 3) % LET.length] : ramp[ki]; } rows.push(s); }
      sh.push({ k: 'a', rows, x: 0, y: g.ADY / 2, dy: g.ADY, font: '500 14px "IBM Plex Mono", ui-monospace, monospace', c: INKs, a: aA * 0.5 });
    }
    // ---- the galaxy, each star born from a character
    const dustOut = t < tMorph ? 1 : 1 - e((t - tMorph) / 1.6);
    const ldM = (x, y) => { const lo = this.ldOp || 0; if (lo <= 0.003) return 1; const z = Math.pow((x - (g.LD[0] - 8)) / 150, 2) + Math.pow((y - g.LD[1]) / 24, 2); return z > 1.6 ? 1 : 1 - lo * 0.9 * (Math.exp(-z * 1.6) - 0.0773) / 0.9227; };
    if (dustOut > 0.003) P.dust.forEach((d) => {
      const ts = 2.2 + d.delay * 4.2, app = e((t - ts) / 1.3); if (app <= 0) return;
      const a = d.th + d.om * t, xg = G0[0] + d.R * Math.cos(a), yg = G0[1] + d.R * Math.sin(a) * 0.78;
      const as = d.th + d.om * ts, xs = G0[0] + d.R * Math.cos(as), ys = G0[1] + d.R * Math.sin(as) * 0.78;
      const cx = (Math.floor(xs / g.ADX) + 0.5) * g.ADX, cy = (Math.floor(ys / g.ADY) + 0.5) * g.ADY, f = e((t - ts) / 3.0);
      const x = lerp(cx, xg, f), y = lerp(cy, yg, f);
      if (x < -10 || x > g.W + 10 || y < -10 || y > g.H + 10) return;
      const lm = ldM(x, y); if (d.rad < 0.95) sh.push({ k: 'q', x, y, s: d.rad * 2, c: INKs, a: d.al * app * dustOut * lm }); else sh.push({ k: 'c', x, y, r: d.rad, c: INKs, a: d.al * app * dustOut * lm });
    });
    const starAt = (d, tt) => { const a = d.th + d.om * tt; return [G0[0] + d.R * Math.cos(a), G0[1] + d.R * Math.sin(a) * 0.78]; };
    // sparks: taken from galaxy stars, they fly into a cell and the cell grows from them
    const sparksInto = (syms, cells, seed) => {
      const tS0 = syms[0].t0, tL = syms[syms.length - 1].t0, span = tL - tS0 + 0.15, NS = 5;
      cells.forEach((c, ci) => {
        let got = 0;
        for (let i = 0; i < NS; i++) {
          const tb = tS0 + ((ci * NS + i + 0.5) / (cells.length * NS)) * span;
          if (t < tb) continue;
          const st = starAt(P.dust[(seed + ci * 7 + i * 13) % P.dust.length], tb);
          const f = eo((t - tb) / 0.5), tx = c.x(), ty = c.y();
          if (f >= 1) { got++; continue; }
          sh.push({ k: 'q', x: lerp(st[0], tx, f), y: lerp(st[1], ty, f), s: 2.2, c: c.mk ? INKs : RIDs, a: 0.9 });
          got += f * 0.6;
        }
        c.grow = Math.min(1, got / NS);
      });
    };
    // ---- the clouds: they leave for the header at 5.5 s on paths that do not cross, wait there squashed to
    // their word's box, and only then are their points drawn into the words
    const blobAt = (k, tt) => { const bl = blobs[k], a = bl.th + bl.om * tt; return [G0[0] + bl.R * Math.cos(a), G0[1] + bl.R * Math.sin(a) * 0.78]; };
    const tgt = (j) => { const L = j < NW ? siteM[j] : siteN; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; L.forEach((q) => { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }); return { L, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, W: x1 - x0 + (j < NW ? 10 : 20), H: y1 - y0 + (j < NW ? 12 : 22), fs: L[0].fs }; };
    // which cloud goes where is chosen once at departure: every pairing is tried, the shortest total way without crossings wins
    const key = JSON.stringify([siteN[0], siteM[0][0], g.W, g.H]);
    if (this.srcKey !== key) {
      const dst = [], org = [];
      for (let j = 0; j < NJ; j++) { const T5 = tgt(j); dst.push([T5.cx, T5.cy]); org.push(blobAt(j, TMOVE + 0.36)); }
      const cross = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
      let best = null, bestC = Infinity;
      const perm = (arr, l) => { if (l === arr.length) { let c = 0; for (let j = 0; j < NJ; j++) { c += Math.hypot(org[arr[j]][0] - dst[j][0], org[arr[j]][1] - dst[j][1]); for (let i = 0; i < j; i++) if (cross(org[arr[i]], dst[i], org[arr[j]], dst[j])) c += 5000; } if (c < bestC) { bestC = c; best = arr.slice(); } return; } for (let i = l; i < arr.length; i++) { [arr[l], arr[i]] = [arr[i], arr[l]]; perm(arr, l + 1); [arr[l], arr[i]] = [arr[i], arr[l]]; } };
      perm([...Array(NJ).keys()], 0);
      this.src = best; this.srcKey = key;
    }
    const SRC = this.src;
    for (let j = 0; j < NJ; j++) {
      const G5 = tgt(j), cS = e((t - (j < NW ? tFly + 0.3 + j * 0.15 : tFly)) / (j < NW ? 1.2 : 1.8));
      if (j < NW && cS > 0) { const t0 = tFly + 0.3 + j * 0.15; emitMenu(j, e((t - t0 - 1.5) / 0.9), TMs[j], e((cS - 0.35) / 0.65)); }
      else if (cS > 0) G5.L.forEach((q5) => { const o = e((cS - 0.35) / 0.65); if (o > 0.003) out.tx.push({ t: q5.t, x: q5.x, y: q5.y, fs: q5.fs, fw: 700, st: 116, ls: q5.ls, o }); });
      const fC = e((t - TMOVE - j * 0.18) / 2.8), cells = j < NW ? menuFold(P.words[j], 0).cells : [], S0 = [G5.cx, G5.cy];
      const tC = Math.min(t, TMOVE + j * 0.18), csx = G5.W / 60, csy = G5.H / 44, sj = SRC[j], cld = P.clouds[sj], bl = cld.bl, abC = bl.th + bl.om * tC, BC = [G0[0] + bl.R * Math.cos(abC), G0[1] + bl.R * Math.sin(abC) * 0.78];
      const nx = -(S0[1] - BC[1]), ny = S0[0] - BC[0], nl = Math.hypot(nx, ny) || 1, bow = Math.sin(Math.PI * fC) * 24;
      const fadeC = 1 - e((cS - 0.45) / 0.55);
      if (fadeC <= 0.003) continue;
      cld.pts.forEach((pt, pi) => {
        const ts = 2.2 + pt.delay * 4.2, app = e((t - ts) / 1.3); if (app <= 0) return;
        const ag = pt.th + pt.om * t, xg = G0[0] + pt.R * Math.cos(ag), yg = G0[1] + pt.R * Math.sin(ag) * 0.78;
        const as = pt.th + pt.om * ts, cx = (Math.floor((G0[0] + pt.R * Math.cos(as)) / g.ADX) + 0.5) * g.ADX, cy = (Math.floor((G0[1] + pt.R * Math.sin(as) * 0.78) / g.ADY) + 0.5) * g.ADY;
        const f0 = e((t - ts) / 3.0);
        let x = lerp(cx, xg, f0), y = lerp(cy, yg, f0);
        if (fC > 0) {
          // in the header the cloud keeps its shape, squashed to its word's box, slowly turning
          const rot = 0.18 * (t - TMOVE), ac = 0.18 * t + pt.delay * 9, lx = pt.lx * Math.cos(rot) - pt.ly * Math.sin(rot), ly = pt.lx * Math.sin(rot) + pt.ly * Math.cos(rot);
          const ccx = lerp(x, S0[0] + lx * csx + Math.sin(ac) * 1.2, fC), ccy = lerp(y, S0[1] + ly * csy + Math.cos(ac) * 1.0, fC);
          x = ccx + nx / nl * bow; y = ccy + ny / nl * bow;
        }
        if (x < -10 || x > g.W + 10 || y < -10 || y > g.H + 10) return;
        const lm = ldM(x, y);
        // each point is drawn into one bit (menu) or one letter (name) of its word, then goes out as the word comes in
        const q5 = j < NW ? (() => { const c = cells[pi % cells.length], T = TMs[j]; return { x: T.ax + c.x * T.s, y: T.ay + c.y * T.s }; })() : G5.L[pi % G5.L.length];
        const jx = (rnd(pi * 3 + j * 77) - 0.5) * G5.fs * 0.7, jy = (rnd(pi * 5 + j * 71) - 0.5) * G5.fs * 0.8;
        const cc = e(cS / 0.8), xx = lerp(x, q5.x + jx * (1 - cc * 0.7), cc), yy = lerp(y, q5.y + jy * (1 - cc * 0.7), cc), a = pt.al * app * lm * fadeC;
        if (a > 0.003) sh.push({ k: 'c', x: xx, y: yy, r: pt.size, c: INKs, a });
      });
    }
    // ---- the name: built as blocks column by column with each letter read out above, then bent into the mark
    if (t >= tN) {
      const s7 = 3.0 * g.ms, T = B.nameT(g.NC[0], g.NC[1] - s7, s7, 0);
      if (t < tMorph) {
        const G = B.hover(0.54);
        B.nMorse.forEach((L) => {
          const els = G.bits.filter((b) => b.k === L.k).map((b) => ({ el: b, mk: false })).concat(G.marks.filter((m) => m && m.k === L.k).map((m) => ({ el: m, mk: true })));
          const cells = els.map((o) => ({ mk: o.mk, x: () => T.ax + o.el.x * T.s, y: () => T.ay + o.el.y * T.s, el: o.el }));
          sparksInto(L.syms.map((q) => ({ t0: nAbs(q.t0) })), cells, 700 + L.k * 13);
          cells.forEach((c) => { const gr = c.grow || 0; if (gr <= 0) return; R(c.x(), c.y(), c.el.w * T.s * gr, c.el.h * T.s * gr, 0, 0, c.mk ? INKs : RIDs, 1); });
          const o = eo((t - nAbs(L.syms[L.syms.length - 1].t0) - 0.1) / 0.35) * (1 - e((t - tMorph - 0.2) / 0.6));
          const bx = T.ax + (B.LX + K * (B.C + (L.k - 6) * 21)) * T.s;
          if (o > 0.003) out.tx.push({ t: NAME[L.k], x: bx, y: T.ay + (B.LY + K * (B.C - 60)) * T.s - 26 * g.ms, fs: 28 * g.ms, fw: 700, st: 112, ls: 0, o });
        });
      } else {
        // the mark forms in the middle and leaves together with the background; the plate fills black as it
        // appears, the dots and the sun turn white on it
        const tau = t - tMorph, Tm = markTat(T, tau), mo = 1 - e((tau - 5.6 / SPD) / 1.6), Gm = m15(tau * SPD);
        if (mo > 0.003) {
          const a0 = 150 - B.FAR - 16, bx = B.LX + K * a0, sz = K * (300 - 2 * a0);
          sh.push({ k: 'F', x: Tm.ax + bx * Tm.s, y: Tm.ay + (B.LY + K * a0) * Tm.s, w: sz * Tm.s, h: sz * Tm.s, r: 60 * K * Tm.s, c: INKs, a: Gm.pl * mo });
          invK = Gm.pl;
          emitName(Gm, Tm, mo);
          invK = 0;
        }
      }
    }
    out.bgOp = 1 - e((t - tMorph - 5.6 / SPD) / 2.2);
    return out;
  }

  // ---------------------------------------------------------------- paint
  draw(S) {
    const cv = this.cv, g = this.g, dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(g.W * dpr), H = Math.round(g.H * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const c = cv.getContext('2d'); if (!c) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, g.W, g.H);
    const rr = (x, y, w, h, r) => { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r); c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r); c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r); c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r); c.closePath(); };
    for (const s of S.sh) {
      if (!(s.a > 0.003)) continue;
      c.globalAlpha = Math.min(1, s.a);
      if (s.k === 'r') {
        const w = s.w, h = s.h; if (!(w > 0.05 && h > 0.05)) continue;
        c.fillStyle = s.c; const rad = Math.min(w, h) / 2 * Math.max(0, Math.min(1, s.rf));
        if (s.rot) { c.save(); c.translate(s.x, s.y); c.rotate(s.rot * Math.PI / 180); if (rad < 0.05) c.fillRect(-w / 2, -h / 2, w, h); else { rr(-w / 2, -h / 2, w, h, rad); c.fill(); } c.restore(); }
        else if (rad < 0.05) c.fillRect(s.x - w / 2, s.y - h / 2, w, h); else { rr(s.x - w / 2, s.y - h / 2, w, h, rad); c.fill(); }
      } else if (s.k === 'c') { if (!(s.r > 0.05)) continue; c.fillStyle = s.c; c.beginPath(); c.arc(s.x, s.y, s.r, 0, 2 * Math.PI); c.fill(); }
      else if (s.k === 'q') { c.fillStyle = s.c; c.fillRect(s.x - s.s / 2, s.y - s.s / 2, s.s, s.s); }
      else if (s.k === 'a') { c.fillStyle = s.c; c.font = s.font; c.textBaseline = 'middle'; for (let j = 0; j < s.rows.length; j++) c.fillText(s.rows[j], s.x, s.y + j * s.dy); }
      else if (s.k === 'f') { c.strokeStyle = s.c; c.lineWidth = s.lw; rr(s.x, s.y, s.w, s.h, s.r); c.stroke(); }
      else if (s.k === 'F') { c.fillStyle = s.c; rr(s.x, s.y, s.w, s.h, s.r); c.fill(); }
    }
    c.globalAlpha = 1;
  }
  // the layers around the canvas: backdrop, header glass, loading line, letters
  paint(S) {
    const g = this.g;
    this.bg.style.opacity = S.bgOp.toFixed(3);
    this.gl.style.opacity = S.glassOp.toFixed(3);
    this.gl.style.height = Math.round(this.siteH || (g.phone ? 70 : 84) + 1) + 'px';
    this.ld.style.opacity = (S.ldOp || 0).toFixed(3);
    this.ld.style.left = (g.LD[0] - 48) + 'px'; this.ld.style.top = g.LD[1] + 'px';
    this.tx.innerHTML = S.tx.map((t) => '<span style="left:' + t.x.toFixed(2) + 'px;top:' + t.y.toFixed(2) + 'px;font-size:' + t.fs.toFixed(2) + 'px;font-weight:' + t.fw +
      ';font-stretch:' + t.st + '%;font-variation-settings:\'wdth\' ' + t.st + ';letter-spacing:' + (t.ls || 0).toFixed(2) + 'px;opacity:' + t.o.toFixed(3) + '">' + t.t + '</span>').join('');
  }
  // done: the real header takes over (same letter positions), the loader fades away in 0.4 s
  finish() {
    this.finished = true;
    if (this.io) this.io.disconnect();
    document.documentElement.classList.remove('ldr');
    this.root.classList.add('ldr-out');
    setTimeout(() => { this.root.hidden = true; this.root.classList.remove('ldr-on'); this.resolve(); }, 450);
  }
  // the model could not be loaded: the loader steps aside for the error line
  fail() { if (this.finished) return; cancelAnimationFrame(this.raf); this.finish(); }
}

const root = document.getElementById('ldr');
export const intro = (document.documentElement.classList.contains('ldr') && root) ? new Loader(root) : null;
// test hooks (?test only): hold the clock, seek to a time, measure one frame
if (intro && new URLSearchParams(location.search).has('test')) {
  window.__intro = {
    hold(on = true) { intro.held = on; },
    seek(t) { intro.held = true; intro.time = t; },
    state: () => ({ time: intro.time, tR: intro.tR, loadReady: intro.loadReady, finished: intro.finished, siteOk: !!intro.siteOk }),
    cost(t) { const a = performance.now(), S = intro.compute(t), b = performance.now(); intro.draw(S); return { compute: b - a, draw: performance.now() - b, shapes: S.sh.length }; },
  };
}
