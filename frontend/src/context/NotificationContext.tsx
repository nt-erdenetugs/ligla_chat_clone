import React, {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  type ReactNode,
} from 'react';

import { enqueueSnackbar } from 'notistack';
import { useLocation } from 'react-router';
import { useRegisterSW } from 'virtual:pwa-register/react';

import { HYPERVISOR_ROUTE } from '~/common/constants';
import { useTranslation } from '~/locales/hooks';
import { fetchApi } from '~/utils';
import { getSession } from '~/utils/auth';
import { subscribeToPush, unsubscribeFromPush } from '~/utils/notification';

interface PushCtx {
  isBrowserSubscribed: boolean;
  isSyncedWithServer: boolean;
  registration: ServiceWorkerRegistration | null;
  subscription: PushSubscription | null;
  subscribeUser: (token?: string) => Promise<void>;
  unsubscribeUser: () => Promise<void>;
}

const PushCtx = createContext<PushCtx | undefined>(undefined);

export const PushNotificationProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const route = useLocation();
  const [isSyncedWithServer, setIsSyncedWithServer] = useState(false);

  const { t_errors } = useTranslation();

  useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, reg) {
      setRegistration(reg || null);
      if (reg) {
        reg.pushManager.getSubscription().then(setSubscription);
      }
    },
    onRegisterError(error) {
      console.error(error);
    },
  });

  const notificationCheck = useCallback(async (): Promise<void> => {
    switch (Notification.permission) {
      case 'granted':
        return;
      case 'default':
        // eslint-disable-next-line no-case-declarations
        const res = await Notification.requestPermission();
        if (res === 'denied') {
          throw new Error('Notification request denied.');
        }
        return;
      case 'denied':
        enqueueSnackbar(t_errors('notificationsBlocked'), {
          variant: 'error',
          preventDuplicate: true,
        });
        setSubscription(null);
        throw new Error('Notification request denied.');
    }
  }, [t_errors]);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      enqueueSnackbar('Push notifications are not supported in this browser.', {
        variant: 'error',
        preventDuplicate: true,
      });
      return;
    }
  }, []);

  useEffect(() => {
    (async () => {
      const isHypervisorRoute = route.pathname.includes(HYPERVISOR_ROUTE);

      if (isHypervisorRoute) {
        return;
      }

      if (!registration) {
        throw new Error('Service Worker registration is not ready.');
      }

      if (!subscription) {
        throw new Error('Subscription not found.');
      }

      const token = getSession();

      if (!token) {
        await subscription.unsubscribe();
        setSubscription(null);
        throw new Error('Session token not found');
      }

      const res = await fetchApi('notifications/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      if (res.ok) {
        const { synced } = (await res.json()) as { synced: boolean };
        if (synced) {
          setIsSyncedWithServer(true);
        } else {
          await subscription?.unsubscribe();
          setSubscription(null);
          setIsSyncedWithServer(false);
        }
      } else {
        setIsSyncedWithServer(false);
        throw new Error(`Server error: ${res.status}`);
      }
    })().catch(() => undefined);
  }, [registration, route.pathname, subscription]);

  const subscribeUser = useCallback(
    async (token?: string) => {
      await notificationCheck();
      const sub = await subscribeToPush(registration, token);

      setSubscription(sub);

      setIsSyncedWithServer(true);
    },
    [notificationCheck, registration],
  );

  const unsubscribeUser = useCallback(async () => {
    try {
      await unsubscribeFromPush(subscription);

      setSubscription(null);
      setIsSyncedWithServer(false);
    } catch (err) {
      if (err instanceof Error) {
        switch (err.cause) {
          case 'not-found':
            setSubscription(null);
            return;
          default:
            throw err;
        }
      }
      throw err;
    }
  }, [subscription]);

  return (
    <PushCtx.Provider
      value={{
        isBrowserSubscribed: !!subscription,
        isSyncedWithServer,
        subscription,
        registration,
        subscribeUser,
        unsubscribeUser,
      }}
    >
      {children}
    </PushCtx.Provider>
  );
};

export function usePushNotifications(): PushCtx {
  const ctx = useContext(PushCtx);
  if (!ctx) throw new Error('Must be inside PushNotificationProvider');
  return ctx;
}
