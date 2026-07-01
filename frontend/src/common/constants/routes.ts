export const ROOT_ROUTE = '/';
export const LOGIN_ROUTE = '/login';
export const FORGOT_PASSWORD_ROUTE = '/forgot-password';
export const PASSWORD_RESET_ROUTE = '/reset-password';
export const INITIAL_LOGIN_ROUTE = '/initial-login';
export const HYPERVISOR_ROUTE = '/hypervisor';
export const HYPERVISOR_LOGIN_ROUTE = `${HYPERVISOR_ROUTE}${LOGIN_ROUTE}`;
export const MAINTENANCE_ROUTE = '/maintenance';

export const LOGIN_ROUTES = [HYPERVISOR_LOGIN_ROUTE, LOGIN_ROUTE];
