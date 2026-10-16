// Hub (HUB_PLAN phase H1): four screens hanging from the dome on thin cables, each one playing a
// slideshow of images read from hub/screens.json.
//   - one bigger landscape screen in the middle (16:9), two poster screens on the left, one on the
//     right (2:3), seen from the hub's view at the top of the stairs
//   - images are scaled to cover the screen without distortion and crossfade every few seconds
//   - nothing loads until the hub is in view, and then only the current and the next image of each
//     screen; out of view the slideshows pause where they are
//   - an empty list (or an image not loaded yet) shows a calm standby picture: dark, faint scan lines
//   - the picture is unlit and a little brighter at night, so it reads as a screen that is on
//   - a screen whose entry in screens.json says "type": "video" (the center one: the films) is
//     driven by media/media.js instead; its image list stays as the fallback if the films fail
// The tall free-standing intro panel of the model ('hubintro_panel') is taken out at load.
import * as THREE from 'three';

// viewer coordinates (y up, the station's open side faces -z, +x is to the left in the default view)
const EYE = new THREE.Vector3(-27.7, 4.65, 0.0);        // the hub's view in index.html: the top of the stairs
const DOME = { x: -22.85, z: 0.0, rim: 6.49, rise: 0.95, r: 5.15 };   // the glass dome the cables hang from
const ceiling = (x, z) => DOME.rim + DOME.rise * Math.max(0, 1 - ((x - DOME.x) ** 2 + (z - DOME.z) ** 2) / DOME.r ** 2);
// each screen: picture size (m), where it hangs as seen from the eye (degrees to the right, metres
// away), the height of its middle, and its place in the stagger (index offset into its list)
const LAYOUT = {
  center: { w: 2.3, h: 1.29, a: 0, d: 8.1, y: 5.2 },
  'left-1': { w: 0.84, h: 1.26, a: -12.5, d: 7.5, y: 5.08 },
  'left-2': { w: 0.84, h: 1.26, a: -20.0, d: 6.8, y: 5.04 },
  'right-1': { w: 0.84, h: 1.26, a: 13.5, d: 7.3, y: 5.08 },
};
const BEZEL = 0.035, DEPTH = 0.05;
const FADE = 1.2;                                         // seconds of crossfade
const SEE_FAR = 30;                                       // further than this the screens are a few pixels: they rest
const ROOM = new THREE.Vector3(-22.85, 4.8, 0.0);         // the hub's middle, for the view test
const CONFIG = 'hub/screens.json';

const S = { host: null, ready: false, screens: [], config: null, loading: false, t: 0, last: 0, on: false, panel: null };
const sph = new THREE.Sphere(), frustum = new THREE.Frustum(), pm = new THREE.Matrix4();
const loader = new THREE.TextureLoader();

// ---- the picture: two images (current, next) mixed, or the standby pattern where one is missing
const VERT = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = `uniform sampler2D uA, uB; uniform vec4 uCa, uCb; uniform float uHasA, uHasB, uMix, uBright, uTime, uLines;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 standby(vec2 uv) {
  float scan = 0.82 + 0.18 * sin(uv.y * uLines * 6.2832);
  float n = hash(floor(uv * vec2(uLines * 1.6, uLines)) + floor(uTime * 6.0));
  return vec3(0.016, 0.019, 0.022) * scan + n * 0.008;
}
void main() {
  vec3 a = uHasA > 0.5 ? texture2D(uA, vUv * uCa.xy + uCa.zw).rgb : standby(vUv);
  vec3 b = uHasB > 0.5 ? texture2D(uB, vUv * uCb.xy + uCb.zw).rgb : standby(vUv);
  gl_FragColor = vec4(mix(a, b, uMix) * uBright, 1.0);
}`;

// scale and offset of the uv so the image covers a w × h screen, centred, without distortion
function cover(tex, w, h, out) {
  const ia = tex.image.width / tex.image.height, sa = w / h;
  if (ia > sa) out.set(sa / ia, 1, (1 - sa / ia) / 2, 0);
  else out.set(1, ia / sa, 0, (1 - ia / sa) / 2);
  return out;
}

function makeScreen(id, L) {
  const g = new THREE.Group(); g.name = 'hub_screen_' + id;
  const dir = THREE.MathUtils.degToRad(L.a);
  g.position.set(EYE.x + Math.cos(dir) * L.d, L.y, EYE.z + Math.sin(dir) * L.d);
  g.rotation.y = Math.atan2(EYE.x - g.position.x, EYE.z - g.position.z);       // the picture faces the stairs
  const dark = new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.45, metalness: 0.2 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(L.w + 2 * BEZEL, L.h + 2 * BEZEL, DEPTH), dark);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: { uA: { value: null }, uB: { value: null }, uCa: { value: new THREE.Vector4(1, 1, 0, 0) }, uCb: { value: new THREE.Vector4(1, 1, 0, 0) },
      uHasA: { value: 0 }, uHasB: { value: 0 }, uMix: { value: 0 }, uBright: { value: 0.9 }, uTime: { value: 0 }, uLines: { value: Math.round(L.h * 90) } },
  });
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(L.w, L.h), mat);
  pic.position.z = DEPTH / 2 + 0.002;
  g.add(frame, pic);
  // two thin cables from the top of the frame straight up to the dome
  g.updateMatrixWorld(true);
  const top = L.y + L.h / 2 + BEZEL, cable = new THREE.MeshStandardMaterial({ color: 0x222326, roughness: 0.6 });
  for (const sx of [-1, 1]) {
    const local = new THREE.Vector3(sx * (L.w / 2 - Math.min(0.12, L.w * 0.15)), 0, 0), at = local.clone().applyMatrix4(g.matrixWorld);
    const len = ceiling(at.x, at.z) - top + 0.05;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, len, 5), cable);
    c.position.set(local.x, L.h / 2 + BEZEL + len / 2, 0);
    g.add(c);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = o !== pic; } });
  return { id, L, group: g, mat, items: [], interval: 8, k: 0, t: 0, cur: null, next: null, fading: -1 };
}

// ---- slideshow: one texture per shown image, freed as soon as it has faded out
function load(s, path, slot) {
  const item = { path, tex: null, failed: false };
  s[slot] = item;
  loader.load(path, (tex) => {
    if (s[slot] !== item) { tex.dispose(); return; }           // the screen moved on meanwhile
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    item.tex = tex;
    if (slot === 'cur') show(s);
  }, undefined, () => { item.failed = true; });
}
function show(s) {                                               // the current image is in: put it up, fetch the next
  const u = s.mat.uniforms;
  u.uA.value = s.cur.tex; cover(s.cur.tex, s.L.w, s.L.h, u.uCa.value); u.uHasA.value = 1;
  u.uMix.value = 0; u.uHasB.value = 0; s.t = 0;
  if (s.items.length > 1) load(s, s.items[(s.k + 1) % s.items.length], 'next');
}
function stepScreen(s, dt) {
  if (s.video) return;                                            // media/media.js plays this one
  const n = s.items.length;
  if (!n) return;
  if (!s.cur) { load(s, s.items[s.k], 'cur'); return; }
  if (s.cur.failed && n > 1 && !s.next) { s.k = (s.k + 1) % n; load(s, s.items[s.k], 'cur'); return; }   // skip a broken image
  if (n < 2) return;
  const u = s.mat.uniforms;
  if (s.fading >= 0) {
    s.fading = S.host.reduceMotion() ? 1 : Math.min(1, s.fading + dt / FADE);
    u.uMix.value = s.fading * s.fading * (3 - 2 * s.fading);
    if (s.fading < 1) return;
    if (s.cur.tex) s.cur.tex.dispose();
    s.cur = s.next; s.next = null; s.k = (s.k + 1) % n; s.fading = -1;
    show(s);
    return;
  }
  s.t += dt;
  if (s.t < s.interval || !s.next) return;
  if (s.next.failed) { s.k = (s.k + 1) % n; s.next = null; load(s, s.items[(s.k + 1) % n], 'next'); return; }
  if (!s.next.tex) return;                                        // waits for it: the picture stays as it is
  u.uB.value = s.next.tex; cover(s.next.tex, s.L.w, s.L.h, u.uCb.value); u.uHasB.value = 1;
  s.fading = 0;
}

function loadConfig() {
  S.loading = true;
  fetch(CONFIG).then((r) => r.json()).then((cfg) => {
    (cfg.screens || []).forEach((c, i) => {
      const s = S.screens.find((q) => q.id === c.id);
      if (!s) return;
      s.items = Array.isArray(c.items) ? c.items.filter((p) => typeof p === 'string' && p) : [];
      s.interval = Math.max(2, +c.interval || 8);
      s.k = s.items.length ? i % s.items.length : 0;             // stagger: neighbours never start on the same image
      const films = c.type === 'video' && Array.isArray(c.films) ? c.films.filter((f) => f && typeof f.src === 'string' && f.src) : [];
      s.video = films.length ? { films } : null;
    });
    S.config = cfg;
  }).catch(() => { S.config = { screens: [] }; });               // no list: every screen stays on standby
}

// ---- is the hub on screen? (the hub is the open place, or the camera is near and sees the room)
function inView() {
  if (S.host.inPlace()) return true;
  const cam = S.host.camera;
  if (cam.position.distanceTo(ROOM) > SEE_FAR) return false;
  pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); frustum.setFromProjectionMatrix(pm);
  return frustum.intersectsSphere(sph.set(ROOM, 5.5));
}

export const hub = {
  // index.html: once the model is loaded. host = the page's camera and helpers
  setup(host, root) {
    S.host = host;
    const panel = root.getObjectByName('hubintro_panel');       // the tall projector-screen-like panel: out
    if (panel) { panel.parent.remove(panel); panel.geometry.dispose(); S.panel = 'removed'; }
    const group = new THREE.Group(); group.name = 'hub_screens';
    S.screens = Object.entries(LAYOUT).map(([id, L]) => makeScreen(id, L));
    S.screens.forEach((s) => group.add(s.group));
    host.scene.add(group);
    S.ready = true;
  },
  // every frame while the station runs: the slideshows only advance while the hub is seen
  step(now) {
    if (!S.ready) return;
    const dt = S.last ? Math.min(0.1, (now - S.last) / 1000) : 0; S.last = now;
    S.on = inView();
    if (!S.on) return;                                           // out of view: nothing loads, nothing moves
    if (!S.config) { if (!S.loading) loadConfig(); }
    else S.screens.forEach((s) => stepScreen(s, dt));
    if (!S.host.reduceMotion()) S.t += dt;
    const bright = 0.9 + 0.3 * S.host.night();
    S.screens.forEach((s) => { s.mat.uniforms.uTime.value = S.t; s.mat.uniforms.uBright.value = bright; });
  },
  resume(now) { S.last = now; },
  // media/media.js: the screen that plays films (its picture material and size), once the list is read
  video() {
    const s = S.screens.find((q) => q.video);
    return s ? { id: s.id, films: s.video.films, mat: s.mat, w: s.L.w, h: s.L.h, seen: S.on } : null;
  },
  noVideo(id) { const s = S.screens.find((q) => q.id === id); if (s) s.video = null; },   // the films fail: back to the slideshow
  // tests
  state: () => ({ on: S.on, panel: S.panel, config: !!S.config,
    screens: S.screens.map((s) => ({ id: s.id, k: s.k, cur: s.cur && s.cur.path, loaded: !!(s.cur && s.cur.tex), next: s.next && s.next.path, fading: s.fading, t: +s.t.toFixed(2), video: !!s.video })) }),
  screen(id) {                                                   // where on the page a screen's middle is
    const s = S.screens.find((q) => q.id === id), v = s.group.getWorldPosition(new THREE.Vector3()).project(S.host.camera);
    const r = S.host.el.getBoundingClientRect();
    return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height, v.z];
  },
};
