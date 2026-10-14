// Sound for the radio room (RELAY_PLAN phase R2), all made in Web Audio: no files to load.
//   static     filtered noise with crackles, loud between stations, it fades as a signal comes in
//   whistle    the heterodyne whine of a voice carrier tuned slightly off (it falls as you get close)
//   sidetone   the Morse key's own beep, straight to the speaker (not through the receiver)
//   voice      speech-like blips: a buzzing source through two formant filters, one syllable per
//              few letters, vowels from the text, so the subtitles and the sound keep in step
//   morse      a keyed tone at a given speed; reports each letter as it is sent
// Every station plays into its own gain (`out`), which the game turns up and down with the tuning.
// The receiver's sound goes through a band-pass (300 Hz – 3 kHz), like a real shortwave set.
// The context is made from a click (browser rule) and closed on leaving the room. Mute is the one
// the safari and the workshop use (same localStorage key).
import { mutedByDefault, saveMute } from '../safari/audio.js';

const MASTER = 0.7;

export function noiseBuffer(ctx, seconds = 2) {
  const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

export function createRadioAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  let muted = mutedByDefault();
  const master = ctx.createGain(); master.gain.value = muted ? 0 : MASTER;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.25;
  master.connect(comp); comp.connect(ctx.destination);
  // the receiver: everything tuned in goes through its band-pass
  const rx = ctx.createGain();
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 280; hp.Q.value = 0.7;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000; lp.Q.value = 0.8;
  rx.connect(hp); hp.connect(lp); lp.connect(master);
  const noise = noiseBuffer(ctx);
  // static: band-passed noise; crackles come from pop()
  const st = ctx.createGain(); st.gain.value = 0; st.connect(rx);
  const n1 = ctx.createBufferSource(); n1.buffer = noise; n1.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 0.4;
  n1.connect(bp); bp.connect(st); n1.start();
  // the whistle of a carrier slightly off tune
  const wh = ctx.createOscillator(); wh.type = 'sine'; wh.frequency.value = 600;
  const whg = ctx.createGain(); whg.gain.value = 0; wh.connect(whg); whg.connect(rx); wh.start();
  // the Morse key's sidetone
  const side = ctx.createOscillator(); side.type = 'sine'; side.frequency.value = 650;
  const sideg = ctx.createGain(); sideg.gain.value = 0; side.connect(sideg); sideg.connect(master); side.start();

  const A = {
    ctx, rx, noise,
    get now() { return ctx.currentTime; },
    station() { const g = ctx.createGain(); g.gain.value = 0; g.connect(rx); return g; },   // a station's own level
    setStatic(level) { st.gain.setTargetAtTime(level, ctx.currentTime, 0.05); },
    setWhistle(level, hz) { whg.gain.setTargetAtTime(level, ctx.currentTime, 0.04); wh.frequency.setTargetAtTime(hz, ctx.currentTime, 0.03); },
    pop(level) {                                                   // one crackle of static
      const s = ctx.createBufferSource(); s.buffer = noise;
      const g = ctx.createGain(), t = ctx.currentTime;
      g.gain.setValueAtTime(level, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.05);
      s.connect(g); g.connect(rx); s.start(t, Math.random() * 1.5, 0.1);
    },
    key(down) { sideg.gain.setTargetAtTime(down ? 0.22 : 0, ctx.currentTime, 0.004); },
    get muted() { return muted; },
    mute(on) { muted = !!on; saveMute(muted); master.gain.setTargetAtTime(muted ? 0 : MASTER, ctx.currentTime, 0.03); },
    suspend() { if (ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx.state === 'suspended') ctx.resume(); },
    close() { try { n1.stop(); wh.stop(); side.stop(); } catch (e) { /* already stopped */ } ctx.close().catch(() => {}); },
  };
  return A;
}

// ---- a short tone (beeps, pips, music-box notes)
export function tone(A, out, t, { f = 1000, dur = 0.1, type = 'sine', vol = 0.4, attack = 0.005, release = 0.02, glide = null }) {
  const o = A.ctx.createOscillator(), g = A.ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release)); g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  o.onended = () => { o.disconnect(); g.disconnect(); };
}
// a burst of noise (squelch tails, pulsar ticks)
export function burst(A, out, t, { dur = 0.15, vol = 0.3, f = 2000, q = 0.6, type = 'bandpass' }) {
  const s = A.ctx.createBufferSource(); s.buffer = A.noise;
  const fl = A.ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = A.ctx.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random(), dur + 0.05);
  s.onended = () => { s.disconnect(); fl.disconnect(); g.disconnect(); };
}

// ---- speech-like voice
const VOWELS = { a: [730, 1090], e: [530, 1840], i: [300, 2200], o: [570, 840], u: [320, 900], y: [300, 2100] };
export function voice(A, out, { pitch = 140, bright = 1 } = {}) {
  const ctx = A.ctx;
  const src = ctx.createOscillator(); src.type = 'sawtooth'; src.frequency.value = pitch;
  const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 6;
  const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 9;
  const env = ctx.createGain(); env.gain.value = 0;
  const mix = ctx.createGain(); mix.gain.value = 2.2 * bright;
  src.connect(f1); src.connect(f2); f1.connect(mix); f2.connect(mix); mix.connect(env); env.connect(out);
  const ns = ctx.createBufferSource(); ns.buffer = A.noise; ns.loop = true;
  const nh = ctx.createBiquadFilter(); nh.type = 'highpass'; nh.frequency.value = 2500;
  const ng = ctx.createGain(); ng.gain.value = 0;
  ns.connect(nh); nh.connect(ng); ng.connect(out);
  src.start(); ns.start();
  return {
    // schedule a line from time t; returns when it ends. Syllables follow the text's vowels.
    say(text, t) {
      const words = text.split(/\s+/).filter(Boolean);
      words.forEach((w, wi) => {
        const letters = w.replace(/[^a-z0-9]/gi, '').toLowerCase();
        const n = Math.max(1, Math.round(letters.length / 2.8));
        for (let k = 0; k < n; k++) {
          const chunk = letters.slice(Math.floor(k * letters.length / n), Math.floor((k + 1) * letters.length / n));
          const v = (chunk.match(/[aeiouy]/) || ['a'])[0], [F1, F2] = VOWELS[v];
          const d = 0.1 + Math.random() * 0.07, stress = k === 0 ? 1.12 : 1;
          if (/^[^aeiou]/.test(chunk)) { ng.gain.setValueAtTime(0.25, t); ng.gain.linearRampToValueAtTime(0, t + 0.035); }
          f1.frequency.setValueAtTime(F1 * (0.9 + Math.random() * 0.2), t); f2.frequency.setValueAtTime(F2 * (0.9 + Math.random() * 0.2), t);
          src.frequency.setValueAtTime(pitch * stress * (1 + (Math.random() - 0.5) * 0.12), t);
          src.frequency.linearRampToValueAtTime(pitch * (0.92 + (wi === words.length - 1 && k === n - 1 ? -0.12 : 0)), t + d);
          env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.5, t + 0.02);
          env.gain.setValueAtTime(0.5, t + d - 0.03); env.gain.linearRampToValueAtTime(0, t + d);
          t += d + 0.015;
        }
        t += /[.,!?;:]$/.test(w) ? 0.28 : 0.07;
      });
      return t;
    },
    stop() { try { src.stop(); ns.stop(); } catch (e) { /* stopped */ } [src, f1, f2, env, mix, ns, nh, ng].forEach((n) => n.disconnect()); },
  };
}

// ---- Morse code
export const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
  N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
  '/': '-..-.', '=': '-...-', '?': '..--..', '.': '.-.-.-', '+': '.-.-.',
};
export const DECODE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
export function morse(A, out, { pitch = 700, vol = 0.45 } = {}) {
  const o = A.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = pitch;
  const g = A.ctx.createGain(); g.gain.value = 0;
  o.connect(g); g.connect(out); o.start();
  return {
    // schedule text from time t at `wpm`; onChar(char, time) for each letter; returns the end time
    send(text, t, wpm = 16, onChar) {
      const u = 1.2 / wpm;
      for (const ch of text.toUpperCase()) {
        if (ch === ' ') { t += 4 * u; if (onChar) onChar(' ', t); continue; }
        const code = MORSE[ch]; if (!code) continue;
        for (const s of code) {
          const len = s === '.' ? u : 3 * u;
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.005);
          g.gain.setValueAtTime(vol, t + len - 0.005); g.gain.linearRampToValueAtTime(0, t + len);
          t += len + u;
        }
        if (onChar) onChar(ch, t);
        t += 2 * u;
      }
      return t;
    },
    beep(t, len, v = vol) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.005); g.gain.setValueAtTime(v, t + len - 0.005); g.gain.linearRampToValueAtTime(0, t + len); },
    pitch: (f, t) => o.frequency.setValueAtTime(f, t),
    stop() { try { o.stop(); } catch (e) { /* stopped */ } o.disconnect(); g.disconnect(); },
  };
}
