// Library (LIBRARY_PLAN phase L1): room details and the lucky cat.
//   - Simon's three things on the bookshelf (the lucky cat, the terrarium in its carafe, the painted
//     vase), 25% bigger since FEAT-021; the books round them are moved aside (some lean, three lie
//     stacked, the ones that no longer fit are taken out; the per-book colours stay as they are)
//   - a monstera in a terracotta pot and a woven basket by the window, its leaf tips stirring faintly
//   - the cat waves its raised paw while the library is open or in view; otherwise nothing runs
//   - click or tap the cat: the camera flies close to it;
//     Back or Esc returns
//   - the all-in-one computer is turned square on the desk, facing the chair
// Phase L2: click the computer and the camera comes so close that the screen fills the view; the
// screen then shows Simon's papers (an HTML list laid over the screen, read from library/papers.json).
// Each paper has one button, Open, a link to its PDF in a new tab (never preloaded).
// Built from the workshop's patterns (workshop/stations.js): hover glow and label, two-tap, Back/Esc,
// a hidden keyboard button, holdView/releaseView on the page.
import * as THREE from 'three';
import { makeCat, makeVase, makeTerrarium, makeMonstera } from './props.js';

// where things stand (viewer coordinates: y up, the room's open side faces -z, +x is to the left
// in the default view). Shelf boards: tops at 3.09 + k * 0.43; bays 1.02 m wide, centres below.
const SHELF_Y = (k) => 3.09 + k * 0.43, SHELF_Z = 2.47;
// half: the thing's half width (m) at its old size; the books round it make room for it at SCALE
const SPOTS = {
  cat: { x: -12.3, k: 3, half: 0.09 },                         // eye level, right of the desk
  vase: { x: -14.25, k: 2, half: 0.105 },                      // above the reading corner (turned; its handles stick out)
  terrarium: { x: -10.05, k: 2, half: 0.07 },                  // towards the window, clear of the computer
};
const SCALE = 1.25;                                            // FEAT-021: the three things 25% bigger
const BAYS = { x0: -14.87, w: 1.024 };                         // the bookshelf's five bays along x
const STACK = { len: 0.25 };                                   // the flat stack's longest book
const LEAN = 0.2;                                              // radians the leaning book tips
const MONSTERA = { x: -8.75, z: 1.85, floor: 3.01, yaw: 0.2 }; // left of the room, in front of the window
const GLOW = new THREE.Color(0xffa95e);
const WAVE = { period: 1.5, swing: 0.32 };                     // seconds per beckon, radians either way
const SEE_FAR = 26;                                            // further than this the cat is a few pixels: it rests
const ROOM = new THREE.Vector3(-11.6, 4.4, 1.2);               // the room's middle, for the view test

const S = { host: null, ready: false, cat: null, monstera: null, zoomed: false, opening: false, hover: null, what: null,
  pc: null, papers: null,
  home: null, seq: 0, t: 0, last: 0, waving: false, els: null, kbd: false, keySig: '' };
const vT = new THREE.Vector3(), sph = new THREE.Sphere(), frustum = new THREE.Frustum(), pm = new THREE.Matrix4();

// ---- DOM: the camp's classes (hover label, Back, the keyboard row)
function buildDom() {
  const style = document.createElement('style');
  style.textContent = 'body.lib-sub .nav, body.lib-sub .gear, body.lib-sub .controls, body.lib-sub .skypanel, body.lib-sub .markers { display: none !important; }';
  document.head.appendChild(style);
  const mk = (tag, cls, attrs = {}) => { const e = document.createElement(tag); e.className = cls; Object.assign(e, attrs); e.hidden = true; document.body.appendChild(e); return e; };
  style.textContent += `
  .lib-screen { position: fixed; z-index: 21; box-sizing: border-box; overflow: auto; overscroll-behavior: contain; opacity: 0; transition: opacity .35s;
    background: var(--stage); color: var(--ink); font-family: var(--font-display); container-type: inline-size; }
  .lib-screen.on { opacity: 1; }
  .lib-screen .lib-in { padding: clamp(18px, 5cqw, 56px); max-width: 900px; margin: 0 auto; }
  .lib-screen h2 { margin: 0 0 clamp(12px, 3cqw, 28px); font: 500 11px/1 var(--font-display); letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-soft); }
  .lib-screen ul { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--rule); }
  .lib-screen li { display: flex; align-items: center; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--rule); }
  .lib-screen .lib-t { flex: 1; min-width: 0; }
  .lib-screen .lib-title { font: 500 clamp(16px, 2.6cqw, 22px)/1.25 var(--font-display); margin: 0 0 6px; }
  .lib-screen .lib-meta { font: 400 13px/1.45 var(--font-display); color: var(--ink-soft); }
  .lib-screen .btn { flex: none; display: inline-flex; align-items: center; justify-content: center; align-self: center; box-sizing: border-box; min-width: 96px; text-decoration: none; color: var(--ink); }
  .lib-screen .btn:hover, .lib-screen .btn:focus-visible { color: var(--accent); }
  .lib-screen .lib-msg { color: var(--ink-soft); font-size: 13px; padding: 16px 0; }
  @container (max-width: 520px) { .lib-screen li { flex-direction: column; align-items: stretch; } .lib-screen .btn { align-self: stretch; } }`;
  const els = { tip: mk('div', 'tip'), back: mk('button', 'btn campback', { type: 'button', textContent: '‹ Back' }), keys: mk('div', 'camp-keys'),
    screen: mk('div', 'lib-screen') };
  els.screen.setAttribute('role', 'region'); els.screen.setAttribute('aria-label', 'Papers');
  els.screen.innerHTML = '<div class="lib-in"><h2>Papers</h2><ul></ul></div>';
  els.keys.setAttribute('role', 'group'); els.keys.setAttribute('aria-label', 'Library');
  els.back.addEventListener('click', back);
  return els;
}

// ---- the room: books moved aside, things in, computer square
// FEAT-021: the three things are 25% bigger, so the books round each one are moved to make room.
// In the thing's bay: the books on its one side are pushed towards the side panel, the one nearest
// the thing leans against its neighbour; on the other side three books lie stacked flat (shortened
// a little) next to the thing, the upright books beyond them pushed aside. Books that no longer fit
// are taken out (index only). Every book keeps its colour (the page's accents tell books apart by
// vertex, and each book is moved as a whole).
function clearBooks(root) {
  const books = root.getObjectByName('librarybooks');
  if (!books || !books.geometry.index) return;
  const g = books.geometry, pos = g.attributes.position, ix = g.index.array, n = pos.count;
  // one book = the vertices joined by shared positions and faces (as the page's accents do it)
  const parent = new Int32Array(n).map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const join = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
  const seen = new Map();
  for (let i = 0; i < n; i++) { const k = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`; if (seen.has(k)) join(i, seen.get(k)); else seen.set(k, i); }
  for (let f = 0; f < ix.length; f += 3) { join(ix[f], ix[f + 1]); join(ix[f], ix[f + 2]); }
  // each book's vertices and box (the books mesh sits at the origin: its vertices are viewer coordinates)
  books.updateMatrixWorld(true);
  const all = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i); vT.fromBufferAttribute(pos, i).applyMatrix4(books.matrixWorld);
    let b = all.get(r);
    if (!b) { b = { r, v: [], x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity }; all.set(r, b); }
    b.v.push(i);
    b.x0 = Math.min(b.x0, vT.x); b.x1 = Math.max(b.x1, vT.x); b.y0 = Math.min(b.y0, vT.y); b.y1 = Math.max(b.y1, vT.y); b.z0 = Math.min(b.z0, vT.z); b.z1 = Math.max(b.z1, vT.z);
  }
  const inv = new THREE.Matrix4().copy(books.matrixWorld).invert();
  const put = (i, x, y, z) => { vT.set(x, y, z).applyMatrix4(inv); pos.setXYZ(i, vT.x, vT.y, vT.z); };
  const gone = new Set();
  // move a book along x, keeping it upright
  const shift = (b, dx) => { b.v.forEach((i) => { vT.fromBufferAttribute(pos, i).applyMatrix4(books.matrixWorld); put(i, vT.x + dx, vT.y, vT.z); }); b.x0 += dx; b.x1 += dx; };
  // lay a book flat: its height along x (length L), its thickness up, its depth D; at [x, x+L], resting on y
  const flat = (b, x, y, L, D, zc) => {
    const w = b.x1 - b.x0, h = b.y1 - b.y0, d = b.z1 - b.z0;
    b.v.forEach((i) => {
      vT.fromBufferAttribute(pos, i).applyMatrix4(books.matrixWorld);
      const u = (vT.x - b.x0) / w, v = (vT.y - b.y0) / h, q = (vT.z - b.z0) / d;
      put(i, x + (1 - v) * L, y + u * w, zc - D / 2 + q * D);   // a turn, not a mirror: the faces stay outside
    });
    return w;
  };
  Object.entries(SPOTS).forEach(([id, sp]) => {
    const top = SHELF_Y(sp.k), bay = Math.floor((sp.x - BAYS.x0) / BAYS.w), L = BAYS.x0 + bay * BAYS.w, R = L + BAYS.w;
    const row = [...all.values()].filter((b) => { const x = (b.x0 + b.x1) / 2, y = (b.y0 + b.y1) / 2; return x > L && x < R && y > top && y < top + 0.38; })
      .sort((p, q) => p.x0 - q.x0);
    if (!row.length) return;
    const uL = row[0].x0, uR = row[row.length - 1].x1;     // where books may stand in this bay
    const half = sp.half * SCALE + 0.03;                    // the bigger thing and a little air
    const g0 = sp.x - half, g1 = sp.x + half;
    const lefts = row.filter((b) => (b.x0 + b.x1) / 2 < sp.x), rights = row.filter((b) => (b.x0 + b.x1) / 2 >= sp.x);
    const gapOf = (list) => { let s = 0; for (let k = 1; k < list.length; k++) s += Math.max(0, list[k].x0 - list[k - 1].x1); return list.length > 1 ? s / (list.length - 1) : 0.003; };
    // the stack goes on the side with more room; the leaning book on the other
    const stackLeft = (g0 - uL) > (uR - g1) ? 1 : 0;
    const sides = [{ list: lefts, dir: -1, from: uL, edge: g0, stack: !!stackLeft }, { list: rights.slice().reverse(), dir: 1, from: uR, edge: g1, stack: !stackLeft }];
    const spare = [];
    sides.forEach((sd) => {
      // the books on this side, from the side panel inwards (towards the thing)
      const list = sd.list;                                  // lefts: panel first; rights reversed: panel first
      const sp0 = gapOf(sd.dir < 0 ? sd.list : sd.list.slice().reverse());
      let room = Math.abs(sd.edge - sd.from) - (sd.stack ? STACK.len + 0.03 : 0.075);   // the stack, or the leaning book's foot
      let at = sd.from;                                      // pack from the panel
      const kept = [];
      list.forEach((b) => {
        const w = b.x1 - b.x0;
        if (room - w < 0) { spare.push(b); return; }
        room -= w + sp0;
        if (sd.dir < 0) { shift(b, at - b.x0); at = b.x1 + sp0; } else { shift(b, at - b.x1); at = b.x0 - sp0; }
        kept.push(b);
      });
      sd.kept = kept; sd.at = at;
    });
    // the leaning book: the last upright one on the non-stack side tips over into the free space
    const ln = sides.find((sd) => !sd.stack);
    if (ln && ln.kept.length > 1) {
      const b = ln.kept[ln.kept.length - 1], prev = ln.kept[ln.kept.length - 2];
      leanBook(b, -ln.dir, LEAN, ln.dir < 0 ? prev.x1 : prev.x0);
    }
    // the stack: three books lying flat next to the thing, shortened a little
    const st = sides.find((sd) => sd.stack);
    const pick = spare.splice(0, 3);
    while (pick.length < 3 && st && st.kept.length > 2) pick.push(st.kept.splice(st.kept.length - 1, 1)[0]);
    if (st && pick.length) {
      let y = top + 0.0005;
      pick.sort((p, q) => (q.x1 - q.x0) - (p.x1 - p.x0));    // the thickest at the bottom
      pick.forEach((b, k) => {
        const Lk = STACK.len - k * 0.018, D = Math.min(b.z1 - b.z0, 0.27) - k * 0.012, x0 = st.dir < 0 ? st.edge - 0.012 - Lk - k * 0.006 : st.edge + 0.012 + k * 0.006;
        const w = flat(b, x0, y, Lk, D, SHELF_Z + 0.005 * (k - 1));
        y += w + 0.0005;
      });
    }
    spare.forEach((b) => gone.add(b.r));
  });
  // tip a book over by a radians, its top resting against its neighbour's face at x = nface; e: from the
  // neighbour towards the free space. Its bottom corner by the neighbour stays on the shelf, the foot slides out.
  function leanBook(b, e, a, nface) {
    const h = b.y1 - b.y0, y0 = b.y0, c = Math.cos(a), sn = Math.sin(a), xin = e > 0 ? b.x0 : b.x1;
    b.v.forEach((i) => {
      vT.fromBufferAttribute(pos, i).applyMatrix4(books.matrixWorld);
      const across = (vT.x - xin) * e, up = vT.y - y0;
      put(i, nface + e * h * sn + e * (across * c - up * sn), y0 + across * sn + up * c, vT.z);
    });
  }
  const keep = [];
  for (let f = 0; f < ix.length; f += 3) if (!gone.has(find(ix[f]))) keep.push(ix[f], ix[f + 1], ix[f + 2]);
  g.setIndex(keep);
  pos.needsUpdate = true;
  g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
  S.booksRemoved = gone.size;
}
// the all-in-one stood at an angle; turn it (body and screen together) about its stand until the
// screen is square to the room, facing the chair
function straightenComputer(root) {
  const body = root.getObjectByName('librarycomputer'), face = root.getObjectByName('librarycomputer_screen');
  if (!body || !face) return;
  root.updateMatrixWorld(true);
  const pts = [], box = new THREE.Box3().setFromObject(body), pivot = box.getCenter(new THREE.Vector3());
  const p = face.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) pts.push(vT.fromBufferAttribute(p, i).applyMatrix4(face.matrixWorld).clone());
  const depth = (a) => {                                // how deep the screen is front to back, turned by a
    let lo = Infinity, hi = -Infinity; const c = Math.cos(a), s = Math.sin(a);
    pts.forEach((q) => { const dx = q.x - pivot.x, dz = q.z - pivot.z, z = -s * dx + c * dz; lo = Math.min(lo, z); hi = Math.max(hi, z); });
    return hi - lo;
  };
  let best = 0, bd = Infinity;
  for (let a = -1.2; a <= 1.2; a += 0.0025) { const d = depth(a); if (d < bd) { bd = d; best = a; } }
  const turn = new THREE.Matrix4().makeTranslation(pivot.x, 0, pivot.z)
    .multiply(new THREE.Matrix4().makeRotationY(best)).multiply(new THREE.Matrix4().makeTranslation(-pivot.x, 0, -pivot.z));
  [body, face].forEach((m) => {
    const w = turn.clone().multiply(m.matrixWorld);
    const local = new THREE.Matrix4().copy(m.parent.matrixWorld).invert().multiply(w);
    local.decompose(m.position, m.quaternion, m.scale);
    m.updateMatrixWorld(true);
  });
  // the screen must face the chair (towards -z): if the turn left it facing the shelves, half a turn more
  const fc = new THREE.Box3().setFromObject(face).getCenter(new THREE.Vector3()), bc = new THREE.Box3().setFromObject(body).getCenter(new THREE.Vector3());
  if (fc.z > bc.z + 0.002) {
    const half = new THREE.Matrix4().makeTranslation(pivot.x, 0, pivot.z).multiply(new THREE.Matrix4().makeRotationY(Math.PI)).multiply(new THREE.Matrix4().makeTranslation(-pivot.x, 0, -pivot.z));
    [body, face].forEach((m) => { const w = half.clone().multiply(m.matrixWorld); new THREE.Matrix4().copy(m.parent.matrixWorld).invert().multiply(w).decompose(m.position, m.quaternion, m.scale); m.updateMatrixWorld(true); });
  }
  S.computerTurn = best;
}
function place(group, x, y, z, yaw = 0, scale = 1) { group.position.set(x, y, z); group.rotation.y = yaw; group.scale.setScalar(scale); group.updateMatrixWorld(true); }

// ---- the computer's screen: its four corners in the world (it faces -z, towards the chair)
function measureScreen(root) {
  const face = root.getObjectByName('librarycomputer_screen'), body = root.getObjectByName('librarycomputer');
  if (!face) return null;
  const b = new THREE.Box3().setFromObject(face), c = b.getCenter(new THREE.Vector3());
  const z = b.min.z - 0.004;                            // just in front of the glass
  // the glass itself: the loose box above is bigger than the turned screen, and the screen leans,
  // so the corners come from its vertices, bottom and top edge each at its own depth
  const g = new THREE.Box3().setFromObject(face, true), my = (g.min.y + g.max.y) / 2, front = [Infinity, Infinity];
  const pos = face.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) { const q = vT.fromBufferAttribute(pos, i).applyMatrix4(face.matrixWorld), k = q.y > my ? 1 : 0; front[k] = Math.min(front[k], q.z); }
  return { face, pick: [face, body].filter(Boolean), centre: c.setZ(z), w: b.max.x - b.min.x, h: b.max.y - b.min.y,
    corners: [[g.min.x, g.min.y, 0], [g.max.x, g.min.y, 0], [g.max.x, g.max.y, 1], [g.min.x, g.max.y, 1]].map(([x, y, k]) => new THREE.Vector3(x, y, front[k] - 0.002)) };
}
// ---- the papers list: read once, on the first visit to the screen
function loadPapers() {
  if (S.papers) return;
  S.papers = fetch(new URL('./papers.json', import.meta.url)).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(renderPapers, () => { S.papers = null; renderPapers(null); });
}
function renderPapers(list) {
  const ul = S.els.screen.querySelector('ul');
  ul.innerHTML = '';
  if (!list) { const li = document.createElement('li'); li.className = 'lib-msg'; li.textContent = 'The list could not be loaded.'; ul.appendChild(li); return; }
  list.forEach((p) => {
    const li = document.createElement('li'), t = document.createElement('div'), h = document.createElement('div'), m = document.createElement('div'), a = document.createElement('a');
    t.className = 'lib-t'; h.className = 'lib-title'; m.className = 'lib-meta'; a.className = 'btn';
    h.textContent = p.title;
    m.textContent = [[].concat(p.authors || []).join(', '), p.type, p.institution, p.year, p.language].filter(Boolean).join(' · ');
    a.textContent = 'Open'; a.href = p.pdf; a.target = '_blank'; a.rel = 'noopener';
    a.setAttribute('aria-label', 'Open ' + p.title + ' (PDF, new tab)');
    t.append(h, m); li.append(t, a); ul.appendChild(li);
  });
}
// lay the list over the screen as it is seen now; a phone held upright gets the whole view instead
function fitScreen() {
  const el = S.els.screen, r = S.host.el.getBoundingClientRect();
  if (S.host.portrait()) { const top = S.els.back.getBoundingClientRect().bottom + 12; setRect(el, 0, top, r.width, Math.max(0, r.bottom - top)); return; }
  // the screen's corners as seen now, in order round its edge (bottom, bottom, top, top); the list takes the
  // largest upright rectangle that lies fully inside them, so it never sticks out past the screen's edges
  const [a, b, c, d] = S.pc.corners.map((q) => screenOf(vT.copy(q)));
  const x0 = Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])), x1 = Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0]));
  const y0 = Math.max(Math.min(a[1], d[1]), Math.min(b[1], c[1])), y1 = Math.min(Math.max(a[1], d[1]), Math.max(b[1], c[1]));
  setRect(el, x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0));
}
function setRect(el, x, y, w, h) {                      // only when it moved: no style writes while the view stands still
  const k = `${Math.round(x)},${Math.round(y)},${Math.round(w)},${Math.round(h)}`;
  if (k === S.rect) return;
  S.rect = k; Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
}

// ---- glow and picking (the cat only)
// the two things to click: the cat and the computer
const THINGS = {
  cat: { label: 'Lucky cat', pick: () => S.cat.pick, anchor: (out) => out.set(S.cat.group.position.x, S.cat.group.position.y + 0.3 * SCALE, S.cat.group.position.z),
    near: (out) => out.set(S.cat.group.position.x, S.cat.group.position.y + 0.12 * SCALE, S.cat.group.position.z) },
  pc: { label: 'Papers', pick: () => S.pc.pick, glow: () => [S.pc.face], anchor: (out) => out.copy(S.pc.centre).setY(S.pc.centre.y + S.pc.h * 0.5 + 0.08), near: (out) => out.copy(S.pc.centre) },
};
const ids = () => (S.pc ? ['cat', 'pc'] : ['cat']);
// what lights up on hover: the computer's body counts for the click, but only its screen glows. Each glowing
// mesh gets its own material first (the body's plaster is the whole room's, Smo: the room turned yellow)
function mats(id) {
  return (THINGS[id].glow || THINGS[id].pick)().map((m) => {
    if (!m.userData.ownMat) { m.material = m.material.clone(); m.userData.ownMat = true; }
    return m.material;
  }).filter((m, i, a) => m.emissive && a.indexOf(m) === i);
}
function setHover(id) {
  if (id === S.hover) return;
  const glow = (k, on) => k && mats(k).forEach((m) => {
    if (!m.userData.e0) m.userData.e0 = { c: m.emissive.clone(), i: m.emissiveIntensity };
    if (on) { m.emissive.copy(GLOW); m.emissiveIntensity = 0.3; } else { m.emissive.copy(m.userData.e0.c); m.emissiveIntensity = m.userData.e0.i; }
  });
  glow(S.hover, false); glow(id, true);
  S.hover = id;
  if (id) S.els.tip.textContent = THINGS[id].label;
  S.els.tip.hidden = !id;
  S.host.el.style.cursor = id ? 'pointer' : '';
}
function screenOf(v) { const r = S.host.el.getBoundingClientRect(); v.project(S.host.camera); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }
function hitThing(ev) {
  const r = S.host.ray; S.host.setRay(ev);
  let best = null, bd = Infinity;
  ids().forEach((id) => { const h = r.intersectObjects(THINGS[id].pick(), false)[0]; if (h && h.distance < bd) { bd = h.distance; best = id; } });
  if (!best) return null;
  const own = THINGS[best].pick();
  const b = r.intersectObjects(S.blockers.filter((o) => !own.includes(o)), false)[0];   // the shelves and the room in front of it
  return b && b.distance < bd - 0.03 ? null : best;
}
function nearThing(ev, reach) {                                 // fingers: a near miss counts
  let best = null, bd = reach;
  ids().forEach((id) => { const [x, y] = screenOf(THINGS[id].near(vT)); const d = Math.hypot(x - ev.clientX, y - ev.clientY); if (d < bd) { bd = d; best = id; } });
  return best;
}

// ---- camera: close to the cat and back
function pcPose() {                                    // the screen almost fills the view; its frame and the Back button stay in sight
  const portrait = S.host.portrait(), fov = portrait ? 55 : 40, at = S.pc.centre.clone();
  const el = S.host.el, aspect = el.clientWidth / Math.max(1, el.clientHeight);
  const vf = THREE.MathUtils.degToRad(fov), hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
  const d = Math.max((S.pc.w * 0.64) / Math.tan(hf / 2), (S.pc.h * 0.64) / Math.tan(vf / 2));
  return { eye: at.clone().add(vT.set(0, 0, -d)), at, fov };
}
function catPose() {
  const portrait = S.host.portrait(), fov = portrait ? 55 : 40, size = 0.42 * SCALE;
  const at = new THREE.Vector3(S.cat.group.position.x, S.cat.group.position.y + 0.13 * SCALE, S.cat.group.position.z);
  const el = S.host.el, aspect = el.clientWidth / Math.max(1, el.clientHeight);
  const vf = THREE.MathUtils.degToRad(fov), hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
  const d = Math.max((size * 0.55) / Math.tan(hf / 2), (size * 0.45) / Math.tan(vf / 2));
  return { eye: at.clone().addScaledVector(vT.set(0, 0.22, -1).normalize(), d), at, fov };
}
function zoom(what = 'cat') {
  if (!S.ready || !S.host.inPlace() || S.zoomed || S.host.tweening() || !THINGS[what] || (what === 'pc' && !S.pc)) return;
  const tok = ++S.seq;
  S.host.closePanel();
  S.home = S.host.holdView();
  S.zoomed = true; S.opening = true; S.what = what; setHover(null);
  document.body.classList.add('lib-sub');
  S.els.back.hidden = false;
  if (S.kbd) S.els.back.focus({ preventScroll: true });   // the key row it came from goes away
  if (what === 'pc') loadPapers();
  const p = what === 'pc' ? pcPose() : catPose();
  S.host.fixedFov(p.fov);
  S.host.flyTo(p.eye, p.at, p.fov, () => {
    if (tok !== S.seq) return;
    S.opening = false;
    if (what !== 'pc') return;
    fitScreen(); S.els.screen.hidden = false;
    requestAnimationFrame(() => { S.els.screen.classList.add('on'); if (S.kbd) { const a = S.els.screen.querySelector('a'); if (a) a.focus({ preventScroll: true }); } });
  });
}
function hideScreen() { S.els.screen.classList.remove('on'); S.els.screen.hidden = true; }
function back() {
  if (!S.zoomed) return;
  const tok = ++S.seq, h = S.home;
  if (S.kbd) S.refocus = S.what;
  S.zoomed = false; S.opening = false; S.what = null; hideScreen();
  document.body.classList.remove('lib-sub');
  S.els.back.hidden = true;
  S.host.flyTo(h.pos.clone(), h.target.clone(), h.fov, () => { if (tok === S.seq) { S.host.releaseView(h); S.home = null; } });
}

// ---- keyboard: Esc goes back, Tab stays on Back and the screen; hidden buttons (shown on focus, as
// at the camp) zoom to the cat or the computer, and focus returns to the same one
function onKey(e) {
  if (!S.host || !S.host.inPlace() || !S.zoomed) return;
  if (e.target.closest && e.target.closest('input, textarea')) return;
  if (e.key === 'Escape') { e.stopImmediatePropagation(); back(); return; }
  if (e.key === 'Tab') {                                // Tab goes round Back and the screen's buttons, nothing behind them
    const loop = [S.els.back, ...(S.els.screen.hidden ? [] : S.els.screen.querySelectorAll('a[href]'))];
    const i = loop.indexOf(document.activeElement), n = loop.length;
    loop[i < 0 ? 0 : (i + (e.shiftKey ? n - 1 : 1)) % n].focus({ preventScroll: true });
    e.preventDefault(); e.stopImmediatePropagation(); return;
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.stopImmediatePropagation();   // no place switching while zoomed
}
function stepKeys() {
  const on = S.host.inPlace() && !S.zoomed && !S.host.tweening();
  const sig = on ? ids().join() : '';
  if (sig === S.keySig) return;
  S.keySig = sig; S.els.keys.innerHTML = ''; S.els.keys.hidden = !on;
  if (!on) return;
  ids().forEach((id) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn'; b.textContent = THINGS[id].label;
    b.addEventListener('click', () => zoom(id));
    S.els.keys.appendChild(b);
  });
  const lost = !document.activeElement || document.activeElement === document.body || !document.activeElement.offsetParent;
  const ret = S.refocus ? ids().indexOf(S.refocus) : -1;
  if (ret >= 0 && lost) S.els.keys.children[ret].focus({ preventScroll: true });
  S.refocus = null;
}

// ---- is the room on screen? (the library is the open place, or the camera is near and sees the cat)
function inView() {
  if (S.host.inPlace()) return true;
  const cam = S.host.camera;
  if (cam.position.distanceTo(S.cat.group.position) > SEE_FAR) return false;
  pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); frustum.setFromProjectionMatrix(pm);
  return frustum.intersectsSphere(sph.set(ROOM, 4.5));
}

export const library = {
  // index.html: once the model is loaded. host = the page's camera, pointer and view helpers
  setup(host, root) {
    S.host = host; S.els = buildDom();
    clearBooks(root);
    straightenComputer(root);
    S.pc = measureScreen(root);
    const items = new THREE.Group(); items.name = 'library_items';
    S.cat = makeCat(); place(S.cat.group, SPOTS.cat.x, SHELF_Y(SPOTS.cat.k), SHELF_Z, 0, SCALE);
    const vase = makeVase(); place(vase.group, SPOTS.vase.x, SHELF_Y(SPOTS.vase.k), SHELF_Z, 0.3, SCALE);
    const terra = makeTerrarium(); place(terra.group, SPOTS.terrarium.x, SHELF_Y(SPOTS.terrarium.k), SHELF_Z, 0, SCALE);
    S.monstera = makeMonstera(); place(S.monstera.group, MONSTERA.x, MONSTERA.floor, MONSTERA.z, MONSTERA.yaw);
    items.add(S.cat.group, vase.group, terra.group, S.monstera.group);
    host.scene.add(items);
    S.blockers = [];
    root.traverse((o) => { if (o.isMesh && /^library(shell|shelves|books|desk|computer|floor_lamp)$/.test(o.name)) S.blockers.push(o); });
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keydown', () => { S.kbd = true; }, true);          // how the visitor moves: keys or a pointer
    window.addEventListener('pointerdown', () => { S.kbd = false; }, true);
    S.ready = true;
  },
  // every frame while the station runs: the cat waves and the monstera sways only while the room is seen
  step(now) {
    if (!S.ready) return;
    const dt = S.last ? Math.min(0.1, (now - S.last) / 1000) : 0; S.last = now;
    stepKeys();
    if (S.what === 'pc' && !S.opening) fitScreen();     // follows resizes and turns of the phone
    if (S.hover && !S.els.tip.hidden) {
      const [x, y] = screenOf(THINGS[S.hover].anchor(vT)), r = S.host.el.getBoundingClientRect();
      S.els.tip.style.left = (x - r.left) + 'px'; S.els.tip.style.top = (y - r.top) + 'px';
    }
    const on = inView();
    S.waving = on;
    if (!on) return;                                    // out of view: the paw rests where it is, nothing else runs
    if (S.host.reduceMotion()) { S.cat.arm.rotation.x = 0; return; }
    S.t += dt;
    S.cat.arm.rotation.x = -WAVE.swing * (0.5 - 0.5 * Math.cos(S.t * Math.PI * 2 / WAVE.period));   // beckons forward and back
    S.monstera.sway.value = S.t;
  },
  // true if the tap was the library's (the cat or the computer close up keeps every tap)
  tap(ev) {
    if (S.zoomed || S.host.tweening()) return true;
    const id = hitThing(ev) || (ev.pointerType !== 'mouse' ? nearThing(ev, 28) : null);
    if (!id) { setHover(null); return false; }
    zoom(id);
    return true;
  },
  hover(ev) {
    if (S.zoomed || S.host.tweening()) { setHover(null); return true; }
    const id = hitThing(ev);
    setHover(id);
    return !!id;
  },
  // leaving the library some other way (menu, browser back, another place): put everything back at once
  reset() {
    if (!S.ready) return;
    S.seq++;
    S.zoomed = false; S.opening = false; S.home = null; S.what = null; setHover(null); hideScreen();
    document.body.classList.remove('lib-sub');
    S.els.back.hidden = true;
  },
  resume(now) { S.last = now; },
  get zoomed() { return S.zoomed; },
  zoom, back,
  // tests
  state: () => ({ zoomed: S.zoomed, what: S.what, opening: S.opening, screenOn: !!S.els && !S.els.screen.hidden, waving: S.waving, paw: S.cat ? +S.cat.arm.rotation.x.toFixed(3) : null, booksRemoved: S.booksRemoved, computerTurn: S.computerTurn, hover: S.hover, armed: null }),
  screen: (id = 'cat') => screenOf(THINGS[id].near(vT)),
};
