// BUG-032: the station's model files stay on the device (the browser's Cache Storage), so coming back
// to the 3D page from a sub page reads them from there instead of downloading them again.
// A kept file is used at once; a few seconds later one small HEAD request asks the site whether the
// file changed (ETag / Last-Modified / size). Only then is the new file fetched, for the next visit.
// Without Cache Storage (old browsers, some private windows) the file is simply downloaded as before.
const STORE = 'station-models-v1';
const stamp = (r) => (r && (r.headers.get('etag') || r.headers.get('last-modified') || r.headers.get('content-length'))) || '';

async function open() {
  try { return 'caches' in window ? await caches.open(STORE) : null; } catch (e) { return null; }
}
async function refresh(cache, url, kept) {
  try {
    const head = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    if (!head.ok || !stamp(head) || stamp(head) === stamp(kept)) return;
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) await cache.put(url, res);
  } catch (e) { /* offline or blocked: keep what is there */ }
}

// the file as an ArrayBuffer (for GLTFLoader.parse)
export async function modelBuffer(path) {
  const url = new URL(path, location.href).href;
  const cache = await open();
  if (cache) {
    let kept = null;
    try { kept = await cache.match(url); } catch (e) { kept = null; }
    if (kept) {
      try {
        const buf = await kept.arrayBuffer();
        setTimeout(() => refresh(cache, url, kept), 8000);
        return buf;
      } catch (e) { /* unreadable: download below */ }
    }
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  if (cache) cache.put(url, res.clone()).catch(() => {});
  return res.arrayBuffer();
}
