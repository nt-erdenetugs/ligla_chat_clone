import { useEffect, useMemo, useState } from 'react';

import { Button } from '@mui/material';

import {
  ShowDialog,
  LabeledGrid,
  type ShowProps,
  ChipsWrapper,
  ActiveStatusChip,
  SkeletonSuspense,
} from '~/common/components';
import { adminRoles, SHOW_ADMINISTRATORS_EMAIL_LIMIT, UserStatusType } from '~/common/constants';
import { useUserChip } from '~/common/hooks';
import { useTranslation } from '~/locales/hooks';
import { useOrganizationActions } from '~/modules/Organizations';
import { uniqueKey } from '~/utils';

import { handleTeamSettingFilterReset } from '../utils/teamSettings';

import { OrganziationTeamSettings } from './OrganziationTeamSettings';

export const Show = ({ id, onClose, dialogProps }: ShowProps) => {
  const { targetOrganization, isFetchingOne, setTargetOrganization } = useOrganizationActions();
  const [openTeamSettings, setOpenTeamSettings] = useState(false);

  const { t, t_management } = useTranslation();
  const { getChipLabelWithStatus, getUserStatusChipColor } = useUserChip();

  const emails = useMemo(() => {
    if (targetOrganization && targetOrganization.users) {
      const admins = targetOrganization.users.filter((user) => adminRoles.includes(user.roleType));

      return (
        <ChipsWrapper
          title={t_management('organizations.companyAdministratorEmail')}
          items={admins}
          limit={SHOW_ADMINISTRATORS_EMAIL_LIMIT}
          getChipLabel={getChipLabelWithStatus}
          getChipColor={(user) =>
            getUserStatusChipColor({
              status: user.status,
              customStatusColors: {
                [UserStatusType.ACTIVE]: undefined,
              },
            })
          }
          getTooltipTitle={(user) =>
            user.status === UserStatusType.PENDING
              ? t_management('organizations.userInvitationPending')
              : undefined
          }
        />
      );
    }
    return '';
  }, [targetOrganization, t_management, getChipLabelWithStatus, getUserStatusChipColor]);

  useEffect(() => {
    setTargetOrganization(String(id));
  }, [id, setTargetOrganization]);

  return (
    <ShowDialog
      onClose={onClose}
      title={t_management('organizations.title')}
      subTitle={t_management('subtitle.details')}
      cancelText={t('actions.close')}
      isLoading={isFetchingOne}
      {...dialogProps}
      titleAction={
        <Button
          onClick={() => {
            handleTeamSettingFilterReset();
            setOpenTeamSettings(true);
          }}
          variant='outlined'
          size='small'
        >
          {t_management('organizations.teamSettings')}
        </Button>
      }
    >
      {openTeamSettings && (
        <OrganziationTeamSettings
          onClose={() => setOpenTeamSettings(false)}
          title={targetOrganization?.displayName}
          organizationId={targetOrganization?.id}
        />
      )}
      <LabeledGrid
        rows={[
          [
            t_management('organizations.companyCodeName'),
            <SkeletonSuspense key={uniqueKey()} isLoading={isFetchingOne}>
              {targetOrganization?.name}
            </SkeletonSuspense>,
          ],
          [
            t_management('organizations.loginLiffId'),
            <SkeletonSuspense key={uniqueKey()} isLoading={isFetchingOne}>
              {targetOrganization?.loginLiffId}
            </SkeletonSuspense>,
          ],
          [
            t_management('organizations.fileUploadLiffId'),
            <SkeletonSuspense key={uniqueKey()} isLoading={isFetchingOne}>
              {targetOrganization?.fileUploadLiffId}
            </SkeletonSuspense>,
          ],
          [
            t_management('organizations.apiKey'),
            <SkeletonSuspense key={uniqueKey()} isLoading={isFetchingOne}>
              {targetOrganization?.apiKey}
            </SkeletonSuspense>,
          ],
          [
            t_management('organizations.companyName'),
            <SkeletonSuspense key={uniqueKey()} isLoading={isFetchingOne}>
              {targetOrganization?.displayName}
            </SkeletonSuspense>,
          ],
          [
            t_management('organizations.notes'),
            <SkeletonSuspense key={uniqueKey()} isLoading={isFetchingOne}>
              {targetOrganization?.description}
            </SkeletonSuspense>,
          ],
          [
            t_management('organizations.maxOperators'),
            <SkeletonSuspense key={uniqueKey()} isLoading={isFetchingOne}>
              {targetOrganization?.maxOperator}
            </SkeletonSuspense>,
          ],
          [
            t_management('organizations.companyAdministratorEmail'),
            <SkeletonSuspense key={uniqueKey()} isLoading={isFetchingOne}>
              {emails}
            </SkeletonSuspense>,
          ],
          [
            t_management('status'),
            <SkeletonSuspense key={uniqueKey()} isLoading={isFetchingOne}>
              <ActiveStatusChip status={Boolean(targetOrganization?.isActive)} />
            </SkeletonSuspense>,
          ],
        ]}
        sx={{
          py: 3,
          my: 3,
        }}
      />
    </ShowDialog>
  );
};
