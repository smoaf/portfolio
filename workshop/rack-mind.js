// --- Mind reader: the brain of the server rack's game (WORKSHOP_PLAN phase W4). Plain logic, no
// three.js and no DOM, so it can be tested on its own. Rock, paper, scissors over a match of 20
// rounds; the rack learns the visitor's habits while they play and says honestly what it spotted.
//
// Moves are 0 rock, 1 paper, 2 scissors; m + 1 (mod 3) beats m. Before each round the rack asks
// every predictor for a guess (a probability for each move) and trusts the one that has guessed best
// lately; it plays what beats that guess. In the first rounds, and whenever no predictor does better
// than chance, it plays at random. The predictors are small enough to explain on the screen:
//   favourite   how often each move comes up overall
//   follow      what comes after the visitor's last move (rock -> paper ...)
//   pairs       what comes after the last two moves
//   result      stay, step up or step down after a win, a loss or a draw ("lose-shift")
//   counter     the visitor's move against the rack's last move ("play what would have beaten it")
//   network     a tiny neural network (21 inputs: the last 3 moves of both sides and the last
//               result, 10 hidden units, 3 outputs), trained online after every round
// Nothing is stored or sent anywhere: `createMind()` keeps it all in memory, `reset()` forgets.
export const MOVES = ['rock', 'paper', 'scissors'];
export const ROUNDS = 20;
const beats = (m) => (m + 1) % 3;
const RES = ['win', 'loss', 'draw'];                  // from the visitor's side
export const resultOf = (you, rack) => (you === rack ? 2 : beats(rack) === you ? 0 : 1);
const WARMUP = 5;                                      // rounds of pure chance at the start
const DECAY = 0.86;                                    // how fast a predictor's record fades (≈ last 7 rounds)
const uniform = () => [1 / 3, 1 / 3, 1 / 3];

// counts that fade a little every round, so a change of habit shows up quickly
function table(n) { return Array.from({ length: n }, () => [0, 0, 0]); }
function dist(row, prior = 0.5) { const s = row[0] + row[1] + row[2] + 3 * prior; return row.map((c) => (c + prior) / s); }
function fade(t, k = 0.97) { t.forEach((r) => { for (let i = 0; i < 3; i++) r[i] *= k; }); }

// ---- the tiny network: 21 -> 10 (tanh) -> 3 (softmax), plain SGD on the last rounds
function makeNet(rand) {
  const NI = 21, NH = 10, NO = 3;
  const w1 = Array.from({ length: NH }, () => Array.from({ length: NI }, () => (rand() - 0.5) * 0.3));
  const b1 = new Array(NH).fill(0);
  const w2 = Array.from({ length: NO }, () => Array.from({ length: NH }, () => (rand() - 0.5) * 0.3));
  const b2 = new Array(NO).fill(0);
  const h = new Array(NH).fill(0);
  function forward(x) {
    for (let j = 0; j < NH; j++) { let s = b1[j]; for (let i = 0; i < NI; i++) if (x[i]) s += w1[j][i] * x[i]; h[j] = Math.tanh(s); }
    const z = [0, 1, 2].map((o) => { let s = b2[o]; for (let j = 0; j < NH; j++) s += w2[o][j] * h[j]; return s; });
    const mx = Math.max(...z), e = z.map((v) => Math.exp(v - mx)), se = e[0] + e[1] + e[2];
    return e.map((v) => v / se);
  }
  function train(x, y, lr = 0.12) {
    const p = forward(x), hs = h.slice();
    const d2 = p.map((v, o) => v - (o === y ? 1 : 0));
    for (let j = 0; j < NH; j++) {
      let g = 0; for (let o = 0; o < NO; o++) g += d2[o] * w2[o][j];
      g *= 1 - hs[j] * hs[j];
      for (let i = 0; i < NI; i++) if (x[i]) w1[j][i] -= lr * g * x[i];
      b1[j] -= lr * g;
    }
    for (let o = 0; o < NO; o++) { for (let j = 0; j < NH; j++) w2[o][j] -= lr * d2[o] * hs[j]; b2[o] -= lr * d2[o]; }
  }
  return { forward, train, hidden: h, NI, NH };
}
function features(hist) {                              // last 3 rounds of both sides + the last result, one-hot
  const x = new Array(21).fill(0);
  for (let k = 0; k < 3; k++) {
    const r = hist[hist.length - 1 - k];
    if (!r) continue;
    x[k * 3 + r.you] = 1; x[9 + k * 3 + r.rack] = 1;
  }
  const last = hist[hist.length - 1];
  if (last) x[18 + last.res] = 1;
  return x;
}

export const PREDICTORS = {
  favourite: 'your favourite move',
  follow: 'what you play after each move',
  pairs: 'what you play after two moves',
  result: 'how you react to winning or losing',
  counter: 'how you answer my last move',
  network: 'my little neural network',
};

export function createMind(rand = Math.random) {
  let M;
  function reset() {
    M = {
      hist: [],                                        // { you, rack, res, guess, by }
      freq: [0, 0, 0], follow: table(3), pairs: table(9), result: table(3), counter: table(1),
      net: makeNet(rand), samples: [],
      score: Object.fromEntries(Object.keys(PREDICTORS).map((k) => [k, 0])),   // faded hits (rounds weighted)
      weight: 0,                                       // faded round count (the score's denominator)
      last: null,                                      // the guesses for the coming round, per predictor
      plan: null,                                      // the rack's move for the coming round, decided before the visitor picks
      match: { you: 0, rack: 0, draw: 0, round: 0 },
      said: [],
    };
    think();
  }

  // ---- every predictor's guess for the next move: [p rock, p paper, p scissors]
  function guesses() {
    const h = M.hist, n = h.length, last = h[n - 1], prev = h[n - 2];
    const g = {};
    g.favourite = dist(M.freq);
    g.follow = last ? dist(M.follow[last.you]) : uniform();
    g.pairs = prev ? dist(M.pairs[prev.you * 3 + last.you], 0.4) : uniform();
    // relative predictors: 0 stay/same, 1 step up (beats it), 2 step down; turned into moves
    const rel = (base, row) => { const p = dist(row); const out = [0, 0, 0]; for (let s = 0; s < 3; s++) out[(base + s) % 3] += p[s]; return out; };
    g.result = last ? rel(last.you, M.result[last.res]) : uniform();
    g.counter = last ? rel(last.rack, M.counter[0]) : uniform();
    g.network = n >= 3 ? M.net.forward(features(h)) : uniform();
    return g;
  }
  const best = (p) => p.indexOf(Math.max(...p));
  function accuracy(k) { return M.weight > 0.5 ? M.score[k] / M.weight : 1 / 3; }
  function leader() {                                  // the predictor that has guessed best lately
    let lead = null, acc = 0;
    Object.keys(PREDICTORS).forEach((k) => { const a = accuracy(k); if (a > acc + 1e-9) { acc = a; lead = k; } });
    return { lead, acc };
  }
  // decide the rack's next move now, before the visitor picks (so it can't cheat)
  function think() {
    M.last = guesses();
    const { lead, acc } = leader();
    const n = M.hist.length;
    // confidence: how far the leader is above chance, 0 .. 1
    const conf = n < WARMUP ? 0 : Math.max(0, Math.min(1, (acc - 0.36) / 0.4));
    let guess = uniform(), move = Math.floor(rand() * 3), by = null;
    if (lead && conf > 0) {
      const p = M.last[lead];
      guess = p.map((v) => v * conf + (1 - conf) / 3);
      // mostly play the counter to the likely move; now and then stay random, so the rack is not
      // itself a pattern a visitor can farm
      if (rand() < 0.35 + 0.6 * conf) { move = beats(best(p)); by = lead; }
    }
    M.plan = { move, guess, by, conf, lead, acc };
  }

  // ---- one round: the visitor's move; returns everything the screens need
  function play(you) {
    if (M.match.round >= ROUNDS) M.match = { you: 0, rack: 0, draw: 0, round: 0 };   // a new match; the habits stay
    const plan = M.plan, rack = plan.move, res = resultOf(you, rack);
    // grade every predictor on this round (faded)
    M.weight = M.weight * DECAY + 1;
    Object.keys(PREDICTORS).forEach((k) => { M.score[k] = M.score[k] * DECAY + (best(M.last[k]) === you && Math.max(...M.last[k]) > 0.34 ? 1 : 0); });
    const hit = plan.by ? best(M.last[plan.by]) === you : null;
    // learn
    const h = M.hist, last = h[h.length - 1], prev = h[h.length - 2];
    const x = features(h);
    fade([M.freq], 0.98); M.freq[you]++;
    if (last) { fade(M.follow); M.follow[last.you][you]++; }
    if (prev) { fade(M.pairs); M.pairs[prev.you * 3 + last.you][you]++; }
    if (last) { fade(M.result); M.result[last.res][(you - last.you + 3) % 3]++; }
    if (last) { fade(M.counter); M.counter[0][(you - last.rack + 3) % 3]++; }
    if (h.length >= 2) { M.samples.push([x, you]); if (M.samples.length > 30) M.samples.shift(); }
    for (let e = 0; e < 4; e++) M.samples.forEach(([sx, sy], i) => { if (i >= M.samples.length - 12 || e === 0) M.net.train(sx, sy); });
    const round = { you, rack, res, guess: plan.guess, by: plan.by, conf: plan.conf, hit };
    h.push(round);
    const mt = M.match; mt.round++; if (res === 0) mt.you++; else if (res === 1) mt.rack++; else mt.draw++;
    const comment = remark(round);
    think();
    return { ...round, comment, match: { ...mt }, over: mt.round >= ROUNDS, verdict: mt.round >= ROUNDS ? verdict() : null };
  }

  // ---- what the rack says: true facts about the visitor's play, the most interesting one first
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const times = (k) => (k === 1 ? 'once' : k === 2 ? 'twice' : k + ' times');
  function facts(r) {
    const h = M.hist, n = h.length, out = [];
    const add = (score, key, text) => out.push({ score, key, text });
    const mv = MOVES[r.you];
    // straight away: repeats and favourites
    let run = 1; while (run < n && h[n - 1 - run].you === r.you) run++;
    if (run >= 2) add(run + 0.5, 'run', `That's ${mv} ${run === 2 ? 'twice' : run + ' times'} in a row.`);
    const cnt = h.filter((q) => q.you === r.you).length;
    if (n >= 4 && cnt / n >= 0.5) add(1.5 + cnt / n * 2, 'fav-' + mv, `${cap(mv)} ${cnt} times out of ${n}. Your favourite.`);
    // after a loss / a win: the plan's "You've played rock twice after a loss"
    const prev = h[n - 2];
    if (prev) {
      const after = h.filter((q, i) => i > 0 && h[i - 1].res === prev.res && q.you === r.you).length;
      const word = prev.res === 0 ? 'a win' : prev.res === 1 ? 'a loss' : 'a draw';
      if (after >= 2) add(after + 1, 'after-' + prev.res + mv, `You've played ${mv} ${times(after)} after ${word}.`);
      const shift = (r.you - prev.you + 3) % 3;
      const same = h.filter((q, i) => i > 0 && h[i - 1].res === prev.res && (q.you - h[i - 1].you + 3) % 3 === shift).length;
      if (same >= 3 && prev.res !== 2) add(same + 0.8, 'shift-' + prev.res + shift,
        shift === 0 ? `After ${word} you tend to stay with the same move.` : `After ${word} you tend to switch${shift === 1 ? ' up: rock to paper, paper to scissors' : ' down: paper to rock, rock to scissors'}.`);
      if (beats(prev.rack) === r.you) {
        const k = h.filter((q, i) => i > 0 && beats(h[i - 1].rack) === q.you).length;
        if (k >= 3) add(k + 0.6, 'counter', `You've played what would have beaten my last move ${times(k)} now.`);
      }
    }
    // the prediction, once it kicks in
    if (r.by) {
      if (r.hit) add(4 + r.conf * 3, 'hit-' + r.by, `I guessed ${mv}, so I played ${MOVES[r.rack]}. I watched ${PREDICTORS[r.by]}.`);
      else add(2.5, 'miss', `I expected ${MOVES[best(r.guess)]}. You surprised me.`);
    }
    if (n >= 12) {
      const { acc } = leader();
      if (acc < 0.42) add(5, 'random', "You're unpredictable, respect. I can't find a pattern.");
    }
    return out;
  }
  function remark(r) {
    const n = M.hist.length;
    const f = facts(r).filter((x) => !M.said.slice(-3).includes(x.key)).sort((a, b) => b.score - a.score)[0];
    let text;
    if (f) { text = f.text; M.said.push(f.key); }
    else if (n === 1) text = 'Round 1. I know nothing about you yet, so I play at random.';
    else if (n < WARMUP) text = 'Still at random. I am watching what you do after a win or a loss.';
    else text = M.plan && M.plan.conf > 0 ? 'Nothing new. I keep watching.' : 'No clear pattern yet. I play at random until I find one.';
    if (M.said.length > 8) M.said.shift();
    return text;
  }
  function verdict() {
    const m = M.match, { lead, acc } = leader();
    const tell = lead && acc > 0.42 ? ` Your tell: ${PREDICTORS[lead]}.` : '';
    if (m.rack > m.you) return { title: `I win ${m.rack}–${m.you}`, text: `I found patterns, I didn't read your mind.${tell}` };
    if (m.you > m.rack) return { title: `You win ${m.you}–${m.rack}`, text: acc > 0.42 ? `Well played. I was catching up on ${PREDICTORS[lead]}.` : "You're unpredictable, respect. I couldn't find a pattern." };
    return { title: `Draw, ${m.you}–${m.rack}`, text: `Too close to call.${tell}` };
  }

  reset();
  return {
    play, reset,
    get match() { return { ...M.match }; },
    get history() { return M.hist.slice(); },
    // how well the rack knows the visitor: the leader's recent hit rate (chance is 1/3)
    knowledge() { const { lead, acc } = M.hist.length ? leader() : { lead: null, acc: 1 / 3 }; return { lead, acc, label: lead ? PREDICTORS[lead] : null, conf: M.plan.conf }; },
    scores() { return Object.keys(PREDICTORS).map((k) => ({ id: k, label: PREDICTORS[k], acc: accuracy(k) })); },
    hidden: () => M.net.hidden,                        // the network's hidden units after the last guess (for the LEDs)
    planned: () => M.plan,                             // tests only: the rack's move for the coming round
  };
}
