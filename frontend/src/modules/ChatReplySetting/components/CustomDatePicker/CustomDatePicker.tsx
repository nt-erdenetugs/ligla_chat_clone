import React, { useState, useCallback } from 'react';

import { CalendarMonth } from '@mui/icons-material';
import {
  Box,
  Checkbox,
  FormControlLabel,
  Chip,
  Stack,
  Card,
  Typography,
  IconButton,
  Popover,
} from '@mui/material';
import { DateCalendar, PickersDay, type PickersDayProps } from '@mui/x-date-pickers';
import dayjs, { type Dayjs } from 'dayjs';

import { type CheckboxControlRenderProps } from '~/common/components';
import { Label } from '~/common/components';
import { useTranslation } from '~/locales/hooks';

import { CustomDatePickerProvider } from './context';

type CustomDatePickerProps = {
  label: string;
  dates: Dayjs[];
  setDates: React.Dispatch<React.SetStateAction<Dayjs[]>>;
} & CheckboxControlRenderProps;

const CustomDatePickerComponent: React.FC<CustomDatePickerProps> = ({
  label,
  dates,
  setDates,
  ...controlProps
}) => {
  const [anchorEl, setAncorEl] = useState<HTMLButtonElement | null>(null);
  const [current, setCurrent] = useState<Dayjs>(dayjs());

  const { t_chat } = useTranslation();

  const toggleDate = useCallback(
    (day: Dayjs) => {
      setDates((prev) =>
        prev.some((d) => d.isSame(day, 'day'))
          ? prev.filter((d) => !d.isSame(day, 'day'))
          : [...prev, day],
      );
    },
    [setDates],
  );

  const handleOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
    setAncorEl(e.currentTarget);
  };

  const handleClose = () => {
    setAncorEl(null);
  };

  const _clearAll = useCallback(() => {
    setDates([]);
  }, [setDates]);

  const renderDay = useCallback(
    (props: PickersDayProps) => {
      const { day, ...dayProps } = props;
      const isSelected = dates.some((d) => d.isSame(day, 'day'));

      return (
        <PickersDay
          {...dayProps}
          day={day}
          selected={isSelected}
          onClick={(e) => {
            dayProps.onClick?.(e);
            toggleDate(day);
          }}
          sx={{
            ...(isSelected && {
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover, &:focus': {
                bgcolor: 'primary.dark',
              },
            }),
          }}
        />
      );
    },
    [dates, toggleDate],
  );

  const open = Boolean(anchorEl);
  const id = open ? 'simple-popover' : undefined;

  return (
    <Box sx={{ px: 1.5, w: '100%' }}>
      <Stack direction='row'>
        <FormControlLabel
          sx={{ gap: 1 }}
          control={<Checkbox checked={!!controlProps.value} {...controlProps} />}
          label={label}
        />
        <IconButton aria-describedby={id} onClick={handleOpen} disabled={!controlProps.value}>
          <CalendarMonth />
        </IconButton>
      </Stack>
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <Card sx={{ maxWidth: 550, px: 3, py: 2 }}>
          <Typography variant='h6' sx={{ mb: 2 }}>
            {t_chat('chatReplySetting.selectCustomDates')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <DateCalendar
                value={current}
                onChange={(d) => d && setCurrent(d)}
                onMonthChange={setCurrent}
                onYearChange={setCurrent}
                showDaysOutsideCurrentMonth
                slots={{ day: renderDay }}
                shouldDisableDate={(date: Date) => dayjs(date).isBefore(dayjs(), 'day')}
                sx={{
                  '& .MuiPickersCalendarHeader-root': {
                    px: 2,
                    mb: 2,
                  },
                  '& .MuiPickersCalendarHeader-label': {
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    color: 'primary.main',
                  },
                  '& .MuiPickersArrowSwitcher-root': {
                    gap: 1,
                  },
                  '& .MuiPickersArrowSwitcher-root .MuiIconButton-root': {
                    bgcolor: 'primary.main',
                    color: '#fff',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                      transform: 'scale(1.1)',
                    },
                    transition: 'all 0.2s ease',
                  },
                  '& .MuiDayCalendar-header .MuiTypography-root': {
                    color: 'text.secondary',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                  },
                  '& .MuiPickersDay-today': {
                    border: '2px solid',
                    borderColor: 'secondary.main',
                    fontWeight: 600,
                  },
                }}
              />
            </Box>
            <Box sx={{ flex: 1, height: '100%' }}>
              <Stack
                sx={{
                  maxHeight: 300,
                  overflowY: 'auto',
                  pl: 2,
                  borderLeft: 1,
                  justifyItems: 'start',
                  borderColor: 'divider',
                  '&::-webkit-scrollbar': {
                    width: 6,
                  },
                  '&::-webkit-scrollbar-thumb': {
                    bgcolor: 'primary.main',
                    borderRadius: 3,
                  },
                }}
              >
                <Box sx={{ mb: 2, textAlign: 'center' }}>
                  <Label text={t_chat('chatReplySetting.selectedCustomDates')} />
                </Box>
                {dates
                  .filter((date) => !date.isBefore(dayjs(), 'day'))
                  .sort((a, b) => a.diff(b))
                  .map((date) => (
                    <Chip
                      key={date.format('YYYY-MM-DD')}
                      label={date.format('MMM D, YYYY')}
                      onDelete={() => toggleDate(date)}
                      clickable
                      variant='outlined'
                      color='primary'
                      sx={{ mb: 1, mr: 1, justifyContent: 'end', px: 2 }}
                    />
                  ))}
              </Stack>
            </Box>
          </Box>
        </Card>
      </Popover>
    </Box>
  );
};

export const CustomDatePicker = (props: CustomDatePickerProps) => (
  <CustomDatePickerProvider>
    <CustomDatePickerComponent {...props} />
  </CustomDatePickerProvider>
);
