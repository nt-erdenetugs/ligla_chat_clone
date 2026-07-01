import { useQuery } from '@apollo/client';
import { Box } from '@mui/material';
import { useSearchParams } from 'react-router';

import { SplashLoader, ErrorFallback } from '~/common/components';
import { useResponsive } from '~/common/hooks';
import {
  VerifyPasswordResetTokenDocument,
  type VerifyPasswordResetTokenQuery,
} from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { ResetPasswordForm } from '~/modules/Auth';

type ResetPasswordPageProps = {
  initial?: boolean;
};

export const ResetPasswordPage = ({ initial }: ResetPasswordPageProps) => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { t } = useTranslation();
  const { isMobileOrTablet } = useResponsive();

  const { data, error, loading } = useQuery<VerifyPasswordResetTokenQuery>(
    VerifyPasswordResetTokenDocument,
    {
      variables: {
        token,
      },
      skip: !token,
    },
  );

  const isValidToken = !!(!error && data?.verifyPasswordResetToken);

  if (loading) {
    return <SplashLoader />;
  }

  if (!token) {
    return (
      <ErrorFallback
        code={401}
        title={
          initial
            ? t('initialLoginErrors.missingTokenTitle')
            : t('resetPasswordErrors.missingTokenTitle')
        }
        description={
          initial
            ? t('initialLoginErrors.missingTokenDescription')
            : t('resetPasswordErrors.missingTokenDescription')
        }
      />
    );
  }

  if (!isValidToken) {
    return (
      <ErrorFallback
        code={401}
        title={
          initial
            ? t('initialLoginErrors.invalidTokenTitle')
            : t('resetPasswordErrors.invalidTokenTitle')
        }
        description={
          initial
            ? t('initialLoginErrors.invalidTokenDescription')
            : t('resetPasswordErrors.invalidTokenDescription')
        }
      />
    );
  }

  return (
    <Box
      display='flex'
      alignItems='center'
      justifyContent='center'
      minHeight='100vh'
      height='100vh'
      bgcolor='white'
      p={2}
    >
      <Box
        width={1}
        display='flex'
        flexDirection='column'
        alignItems='center'
        justifyContent='center'
      >
        <Box {...(isMobileOrTablet ? { width: 1 } : { p: 5, bgcolor: '#ebf7f3', borderRadius: 5 })}>
          <ResetPasswordForm token={token} initial={initial} />
        </Box>
      </Box>
    </Box>
  );
};
