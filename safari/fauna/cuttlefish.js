// The flamboyant cuttlefish (FEAT-014): a small cuttlefish that walks over the floor of the canyon's
// deep pool while waves of colour run over its body.
//
//   flamboyant-cuttlefish   larger than life like the frogs and the ants (5× real size): about 38 cm
//                from the arm tips to the end of the mantle. A broad oval mantle with small knobs on its
//                back and a wavy fin all round its edge, a short head with big eyes (W-shaped pupils),
//                eight short arms, the lowest pair wider: it "walks" on that pair and on two flaps under
//                the back of its mantle instead of swimming, the fin rippling along its sides. Colours:
//                a dark brown base with waves of white, bright yellow and purple-red running from head
//                to tail, the fin's edge yellow, the arm tips purple-red. As the van passes close it
//                flashes brighter and raises its front arms. Rare pose (about half the runs, its own
//                roll): the full warning display, all arms raised into a crown, the flaps spread, the
//                colour pulsing fast. Night: it sits still on the floor, its colour waves pulsing slowly
//                with the glow, a faintly flashing spot in the dark water.
//
// The twist: the colour waves glow faintly (barely by day, clearly at night). The waves are one cheap
// shader on the skin (the pattern follows the body's own length, worked out per pixel), so the whole
// animal is a handful of draws: body, fin, head, arms, eyes.
import * as THREE from 'three';

export const SPECIES = {
  'flamboyant-cuttlefish': { id: 'flamboyant-cuttlefish', name: 'Flamboyant cuttlefish', points: 230, call: { hz: 900, kind: 'chirp' } },
};

const PI = Math.PI, TAU = PI * 2;
const LEN = 0.38;                                          // m, the arm tips to the end of the mantle
const damp = (a, b, k, dt) => a + (b - a) * Math.min(1, k * dt);
const clamp = THREE.MathUtils.clamp;
const vA = new THREE.Vector3();
const FLASH_AT = 8;                                         // m: the van this close, it flashes and raises its front arms
const SHOW_AT = 26;                                         // m: in a run with the display, it starts from this close
const SHOW = 6.5;                                           // s the display lasts

// ---------------------------------------------------------------- the skin
// One standard material with the colour waves added: the pattern is worked out from where a point
// sits along the body (`vCfRoot`, the animal's own frame, head +z), so it runs head to tail over the
// mantle, the head and the arms alike. `uPhase` moves the waves (the step sets its speed: slow at
// night, fast in the display), `uFlash` brightens them, `uGlow` is their own light. The fin also
// ripples in the vertex shader (`uFin`), its edge yellow; the arm tips are purple-red.
function skin(K, U, kind) {
  const m = K.keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: kind === 'fin' ? 0.45 : 0.55, metalness: 0, side: kind === 'fin' ? THREE.DoubleSide : THREE.FrontSide }));
  m.customProgramCacheKey = () => 'cuttle-' + kind;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform mat4 uRootInv; uniform float uFin;
        varying vec3 vCfRoot; varying vec2 vCfUv;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        ${kind === 'fin' ? 'transformed.y += sin(uv.x * 6.2832 * 9.0 - uFin) * 0.045 * uv.y * uv.y;' : ''}`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vCfRoot = (uRootInv * modelMatrix * vec4(transformed, 1.0)).xyz; vCfUv = uv;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uPhase, uFlash, uGlow, uLen;
        uniform vec3 uBrown, uWhite, uYellow, uRed;
        varying vec3 vCfRoot; varying vec2 vCfUv;
        float cfLit;
        vec3 cfPattern() {
          float s = vCfRoot.z / uLen;                                       // head +0.5 .. tail -0.5
          float x = vCfRoot.x / uLen;
          float p = s * 1.9 + uPhase + sin(x * 9.0 + s * 5.0) * 0.12 + sin(x * 23.0 - s * 7.0) * 0.04;
          float w = fract(p);
          // the waves break up into patches as they travel (strongest along the middle of the back)
          float pa = 0.55 + 0.45 * sin(x * 21.0 + s * 6.0 + floor(p) * 2.3) * sin(s * 13.0 - x * 8.0 + floor(p) * 1.7);
          pa = clamp(pa * 1.3 + 0.15, 0.0, 1.0);
          float bw = smoothstep(0.50, 0.55, w) * (1.0 - smoothstep(0.59, 0.64, w)) * pa;
          float by = smoothstep(0.59, 0.64, w) * (1.0 - smoothstep(0.70, 0.75, w));
          float br = smoothstep(0.70, 0.75, w) * (1.0 - smoothstep(0.82, 0.9, w)) * (0.4 + 0.6 * pa);
          vec3 c = uBrown;
          c = mix(c, uWhite, bw); c = mix(c, uYellow, by); c = mix(c, uRed, br);
          ${kind === 'fin' ? 'c = mix(c, uYellow, smoothstep(0.35, 1.0, vCfUv.y) * 0.75);' : ''}
          ${kind === 'arm' ? 'c = mix(c, uRed * 1.15, smoothstep(0.35, 1.0, vCfUv.x) * 0.7);' : ''}
          // a fine speckle, so the skin doesn't read as plastic
          float n = fract(sin(dot(floor(vCfRoot * 160.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          c *= 0.86 + 0.26 * n;
          cfLit = bw * 0.8 + by + br * 0.75${kind === 'fin' ? ' + smoothstep(0.5, 1.0, vCfUv.y) * 0.35' : ''};
          return mix(c, min(c * 1.7 + 0.03, vec3(1.0)), uFlash * cfLit);
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb = cfPattern();`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * cfLit * uGlow;`);
  };
  return m;
}

// the fin: a band round the mantle's edge (the oval a × b about z0), open at the head; uv.x runs
// round it, uv.y from where it joins the body (0) to its edge (1)
function finGeo(a, b, z0, width, gap) {
  const N = 72, pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = gap + (i / N) * (TAU - 2 * gap);               // 0 points to the head (+z)
    const x = Math.sin(t) * a, z = Math.cos(t) * b;
    let nx = Math.sin(t) / a, nz = Math.cos(t) / b;
    const l = Math.hypot(nx, nz); nx /= l; nz /= l;
    const taper = Math.min(1, (t - gap) / 0.5, (TAU - gap - t) / 0.5);     // narrows to nothing at the head
    for (let j = 0; j <= 2; j++) {
      const k = j / 2, w = width * taper * k;
      pos.push(x * 0.96 + nx * w, -0.01 - k * 0.012, z0 + z * 0.96 + nz * w);
      uv.push(i / N, k);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < 2; j++) {
    const a0 = i * 3 + j, b0 = a0 + 3;
    idx.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// =============================================================================================
// The cuttlefish. Built in its own unit (1 = LEN), the near body scaled down to size. opts:
//   path   [a, b]: the ends of the short line it walks along the floor (day; it starts at `a`, walking
//          towards `b`, the way the van comes from)
//   yaw    its heading at the start
//   keep   (x, z) => false where it must not walk (the middle of the van's track)
export function buildCuttlefish(K, home, opts = {}) {
  const night = K.night;
  const col = (h) => new THREE.Color(h);
  const U = {
    uRootInv: { value: new THREE.Matrix4() }, uPhase: { value: Math.random() * 4 }, uFin: { value: 0 },
    uFlash: { value: 0 }, uGlow: { value: 0 }, uLen: { value: LEN },
    uBrown: { value: col(0x3b2417) }, uWhite: { value: col(0xefe9da) }, uYellow: { value: col(0xf2c418) }, uRed: { value: col(0xa3264f) },
  };
  const body = skin(K, U, 'body'), fin = skin(K, U, 'fin'), arm = skin(K, U, 'arm');
  const eyeM = K.sheen(0x8c7d43, { roughness: 0.2 }), pupilM = K.sheen(0x0a0806, { roughness: 0.15 });

  const root = K.group(), near = K.group(null, root), far = K.group(null, root);
  near.scale.setScalar(LEN);
  K.shadow(root, 0.13, 0.19, 0.02);

  // ---- the mantle: a broad, low oval, small knobs over the back, the wavy fin round its edge
  const B = K.group([0, 0.2, 0], near);
  K.mesh(K.sphere(1, 20, 12), body, [0, 0, -0.1], B, null, [0.25, 0.14, 0.4]);
  K.mesh(K.sphere(1, 12, 8), body, [0, -0.045, -0.06], B, null, [0.21, 0.08, 0.33]);    // the flatter belly
  const knob = K.cone(1, 1, 5);
  for (let i = 0; i < 14; i++) {
    const t = (i * 0.618) % 1, side = i % 2 ? 1 : -1;
    const z = -0.42 + t * 0.6, x = side * (0.04 + ((i * 0.37) % 1) * 0.13);
    const y = 0.14 * Math.sqrt(Math.max(0, 1 - (x / 0.25) ** 2 - ((z + 0.1) / 0.4) ** 2));
    K.mesh(knob, body, [x, y - 0.004, z], B, [-0.1, 0, side * 0.2], [0.014, 0.03, 0.014]);
  }
  K.mesh(K.geo('cf-fin', () => finGeo(0.25, 0.4, -0.1, 0.08, 0.55)), fin, [0, 0, 0], B);
  // the two flaps under the back of the mantle it pushes off with
  const flapGeo = K.geo('cf-flap', () => new THREE.SphereGeometry(1, 10, 6).translate(0, -1, 0));
  const flaps = [-1, 1].map((s) => {
    const g = K.group([s * 0.13, -0.07, -0.24], B);
    K.mesh(flapGeo, body, [0, 0, 0], g, null, [0.022, 0.075, 0.07]);
    return { g, s };
  });

  // ---- the head: short and broad, big eyes high on its sides with W-shaped pupils
  const HD = K.group([0, -0.005, 0.27], B);
  K.mesh(K.sphere(1, 14, 10), body, [0, 0, 0], HD, null, [0.18, 0.12, 0.13]);
  const wGeo = K.shape('cf-w', [[-1, 0.3], [-0.5, -0.2], [0, 0.22], [0.5, -0.2], [1, 0.3], [0.95, -0.12], [0.5, -0.62], [0, -0.22], [-0.5, -0.62], [-0.95, -0.12]]);   // the wavy W-shaped pupil
  const eyes = [-1, 1].map((s) => {
    const e = K.group([s * 0.15, 0.05, -0.01], HD);
    const ball = K.mesh(K.sphere(1, 14, 10), eyeM, [0, 0, 0], e, null, [0.062, 0.058, 0.066]); ball.userData.keep = true;
    const pu = K.mesh(wGeo, pupilM, [s * 0.0605, 0.006, 0.002], e, [0, s * PI / 2, 0], [0.047, 0.05, 1]); pu.userData.keep = true;
    K.mesh(K.sphere(1, 10, 6), body, [-s * 0.012, 0.046, 0], e, null, [0.05, 0.022, 0.06]);       // the brow over it
    return e;
  });

  // ---- the arms: eight short ones in a ring at the front of the head, the lowest pair wider and
  // longer (the walking arms), each a group of its own so it can lift
  const arms = [];
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
    const th = 0.35 + k * 0.8;                                    // round from the top (0) to below (π)
    const g = K.group([s * Math.sin(th) * 0.075, Math.cos(th) * 0.07, 0.11], HD);
    const walk = k === 3, L = walk ? 0.21 : 0.16 - k * 0.01;
    const pts = walk ? [[0, 0, 0], [0, -0.01, L * 0.4], [0, -0.03, L * 0.75], [0, -0.02, L]] : [[0, 0, 0], [0, 0.01, L * 0.45], [0, -0.01, L * 0.8], [0, -0.04, L]];
    const tube = K.mesh(K.tube('cf-arm' + k, pts, walk ? 0.032 : 0.028, 0.006, 6, 10), arm, [0, 0, 0], g, null, walk ? [1.5, 0.55, 1] : [1, 1, 1]);
    tube.userData.walk = walk;
    const rest = { x: walk ? 0.55 : 0.18 + k * 0.12, y: s * (0.05 + k * 0.06), z: 0 };
    g.rotation.set(rest.x, rest.y, rest.z);
    arms.push({ g, s, k, walk, rest, th });
  }

  // ---- far: the mantle and the head, one draw
  K.mesh(K.sphere(1, 10, 7), body, [0, 0.07, -0.02], far, null, [0.1, 0.055, 0.19]);

  K.place(root, home);

  // ---- the behaviour, its own (not the shared state machine; it ignores feed, never flees):
  //   idle    standing on the floor, arms gently curling (the first while: waits for the van)
  //   wander  walking slowly along its line towards the oncoming van
  //   rare    the warning display (its own roll, about half the runs)
  //   rest    night: sitting still on the floor
  const ends = (opts.path || [home, home]).map((p) => p.clone());
  const S = { ph: 0, end: 1, flash: 0, flashT: 0, show: 0, raise: 0, sit: night ? 1 : 0, glowK: 0 };
  const c = K.makeCreature({
    species: SPECIES['flamboyant-cuttlefish'], root, home, radius: 0.21, eye: new THREE.Vector3(0, 0.08, 0.02),
    ground: K.groundY, keep: opts.keep, speed: 0.12, roam: 0, fleeAt: 0, curiousAt: 0, shy: 1, rareChance: 0, yaw: opts.yaw, poseLen: SHOW,
  });
  c.state = night ? 'rest' : 'idle';
  c.hold = 1e9;
  c.air = true;                                              // feed is not for it
  // the display is its own set piece (the route marks it `always`, so safari/poses.js leaves it be):
  // rolled here for about half of the runs, never at night
  c.poseRun = !night && Math.random() < 0.5;
  c.setShow = (on) => { c.poseRun = !!on; };                 // tests: pick the run

  c.step = (dt, env) => {
    c.t += dt;
    const d = env.dist, rp = c.root.position;
    switch (c.state) {
      case 'rest':
        break;
      case 'idle':
        if (c.hold > 1e8 && d < 120) c.hold = 0.5;
        if (c.t > c.hold) { c.target = ends[S.end]; c.go('wander', 90); }
        break;
      case 'wander': {
        const done = c.walkTo(c.target, dt);
        if (done || c.t > c.hold) { S.end = 1 - S.end; c.go('idle', 3 + Math.random() * 2); }
        else if (c.t > 6 && Math.random() < dt * 0.04) c.go('idle', 1.5 + Math.random());
        break;
      }
      case 'rare':
        c.turnTo(env.camPos.x, env.camPos.z, dt, 0.5);           // squares up to the van
        if (c.t > c.hold) c.go('idle', 3);
        break;
      default:
        c.go('idle', 2);
    }
    // the display: once, as the van comes within SHOW_AT
    if (c.poseRun && !S.shown && (c.state === 'idle' || c.state === 'wander') && d < SHOW_AT) { S.shown = true; c.go('rare', SHOW); }
    rp.y = K.groundY(rp.x, rp.z);
    pose(dt, env);
    c.root.updateMatrixWorld();
    U.uRootInv.value.copy(c.root.matrixWorld).invert();
  };

  function pose(dt, env) {
    const st = c.state, t = env.t;
    const spd = motion(dt);
    // the flash: the van close by (not at night, where it sits still and only pulses)
    if (!night && c.near !== undefined && c.near < FLASH_AT) S.flashT = 1.6;
    S.flashT = Math.max(0, S.flashT - dt);
    const showK = st === 'rare' ? clamp(c.t / 0.9, 0, 1) * clamp((c.hold - c.t) / 0.9, 0, 1) : 0;
    S.show = damp(S.show, showK, 5, dt);
    S.flash = damp(S.flash, S.flashT > 0 ? 1 : 0, S.flashT > 0 ? 5 : 1.5, dt);
    S.raise = damp(S.raise, S.flashT > 0 && st !== 'rare' ? 1 : 0, 3, dt);
    const sh = S.show;
    // the colour waves: slow at night, quicker while walking, fast in the display
    const wave = night ? 0.18 : 0.55 + clamp(spd / 0.12, 0, 1) * 0.25 + S.flash * 0.7 + sh * 2.4;
    U.uPhase.value -= dt * wave;                                  // the bands travel from the head to the tail
    U.uFin.value += dt * (night ? 1.2 : 4 + sh * 3);
    U.uFlash.value = Math.max(S.flash * 0.75, sh);
    const pulse = night ? 0.65 + 0.35 * Math.sin(t * 0.9 + c.bob) : 1;
    U.uGlow.value = K.glowLevel * 0.14 * pulse * (1 + S.flash * 0.8) * (1 + sh * 0.5);
    // the walk: the two walking arms step in turn, the flaps push off in time with them, the body
    // rocks a little; the stride follows its real speed so nothing skates
    S.ph += dt * (spd / 0.05) * PI;
    const w = clamp(spd / 0.06, 0, 1) * (1 - sh);
    const breathe = Math.sin(t * (night ? 0.9 : 1.5) + c.bob);
    B.position.y = 0.2 - S.sit * 0.07 + sh * 0.05 + Math.abs(Math.sin(S.ph)) * 0.012 * w + breathe * 0.004;
    B.rotation.x = 0.04 * w - sh * 0.12 + S.sit * 0.03;
    B.rotation.z = Math.sin(S.ph) * 0.03 * w;
    B.scale.set(1 + breathe * 0.012 + sh * 0.04, 1 - breathe * 0.01, 1);
    for (const f of flaps) {
      const step = Math.sin(S.ph + (f.s > 0 ? PI : 0));
      f.g.rotation.set(step * 0.35 * w - sh * 0.2, 0, f.s * (0.15 + sh * 0.75 + S.sit * 0.35));
    }
    // the arms: curling slowly at rest; the walking pair steps; near the van the top arms rise;
    // in the display all of them lift into a crown, spread and twist
    for (const a of arms) {
      const r = a.rest, idle = Math.sin(t * 1.3 + a.k * 0.9 + (a.s > 0 ? 1.7 : 0)) * 0.06;
      let rx = r.x + idle, ry = r.y, rz = r.z;
      if (a.walk) {
        const step = Math.sin(S.ph + (a.s > 0 ? 0 : PI));
        rx += (-Math.max(0, step) * 0.35 + 0.1 * step) * w;
        ry += -a.s * step * 0.18 * w;
        rx += S.sit * 0.18;
      }
      if (a.k <= 1) rx += -S.raise * (1.25 - a.k * 0.35);              // the front (top) arms up as the van passes
      if (sh > 0.001) {
        const spread = a.th - 1.55;                                     // where it sits round the ring
        const crownX = -1.15 - (a.walk ? 0.2 : 0) + Math.sin(t * 6 + a.k + a.s) * 0.12;
        rx = rx * (1 - sh) + crownX * sh;
        ry = ry * (1 - sh) + (-a.s * (0.5 + a.k * 0.18)) * sh;
        rz = rz * (1 - sh) + (a.s * spread * 0.35) * sh;
      }
      a.g.rotation.set(rx, ry, rz);
    }
    // the eyes: the lids half down while it sits at night, open as the van comes close
    const lid = night ? (c.near !== undefined && c.near < 10 ? 1 : 0.55) : 1;
    for (const e of eyes) e.scale.y = damp(e.scale.y, lid, 3, dt);
    // the photo point: the middle of the body; a little higher and larger in the display
    c.eye.set(0, 0.08 + sh * 0.03 - S.sit * 0.02, 0.02);
    c.radius = 0.21 + sh * 0.03;
  }

  // how fast it really moves (m/s, smoothed)
  function motion(dt) {
    const p = c.root.position;
    if (S.px === undefined) { S.px = p.x; S.pz = p.z; S.spd = 0; }
    const dd = Math.hypot(p.x - S.px, p.z - S.pz);
    S.px = p.x; S.pz = p.z;
    if (dt > 0) S.spd = damp(S.spd, Math.min(1, dd / dt), 6, dt);
    return S.spd;
  }

  c.root.updateMatrixWorld(true);
  U.uRootInv.value.copy(c.root.matrixWorld).invert();
  pose(0, { t: 0, dist: 99, camPos: new THREE.Vector3(0, 0, 1e4) });
  return K.lod(c, near, far, 30);
}

export const BUILDERS = {
  'flamboyant-cuttlefish': buildCuttlefish,
};
