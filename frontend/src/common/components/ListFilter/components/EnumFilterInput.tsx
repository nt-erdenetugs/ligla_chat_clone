import { FormControl, InputLabel, MenuItem, Select, type SelectChangeEvent } from '@mui/material';

import { useTranslation } from '~/locales/hooks';

export const EnumFilterInput = ({
  field,
  options,
  index,
  disabled,
}: {
  field: any;
  options: { value: string; label: string }[];
  index?: number;
  disabled?: boolean;
}) => {
  const { t } = useTranslation();
  return (
    <FormControl size='small' sx={{ width: 180 }}>
      <InputLabel id={`value-label-${index}`}>{t('datatableFilter.value')}</InputLabel>
      <Select
        labelId={`value-label-${index}`}
        label={t('datatableFilter.value')}
        value={String(field.value ?? '')}
        onChange={(e: SelectChangeEvent<string>) => {
          field.onChange(e.target.value);
        }}
        disabled={disabled}
      >
        {options.map((option) => (
          <MenuItem key={String(option.value)} value={String(option.value)}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default EnumFilterInput;
