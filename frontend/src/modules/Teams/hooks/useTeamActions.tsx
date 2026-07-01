import { useState, useCallback, useEffect } from 'react';

import { useLazyQuery, useMutation } from '@apollo/client';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router';

import {
  CreateTeamDocument,
  type CreateTeamMutation,
  TeamDocument,
  type TeamQuery,
  DisableTeamDocument,
  type DisableTeamMutation,
  UpdateTeamDocument,
  type UpdateTeamMutation,
  type ToggleTeamStatusMutation,
  ToggleTeamStatusDocument,
} from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { type Inputs, type ITeam } from '~/modules/Teams';
import { PAGES } from '~/routes/sidebar';
import { onError } from '~/utils';

type ID = ITeam['id'];

export const useTeamActions = (organizationId?: string) => {
  const { enqueueSnackbar } = useSnackbar();
  const { t_toasts } = useTranslation();
  const navigate = useNavigate();

  const [targetTeam, _setTargetTeam] = useState<Nullish<ITeam>>(null);

  const [getTeam, { data: teamData, loading: isFetchingOne, error }] = useLazyQuery<TeamQuery>(
    TeamDocument,
    {
      errorPolicy: 'all',
    },
  );

  useEffect(() => {
    if (!teamData) return;
    _setTargetTeam(teamData.team as ITeam);
  }, [teamData]);

  useEffect(() => {
    if (error) {
      console.error(error.message);
      enqueueSnackbar(error.message, { variant: 'error' });
      navigate(`/${PAGES.TEAMS}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const [_createTeam, { loading: isCreating }] = useMutation<CreateTeamMutation>(
    CreateTeamDocument,
    {
      refetchQueries: ['paginatedTeams', 'selectableTeams'],
      onCompleted: () => {
        enqueueSnackbar(t_toasts('team.success.create'), { variant: 'success' });
      },
      onError,
    },
  );

  const [_updateTeam, { loading: isUpdating }] = useMutation<UpdateTeamMutation>(
    UpdateTeamDocument,
    {
      refetchQueries: ['paginatedTeams', 'selectableTeams'],
      onCompleted: () => {
        enqueueSnackbar(t_toasts('team.success.update'), { variant: 'success' });
      },
      onError,
    },
  );

  const [_toggleTeamStatus] = useMutation<ToggleTeamStatusMutation>(ToggleTeamStatusDocument, {
    refetchQueries: ['paginatedTeams', 'selectableTeams'],
    onCompleted: () => {
      enqueueSnackbar(t_toasts('team.success.update'), { variant: 'success' });
    },
    onError,
  });

  const [_disableTeam] = useMutation<DisableTeamMutation>(DisableTeamDocument, {
    refetchQueries: ['paginatedTeams', 'selectableTeams'],
    onCompleted: () => {
      enqueueSnackbar(t_toasts('team.success.disable'), { variant: 'success' });
    },
    onError,
  });

  const setTargetTeam = useCallback(
    (id: ID, variables?: object) => {
      getTeam({
        variables: { id, ...variables },
      });
    },
    [getTeam],
  );

  const removeTargetTeam = () => {
    _setTargetTeam(null);
  };

  const createTeam = useCallback(
    async (inputs: Inputs) => {
      const createTeamInput = {
        managerIds: inputs.managerIds,
        operatorIds: inputs.operatorIds,
        storeIds: inputs.storeIds,
        name: inputs.name,
        teamSetting: inputs.teamSetting,
      };
      await _createTeam({
        variables: {
          createTeamInput,
          organizationId,
        },
      });
    },
    [organizationId, _createTeam],
  );

  const updateTeam = async (id: string, inputs: Inputs) => {
    await _updateTeam({
      variables: {
        updateTeamInput: {
          id,
          ...inputs,
        },
        organizationId,
      },
    });
  };

  const toggleTeamStatus = async (id: string) => {
    await _toggleTeamStatus({
      variables: {
        id,
        organizationId,
      },
    });
  };

  const disableTeam = async (id: ID) => {
    await _disableTeam({
      variables: {
        disableTeamId: id,
        organizationId,
      },
    });
  };

  return {
    targetTeam,
    isFetchingOne,
    isCreating,
    isUpdating,
    setTargetTeam,
    removeTargetTeam,
    createTeam,
    updateTeam,
    toggleTeamStatus,
    disableTeam,
  };
};
