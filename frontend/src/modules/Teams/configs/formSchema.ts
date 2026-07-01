import { useForm as _useForm, type UseFormProps } from '~/lib/react-hook-form';
import { z } from '~/lib/zod';

export const TEAM_NAME_MAX_CHARACTER_LIMIT = 250;

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: 'enterName' })
    .max(TEAM_NAME_MAX_CHARACTER_LIMIT, { message: 'nameTooLong' })
    .regex(/^(?:\S+\s)*\S+$/, 'nameMustContain'),
  managerIds: z.string().array(),
  operatorIds: z.string().array(),
  storeIds: z.string().array(),
  isActive: z.boolean(),
  teamSetting: z.object({
    teamChatSetting: z.object({
      viewAllChatsEnabled: z.boolean(),
    }),
  }),
});

export type Inputs = z.infer<typeof schema>;

const defaultValues: Inputs = {
  name: '',
  managerIds: [],
  operatorIds: [],
  storeIds: [],
  isActive: true,
  teamSetting: {
    teamChatSetting: {
      viewAllChatsEnabled: true,
    },
  },
};

export const useForm = (props: UseFormProps<Inputs>) => {
  return _useForm<Inputs>({ schema, defaultValues, ...props });
};
