import { useState } from 'react';

import { Stack, Chip, type ChipProps, type StackProps, type SxProps, Tooltip } from '@mui/material';

import { ChipDetailDialog } from '~/common/components';
import { type ChipColor } from '~/common/hooks';

type ChipsWrapperProps<T> = ChipProps & {
  title?: string;
  disabled?: boolean;
  items: T[];
  limit?: number;
  sx?: SxProps;
  getChipLabel: (item: T) => string;
  getTooltipTitle?: (item: T) => string | undefined;
  getChipColor?: (item: T) => ChipColor;
  stackProps?: StackProps;
};

const maxWidth = '15rem';
export const ChipsWrapper = <T,>({
  title,
  disabled,
  items,
  limit,
  getChipLabel,
  getChipColor,
  stackProps = {},
  getTooltipTitle,
  sx,
  ...rest
}: ChipsWrapperProps<T>) => {
  const [open, setOpen] = useState<boolean>(false);
  const displayedItems = limit ? items.slice(0, limit) : items;
  const _sx = { maxWidth, ...sx };

  const openChipDetailDialog = () => {
    setOpen(true);
  };

  const closeChipDetailDialog = () => {
    setOpen(false);
  };

  return (
    <>
      <Stack px={1} direction='row' gap={1} alignItems='center' flexWrap='wrap' {...stackProps}>
        {displayedItems.map((item, index) => {
          const chipColor = getChipColor?.(item);

          return (
            <Tooltip key={index} title={getTooltipTitle?.(item) ?? ''}>
              <Chip
                key={index}
                label={getChipLabel(item)}
                color={chipColor}
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  borderRadius: 20,
                  fontSize: '0.75rem',
                  alignItems: 'center',
                }}
                {...rest}
              />
            </Tooltip>
          );
        })}
        {limit && items.length > limit && (
          <Chip
            onClick={disabled ? undefined : openChipDetailDialog}
            label={`+${items.length - limit}`}
            sx={_sx}
            {...rest}
          />
        )}
      </Stack>
      <ChipDetailDialog
        title={title}
        getChipLabel={getChipLabel}
        items={items}
        open={open}
        onClose={closeChipDetailDialog}
      />
    </>
  );
};
