import { useState, useEffect, useCallback } from 'react';

import { useSnackbar } from 'notistack';

import {
  type UpdateMemberFeedSettingMutationHookResult,
  type UpdateSurveySettingMutationHookResult,
  type MemberFeedColumnsQueryHookResult,
  type SurveyColumnsQueryHookResult,
  type MemberFeedColumn,
  type SurveyColumn,
  type UpdateMemberFeedSettingMutationVariables,
  type UpdateSurveySettingMutationVariables,
} from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';

type UseQueryReturnType = MemberFeedColumnsQueryHookResult | SurveyColumnsQueryHookResult;
type UseMutationReturnType =
  | UpdateMemberFeedSettingMutationHookResult
  | UpdateSurveySettingMutationHookResult;
type MutationInputName =
  | keyof UpdateMemberFeedSettingMutationVariables
  | keyof UpdateSurveySettingMutationVariables;

export enum COLUMN_SETTING_QUERY_PATH {
  MEMBER_FEED_COLUMNS = 'memberFeedColumns',
  SURVEY_COLUMNS = 'surveyColumns',
}

export interface ColumnSettingConfig<ColumnEnum> {
  useQuery: () => UseQueryReturnType;
  useMutation: () => UseMutationReturnType;
  queryDataPath: COLUMN_SETTING_QUERY_PATH;
  mutationInputName: MutationInputName;
  columnEnum: Record<string, ColumnEnum>;
  successKey: string;
  restoreKey: string;
}

/* --- Overload signatures --- */
export function useColumnSettingActions<ColumnEnum extends string>(
  config: ColumnSettingConfig<ColumnEnum>,
): ReturnType<typeof useColumnSettingActionsImpl>;

export function useColumnSettingActions(
  config: ColumnSettingConfig<MemberFeedColumn>,
): ReturnType<typeof useColumnSettingActionsImpl>;

export function useColumnSettingActions(
  config: ColumnSettingConfig<SurveyColumn>,
): ReturnType<typeof useColumnSettingActionsImpl>;

/* --- Implementation (removed all `any`) --- */
export function useColumnSettingActions<ColumnEnum extends string>(
  config: ColumnSettingConfig<ColumnEnum>,
) {
  return useColumnSettingActionsImpl<ColumnEnum>(config);
}

function useColumnSettingActionsImpl<ColumnEnum extends string>(
  config: ColumnSettingConfig<ColumnEnum>,
) {
  const { enqueueSnackbar } = useSnackbar();
  const { t_toasts, t_errors } = useTranslation();

  const [localCheckedState, setLocalCheckedState] = useState<Map<ColumnEnum, boolean>>(new Map());

  const { data, refetch } = config.useQuery();
  const [mutateFn] = config.useMutation();

  const initializeLocalStateFromServer = useCallback(() => {
    const columns = (data as Record<string, unknown>)?.[config.queryDataPath];
    const checkedMap = new Map<ColumnEnum, boolean>();

    if (Array.isArray(columns)) {
      (columns as Array<{ name: ColumnEnum; isEnabled: boolean }>).forEach((col) => {
        checkedMap.set(col.name, col.isEnabled);
      });
    }

    setLocalCheckedState(checkedMap);
  }, [data, config.queryDataPath]);

  useEffect(() => {
    if (data) {
      initializeLocalStateFromServer();
    }
  }, [data, initializeLocalStateFromServer]);

  const saveSettings = useCallback(
    async (checkedState: Map<ColumnEnum, boolean>) => {
      const enabledColumns = Array.from(checkedState.entries())
        .filter(([, checked]) => checked)
        .map(([col]) => col);

      const variables: { [K in MutationInputName]?: { enabledColumns: ColumnEnum[] } } = {
        [config.mutationInputName]: { enabledColumns },
      };

      try {
        await mutateFn({ variables });
        enqueueSnackbar(t_toasts(config.successKey), {
          variant: 'success',
          preventDuplicate: true,
        });
        refetch();
      } catch {
        enqueueSnackbar(t_errors('failedToSave'), { variant: 'error', preventDuplicate: true });
      }
    },
    [
      config.mutationInputName,
      config.successKey,
      mutateFn,
      enqueueSnackbar,
      t_toasts,
      refetch,
      t_errors,
    ],
  );

  const toggleColumn = useCallback(
    (column: ColumnEnum, checked: boolean) => {
      setLocalCheckedState((prev) => new Map(prev).set(column, checked));
      saveSettings(new Map(localCheckedState).set(column, checked));
    },
    [saveSettings, localCheckedState],
  );

  return {
    localCheckedState,
    toggleColumn,
  };
}
