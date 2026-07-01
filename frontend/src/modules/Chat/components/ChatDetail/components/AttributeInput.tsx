import { useState } from 'react';

import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { FormHelperText, IconButton, Stack, TextField, Box, Autocomplete } from '@mui/material';
import { TimePicker, LocalizationProvider, DatePicker, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/ja';

import { NewLine, MobileSelectModal } from '~/common/components';
import { type AttributeOption } from '~/common/constants';
import { useResponsive } from '~/common/hooks';
import { getLocale } from '~/lib/apollo-client';
import { useTranslation } from '~/locales/hooks';
import {
  ATTRIBUTE_VALUE_MAX_CHARACTER_LIMIT,
  attributeSchema,
  type SelectOption,
  type AttributeField,
} from '~/modules/Chat';

type AttributeInputProps = {
  field: AttributeField;
  handleClose: (id: string) => void;
  handleSave: (field: AttributeField) => void;
};

export const AttributeInput = (props: AttributeInputProps) => {
  const { field, handleClose, handleSave } = props;
  const { t, t_errors } = useTranslation();
  const locale = getLocale();
  const [inputValue, setInputValue] = useState(field.value || '');
  const { isMobileOrTablet } = useResponsive();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const selectOptions: SelectOption[] = field.selectOption ?? [];

  const handleSubmit = () => {
    const { value = '' } = field;

    const isSameValue = value === inputValue;

    if (isSameValue) {
      handleClose(field.id);
      return;
    }

    const payload: AttributeField = {
      ...field,
      value: inputValue,
    };

    const result = attributeSchema.safeParse(payload);
    if (!result.success) {
      return;
    }

    handleSave(payload);
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      handleSubmit();
    }
  };

  const errorMessage =
    inputValue.length > ATTRIBUTE_VALUE_MAX_CHARACTER_LIMIT
      ? t_errors('maxCharacterLimit', { limit: ATTRIBUTE_VALUE_MAX_CHARACTER_LIMIT })
      : null;

  const handleMobileSelectToggle = (option: AttributeOption, selectedOption?: AttributeOption) => {
    if (selectedOption && selectedOption.value === option.value) {
      setInputValue('');
    } else {
      setInputValue(option.value);
    }
    setDialogOpen(false);
    setSearchValue('');
  };

  return (
    <Stack direction='row' spacing={0} sx={{ py: 1 }}>
      <Stack
        sx={{
          width: '100%',
        }}
      >
        <Box>
          <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={locale}>
            {field.type === 'boolean' ? (
              <Stack direction='row' gap={1} alignItems='center' flexWrap='wrap'>
                <Autocomplete
                  options={['True', 'False']}
                  value={inputValue}
                  onChange={(_event, newValue) => setInputValue(newValue ?? '')}
                  size='small'
                  sx={{
                    width: '100%',
                  }}
                  disableClearable
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={field.name}
                      size='small'
                      fullWidth
                      autoFocus
                      placeholder={t('pleaseEnter')}
                    />
                  )}
                />
              </Stack>
            ) : field.type === 'date' ? (
              <DatePicker
                enableAccessibleFieldDOMStructure={false}
                label={field.name}
                value={inputValue ? dayjs(inputValue, 'YYYY-MM-DD') : null}
                onChange={(newValue: dayjs.Dayjs | null) =>
                  setInputValue(newValue ? newValue.format('YYYY-MM-DD') : '')
                }
                slotProps={{
                  textField: {
                    size: 'small',
                    fullWidth: true,
                    sx: { width: '100%' },
                    InputLabelProps: { shrink: true },
                    onKeyUp: handleKeyPress,
                    error: String(inputValue).length > ATTRIBUTE_VALUE_MAX_CHARACTER_LIMIT,
                    autoFocus: true,
                  },
                }}
              />
            ) : field.type === 'datetime' ? (
              <DateTimePicker
                enableAccessibleFieldDOMStructure={false}
                label={field.name}
                value={inputValue ? dayjs(inputValue) : null}
                onChange={(newValue: dayjs.Dayjs | null) =>
                  setInputValue(newValue ? newValue.format('YYYY-MM-DD HH:mm') : '')
                }
                slotProps={{
                  textField: {
                    size: 'small',
                    fullWidth: true,
                    sx: { width: '100%' },
                    InputLabelProps: { shrink: true },
                    onKeyUp: handleKeyPress,
                    error: String(inputValue).length > ATTRIBUTE_VALUE_MAX_CHARACTER_LIMIT,
                    autoFocus: true,
                  },
                }}
              />
            ) : field.type === 'time' ? (
              <TimePicker
                enableAccessibleFieldDOMStructure={false}
                label={field.name}
                value={inputValue ? dayjs(inputValue, 'HH:mm') : null}
                onChange={(newValue: dayjs.Dayjs | null) =>
                  setInputValue(newValue ? newValue.format('HH:mm') : '')
                }
                slotProps={{
                  textField: {
                    size: 'small',
                    fullWidth: true,
                    sx: { width: '100%' },
                    InputLabelProps: { shrink: true },
                    onKeyUp: handleKeyPress,
                    error: String(inputValue).length > ATTRIBUTE_VALUE_MAX_CHARACTER_LIMIT,
                    autoFocus: true,
                  },
                }}
              />
            ) : field.type === 'number' || field.type === 'string' ? (
              <TextField
                label={field.name}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                }}
                size='small'
                sx={{
                  width: '100%',
                }}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                }}
                onKeyUp={handleKeyPress}
                error={inputValue.length > ATTRIBUTE_VALUE_MAX_CHARACTER_LIMIT}
                autoFocus
              />
            ) : field.type === 'selection' ? (
              (() => {
                const formatedSelectOptions: AttributeOption[] = selectOptions.map(
                  (selectOption) => ({
                    label: selectOption.value,
                    value: selectOption.value,
                  }),
                );

                const selectedOption = formatedSelectOptions.find(
                  (formatedSelectOption) => formatedSelectOption.value === inputValue,
                );

                if (isMobileOrTablet) {
                  return (
                    <>
                      <TextField
                        value={selectedOption ? selectedOption.label : ''}
                        placeholder={t('pleaseEnter')}
                        disabled={false}
                        size='small'
                        fullWidth
                        slotProps={{
                          input: {
                            readOnly: true,
                            sx: { height: '36px', fontSize: 14, borderRadius: 2 },
                            onClick: () => setDialogOpen(true),
                          },
                        }}
                      />
                      <MobileSelectModal<AttributeOption>
                        title={field.name}
                        options={formatedSelectOptions}
                        selectedOptions={selectedOption ? [selectedOption] : []}
                        getOptionId={(option: AttributeOption) => option.value}
                        isEnabled={true}
                        searchValue={searchValue}
                        setSearchValue={setSearchValue}
                        onToggle={(option) => handleMobileSelectToggle(option, selectedOption)}
                        isDialogOpen={isDialogOpen}
                        onClose={() => {
                          setDialogOpen(false);
                          setSearchValue('');
                        }}
                      />
                    </>
                  );
                }

                return (
                  <Autocomplete
                    options={formatedSelectOptions}
                    value={selectedOption ?? null}
                    freeSolo
                    renderInput={(params) => (
                      <TextField {...params} label={field.name} size='small' fullWidth autoFocus />
                    )}
                    onChange={(_event, newValue) => {
                      if (typeof newValue === 'string') setInputValue(newValue ?? '');
                      else setInputValue((newValue as AttributeOption)?.value ?? '');
                    }}
                  />
                );
              })()
            ) : null}
          </LocalizationProvider>
        </Box>
        {errorMessage && (
          <FormHelperText error>
            {typeof errorMessage === 'string' ? <NewLine text={errorMessage} /> : errorMessage}
          </FormHelperText>
        )}
      </Stack>
      <IconButton
        onClick={handleSubmit}
        size='small'
        sx={{
          marginLeft: '4px',
          width: '40px',
          height: '40px',
          color: 'green',
        }}
        disabled={!!errorMessage}
      >
        <CheckIcon />
      </IconButton>
      <IconButton
        onClick={() => handleClose(field.id)}
        size='small'
        sx={{
          width: '40px',
          height: '40px',
        }}
      >
        <CloseIcon />
      </IconButton>
    </Stack>
  );
};
