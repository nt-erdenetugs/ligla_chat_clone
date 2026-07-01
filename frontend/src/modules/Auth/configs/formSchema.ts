import { useForm as _useForm, type UseFormProps } from '~/lib/react-hook-form';
import { z } from '~/lib/zod';

const schema = z.object({
  email: z
    .string()
    .min(1, { message: 'enterEmail' })
    .max(255, { message: 'emailTooLong' })
    .email({ message: 'emailValid' }),
  password: z.string().min(1, { message: 'enterPassword' }),
});

export type Inputs = z.infer<typeof schema>;

export const defaultValues: Inputs = { email: '', password: '' };

export const useForm = (props: UseFormProps<Inputs>) => {
  return _useForm<Inputs>({ schema, defaultValues, ...props });
};

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(1, { message: 'enterPassword' })
      .min(6, { message: 'passwordAtLeast' })
      .max(255, { message: 'passwordTooLong' })
      .regex(/[A-Z]/, {
        message: 'passwordContainUppercase',
      })
      .regex(/[a-z]/, {
        message: 'passwordContainLowercase',
      })
      .regex(/[0-9]/, {
        message: 'passwordContainNumber',
      })
      .regex(/[!@#$%^&*()_+-]/, {
        message: 'passwordContainSpecial',
      }),
    validatePassword: z.string(),
  })
  .refine((data) => data.validatePassword === data.password, {
    path: ['validatePassword'],
    message: 'passwordNotMatch',
  });

export type ResetPasswordInputs = z.infer<typeof resetPasswordSchema>;

export const resetPasswordDefaultValues: ResetPasswordInputs = {
  password: '',
  validatePassword: '',
};

export const useResetPasswordForm = (props: UseFormProps<ResetPasswordInputs>) => {
  return _useForm<ResetPasswordInputs>({
    schema: resetPasswordSchema,
    defaultValues: resetPasswordDefaultValues,
    ...props,
  });
};
