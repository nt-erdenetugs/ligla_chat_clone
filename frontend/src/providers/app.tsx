import { useMemo } from 'react';

import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { ErrorBoundary } from 'react-error-boundary';
import { RouterProvider } from 'react-router';

import { ErrorFallback, ConfirmationProvider } from '~/common/components';
import { createTheme, MUI_LOCALE_MAP } from '~/configs/theme';
import { SnackbarProvider } from '~/lib/notistack';
import { useTranslation } from '~/locales/hooks';
import { router } from '~/routes';

export const AppProvider = () => {
  const { i18n } = useTranslation();

  const themeWithLocale = useMemo(
    () => createTheme(MUI_LOCALE_MAP[i18n.language]),
    [i18n.language],
  );

  return (
    <ThemeProvider theme={themeWithLocale}>
      <CssBaseline />
      <ErrorBoundary FallbackComponent={(error) => ErrorFallback({ error })}>
        <SnackbarProvider>
          <ConfirmationProvider>
            <RouterProvider router={router} />
          </ConfirmationProvider>
        </SnackbarProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
};
