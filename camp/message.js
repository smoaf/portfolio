// "Leave a message": the glass panel the figure at the camp opens. Name, email (to reply to),
// message and a honeypot field against spam. No phone number and no contact data on purpose.
// Where it sends to is set in config.js; while that is empty the send button says so.
import { FORM_ENDPOINT, FORM_FORMAT } from './config.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// body: the element the form is drawn into; onDone: called by the Close button of the success state.
// endpoint/format may be passed to override the config (used by tests to see the success and error states).
export function mountMessage(body, { onDone, endpoint = FORM_ENDPOINT, format = FORM_FORMAT } = {}) {
  const live = !!endpoint;
  body.innerHTML = `<div class="kicker">Camp</div><h2>Leave a message</h2>
    <form class="msg-form" novalidate>
      <label class="msg-field"><span class="kicker">Name</span><input name="name" autocomplete="name" maxlength="120" required></label>
      <label class="msg-field"><span class="kicker">Email <em>to reply to</em></span><input name="email" type="email" autocomplete="email" inputmode="email" maxlength="200" required></label>
      <label class="msg-field"><span class="kicker">Message</span><textarea name="message" rows="6" maxlength="4000" required></textarea></label>
      <div class="msg-hp" aria-hidden="true"><label>Leave this field empty<input name="website" tabindex="-1" autocomplete="off"></label></div>
      <div class="panel-actions"><button class="btn msg-send" type="submit"${live ? '' : ' aria-disabled="true" aria-describedby="msg-off"'}>${live ? 'Send' : 'Send · not connected yet'}</button></div>
      ${live ? '' : '<p class="note" id="msg-off">Sending isn’t connected yet, so messages can’t be sent from here for now.</p>'}
      <p class="msg-status" role="status" aria-live="polite"></p>
    </form>`;
  const form = body.querySelector('form'), status = body.querySelector('.msg-status'), send = body.querySelector('.msg-send');
  const say = (txt, kind) => { status.textContent = txt; status.dataset.kind = kind || ''; };
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!live) { say('Messages can’t be sent yet: the sending service isn’t connected.', 'error'); return; }
    const data = Object.fromEntries(new FormData(form));
    const bad = !data.name.trim() ? 'name' : !EMAIL.test(data.email.trim()) ? 'email' : !data.message.trim() ? 'message' : null;
    form.querySelectorAll('[aria-invalid]').forEach((f) => f.removeAttribute('aria-invalid'));
    if (bad) {
      form.elements[bad].setAttribute('aria-invalid', 'true'); form.elements[bad].focus();
      say({ name: 'Please add your name.', email: 'Please add an email address to reply to.', message: 'Please write a message.' }[bad], 'error');
      return;
    }
    if (data.website) { done(data.name); return; }            // honeypot filled: a bot; pretend it worked
    send.disabled = true; say('Sending…');
    const msg = { name: data.name.trim(), email: data.email.trim(), message: data.message.trim() };
    try {
      let req;
      if (format === 'form') { const fd = new FormData(); Object.entries(msg).forEach(([k, v]) => fd.append(k, v)); req = { body: fd }; }
      else req = { body: JSON.stringify(msg), headers: { 'Content-Type': 'application/json' } };
      const res = await fetch(endpoint, { method: 'POST', ...req, headers: { Accept: 'application/json', ...(req.headers || {}) } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      done(msg.name);
    } catch (e) {
      send.disabled = false;
      say('That didn’t go through. Please try again in a moment.', 'error');
    }
  });
  function done(name) {
    body.innerHTML = `<div class="kicker">Camp</div><h2>Thank you${name ? ', ' + esc(name.trim().split(/\s+/)[0]) : ''}</h2>
      <p class="lead">Your message is on its way. I’ll reply to the email you gave.</p>
      <div class="panel-actions"><button class="btn msg-done" type="button">Close</button></div>`;
    body.querySelector('.msg-done').addEventListener('click', () => onDone && onDone());
    body.querySelector('.msg-done').focus();
  }
  return { focus: () => form.elements.name.focus({ preventScroll: true }) };
}
