// EUTOPAI · Drei Zeichen. Three cards drawn from the slide-out box. Units: cm, Z up.
import * as THREE from "./vendor/three.module.min.js";
import { OrbitControls } from "./vendor/OrbitControls.js";
import { RoomEnvironment } from "./vendor/RoomEnvironment.js";

const $ = (id) => document.getElementById(id);
if (new URLSearchParams(location.search).has("embed")) document.body.classList.add("embed");
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const SPEED = REDUCED ? 0.35 : 1;
const POS = ["Was war", "Was ist", "Was werden kann"];

// ---------- product sizes (cm), same as the print data ----------
const T = 0.05;
const SW = 8.1, SH = 2.85, SL = 11.1;          // sleeve outside
const TW = 7.9, TL = 11.1, TH = 2.65;          // tray outside
const CW = 7.4, CH = 10.5, CT = 0.037;         // A7 card
const DECK_H = 40 * CT, BOOK_H = 0.32;
const PULL = 7.2;

// ---------- renderer, scene, camera ----------
const canvas = $("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const NAVY = new THREE.Color(0x050a24);
scene.background = NAVY; scene.fog = new THREE.Fog(NAVY, 95, 230);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.22;

const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 600);
camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.enablePan = false;
controls.minDistance = 18; controls.maxDistance = 130;
controls.minPolarAngle = 0.15; controls.maxPolarAngle = 1.35;
const VIEWS = {
  idle: { pos: new THREE.Vector3(-7, -17, 22), tgt: new THREE.Vector3(0.5, 7, 1.2) },
  drawn: { pos: new THREE.Vector3(-2, -33, 33), tgt: new THREE.Vector3(0, -2, 0) },
  look: { pos: new THREE.Vector3(-12, -16, 22), tgt: new THREE.Vector3(0.5, 8, 6) },
};
camera.position.copy(VIEWS.idle.pos); controls.target.copy(VIEWS.idle.tgt);

// ---------- set: velvet floor and light like the mockups ----------
const floorTex = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
  const im = g.createImageData(256, 256);
  for (let i = 0; i < im.data.length; i += 4) { const v = 120 + Math.random() * 40; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(40, 40); return t;
})();
const floor = new THREE.Mesh(new THREE.CircleGeometry(160, 96),
  new THREE.MeshStandardMaterial({ color: 0x0c1650, roughness: 1, bumpMap: floorTex, bumpScale: 0.6 }));
floor.receiveShadow = true; scene.add(floor);

const hemi = new THREE.HemisphereLight(0x4c5fd0, 0x03050f, 0.35); hemi.position.set(0, 0, 1); scene.add(hemi);
const beam = new THREE.SpotLight(0xfff0dc, 6.5, 0, 0.32, 0.6, 0);
beam.position.set(-42, -36, 30); beam.castShadow = true;
beam.shadow.mapSize.set(2048, 2048); beam.shadow.bias = -0.0004; beam.shadow.radius = 4;
beam.target.position.set(0, 0, 0); scene.add(beam, beam.target);
const rim = new THREE.DirectionalLight(0xc4ff3a, 1.4); rim.position.set(22, 30, 12); scene.add(rim);
const fill = new THREE.DirectionalLight(0x7088ff, 0.4); fill.position.set(10, -60, 70); scene.add(fill);
const key = new THREE.DirectionalLight(0xfff6ee, 0.55); key.position.set(12, -30, 30); scene.add(key);

// ---------- textures and materials ----------
const loader = new THREE.TextureLoader();
const aniso = renderer.capabilities.getMaxAnisotropy();
const texCache = new Map();
function tex(url, color = true) {
  if (texCache.has(url)) return texCache.get(url);
  const p = new Promise((res, rej) => loader.load(url, (t) => {
    t.anisotropy = aniso; if (color) t.colorSpace = THREE.SRGBColorSpace; res(t);
  }, undefined, rej));
  texCache.set(url, p); return p;
}
const white = new THREE.MeshStandardMaterial({ color: 0xe4e1d6, roughness: 0.8, side: THREE.DoubleSide });
const spine = new THREE.MeshStandardMaterial({ color: 0x224ea1, roughness: 0.5 });
const deckEdge = new THREE.MeshStandardMaterial({ color: 0xc9d35a, roughness: 0.75 });
const paperEdge = new THREE.MeshStandardMaterial({ color: 0xe9e7dc, roughness: 0.8 });

async function printMat(name, varnish = false, extra = {}) {
  const map = await tex(`box/${name}.webp`);
  const opt = { map, roughness: 0.6, side: THREE.DoubleSide, ...extra };
  if (varnish) {
    const v = await tex(`box/${name}_varnish.webp`, false);
    Object.assign(opt, { clearcoat: 1, clearcoatMap: v, clearcoatRoughness: 0.03, bumpMap: v, bumpScale: 0.45 });
  }
  return new THREE.MeshPhysicalMaterial(opt);
}

// A quad from four corners (local coords) with a uv function, same mapping as the Blender mockup script.
function quad(pts, uv, mat) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts.flat(), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(pts.map((p) => uv(...p)).flat(), 2));
  g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}

// Thumb notches (r = 8 mm) cut from both ends of the sleeve's side walls.
const notchMask = (() => {
  const c = document.createElement("canvas"); c.width = 256; c.height = 1024; const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, 256, 1024); g.fillStyle = "#000";
  const rx = 0.8 / SH * 256, ry = 0.8 / SL * 1024;
  for (const y of [0, 1024]) { g.beginPath(); g.ellipse(128, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
  return new THREE.CanvasTexture(c);
})();

// ---------- build the box ----------
const box = new THREE.Group(); scene.add(box);           // whole product, lying flat
const sleeve = new THREE.Group(); box.add(sleeve);
const tray = new THREE.Group(); sleeve.add(tray);
let deck, booklet;

async function buildBox() {
  const hw = SW / 2, hh = SH / 2, hl = SL / 2;
  const vy = (y) => (y + hl) / SL;
  const sideA = await printMat("s_sideA", false, { alphaMap: notchMask, alphaTest: 0.5 });
  const sideB = await printMat("s_sideB", false, { alphaMap: notchMask, alphaTest: 0.5 });
  const whiteNotch = white.clone(); whiteNotch.alphaMap = notchMask; whiteNotch.alphaTest = 0.5;
  sleeve.add(
    quad([[-hw, -hl, hh], [hw, -hl, hh], [hw, hl, hh], [-hw, hl, hh]], (x, y) => [(x + hw) / SW, vy(y)], await printMat("s_top", true)),
    quad([[-hw, -hl, -hh], [-hw, hl, -hh], [hw, hl, -hh], [hw, -hl, -hh]], (x, y) => [(hw - x) / SW, vy(y)], await printMat("s_bottom", true)),
    quad([[hw, -hl, -hh], [hw, -hl, hh], [hw, hl, hh], [hw, hl, -hh]], (x, y, z) => [(hh - z) / SH, vy(y)], sideA),
    quad([[-hw, -hl, -hh], [-hw, hl, -hh], [-hw, hl, hh], [-hw, -hl, hh]], (x, y, z) => [(z + hh) / SH, vy(y)], sideB),
    // inside of the board
    quad([[-hw + T, -hl, hh - T], [hw - T, -hl, hh - T], [hw - T, hl, hh - T], [-hw + T, hl, hh - T]], () => [0, 0], white),
    quad([[-hw + T, -hl, -hh + T], [hw - T, -hl, -hh + T], [hw - T, hl, -hh + T], [-hw + T, hl, -hh + T]], () => [0, 0], white),
    quad([[hw - T, -hl, -hh], [hw - T, -hl, hh], [hw - T, hl, hh], [hw - T, hl, -hh]], (x, y, z) => [(hh - z) / SH, vy(y)], whiteNotch),
    quad([[-hw + T, -hl, -hh], [-hw + T, hl, -hh], [-hw + T, hl, hh], [-hw + T, -hl, hh]], (x, y, z) => [(z + hh) / SH, vy(y)], whiteNotch),
  );

  // tray, origin at the centre of its base underside
  const tw = TW / 2, tl = TL / 2;
  const tSide = await printMat("t_side");
  tray.add(quad([[-tw, -tl, 0], [-tw, tl, 0], [tw, tl, 0], [tw, -tl, 0]], (x, y) => [(x + tw) / TW, (y + tl) / TL], await printMat("t_bottom")));
  tray.add(quad([[-tw, -tl, T], [tw, -tl, T], [tw, tl, T], [-tw, tl, T]], () => [0, 0], white));
  for (const s of [-1, 1]) {
    const x = s * tw;
    tray.add(quad([[x, -tl, 0], [x, tl, 0], [x, tl, TH], [x, -tl, TH]], (x_, y, z) => [(y + tl) / TL, z / TH], tSide));
    tray.add(quad([[x - s * T, -tl, 0], [x - s * T, tl, 0], [x - s * T, tl, TH], [x - s * T, -tl, TH]], () => [0, 0], white));
    const yo = s * tl, yi = s * (tl - 2 * T);
    const uo = s < 0 ? (x_) => (x_ + tw) / TW : (x_) => (tw - x_) / TW;
    const ui = s < 0 ? (x_) => (tw - x_) / TW : (x_) => (x_ + tw) / TW;
    tray.add(quad([[-tw, yo, 0], [tw, yo, 0], [tw, yo, TH], [-tw, yo, TH]], (x_, y, z) => [uo(x_), z / TH], await printMat("t_end_out", true)));
    tray.add(quad([[-tw, yi, 0], [tw, yi, 0], [tw, yi, TH], [-tw, yi, TH]], (x_, y, z) => [ui(x_), z / TH], await printMat("t_end_in")));
    tray.add(quad([[-tw, yo, TH], [tw, yo, TH], [tw, yi, TH], [-tw, yi, TH]], () => [0, 0], spine));
  }
  tray.position.set(0, 0, -hh + 0.06);

  // deck (backs up) and the closed booklet on top
  const back = await tex("cards/card_back.webp");
  deck = new THREE.Mesh(new THREE.BoxGeometry(CW, CH, DECK_H), [deckEdge, deckEdge, deckEdge, deckEdge,
    new THREE.MeshStandardMaterial({ map: back, roughness: 0.55 }), deckEdge]);
  deck.position.set(0, 0, T + DECK_H / 2); deck.castShadow = deck.receiveShadow = true; tray.add(deck);
  const b1 = await tex("box/bk_01.webp"), b48 = await tex("box/bk_48.webp");
  booklet = new THREE.Mesh(new THREE.BoxGeometry(CW, CH, BOOK_H), [paperEdge, paperEdge, paperEdge, paperEdge,
    new THREE.MeshStandardMaterial({ map: b1, roughness: 0.5 }), new THREE.MeshStandardMaterial({ map: b48, roughness: 0.5 })]);
  booklet.castShadow = booklet.receiveShadow = true;
  booklet.userData.home = new THREE.Vector3(0, 0, T + DECK_H + BOOK_H / 2);
  booklet.position.copy(booklet.userData.home); tray.add(booklet);

  box.rotation.order = "ZXY"; box.position.set(0.5, 8, SH / 2); box.rotation.z = THREE.MathUtils.degToRad(-14);
  box.traverse((o) => { if (o.isMesh) o.userData.box = true; });
}

// ---------- cards ----------
let CARDS = [];
const backMat = () => tex("cards/card_back.webp").then((t) => new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }));
async function makeCard(c) {
  const front = await tex(`cards/card_${String(c.id).padStart(2, "0")}.webp`);
  const m = new THREE.Mesh(new THREE.BoxGeometry(CW, CH, CT), [paperEdge, paperEdge, paperEdge, paperEdge,
    new THREE.MeshStandardMaterial({ map: front, roughness: 0.5 }), await backMat()]);
  m.rotation.order = "ZYX"; m.castShadow = m.receiveShadow = true; m.userData.card = c; return m;
}

// ---------- tiny tween engine ----------
const tweens = new Set();
const ease = { io: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, out: (t) => 1 - Math.pow(1 - t, 3) };
function tween(ms, fn, e = ease.io) {
  return new Promise((res) => tweens.add({ t0: performance.now(), ms: ms * SPEED, fn, e, res }));
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms * SPEED));
function stepTweens(now) {
  for (const tw of [...tweens]) {
    const k = Math.min(1, (now - tw.t0) / tw.ms); tw.fn(tw.e(k));
    if (k >= 1) { tweens.delete(tw); tw.res(); }
  }
}
function fitted(v) {
  // narrow screens: step back so the three cards still fit side by side
  const a = camera.aspect, f = a < 1.25 ? Math.pow(1.25 / a, 0.92) : 1;
  return { pos: v.tgt.clone().add(v.pos.clone().sub(v.tgt).multiplyScalar(f)), tgt: v.tgt };
}
function moveCamera(v, ms = 1400) {
  v = fitted(v);
  const p0 = camera.position.clone(), t0 = controls.target.clone();
  return tween(ms, (k) => { camera.position.lerpVectors(p0, v.pos, k); controls.target.lerpVectors(t0, v.tgt, k); });
}

// ---------- game flow ----------
let state = "loading", drawn = [], viewing = false;
const SLOTS = [new THREE.Vector3(-8.9, -9.2, 0), new THREE.Vector3(0, -9.8, 0), new THREE.Vector3(8.9, -9.2, 0)];
const SLOT_ROT = [6, 0, -6];

async function setTray(open) {
  const y0 = tray.position.y, y1 = open ? -PULL : 0;
  await tween(900, (k) => { tray.position.y = y0 + (y1 - y0) * k; });
}
async function setBooklet(out) {
  // reparent without jumping, then glide: out of the tray onto the velvet beside the box, or back on the deck
  (out ? box : tray).attach(booklet);
  const p0 = booklet.position.clone(), r0 = booklet.rotation.z;
  const p1 = out ? new THREE.Vector3(-10.5, 1.0, -SH / 2 + BOOK_H / 2 + 0.01) : booklet.userData.home;
  const r1 = out ? THREE.MathUtils.degToRad(24) : 0;
  await tween(800, (k) => {
    booklet.position.lerpVectors(p0, p1, k); booklet.position.z += Math.sin(k * Math.PI) * 4;
    booklet.rotation.z = r0 + (r1 - r0) * k;
  });
}

function deckTopWorld() {
  tray.updateMatrixWorld(true);
  return deck.localToWorld(new THREE.Vector3(0, 0, DECK_H / 2 + CT / 2));
}

async function flyCard(mesh, i) {
  const start = deckTopWorld();
  const rz0 = box.rotation.z, rz1 = THREE.MathUtils.degToRad(SLOT_ROT[i]);
  mesh.position.copy(start); mesh.rotation.set(0, Math.PI, rz0); scene.add(mesh);
  const end = SLOTS[i].clone(); end.z = CT / 2 + 0.01 * i;
  const mid = start.clone().lerp(end, 0.5); mid.z = 9;
  await tween(950, (k) => {
    const a = start.clone().lerp(mid, k), b = mid.clone().lerp(end, k); mesh.position.copy(a.lerp(b, k));
    mesh.rotation.z = rz0 + (rz1 - rz0) * k; mesh.rotation.x = Math.sin(k * Math.PI) * 0.25;
  }, ease.io);
}
async function flip(mesh) {
  const z0 = mesh.position.z;
  await tween(700, (k) => { mesh.rotation.y = Math.PI * (1 - k); mesh.position.z = z0 + Math.sin(k * Math.PI) * 3.2; });
}

function pick3() {
  const ids = [...CARDS.keys()];
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  return ids.slice(0, 3).map((i) => CARDS[i]);
}

async function draw() {
  if (state !== "idle") return;
  if (viewing) await toggleView(false);
  state = "busy"; $("btn-draw").disabled = true;
  const picks = pick3();
  const meshes = await Promise.all(picks.map(makeCard));
  await setTray(true);
  await setBooklet(true);
  moveCamera(VIEWS.drawn, 2200);
  for (let i = 0; i < 3; i++) { await flyCard(meshes[i], i); await wait(80); }
  for (let i = 0; i < 3; i++) { await flip(meshes[i]); await wait(120); }
  drawn = meshes; showResult(picks); state = "drawn";
}

async function reset() {
  if (state !== "drawn") return;
  state = "busy"; $("result").hidden = true; $("intro").hidden = false;
  const home = deckTopWorld();
  await Promise.all(drawn.map(async (m, i) => {
    await wait(i * 120);
    const p0 = m.position.clone(), ry0 = m.rotation.y, rz0 = m.rotation.z;
    await tween(800, (k) => {
      m.position.lerpVectors(p0, home, k); m.position.z += Math.sin(k * Math.PI) * 6;
      m.rotation.y = ry0 + (Math.PI - ry0) * k; m.rotation.z = rz0 + (box.rotation.z - rz0) * k;
    });
    scene.remove(m);
  }));
  drawn = [];
  await setBooklet(false);
  moveCamera(VIEWS.idle, 1200);
  await setTray(false);
  state = "idle"; $("btn-draw").disabled = false;
}

// look at the packaging: the closed box rises and turns, so every side and the varnish catch the light
let spin = 0;
const IDLE_RZ = THREE.MathUtils.degToRad(-14), LOOK_RZ = THREE.MathUtils.degToRad(28), LOOK_RX = 0.32;
async function toggleView(on = !viewing) {
  if (state === "busy" || state === "loading") return;
  if (on && state === "drawn") await reset();
  viewing = on; $("btn-view").setAttribute("aria-pressed", String(on));
  $("btn-view").textContent = on ? "Zurück zum Spiel" : "Schachtel ansehen";
  const z0 = box.position.z, z1 = on ? 7.5 : SH / 2;
  const rx0 = box.rotation.x, rx1 = on ? LOOK_RX : 0, rz0 = box.rotation.z, rz1 = on ? LOOK_RZ : IDLE_RZ;
  const ry0 = box.rotation.y % (2 * Math.PI), ry1 = on ? ry0 : (ry0 > Math.PI ? 2 * Math.PI : 0);
  spinning = false;
  moveCamera(on ? VIEWS.look : VIEWS.idle, 1200);
  await tween(1200, (k) => {
    box.position.z = z0 + (z1 - z0) * k; box.rotation.x = rx0 + (rx1 - rx0) * k;
    box.rotation.z = rz0 + (rz1 - rz0) * k; box.rotation.y = ry0 + (ry1 - ry0) * k;
  });
  if (!on) box.rotation.y = 0;
  spinning = on;
}
let spinning = false;

// ---------- result panel ----------
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function showResult(picks) {
  const k = picks.map((c) => `<b>${esc(c.keywords[0])}</b>`);
  $("sentence").innerHTML = `Aus ${k[0]} wurde ${k[1]}. Daraus kann ${k[2]} werden.`;
  const cols = $("cols"); cols.innerHTML = "";
  picks.forEach((c, i) => {
    const b = el("button", "eg-card"); b.type = "button"; b.dataset.i = i; b.setAttribute("aria-expanded", "false");
    b.append(el("p", "eg-pos", POS[i]), el("h2", "eg-name", `<span>${esc(c.num)}</span>${esc(c.name)}`));
    const ul = el("ul", "eg-kw"); c.keywords.forEach((w) => ul.append(el("li", null, esc(w)))); b.append(ul);
    b.append(el("p", "eg-meaning", esc(c.meaning)), el("p", "eg-q", esc(c.question)),
      el("p", "eg-more", `<em>Aus dem Begleitheft:</em> ${esc(c.text)}`), el("p", "eg-toggle", "Tippen für den Text aus dem Heft"));
    b.addEventListener("click", () => openCard(i));
    cols.append(b);
  });
  $("intro").hidden = true; $("result").hidden = false; postHeight();
}
let lifted = -1;
function openCard(i) {
  const cards = [...document.querySelectorAll(".eg-card")];
  cards.forEach((c, j) => { const on = j === i ? !c.classList.contains("open") : false; c.classList.toggle("open", on); c.classList.toggle("active", on); c.setAttribute("aria-expanded", String(on)); });
  const open = cards[i]?.classList.contains("open");
  // lift the matching card in the scene
  drawn.forEach((m, j) => {
    const want = open && j === i ? CT / 2 + 1.2 : CT / 2 + 0.01 * j, z0 = m.position.z;
    if (Math.abs(want - z0) > 1e-3) tween(350, (k) => { m.position.z = z0 + (want - z0) * k; });
  });
  lifted = open ? i : -1; postHeight();
}

// ---------- picking ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let downAt = null;
canvas.addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY]; });
canvas.addEventListener("pointerup", (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects([box, ...drawn], true)[0];
  if (!hit) return;
  if (hit.object.userData.card) { openCard(drawn.indexOf(hit.object)); document.querySelectorAll(".eg-card")[drawn.indexOf(hit.object)]?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
  else if (hit.object.userData.box && state === "idle") draw();
});

$("btn-draw").addEventListener("click", draw);
$("btn-again").addEventListener("click", async () => { await reset(); draw(); });
$("btn-view").addEventListener("click", () => toggleView());

// ---------- loop and sizing ----------
function resize() {
  const r = canvas.parentElement.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height;
  camera.fov = 32; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas.parentElement);
// tell a parent page how tall the game is, so an iframe can fit it without scrollbars
function postHeight() { if (parent !== window) parent.postMessage({ type: "eutopai-game-height", height: document.documentElement.scrollHeight }, "*"); }
new ResizeObserver(postHeight).observe(document.body);

renderer.setAnimationLoop((now) => {
  stepTweens(now);
  if (spinning) box.rotation.y += REDUCED ? 0.002 : 0.006;   // turn around the long axis: top, side, bottom, side
  controls.update(); renderer.render(scene, camera);
});

// ---------- start ----------
(async () => {
  resize(); const v0 = fitted(VIEWS.idle); camera.position.copy(v0.pos); controls.target.copy(v0.tgt);
  const [data] = await Promise.all([fetch("cards.json").then((r) => r.json()), buildBox()]);
  CARDS = data;
  $("loading").classList.add("done");
  state = "idle"; $("btn-draw").disabled = false; postHeight();
})().catch((e) => { $("loading").textContent = "Die Karten konnten nicht geladen werden."; console.error(e); });
