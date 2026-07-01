import { type Column } from '~/common/components';
import { useTranslation } from '~/locales/hooks';
import { type IStore } from '~/modules/Stores';
import { formatYYYYMMDDHHmm } from '~/plugins';

export const useColumns = (): Column<IStore>[] => {
  const { t_management } = useTranslation();

  return [
    {
      name: 'liglaStoreId',
      label: t_management('stores.storeID'),
      width: '20%',
      sortDisabled: true,
      filterable: true,
      filterType: 'number',
    },
    {
      name: 'name',
      label: t_management('stores.name'),
      width: '40%',
      filterable: true,
      searchable: true,
    },
    {
      name: 'areaName',
      label: t_management('stores.locationArea'),
      width: '40%',
      filterable: true,
      searchable: true,
    },
    {
      name: 'typeName',
      label: t_management('stores.facilityType'),
      width: '40%',
      filterable: true,
      searchable: true,
    },
    {
      name: 'createdAt',
      label: t_management('createdDate'),
      width: '10%',
      sortDisabled: true,
      formatValue: ({ createdAt }) => (createdAt ? formatYYYYMMDDHHmm(createdAt) : ''),
      filterable: true,
      filterType: 'datetime',
    },
  ];
};
