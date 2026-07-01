import { useCallback, useEffect, useMemo, useState } from 'react';

import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

import { useTranslation } from '~/locales/hooks';

import { type Schedule } from './types';

type TimeRange = { start: string; end: string };

type PropsType = Pick<Schedule, 'timeRanges'> & {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (timeRanges: TimeRange[]) => void;
};

const EMPTY_RANGE: TimeRange = { start: '', end: '' };
const STEP_SECONDS = 300;

const isOverlapping = (timeRanges: TimeRange[]) => {
  const parseTime = (t: string): number => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const ranges = timeRanges.map((r) => ({
    ...r,
    startMin: parseTime(r.start),
    endMin: parseTime(r.end),
  }));

  const collidedIdx = new Set<number>();
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const a = ranges[i],
        b = ranges[j];
      if (a.startMin < b.endMin && b.startMin < a.endMin) {
        collidedIdx.add(i);
        collidedIdx.add(j);
      }
    }
  }

  return Array.from(collidedIdx).map((idx) => timeRanges[idx]);
};

export const TimeRangePickerModal = ({
  title,
  timeRanges: initialRanges,
  isOpen,
  onClose,
  onSave,
}: PropsType) => {
  const [timeRanges, setTimeRanges] = useState<TimeRange[]>([EMPTY_RANGE]);
  const { t, t_chat, t_errors } = useTranslation();

  useEffect(() => {
    if (initialRanges.length > 0) setTimeRanges(initialRanges);
  }, [initialRanges]);

  const isIncomplete = ({ start, end }: TimeRange) => !start || !end;
  const isEmptyRange = ({ start, end }: TimeRange) => !start && !end;

  const lastRange = timeRanges.at(-1) ?? EMPTY_RANGE;
  const lastRangeIncomplete = isIncomplete(lastRange);

  const validRanges = useMemo(() => timeRanges.filter((r) => !isEmptyRange(r)), [timeRanges]);

  const hasPartialRange = useMemo(() => validRanges.some(isIncomplete), [validRanges]);

  const overlappingTimeranges = useMemo(() => isOverlapping(validRanges), [validRanges]);

  const isSaveDisabled = useMemo(() => {
    // Disable if:
    // - There is more than 1 range AND last range is incomplete
    // OR
    // - There is any partially filled range (invalid)
    return (
      (timeRanges.length > 1 && lastRangeIncomplete) ||
      hasPartialRange ||
      overlappingTimeranges.length > 0
    );
  }, [timeRanges.length, lastRangeIncomplete, hasPartialRange, overlappingTimeranges.length]);

  const handleChange = (index: number, field: keyof TimeRange, value: string) => {
    setTimeRanges((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAdd = useCallback(() => {
    if (lastRangeIncomplete) return;
    setTimeRanges((prev) => [...prev, EMPTY_RANGE]);
  }, [lastRangeIncomplete]);

  const handleDelete = useCallback((index: number) => {
    setTimeRanges((prev) =>
      prev.length <= 1 ? [EMPTY_RANGE] : prev.filter((_, i) => i !== index),
    );
  }, []);

  const handleResetAndClose = useCallback(() => {
    setTimeRanges([EMPTY_RANGE]);
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(() => {
    onSave(validRanges);
  }, [onSave, validRanges]);

  return (
    <Dialog open={isOpen} onClose={handleResetAndClose} maxWidth='xs' fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          {timeRanges.map((range, index) => (
            <Stack
              key={index}
              direction='row'
              alignItems='center'
              spacing={1}
              justifyContent='space-between'
            >
              <TextField
                type='time'
                value={range.start}
                onChange={(e) => handleChange(index, 'start', e.target.value)}
                fullWidth
                size='small'
                error={overlappingTimeranges.includes(range)}
                slotProps={{ htmlInput: { step: STEP_SECONDS } }}
              />
              <Typography sx={{ mx: 0.5 }}>~</Typography>
              <TextField
                type='time'
                value={range.end}
                onChange={(e) => handleChange(index, 'end', e.target.value)}
                fullWidth
                size='small'
                error={overlappingTimeranges.includes(range)}
                slotProps={{ htmlInput: { step: STEP_SECONDS } }}
              />
              <IconButton onClick={() => handleDelete(index)} color='warning'>
                <DeleteOutlineIcon />
              </IconButton>
            </Stack>
          ))}

          <Tooltip
            title={
              lastRangeIncomplete
                ? t_chat('chatReplySetting.timeRangePicker.completeLastRangeToAdd')
                : ''
            }
            placement='bottom'
          >
            <span>
              <Button
                onClick={handleAdd}
                disabled={lastRangeIncomplete}
                variant='outlined'
                size='small'
                fullWidth
              >
                {t('actions.addMore')}
              </Button>
            </span>
          </Tooltip>
          {overlappingTimeranges.length > 0 && (
            <Typography textAlign='center' color='error'>
              {t_errors('chatReplySetting.overlappingTimeranges')}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleResetAndClose} color='secondary' fullWidth>
          {t('actions.cancel')}
        </Button>
        <Tooltip
          title={
            isSaveDisabled ? t_chat('chatReplySetting.timeRangePicker.completeAllRangesToSave') : ''
          }
          placement='top'
        >
          <span style={{ width: '100%' }}>
            <Button onClick={handleSubmit} color='primary' disabled={isSaveDisabled} fullWidth>
              {t('actions.ok')}
            </Button>
          </span>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
};
