import AddIcon from '@mui/icons-material/Add';
import { type ButtonProps } from '@mui/material';

import { ACTIONS_TYPE, ACTION_LABEL_KEYS } from '~/common/constants';
import { useTranslation } from '~/locales/hooks';

import { ActionButton } from './components';

export const AddButton = (props: ButtonProps) => {
  const { t } = useTranslation();

  return (
    <ActionButton actionType={ACTIONS_TYPE.NEW} icon={<AddIcon fontSize='small' />} {...props}>
      {t(ACTION_LABEL_KEYS[ACTIONS_TYPE.NEW])}
    </ActionButton>
  );
};
