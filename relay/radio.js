// "Tune in" (RELAY_PLAN phase R2): the game on the radio room's receiver. One big dial sweeps the
// band from 3 to 12 MHz. Between stations there is static; near one the static fades, the S-meter
// rises and the signal comes in clear (voices and music whistle when slightly off tune, as on a real
// set). Eleven stations are hidden on the band, and a twelfth only exists while the radio telescope
// tracks a moon: the moon-bounce channel, where your own Morse sends come back ~2.5 s later
// (Earth–Moon–Earth, a real radio-amateur technique). Holding a station clearly for a moment logs
// it and gives a QSL card; the cards are kept per visitor in localStorage.
//
// All texts on the air are placeholders until Smo supplies real ones.
import { createRadioAudio, voice, morse, tone, burst, DECODE } from './radio-audio.js';
import { BAND } from './room.js';

const SAVE = 'smo.relay.qsl';
const CLEAR = 0.03;                    // MHz: how sharp a station is (clarity e^-(d/CLEAR)^2)
const LOG_AT = 0.72, LOG_MS = 1500;    // clear enough, for long enough: logged
const RANGE = 0.12;                    // MHz: a station only plays while the dial is this close
export const EME = { f: 7.05, delay: 2.5 };

const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];

// ---- the stations. `make(A, out, io)` builds one when the dial comes near and returns
// { tick(t) (schedule up to t), stop(), keyed() (optional: the visitor keyed while tuned here) }.
// io.show(text, at) puts a subtitle up at context time `at`; io.type(ch, at) adds one decoded letter.
function program(lines, gap = 1.2) {                  // a loop of scheduled lines with pauses
  let i = 0, next = 0;
  return (t, play) => { if (!next) next = t + 0.3; while (next < t + 0.8) { next = play(lines[i % lines.length], next) + gap; i++; } };
}
export const STATIONS = [
  { id: 'beacon', f: 3.55, call: 'RS1', name: 'Relay beacon', blurb: 'The station’s own beacon, in Morse, day and night.', colour: '#e8c66a',
    make(A, out, io) {
      const m = morse(A, out, { pitch: 640 }); const loop = program(['VVV DE RS1 RS1 BCN = RELAY STN PLATEAU'], 2.2);
      return { tick: (t) => loop(t, (s, at) => { io.show('', at); return m.send(s, at, 17, (c, ct) => io.type(c, ct)); }), stop: m.stop };
    } },
  { id: 'weather', f: 4.3, call: 'RS1-WX', name: 'Station weather', blurb: 'The research station reads its weather on the hour.', colour: '#9cc7c0', carrier: true,
    make(A, out, io) {
      const v = voice(A, out, { pitch: 118 });
      const lines = () => ['Station weather, relay one.', 'Station time ' + io.clock() + '.', 'Wind from the west, twelve knots.', io.sky(), 'Visibility good. Next report on the hour.'];
      let ls = lines(); const loop = program(ls.map((_, k) => k), 0.7);
      return { tick: (t) => loop(t, (k, at) => { if (k === 0) ls = lines(); io.show(ls[k], at); const e = v.say(ls[k], at); if (k === ls.length - 1) return e + 2.5; return e; }), stop: v.stop };
    } },
  { id: 'numbers', f: 5.1, call: '???', name: 'Numbers station', blurb: 'Groups of numbers for nobody. A = 1, B = 2 …', colour: '#d9d4c7', carrier: true,
    make(A, out, io) {
      const v = voice(A, out, { pitch: 190, bright: 0.8 });
      const groups = [[8, 5, 12, 12, 15], [6, 18, 15, 13], [19, 13, 15]];
      const loop = program(['tune', 0, 1, 2, 'end'], 0.9);
      return { tick: (t) => loop(t, (k, at) => {
        if (k === 'tune') { io.show('♪ (a music-box tune)', at); [784, 659, 523, 659, 784, 1047].forEach((f, i) => tone(A, out, at + i * 0.32, { f, dur: 0.3, type: 'triangle', vol: 0.35, release: 0.2 })); return at + 2.2; }
        if (k === 'end') { io.show('End of message.', at); return v.say('End of message.', at) + 3; }
        const g = groups[k]; io.show(g.join(' · '), at);
        return v.say(g.map((n) => NUM[n]).join(', ') + '.', at);
      }), stop: v.stop };
    } },
  { id: 'music', f: 5.95, call: 'VLY', name: 'Valley night music', blurb: 'Slow tunes from a station down in the valley.', colour: '#b9c6e6', carrier: true,
    make(A, out, io) {
      const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]];
      const scale = [440, 523.3, 587.3, 659.3, 784, 880];
      let bar = 0, next = 0, seed = 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      return { tick(t) {
        if (!next) { next = t + 0.2; io.show('♪ Valley night music', next); }
        while (next < t + 0.8) {
          const c = chords[bar % 4], beat = 0.62;
          c.forEach((f) => tone(A, out, next, { f, dur: beat * 4, type: 'triangle', vol: 0.09, attack: 0.3, release: 0.8 }));
          tone(A, out, next, { f: c[0] / 2, dur: beat * 2, type: 'sine', vol: 0.25, release: 0.4 });
          for (let b = 0; b < 4; b++) if (rnd() < 0.8) tone(A, out, next + b * beat, { f: scale[Math.floor(rnd() * scale.length)], dur: beat * (rnd() < 0.3 ? 2 : 1), type: 'square', vol: 0.05, release: 0.2 });
          next += beat * 4; bar++;
        }
      }, stop() {} };
    } },
  { id: 'van', f: 6.55, call: 'VAN-07', name: 'Safari van crew', blurb: 'The research van’s crew, on the way to the river.', colour: '#e3a48d', carrier: true,
    make(A, out, io) {
      const a = voice(A, out, { pitch: 112 }), b = voice(A, out, { pitch: 165 });
      const lines = [[a, 'Van seven to base, over.'], [b, 'Base here. Go ahead, seven.'], [a, 'We are at the river crossing. Herons everywhere.'],
        [b, 'Copy that. Keep the lens cap off.'], [a, 'Will do. Back before dark. Seven out.']];
      const loop = program(lines, 0.5);
      return { tick: (t) => loop(t, ([v, s], at) => {
        io.show((v === a ? 'Van: ' : 'Base: ') + s, at);
        const e = v.say(s, at); tone(A, out, e + 0.05, { f: 1150, dur: 0.07, vol: 0.25 }); burst(A, out, e + 0.13, { dur: 0.22, vol: 0.35, f: 2500 });
        return e + (s.endsWith('out.') ? 4 : 0.3);
      }), stop() { a.stop(); b.stop(); } };
    } },
  { id: 'pulsar', f: 7.75, call: 'PSR', name: 'Space noise: a pulsar', blurb: 'A spinning star ticking 1.4 times a second, very far away.', colour: '#20263a', ink: '#f2ddb0',
    make(A, out, io) {
      let next = 0;
      return { tick(t) {
        if (!next) { next = t + 0.2; io.show('Space noise · a pulsar, 1.40 ticks a second', next); }
        while (next < t + 0.8) { burst(A, out, next, { dur: 0.05, vol: 0.9, f: 900, q: 1.2 }); burst(A, out, next + 0.004, { dur: 0.3, vol: 0.1, f: 400, q: 0.5, type: 'lowpass' }); next += 0.714; }
      }, stop() {} };
    } },
  { id: 'broadcast', f: 8.45, call: 'R-PLATEAU', name: 'Radio Plateau', blurb: 'The shortwave programme about the projects at the station.', colour: '#c8dca8', carrier: true,
    make(A, out, io) {
      const v = voice(A, out, { pitch: 132 });
      const lines = ['interval', 'This is Radio Plateau, on the air from the research station.', 'Tonight: a thesis on how animals talk to each other.',
        'A workshop full of home-made sound gear.', 'And a station that grows one module at a time.', 'Placeholder programme. The real one follows soon.'];
      const loop = program(lines, 0.8);
      return { tick: (t) => loop(t, (s, at) => {
        if (s === 'interval') { io.show('♪ (interval signal)', at); [523, 659, 784, 659, 523, 392].forEach((f, i) => tone(A, out, at + i * 0.26, { f, dur: 0.24, type: 'triangle', vol: 0.3, release: 0.15 })); return at + 1.9; }
        io.show(s, at); const e = v.say(s, at); return s.startsWith('Placeholder') ? e + 3 : e;
      }), stop: v.stop };
    } },
  { id: 'cq', f: 9.2, call: 'PL2Q', name: 'A ham calling CQ', blurb: 'Someone on a hill calling “anyone there?” Answer with the key.', colour: '#f3e1b5',
    make(A, out, io) {
      const m = morse(A, out, { pitch: 720 }); let next = 0, reply = false;
      return { tick(t) {
        if (!next) next = t + 0.3;
        if (next < t + 0.8) {
          const s = reply ? 'R R TNX FER CALL UR 599 73' : 'CQ CQ DE PL2Q K';
          io.show(reply ? 'They heard you! ' : '', next);
          next = m.send(s, next, 18, (c, ct) => io.type(c, ct)) + (reply ? 4 : 2.2); reply = false;
        }
      }, keyed(t) {                                    // the visitor answered: stop calling, reply once they pause
        m.cancel(t); io.drop(t); reply = true; next = t + 1.4;
      }, stop: m.stop };
    } },
  { id: 'time', f: 9.95, call: 'TIME', name: 'Time signal', blurb: 'A pip every second, a long one on the minute.', colour: '#e6b8d0',
    make(A, out, io) {
      let next = 0, sec = 0;
      return { tick(t) {
        if (!next) { const d = new Date(); sec = d.getUTCSeconds() + 1; next = t + (1000 - d.getUTCMilliseconds()) / 1000; }
        while (next < t + 0.8) {
          const s = sec % 60; tone(A, out, next, { f: 1000, dur: s === 0 ? 0.5 : 0.1, vol: 0.5 });
          const d = new Date(Date.now() + (next - A.now) * 1000);
          io.show('UTC ' + [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()].map((n) => String(n).padStart(2, '0')).join(':'), next);
          next += 1; sec++;
        }
      }, stop() {} };
    } },
  { id: 'rtty', f: 10.65, call: 'TTY', name: 'Teleprinter news', blurb: 'News by teleprinter: two tones, typed out letter by letter.', colour: '#f1ead8',
    make(A, out, io) {
      const o = A.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 2125;
      const g = A.ctx.createGain(); g.gain.value = 0.28; o.connect(g); g.connect(out); o.start();
      const text = 'RLY NEWS: NEW MODULE GOING UP ON THE PLATEAU. TURBINE OK. CAMP FIRE LIT AT DUSK. PLACEHOLDER.   ';
      let next = 0, i = 0;
      return { tick(t) {
        if (!next) { next = t + 0.2; io.show('', next); }
        while (next < t + 0.8) {
          const ch = text[i % text.length];
          for (let b = 0; b < 8; b++) o.frequency.setValueAtTime(b === 0 ? 2125 : b === 7 ? 2295 : (Math.random() < 0.5 ? 2125 : 2295), next + b * 0.022);
          next += 0.165; io.type(ch, next); i++;
          if (i % text.length === 0) io.show('', next);
        }
      }, stop() { try { o.stop(); } catch (e) { /* stopped */ } o.disconnect(); g.disconnect(); } };
    } },
  { id: 'whales', f: 11.4, call: 'HYD-3', name: 'Hydrophone relay: whale song', blurb: 'A microphone under the sea, relayed: humpbacks singing.', colour: '#2f5878', ink: '#e9f0f4',
    make(A, out, io) {
      const dl = A.ctx.createDelay(1); dl.delayTime.value = 0.42; const fb = A.ctx.createGain(); fb.gain.value = 0.45;
      const wet = A.ctx.createGain(); wet.gain.value = 0.6; wet.connect(out); wet.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(out);
      let next = 0, seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      return { tick(t) {
        if (!next) { next = t + 0.2; io.show('Hydrophone relay from the bay · humpbacks singing', next); }
        while (next < t + 0.8) {
          const f0 = 180 + rnd() * 320, f1 = f0 * (0.5 + rnd() * 1.8), d = 0.8 + rnd() * 1.6;
          tone(A, wet, next, { f: f0, glide: f1, dur: d, type: rnd() < 0.5 ? 'sine' : 'triangle', vol: 0.35, attack: 0.15, release: 0.35 });
          next += d + 0.3 + rnd() * 1.2;
        }
      }, stop() { [dl, fb, wet].forEach((n) => n.disconnect()); } };
    } },
];
// the secret one: it is not on the air unless the telescope tracks a moon
export const SECRET = { id: 'eme', f: EME.f, call: 'EME', name: 'Moon bounce', blurb: 'Your own Morse, sent to a moon and back: Earth – Moon – Earth.', colour: '#5b5f6e', ink: '#f9e3b3', secret: true };
export const ALL = [...STATIONS.slice(0, 5), SECRET, ...STATIONS.slice(5)];

// a little bell when a card is logged (outside the receiver's filter)
export function chime(A, t, f) { tone(A, A.master, t, { f, dur: 0.5, type: 'sine', vol: 0.18, release: 0.4 }); }

export function loadLog() {
  try { const o = JSON.parse(localStorage.getItem(SAVE) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; }
}
function saveLog(log) { try { localStorage.setItem(SAVE, JSON.stringify(log)); } catch (e) { /* no storage */ } }

// ---- the receiver: tuning, levels, logging, the visitor's Morse key
// host: { moon() -> name of the moon the telescope tracks, or null; clock() -> 'hh:mm'; sky() -> a weather line }
export function createRadio(host) {
  const R = {
    f: 7.6, A: null, live: new Map(), log: loadLog(), held: { id: null, since: 0 },
    texts: new Map(), queue: [], sent: { code: '', text: '', at: 0, down: 0, up: 0 },
    echoes: [], heardEcho: 0, popT: 0, signal: 0, onLog: null,
  };
  const clarity = (f0) => Math.exp(-(((R.f - f0) / CLEAR) ** 2));
  function io(id) {
    return {
      show: (line, at) => R.queue.push({ id, at, line }),
      drop: (after) => { R.queue = R.queue.filter((q) => q.id !== id || q.at <= after); },
      type: (ch, at) => R.queue.push({ id, at, ch }),
      clock: host.clock, sky: host.sky,
    };
  }
  function start() {                                   // from a click: make the sound
    if (R.A) { R.A.resume(); return R.A; }
    R.A = createRadioAudio();
    if (!R.A) return null;
    // the moon bounce's echo: its own tone and level, always ready
    // (a little smeared, as if it had travelled 2 × 380 000 km)
    const ctx = R.A.ctx, out = R.A.station(), pre = ctx.createGain();
    const dl = ctx.createDelay(0.5); dl.delayTime.value = 0.09; const fb = ctx.createGain(); fb.gain.value = 0.35;
    pre.connect(out); pre.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(out);
    R.eme = { out, m: morse(R.A, pre, { pitch: 655, vol: 0.5 }) };
    return R.A;
  }
  function stop() {
    R.live.forEach((s) => s.gen.stop()); R.live.clear();
    if (R.A) R.A.close();
    R.A = null; R.eme = null; R.queue = []; R.echoes = []; R.texts.clear();
  }
  const emeOn = () => !!host.moon();
  // every frame while the room is open
  function step(dt) {
    let best = null, cmax = 0;
    const list = emeOn() ? [...STATIONS, SECRET] : STATIONS;
    list.forEach((s) => { const c = clarity(s.f); if (c > cmax) { cmax = c; best = s; } });
    R.signal = best && best.secret ? cmax * 0.55 : cmax;            // the moon's echo is faint even when tuned
    const A = R.A;
    if (A) {
      const t = A.now;
      // stations near the dial play; the rest are not even built
      STATIONS.forEach((s) => {
        const near = Math.abs(R.f - s.f) < RANGE;
        let L = R.live.get(s.id);
        if (near && !L) { const out = A.station(); L = { out, gen: s.make(A, out, io(s.id)), away: 0 }; R.live.set(s.id, L); }
        if (!L) return;
        L.away = near ? 0 : L.away + dt;
        if (L.away > 2) { L.gen.stop(); L.out.disconnect(); R.live.delete(s.id); R.texts.delete(s.id); R.queue = R.queue.filter((q) => q.id !== s.id); return; }
        const fade = s.id === 'whales' || s.id === 'pulsar' ? 0.8 + 0.2 * Math.sin(t * 0.7 + s.f) : 1;   // the far ones fade in and out
        L.out.gain.setTargetAtTime(clarity(s.f) * fade * (s.id === 'pulsar' ? 0.8 : 1), t, 0.05);
        L.gen.tick(t);
      });
      if (R.eme) R.eme.out.gain.setTargetAtTime(emeOn() ? clarity(EME.f) * 0.6 : 0, t, 0.05);
      const carrier = STATIONS.find((s) => s.carrier && Math.abs(R.f - s.f) < 0.09);
      if (carrier) { const d = Math.abs(R.f - carrier.f); A.setWhistle(0.1 * (1 - clarity(carrier.f)) * Math.exp(-((d / 0.07) ** 2)), 60 + d * 11000); } else A.setWhistle(0, 400);
      A.setStatic(0.32 * (1 - 0.88 * cmax) * (emeOn() && Math.abs(R.f - EME.f) < 0.04 ? 0.45 : 1));
      R.popT -= dt;
      if (R.popT < 0) { R.popT = 0.05 + Math.random() * 0.5; A.pop((0.15 + Math.random() * 0.4) * (1 - cmax)); }
      // subtitles and decoded letters arrive on time
      const due = R.queue.filter((q) => q.at <= t).sort((a, b) => a.at - b.at);
      if (due.length) R.queue = R.queue.filter((q) => q.at > t);
      due.forEach((q) => {
        const T = R.texts.get(q.id) || { line: '', typed: '' }; R.texts.set(q.id, T);
        if (q.line !== undefined) { T.line = q.line; T.typed = ''; } else T.typed = (T.typed + q.ch).slice(-40);
      });
      // echoes from the moon come back
      R.echoes = R.echoes.filter((e) => { if (e.at > t) return true; if (clarity(EME.f) > 0.55) R.heardEcho = performance.now(); return false; });
    }
    // logging: held clear for a moment
    const target = best && (best.secret ? (performance.now() - R.heardEcho < 1500 && emeOn()) : true) ? best : null;
    if (target && cmax > LOG_AT) {
      if (R.held.id !== target.id) R.held = { id: target.id, since: performance.now() };
      if (performance.now() - R.held.since > (target.secret ? 0 : LOG_MS) && !R.log[target.id]) {
        R.log[target.id] = Date.now(); saveLog(R.log);
        if (R.onLog) R.onLog(target);
      }
    } else R.held = { id: null, since: 0 };
    // the visitor's own Morse: a letter ends after a pause
    const S = R.sent, now = performance.now();
    if (S.code && !S.down && now - S.up > 420) { S.text = (S.text + (DECODE[S.code] || '?')).slice(-24); S.code = ''; S.at = now; }
    if (S.text && !S.down && !S.code && now - S.up > 1100 && !S.text.endsWith(' ')) S.text += ' ';
    return { best, cmax };
  }
  // what the readout says now
  function readout() {
    const list = emeOn() ? [...STATIONS, SECRET] : STATIONS;
    let best = null, cmax = 0;
    list.forEach((s) => { const c = clarity(s.f); if (c > cmax) { cmax = c; best = s; } });
    const nearEme = Math.abs(R.f - EME.f) < 0.03;
    const keyed = performance.now() - R.sent.at < 4000 && R.sent.text.trim();
    let line = '', head = '';
    if (nearEme && !emeOn()) { head = 'Only the hiss of space'; line = 'Nothing comes back from here unless the radio telescope points at a moon.'; }
    else if (best && best.secret && cmax > 0.4) { head = 'Moon bounce · ' + host.moon(); line = performance.now() - R.heardEcho < 2500 ? 'Your echo came back from the moon!' : 'The telescope is on the moon. Key the Morse key and wait for the echo.'; }
    else if (best && cmax > LOG_AT) { head = best.call + ' · ' + best.name; const T = R.texts.get(best.id); line = T ? (T.line + T.typed).trim() : ''; }
    else if (best && cmax > 0.12) { head = 'Something there…'; line = 'Turn slowly'; }
    else { head = 'Static'; line = ''; }
    if (keyed) line = 'You sent: ' + R.sent.text.trim();
    return { head, line, found: best && cmax > LOG_AT && !best.secret && R.log[best.id] ? true : false };
  }
  function key(down) {
    const S = R.sent, now = performance.now();
    if (!!down === !!S.down) return;
    if (R.A) R.A.key(down);
    if (down) { S.down = now; return; }
    const len = now - S.down; S.down = 0; S.up = now;
    S.code += len < 200 ? '.' : '-'; S.at = now;
    if (!R.A) return;
    const t = R.A.now;
    // the CQ station hears you; the moon sends it back
    const cq = R.live.get('cq'); if (cq && clarity(9.2) > 0.4 && cq.gen.keyed) cq.gen.keyed(t);
    if (R.eme && emeOn()) {
      const at = t + EME.delay - len / 1000;
      R.eme.m.beep(at, Math.min(1.5, len / 1000), 0.5);
      R.echoes.push({ at: at + len / 1000 });
    }
  }
  return {
    get f() { return R.f; },
    set(f) { R.f = Math.max(BAND.lo, Math.min(BAND.hi, f)); },
    start, stop, step, readout, key,
    get signal() { return R.signal; },
    get log() { return R.log; },
    onLog(fn) { R.onLog = fn; },
    get audio() { return R.A; },
    clarity,
  };
}
