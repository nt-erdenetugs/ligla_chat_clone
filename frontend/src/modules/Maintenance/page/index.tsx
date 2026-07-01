import BuildIcon from '@mui/icons-material/Build';
import { Box, Container, Stack, Typography, Paper } from '@mui/material';

import { useResponsive } from '~/common/hooks';
import { LOGO } from '~/configs';
import { useTranslation } from '~/locales/hooks';

export const MaintenancePage = () => {
  const { isMobileOrTablet } = useResponsive();
  const { t } = useTranslation();
  const descriptionLines = t('maintenance.description').split('\n');

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: '#f6f8f7',
        display: 'flex',
        alignItems: 'center',
        py: 6,
      }}
    >
      <Container maxWidth='md'>
        <Paper
          elevation={0}
          sx={{
            borderRadius: 3,
            overflow: 'hidden',
            boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
          }}
        >
          <Box sx={{ height: 6, backgroundColor: 'primary.main' }} />

          <Stack spacing={4} sx={{ p: { xs: 4, md: 6 }, textAlign: 'center' }}>
            <Stack spacing={2} alignItems='center'>
              <img src={LOGO} alt='logo' width={isMobileOrTablet ? 140 : 180} />

              <Stack direction='row' spacing={2} alignItems='center'>
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(0, 200, 83, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BuildIcon color='primary' />
                </Box>

                <Typography variant='h6' fontWeight='bold'>
                  {t('maintenance.title')}
                </Typography>
              </Stack>
            </Stack>

            <Box
              sx={{
                backgroundColor: '#eef7f2',
                borderRadius: 2,
                p: 3,
              }}
            >
              <Typography variant='body2'>
                {descriptionLines.map((line, index) => (
                  <span key={`maintenance-line-${index}`}>
                    {line}
                    {index < descriptionLines.length - 1 ? <br /> : null}
                  </span>
                ))}
              </Typography>
            </Box>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
};
