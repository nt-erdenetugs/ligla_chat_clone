import { useEffect, type ReactNode } from 'react';

import { useErrorBoundary } from 'react-error-boundary';
import { useNavigate } from 'react-router';

import { SplashLoader } from '~/common/components';
import { HYPERVISOR_LOGIN_ROUTE, LOGIN_ROUTE } from '~/common/constants';
import { useAuthContext } from '~/context/AuthContext';
import { SystemUserType } from '~/generated/graphql/types';
import { type AuthProps } from '~/routes';

type PrivateRouteProps = AuthProps & {
  page: ReactNode;
};

export const PrivateRoute = ({ page, roles }: PrivateRouteProps) => {
  const { user, isUserLoading, isScopeChanging, isAuthenticated } = useAuthContext();
  const navigate = useNavigate();
  const { showBoundary } = useErrorBoundary();

  useEffect(() => {
    if (isUserLoading || isScopeChanging) return;

    if (!user) {
      const to = roles.includes(SystemUserType.Hypervisor) ? HYPERVISOR_LOGIN_ROUTE : LOGIN_ROUTE;
      navigate(to, { replace: true });
      return;
    }

    if (!isAuthenticated({ roles })) {
      // Regular user trying to access hypervisor
      const isHypervisorRoute = roles.includes(SystemUserType.Hypervisor);
      const isHypervisorUser = user.systemUserType === SystemUserType.Hypervisor;

      if (isHypervisorRoute && !isHypervisorUser) {
        // Regular user trying to access hypervisor route → redirect to hypervisor login
        navigate(HYPERVISOR_LOGIN_ROUTE, { replace: true });
        return;
      }

      if (!isHypervisorRoute && isHypervisorUser) {
        // Hypervisor user trying to access regular route → redirect to regular login
        navigate(LOGIN_ROUTE, { replace: true });
        return;
      }

      // Same scope but insufficient permissions → show 403
      showBoundary({ status: 403 });
    }
  }, [user, isUserLoading, isScopeChanging, navigate, isAuthenticated, roles, showBoundary]);

  return user ? <>{page}</> : <SplashLoader />;
};
