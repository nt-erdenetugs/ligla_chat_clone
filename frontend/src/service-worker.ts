/// <reference lib="webworker" />
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';

import { NotificationClickEventType } from './common/types';

declare const self: ServiceWorkerGlobalScope;

interface NotificationData {
  title: string;
  body: string;
  icon?: string;
  data?: {
    url?: string;
  };
}

const BASE_URL = (import.meta.env.VITE_APP_BASE_PATH as string) || '/';

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({ cacheName: 'google-fonts-stylesheets' }),
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
        maxEntries: 30,
      }),
    ],
  }),
);

self.addEventListener('push', (event: PushEvent) => {
  let data: NotificationData | undefined = undefined;

  if (event.data) {
    try {
      data = event.data.json() as NotificationData;
    } catch {
      console.warn('Push data is not JSON, treating as text.');
      data = { title: 'Push Notification', body: event.data.text() };
    }
  } else {
    data = { title: 'Push Notification', body: 'No payload received.' };
  }

  const title = data.title || 'New Notification';
  const options: NotificationOptions = {
    body: data.body || 'You have a new message!',
    icon: data.icon || `${BASE_URL}/icons/icon-192x192.png`,
    data: {
      url: `${BASE_URL}${data.data?.url}` || BASE_URL,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const baseOrigin = self.location.origin + BASE_URL;
  const rawUrl = (event.notification.data as NotificationData['data'])?.url ?? '';
  const url = new URL(rawUrl, baseOrigin);

  const chatId = new URL(url).searchParams.get('id');

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        await client.focus();
        if (chatId) {
          client.postMessage({
            type: NotificationClickEventType.CHAT_NOTIFICATION_CLICKED,
            data: { chatId },
          });
          return;
        }
      }

      return self.clients.openWindow(url);
    })(),
  );
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
