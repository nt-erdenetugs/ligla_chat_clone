import { useSearchParams } from 'react-router';

import { DataTableWithHeader } from '~/common/components/Elements/DataTableWithHeader/DataTableWithHeader';
import { getFilterFromSearchParams } from '~/common/components/ListFilter/hooks/useListFilter';
import { PaginatedAttributesDocument } from '~/generated/graphql/types';
import {
  Form as AttributeForm,
  Show as AttributeShow,
  useAttributesActions,
  useColumns as useAttributeColumns,
} from '~/modules/Attributes';

export const AttributesColumnSettings = () => {
  const { disableAttribute } = useAttributesActions();
  const [searchParams] = useSearchParams();
  const columns = useAttributeColumns();

  const filter = getFilterFromSearchParams(searchParams, {
    columns,
    paramKey: 'filters_attributes',
  });

  return (
    <DataTableWithHeader
      entryKey='attributes'
      query={PaginatedAttributesDocument}
      useColumns={useAttributeColumns}
      Form={AttributeForm}
      Show={AttributeShow}
      extraQueryVariables={filter ? { filter } : undefined}
      getRowStyle={(row) => (row.isActive ? {} : { backgroundColor: '#f5f5f9', opacity: 0.5 })}
      onDelete={disableAttribute}
      mergeHeader
    />
  );
};
