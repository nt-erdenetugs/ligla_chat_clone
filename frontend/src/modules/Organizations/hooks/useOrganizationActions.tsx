import { useState, useEffect, useCallback } from 'react';

import { useLazyQuery, useMutation, useQuery } from '@apollo/client';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router';

import { HYPERVISOR_ROUTE } from '~/common/constants';
import {
  CreateOrganizationDocument,
  type CreateOrganizationMutation,
  OrganizationDocument,
  type OrganizationQuery,
  OrganizationsDocument,
  type OrganizationsQuery,
  UpdateOrganizationDocument,
  type UpdateOrganizationMutation,
  type ToggleOrganizationStatusMutation,
  ToggleOrganizationStatusDocument,
} from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { type Inputs, type IOrganization } from '~/modules/Organizations';
import { PAGES } from '~/routes/sidebar';
import { onError } from '~/utils';

type ID = IOrganization['name'];

export const useOrganizationActions = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { t_toasts } = useTranslation();
  const navigate = useNavigate();

  const [organizations, setOrganizations] = useState<IOrganization[]>([]);
  const [targetOrganization, _setTargetOrganization] = useState<Nullish<IOrganization>>(null);

  // TODO: Remove organizations query after pagination feature [phase 2][task 94140238]
  const { data: organizationsData, loading } = useQuery<OrganizationsQuery>(OrganizationsDocument);

  const [getOrganization, { data: organizationData, loading: isFetchingOne, error }] =
    useLazyQuery<OrganizationQuery>(OrganizationDocument);

  useEffect(() => {
    if (!organizationData) return;
    _setTargetOrganization(organizationData.organization as IOrganization);
  }, [organizationData]);

  useEffect(() => {
    if (error) {
      console.error(error.message);
      enqueueSnackbar(error.message, { variant: 'error' });
      navigate(`${HYPERVISOR_ROUTE}/${PAGES.ORGANIZATIONS}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const [_createOrganization, { loading: isCreating }] = useMutation<CreateOrganizationMutation>(
    CreateOrganizationDocument,
    {
      refetchQueries: ['paginatedOrganizations'],
      onCompleted: () => {
        enqueueSnackbar(t_toasts('organization.success.create'), { variant: 'success' });
      },
      onError,
    },
  );

  const [_updateOrganization, { loading: isUpdating }] = useMutation<UpdateOrganizationMutation>(
    UpdateOrganizationDocument,
    {
      refetchQueries: ['paginatedOrganizations'],
      onCompleted: () => {
        enqueueSnackbar(t_toasts('organization.success.update'), { variant: 'success' });
      },
      onError,
    },
  );

  const [_toggleOrganizationStatus] = useMutation<ToggleOrganizationStatusMutation>(
    ToggleOrganizationStatusDocument,
    {
      refetchQueries: ['paginatedOrganizations'],
      onCompleted: () => {
        enqueueSnackbar(t_toasts('organization.success.update'), { variant: 'success' });
      },
      onError,
    },
  );

  useEffect(() => {
    if (!organizationsData) return;
    const organizations = organizationsData.organizations;
    const items: IOrganization[] = Array.isArray(organizations)
      ? (organizations as IOrganization[])
      : organizations && typeof organizations === 'object' && 'items' in organizations
        ? (organizations.items as IOrganization[])
        : [];

    setOrganizations(items);
  }, [organizationsData]);

  const setTargetOrganization = useCallback(
    (name: ID) => {
      const currentData = organizations.find((org) => org.name === name);

      if (currentData) {
        _setTargetOrganization(currentData);
      } else {
        getOrganization({
          variables: { name },
        });
      }
    },
    [getOrganization, organizations],
  );

  const removeTargetOrganization = () => {
    _setTargetOrganization(null);
  };

  const createOrganization = async (inputs: Inputs) => {
    await _createOrganization({
      variables: {
        createOrganizationInput: {
          ...inputs,
        },
      },
    });
  };

  const updateOrganization = async (inputs: Inputs) => {
    await _updateOrganization({
      variables: {
        updateOrganizationInput: {
          ...inputs,
        },
      },
    });
  };

  const toggleOrganizationStatus = async (name: string) => {
    await _toggleOrganizationStatus({
      variables: {
        name,
      },
    });
  };

  return {
    organizations,
    targetOrganization,
    isFetchingAll: loading,
    isFetchingOne,
    isCreating,
    isUpdating,
    setTargetOrganization,
    removeTargetOrganization,
    createOrganization,
    updateOrganization,
    toggleOrganizationStatus,
  };
};
