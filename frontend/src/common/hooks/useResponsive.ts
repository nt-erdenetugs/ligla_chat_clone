import { type Breakpoint, useMediaQuery, useTheme } from '@mui/material';

type Query = 'up' | 'down' | 'between' | 'only';
type Value = Breakpoint | number;

type ResponsiveDeviceResult = {
  isMobile: boolean;
  isTablet: boolean;
  isMobileOrTablet: boolean;
  isDesktop: boolean;
};

export function useResponsive(): ResponsiveDeviceResult;
export function useResponsive(query: Query, start?: Value, end?: Value): boolean;

export function useResponsive(
  query?: Query,
  start?: Value,
  end?: Value,
): boolean | ResponsiveDeviceResult {
  const theme = useTheme();

  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'lg'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobileOrTablet = isMobile || isTablet;

  const mediaUp = useMediaQuery(theme.breakpoints.up(start as Value));
  const mediaDown = useMediaQuery(theme.breakpoints.down(start as Value));
  const mediaBetween = useMediaQuery(theme.breakpoints.between(start as Value, end as Value));
  const mediaOnly = useMediaQuery(theme.breakpoints.only(start as Breakpoint));

  if (!query && !start && !end) return { isMobile, isTablet, isMobileOrTablet, isDesktop };

  if (query === 'up') return mediaUp;
  if (query === 'down') return mediaDown;
  if (query === 'between') return mediaBetween;

  return mediaOnly;
}
