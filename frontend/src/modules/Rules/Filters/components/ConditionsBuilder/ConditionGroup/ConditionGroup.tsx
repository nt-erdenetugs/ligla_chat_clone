import { memo } from 'react';

import { Box, Typography } from '@mui/material';
import { type FieldErrors, type FieldError } from 'react-hook-form';

import {
  type ConditionOperator,
  type ValueType,
  type LogicalOperator,
  type FilterTargetType,
} from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import {
  ConditionLeaf,
  ConditionsActions,
  ConditionGate,
  GATE_COLORS,
  NESTED_GROUP_MAX_DEPTH,
  type IConditionGroup,
  type ICondition,
  type Inputs,
} from '~/modules/Rules/Filters';

export type ConditionGroupProps = {
  data: IConditionGroup;
  level?: number;
  path: number[];
  disabled?: boolean;
  isDeletable?: boolean;
  targetTable?: FilterTargetType;
  fieldsAlias?: Record<string, string>;
  errors?: FieldErrors<Inputs>['rootConditionGroup'];
  readOnly?: boolean;
  onAddFilter: (path: number[]) => void;
  onAddGroup: (path: number[]) => void;
  onUpdateValue: (
    path: number[],
    field: string,
    newValue: string | number,
    newValueType?: ValueType,
    defaultOperator?: ConditionOperator,
  ) => void;
  onUpdateGate: (path: number[], newOperator: LogicalOperator) => void;
  onDeleteNode: (path: number[]) => void;
};

const CONDITION_DELETION_RULES = {
  rootWithSubGroups: { minItems: 2 }, // Must keep at least 1 condition + 1 subgroup
  rootWithoutSubGroups: { minItems: 1 }, // Must keep at least 1 condition
  nested: { minItems: 2 }, // Must keep at least 2 items
} as const;

export const ConditionGroup = memo(function ConditionGroup({
  data,
  path,
  level = 0,
  disabled = false,
  readOnly = false,
  onAddFilter,
  onAddGroup,
  onUpdateGate,
  onDeleteNode,
  errors,
  ...rest
}: ConditionGroupProps) {
  const { conditions, subGroups, logicalOperator } = data;
  const hasSubGroups = (subGroups?.length ?? 0) > 0;
  const { t_errors } = useTranslation();

  const { parentSectionBgColor, childSectionBgColor } = GATE_COLORS[logicalOperator];

  const backgroundColor = level % 2 === 0 ? parentSectionBgColor : childSectionBgColor;

  const isRoot = level === 0;

  const isShowGate = (isRoot && conditions.length + (subGroups?.length ?? 0) > 1) || !isRoot;

  const totalItems = conditions.length + (subGroups?.length ?? 0);

  const getRuleKey = (): keyof typeof CONDITION_DELETION_RULES => {
    if (!isRoot) return 'nested';
    return hasSubGroups ? 'rootWithSubGroups' : 'rootWithoutSubGroups';
  };

  const isDeletable = totalItems > CONDITION_DELETION_RULES[getRuleKey()].minItems;

  const handleGateChange = (newOperator: LogicalOperator) => {
    if (!disabled && !readOnly) onUpdateGate(path, newOperator);
  };

  const handleDeleteGroup = () => !readOnly && onDeleteNode(path);
  const handleAddFilter = () => !readOnly && onAddFilter(path);
  const handleAddGroup = () => !readOnly && onAddGroup(path);

  if (level > NESTED_GROUP_MAX_DEPTH) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          borderRadius: 2,
          backgroundColor,
          width: '100%',
          px: 3,
          py: 2,
          border: '2px solid',
          borderColor: 'error.main',
        }}
      >
        <Typography
          variant='body2'
          color='error'
          sx={{
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          {t_errors('chatAssignRules.filter.maxNestedDepthExceeded', {
            maxDepth: NESTED_GROUP_MAX_DEPTH,
          })}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        borderRadius: 2,
        backgroundColor,
        width: '100%',
        minWidth: 'fit-content',
        px: 3,
        py: 2,
      }}
    >
      <Box display='flex' flexDirection='row' gap={(isRoot || readOnly) && isShowGate ? 4 : 6}>
        {isShowGate && (
          <ConditionGate
            logicalOperator={logicalOperator}
            onChange={handleGateChange}
            disabled={disabled}
            readOnly={readOnly}
            {...(!isRoot && { onDelete: handleDeleteGroup })}
          />
        )}

        <Box flex={1} display='flex' flexDirection='column' gap={3}>
          {conditions.map((child, index) => (
            <ConditionLeaf
              key={[...path, index].join('-')}
              data={child}
              logicalOperator={logicalOperator}
              path={[...path, index]}
              disabled={disabled}
              onDeleteNode={onDeleteNode}
              isDeletable={isDeletable}
              error={errors?.conditions?.[index] as Partial<Record<keyof ICondition, FieldError>>}
              readOnly={readOnly}
              {...rest}
            />
          ))}
          {subGroups?.map((child, index) => {
            const subGroupIndex = conditions.length + index;
            return (
              <ConditionGroup
                key={[...path, subGroupIndex].join('-')}
                data={child}
                level={level + 1}
                path={[...path, subGroupIndex]}
                disabled={disabled}
                onAddFilter={onAddFilter}
                onAddGroup={onAddGroup}
                onUpdateGate={onUpdateGate}
                onDeleteNode={onDeleteNode}
                errors={errors?.subGroups?.[index]}
                readOnly={readOnly}
                {...rest}
              />
            );
          })}
        </Box>
      </Box>

      {!readOnly && (
        <ConditionsActions
          onAddFilter={handleAddFilter}
          onAddGroup={handleAddGroup}
          level={level}
          logicalOperator={logicalOperator}
          disabled={disabled}
        />
      )}
    </Box>
  );
});

ConditionGroup.displayName = 'ConditionGroup';
