import { useEffect, useMemo } from 'react';

import { Box } from '@mui/material';
import { type FieldPathByValue } from 'react-hook-form';

import {
  TextFieldControl,
  FlexForm,
  FormDialog,
  type FormProps,
  MultipleAutocompleteControl,
  SwitchControl,
  Label,
  SkeletonSuspense,
} from '~/common/components';
import {
  useErrorHandledAction,
  QUERY_RESPONSE_KEYS,
  useInfiniteQuery,
  useMergedAutocompleteOptions,
} from '~/common/hooks';
import { useAuthContext } from '~/context/AuthContext';
import {
  AllSelectableOperatorsDocument,
  type AllSelectableOperatorsQuery,
  ManagersDocument,
  type ManagersQuery,
  type Store,
  type User,
  type StoresInfiniteScrollQuery,
  StoresInfiniteScrollDocument,
  UserRoleType,
} from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import {
  TEAM_NAME_MAX_CHARACTER_LIMIT,
  useForm,
  useTeamActions,
  type Inputs,
} from '~/modules/Teams';

type TeamSettingKeys = keyof Inputs['teamSetting'];

type OptionType = {
  category: TeamSettingKeys;
  options: FieldPathByValue<Inputs['teamSetting'][TeamSettingKeys], boolean>[];
};

const teamSettingOptions: OptionType[] = [
  {
    category: 'teamChatSetting',
    options: ['viewAllChatsEnabled'],
  },
];

export const Form = ({ id, onClose, organizationId }: FormProps) => {
  const { isAdminUser, isHypervisorUser, isManagerUser } = useAuthContext();

  const {
    targetTeam,
    isFetchingOne,
    setTargetTeam,
    removeTargetTeam,
    createTeam,
    updateTeam,
    isCreating,
    isUpdating,
  } = useTeamActions(isHypervisorUser ? organizationId : undefined);

  const managersKey = QUERY_RESPONSE_KEYS.managers;
  const operatorsKey = QUERY_RESPONSE_KEYS.allSelectableOperators;
  const storesKey = QUERY_RESPONSE_KEYS.storesCursor;

  const {
    data: managers,
    loading: isFetchingAllManagers,
    loadMore: fetchMoreManagers,
    fetchedAll: fetchedAllManagers,
  } = useInfiniteQuery<typeof managersKey, ManagersQuery>(ManagersDocument, managersKey, {
    extraParams: { organizationId },
    pickAll: true,
  });

  const {
    data: allSelectableOperators,
    loading: isFetchingAllSelectableOperators,
    loadMore: fetchMoreOperators,
    fetchedAll: fetchedAllOperators,
  } = useInfiniteQuery<typeof operatorsKey, AllSelectableOperatorsQuery>(
    AllSelectableOperatorsDocument,
    operatorsKey,
    { extraParams: { organizationId }, pickAll: true },
  );

  const {
    data: stores,
    loading: isFetchingStores,
    loadMore: fetchMoreStores,
    fetchedAll: fetchedAllStores,
  } = useInfiniteQuery<typeof storesKey, StoresInfiniteScrollQuery>(
    StoresInfiniteScrollDocument,
    storesKey,
    {
      extraParams: { organizationId },
      pickAll: true,
    },
  );

  const isEditing = useMemo(() => !!id, [id]);
  const { executeAction } = useErrorHandledAction();
  const { t_management, t_errors } = useTranslation();

  const isAdminOrHypervisor = useMemo(
    () => isAdminUser || isHypervisorUser,
    [isAdminUser, isHypervisorUser],
  );

  const handleClose = () => {
    onClose();
    removeTargetTeam();
  };

  const onSubmit = async (inputs: Inputs) => {
    if (!formState.isDirty) return handleClose();

    const removedManagerIds = new Set(
      targetTeam?.managers.map((m) => m.id).filter((id) => !inputs.managerIds.includes(id)),
    );

    const finalData = {
      ...inputs,
      operatorIds: inputs.operatorIds.filter((id) => !removedManagerIds.has(id)),
    };

    const action = isEditing ? () => updateTeam(id as string, finalData) : () => createTeam(inputs);

    await executeAction(action, handleClose);
  };

  const values = useMemo(
    () =>
      isEditing && targetTeam
        ? {
            name: targetTeam.name,
            managerIds: targetTeam.managers.map((u) => u.id),
            operatorIds: targetTeam.operators.map((u) => u.id),
            storeIds: targetTeam.stores.map((s) => s.id),
            isActive: targetTeam.isActive,
            teamSetting: {
              teamChatSetting: targetTeam.teamSetting?.teamChatSetting ?? {
                viewAllChatsEnabled: true,
              },
            },
          }
        : undefined,
    [isEditing, targetTeam],
  );

  const { control, handleSubmit, formState, watch } = useForm({
    values,
  });
  const isActive = watch('isActive');

  // Grab current selection from the form:
  const managerIdsValue = watch('managerIds') || [];
  const operatorIdsValue = watch('operatorIds') || [];
  const storeIdsValue = watch('storeIds') || [];

  const selectedManagers =
    isEditing && targetTeam
      ? targetTeam.managers.filter((m) => managerIdsValue.includes(m.id))
      : [];
  const selectedOperators =
    isEditing && targetTeam
      ? targetTeam.operators.filter(
          (o) => operatorIdsValue.includes(o.id) && o.roleType === UserRoleType.Operator,
        )
      : [];
  const selectedStores =
    isEditing && targetTeam ? targetTeam.stores.filter((s) => storeIdsValue.includes(s.id)) : [];

  const mergedManagerOptions = useMergedAutocompleteOptions(
    managers,
    selectedManagers as User[],
    (user) => user.id,
    (user) => user.email,
  );

  const mergedOperatorOptions = useMergedAutocompleteOptions(
    allSelectableOperators,
    selectedOperators as User[],
    (user) => user.id,
    (user) => user.email,
  );

  const mergedStoreOptions = useMergedAutocompleteOptions<Store>(
    stores,
    selectedStores as Store[],
    (store) => store.id,
    (store) => store.name,
  );

  useEffect(() => {
    if (!id) return;
    setTargetTeam(String(id), { organizationId });
  }, [id, organizationId, setTargetTeam]);

  const errorMessage =
    watch('name').length > TEAM_NAME_MAX_CHARACTER_LIMIT
      ? t_errors('maxCharacterLimit', { limit: TEAM_NAME_MAX_CHARACTER_LIMIT })
      : null;

  return (
    <FormDialog
      onClose={handleClose}
      title={isEditing ? t_management('teams.editTeam') : t_management('teams.createTeam')}
      subTitle={isEditing ? t_management('subtitle.edit') : t_management('subtitle.create')}
      onConfirm={handleSubmit(onSubmit)}
      isDirty={formState.isDirty}
      isLoading={isCreating || isUpdating || isFetchingOne}
      open
    >
      <FlexForm
        onSubmit={handleSubmit(onSubmit)}
        sx={{
          py: 2,
        }}
      >
        <TextFieldControl
          name='name'
          label={t_management('teams.name')}
          control={control}
          required
          disabled={false}
          title={t_management('teams.helper.cantChange')}
          errorMessage={errorMessage}
        />

        <MultipleAutocompleteControl
          control={control}
          name='managerIds'
          label={t_management('teams.managers')}
          placeholder={t_management('teams.selectManagers')}
          noOptionsText={t_management('teams.noManagersText')}
          options={mergedManagerOptions}
          loading={isFetchingAllManagers}
          disabled={!isAdminOrHypervisor || !isActive}
          title={
            !isAdminOrHypervisor
              ? t_management('teams.helper.noPermissionToSelectManagers')
              : undefined
          }
          infiniteQueryResponse={{
            fetchMore: fetchMoreManagers,
            fetchedAll: fetchedAllManagers,
            loading: isFetchingAllManagers,
          }}
          checkBox
        />

        <MultipleAutocompleteControl
          control={control}
          name='operatorIds'
          label={t_management('teams.operators')}
          placeholder={t_management('teams.selectOperators')}
          noOptionsText={t_management('teams.noOperatorsText')}
          options={mergedOperatorOptions}
          loading={isFetchingAllSelectableOperators}
          disabled={!isActive}
          infiniteQueryResponse={{
            fetchMore: fetchMoreOperators,
            fetchedAll: fetchedAllOperators,
            loading: isFetchingAllSelectableOperators,
          }}
          checkBox
        />

        <MultipleAutocompleteControl
          control={control}
          name='storeIds'
          label={t_management('teams.stores')}
          placeholder={t_management('teams.selectStores')}
          noOptionsText={t_management('teams.noStoresText')}
          options={mergedStoreOptions}
          loading={isFetchingStores}
          disabled={!isAdminOrHypervisor || !isActive}
          title={
            !isAdminOrHypervisor
              ? t_management('teams.helper.noPermissionToSelectStores')
              : undefined
          }
          infiniteQueryResponse={{
            fetchMore: fetchMoreStores,
            fetchedAll: fetchedAllStores,
            loading: isFetchingStores,
          }}
          checkBox
        />

        {isEditing && isAdminOrHypervisor && !targetTeam?.isDefault && (
          <SwitchControl
            name='isActive'
            label={t_management('status')}
            startText={t_management('active')}
            endText={t_management('inactive')}
            control={control}
            disabled={!isAdminOrHypervisor}
          />
        )}
        {(isAdminOrHypervisor || isManagerUser) &&
          teamSettingOptions.map(({ category, options }) => (
            <Box key={category}>
              <Label text={t_management(`teams.teamSetting.${category}.title`)} />
              {options.map((option) => (
                <SkeletonSuspense
                  isLoading={isFetchingOne}
                  key={option}
                  skeletonProps={{ width: '50%' }}
                >
                  <SwitchControl
                    name={`teamSetting.${category}.${option}`}
                    startText={t_management(
                      `teams.teamSetting.${category}.${option}.options.start`,
                    )}
                    endText={t_management(`teams.teamSetting.${category}.${option}.options.end`)}
                    control={control}
                    disabled={!isActive}
                  />
                </SkeletonSuspense>
              ))}
            </Box>
          ))}
      </FlexForm>
    </FormDialog>
  );
};
