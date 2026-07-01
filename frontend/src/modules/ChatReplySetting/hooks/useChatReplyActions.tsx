import { useEffect, useState } from 'react';

import { useMutation, useQuery } from '@apollo/client';
import dayjs, { type Dayjs } from 'dayjs';
import { useSnackbar } from 'notistack';

import { useAuthContext } from '~/context/AuthContext';
import {
  ChatReplySettingDocument,
  UpdateChatReplySettingDocument,
  type UpdateChatReplySettingMutation,
  type ChatReplySettingQuery,
  type CreateChatReplySettingMutation,
  CreateChatReplySettingDocument,
  ChatReplyScheduleType,
} from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import {
  type Schedule,
  type IChatReplySetting,
  specialDays,
  defaultSchedules,
} from '~/modules/ChatReplySetting';

export const useChatReplyActions = (includeOrgName = true) => {
  const { enqueueSnackbar } = useSnackbar();
  const { t_toasts } = useTranslation();
  const { user } = useAuthContext();
  const [chatReplySetting, setChatReplySetting] = useState<Nullable<IChatReplySetting>>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [schedules, setSchedules] = useState<Optional<Schedule[]>>(defaultSchedules);
  const [customDates, setCustomDates] = useState<Dayjs[]>([]);
  const [prevCustomDates, setPrevCustomDates] = useState<Dayjs[]>([]);

  const inputOrganizationId = user?.organization?.id;
  const variables = includeOrgName && inputOrganizationId ? { inputOrganizationId } : {};

  const { data: chatReplySettingData, error } = useQuery<ChatReplySettingQuery>(
    ChatReplySettingDocument,
    {
      variables,
      errorPolicy: 'all',
    },
  );

  useEffect(() => {
    if (!chatReplySettingData?.chatReplySetting) {
      setChatReplySetting(null);
      setSchedules(defaultSchedules);
      setCustomDates([]);
      setPrevCustomDates([]);

      setIsLoading(false);
      return;
    }
    const _chatReplySetting = chatReplySettingData.chatReplySetting as IChatReplySetting;
    setChatReplySetting(_chatReplySetting);

    const schedules = _chatReplySetting.chatReplySchedules.map((schedule) => ({
      scheduleType: schedule.scheduleType,
      isSpecialDay: specialDays.includes(schedule.scheduleType),
      timeRanges: schedule.chatReplyScheduleTimeRanges.map((timeRange) => ({
        start: timeRange.startTime,
        end: timeRange.endTime,
      })),
    })) as Schedule[];

    const customDates =
      _chatReplySetting.chatReplySchedules
        .find((schedule) => schedule.scheduleType === ChatReplyScheduleType.CustomDate)
        ?.chatReplyScheduleCustomDates?.filter((date) => (date ? new Date(date) : null)) || [];

    setSchedules(schedules);
    setCustomDates(customDates.map(dayjs));
    setPrevCustomDates(customDates.map(dayjs));
    setIsLoading(false);
  }, [chatReplySettingData]);

  useEffect(() => {
    if (error) {
      setIsLoading(false);
      console.error(error.message);
      enqueueSnackbar(error.message, { variant: 'error' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const [createChatReplySetting, { loading: isCreating }] =
    useMutation<CreateChatReplySettingMutation>(CreateChatReplySettingDocument, {
      onCompleted(data) {
        if (data.createChatReplySetting) {
          setChatReplySetting(data.createChatReplySetting);
          enqueueSnackbar(t_toasts('chatReplySetting.success.create'), { variant: 'success' });
        } else {
          enqueueSnackbar(t_toasts('chatReplySetting.error.create'), { variant: 'error' });
        }
      },
      onError(error) {
        console.error(error.message);
        enqueueSnackbar(error.message, { variant: 'error' });
      },
      errorPolicy: 'all',
    });

  const [updateChatReplySetting, { loading: isUpdating }] =
    useMutation<UpdateChatReplySettingMutation>(UpdateChatReplySettingDocument, {
      onCompleted(data) {
        if (data.updateChatReplySetting) {
          setChatReplySetting(data.updateChatReplySetting);
          const updatedPrev = (
            data.updateChatReplySetting.chatReplySchedules
              .find((schedule) => schedule.scheduleType === ChatReplyScheduleType.CustomDate)
              ?.chatReplyScheduleCustomDates?.filter((date) => (date ? new Date(date) : null)) || []
          ).map(dayjs);
          setPrevCustomDates(updatedPrev);
          enqueueSnackbar(t_toasts('chatReplySetting.success.update'), { variant: 'success' });
        } else {
          enqueueSnackbar(t_toasts('chatReplySetting.error.update'), { variant: 'error' });
        }
      },
      onError(error) {
        console.error(error.message);
        enqueueSnackbar(error.message, { variant: 'error' });
      },
      errorPolicy: 'all',
    });

  const resetCustomDates = () => {
    setCustomDates(prevCustomDates);
  };

  return {
    isLoading,
    isUpdating,
    isCreating,
    chatReplySetting,
    schedules,
    customDates,
    createChatReplySetting,
    updateChatReplySetting,
    setSchedules,
    setCustomDates,
    resetCustomDates,
  };
};
