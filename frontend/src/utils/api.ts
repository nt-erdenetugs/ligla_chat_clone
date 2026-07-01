import { API_PREFIXES } from '~/common/constants';
import { getLocale } from '~/lib/apollo-client';

import { getSession } from './auth';

export const fetchApi = async (
  endpoint: string,
  options: RequestInit = {},
  params: Record<string, string | number | boolean> = {},
): Promise<Response> => {
  const BASE_URL = import.meta.env.VITE_BACKEND_URL as string;
  const url = new URL(`${BASE_URL}/${API_PREFIXES.HTTP}/${endpoint}`);
  // casting params as Record<string, string> to avoid type error but URLSearchParams can work with number or boolean
  url.search = new URLSearchParams(params as Record<string, string>).toString();

  const accessToken = getSession();

  const defaultOptions: RequestInit = {
    headers: { Authorization: `Bearer ${accessToken}`, 'Accept-Language': getLocale() },
  };

  const mergedOptions: RequestInit = {
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options?.headers,
    },
  };

  return fetch(url, mergedOptions);
};
