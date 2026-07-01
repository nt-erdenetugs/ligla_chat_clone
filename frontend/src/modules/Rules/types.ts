import { type IFilterGroup } from '.';

export enum FilterGroupItemType {
  Filter = 'FILTER',
  Group = 'GROUP',
}

export enum DragDataType {
  GroupItem = 'GROUP_ITEM',
  Group = 'GROUP',
}

export type DragData = Pick<IFilterGroup, 'logicalOperator' | 'items'> & {
  type: DragDataType;
  itemId: string;
  id?: string;
  name?: string;
  groupId?: string;
  index?: number;
  parents?: string[];
};
