import { memo } from 'react';

import { useSortable } from '@dnd-kit/sortable';
import { Box } from '@mui/material';

import { DragOverlay } from '~/common/components';
import {
  type IFilterGroup,
  useSortDirection,
  dropPreviewStyle,
  type GroupFormProps,
  FiltersBuilder,
} from '~/modules/Rules';

type SortableGroupProps = GroupFormProps &
  Pick<IFilterGroup, 'logicalOperator' | 'items'> & {
    itemId: string;
    groupId: string;
    index: number;
    top?: boolean;
  };

export const SortableGroup = ({ logicalOperator, items, top, ...props }: SortableGroupProps) => {
  const { itemId, groupId, index, parents } = props;
  const { listeners, setNodeRef, isOver, activeIndex, overIndex, isDragging, over, active } =
    useSortable({
      id: itemId,
      data: { type: 'group-item', items, logicalOperator, itemId, groupId, index, parents },
      disabled: items.length === 0,
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
        ...dropPreviewStyle(props.nested, sortDirection),
      }}
    >
      <MemoGroup setNodeRef={setNodeRef} listeners={listeners} {...props} />
      <DragOverlay>
        {active?.id === itemId && (
          <Box sx={{ opacity: 0.75, filter: 'drop-shadow(0px 0px 4px rgba(0, 0, 0, 0.1))' }}>
            <MemoGroup {...props} overlay />
          </Box>
        )}
      </DragOverlay>
    </Box>
  );
};

const MemoGroup = memo(FiltersBuilder);
