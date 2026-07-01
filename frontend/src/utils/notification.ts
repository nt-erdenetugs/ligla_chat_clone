import { getSession } from './auth';

import { fetchApi } from '.';

const VITE_VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string) ?? '';

export const unsubscribeFromPush = async (subscription: PushSubscription | null) => {
  if (!subscription) throw new Error('No subscription found.', { cause: 'not-found' });

  await subscription.unsubscribe();

  const token = getSession();
  const res = await fetchApi(`notifications/unsubscribe`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  });

  if (!res.ok) {
    throw new Error(`Server error: ${res.status}`, { cause: 'server-error' });
  }
};

export const subscribeToPush = async (
  registration: ServiceWorkerRegistration | null,
  token?: string,
): Promise<PushSubscription | null> => {
  if (!registration) throw new Error('Registration not found.', { cause: 'not-found' });

  let sub = await registration.pushManager.getSubscription();

  if (!sub) {
    const applicationServerKey = urlBase64ToUint8Array(VITE_VAPID_PUBLIC_KEY);
    sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  const userToken = !token ? getSession() : token;

  if (!userToken) throw new Error('No auth token available.');

  const resp = await fetchApi('notifications/subscribe', {
    method: 'POST',
    body: JSON.stringify(sub),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userToken}`,
    },
  });

  if (!resp.ok) {
    throw new Error(`Server error: ${resp.status}`, { cause: 'sub-api-failed' });
  }

  return sub;
};

export function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
