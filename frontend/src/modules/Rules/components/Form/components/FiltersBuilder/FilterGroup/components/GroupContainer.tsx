import { type ReactNode } from 'react';

import { Box, Stack } from '@mui/material';

import { MAIN_COLOR } from '~/configs';
import { type NestedStyleProps, nestedStyle } from '~/modules/Rules';

type GroupContainerProps = {
  children: ReactNode;
  isOver?: boolean;
  setNodeRef?: (element: HTMLElement | null) => void;
  setDroppableRef?: (element: HTMLElement | null) => void;
  nested?: boolean;
  nestedStyleProps?: NestedStyleProps;
  pb?: number | string;
  error?: boolean;
};

export const GroupContainer = ({
  children,
  isOver,
  setNodeRef,
  setDroppableRef,
  nested,
  nestedStyleProps,
  pb,
  error = false,
}: GroupContainerProps) => {
  const borderColor = error ? 'red' : nestedStyleProps?.color || MAIN_COLOR;

  return (
    <Box
      ref={setNodeRef}
      position='relative'
      width={!nested ? '100%' : 'calc(100% - 15px)'}
      pb={pb}
      sx={{ opacity: '1 !important' }}
      {...(nested && { sx: nestedStyle({ ...nestedStyleProps }) })}
    >
      <Stack
        p='12px 8px 0 8px'
        gap='12px'
        border={`1px solid ${borderColor}`}
        borderTop={`3px solid ${borderColor}`}
        borderRadius={1}
        width='100%'
        sx={{
          backgroundColor: isOver ? 'rgba(0, 108, 35, 0.08)' : '#fff',
        }}
      >
        {children}
      </Stack>
      <Box
        ref={setDroppableRef}
        sx={{
          content: '""',
          position: 'absolute',
          left: 0,
          top: 16,
          height: 'calc(100% - 32px)',
          width: '100%',
          pointerEvents: 'none',
        }}
      />
    </Box>
  );
};
