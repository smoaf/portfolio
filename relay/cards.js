// The box of QSL cards in the radio room (RELAY_PLAN phase R2). Radio amateurs confirm a contact by
// post with a QSL card: a postcard with the station's call sign, the frequency, the time and a
// signal report. Here every station found on the band gives one, and the box shows them over the
// paused room in the van album's scrapbook style: cream cards, a strip of tape, a slight turn.
// Cards not found yet are blank, with only a hint where to look; the moon-bounce card stays a secret.
const CSS = `
  .qsl { position: fixed; inset: 0; z-index: 23; display: grid; grid-template-rows: auto 1fr; padding-top: var(--hh, 77px);
         background: rgba(24, 20, 16, 0.62); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); opacity: 0; transition: opacity .3s; }
  .qsl.open { opacity: 1; }
  .qsl-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 24px 4px; color: #f1ede6; }
  .qsl-head h2 { margin: 0; font: 700 22px/1.1 var(--font-display); letter-spacing: 0.02em; }
  .qsl-head .kicker { color: #c9c1b4; }
  .qsl-head .btn { color: #f1ede6; border-color: rgba(255,255,255,0.4); }
  .qsl-grid { overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 22px 18px; padding: 16px 24px calc(28px + env(safe-area-inset-bottom, 0px));
              align-content: start; max-width: 1180px; width: 100%; margin: 0 auto; box-sizing: border-box; }
  .qsl-card { position: relative; aspect-ratio: 3 / 2; box-sizing: border-box; padding: 12px 14px 10px; color: var(--ink, #2a2418); background: var(--bg, #f1ead8);
              box-shadow: 0 1px 3px rgba(40, 30, 20, 0.35), 0 8px 18px rgba(0, 0, 0, 0.25); transform: rotate(var(--rot, 0deg));
              display: grid; grid-template-rows: auto 1fr auto; font-family: var(--font-display); }
  .qsl-card::before { content: ""; position: absolute; left: 50%; top: -9px; width: 64px; height: 18px; transform: translateX(-50%) rotate(var(--tape, -3deg));
                      background: rgba(236, 222, 180, 0.82); background-image: repeating-linear-gradient(90deg, rgba(255,255,255,0.2) 0 3px, transparent 3px 7px);
                      clip-path: polygon(2% 0, 98% 4%, 100% 50%, 97% 100%, 1% 96%, 0 50%); }
  .qsl-card .call { font: 800 30px/1 var(--font-display); font-stretch: 116%; font-variation-settings: 'wdth' 116; letter-spacing: 0.03em; }
  .qsl-card .meta { font: 500 10px/1.3 var(--font-display); letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.75; margin-top: 4px; }
  .qsl-card .name { font: 600 14px/1.25 var(--font-display); align-self: end; }
  .qsl-card .blurb { font: 400 12px/1.35 var(--font-display); opacity: 0.85; margin-top: 2px; }
  .qsl-card .rst { position: absolute; right: 12px; top: 12px; width: 44px; height: 44px; border: 2px solid currentColor; border-radius: 50%; display: grid; place-items: center;
                   font: 700 10px/1.05 var(--font-display); letter-spacing: 0.06em; text-align: center; opacity: 0.6; transform: rotate(-12deg); }
  .qsl-card.blank { --bg: rgba(241, 234, 216, 0.16); color: #e9e2d5; box-shadow: none; border: 1px dashed rgba(255, 255, 255, 0.35); }
  .qsl-card.blank::before { display: none; }
  .qsl-card.blank .call { opacity: 0.5; }
  .qsl-card.new { animation: qsl-in .7s cubic-bezier(.2,.7,.2,1); }
  @keyframes qsl-in { from { transform: translateY(30px) rotate(calc(var(--rot) + 8deg)) scale(0.9); opacity: 0; } }
  @media (max-width: 560px) { .qsl-grid { grid-template-columns: 1fr 1fr; gap: 16px 12px; padding: 12px 14px 24px; } .qsl-card { padding: 8px 9px; }
    .qsl-card .call { font-size: 19px; } .qsl-card .blurb { display: none; } .qsl-card .rst { width: 32px; height: 32px; font-size: 7.5px; right: 6px; top: 6px; } .qsl-card .name { font-size: 12px; } }
  @media (prefers-reduced-motion: reduce) { .qsl, .qsl-card.new { transition: none; animation: none; } }
`;
let styled = false;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function openCards(list, log, { fresh = null, onClose } = {}) {
  if (!styled) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); styled = true; }
  const el = document.createElement('div');
  el.className = 'qsl'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'QSL cards');
  const n = list.filter((s) => log[s.id]).length;
  const cards = list.map((s, i) => {
    const rot = ((i * 37) % 7 - 3) * 0.7, tape = ((i * 53) % 9 - 4);
    if (!log[s.id]) {
      const where = s.secret ? 'A secret station. Read the postcard on the wall.' : 'Somewhere between ' + (Math.floor(s.f * 2) / 2).toFixed(1) + ' and ' + (Math.floor(s.f * 2) / 2 + 0.5).toFixed(1) + ' MHz';
      return `<div class="qsl-card blank" style="--rot:${rot}deg"><div><div class="call">?</div><div class="meta">Not heard yet</div></div><div></div><div class="blurb">${esc(where)}</div></div>`;
    }
    const d = new Date(log[s.id]);
    const when = d.toISOString().slice(0, 10) + ' · ' + d.toISOString().slice(11, 16) + ' UTC';
    return `<div class="qsl-card${fresh === s.id ? ' new' : ''}" style="--rot:${rot}deg;--tape:${tape}deg;--bg:${s.colour};--ink:${s.ink || '#2a2418'}">
      <div><div class="call">${esc(s.call)}</div><div class="meta">${s.f.toFixed(2)} MHz · ${esc(when)}</div></div>
      <div class="rst">RST<br>${s.secret ? '339' : '599'}</div>
      <div><div class="name">${esc(s.name)}</div><div class="blurb">${esc(s.blurb)}</div></div></div>`;
  }).join('');
  el.innerHTML = `<div class="qsl-head"><div><div class="kicker">QSL cards · ${n} / ${list.length} found</div><h2>Stations heard from the relay</h2></div>
    <button class="btn" type="button">Close ✕</button></div><div class="qsl-grid">${cards}</div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('open'));
  const btn = el.querySelector('.btn');
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    el.classList.remove('open');
    setTimeout(() => el.remove(), 320);
    if (onClose) onClose();
  };
  btn.addEventListener('click', close);
  el.addEventListener('click', (e) => { if (e.target === el || e.target.classList.contains('qsl-grid')) close(); });
  setTimeout(() => btn.focus({ preventScroll: true }), 50);
  return { close, el };
}
