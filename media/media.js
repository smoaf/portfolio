// Media (MEDIA_PLAN phase M1): video on two screens that are already in the station.
//   - showroom: the 360° panorama runs all the way round the inside of the ring screen
//     ('showroomscreen'), the video's width over the full circumference, the joint behind the view
//   - hub: the big middle screen (hub/screens.js) plays the films listed in hub/screens.json
//     ("type": "video"): one at random on entering, then another, never the same twice in a row
//   - a video loads only while its place is the open one; until then, and while it loads, the
//     screen shows the film's still. Leaving pauses it and lets it go (src cleared, load())
//   - there is only ever one video element, so the two can never load at the same time
//   - always muted at first; a Sound button unmutes (the site's shared mute, safari/audio.js)
//   - the 3D resting (a panel open, the safari, a hidden tab) pauses the video where it is
import * as THREE from 'three';
import { mutedByDefault, saveMute } from '../safari/audio.js';

const PANO = {
  big: 'assets/media/showroom-360/echoes2026-360-4096.mp4',
  small: 'assets/media/showroom-360/echoes2026-360-2560.mp4',     // phones, small screens, data saver
  still: 'assets/media/showroom-360/echoes2026-360-still.webp',
};
const INSET = 0.012;                                   // the picture sits this far inside the ring's inner face

const M = { host: null, hub: null, ready: false, el: null, tex: null, owner: null, src: '', held: false, live: false,
  pano: null, film: -1, lastFilm: -1, stills: new Map(), sound: false, btn: null, tried: new Set() };
const loader = new THREE.TextureLoader();

const small = () => Math.min(screen.width, screen.height) <= 820 || matchMedia('(max-width: 820px)').matches ||
  !!(navigator.connection && navigator.connection.saveData);

// ---- the panorama band: the ring screen's inward faces, a little inside, with the video wrapped round
function panoBand(screenMesh) {
  screenMesh.updateMatrixWorld(true);
  const g = screenMesh.geometry.index ? screenMesh.geometry.toNonIndexed() : screenMesh.geometry;
  const src = g.attributes.position, n = src.count;
  const P = [];
  for (let i = 0; i < n; i++) P.push(new THREE.Vector3().fromBufferAttribute(src, i).applyMatrix4(screenMesh.matrixWorld));
  if (g !== screenMesh.geometry) g.dispose();
  const box = new THREE.Box3().setFromPoints(P), c = box.getCenter(new THREE.Vector3());
  // the inner face: the upright faces with nothing between them and the middle (the export's
  // winding can't be trusted, so this goes by position, and each triangle is turned to face the middle)
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), nrm = new THREE.Vector3(), hit = new THREE.Vector3();
  const cand = [];
  for (let i = 0; i + 2 < n; i += 3) {
    const a = P[i], b = P[i + 1], d = P[i + 2];
    nrm.crossVectors(ab.subVectors(b, a), ac.subVectors(d, a));
    if (nrm.lengthSq() < 1e-10 || Math.abs(nrm.normalize().y) > 0.3) continue;   // tops and bottoms out
    const mid = a.clone().add(b).add(d).divideScalar(3);
    cand.push({ a, b, d, mid, facing: nrm.x * (c.x - mid.x) + nrm.z * (c.z - mid.z) });
  }
  const ray = new THREE.Ray(), tris = [];
  cand.forEach((t) => {
    ray.origin.set(c.x, t.mid.y, c.z); ray.direction.set(t.mid.x - c.x, 0, t.mid.z - c.z);
    const far = ray.direction.length() - 0.004; ray.direction.normalize();
    const covered = cand.some((o) => o !== t && ray.intersectTriangle(o.a, o.b, o.d, false, hit) && hit.distanceTo(ray.origin) < far);
    if (covered) return;
    if (t.facing > 0) tris.push(t.a, t.b, t.d); else tris.push(t.a, t.d, t.b);
  });
  // the inner face's own extent: an oval with half-widths A (x) and B (z), height y0..y1
  const inner = new THREE.Box3().setFromPoints(tris), A = (inner.max.x - inner.min.x) / 2, B = (inner.max.z - inner.min.z) / 2;
  const y0 = inner.min.y, y1 = inner.max.y;
  // u by arc length round the oval (so the picture is not stretched on the long sides), starting
  // behind the showroom's view (-z) and running to the right as seen from inside
  const STEPS = 1440, start = -Math.PI / 2, len = new Float32Array(STEPS + 1);
  const at = (t) => { const r = (A * B) / Math.hypot(B * Math.cos(t), A * Math.sin(t)); return [r * Math.cos(t), r * Math.sin(t)]; };
  let prev = at(start);
  for (let i = 1; i <= STEPS; i++) { const q = at(start + (i / STEPS) * Math.PI * 2); len[i] = len[i - 1] + Math.hypot(q[0] - prev[0], q[1] - prev[1]); prev = q; }
  const total = len[STEPS];
  const uOf = (p) => {
    let t = Math.atan2(p.z - c.z, p.x - c.x) - start;
    t = ((t % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const f = (t / (Math.PI * 2)) * STEPS, i = Math.min(STEPS - 1, Math.floor(f));
    return (len[i] + (len[i + 1] - len[i]) * (f - i)) / total;
  };
  const pos = new Float32Array(tris.length * 3), uv = new Float32Array(tris.length * 2);
  for (let i = 0; i < tris.length; i += 3) {
    const us = [0, 1, 2].map((k) => uOf(tris[i + k]));
    if (Math.max(...us) - Math.min(...us) > 0.5) us.forEach((u, k) => { if (u < 0.5) us[k] = u + 1; });   // the joint: wrap, don't smear
    for (let k = 0; k < 3; k++) {
      const p = tris[i + k], d = new THREE.Vector3(c.x - p.x, 0, c.z - p.z).normalize().multiplyScalar(INSET);
      pos.set([p.x + d.x, p.y, p.z + d.z], (i + k) * 3);
      uv.set([us[k], (p.y - y0) / (y1 - y0)], (i + k) * 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeBoundingSphere();
  return geo;
}
function wrap(tex) { tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; return tex; }

// ---- stills: loaded once each, kept (they are small)
function still(path, done) {
  let s = M.stills.get(path);
  if (!s) {
    s = { tex: null, wait: [] };
    M.stills.set(path, s);
    loader.load(path, (t) => { t.colorSpace = THREE.SRGBColorSpace; s.tex = t; s.wait.forEach((f) => f(t)); s.wait = []; }, undefined, () => { s.wait = []; });
  }
  if (s.tex) done(s.tex); else s.wait.push(done);
}
function cover(w, h, iw, ih, out) {                    // as hub/screens.js: fill the screen, no distortion
  const ia = iw / ih, sa = w / h;
  if (ia > sa) out.set(sa / ia, 1, (1 - sa / ia) / 2, 0); else out.set(1, ia / sa, 0, (1 - ia / sa) / 2);
}
function hubPicture(tex, iw, ih) {
  const v = M.hub.video();
  if (!v) return;
  const u = v.mat.uniforms;
  u.uA.value = tex; cover(v.w, v.h, iw, ih, u.uCa.value);
  u.uHasA.value = 1; u.uHasB.value = 0; u.uMix.value = 0;
}
function showHubStill() {                              // the chosen film's still on the middle screen
  const v = M.hub.video();
  if (!v || M.film < 0) return;
  const want = M.film, u = v.mat.uniforms;
  if (u.uA.value && u.uA.value.isVideoTexture) { u.uA.value = null; u.uHasA.value = 0; }   // the video is let go: standby until the still is in
  still(v.films[want].still, (t) => { if (M.film === want && !(M.owner === 'hub' && M.live)) hubPicture(t, t.image.width, t.image.height); });
}
function pickFilm(n) {                                  // at random, never the one just played
  if (n < 2) return 0;
  let k;
  do k = Math.floor(Math.random() * n); while (k === M.lastFilm);
  return k;
}

// ---- the one video element
function makeVideo() {
  const v = document.createElement('video');
  v.muted = true; v.defaultMuted = true; v.playsInline = true; v.preload = 'none';
  v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
  v.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
  v.addEventListener('playing', () => {
    if (!M.owner || M.live) return;
    M.live = true; M.tried.clear();
    if (M.owner === 'showroom') { M.pano.mat.map = M.tex; M.pano.mat.needsUpdate = true; }
    else hubPicture(M.tex, v.videoWidth || 16, v.videoHeight || 9);
  });
  v.addEventListener('ended', () => {                    // hub: the next film
    if (M.owner !== 'hub') return;
    const f = M.hub.video();
    if (!f) return;
    M.lastFilm = M.film; M.film = pickFilm(f.films.length);
    load(f.films[M.film].src);
  });
  v.addEventListener('error', () => {
    if (!M.owner || !v.getAttribute('src')) return;
    const f = M.owner === 'hub' && M.hub.video();
    if (f) M.tried.add(M.film);
    const left = f ? f.films.map((x, k) => k).filter((k) => !M.tried.has(k)) : [];
    if (left.length) {                                     // try a film not tried yet, after the element has settled
      M.lastFilm = M.film; M.film = left[Math.floor(Math.random() * left.length)];
      const film = f.films[M.film].src;
      setTimeout(() => { if (M.owner === 'hub') load(film); }, 300);
      return;
    }
    if (f) { const id = f.id; release(); M.film = -1; M.hub.noVideo(id); return; }   // none of the films play: the slideshow again
    release(true);                                       // the panorama stays on its still
  });
  document.body.appendChild(v);
  return v;
}
function load(src) {
  const v = M.el;
  if (M.live) { M.live = false; if (M.owner === 'hub') showHubStill(); }
  if (M.tex) { M.tex.dispose(); M.tex = null; }
  M.src = src;
  v.loop = M.owner === 'showroom';
  v.preload = 'auto';
  v.src = src;
  M.tex = M.owner === 'showroom' ? wrap(new THREE.VideoTexture(v)) : new THREE.VideoTexture(v);
  if (M.owner !== 'showroom') M.tex.colorSpace = THREE.SRGBColorSpace;
  v.load();
  play();
}
function play() {
  const v = M.el;
  if (!M.owner || M.held || document.hidden) return;
  v.muted = !(M.sound && !mutedByDefault());
  const p = v.play();
  if (p && p.catch) p.catch((e) => {
    if (e && e.name === 'NotAllowedError' && !v.muted) { v.muted = true; paintSound(); v.play().catch(() => {}); }   // no sound allowed yet: muted
  });
  paintSound();
}
function start(owner) {
  M.owner = owner; M.tried.clear();
  if (owner === 'showroom') load(small() ? PANO.small : PANO.big);
  else {
    const f = M.hub.video();
    if (M.film < 0) M.film = pickFilm(f.films.length);
    showHubStill();
    load(f.films[M.film].src);
  }
  M.btn.hidden = false; paintSound();
}
function release(keepOwner) {                         // pause, let the file go, stills back up
  const v = M.el, was = M.owner;
  v.pause(); v.removeAttribute('src'); v.preload = 'none'; v.load();
  if (M.tex) { M.tex.dispose(); M.tex = null; }
  M.live = false; M.src = '';
  if (M.pano) { M.pano.mat.map = M.pano.still; M.pano.mat.needsUpdate = true; }
  if (was === 'hub') {                                 // next time: another film, its still shows meanwhile
    const f = M.hub.video();
    if (f) { M.lastFilm = M.film; M.film = pickFilm(f.films.length); showHubStill(); }
  }
  if (!keepOwner) M.owner = null;
  else M.owner = 'failed-' + was;                      // stays on its still until the place is left
  M.btn.hidden = true;
}

// ---- sound
function paintSound() {
  if (!M.btn) return;
  const on = !M.el.muted;
  M.btn.textContent = on ? 'Sound' : 'Muted';
  M.btn.setAttribute('aria-pressed', String(!on));
  M.btn.title = on ? 'Mute the video' : 'Sound on';
}
function toggleSound() {
  const on = M.el.muted;                               // muted now: turn the sound on
  M.sound = on; saveMute(!on);
  M.el.muted = !on;
  if (on && M.el.paused && M.owner && !M.held) play();
  paintSound();
}
const CSS = `
  .md-sound { position: fixed; z-index: 22; right: 16px; top: calc(var(--hh, 77px) + 12px); color: var(--glass-ink); background: var(--glass-strong);
              border: 1px solid var(--glass-line); -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur); font-size: 11px; }
  .md-sound[hidden] { display: none; }
`;

// ---- which video, if any, should run now
function wanted() {
  const p = M.host.place();
  if (p === 'showroom' && M.pano) return 'showroom';
  if (p === 'hub' && M.hub.video()) return 'hub';
  return null;
}

export const media = {
  // index.html: once the model is loaded. host = the page's helpers, hub = hub/screens.js
  setup(host, root, hub) {
    M.host = host; M.hub = hub;
    const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    M.btn = document.createElement('button');
    M.btn.className = 'btn md-sound'; M.btn.type = 'button'; M.btn.hidden = true;
    M.btn.addEventListener('click', toggleSound);
    document.body.appendChild(M.btn);
    M.el = makeVideo();
    const screenMesh = root.getObjectByName('showroomscreen');
    if (screenMesh && screenMesh.isMesh) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const mesh = new THREE.Mesh(panoBand(screenMesh), mat);
      mesh.name = 'showroom_pano'; mesh.castShadow = false; mesh.receiveShadow = false;
      host.scene.add(mesh);
      M.pano = { mesh, mat, still: null };
      still(PANO.still, (t) => { M.pano.still = wrap(t); if (!M.live || M.owner !== 'showroom') { mat.map = t; mat.needsUpdate = true; } });
    }
    document.addEventListener('visibilitychange', () => {
      if (!M.owner || !M.src) return;
      if (document.hidden) M.el.pause(); else play();
    });
    M.ready = true;
  },
  // every frame: start, swap or stop the video with the open place
  step() {
    if (!M.ready) return;
    const f = M.hub.video();
    if (f && f.seen && M.film < 0) { M.film = pickFilm(f.films.length); showHubStill(); }   // the hub comes into view
    const want = wanted();
    if (M.owner === 'failed-' + want) return;
    if (want !== M.owner) {
      if (M.owner) release();
      if (want) start(want);
    }
  },
  // the 3D rests (a panel is open, the safari runs) or runs again: the video pauses and goes on
  hold(on) {
    M.held = !!on;
    if (!M.ready || !M.owner || !M.src) return;
    if (on) { M.el.pause(); M.btn.hidden = true; } else { M.btn.hidden = false; play(); }
  },
  // tests
  state: () => ({ owner: M.owner, src: M.src, live: M.live, paused: M.el ? M.el.paused : true, muted: M.el ? M.el.muted : true,
    film: M.film, lastFilm: M.lastFilm, held: M.held, videos: document.querySelectorAll('video').length,
    pano: M.pano ? { map: M.pano.mat.map === M.tex && !!M.tex ? 'video' : M.pano.mat.map ? 'still' : 'none', tris: M.pano.mesh.geometry.attributes.position.count / 3 } : null,
    button: M.btn && !M.btn.hidden ? M.btn.textContent : null }),
};
