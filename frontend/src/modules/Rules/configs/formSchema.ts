import { LogicalOperator } from '~/generated/graphql/types';
import { useForm as _useForm, type UseFormProps } from '~/lib/react-hook-form';
import { z } from '~/lib/zod';
import { uniqueKey } from '~/utils';

import { RULE_NAME_MAX_CHARACTER_LIMIT, RULE_NOTE_MAX_CHARACTER_LIMIT } from '../constants';
import { FilterGroupItemType } from '../types';

export type IFilter = z.infer<typeof filterSchema>;

export type IFilterGroup = z.infer<typeof baseGroupSchema> & {
  items: (IFilterGroup | IFilter)[];
};

const filterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  key: z.string(),
  type: z.enum(FilterGroupItemType),
});

const baseGroupSchema = z.object({
  logicalOperator: z.enum(LogicalOperator),
  key: z.string(),
  type: z.enum(FilterGroupItemType),
});

const nestedGroupSchema: z.ZodType<IFilterGroup> = baseGroupSchema.extend({
  items: z
    .lazy(() => z.array(nestedGroupSchema.or(filterSchema)))
    .refine((items) => items.length > 1, {
      message: 'chatAssignRules.mustHaveTwoItems',
    }),
});

const rootGroupSchema: z.ZodType<IFilterGroup> = baseGroupSchema.extend({
  items: z
    .lazy(() => z.array(nestedGroupSchema.or(filterSchema)))
    .refine((items) => items.length > 0, {
      message: 'chatAssignRules.mustHaveFilterOrSubgroup',
    }),
});

const schema = z.object({
  name: z
    .string()
    .min(1, 'enterName')
    .max(RULE_NAME_MAX_CHARACTER_LIMIT, { message: 'nameTooLong' }),
  note: z
    .string()
    .max(RULE_NOTE_MAX_CHARACTER_LIMIT, {
      message: 'noteMaxCharacterLimit',
    })
    .nullish(),
  isActive: z.boolean().default(true),
  targetTeamIds: z.array(z.string()).min(1, { message: 'chatAssignRules.selectAtLeastOneTeam' }),
  rootFilterGroup: rootGroupSchema,
});

export type Inputs = z.infer<typeof schema>;

const SINGLE_FILTER_GROUP: IFilterGroup = {
  type: FilterGroupItemType.Group,
  key: uniqueKey(FilterGroupItemType.Group),
  logicalOperator: LogicalOperator.And,
  items: [],
};

const defaultValues: Inputs = {
  name: '',
  note: '',
  isActive: true,
  targetTeamIds: [],
  rootFilterGroup: SINGLE_FILTER_GROUP,
};

export const useForm = (props: UseFormProps<Inputs>) => {
  return _useForm<Inputs>({ schema, defaultValues, ...props });
};
