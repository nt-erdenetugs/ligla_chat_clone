import DeleteIcon from '@mui/icons-material/Delete';
import { type ButtonProps } from '@mui/material';

import { ACTIONS_TYPE, ACTION_LABEL_KEYS } from '~/common/constants';
import { useTranslation } from '~/locales/hooks';

import { ActionButton } from './components';

export const DeleteButton = (props: ButtonProps) => {
  const { t } = useTranslation();

  return (
    <ActionButton
      actionType={ACTIONS_TYPE.DELETE}
      icon={<DeleteIcon fontSize='small' />}
      color='error'
      {...props}
    >
      {t(ACTION_LABEL_KEYS[ACTIONS_TYPE.DELETE])}
    </ActionButton>
  );
};
