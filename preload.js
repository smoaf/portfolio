// FEAT-046: places load quietly in the background while the visitor is near them, so going in is instant.
// index.html lists the jobs: for each, when it counts as near and the steps that load it (modules, the van's
// interior, images). A job starts after the visitor has been near it for a moment (a fly-past loads
// nothing), and runs one step at a time in the browser's idle time, so walking round never stutters.
// A finished job stays finished: going back in is instant. Nothing starts before the station is on screen
// and the startup loader is gone, so the first page load is exactly as before.
// `need(id)` starts a job at once (the visitor went in early); `done(id)` says whether it has finished.
const DWELL = 1200;                                   // ms near a place before its job starts
const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 60));

export function createPreloader({ canStart }) {
  const jobs = new Map(), queue = [];
  let busy = false, lastTick = 0, hurry = 0;          // hurry: someone waits for a job, no more idle gaps
  function run() {
    if (busy || !queue.length) return;
    const job = queue.shift();
    busy = true;
    const next = (i) => {
      if (i >= job.steps.length) { job.state = 'done'; job.at = performance.now() - job.t0; busy = false; job.resolve(); run(); return; }
      job.step = i;
      (hurry ? (fn) => setTimeout(fn, 0) : idle)(() => {
        let r; try { r = job.steps[i](); } catch (err) { r = null; }
        Promise.resolve(r).catch(() => {}).then(() => next(i + 1));
      });
    };
    job.t0 = performance.now();
    next(0);
  }
  function start(job) {
    if (job.state !== 'idle') return;
    job.state = 'loading'; queue.push(job); run();
  }
  return {
    add(id, near, steps) {
      let resolve; const p = new Promise((r) => { resolve = r; });
      jobs.set(id, { id, near, steps, state: 'idle', since: 0, p, resolve, t0: 0, at: 0 });
    },
    // called every frame; looks round twice a second
    tick(now) {
      if (now - lastTick < 500) return;
      lastTick = now;
      if (!canStart()) return;
      for (const job of jobs.values()) {
        if (job.state !== 'idle') continue;
        if (!job.near()) { job.since = 0; continue; }
        if (!job.since) job.since = now;
        if (now - job.since >= DWELL) start(job);
      }
    },
    need(id) {
      const job = jobs.get(id); if (!job) return Promise.resolve();
      if (job.state === 'done') return job.p;
      if (job.state === 'idle') { job.state = 'loading'; queue.unshift(job); }
      else if (queue.includes(job)) { queue.splice(queue.indexOf(job), 1); queue.unshift(job); }
      hurry++; job.p.then(() => { hurry--; });
      run();
      return job.p;
    },
    done: (id) => { const job = jobs.get(id); return !job || job.state === 'done'; },
    state: () => [...jobs.values()].map((j) => ({ id: j.id, state: j.state, step: j.step, ms: Math.round(j.at) })),
  };
}
