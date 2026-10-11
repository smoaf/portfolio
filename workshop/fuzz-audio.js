// The fuzz pedal's sound and the guitar loop it plays (WORKSHOP_PLAN phase W2). Used by
// workshop/solder.js; nothing here touches the scene.
//
// The pedal is modelled loosely on the two-transistor circuit in the schematic on the bench:
//   IN ─ 2.2µF ─ Q1 ─ Q2 ─ 10nF ─ VOLUME (500k) ─ OUT, FUZZ (1k) sets how much of Q2's gain is used
// Here: a coupling high-pass, a gain stage whose amount is the FUZZ knob, two clipping stages (the
// first soft and lopsided like a transistor, which makes the warm even harmonics; the second harder),
// a DC blocker, a gentle low-pass that closes a little as the fuzz goes up, and the VOLUME. Like the
// real thing it cleans up when the input gets quieter (the interface's LEVEL knob).
//
// The guitar loop is made here too (no sample file): plucked strings by the Karplus-Strong method,
// a short original riff in E, rendered once per sample rate and kept for the next visit.

// a waveshaper curve: soft, lopsided (positive side clips earlier, as a biased transistor does)
function curve(fn, n = 2048) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = fn(x); }
  return c;
}
const SOFT = curve((x) => (x >= 0 ? Math.tanh(x * 1.6) / Math.tanh(1.6) : Math.tanh(x * 0.9) / Math.tanh(1.6) * 1.15));
const HARD = curve((x) => Math.max(-0.9, Math.min(0.9, x * 1.3)) / 0.9 * 0.82 + Math.tanh(x * 3) * 0.12);

export function createFuzz(ctx) {
  const input = ctx.createGain();
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 110; hp.Q.value = 0.6;   // the input capacitor
  const pre = ctx.createGain();
  const s1 = ctx.createWaveShaper(); s1.curve = SOFT; s1.oversample = '4x';
  const mid = ctx.createGain();
  const s2 = ctx.createWaveShaper(); s2.curve = HARD; s2.oversample = '4x';
  const dc = ctx.createBiquadFilter(); dc.type = 'highpass'; dc.frequency.value = 35;
  const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 700; body.Q.value = 0.8; body.gain.value = 3;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.5;
  const vol = ctx.createGain();
  input.connect(hp); hp.connect(pre); pre.connect(s1); s1.connect(mid); mid.connect(s2); s2.connect(dc);
  dc.connect(body); body.connect(lp); lp.connect(vol);
  const out = ctx.createGain();
  vol.connect(out);
  const meter = ctx.createAnalyser(); meter.fftSize = 1024; out.connect(meter);
  const buf = new Float32Array(meter.fftSize);
  const t = () => ctx.currentTime;
  return {
    input, output: out,
    // fuzz, volume: 0..1 (the knobs)
    set(fuzz, volume) {
      const g = 1.5 + fuzz * fuzz * 90;               // the FUZZ pot lets Q2 work harder
      pre.gain.setTargetAtTime(g, t(), 0.02);
      mid.gain.setTargetAtTime(1 + fuzz * 2.5, t(), 0.02);
      lp.frequency.setTargetAtTime(6200 - fuzz * 2600, t(), 0.02);
      // loudness: the clipped signal is near full scale, so the volume taper does the rest
      vol.gain.setTargetAtTime(Math.pow(volume, 1.6) * (0.55 - fuzz * 0.15), t(), 0.02);
    },
    rms() {                                            // output level, for the multimeter's AC volts
      meter.getFloatTimeDomainData(buf);
      let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      return Math.sqrt(s / buf.length);
    },
    dispose() { [input, hp, pre, s1, mid, s2, dc, body, lp, vol, out, meter].forEach((n) => n.disconnect()); },
  };
}

// ---- the guitar loop
const BPM = 100, BEAT = 60 / BPM, BARS = 4;
const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const E2 = 40, G2 = 43, A2 = 45, B2 = 47, D3 = 50;
const pow5 = (r) => [r, r + 7, r + 12];                // a power chord: root, fifth, octave
// [beat, notes, length in beats, palm-muted]
const RIFF = [
  [0, pow5(E2), 1.5, false], [1.5, [G2 + 12], 0.5, true], [2, pow5(A2), 1, false], [3, [G2], 0.5, true], [3.5, [A2], 0.5, true],
  [4, [E2 + 12], 0.5, false], [4.5, [G2 + 12], 0.5, false], [5, [A2 + 12], 0.5, false], [5.5, [A2 + 12 + 2], 0.5, false],
  [6, [A2 + 12], 0.5, false], [6.5, [G2 + 12], 0.5, false], [7, [E2 + 12], 0.5, false], [7.5, [D3], 0.5, true],
  [8, pow5(E2), 1.5, false], [9.5, [G2 + 12], 0.5, true], [10, pow5(G2), 1, false], [11, pow5(A2), 0.5, false], [11.5, [A2], 0.5, true],
  [12, pow5(B2), 2.5, false], [14.5, [A2], 0.5, true], [15, [G2], 0.5, true], [15.5, [E2 + 12], 0.5, false],
];
let cache = null;
export function guitarLoop(ctx) {
  const sr = ctx.sampleRate;
  if (cache && cache.sr === sr) return toBuffer(ctx, cache.data, sr);
  const len = Math.round(BARS * 4 * BEAT * sr), data = new Float32Array(len);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  RIFF.forEach(([beat, notes, dur, mute]) => {
    notes.forEach((m, k) => {
      const t0 = Math.round((beat * BEAT + k * 0.009) * sr);   // strummed: 9 ms between strings
      pluck(data, t0, Math.round(dur * BEAT * sr), midiHz(m), mute, sr, rnd, notes.length > 1 ? 0.22 : 0.32);
    });
  });
  // one-pole DC blocker and a peak normalise to about 0.5 (a hot single-coil guitar)
  let px = 0, py = 0, peak = 0;
  for (let i = 0; i < len; i++) { const y = data[i] - px + 0.995 * py; px = data[i]; py = y; data[i] = y; peak = Math.max(peak, Math.abs(y)); }
  const k = 0.5 / (peak || 1); for (let i = 0; i < len; i++) data[i] *= k;
  cache = { sr, data };
  return toBuffer(ctx, data, sr);
}
function toBuffer(ctx, data, sr) { const b = ctx.createBuffer(1, data.length, sr); b.copyToChannel(data, 0); return b; }
// Karplus-Strong: a burst of noise in a delay line one period long, averaged on every pass
function pluck(out, t0, dur, hz, mute, sr, rnd, amp) {
  const N = Math.max(2, Math.round(sr / hz)), line = new Float32Array(N);
  let prev = 0;
  for (let i = 0; i < N; i++) { const v = rnd(); prev = prev * (mute ? 0.75 : 0.35) + v * (mute ? 0.25 : 0.65); line[i] = prev; }   // the pick: softer when muted
  const decay = mute ? 0.955 : 0.9965, rel = Math.round(0.03 * sr);
  const total = Math.min(out.length - t0, dur + rel + (mute ? 0 : Math.round(0.05 * sr)));
  let j = 0;
  for (let n = 0; n < total; n++) {
    const a = line[j], b = line[(j + 1) % N];
    line[j] = decay * 0.5 * (a + b);
    j = (j + 1) % N;
    let env = 1;
    if (n > dur) env = Math.max(0, 1 - (n - dur) / rel);   // let go of the string
    if (t0 + n >= 0) out[t0 + n] += a * amp * env;
  }
}
