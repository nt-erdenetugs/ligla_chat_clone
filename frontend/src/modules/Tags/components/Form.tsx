import { useEffect, useMemo } from 'react';

import {
  TextFieldControl,
  FlexForm,
  FormDialog,
  type FormProps,
  SwitchControl,
} from '~/common/components';
import { useErrorHandledAction } from '~/common/hooks';
import { useTranslation } from '~/locales/hooks';
import { TAG_NAME_MAX_CHARACTER_LIMIT, useForm, useTagActions, type Inputs } from '~/modules/Tags';
import { convertEmptyFieldsToNull } from '~/utils';

export const Form = ({ id, onClose }: FormProps) => {
  const { targetTag, isFetchingOne, setTargetTag, createTag, updateTag, isCreating, isUpdating } =
    useTagActions();
  const { t_management, t_errors } = useTranslation();
  const { executeAction } = useErrorHandledAction();

  useEffect(() => {
    if (!id) return;

    setTargetTag(String(id));
  }, [id, setTargetTag]);

  const isEditing = useMemo(() => !!id, [id]);

  const values = useMemo(
    () =>
      isEditing && targetTag
        ? {
            name: targetTag.name,
            isActive: Boolean(targetTag.isActive),
          }
        : undefined,
    [isEditing, targetTag],
  );

  const { control, reset, handleSubmit, formState, watch } = useForm({
    values,
  });

  const isActive = watch('isActive');

  const handleClose = () => {
    onClose();
    reset();
  };

  const onSubmit = async (inputs: Inputs) => {
    if (formState.isDirty) {
      const { isActive, ...payload } = inputs;

      const data = convertEmptyFieldsToNull(payload);

      const action = isEditing
        ? () =>
            updateTag(String(id), {
              ...data,
              isActive: Boolean(isActive),
            })
        : () => createTag(data);

      await executeAction(action, handleClose);
    }
  };

  const errorMessage =
    watch('name').length > TAG_NAME_MAX_CHARACTER_LIMIT
      ? t_errors('maxCharacterLimit', { limit: TAG_NAME_MAX_CHARACTER_LIMIT })
      : null;

  return (
    <FormDialog
      onClose={handleClose}
      title={isEditing ? t_management('tags.editTag') : t_management('tags.createNewTag')}
      subTitle={isEditing ? t_management('subtitle.edit') : t_management('subtitle.create')}
      onConfirm={handleSubmit(onSubmit)}
      isDirty={formState.isDirty}
      isLoading={isCreating || isUpdating || isFetchingOne}
      open
    >
      <FlexForm onSubmit={handleSubmit(onSubmit)}>
        <TextFieldControl
          name='name'
          label={t_management('tags.name')}
          control={control}
          required
          disabled={isEditing && !isActive}
          errorMessage={errorMessage}
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
