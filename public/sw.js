const CACHE_VERSION = "manalio-pwa-v2";
const STATIC_CACHE = [
  "/offline.html",
  "/images/brand-icon.svg",
  "/images/app-icon-192.png",
  "/images/app-icon-512.png",
  "/images/app-icon-maskable-512.png",
  "/images/apple-touch-icon.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    precacheStaticAssets().then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isPrivateOrDynamicPath(url.pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

async function precacheStaticAssets() {
  const cache = await caches.open(CACHE_VERSION);
  const results = await Promise.allSettled(
    STATIC_CACHE.map(async (asset) => {
      const response = await fetch(asset, { cache: "reload" });
      if (response?.ok) await cache.put(asset, response);
    }),
  );
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length > 0) {
    console.warn(`Manalio service worker precache skipped ${failures.length} asset(s).`);
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response?.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || refresh || fetch(request);
}

function isPrivateOrDynamicPath(pathname) {
  return pathname.startsWith("/api/")
    || pathname === "/app"
    || pathname.startsWith("/app/")
    || pathname === "/login"
    || pathname.startsWith("/login/");
}

function isStaticAsset(pathname) {
  return pathname.startsWith("/images/")
    || pathname.startsWith("/_next/static/")
    || pathname === "/manifest.webmanifest"
    || pathname === "/offline.html";
}
