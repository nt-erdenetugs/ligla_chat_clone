import { useForm as _useForm, type UseFormProps } from '~/lib/react-hook-form';
import { z } from '~/lib/zod';

const emailSchema = () => z.object({ email: z.string().email() });

export type EmailInputs = z.infer<ReturnType<typeof emailSchema>>;

export const useEmailForm = (props: UseFormProps<EmailInputs>) => {
  return _useForm<EmailInputs>({
    schema: emailSchema(),
    ...props,
  });
};
