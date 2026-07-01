import { DataTable } from '~/common/components/Elements/DataTableWithHeader/DataTable';
import { COLUMN_SETTING_QUERY_PATH, useColumnSettingActions } from '~/common/hooks';
import {
  MemberFeedColumnsDocument,
  MemberFeedColumnType,
  useMemberFeedColumnsQuery,
  useUpdateMemberFeedSettingMutation,
} from '~/generated/graphql/types';
import { useColumns } from '~/modules/Member';

export const MemberFeedColumnSettings = () => {
  const { localCheckedState, toggleColumn } = useColumnSettingActions({
    useQuery: useMemberFeedColumnsQuery,
    useMutation: useUpdateMemberFeedSettingMutation,
    queryDataPath: COLUMN_SETTING_QUERY_PATH.MEMBER_FEED_COLUMNS,
    mutationInputName: 'updateMemberFeedSettingInput',
    columnEnum: MemberFeedColumnType,
    successKey: 'memberFeed.success.update',
    restoreKey: 'memberFeed.success.restore',
  });

  const tableColumns = useColumns({
    onToggleShow: toggleColumn,
    localCheckedState,
  });

  return (
    <DataTable
      entryKey='memberFeedColumns'
      query={MemberFeedColumnsDocument}
      useColumns={() => tableColumns}
      disableAddAction
      disablePagination
      hideActionsColumn
      filterColumn={true}
    />
  );
};
