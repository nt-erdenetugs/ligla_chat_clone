import { type SyntheticEvent, useState } from 'react';

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Autocomplete,
  type AutocompleteChangeReason,
} from '@mui/material';
import { type FieldValues, type UseControllerProps, useController } from 'react-hook-form';

import { TextField, TextFieldControl } from '~/common/components';
import { useTranslation } from '~/locales/hooks';
import { type EmailInputs, useEmailForm } from '~/modules/Organizations';

type EmailDialogInputProps<T extends FieldValues> = UseControllerProps<T> & {
  name: string;
  label: string;
};

export const EmailDialogInput = <T extends FieldValues>(props: EmailDialogInputProps<T>) => {
  const { control: rootControl, name, label, disabled } = props;

  const {
    field: { ref, onChange, ...controlProps },
    fieldState: { error },
  } = useController<T>({ name, control: rootControl });

  const errorMessage = error && error.message;

  const { control, setError, handleSubmit, reset } = useEmailForm({});

  const [open, setOpen] = useState<boolean>(false);

  const { t, t_management, t_errors } = useTranslation();

  const handleOpen = () => {
    if (!disabled) {
      setOpen(true);
    }
  };

  const handleCloseDialog = () => {
    setOpen(false);
    reset();
  };

  const handleAutocompleteChange = (
    event: SyntheticEvent,
    emails: string[],
    situation: AutocompleteChangeReason,
  ) => {
    event.preventDefault();

    if (situation === 'removeOption') {
      onChange(emails);
    }
  };

  const onSubmit = (inputs: EmailInputs) => {
    const emails: string[] = controlProps.value;
    const { email } = inputs;

    const isDuplicate = emails.includes(email);
    if (isDuplicate) {
      setError('email', {
        type: 'manual',
        message: t_errors('emailAlreadyExistsInList'),
      });
      return;
    }

    onChange([...emails, email]);

    handleCloseDialog();
  };

  return (
    <>
      <Autocomplete
        {...controlProps}
        options={[]}
        freeSolo
        multiple
        clearIcon={null}
        onChange={handleAutocompleteChange}
        disabled={disabled}
        renderInput={(params) => {
          return (
            <TextField
              {...params}
              inputRef={ref}
              name={name}
              label={label}
              onClick={handleOpen}
              slotProps={{
                htmlInput: {
                  ...params.inputProps,
                  readOnly: true,
                },
              }}
              error={!!errorMessage}
              errorMessage={errorMessage ? t_errors(errorMessage) : errorMessage}
            />
          );
        }}
      />
      <Dialog
        open={open}
        onClose={handleCloseDialog}
        fullWidth
        maxWidth='xs'
        closeAfterTransition={true}
      >
        <DialogTitle>{t_management('organizations.addCompanyAdministratorEmail')}</DialogTitle>
        <DialogContent>
          <TextFieldControl
            name='email'
            label={t('email')}
            control={control}
            sx={{
              marginTop: 1,
            }}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>{t('actions.cancel')}</Button>
          <Button onClick={handleSubmit(onSubmit)} color='secondary' variant='contained'>
            {t('actions.invite')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
