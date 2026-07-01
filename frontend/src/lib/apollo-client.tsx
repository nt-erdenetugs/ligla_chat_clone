import { ApolloClient, from, HttpLink, InMemoryCache } from '@apollo/client';
import { loadDevMessages, loadErrorMessages } from '@apollo/client/dev';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

import { API_PREFIXES } from '~/common/constants';
import { getLiffSession } from '~/lib/liff-session';
import { getSession } from '~/utils/auth';

const httpLink = new HttpLink({
  uri: `${import.meta.env.VITE_BACKEND_URL}/${API_PREFIXES.GRAPHQL}`,
});

const DEFAULT_LOCALE = 'en';
const LOCALE_STORAGE_KEY = 'i18nextLng';

export const getLocale = (): string => {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }

  return localStorage.getItem(LOCALE_STORAGE_KEY) || DEFAULT_LOCALE;
};

const errorLink = onError(({ graphQLErrors, networkError, response }) => {
  if (networkError && graphQLErrors && graphQLErrors.length > 0) {
    const aggregatedMessage = graphQLErrors.map(({ message }) => message).join('; ');

    networkError.message = aggregatedMessage;

    if (response) {
      response.errors = graphQLErrors;
    }
  }
});

const authLink = setContext((_, { headers }) => {
  const accessToken = getSession();

  return {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    headers: {
      ...headers,
      authorization: `Bearer ${accessToken}`,
      'Accept-Language': getLocale(),
    },
  };
});

const liffLink = setContext((_, { headers }) => {
  const session = getLiffSession();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  if (!session) return { headers };

  return {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    headers: {
      ...headers,
      'x-liff-id-token': session.idToken,
      'x-organization-code': session.organizationCode,
    },
  };
});

const client = new ApolloClient({
  cache: new InMemoryCache(),
  link: from([errorLink, authLink, liffLink, httpLink]),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'ignore',
    },
    query: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
    },
    mutate: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
    },
  },
});

if (import.meta.env.DEV) {
  loadDevMessages();
  loadErrorMessages();
}

export default client;
