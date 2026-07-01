import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';

import { type ConditionOperator } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import type { IConditionOperator } from '~/modules/Rules/Filters';

type OperatorSelectProps = {
  value: ConditionOperator;
  operators: IConditionOperator[];
  onChange: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
};

export const OperatorSelect = ({
  value,
  operators,
  onChange,
  disabled = false,
  readOnly = false,
}: OperatorSelectProps) => {
  const { t_management } = useTranslation();

  const label = readOnly
    ? t_management('chatAssignFilters.filterBuilder.operator')
    : t_management('chatAssignFilters.filterBuilder.selectOperator');

  return (
    <FormControl size='small' sx={{ minWidth: 220 }}>
      <InputLabel>{label}</InputLabel>
      <Select
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        inputProps={{ readOnly }}
        {...(readOnly && { IconComponent: () => null })}
      >
        {operators.map((op) => (
          <MenuItem key={op.operator} value={op.operator}>
            {t_management(op.labelKey)}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
