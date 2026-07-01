import { useSearchParams } from 'react-router';

import { DataTableWithHeader } from '~/common/components/Elements/DataTableWithHeader/DataTableWithHeader';
import { getFilterFromSearchParams } from '~/common/components/ListFilter/hooks/useListFilter';
import { TagsDocument } from '~/generated/graphql/types';
import {
  Form as TagForm,
  Show as TagShow,
  useColumns as useTagColumns,
  useTagActions,
} from '~/modules/Tags';

export const TagsColumnSettings = () => {
  const { disableTag } = useTagActions();
  const columns = useTagColumns();

  const [searchParams] = useSearchParams();
  const filter = getFilterFromSearchParams(searchParams, { columns, paramKey: 'filters_tags' });

  return (
    <DataTableWithHeader
      entryKey='tags'
      query={TagsDocument}
      useColumns={useTagColumns}
      Form={TagForm}
      Show={TagShow}
      extraQueryVariables={filter ? { filter } : undefined}
      getRowStyle={(row) => (row.isActive ? {} : { backgroundColor: '#f5f5f9', opacity: 0.5 })}
      onDelete={disableTag}
      mergeHeader
    />
  );
};
