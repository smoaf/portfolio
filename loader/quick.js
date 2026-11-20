// FEAT-046: the short loader. When a visitor goes into the radio room, the van or the safari before it has
// finished loading in the background, this plays until the place is ready: the first part of the startup
// loader (loader/engine.js, FEAT-045), the ASCII field turning into the star field, with the "Loading model…"
// line and its three dots. No name, no mark, no header: the field uses only the density characters (the
// startup's field also spells the name and the menu words), and the menu clouds are left out.
// Same fonts and colours as the startup loader, played faster at first so the stars are there within ~2.5 s.
// It fades out (0.3 s) the moment the place is ready. With reduce motion it shows one still frame.
import { e, eo, lerp } from './bits.js';
import { geometry, prep } from './engine.js';

const INK = 'rgb(29,27,24)', DOT = 'rgb(94,88,80)';
const RAMP = ' .:-=+*#%@';
const T0 = 1.2, FAST = 2, FORMED = 8;              // start into the field, twice as fast until the galaxy has formed
const rnd = (i) => { const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };

let root = null, cv = null, line = null, g = null, P = null, raf = 0, time = 0, last = 0, users = 0, outT = 0, shownAt = 0;
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function build() {
  root = document.createElement('div');
  root.id = 'ldq'; root.hidden = true;
  root.innerHTML = '<div class="ldq-bg"></div><canvas aria-hidden="true"></canvas><div class="ldq-line" role="status">Loading model…</div>';
  document.body.appendChild(root);
  cv = root.querySelector('canvas'); line = root.querySelector('.ldq-line');
  addEventListener('resize', () => { if (!root.hidden) layout(); });
}
function layout() {
  g = geometry(); P = prep(g);
  line.style.left = (g.LD[0] - 48) + 'px'; line.style.top = g.LD[1] + 'px';
}

// one frame at loader time t (the startup's own formulas for the field, the stars and the dots)
function draw(t) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(g.W * dpr), H = Math.round(g.H * dpr);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const c = cv.getContext('2d'); if (!c) return;
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, g.W, g.H);
  const G0 = g.G0, ldOp = eo((t - T0) / 0.5);
  line.style.opacity = ldOp.toFixed(3);
  // the ASCII field, fading as its characters become the galaxy
  const fr = Math.floor(t * 14), aA = eo((t - T0 + 0.4) / 0.4) * (1 - e((t - 3.2) / 4.4));
  const armDen = (px, py) => {
    const dx = (px - G0[0]) / g.gs, dy = (py - G0[1]) / 0.78 / g.gs, Rr = Math.hypot(dx, dy), th = Math.atan2(dy, dx), om = 0.2 * (250 / (Rr + 120));
    let best = 9; for (let arm = 0; arm < 2; arm++) { const ta = arm * Math.PI + Math.log(Math.max(Rr, 40) / 40) / Math.tan(0.36) + om * t; const dth = Math.atan2(Math.sin(th - ta), Math.cos(th - ta)); best = Math.min(best, Math.abs(dth)); }
    return Math.exp(-Math.pow(best / 0.3, 2)) * (Rr < 820 ? 0.55 + 0.45 * Math.exp(-Rr / 320) : 0) + 0.95 * Math.exp(-Math.pow(Rr / 85, 2)) + 0.14 * Math.exp(-Rr / 520);
  };
  if (aA > 0.003) {
    const kS = 0.72 * e((t - 0.6) / 5.4), hx = g.AC / 2, hy = g.AR / 2;
    c.globalAlpha = aA * 0.5; c.fillStyle = INK; c.font = '500 14px "IBM Plex Mono", ui-monospace, monospace'; c.textBaseline = 'middle';
    for (let y = 0; y < g.AR; y++) {
      let s = '';
      for (let x = 0; x < g.AC; x++) {
        const v = Math.sin(x * 0.07 + t * 1.2) + Math.sin(y * 0.16 - t * 0.9) + Math.sin((x + y) * 0.05 + t * 0.7) + Math.sin(Math.hypot(x - hx, (y - hy) * 2) * 0.11 - t * 2);
        const nz = rnd(x * 31 + y * 7 + fr * 13) - 0.5, d0 = (v + 4) / 8 + nz * 0.35;
        const d1 = Math.min(1, armDen((x + 0.5) * g.ADX, (y + 0.5) * g.ADY) * 1.05) + nz * 0.12;
        s += RAMP[Math.max(0, Math.min(9, Math.floor((d0 * (1 - kS) + d1 * kS) * 10)))];
      }
      c.fillText(s, 0, g.ADY / 2 + y * g.ADY);
    }
  }
  // the star field, each star born from a character; the stars thin out round the loading line
  const ldM = (x, y) => { if (ldOp <= 0.003) return 1; const z = Math.pow((x - (g.LD[0] - 8)) / 150, 2) + Math.pow((y - g.LD[1]) / 24, 2); return z > 1.6 ? 1 : 1 - ldOp * 0.9 * (Math.exp(-z * 1.6) - 0.0773) / 0.9227; };
  c.fillStyle = INK;
  for (const d of P.dust) {
    const ts = 2.2 + d.delay * 4.2, app = e((t - ts) / 1.3); if (app <= 0) continue;
    const a = d.th + d.om * t, xg = G0[0] + d.R * Math.cos(a), yg = G0[1] + d.R * Math.sin(a) * 0.78;
    const as = d.th + d.om * ts, xs = G0[0] + d.R * Math.cos(as), ys = G0[1] + d.R * Math.sin(as) * 0.78;
    const cx = (Math.floor(xs / g.ADX) + 0.5) * g.ADX, cy = (Math.floor(ys / g.ADY) + 0.5) * g.ADY, f = e((t - ts) / 3.0);
    const x = lerp(cx, xg, f), y = lerp(cy, yg, f);
    if (x < -10 || x > g.W + 10 || y < -10 || y > g.H + 10) continue;
    const al = Math.min(1, d.al * app * ldM(x, y)); if (al <= 0.003) continue;
    c.globalAlpha = al;
    if (d.rad < 0.95) c.fillRect(x - d.rad, y - d.rad, d.rad * 2, d.rad * 2); else { c.beginPath(); c.arc(x, y, d.rad, 0, 2 * Math.PI); c.fill(); }
  }
  // the three dots on their 5.1 s loop, left of the line
  if (ldOp > 0.003) {
    const A3 = [-Math.PI / 2, Math.PI / 6, 5 * Math.PI / 6], sm = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    const u = (t % 5.1) / 5.1, sc = 0.38, cx = g.LD[0] - 66, cy = g.LD[1];
    c.fillStyle = DOT; c.globalAlpha = 0.85 * ldOp;
    for (let i = 0; i < 3; i++) {
      let px, py;
      if (u < 0.52941) { const st = Math.min(5, Math.floor(u / 0.088235)), f = sm((u - st * 0.088235) / 0.07451), a0 = A3[(i + st) % 3], a1 = A3[(i + st + 1) % 3]; px = 16 * lerp(Math.cos(a0), Math.cos(a1), f); py = 16 * lerp(Math.sin(a0), Math.sin(a1), f); }
      else { let a = A3[i], r = 16; if (u < 0.59804) r = 16 + 8 * sm((u - 0.52941) / 0.06863); else if (u < 0.91176) { r = 24; a += 4 * Math.PI * (u - 0.59804) / 0.31372; } else r = 24 - 8 * sm((u - 0.91176) / 0.06863); px = r * Math.cos(a); py = r * Math.sin(a); }
      c.beginPath(); c.arc(cx + px * sc, cy + py * sc, 1.7, 0, 2 * Math.PI); c.fill();
    }
  }
  c.globalAlpha = 1;
}
function loop(n) {
  const dt = Math.min(0.05, Math.max(0, (n - last) / 1000)); last = n;
  time += dt * (time < FORMED ? FAST : 1);
  draw(time);
  raf = requestAnimationFrame(loop);
}

function show() {
  if (!root) build();
  clearTimeout(outT);
  if (!root.hidden && !root.classList.contains('ldq-out')) return;
  root.classList.add('ldq-out'); root.hidden = false; void root.offsetWidth;   // fades in over the dark fade
  root.classList.remove('ldq-out'); shownAt = performance.now();
  layout();
  cancelAnimationFrame(raf);
  if (still()) { time = FORMED + 2; draw(time); return; }
  time = T0; last = performance.now(); draw(time);
  raf = requestAnimationFrame(loop);
}
function hide() {
  if (!root || root.hidden) return Promise.resolve();
  root.classList.add('ldq-out');
  return new Promise((res) => {
    outT = setTimeout(() => { cancelAnimationFrame(raf); root.hidden = true; root.classList.remove('ldq-out'); res(); }, still() ? 0 : 300);
  });
}

// plays while `p` is pending and ends as soon as it settles; `ready` true: nothing shows, no wait at all
export async function loadingWhile(p, ready) {
  if (ready) return p;
  users++; show();
  try { return await p; } finally { if (--users === 0) await hide(); }
}
// true while the loader fully covers the screen (not while it fades in or out): the 3D need not draw behind it
export const quickCovers = () => !!root && !root.hidden && !root.classList.contains('ldq-out') && performance.now() - shownAt > 350;
export const quickState = () => ({ shown: !!root && !root.hidden, out: !!root && root.classList.contains('ldq-out'), time });
