// What every creature in the safari shares: the behaviour state machine, the facing, and the small
// things the photo scoring asks for. A route (safari/routes/*.js) builds the body and hands it in;
// this file drives it. The states are the ones the plan asks for:
//
//   idle    standing, breathing, looking around
//   wander  strolling to a spot near its home
//   curious the van is close and interesting: turn towards it, come a step nearer
//   flee    the van is too close: run away from it and settle again further off
//   eat     a feed pellet landed within reach: go to it, eat
//   rare    the one showy behaviour per species, worth a photo (feed or the time of day trigger it)
//
// The species supplies `pose(c, dt, env)` for the animation and may override any of it. Distances
// are in metres.
import * as THREE from 'three';

const vA = new THREE.Vector3(), vB = new THREE.Vector3();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function makeCreature(def) {
  const c = {
    species: def.species,                               // { id, name, points, call }
    root: def.root,
    home: def.home.clone(),
    radius: def.radius ?? 0.6,                          // for framing and the occlusion test
    eye: def.eye ?? new THREE.Vector3(0, def.radius ?? 0.6, 0),   // photo point in local space
    flyer: !!def.flyer,
    ground: def.ground || (() => 0),
    speed: def.speed ?? 1.6,
    roam: def.roam ?? 6,
    fleeAt: def.fleeAt ?? 7,
    curiousAt: def.curiousAt ?? 22,
    shy: def.shy ?? 0.5,                                // 0 = bold, 1 = never comes closer
    rareChance: def.rareChance ?? 0.5,                  // after eating
    rareAt: def.rareAt || null,                         // a time of day that makes it show off by itself
    state: 'idle', t: 0, hold: 1 + Math.random() * 2,
    yaw: def.yaw ?? Math.random() * Math.PI * 2,
    target: null, pellet: null, bob: Math.random() * 6.28,
    pose: def.pose || (() => {}),
    onState: def.onState || null,
    visible: true,
  };
  c.root.position.copy(c.home);
  c.root.rotation.y = c.yaw;

  const go = (state, hold) => {
    if (c.state === state) return;
    c.state = state; c.t = 0; c.hold = hold;
    if (c.onState) c.onState(c, state);
  };
  c.go = go;

  // where the camera should aim for: the head, in world space
  c.photoPoint = (out) => out.copy(c.eye).applyMatrix4(c.root.matrixWorld);
  c.forward = (out) => out.set(Math.sin(c.root.rotation.y), 0, Math.cos(c.root.rotation.y));

  const turnTo = (x, z, dt, rate = 2.4) => {
    const want = Math.atan2(x - c.root.position.x, z - c.root.position.z);
    c.root.rotation.y += THREE.MathUtils.clamp(wrap(want - c.root.rotation.y), -rate * dt, rate * dt);
  };
  const walkTo = (p, dt, k = 1) => {
    vA.subVectors(p, c.root.position); vA.y = 0;
    const d = vA.length();
    if (d < 0.25) return true;
    turnTo(p.x, p.z, dt);
    const step = Math.min(d, c.speed * k * dt);
    c.root.position.addScaledVector(vA.normalize(), step);
    if (!c.flyer) c.root.position.y = c.ground(c.root.position.x, c.root.position.z);
    return false;
  };
  c.walkTo = walkTo; c.turnTo = turnTo;

  // env: { camPos, t, tod, pellets, dist }
  c.step = (dt, env) => {
    c.t += dt;
    const dist = env.dist;
    // the van decides a lot: too close and it bolts, close enough and it looks over
    if (c.state !== 'flee' && c.state !== 'rare' && dist < c.fleeAt * (0.6 + c.shy * 0.8)) {
      vA.subVectors(c.root.position, env.camPos).setY(0).normalize();
      c.target = c.root.position.clone().addScaledVector(vA, 7 + Math.random() * 6);
      go('flee', 2.5 + Math.random());
      if (env.call && Math.random() < 0.5) env.call(c, 'flee');
    } else if (c.state === 'idle' || c.state === 'wander') {
      const pellet = env.pellets.find((p) => p.landed && !p.eaten && p.pos.distanceTo(c.root.position) < 14);
      if (pellet) { c.pellet = pellet; go('eat', 6); }
      else if (dist < c.curiousAt && dist > c.fleeAt && c.t > 0.6 && Math.random() < dt * (1.2 - c.shy)) go('curious', 2.5 + Math.random() * 2);
      else if (c.rareAt && c.rareAt === env.tod && Math.random() < dt * 0.06) go('rare', 5);
    }

    switch (c.state) {
      case 'idle':
        if (c.t > c.hold) { c.target = c.home.clone().add(vB.set((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2).multiplyScalar(c.roam)); go('wander', 8); }
        break;
      case 'wander':
        if (walkTo(c.target, dt) || c.t > c.hold) go('idle', 1.5 + Math.random() * 3);
        break;
      case 'curious':
        turnTo(env.camPos.x, env.camPos.z, dt, 1.6);
        if (dist > c.fleeAt * 1.6) {                     // comes a step nearer, never into its own flee zone
          vA.subVectors(env.camPos, c.root.position).setY(0).normalize();
          walkTo(vB.copy(c.root.position).addScaledVector(vA, 1.5), dt, 0.5);
        }
        if (c.t > c.hold) go('idle', 1 + Math.random() * 2);
        break;
      case 'flee':
        walkTo(c.target, dt, 2.2);
        if (c.t > c.hold) { c.home.copy(c.root.position); go('idle', 2 + Math.random() * 2); }
        break;
      case 'eat': {
        const p = c.pellet;
        if (!p || p.eaten) { go('idle', 1); break; }
        if (walkTo(p.pos, dt, 1.3)) {
          p.eaten = true; p.eatenAt = env.t;
          if (env.call) env.call(c, 'eat');
          if (Math.random() < c.rareChance) go('rare', 4.5 + Math.random()); else go('idle', 2);
        } else if (c.t > c.hold) go('idle', 1);
        break;
      }
      case 'rare':
        if (c.t > c.hold) go('idle', 2);
        break;
    }
    c.pose(c, dt, env);
    c.root.updateMatrixWorld();
  };
  return c;
}

// A flock: many copies of one body that circle a centre together. The engine treats it as one
// creature for the photo (the nearest bird is the subject), which keeps the scoring honest.
export function makeFlock({ species, root, bodies, centre, radius = 26, height = 18, speed = 0.22, climb = 4, pose }) {
  const c = {
    species, root, radius: 1.6, flock: true, state: 'idle', t: 0,
    home: centre.clone(), visible: true, bodies,
    phase: bodies.map((_, i) => (i / bodies.length) * Math.PI * 2),
  };
  c.photoPoint = (out) => out.copy(c.lead ? c.lead.position : c.root.position).add(c.root.position.clone().sub(c.root.position));
  c.forward = (out) => out.copy(c.leadDir || vA.set(0, 0, 1));
  c.step = (dt, env) => {
    c.t += dt;
    // one shared circle; a dive is the rare behaviour, and feed on the ground starts it
    const feeding = env.pellets.some((p) => p.landed && !p.eaten && p.pos.distanceTo(centre) < 40);
    if (feeding && c.state !== 'rare') { c.state = 'rare'; c.t = 0; if (env.call) env.call(c, 'rare'); }
    if (c.state === 'rare' && c.t > 7) c.state = 'idle';
    const dip = c.state === 'rare' ? (0.5 - 0.5 * Math.cos(Math.min(1, c.t / 7) * Math.PI * 2)) : 0;
    let best = null, bestD = Infinity;
    bodies.forEach((b, i) => {
      const a = c.phase[i] + env.t * speed * (1 + (i % 3) * 0.04);
      const r = radius * (0.7 + 0.3 * Math.sin(a * 0.7 + i));
      b.position.set(centre.x + Math.cos(a) * r, centre.y + height - dip * (height - 3) + Math.sin(a * 1.7 + i) * climb, centre.z + Math.sin(a) * r);
      b.rotation.y = -a + Math.PI / 2;
      b.rotation.z = Math.sin(a * 2 + i) * 0.22 - 0.25;
      if (pose) pose(b, i, env.t, c.state);
      const d = b.position.distanceTo(env.camPos);
      if (d < bestD) { bestD = d; best = b; }
    });
    c.lead = best; c.near = bestD;
    if (best) c.leadDir = vB.set(Math.sin(best.rotation.y), 0, Math.cos(best.rotation.y)).clone();
    c.root.updateMatrixWorld();
  };
  c.photoPoint = (out) => (c.lead ? out.copy(c.lead.getWorldPosition(vA)) : out.copy(centre));
  return c;
}
