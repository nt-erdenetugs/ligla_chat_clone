import { type ChatAssignCondition, ConditionOperator, ValueType } from '~/generated/graphql/types';
import { type ICondition, ARRAY_VALUE_SEPARATOR, STORE_IDS_FIELD } from '~/modules/Rules/Filters';

type SentenceParams = Pick<ChatAssignCondition, 'valueObjects'> & {
  field: string;
  operator: ConditionOperator;
  value: string;
  valueType?: ValueType;
  fieldsAlias?: Record<string, string>;
  t: (key: string, config?: object) => string;
};

const getFieldDisplayName = (field: string, fieldsAlias?: Record<string, string>): string => {
  if (fieldsAlias?.[field]) {
    return fieldsAlias[field];
  }

  // Extract field type and number for survey fields
  if (field.startsWith('survey_')) {
    const parts = field.replace('survey_', '').match(/^(category|number|datetime)_(\d)$/i);
    if (parts) {
      const [, type, num] = parts;
      return `${type.charAt(0).toUpperCase() + type.slice(1)}_${num}`;
    }
  }

  return field;
};

const formatValue = ({
  field,
  value,
  valueType,
  valueObjects,
}: Pick<SentenceParams, 'field' | 'value' | 'valueType' | 'valueObjects'>): string => {
  if (!value) return '';

  switch (valueType) {
    case ValueType.Array:
      if (field === STORE_IDS_FIELD && Array.isArray(valueObjects) && valueObjects.length) {
        return valueObjects.map((value) => String(value.name)).join(', ');
      }
      return value.split(ARRAY_VALUE_SEPARATOR).filter(Boolean).join(', ');
    case ValueType.Datetime:
      return value;
    case ValueType.Number:
      return value;
    case ValueType.String:
    default:
      return `"${value}"`;
  }
};

export const conditionToSentence = ({
  field,
  operator,
  value,
  valueType,
  valueObjects,
  fieldsAlias,
  t,
}: SentenceParams): string => {
  const fieldName = getFieldDisplayName(field, fieldsAlias);
  const formattedValue = formatValue({ field, value, valueType, valueObjects });
  const categoryKey = field === STORE_IDS_FIELD ? 'favoriteStore' : 'survey';

  // Map operators to sentence templates
  const operatorKey = (() => {
    switch (operator) {
      case ConditionOperator.Equal:
        return 'equals';
      case ConditionOperator.NotEqual:
        return 'notEquals';
      case ConditionOperator.Include:
        return 'includes';
      case ConditionOperator.NotInclude:
        return 'doesNotInclude';
      case ConditionOperator.Regex:
        return 'matchesPattern';
      case ConditionOperator.Null:
        return 'isEmpty';
      case ConditionOperator.NotNull:
        return 'isNotEmpty';
      case ConditionOperator.Gt:
        return 'greaterThan';
      case ConditionOperator.Lt:
        return 'lessThan';
      case ConditionOperator.Gte:
        return 'greaterThanOrEquals';
      case ConditionOperator.Lte:
        return 'lessThanOrEquals';
      case ConditionOperator.ValuesMatchAny:
        return 'matchesAny';
      case ConditionOperator.ValuesDoNotMatchAny:
        return 'doesNotMatchAny';
      default:
        return 'equals';
    }
  })();

  // Check if operator needs value
  const needsValue = ![ConditionOperator.Null, ConditionOperator.NotNull].includes(operator);

  const translationKey = `chatAssignFilters.filterBuilder.sentences.${categoryKey}.${operatorKey}`;

  if (needsValue) {
    return t(translationKey, { field: fieldName, value: formattedValue });
  } else {
    return t(translationKey, { field: fieldName });
  }
};

export const conditionDataToSentence = (
  condition: ICondition,
  fieldsAlias: Record<string, string> | undefined,
  t: SentenceParams['t'],
): string => {
  const { field, operator, valueType, value, valueObjects } = condition;

  return conditionToSentence({
    field,
    operator,
    valueType,
    fieldsAlias,
    value: value ?? '',
    valueObjects,
    t,
  });
};
