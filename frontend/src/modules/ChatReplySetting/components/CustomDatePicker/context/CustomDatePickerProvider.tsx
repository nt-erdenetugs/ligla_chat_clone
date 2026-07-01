import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

import { getLocale } from '~/lib/apollo-client';
import 'dayjs/locale/ja';

interface IChatReplySettingsProviderProps {
  children: React.ReactNode;
}

export const CustomDatePickerProvider = ({ children }: IChatReplySettingsProviderProps) => {
  const locale = getLocale();
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={locale}>
      {children}
    </LocalizationProvider>
  );
};
