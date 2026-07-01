import { useMemo, useState } from 'react';

import { Box, Stack, type StackProps, Typography } from '@mui/material';
import { blue } from '@mui/material/colors';

import { ChatReplyScheduleType } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';

import {
  type Schedule,
  TimeBar,
  type TimeRange,
  TimeRangePickerModal,
  type Weekend,
  defaultSchedules,
  labelColumnWidth,
  specialDays,
  styles,
  weekdays,
} from '.';

type TimeRangePickerProps = StackProps & {
  schedules: Optional<Schedule[]>;
  setSchedules: (newSchedules: Schedule[]) => void;
  useHolidays?: boolean;
  useCustomDates?: boolean;
  disabled?: boolean;
};

const timeLabels = ['00:00', '06:00', '12:00', '18:00', '24:00'];
const dayLabelColorMap: Record<Weekend, string> = {
  [ChatReplyScheduleType.Saturday]: blue[900],
  [ChatReplyScheduleType.Sunday]: 'error.main',
};

const timeToPercent = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return ((h * 60 + m) / (24 * 60)) * 100;
};

const TimeGuidelines = () => (
  <Box sx={styles.guidelineContainer(labelColumnWidth)}>
    {timeLabels.map((label) => {
      const left = timeToPercent(label);
      return (
        <Box key={label} sx={{ ...styles.verticalLine, left: `${left}%` }}>
          <Typography sx={styles.timeLabel}>{label}</Typography>
        </Box>
      );
    })}
  </Box>
);

const isWeekendSchedule = (scheduleType: ChatReplyScheduleType): scheduleType is Weekend => {
  return (
    scheduleType === ChatReplyScheduleType.Saturday || scheduleType === ChatReplyScheduleType.Sunday
  );
};

export const TimeRangePicker = ({
  schedules = defaultSchedules,
  setSchedules,
  useHolidays = false,
  useCustomDates = false,
  disabled,
  ...props
}: TimeRangePickerProps) => {
  const { t_chat } = useTranslation();

  const [targetSchedule, setTargetSchedule] = useState<Nullable<Schedule>>(null);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);

  const handleClick = (schedule: Schedule) => {
    setTargetSchedule(schedule);
    setIsTimePickerOpen(true);
  };

  const handleTimePickerClose = () => {
    setTargetSchedule(null);
    setIsTimePickerOpen(false);
  };

  const handleScheduleTimeRangesChange = (
    scheduleType: ChatReplyScheduleType,
    timeRanges: TimeRange[],
  ) => {
    if (!targetSchedule) return;
    const updatedSchedules = schedules.map((s) =>
      s.scheduleType === scheduleType ? { ...s, timeRanges } : s,
    );
    setSchedules(updatedSchedules);
    handleTimePickerClose();
  };

  const filteredSchedules = useMemo(() => {
    const order = [...weekdays, ...specialDays];

    return schedules
      .toSorted((a, b) => order.indexOf(a.scheduleType) - order.indexOf(b.scheduleType))
      .filter(
        (s) =>
          !s.isSpecialDay ||
          (s.scheduleType == ChatReplyScheduleType.Holidays && useHolidays) ||
          (s.scheduleType == ChatReplyScheduleType.CustomDate && useCustomDates),
      );
  }, [schedules, useHolidays, useCustomDates]);

  return (
    <Stack position='relative' {...props}>
      <TimeGuidelines />
      {filteredSchedules?.map((schedule, i) => (
        <TimeBar
          key={schedule.scheduleType as string}
          scheduleLabel={t_chat(`chatReplySetting.scheduleLabel.${schedule.scheduleType}`)}
          isLast={i === filteredSchedules.length - 1}
          labelColor={
            isWeekendSchedule(schedule.scheduleType)
              ? dayLabelColorMap[schedule.scheduleType]
              : undefined
          }
          onClick={() => handleClick(schedule)}
          disabled={disabled}
          {...schedule}
        />
      ))}
      {targetSchedule && (
        <TimeRangePickerModal
          title={t_chat(`chatReplySetting.scheduleFullLabel.${targetSchedule.scheduleType}`)}
          timeRanges={targetSchedule.timeRanges}
          isOpen={isTimePickerOpen}
          onClose={handleTimePickerClose}
          onSave={(...params) =>
            handleScheduleTimeRangesChange(targetSchedule.scheduleType, ...params)
          }
        />
      )}
    </Stack>
  );
};
