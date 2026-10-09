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
// brings the camera, the scoring, the sound and the HUD. A route with water (`under`, `dive`) also
// gets the submersible: the hatches, the lamps, the tinted fog and the muffled sound.
import * as THREE from 'three';
import { makeRig, FOV } from './rig.js';
import { createHud } from './hud.js';
import { createAudio, mutedByDefault } from './audio.js';
import { judge, verdict, grab } from './photo.js';
import { localStore } from './leaderboard.js';
import { survey, record } from './fieldlog.js';
import { chunkScenery } from './terrain.js';

const FILM = 30, PELLETS = 8;
const vA = new THREE.Vector3(), vB = new THREE.Vector3();
const frustum = new THREE.Frustum(), mView = new THREE.Matrix4(), ball = new THREE.Sphere();
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
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe7ff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
  stars.frustumCulled = false;
  scene.add(stars);
  return dome;
}

export async function startSafari({ renderer, route = 'canyon', tod = 'day', host = document.body, onExit = () => {} } = {}) {
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
  // route-long instance sets in culled chunks: only where the fog closes the view in (the jungle);
  // in the open canyon nearly every chunk would be in view, so it would only add draw calls
  const scenery = chunkScenery(scene, P.far < 400 ? 150 : Infinity);

  scene.fog = new THREE.Fog(srgb(P.fog), P.near, P.far);
  const sky = makeSky(scene, P, tod === 'night');
  const stars = scene.children[scene.children.length - 1].isPoints ? scene.children[scene.children.length - 1] : null;
  // below the surface (a route with water hands over `under`): its own fog, no sky, muffled sound
  const U = world.under || null;
  const fogAir = srgb(P.fog), fogSea = U ? srgb(U.fog) : fogAir;
  scene.add(new THREE.AmbientLight(srgb(P.horizon), P.amb ?? 0.2));
  scene.add(new THREE.HemisphereLight(srgb(P.hemi[0]), srgb(P.hemi[1]), P.hemi[2]));
  const sun = new THREE.DirectionalLight(srgb(P.sun[0]), P.sun[1]);
  sun.position.set(...P.sun[2]).multiplyScalar(120);
  scene.add(sun);                                        // fixed: no moving sun, no moving shadows

  const rig = makeRig({ route: { ...R, path: world.path, speedAt: world.speedAt, swayAt: world.swayAt }, scene, aspect: innerWidth / Math.max(1, innerHeight) });
  // at night the van's own light is all there is: two headlights, and a torch that follows the lens
  if (tod === 'night' || tod === 'dusk') {
    [-0.85, 0.85].forEach((x) => {
      // aimed long and soft, so the pool of light lies out on the road ahead instead of flooding the
      // ground right under the lens
      const l = new THREE.SpotLight(0xfff0cf, tod === 'night' ? 38 : 12, 90, 0.42, 0.85, 1.2);
      l.position.set(x, 1.1, -2.1); l.target.position.set(x * 1.6, -0.2, -40);
      rig.rig.add(l, l.target);
    });
    const torch = new THREE.SpotLight(0xdfe6f2, tod === 'night' ? 30 : 14, 110, 0.32, 0.7, 1.3);
    torch.position.set(0, 0, 0); torch.target.position.set(0, 0, -30);
    rig.camera.add(torch, torch.target);
  }
  // the submersible's lamps: off until the hatches close, then a wide pair that follows the lens
  const lamps = [];
  if (world.dive) {
    [-0.7, 0.7].forEach((x) => {
      const l = new THREE.SpotLight(0xcfeeff, 0, 60, 0.62, 0.6, 1.2);
      l.position.set(x, -0.3, 0); l.target.position.set(x * 2, -1.5, -20);
      rig.camera.add(l, l.target);
      lamps.push(l);
    });
  }

  // the HUD hangs in the body, not in the stage: the stage's own canvas rules are not meant for it
  const hud = createHud({ route: R, tod, film: FILM, pellets: PELLETS, on: {
    exit: () => quit(),
    feed: () => { audio.start(); throwFeed(); },
    mute: () => { audio.start(); hud.setMuted(audio.mute(!audio.muted)); },
  } });
  const audio = createAudio({ ambience: world.ambience, muted: mutedByDefault() });
  hud.setMuted(audio.muted);
  const store = localStore();
  survey(R, world.creatures);                           // the van's field log learns what this route has

  // ---- state
  const S = { film: FILM, pellets: PELLETS, shots: [], t: 0, last: 0, paused: false, over: false, dead: false, pending: false,
    under: 0, diving: false, section: -1, fresh: 0 };
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

  // the bed on its own is just wind: now and then something calls from somewhere out in the range
  // (birds by day, insects after dark). Nothing is scheduled ahead, so a pause costs nothing.
  const AMBIENT = {
    day: { every: 4.5, kind: 'chirp', hz: 1500, vol: 0.18 },
    dawn: { every: 3.2, kind: 'trill', hz: 1700, vol: 0.22 },
    dusk: { every: 4.0, kind: 'hoot', hz: 420, vol: 0.2 },
    night: { every: 2.6, kind: 'chirp', hz: 3400, vol: 0.12 },
  };
  let nextAmbient = 3;
  function stepAmbient() {
    if (!audio.live || S.t < nextAmbient) return;
    // a route can swap the calls for a stretch (bubbles under water, gulls over the estuary)
    const a = (world.ambient && world.ambient(rig.progress, tod, S.under)) || AMBIENT[tod] || AMBIENT.day;
    nextAmbient = S.t + a.every * (0.6 + Math.random());
    const ang = Math.random() * Math.PI * 2, r = 8 + Math.random() * 30;
    audio.call({ x: Math.cos(ang) * r, y: 2 + Math.random() * 10, z: Math.sin(ang) * r, hz: a.hz * (0.85 + Math.random() * 0.3), kind: a.kind, vol: a.vol });
  }

  function throwFeed() {
    if (S.pellets <= 0 || S.over) return;
    S.pellets--; hud.setPellets(S.pellets);
    const m = new THREE.Mesh(pelletGeo, pelletMat);
    rig.worldHead(m.position);
    rig.lookDir(vA);
    // under water the throw is short and the feed sinks; in the air it arcs out
    const v = S.under > 0.5 ? vA.clone().multiplyScalar(6).add(new THREE.Vector3(0, 0.5, 0)) : vA.clone().multiplyScalar(17).add(new THREE.Vector3(0, 5, 0));
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
        // the medium the pellet is in: water slows it right down (it sinks), unless the route lets
        // feed float (`world.floats`, the estuary), then it rides on the surface
        const wy = world.waterY ? world.waterY(p.pos.x, p.pos.z) : -Infinity;
        const wet = p.pos.y < wy;
        if (wet && world.floats && !p.sunk) { p.pos.y = wy; p.landed = true; p.landedAt = S.t; p.floating = true; continue; }
        if (wet) { p.vel.multiplyScalar(Math.max(0, 1 - dt * 3.5)); p.vel.y -= 1.1 * dt; p.vel.y = Math.max(p.vel.y, -1.4); p.sunk = true; }
        else p.vel.y -= 11 * dt;
        p.pos.addScaledVector(p.vel, dt);
        const g = world.groundY(p.pos.x, p.pos.z);
        if (p.pos.y <= g + 0.16) { p.pos.y = g + 0.16; p.landed = true; p.landedAt = S.t; }
      } else if (p.floating && !p.eaten) {
        const wy = world.waterY(p.pos.x, p.pos.z);
        p.pos.y = wy + Math.sin(S.t * 2.2 + p.born) * 0.05;           // bobs on the swell
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
    const fresh = record(R.id, shot);
    if (fresh) S.fresh++;
    hud.say(shot.points ? `+${shot.points}` : '0', shot.best ? `${shot.best.species.name} · ${fresh ? 'new in the field log' : verdict(shot)}` : 'nothing in frame');
    if (!S.film) hud.help('Last frame used. The report comes at the end of the drive.');
  }

  // ---- the loop. The van is placed first, then the creatures react to where it now is, then the
  // picture is drawn: that way nothing ever reads a position from the frame before.
  const env = { camPos: new THREE.Vector3(), t: 0, tod, pellets, call: callFor, dist: 0, under: 0, u: 0 };
  let poi = null;
  function frame(now) {
    const dt = S.last ? Math.min(0.08, (now - S.last) / 1000) : 0.016;
    S.last = now;
    S.t += dt; env.t = S.t;

    const speed = rig.step(dt, reduceMotion() ? null : poi);
    rig.worldHead(env.camPos);
    sky.position.copy(env.camPos);                     // the sky travels with the lens (a long route would leave it behind)
    if (stars) stars.position.copy(env.camPos);
    env.u = rig.progress;
    stepMedium(dt);
    if (world.update) world.update(dt, env);
    scenery.cull(env.camPos, scene.fog.far * 1.05);
    // what the lens drifts towards next: the nearest creature worth a look, else the route's own point
    let poiD = 80;
    poi = null;
    // what the lens can see this frame: animals outside it keep living but are not drawn (their
    // bodies are many small draws, so this is most of the saving); flocks spread wide, so they stay
    rig.camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(mView.multiplyMatrices(rig.camera.projectionMatrix, rig.camera.matrixWorldInverse));
    for (const c of world.creatures) {
      c.photoPoint(vA);
      const d = vA.distanceTo(env.camPos);
      c.near = d;
      c.visible = d < (c.seeAt || 170);
      ball.set(vA, (c.radius || 1) * 2.5 + 1.5);
      c.root.visible = c.visible && (c.flock || d < 6 || frustum.intersectsSphere(ball));
      if (c.lod) c.lod(d);
      if (c.visible) { env.dist = d; c.step(dt, env); }
      if (d < poiD && d > 7) { poiD = d; poi = c.photoPoint(new THREE.Vector3()); }
    }
    if (!poi && world.poi) poi = world.poi(rig.progress);
    stepPellets(dt);
    stepAmbient();
    audio.drive(speed);
    if (rig.state.bump > lastBump + 0.18) audio.bump(Math.min(1, rig.state.bump));   // only the new jolts make a sound
    lastBump = rig.state.bump;
    hud.progress(rig.progress);

    renderer.render(scene, rig.camera);
    if (S.pending) takeShot();
    adapt(now);
    if (rig.done && !S.over) finish();
  }

  // ---- the frame rate: slow phones get fewer pixels instead of a stutter. Every two seconds the
  // average frame time is checked; above ~34 ms (under 30 fps) the pixel ratio steps down, and
  // with plenty of headroom it steps back up, never past the starting ratio.
  const RES = { top: Math.min(window.devicePixelRatio, 1.35), min: 0.6, t0: 0, n: 0 };
  RES.ratio = RES.top;
  function adapt(now) {
    if (!RES.t0) { RES.t0 = now; RES.n = 0; return; }
    RES.n++;
    if (now - RES.t0 < 2000) return;
    const ms = (now - RES.t0) / RES.n;
    RES.t0 = now; RES.n = 0;
    let r = RES.ratio;
    if (ms > 34) r = Math.max(RES.min, r * 0.85);
    else if (ms < 20) r = Math.min(RES.top, r * 1.1);
    if (Math.abs(r - RES.ratio) < 0.01) return;
    RES.ratio = r;
    renderer.setPixelRatio(r);
    renderer.setSize(host.clientWidth, host.clientHeight, false);
  }

  // ---- the medium and the stretches of the route. The dive is announced a moment before the van
  // touches the water, so the hatches are shut by the time the surface closes over the lens.
  function stepMedium(dt) {
    const u = rig.progress;
    if (world.dive) {
      const [u0, u1] = world.dive;
      const inside = u > u0 - 0.012 && u < u1;
      if (inside !== S.diving) {
        S.diving = inside;
        hud.dive(inside);
        audio.call({ x: 0, y: -1, z: 0, hz: inside ? 180 : 260, kind: 'noise', vol: 0.5 });
      }
      lamps.forEach((l) => { l.intensity += ((S.diving ? 70 : 0) - l.intensity) * Math.min(1, dt * 3); });
    }
    const wy = world.waterY ? world.waterY(env.camPos.x, env.camPos.z) : -Infinity;
    const want = U && env.camPos.y < wy ? 1 : 0;
    S.under += (want - S.under) * Math.min(1, dt * 5);
    if (Math.abs(S.under - want) < 0.002) S.under = want;
    env.under = S.under;
    if (U) {
      const k = S.under;
      scene.fog.color.copy(fogAir).lerp(fogSea, k);
      scene.fog.near = THREE.MathUtils.lerp(P.near, U.near, k);
      scene.fog.far = THREE.MathUtils.lerp(P.far, U.far, k);
      renderer.setClearColor(scene.fog.color, 1);
      sky.visible = k < 0.5;
      if (stars) stars.visible = k < 0.5;
      hud.under(k);
      audio.muffle(k);
    }
    if (world.sections) {
      let i = -1;
      world.sections.forEach((s, k) => { if (u >= s.u) i = k; });
      if (i !== S.section) { S.section = i; if (i >= 0 && world.sections[i].title) hud.title(world.sections[i].title, world.sections[i].line); }
    }
  }

  async function finish() {
    if (S.over) return;
    S.over = true;
    audio.drive(0, 0);
    await hud.report({
      shots: S.shots, route: R, tod, store, fresh: S.fresh,
      onDone: () => leave(),
      onAgain: () => leave({ again: true }),
    });
  }

  function leave(opts = {}) {
    if (S.dead) return;
    onExit(opts);
  }
  // Exit and Esc: with photos in the bag the run ends in the report, otherwise straight back to the van
  const quit = () => (!S.over && S.shots.length ? finish() : leave());

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
    const t = ev.target;
    if (t && t.closest && t.closest('input, textarea, .sf-report')) return;      // the report has its own keys
    const k = ev.key;
    if ((k === ' ' || k === 'Enter') && t && t.closest && t.closest('button')) return;   // a focused button acts
    if (k === 'Escape') { ev.stopImmediatePropagation(); ev.preventDefault(); quit(); return; }
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
    else { S.last = 0; RES.t0 = 0; renderer.setAnimationLoop(frame); audio.resume(); }
  }

  // ---- hand the renderer over: the station has already stopped its own loop
  const prev = { clear: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(), ratio: renderer.getPixelRatio() };
  renderer.setClearColor(srgb(P.fog), 1);
  renderer.setPixelRatio(RES.ratio);
  renderer.setSize(host.clientWidth, host.clientHeight, false);
  rig.resize(host.clientWidth / Math.max(1, host.clientHeight));
  hud.setZoom(rig.state.fov, FOV.wide);
  renderer.setAnimationLoop(frame);

  return {
    route: R, tod,
    state: () => ({ u: rig.progress, ratio: +RES.ratio.toFixed(2), film: S.film, pellets: S.pellets, shots: S.shots.length,
      points: S.shots.reduce((n, s) => n + s.points, 0), over: S.over, paused: S.paused,
      species: new Set(S.shots.filter((s) => s.best).map((s) => s.best.species.id)).size }),
    // test hooks: drive the run on without waiting two minutes
    skipTo: (u) => { rig.state.u = Math.max(rig.state.u, Math.min(0.999, u)); },
    shots: () => S.shots,
    aimAt: (p) => rig.aimAt(p),
    shoot, feed: throwFeed, finish,
    stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, ratio: RES.ratio }),
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
        if (o.isInstancedMesh) o.dispose();           // its instance buffers
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
