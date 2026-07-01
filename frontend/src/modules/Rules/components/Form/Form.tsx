import { useEffect, useMemo, useState } from 'react';

import { DndContext, MouseSensor, pointerWithin, useSensor } from '@dnd-kit/core';
import { Edit, Save } from '@mui/icons-material';
import { Button, IconButton } from '@mui/material';
import { useSearchParams } from 'react-router';
import { CloseIcon } from 'yet-another-react-lightbox';

import {
  ConfirmationDialog,
  type FormProps,
  FullScreenDialog,
  TitleCaption,
} from '~/common/components';
import { ACTION_PARAM_KEY, ACTIONS_TYPE } from '~/common/constants';
import { useErrorHandledAction } from '~/common/hooks';
import { useTranslation } from '~/locales/hooks';
import { type Inputs, RuleForm, useForm, useRulesActions } from '~/modules/Rules';

export type RuleFormProps = FormProps & { readOnly?: boolean };

export const Form = ({ id, readOnly = false, onClose }: RuleFormProps) => {
  const { t, t_management } = useTranslation();
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  const { executeAction } = useErrorHandledAction();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    targetRule,
    isFetchingOne,
    setTargetRule,
    createRule,
    updateRule,
    isCreating,
    isUpdating,
    removeTargetRule,
  } = useRulesActions();

  const isEditing = useMemo(() => !!id && !readOnly, [id, readOnly]);

  const values: Optional<Inputs> = useMemo(
    () =>
      (readOnly || isEditing) && targetRule
        ? {
            name: targetRule.name,
            note: targetRule.note ?? '',
            isActive: targetRule.isActive,
            targetTeamIds: targetRule.targetTeamIds,
            rootFilterGroup: targetRule.rootFilterGroup,
          }
        : undefined,
    [isEditing, readOnly, targetRule],
  );

  useEffect(() => {
    if (!id) return;

    setTargetRule(String(id));
  }, [id, setTargetRule]);

  const handleSave = async (inputs: Inputs) => {
    const action = isEditing && targetRule ? () => updateRule(inputs) : () => createRule(inputs);

    await executeAction(action, onClose);
  };

  const handleEdit = () => {
    searchParams.set(ACTION_PARAM_KEY, ACTIONS_TYPE.EDIT);
    setSearchParams(searchParams);
  };

  const form = useForm({
    values,
  });

  const { handleSubmit, formState, reset } = form;

  const isLoading = isFetchingOne || isCreating || isUpdating;
  const { isDirty } = formState;
  const isSaveDisabled = !isDirty || isLoading;

  const _onClose = () => {
    setShowConfirm(false);
    reset();
    removeTargetRule();
    onClose();
  };

  const handleClose = () => {
    if (isDirty) return setShowConfirm(true);

    _onClose();
  };

  const subTitle = isEditing
    ? t('actions.edit')
    : readOnly
      ? t_management('subtitle.details')
      : t('actions.new');

  const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance: 3 } });

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
            primary={t_management('chatAssignRules.formTitle')}
            secondary={subTitle}
            subTitleProps={{ color: 'white' }}
            width='100%'
          >
            {readOnly ? (
              <Button variant='outlined' startIcon={<Edit />} onClick={handleEdit} color='inherit'>
                {t('actions.edit')}
              </Button>
            ) : (
              <Button
                variant='outlined'
                startIcon={<Save />}
                onClick={handleSubmit(handleSave)}
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
            )}
          </TitleCaption>
        }
      >
        <DndContext sensors={[mouseSensor]} collisionDetection={pointerWithin}>
          <RuleForm form={form} isEditing={isEditing} />
        </DndContext>
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
