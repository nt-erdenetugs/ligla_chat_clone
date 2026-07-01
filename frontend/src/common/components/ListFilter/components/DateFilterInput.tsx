import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { type Dayjs } from 'dayjs';

export const DateFilterInput = ({ field, disabled }: { field: any; disabled?: boolean }) => (
  <LocalizationProvider dateAdapter={AdapterDayjs}>
    <DateTimePicker
      value={field.value ? dayjs(String(field.value)) : null}
      onChange={(newValue: Dayjs | null) => {
        field.onChange(newValue ? newValue.toISOString() : null);
      }}
      slotProps={{ textField: { size: 'small', sx: { width: 240 }, disabled } }}
    />
  </LocalizationProvider>
);

export default DateFilterInput;
