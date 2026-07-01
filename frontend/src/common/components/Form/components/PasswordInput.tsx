import { useState } from 'react';

import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { InputAdornment, IconButton } from '@mui/material';
import { type FieldValues } from 'react-hook-form';

import { OutlinedInputControl, type OutlinedInputControlProps } from '../OutlinedInputControl';

export const PasswordInput = <T extends FieldValues>({
  name,
  label,
  control,
  onFocus,
  required = false,
  ...props
}: OutlinedInputControlProps<T>) => {
  const [showPassword, setShowPassword] = useState(false);

  const handleTogglePassword = () => setShowPassword((show) => !show);

  return (
    <OutlinedInputControl
      name={name}
      label={label}
      control={control}
      onFocus={onFocus}
      required={required}
      type={showPassword ? 'text' : 'password'}
      sx={{ backgroundColor: '#ffffff' }}
      endAdornment={
        <InputAdornment position='end'>
          <IconButton
            aria-label={showPassword ? 'hide the password' : 'display the password'}
            onClick={handleTogglePassword}
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
      {...props}
    />
  );
};
