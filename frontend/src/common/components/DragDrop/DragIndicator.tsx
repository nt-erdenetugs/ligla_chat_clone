import { type SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { Stack } from '@mui/material';

type DragIndicatorProps = {
  listeners?: SyntheticListenerMap;
};

export const DragIndicator = ({ listeners }: DragIndicatorProps) => {
  return (
    <Stack
      p='4px'
      borderRadius={1}
      sx={{ transition: '.2s', ':hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' } }}
    >
      <DragIndicatorIcon
        color='secondary'
        sx={{ cursor: 'grab', fontSize: '1.2rem' }}
        {...listeners}
      />
    </Stack>
  );
};
