import { type ReactNode } from 'react';

import { type SxProps } from '@mui/material';

import { type ShowDialogProps, type FormDialogProps } from '~/common/components';
import { type NumberOrString, type ID } from '~/common/types';
import { type PAGES } from '~/routes/sidebar';

export type Row = {
  id: ID;
  isActive?: boolean;
  isDefault?: boolean;
  [key: string]: any;
};

export type Column<T = Record<string, any>> = {
  name: keyof T | string;
  label: string;
  formatValue?: (record: T) => ReactNode;
  renderHeader?: () => ReactNode;
  width?: NumberOrString;
  minWidth?: NumberOrString;
  align?: 'right' | 'left' | 'center';
  sortDisabled?: boolean;
  sx?: SxProps;
  enumOptions?: { value: string | number | boolean; label: string }[];
  filterable?: boolean;
  searchable?: boolean;
  filterType?: 'datetime' | 'number' | 'boolean' | 'string' | 'type' | 'isEnum';
};

export type FormProps = {
  onClose: () => void;
  id?: ID;
  organizationId?: string;
  dialogProps?: Partial<FormDialogProps>;
};

export type ShowProps = {
  onClose: () => void;
  onConfirm?: () => void;
  id: ID;
  organizationId?: string;
  dialogProps?: Partial<ShowDialogProps>;
  depth?: number;
};

export type TableKey =
  | (typeof PAGES)[keyof typeof PAGES]
  | 'memberFeedColumns'
  | 'surveyColumns'
  | 'attributes'
  | 'tags'
  | 'chatAssignFilters';

export type ToggleProps = {
  onClose: () => void;
  id: ID;
  dialogProps?: Partial<ShowDialogProps>;
  status: boolean;
  setTarget: (id: string) => void;
  removeTarget: () => void;
  toggleStatus: (id: string) => Promise<void>;
};

export type ActionItem = {
  key: string;
  label?: string;
  tooltip?: string;
  icon?: ReactNode;
  onClick?: () => void | Promise<void>;
};
