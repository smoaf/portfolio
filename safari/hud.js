// Everything the visitor sees on top of the picture. Kept to what the plan allows: the viewfinder,
// how much film is left, the feed button, exit (plus a mute toggle, because the safari makes sound).
// The HUD element is also the input surface: the station's canvas sits behind it, so no drag of
// the safari ever reaches the station's orbit controls.
import { verdict } from './photo.js';

const TOD = { dawn: 'Dawn', day: 'Day', dusk: 'Dusk', night: 'Night' };
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html !== undefined) n.innerHTML = html; return n; };
// the same frame can show up in the feed and twice in the report, so each place gets its own copy
function copyThumb(src, shrink = 1) {
  const c = document.createElement('canvas');
  c.width = Math.round(src.width / shrink); c.height = Math.round(src.height / shrink);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c;
}

export function createHud({ host = document.body, route, tod, film, pellets, on = {} }) {
  const root = el('div', 'safari');
  root.setAttribute('role', 'application');
  root.setAttribute('aria-label', `Photo safari: ${route.name}`);
  root.innerHTML = `
    <div class="sf-finder">
      <div class="sf-corner tl"></div><div class="sf-corner tr"></div><div class="sf-corner bl"></div><div class="sf-corner br"></div>
      <div class="sf-cross"><span></span></div>
      <div class="sf-grain"></div>
    </div>
    <div class="sf-read">
      <div class="sf-chip" id="sf-film">Film <b>${film}</b>/${film}</div>
      <div class="sf-chip" id="sf-zoom">1.0×</div>
    </div>
    <div class="sf-top-right">
      <button id="sf-mute" aria-pressed="false" title="Sound">Sound</button>
      <button id="sf-exit">Exit</button>
    </div>
    <div class="sf-tools">
      <div class="sf-left"><button id="sf-feed">Feed <b>${pellets}</b></button></div>
      <div class="sf-right"></div>
    </div>
    <div class="sf-feed" id="sf-shots" aria-live="polite"></div>
    <div class="sf-say" id="sf-say"></div>
    <div class="sf-flash" id="sf-flash"></div>
    <div class="sf-help" id="sf-help"></div>
    <div class="sf-rail"><i id="sf-rail"></i></div>`;
  host.appendChild(root);

  const q = (id) => root.querySelector('#' + id);
  const filmEl = q('sf-film'), zoomEl = q('sf-zoom'), feedEl = q('sf-feed'), shotsEl = q('sf-shots'),
        sayEl = q('sf-say'), flashEl = q('sf-flash'), helpEl = q('sf-help'), railEl = q('sf-rail'),
        muteEl = q('sf-mute'), exitEl = q('sf-exit');

  // buttons must never also take a photo, so they swallow the tap before the view sees it
  const stop = (e) => e.stopPropagation();
  root.querySelectorAll('button').forEach((b) => {
    b.addEventListener('pointerdown', stop); b.addEventListener('pointerup', stop);
    b.addEventListener('click', () => b.blur());       // after a tap the space bar is the shutter again
  });
  exitEl.addEventListener('click', () => on.exit && on.exit());
  feedEl.addEventListener('click', () => on.feed && on.feed());
  muteEl.addEventListener('click', () => on.mute && on.mute());

  const touch = !matchMedia('(hover: hover)').matches;
  helpEl.textContent = touch ? 'Drag to look · tap to shoot · pinch to zoom' : 'Drag to look · click to shoot · wheel to zoom · space, F to feed';
  setTimeout(() => helpEl.classList.add('gone'), 7000);

  let sayTimer = 0, report = null;
  const api = {
    root,
    setFilm(left, total) {
      filmEl.innerHTML = `Film <b>${left}</b>/${total}`;
      filmEl.classList.toggle('low', left <= 5);
    },
    setPellets(n) { feedEl.innerHTML = `Feed <b>${n}</b>`; feedEl.disabled = n <= 0; },
    setZoom(fov, wide) { zoomEl.textContent = (wide / fov).toFixed(1) + '×'; },
    setMuted(on_) { muteEl.setAttribute('aria-pressed', String(on_)); muteEl.textContent = on_ ? 'Muted' : 'Sound'; },
    progress(u) { railEl.style.width = Math.round(u * 100) + '%'; },
    flash() { flashEl.classList.remove('on'); void flashEl.offsetWidth; flashEl.classList.add('on'); },
    say(big, small) {
      sayEl.innerHTML = `<b>${big}</b>${small || ''}`;
      sayEl.classList.add('on');
      clearTimeout(sayTimer); sayTimer = setTimeout(() => sayEl.classList.remove('on'), 1400);
    },
    // the print slides out of the camera and stacks up at the bottom right; only the last few stay
    addShot(shot) {
      const card = el('div', 'sf-shot');
      card.appendChild(copyThumb(shot.thumb));
      card.appendChild(el('div', 'sf-cap', `<span>${shot.best ? shot.best.species.name : 'Empty'}</span><b>${shot.points}</b>`));
      shotsEl.appendChild(card);
      requestAnimationFrame(() => card.classList.add('in'));
      while (shotsEl.children.length > 6) shotsEl.firstChild.remove();
      if (shotsEl.children.length > 3) {
        const old = shotsEl.firstChild;
        old.classList.add('out');
        setTimeout(() => old.remove(), 420);
      }
    },
    help(text) { helpEl.textContent = text; helpEl.classList.remove('gone'); setTimeout(() => helpEl.classList.add('gone'), 5000); },

    // ---- the field report: best shot per species, the total, and the board for this route and time
    async report({ shots, route: r, tod: t, store, onDone, onAgain }) {
      if (report) return;
      report = el('div', 'sf-report');
      report.setAttribute('role', 'dialog');
      report.setAttribute('aria-label', 'Field report');
      // one card per species, with every shot of it behind the chosen one: the visitor picks which
      // frame counts, and the total follows their choice
      const byId = new Map();
      shots.forEach((s) => {
        if (!s.best) return;
        const k = s.best.species.id;
        if (!byId.has(k)) byId.set(k, []);
        byId.get(k).push(s);
      });
      const picks = [...byId.values()]
        .map((list) => ({ list: list.sort((a, b) => b.points - a.points), i: 0 }))
        .sort((a, b) => b.list[0].points - a.list[0].points);
      const chosen = (p) => p.list[p.i];
      const total = () => picks.reduce((n, p) => n + chosen(p).points, 0);
      report.innerHTML = `<div class="sf-wrap">
        <div class="sf-sub">${r.name} · ${TOD[t] || 'Day'} · ${shots.length} shot${shots.length === 1 ? '' : 's'}</div>
        <h2>Field report</h2>
        <div class="sf-total"><b id="sf-total">${total()}</b><span class="sf-caps">points · ${picks.length} species</span></div>
        <div class="sf-grid" id="sf-picks"></div>
        <div class="sf-board">
          <div><h3>Your name for the board</h3>
            <form class="sf-entry" id="sf-form"><input id="sf-name" maxlength="14" placeholder="Visitor" aria-label="Name for the leaderboard" autocomplete="off"><button type="submit" id="sf-save">Save</button></form>
            <p class="sf-empty" id="sf-note" style="margin-top:10px">Scores stay in this browser for now.</p></div>
          <div><h3>Best runs · ${r.name} · ${TOD[t] || 'Day'}</h3><ol class="sf-list" id="sf-list"></ol></div>
        </div>
        <div class="sf-done"><button id="sf-again">Drive it again</button><button id="sf-back">Back to the van</button></div>
      </div>`;
      const grid = report.querySelector('#sf-picks');
      const totalEl = report.querySelector('#sf-total');
      picks.forEach((p) => {
        const card = el('div', 'sf-card');
        const main = el('div', 'sf-main');
        const name = el('div', 'sf-name');
        const meta = el('div', 'sf-meta');
        card.append(main, name, meta);
        const paint = () => {
          const s = chosen(p);
          main.innerHTML = '';
          main.appendChild(copyThumb(s.thumb));
          name.textContent = s.best.species.name;
          meta.innerHTML = `<span>${verdict(s)}</span><b>${s.points}</b>`;
          totalEl.textContent = total();
        };
        if (p.list.length > 1) {                         // the other frames of the same animal
          const alts = el('div', 'sf-alts');
          p.list.forEach((s, i) => {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'sf-alt'; b.title = `${s.points} points`;
            b.setAttribute('aria-label', `Frame ${i + 1}, ${s.points} points`);
            b.appendChild(copyThumb(s.thumb, 3));
            b.addEventListener('click', () => {
              p.i = i; paint();
              alts.querySelectorAll('.sf-alt').forEach((x, k) => x.setAttribute('aria-pressed', String(k === i)));
            });
            b.setAttribute('aria-pressed', String(i === 0));
            alts.appendChild(b);
          });
          card.appendChild(alts);
        }
        paint();
        grid.appendChild(card);
      });
      if (!picks.length) grid.innerHTML = '<p class="sf-empty">No species in the album this time. The animals come closer when you feed them, and the lens zooms in for the shy ones.</p>';
      root.appendChild(report);
      root.classList.add('reporting');                 // the viewfinder and the tools step aside
      requestAnimationFrame(() => report.classList.add('on'));

      const listEl = report.querySelector('#sf-list');
      const draw = (rows, mine) => {
        listEl.innerHTML = '';
        if (!rows.length) { listEl.innerHTML = '<li><span class="sf-rank">–</span><span>No runs yet</span><span>0</span></li>'; return; }
        rows.slice(0, 8).forEach((e, i) => {
          const li = el('li', e === mine || (mine && e.at === mine.at) ? 'me' : '',
            `<span class="sf-rank">${i + 1}</span><span>${e.name}</span><span>${e.score}</span>`);
          listEl.appendChild(li);
        });
      };
      draw(await store.list(r.id, t), null);
      const { lastName, rememberName } = await import('./leaderboard.js');
      const nameEl = report.querySelector('#sf-name');
      nameEl.value = lastName();
      report.querySelector('#sf-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = (nameEl.value || 'Visitor').trim().slice(0, 14);
        rememberName(name);
        const mine = await store.add(r.id, t, { name, score: total(), shots: shots.length, species: picks.length });
        draw(await store.list(r.id, t), mine);
        report.querySelector('#sf-save').textContent = 'Saved';
        report.querySelector('#sf-note').textContent = 'Saved in this browser.';
      });
      report.querySelector('#sf-back').addEventListener('click', () => onDone && onDone());
      report.querySelector('#sf-again').addEventListener('click', () => onAgain && onAgain());
      setTimeout(() => { const b = report && report.querySelector('#sf-back'); if (b) b.focus({ preventScroll: true }); }, 450);
      return { total: total(), species: picks.length };
    },
    get reporting() { return !!report; },
    dispose() { clearTimeout(sayTimer); root.remove(); },
  };
  api.setFilm(film, film);
  api.setPellets(pellets);
  return api;
}
