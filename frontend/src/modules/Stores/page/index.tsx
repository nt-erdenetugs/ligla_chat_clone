import { useSearchParams } from 'react-router';

import { DataTableWithHeader } from '~/common/components/Elements/DataTableWithHeader';
import { getFilterFromSearchParams } from '~/common/components/ListFilter/hooks/useListFilter';
import { StoresDocument } from '~/generated/graphql/types';
import { useColumns, Show } from '~/modules/Stores';
import { PAGES } from '~/routes/sidebar';

export const StoresPage = () => {
  const [searchParams] = useSearchParams();
  const filter = getFilterFromSearchParams(searchParams);

  return (
    <DataTableWithHeader
      entryKey={PAGES.STORES}
      query={StoresDocument}
      useColumns={useColumns}
      Show={Show}
      disableAddAction
      editDisabled
      extraQueryVariables={filter ? { filter } : undefined}
    />
  );
};
