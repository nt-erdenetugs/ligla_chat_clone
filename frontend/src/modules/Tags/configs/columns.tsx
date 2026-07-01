import { ActiveStatusChip, type Column } from '~/common/components';
import { useTranslation } from '~/locales/hooks';
import { useTagActions, type ITag } from '~/modules/Tags';

export const useColumns = (): Column<ITag>[] => {
  const { t_management } = useTranslation();
  const { setTargetTag, removeTargetTag, toggleTagStatus } = useTagActions();

  return [
    {
      name: 'isActive',
      label: t_management('status'),
      width: '15%',
      filterType: 'boolean',
      enumOptions: [
        { value: true, label: t_management('Active') },
        { value: false, label: t_management('Inactive') },
      ],
      filterable: true,
      formatValue: (record) => (
        <ActiveStatusChip
          id={record.id}
          status={Boolean(record.isActive)}
          setTarget={setTargetTag}
          removeTarget={removeTargetTag}
          toggleStatus={toggleTagStatus}
        />
      ),
    },
    {
      name: 'name',
      label: t_management('tags.name'),
      width: '50%',
      filterable: true,
      searchable: true,
    },
  ];
};
