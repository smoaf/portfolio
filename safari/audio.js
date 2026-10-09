// The safari soundscape. Everything is made in Web Audio (oscillators and filtered noise), so there
// are no audio files to download and nothing to decode: the van's engine, the tyres on gravel, the
// bumps, an ambient bed per terrain and time of day, a few creature calls placed in 3D, and the
// shutter. The context is only created once the visitor has clicked (browser rule) and is closed on
// exit. Mute is remembered in localStorage (Global rule 5).
const MUTE_KEY = 'smo.safari.mute';

export function mutedByDefault() {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { return false; }
}
function saveMute(on) {
  try { localStorage.setItem(MUTE_KEY, on ? '1' : '0'); } catch (e) { /* ignore */ }
}

// one second of noise, reused by every noise voice
function noiseBuffer(ctx) {
  const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
  return b;
}

export function createAudio({ ambience = {}, muted = mutedByDefault() } = {}) {
  let ctx = null, master = null, muffler = null, noise = null, parts = null, closed = false, muffled = 0;
  const state = { muted, speed: 0, started: false };

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    noise = noiseBuffer(ctx);
    master = ctx.createGain();
    master.gain.value = state.muted ? 0 : 0.0001;
    // under water everything goes through a low-pass: the world outside the hull sounds far away
    muffler = ctx.createBiquadFilter(); muffler.type = 'lowpass'; muffler.frequency.value = 18000; muffler.Q.value = 0.4;
    master.connect(muffler); muffler.connect(ctx.destination);
    // listener at the origin; creature calls are placed around it in the van's own frame
    const L = ctx.listener;
    if (L.positionX) { L.positionX.value = 0; L.positionY.value = 0; L.positionZ.value = 0; }

    const src = (buf, loop = true) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = loop; return s; };
    const gain = (v) => { const g = ctx.createGain(); g.gain.value = v; return g; };
    const filter = (type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b; };

    // --- engine: a saw and a sub an octave below, through a low-pass that opens with the speed
    const eng = gain(0), engLp = filter('lowpass', 420, 2);
    const osc1 = ctx.createOscillator(); osc1.type = 'sawtooth'; osc1.frequency.value = 54;
    const osc2 = ctx.createOscillator(); osc2.type = 'square'; osc2.frequency.value = 27;
    const o2g = gain(0.35);
    osc1.connect(eng); osc2.connect(o2g); o2g.connect(eng);
    eng.connect(engLp); engLp.connect(master);
    // a slow wobble, so the hum is never quite steady
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.7;
    const lfoG = gain(1.6); lfo.connect(lfoG); lfoG.connect(osc1.frequency);

    // --- tyres on gravel: band-passed noise, louder and brighter the faster the van rolls
    const tyre = gain(0), tyreBp = filter('bandpass', 900, 0.8);
    const tyreSrc = src(noise); tyreSrc.connect(tyreBp); tyreBp.connect(tyre); tyre.connect(master);

    // --- ambient bed: a wide noise wind plus a narrow band that stands for water or leaves
    const bedA = gain(ambience.wind ?? 0.05), bedALp = filter('lowpass', ambience.windCut ?? 500, 0.6);
    const bedASrc = src(noise); bedASrc.connect(bedALp); bedALp.connect(bedA); bedA.connect(master);
    const bedB = gain(ambience.band ?? 0.02), bedBBp = filter('bandpass', ambience.bandHz ?? 2400, 1.4);
    const bedBSrc = src(noise); bedBSrc.connect(bedBBp); bedBBp.connect(bedB); bedB.connect(master);
    // the wind breathes
    const windLfo = ctx.createOscillator(); windLfo.type = 'sine'; windLfo.frequency.value = 0.08;
    const windG = gain((ambience.wind ?? 0.05) * 0.6); windLfo.connect(windG); windG.connect(bedA.gain);

    [osc1, osc2, lfo, windLfo, tyreSrc, bedASrc, bedBSrc].forEach((n) => n.start());
    parts = { eng, engLp, osc1, osc2, tyre, tyreBp, bedA, bedB, nodes: [osc1, osc2, lfo, windLfo, tyreSrc, bedASrc, bedBSrc] };
    return true;
  }

  // Called from the first gesture inside the safari (and again after a pause).
  function start() {
    if (closed) return;
    if (!ctx && !build()) return;
    if (ctx.state === 'suspended') ctx.resume();
    state.started = true;
    if (!state.muted) master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.4);
  }

  const api = {
    get muted() { return state.muted; },
    get live() { return !!ctx && !closed; },
    start,
    mute(on) {
      state.muted = on; saveMute(on);
      if (master && ctx) master.gain.setTargetAtTime(on ? 0 : 0.9, ctx.currentTime, 0.08);
      return on;
    },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended' && state.started) ctx.resume(); },

    // speed 0..1 of the van, bump 0..1 from the road: the hum rises in pitch, the tyres get louder
    drive(speed, bump = 0) {
      if (!ctx || closed) return;
      state.speed = speed;
      const t = ctx.currentTime;
      parts.osc1.frequency.setTargetAtTime(44 + speed * 52, t, 0.25);
      parts.osc2.frequency.setTargetAtTime(22 + speed * 26, t, 0.25);
      parts.engLp.frequency.setTargetAtTime(260 + speed * 900, t, 0.3);
      parts.eng.gain.setTargetAtTime(0.055 + speed * 0.1, t, 0.3);
      parts.tyre.gain.setTargetAtTime(speed * 0.05, t, 0.2);
      parts.tyreBp.frequency.setTargetAtTime(500 + speed * 1500, t, 0.3);
      if (bump > 0.01) api.bump(bump);
    },
    // 0 = air, 1 = below the surface
    muffle(k) {
      if (!ctx || closed || Math.abs(k - muffled) < 0.01) return;
      muffled = k;
      muffler.frequency.setTargetAtTime(18000 * Math.pow(420 / 18000, k), ctx.currentTime, 0.15);
    },
    // a short thud under the floor when a wheel drops into something
    bump(strength = 1) {
      if (!ctx || closed) return;
      const t = ctx.currentTime, g = ctx.createGain(), lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 160;
      const s = ctx.createBufferSource(); s.buffer = noise;
      s.connect(lp); lp.connect(g); g.connect(master);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.1 * strength + 0.001, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      s.start(t); s.stop(t + 0.3);
    },
    // the shutter: a click, a soft mirror slap, the film winding on
    shutter() {
      if (!ctx || closed) return;
      const t = ctx.currentTime;
      const click = (at, f, dur, vol) => {
        const g = ctx.createGain(), bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 1.2;
        const s = ctx.createBufferSource(); s.buffer = noise;
        s.connect(bp); bp.connect(g); g.connect(master);
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(vol, at + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        s.start(at); s.stop(at + dur + 0.05);
      };
      click(t, 2600, 0.05, 0.3); click(t + 0.03, 900, 0.09, 0.2); click(t + 0.16, 1500, 0.2, 0.08);
    },
    // feed pellets leaving the hatch
    throwPellet() {
      if (!ctx || closed) return;
      const t = ctx.currentTime, g = ctx.createGain(), bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.9;
      const s = ctx.createBufferSource(); s.buffer = noise;
      s.connect(bp); bp.connect(g); g.connect(master);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      s.start(t); s.stop(t + 0.25);
    },
    // a creature call, placed where the creature is (relative to the van, metres)
    call({ x = 0, y = 0, z = -6, hz = 700, kind = 'chirp', vol = 0.5 } = {}) {
      if (!ctx || closed) return;
      const t = ctx.currentTime;
      const pan = ctx.createPanner();
      pan.panningModel = 'equalpower'; pan.distanceModel = 'inverse'; pan.refDistance = 6; pan.maxDistance = 90;
      if (pan.positionX) { pan.positionX.value = x; pan.positionY.value = y; pan.positionZ.value = z; }
      else pan.setPosition(x, y, z);
      const g = ctx.createGain(); g.gain.value = 0.0001;
      pan.connect(master); g.connect(pan);
      if (kind === 'noise') {                               // a rustle or a splash
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = hz; bp.Q.value = 1.1;
        const s = ctx.createBufferSource(); s.buffer = noise;
        s.connect(bp); bp.connect(g);
        g.gain.exponentialRampToValueAtTime(vol * 0.5, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        s.start(t); s.stop(t + 0.6);
        return;
      }
      const o = ctx.createOscillator();                      // a chirp, a hoot or a trill
      o.type = kind === 'hoot' ? 'sine' : 'triangle';
      o.frequency.setValueAtTime(hz, t);
      if (kind === 'chirp') o.frequency.exponentialRampToValueAtTime(hz * 1.9, t + 0.09);
      if (kind === 'hoot') o.frequency.exponentialRampToValueAtTime(hz * 0.7, t + 0.35);
      if (kind === 'trill') for (let k = 0; k < 6; k++) o.frequency.setValueAtTime(hz * (k % 2 ? 1.5 : 1), t + k * 0.055);
      o.connect(g);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'hoot' ? 0.5 : 0.3));
      o.start(t); o.stop(t + 0.6);
    },
    dispose() {
      closed = true;
      if (!ctx) return;
      try { parts.nodes.forEach((n) => n.stop()); } catch (e) { /* already stopped */ }
      try { master.disconnect(); } catch (e) { /* ignore */ }
      ctx.close(); ctx = null; parts = null;
    },
  };
  return api;
}
