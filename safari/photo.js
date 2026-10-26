// Taking and judging a photo. The thumbnail is grabbed straight off the WebGL canvas in the same
// frame as the render (the renderer keeps no drawing buffer, so it has to happen there and then),
// and the score is worked out from what the lens actually had in front of it.
//
// The base score is the species' value times how big the animal is in the frame (a soft bell: a
// third of the frame is ideal) times how near the middle it sits. On top come the bonuses, all
// stackable, each a share of the base score:
//
//   + group     2 or more animals of the photographed species in frame     +25% (once)
//   + species   every other species in frame                              +50% each
//   + feeding   the animal is eating, or walking to the feed               +50%
//   + pose      the animal is in its rare pose or rare behaviour           +50%
//
// An animal that is hidden behind rock, plants or another animal is not a subject at all.
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
    if (open / OFF.length < 0.34) continue;            // fully hidden: not a photo of anything
    subjects.push({ c, species: c.species, size, sizeFrac: f, centre, rare: c.state === 'rare', feeding: c.state === 'eat', dist });
  }
  if (!subjects.length) return { points: 0, subjects: [], best: null, bonuses: [], aspect };
  subjects.sort((a, b) => b.size * b.centre - a.size * a.centre);
  const best = subjects[0];
  const base = (best.species.points || 100) * best.size * best.centre;
  const others = new Set(subjects.map((s) => s.species.id));
  others.delete(best.species.id);
  const bonuses = [];
  if (subjects.filter((s) => s.species.id === best.species.id).length > 1) bonuses.push(BONUS.group);
  others.forEach(() => bonuses.push(BONUS.species));
  if (best.feeding) bonuses.push(BONUS.feeding);
  if (best.rare) bonuses.push(BONUS.pose);
  const points = Math.round(base * (1 + bonuses.reduce((n, b) => n + b.share, 0)));
  return {
    points, best, subjects, aspect, bonuses,
    parts: { base: Math.round(base), size: best.size, centre: best.centre, rare: best.rare, feeding: best.feeding, species: others.size + 1 },
  };
}

// the bonuses, with the words the polaroid and the report show for them
export const BONUS = {
  group: { id: 'group', label: '+ group', share: 0.25 },
  species: { id: 'species', label: '+ species', share: 0.5 },
  feeding: { id: 'feeding', label: '+ feeding', share: 0.5 },
  pose: { id: 'pose', label: '+ pose', share: 0.5 },
};
// the bonus words of a shot, e.g. "+ group + feeding"; empty when it earned none
export const bonusText = (shot) => (shot.bonuses || []).map((b) => b.label).join(' ');

// The words under the score when a shot comes in: short, so a phone can read them at a glance.
export function verdict(shot) {
  if (!shot.best) return 'Nothing in frame';
  const p = shot.parts, bits = [];
  if (p.size > 0.75) bits.push('well framed'); else if (shot.best.sizeFrac < 0.12) bits.push('far away');
  if (p.centre > 0.9) bits.push('centred');
  return bits.join(' · ') || 'in frame';
}

// Grab the frame that was just drawn. Called from inside the render loop, right after render().
// `size` is the thumbnail by default; the report's large view asks for a bigger copy of the same frame.
export function grab(canvas, size = THUMB) {
  const t = document.createElement('canvas');
  t.width = size.w; t.height = size.h;
  const g = t.getContext('2d');
  const sw = canvas.width, sh = canvas.height, want = size.w / size.h;
  let cw = sw, ch = Math.round(sw / want);
  if (ch > sh) { ch = sh; cw = Math.round(sh * want); }
  g.drawImage(canvas, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, size.w, size.h);
  return t;
}
