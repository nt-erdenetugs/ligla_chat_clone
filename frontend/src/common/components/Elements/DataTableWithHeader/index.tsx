import {
  DataTableWithHeader as _DataTableWithHeader,
  type DataTableWithHeaderProps,
} from '~/common/components/Elements/DataTableWithHeader/DataTableWithHeader';

import { DataTableProvider } from './providers';

export { type DataTableWithHeaderProps } from '~/common/components/Elements/DataTableWithHeader/DataTableWithHeader';

export * from './types';
export * from './components';

export const DataTableWithHeader = ({ customPagination, ...props }: DataTableWithHeaderProps) => {
  return (
    <DataTableProvider customPagination={customPagination}>
      <_DataTableWithHeader {...props} />
    </DataTableProvider>
  );
};
