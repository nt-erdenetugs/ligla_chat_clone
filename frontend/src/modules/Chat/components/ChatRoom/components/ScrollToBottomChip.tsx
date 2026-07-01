import { memo } from 'react';

import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown';
import { Box, Chip, Zoom } from '@mui/material';

import { useTranslation } from '~/locales/hooks';

type PropsType = {
  show: boolean;
  handleClick: () => void;
};

export const ScrollToBottomChip = memo(function ScrollToBottomChip(props: PropsType) {
  const { show, handleClick } = props;
  const { t_chat } = useTranslation();

  return (
    <Box
      sx={{
        transition: 'transform 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
        },
        pointerEvents: 'auto',
      }}
    >
      <Zoom in={show}>
        <Chip
          sx={{
            bgcolor: 'white',
            boxShadow: 3,
            '&:hover': {
              bgcolor: 'white',
            },
          }}
          icon={<KeyboardDoubleArrowDownIcon />}
          label={t_chat('youHaveNewMessage')}
          onClick={handleClick}
          clickable
        />
      </Zoom>
    </Box>
  );
});

ScrollToBottomChip.displayName = 'ScrollToBottomChip';
