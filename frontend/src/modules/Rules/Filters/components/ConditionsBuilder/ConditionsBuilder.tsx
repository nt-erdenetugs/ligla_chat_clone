import { useEffect, useMemo, useRef } from 'react';

import { useQuery } from '@apollo/client';
import { Box, FormHelperText } from '@mui/material';
import { type Control, useController, useFormState, useWatch } from 'react-hook-form';

import { Label } from '~/common/components';
import {
  type SurveyColumnsQuery,
  SurveyColumnsDocument,
  type SurveyColumnType,
  type ConditionOperator,
  type ValueType,
  type LogicalOperator,
} from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import {
  ConditionGroup,
  deleteAtPath,
  getInitialCondition,
  getInitialConditionGroup,
  insertCondition,
  insertGroup,
  updateAtPath,
  updateGateAtPath,
  type Inputs,
} from '~/modules/Rules/Filters';

type RulesProps = {
  control: Control<Inputs>;
  readOnly?: boolean;
};

export const ConditionsBuilder = ({ control, readOnly = false }: RulesProps) => {
  const { data: surveyColumns } = useQuery<SurveyColumnsQuery>(SurveyColumnsDocument);
  const { t_management } = useTranslation();

  const {
    field: { value: group, onChange },
    formState: { errors },
  } = useController({ control, name: 'rootConditionGroup' });

  const { dirtyFields } = useFormState({
    control,
  });

  const targetTable = useWatch({
    control,
    name: 'targetTable',
  });

  const trackingEnabled = useRef(false);

  useEffect(() => {
    if (readOnly) return;

    if (!trackingEnabled.current) {
      if (!dirtyFields.targetTable) return;
      trackingEnabled.current = true;
    }

    onChange(getInitialConditionGroup(targetTable, true));
  }, [dirtyFields.targetTable, onChange, readOnly, targetTable]);

  const errorMessage = errors.rootConditionGroup ? (
    <FormHelperText error sx={{ m: 0 }}>
      {t_management('chatAssignFilters.conditionsWrong')}
    </FormHelperText>
  ) : null;

  const surveyColumnsAliasMap = useMemo(
    () =>
      surveyColumns?.surveyColumns.reduce(
        (acc, column) => {
          if (column.alias) {
            acc[column.name] = column.alias;
          }
          return acc;
        },
        {} as Record<SurveyColumnType, string>,
      ),
    [surveyColumns],
  );

  const handleAddCondition = (path: number[]) => {
    const current = group;
    const next = insertCondition(current, path, getInitialCondition(targetTable));
    onChange(next);
  };

  const handleAddGroup = (path: number[]) => {
    const current = group;
    const next = insertGroup(current, path, getInitialConditionGroup(targetTable));
    onChange(next);
  };

  const handleUpdateValue = (
    path: number[],
    field: string,
    newValue: string | number,
    newValueType?: ValueType,
    defaultOperator?: ConditionOperator,
  ) => {
    if (!group) return;
    const next = updateAtPath(group, path, field, newValue, newValueType, defaultOperator);
    onChange(next);
  };

  const handleUpdateGate = (path: number[], newGate: LogicalOperator) => {
    if (!group) return;
    const next = updateGateAtPath(group, path, newGate);
    onChange(next);
  };

  const handleDeleteNode = (path: number[]) => {
    if (!group || path.length === 0) return;
    const next = deleteAtPath(group, path, getInitialCondition(targetTable));
    onChange(next);
  };

  return (
    <Box>
      <Box gap={2} mb={2}>
        <Label
          text={t_management('chatAssignFilters.filterBuilder.conditions')}
          mb={0}
          error={!!errorMessage}
          required={!readOnly}
        />
        {errorMessage}
      </Box>

      <Box sx={{ display: 'flex', gap: 5, mt: 2 }}>
        <ConditionGroup
          data={group}
          level={0}
          errors={errors.rootConditionGroup}
          readOnly={readOnly}
          path={[]}
          targetTable={targetTable}
          fieldsAlias={surveyColumnsAliasMap}
          onAddFilter={handleAddCondition}
          onAddGroup={handleAddGroup}
          onUpdateValue={handleUpdateValue}
          onUpdateGate={handleUpdateGate}
          onDeleteNode={handleDeleteNode}
        />
      </Box>
    </Box>
  );
};
