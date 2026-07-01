import EditIcon from '@mui/icons-material/Edit';
import { type ButtonProps } from '@mui/material';

import { ACTIONS_TYPE, ACTION_LABEL_KEYS } from '~/common/constants';
import { useTranslation } from '~/locales/hooks';

import { ActionButton } from './components';

export const EditButton = (props: ButtonProps) => {
  const { t } = useTranslation();

  return (
    <ActionButton actionType={ACTIONS_TYPE.EDIT} icon={<EditIcon fontSize='small' />} {...props}>
      {t(ACTION_LABEL_KEYS[ACTIONS_TYPE.EDIT])}
    </ActionButton>
  );
};
