// The photo album in the van: a travel scrapbook. 2–3 photos per page, stuck on with strips of tape,
// laid out from the manifest (assets/album/index.json). Positions and turns vary per page but are
// seeded by the page number, so a page always looks the same.
//   - the open book is the largest the photos ever get: no lightbox, no zoom
//   - sharpness: a photo is never shown larger than its own pixels (CSS size x devicePixelRatio <= w, h);
//     on big screens the book stops growing instead
//   - only the visible spread and the next one are loaded
//   - turning: arrows (buttons or keys), or drag / swipe across the book; a light page-turn animation
//   - handwritten notes: a page may carry `notes` ([{ text, photo?, corner? }]) in the manifest; each is
//     a slip of paper taped on beside a photo, over its corner at most, never over its middle
const PAGE_H = 1.3;                          // page height in page widths (portrait pages)
const FRAME = 0.016;                         // white print border, in page widths
const TAPES = ['rgba(222, 204, 158, 0.9)', 'rgba(170, 205, 194, 0.88)', 'rgba(232, 172, 150, 0.88)', 'rgba(196, 180, 222, 0.88)', 'rgba(236, 214, 120, 0.88)'];

function rng(seed) {                         // small deterministic generator (mulberry32)
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// slots per photo count: centre (x, y) and the box the photo fits into, in page widths
const TEMPLATES = {
  1: [[[0.5, 0.62, 0.8, 0.8]]],
  2: [[[0.5, 0.36, 0.74, 0.54], [0.5, 0.96, 0.74, 0.54]],
      [[0.42, 0.36, 0.7, 0.52], [0.58, 0.95, 0.7, 0.52]],
      [[0.57, 0.37, 0.7, 0.53], [0.43, 0.95, 0.7, 0.53]]],
  3: [[[0.44, 0.24, 0.62, 0.38], [0.58, 0.65, 0.62, 0.38], [0.44, 1.07, 0.62, 0.38]],
      [[0.57, 0.24, 0.62, 0.38], [0.42, 0.65, 0.62, 0.38], [0.58, 1.06, 0.62, 0.38]],
      [[0.29, 0.3, 0.46, 0.4], [0.71, 0.44, 0.46, 0.4], [0.5, 0.98, 0.66, 0.44]]],
};
// layout of one page: per photo its centre, displayed width (page widths, frame excluded), turn, tapes
export function layoutPage(page, index) {
  const r = rng(index * 7919 + 17), n = Math.min(3, page.photos.length);
  const opts = TEMPLATES[n] || TEMPLATES[3], tpl = opts[Math.floor(r() * opts.length)];
  return page.photos.slice(0, 3).map((p, i) => {
    const [cx, cy, bw, bh] = tpl[i];
    const a = p.w / p.h;
    const w = Math.min(bw, bh * a) * (0.92 + 0.08 * r());
    const tapes = [];
    const style = r();
    if (style < 0.45) { tapes.push([-1, -1], [1, 1]); }                 // two opposite corners
    else if (style < 0.75) { tapes.push([-1, -1], [1, -1]); }            // both top corners
    else { tapes.push([0, -1]); if (r() < 0.6) tapes.push([0, 1]); }    // top edge (and bottom)
    return { p, cx: cx + (r() - 0.5) * 0.06, cy: cy + (r() - 0.5) * 0.05, w, h: w / a, rot: (r() - 0.5) * 9,
      tapes: tapes.map(([tx, ty]) => ({ tx, ty, rot: (tx ? tx * ty * 38 : 0) + (r() - 0.5) * 14, col: TAPES[Math.floor(r() * TAPES.length)], len: 0.13 + r() * 0.05 })) };
  });
}

// layout of a page's notes: each sits on a corner of one of the photos, pushed outwards so that it
// covers that corner and no more. The data may name the photo (index) and the corner ('tl', 'tr',
// 'bl', 'br'); otherwise the corner that hides the least of any photo is taken.
const NOTE_W = 0.34, NOTE_H = 0.17;          // a note's box, in page widths
export function layoutNotes(page, index, photos) {
  const r = rng(index * 4421 + 5);
  const taken = [];
  return (page.notes || []).filter((n) => n && n.text).map((n) => {
    const cands = [];
    photos.forEach((ph, pi) => {
      if (n.photo !== undefined && n.photo !== pi) return;
      for (const [k, sx, sy] of [['tl', -1, -1], ['tr', 1, -1], ['bl', -1, 1], ['br', 1, 1]]) {
        if (n.corner && n.corner !== k) continue;
        let cx = ph.cx + sx * (ph.w / 2 + NOTE_W * 0.26), cy = ph.cy + sy * (ph.h / 2 + NOTE_H * 0.22);
        cx = Math.min(1 - NOTE_W / 2 - 0.02, Math.max(NOTE_W / 2 + 0.02, cx));
        cy = Math.min(PAGE_H - NOTE_H / 2 - 0.05, Math.max(NOTE_H / 2 + 0.03, cy));
        cands.push({ cx, cy });
      }
    });
    // how much of the photos (and of earlier notes) a note there would hide: the middle of a photo counts
    // many times over, so a note only ever lands on a corner or the margin
    const cost = (c) => {
      let k = 0;
      const ov = (ax, ay, aw, ah) => Math.max(0, Math.min(c.cx + NOTE_W / 2, ax + aw / 2) - Math.max(c.cx - NOTE_W / 2, ax - aw / 2))
        * Math.max(0, Math.min(c.cy + NOTE_H / 2, ay + ah / 2) - Math.max(c.cy - NOTE_H / 2, ay - ah / 2));
      photos.forEach((ph) => { k += ov(ph.cx, ph.cy, ph.w, ph.h) / (ph.w * ph.h) + 20 * ov(ph.cx, ph.cy, ph.w * 0.6, ph.h * 0.6); });
      taken.forEach((t) => { k += 10 * ov(t.cx, t.cy, NOTE_W, NOTE_H); });
      return k;
    };
    cands.forEach((c) => { c.k = cost(c) + r() * 0.01; });
    cands.sort((a, b) => a.k - b.k);
    const at = cands[0] || { cx: 0.5, cy: PAGE_H - NOTE_H };
    taken.push(at);
    return { text: n.text, cx: at.cx, cy: at.cy, rot: (r() - 0.5) * 10, tape: { rot: (r() - 0.5) * 12, col: TAPES[Math.floor(r() * TAPES.length)] } };
  });
}

export function openAlbum(root, manifest, { onClose } = {}) {
  const pages = (manifest && manifest.pages) || [];
  const layouts = pages.map(layoutPage);
  const notes = pages.map((p, i) => layoutNotes(p, i, layouts[i]));
  // the largest page width (CSS px) at which no photo is upscaled on this screen
  const dpr = window.devicePixelRatio || 1;
  let pwMax = Infinity;
  layouts.forEach((L) => L.forEach((ph) => { pwMax = Math.min(pwMax, ph.p.w / (ph.w * dpr), ph.p.h / (ph.h * dpr)); }));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let spread = true, at = 0, busy = false, pw = 300;
  root.innerHTML = `<div class="album-stage"><div class="album-book" aria-live="polite"></div></div>
    <div class="album-bar"><button class="album-prev" aria-label="Previous page">‹</button><span class="album-count"></span><button class="album-next" aria-label="Next page">›</button></div>`;
  const book = root.querySelector('.album-book'), count = root.querySelector('.album-count');
  const prevB = root.querySelector('.album-prev'), nextB = root.querySelector('.album-next');
  root.hidden = false;
  requestAnimationFrame(() => root.classList.add('open'));

  const perView = () => (spread ? 2 : 1);
  const views = () => Math.ceil(pages.length / perView());
  function pageEl(i) {                        // one page of the scrapbook (or an empty sheet)
    const el = document.createElement('div');
    el.className = 'album-page';
    if (i < 0 || i >= pages.length) { el.classList.add('blank'); return el; }
    layouts[i].forEach((ph) => {
      const f = document.createElement('figure');
      f.className = 'album-photo';
      f.style.cssText = `left:${(ph.cx - ph.w / 2 - FRAME) * 100}%;top:${((ph.cy - ph.h / 2 - FRAME) / PAGE_H) * 100}%;width:${(ph.w + 2 * FRAME) * 100}%;transform:rotate(${ph.rot.toFixed(2)}deg)`;
      const img = document.createElement('img');
      img.src = ph.p.src; img.alt = ''; img.decoding = 'async'; img.draggable = false;
      img.width = ph.p.w; img.height = ph.p.h;
      f.appendChild(img);
      ph.tapes.forEach((t) => {
        const tp = document.createElement('span');
        tp.className = 'album-tape';
        const x = t.tx === 0 ? 50 : t.tx < 0 ? 4 : 96, y = t.ty < 0 ? 2 : 98;
        tp.style.cssText = `left:${x}%;top:${y}%;width:${(t.len / (ph.w + 2 * FRAME)) * 100}%;background-color:${t.col};transform:translate(-50%,-50%) rotate(${t.rot.toFixed(1)}deg)`;
        f.appendChild(tp);
      });
      el.appendChild(f);
    });
    notes[i].forEach((n) => {
      const d = document.createElement('div');
      d.className = 'album-note';
      d.style.cssText = `left:${(n.cx - NOTE_W / 2) * 100}%;top:${((n.cy - NOTE_H / 2) / PAGE_H) * 100}%;width:${NOTE_W * 100}%;min-height:${(NOTE_H / PAGE_H) * 100}%;transform:rotate(${n.rot.toFixed(2)}deg)`;
      const t = document.createElement('p'); t.textContent = n.text;
      const tp = document.createElement('span');
      tp.className = 'album-tape';
      tp.style.cssText = `left:50%;top:0;width:${(0.15 / NOTE_W) * 100}%;background-color:${n.tape.col};transform:translate(-50%,-50%) rotate(${n.tape.rot.toFixed(1)}deg)`;
      d.append(t, tp);
      el.appendChild(d);
    });
    const no = document.createElement('span'); no.className = 'album-no'; no.textContent = i + 1;
    el.appendChild(no);
    return el;
  }
  function preload(v) {                       // warm the browser cache for the next view only
    for (let k = 0; k < perView(); k++) {
      const i = v * perView() + k;
      if (pages[i]) pages[i].photos.forEach((p) => { const im = new Image(); im.decoding = 'async'; im.src = p.src; });
    }
  }
  function size() {
    const r = root.getBoundingClientRect();
    const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hh')) || 70;
    const availW = r.width - 32, availH = r.height - top - 96;
    const first = at * perView();
    spread = availW / availH > 1.15;
    at = Math.floor(first / perView());
    pw = Math.max(120, Math.min(spread ? availW / 2 : availW, availH / PAGE_H, pwMax));
    book.style.setProperty('--pw', pw + 'px');
    book.classList.toggle('single', !spread);
  }
  function render() {
    book.querySelectorAll('.album-sheet, .album-flip').forEach((e) => e.remove());
    const first = at * perView();
    const sheet = document.createElement('div'); sheet.className = 'album-sheet';
    for (let k = 0; k < perView(); k++) sheet.appendChild(pageEl(first + k));
    book.appendChild(sheet);
    const last = Math.min(pages.length, first + perView());
    count.textContent = pages.length ? (last - first > 1 ? `${first + 1}–${last}` : `${first + 1}`) + ` / ${pages.length}` : 'No photos yet';
    prevB.disabled = at <= 0; nextB.disabled = at >= views() - 1;
    preload(at + 1);
  }
  function turn(dir) {
    const to = at + dir;
    if (busy || to < 0 || to >= views()) return;
    if (reduce) { at = to; render(); return; }
    busy = true;
    const first = at * perView(), nfirst = to * perView();
    // underneath: what is visible once the page has turned; on top: the page that turns
    const under = document.createElement('div'); under.className = 'album-sheet';
    const flip = document.createElement('div'); flip.className = 'album-flip ' + (dir > 0 ? 'fwd' : 'back');
    const front = document.createElement('div'), back = document.createElement('div');
    front.className = 'album-face front'; back.className = 'album-face back';
    if (spread) {
      under.append(pageEl(dir > 0 ? first : nfirst), pageEl(dir > 0 ? nfirst + 1 : first + 1));
      front.appendChild(pageEl(dir > 0 ? first + 1 : first));
      back.appendChild(pageEl(dir > 0 ? nfirst : nfirst + 1));
    } else {
      under.appendChild(pageEl(dir > 0 ? nfirst : first));
      front.appendChild(pageEl(dir > 0 ? first : nfirst));
      back.appendChild(pageEl(-1));
      if (dir < 0) flip.classList.add('from');
    }
    flip.append(front, back);
    book.querySelectorAll('.album-sheet').forEach((e) => e.remove());
    book.append(under, flip);
    requestAnimationFrame(() => requestAnimationFrame(() => flip.classList.add('go')));
    let finished = false;
    const end = () => { if (finished) return; finished = true; busy = false; at = to; render(); };
    flip.addEventListener('transitionend', end, { once: true });
    setTimeout(end, 900);                     // in case the transition event never comes
  }
  // drag / swipe across the book; a plain tap on the outer half of a page turns too
  let down = null;
  book.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  book.addEventListener('pointerup', (e) => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y; down = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { turn(dx < 0 ? 1 : -1); return; }
    if (Math.hypot(dx, dy) < 8) {
      const r = book.getBoundingClientRect(), u = (e.clientX - r.left) / r.width;
      if (u > 0.82) turn(1); else if (u < 0.18) turn(-1);
    }
  });
  book.addEventListener('pointercancel', () => { down = null; });
  prevB.addEventListener('click', () => turn(-1));
  nextB.addEventListener('click', () => turn(1));
  const onResize = () => { size(); render(); };
  window.addEventListener('resize', onResize);
  size(); render();

  return {
    key(e) {                                  // returns true when the album used the key
      if (e.key === 'ArrowRight') { turn(1); return true; }
      if (e.key === 'ArrowLeft') { turn(-1); return true; }
      return false;
    },
    close() {
      window.removeEventListener('resize', onResize);
      root.classList.remove('open');
      setTimeout(() => { if (!root.classList.contains('open')) { root.hidden = true; root.innerHTML = ''; } }, 300);
      onClose && onClose();
    },
    state: () => ({ at, spread, pw, pwMax, dpr, views: views() }),
  };
}
