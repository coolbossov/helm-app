// Service worker disabled to avoid stale cache serving old map bundles.
// This worker unregisters itself and clears legacy sapd-shell caches.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith("sapd-shell-")).map((k) => caches.delete(k))
      );
      await self.registration.unregister();
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", () => {
  // Intentionally no-op: always use network/default browser behavior.
});
