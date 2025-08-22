// v2025-08-21-02 (bump de versão para forçar atualização)
const CACHE_NAME = "mh-pwa-v2025-08-21-02";
const BASE = "/MaxwellsHub-PWA"; // pasta do projeto no GitHub Pages

// Liste apenas os assets locais do próprio GitHub Pages
const ASSETS = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/style.css`,
  `${BASE}/script.js`,
  `${BASE}/manifest.json`,
  // adicione aqui ícones do PWA, se houver:
  // `${BASE}/icons/icon-192.png`,
  // `${BASE}/icons/icon-512.png`,
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // 🚫 Não intercepta cross-origin (ex.: chamadas para a Vercel)
  if (url.origin !== self.location.origin) return;

  // 🔁 Cache first para os assets locais
  e.respondWith(
    caches.match(e.request).then((cached) =>
      cached ||
      fetch(e.request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(e.request, copy));
        return resp;
      })
    )
  );
});
