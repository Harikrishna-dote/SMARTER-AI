import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

precacheAndRoute(self.__WB_MANIFEST);

const apiCache = new CacheFirst({
  cacheName: 'api-cache',
  plugins: [
    new ExpirationPlugin({
      maxEntries: 200,
      maxAgeSeconds: 7 * 24 * 60 * 60,
    }),
  ],
});

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  apiCache
);

const staticCache = new CacheFirst({
  cacheName: 'static-cache',
  plugins: [
    new ExpirationPlugin({
      maxEntries: 100,
      maxAgeSeconds: 30 * 24 * 60 * 60,
    }),
  ],
});

registerRoute(
  ({ request }) => request.destination === 'image' || request.destination === 'font' || request.destination === 'script' || request.destination === 'style',
  staticCache
);

const offlineFallback = new Request('/offline.html');
registerRoute(
  new NavigationRoute(offlineFallback)
);

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.data.urls.forEach((url: string) => {
      caches.open('dynamic-cache').then((cache) => cache.add(url));
    });
  }
});
