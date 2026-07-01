import { Box, CircularProgress, type CircularProgressProps, Zoom } from '@mui/material';

export type LoadingProps = CircularProgressProps & {
  zoomTimeout?: number;
};

export const Loading = ({ zoomTimeout, sx, ...rest }: LoadingProps) => {
  return (
    <Zoom timeout={zoomTimeout || 500} in>
      <Box sx={{ display: 'flex' }}>
        <CircularProgress sx={{ my: 12, mx: 'auto', ...sx }} {...rest} />
      </Box>
    </Zoom>
  );
};
