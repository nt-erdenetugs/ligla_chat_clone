import { Box } from '@mui/material';

import { type IChatMessage } from '~/modules/Chat';

type MessageSeparateProps = Pick<IChatMessage, 'content'> & {
  isLinear?: boolean;
};

export const MessageSeparator = (props: MessageSeparateProps) => {
  const { content, isLinear = false } = props;
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginY: 1,
        width: '80%',
        marginX: 'auto',
      }}
    >
      <Box sx={{ flexGrow: 1, height: '1px', bgcolor: '#959A97', marginRight: 1 }} />
      <Box
        sx={{
          paddingX: 1,
          paddingY: 0.5,
          color: isLinear ? 'grey.800' : 'white',
          bgcolor: isLinear ? '' : 'grey.800',
          borderRadius: 3,
          fontSize: '10px',
        }}
      >
        {content}
      </Box>
      <Box sx={{ flexGrow: 1, height: '1px', bgcolor: '#959A97', marginLeft: 1 }} />
    </Box>
  );
};
