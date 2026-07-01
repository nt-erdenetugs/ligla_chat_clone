import { useState, type MouseEvent } from 'react';

import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { Button, Collapse, IconButton, InputAdornment, Stack } from '@mui/material';
import { type Control } from 'react-hook-form';

import { FlexForm, OutlinedInputControl } from '~/common/components';
import { useTranslation } from '~/locales/hooks';
import { useAuthActions } from '~/modules/Auth/hooks';

import { type UpdatePasswordInputs, useUpdatePasswordForm } from '../configs';

type EditPasswordProps = {
  open: boolean;
  onClose: () => void;
};

export const EditPassword = ({ open, onClose }: EditPasswordProps) => {
  const { t } = useTranslation();
  const { updatePassword, isUpdatingPassword } = useAuthActions();

  const { control, handleSubmit, reset } = useUpdatePasswordForm({});

  const handleClose = () => {
    onClose();
    reset();
  };

  const onSubmit = async ({ currentPassword, newPassword }: UpdatePasswordInputs) => {
    await updatePassword({ currentPassword, newPassword }).then((result) => {
      if (!result.errors) {
        handleClose();
      }
    });
  };

  return (
    <Collapse timeout={300} in={open}>
      <Stack gap={2}>
        <FlexForm width='auto' sx={{ gap: 1 }} onSubmit={handleSubmit(onSubmit)}>
          <input type='text' autoComplete='username' hidden disabled />
          <TogglePasswordInputControl
            name='currentPassword'
            label={t('oldPassword')}
            control={control}
          />
          <TogglePasswordInputControl
            name='newPassword'
            label={t('newPassword')}
            control={control}
          />
          <TogglePasswordInputControl
            name='confirmPassword'
            label={t('newPasswordForConfirmation')}
            control={control}
          />
        </FlexForm>
        <Stack direction='row' justifyContent='flex-end' gap={1}>
          <Button
            variant='contained'
            onClick={handleSubmit(onSubmit)}
            disabled={isUpdatingPassword}
          >
            {t('actions.keep')}
          </Button>
          <Button variant='outlined' color='secondary' onClick={handleClose}>
            {t('actions.cancel')}
          </Button>
        </Stack>
      </Stack>
    </Collapse>
  );
};

const TogglePasswordInputControl = ({
  label,
  name,
  control,
}: {
  label: string;
  name: 'currentPassword' | 'newPassword' | 'confirmPassword';
  control: Control<UpdatePasswordInputs>;
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const handleMouseEvent = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  return (
    <OutlinedInputControl
      name={name}
      label={label}
      control={control}
      required
      type={showPassword ? 'text' : 'password'}
      endAdornment={
        <InputAdornment position='end'>
          <IconButton
            aria-label={showPassword ? 'hide the password' : 'display the password'}
            onClick={() => setShowPassword((val) => !val)}
            onMouseDown={handleMouseEvent}
            onMouseUp={handleMouseEvent}
            edge='end'
            disableRipple
          >
            {showPassword ? (
              <VisibilityOutlinedIcon fontSize='small' />
            ) : (
              <VisibilityOffOutlinedIcon fontSize='small' />
            )}
          </IconButton>
        </InputAdornment>
      }
    />
  );
};
