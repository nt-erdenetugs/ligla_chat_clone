import React, { createContext, useContext, type ReactNode } from 'react';

import { type ApolloError } from '@apollo/client';

export interface InfiniteQueryResponse {
  fetchMore: () => Promise<void>;
  loading: boolean;
  fetchedAll: boolean;
  error?: ApolloError;
  cursorId?: Nullable<string>;
  cursorCreatedAt?: Nullable<Date>;
}

export interface InfiniteQueryContextType {
  infiniteQueryResponse?: InfiniteQueryResponse;
}

const defaultValue: InfiniteQueryResponse = {
  fetchMore: async () => {},
  loading: false,
  fetchedAll: true,
};

const InfiniteQueryContext = createContext<InfiniteQueryContextType | undefined>(undefined);

interface InfiniteQueryProviderProps {
  children: ReactNode;
  infiniteQueryResponse?: InfiniteQueryResponse;
}

export const InfiniteQueryProvider: React.FC<InfiniteQueryProviderProps> = ({
  children,
  infiniteQueryResponse = defaultValue,
}) => (
  <InfiniteQueryContext.Provider
    value={{
      infiniteQueryResponse,
    }}
  >
    {children}
  </InfiniteQueryContext.Provider>
);

export const useInfiniteQueryContext = () => {
  const context = useContext(InfiniteQueryContext);
  if (!context) {
    throw new Error('useInfiniteQueryContext must be used within an InfiniteQueryProvider');
  }
  return context;
};
