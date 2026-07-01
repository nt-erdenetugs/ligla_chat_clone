import { useMemo } from 'react';

import { useDndMonitor } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Box, Divider } from '@mui/material';
import Stack from '@mui/material/Stack';
import { createPortal } from 'react-dom';
import { type UseFormReturn } from 'react-hook-form';
import { useSearchParams } from 'react-router';
import SimpleBar from 'simplebar-react';

import { Label, SwitchControl, TextFieldControl } from '~/common/components';
import { useTranslation } from '~/locales/hooks';
import {
  RULE_FILTER_ACTION_KEY,
  DragDataType,
  FilterGroupItemType,
  FilterList,
  FiltersBuilder,
  findGroup,
  findGroupPathName,
  isOverChild,
  RuleTarget,
  RULE_NAME_MAX_CHARACTER_LIMIT,
  RULE_NOTE_MAX_CHARACTER_LIMIT,
  type DragData,
  type Inputs,
} from '~/modules/Rules';
import { FilterForm, Show as FilterShow } from '~/modules/Rules/Filters';
import { useTeamQueries } from '~/modules/Teams';
import { uniqueKey } from '~/utils';

type RuleFormProps = {
  form: UseFormReturn<Inputs>;
  isEditing?: boolean;
};

export const RuleForm = ({ form, isEditing = false }: RuleFormProps) => {
  const { t_management, t_errors } = useTranslation();
  const { selectableTeams } = useTeamQueries();

  const [searchParams, setSearchParams] = useSearchParams();
  const [action, filterId] = searchParams.get(RULE_FILTER_ACTION_KEY)?.split('_') || [];
  const { control, setValue, getValues, watch } = form;

  const allTeamOptions = useMemo(
    () => selectableTeams.map((t) => [t.name, t.id] as [string, string]),
    [selectableTeams],
  );

  const handleClose = () => {
    searchParams.delete(RULE_FILTER_ACTION_KEY);
    setSearchParams(searchParams);
  };

  useDndMonitor({
    onDragEnd: ({ over, active }) => {
      const activeData = active?.data.current as Optional<DragData>;
      const overData = over?.data.current as Optional<DragData>;

      if (!activeData || !overData || isOverChild(active, over)) {
        return;
      }

      const rootGroup = getValues('rootFilterGroup');

      // Case: reorder within same group
      if (
        overData.type === DragDataType.GroupItem &&
        activeData.groupId &&
        activeData.groupId === overData.groupId
      ) {
        const groupPathName = findGroupPathName(rootGroup, overData.groupId);
        if (groupPathName) {
          const currentGroupItems = getValues(groupPathName)?.items;
          const newItems = arrayMove(currentGroupItems, activeData.index!, overData.index!);
          setValue(`${groupPathName}.items`, newItems, { shouldDirty: true });
        }
      }
      // Case: move to different group or insert filter into a group
      else if (overData.groupId || overData.type === DragDataType.Group) {
        const activeGroup = findGroup(rootGroup, activeData.itemId);
        const overIndex = overData.type === DragDataType.Group ? 0 : overData.index! + 1;

        const newItem = activeGroup
          ? activeGroup
          : {
              type: FilterGroupItemType.Filter,
              key: uniqueKey(FilterGroupItemType.Filter),
              id: activeData.id!,
              name: activeData.name!,
            };

        // Remove from old location
        const activeParentItems = findGroup(rootGroup, activeData.groupId!)?.items;
        activeParentItems?.splice(activeData.index!, 1);

        // Insert into new location
        const overKey = overData.type === DragDataType.Group ? overData.itemId : overData.groupId!;
        const overItems = findGroup(rootGroup, overKey)?.items;
        overItems?.splice(overIndex, 0, newItem);

        // Update form values
        const activeParentName = findGroupPathName(rootGroup, activeData.groupId!);
        const overGroupName = findGroupPathName(rootGroup, overKey);

        if (overGroupName && overItems) {
          setValue(`${overGroupName}.items`, overItems, { shouldDirty: true });
        }
        if (activeParentName && activeParentItems) {
          setValue(`${activeParentName}.items`, activeParentItems, { shouldDirty: true });
        }
      }
    },
  });

  const nameErrorMessage =
    watch('name').length > RULE_NAME_MAX_CHARACTER_LIMIT
      ? t_errors('maxCharacterLimit', { limit: RULE_NAME_MAX_CHARACTER_LIMIT })
      : null;

  const noteErrorMessage =
    (watch('note') || '').length > RULE_NOTE_MAX_CHARACTER_LIMIT
      ? t_errors('maxCharacterLimit', { limit: RULE_NOTE_MAX_CHARACTER_LIMIT })
      : null;

  return (
    <>
      <Stack direction='row' gap={3} height='100%'>
        <FilterList />

        <Box flexGrow={1} sx={{ overflow: 'hidden', pb: 4 }}>
          <SimpleBar
            forceVisible='y'
            style={{ height: '100%', paddingRight: '16px' }}
            classNames={{ contentEl: 'simplebar-content h-100' }}
          >
            <Stack gap={3}>
              <TextFieldControl
                name='name'
                label={t_management('chatAssignRules.name')}
                errorMessage={nameErrorMessage}
                control={control}
                required
              />

              <Divider />

              <Stack gap={2}>
                <Stack
                  direction='row'
                  sx={{ gap: 1, alignItems: 'end', justifyContent: 'space-between' }}
                >
                  <Label text={t_management('chatAssignFilters.title')} required />
                </Stack>

                <Stack>
                  <FiltersBuilder
                    form={form}
                    name='rootFilterGroup'
                    nested={false}
                    parents={[]}
                    root
                  />
                </Stack>
              </Stack>
              <Divider />
              <TextFieldControl
                name='note'
                label={t_management('note')}
                errorMessage={noteErrorMessage}
                control={control}
                minRows={2}
                multiline
              />

              <Divider />

              <RuleTarget
                control={control}
                options={allTeamOptions}
                placeholder={t_management('teams.selectTeams')}
              />

              {isEditing && (
                <>
                  <Divider />
                  <SwitchControl
                    name='isActive'
                    label={t_management('status')}
                    startText={t_management('active')}
                    endText={t_management('inactive')}
                    control={control}
                  />
                </>
              )}
            </Stack>
          </SimpleBar>
        </Box>
      </Stack>

      {action === 'show' &&
        createPortal(
          <FilterShow
            id={filterId}
            onClose={handleClose}
            dialogProps={{ actionKey: RULE_FILTER_ACTION_KEY, paramSuffix: `_${filterId}` }}
          />,
          document.body,
        )}
      {action === 'edit' && <FilterForm id={filterId} onClose={handleClose} />}
    </>
  );
};
