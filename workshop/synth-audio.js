// --- The modular synth's sound (WORKSHOP_PLAN phase W1): one Web Audio node set per module, built
// whenever the workshop's AudioContext is made (workshop/synth.js keeps the knob values and the
// cables and applies them again). Every jack is a node: an output is a node that can feed several
// inputs, an input is a node (or a gain feeding an AudioParam) that takes one cable. Control voltage
// is ordinary audio-rate signal: pitch in octaves (1 = one octave up), the envelope 0..1, the LFO
// -1..1. Gates are events: the sequencer's GATE output calls the envelopes patched to it; patched to
// a normal input it is also a 0/1 signal.
const SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];    // the sequencer's notes: minor pentatonic, two octaves
export const SEQ_NOTES = SCALE.length;
const BASE = 130.81;                                     // C3: an oscillator with its PITCH knob in the middle
const WAVES = ['sine', 'triangle', 'sawtooth', 'square'];
const log = (v, a, b) => a * Math.pow(b / a, v);          // knob 0..1 onto a log range

export function createEngine(ctx, dest) {
  const J = {};                                          // jack id -> { node, type: 'audio'|'cv'|'gate', dir, ... }
  const P = {};                                          // param id -> fn(v 0..1)
  const meters = {};                                     // LED id -> analyser
  const stops = [];                                      // sources to stop on dispose
  const t = () => ctx.currentTime;
  const gain = (v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const smooth = (param, v, tc = 0.015) => param.setTargetAtTime(v, t(), tc);
  const meter = (id, node) => { const a = ctx.createAnalyser(); a.fftSize = 256; node.connect(a); meters[id] = a; };
  const out = (id, node, type = 'audio') => { J[id] = { node, type, dir: 'out' }; };
  const inp = (id, node, type = 'audio', onPatch) => { J[id] = { node, type, dir: 'in', onPatch }; };

  // ---- sequencer: PITCH (octaves) and GATE, 8 steps
  const seq = { notes: new Array(8).fill(0.5), on: new Array(8).fill(true), bpm: 120, len: 0.5, run: true, playing: false,
    step: -1, next: 0, timer: 0, queue: [], gates: new Set() };
  const pitch = ctx.createConstantSource(); pitch.offset.value = 0; pitch.start(); stops.push(pitch);
  const gateSig = ctx.createConstantSource(); gateSig.offset.value = 0; gateSig.start(); stops.push(gateSig);
  out('seq.pitch', pitch, 'cv'); out('seq.gate', gateSig, 'gate');
  J['seq.gate'].listeners = seq.gates;
  for (let i = 0; i < 8; i++) {
    P['seq.n' + i] = (v) => { seq.notes[i] = v; };
  }
  P['seq.tempo'] = (v) => { seq.bpm = Math.round(60 + v * 140); };
  P['seq.len'] = (v) => { seq.len = 0.1 + v * 0.85; };
  function tick() {                                      // schedule the steps of the next 120 ms
    if (!seq.playing || !seq.run) return;
    const dur = 60 / seq.bpm / 2;                        // eighth notes
    if (seq.next < t()) seq.next = t() + 0.03;
    while (seq.next < t() + 0.12) {
      seq.step = (seq.step + 1) % 8;
      const i = seq.step, at = seq.next;
      seq.queue.push({ i, at });
      if (seq.on[i]) {
        const semis = SCALE[Math.round(seq.notes[i] * (SCALE.length - 1))];
        pitch.offset.setValueAtTime(semis / 12, at);
        gateSig.offset.setValueAtTime(1, at); gateSig.offset.setValueAtTime(0, at + dur * seq.len);
        seq.gates.forEach((g) => g.gate(at, at + dur * seq.len));
      }
      seq.next += dur;
    }
  }
  seq.start = () => { if (seq.playing) return; seq.playing = true; seq.next = t() + 0.05; seq.timer = setInterval(tick, 25); tick(); };
  seq.stop = () => {
    seq.playing = false; clearInterval(seq.timer); seq.queue.length = 0;
    gateSig.offset.cancelScheduledValues(t()); gateSig.offset.setValueAtTime(0, t());
    seq.gates.forEach((g) => g.release(t()));
  };
  seq.current = () => {                                  // the step sounding now (for the LEDs)
    while (seq.queue.length > 1 && seq.queue[1].at <= t()) seq.queue.shift();
    return seq.queue.length && seq.queue[0].at <= t() ? seq.queue[0].i : -1;
  };

  // ---- two oscillators
  ['osc1', 'osc2'].forEach((id) => {
    const o = ctx.createOscillator(); o.frequency.value = BASE; o.start(); stops.push(o);
    const cv = gain(1200); cv.connect(o.detune);          // 1 = one octave
    const lvl = gain(0.5); o.connect(lvl);
    const st = { semis: 0, fine: 0 };
    const tune = () => { smooth(o.frequency, BASE * Math.pow(2, st.semis / 12), 0.005); smooth(o.detune, st.fine, 0.005); };
    P[id + '.wave'] = (v) => { const w = WAVES[Math.round(v * 3)]; o.type = w; lvl.gain.value = w === 'square' ? 0.32 : w === 'sawtooth' ? 0.4 : 0.55; };
    P[id + '.pitch'] = (v) => { st.semis = Math.round(v * 48) - 24; tune(); };
    P[id + '.fine'] = (v) => { st.fine = (v - 0.5) * 100; tune(); };
    inp(id + '.cv', cv, 'cv'); out(id + '.out', lvl);
  });

  // ---- noise with a colour filter
  {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.start(); stops.push(src);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.3;
    const lvl = gain(0.45); src.connect(lp); lp.connect(lvl);
    P['noise.color'] = (v) => smooth(lp.frequency, log(v, 300, 18000));
    out('noise.out', lvl);
  }

  // ---- LFO
  {
    const o = ctx.createOscillator(); o.start(); stops.push(o);
    const depth = gain(0.5); o.connect(depth);
    P['lfo.rate'] = (v) => smooth(o.frequency, log(v, 0.05, 20));
    P['lfo.shape'] = (v) => { o.type = WAVES[Math.round(v * 3)]; };
    P['lfo.depth'] = (v) => smooth(depth.gain, v * v);
    out('lfo.out', depth, 'cv'); meter('lfo', depth);
  }

  // ---- envelope (ADSR) on a gate
  {
    const cs = ctx.createConstantSource(); cs.offset.value = 0; cs.start(); stops.push(cs);
    const e = { a: 0.01, d: 0.3, s: 0.5, r: 0.3 };
    const hold = (at) => { const p = cs.offset; if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(at); else { p.cancelScheduledValues(at); } };
    const env = {
      gate(on, off) {
        const p = cs.offset; hold(on);
        p.setTargetAtTime(1, on, e.a / 3); p.setTargetAtTime(e.s, on + e.a, e.d / 3);
        if (off !== undefined) { if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(off); p.setTargetAtTime(0, Math.max(off, on + e.a * 0.8), e.r / 3); }
      },
      release(at) { hold(at); cs.offset.setTargetAtTime(0, at, e.r / 3); },
    };
    P['env.a'] = (v) => { e.a = log(v, 0.002, 2); };
    P['env.d'] = (v) => { e.d = log(v, 0.02, 2.5); };
    P['env.s'] = (v) => { e.s = v; };
    P['env.r'] = (v) => { e.r = log(v, 0.02, 4); };
    inp('env.gate', null, 'gate'); J['env.gate'].env = env;
    out('env.out', cs, 'cv'); meter('env', cs);
  }

  // ---- mixer
  {
    const sum = gain(1);
    [1, 2, 3].forEach((i) => { const g = gain(0.7); g.connect(sum); inp('mix.in' + i, g); P['mix.l' + i] = (v) => smooth(g.gain, v * v); });
    out('mix.out', sum);
  }

  // ---- low-pass filter, CV on its cutoff (octaves via detune)
  {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    const cv = gain(2400); cv.connect(f.detune);
    const lvl = gain(0.8); f.connect(lvl);
    P['filter.cut'] = (v) => smooth(f.frequency, log(v, 40, 14000));
    P['filter.res'] = (v) => { smooth(f.Q, 0.5 + v * v * 22); smooth(lvl.gain, 0.8 / (1 + v * 1.6)); };
    P['filter.amt'] = (v) => smooth(cv.gain, v * 4800);
    inp('filter.in', f); inp('filter.cv', cv, 'cv'); out('filter.out', lvl);
  }

  // ---- VCA: LEVEL alone opens it; with a CV patched, the CV opens it and LEVEL scales the CV
  {
    const v = gain(0.8), cv = gain(0.8); cv.connect(v.gain);
    const st = { level: 0.8, patched: false };
    const apply = () => { smooth(v.gain, st.patched ? 0 : st.level, 0.01); smooth(cv.gain, st.level, 0.01); };
    P['vca.level'] = (x) => { st.level = x; apply(); };
    inp('vca.in', v); inp('vca.cv', cv, 'cv', (on) => { st.patched = on; apply(); }); out('vca.out', v);
  }

  // ---- chorus: two short delays swung by a slow LFO
  {
    const inG = gain(1), dry = gain(1), wet = gain(0.5), sum = gain(0.8);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.6; lfo.start(); stops.push(lfo);
    const amt = gain(0.003); lfo.connect(amt);
    const inv = gain(-1); amt.connect(inv);
    [amt, inv].forEach((m) => { const d = ctx.createDelay(0.05); d.delayTime.value = 0.012; m.connect(d.delayTime); inG.connect(d); d.connect(wet); });
    inG.connect(dry); dry.connect(sum); wet.connect(sum);
    P['chorus.rate'] = (v) => smooth(lfo.frequency, log(v, 0.1, 6));
    P['chorus.depth'] = (v) => smooth(amt.gain, 0.0002 + v * 0.0065);
    P['chorus.mix'] = (v) => { smooth(wet.gain, v * 0.8); smooth(dry.gain, 1 - v * 0.5); };
    inp('chorus.in', inG); out('chorus.out', sum);
  }

  // ---- reverb: a convolver with a made-up decaying noise tail (room, hall, cave)
  {
    const inG = gain(1), dry = gain(1), wet = gain(0.4), sum = gain(0.9), conv = ctx.createConvolver();
    const tails = {};
    const tail = (sec) => {
      if (tails[sec]) return tails[sec];
      const n = Math.round(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
      return (tails[sec] = b);
    };
    inG.connect(dry); inG.connect(conv); conv.connect(wet); dry.connect(sum); wet.connect(sum);
    P['reverb.size'] = (v) => { const b = tail([0.7, 2.2, 5][Math.round(v * 2)]); if (conv.buffer !== b) conv.buffer = b; };
    P['reverb.mix'] = (v) => { smooth(wet.gain, v * 0.9); smooth(dry.gain, 1 - v * 0.6); };
    inp('reverb.in', inG); out('reverb.out', sum);
  }

  // ---- output: two inputs, a level, on into the chain (slot 'synth')
  const master = gain(0);
  {
    const sum = gain(1), lvl = gain(0.6);
    inp('out.in', sum); inp('out.in2', sum);
    sum.connect(lvl); lvl.connect(master); master.connect(dest);
    P["out.level"] = (v) => smooth(lvl.gain, v * v * 4.4);
    meter('out', master);
  }

  // ---- patching
  function connect(a, b) {                               // a: output jack id, b: input jack id; false if they don't fit
    const A = J[a], B = J[b];
    if (!A || !B) return false;
    if (B.type === 'gate') { if (!A.listeners) return false; A.listeners.add(B.env); return true; }
    A.node.connect(B.node);
    if (B.onPatch) B.onPatch(true);
    return true;
  }
  function disconnect(a, b) {
    const A = J[a], B = J[b];
    if (!A || !B) return;
    if (B.type === 'gate') { if (A.listeners) { A.listeners.delete(B.env); B.env.release(t()); } return; }
    try { A.node.disconnect(B.node); } catch (e) { /* was not connected */ }
    if (B.onPatch) B.onPatch(false);
  }
  const fits = (a, b) => !!J[a] && !!J[b] && (J[b].type !== 'gate' || !!J[a].listeners);

  // the level an LED shows (0..1)
  const lb = new Float32Array(256);
  function level(id) {
    const a = meters[id]; if (!a) return 0;
    a.getFloatTimeDomainData(lb);
    if (id === 'out') { let s = 0; for (let i = 0; i < lb.length; i++) s = Math.max(s, Math.abs(lb[i])); return Math.min(1, s * 1.6); }
    return lb[lb.length - 1];
  }

  return {
    J, set: (id, v) => { if (P[id]) P[id](v); }, connect, disconnect, fits, level, seq,
    setOn: (i, on) => { seq.on[i] = on; },
    play(on) {                                           // fade in/out with the stations that listen
      master.gain.setTargetAtTime(on ? 1 : 0, t(), on ? 0.05 : 0.12);
      if (on) seq.start(); else seq.stop();
    },
    dispose() { seq.stop(); stops.forEach((s) => { try { s.stop(); } catch (e) { /* already stopped */ } }); },
  };
}
