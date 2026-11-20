// FEAT-045: the menu words as bits (brandbook 1.6c), shared by the startup loader (engine.js) and the
// menu fold on every page (menubits.js). Ported from Smo's reference build (brandbook 4.13a, variation 18).
// A letter is its place in the alphabet (A = 1 … Z = 26) as five bits weighted 16, 8, 4, 2, 1 from the top,
// with a marker bar below. Item units: a word of n letters is n * 14 wide and 44 high, centre line at 22.
export const W5 = [16, 8, 4, 2, 1];
export const val = (ch) => (ch === ' ' ? 0 : ch.charCodeAt(0) - 64);
export const cl = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const e = (x) => { x = cl(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const eo = (x) => { x = cl(x); return 1 - Math.pow(1 - x, 3); };
export const lerp = (a, b, k) => a + (b - a) * k;
export const MS = { cs: 6, rp: 7, cp: 7, mw: 6, mh: 2.4 };

// the 1.6c menu fold: q = 0 compact bits, 1 the word. BUG-036: the marker bars below the bits are no longer
// drawn (marks: false leaves them out; the bits keep their place, the block is still centred as before)
export function menuFold(w, q, marks = false) {
  const n = w.length, off = (n * 14 - n * MS.cp) / 2, top = 22 - (5 * MS.rp + MS.mh) / 2;
  const spread = e(q / 0.45), cells = [], letters = [];
  for (let k = 0; k < n; k++) {
    const lt = e((q - 0.4 - k * 0.045) / 0.3);
    const cx0 = off + k * MS.cp + MS.cp / 2, cx1 = k * 14 + 7, cx = cx0 + (cx1 - cx0) * spread;
    const code = val(w[k]);
    for (let r = 0; r < (marks ? 6 : 5); r++) {
      const isM = r === 5;
      if (!isM && !(code & W5[r])) continue;
      let bw, bh, yc;
      if (!isM) { bw = bh = MS.cs * (1 - 0.7 * lt); yc = top + r * MS.rp + MS.cs / 2; } else { bw = MS.mw * (1 - 0.7 * lt); bh = MS.mh; yc = top + 5 * MS.rp + MS.mh / 2; }
      cells.push({ x: cx, y: yc + (22 - yc) * lt * 0.6, w: bw, h: bh, mk: isM, o: 1 - lt, k, r });
    }
    letters.push({ t: w[k], x: k * 14 + 7, y: 22, o: lt });
  }
  return { cells, letters };
}

// the screen position of every letter in an element (client px, centre of each glyph's box, spaces left out)
export function letterBoxes(el) {
  const out = [], walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), rg = document.createRange();
  let node;
  while ((node = walk.nextNode())) {
    const s = node.nodeValue, cs = getComputedStyle(node.parentElement), ls = parseFloat(cs.letterSpacing) || 0;
    for (let i = 0; i < s.length; i++) {
      if (/\s/.test(s[i])) continue;
      rg.setStart(node, i); rg.setEnd(node, i + 1);
      const q = rg.getBoundingClientRect();
      out.push({ t: s[i].toUpperCase(), x: q.left + q.width / 2, y: q.top + q.height / 2, ls, fs: parseFloat(cs.fontSize) || 12 });
    }
  }
  return out;
}

// how a word's item units sit on its real letters: screen = ax + unit * s
export function wordTransform(L) {
  const n = L.length, s = n > 1 ? (L[n - 1].x - L[0].x) / ((n - 1) * 14) : 0.78;
  let cy = 0; L.forEach((q) => { cy += q.y; }); cy /= n;
  return { ax: L[0].x - 7 * s, ay: cy - 22 * s, s };
}

// BUG-036: every menu word folds at the size of WORK's fold. R: the letter boxes of WORK set in the same font,
// L: the word's own letters. The scale is WORK's; the block is centred on the word's letters as WORK's is on its own.
export function refTransform(L, R) {
  const s = wordTransform(R).s, n = L.length;
  let cy = 0; L.forEach((q) => { cy += q.y; }); cy /= n;
  return { ax: (L[0].x + L[n - 1].x) / 2 - n * 7 * s, ay: cy - 22 * s, s };
}
