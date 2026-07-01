import { DataTable } from '~/common/components/Elements/DataTableWithHeader/DataTable';
import { COLUMN_SETTING_QUERY_PATH, useColumnSettingActions } from '~/common/hooks';
import {
  SurveyColumnsDocument,
  SurveyColumnType,
  useSurveyColumnsQuery,
  useUpdateSurveySettingMutation,
} from '~/generated/graphql/types';
import { useColumns } from '~/modules/SurveySettings';

export const SurveyColumnSettings = () => {
  const { localCheckedState, toggleColumn } = useColumnSettingActions({
    useQuery: useSurveyColumnsQuery,
    useMutation: useUpdateSurveySettingMutation,
    queryDataPath: COLUMN_SETTING_QUERY_PATH.SURVEY_COLUMNS,
    mutationInputName: 'updateSurveySettingInput',
    columnEnum: SurveyColumnType,
    successKey: 'survey.success.update',
    restoreKey: 'survey.success.restore',
  });

  const tableColumns = useColumns({
    onToggleShow: toggleColumn,
    localCheckedState,
  });

  return (
    <DataTable
      entryKey='surveyColumns'
      query={SurveyColumnsDocument}
      useColumns={() => tableColumns}
      disableAddAction
      disablePagination
      hideActionsColumn
      filterColumn={true}
    />
  );
};
