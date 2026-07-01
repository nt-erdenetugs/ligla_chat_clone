import { type ButtonProps, Stack, Typography } from '@mui/material';

import { AddButton } from '~/common/components';
import { useTranslation } from '~/locales/hooks';

export type GetStartedProps = {
  title: string;
  notFound?: boolean;
  showAddButton?: boolean;
  addButtonProps?: ButtonProps;
};

export const GetStarted = ({
  title,
  notFound = false,
  showAddButton,
  addButtonProps,
}: GetStartedProps) => {
  const { t_errors } = useTranslation();
  return (
    <Stack alignItems='center' gap={1} my={4}>
      <Typography variant='body2' fontWeight='bold'>
        {notFound
          ? `${title} ${t_errors('searchNotFound')}`
          : `${t_errors('doesNotExist', { item: title })}`}
      </Typography>
      {!notFound && showAddButton && <AddButton variant='outlined' {...addButtonProps} />}
    </Stack>
  );
};
