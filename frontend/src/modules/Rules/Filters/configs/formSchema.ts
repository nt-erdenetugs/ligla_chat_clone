import {
  type ChatAssignCondition,
  LogicalOperator,
  ConditionOperator,
  ValueType,
  FilterTargetType,
} from '~/generated/graphql/types';
import { useForm as _useForm, type UseFormProps } from '~/lib/react-hook-form';
import { z } from '~/lib/zod';
import { validateRe2Pattern } from '~/utils/re2Validation';

import {
  FILTER_NAME_MAX_CHARACTER_LIMIT,
  FILTER_NOTE_MAX_CHARACTER_LIMIT,
  LOGIC_ONLY_OPERATORS,
  MAX_INT_32,
  SINGLE_CONDITION_GROUP,
} from '../constants';

export type IConditionGroup = {
  logicalOperator: LogicalOperator;
  conditions: ICondition[];
  subGroups?: Nullable<IConditionGroup[]>;
};

export type ICondition = z.infer<typeof conditionSchema> &
  Pick<ChatAssignCondition, 'valueObjects'>;

export type IConditionNode = IConditionGroup | ICondition;

const conditionSchema = z
  .object({
    field: z.string().min(1, { message: 'chatAssignRules.filter.enterField' }),
    operator: z.enum(ConditionOperator),
    value: z
      .string()
      .max(255, { message: 'chatAssignRules.filter.valueTooLong' })
      .optional()
      .nullable(),
    valueType: z.enum(ValueType),
  })
  .refine(
    (data) => {
      // If operator requires a value, value must not be empty
      const requiresValue = !LOGIC_ONLY_OPERATORS.includes(data.operator);
      if (requiresValue) {
        return !!data.value && data.value.trim().length > 0;
      }
      return true;
    },
    {
      message: 'chatAssignRules.filter.valueRequired',
      path: ['value'],
    },
  )
  .refine(
    (data) => {
      // If operator is Regex, validate that value is a valid RE2-compatible regex pattern
      if (data.operator === ConditionOperator.Regex && data.value) {
        const validation = validateRe2Pattern(data.value);
        if (!validation.isValid && validation.error) {
          console.warn(validation.error);
        }

        return validation.isValid;
      }
      return true;
    },
    {
      message: 'chatAssignRules.filter.invalidRegexPattern',
      path: ['value'],
    },
  )
  .refine(
    (data) => {
      if (data.valueType === ValueType.Number) {
        return Number(data.value) <= MAX_INT_32;
      }
      return true;
    },
    {
      message: 'chatAssignRules.filter.maxInt32Exceeded',
      path: ['value'],
    },
  );

const groupSchema: z.ZodType<IConditionGroup> = z.lazy(() =>
  z
    .object({
      logicalOperator: z.enum(LogicalOperator),
      conditions: z.array(conditionSchema),
      subGroups: z.array(groupSchema).optional().nullable(),
    })
    .refine((data) => data.conditions.length > 0 || (data.subGroups?.length ?? 0) > 0, {
      message: 'chatAssignRules.filter.mustHaveConditionOrSubgroup',
    }),
);

const schema = z.object({
  name: z
    .string()
    .min(1, 'enterName')
    .max(FILTER_NAME_MAX_CHARACTER_LIMIT, { message: `nameTooLong` }),
  targetTable: z.enum(FilterTargetType),
  note: z
    .string()
    .max(FILTER_NOTE_MAX_CHARACTER_LIMIT, {
      message: 'noteMaxCharacterLimit',
    })
    .optional()
    .nullable(),
  isActive: z.boolean().default(true),
  rootConditionGroup: groupSchema,
});

export type Inputs = z.infer<typeof schema>;

const defaultValues: Inputs = {
  name: '',
  targetTable: FilterTargetType.Store,
  isActive: true,
  rootConditionGroup: SINGLE_CONDITION_GROUP,
};

export const useForm = (props: UseFormProps<Inputs>) => {
  return _useForm<Inputs>({ schema, defaultValues, ...props });
};
