import { type Column, ActiveStatusChip } from '~/common/components';
import { useTranslation } from '~/locales/hooks';
import { useAttributesActions, type IAttribute } from '~/modules/Attributes';

export const useColumns = (): Column<IAttribute>[] => {
  const { t_management } = useTranslation();
  const { setTargetAttribute, removeTargetAttribute, toggleAttributeStatus } =
    useAttributesActions();

  return [
    {
      name: 'isActive',
      label: t_management('status'),
      width: '15%',
      enumOptions: [
        { value: true, label: t_management('Active') },
        { value: false, label: t_management('Inactive') },
      ],
      filterType: 'isEnum',
      filterable: true,
      formatValue: (record) => (
        <ActiveStatusChip
          id={record.id}
          status={Boolean(record.isActive)}
          setTarget={setTargetAttribute}
          removeTarget={removeTargetAttribute}
          toggleStatus={toggleAttributeStatus}
        />
      ),
    },
    {
      name: 'name',
      label: t_management('attributes.name'),
      width: '20%',
      filterable: true,
      searchable: true,
    },
    {
      name: 'type',
      label: t_management('attributes.type'),
      width: '20%',
      filterable: true,
      filterType: 'type',
    },
    {
      name: 'isEncryptionEnabled',
      label: t_management('attributes.isEncrypted'),
      width: '20%',
      formatValue: (record) => {
        return record.isEncryptionEnabled ? 'Yes' : 'No';
      },
      filterable: true,
      filterType: 'boolean',
      enumOptions: [
        { value: true, label: t_management('yes') },
        { value: false, label: t_management('no') },
      ],
    },
  ];
};
