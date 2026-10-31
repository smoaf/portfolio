// --- reads a visitor's own model for the 3D printer in the background (a Web Worker, BUG-017), so
// the page never freezes. Takes .stl (binary and text) and .glb up to 150 MB. The file is read in
// pieces of a few MB, never whole, in two passes: the first finds the model's size, the second sorts
// every corner into a grid of small cells and keeps one corner per cell (vertex clustering). The grid
// is then made coarser until about 30,000 triangles are left; more is never visible on the 17 × 20 cm
// print. Models already that small come back as they are. Nothing leaves the browser.
// In:  { file }                     Out: { p } progress 0–1, then { pos } (Float32Array, 9 floats a
//                                       triangle, y up for .glb, as in the file for .stl) or { error }
'use strict';
const CHUNK = 4 << 20, TARGET = 30000, GRID = 160;

self.onmessage = async (e) => {
  try { await read(e.data.file); }
  catch (err) { self.postMessage({ error: (err && err.user) || 'Could not read that file. Is it a working .glb or .stl?' }); }
};
const fail = (text) => { const e = new Error(text); e.user = text; throw e; };
let lastP = -1;
const progress = (p) => { p = Math.min(0.99, p); if (p - lastP >= 0.01) { lastP = p; self.postMessage({ p }); } };

async function read(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const src = ext === 'glb' ? await glb(file) : await stl(file);
  progress(0);
  // pass 1: size and triangle count
  const box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  let tris = 0;
  await src.each((x, y, z) => { if (x < box.min[0]) box.min[0] = x; if (y < box.min[1]) box.min[1] = y; if (z < box.min[2]) box.min[2] = z; if (x > box.max[0]) box.max[0] = x; if (y > box.max[1]) box.max[1] = y; if (z > box.max[2]) box.max[2] = z; }, () => tris++, 0, 0.45);
  if (!tris || !(box.max[0] >= box.min[0])) fail('That model is empty.');
  if (![...box.min, ...box.max].every(Number.isFinite)) fail('That model has broken coordinates.');
  // pass 2: small models as they are, big ones sorted into the grid
  let out;
  if (tris <= TARGET) {
    out = new Float32Array(tris * 9); let k = 0;
    await src.each((x, y, z) => { if (k < out.length) { out[k++] = x; out[k++] = y; out[k++] = z; } }, null, 0.45, 0.99);
    out = out.subarray(0, k - k % 9);
  } else {
    const g = grid(box, GRID), mesh = { sum: new Float64Array(1 << 16), n: 0, map: new Map(), tri: new Int32Array(1 << 16), t: 0 };
    let c = [0, 0, 0], ci = 0;
    await src.each((x, y, z) => { c[ci++] = cellOf(mesh, g, x, y, z); }, () => { if (ci === 3) addTri(mesh, c[0], c[1], c[2]); ci = 0; }, 0.45, 0.95);
    let m = finish(mesh), n = GRID;
    while (m.t > TARGET && n > 8) { n = Math.floor(n * 0.85); m = coarsen(m, box, n); }
    out = new Float32Array(m.t * 9);
    for (let t = 0; t < m.t; t++) for (let v = 0; v < 3; v++) { const i = m.tri[t * 3 + v]; out[t * 9 + v * 3] = m.pos[i * 3]; out[t * 9 + v * 3 + 1] = m.pos[i * 3 + 1]; out[t * 9 + v * 3 + 2] = m.pos[i * 3 + 2]; }
  }
  if (!out.length) fail('That model is empty.');
  self.postMessage({ p: 1 });
  self.postMessage({ pos: out }, [out.buffer]);
}

// ---- the grid: cells of equal size along the longest side
function grid(box, n) {
  const size = Math.max(box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2], 1e-9);
  const cell = size / n;
  return { min: box.min, cell, nx: Math.floor((box.max[0] - box.min[0]) / cell) + 1, ny: Math.floor((box.max[1] - box.min[1]) / cell) + 1 };
}
function cellOf(m, g, x, y, z) {
  const key = Math.floor((x - g.min[0]) / g.cell) + g.nx * (Math.floor((y - g.min[1]) / g.cell) + g.ny * Math.floor((z - g.min[2]) / g.cell));
  let i = m.map.get(key);
  if (i === undefined) {
    i = m.n++; m.map.set(key, i);
    if (m.sum.length < m.n * 4) { const s = new Float64Array(m.sum.length * 2); s.set(m.sum); m.sum = s; }
  }
  m.sum[i * 4] += x; m.sum[i * 4 + 1] += y; m.sum[i * 4 + 2] += z; m.sum[i * 4 + 3]++;
  return i;
}
function addTri(m, a, b, c) {
  if (a === b || b === c || a === c) return;           // collapsed into a line or a point
  if (m.tri.length < (m.t + 1) * 3) { const s = new Int32Array(m.tri.length * 2); s.set(m.tri); m.tri = s; }
  m.tri[m.t * 3] = a; m.tri[m.t * 3 + 1] = b; m.tri[m.t * 3 + 2] = c; m.t++;
}
// each cell's corner is the mean of all corners that fell into it; the same triangle only once
function finish(m) {
  const pos = new Float64Array(m.n * 3), w = new Float64Array(m.n);
  for (let i = 0; i < m.n; i++) { const k = m.sum[i * 4 + 3]; w[i] = k; pos[i * 3] = m.sum[i * 4] / k; pos[i * 3 + 1] = m.sum[i * 4 + 1] / k; pos[i * 3 + 2] = m.sum[i * 4 + 2] / k; }
  const seen = new Set(), tri = new Int32Array(m.t * 3), B = m.n + 1, numeric = B * B * B < 2 ** 52;
  let t = 0;
  for (let s = 0; s < m.t; s++) {
    const a = m.tri[s * 3], b = m.tri[s * 3 + 1], c = m.tri[s * 3 + 2];
    const lo = Math.min(a, b, c), hi = Math.max(a, b, c), mid = a + b + c - lo - hi;
    const key = numeric ? (lo * B + mid) * B + hi : lo + ',' + mid + ',' + hi;
    if (seen.has(key)) continue;
    seen.add(key); tri[t * 3] = a; tri[t * 3 + 1] = b; tri[t * 3 + 2] = c; t++;
  }
  return { pos, w, tri, t };
}
function coarsen(m, box, n) {
  const g = grid(box, n), next = { sum: new Float64Array(1 << 16), n: 0, map: new Map(), tri: new Int32Array(1 << 16), t: 0 };
  const to = new Int32Array(m.pos.length / 3);
  for (let i = 0; i < to.length; i++) {               // weighted, so a cell's corner stays the mean of the original corners
    const x = m.pos[i * 3], y = m.pos[i * 3 + 1], z = m.pos[i * 3 + 2], k = cellOf(next, g, x, y, z), w = m.w[i];
    next.sum[k * 4] += x * (w - 1); next.sum[k * 4 + 1] += y * (w - 1); next.sum[k * 4 + 2] += z * (w - 1); next.sum[k * 4 + 3] += w - 1;
    to[i] = k;
  }
  for (let t = 0; t < m.t; t++) addTri(next, to[m.tri[t * 3]], to[m.tri[t * 3 + 1]], to[m.tri[t * 3 + 2]]);
  return finish(next);
}

// ---- reading a part of the file
const part = (file, a, b) => file.slice(a, b).arrayBuffer();

// ---- STL: binary (50 bytes a triangle after an 84-byte header) or text ("vertex x y z" lines)
async function stl(file) {
  if (file.size < 15) fail('That file is too small to hold a model.');
  const head = new DataView(await part(file, 0, Math.min(file.size, 84)));
  const count = file.size >= 84 ? head.getUint32(80, true) : -1;
  if (count >= 0 && 84 + count * 50 === file.size) {
    return { each: async (vert, tri, p0, p1) => {
      const per = Math.floor(CHUNK / 50);
      for (let s = 0; s < count; s += per) {
        const n = Math.min(per, count - s), d = new DataView(await part(file, 84 + s * 50, 84 + (s + n) * 50));
        for (let t = 0; t < n; t++) {
          const o = t * 50 + 12;
          for (let v = 0; v < 3; v++) vert(d.getFloat32(o + v * 12, true), d.getFloat32(o + v * 12 + 4, true), d.getFloat32(o + v * 12 + 8, true));
          if (tri) tri();
        }
        progress(p0 + (p1 - p0) * (s + n) / count);
      }
    } };
  }
  const start = new TextDecoder().decode(new Uint8Array(head.buffer, 0, Math.min(5, head.byteLength)));
  if (start.toLowerCase() !== 'solid') fail('That .stl file is broken: its size does not match its triangle count.');
  return { each: async (vert, tri, p0, p1) => {
    const dec = new TextDecoder(); let rest = '', k = 0, bad = 0;
    for (let a = 0; a < file.size; a += CHUNK) {
      const text = rest + dec.decode(await part(file, a, a + CHUNK), { stream: a + CHUNK < file.size });
      const lines = text.split('\n'); rest = a + CHUNK < file.size ? lines.pop() : '';
      for (const line of lines) {
        const l = line.trim();
        if (!l.startsWith('vertex')) continue;
        const v = l.split(/\s+/), x = +v[1], y = +v[2], z = +v[3];
        if (!Number.isFinite(x + y + z)) { if (++bad > 100) fail('That .stl file is broken: some of its numbers can\'t be read.'); continue; }
        vert(x, y, z);
        if (++k === 3) { k = 0; if (tri) tri(); }
      }
      progress(p0 + (p1 - p0) * Math.min(1, (a + CHUNK) / file.size));
    }
  } };
}

// ---- GLB: the JSON part tells where each mesh's corners and triangles lie in the binary part; only
// those pieces are read, piece by piece, with each node's placement in the scene applied
async function glb(file) {
  if (file.size < 28) fail('That file is too small to hold a model.');
  const h = new DataView(await part(file, 0, 20));
  if (h.getUint32(0, true) !== 0x46546C67) fail('That .glb file is broken: it doesn\'t start like a .glb.');
  const jsonLen = h.getUint32(12, true);
  if (h.getUint32(16, true) !== 0x4E4F534A || 20 + jsonLen > file.size) fail('That .glb file is broken.');
  const json = JSON.parse(new TextDecoder().decode(await part(file, 20, 20 + jsonLen)));
  const used = [...(json.extensionsRequired || []), ...(json.extensionsUsed || [])];
  if (used.some((x) => /draco|meshopt/i.test(x))) fail('That .glb is compressed (Draco or meshopt), which the printer can\'t read. Export it without compression.');
  const binStart = 20 + jsonLen + 8;
  const bufStart = (i) => { const b = (json.buffers || [])[i]; if (!b || b.uri !== undefined || i !== 0) fail('That .glb keeps its data in other files. Use a .glb with everything inside.'); return binStart; };
  // every triangle mesh in the scene, with its world matrix
  const prims = [], nodes = json.nodes || [], scene = (json.scenes || [])[json.scene || 0];
  const walk = (i, parent) => {
    const n = nodes[i]; if (!n) return;
    const m = mul(parent, local(n));
    if (n.mesh !== undefined) for (const p of (json.meshes[n.mesh].primitives || [])) if ((p.mode === undefined || p.mode === 4) && p.attributes && p.attributes.POSITION !== undefined) prims.push({ p, m });
    for (const c of n.children || []) walk(c, m);
  };
  (scene ? scene.nodes || [] : nodes.map((_, i) => i)).forEach((i) => walk(i, ID));
  if (!prims.length) fail('There is no model in that file.');
  const acc = (i) => {
    const a = json.accessors[i], v = json.bufferViews[a.bufferView];
    if (a.sparse || !v) fail('That .glb stores its shape in a way the printer can\'t read.');
    const size = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[a.componentType];
    const comps = { SCALAR: 1, VEC3: 3 }[a.type];
    if (!size || !comps) fail('That .glb stores its shape in a way the printer can\'t read.');
    return { a, start: bufStart(v.buffer) + (v.byteOffset || 0) + (a.byteOffset || 0), stride: v.byteStride || size * comps, size, comps, count: a.count };
  };
  const total = prims.reduce((s, { p }) => s + (p.indices !== undefined ? json.accessors[p.indices].count : json.accessors[p.attributes.POSITION].count), 0);
  return { each: async (vert, tri, p0, p1) => {
    let done = 0;
    for (const { p, m } of prims) {
      const P = acc(p.attributes.POSITION), I = p.indices !== undefined ? acc(p.indices) : null;
      // the corners, in world space, read piece by piece
      const pos = new Float32Array(P.count * 3), per = Math.max(1, Math.floor(CHUNK / P.stride));
      for (let s = 0; s < P.count; s += per) {
        const n = Math.min(per, P.count - s), d = new DataView(await part(file, P.start + s * P.stride, P.start + (s + n - 1) * P.stride + P.size * 3));
        for (let k = 0; k < n; k++) {
          const x = num(d, k * P.stride, P), y = num(d, k * P.stride + P.size, P), z = num(d, k * P.stride + 2 * P.size, P);
          pos[(s + k) * 3] = m[0] * x + m[4] * y + m[8] * z + m[12];
          pos[(s + k) * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
          pos[(s + k) * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
        }
      }
      const corner = (i) => { if (i >= P.count) fail('That .glb file is broken: a triangle points past its corners.'); vert(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); };
      const n3 = (I ? I.count : P.count) - (I ? I.count : P.count) % 3;
      if (!I) for (let i = 0; i < n3; i++) { corner(i); if (i % 3 === 2 && tri) tri(); }
      else {
        const per = Math.floor(CHUNK / I.stride / 3) * 3;
        for (let s = 0; s < n3; s += per) {
          const n = Math.min(per, n3 - s), d = new DataView(await part(file, I.start + s * I.stride, I.start + (s + n) * I.stride));
          for (let k = 0; k < n; k++) { corner(I.size === 4 ? d.getUint32(k * I.stride, true) : I.size === 2 ? d.getUint16(k * I.stride, true) : d.getUint8(k * I.stride)); if (k % 3 === 2 && tri) tri(); }
          progress(p0 + (p1 - p0) * (done + s + n) / total);
        }
      }
      done += I ? I.count : P.count;
      progress(p0 + (p1 - p0) * done / total);
    }
  } };
}
function num(d, o, P) {                                // a float, or a whole number (normalised if marked so)
  switch (P.a.componentType) {
    case 5126: return d.getFloat32(o, true);
    case 5120: { const v = d.getInt8(o); return P.a.normalized ? Math.max(v / 127, -1) : v; }
    case 5121: { const v = d.getUint8(o); return P.a.normalized ? v / 255 : v; }
    case 5122: { const v = d.getInt16(o, true); return P.a.normalized ? Math.max(v / 32767, -1) : v; }
    case 5123: { const v = d.getUint16(o, true); return P.a.normalized ? v / 65535 : v; }
    default: return d.getUint32(o, true);
  }
}
// 4 × 4 matrices, column by column as in glTF
const ID = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function local(n) {
  if (n.matrix) return n.matrix;
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0];
  return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
}
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}
