// First-visit tour by the figure at the camp (FEAT-023).
//   - first visit only (remembered in the browser): a small banner after loading points to the camp,
//     and the figure glows softly until it is first clicked or tapped (the glow itself is drawn in
//     index.html, stepFigureGlow, which asks `glowing()`)
//   - clicking the figure asks "Tour or leave a message?" (index.html, the camp's bubble); Tour calls
//     start() here
//   - the tour: a short introduction while the figure faces the visitor, then the camera flies
//     place to place (hub, showroom, library, workshop, relay, radio telescope, camp) and the figure's
//     lines show in a small speech card with Next and Skip; at the end the top menu pulses while the
//     card says that every place can be reached from there. The visitor stays at the last view.
//   - Skip, Esc, or going somewhere else on the way end it at once. Once it was skipped or finished,
//     or the banner was dismissed, the banner never comes back by itself; the figure still offers the tour.
// No sound. index.html builds the host: go(id) flies to a place without opening its panel,
// endIntro() lets the figure walk on (Skip during the introduction).

// PLACEHOLDER texts (Smo supplies the real ones), written from what each place contains
const NAME = 'The camp guide';
const BANNER = 'New here? Find the guide at the camp and click him.';
const STEPS = [
  { place: null, text: 'Welcome to the station! Each module holds one field of work: research, products, technology and media. The camp, the relay and the telescope around it hold the person. Let me show you round.' },
  { place: 'hub', text: 'This is the hub, where it all starts. The screens tell who builds this station, and a small robot walks the floor. Tap it to say hello.' },
  { place: 'showroom', text: 'The showroom holds media and installations: a film plays all round the walls, and a six-legged robot roams the floor. Click the roof to open or close it.' },
  { place: 'library', text: 'The library holds the research: the thesis on non-human communication, papers and talks. The computer lists the publications, and the cat on the shelf waves.' },
  { place: 'workshop', text: 'The workshop is for technology and AI. The devices on the bench work: print a model, play the synth, try the amp, the scope or the tape delay.' },
  { place: 'relay', text: 'The relay station is where you get in touch. Inside the hut there is a radio room with a small game.' },
  { place: 'dish', text: 'The radio telescope follows the sun and the moons across the sky. Click it and it tracks one of them.' },
  { place: 'camp', text: 'And this is my camp. Sit by the fire, step into the van for the photo album and the Photo Safari, or leave a message with me.' },
  { place: null, menu: true, text: 'One last thing: from the menu up top you can jump to any place at any time. Have fun exploring!' },
];
const KEY = 'station-guide-intro';

const S = { host: null, on: false, i: 0, expect: null, first: false, clicked: false, banner: null, card: null };

function seen() { try { return localStorage.getItem(KEY) === 'done'; } catch (e) { return false; } }
function markSeen() { try { localStorage.setItem(KEY, 'done'); } catch (e) { /* no storage */ } }

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}
function build() {
  const b = el('div', 'tour-banner'); b.hidden = true; b.setAttribute('role', 'status');
  b.dataset.placeholder = 'true';
  b.appendChild(el('span', 'tour-banner-text', BANNER));
  const x = el('button', 'tour-banner-close', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Dismiss');
  x.addEventListener('click', () => { hideBanner(); markSeen(); });
  b.appendChild(x);
  document.body.appendChild(b);
  S.banner = b;

  const c = el('div', 'tour-card'); c.hidden = true;
  c.setAttribute('role', 'dialog'); c.setAttribute('aria-label', 'Tour of the station');
  c.dataset.placeholder = 'true';
  const head = el('div', 'tour-who');
  head.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7.5" r="3.6"/><path d="M4.5 21c.6-4.6 3.6-7.4 7.5-7.4s6.9 2.8 7.5 7.4"/></svg>';
  head.appendChild(el('span', 'kicker', NAME));
  head.appendChild(el('span', 'tour-count'));
  c.appendChild(head);
  c.appendChild(el('p', 'tour-text'));
  const a = el('div', 'bubble-actions');
  const next = el('button', 'btn', 'Next'); next.type = 'button'; next.id = 'tour-next';
  const skip = el('button', 'btn ghost', 'Skip'); skip.type = 'button'; skip.id = 'tour-skip';
  next.addEventListener('click', () => advance());
  skip.addEventListener('click', () => end('skip'));
  a.appendChild(next); a.appendChild(skip);
  c.appendChild(a);
  c.appendChild(el('div', 'tour-note', 'Placeholder text'));
  document.body.appendChild(c);
  S.card = c;

  window.addEventListener('keydown', (e) => {
    if (!S.on || e.key !== 'Escape') return;
    e.preventDefault(); e.stopImmediatePropagation();          // Esc ends the tour only: the visitor stays where they are
    end('skip');
  }, true);
}

function hideBanner() { if (S.banner) S.banner.hidden = true; }

function render() {
  const st = STEPS[S.i], c = S.card;
  c.querySelector('.tour-text').textContent = st.text;
  c.querySelector('.tour-count').textContent = `${S.i + 1} / ${STEPS.length}`;
  c.querySelector('#tour-next').textContent = S.i === STEPS.length - 1 ? 'Done' : 'Next';
  const was = c.hidden;
  c.hidden = false;
  if (was) requestAnimationFrame(() => c.classList.add('on'));
  document.body.classList.add('tour-on');
  document.body.classList.toggle('tour-menu', !!st.menu);
  setTimeout(() => { if (S.on && !c.contains(document.activeElement)) c.querySelector('#tour-next').focus({ preventScroll: true }); }, 50);
}

function goStep(i) {
  S.i = i;
  const st = STEPS[i];
  if (st.place) { S.expect = st.place; S.host.go(st.place); }
  render();
}
function advance() {
  if (!S.on) return;
  if (S.i >= STEPS.length - 1) { end('done'); return; }
  goStep(S.i + 1);
}
function end(why) {
  if (!S.on) return;
  const atIntro = S.i === 0;
  S.on = false; S.expect = null;
  S.card.classList.remove('on'); S.card.hidden = true;
  document.body.classList.remove('tour-on', 'tour-menu');
  markSeen();
  if (S.host.ended) S.host.ended(why);
  if (atIntro && why !== 'left' && S.host.endIntro) S.host.endIntro();
}

export const tour = {
  setup(host) { S.host = host; S.first = !seen(); build(); },
  // after the loading screen: the banner, on the first visit only
  loaded() { if (S.first && !seen() && !S.on) S.banner.hidden = false; },
  glowing() { return S.first && !S.clicked; },
  figureClicked() { S.clicked = true; hideBanner(); },
  start() { hideBanner(); S.on = true; S.expect = null; goStep(0); },
  // index.html calls this whenever a place is entered: somewhere the tour didn't send the visitor ends it
  entered(id) { if (S.on && id !== S.expect) end('left'); },
  // the camp's figure view was left during the introduction (Back): the tour ends with it
  introLeft() { if (S.on && S.i === 0) end('left'); },
  skip() { end('skip'); },
  next() { advance(); },
  get active() { return S.on; },
  state: () => ({ on: S.on, step: S.i, place: STEPS[S.i].place, menu: !!STEPS[S.i].menu, first: S.first, clicked: S.clicked, seen: seen(),
    banner: !!S.banner && !S.banner.hidden, card: !!S.card && !S.card.hidden }),
  steps: STEPS.map((s) => s.place),
};
