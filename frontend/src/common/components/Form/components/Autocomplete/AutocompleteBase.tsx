import {
  Autocomplete,
  TextField,
  type AutocompleteProps,
  type ChipTypeMap,
  type TextFieldProps,
} from '@mui/material';

import { ListboxComponent, type FieldLabelProps } from '~/common/components';
import {
  type InfiniteQueryContextType,
  InfiniteQueryProvider,
} from '~/context/InfiniteScrollContext';
import { useTranslation } from '~/locales/hooks';

export type AutocompleteBaseProps<
  Value,
  Multiple extends boolean | undefined = false,
  DisableClearable extends boolean | undefined = false,
  FreeSolo extends boolean | undefined = false,
  ChipComponent extends React.ElementType = ChipTypeMap['defaultComponent'],
> = Omit<
  AutocompleteProps<Value, Multiple, DisableClearable, FreeSolo, ChipComponent>,
  'renderInput'
> & {
  label?: FieldLabelProps['label'];
  errorMessage?: FieldLabelProps['errorMessage'];
  inputRef?: TextFieldProps['ref'];
  inputProps?: Omit<TextFieldProps, 'label'>;
  placeholder?: string;
  noOptionsText?: string;
  required?: boolean;
  labelFloat?: boolean;
} & InfiniteQueryContextType;

export const AutocompleteBase = <
  Value,
  Multiple extends boolean | undefined = false,
  DisableClearable extends boolean | undefined = false,
  FreeSolo extends boolean | undefined = false,
  ChipComponent extends React.ElementType = ChipTypeMap['defaultComponent'],
>({
  label,
  errorMessage,
  inputRef,
  inputProps,
  placeholder = 'Select',
  noOptionsText,
  required,
  labelFloat,
  infiniteQueryResponse,
  ...props
}: AutocompleteBaseProps<Value, Multiple, DisableClearable, FreeSolo, ChipComponent>) => {
  const { t_chat } = useTranslation();

  return (
    <InfiniteQueryProvider infiniteQueryResponse={infiniteQueryResponse}>
      <Autocomplete
        fullWidth
        renderInput={(params) => (
          <TextField
            inputRef={inputRef}
            placeholder={placeholder}
            error={!!errorMessage}
            {...(labelFloat && { label })}
            required={required}
            {...params}
            {...inputProps}
          />
        )}
        slotProps={{
          listbox: {
            sx: { maxHeight: 250 },
            component: ListboxComponent,
          },
        }}
        noOptionsText={noOptionsText || t_chat('chatTags.noOptionsText')}
        {...props}
      />
    </InfiniteQueryProvider>
  );
};
