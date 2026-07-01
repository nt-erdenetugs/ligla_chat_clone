import { useState, useEffect, useCallback } from 'react';

import { useLazyQuery, useMutation, useQuery } from '@apollo/client';
import { useSnackbar } from 'notistack';

import {
  CreateTagDocument,
  type CreateTagMutation,
  DisableTagDocument,
  type DisableTagMutation,
  TagDocument,
  type TagQuery,
  TagsDocument,
  UpdateTagDocument,
  type UpdateTagMutation,
  type TagsQuery,
  type ToggleTagStatusMutation,
  ToggleTagStatusDocument,
} from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { type Inputs, type ID, type ITag } from '~/modules/Tags';
import { onError } from '~/utils';

export const useTagActions = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { t_toasts } = useTranslation();
  const [tags, setTags] = useState<ITag[]>([]);
  const [targetTag, _setTargetTag] = useState<Nullish<ITag>>(null);
  const [isFetchingAll, setIsFetchingAll] = useState(true);

  // TODO: Remove tags query after pagination feature [phase 2][task 94140238]
  const { data: tagsData, error } = useQuery<TagsQuery>(TagsDocument);

  useEffect(() => {
    if (error) {
      setIsFetchingAll(false);
      onError(error);
    }
  }, [error]);

  const [getTag, { data: tagData, loading: isFetchingOne, error: getTagError }] =
    useLazyQuery<TagQuery>(TagDocument, {
      errorPolicy: 'all',
    });

  useEffect(() => {
    if (!tagData) return;
    _setTargetTag(tagData.tag);
  }, [tagData]);

  useEffect(() => {
    if (getTagError) {
      console.error(getTagError.message);
      enqueueSnackbar(getTagError.message, { variant: 'error' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getTagError]);

  const [_createTag, { loading: isCreating }] = useMutation<CreateTagMutation>(CreateTagDocument, {
    refetchQueries: ['tags'],
    onCompleted: () => {
      enqueueSnackbar(t_toasts('tag.success.create'), { variant: 'success' });
    },
    onError,
  });

  const [_updateTag, { loading: isUpdating }] = useMutation<UpdateTagMutation>(UpdateTagDocument, {
    refetchQueries: ['tags'],
    onCompleted: () => {
      enqueueSnackbar(t_toasts('tag.success.update'), { variant: 'success' });
    },
    onError,
  });

  const [_toggleTagStatus] = useMutation<ToggleTagStatusMutation>(ToggleTagStatusDocument, {
    refetchQueries: ['tags'],
    onCompleted: () => {
      enqueueSnackbar(t_toasts('tag.success.update'), { variant: 'success' });
    },
    onError,
  });

  const [_disableTag] = useMutation<DisableTagMutation>(DisableTagDocument, {
    refetchQueries: ['tags'],
    onCompleted: () => {
      enqueueSnackbar(t_toasts('tag.success.disable'), { variant: 'success' });
    },
    onError,
  });

  useEffect(() => {
    if (!tagsData) return;

    const tags = tagsData.tags;
    if (Array.isArray(tags)) {
      setTags(tags);
    } else if (tags && Array.isArray(tags.items)) {
      setTags(tags.items);
    } else {
      setTags([]);
    }
    setIsFetchingAll(false);
  }, [tagsData]);

  const setTargetTag = useCallback(
    (id: ID) => {
      const currentData = tags.find((tag) => tag.id === id);
      if (currentData) {
        _setTargetTag(currentData);
      } else {
        getTag({
          variables: { id },
        });
      }
    },
    [getTag, tags],
  );

  const removeTargetTag = () => {
    _setTargetTag(null);
  };

  const createTag = async (inputs: Inputs) => {
    await _createTag({
      variables: {
        createTagInput: {
          ...inputs,
        },
      },
    });
  };

  const updateTag = async (id: string, inputs: Inputs) => {
    await _updateTag({
      variables: {
        updateTagInput: {
          id,
          ...inputs,
        },
      },
    });
  };

  const disableTag = async (id: string) => {
    await _disableTag({
      variables: {
        id,
      },
    });
  };

  const toggleTagStatus = async (id: string) => {
    await _toggleTagStatus({
      variables: {
        id,
      },
    });
  };

  return {
    tags,
    targetTag,
    isFetchingAll,
    isFetchingOne,
    isCreating,
    isUpdating,
    setTargetTag,
    removeTargetTag,
    createTag,
    updateTag,
    toggleTagStatus,
    disableTag,
  };
};
