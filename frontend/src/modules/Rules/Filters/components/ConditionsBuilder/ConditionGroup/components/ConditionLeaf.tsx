import { useMemo, useCallback } from 'react';

import DeleteIcon from '@mui/icons-material/Delete';
import { Box, Stack } from '@mui/material';
import type { FieldError } from 'react-hook-form';

import { TooltipIconButton } from '~/common/components';
import { FilterTargetType, type LogicalOperator } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import {
  allConditionFields,
  FieldSelect,
  LOGIC_ONLY_OPERATORS,
  OperatorSelect,
  STRING_OPERATORS,
  ValueInput,
  type ICondition,
  type IConditionOperator,
  type ConditionGroupProps,
  GATE_COLORS,
  ConditionSentence,
} from '~/modules/Rules/Filters';

type ConditionLeafProps = Pick<
  ConditionGroupProps,
  | 'path'
  | 'onUpdateValue'
  | 'onDeleteNode'
  | 'disabled'
  | 'isDeletable'
  | 'targetTable'
  | 'fieldsAlias'
  | 'readOnly'
> & {
  data: ICondition;
  logicalOperator: LogicalOperator;
  error?: Partial<Record<keyof ICondition, FieldError>>;
};

const findFieldConfig = (fieldValue: string) =>
  allConditionFields.find((f) => f.field === fieldValue);

const findOperator = (operators: IConditionOperator[], operatorValue: string) =>
  operators.find((op) => op.operator === operatorValue);

export const ConditionLeaf = ({
  data,
  path,
  onUpdateValue,
  onDeleteNode,
  disabled = false,
  readOnly = false,
  isDeletable = true,
  targetTable = FilterTargetType.Store,
  fieldsAlias,
  logicalOperator,
  error,
}: ConditionLeafProps) => {
  const { t } = useTranslation();
  const { operator, field, value, valueObjects } = data;
  const { chipBorderColor } = GATE_COLORS[logicalOperator];

  const selectedField = useMemo(() => findFieldConfig(field), [field]);

  const availableOperators = useMemo(
    () => selectedField?.operatorsType ?? STRING_OPERATORS,
    [selectedField],
  );

  const selectedOperator = useMemo(
    () => findOperator(availableOperators, operator) ?? availableOperators[0],
    [availableOperators, operator],
  );

  const showValueInput = useMemo(() => !LOGIC_ONLY_OPERATORS.includes(operator), [operator]);

  const handleOperatorChange = useCallback(
    (newOperatorValue: string) => {
      const newOperator = findOperator(availableOperators, newOperatorValue);
      if (!newOperator) return;

      onUpdateValue(path, 'operator', newOperatorValue, newOperator.valueType);
    },
    [availableOperators, onUpdateValue, path],
  );

  const handleFieldChange = useCallback(
    (newFieldValue: string) => {
      const newField = findFieldConfig(newFieldValue);
      if (!newField) return;

      const newAvailableOperators = newField.operatorsType;
      const isCurrentOperatorValid = newAvailableOperators.some((op) => op.operator === operator);
      const newAvailableOperator = isCurrentOperatorValid ? null : newAvailableOperators[0];

      onUpdateValue(
        path,
        'field',
        newFieldValue,
        newAvailableOperator?.valueType,
        newAvailableOperator?.operator,
      );
    },
    [onUpdateValue, path, operator],
  );

  const handleValueChange = useCallback(
    (newValue: string) => {
      onUpdateValue(path, 'value', newValue, selectedOperator.valueType);
    },
    [onUpdateValue, path, selectedOperator],
  );

  const handleDelete = useCallback(() => {
    if (disabled) return;
    onDeleteNode(path);
  }, [disabled, onDeleteNode, path]);

  return (
    <Stack direction='row' spacing={1} alignItems='center'>
      {readOnly ? (
        <ConditionSentence data={data} fieldsAlias={fieldsAlias} borderColor={chipBorderColor} />
      ) : (
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            alignItems: 'start',
            flexWrap: 'wrap',
          }}
        >
          <FieldSelect
            value={field}
            onChange={handleFieldChange}
            disabled={disabled}
            targetTable={targetTable}
            fieldsAlias={fieldsAlias}
            readOnly={readOnly}
          />

          <OperatorSelect
            value={operator}
            operators={availableOperators}
            onChange={handleOperatorChange}
            disabled={disabled}
            readOnly={readOnly}
          />

          {showValueInput && (
            <ValueInput
              field={field}
              value={value ?? ''}
              valueType={selectedOperator?.valueType}
              valueObjects={valueObjects}
              onChange={handleValueChange}
              disabled={disabled}
              error={error?.value?.message}
              readOnly={readOnly}
            />
          )}
        </Box>
      )}

      {!readOnly && isDeletable && (
        <TooltipIconButton
          title={t('actions.delete')}
          icon={<DeleteIcon fontSize='small' color={disabled ? 'disabled' : 'primary'} />}
          onClick={handleDelete}
          disabled={disabled}
        />
      )}
    </Stack>
  );
};
