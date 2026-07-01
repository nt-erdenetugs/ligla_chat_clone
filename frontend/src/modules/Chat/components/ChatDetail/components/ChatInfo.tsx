import { memo } from 'react';

import { Stack, Typography, Box } from '@mui/material';

import { useTranslation } from '~/locales/hooks';
import { chatAttributeStyles, formatFieldValue, typographyColors } from '~/modules/Chat';

export type InfoField = {
  columnName: string;
  columnAlias: string;
  value?: string | number | null;
};

export const InfoDisplay = memo(function InfoDisplay({
  fields,
  loading,
  emptyMessage,
  additionalField,
}: {
  fields: InfoField[] | undefined;
  loading: boolean;
  emptyMessage: string;
  additionalField?: { label: string; value: string };
}) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography>{t('loading')}</Typography>
      </Box>
    );
  }

  if (!fields || fields.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography>{emptyMessage}</Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      {additionalField && (
        <Box key={additionalField.value}>
          <Stack direction='row' spacing={0.5}>
            <Typography
              fontSize={13}
              color={typographyColors.name}
              sx={chatAttributeStyles.nameStyle}
            >
              {additionalField.label}
            </Typography>
            <Typography
              color={typographyColors.value}
              sx={{ ...chatAttributeStyles.valueStyle, wordBreak: 'break-word' }}
            >
              {additionalField.value}
            </Typography>
          </Stack>
        </Box>
      )}
      {fields.map((field) => (
        <Box key={field.columnName}>
          <Stack direction='row' spacing={0.5}>
            <Typography
              fontSize={13}
              color={typographyColors.name}
              sx={chatAttributeStyles.nameStyle}
            >
              {field.columnAlias}:
            </Typography>
            <Typography
              color={typographyColors.value}
              sx={{ ...chatAttributeStyles.valueStyle, wordBreak: 'break-word' }}
            >
              {formatFieldValue(field)}
            </Typography>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
});

interface ChatMemberIdProps {
  clientUserId?: Nullable<string>;
}

export const ChatMemberId = memo(function ChatMemberId({ clientUserId }: ChatMemberIdProps) {
  const { t_chat } = useTranslation();
  const value = clientUserId || '';

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <Typography variant='subtitle1' fontWeight='regular'>
        {t_chat('chatFeeds.memberId')} -
      </Typography>
      <Typography variant='body2' color='text.primary' sx={{ wordBreak: 'break-word' }}>
        {value}
      </Typography>
    </Box>
  );
});

ChatMemberId.displayName = 'ChatMemberId';
