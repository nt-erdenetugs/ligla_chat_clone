import { type SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { FormHelperText, Stack } from '@mui/material';
import { type UseFieldArrayReturn } from 'react-hook-form';

import { NewLine, ToggleButtonGroupControl } from '~/common/components';
import { DragIndicator } from '~/common/components/DragDrop';
import { LogicalOperator } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import {
  type DragData,
  FilterGroupItemType,
  type GroupFormProps,
  type IFilterGroup,
  isGroup,
  SortableFilter,
  SortableGroup,
  type AddFilterButtonProps,
  GroupContainer,
  GroupToolButton,
} from '~/modules/Rules';
import { NESTED_GROUP_MAX_DEPTH } from '~/modules/Rules/Filters';

export type GroupProps = GroupFormProps & {
  fields: UseFieldArrayReturn<IFilterGroup>['fields'];
  group: IFilterGroup;
  onAddFilter: AddFilterButtonProps['onAdd'];
  onAddGroup: (
    { logicalOperator, items }: Pick<DragData, 'logicalOperator' | 'items'>,
    index?: number,
  ) => void;
  onRemoveItem: (key: string) => void;
  onRemove?: (id: string) => void;
  setNodeRef?: (element: HTMLElement | null) => void;
  setDroppableRef?: (element: HTMLElement | null) => void;
  listeners?: SyntheticListenerMap;
  isOver?: boolean;
  errorMessage?: string;
};

export const FilterGroup = (props: GroupProps) => {
  const { t, t_management } = useTranslation();
  const {
    form,
    name,
    fields,
    group,
    onAddFilter,
    onAddGroup,
    onRemoveItem,
    onRemove,
    parents,
    nested,
    nestedStyleProps,
    setNodeRef,
    setDroppableRef,
    listeners,
    isOver,
    overlay,
    errorMessage,
  } = props;

  return (
    <GroupContainer
      isOver={isOver}
      setNodeRef={setNodeRef}
      setDroppableRef={setDroppableRef}
      nested={nested && !overlay}
      nestedStyleProps={nestedStyleProps}
      error={!!errorMessage}
      pb='12px'
    >
      <Stack direction='row' justifyContent='space-between'>
        <Stack direction='row' gap={1} alignItems='center'>
          <ToggleButtonGroupControl
            control={form.control}
            name={`${name}.logicalOperator`}
            options={[
              [t('logicalOperator.and'), LogicalOperator.And],
              [t('logicalOperator.or'), LogicalOperator.Or],
            ]}
            size='small'
            disabled={fields.length < 2}
            sx={{ bgcolor: '#fff' }}
            exclusive
          />
          {listeners && <DragIndicator listeners={listeners} />}
          {errorMessage && <FormHelperText error>{errorMessage}</FormHelperText>}
        </Stack>
        <GroupToolButton
          groupKey={group.key}
          onAddFilter={onAddFilter}
          onAddGroup={onAddGroup}
          onRemove={onRemove}
          addGroupDisabled={parents.length >= NESTED_GROUP_MAX_DEPTH}
        />
      </Stack>

      <Stack ml='10px'>
        <SortableContext
          id={group.key}
          items={fields.map(({ key }) => key)}
          strategy={rectSortingStrategy}
        >
          {fields.map(({ id, type, key }, index) => {
            const item = group.items[index];
            const props = {
              itemId: key,
              groupId: group.key,
              index,
              nested: fields.length >= 2,
              top: index === 0,
              nestedStyleProps: {
                last: fields.length === index + 1,
              },
              parents: [...parents, group.key],
            };

            return type === FilterGroupItemType.Filter ? (
              <SortableFilter
                key={id}
                id={form.getValues(`${name}.items.${index}.id`)}
                name={form.getValues(`${name}.items.${index}.name`)}
                onNameChange={(name) =>
                  form.setValue(
                    `${name}.items.${index}.name` as 'rootFilterGroup.items.0.name',
                    name,
                  )
                }
                onRemove={() => onRemoveItem(key)}
                {...props}
              />
            ) : (
              isGroup(item) && item?.items && (
                <SortableGroup
                  key={id}
                  form={form}
                  name={`${name}.items.${index}` as GroupFormProps['name']}
                  onRemove={onRemoveItem}
                  items={item.items}
                  logicalOperator={item.logicalOperator}
                  {...props}
                />
              )
            );
          })}
        </SortableContext>
        {fields.length === 0 && (
          <Stack mb={4} alignItems='center' color='#aaa' textAlign='center' lineHeight='1.5rem'>
            <NewLine text={t_management('chatAssignRules.dropFilterOrCreate')} />
          </Stack>
        )}
      </Stack>
    </GroupContainer>
  );
};
