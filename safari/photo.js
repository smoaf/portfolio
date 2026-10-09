// Taking and judging a photo. The thumbnail is grabbed straight off the WebGL canvas in the same
// frame as the render (the renderer keeps no drawing buffer, so it has to happen there and then),
// and the score is worked out from what the lens actually had in front of it:
//
//   subject    the creature is in frame, big enough to read and not hidden
//   size       best when it fills a good part of the frame, less when it is a dot or cropped
//   centring   how near the middle of the viewfinder it sits
//   facing     whether it looks towards the camera
//   behaviour  the rare behaviour is the shot worth waiting for
//   company    more than one species in the same frame
//   occlusion  rock, plant or another animal in the way
import * as THREE from 'three';

export const THUMB = { w: 216, h: 162 };               // the little polaroid in the feed and the album

const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), eye = new THREE.Vector3();
const ray = new THREE.Raycaster();
ray.layers.enableAll();                               // the colliders include scenery the lens skips (chunked)

// how much of the frame height the creature covers
function framing(camera, radius, dist) {
  const half = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * dist;
  return THREE.MathUtils.clamp(radius / half, 0, 2);
}
// a soft bell: small is weak, about a third of the frame is ideal, cropped is punished
function sizeScore(f) {
  if (f < 0.04) return 0;
  if (f <= 0.34) return THREE.MathUtils.smoothstep(f, 0.04, 0.34);
  return 1 - 0.75 * THREE.MathUtils.smoothstep(f, 0.4, 1.1);
}

export function judge({ camera, creatures, colliders, aspect }) {
  camera.updateMatrixWorld();
  camera.getWorldPosition(eye);                        // the lens sits on the van, not at the origin
  const subjects = [];
  for (const c of creatures) {
    if (!c.visible || !c.root.visible) continue;
    c.photoPoint(vA);
    const dist = eye.distanceTo(vA);
    if (dist > 160) continue;
    vB.copy(vA).project(camera);
    if (vB.z > 1 || Math.abs(vB.x) > 1.08 || Math.abs(vB.y) > 1.08) continue;
    const f = framing(camera, c.radius, dist);
    const size = sizeScore(f);
    if (size <= 0.02) continue;
    // centring: the middle of the frame counts most, the corners least
    const off = Math.min(1, Math.hypot(vB.x * 0.8, vB.y) / 1.0);
    const centre = 1 - 0.75 * off * off;
    // facing: 1 when it looks straight down the lens
    vC.subVectors(eye, vA).setY(0).normalize();
    const facing = 0.65 + 0.35 * THREE.MathUtils.clamp(c.forward(vB).dot(vC), -1, 1);
    // occlusion: three rays, from the lens to the head, the shoulder and the flank
    const OFF = [[0, 0, 0], [c.radius * 0.6, -c.radius * 0.5, 0], [-c.radius * 0.6, 0, 0]];
    let open = 0;
    for (const o of OFF) {
      c.photoPoint(vA).add(vC.set(o[0], o[1], o[2]));
      vB.subVectors(vA, eye);
      const len = vB.length();
      ray.set(eye, vB.normalize());
      ray.far = Math.max(0.1, len - c.radius * 0.5);
      if (!colliders.length || !ray.intersectObjects(colliders, false).length) open++;
    }
    const clear = open / OFF.length;
    if (clear < 0.34) continue;                        // fully hidden: not a photo of anything
    const rare = c.state === 'rare';
    subjects.push({ c, species: c.species, size, sizeFrac: f, centre, facing, clear, rare, dist });
  }
  if (!subjects.length) return { points: 0, subjects: [], best: null, aspect };
  subjects.sort((a, b) => b.size * b.centre - a.size * a.centre);
  const best = subjects[0];
  const species = new Set(subjects.map((s) => s.species.id));
  const company = Math.min(0.45, (species.size - 1) * 0.15);
  const base = best.species.points || 100;
  const points = Math.round(base * best.size * best.centre * best.facing * best.clear * (best.rare ? 1.6 : 1) * (1 + company));
  return {
    points, best, subjects, aspect,
    parts: { size: best.size, centre: best.centre, facing: best.facing, clear: best.clear, rare: best.rare, company, species: species.size },
  };
}

// The words under the polaroid: short, so a phone can read them at a glance.
export function verdict(shot) {
  if (!shot.best) return 'Nothing in frame';
  const p = shot.parts, bits = [];
  if (p.rare) bits.push('rare behaviour');
  if (p.size > 0.75) bits.push('well framed'); else if (shot.best.sizeFrac < 0.12) bits.push('far away');
  if (p.centre > 0.9) bits.push('centred');
  if (p.facing > 0.9) bits.push('looking at you');
  if (p.clear < 0.9) bits.push('partly hidden');
  if (p.species > 1) bits.push(`${p.species} species`);
  return bits.slice(0, 2).join(' · ') || 'in frame';
}

// Grab the frame that was just drawn. Called from inside the render loop, right after render().
export function grab(canvas) {
  const t = document.createElement('canvas');
  t.width = THUMB.w; t.height = THUMB.h;
  const g = t.getContext('2d');
  const sw = canvas.width, sh = canvas.height, want = THUMB.w / THUMB.h;
  let cw = sw, ch = Math.round(sw / want);
  if (ch > sh) { ch = sh; cw = Math.round(sh * want); }
  g.drawImage(canvas, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, THUMB.w, THUMB.h);
  return t;
}
