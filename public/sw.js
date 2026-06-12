// public/sw.js — Service worker mínimo para que la web sea instalable (PWA) y
// resista la pérdida de red. Estrategia conservadora: NO cachea HTML de páginas
// (siempre fresco desde la red); solo sirve una página offline de respaldo y
// cachea iconos estáticos. Subir CACHE_VERSION fuerza limpieza del caché viejo.
const CACHE_VERSION = "tj-v1";
const OFFLINE_URL = "/offline.html";
const EXTRA_PRECACHE = ["/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      // La página offline es crítica: si esto falla, el fallback no existe → que
      // reviente el install. Los iconos son opcionales (allSettled): un 404 en
      // uno no debe impedir cachear la offline.
      await cache.add(OFFLINE_URL);
      await Promise.allSettled(EXTRA_PRECACHE.map((url) => cache.add(url)));
    })
  );
  // Seguro mientras el SW NO cachee HTML ni /_next/ (solo iconos versionados por
  // nombre). Si algún día se cachean páginas/chunks, revisar este skipWaiting:
  // serviría assets de dos versiones mezclados a pestañas abiertas.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navegaciones (páginas): siempre red; si falla, página offline de respaldo.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((r) => r || Response.error())
      )
    );
    return;
  }

  // Iconos del PWA: cache-first (estables, versionados por archivo).
  if (url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
  }
});
