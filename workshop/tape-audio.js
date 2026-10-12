// The tape delay's sound (WORKSHOP_PLAN phase W3), after Simon's prototype: a tape loop with an
// erase head, a record head and five playback heads in a row. Web Audio, no samples.
//
//   input ─┬──────────────────────────────────────────────── dry ──────────────┐
//          └► record bus ◄── feedback (heads) ◄─┐                               ├─► output
//               ▲   │                           │                               │
//    sound-on-   │   ▼ saturation ► tone ► tape ─┼► head 1..5 delays ► on/off ► pan ► wet ┘
//    sound loop  └── loop delay (one turn) ◄─────┘          (+ hiss, wow and flutter)
//
// Every head is a delay of distance / tape speed. Changing the motor speed glides every delay
// time, so the echoes bend in pitch while it changes, as on real tape. The loop delay is one full
// turn of the tape: with the erase head off, what was recorded comes round again and is recorded
// over (sound-on-sound); the saturation and a gain under 1 keep the layers from ever getting loud.
// Wear (0..1) adds wow and flutter, hiss, a duller tone and dropouts (the caller schedules those).
//
// createTape(ctx, { heads: [d1..d5], erase: dErase, loop: L, v0 }) with distances in metres along
// the tape from the record head; v0 = tape speed in m/s at speed 1.
const PANS = [-0.8, -0.4, 0, 0.4, 0.8];               // the heads across the stereo field, left to right
const MIN_SPEED = 0.2;                                 // a stopped motor: the tape slows to this, then fades

export function createTape(ctx, geo) {
  const t = ctx.currentTime;
  const g = (v = 1) => { const x = ctx.createGain(); x.gain.value = v; return x; };
  const input = g(), output = g(), dry = g(1), wet = g(0);
  input.connect(dry); dry.connect(output);
  // the record bus, saturation (tape compresses, never clips hard), tone, the tape itself
  const rec = g(1), pre = g(0.9);
  const sat = ctx.createWaveShaper();
  const N = 2048, curve = new Float32Array(N), k = 1.7;
  for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * 2 - 1; curve[i] = Math.tanh(k * x) / Math.tanh(k); }
  sat.curve = curve; sat.oversample = '2x';
  const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 9000; tone.Q.value = 0.5;
  const low = ctx.createBiquadFilter(); low.type = 'highpass'; low.frequency.value = 70;
  const tape = g(1);                                   // dropouts and the motor's fade act here
  input.connect(rec); rec.connect(pre); pre.connect(sat); sat.connect(tone); tone.connect(low); low.connect(tape);
  const meter = ctx.createAnalyser(); meter.fftSize = 512; tape.connect(meter);
  // one turn of the loop back to the record head (sound-on-sound when the erase head is off)
  const MAXD = geo.loop / (geo.v0 * MIN_SPEED) + 1;
  const loopD = ctx.createDelay(MAXD), sos = g(0);
  tape.connect(loopD); loopD.connect(sos); sos.connect(rec);
  // the five playback heads
  const fbSum = g(1), fb = g(0), fbHp = ctx.createBiquadFilter(); fbHp.type = 'highpass'; fbHp.frequency.value = 160;
  const wetSum = g(1), comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = 0.005; comp.release.value = 0.25;
  const heads = geo.heads.map((d, i) => {
    const dl = ctx.createDelay(MAXD), on = g(0);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    tape.connect(dl); dl.connect(on); on.connect(fbSum);
    if (pan) { pan.pan.value = PANS[i]; on.connect(pan); pan.connect(wetSum); } else on.connect(wetSum);
    return { d, dl, on, pan, mod: g(0) };
  });
  fbSum.connect(fbHp); fbHp.connect(fb); fb.connect(rec);
  wetSum.connect(comp); comp.connect(wet); wet.connect(output);
  // hiss, into the heads' sum (it is on the tape, so it comes out wherever the heads play)
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource(); noise.buffer = nb; noise.loop = true;
  const hissF = ctx.createBiquadFilter(); hissF.type = 'bandpass'; hissF.frequency.value = 5500; hissF.Q.value = 0.4;
  const hiss = g(0); noise.connect(hissF); hissF.connect(hiss); hiss.connect(wetSum); noise.start(t);
  // wow (slow) and flutter (fast), one shared modulation scaled per delay by its own time
  const wow = ctx.createOscillator(); wow.frequency.value = 0.55;
  const flut = ctx.createOscillator(); flut.frequency.value = 6.3;
  const flutG = g(0.3), modSum = g(1);
  wow.connect(modSum); flut.connect(flutG); flutG.connect(modSum);
  const loopMod = g(0); modSum.connect(loopMod); loopMod.connect(loopD.delayTime);
  heads.forEach((h) => { modSum.connect(h.mod); h.mod.connect(h.dl.delayTime); });
  wow.start(t); flut.start(t);

  const S = { speed: 1, run: true, power: true, feedback: 0.35, mix: 0.5, erase: true, wear: 0, on: [true, false, true, false, true] };
  const ramp = (p, v, tc = 0.03) => p.setTargetAtTime(v, ctx.currentTime, tc);
  // the tape's real speed (m/s): the motor ramps, a stopped tape slows to MIN_SPEED and fades out
  function times(tc) {
    const sp = S.run ? S.speed : MIN_SPEED, v = geo.v0 * sp;
    heads.forEach((h) => { ramp(h.dl.delayTime, h.d / v, tc); ramp(h.mod.gain, (h.d / v) * depth(), 0.2); });
    ramp(loopD.delayTime, geo.loop / v, tc); ramp(loopMod.gain, (geo.loop / v) * depth() * 0.5, 0.2);
  }
  const depth = () => 0.0012 + S.wear * S.wear * 0.006;   // fraction of the delay time
  function levels() {
    const n = S.on.filter(Boolean).length;
    S.on.forEach((on, i) => ramp(heads[i].on.gain, on ? 1 : 0, 0.015));
    // the heads' sum feeds back: at most just over 1 / n per head, so even five heads at full
    // feedback only build up into the saturation (a long smear), never a runaway
    ramp(fb.gain, n ? (S.feedback * 1.02) / n : 0);
    ramp(sos.gain, S.erase ? 0 : 0.8 - S.feedback * 0.18 - S.wear * 0.08, 0.05);
    ramp(pre.gain, S.erase ? 0.9 : 0.72);
    const live = S.power, m = S.mix;
    ramp(dry.gain, live ? Math.cos(m * Math.PI / 2) * 0.95 + 0.05 : 1, 0.05);
    ramp(wet.gain, live ? Math.sin(m * Math.PI / 2) * 1.25 : 0, 0.08);
    ramp(tape.gain, S.run && live ? 1 : 0, S.run ? 0.05 : 0.35);
    ramp(hiss.gain, S.run && live ? 0.006 + S.wear * 0.03 : 0, 0.2);
    ramp(tone.frequency, 9000 - S.wear * 6200, 0.3);
  }
  const api = {
    input, output, state: S,
    set(o) {
      const sp = S.speed, run = S.run;
      Object.assign(S, o);
      if (o.on) S.on = [...o.on];
      levels();
      if (S.speed !== sp || S.run !== run || 'wear' in o) times(S.run !== run ? (S.run ? 0.35 : 0.5) : 0.22);
    },
    // a dropout: the tape lifts off the heads for a moment
    dropout(len = 0.08, depthTo = 0.15) {
      if (!S.run || !S.power) return;
      const now = ctx.currentTime;
      tape.gain.cancelScheduledValues(now); tape.gain.setValueAtTime(tape.gain.value, now);
      tape.gain.linearRampToValueAtTime(depthTo, now + 0.012);
      tape.gain.setValueAtTime(depthTo, now + len);
      tape.gain.linearRampToValueAtTime(1, now + len + 0.04);
    },
    // the recorded level right now (0..1), for the picture of the sound on the tape
    level(buf) {
      meter.getFloatTimeDomainData(buf);
      let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      return Math.sqrt(s / buf.length);
    },
    stop() { try { noise.stop(); wow.stop(); flut.stop(); } catch (e) { /* closed */ } },
  };
  levels(); times(0.01);
  return api;
}

// ---- the demo loop (until Simon's own recording is there): a sparse kalimba-like phrase with a
// soft knock, made here (no sample files). Gaps on purpose, so every echo can be heard.
// 2 bars at 84 BPM in D minor pentatonic. Cached per sample rate.
const cache = new Map();
export function demoLoop(ctx) {
  const sr = ctx.sampleRate;
  if (cache.has(sr)) { const b = cache.get(sr); const out = ctx.createBuffer(2, b[0].length, sr); out.copyToChannel(b[0], 0); out.copyToChannel(b[1], 1); return out; }
  const beat = 60 / 84, len = Math.round(beat * 8 * sr);
  const L = new Float32Array(len), R = new Float32Array(len);
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // [beat, midi note, velocity]
  const notes = [[0, 62, 1], [0.75, 69, 0.7], [1.5, 72, 0.8], [3, 67, 0.75], [4, 65, 0.9], [4.5, 69, 0.6], [5.5, 74, 0.7], [6.5, 72, 0.55]];
  notes.forEach(([b, m, v], n) => {
    const f = hz(m), s0 = Math.round(b * beat * sr), dur = Math.round(1.6 * sr), p = (n % 2 ? 0.25 : -0.25);
    for (let i = 0; i < dur && s0 + i < len; i++) {
      const tt = i / sr;
      const env = Math.min(1, tt * 400) * Math.exp(-tt * 3.2);
      const tine = Math.sin(2 * Math.PI * f * tt) + 0.35 * Math.sin(2 * Math.PI * f * 2.01 * tt) * Math.exp(-tt * 9)
        + 0.18 * Math.sin(2 * Math.PI * f * 5.43 * tt) * Math.exp(-tt * 28);
      const x = tine * env * v * 0.32;
      L[s0 + i] += x * (1 - p); R[s0 + i] += x * (1 + p);
    }
  });
  // the knock: a short low thump on beats 0 and 4, a rim tick on 2.5 and 6.75
  [[0, 1], [4, 1], [2.5, 0], [6.75, 0]].forEach(([b, low]) => {
    const s0 = Math.round(b * beat * sr), dur = Math.round(0.12 * sr);
    let ph = 0;
    for (let i = 0; i < dur; i++) {
      const tt = i / sr;
      const x = low ? Math.sin(ph) * Math.exp(-tt * 38) * 0.42 : (Math.random() * 2 - 1) * Math.exp(-tt * 160) * 0.16;
      ph += 2 * Math.PI * (low ? 65 + 90 * Math.exp(-tt * 50) : 0) / sr;
      L[s0 + i] += x; R[s0 + i] += x;
    }
  });
  // a fade at the loop seam
  for (let i = 0; i < 256; i++) { const k = i / 256; L[len - 1 - i] *= k; R[len - 1 - i] *= k; }
  cache.set(sr, [L, R]);
  return demoLoop(ctx);
}
