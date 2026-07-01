import { memo, Suspense } from 'react';

import { Avatar, Skeleton, Stack, type StackProps, Typography } from '@mui/material';

import { USER_DEFAULT_PICTURE_URL } from '~/common/constants';
import { getDisplayNames, type IChat } from '~/modules/Chat';
import { truncate, discardNull } from '~/utils';

type ChatUserInfoProps = {
  chat: IChat;
  avatarSize?: number;
  truncateLength?: number;
  isTruncate?: boolean;
} & StackProps;

const AvatarFallback = ({ size }: { size: number }) => (
  <Skeleton variant='circular' width={size} height={size} />
);

const textTruncateProps = {
  maxWidth: { xs: 100, sm: 400 },
  noWrap: true,
  sx: { overflow: 'hidden', textOverflow: 'ellipsis' },
};

export const ChatUserInfo = memo(function ChatUserInfo({
  chat,
  avatarSize = 35,
  truncateLength = 50,
  gap = 1,
  isTruncate = false,
  ...rest
}: ChatUserInfoProps) {
  const {
    endUser: { displayName, pictureUrl },
  } = chat;

  const { fullName } = getDisplayNames(discardNull(displayName));

  return (
    <Stack alignItems='center' gap={gap} {...rest}>
      <Suspense fallback={<AvatarFallback size={avatarSize} />}>
        <Avatar
          src={pictureUrl || USER_DEFAULT_PICTURE_URL}
          sx={{ width: avatarSize, height: avatarSize }}
        />
      </Suspense>
      <Typography
        variant='h6'
        fontSize={14}
        lineHeight={1.2}
        {...(isTruncate ? textTruncateProps : {})}
      >
        {truncate(fullName, truncateLength)}
      </Typography>
    </Stack>
  );
});
