// The server rack's sounds (WORKSHOP_PLAN phase W5): a soft fan hum that rises as the fans spin up,
// a little computer chatter while the rack "thinks" after a round, and short blips for the result.
// Everything is made here from oscillators and a noise buffer; it plays into the workshop's effects
// bus (workshop/audio.js `bus()`), so the master volume and mute apply but the chain's pedal and
// delay don't.
//   const snd = createRackSound(ctx, out)
//   snd.fan(spin)          every frame: the fans' speed (0 = silent, ~13 = flat out)
//   snd.think(seconds)     chatter for that long
//   snd.result(res)        0 = you win, 1 = the rack wins, 2 = draw, 'verdict' = the match is over
//   snd.forget()           a falling sweep
const SCALE = [523.3, 587.3, 659.3, 784, 880, 1046.5, 1174.7, 1318.5];   // pentatonic-ish, so the chatter never grates

export function createRackSound(ctx, out) {
  const t = () => ctx.currentTime;
  const bus = ctx.createGain(); bus.gain.value = 2; bus.connect(out);
  // fan: looped noise through a low band-pass, louder and brighter with speed
  const n = Math.round(ctx.sampleRate * 2), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  let b = 0;
  for (let i = 0; i < n; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 6; }   // soft brown-ish noise
  const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.8; bp.frequency.value = 160;
  const fanG = ctx.createGain(); fanG.gain.value = 0;
  noise.connect(bp); bp.connect(fanG); fanG.connect(bus); noise.start();
  let fanLast = -1;

  function tone(f, at, dur, { type = 'square', vol = 0.05, to = 0 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, at);
    if (to) o.frequency.exponentialRampToValueAtTime(to, at + dur);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol, at + 0.005); g.gain.setTargetAtTime(0, at + dur * 0.6, dur * 0.25);
    o.connect(g); g.connect(bus); o.start(at); o.stop(at + dur + 0.3);
  }
  return {
    fan(spin) {
      const s = Math.max(0, spin);
      if (Math.abs(s - fanLast) < 0.05) return;
      fanLast = s;
      fanG.gain.setTargetAtTime(s ? 0.012 + Math.min(1, s / 12) * 0.05 : 0, t(), 0.15);
      bp.frequency.setTargetAtTime(140 + s * 45, t(), 0.15);
    },
    think(sec) {
      const t0 = t() + 0.02, k = Math.max(3, Math.round(sec * 14));
      for (let i = 0; i < k; i++) if (Math.random() < 0.75) tone(SCALE[Math.floor(Math.random() * SCALE.length)] * 2, t0 + i * sec / k, 0.025, { vol: 0.018 });
    },
    result(res) {
      const t0 = t() + 0.04;
      if (res === 'verdict') [523.3, 659.3, 784, 1046.5].forEach((f, i) => tone(f, t0 + i * 0.11, 0.18, { type: 'triangle', vol: 0.09 }));
      else if (res === 0) [659.3, 880].forEach((f, i) => tone(f, t0 + i * 0.09, 0.14, { type: 'triangle', vol: 0.08 }));   // you win: up
      else if (res === 1) [392, 293.7].forEach((f, i) => tone(f, t0 + i * 0.1, 0.12, { vol: 0.045 }));   // the rack wins: down
      else [523.3, 523.3].forEach((f, i) => tone(f, t0 + i * 0.1, 0.07, { type: 'triangle', vol: 0.06 }));   // draw
    },
    forget() { tone(1400, t() + 0.02, 0.6, { type: 'sine', vol: 0.07, to: 90 }); },
  };
}
