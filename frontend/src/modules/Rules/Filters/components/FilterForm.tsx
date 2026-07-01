import { useEffect, useMemo, useState } from 'react';

import { Save } from '@mui/icons-material';
import CloseIcon from '@mui/icons-material/Close';
import { Button, Divider, IconButton } from '@mui/material';
import SimpleBar from 'simplebar-react';

import {
  FlexForm,
  type FormProps,
  TextFieldControl,
  ConfirmationDialog,
  FullScreenDialog,
  SwitchControl,
  Suspense,
  TitleCaption,
  SelectControl,
} from '~/common/components';
import { useErrorHandledAction } from '~/common/hooks';
import { FilterTargetType, type ChatAssignFilter } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';

import {
  ConditionsBuilder,
  FILTER_NAME_MAX_CHARACTER_LIMIT,
  FILTER_NOTE_MAX_CHARACTER_LIMIT,
  type Inputs,
  useFiltersActions,
  useForm,
} from '..';

export type FilterFormProps = FormProps & {
  onSuccess?: (data?: ChatAssignFilter) => void;
};

export const FilterForm = ({ id, onClose, onSuccess }: FilterFormProps) => {
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  const {
    targetFilter,
    isFetchingOne,
    setTargetFilter,
    removeTargetFilter,
    createFilter,
    updateFilter,
    isCreating,
    isUpdating,
  } = useFiltersActions();
  const { t, t_management, t_errors } = useTranslation();
  const { executeAction } = useErrorHandledAction();

  const isEditing = useMemo(() => !!id, [id]);

  const values = useMemo(
    () =>
      isEditing && targetFilter
        ? {
            name: targetFilter.name,
            targetTable: targetFilter.targetTable,
            note: targetFilter.note ?? '',
            isActive: targetFilter.isActive,
            rootConditionGroup: targetFilter.rootConditionGroup,
          }
        : undefined,
    [isEditing, targetFilter],
  );

  const { control, handleSubmit, formState, watch } = useForm({
    values,
  });

  const { isDirty } = formState;
  const isLoading = isCreating || isUpdating;
  const isSaveDisabled = !isDirty || isLoading;

  useEffect(() => {
    if (!id) return;

    setTargetFilter(String(id));
  }, [id, setTargetFilter]);

  const onSubmit = async (inputs: Inputs) => {
    const { isActive, ...data } = inputs;
    const action =
      isEditing && targetFilter
        ? () => updateFilter({ ...data, isActive })
        : () => createFilter(data, (filterResponse) => onSuccess?.(filterResponse));

    await executeAction(action, onClose);
  };

  const _onClose = () => {
    setShowConfirm(false);
    onClose();
    removeTargetFilter();
  };

  const handleClose = () => {
    if (isDirty) return setShowConfirm(true);

    _onClose();
  };

  const subTitle = isEditing ? t('actions.edit') : t('actions.new');

  const nameErrorMessage =
    watch('name').length > FILTER_NAME_MAX_CHARACTER_LIMIT
      ? t_errors('maxCharacterLimit', { limit: FILTER_NAME_MAX_CHARACTER_LIMIT })
      : null;

  const noteErrorMessage =
    (watch('note') || '').length > FILTER_NOTE_MAX_CHARACTER_LIMIT
      ? t_errors('maxCharacterLimit', { limit: FILTER_NOTE_MAX_CHARACTER_LIMIT })
      : null;

  return (
    <>
      <FullScreenDialog
        open
        onClose={handleClose}
        showCloseIcon={false}
        titleIcon={
          <IconButton edge='start' color='inherit' onClick={handleClose} aria-label='close'>
            <CloseIcon />
          </IconButton>
        }
        title={
          <TitleCaption
            primary={t_management('chatAssignFilters.formTitle')}
            secondary={subTitle}
            subTitleProps={{ color: 'white' }}
            width='100%'
          >
            <Button
              variant='outlined'
              startIcon={<Save />}
              onClick={handleSubmit(onSubmit)}
              disabled={isSaveDisabled}
              color='inherit'
              sx={{
                '&.Mui-disabled': {
                  color: 'inherit',
                  borderColor: 'inherit',
                  opacity: 0.7,
                },
              }}
            >
              {t('actions.save')}
            </Button>
          </TitleCaption>
        }
      >
        <SimpleBar forceVisible='y' style={{ maxHeight: '100%' }}>
          <FlexForm
            sx={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              p: 2,
            }}
          >
            <Suspense isLoading={isFetchingOne}>
              <TextFieldControl
                control={control}
                name='name'
                label={t_management('chatAssignFilters.name')}
                errorMessage={nameErrorMessage}
                size='small'
                sx={{ maxWidth: 400 }}
                required
              />

              <SelectControl
                control={control}
                name='targetTable'
                label={t_management('chatAssignFilters.targetTable')}
                size='small'
                sx={{ maxWidth: 400 }}
                options={Object.values(FilterTargetType).map((option) => ({
                  label: t_management(`chatAssignFilters.${option.toLowerCase()}`),
                  value: option,
                }))}
                required
              />

              <Divider sx={{ borderColor: 'secondary.light' }} />

              <ConditionsBuilder control={control} />

              <Divider sx={{ borderColor: 'secondary.light' }} />

              <TextFieldControl
                name='note'
                label={t_management('note')}
                errorMessage={noteErrorMessage}
                control={control}
                minRows={2}
                multiline
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
            </Suspense>
          </FlexForm>
        </SimpleBar>
      </FullScreenDialog>
      <ConfirmationDialog
        open={showConfirm}
        onConfirm={_onClose}
        isLoading={isLoading}
        onClose={() => setShowConfirm(false)}
        contentText={t('info.sureToCancelEdit')}
        confirmationText={t('actions.ok')}
      />
    </>
  );
};
