// The workshop's layout for the stations (WORKSHOP_PLAN "Layout", phase W0). The model is changed
// here at load time instead of in the generator (3d/scripts/build_station_v4.py, `workshop()`), so
// the 14 MB model does not have to be rebuilt for it:
//   - the assembly table ("the desk") is wider and a little deeper towards the front
//   - the three old bench devices (`workshopdevices`, `workshopdevice_screens`) are gone: the
//     electronics station on the desk replaces them
//   - the drone leaves the desk and hangs on the back wall, on a small ledge above the printer
//   - the empty spots for the stations: back of the desk the oscilloscope, power amp and modular
//     synth; front of the desk the solder station and the tape delay; the server rack stays the
//     big rack on the left. Each spot has a flat placeholder pad and is a placeholder station until
//     its phase registers the real one under the same id.
// Viewer coordinates (y up; the workshop's open side faces -z, +x is to the left on screen).
import { register } from './stations.js';

export const DESK = { top: 3.94, x0: 8.55, x1: 11.95, back: -0.35, front: -1.6 };   // after widening
// spot centres sit on the desk top; w along x, d along z
export const SPOTS = {
  synth: { label: 'Modular synth', at: [9.45, DESK.top, -0.62], w: 1.6, d: 0.46 },
  amp: { label: 'Power amp', at: [10.65, DESK.top, -0.6], w: 0.5, d: 0.4 },
  scope: { label: 'Oscilloscope', at: [11.55, DESK.top, -0.6], w: 0.6, d: 0.4 },
  solder: { label: 'Solder station', at: [11.1, DESK.top, -1.32], w: 1.5, d: 0.46 },
  tape: { label: 'Tape delay', at: [9.35, DESK.top, -1.32], w: 1.2, d: 0.46 },
  rack: { label: 'Server rack', at: [14.1, 4.1, 1.17], rack: true },
};
const WALL_DRONE = { at: [12.85, 5.02, 2.62] };       // on the back wall, left of the pegboard, above the printer

// scale or move a mesh in world space, whatever its node transform is
function worldEdit(THREE, mesh, m) {
  mesh.updateWorldMatrix(true, false);
  const inv = mesh.matrixWorld.clone().invert();
  mesh.geometry.applyMatrix4(inv.multiply(m).multiply(mesh.matrixWorld));
  mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere();
}

export function setupLayout(ws) {
  const { THREE } = ws, M = THREE.Matrix4;
  // the desk: 2.2 -> 3.4 m wide around its middle, 1.1 -> 1.25 m deep, the back edge stays
  const table = ws.mesh('workshoptable');
  if (table) {
    const b = new THREE.Box3().setFromObject(table), cx = (b.min.x + b.max.x) / 2;
    const sx = (DESK.x1 - DESK.x0) / (b.max.x - b.min.x), sz = (DESK.back - DESK.front) / (b.max.z - b.min.z);
    worldEdit(THREE, table, new M().makeTranslation(cx, 0, b.max.z).multiply(new M().makeScale(sx, 1, sz)).multiply(new M().makeTranslation(-cx, 0, -b.max.z)));
  }
  ['workshopdevices', 'workshopdevice_screens'].forEach((n) => { const o = ws.mesh(n); if (o) { o.visible = false; o.castShadow = false; } });
  // the drone: stood up against the back wall (its top towards the room) on a small ledge
  const drone = ws.mesh('workshopdrone');
  if (drone) {
    const c = new THREE.Box3().setFromObject(drone).getCenter(new THREE.Vector3());
    worldEdit(THREE, drone, new M().makeTranslation(...WALL_DRONE.at).multiply(new M().makeRotationX(-Math.PI / 2)).multiply(new M().makeTranslation(-c.x, -c.y, -c.z)));
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.025, 0.13), drone.material);
    ledge.position.set(WALL_DRONE.at[0], WALL_DRONE.at[1] - 0.33, 2.64);
    ledge.castShadow = ledge.receiveShadow = true; ledge.name = 'workshop-drone-ledge';
    ws.scene.add(ledge);
  }
  // placeholder pads, and a placeholder station for every spot
  const padMat = new THREE.MeshStandardMaterial({ color: 0xc9c0b0, roughness: 0.9 });
  const lineMat = new THREE.LineBasicMaterial({ color: 0x5a5247 });
  Object.entries(SPOTS).forEach(([id, s]) => {
    let pick;
    if (s.rack) {
      const ms = ['workshopservers', 'workshopserver_grilles'].map(ws.mesh).filter(Boolean);
      ws.own(ms);
      pick = () => ms;
    } else {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(s.w, 0.012, s.d), padMat.clone());
      pad.position.set(s.at[0], s.at[1] + 0.006, s.at[2]);
      pad.add(new THREE.LineSegments(new THREE.EdgesGeometry(pad.geometry), lineMat));
      pad.receiveShadow = true; pad.name = 'workshop-spot-' + id;
      ws.scene.add(pad);
      s.pad = pad;
      pick = () => [pad];
    }
    register({
      id, label: s.label, placeholder: true, pick,
      view: s.rack ? { at: s.at, from: [-1, 0.18, -0.3], size: 3.2 } : { at: [s.at[0], s.at[1] + 0.12, s.at[2]], from: [0, 0.8, -1], size: Math.max(0.9, s.w + 0.3) },
      hint: 'Placeholder: the ' + s.label.toLowerCase() + ' comes here',
    });
  });
  ws.markShadows();
}
