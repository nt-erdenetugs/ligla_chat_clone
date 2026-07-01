import {
  createBrowserRouter,
  Navigate,
  Outlet,
  type RouteObject as _RouteObject,
} from 'react-router';

import { MainLayout, ErrorFallback, PrivateRoute, TopLoader } from '~/common/components';
import {
  FORGOT_PASSWORD_ROUTE,
  HYPERVISOR_LOGIN_ROUTE,
  INITIAL_LOGIN_ROUTE,
  LOGIN_ROUTE,
  MAINTENANCE_ROUTE,
  PASSWORD_RESET_ROUTE,
} from '~/common/constants';
import { SystemUserType, UserRoleType } from '~/generated/graphql/types';
import { AuthenticatedLayout, LiffAppLayout, MaintenanceModeLayout } from '~/layouts';
import { LoginPage, ForgotPasswordPage, ResetPasswordPage } from '~/modules/Auth';
import { LiffFileUpload } from '~/modules/ChatUpload/pages/ChatFileUpload';
import { MaintenancePage } from '~/modules/Maintenance';

import { sidebarRoutes, hypervisorSidebarRoutes } from './sidebar';

export type AuthProps = {
  roles: string[];
};

export type RouteObject = _RouteObject & {
  auth?: AuthProps;
};

const appRoutes: RouteObject[] = [
  {
    path: LOGIN_ROUTE,
    element: <LoginPage />,
  },
  {
    path: HYPERVISOR_LOGIN_ROUTE,
    element: <LoginPage isHypervisor />,
  },
  {
    path: FORGOT_PASSWORD_ROUTE,
    element: <ForgotPasswordPage />,
  },
  {
    path: PASSWORD_RESET_ROUTE,
    element: <ResetPasswordPage />,
  },
  {
    path: INITIAL_LOGIN_ROUTE,
    element: <ResetPasswordPage initial />,
  },
  {
    path: '/hypervisor',
    element: <MainLayout />,
    children: hypervisorSidebarRoutes,
    auth: {
      roles: [SystemUserType.Hypervisor],
    },
  },
  {
    path: '/',
    element: <MainLayout />,
    children: sidebarRoutes,
    auth: {
      roles: [
        UserRoleType.Admin,
        UserRoleType.AdminOperator,
        UserRoleType.Manager,
        UserRoleType.ManagerOperator,
        UserRoleType.Operator,
      ],
    },
  },
  {
    path: MAINTENANCE_ROUTE,
    element: <Navigate to='/' replace />,
  },
  {
    path: '*',
    element: <ErrorFallback code={404} />,
  },
];

const authenticateRoutes = (routes: RouteObject[]): RouteObject[] =>
  routes.map(
    (route) =>
      ({
        ...route,
        element: route.auth ? <PrivateRoute page={route.element} {...route.auth} /> : route.element,
        children: route.children ? authenticateRoutes(route.children) : undefined,
      }) as RouteObject,
  );

const normalRoutesTree: RouteObject[] = [
  {
    element: <LiffAppLayout />,
    children: [{ path: '/upload', element: <LiffFileUpload /> }],
  },
  {
    element: <AuthenticatedLayout />,
    children: authenticateRoutes(appRoutes),
  },
];

const maintenanceRoutes: RouteObject[] = [
  {
    element: <MaintenanceModeLayout />,
    children: [
      {
        path: MAINTENANCE_ROUTE,
        element: <MaintenancePage />,
      },
      {
        path: '*',
        element: <Navigate to={MAINTENANCE_ROUTE} replace />,
      },
    ],
  },
];

const RootLayout = () => (
  <>
    <TopLoader />
    <Outlet />
  </>
);

const basename = import.meta.env.VITE_APP_BASE_PATH as Optional<string>;
const maintenanceModeActive = import.meta.env.VITE_MAINTENANCE_MODE_ACTIVE === 'true';

export const router = createBrowserRouter(
  [
    {
      element: <RootLayout />,
      children: maintenanceModeActive ? maintenanceRoutes : normalRoutesTree,
    },
  ],
  { basename },
);
