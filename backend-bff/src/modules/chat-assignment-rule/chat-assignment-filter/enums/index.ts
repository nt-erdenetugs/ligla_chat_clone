import { registerEnumType } from '@nestjs/graphql';

import { inferEnum, InferEnumType } from '@/drizzle/utils';
import { conditionoperator, logicaloperator, valuetype } from '@@/drizzle/enums';

export const LogicalOperator = inferEnum(logicaloperator);
export type LogicalOperator = InferEnumType<typeof logicaloperator.enumValues>;

registerEnumType(LogicalOperator, {
  name: 'LogicalOperator',
});

export const ConditionOperator = inferEnum(conditionoperator);
export type ConditionOperator = InferEnumType<typeof conditionoperator.enumValues>;

registerEnumType(ConditionOperator, {
  name: 'ConditionOperator',
});

export const ValueType = inferEnum(valuetype);
export type ValueType = InferEnumType<typeof valuetype.enumValues>;

registerEnumType(ValueType, {
  name: 'ValueType',
});

export enum FilterTargetType {
  STORE = 'STORE',
  SURVEY = 'SURVEY',
}

registerEnumType(FilterTargetType, {
  name: 'FilterTargetType',
});
