import { DISPLAY_NAME_MAX_CHAR_LIMIT } from '~/common/constants';
import { useForm as _useForm, type UseFormProps } from '~/lib/react-hook-form';
import { z } from '~/lib/zod';

const schema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: 'emailValid' })
    .min(1, { message: 'enterEmail' })
    .max(255, { message: 'emailTooLong' }),
  displayName: z
    .string()
    .trim()
    .min(1, { message: 'enterName' })
    .max(DISPLAY_NAME_MAX_CHAR_LIMIT, { message: 'nameTooLong' }),
  senderName: z
    .string()
    .trim()
    .max(DISPLAY_NAME_MAX_CHAR_LIMIT, { message: 'nameTooLong' })
    .nullish(),
  roleType: z.string().min(1, { message: 'selectRole' }),
  teamIds: z.string().array().nullish(),
  isActive: z.boolean().nullish(),
});

export type Inputs = z.infer<typeof schema>;

const defaultValues: Inputs = {
  email: '',
  displayName: '',
  senderName: '',
  roleType: '',
  isActive: true,
};

export const useForm = (props: UseFormProps<Inputs>) => {
  return _useForm<Inputs>({ schema, defaultValues, ...props });
};
