import { Box } from '@mui/material';
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { type Dayjs } from 'dayjs';
import type { ControllerRenderProps } from 'react-hook-form';

import { type ListFilterForm } from '../hooks/filterSchema';

export const DateRangeFilterInput = ({
  field,
  disabled,
}: {
  field: ControllerRenderProps<ListFilterForm, `filters.${number}.value`> & {
    value?: { gte?: string; lte?: string };
  };
  disabled?: boolean;
}) => {
  const previousValue = (field.value as { gte?: string | null; lte?: string | null }) || {};
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <DateTimePicker
          value={previousValue.gte ? dayjs(previousValue.gte) : null}
          onChange={(newValue: Dayjs | null) => {
            field.onChange({
              ...field?.value,
              gte: newValue ? newValue.toISOString() : null,
            });
          }}
          slotProps={{ textField: { size: 'small', sx: { width: 220 }, disabled } }}
        />
        <DateTimePicker
          value={previousValue.lte ? dayjs(previousValue.lte) : null}
          onChange={(newValue: Dayjs | null) => {
            field.onChange({
              ...field?.value,
              lte: newValue ? newValue.toISOString() : null,
            });
          }}
          slotProps={{ textField: { size: 'small', sx: { width: 220 }, disabled } }}
        />
      </Box>
    </LocalizationProvider>
  );
};

export default DateRangeFilterInput;
