import { Chip, Stack, Typography } from '@mui/material';

import { ActiveStatusChip, type Column } from '~/common/components';
import { type ChatAssignRule } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { useRulesActions } from '~/modules/Rules';
import { formatYYYYMMDDHHmm } from '~/plugins';

export const useRulesColumns = (): Column<ChatAssignRule>[] => {
  const { t_management } = useTranslation();
  const { setTargetRule, removeTargetRule, toggleRuleStatus } = useRulesActions();

  return [
    {
      name: 'isActive',
      label: t_management('status'),
      filterType: 'boolean',
      enumOptions: [
        { value: true, label: t_management('Active') },
        { value: false, label: t_management('Inactive') },
      ],
      filterable: true,
      width: '15%',
      sortDisabled: true,
      formatValue: (rule: ChatAssignRule) => (
        <ActiveStatusChip
          id={rule.id}
          status={Boolean(rule.isActive)}
          setTarget={setTargetRule}
          removeTarget={removeTargetRule}
          toggleStatus={toggleRuleStatus}
        />
      ),
    },
    {
      name: 'name',
      label: t_management('chatAssignRules.name'),
      width: '25%',
      searchable: true,
      filterable: true,
      filterType: 'string',
    },
    {
      name: 'teams',
      label: t_management('chatAssignRules.appliedTeams'),
      width: '30%',
      sortDisabled: true,
      filterable: false,
      formatValue: ({ targetTeams }: ChatAssignRule) => (
        <Stack direction='row' spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
          {targetTeams?.map((team) => (
            <Chip key={team.id} label={team.name} size='small' />
          ))}
        </Stack>
      ),
    },
    {
      name: 'createdAt',
      label: t_management('createdDate'),
      filterable: true,
      filterType: 'datetime',
      width: '15%',
      formatValue: (rule: ChatAssignRule) => (
        <Typography variant='body2' color='text.secondary'>
          {formatYYYYMMDDHHmm(rule.createdAt)}
        </Typography>
      ),
    },
  ];
};
