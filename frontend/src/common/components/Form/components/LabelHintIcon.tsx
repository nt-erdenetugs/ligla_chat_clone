import { useState, type ReactNode } from 'react';

import Info from '@mui/icons-material/Info';
import { IconButton, Tooltip, Typography, type Theme } from '@mui/material';

import { CustomPopover } from '~/common/components';
import { useBoolean, useResponsive } from '~/common/hooks';
import { useTranslation } from '~/locales/hooks';

type LabelHintIconProps = {
  title: ReactNode;
  ariaLabel?: string;
};

const iconButtonSx = {
  p: 0.25,
  color: 'text.secondary',
  '&:focus-visible': {
    outline: (theme: Theme) => `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
} as const;

export const LabelHintIcon = ({ title, ariaLabel }: LabelHintIconProps) => {
  const { t } = useTranslation();
  const { isMobileOrTablet } = useResponsive();
  const { value: isOpen, onTrue: openPopover, onFalse: closePopover } = useBoolean();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const resolvedAriaLabel =
    ariaLabel ?? (typeof title === 'string' ? title : t('actions.moreInfo'));

  if (isMobileOrTablet) {
    return (
      <>
        <IconButton
          size='small'
          aria-label={resolvedAriaLabel}
          sx={iconButtonSx}
          onClick={(event) => {
            setAnchorEl(event.currentTarget);
            openPopover();
          }}
        >
          <Info fontSize='small' />
        </IconButton>
        <CustomPopover
          open={isOpen}
          anchorEl={anchorEl}
          onClose={closePopover}
          sx={{
            width: 300,
            bgcolor: 'grey.700',
            color: 'white',
            textAlign: 'left',
            px: 1,
          }}
          anchorOrigin={{ vertical: 40, horizontal: 'center' }}
        >
          <Typography variant='body2'>{title}</Typography>
        </CustomPopover>
      </>
    );
  }

  return (
    <Tooltip title={title}>
      <IconButton size='small' aria-label={resolvedAriaLabel} sx={iconButtonSx}>
        <Info fontSize='small' />
      </IconButton>
    </Tooltip>
  );
};
