import { useState, useEffect, useCallback } from 'react';

import { useLazyQuery, useMutation, useQuery } from '@apollo/client';
import { useSnackbar } from 'notistack';

import {
  CreateAttributeDocument,
  type CreateAttributeMutation,
  AttributeDocument,
  type AttributeQuery,
  AttributesDocument,
  type AttributesQuery,
  UpdateAttributeDocument,
  type UpdateAttributeMutation,
  DisableAttributeDocument,
  type DisableAttributeMutation,
  type ToggleAttributeStatusMutation,
  ToggleAttributeStatusDocument,
} from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { type Inputs, type IAttribute } from '~/modules/Attributes';
import { onError } from '~/utils';

export const useAttributesActions = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { t_toasts } = useTranslation();

  const [attributes, setAttributes] = useState<IAttribute[]>([]);
  const [targetAttribute, _setTargetAttribute] = useState<Nullish<IAttribute>>(null);

  // TODO: Remove attributes query after pagination feature [phase 2][94140238]
  const { data: attributesData, loading: isFetchingAll } =
    useQuery<AttributesQuery>(AttributesDocument);

  const [getAttribute, { data, loading: isFetchingOne, error }] = useLazyQuery<AttributeQuery>(
    AttributeDocument,
    {
      errorPolicy: 'all',
    },
  );

  useEffect(() => {
    if (data?.attribute) _setTargetAttribute(data.attribute as IAttribute);
  }, [data]);

  useEffect(() => {
    if (error) {
      enqueueSnackbar(error.message, { variant: 'error' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const [_createAttribute, { loading: isCreating }] = useMutation<CreateAttributeMutation>(
    CreateAttributeDocument,
    {
      refetchQueries: ['paginatedAttributes'],
      onCompleted: () => {
        enqueueSnackbar(t_toasts('attribute.success.create'), { variant: 'success' });
      },
      onError,
    },
  );

  const [_updateAttribute, { loading: isUpdating }] = useMutation<UpdateAttributeMutation>(
    UpdateAttributeDocument,
    {
      refetchQueries: ['paginatedAttributes'],
      onCompleted: () => {
        enqueueSnackbar(t_toasts('attribute.success.update'), { variant: 'success' });
      },
      onError,
    },
  );

  const [_toggleAttributeStatus] = useMutation<ToggleAttributeStatusMutation>(
    ToggleAttributeStatusDocument,
    {
      refetchQueries: ['paginatedAttributes'],
      onCompleted: () => {
        enqueueSnackbar(t_toasts('attribute.success.update'), { variant: 'success' });
      },
      onError,
    },
  );

  const [_disableAttribute] = useMutation<DisableAttributeMutation>(DisableAttributeDocument, {
    refetchQueries: ['paginatedAttributes'],
    onCompleted: () => {
      enqueueSnackbar(t_toasts('attribute.success.disable'), { variant: 'success' });
    },
    onError,
  });

  const disableAttribute = async (id: string) => {
    await _disableAttribute({
      variables: {
        id,
      },
    });
  };

  useEffect(() => {
    if (!attributesData) return;

    const items = attributesData.attributes?.items ?? [];
    setAttributes(items as IAttribute[]);
  }, [attributesData]);

  const setTargetAttribute = useCallback(
    (id: string) => {
      const currentData = attributes.find((attribute) => attribute.id === id);

      if (currentData) {
        _setTargetAttribute(currentData);
      } else {
        getAttribute({
          variables: { id },
        });
      }
    },
    [getAttribute, attributes],
  );

  const removeTargetAttribute = () => {
    _setTargetAttribute(null);
  };

  const createAttribute = async (inputs: Inputs) => {
    await _createAttribute({
      variables: {
        createAttributeInput: {
          ...inputs,
        },
      },
    });
  };

  const updateAttribute = async (inputs: Inputs) => {
    if (!targetAttribute) {
      enqueueSnackbar(t_toasts('attribute.error.noAttributeSelected'), { variant: 'error' });
      return;
    }

    const { isEncryptionEnabled: _omit, ...rest } = inputs;

    await _updateAttribute({
      variables: {
        updateAttributeInput: {
          id: targetAttribute.id,
          ...rest,
        },
      },
    });
  };

  const toggleAttributeStatus = async (id: string) => {
    await _toggleAttributeStatus({
      variables: {
        id,
      },
    });
  };

  return {
    attributes,
    targetAttribute,
    isFetchingAll,
    isFetchingOne,
    isCreating,
    isUpdating,
    setTargetAttribute,
    removeTargetAttribute,
    createAttribute,
    updateAttribute,
    toggleAttributeStatus,
    disableAttribute,
  };
};
