import { useEffect } from 'react';

import { Avatar, Box, Stack, Typography } from '@mui/material';

import {
  ShowDialog,
  LabeledGrid,
  type ShowProps,
  ChipsWrapper,
  SkeletonSuspense,
  RoleTooltipChip,
  UserNameTooLong,
} from '~/common/components';
import {
  SHOW_TEAMS_LIMIT,
  USER_DEFAULT_PICTURE_URL,
  type UserStatusType,
} from '~/common/constants';
import { useAuthContext } from '~/context/AuthContext';
import { useTranslation } from '~/locales/hooks';
import { useUserActions, StatusChip } from '~/modules/Users';
import { uniqueKey } from '~/utils';

export const Show = ({ id, onClose, dialogProps }: ShowProps) => {
  const { targetUser, isFetchingOne, setTargetUser, removeTargetUser } = useUserActions();
  const { t, t_management } = useTranslation();
  const { isAdminUser } = useAuthContext();

  useEffect(() => {
    setTargetUser(String(id));
  }, [id, setTargetUser]);

  const handleClose = () => {
    removeTargetUser();
    onClose();
  };

  return (
    <ShowDialog
      onClose={handleClose}
      title={t_management('users.title')}
      subTitle={t_management('subtitle.details')}
      cancelText={t('actions.close')}
      isLoading={isFetchingOne}
      editDisabled={!isAdminUser}
      {...dialogProps}
    >
      <LabeledGrid
        rows={[
          [
            t_management('users.profile'),
            <SkeletonSuspense
              skeletonProps={{ variant: 'circular', width: 80, height: 80 }}
              isLoading={isFetchingOne}
              key={uniqueKey()}
            >
              <Box sx={{ position: 'relative', width: 90 }}>
                <Avatar
                  sx={{ width: 80, height: 80 }}
                  src={targetUser?.pictureUrl || USER_DEFAULT_PICTURE_URL}
                />
              </Box>
            </SkeletonSuspense>,
          ],
          [
            t_management('status'),
            <SkeletonSuspense isLoading={isFetchingOne} key={uniqueKey()}>
              {targetUser?.status && <StatusChip status={targetUser.status as UserStatusType} />}
            </SkeletonSuspense>,
          ],
          [
            t_management('users.email'),
            <SkeletonSuspense isLoading={isFetchingOne} key={uniqueKey()}>
              {targetUser?.email}
            </SkeletonSuspense>,
          ],
          [
            t_management('users.name'),
            <SkeletonSuspense isLoading={isFetchingOne} key={uniqueKey()}>
              <Stack direction='column'>
                <Typography variant='body2'>{targetUser?.displayName}</Typography>
                {targetUser && <UserNameTooLong name={targetUser?.displayName} />}
              </Stack>
            </SkeletonSuspense>,
          ],
          [
            t_management('users.senderName'),
            <SkeletonSuspense isLoading={isFetchingOne} key={uniqueKey()}>
              <Typography variant='body2'>{targetUser?.senderName || '-'}</Typography>
            </SkeletonSuspense>,
          ],
          [
            t_management('users.role'),
            <SkeletonSuspense isLoading={isFetchingOne} key={uniqueKey()}>
              {targetUser ? <RoleTooltipChip roleType={targetUser.roleType} /> : <></>}
            </SkeletonSuspense>,
          ],
          [
            t_management('users.teams'),
            <SkeletonSuspense isLoading={isFetchingOne} key={uniqueKey()}>
              <ChipsWrapper
                title={t_management('users.teams')}
                items={targetUser?.teams || []}
                limit={SHOW_TEAMS_LIMIT}
                getChipLabel={(team) => team.name}
              />
            </SkeletonSuspense>,
          ],
        ]}
        pb={3}
      />
    </ShowDialog>
  );
};
