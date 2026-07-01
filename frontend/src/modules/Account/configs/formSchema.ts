import { useForm as _useForm, type UseFormProps } from '~/lib/react-hook-form';
import { z } from '~/lib/zod';

const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: 'enterPassword' }),
    newPassword: z
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
    confirmPassword: z.string().min(1, { message: 'enterPassword' }),
  })
  .refine((data) => data.confirmPassword === data.newPassword, {
    path: ['confirmPassword'],
    message: 'passwordNotMatch',
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    path: ['newPassword'],
    message: 'passwordSameAsOld',
  });

export const updatePasswordDefaultValues: UpdatePasswordInputs = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export type UpdatePasswordInputs = z.infer<typeof updatePasswordSchema>;

export const useUpdatePasswordForm = (props: UseFormProps<UpdatePasswordInputs>) => {
  return _useForm<UpdatePasswordInputs>({
    schema: updatePasswordSchema,
    defaultValues: updatePasswordDefaultValues,
    ...props,
  });
};
