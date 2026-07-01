import { type ReactNode } from 'react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
  type DialogProps,
  DialogActions,
  Grid,
  CircularProgress,
} from '@mui/material';

export type IconCardOption<Value> = {
  value: Value;
  title: string;
  description: string;
  icon: ReactNode;
};

type IconCardSelectDialogProps<Value> = Omit<DialogProps, 'onClose' | 'onSelect'> & {
  options: IconCardOption<Value>[];
  onClose?: () => void;
  onSelect?: (value: Value) => void;
  title?: string;
  cancelText?: string;
  gridSize?: number;
  disabled?: boolean;
  isLoading?: boolean;
};

export const IconCardSelectDialog = <T,>({
  options,
  onSelect,
  cancelText,
  title,
  onClose,
  gridSize,
  disabled,
  isLoading,
  ...props
}: IconCardSelectDialogProps<T>) => {
  return (
    <Dialog onClose={onClose} {...props}>
      {title && <DialogTitle>{title}</DialogTitle>}
      <DialogContent>
        <Grid container spacing={2}>
          {options.map(({ value, title, description, icon }, index) => (
            <Grid key={index} size={{ xs: gridSize ?? 3 }}>
              <Stack
                key={index}
                component={Button}
                p={2}
                gap={3}
                borderRadius={4}
                justifyContent='flex-start'
                position='relative'
                border='1px solid rgba(0,0,0,0.15)'
                boxShadow='2px 2px 5px rgba(0,0,0,0.15)'
                onClick={() => onSelect?.(value)}
                height='100%'
                width='100%'
                disabled={isLoading || disabled}
              >
                <Stack sx={{ '&>svg, &>i': { fontSize: 80 }, height: 80 }}>{icon}</Stack>
                <Stack alignItems='center' gap={1}>
                  <Typography fontWeight='bold' color='black' textTransform='initial'>
                    {title}
                  </Typography>
                  <Typography fontSize={13} color='secondary' textTransform='initial'>
                    {description}
                  </Typography>
                </Stack>
              </Stack>
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      {cancelText && (
        <DialogActions>
          {isLoading && <CircularProgress size='1rem' sx={{ mr: 'auto', ml: '1rem' }} />}
          <Button onClick={onClose} color='secondary' disabled={isLoading || disabled}>
            {cancelText}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};
