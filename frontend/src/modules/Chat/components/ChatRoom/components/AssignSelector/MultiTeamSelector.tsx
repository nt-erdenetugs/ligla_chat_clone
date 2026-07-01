import { useEffect, useState } from 'react';

import {
  Autocomplete,
  TextField,
  type TextFieldProps,
  type AutocompleteChangeReason,
} from '@mui/material';
import { useSnackbar } from 'notistack';

import { useConfirmation } from '~/common/components';
import { operatorRoles, managerRoles, adminRoles } from '~/common/constants';
import { useAuthContext } from '~/context/AuthContext';
import { UserRoleType } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import {
  type AssignSelectorBaseProps,
  useChatActions,
  useChatRoomContext,
  type ITeamsInChat,
} from '~/modules/Chat';

import { type SelectableOperatorType } from './OperatorSelector';

export type SelectableTeamsType = {
  id: string;
  name: string;
  operators: SelectableOperatorType[];
};

const autocompleteProps = {
  style: {
    width: '100%',
    minWidth: '100%',
    '.MuiInputBase-root': {
      '&:hover': {
        cursor: 'pointer',
      },
    },
  },
  slotProps: {
    chip: { sx: { height: '100%' }, size: 'small' },
  },
};

const getOperatorsByTeamId = (teamId: string, teams: ITeamsInChat[]) => {
  const targetTeam = teams.find((team) => team.id === teamId);

  if (!targetTeam) {
    return [];
  }

  return targetTeam.operators.map((operator) => ({
    id: operator.id,
    displayName: operator.displayName,
    teamName: targetTeam.name,
  }));
};

export const MultiTeamSelector = ({ onChange }: AssignSelectorBaseProps) => {
  const [value, setValue] = useState<SelectableTeamsType[]>([]);

  const { user } = useAuthContext();

  const { targetChat, teamsInChat } = useChatRoomContext();
  const { assignTeam, unassignTeam } = useChatActions();

  const { enqueueSnackbar } = useSnackbar();
  const { requestConfirmation } = useConfirmation();
  const { t, t_toasts } = useTranslation();

  const options = teamsInChat.map((team) => ({
    id: team.id,
    name: team.name,
    operators: team.operators.map((operator) => ({
      id: operator.id,
      displayName: operator.displayName,
    })),
  }));

  useEffect(() => {
    if (targetChat) {
      const chatTeamAssignment = targetChat.chatTeamAssignment;
      const defaultValue = chatTeamAssignment.map(({ team }) => ({
        id: team.id,
        name: team.name,
        operators: getOperatorsByTeamId(team.id, teamsInChat),
      }));

      setValue(defaultValue as unknown as SelectableTeamsType[]);
    }
  }, [targetChat, teamsInChat, user]);

  if (!user || !targetChat) {
    return null;
  }

  const chatId = targetChat.id;
  const isOperator = operatorRoles.includes(user.roleType);
  const isManager = managerRoles.includes(user.roleType);

  const getTeamCountOfAssignedOperator = (): number => {
    return value.reduce((count, team) => {
      const isOperatorAssigned = team.operators.some(
        (operator) => operator.id === targetChat.assignedUserId,
      );

      return isOperatorAssigned ? count + 1 : count;
    }, 0);
  };

  const validateTeamAssignment = (teamIds: string[]): boolean => {
    if (teamIds.length === 0) {
      enqueueSnackbar(t_toasts('team.error.mustHaveOneTeam'), { variant: 'error' });
      return false;
    }

    if (options && options.length > 0) {
      const targetTeams = options.filter((team) => teamIds.includes(team.id));

      const totalOperators = targetTeams.reduce((acc, team) => acc + team.operators.length, 0);

      if (totalOperators === 0) {
        const isAdminAssigned =
          targetChat.assignedUser && adminRoles.includes(targetChat.assignedUser.roleType);
        if (!isAdminAssigned) {
          enqueueSnackbar(t_toasts('team.error.mustHaveOneOperator'), {
            variant: 'error',
          });
          return false;
        }
      }
    }
    return true;
  };

  const validateRemovableTeams = (teamIdsToRemove: string[]): boolean => {
    if (isManager) {
      const assignedTeamIds = user.teams?.map((team) => team.id) || [];
      const isAttemptingToRemoveOtherTeam = teamIdsToRemove.every(
        (teamId) => !assignedTeamIds.includes(teamId),
      );

      if (isAttemptingToRemoveOtherTeam) {
        enqueueSnackbar(t_toasts('team.error.cannotRemoveYourTeam'), {
          variant: 'error',
        });
        return false;
      }
    }

    const unassignedTeams = teamsInChat.filter((team) => teamIdsToRemove.includes(team.id));

    const isAttemptingToRemoveDefaultTeam = unassignedTeams.some((team) => team.isDefault);
    const isAdminAssigned =
      targetChat.assignedUser && adminRoles.includes(targetChat.assignedUser.roleType);

    if (isAttemptingToRemoveDefaultTeam && isAdminAssigned) {
      enqueueSnackbar(t_toasts('team.error.cannotRemoveDefaultTeamWithAdmin'), {
        variant: 'error',
      });
      return false;
    }

    const isAttemptingToRemoveAssignedOperatorLastTeam = getTeamCountOfAssignedOperator() === 1;

    if (isAttemptingToRemoveAssignedOperatorLastTeam) {
      const isAttemptingToRemoveAssignedOperatorTeam = unassignedTeams.some((teams) =>
        teams.operators.some((operator) => operator.id === targetChat.assignedUserId),
      );

      if (isAttemptingToRemoveAssignedOperatorTeam) {
        enqueueSnackbar(t_toasts('team.error.cannotRemoveTeamWithOperators'), {
          variant: 'error',
        });
        return false;
      }
    }

    return true;
  };

  const handleTeamChange = async (
    modifiedValue: SelectableTeamsType[],
    reason: AutocompleteChangeReason,
  ) => {
    const isConfirmed = await requestConfirmation({
      title: t('confirmation'),
      message: t('info.sureToChangeTeam'),
      confirmText: t('actions.confirm'),
      cancelText: t('actions.cancel'),
    });

    if (!isConfirmed) return;

    if (isOperator) {
      enqueueSnackbar(t_toasts('team.error.notAuthorizedToAssignChat'), { variant: 'error' });
      return;
    }

    const teamIds = modifiedValue.map((team) => team.id);

    const isValidTeamAssignment = validateTeamAssignment(teamIds);
    if (!isValidTeamAssignment) return;

    let isActionCompleted = false;
    if (reason === 'removeOption') {
      const teamIdsToRemove = value
        .map((team) => team.id)
        .filter((teamId) => !teamIds.includes(teamId));

      const isTeamsRemovable = validateRemovableTeams(teamIdsToRemove);
      if (!isTeamsRemovable) return;

      /*
       * NOTE:
       * Using MUI Autocomplete with multiple options for better UI.
       * The built-in functionality returns an array of options.
       * Clearable option is disabled, so only one team can be removed at a time.
       */
      const teamIdToRemove = teamIdsToRemove[0];
      const isRemoved = await unassignTeam(chatId, teamIdToRemove);
      if (isRemoved) isActionCompleted = true;
    }

    if (reason === 'selectOption') {
      const teamIdsToAdd = teamIds.filter(
        (teamId) => !value.map((team) => team.id).includes(teamId),
      );

      // NOTE: Only one team can be added at a time, same as removing
      const teamIdToAdd = teamIdsToAdd[0];
      const isAdded = await assignTeam(chatId, teamIdToAdd);
      if (isAdded) isActionCompleted = true;
    }

    if (isActionCompleted) {
      setValue(modifiedValue);
      if (onChange) onChange();
    }
  };

  const isDisabled = !!user && user.roleType === UserRoleType.Operator;

  return (
    <Autocomplete
      multiple
      options={options}
      getOptionLabel={(option) => option.name}
      value={value}
      onChange={(_event, value, reason) => {
        handleTeamChange(value as SelectableTeamsType[], reason);
      }}
      limitTags={5}
      slotProps={autocompleteProps.slotProps}
      renderInput={(params) => {
        const textFieldProps: TextFieldProps = {
          ...params,
          size: 'small',
          slotProps: {
            htmlInput: {
              ...params.inputProps,
              style: {
                display: 'none',
              },
            },
          },
        };

        return (
          <TextField
            sx={{
              '& .MuiInputBase-root': {
                minHeight: '40px',
              },
            }}
            {...textFieldProps}
          />
        );
      }}
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          {option.name}
        </li>
      )}
      getOptionKey={(option) => option.id}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      disableClearable
      readOnly={isDisabled}
      disabled={isDisabled}
      sx={autocompleteProps.style}
    />
  );
};
