import { Stack } from '@mui/material';

import { FilterLink, type QueryTokens } from '~/modules/Rules';

type QueryExpressionProps = {
  queryTokens: QueryTokens;
  depth: Optional<number>;
};

export const QueryExpression = ({ queryTokens, depth }: QueryExpressionProps) => {
  return (
    <Stack direction='row' alignItems='center' flexWrap='wrap' gap={1}>
      {queryTokens.map((token, i) => (
        <span key={i}>
          {typeof token === 'string' ? (
            token
          ) : (
            <FilterLink id={token.id} title={token.name} depth={depth} />
          )}
        </span>
      ))}
    </Stack>
  );
};
