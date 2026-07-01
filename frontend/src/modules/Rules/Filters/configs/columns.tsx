import { Chip, Typography } from '@mui/material';

import { type Column, ActiveStatusChip } from '~/common/components';
import { type ChatAssignFilter, FilterTargetType } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { formatYYYYMMDDHHmm } from '~/plugins';

export const useColumns = (): Column<ChatAssignFilter>[] => {
  const { t, t_management } = useTranslation();

  return [
    {
      name: 'name',
      label: t_management('chatAssignFilters.name'),
      filterable: true,
      filterType: 'string',
      searchable: true,
      width: '25%',
    },
    {
      name: 'note',
      label: t('note'),
      filterable: true,
      filterType: 'string',
      searchable: true,
    },
    {
      name: 'targetTable',
      label: t_management('chatAssignFilters.targetTable'),
      filterable: true,
      searchable: true,
      filterType: 'isEnum',
      enumOptions: Object.values(FilterTargetType).map((v) => ({ value: v, label: v })),
      formatValue: (record) => (
        <Chip
          sx={{ width: '5.5rem', fontWeight: 'bold', fontSize: '0.75rem' }}
          label={t_management(`chatAssignFilters.${record.targetTable.toLowerCase()}`)}
        />
      ),
    },
    {
      name: 'isActive',
      label: t_management('status'),
      width: '15%',
      filterable: true,
      filterType: 'boolean',
      enumOptions: [
        { value: true, label: t_management('active') },
        { value: false, label: t_management('inactive') },
      ],
      formatValue: (record) => <ActiveStatusChip status={Boolean(record.isActive)} />,
    },
    {
      name: 'createdAt',
      label: t_management('createdDate'),
      width: '15%',
      filterable: true,
      filterType: 'datetime',
      formatValue: (record) => (
        <Typography variant='body2' color='text.secondary'>
          {formatYYYYMMDDHHmm(record.createdAt)}
        </Typography>
      ),
    },
  ];
};
