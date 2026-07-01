import {
  useContext,
  createContext,
  useState,
  type ReactNode,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';

import { type ApolloError, useApolloClient, useMutation, useQuery } from '@apollo/client';
import { jwtDecode } from 'jwt-decode';
import { useSnackbar } from 'notistack';
import { useLocation, useNavigate } from 'react-router';

import {
  adminRoles,
  FORGOT_PASSWORD_ROUTE,
  HYPERVISOR_ROUTE,
  LOGIN_ROUTES,
  managerRoles,
  NOTIFICATION_DISABLED_KEY,
  ROOT_ROUTE,
  DISPLAY_NAME_MAX_CHAR_LIMIT,
  allOperatorRoles,
} from '~/common/constants';
import { NotificationClickEventType, type SWMessageEvent, type ID } from '~/common/types';
import {
  LoginDocument,
  type LoginMutation,
  LoginToHypervisorDocument,
  type LoginToHypervisorMutation,
  MeDocument,
  type MeQuery,
  SystemUserType,
} from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { type Inputs as LoginInput } from '~/modules/Auth';
import { type IUser } from '~/modules/Users';
import { type AuthProps } from '~/routes';
import { getSidebarRoutesByRole, hypervisorSidebarRoutes } from '~/routes/sidebar';
import { handleApolloError, isTextTooLong, removeBaseFromPath } from '~/utils';
import { setSession, removeSession, getSession } from '~/utils/auth';

import { usePushNotifications } from './NotificationContext';

type AuthContextType = {
  user: Nullable<IUser>;
  isUserLoading: boolean;
  isHypervisorUser: boolean;
  isAdminUser: boolean;
  isManagerUser: boolean;
  isOperatorUser: boolean;
  isAuthenticating: boolean;
  isProfileChanged: boolean;
  isScopeChanging: boolean;
  isUserNameTooLong: boolean;
  error?: string;
  clearError: () => void;
  setUserFields: (fields: Partial<IUser>) => void;
  updatePictureUrl: (pictureUrl: string) => void;
  isAuthenticated: (authProps: AuthProps) => boolean;
  isMe: (id?: ID) => boolean;
  login: (data: LoginInput, isHypervisor?: boolean) => Promise<void>;
  logOut: () => void;
};

type AuthProviderProps = {
  children: ReactNode;
};

const MAX_TIMEOUT_MS = 2147483647;

const setSafeTimeout = (callback: () => void, delay: number): NodeJS.Timeout => {
  if (delay > MAX_TIMEOUT_MS) {
    return setTimeout(() => {
      setSafeTimeout(callback, delay - MAX_TIMEOUT_MS);
    }, MAX_TIMEOUT_MS);
  }
  return setTimeout(callback, delay);
};

const defaultContext = {
  user: null,
  isUserLoading: false,
  isHypervisorUser: false,
  isAdminUser: false,
  isManagerUser: false,
  isOperatorUser: false,
  isAuthenticating: false,
  isProfileChanged: false,
  isScopeChanging: false,
  isUserNameTooLong: false,
  clearError: () => undefined,
  isAuthenticated: () => false,
  isMe: () => false,
  login: async () => {},
  logOut: () => {},
  setUserFields: () => {},
  updatePictureUrl: () => {},
};

const AuthContext = createContext<AuthContextType>(defaultContext);

const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<Nullable<IUser>>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScopeChanging, setIsScopeChanging] = useState(false);
  const [error, setError] = useState<Optional<string>>(undefined);
  const location = useLocation();
  const navigate = useNavigate();
  const { t_toasts } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const client = useApolloClient();

  const { subscribeUser, unsubscribeUser } = usePushNotifications();

  const handleMe = useCallback(
    (data: MeQuery) => {
      if (!data) return;

      const { me } = data;

      setUser(me);

      const blockedRoutes = [...LOGIN_ROUTES, FORGOT_PASSWORD_ROUTE, ROOT_ROUTE, HYPERVISOR_ROUTE];

      const { pathname, search } = location;

      if (!blockedRoutes.includes(removeBaseFromPath(pathname))) {
        return;
      }

      const redirectRoute = getRedirectRoute(me);
      if (pathname === redirectRoute) {
        return;
      }
      navigate({ pathname: redirectRoute, search });
    },
    [location, navigate],
  );

  const { loading, data: meData, refetch } = useQuery<MeQuery>(MeDocument);

  useEffect(() => {
    if (meData) {
      handleMe(meData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meData]);

  const handleError = (error: ApolloError) => {
    const errorMessage = handleApolloError(error);
    setError(errorMessage);
  };

  const [_login, { loading: isUserAuthenticating }] = useMutation<LoginMutation>(LoginDocument, {
    onCompleted: (loginData) => handleLoginCompletion(loginData?.login.accessToken),
    onError: handleError,
  });

  const [loginAsHypervisor, { loading: isHypervisorAuthenticating }] =
    useMutation<LoginToHypervisorMutation>(LoginToHypervisorDocument, {
      onCompleted: (loginData) => handleLoginCompletion(loginData?.loginToHypervisor.accessToken),
      onError: handleError,
    });

  const handleLoginCompletion = async (accessToken?: string) => {
    if (!accessToken) return;
    setSession(accessToken);
    hasShownSessionExpiredRef.current = false;
    const { data } = await refetch();
    handleMe(data);
    if (
      localStorage.getItem(NOTIFICATION_DISABLED_KEY) ||
      location.pathname.includes(HYPERVISOR_ROUTE)
    )
      return;

    await subscribeUser(accessToken);
  };

  const getRedirectRoute = (me: MeQuery['me']): string => {
    if (me.systemUserType === SystemUserType.Hypervisor) {
      return `${HYPERVISOR_ROUTE}/${hypervisorSidebarRoutes[0].path}`;
    }

    const userRoutes = getSidebarRoutesByRole(me.roleType);
    return userRoutes.length > 0 && userRoutes[0].path ? userRoutes[0].path : ROOT_ROUTE;
  };

  const isAuthenticated = useCallback(
    ({ roles }: AuthProps) => {
      if (!user) {
        return false;
      }

      const isHypervisor = user.systemUserType === SystemUserType.Hypervisor;

      if (isHypervisor) {
        return roles.includes(SystemUserType.Hypervisor);
      }

      return roles.length === 0 || roles.includes(user.roleType);
    },
    [user],
  );

  const isMe = useCallback(
    (id?: ID) => {
      return !!id && id === user?.id;
    },
    [user],
  );

  useEffect(() => {
    setIsLoading(loading);
  }, [loading]);

  const isHypervisorUser = user?.systemUserType === SystemUserType.Hypervisor;
  const isAdminUser = user ? !!adminRoles.includes(user.roleType) : false;
  const isManagerUser = user ? !!managerRoles.includes(user.roleType) : false;
  const isOperatorUser = user ? !!allOperatorRoles.includes(user.roleType) : false;

  const login = async (data: LoginInput, isHypervisor = false) => {
    const { email, password } = data;

    const variables = {
      loginInput: {
        email,
        password,
      },
    };

    if (isHypervisor) {
      await loginAsHypervisor({
        variables,
      });
    } else {
      await _login({
        variables,
      });
    }
  };

  const resetUserAndCookie = () => {
    setUser(null);
    removeSession();
  };

  const setUserFields = (fields: Partial<IUser>) => {
    setUser((prevUser) =>
      prevUser
        ? {
            ...prevUser,
            ...fields,
          }
        : prevUser,
    );
  };

  const updatePictureUrl = (pictureUrl: string) => {
    setUserFields({ pictureUrl });
    client.refetchQueries({
      include: ['me', 'users'],
    });
  };

  useEffect(() => {
    if (!meData) return;
    setUser(meData.me);
  }, [meData]);

  const isUserNameTooLong = useMemo(() => {
    if (!user) return false;
    return isTextTooLong(user.displayName, DISPLAY_NAME_MAX_CHAR_LIMIT);
  }, [user]);

  const isProfileChanged = useMemo(() => {
    if (meData && meData.me && meData.me.pictureUrl)
      return meData?.me?.pictureUrl !== user?.pictureUrl;
    return false;
  }, [meData, user]);

  const logOut = useCallback(() => {
    if (user?.systemUserType === SystemUserType.Hypervisor) {
      resetUserAndCookie();
      return;
    }

    unsubscribeUser().finally(resetUserAndCookie);
  }, [unsubscribeUser, user]);

  const clearError = () => setError('');

  const timeOutRef = useRef<null | NodeJS.Timeout>(null);
  const hasShownSessionExpiredRef = useRef(false);

  const checkSession = useCallback(() => {
    if (timeOutRef.current) {
      clearTimeout(timeOutRef.current);
      timeOutRef.current = null;
    }

    const token = getSession();
    if (!token) return;

    try {
      const decoded = jwtDecode<{ exp: number }>(token);
      const expirationTime = decoded.exp * 1000; // convert to milliseconds
      const timeout = expirationTime - Date.now();

      if (timeout > 0) {
        timeOutRef.current = setSafeTimeout(() => {
          if (!hasShownSessionExpiredRef.current) {
            hasShownSessionExpiredRef.current = true;
            logOut();
            navigate('/login');
            enqueueSnackbar(t_toasts('auth.info.sessionExpired'), { variant: 'warning' });
          }
        }, timeout);
      } else {
        logOut();
        navigate('/login');
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      logOut();
      navigate('/login');
    }
  }, [logOut, navigate, t_toasts, enqueueSnackbar]);

  useEffect(() => {
    checkSession();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timeOutRef.current) {
        clearTimeout(timeOutRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkSession]);

  const scopeRef = useRef<boolean>(location.pathname.includes(HYPERVISOR_ROUTE));

  useEffect(() => {
    const now = location.pathname.includes(HYPERVISOR_ROUTE);
    if (now !== scopeRef.current) {
      scopeRef.current = now;

      const token = getSession();
      if (!token) {
        setUser(null);
        setIsScopeChanging(false);
        return;
      }

      setIsScopeChanging(true);
      setUser(null);
      refetch()
        .then((result) => {
          const isHypervisorScope = location.pathname.includes(HYPERVISOR_ROUTE);
          const isHypervisorUser = result.data?.me?.systemUserType === SystemUserType.Hypervisor;

          if (isHypervisorScope !== isHypervisorUser) {
            setUser(null);
          }
          setIsScopeChanging(false);
        })
        .catch((err) => {
          setUser(null);
          setIsScopeChanging(false);
          console.error('Refetch failed:', err);
        });
    }
  }, [location.pathname, refetch]);

  // iOS Safari keep-alive: Prevent 7-day cookie deletion
  useEffect(() => {
    const KEEP_ALIVE_INTERVAL = 6 * 24 * 60 * 60 * 1000;

    const keepAliveTimer = setInterval(() => {
      const token = getSession();
      if (token) {
        setSession(token);
      }
    }, KEEP_ALIVE_INTERVAL);

    return () => clearInterval(keepAliveTimer);
  }, []);

  useEffect(() => {
    const navigateToTargetChat = (event: MessageEvent<SWMessageEvent>) => {
      if (event.data.type !== NotificationClickEventType.CHAT_NOTIFICATION_CLICKED) return;
      const targetChatId = event.data.data.chatId as string;
      if (location.pathname === '/') return;
      navigate(`/?id=${targetChatId}`);
    };
    if (!navigator.serviceWorker) return;
    navigator.serviceWorker.addEventListener('message', navigateToTargetChat);

    return () => navigator.serviceWorker.removeEventListener('message', navigateToTargetChat);
  }, [location.pathname, navigate]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isUserLoading: isLoading,
        isHypervisorUser,
        isAdminUser,
        isManagerUser,
        isOperatorUser,
        isProfileChanged,
        isUserNameTooLong,
        isScopeChanging,
        isAuthenticating: isUserAuthenticating || isHypervisorAuthenticating,
        error,
        clearError,
        isAuthenticated,
        isMe,
        login,
        logOut,
        setUserFields,
        updatePictureUrl,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => useContext(AuthContext);

export default AuthProvider;
