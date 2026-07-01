import { Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

import {
  type MappedChatAssignRule,
  QueryExpression,
  convertItemsToQueryTokens,
} from '~/modules/Rules';

type ContentProps = {
  data: MappedChatAssignRule;
  depth: Optional<number>;
};

export const Content = ({ data, depth }: ContentProps) => {
  const {
    rootFilterGroup: { items, logicalOperator },
  } = data;
  const { t } = useTranslation();

  const queryTokens = convertItemsToQueryTokens(items, logicalOperator);

  return (
    <Stack fontSize='0.9rem'>
      {queryTokens?.length ? (
        <Stack gap='4px'>
          <Stack gap='4px'>
            <QueryExpression queryTokens={queryTokens} depth={depth} />
          </Stack>
        </Stack>
      ) : (
        <Typography color='grey' variant='body2'>
          {t('表示できません')}
        </Typography>
      )}
    </Stack>
  );
};
