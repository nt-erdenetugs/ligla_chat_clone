import { useEffect, useMemo } from 'react';

import { useWatch } from 'react-hook-form';

import {
  TextFieldControl,
  FlexForm,
  FormDialog,
  SwitchControl,
  type FormProps,
} from '~/common/components';
import {
  adminRoles,
  ORGANIZATION_DEFAULT_MAX_OPERATOR,
  ORGANIZATION_MAX_OPERATOR,
} from '~/common/constants';
import { useErrorHandledAction } from '~/common/hooks';
import { useTranslation } from '~/locales/hooks';
import {
  useForm,
  type Inputs,
  useOrganizationActions,
  EmailDialogInput,
} from '~/modules/Organizations';
import { type IUser } from '~/modules/Users';
import { convertEmptyFieldsToNull, discardNull } from '~/utils';

const getAdminEmails = (users: IUser[]) =>
  users.filter((user) => adminRoles.includes(user.roleType)).map((user) => user.email);

export const Form = ({ id, onClose }: FormProps) => {
  const {
    organizations,
    targetOrganization,
    isFetchingOne,
    setTargetOrganization,
    removeTargetOrganization,
    createOrganization,
    updateOrganization,
    isCreating,
    isUpdating,
  } = useOrganizationActions();
  const { executeAction } = useErrorHandledAction();

  const { t_management } = useTranslation();

  const handleClose = () => {
    onClose();
    reset();
    removeTargetOrganization();
  };

  const isEditing = useMemo(() => !!id, [id]);

  const onSubmit = async (inputs: Inputs) => {
    const { isActive, ...payload } = inputs;
    const data = convertEmptyFieldsToNull(payload);

    const action = isEditing
      ? () => updateOrganization({ ...data, isActive: Boolean(isActive) })
      : () => createOrganization(data);

    await executeAction(action, handleClose);
  };

  const values = useMemo(
    () =>
      isEditing && targetOrganization
        ? {
            name: targetOrganization.name,
            displayName: targetOrganization.displayName,
            description: discardNull(targetOrganization.description),
            maxOperator: targetOrganization.maxOperator,
            apiKey: targetOrganization.apiKey,
            loginLiffId: targetOrganization.loginLiffId ?? '',
            fileUploadLiffId: targetOrganization.fileUploadLiffId ?? '',
            isActive: Boolean(targetOrganization.isActive),
            emails: targetOrganization.users ? getAdminEmails(targetOrganization.users) : [],
          }
        : undefined,
    [isEditing, targetOrganization],
  );

  // TODO: Stop using organizations after updating validation for registeredNames [phase 2][task 94140238]
  const registeredNames = useMemo(() => organizations.map((org) => org.name), [organizations]);

  const { control, reset, handleSubmit, formState, setValue } = useForm(
    {
      values,
    },
    isEditing ? [] : registeredNames,
  );

  useEffect(() => {
    if (!id) return;

    setTargetOrganization(String(id));
  }, [id, setTargetOrganization]);

  useEffect(() => {
    if (isEditing && targetOrganization) {
      if (targetOrganization.users) {
        const currentEmails = getAdminEmails(targetOrganization.users);
        setValue('emails', currentEmails);
      }
    }
  }, [targetOrganization, setValue, isEditing]);

  const isActive = useWatch({
    control,
    name: 'isActive',
    defaultValue: true,
  });

  const { isDirty } = formState;

  return (
    <FormDialog
      onClose={handleClose}
      title={
        isEditing
          ? t_management('organizations.editOrganization')
          : t_management('organizations.createNewOrganization')
      }
      subTitle={isEditing ? t_management('subtitle.edit') : t_management('subtitle.create')}
      onConfirm={handleSubmit(onSubmit)}
      isDirty={isDirty}
      open={!isFetchingOne}
      isLoading={isCreating || isUpdating}
    >
      <FlexForm onSubmit={handleSubmit(onSubmit)}>
        <TextFieldControl
          name='name'
          label={t_management('organizations.companyCodeName')}
          control={control}
          disabled={isEditing}
          required
        />
        <TextFieldControl
          name='loginLiffId'
          label={t_management('organizations.loginLiffId')}
          control={control}
          disabled={!isActive}
          required
        />
        <TextFieldControl
          name='fileUploadLiffId'
          label={t_management('organizations.fileUploadLiffId')}
          control={control}
          disabled={!isActive}
          required
        />
        <TextFieldControl
          name='apiKey'
          label={t_management('organizations.apiKey')}
          control={control}
          slotProps={{ htmlInput: { maxLength: 64 } }}
          required
          disabled={isEditing && !isActive}
        />
        <TextFieldControl
          name='displayName'
          label={t_management('organizations.companyName')}
          control={control}
          required
          disabled={isEditing && !isActive}
        />
        <EmailDialogInput
          name='emails'
          label={t_management('organizations.companyAdministratorEmail')}
          control={control}
          disabled={isEditing && !isActive}
        />
        <TextFieldControl
          name='maxOperator'
          label={`${t_management('organizations.maxOperators')} (${t_management('organizations.defaultIs')}: ${ORGANIZATION_DEFAULT_MAX_OPERATOR}, ${t_management('organizations.max')}: ${ORGANIZATION_MAX_OPERATOR.toLocaleString()})`}
          slotProps={{ htmlInput: { min: 1, type: 'number' } }}
          control={control}
          required
          disabled={isEditing && !isActive}
        />
        <TextFieldControl
          name='description'
          label={t_management('organizations.notes')}
          control={control}
          multiline
          rows={2}
          disabled={isEditing && !isActive}
        />
        {isEditing && (
          <SwitchControl
            name='isActive'
            label={t_management('status')}
            startText={t_management('active')}
            endText={t_management('inactive')}
            control={control}
          />
        )}
      </FlexForm>
    </FormDialog>
  );
};
