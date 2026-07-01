import { memo } from 'react';

import CloseIcon from '@mui/icons-material/Close';
import { Box, Chip, Tooltip } from '@mui/material';

import { Suspense } from '~/common/components';
import { TAG_NAME_MAX_LENGTH } from '~/common/constants';
import { truncate } from '~/utils';

interface SelectedTagsProps {
  id: string;
  isEnabled?: boolean;
  isLoading?: boolean;
  selectedTags?: Array<{
    name: string;
    id: string;
    isActive: boolean;
  }>;
  handleTagDelete?: (tagId: string) => void;
}

export const SelectedTags = memo(function SelectedTags({
  id,
  isLoading,
  isEnabled,
  selectedTags,
  handleTagDelete,
}: SelectedTagsProps) {
  const chipStyles = (isActive: boolean) => ({
    py: 2,
    px: 0.7,
    opacity: isActive ? 1 : 0.5,
    width: 'auto',
  });

  return (
    <Suspense isLoading={isLoading ?? false} zoomTimeout={0} size={30} disableShrink sx={{ my: 2 }}>
      {selectedTags && selectedTags.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            columnGap: 1,
            mt: 2,
          }}
        >
          {selectedTags?.map((tag) => (
            <Tooltip key={`${id}-${tag.id}`} title={tag.name} arrow>
              <Chip
                label={truncate(tag.name, TAG_NAME_MAX_LENGTH)}
                sx={chipStyles(tag.isActive)}
                deleteIcon={<CloseIcon fontSize='small' />}
                variant={tag.isActive ? 'outlined' : 'filled'}
                color={tag.isActive ? 'primary' : 'default'}
                size='small'
                {...(isEnabled && {
                  onDelete: () => handleTagDelete?.(tag.id),
                })}
              />
            </Tooltip>
          ))}
        </Box>
      )}
    </Suspense>
  );
});

SelectedTags.displayName = 'SelectedTags';
