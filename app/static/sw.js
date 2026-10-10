const CACHE = "shopkaro-shell-v1";
const SHELL = [
  "/",
  "/static/style.css",
  "/static/app.js",
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png"
];

// pehli baar: page ki zaroori files yaad kar lo
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

// purana yaaddaasht hatao
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// har request pe
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // sirf page ki files (HTML, CSS, JS, icons). API (products, cart, orders) ko haath nahi lagate
  const isShell = url.pathname === "/" || url.pathname.startsWith("/static/");
  if (!isShell) return;

  // pehle internet se lao (taaki tumhare edits dikhein), na mile to yaaddaasht se do
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req))
  );
});