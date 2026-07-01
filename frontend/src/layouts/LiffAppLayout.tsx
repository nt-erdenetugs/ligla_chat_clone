import { ApolloProvider } from '@apollo/client';
import { Outlet } from 'react-router';

import client from '~/lib/apollo-client';

export const LiffAppLayout = () => (
  <ApolloProvider client={client}>
    <Outlet />
  </ApolloProvider>
);
