import { memo } from 'react';

import { useSortable } from '@dnd-kit/sortable';
import { Box, type SxProps } from '@mui/material';

import { DragOverlay } from '~/common/components';
import {
  DragDataType,
  dropPreviewStyle,
  Filter,
  useSortDirection,
  type FilterProps,
} from '~/modules/Rules';

type SortableFilterProps = FilterProps & {
  itemId: string;
  groupId?: string;
  index?: number;
  top?: boolean;
  parents?: string[];
  sx?: SxProps;
  draggable?: boolean;
};

export const SortableFilter = ({
  itemId,
  groupId,
  index,
  top,
  parents,
  sx,
  draggable = true,
  ...props
}: SortableFilterProps) => {
  const { id, name, nested } = props;

  const { listeners, setNodeRef, isOver, activeIndex, overIndex, isDragging, over, active } =
    useSortable({
      id: itemId,
      data: { type: DragDataType.GroupItem, id, name, itemId, groupId, index, parents },
      disabled: { draggable: !draggable },
    });

  const sortDirection = useSortDirection({
    active,
    over,
    activeIndex,
    overIndex,
    groupId,
    isOver,
    top,
  });

  return (
    <Box
      sx={{
        position: 'relative',
        ...(isDragging && { opacity: 0.5 }),
        ...dropPreviewStyle(nested, sortDirection),
        ...sx,
      }}
    >
      <MemoFilter listeners={listeners} setNodeRef={setNodeRef} {...props} />
      <DragOverlay>{active?.id === itemId && <MemoFilter {...props} overlay />}</DragOverlay>
    </Box>
  );
};

const MemoFilter = memo(Filter);
