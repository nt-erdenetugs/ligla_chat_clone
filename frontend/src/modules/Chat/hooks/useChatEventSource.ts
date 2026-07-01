import { useEffect, useRef } from 'react';

import {
  fetchEventSource,
  EventStreamContentType,
  type EventSourceMessage,
} from '@microsoft/fetch-event-source';

import { API_PREFIXES } from '~/common/constants';
import { getSession } from '~/utils/auth';

export type EventDataHandler<T> = (data: T) => void;
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export const useChatEventSource = <T>(
  eventHandler: EventDataHandler<T>,
  options = {
    maxRetries: 5,
    initialRetryDelay: 1000,
    maxRetryDelay: 30000,
    jitterFactor: 0.1,
  },
) => {
  const accessTokenRef = useRef(getSession());
  const eventHandlerRef = useRef(eventHandler);
  const retryCount = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const statusRef = useRef<ConnectionStatus>('disconnected');

  useEffect(() => {
    eventHandlerRef.current = eventHandler;
  }, [eventHandler]);

  const calculateRetryDelay = (retryAttempt: number) => {
    const { initialRetryDelay, maxRetryDelay, jitterFactor } = options;
    // Exponential backoff with jitter
    const exponentialDelay = initialRetryDelay * Math.pow(2, retryAttempt);
    const maxDelay = Math.min(exponentialDelay, maxRetryDelay);
    const jitter = maxDelay * jitterFactor * (Math.random() * 2 - 1);
    return Math.max(0, maxDelay + jitter);
  };

  const reconnect = () => {
    if (retryCount.current < options.maxRetries) {
      const delay = calculateRetryDelay(retryCount.current);
      setTimeout(() => {
        retryCount.current += 1;
        handleSSE();
      }, delay);
    } else {
      statusRef.current = 'error';
      console.error('Max retry attempts reached');
    }
  };

  const validateParsedData = (data: unknown): data is T => {
    return (
      !!data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length > 0
    );
  };

  const handleSSE = async () => {
    if (!accessTokenRef.current || statusRef.current === 'connecting') {
      return;
    }

    const url = `${import.meta.env.VITE_BACKEND_URL}/${API_PREFIXES.HTTP}/events`;
    controllerRef.current = new AbortController();
    statusRef.current = 'connecting';

    try {
      await fetchEventSource(url, {
        headers: {
          Authorization: `Bearer ${accessTokenRef.current}`,
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
        async onopen(response) {
          if (response.ok && response.headers.get('content-type') === EventStreamContentType) {
            statusRef.current = 'connected';
            retryCount.current = 0;
            return Promise.resolve();
          }

          let error = `HTTP error! status: ${response.status}`;
          if (response.status === 401 || response.status === 403) {
            error = 'Authentication failed';
            controllerRef.current?.abort();
          } else if (response.status === 404) {
            error = 'SSE endpoint not found';
            controllerRef.current?.abort();
          }
          throw new Error(error);
        },
        onmessage(msg: EventSourceMessage) {
          if (msg.event === 'FatalError') {
            console.error('Fatal error received from SSE:', msg.data);
            controllerRef.current?.abort();
            return;
          }

          if (!msg.data) return;

          try {
            const parsedData = JSON.parse(msg.data) as T;
            if (!validateParsedData(parsedData)) {
              throw new Error('Invalid data structure received');
            }
            eventHandlerRef.current(parsedData);
          } catch (error) {
            console.error('Error parsing SSE data:', error);
          }
        },
        // NOTE: Some chat events might have been missed during reconnection. Consider using GraphQL subscriptions instead.
        onclose() {
          statusRef.current = 'disconnected';
          console.warn('SSE connection closed unexpectedly');
          reconnect();
        },
        onerror(err) {
          console.error('SSE connection error:', err);
          statusRef.current = 'error';
          throw err; // Let onclose handle the retry
        },
        signal: controllerRef.current.signal,
        openWhenHidden: true,
        fetch: window.fetch, // Use native fetch
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('SSE connection aborted');
        return;
      }

      statusRef.current = 'error';
      console.error('SSE connection error:', error);
      reconnect();
    }
  };

  useEffect(() => {
    if (!accessTokenRef.current) {
      console.warn('Access token not available');
      return;
    }

    handleSSE();

    return () => {
      controllerRef.current?.abort();
      statusRef.current = 'disconnected';
      retryCount.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    status: statusRef.current,
    retry: () => {
      retryCount.current = 0;
      handleSSE();
    },
  };
};
