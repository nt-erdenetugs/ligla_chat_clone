import { type ChangeEvent, useState, useEffect } from 'react';

import CheckIcon from '@mui/icons-material/Check';
import ClearIcon from '@mui/icons-material/Clear';
import EditIcon from '@mui/icons-material/Edit';
import { Stack, Tooltip, Typography } from '@mui/material';

import { useTranslation } from '~/locales/hooks';

import { TooltipIconButton } from '../Elements/TooltipIconButton';

import { TextField } from './components';

type EditableTextLabelProps = {
  label: string;
  onSubmit: (value: string) => void;
  maxLength?: number;
  allowEmpty?: boolean;
  emptyPlaceholder?: string;
};

export const EditableTextLabel = ({
  label,
  onSubmit,
  maxLength,
  allowEmpty = false,
  emptyPlaceholder,
}: EditableTextLabelProps) => {
  const { t, t_errors } = useTranslation();
  const [text, setText] = useState('');
  const [error, setError] = useState<string>('');
  const [edit, setEdit] = useState(false);

  useEffect(() => {
    setText(label);
    return () => setText('');
  }, [label, setText]);

  const handleCancel = () => {
    setText(label);
    setEdit(false);
  };

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!allowEmpty && !trimmed) return;
    setText(trimmed);
    setEdit(false);
    onSubmit(trimmed);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setText(newValue);
    if (maxLength && newValue.length > maxLength) {
      setError(t_errors('maxCharacterLimit', { limit: maxLength }));
    } else {
      setError('');
    }
  };

  return edit ? (
    <Stack direction='row' alignItems='center' gap={1} width='100%'>
      <form
        style={{ width: 'inherit' }}
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <TextField
          type='text'
          value={text}
          onChange={handleChange}
          size='small'
          errorMessage={error}
          placeholder={t('pleaseEnter')}
        />
      </form>
      <Stack direction='row'>
        <TooltipIconButton
          title={t('actions.confirm')}
          icon={<CheckIcon />}
          onClick={handleSubmit}
          disabled={(!allowEmpty && !text.trim()) || Boolean(error)}
          iconButtonProps={{ size: 'small' }}
        />
        <TooltipIconButton
          title={t('actions.cancel')}
          icon={<ClearIcon />}
          onClick={handleCancel}
          iconButtonProps={{ size: 'small' }}
        />
      </Stack>
    </Stack>
  ) : (
    <Stack direction='row' alignItems='center' gap={1} width='100%' justifyContent='space-between'>
      <Tooltip
        title={label || ''}
        placement='top'
        arrow
        disableHoverListener={!label}
        disableFocusListener={!label}
        disableTouchListener={!label}
      >
        <Typography
          variant='body1'
          overflow='hidden'
          textOverflow='ellipsis'
          noWrap
          sx={{ flex: 1, minWidth: 0 }}
          color={!label && emptyPlaceholder ? 'text.disabled' : undefined}
        >
          {label || emptyPlaceholder}
        </Typography>
      </Tooltip>
      <TooltipIconButton
        title={t('actions.edit')}
        icon={<EditIcon />}
        onClick={() => setEdit(true)}
        iconButtonProps={{ size: 'small' }}
      />
    </Stack>
  );
};
