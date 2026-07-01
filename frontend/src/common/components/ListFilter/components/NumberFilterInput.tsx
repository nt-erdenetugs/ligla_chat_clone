import { TextField } from '@mui/material';

export const NumberFilterInput = ({ field, disabled }: { field: any; disabled?: boolean }) => (
  <TextField
    variant='outlined'
    size='small'
    type='number'
    sx={{ width: 180 }}
    value={field.value === null || field.value === undefined ? '' : String(field.value)}
    onChange={(e) => {
      const value = e.target.value;
      field.onChange(value === '' ? null : Number(value));
    }}
    disabled={disabled}
  />
);

export default NumberFilterInput;
