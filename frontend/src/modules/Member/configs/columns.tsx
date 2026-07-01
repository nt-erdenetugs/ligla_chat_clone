import Switch from '@mui/material/Switch';

import { type Column } from '~/common/components';
import { type MemberFeedColumn, type MemberFeedColumnType } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';

interface UseColumnsProps {
  onToggleShow: (columnType: MemberFeedColumnType, checked: boolean) => void;
  localCheckedState: Map<string, boolean>;
}

export const useColumns = ({
  onToggleShow,
  localCheckedState,
}: UseColumnsProps): Column<MemberFeedColumn>[] => {
  const { t_management } = useTranslation();

  return [
    {
      name: 'isShow',
      label: t_management('columnSettings.column.show'),
      width: '10%',
      sortDisabled: true,
      filterable: false,
      formatValue: (record: MemberFeedColumn) => {
        const isChecked = localCheckedState.get(record.name) ?? false;
        return (
          <Switch
            checked={isChecked}
            onChange={(_event, checked) => onToggleShow(record.name, checked)}
          />
        );
      },
    },
    {
      name: 'name',
      label: t_management('columnSettings.column.name'),
      width: '25%',
      filterable: true,
      searchable: true,
    },
    {
      name: 'alias',
      label: t_management('columnSettings.column.alias'),
      filterable: true,
      searchable: true,
    },
  ];
};
