// --- 3D printer in the workshop (Smo): prints a small toy robot from the bottom up, then shows it a
// moment, clears the bed and starts again. The toy is cut off above the current layer with a clip
// plane; bed, X bar and head move like a bed-slinger printer. Only moves while the workshop could
// be seen up close (cheap anyway: a few transforms per frame).
// Moved here from index.html in phase W0 without changing how it looks or behaves; it is now a
// workshop station (click to zoom in). Phase W1 adds choosing and uploading what it prints.
import * as THREE from 'three';
import { register } from './stations.js';

export const PRN = { bed: null, toy: null, xbar: null, head: null, b0: null, x0: null, h0: null, plane: new THREE.Plane(new THREE.Vector3(0, -1, 0), 0),
  printS: 48, holdS: 7, t: 0, last: 0, toyBottom: 0, toyH: 0.2 };
let parts = [];
function setupPrinter(ws) {
  ws.root.traverse((o) => {
    if (o.name === 'workshopprinter_bed') PRN.bed = o;
    if (o.name === 'workshopprinter_toy') PRN.toy = o;
    if (o.name === 'workshopprinter_xbar') PRN.xbar = o;
    if (o.name === 'workshopprinter_head') PRN.head = o;
  });
  if (!PRN.toy) return;
  ws.renderer.localClippingEnabled = true;
  PRN.toy.material.clippingPlanes = [PRN.plane];        // the accent setup already gave the toy its own material
  PRN.toy.material.side = THREE.DoubleSide;           // the cut shows the inside instead of nothing
  PRN.toy.castShadow = false;
  [PRN.bed, PRN.xbar, PRN.head].forEach((o) => { if (o) o.castShadow = false; });
  PRN.b0 = PRN.bed.position.clone(); PRN.x0 = PRN.xbar.position.clone(); PRN.h0 = PRN.head.position.clone();
  PRN.toyBottom = PRN.toy.position.y; PRN.toyH = 0.2;
  // what a click hits; own materials for the frame parts so only the printer glows (toy and spool
  // have their own already, from the colour touches)
  const own = ['workshopprinter_frame', 'workshopprinter_frame_black', 'workshopprinter_bed', 'workshopprinter_xbar', 'workshopprinter_head'].map(ws.mesh).filter(Boolean);
  ws.own(own);
  parts = [...own, ws.mesh('workshopprinter_spool'), PRN.toy].filter(Boolean);
}
function stepPrinter(now) {
  if (!PRN.toy) return;
  const dt = PRN.last ? Math.min(0.1, (now - PRN.last) / 1000) : 0; PRN.last = now;
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) PRN.t = (PRN.t + dt) % (PRN.printS + PRN.holdS);
  else PRN.t = PRN.printS * 0.6;
  const printing = PRN.t < PRN.printS;
  const u = printing ? PRN.t / PRN.printS : 1;
  const layer = PRN.toyH * u;                         // height printed so far
  const t = now / 1000;
  // the toy's width changes with height: legs, body with arms, neck, head (roughly)
  const half = layer < 0.055 ? 0.035 : layer < 0.12 ? 0.065 : layer < 0.13 ? 0.01 : 0.037;
  const hx = printing ? Math.sin(t * 5.3) * half : 0.12;           // head darts over the part, parks to the side when done
  const by = printing ? Math.sin(t * 3.1 + 1.3) * half * 0.7 : -0.06;
  PRN.bed.position.set(PRN.b0.x, PRN.b0.y, PRN.b0.z + by);
  PRN.toy.position.copy(PRN.bed.position);
  const z = layer + (printing ? 0.002 : 0.05);
  PRN.xbar.position.set(PRN.x0.x, PRN.x0.y + z, PRN.x0.z);
  PRN.head.position.set(PRN.h0.x + hx, PRN.h0.y + z, PRN.h0.z);
  PRN.plane.constant = PRN.toyBottom + layer;          // keep what lies below the current layer
  PRN.toy.visible = u > 0.002;
}

register({
  id: 'printer', label: '3D printer',
  pick: () => parts,
  view: { at: [12.08, 4.24, 2.3], from: [0.12, 0.38, -1], size: 0.95 },
  setup: setupPrinter,
  arrive: () => { PRN.t = 0; },                        // a new print starts when you arrive
  update: (dt, now) => stepPrinter(now),
  resume: (now) => { PRN.last = now; },
  print: (u) => { PRN.t = u * PRN.printS; },            // test hook
});
