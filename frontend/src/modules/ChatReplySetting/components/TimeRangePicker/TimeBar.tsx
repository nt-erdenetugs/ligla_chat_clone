import { Box, Stack, Typography } from '@mui/material';

import { type Schedule, type TimeRange, labelColumnWidth, styles } from '.';

type TimeBarProps = Schedule & {
  scheduleLabel: string;
  isLast: boolean;
  onClick: () => void;
  disabled?: boolean;
  labelColor?: string;
};

const defaultLabelColor = 'text.primary';

const timeToPercent = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return ((h * 60 + m) / (24 * 60)) * 100;
};

const TimeRangeBlock = ({ start, end }: TimeRange) => {
  const startPercent = timeToPercent(start);
  const endPercent = timeToPercent(end);

  // If range goes past midnight
  const wrapsAround = startPercent > endPercent;

  return (
    <>
      <Box
        className='time-range'
        sx={{
          ...styles.timeRange,
          left: `${startPercent}%`,
          width: `${wrapsAround ? 100 - startPercent : endPercent - startPercent}%`,
        }}
      />
      {wrapsAround && (
        <Box
          className='time-range'
          sx={{
            ...styles.timeRange,
            left: '0%',
            width: `${endPercent}%`,
          }}
        />
      )}
    </>
  );
};

export const TimeBar = ({
  scheduleType,
  scheduleLabel,
  timeRanges,
  isSpecialDay,
  isLast,
  onClick,
  labelColor,
  disabled = false,
}: TimeBarProps) => {
  const color = labelColor || (isSpecialDay ? 'error.main' : defaultLabelColor);

  return (
    <Stack direction='row' alignItems='center'>
      <Typography
        sx={{
          ...styles.scheduleLabel(labelColumnWidth),
          color,
          ...(disabled && {
            opacity: 0.5,
          }),
        }}
      >
        {scheduleLabel}
      </Typography>

      <Box
        onClick={disabled ? undefined : onClick}
        sx={{
          ...styles.barContainer,
          borderBottom: isLast ? styles.border : 'none',
        }}
      >
        <Box className='time-bar' sx={styles.timeBar}>
          {timeRanges.map((range) => (
            <TimeRangeBlock key={`${scheduleType}-${range.start}`} {...range} />
          ))}
        </Box>
      </Box>
    </Stack>
  );
};
