import { useEffect, useMemo, useState } from 'react';

import { Restore } from '@mui/icons-material';
import SaveIcon from '@mui/icons-material/Save';
import { Button, Stack } from '@mui/material';
import { type Dayjs } from 'dayjs';
import { useController } from 'react-hook-form';

import {
  Card,
  CheckboxControl,
  type CheckboxControlRenderProps,
  FlexForm,
  Loading,
  SwitchControl,
  TextFieldControl,
  Title,
} from '~/common/components';
import { useAuthContext } from '~/context/AuthContext';
import {
  ChatMessageType,
  ChatReplyScheduleType,
  ChatReplyTimeRangeType,
} from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';

import {
  TimeRangePicker,
  useChatReplyActions,
  type Inputs,
  useForm,
  CustomDatePicker,
  type Schedule,
} from '..';

const controlFieldStyles = {
  wrapperProps: {
    display: 'grid',
    gridTemplateColumns: '1fr 11fr',
    gap: 5,
    alignItems: 'center',
  },
  labelProps: { mb: 0, align: 'left' as const },
};

const buildMessages = (activeMsg = '', defaultMsg = '') => [
  {
    timeRangeType: ChatReplyTimeRangeType.ActiveTime,
    messageTemplate: {
      type: ChatMessageType.Text,
      text: activeMsg,
    },
  },
  {
    timeRangeType: ChatReplyTimeRangeType.Default,
    messageTemplate: {
      type: ChatMessageType.Text,
      text: defaultMsg,
    },
  },
];

const buildSchedules = (
  schedules: Schedule[] = [],
  customDates: Dayjs[],
  config: { useHolidays: boolean; useCustomDates: boolean },
) =>
  schedules
    .filter((s) => {
      if (!s.isSpecialDay) return true;
      if (s.scheduleType === ChatReplyScheduleType.Holidays) return config.useHolidays;
      if (s.scheduleType === ChatReplyScheduleType.CustomDate) return config.useCustomDates;
      return false;
    })
    .map(({ scheduleType, timeRanges }) => ({
      scheduleType,
      timeRanges: timeRanges.map((tr) => ({
        startTime: tr.start,
        endTime: tr.end,
        timeRangeType: ChatReplyTimeRangeType.ActiveTime,
      })),
      customDates:
        scheduleType === ChatReplyScheduleType.CustomDate
          ? customDates.map((d) => d.toISOString())
          : [],
    }));

const updateSchedules = (
  isEnabled: boolean,
  scheduleType: ChatReplyScheduleType,
  setSchedules: React.Dispatch<React.SetStateAction<Schedule[] | undefined>>,
) => {
  setSchedules((prevSchedules) => {
    const alreadyExists = prevSchedules?.some((s) => s.scheduleType === scheduleType);
    if (isEnabled) {
      if (alreadyExists) return prevSchedules;
      return [
        ...(prevSchedules ?? []),
        {
          scheduleType,
          timeRanges: [],
          isSpecialDay: true,
        },
      ];
    }
    return prevSchedules?.filter((s) => s.scheduleType !== scheduleType);
  });
};

export const ChatReplySettingsPage = () => {
  const {
    chatReplySetting,
    isLoading,
    isCreating,
    isUpdating,
    customDates,
    schedules,
    setCustomDates,
    setSchedules,
    createChatReplySetting,
    updateChatReplySetting,
    resetCustomDates,
  } = useChatReplyActions();
  const [isDirty, setIsDirty] = useState(false);

  const { user } = useAuthContext();
  const { t, t_chat } = useTranslation();

  const values = useMemo(() => {
    if (!chatReplySetting) return undefined;

    const hasScheduleType = (type: ChatReplyScheduleType) =>
      chatReplySetting.chatReplySchedules.some((s) => s.scheduleType === type);

    const getMessageContent = (timeType: ChatReplyTimeRangeType) =>
      chatReplySetting.chatReplySettingMessages.find(
        (m) =>
          m.timeRangeType === timeType && m.chatReplyMessageTemplate.type === ChatMessageType.Text,
      )?.chatReplyMessageTemplate.content || '';

    return {
      isActive: Boolean(chatReplySetting.isActive),
      useHolidays: hasScheduleType(ChatReplyScheduleType.Holidays),
      useCustomDates: hasScheduleType(ChatReplyScheduleType.CustomDate),
      activeTimeMessage: getMessageContent(ChatReplyTimeRangeType.ActiveTime),
      defaultMessage: getMessageContent(ChatReplyTimeRangeType.Default),
    };
  }, [chatReplySetting]);

  const { control, handleSubmit, formState, watch, reset } = useForm({ values });

  const useHolidays = watch('useHolidays');
  const useCustomDates = watch('useCustomDates');

  useEffect(() => {
    updateSchedules(!!useHolidays, ChatReplyScheduleType.Holidays, setSchedules);
  }, [useHolidays, setSchedules]);

  useEffect(() => {
    updateSchedules(!!useCustomDates, ChatReplyScheduleType.CustomDate, setSchedules);
  }, [useCustomDates, setSchedules]);

  const buildVariables = (isUpdate = false, inputs: Inputs) => {
    const { isActive, activeTimeMessage, defaultMessage } = inputs;
    const messages = buildMessages(activeTimeMessage, defaultMessage);
    const scheduleData = buildSchedules(schedules, customDates, {
      useHolidays: !!useHolidays,
      useCustomDates: !!useCustomDates,
    });

    const variables = {
      ...(isUpdate && chatReplySetting ? { id: chatReplySetting.id } : {}),
      isActive,
      messages,
      schedules: scheduleData,
    };

    return {
      [isUpdate ? 'updateChatReplySettingInput' : 'createChatReplySettingInput']: variables,
      inputOrganizationId: user?.organization?.id,
    };
  };

  const onSubmit = (inputs: Inputs) => {
    const isUpdate = !!chatReplySetting;
    const variables = buildVariables(isUpdate, inputs);
    if (isUpdate) {
      updateChatReplySetting({ variables });
    } else {
      createChatReplySetting({ variables });
    }
    setIsDirty(false);
  };

  const onReset = () => {
    reset();
    resetCustomDates();
    setIsDirty(false);
  };

  const checkboxFields = [
    {
      name: 'useHolidays',
      label: t_chat('chatReplySetting.useHolidaysTitle'),
      checkBoxText: t_chat('chatReplySetting.useHolidaysDesc'),
    },
    {
      name: 'useCustomDates',
      label: t_chat('chatReplySetting.useCustomDatesTitle'),
      checkBoxElement: (props: CheckboxControlRenderProps) => (
        <CustomDatePicker
          dates={customDates}
          label={t_chat('chatReplySetting.useCustomDatesDesc')}
          setDates={(...params) => {
            setIsDirty(true);
            setCustomDates(...params);
          }}
          {...props}
          disabled={!isActiveValue}
        />
      ),
    },
  ];

  const textFields = [
    {
      name: 'activeTimeMessage',
      label: t_chat('chatReplySetting.activeTimeMessage.label'),
      placeholder: t_chat('chatReplySetting.activeTimeMessage.placeholder'),
    },
    {
      name: 'defaultMessage',
      label: t_chat('chatReplySetting.defaultMessage.label'),
      placeholder: t_chat('chatReplySetting.defaultMessage.placeholder'),
    },
  ];

  const isSaveDisabled = useMemo(() => {
    const submitting = isLoading || isUpdating || isCreating;
    const hasChanges = isDirty || formState.isDirty;
    return submitting || !hasChanges;
  }, [isLoading, isUpdating, isCreating, isDirty, formState.isDirty]);

  const {
    field: { value: isActiveValue },
  } = useController({ name: 'isActive', control });

  return (
    <>
      <Title title={t_chat('chatReplySetting.title')} />

      <Card pb={20}>
        {isLoading ? (
          <Loading />
        ) : (
          <FlexForm width={1}>
            <SwitchControl
              name='isActive'
              label={t_chat('chatReplySetting.status')}
              control={control}
              {...controlFieldStyles}
              wrapperProps={{ pr: '30%', ...controlFieldStyles.wrapperProps }}
            />

            <TimeRangePicker
              mr={7}
              ml={3}
              my={2}
              schedules={schedules}
              setSchedules={(...params) => {
                setIsDirty(true);
                setSchedules(...params);
              }}
              useHolidays={useHolidays}
              useCustomDates={useCustomDates}
              disabled={!isActiveValue}
            />

            <Stack sx={{ pr: '30%', gap: 3 }}>
              {checkboxFields.map((field) => (
                <CheckboxControl
                  key={field.name}
                  name={field.name as keyof Inputs}
                  label={field.label}
                  checkBoxText={field.checkBoxText}
                  checkBoxElement={field.checkBoxElement}
                  control={control}
                  disabled={!isActiveValue}
                  {...controlFieldStyles}
                />
              ))}

              {textFields.map((field) => (
                <TextFieldControl
                  key={field.name}
                  name={field.name as keyof Inputs}
                  label={field.label}
                  placeholder={field.placeholder}
                  control={control}
                  disabled={!isActiveValue}
                  multiline
                  minRows={2}
                  {...controlFieldStyles}
                />
              ))}
            </Stack>
          </FlexForm>
        )}
        <Stack
          direction='row'
          gap={2}
          justifyContent='center'
          sx={{
            position: 'fixed',
            bottom: 50,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
          }}
        >
          <Button
            variant={formState.isDirty ? 'contained' : 'outlined'}
            color='error'
            startIcon={<Restore />}
            disabled={isSaveDisabled}
            onClick={() => onReset()}
            sx={{
              '&.Mui-disabled': {
                backgroundColor: (theme) => theme.palette.grey[200],
              },
            }}
          >
            {t('actions.restore')}
          </Button>
          <Button
            variant={formState.isDirty ? 'contained' : 'outlined'}
            startIcon={<SaveIcon />}
            disabled={isSaveDisabled}
            onClick={handleSubmit(onSubmit)}
            sx={{
              '&.Mui-disabled': {
                backgroundColor: (theme) => theme.palette.grey[200],
              },
            }}
          >
            {t('actions.save')}
          </Button>
        </Stack>
      </Card>
    </>
  );
};
