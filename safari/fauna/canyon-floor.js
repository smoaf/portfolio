// The canyon floor and the water's edge: who lives down by the river. Each export takes the route's
// context ({ scene, keep, tod, glow, ground }) and returns { species, spawn(home, opts) }.
//
// The twist on every real animal is light: markings that glow faintly by day and strongly at dusk
// and night (ctx.glow), an extra pair of eyes here, a fin there. The shapes stay true to the animal.
import * as THREE from 'three';
import { body, materials, lookAt, damp, blinker } from '../kit.js';
import { quadruped, quadLife, quadPose, spawn, jointedLeg, legWave, spine, swimWave } from './forms.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const arr = (v) => [v.x, v.y, v.z];
const rnd = (a, b) => a + Math.random() * (b - a);

// a coat of short hair: a base colour, darker along the back, lighter on the belly, fine streaks
function coat(base, { back, belly, streak = 0.08, seed = 1 } = {}) {
  return (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);     // u: belly, flank, back, flank, belly
    gr.addColorStop(0, belly || base); gr.addColorStop(0.3, base); gr.addColorStop(0.5, back || base); gr.addColorStop(0.7, base); gr.addColorStop(1, belly || base);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    let s = seed;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    g.globalAlpha = streak;
    for (let i = 0; i < 900; i++) {
      g.fillStyle = r() > 0.5 ? '#000' : '#fff';
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 4 + r() * 10);
    }
    g.globalAlpha = 1;
  };
}

// ---- Cape buffalo ---------------------------------------------------------------------------------
// A small herd drinks at the ford. Heavy, low head, the horns that meet in a boss over the brow.
// Twist: a row of pale-blue glowing pores along the spine, and the boss glows at night.
export function capeBuffalo(ctx) {
  const M = materials({
    keep: ctx.keep, glowColor: 0x7fd6ff, glowAt: 0.6 * ctx.glow, rough: 0.78,
    paint: coat('#2e2a28', { back: '#1f1c1b', belly: '#3b3531', streak: 0.12, seed: 7 }),
    glow: (g, w, h) => { g.fillStyle = '#fff'; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(w * 0.5, h * (0.12 + i * 0.055), 3.2, 0, 7); g.fill(); } },
  });
  const species = { id: 'buffalo', name: 'Cape buffalo', points: 120, call: { hz: 110, kind: 'hoot' } };
  const S = { L: 2.3, H: 1.42, R: [0.56, 0.62], hump: 0.5,
    neck: { len: 0.42, up: 0.15, r: [0.5, 0.36] }, head: { len: 0.62, r: 0.26, drop: 1.15, muzzle: 0.75, wide: 0.92 },
    leg: [0.17, 0.08, 0.1], tail: { len: 0.75, r: 0.05, tuft: 1.2 }, coat: 0xffffff, legColor: 0xdddddd };
  const make = (q) => {
    const B = body(q);
    const F = quadruped(B, M, S);
    const h = F.head;
    // horns: a broad boss on the brow, then out, down and up again to a point
    [1, -1].forEach((sx) => {
      const o = h.at(0.12, 0.2, 0);
      const pts = [V(sx * 0.03, 0.04, 0), V(sx * 0.2, 0.0, -0.02), V(sx * 0.4, -0.16, 0.02), V(sx * 0.55, -0.15, 0.1), V(sx * 0.58, 0.02, 0.15), V(sx * 0.5, 0.16, 0.12)];
      const rs = [0.13, 0.12, 0.085, 0.06, 0.04, 0.012];
      B.loft(pts.map((p, i) => ({ p: arr(o.clone().add(p)), r: [rs[i], rs[i] * (i < 2 ? 0.55 : 1)], b: 'head', c: i < 2 ? 0x5a5048 : 0x3a3530 })),
        { mat: M.skin, seg: q ? 10 : 5, plain: true });
    });
    // the glowing boss seam, the twist
    B.add(new THREE.CapsuleGeometry(0.025, 0.22, 3, 6), { bone: 'head', mat: M.skin, glow: true, at: arr(h.at(0.12, 0.25, 0)), rot: [0, 0, Math.PI / 2] });
    // ears hang below the horns, fringed
    [1, -1].forEach((sx) => {
      const n = sx > 0 ? 'earL' : 'earR';
      const at = h.at(0.1, 0.02, sx * 0.24);
      B.bone(n, 'head', arr(at));
      B.loft([{ p: arr(at), r: [0.05, 0.03], b: n }, { p: arr(at.clone().add(V(sx * 0.14, -0.05, 0.02))), r: [0.08, 0.035], b: n }, { p: arr(at.clone().add(V(sx * 0.27, -0.1, 0.02))), r: [0.03, 0.02], b: n }],
        { mat: M.skin, seg: q ? 8 : 4, color: 0x8a7e74 });
    });
    // eyes, low and to the side; a wet, wide nose
    const ey = h.at(0.3, 0.08, 0);
    B.bone('eyes', 'head', arr(ey));
    [1, -1].forEach((sx) => B.eye({ bone: 'eyes', at: arr(ey.clone().add(V(sx * 0.21, 0, 0))), r: 0.038, look: [sx, 0.1, 0.5], iris: 0x2a1a10, mat: M.eyes, skin: M.skin }));
    B.add(new THREE.SphereGeometry(0.13, q ? 12 : 6, q ? 8 : 4), { bone: 'head', mat: M.eyes, at: arr(h.at(0.98, -0.02, 0)), scale: [1.25, 0.7, 0.6], color: 0x1a1614 });
    return B;
  };
  return {
    species,
    spawn: (home, o = {}) => spawn(ctx, {
      species, make, radius: 1.35, eye: [0, 1.2, 1.3], scale: o.scale ?? rnd(0.92, 1.06), home, yaw: o.yaw,
      speed: 1.4, roam: 6, fleeAt: 6, curiousAt: 30, shy: 0.25, rareChance: 0.5, rareAt: 'dawn',
      pose(c, T, st, dt, env) {
        quadLife(c, T, st, dt, env, { stride: 1.5, gallopAt: 2.6, reach: 1.0 });
        // rare: the bull tosses his head and paws the ground, a bellow
        if (c.state === 'rare') {
          const k = Math.min(1, c.t * 2) * Math.min(1, (c.hold - c.t) * 2);
          T.bones.neck.rotation.x = -0.25 * k + Math.sin(c.t * 7) * 0.25 * k;
          T.bones.FL1.rotation.x = Math.sin(c.t * 9) * 0.5 * k;
          T.bones.head.rotation.z = Math.sin(c.t * 7) * 0.2 * k;
        }
      },
    }),
  };
}
