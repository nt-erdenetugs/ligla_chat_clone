import { Box, Typography } from '@mui/material';

import { useTranslation } from '~/locales/hooks';
import { type ICondition, conditionDataToSentence } from '~/modules/Rules/Filters';

type ConditionSentenceProps = {
  data: ICondition;
  fieldsAlias?: Record<string, string>;
  borderColor: string;
};

export const ConditionSentence = ({ data, fieldsAlias, borderColor }: ConditionSentenceProps) => {
  const { t_management } = useTranslation();

  const sentence = conditionDataToSentence(data, fieldsAlias, t_management);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        py: 0.5,
        px: 3,
        border: '1px solid',
        borderRadius: 50,
        borderColor,
      }}
    >
      <Typography
        sx={{
          color: 'text.primary',
          whiteSpace: 'nowrap',
        }}
      >
        {sentence}
      </Typography>
    </Box>
  );
};
