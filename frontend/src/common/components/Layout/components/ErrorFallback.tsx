import { useEffect, useRef } from 'react';

import { Button, Container, Stack, Typography } from '@mui/material';
import { type FallbackProps } from 'react-error-boundary';
import { useInRouterContext, useNavigate } from 'react-router';

import { NewLine } from '~/common/components';
import { useResponsive } from '~/common/hooks';
import { LOGO } from '~/configs';
import { useTranslation } from '~/locales/hooks';
import { fetchApi } from '~/utils';

export const ErrorFallbackCodes = [401, 403, 404, 500] as const;

export type ErrorFallbackProps = {
  code?: (typeof ErrorFallbackCodes)[number];
  error?: FallbackProps;
  title?: string;
  description?: string;
  buttonText?: string;
  redirectRoute?: string;
  hideButton?: boolean;
};

type ReturnHomeButtonProps = {
  buttonText: string;
  redirectRoute: string;
  onBeforeRedirect?: () => void;
};

const RouterReturnHomeButton = ({
  buttonText,
  redirectRoute,
  onBeforeRedirect,
}: ReturnHomeButtonProps) => {
  const navigate = useNavigate();

  return (
    <Button
      color='primary'
      size='large'
      onClick={() => {
        onBeforeRedirect?.();
        navigate(redirectRoute, { replace: true });
      }}
    >
      {buttonText}
    </Button>
  );
};

export const ErrorFallback = ({
  code,
  error,
  title: customTitle,
  description: customDescription,
  buttonText: customButtonText,
  redirectRoute,
  hideButton,
}: ErrorFallbackProps) => {
  const inRouterContext = useInRouterContext();
  const { isMobileOrTablet } = useResponsive();
  const { t } = useTranslation();

  const errorStatus = (error?.error?.response?.status ||
    error?.error?.status) as ErrorFallbackProps['code'];

  if (errorStatus && ErrorFallbackCodes.includes(errorStatus)) {
    code = errorStatus;
  } else {
    code = code ?? 500;
  }

  const hasLoggedErrorRef = useRef(false);

  useEffect(() => {
    if (hasLoggedErrorRef.current) return;
    if (errorStatus && ErrorFallbackCodes.includes(errorStatus)) return;

    hasLoggedErrorRef.current = true;
    fetchApi('log/error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Unhandled error',
        error: error?.error as Record<string, any>,
        errorStatus,
        context: 'ErrorFallback',
      }),
    });
  }, [error?.error, errorStatus]);

  const defaultMessages = {
    title: t(`errorFallback.${code}.title`),
    description: t(`errorFallback.${code}.description`),
  };

  const title = customTitle ?? defaultMessages.title;
  const description = customDescription ?? defaultMessages.description;
  const buttonText = customButtonText ?? t('errorFallback.returnToHomePage');
  const targetRoute = redirectRoute ?? '/';
  const onBeforeRedirect = error?.resetErrorBoundary;

  return (
    <Container sx={{ display: 'flex', alignItems: 'center', height: '90vh' }}>
      <Stack sx={{ mx: 'auto', textAlign: 'center' }} alignItems='center' gap={6}>
        <Stack alignItems='center' gap={2}>
          <img src={LOGO} alt='logo' width={isMobileOrTablet ? 150 : 250} />
          <Typography variant='h1' component='h1' fontWeight='bold' color='primary.main'>
            {code}
          </Typography>
          <Typography variant='h5' component='h5' fontWeight='bold' color='black'>
            {title}
          </Typography>
        </Stack>
        <Typography variant='subtitle2'>
          <NewLine text={description} />
        </Typography>
        {!hideButton &&
          (inRouterContext ? (
            <RouterReturnHomeButton
              buttonText={buttonText}
              redirectRoute={targetRoute}
              onBeforeRedirect={onBeforeRedirect}
            />
          ) : (
            <Button
              color='primary'
              size='large'
              onClick={() => {
                onBeforeRedirect?.();
                const basePath = (import.meta.env.VITE_APP_BASE_PATH || '') as string;
                const normalizedBasePath = basePath.endsWith('/')
                  ? basePath.slice(0, -1)
                  : basePath;
                const normalizedTargetRoute = targetRoute.startsWith('/')
                  ? targetRoute
                  : `/${targetRoute}`;
                window.location.assign(
                  `${window.location.origin}${normalizedBasePath}${normalizedTargetRoute}`,
                );
              }}
            >
              {buttonText}
            </Button>
          ))}
      </Stack>
    </Container>
  );
};
