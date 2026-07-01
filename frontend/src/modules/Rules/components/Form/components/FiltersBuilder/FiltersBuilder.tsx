import { useEffect } from 'react';

import { useDroppable } from '@dnd-kit/core';
import { type SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { type FieldErrors, type UseFormReturn, useFieldArray } from 'react-hook-form';

import { LogicalOperator } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import {
  DragDataType,
  FilterGroup,
  FilterGroupItemType,
  isOverChild,
  type GroupProps,
  type NestedStyleProps,
  type Inputs,
} from '~/modules/Rules';
import { isArrayEqual, uniqueKey } from '~/utils';

type GroupName = 'rootFilterGroup';

type ArrayIndex = `${number}`;

// Recursively get the type of a nested path
type DeepValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? DeepValue<T[K], Rest>
    : K extends ArrayIndex
      ? T extends Array<infer U>
        ? DeepValue<U, Rest>
        : never
      : never
  : P extends keyof T
    ? T[P]
    : P extends ArrayIndex
      ? T extends Array<infer U>
        ? U
        : never
      : never;

export type GroupFormProps = {
  form: UseFormReturn<Inputs>;
  name: GroupName;
  parents: string[];
  onRemove?: (id: string) => void;
  root?: boolean;
  nested?: boolean;
  nestedStyleProps?: NestedStyleProps;
  setNodeRef?: (element: HTMLElement | null) => void;
  listeners?: SyntheticListenerMap;
  overlay?: boolean;
};

const getNestedValue = <T extends object, P extends string>(obj: FieldErrors<T>, path: P) => {
  return path.split('.').reduce<any>((acc, key) => {
    if (acc == null) return undefined;

    const idx = Number(key);
    if (!isNaN(idx)) return (acc as unknown[])[idx];

    return (acc as Record<string, unknown>)[key];
  }, obj) as DeepValue<FieldErrors<T>, P>;
};

export const FiltersBuilder = (props: GroupFormProps) => {
  const { form, name, parents } = props;
  // Depending on the rendering order, an old name may be passed,
  // so we make sure that the group value can be obtained before rendering.
  const group = form.watch(name);
  const { t_errors } = useTranslation();

  const { fields, insert, replace, remove } = useFieldArray({
    name: `${name}.items`,
    control: form.control,
  });

  const groupError = getNestedValue(form.formState.errors, name);
  const errorMessage = t_errors(
    groupError?.message ?? groupError?.items?.message ?? (groupError?.items?.root?.message || ''),
  );

  useEffect(() => {
    if (
      !isArrayEqual(
        fields.map(({ key }) => key),
        group.items?.map(({ key }) => key),
      )
    ) {
      // Manual update because useFieldArray does not detect parent updates
      replace(group.items ?? []);
    }
  }, [fields, group, replace]);

  useEffect(() => {
    if (!errorMessage) return;

    const minItemsForCurrentGroup = props.root ? 0 : 1;
    const hasValidNumberOfItems = (fields?.length ?? 0) > minItemsForCurrentGroup;

    if (hasValidNumberOfItems) {
      form.clearErrors(`${name}.items`);
    }
  }, [errorMessage, fields?.length, form, name, props.root]);

  const {
    setNodeRef: setDroppableRef,
    isOver,
    active,
    over,
  } = useDroppable({
    id: `droppable-${group.key}`,
    data: { type: DragDataType.Group, itemId: group.key, parents },
  });

  const handleAddFilter: GroupProps['onAddFilter'] = (props, index) => {
    const { id, name } = props;

    insert(index ?? 0, {
      type: FilterGroupItemType.Filter,
      key: uniqueKey(FilterGroupItemType.Filter),
      id: id!,
      name: name ?? '',
    });
  };

  const handleAddGroup: GroupProps['onAddGroup'] = ({ logicalOperator, items }, index) => {
    insert(index ?? 0, {
      type: FilterGroupItemType.Group,
      key: uniqueKey(FilterGroupItemType.Group),
      logicalOperator: logicalOperator ?? LogicalOperator.And,
      items: items ?? [],
    });
  };

  const handleRemoveItem: GroupProps['onRemoveItem'] = (key) => {
    const index = fields.findIndex((v) => v.key === key);
    if (index !== -1) remove(index);
  };

  return (
    <FilterGroup
      group={group}
      onAddFilter={handleAddFilter}
      onAddGroup={handleAddGroup}
      onRemoveItem={handleRemoveItem}
      fields={fields}
      setDroppableRef={setDroppableRef}
      isOver={isOver && fields.length === 0 && !isOverChild(active, over)}
      errorMessage={errorMessage}
      {...props}
    />
  );
};
