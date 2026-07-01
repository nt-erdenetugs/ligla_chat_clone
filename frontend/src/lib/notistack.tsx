import CloseIcon from '@mui/icons-material/Close';
import { IconButton } from '@mui/material';
import {
  SnackbarProvider as _SnackbarProvider,
  type SnackbarProviderProps as _SnackbarProviderProps,
  closeSnackbar,
  type SnackbarOrigin,
} from 'notistack';

import { useResponsive } from '~/common/hooks';

const SNACKBAR_CONFIG = {
  SP: {
    AUTO_HIDE_DURATION: 3000,
    MAX_SNACK: 2,
  },
  PC: {
    AUTO_HIDE_DURATION: 5000,
    MAX_SNACK: 5,
  },
} as const;

export const SnackbarProvider = (props: _SnackbarProviderProps) => {
  const { isMobileOrTablet } = useResponsive();

  const anchorOrigin: SnackbarOrigin = isMobileOrTablet
    ? { vertical: 'top', horizontal: 'center' }
    : { vertical: 'bottom', horizontal: 'right' };

  const { AUTO_HIDE_DURATION, MAX_SNACK } = SNACKBAR_CONFIG[isMobileOrTablet ? 'SP' : 'PC'];

  return (
    <_SnackbarProvider
      autoHideDuration={AUTO_HIDE_DURATION}
      maxSnack={MAX_SNACK}
      anchorOrigin={anchorOrigin}
      action={(snackbarId) => (
        <IconButton onClick={() => closeSnackbar(snackbarId)} color='inherit'>
          <CloseIcon fontSize='small' />
        </IconButton>
      )}
      style={{
        whiteSpace: 'pre-wrap',
        flexWrap: 'nowrap',
      }}
      {...props}
    />
  );
};
