import { useMutation } from '@apollo/client';
import { useSnackbar } from 'notistack';

import {
  FillChatAttributeValueDocument,
  type FillChatAttributeValueMutation,
} from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { useChatActions } from '~/modules/Chat';
import { onError } from '~/utils';

export const useChatAttributesActions = (chatId: string) => {
  const { enqueueSnackbar } = useSnackbar();
  const { refetchTargetChat } = useChatActions();
  const { t_toasts } = useTranslation();

  const [_fillChatAttributeValue] = useMutation<FillChatAttributeValueMutation>(
    FillChatAttributeValueDocument,
    {
      onCompleted: async () => {
        // NOTE:
        // `refetchQueries` does not trigger the `onCompleted` callback of `useLazyQuery`.
        // We are updating the chat context using React's `useState`, which relies on the `onCompleted` callback.
        // Therefore, we need to manually refetch the data to ensure the state values (managed in the chat context) are updated correctly.
        await refetchTargetChat();
        enqueueSnackbar(t_toasts('attribute.success.fill'), { variant: 'success' });
      },
      onError,
    },
  );

  const fillChatAttributeValue = ({
    attributeId,
    value,
  }: {
    attributeId: string;
    value: string;
  }) => {
    return _fillChatAttributeValue({
      variables: {
        createChatAttributeValueInput: {
          chatId,
          attributeId,
          value,
        },
      },
    });
  };

  return {
    fillChatAttributeValue,
  };
};
