import { useSearchParams } from 'react-router';

import { DataTableWithHeader } from '~/common/components';
import { getFilterFromSearchParams } from '~/common/components/ListFilter/hooks/useListFilter';
import { PaginatedOrganizationsDocument } from '~/generated/graphql/types';
import { useColumns, Form, Show } from '~/modules/Organizations';
import { PAGES } from '~/routes/sidebar';

export const OrganizationsPage = () => {
  const [searchParams] = useSearchParams();
  const filter = getFilterFromSearchParams(searchParams);
  return (
    <DataTableWithHeader
      entryKey={PAGES.ORGANIZATIONS}
      query={PaginatedOrganizationsDocument}
      useColumns={useColumns}
      extraQueryVariables={filter ? { filter } : undefined}
      Form={Form}
      Show={Show}
    />
  );
};
