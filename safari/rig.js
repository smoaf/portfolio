// The van on rails and the camera the visitor looks through. The van drives itself along the route's
// spline; the player only turns the lens. Speed comes from the route (it slows at the set pieces),
// so the engine note and the tyres follow it by themselves.
//
// The camera sits on a rig: the rig takes the van's position and heading, the camera takes the
// visitor's own yaw and pitch on top of it. Zoom is the field of view, from a wide 62° down to a
// long 18°, which is what the camera in the van has on it (a long lens on a small tripod).
import * as THREE from 'three';

export const FOV = { wide: 62, long: 18 };
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), q = new THREE.Quaternion();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// with reduced motion the van glides: no shake, no bob, only a trace of the swell
const calm = matchMedia('(prefers-reduced-motion: reduce)');

export function makeRig({ route, scene, aspect = 1.6 }) {
  const path = route.path;
  const length = path.getLength();
  const rig = new THREE.Group();                        // the van: position and heading
  const head = new THREE.Group();                       // where the visitor's head is in the van
  head.position.set(0, route.eyeHeight ?? 1.95, -0.2);      // a little ahead of the van's middle
  rig.add(head);
  scene.add(rig);
  const camera = new THREE.PerspectiveCamera(FOV.wide, aspect, 0.25, 900);
  camera.rotation.order = 'YXZ';
  head.add(camera);

  const S = {
    u: 0, speed: 0, fov: FOV.wide, yaw: 0, pitch: 0,
    yawLimit: route.yawLimit ?? 2.6, pitchLimit: 1.0,
    lastDrag: -10, auto: new THREE.Vector2(), bump: 0, done: false,
    seconds: route.seconds ?? 120, t: 0,
  };

  // the van's own frame, and a little body roll and shake so it never feels like a tripod
  function place(dt) {
    const u = Math.min(1, S.u);
    path.getPointAt(u, vA);
    path.getTangentAt(u, vB);
    rig.position.copy(vA);
    rig.rotation.y = Math.atan2(-vB.x, -vB.z);           // the rig's -z is the way it drives, like the camera's
    // afloat, the van rocks on the swell instead of rattling on gravel
    const sway = route.swayAt ? route.swayAt(u) : 0;
    const m = calm.matches ? 0 : 1, sm = calm.matches ? 0.2 : 1;
    const roll = (Math.sin(S.t * 1.1) * 0.012 + S.bump * 0.03 * (1 - sway)) * m + Math.sin(S.t * 0.9) * 0.045 * sway * sm;
    rig.rotation.z = roll;
    rig.rotation.x = Math.sin(S.t * 0.7 + 1) * 0.03 * sway * sm;
    head.position.y = (route.eyeHeight ?? 1.95) + (Math.sin(S.t * 6.2) * 0.012 * (0.3 + S.speed) + S.bump * 0.05) * m;
    S.bump *= Math.max(0, 1 - dt * 6);
  }

  place(0);                                             // stand on the start of the route right away
  scene.updateMatrixWorld(true);

  // the yaw and pitch that would put a world point in the middle of the viewfinder
  function angles(point) {
    head.getWorldPosition(vA);
    vB.copy(point).sub(vA).normalize().applyQuaternion(rig.getWorldQuaternion(q).invert());
    return { yaw: Math.atan2(-vB.x, -vB.z), pitch: Math.asin(THREE.MathUtils.clamp(vB.y, -1, 1)) };
  }

  function step(dt, poi) {
    S.t += dt;
    // the route decides the pace: 1 is cruising, 0.25 is crawling past a set piece
    const want = route.speedAt ? route.speedAt(S.u) : 1;
    S.speed += (want - S.speed) * Math.min(1, dt * 0.8);
    const metres = (length / S.seconds) * S.speed * dt;
    S.u = Math.min(1, S.u + metres / length);
    if (S.u >= 1) S.done = true;
    // gravel: a small jolt now and then, stronger the faster it rolls
    const afloat = route.swayAt ? route.swayAt(S.u) > 0.5 : false;
    if (!afloat && Math.random() < dt * (0.5 + S.speed * 1.6)) S.bump = Math.min(1, S.bump + 0.25 + Math.random() * 0.5);
    place(dt);

    // auto-look: when nobody has dragged for a moment, the lens drifts a little towards whatever is
    // worth seeing. It never takes the view over: a drag wins at once.
    const idle = S.t - S.lastDrag > 1.6;
    let tx = 0, ty = 0;
    if (idle && poi) {
      const a = angles(poi);
      tx = THREE.MathUtils.clamp(wrap(a.yaw - S.yaw), -0.5, 0.5);
      ty = THREE.MathUtils.clamp(a.pitch - S.pitch, -0.3, 0.3);
    }
    S.auto.x += (tx * 0.35 - S.auto.x) * Math.min(1, dt * (idle ? 0.7 : 4));
    S.auto.y += (ty * 0.35 - S.auto.y) * Math.min(1, dt * (idle ? 0.7 : 4));

    camera.rotation.y = THREE.MathUtils.clamp(S.yaw + S.auto.x, -S.yawLimit, S.yawLimit);
    camera.rotation.x = THREE.MathUtils.clamp(S.pitch + S.auto.y, -S.pitchLimit, S.pitchLimit);
    camera.updateMatrixWorld();
    return S.speed;
  }

  function setZoom(fov) {
    S.fov = THREE.MathUtils.clamp(fov, FOV.long, FOV.wide);
    camera.fov = S.fov; camera.updateProjectionMatrix();
    return S.fov;
  }

  return {
    rig, head, camera, state: S, length,
    get progress() { return S.u; },
    get done() { return S.done; },
    step,
    // drag: the view follows the finger, in the same feel as the station's inside views
    drag(dx, dy, height) {
      const k = THREE.MathUtils.degToRad(camera.fov) / Math.max(1, height);
      S.yaw = THREE.MathUtils.clamp(S.yaw + dx * k, -S.yawLimit, S.yawLimit);
      S.pitch = THREE.MathUtils.clamp(S.pitch + dy * k, -S.pitchLimit, S.pitchLimit);
      S.lastDrag = S.t; S.auto.set(0, 0);
    },
    angles,
    aimAt(point) {                                      // tests and set pieces: look straight at it
      const a = angles(point);
      S.yaw = THREE.MathUtils.clamp(a.yaw, -S.yawLimit, S.yawLimit);
      S.pitch = THREE.MathUtils.clamp(a.pitch, -S.pitchLimit, S.pitchLimit);
      S.auto.set(0, 0); S.lastDrag = S.t;
    },
    nudge(x, y) { S.yaw = THREE.MathUtils.clamp(S.yaw + x, -S.yawLimit, S.yawLimit); S.pitch = THREE.MathUtils.clamp(S.pitch + y, -S.pitchLimit, S.pitchLimit); S.lastDrag = S.t; },
    zoom(factor) { return setZoom(S.fov * factor); },
    setZoom,
    resize(a) { camera.aspect = a; camera.updateProjectionMatrix(); },
    worldHead: (out) => head.getWorldPosition(out),
    lookDir: (out) => out.set(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(q)),
  };
}
