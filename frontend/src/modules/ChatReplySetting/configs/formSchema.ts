import { useForm as _useForm, type UseFormProps } from '~/lib/react-hook-form';
import { z } from '~/lib/zod';

const messageSchema = z.string().max(5000, { message: 'messageTooLong' }).optional();

const schema = z.object({
  isActive: z.boolean().default(false),
  useHolidays: z.boolean().optional(),
  useCustomDates: z.boolean().optional(),
  activeTimeMessage: messageSchema,
  defaultMessage: messageSchema,
});

export type Inputs = z.infer<typeof schema>;

const defaultValues: Inputs = {
  isActive: false,
};

export const useForm = (props: UseFormProps<Inputs>) => {
  return _useForm<Inputs>({ schema, defaultValues, ...props });
};
