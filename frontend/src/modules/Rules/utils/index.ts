import { useMemo } from 'react';

import { type Active, type Over } from '@dnd-kit/core';

import { uniqueKey } from '~/utils';

import { type IFilterGroup, type IFilter, FilterGroupItemType, type DragData } from '..';

export type NestedStyleProps = {
  last?: boolean;
  detatched?: boolean;
  color?: string;
};

export const isGroup = (data: IFilterGroup['items'][number]): data is IFilterGroup => {
  return data.type === FilterGroupItemType.Group;
};

export const isFilter = (data: IFilterGroup['items'][number]): data is IFilter => {
  return data.type === FilterGroupItemType.Filter;
};

export const findGroupPathName = <T extends 'rootFilterGroup'>(
  group: IFilterGroup,
  targetGroupKey: string,
  fieldPathName: T = 'rootFilterGroup' as T,
): Nullable<T> => {
  if (group.key === targetGroupKey) return fieldPathName;

  for (let i = 0; i < group.items.length; i++) {
    const item = group.items[i];
    if (isGroup(item)) {
      const currentPathName = `${fieldPathName}.items.${i}` as T;
      if (item.key === targetGroupKey) return currentPathName;
      const childGroupPathName = findGroupPathName(item, targetGroupKey, currentPathName);
      if (childGroupPathName) return childGroupPathName;
    }
  }

  return null;
};

export const findGroup = (group: IFilterGroup, targetKey: string): Nullable<IFilterGroup> => {
  if (group.key === targetKey) {
    return group;
  }
  for (let i = 0; i < group.items.length; i++) {
    const item = group.items[i];
    if (isGroup(item)) {
      if (item.key === targetKey) {
        return item;
      }
      const childTargetGroup = findGroup(item, targetKey);
      if (childTargetGroup) {
        return childTargetGroup;
      }
    }
  }
  return null;
};

export const isOverChild = (active: Active | null, over: Over | null) => {
  const activeData = active?.data.current as DragData | undefined;
  const overData = over?.data.current as DragData | undefined;
  return Boolean(
    activeData?.itemId === overData?.itemId ||
    (activeData && overData?.parents?.includes(activeData.itemId)),
  );
};

type SortDirectionProps = {
  active: Active | null;
  over: Over | null;
  activeIndex: number;
  overIndex: number;
  isOver: boolean;
  top?: boolean;
  groupId?: string;
};

export const useSortDirection = ({
  active,
  over,
  activeIndex,
  overIndex,
  groupId,
  isOver,
  top,
}: SortDirectionProps) => {
  return useMemo(() => {
    if (!groupId || isOverChild(active, over)) return false;
    return isOver
      ? activeIndex > overIndex
        ? 'before'
        : activeIndex < overIndex
          ? 'after'
          : false
      : top && over?.id === `droppable-${groupId}`
        ? 'before'
        : false;
  }, [active, activeIndex, groupId, isOver, over, overIndex, top]);
};

export const withKeyAndType = <T extends { id?: string }>(data: T, type: FilterGroupItemType) => ({
  ...data,
  key: data.id || uniqueKey(type),
  type,
});

export const dropPreviewStyle = (nested?: boolean, sortDirection?: 'before' | 'after' | false) => {
  const commonStyle = {
    content: '""',
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    ml: nested ? '15px' : 0,
    backgroundColor: 'info.main',
    width: '75%',
    opacity: 0,
    transition: '0.25s',
    borderRadius: 1,
  };

  return {
    '&::before': {
      top: -8,
      ...commonStyle,
      ...(sortDirection === 'before' && {
        width: 'calc(100% - 15px)',
        opacity: 1,
      }),
    },
    '&::after': {
      bottom: 4,
      ...commonStyle,
      ...(sortDirection === 'after' && {
        width: 'calc(100% - 15px)',
        opacity: 1,
      }),
    },
  };
};

export const nestedStyle = ({ last, detatched, color }: NestedStyleProps) => ({
  position: 'relative',
  opacity: '1 !important',
  ml: '15px',
  ':before, :after': {
    content: '""',
    position: 'absolute',
    borderColor: color || '#ccc',
    borderStyle: 'solid',
    width: 12,
    left: -13,
  },
  ':before': {
    top: -13,
    height: 'calc(50% + 15px)',
    borderWidth: detatched ? '0 0 0 2px' : '0 0 2px 2px',
  },
  ':after': {
    top: 'calc(50% + 1px)',
    height: 'calc(50% + 2px)',
    borderWidth: last ? 0 : '0 0 0 2px',
  },
});
