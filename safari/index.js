// The Photo Safari engine (Phase 2). Everything here downloads only when the visitor picks a route
// on the van's screen, and everything here goes again when they leave (Global rule 1): the station
// keeps its scene in memory, paused, while this one runs on the same renderer.
//
//   startSafari({ renderer, route, tod, onExit })  ->  { dispose(), state() }
//
// The run: the van drives itself along the route's spline for about two minutes, the visitor turns
// the lens (drag, pinch or wheel), a click or tap takes a photo, the feed button throws pellets, and
// at the end a field report shows the best shot per species, the score and the board.
//
// A route module (safari/routes/*.js) brings the terrain, the creatures and the palette; the engine
// brings the camera, the scoring, the sound and the HUD. Phase 3 and 4 add canyon.js and jungle.js
// next to test.js and nothing in here has to change.
import * as THREE from 'three';
import { makeRig, FOV } from './rig.js';
import { createHud } from './hud.js';
import { createAudio, mutedByDefault } from './audio.js';
import { judge, verdict, grab } from './photo.js';
import { localStore } from './leaderboard.js';

const FILM = 30, PELLETS = 8;
const vA = new THREE.Vector3(), vB = new THREE.Vector3();
const srgb = (hex) => new THREE.Color(hex).convertSRGBToLinear();
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// the sky: a gradient dome with the route's three colours, plus stars when it is dark
function makeSky(scene, P, dark) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: srgb(P.top) }, horizon: { value: srgb(P.horizon) }, low: { value: srgb(P.fog) } },
    vertexShader: 'varying vec3 vW; void main() { vW = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 low; varying vec3 vW;
      void main() {
        float h = normalize(vW).y;
        vec3 c = mix(horizon, top, smoothstep(0.0, 0.5, h));
        c = mix(low, c, smoothstep(-0.22, 0.03, h));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(620, 24, 16), mat);
  dome.frustumCulled = false;
  scene.add(dome);
  if (!dark) return dome;
  const n = 420, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, y = 0.06 + Math.random() * 0.9, r = Math.sqrt(1 - y * y);
    p.set([Math.cos(a) * r * 560, y * 560, Math.sin(a) * r * 560], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe7ff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false }));
  stars.frustumCulled = false;
  scene.add(stars);
  return dome;
}

export async function startSafari({ renderer, route = 'test', tod = 'day', host = document.body, onExit = () => {} } = {}) {
  // the HUD's own stylesheet comes with the safari and goes with it
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = new URL('./safari.css', import.meta.url).href;
  document.head.appendChild(css);
  await new Promise((res) => { css.onload = css.onerror = res; setTimeout(res, 1500); });

  const mod = await import(`./routes/${route}.js`);
  const R = mod.ROUTE;
  const scene = new THREE.Scene();
  const keepers = [];
  const keep = (x) => { keepers.push(x); return x; };
  const world = R.build({ scene, tod, keep, THREE });
  const P = world.palette || R.palette[tod] || R.palette.day;
  const dark = tod === 'night' || tod === 'dusk' || tod === 'dawn';

  scene.fog = new THREE.Fog(srgb(P.fog), P.near, P.far);
  makeSky(scene, P, tod === 'night');
  scene.add(new THREE.AmbientLight(srgb(P.horizon), P.amb ?? 0.2));
  scene.add(new THREE.HemisphereLight(srgb(P.hemi[0]), srgb(P.hemi[1]), P.hemi[2]));
  const sun = new THREE.DirectionalLight(srgb(P.sun[0]), P.sun[1]);
  sun.position.set(...P.sun[2]).multiplyScalar(120);
  scene.add(sun);                                        // fixed: no moving sun, no moving shadows

  const rig = makeRig({ route: { ...R, path: world.path, speedAt: world.speedAt }, scene, aspect: innerWidth / Math.max(1, innerHeight) });
  // at night the van's own light is all there is: two headlights, and a torch that follows the lens
  if (tod === 'night' || tod === 'dusk') {
    [-0.85, 0.85].forEach((x) => {
      const l = new THREE.SpotLight(0xfff0cf, tod === 'night' ? 90 : 40, 85, 0.5, 0.55, 1.4);
      l.position.set(x, 1.1, -2.1); l.target.position.set(x * 1.6, -0.6, -26);
      rig.rig.add(l, l.target);
    });
    const torch = new THREE.SpotLight(0xe8f2ff, tod === 'night' ? 70 : 28, 110, 0.32, 0.7, 1.3);
    torch.position.set(0, 0, 0); torch.target.position.set(0, 0, -30);
    rig.camera.add(torch, torch.target);
  }

  // the HUD hangs in the body, not in the stage: the stage's own canvas rules are not meant for it
  const hud = createHud({ route: R, tod, film: FILM, pellets: PELLETS, on: {
    exit: () => (S.shots.length && !S.over ? finish() : leave()),
    feed: () => { audio.start(); throwFeed(); },
    mute: () => { audio.start(); hud.setMuted(audio.mute(!audio.muted)); },
  } });
  const audio = createAudio({ ambience: world.ambience, muted: mutedByDefault() });
  hud.setMuted(audio.muted);
  const store = localStore();

  // ---- state
  const S = { film: FILM, pellets: PELLETS, shots: [], t: 0, last: 0, paused: false, over: false, dead: false, pending: false, dragging: 0 };
  const pellets = [];
  const pelletGeo = keep(new THREE.SphereGeometry(0.16, 8, 6));
  const pelletMat = keep(new THREE.MeshStandardMaterial({ color: 0xd9b36a, emissive: dark ? 0x3a2a10 : 0x000000, roughness: 0.8 }));

  let lastBump = 0;
  // one creature call at a time is plenty: more and the range sounds like a zoo
  let lastCall = -5;
  const callFor = (c, why) => {
    if (!audio.live || S.t - lastCall < 0.9) return;
    lastCall = S.t;
    c.photoPoint(vA);
    rig.worldHead(vB);
    const d = vA.clone().sub(vB).applyQuaternion(rig.rig.quaternion.clone().invert());
    const call = c.species.call || {};
    audio.call({ x: d.x, y: d.y, z: -d.z, hz: (call.hz || 700) * (why === 'flee' ? 1.3 : 1), kind: why === 'eat' ? 'noise' : (call.kind || 'chirp'), vol: why === 'rare' ? 0.6 : 0.4 });
  };

  function throwFeed() {
    if (S.pellets <= 0 || S.over) return;
    S.pellets--; hud.setPellets(S.pellets);
    const m = new THREE.Mesh(pelletGeo, pelletMat);
    rig.worldHead(m.position);
    rig.lookDir(vA);
    const v = vA.clone().multiplyScalar(17).add(new THREE.Vector3(0, 5, 0));
    m.position.addScaledVector(vA, 1.2);
    scene.add(m);
    pellets.push({ mesh: m, pos: m.position, vel: v, landed: false, eaten: false, born: S.t });
    audio.throwPellet();
    hud.say('Feed', 'thrown');
  }

  function stepPellets(dt) {
    for (let i = pellets.length - 1; i >= 0; i--) {
      const p = pellets[i];
      if (!p.landed) {
        p.vel.y -= 11 * dt;
        p.pos.addScaledVector(p.vel, dt);
        const g = world.groundY(p.pos.x, p.pos.z);
        if (p.pos.y <= g + 0.16) { p.pos.y = g + 0.16; p.landed = true; p.landedAt = S.t; }
      } else if (p.eaten) {
        p.mesh.scale.multiplyScalar(Math.max(0, 1 - dt * 6));
      }
      const old = S.t - p.born > 40 || (p.eaten && p.mesh.scale.x < 0.05);
      if (old) { scene.remove(p.mesh); pellets.splice(i, 1); }
    }
  }

  // ---- the shot: judged on what the lens had, then grabbed off the canvas after the next render
  function shoot() {
    if (S.over || S.pending) return;
    if (S.film <= 0) { hud.say('No film', 'the run is nearly over'); return; }
    S.pending = true;
  }
  function takeShot() {
    S.pending = false;
    const shot = judge({ camera: rig.camera, creatures: world.creatures, colliders: world.colliders, aspect: rig.camera.aspect });
    shot.thumb = grab(renderer.domElement);
    S.film--; hud.setFilm(S.film, FILM);
    hud.flash(); audio.shutter();
    S.shots.push(shot);
    hud.addShot(shot);
    hud.say(shot.points ? `+${shot.points}` : '0', shot.best ? `${shot.best.species.name} · ${verdict(shot)}` : 'nothing in frame');
    if (!S.film) hud.help('Last frame used. The report comes at the end of the drive.');
  }

  // ---- the loop. The van is placed first, then the creatures react to where it now is, then the
  // picture is drawn: that way nothing ever reads a position from the frame before.
  const env = { camPos: new THREE.Vector3(), t: 0, tod, pellets, call: callFor, dist: 0 };
  let poi = null;
  function frame(now) {
    const dt = S.last ? Math.min(0.08, (now - S.last) / 1000) : 0.016;
    S.last = now;
    S.t += dt; env.t = S.t;

    const speed = rig.step(dt, reduceMotion() ? null : poi);
    rig.worldHead(env.camPos);
    // what the lens drifts towards next: the nearest creature worth a look, else the route's own point
    let poiD = 80;
    poi = null;
    for (const c of world.creatures) {
      c.photoPoint(vA);
      const d = vA.distanceTo(env.camPos);
      c.near = d;
      c.visible = d < 170;
      c.root.visible = c.visible;
      if (c.visible) { env.dist = d; c.step(dt, env); }
      if (d < poiD && d > 7) { poiD = d; poi = c.photoPoint(new THREE.Vector3()); }
    }
    if (!poi && world.poi) poi = world.poi(rig.progress);
    stepPellets(dt);
    audio.drive(speed);
    if (rig.state.bump > lastBump + 0.18) audio.bump(Math.min(1, rig.state.bump));   // only the new jolts make a sound
    lastBump = rig.state.bump;
    hud.progress(rig.progress);

    renderer.render(scene, rig.camera);
    if (S.pending) takeShot();
    if (rig.done && !S.over) finish();
  }

  async function finish() {
    if (S.over) return;
    S.over = true;
    audio.drive(0, 0);
    await hud.report({
      shots: S.shots, route: R, tod, store,
      onDone: () => leave(),
      onAgain: () => leave({ again: true }),
    });
  }

  function leave(opts = {}) {
    if (S.dead) return;
    onExit(opts);
  }

  // ---- input: the HUD element is on top of everything, so the station never sees any of it
  const abort = new AbortController(), sig = { signal: abort.signal };
  const el = hud.root;
  const pointers = new Map();
  let downAt = null, pinch = 0, fov0 = 0, moved = 0;
  el.addEventListener('pointerdown', (ev) => {
    if (S.over) return;
    audio.start();
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    el.setPointerCapture(ev.pointerId);
    if (pointers.size === 1) { downAt = { x: ev.clientX, y: ev.clientY, t: performance.now() }; moved = 0; }
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); fov0 = rig.state.fov; }
  }, sig);
  el.addEventListener('pointermove', (ev) => {
    if (!pointers.has(ev.pointerId)) {                 // desktop: the view follows the mouse near the edges
      if (ev.pointerType === 'mouse' && !S.over) edge(ev);
      return;
    }
    const prev = pointers.get(ev.pointerId);
    if (pointers.size === 1) {
      rig.drag(ev.clientX - prev.x, ev.clientY - prev.y, el.clientHeight);
      moved += Math.hypot(ev.clientX - prev.x, ev.clientY - prev.y);
    }
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      hud.setZoom(rig.setZoom(fov0 * pinch / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))), FOV.wide);
    }
  }, sig);
  const up = (ev) => {
    const had = pointers.delete(ev.pointerId);
    if (!had || S.over) { downAt = null; return; }
    // a short press that did not travel is the shutter; a drag only looks
    if (pointers.size === 0 && downAt && moved < 9 && performance.now() - downAt.t < 700) shoot();
    downAt = null;
  };
  el.addEventListener('pointerup', up, sig);
  el.addEventListener('pointercancel', (ev) => { pointers.delete(ev.pointerId); downAt = null; }, sig);
  el.addEventListener('wheel', (ev) => { ev.preventDefault(); hud.setZoom(rig.zoom(Math.exp(ev.deltaY * 0.0012)), FOV.wide); }, { passive: false, signal: abort.signal });
  el.addEventListener('contextmenu', (ev) => ev.preventDefault(), sig);
  function edge(ev) {
    const w = el.clientWidth, h = el.clientHeight, mx = ev.clientX / w, my = ev.clientY / h;
    const k = (v, a, b) => (v < a ? (v - a) / a : v > b ? (v - b) / (1 - b) : 0);
    const dx = k(mx, 0.12, 0.88), dy = k(my, 0.14, 0.86);
    if (dx || dy) rig.nudge(dx * 0.035, -dy * 0.025);
  }
  window.addEventListener('keydown', (ev) => {
    if (ev.target.closest && ev.target.closest('input, textarea')) return;
    const k = ev.key;
    if (k === 'Escape') { ev.stopImmediatePropagation(); ev.preventDefault(); S.over ? leave() : finish(); return; }
    if (S.over) return;
    if (k === ' ' || k === 'Spacebar') { ev.preventDefault(); ev.stopImmediatePropagation(); audio.start(); shoot(); }
    else if (k === 'f' || k === 'F') { ev.stopImmediatePropagation(); audio.start(); throwFeed(); }
    else if (k === 'm' || k === 'M') { ev.stopImmediatePropagation(); hud.setMuted(audio.mute(!audio.muted)); }
    else if (k.startsWith('Arrow')) {
      ev.preventDefault(); ev.stopImmediatePropagation();
      rig.nudge(k === 'ArrowLeft' ? -0.12 : k === 'ArrowRight' ? 0.12 : 0, k === 'ArrowUp' ? 0.09 : k === 'ArrowDown' ? -0.09 : 0);
    } else if (k === '+' || k === '=') { hud.setZoom(rig.zoom(0.85), FOV.wide); }
    else if (k === '-' || k === '_') { hud.setZoom(rig.zoom(1.18), FOV.wide); }
  }, { capture: true, signal: abort.signal });

  // the safari rests with the tab (Global rule 1)
  const onVis = () => (document.hidden ? pause(true) : pause(false));
  document.addEventListener('visibilitychange', onVis, sig);
  const onResize = () => rig.resize(host.clientWidth / Math.max(1, host.clientHeight));
  window.addEventListener('resize', onResize, sig);

  function pause(on) {
    if (S.dead || on === S.paused) return;
    S.paused = on;
    if (on) { renderer.setAnimationLoop(null); audio.suspend(); }
    else { S.last = 0; renderer.setAnimationLoop(frame); audio.resume(); }
  }

  // ---- hand the renderer over: the station has already stopped its own loop
  const prev = { clear: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(), ratio: renderer.getPixelRatio() };
  renderer.setClearColor(srgb(P.fog), 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35));
  renderer.setSize(host.clientWidth, host.clientHeight, false);
  rig.resize(host.clientWidth / Math.max(1, host.clientHeight));
  hud.setZoom(rig.state.fov, FOV.wide);
  renderer.setAnimationLoop(frame);

  return {
    route: R, tod,
    state: () => ({ u: rig.progress, film: S.film, pellets: S.pellets, shots: S.shots.length,
      points: S.shots.reduce((n, s) => n + s.points, 0), over: S.over, paused: S.paused,
      species: new Set(S.shots.filter((s) => s.best).map((s) => s.best.species.id)).size }),
    // test hooks: drive the run on without waiting two minutes
    skipTo: (u) => { rig.state.u = Math.max(rig.state.u, Math.min(0.999, u)); },
    shots: () => S.shots,
    aimAt: (p) => rig.aimAt(p),
    shoot, feed: throwFeed, finish,
    hud, rig, scene, world,
    dispose() {
      if (S.dead) return;
      S.dead = true;
      abort.abort();
      renderer.setAnimationLoop(null);
      hud.dispose();
      audio.dispose();
      css.remove();
      // give every geometry, material and texture back (Global rule 1)
      scene.traverse((o) => {
        if (o.isMesh || o.isPoints || o.isInstancedMesh) {
          o.geometry && o.geometry.dispose();
          for (const m of [].concat(o.material || [])) {
            for (const k of ['map', 'normalMap', 'roughnessMap', 'emissiveMap', 'alphaMap', 'aoMap']) if (m[k]) m[k].dispose();
            m.dispose();
          }
        }
        if (o.isLight && o.dispose) o.dispose();
      });
      keepers.forEach((k) => k && k.dispose && k.dispose());
      scene.clear();
      renderer.setClearColor(prev.clear, prev.alpha);
      renderer.setPixelRatio(prev.ratio);
      renderer.setSize(host.clientWidth, host.clientHeight, false);
      renderer.renderLists.dispose();
    },
  };
}
