import { Container, Stack, Typography } from '@mui/material';

import { useTranslation } from '~/locales/hooks';

export const PublicErrorFallback = () => {
  const { t } = useTranslation();
  const displayCode = 403;
  const title = t('errorFallback.403.title');

  return (
    <Container
      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '90vh' }}
    >
      <Stack sx={{ textAlign: 'center' }} alignItems='center' gap={2}>
        <Typography variant='h1' component='h1' fontWeight='bold' color='primary.main'>
          {displayCode}
        </Typography>
        <Typography variant='h5' component='h5' fontWeight='bold' color='black'>
          {title}
        </Typography>
      </Stack>
    </Container>
  );
};
