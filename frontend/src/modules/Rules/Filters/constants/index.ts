import {
  LogicalOperator,
  ConditionOperator,
  SurveyColumnType,
  ValueType,
  FilterTargetType,
} from '~/generated/graphql/types';

import { type ICondition, type IConditionGroup } from '..';

export type IConditionOperator = {
  operator: ConditionOperator;
  labelKey: string;
  valueType?: ValueType;
};

type IConditionFieldItem = {
  field: string;
  label: string;
  operatorsType: IConditionOperator[];
};

type IConditionField = {
  category: 'favorites' | 'survey';
  fields: IConditionFieldItem[];
};

export const FILTER_NAME_MAX_CHARACTER_LIMIT = 50;
export const FILTER_NOTE_MAX_CHARACTER_LIMIT = 255;
export const MAX_INT_32 = 2147483647;

const DEFAULT_GATE = LogicalOperator.And;

export const ARRAY_VALUE_SEPARATOR = ' ';
export const NESTED_GROUP_MAX_DEPTH = 10;

export const GATE_COLORS = {
  AND: {
    lineColor: '#7ea5e3',
    chipBgColor: '#eaf1f9',
    chipBorderColor: '#90caf9',
    actionBtnColor: '#7ea5e3',
    parentSectionBgColor: '#f2f7ff',
    childSectionBgColor: '#fafcff',
  },
  OR: {
    lineColor: '#fed8ac',
    chipBgColor: '#fff3e0',
    chipBorderColor: '#ffcc80',
    actionBtnColor: '#ffb01f',
    parentSectionBgColor: '#fff7ec',
    childSectionBgColor: '#fffdf8',
  },
};

export const LOGIC_ONLY_OPERATORS = [ConditionOperator.Null, ConditionOperator.NotNull];

// ---------- Helper Functions ----------
const createOperators = (
  operators: { key: ConditionOperator; label: string; type: ValueType }[],
): IConditionOperator[] =>
  operators.map(({ key, label, type }) => ({
    operator: key,
    labelKey: `chatAssignFilters.filterBuilder.operators.${label}`,
    valueType: type,
  }));

const createSequentialFields = (
  prefix: string,
  start: number,
  end: number,
  type: IConditionOperator[],
): IConditionFieldItem[] =>
  Array.from({ length: end - start + 1 }, (_, i) => {
    const idx = i + start;
    const fieldKey = `${prefix}_${idx}` as keyof typeof SurveyColumnType;
    const field = SurveyColumnType[fieldKey] as string;
    return {
      field,
      label: `${prefix.replace(/([A-Z])/g, ' $1').trim()} ${idx}`,
      operatorsType: type,
    };
  });

// ---------- Operators ----------
const BASE_NUMBER_OPS = [
  { key: ConditionOperator.Equal, label: 'equal', type: ValueType.Number },
  { key: ConditionOperator.NotEqual, label: 'notEqual', type: ValueType.Number },
  { key: ConditionOperator.Gt, label: 'greaterThan', type: ValueType.Number },
  { key: ConditionOperator.Lt, label: 'lessThan', type: ValueType.Number },
  { key: ConditionOperator.Gte, label: 'greaterThanOrEqual', type: ValueType.Number },
  { key: ConditionOperator.Lte, label: 'lessThanOrEqual', type: ValueType.Number },
  { key: ConditionOperator.ValuesMatchAny, label: 'valuesMatchAny', type: ValueType.Array },
  {
    key: ConditionOperator.ValuesDoNotMatchAny,
    label: 'valuesDoNotMatchAny',
    type: ValueType.Array,
  },
  { key: ConditionOperator.Null, label: 'null', type: ValueType.Boolean },
  { key: ConditionOperator.NotNull, label: 'notNull', type: ValueType.Boolean },
];

const BASE_STRING_OPS = [
  { key: ConditionOperator.Equal, label: 'equal', type: ValueType.String },
  { key: ConditionOperator.NotEqual, label: 'notEqual', type: ValueType.String },
  { key: ConditionOperator.Include, label: 'include', type: ValueType.String },
  { key: ConditionOperator.NotInclude, label: 'notInclude', type: ValueType.String },
  { key: ConditionOperator.Regex, label: 'regex', type: ValueType.String },
  { key: ConditionOperator.Null, label: 'null', type: ValueType.Boolean },
  { key: ConditionOperator.NotNull, label: 'notNull', type: ValueType.Boolean },
];

const BASE_DATETIME_OPS = [
  { key: ConditionOperator.Equal, label: 'equal', type: ValueType.Datetime },
  { key: ConditionOperator.NotEqual, label: 'notEqual', type: ValueType.Datetime },
  { key: ConditionOperator.Gt, label: 'greaterThan', type: ValueType.Datetime },
  { key: ConditionOperator.Lt, label: 'lessThan', type: ValueType.Datetime },
  { key: ConditionOperator.Gte, label: 'greaterThanOrEqual', type: ValueType.Datetime },
  { key: ConditionOperator.Lte, label: 'lessThanOrEqual', type: ValueType.Datetime },
  { key: ConditionOperator.Null, label: 'null', type: ValueType.Boolean },
  { key: ConditionOperator.NotNull, label: 'notNull', type: ValueType.Boolean },
];

const BASE_ARRAY_OPS = [
  { key: ConditionOperator.ValuesMatchAny, label: 'valuesMatchAny', type: ValueType.Array },
  {
    key: ConditionOperator.ValuesDoNotMatchAny,
    label: 'valuesDoNotMatchAny',
    type: ValueType.Array,
  },
  { key: ConditionOperator.Null, label: 'null', type: ValueType.Boolean },
  { key: ConditionOperator.NotNull, label: 'notNull', type: ValueType.Boolean },
];

// ---------- Operator Groups ----------
const NUMBER_OPERATORS = createOperators(BASE_NUMBER_OPS);
export const STRING_OPERATORS = createOperators(BASE_STRING_OPS);
const DATETIME_OPERATORS = createOperators(BASE_DATETIME_OPS);
const ARRAY_OPERATORS = createOperators(BASE_ARRAY_OPS);

// ---------- Condition Fields ----------
export const STORE_IDS_FIELD = 'storeIds';
export const CONDITION_FIELDS: IConditionField[] = [
  {
    category: 'favorites',
    fields: [{ field: STORE_IDS_FIELD, label: 'store', operatorsType: ARRAY_OPERATORS }],
  },
  {
    category: 'survey',
    fields: [
      ...createSequentialFields('Category', 1, 25, STRING_OPERATORS),
      ...createSequentialFields('Number', 1, 15, NUMBER_OPERATORS),
      ...createSequentialFields('Datetime', 1, 15, DATETIME_OPERATORS),
    ],
  },
];

export const allConditionFields = CONDITION_FIELDS.flatMap((category) => category.fields);

// ---------- Defaults ----------
const DEFAULT_CONDITION: ICondition = {
  field: CONDITION_FIELDS[0].fields[0].field,
  operator: ConditionOperator.ValuesMatchAny,
  value: '',
  valueType: ValueType.String,
};

export const SINGLE_CONDITION_GROUP: IConditionGroup = {
  logicalOperator: DEFAULT_GATE,
  conditions: [DEFAULT_CONDITION],
  subGroups: [],
};

export const TARGET_TABLE_FIELD_CATEGORY_MAP = {
  [FilterTargetType.Store]: 'favorites',
  [FilterTargetType.Survey]: 'survey',
};

export const getInitialCondition = (targetTable: FilterTargetType) => {
  const avialableConditions = CONDITION_FIELDS.filter(
    (field) => field.category === TARGET_TABLE_FIELD_CATEGORY_MAP[targetTable],
  );
  const [firstField] = avialableConditions[0].fields;
  const { field, operatorsType } = firstField;

  if (!field) return DEFAULT_CONDITION;

  const [firstOperator] = operatorsType;

  return {
    field,
    operator: firstOperator.operator,
    value: '',
    valueType: firstOperator.valueType as ValueType,
  };
};

export const getInitialConditionGroup = (
  targetTable: FilterTargetType,
  isRoot = false,
): IConditionGroup => {
  const defaultCondition = getInitialCondition(targetTable);
  return {
    logicalOperator: DEFAULT_GATE,
    conditions: isRoot ? [defaultCondition] : [defaultCondition, defaultCondition],
    subGroups: [],
  };
};
