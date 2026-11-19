// FEAT-045: the menu bit fold on every page (brandbook 1.6c). Hovering a menu word (computer), pressing it
// (phone) or giving it keyboard focus folds it into its bits over 0.9 s; it opens again on leave. The items stay
// real buttons and links: their letters are only wrapped in spans (so each can fade), the bits are drawn on a
// small canvas inside the item. The name has no fold. With reduce motion the fold switches without animation.
import { menuFold, wordTransform, letterBoxes } from './bits.js';

const RIDGE = '#798072';
const reduce = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const items = [];
let raf = 0, last = 0;

const css = document.createElement('style');
css.textContent = '.mb-c { position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; }';
document.head.appendChild(css);

function draw(it) {
  const { el, cv, spans } = it, r = el.getBoundingClientRect();
  const g = cv.getContext('2d'); if (!g || !(r.width > 0)) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, r.height);
  if (it.p <= 0) { spans.forEach((s) => { s.style.opacity = ''; }); return; }
  const L = letterBoxes(el).map((q) => ({ x: q.x - r.left, y: q.y - r.top }));
  if (L.length !== it.word.length) return;
  const T = wordTransform(L), M = menuFold(it.word, 1 - it.p), ink = getComputedStyle(el).color;
  M.cells.forEach((c) => {
    if (!(c.o > 0.003)) return;
    g.globalAlpha = Math.min(1, c.o); g.fillStyle = c.mk ? ink : RIDGE;
    g.fillRect(T.ax + (c.x - c.w / 2) * T.s, T.ay + (c.y - c.h / 2) * T.s, c.w * T.s, c.h * T.s);
  });
  g.globalAlpha = 1;
  M.letters.forEach((l, k) => { if (spans[k]) spans[k].style.opacity = l.o.toFixed(3); });
}

function tick(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  let busy = false;
  items.forEach((it) => {
    const want = it.hover || it.press || it.focus ? 1 : 0;
    if (it.p === want) return;
    const st = reduce() ? 1 : dt / 0.9;
    it.p = want ? Math.min(1, it.p + st) : Math.max(0, it.p - st);
    draw(it);
    if (it.p !== want) busy = true;
  });
  raf = busy ? requestAnimationFrame(tick) : 0;
}
const wake = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };

function setup(el) {
  if (el.dataset.mb) return;
  const txt = el.textContent.trim();
  if (!/^[A-Za-z]+$/.test(txt)) return;
  el.dataset.mb = '1';
  el.textContent = '';
  const spans = [...txt].map((ch) => { const s = document.createElement('span'); s.className = 'mb-l'; s.textContent = ch; el.appendChild(s); return s; });
  const cv = document.createElement('canvas'); cv.className = 'mb-c'; cv.setAttribute('aria-hidden', 'true'); el.appendChild(cv);
  const it = { el, cv, spans, word: txt.toUpperCase(), p: 0, hover: false, press: false, focus: false };
  const set = (k, v) => { if (it[k] !== v) { it[k] = v; wake(); } };
  el.addEventListener('pointerenter', (ev) => { if (ev.pointerType === 'mouse') set('hover', true); });
  el.addEventListener('pointerleave', () => { set('hover', false); set('press', false); });
  el.addEventListener('pointerdown', (ev) => { if (ev.pointerType !== 'mouse') set('press', true); });
  el.addEventListener('pointerup', () => set('press', false));
  el.addEventListener('pointercancel', () => set('press', false));
  el.addEventListener('focus', () => { let fv = false; try { fv = el.matches(':focus-visible'); } catch (err) { fv = false; } set('focus', fv); });
  el.addEventListener('blur', () => set('focus', false));
  items.push(it);
}

export function setupMenuBits(root = document) {
  root.querySelectorAll('.site .menu > button, .site .menu > a, .site .menu-toggle').forEach(setup);
}
setupMenuBits();
