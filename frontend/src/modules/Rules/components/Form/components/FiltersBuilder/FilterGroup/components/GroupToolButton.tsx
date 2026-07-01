import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { Button, Stack } from '@mui/material';

import { TooltipIconButton } from '~/common/components';
import { LogicalOperator } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';

import { type GroupProps, AddFilterButton } from '..';

type GroupToolButtonProps = {
  groupKey: string;
  onAddFilter: GroupProps['onAddFilter'];
  onAddGroup: GroupProps['onAddGroup'];
  onRemove?: GroupProps['onRemove'];
  addGroupDisabled?: boolean;
};

export const GroupToolButton = ({
  groupKey,
  onAddFilter,
  onAddGroup,
  onRemove,
  addGroupDisabled,
}: GroupToolButtonProps) => {
  const { t, t_management } = useTranslation();

  return (
    <Stack direction='row' gap={1}>
      <AddFilterButton groupKey={groupKey} onAdd={onAddFilter} />
      {!addGroupDisabled && (
        <Button
          size='small'
          startIcon={<AddIcon />}
          variant='outlined'
          onClick={() => onAddGroup({ logicalOperator: LogicalOperator.And, items: [] })}
          sx={{ backgroundColor: 'white' }}
        >
          {t_management('chatAssignRules.addGroup')}
        </Button>
      )}
      {onRemove && (
        <TooltipIconButton
          title={t('actions.delete')}
          icon={<DeleteIcon />}
          iconButtonProps={{ size: 'small', color: 'primary' }}
          onClick={() => onRemove(groupKey)}
        />
      )}
    </Stack>
  );
};
