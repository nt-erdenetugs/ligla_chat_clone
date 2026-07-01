import { Box } from '@mui/material';

import { type IChatMessage } from '~/modules/Chat';

export const MessageLog = ({ content }: Pick<IChatMessage, 'content'>) => {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        marginY: 2,
      }}
    >
      <Box
        sx={{
          paddingX: 2,
          paddingY: 1,
          color: 'white',
          borderRadius: '14px',
          border: '1px solid #959A97',
          fontSize: '8px',
          fontWeight: 'bold',
          display: 'inline-block',
        }}
      >
        {content}
      </Box>
    </Box>
  );
};
