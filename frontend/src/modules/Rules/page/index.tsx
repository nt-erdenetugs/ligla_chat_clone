import JoinLeftIcon from '@mui/icons-material/JoinLeft';
import { useSearchParams } from 'react-router';

import { DataTableWithHeader, OpenDialogButton } from '~/common/components';
import { getFilterFromSearchParams } from '~/common/components/ListFilter/hooks/useListFilter';
import { ChatAssignRulesDocument } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { useRulesColumns, useRulesActions, Form, Show } from '~/modules/Rules';
import { FiltersTable } from '~/modules/Rules/Filters';
import { PAGES } from '~/routes/sidebar';

const DIALOG_KEY = 'type';
const DIALOG_VALUES: string[] = ['filter'];

export const AssignmentRulesPage = () => {
  const [searchParams] = useSearchParams();
  const { disableRule } = useRulesActions();
  const { t_management } = useTranslation();
  const filter = getFilterFromSearchParams(searchParams);

  return (
    <DataTableWithHeader
      entryKey={PAGES.ASSIGN_RULES}
      query={ChatAssignRulesDocument}
      useColumns={useRulesColumns}
      Form={Form}
      Show={Show}
      extraQueryVariables={filter ? { filter } : undefined}
      getRowStyle={(row) => (row.isActive ? {} : { backgroundColor: '#f5f5f9', opacity: 0.5 })}
      actionDisabled={DIALOG_VALUES.includes(searchParams.get(DIALOG_KEY) || '')}
      onDelete={disableRule}
      CustomAction={() => (
        <OpenDialogButton
          dialog={(handleClose) => <FiltersTable onClose={handleClose} />}
          startIcon={<JoinLeftIcon />}
          paramKey={DIALOG_KEY}
          paramValue={DIALOG_VALUES[0]}
        >
          {t_management('chatAssignRules.filterManagements')}
        </OpenDialogButton>
      )}
    />
  );
};
