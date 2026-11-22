const CACHE_NAME = "cuide-do-geraldei-v2";
const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/constants.js",
  "./js/state.js",
  "./js/persistence.js",
  "./js/sprites.js",
  "./js/audio.js",
  "./js/renderer.js",
  "./js/mechanics.js",
  "./js/minigames.js",
  "./js/main.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/sprites/cutouts/affectionate.png",
  "./assets/sprites/cutouts/playful-1.png",
  "./assets/sprites/cutouts/playful-2.png",
  "./assets/sprites/cutouts/grumpy.png",
  "./assets/sprites/cutouts/needy.png",
  "./assets/sprites/geraldei-serio.jpeg",
  "./assets/sprites/cutouts/sleeping.png",
  "./assets/sprites/geraldei-dormindo.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});
