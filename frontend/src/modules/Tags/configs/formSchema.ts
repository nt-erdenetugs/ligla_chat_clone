import { useForm as _useForm, type UseFormProps } from '~/lib/react-hook-form';
import { z } from '~/lib/zod';

export const TAG_NAME_MAX_CHARACTER_LIMIT = 20;

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: 'enterName' })
    .max(TAG_NAME_MAX_CHARACTER_LIMIT, { message: 'nameTooLong' })
    .regex(/^(?:\S+\s)*\S+$/, 'nameMustContain'),
  isActive: z.boolean().optional(),
});

export type Inputs = z.infer<typeof schema>;

const defaultValues: Inputs = {
  name: '',
  isActive: true,
};

export const useForm = (props: UseFormProps<Inputs>) => {
  return _useForm<Inputs>({ schema, defaultValues, ...props });
};
