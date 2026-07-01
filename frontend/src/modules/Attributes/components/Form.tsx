import { useEffect, useMemo, useState, useRef, useCallback } from 'react';

import Add from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import {
  Autocomplete,
  Box,
  TextField,
  Typography,
  IconButton,
  Paper,
  Button,
  FormControlLabel,
  Checkbox,
  Tooltip,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { Controller, type SubmitHandler } from 'react-hook-form';

import {
  TextFieldControl,
  FlexForm,
  FormDialog,
  SwitchControl,
  type FormProps,
} from '~/common/components';
import { ATTRIBUTE_OPTIONS, type AttributeOption } from '~/common/constants';
import { useErrorHandledAction } from '~/common/hooks';
import { useTranslation } from '~/locales/hooks';
import {
  ATTRIBUTE_NAME_MAX_CHARACTER_LIMIT,
  useForm,
  useAttributesActions,
  type Inputs,
} from '~/modules/Attributes';
import { convertEmptyFieldsToNull } from '~/utils';
export const Form = ({ id, onClose }: FormProps) => {
  const {
    targetAttribute,
    attributes,
    isFetchingOne,
    setTargetAttribute,
    removeTargetAttribute,
    createAttribute,
    updateAttribute,
    isCreating,
    isUpdating,
  } = useAttributesActions();
  const { executeAction } = useErrorHandledAction();

  const { t_management, t_errors } = useTranslation();
  const [isSubmitAttempted, setIsSubmitAttempted] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;

    setTargetAttribute(String(id));
  }, [id, setTargetAttribute]);

  const handleClose = () => {
    onClose();
    reset();
    removeTargetAttribute();
  };

  const isEditing = useMemo(() => !!id, [id]);

  const onSubmit = async (inputs: Inputs) => {
    const { isActive, ...payload } = inputs;

    const data = convertEmptyFieldsToNull(payload);
    data.isEncryptionEnabled = Boolean(inputs.isEncryptionEnabled);

    const action = isEditing
      ? () =>
          updateAttribute({
            ...data,
            isActive: Boolean(isActive),
          })
      : () => createAttribute(data);

    await executeAction(action, handleClose);
  };

  const values = useMemo(
    () =>
      isEditing && targetAttribute
        ? {
            name: targetAttribute.name,
            type: targetAttribute.type,
            isActive: Boolean(targetAttribute.isActive),
            selectOptions: Array.isArray(targetAttribute.selectOption)
              ? targetAttribute.selectOption
              : [],
            isEncryptionEnabled: Boolean(targetAttribute.isEncryptionEnabled),
          }
        : undefined,
    [isEditing, targetAttribute],
  );

  const registeredNames = attributes.map((attribute) => attribute.name);
  const { control, reset, handleSubmit, formState, watch, setValue, clearErrors, getValues } =
    useForm({ values }, isEditing ? [] : registeredNames);

  const submitForm: SubmitHandler<Inputs> = async (inputs) => {
    setIsSubmitAttempted(true);
    await onSubmit(inputs);
    setIsSubmitAttempted(false);
  };

  const handleInvalid = () => setIsSubmitAttempted(true);
  const submit = handleSubmit(submitForm as any, handleInvalid);
  const updateSelectOption = (index: number, patch: Partial<AttributeOption>) => {
    const currentSelectOptions: Inputs['selectOptions'] = getValues('selectOptions') ?? [];
    const updatedOptions = currentSelectOptions.map((currentSelectOption, i) =>
      i === index ? { ...currentSelectOption, ...patch } : currentSelectOption,
    );

    setValue('selectOptions', updatedOptions as Inputs['selectOptions'], { shouldDirty: true });
    if (isSubmitAttempted && patch.value && String(patch.value).trim().length > 0) {
      clearErrors?.(`selectOptions.${index}.value`);
    }
  };

  const removeSelectOption = (index: number) => {
    const currentSelectOptions: Inputs['selectOptions'] = getValues('selectOptions') ?? [];
    const updatedSelectOptions = currentSelectOptions.filter((_, i) => i !== index);
    setValue('selectOptions', updatedSelectOptions as Inputs['selectOptions'], {
      shouldDirty: true,
    });
  };

  const addSelectOption = () => {
    const currentSelectOptions: Inputs['selectOptions'] = getValues('selectOptions') ?? [];
    const lastSelectOptionIndex = currentSelectOptions.length - 1;
    if (lastSelectOptionIndex >= 0) {
      const last = currentSelectOptions[lastSelectOptionIndex];
      if (!last?.value || String(last.value).trim().length === 0) {
        enqueueSnackbar(t_errors('enterValue'), { variant: 'error' });
        setFocusIndex(lastSelectOptionIndex);
        return;
      }
    }

    const updatedSelectOptions = [...currentSelectOptions, { value: '', label: '' }];
    setValue('selectOptions', updatedSelectOptions as Inputs['selectOptions'], {
      shouldDirty: true,
    });
    setFocusIndex(currentSelectOptions.length);
  };

  const focusInput = useCallback((index: number) => {
    if (index == null || index < 0) return;
    let attempts = 0;

    const tryFocus = () => {
      const element = inputRefs.current[index];

      if (element) {
        element.focus();
        element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      } else if (attempts < 6) {
        attempts += 1;
        requestAnimationFrame(tryFocus);
      }
    };

    tryFocus();
  }, []);

  useEffect(() => {
    if (focusIndex === null) return;
    focusInput(focusIndex);
    setFocusIndex(null);
  }, [focusIndex, focusInput]);

  useEffect(() => {
    if (isEditing && targetAttribute) {
      const normalized = Array.isArray(targetAttribute.selectOption)
        ? targetAttribute.selectOption.map((option) => ({
            id: (option as AttributeOption & { id?: string })?.id,
            label: option.label ?? option.value,
            value: option.value,
          }))
        : [];
      setValue('selectOptions', normalized.length > 0 ? normalized : [], { shouldDirty: false });
      if (normalized.length > 0) {
        setFocusIndex(normalized.length - 1);
      }
    } else {
      setValue('selectOptions', [], { shouldDirty: false });
    }
  }, [isEditing, targetAttribute, setValue]);

  useEffect(() => {
    if (!values) {
      reset();
      setValue('selectOptions', [], { shouldDirty: false });
      return;
    }

    reset({
      ...values,
      selectOptions:
        Array.isArray(values.selectOptions) && values.selectOptions.length > 0
          ? values.selectOptions
          : [],
    });
  }, [values, reset, setValue]);
  const isActive = watch('isActive');
  const typeValue = watch('type');
  const errorNameMessage =
    watch('name').length > ATTRIBUTE_NAME_MAX_CHARACTER_LIMIT
      ? t_errors('maxCharacterLimit', { limit: ATTRIBUTE_NAME_MAX_CHARACTER_LIMIT })
      : null;

  const { isDirty } = formState;
  return (
    <FormDialog
      onClose={handleClose}
      title={
        isEditing
          ? t_management('attributes.editAttribute')
          : t_management('attributes.createAttribute')
      }
      subTitle={isEditing ? t_management('subtitle.edit') : t_management('subtitle.create')}
      onConfirm={submit}
      isDirty={isDirty}
      isLoading={isCreating || isUpdating || isFetchingOne}
      open
    >
      <FlexForm onSubmit={submit} sx={{ width: { xs: 330, md: 500 } }}>
        <TextFieldControl
          name='name'
          label={t_management('attributes.name')}
          control={control}
          required
          disabled={isEditing && !isActive}
          errorMessage={errorNameMessage}
        />
        <Controller
          name='type'
          control={control}
          defaultValue={values?.type ?? ''}
          render={({ field }) => {
            const selected =
              ATTRIBUTE_OPTIONS.find((option) => option.value === field.value) ?? null;
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant='body2' sx={{ color: 'text.primary', fontWeight: '500' }}>
                  {t_management('attributes.type')}
                </Typography>
                <Autocomplete
                  options={ATTRIBUTE_OPTIONS}
                  disabled={isEditing}
                  getOptionLabel={(option) => option.label}
                  size='small'
                  sx={{
                    '& .MuiAutocomplete-inputRoot': {
                      minHeight: 56,
                      padding: 0,
                    },
                  }}
                  value={selected}
                  onChange={(_event, newValue) => field.onChange(newValue ? newValue.value : '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder={t_management('attributes.enterType')}
                      size='small'
                    />
                  )}
                />
              </Box>
            );
          }}
        />
        {typeValue === 'selection' && (
          <Controller
            name='selectOptions'
            control={control}
            render={() => (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant='body2' sx={{ color: 'text.primary', fontWeight: '500' }}>
                  {t_management('attributes.selectOptions')}
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: 200,
                    overflowY: 'auto',
                  }}
                >
                  {(() => {
                    const formSelectOptions = (watch('selectOptions') ??
                      []) as Inputs['selectOptions'];
                    return formSelectOptions?.map((option, index) => (
                      <Paper
                        key={index}
                        variant='outlined'
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          py: 2,
                          px: 4,
                          mb: 1,
                          ml: 0.5,
                          boxShadow: 3,
                          borderRadius: 2,
                          borderColor: 'divider',
                          bgcolor: 'background.paper',
                        }}
                      >
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1 }}>
                          <TextField
                            size='small'
                            placeholder={t_management('attributes.value')}
                            label={t_management('attributes.value')}
                            inputRef={(element: HTMLInputElement | null) => {
                              inputRefs.current[index] = element;
                            }}
                            value={option.value ?? ''}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              updateSelectOption(index, { value: newValue });
                              if (isSubmitAttempted && String(newValue ?? '').trim().length > 0) {
                                clearErrors?.(`selectOptions.${index}.value`);
                              }
                            }}
                            error={
                              isSubmitAttempted &&
                              Boolean((formState.errors as any)?.selectOptions?.[index]?.value)
                            }
                            helperText={
                              isSubmitAttempted &&
                              formState.errors?.selectOptions?.[index]?.value?.message
                                ? t_errors(formState.errors?.selectOptions?.[index]?.value?.message)
                                : undefined
                            }
                            sx={{
                              '& .MuiInputBase-root': {
                                minHeight: 32,
                                width: '90%',
                              },
                            }}
                            onKeyDown={(e) => {
                              const native = e.nativeEvent || {};
                              if (e.key === 'Enter' && !native.isComposing) {
                                e.preventDefault();
                                const refEl = inputRefs.current?.[index];
                                if (refEl && typeof refEl.blur === 'function') {
                                  refEl.blur();
                                } else {
                                  (e.target as HTMLElement)?.blur();
                                }
                              }
                            }}
                          />

                          {/* <TextField
                            size='small'
                            placeholder={t_management('attributes.label')}
                            label={t_management('attributes.label')}
                            value={option.label ?? ''}
                            onChange={(e) => {
                              updateSelectOption(index, { label: e.target.value });
                            }}
                            sx={{
                              '& .MuiInputBase-root': {
                                minHeight: 32,
                                width: '90%',
                              },
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.preventDefault();
                            }}
                          /> */}
                        </Box>

                        <IconButton
                          edge='end'
                          onClick={() => removeSelectOption(index)}
                          aria-label='delete'
                        >
                          <DeleteIcon fontSize='medium' />
                        </IconButton>
                      </Paper>
                    ));
                  })()}
                </Box>
                <Button
                  variant='outlined'
                  onClick={addSelectOption}
                  fullWidth
                  size='small'
                  startIcon={<Add fontSize='medium' />}
                  sx={{
                    borderStyle: 'dotted',
                    borderColor: 'divider',
                    borderWidth: 1,
                    borderRadius: 1,
                    justifyContent: 'flex-center',
                    fontSize: '16px',
                    minHeight: 56,
                  }}
                >
                  {t_management('attributes.addOption')}
                </Button>
              </Box>
            )}
          />
        )}
        {isEditing && (
          <SwitchControl
            name='isActive'
            label={t_management('status')}
            startText={t_management('active')}
            endText={t_management('inactive')}
            control={control}
          />
        )}
        {
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
            <Controller
              name='isEncryptionEnabled'
              control={control}
              defaultValue={Boolean(values?.isEncryptionEnabled)}
              render={({ field }) => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <Tooltip
                    title={isEditing ? t_management('attributes.encryptionLockedTooltip') : ''}
                    disableHoverListener={!isEditing}
                    disableFocusListener={!isEditing}
                    disableTouchListener={!isEditing}
                  >
                    <FormControlLabel
                      sx={{ ml: 0.5, mr: 0 }}
                      control={
                        <Checkbox
                          {...field}
                          checked={Boolean(field.value)}
                          onChange={(e) => field.onChange(e.target.checked)}
                          edge='start'
                          size='small'
                          disabled={isEditing}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {t_management('attributes.enableAttributeEncryption')}
                          {!isEditing && (
                            <Tooltip title={t_management('attributes.encryptionLockedTooltip')}>
                              <InfoOutlined
                                fontSize='small'
                                sx={{ color: 'text.secondary', cursor: 'help' }}
                              />
                            </Tooltip>
                          )}
                        </Box>
                      }
                    />
                  </Tooltip>
                </Box>
              )}
            />
          </Box>
        }
      </FlexForm>
    </FormDialog>
  );
};
