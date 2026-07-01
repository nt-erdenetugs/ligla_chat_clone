import { ApolloProvider } from '@apollo/client';
import { Outlet } from 'react-router';

import { PWAInstallDrawer } from '~/common/components';
import AuthProvider from '~/context/AuthContext';
import { PushNotificationProvider } from '~/context/NotificationContext';
import client from '~/lib/apollo-client';

export const AuthenticatedLayout = () => (
  <ApolloProvider client={client}>
    <PWAInstallDrawer />
    <PushNotificationProvider>
      <AuthProvider>
        <Outlet />
      </AuthProvider>
    </PushNotificationProvider>
  </ApolloProvider>
);
