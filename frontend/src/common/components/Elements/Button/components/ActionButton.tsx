import { type ReactNode } from 'react';

import { Button, type ButtonProps } from '@mui/material';
import { useSearchParams } from 'react-router';

import { ACTION_PARAM_KEY, ACTION_LABEL_KEYS, type IAction } from '~/common/constants';
import { useTranslation } from '~/locales/hooks';

type ActionButtonProps = ButtonProps & {
  actionType: IAction;
  icon: ReactNode;
  defaultText?: string;
  variant?: string;
};
export const ActionButton = ({
  actionType,
  icon,
  defaultText = actionType,
  variant = 'contained',
  children,
  ...props
}: ActionButtonProps) => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleClick = () => {
    setSearchParams((prev) => [...prev, [ACTION_PARAM_KEY, actionType]]);
  };
  return (
    <Button
      variant={variant}
      startIcon={icon}
      onClick={handleClick}
      disabled={searchParams.get(ACTION_PARAM_KEY) === actionType}
      {...props}
    >
      {children || t(ACTION_LABEL_KEYS[actionType]) || t(defaultText)}
    </Button>
  );
};
