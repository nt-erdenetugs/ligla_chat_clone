import cookies from 'js-cookie';

import {
  ACCESS_TOKEN_COOKIE,
  HYPERVISOR_ACCESS_TOKEN_COOKIE,
  HYPERVISOR_ROUTE,
} from '~/common/constants';

const isHypervisorPath = (): boolean =>
  typeof window !== 'undefined' && window.location.pathname.includes(HYPERVISOR_ROUTE);

export const setSession = (accessToken: string | null): void => {
  if (!accessToken) return;
  const key = isHypervisorPath() ? HYPERVISOR_ACCESS_TOKEN_COOKIE : ACCESS_TOKEN_COOKIE;

  cookies.set(key, accessToken, {
    expires: 90,
    path: '/',
    sameSite: 'Lax',
    secure: window.location.protocol === 'https:',
  });
};

export const removeSession = (): void => {
  const key = isHypervisorPath() ? HYPERVISOR_ACCESS_TOKEN_COOKIE : ACCESS_TOKEN_COOKIE;
  cookies.remove(key);
};

export const getSession = (): string | null => {
  const key = isHypervisorPath() ? HYPERVISOR_ACCESS_TOKEN_COOKIE : ACCESS_TOKEN_COOKIE;
  return cookies.get(key) || null;
};
