import { Typography } from '@mui/material';

import { DISPLAY_NAME_MAX_CHAR_LIMIT } from '~/common/constants';
import { useAuthContext } from '~/context/AuthContext';
import { useTranslation } from '~/locales/hooks';
import { isTextTooLong } from '~/utils';

type PropsType = {
  name?: string;
  limit?: number;
  warningText?: string;
};

export const UserNameTooLong = ({
  name,
  limit = DISPLAY_NAME_MAX_CHAR_LIMIT,
  warningText,
}: PropsType) => {
  const { isUserNameTooLong } = useAuthContext();
  const { t_errors } = useTranslation();

  const isCurrentUserNameTooLong = !name && isUserNameTooLong;
  const shouldWarn = (name && isTextTooLong(name, limit)) || isCurrentUserNameTooLong;

  if (!shouldWarn) return null;

  return (
    <Typography variant='caption' color='warning' sx={{ wordBreak: 'break-word' }}>
      {warningText ?? t_errors('userNameMaxCharacterLimit', { limit })}
    </Typography>
  );
};
