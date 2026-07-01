import { FormControl, InputLabel, MenuItem, Select, type SelectChangeEvent } from '@mui/material';

import { usePaginationContext } from '~/context/PaginationContext';
import { useTranslation } from '~/locales/hooks';

const OPTIONS = [10, 25, 50, 100];

export const RowsPerPage = () => {
  const { pageParams, setRowsPerPage, setPage } = usePaginationContext();
  const { t_management } = useTranslation();

  return (
    <FormControl>
      <InputLabel size='small'>{t_management('rowsPerPage')}</InputLabel>
      <Select
        value={`${pageParams.per}`}
        size='small'
        label={t_management('rowsPerPage')}
        color='primary'
        sx={{ minWidth: 100 }}
        onChange={(e: SelectChangeEvent) => {
          setRowsPerPage(Number(e.target.value));
          setPage(1);
        }}
      >
        {OPTIONS.map((option) => (
          <MenuItem key={option} value={option}>
            {option} {t_management('items')}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
