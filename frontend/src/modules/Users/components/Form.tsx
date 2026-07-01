import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type AutocompleteRenderGetTagProps,
  Avatar,
  Box,
  Button,
  type ButtonOwnProps,
  Chip,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { useWatch } from 'react-hook-form';

import {
  TextFieldControl,
  FlexForm,
  FormDialog,
  type FormProps,
  AutocompleteControl,
  MultipleAutocompleteControl,
  SwitchControl,
  type OptionProps,
  type OptionValueType,
  UploadProfileImage,
} from '~/common/components';
import {
  adminRoles,
  getRoleLabel,
  USER_DEFAULT_PICTURE_URL,
  DISPLAY_NAME_MAX_CHAR_LIMIT,
  UserRoleTypes,
  UserStatusType,
} from '~/common/constants';
import { useErrorHandledAction, useUploadProfile } from '~/common/hooks';
import { type NumberOrString } from '~/common/types';
import { useAuthContext } from '~/context/AuthContext';
import { useTranslation } from '~/locales/hooks';
import { useAuthActions } from '~/modules/Auth';
import { useTeamQueries } from '~/modules/Teams';
import { StatusChip, useForm, useUserActions, type Inputs } from '~/modules/Users';

const DEFAULT_VALUE = {
  email: '',
  displayName: '',
  senderName: '',
  roleType: '',
  isActive: true,
};

const StatusInfoMap: Record<
  UserStatusType,
  ButtonOwnProps & {
    label: string;
  }
> = {
  [UserStatusType.ACTIVE]: { label: 'deactivate', color: 'error' },
  [UserStatusType.INACTIVE]: { label: 'activate', color: 'success' },
  [UserStatusType.PENDING]: { label: 'reInvite', color: 'warning' },
  [UserStatusType.LOCKED]: { label: 'unlockUser', color: 'success' },
};

export const Form = ({ id, onClose }: FormProps) => {
  const {
    targetUser,
    setTargetUser,
    updatePictureUrl,
    removeTargetUser,
    createUser,
    updateUser,
    toggleUserStatus,
    checkUserExists,
    isCreating,
    isUpdating,
  } = useUserActions();
  const { selectableTeams, isFetchingSelectableTeams: isFetchingTeams } = useTeamQueries();

  const { requestReInvite } = useAuthActions();

  const { isAdminUser, isMe } = useAuthContext();
  const { executeAction } = useErrorHandledAction();
  const {
    pictureUrl,
    isUploading: isUploadingProfile,
    isChanged: isProfileChanged,
    handleDrop,
    upload,
  } = useUploadProfile(targetUser?.pictureUrl, targetUser?.id);

  const [isLoading, setIsLoading] = useState(false);

  const handleClose = () => {
    onClose();
    reset();
    removeTargetUser();
  };

  const isEditing = useMemo(() => !!id, [id]);
  const isUserInactive = useMemo(() => targetUser?.status !== UserStatusType.ACTIVE, [targetUser]);
  const isUserLockedOrPending = useMemo(
    () =>
      targetUser?.status === UserStatusType.LOCKED || targetUser?.status === UserStatusType.PENDING,
    [targetUser],
  );

  const { t, t_errors, t_management, t_toasts } = useTranslation();

  const roleOptions: OptionProps<string>[] = useMemo(() => {
    if (targetUser) {
      const isTargetUserAdmin = adminRoles.includes(targetUser.roleType);
      if (isTargetUserAdmin) {
        return adminRoles.map((role) => [t_management(`roles.${getRoleLabel(role)}`), role]);
      }
    }
    return UserRoleTypes.map((role) => [t_management(`roles.${getRoleLabel(role)}`), role]);
  }, [t_management, targetUser]);

  const defaultTeamId = selectableTeams.find((team) => team.isDefault)?.id;

  const values = useMemo(
    () =>
      isEditing && targetUser
        ? {
            email: targetUser.email,
            displayName: targetUser.displayName,
            senderName: targetUser.senderName || '',
            roleType: targetUser.roleType,
            teamIds: targetUser?.teams ? targetUser.teams.map((team) => team.id) : [],
            isActive: targetUser.status === UserStatusType.ACTIVE,
          }
        : {
            ...DEFAULT_VALUE,
            teamIds: defaultTeamId ? [defaultTeamId] : [],
          },
    [defaultTeamId, isEditing, targetUser],
  );

  const { control, reset, handleSubmit, formState, setValue, watch } = useForm({
    values,
  });

  const selectedTeamIds = watch('teamIds') || [];

  const updateUserProfile = useCallback(async () => {
    if (!pictureUrl) return false;

    const success = await upload();
    if (success) {
      updatePictureUrl(pictureUrl);
      if (formState.isDirty) return true; // Avoid duplicate success toasts

      enqueueSnackbar(t_toasts('user.success.update'), { variant: 'success' });
      return true;
    }

    enqueueSnackbar(t_errors('failedToSave'), { variant: 'error' });
    return false;
  }, [formState.isDirty, pictureUrl, t_errors, t_toasts, updatePictureUrl, upload]);

  const onSubmit = async (data: Inputs) => {
    const isExists = await checkUserExists(data.email);

    if (!isEditing && isExists)
      return control.setError('email', {
        message: t_errors('emailAlreadyExists'),
      });

    const { email, displayName, senderName, roleType, teamIds, isActive } = data;

    const basePayload = {
      email,
      displayName,
      senderName,
      roleType,
    };

    if (isEditing && isProfileChanged) {
      const result = await updateUserProfile();
      if (!result || !formState.isDirty) return;
    }

    const action = isEditing
      ? () =>
          updateUser(String(id), {
            ...basePayload,
            isActive,
          })
      : () =>
          createUser({
            ...basePayload,
            teamIds,
          });

    await executeAction(action, handleClose);
  };

  const handleStatusAction = useCallback(
    async (status: UserStatusType) => {
      if (!targetUser) return;

      setIsLoading(true);
      const _toggleUserStatus = () => executeAction(() => toggleUserStatus(String(id)));

      try {
        const actionsMap = {
          [UserStatusType.LOCKED]: _toggleUserStatus,
          [UserStatusType.PENDING]: () => requestReInvite({ email: targetUser.email }),
          [UserStatusType.ACTIVE]: _toggleUserStatus,
          [UserStatusType.INACTIVE]: _toggleUserStatus,
        };

        await actionsMap[status]?.();
      } finally {
        setIsLoading(false);
      }
    },
    [id, requestReInvite, targetUser, toggleUserStatus, executeAction],
  );

  const getOptionDisabled = ({ value }: OptionValueType<NumberOrString>) => {
    const isOptionDefaultTeam = value === defaultTeamId;
    const isDefaultTeamRequired = !selectedTeamIds.some((id) => id !== defaultTeamId);
    return isOptionDefaultTeam && isDefaultTeamRequired;
  };

  const handleTeamIdsChange = (newTeamIds: string[]) => {
    const nonDefaultTeams = newTeamIds.filter((id) => id !== defaultTeamId);
    setValue('teamIds', nonDefaultTeams.length > 0 ? newTeamIds : [defaultTeamId ?? '']);
  };

  const renderTagChip = (
    option: OptionValueType<NumberOrString>,
    index: number,
    getTagProps: AutocompleteRenderGetTagProps,
  ) => {
    const { key, ...tagProps } = getTagProps({ index });
    return (
      <Chip key={key} label={option.label} {...tagProps} disabled={getOptionDisabled(option)} />
    );
  };

  const statusActionButton = useCallback(() => {
    if (!targetUser?.status) return null;

    const { status } = targetUser;

    const { label, color } = StatusInfoMap[status as UserStatusType];

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'end', mt: 1 }}>
        <Button
          variant='contained'
          color={color}
          sx={{
            width: 160,
            height: 40,
            fontSize: '12px',
            color: '#fff',
            borderRadius: '0.75rem',
          }}
          disabled={isMe(id) || isLoading}
          onClick={() => handleStatusAction(status as UserStatusType)}
        >
          {t_management(`users.${label}`)}
        </Button>
      </Box>
    );
  }, [handleStatusAction, id, isMe, isLoading, targetUser, t_management]);

  useEffect(() => {
    if (!id) return;

    setTargetUser(String(id));
  }, [id, setTargetUser]);

  const isActive = useWatch({
    control,
    name: 'isActive',
    defaultValue: targetUser?.status !== UserStatusType.ACTIVE,
  });

  const isDisabled = isUserLockedOrPending || isMe(id);

  const maxCharError = (field: string) =>
    field.length > DISPLAY_NAME_MAX_CHAR_LIMIT
      ? t_errors('maxCharacterLimit', { limit: DISPLAY_NAME_MAX_CHAR_LIMIT })
      : null;

  return (
    <FormDialog
      onClose={handleClose}
      title={isEditing ? t_management('users.editUser') : t_management('users.createNewUser')}
      subTitle={isEditing ? t_management('subtitle.edit') : t_management('subtitle.create')}
      onConfirm={handleSubmit(onSubmit)}
      isDirty={formState.isDirty || isProfileChanged}
      isLoading={isCreating || isUpdating || isUploadingProfile}
      open
    >
      <FlexForm onSubmit={handleSubmit(onSubmit)}>
        {isEditing &&
          (isAdminUser ? (
            <UploadProfileImage
              fileUrl={pictureUrl}
              isLoading={isUploadingProfile}
              onDrop={handleDrop}
              userStatus={isUserInactive ? (targetUser?.status as UserStatusType) : undefined}
            >
              {isAdminUser && statusActionButton()}
            </UploadProfileImage>
          ) : (
            <Box sx={{ position: 'relative', width: 100, marginX: '3rem' }}>
              <Avatar
                sx={{ width: 100, height: 100 }}
                src={targetUser?.pictureUrl || USER_DEFAULT_PICTURE_URL}
              />
              {targetUser?.status && (
                <Box
                  sx={{
                    position: 'absolute',
                    right: '-2rem',
                    background: '#ffffff',
                    borderRadius: '1rem',
                    bottom: -10,
                    p: '2px',
                  }}
                >
                  {isUserInactive && <StatusChip status={targetUser.status as UserStatusType} />}
                </Box>
              )}
            </Box>
          ))}

        <TextFieldControl
          name='email'
          label={t_management('users.email')}
          control={control}
          type='email'
          {...(isEditing ? { disabled: true } : { required: true })}
        />
        <TextFieldControl
          name='displayName'
          label={t_management('users.name')}
          control={control}
          required
          disabled={isEditing && !isActive}
          errorMessage={maxCharError(watch('displayName') ?? '')}
        />
        <TextFieldControl
          name='senderName'
          label={t_management('users.senderName')}
          labelTooltip={t('senderNameHint')}
          control={control}
          disabled={isEditing && !isActive}
          errorMessage={maxCharError(watch('senderName') ?? '')}
        />

        <AutocompleteControl
          control={control}
          name='roleType'
          label={t_management('users.role')}
          placeholder={t_management('users.selectRoles')}
          options={roleOptions}
          disableClearable
          disabled={!isAdminUser || (!isActive && isEditing) || (isEditing && !targetUser)}
          required
        />

        <MultipleAutocompleteControl
          control={control}
          name='teamIds'
          label={t_management('teams.title')}
          placeholder={t_management('teams.selectTeams')}
          noOptionsText={t_management('teams.noTargetTeams')}
          options={selectableTeams.map((team) => [team.name, team.id])}
          loading={isFetchingTeams}
          checkBox
          disabled={isEditing}
          tooltipTitle={t_management('teams.selectTeamsTooltip')}
          {...(!isEditing && {
            title: t_management('users.assignAtLeastOneTeam'),
            getOptionDisabled,
            onChange: handleTeamIdsChange,
            renderTags: (tagValues, getTagProps) =>
              tagValues.map((option, index) => renderTagChip(option, index, getTagProps)),
          })}
        />

        {isEditing && (
          <SwitchControl
            name='isActive'
            label={t_management('status')}
            startText={t_management('active')}
            endText={t_management('inactive')}
            control={control}
            disabled={isDisabled}
          />
        )}
      </FlexForm>
    </FormDialog>
  );
};
