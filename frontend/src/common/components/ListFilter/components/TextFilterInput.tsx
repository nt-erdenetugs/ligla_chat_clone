import { TextField } from '@mui/material';

import { useTranslation } from '~/locales/hooks';

export const TextFilterInput = ({ field, disabled }: { field: any; disabled?: boolean }) => {
  const { t } = useTranslation();
  return (
    <TextField
      label={t('datatableFilter.value')}
      variant='outlined'
      size='small'
      sx={{ width: 180 }}
      value={String(field.value ?? '')}
      onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        field.onChange(String(e.target.value));
      }}
      disabled={disabled}
    />
  );
};

export default TextFilterInput;
