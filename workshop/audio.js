// The workshop's shared signal chain (WORKSHOP_PLAN "Shared audio chain"):
//
//   synth ──► fuzz ──► delay ──► amp ──► master (volume, mute) ──► limiter ──► speakers
//
// Every stage is a slot with an `in` and an `out` node. An empty slot passes the signal straight
// through, so each station also works on its own: a station puts its processor into its slot with
// `slot(id).insert(input, output)`, and a sound source plays into any slot's `in` (the synth into
// 'synth', the guitar loop into 'fuzz'). The oscilloscope reads one analyser that can be moved to
// any slot's output with `probe(id)`.
//
// The AudioContext is only made on the first `start()`, which must come from a click (browser rule).
// Leaving the workshop calls `dispose()`: the context is closed and every node is dropped; stations
// listen with `onDispose()` and rebuild their nodes the next time they start. Mute is shared with
// the Photo Safari (same localStorage key, safari/audio.js).
import { mutedByDefault, saveMute } from '../safari/audio.js';

export const SLOTS = ['synth', 'fuzz', 'delay', 'amp'];
const MASTER = 0.8;

let ctx = null, master = null, limiter = null, analyser = null, probed = null;
let slots = null;
let muted = mutedByDefault();
const disposeFns = new Set(), muteFns = new Set();

function makeSlot(id) {
  const s = { id, in: ctx.createGain(), out: ctx.createGain(), proc: null, bypassed: false };
  s.in.connect(s.out);
  return s;
}
function wire(s) {                                     // (re)connect a slot's inside: straight or through its processor
  s.in.disconnect();
  if (s.proc) { try { s.proc.output.disconnect(s.out); } catch (e) { /* was not connected */ } }
  if (s.proc && !s.bypassed) { s.in.connect(s.proc.input); s.proc.output.connect(s.out); } else s.in.connect(s.out);
}

// make the context (from a click) and the chain; returns the context, or null without Web Audio
export function start() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  slots = Object.fromEntries(SLOTS.map((id) => [id, makeSlot(id)]));
  SLOTS.forEach((id, i) => { if (i < SLOTS.length - 1) slots[id].out.connect(slots[SLOTS[i + 1]].in); });
  master = ctx.createGain(); master.gain.value = muted ? 0 : MASTER;
  limiter = ctx.createDynamicsCompressor();             // nothing a patch or a feedback loop does gets painfully loud
  limiter.threshold.value = -10; limiter.knee.value = 6; limiter.ratio.value = 12; limiter.attack.value = 0.003; limiter.release.value = 0.2;
  analyser = ctx.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0;
  slots[SLOTS[SLOTS.length - 1]].out.connect(master);
  master.connect(limiter); limiter.connect(ctx.destination);
  probe(SLOTS[SLOTS.length - 1]);
  return ctx;
}
export const context = () => ctx;
export const running = () => !!ctx;

// one stage of the chain: put a processor in ({ input, output } nodes), take it out, or bypass it
export function slot(id) {
  if (!ctx) start();
  if (!ctx) return null;
  const s = slots[id];
  return {
    in: s.in, out: s.out,
    insert(input, output = input) { if (s.proc) s.proc.output.disconnect(); s.proc = { input, output }; wire(s); },
    remove() { if (s.proc) { s.proc.output.disconnect(); s.proc = null; wire(s); } },
    bypass(on) { s.bypassed = !!on; wire(s); },
    get bypassed() { return s.bypassed; },
  };
}

// the oscilloscope's tap: which slot's output it reads ('master' = after the volume)
export function probe(id) {
  if (!ctx) return;
  const src = id === 'master' ? master : slots[id] && slots[id].out;
  if (!src) return;
  if (probed) { try { probed.disconnect(analyser); } catch (e) { /* was not connected */ } }
  src.connect(analyser); probed = src;
}
export const probedSlot = () => (probed === master ? 'master' : SLOTS.find((id) => slots && slots[id].out === probed) || null);
export function scope(buf) {                           // fills a Float32Array with the current waveform (silence before start)
  if (!analyser) { buf.fill(0); return buf; }
  analyser.getFloatTimeDomainData(buf); return buf;
}
export const scopeSize = () => (analyser ? analyser.fftSize : 2048);

// master volume 0..1 (the power amp's knob) and the shared mute
let volume = 1;
function applyGain() { if (master) master.gain.setTargetAtTime(muted ? 0 : MASTER * volume, ctx.currentTime, 0.03); }
export function setVolume(v) { volume = Math.max(0, Math.min(1, v)); applyGain(); }
export const isMuted = () => muted;
export function mute(on) { muted = !!on; saveMute(muted); applyGain(); muteFns.forEach((f) => f(muted)); }
export function onMute(fn) { muteFns.add(fn); return () => muteFns.delete(fn); }

export function onDispose(fn) { disposeFns.add(fn); return () => disposeFns.delete(fn); }
export function dispose() {
  if (!ctx) return;
  disposeFns.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
  const c = ctx;
  ctx = master = limiter = analyser = probed = slots = null;
  c.close().catch(() => {});
}
