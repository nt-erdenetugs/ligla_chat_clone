import {
  FormControl,
  InputLabel,
  ListSubheader,
  MenuItem,
  Select,
  type SelectChangeEvent,
} from '@mui/material';

import { type FilterTargetType } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { CONDITION_FIELDS, TARGET_TABLE_FIELD_CATEGORY_MAP } from '~/modules/Rules/Filters';

type FieldSelectProps = {
  value: string;
  onChange: (value: string) => void;
  targetTable: FilterTargetType;
  fieldsAlias?: Record<string, string>;
  disabled?: boolean;
  readOnly?: boolean;
};

export const FieldSelect = ({
  value,
  onChange,
  targetTable,
  fieldsAlias,
  readOnly = false,
  disabled = false,
}: FieldSelectProps) => {
  const { t, t_management } = useTranslation();

  const avialableFields = CONDITION_FIELDS.filter(
    (field) => field.category === TARGET_TABLE_FIELD_CATEGORY_MAP[targetTable],
  );

  const availableFieldNames = avialableFields.flatMap(({ fields }) => fields.map((f) => f.field));
  const validValue = availableFieldNames.includes(value) ? value : availableFieldNames[0] || '';

  const handleChange = (event: SelectChangeEvent<string>) => {
    onChange(event.target.value);
  };

  const label = readOnly
    ? t_management('chatAssignFilters.filterBuilder.column')
    : t_management('chatAssignFilters.filterBuilder.selectColumn');

  return (
    <FormControl size='small' sx={{ minWidth: 250 }} disabled={disabled}>
      <InputLabel id='grouped-field-label'>{label}</InputLabel>

      <Select
        labelId='grouped-field-label'
        id='grouped-field-select'
        value={validValue}
        onChange={handleChange}
        label={label}
        variant='outlined'
        MenuProps={{ sx: { maxHeight: 500 } }}
        inputProps={{ readOnly }}
        {...(readOnly && { IconComponent: () => null })}
      >
        {avialableFields.flatMap(({ category, fields }) => [
          <ListSubheader key={`${category}-sub`} disableSticky>
            {t(category)}
          </ListSubheader>,
          ...fields.map(({ field, label }) => (
            <MenuItem key={`${category}-${field}`} value={field} sx={{ pl: 4 }}>
              {fieldsAlias?.[field] ?? t(label)}
            </MenuItem>
          )),
        ])}
      </Select>
    </FormControl>
  );
};
