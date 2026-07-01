import { useCallback, useEffect } from 'react';

import {
  ShowDialog,
  LabeledGrid,
  type ShowProps,
  ChipsWrapper,
  ActiveStatusChip,
  SkeletonSuspense,
} from '~/common/components';
import { SHOW_STORES_LIMIT, SHOW_USERS_LIMIT, UserStatusType } from '~/common/constants';
import { useUserChip } from '~/common/hooks';
import { useAuthContext } from '~/context/AuthContext';
import { UserRoleType } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { useTeamActions } from '~/modules/Teams';
import { type IUser } from '~/modules/Users';
import { uniqueKey } from '~/utils';

export const Show = ({ id, onClose, dialogProps, onConfirm, organizationId }: ShowProps) => {
  const { targetTeam, isFetchingOne, setTargetTeam } = useTeamActions();
  const { t, t_management, t_errors } = useTranslation();
  const { user } = useAuthContext();
  const { getUserStatusChipColor, getChipLabelWithStatus } = useUserChip();

  useEffect(() => {
    setTargetTeam(String(id), { organizationId });
  }, [id, organizationId, setTargetTeam]);

  const _getUserStatusChipColor = useCallback(
    (user: IUser) => {
      return getUserStatusChipColor({
        status: user.status,
        customStatusColors: {
          [UserStatusType.ACTIVE]:
            user.roleType === UserRoleType.ManagerOperator ? 'primary' : undefined,
        },
      });
    },
    [getUserStatusChipColor],
  );

  return (
    <ShowDialog
      onClose={onClose}
      title={t_management('teams.title')}
      subTitle={t_management('subtitle.details')}
      cancelText={t('actions.close')}
      isLoading={isFetchingOne}
      onConfirm={onConfirm}
      editDisabled={user?.roleType === UserRoleType.Operator}
      {...dialogProps}
    >
      <LabeledGrid
        sx={{
          py: 2,
        }}
        rows={[
          [
            t_management('teams.name'),
            <SkeletonSuspense isLoading={isFetchingOne} key={uniqueKey()}>
              {targetTeam?.name}
            </SkeletonSuspense>,
          ],
          [
            t_management('teams.managers'),
            <SkeletonSuspense isLoading={isFetchingOne} key={uniqueKey()}>
              <ChipsWrapper
                title={t_management('teams.managers')}
                items={targetTeam?.managers || []}
                limit={SHOW_USERS_LIMIT}
                getChipLabel={getChipLabelWithStatus}
                getChipColor={_getUserStatusChipColor}
                getTooltipTitle={(user) =>
                  user.roleType === UserRoleType.ManagerOperator
                    ? t_errors('userHasBothOperatorAndManagerRoles')
                    : undefined
                }
              />
            </SkeletonSuspense>,
          ],
          [
            t_management('teams.operators'),
            <SkeletonSuspense isLoading={isFetchingOne} key={uniqueKey()}>
              <ChipsWrapper
                title={t_management('teams.operators')}
                items={targetTeam?.operators || []}
                limit={SHOW_USERS_LIMIT}
                getChipLabel={getChipLabelWithStatus}
                getChipColor={_getUserStatusChipColor}
                getTooltipTitle={(user) =>
                  user.roleType === UserRoleType.ManagerOperator
                    ? t_errors('userHasBothOperatorAndManagerRoles')
                    : undefined
                }
              />
            </SkeletonSuspense>,
          ],
          [
            t_management('teams.stores'),
            <SkeletonSuspense isLoading={isFetchingOne} key={uniqueKey()}>
              <ChipsWrapper
                title={t_management('teams.stores')}
                key={uniqueKey()}
                items={targetTeam?.stores || []}
                limit={SHOW_STORES_LIMIT}
                getChipLabel={(store) => store.name}
              />
            </SkeletonSuspense>,
          ],
          ...(targetTeam?.isDefault
            ? []
            : [
                [
                  t_management('status'),
                  <SkeletonSuspense isLoading={isFetchingOne} key={uniqueKey()}>
                    <ActiveStatusChip status={Boolean(targetTeam?.isActive)} />
                  </SkeletonSuspense>,
                ],
              ]),
        ]}
      />
    </ShowDialog>
  );
};
