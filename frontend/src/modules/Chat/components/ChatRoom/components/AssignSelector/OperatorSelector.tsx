import { useEffect, useState } from 'react';

import {
  Chip,
  ListSubheader,
  MenuItem,
  OutlinedInput,
  Select,
  Typography,
  type SelectChangeEvent,
  type SxProps,
} from '@mui/material';
import { useSnackbar } from 'notistack';

import { useConfirmation } from '~/common/components';
import { operatorRoles, managerRoles, adminRoles } from '~/common/constants';
import { QUERY_RESPONSE_KEYS, useInfiniteQuery, useUserChip } from '~/common/hooks';
import { useAuthContext } from '~/context/AuthContext';
import { AdminOperatorsDocument, type AdminOperatorsQuery } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import {
  type AssignSelectorBaseProps,
  isOperatorInOtherTeams,
  useChatActions,
  useChatRoomContext,
} from '~/modules/Chat';
import { type IUser } from '~/modules/Users';
import { uniqueKey } from '~/utils';

export type SelectableOperatorType = {
  id: string;
  displayName: string;
  email: string;
  status: string;
  disabled?: boolean;
};

export type GroupedOptionsType = {
  teamName: string;
  options: SelectableOperatorType[];
};

const selectStyle: SxProps = {
  height: '40px',
  width: '100%',
};

const selectOptionStyle: SxProps = {
  marginLeft: 2,
};

export const OperatorSelector = ({ onChange }: AssignSelectorBaseProps) => {
  const [value, setValue] = useState<string>('');

  const { user, isAdminUser } = useAuthContext();
  const { targetChat, teamsInChat } = useChatRoomContext();
  const { assignOperator, updateChatLatestRead } = useChatActions();

  const { data: adminOperators } = useInfiniteQuery<
    typeof QUERY_RESPONSE_KEYS.adminOperators,
    AdminOperatorsQuery
  >(AdminOperatorsDocument, QUERY_RESPONSE_KEYS.adminOperators, {
    pickAll: true,
    skipInitialFetch: !isAdminUser,
  });
  const { requestConfirmation } = useConfirmation();
  const { enqueueSnackbar } = useSnackbar();
  const { t, t_chat, t_toasts, t_errors } = useTranslation();
  const { getChipLabelWithStatus } = useUserChip();

  useEffect(() => {
    if (targetChat) {
      setValue(targetChat.assignedUserId || '');
    }
  }, [targetChat]);

  if (!user || !targetChat) {
    return null;
  }

  const isOperator = operatorRoles.includes(user.roleType);
  const isManager = managerRoles.includes(user.roleType);
  const isAdmin = adminRoles.includes(user.roleType);

  const currentAssigneeId = targetChat.assignedUserId;
  const isCurrentAssigneeInOtherTeam = currentAssigneeId
    ? isOperatorInOtherTeams({
        operatorId: currentAssigneeId,
        isAdmin,
        teams: user.teams || [],
        teamsInChat,
      })
    : false;

  const groupedOptions: GroupedOptionsType[] = teamsInChat
    .filter((teamInChat) =>
      targetChat.chatTeamAssignment.map((team) => team.teamId).includes(teamInChat.id),
    )
    .map((team) => {
      const filteredOperators = team.operators.filter((operator) => operator.id !== value);
      const options = filteredOperators.map((operator) => ({
        id: operator.id,
        displayName: operator.displayName,
        email: operator.email,
        status: operator.status,
        disabled: isOperatorInOtherTeams({
          operatorId: operator.id,
          isAdmin,
          teams: user?.teams || [],
          teamsInChat,
        }),
      }));

      return {
        teamName: team.name,
        options,
      };
    });

  if (isAdmin) {
    adminOperators?.forEach((operator) => {
      const isAdminGroupCreated = groupedOptions.find((group) => group.teamName === 'Admin');
      if (isAdminGroupCreated) {
        isAdminGroupCreated.options.push({
          id: operator.id,
          displayName: operator.displayName,
          email: operator.email,
          status: operator.status,
          disabled: false,
        });
      } else {
        groupedOptions.push({
          teamName: 'Admin',
          options: [
            {
              id: operator.id,
              displayName: operator.displayName,
              email: operator.email,
              status: operator.status,
              disabled: false,
            },
          ],
        });
      }
    });
  }

  const groupedOptionsByTeam: GroupedOptionsType[] = groupedOptions.filter((group) =>
    group.options.some((option) => option.id !== value),
  );

  const validateOperatorActions = (newAssigneeId: string): boolean => {
    if (!isOperator) return true;

    const isAssignedToMe = currentAssigneeId === user.id;
    const isFirstAssignee = !currentAssigneeId;
    const isAssignedToOther = newAssigneeId !== user.id;

    if (isFirstAssignee && isAssignedToOther) {
      enqueueSnackbar(t_toasts('operatorSelector.error.onlyYourself'), { variant: 'error' });
      return false;
    }

    if (!isFirstAssignee && !isAssignedToMe) {
      enqueueSnackbar(t_toasts('operatorSelector.error.notAuthorized'), {
        variant: 'error',
      });
      return false;
    }

    return true;
  };

  const validateManagerOrOperatorActions = (): boolean => {
    const isManagerOrOperator = isManager || isOperator;

    if (!isManagerOrOperator) return true;
    if (isCurrentAssigneeInOtherTeam) {
      enqueueSnackbar(t_toasts('operatorSelector.error.cannotReassignToOtherTeam'), {
        variant: 'error',
      });
      return false;
    }

    return true;
  };

  const validateTeamMember = (newAssigneeId: string) => {
    const isInOtherTeam = isOperatorInOtherTeams({
      operatorId: newAssigneeId,
      isAdmin,
      teams: user.teams || [],
      teamsInChat,
    });

    if (isInOtherTeam) {
      enqueueSnackbar(t_toasts('operatorSelector.error.cannotAssignToOtherTeam'), {
        variant: 'error',
      });
      return false;
    }

    return true;
  };

  const handleOperatorChange = async (event: SelectChangeEvent<IUser['id']>) => {
    const isConfirmed = await requestConfirmation({
      title: t('confirmation'),
      message: t('info.sureToChangeOperator'),
      confirmText: t('actions.confirm'),
      cancelText: t('actions.cancel'),
    });

    if (!isConfirmed) {
      return;
    }

    const newAssigneeId = event.target.value;

    const isValidOperatorAction = validateOperatorActions(newAssigneeId);
    if (!isValidOperatorAction) return;

    const isValidManagerOrOperatorAction = validateManagerOrOperatorActions();
    if (!isValidManagerOrOperatorAction) return;

    const isTeamMember = validateTeamMember(newAssigneeId);
    if (!isTeamMember) return;

    const isAssigned = await assignOperator(targetChat.id, newAssigneeId);
    if (!isAssigned) return;

    if (onChange) onChange();
    if (newAssigneeId === user.id && targetChat.latestMessageTimestamp) {
      updateChatLatestRead(targetChat.id, targetChat.latestMessageTimestamp);
    }
  };

  const isDisabled =
    isCurrentAssigneeInOtherTeam || (isOperator && value !== user.id && value !== '');

  const labels = {
    assignedToMe: t_chat('assignedToMe'),
    unassigned: t_chat('unassigned'),
    unknown: t_chat('unknown'),
  };

  return (
    <Select
      value={value}
      onChange={handleOperatorChange}
      input={<OutlinedInput />}
      displayEmpty
      renderValue={(selected) => getRenderValue(labels, selected, user, targetChat.assignedUser)}
      sx={selectStyle}
      size='small'
      disabled={isDisabled}
      MenuProps={{
        sx: {
          '.MuiMenu-paper': {
            maxHeight: 400,
          },
        },
      }}
    >
      {groupedOptionsByTeam.length > 0 ? (
        groupedOptionsByTeam
          .map(({ teamName, options }) => [
            <ListSubheader
              key={teamName}
              sx={{
                lineHeight: 2,
                color: 'text.secondary',
              }}
            >
              {teamName} {options.length === 0 ? t_errors('operator.notFound') : ''}
            </ListSubheader>,
            [
              ...options.map((option) => (
                <MenuItem
                  key={uniqueKey()}
                  value={option.id}
                  disabled={option.disabled}
                  sx={{
                    ...selectOptionStyle,
                    display: value === option.id ? 'none' : 'block',
                  }}
                >
                  {getChipLabelWithStatus(option)}
                </MenuItem>
              )),
            ],
          ]) // NOTE: Due to limitations within Material UI, we cannot utilize fragments in this instance. As a workaround, we are using an array.
          .flat()
      ) : (
        <Typography sx={{ mx: 2, opacity: 0.6 }}>{t('noOptions')}</Typography>
      )}
      {/* NOTE: Suppresses out-of-range value warning when filtering removes a selected MenuItem */}
      {value !== '' && (
        <MenuItem value={value} sx={{ display: 'none' }}>
          {targetChat.assignedUser?.displayName}
        </MenuItem>
      )}
    </Select>
  );
};

const getRenderValue = (
  labels: Record<string, string>,
  selected: string,
  user: IUser | null,
  assignee?: IUser | null,
) => {
  if (!selected) {
    return (
      <Typography sx={{ fontSize: '14px', lineHeight: 'inherit' }}>{labels.unassigned}</Typography>
    );
  }

  if (user && selected === user.id) {
    return <Chip label={labels.assignedToMe} size='small' />;
  }

  const assignedOperator = assignee ? assignee.displayName : labels.unknown;

  return <Chip label={assignedOperator} size='small' />;
};
