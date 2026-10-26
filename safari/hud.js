// Everything the visitor sees on top of the picture. Kept to what the plan allows: the viewfinder,
// how much film is left, the feed button, exit (plus a mute toggle, because the safari makes sound).
// The viewfinder is an old camera's focusing screen: corner marks, a pale ring with a split-image spot
// in the middle, grain and a few specks of dust, and the figures along the bottom edge of the frame.
// The HUD element is also the input surface: the station's canvas sits behind it, so no drag of
// the safari ever reaches the station's orbit controls.
import { bonusText } from './photo.js';

const TOD = { dawn: 'Dawn', day: 'Day', dusk: 'Dusk', night: 'Night' };
// names on the board come back out of localStorage, so they go in as text, never as markup
const esc = (v) => String(v).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html !== undefined) n.innerHTML = html; return n; };
// the same frame can show up in the feed and twice in the report, so each place gets its own copy
function copyThumb(src, shrink = 1) {
  const c = document.createElement('canvas');
  c.width = Math.round(src.width / shrink); c.height = Math.round(src.height / shrink);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c;
}
// dust on the focusing screen: a few dark specks and short fibres, different on every run
function dust() {
  const r = Math.random, bits = [];
  for (let i = 0; i < 26; i++) {
    const x = (r() * 100).toFixed(1), y = (r() * 100).toFixed(1);
    if (r() < 0.8) bits.push(`<circle cx='${x}%' cy='${y}%' r='${(0.5 + r() * 0.9).toFixed(1)}' fill-opacity='${(0.25 + r() * 0.35).toFixed(2)}'/>`);
    else bits.push(`<path d='M0 0q${(r() * 8 - 4).toFixed(1)} ${(r() * 6 - 3).toFixed(1)} ${(r() * 14 - 7).toFixed(1)} ${(r() * 10 - 5).toFixed(1)}' transform='translate(${x * 12.8} ${y * 8})' stroke='%23000' stroke-opacity='.3' fill='none' stroke-width='.7'/>`);
  }
  return `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='1280' height='800' viewBox='0 0 1280 800' preserveAspectRatio='none'>${bits.join('')}</svg>")`;
}
const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

export function createHud({ host = document.body, route, tod, film, pellets, on = {} }) {
  const touch = !matchMedia('(hover: hover)').matches;
  // the feed button names its key where there is a keyboard
  const feedLabel = (n) => `Feed <b>${n}</b>${touch ? '' : ' <span class="sf-key">(Space)</span>'}`;
  const root = el('div', 'safari');
  root.setAttribute('role', 'application');
  root.setAttribute('aria-label', `Photo safari: ${route.name}`);
  root.innerHTML = `
    <div class="sf-finder">
      <div class="sf-grain"></div><div class="sf-dust"></div>
      <div class="sf-corner tl"></div><div class="sf-corner tr"></div><div class="sf-corner bl"></div><div class="sf-corner br"></div>
      <div class="sf-focus"><i class="sf-split"></i></div>
    </div>
    <div class="sf-read sf-read-l"><span id="sf-film"><b>${film}</b></span></div>
    <div class="sf-read sf-read-r"><span id="sf-zoom">1.0×</span><span id="sf-clock">0:00</span></div>
    <div class="sf-top-right">
      <button id="sf-mute" aria-pressed="false" title="Sound">Sound</button>
      <button id="sf-exit">Exit</button>
    </div>
    <div class="sf-tools"><button id="sf-feed">${feedLabel(pellets)}</button></div>
    <div class="sf-feed" id="sf-shots" aria-live="polite"></div>
    <div class="sf-sea"></div>
    <div class="sf-title" id="sf-title"></div>
    <div class="sf-say" id="sf-say"></div>
    <div class="sf-flash" id="sf-flash"></div>
    <div class="sf-help" id="sf-help"></div>
    <div class="sf-hint" id="sf-hint" aria-live="polite"></div>
    <div class="sf-rail"><i id="sf-rail"></i></div>`;
  host.appendChild(root);
  root.querySelector('.sf-dust').style.backgroundImage = dust();

  const q = (id) => root.querySelector('#' + id);
  const filmEl = q('sf-film'), zoomEl = q('sf-zoom'), feedEl = q('sf-feed'), shotsEl = q('sf-shots'),
        sayEl = q('sf-say'), flashEl = q('sf-flash'), helpEl = q('sf-help'), railEl = q('sf-rail'),
        muteEl = q('sf-mute'), hintEl = q('sf-hint'), exitEl = q('sf-exit'), clockEl = q('sf-clock'), titleEl = q('sf-title');

  // buttons must never also take a photo, so they swallow the tap before the view sees it
  const stop = (e) => e.stopPropagation();
  root.querySelectorAll('button').forEach((b) => {
    b.addEventListener('pointerdown', stop); b.addEventListener('pointerup', stop);
    b.addEventListener('click', () => b.blur());       // after a tap the space bar is the shutter again
  });
  exitEl.addEventListener('click', () => on.exit && on.exit());
  feedEl.addEventListener('click', () => on.feed && on.feed());
  muteEl.addEventListener('click', () => on.mute && on.mute());

  helpEl.textContent = touch ? 'Drag to look · tap to shoot · pinch to zoom' : 'Mouse to aim · click or Enter to shoot · wheel to zoom · space or F to feed';
  setTimeout(() => helpEl.classList.add('gone'), 7000);

  let sayTimer = 0, titleTimer = 0, report = null, viewer = null;
  // a print slides away to the right and is gone once the slide is over
  const leave = (c) => { if (c.classList.contains('out')) return; c.classList.add('out'); setTimeout(() => c.remove(), 460); };
  const keys = new AbortController();
  const api = {
    root,
    // frames left, the way a film counter shows it; the last fifth of the roll turns red
    setFilm(left, total) {
      filmEl.innerHTML = `<b>${left}</b>`;
      filmEl.title = `${left} of ${total} frames left`;
      filmEl.classList.toggle('low', left <= Math.max(3, Math.round(total * 0.2)));
    },
    setClock(sec) { const t = clock(sec); if (clockEl.textContent !== t) clockEl.textContent = t; },
    setPellets(n) { feedEl.innerHTML = feedLabel(n); feedEl.disabled = n <= 0; },
    setZoom(fov, wide) { zoomEl.textContent = (wide / fov).toFixed(1) + '×'; },
    setMuted(on_) { muteEl.setAttribute('aria-pressed', String(on_)); muteEl.textContent = on_ ? 'Muted' : 'Sound'; },
    progress(u) { railEl.style.width = Math.round(u * 100) + '%'; },
    // is this point inside the frame the corner marks draw (the reticle)?
    inFrame(x, y) {
      const a = root.querySelector('.sf-corner.tl').getBoundingClientRect(), b = root.querySelector('.sf-corner.br').getBoundingClientRect();
      return x >= a.left && x <= b.right && y >= a.top && y <= b.bottom;
    },
    flash() { flashEl.classList.remove('on'); void flashEl.offsetWidth; flashEl.classList.add('on'); },
    say(big, small) {
      sayEl.innerHTML = `<b>${big}</b>${small || ''}`;
      sayEl.classList.add('on');
      clearTimeout(sayTimer); sayTimer = setTimeout(() => sayEl.classList.remove('on'), 1400);
    },
    // a tap or click on a print sends it away at once, the same way it leaves on its own (the photo
    // stays in the bag); true when the point was on one, so the caller doesn't shoot
    dropShot(x, y) {
      const hit = [...shotsEl.children].find((c) => {      // one already sliding away still catches the tap
        const r = c.getBoundingClientRect();
        return r.width > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      });
      if (hit) leave(hit);
      return !!hit;
    },
    // the print slides out of the camera at the bottom right, stays 2 s and slides away to the right;
    // each print keeps its own 2 s, so a fast burst stacks a few for a moment (only the last few stay)
    addShot(shot) {
      const card = el('div', 'sf-shot');
      card.appendChild(copyThumb(shot.thumb));
      // the final score with the bonuses it earned under it; a frame worth nothing gets no label at all
      if (shot.best && shot.points) {
        card.appendChild(el('div', 'sf-cap', `<span>${shot.best.species.name}</span><b>${shot.points}</b>`));
        if (shot.bonuses.length) card.appendChild(el('div', 'sf-bonus', bonusText(shot)));
      }
      shotsEl.appendChild(card);
      requestAnimationFrame(() => card.classList.add('in'));
      setTimeout(() => leave(card), 2000);
      while (shotsEl.children.length > 6) shotsEl.firstChild.remove();
      const live = [...shotsEl.children].filter((c) => !c.classList.contains('out'));
      if (live.length > 3) leave(live[0]);
    },
    // the name of a stretch of the route, when the van rolls into it
    title(big, small) {
      titleEl.innerHTML = `<b>${big}</b>${small ? `<span>${small}</span>` : ''}`;
      titleEl.classList.remove('on'); void titleEl.offsetWidth; titleEl.classList.add('on');
      clearTimeout(titleTimer); titleTimer = setTimeout(() => titleEl.classList.remove('on'), 3600);
    },
    // `under` tints the frame while the van is below the surface
    under(k) { root.style.setProperty('--under', k.toFixed(3)); root.classList.toggle('under', k > 0.02); },
    help(text) { helpEl.textContent = text; helpEl.classList.remove('gone'); setTimeout(() => helpEl.classList.add('gone'), 5000); },
    // how to zoom, on the first stretch where the lens needs it; it stays until the visitor zooms
    zoomHint(on) {
      if (on) { hintEl.textContent = touch ? 'Pinch to zoom' : 'Scroll or pinch the trackpad to zoom'; helpEl.classList.add('gone'); }
      hintEl.classList.toggle('on', !!on);
    },

    // ---- the field report: every shot on its own card, the total, and the board for this route and
    // time. The total counts the best frame of each species (the cards say which one counts).
    async report({ shots, route: r, tod: t, store, fresh = 0, onDone, onAgain }) {
      if (report && report.isConnected) return;
      if (viewer) { viewer.remove(); viewer = null; }
      report = el('div', 'sf-report');      // a report that failed half-built is simply built again
      report.setAttribute('role', 'dialog');
      report.setAttribute('aria-label', 'Field report');
      const best = new Map();
      shots.forEach((s) => {
        if (!s.best) return;
        const k = s.best.species.id;
        if (!best.has(k) || s.points > best.get(k).points) best.set(k, s);
      });
      const counted = new Set(best.values());
      const species = best.size;
      const total = () => [...counted].reduce((n, s) => n + s.points, 0);
      report.innerHTML = `<div class="sf-wrap">
        <div class="sf-sub">${r.name} · ${TOD[t] || 'Day'} · ${shots.length} shot${shots.length === 1 ? '' : 's'}</div>
        <h2>Field report</h2>
        <div class="sf-total"><b id="sf-total">${total()}</b><span class="sf-caps">points · ${species} species${fresh ? ` · ${fresh} new in the field log` : ''}</span></div>
        <div class="sf-grid" id="sf-picks"></div>
        <div class="sf-board">
          <div><h3>Your name for the board</h3>
            <form class="sf-entry" id="sf-form"><input id="sf-name" maxlength="5" placeholder="NAME" aria-label="Name for the leaderboard, up to 5 letters" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false"><button type="submit" id="sf-save">Save</button></form>
            <p class="sf-empty" id="sf-note" style="margin-top:10px">Scores stay in this browser for now.</p></div>
          <div><h3>Best runs · ${r.name}</h3><ol class="sf-list" id="sf-list"></ol></div>
        </div>
        <div class="sf-done"><button id="sf-again">Drive it again</button><button id="sf-back">Back to the van</button></div>
      </div>`;
      const grid = report.querySelector('#sf-picks');
      const name = (s) => (s.best ? s.best.species.name : 'Nothing in frame');
      // one card per shot, in the order they were taken
      shots.forEach((s, i) => {
        const card = el('button', 'sf-card' + (counted.has(s) ? ' counts' : ''));
        card.type = 'button';
        card.setAttribute('aria-label', `Photo ${i + 1}: ${name(s)}, ${s.points} points${bonusText(s) ? ' ' + bonusText(s) : ''}. Open large`);
        try { card.appendChild(copyThumb(s.thumb)); } catch (err) { console.error('Safari photo failed', err); }   // one bad print doesn't stop the report
        if (s.best && s.points) {       // the same final score and bonus words as the polaroid; an empty frame has no label
          card.appendChild(el('div', 'sf-name', esc(name(s))));
          card.appendChild(el('div', 'sf-meta', `<span>${bonusText(s)}</span><b>${s.points}</b>`));
        }
        card.addEventListener('click', () => open(i));
        grid.appendChild(card);
      });

      // ---- one photo large on top of the report: click outside, the close button or Esc closes it,
      // the arrows and a swipe go through the roll
      let at = 0;
      const open = (i) => {
        if (!viewer) {
          viewer = el('div', 'sf-view');
          viewer.setAttribute('role', 'dialog');
          viewer.setAttribute('aria-label', 'Photo');
          viewer.innerHTML = `<figure class="sf-print"><div class="sf-pic"></div><figcaption><span class="sf-vname"></span><span class="sf-vmeta"></span><b class="sf-vpts"></b></figcaption></figure>
            <button type="button" class="sf-vbtn sf-prev" aria-label="Previous photo">‹</button>
            <button type="button" class="sf-vbtn sf-next" aria-label="Next photo">›</button>
            <button type="button" class="sf-vclose" aria-label="Close">Close</button>
            <div class="sf-vcount"></div>`;
          viewer.addEventListener('click', (e) => { if (e.target === viewer) close(); });
          viewer.querySelector('.sf-vclose').addEventListener('click', close);
          viewer.querySelector('.sf-prev').addEventListener('click', () => go(-1));
          viewer.querySelector('.sf-next').addEventListener('click', () => go(1));
          let sx = null;
          const fig = viewer.querySelector('.sf-print');
          fig.addEventListener('pointerdown', (e) => { sx = { x: e.clientX, y: e.clientY }; });
          fig.addEventListener('pointerup', (e) => {
            if (!sx) return;
            const dx = e.clientX - sx.x, dy = e.clientY - sx.y;
            sx = null;
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
          });
          fig.addEventListener('pointercancel', () => { sx = null; });
          report.appendChild(viewer);
        }
        at = (i + shots.length) % shots.length;
        const s = shots[at];
        const pic = viewer.querySelector('.sf-pic');
        pic.innerHTML = '';
        if (s.big) { const img = new Image(); img.src = s.big; img.alt = name(s); pic.appendChild(img); }
        else pic.appendChild(copyThumb(s.thumb));
        const worth = !!(s.best && s.points);
        viewer.querySelector('.sf-vname').textContent = worth ? name(s) : '';
        viewer.querySelector('.sf-vmeta').textContent = worth ? bonusText(s) : '';
        viewer.querySelector('.sf-vpts').textContent = worth ? `${s.points}` : '';
        viewer.querySelector('.sf-vcount').textContent = `${at + 1} / ${shots.length}`;
        viewer.querySelectorAll('.sf-vbtn').forEach((b) => { b.hidden = shots.length < 2; });
        requestAnimationFrame(() => viewer && viewer.classList.add('on'));
        viewer.querySelector('.sf-vclose').focus({ preventScroll: true });
      };
      const go = (d) => open(at + d);
      const close = () => {
        if (!viewer) return;
        const card = grid.children[at];
        viewer.remove(); viewer = null;
        if (card && card.focus) card.focus({ preventScroll: true });
      };
      // keys while the photo is open (wherever the focus is); otherwise the report keeps its own keys
      window.addEventListener('keydown', (e) => {
        if (!viewer) return;
        const k = e.key;
        if (k === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); }
        else if (k === 'ArrowLeft' || k === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); go(k === 'ArrowLeft' ? -1 : 1); }
      }, { capture: true, signal: keys.signal });
      if (!shots.length) grid.innerHTML = '<p class="sf-empty">No photos this time. The animals come closer when you feed them, and the lens zooms in for the shy ones.</p>';
      else if (!species) grid.insertAdjacentHTML('beforebegin', '<p class="sf-empty">No species in frame this time. The animals come closer when you feed them, and the lens zooms in for the shy ones.</p>');
      report.querySelector('#sf-back').addEventListener('click', () => onDone && onDone());
      report.querySelector('#sf-again').addEventListener('click', () => onAgain && onAgain());
      root.appendChild(report);
      root.classList.add('reporting');                 // the viewfinder and the tools step aside
      const shown = report;
      requestAnimationFrame(() => shown.classList.add('on'));

      const listEl = report.querySelector('#sf-list');
      const draw = (rows, mine) => {
        listEl.innerHTML = '';
        if (!rows.length) { listEl.innerHTML = '<li class="sf-none">No runs yet</li>'; return; }
        rows.slice(0, 10).forEach((e, i) => {
          const li = el('li', e === mine || (mine && e.at === mine.at) ? 'me' : '',
            `<span class="sf-rank">${i + 1}.</span><span>${esc(e.name)}</span><span class="sf-score">${esc(e.score)}</span>`);
          listEl.appendChild(li);
        });
      };
      draw(await store.list(r.id), null);
      const { lastName, rememberName, cleanName } = await import('./leaderboard.js');
      const form = report.querySelector('#sf-form'), nameEl = report.querySelector('#sf-name'), saveEl = report.querySelector('#sf-save');
      // only capitals A–Z, Ä, Ö, Ü, at most 5: a lowercase letter turns into its capital, any other key is not taken
      const tidy = () => {
        const v = nameEl.value, c = cleanName(v);
        if (c !== v) {
          const at = cleanName(v.slice(0, nameEl.selectionStart ?? v.length)).length;
          nameEl.value = c;
          try { nameEl.setSelectionRange(at, at); } catch (err) { /* not focused */ }
        }
        saveEl.disabled = !c;
      };
      nameEl.value = lastName();
      tidy();
      nameEl.addEventListener('input', tidy);
      let saved = false;                               // one save per run
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = cleanName(nameEl.value);
        if (saved || !name) return;
        saved = true;
        form.hidden = true;
        rememberName(name);
        const mine = await store.add(r.id, { name, score: total(), shots: shots.length, species });
        draw(await store.list(r.id), mine);
        report.querySelector('#sf-note').textContent = 'Saved in this browser.';
      });
      setTimeout(() => { const b = report && report.querySelector('#sf-back'); if (b) b.focus({ preventScroll: true }); }, 450);
      return { total: total(), species };
    },
    get reporting() { return !!report; },
    get reportShown() { return !!report && report.isConnected; },
    get viewing() { return !!viewer; },
    dispose() { keys.abort(); clearTimeout(sayTimer); clearTimeout(titleTimer); root.remove(); },
  };
  api.setFilm(film, film);
  api.setPellets(pellets);
  return api;
}
