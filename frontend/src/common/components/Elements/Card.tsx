import { Fragment } from 'react';

import {
  Stack,
  Fade,
  Grow,
  Zoom,
  Card as MuiCard,
  type CardProps as MuiCardProps,
  type StackProps,
} from '@mui/material';

export type CardProps = MuiCardProps &
  StackProps & {
    transition?: keyof typeof Transitions;
    timeout?: number;
  };

const Transitions = {
  fade: Fade,
  zoom: Zoom,
  grow: Grow,
};

export const Card = ({ children, transition, timeout, sx, ...rest }: CardProps) => {
  const Transition = transition ? Transitions[transition] : Fragment;

  return (
    <Transition {...(transition && { timeout, in: true })}>
      <MuiCard
        p={3}
        component={Stack}
        sx={{
          borderRadius: 2,
          boxShadow:
            'rgba(145, 158, 171, 0.08) 0px 0px 2px 0px, rgba(145, 158, 171, 0.08) 0px 12px 24px -4px',
          ...sx,
        }}
        {...rest}
      >
        {children}
      </MuiCard>
    </Transition>
  );
};
