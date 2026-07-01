import { jaJP, enUS, type Localization } from '@mui/material/locale';
import { createTheme as _createTheme } from '@mui/material/styles';

import liglaLogo from '~/assets/images/liglaLogo.svg';
import liglaLogoSymbol from '~/assets/images/liglaLogoSymbol.svg';
import { LOCALE_EN, LOCALE_JA } from '~/locales/config';

export const MAIN_COLOR = '#006c23';
export const LOGO = liglaLogo;
export const LOGO_SYMBOL = liglaLogoSymbol;

export const MUI_LOCALE_MAP: Record<string, Localization> = {
  [LOCALE_JA]: jaJP,
  [LOCALE_EN]: enUS,
};

export const createTheme = (locale = jaJP) =>
  _createTheme(
    {
      typography: {
        h1: { fontSize: '3rem' },
        h2: { fontSize: '2.5rem' },
        h3: { fontSize: '2.25rem' },
        h4: { fontSize: '2rem' },
        h5: { fontSize: '1.5rem' },
        h6: { fontSize: '1.25rem' },
        body1: { fontSize: '1rem' },
        body2: { fontSize: '0.875rem' },
        fontFamily: ['Roboto', 'sans-serif'].join(','),
        muted: {
          fontSize: '1rem',
          color: '#aaaaaa',
        },
      },
      palette: {
        mode: 'light',
        background: {
          default: 'rgb(242, 245, 247)',
        },
        primary: {
          main: MAIN_COLOR,
        },
        secondary: {
          main: '#6c757d',
          light: '#dcdfe4',
        },
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            '@media (pointer: coarse)': {
              html: {
                overscrollBehavior: 'none',
              },
            },
            body: {
              color: 'rgb(54, 65, 82)',
            },
          },
        },
        MuiTooltip: {
          styleOverrides: {
            tooltip: {
              fontSize: '0.75rem',
            },
          },
        },
        MuiListItemIcon: {
          styleOverrides: {
            root: {
              minWidth: 40,
            },
          },
        },
        MuiButton: {
          styleOverrides: {
            root: {
              '&.MuiButton-contained': {
                fontWeight: 'bold',
              },
            },
          },
        },
        MuiTypography: {
          defaultProps: {
            variantMapping: {
              h1: '48px',
              h2: '40px',
              h3: '36px',
              h4: '32px',
              h5: '24px',
              h6: '',
              body1: 'span',
              body2: 'span',
            },
          },
        },
      },
    },
    locale,
  );

// @note https://mui.com/material-ui/customization/typography/
declare module '@mui/material/styles' {
  interface TypographyVariants {
    muted: React.CSSProperties;
  }

  // allow configuration using `createTheme`
  interface TypographyVariantsOptions {
    muted?: React.CSSProperties;
  }
}

// Update the Typography's variant prop options
declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    muted: true;
  }
}
