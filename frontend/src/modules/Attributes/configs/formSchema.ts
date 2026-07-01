import { useForm as _useForm, type UseFormProps } from '~/lib/react-hook-form';
import { z } from '~/lib/zod';

export const ATTRIBUTE_NAME_MAX_CHARACTER_LIMIT = 20;

const schema = (registeredNames: string[]) =>
  z.object({
    name: z
      .string()
      .trim()
      .min(1, 'enterName')
      .max(ATTRIBUTE_NAME_MAX_CHARACTER_LIMIT)
      .refine((v) => !registeredNames.includes(v), {
        message: 'nameAlreadyExists',
      }),
    isActive: z.boolean().optional(),
    type: z.string().min(1, 'enterType'),
    selectOptions: z
      .array(
        z.object({
          id: z.string().optional(),
          value: z
            .string()
            .min(1, 'enterValue')
            .max(50, 'valueTooLong')
            .refine((v) => v.trim().length > 0, { message: 'onlySpaces' }),
          label: z.string().optional(),
        }),
      )
      .optional(),
    isEncryptionEnabled: z.boolean().optional(),
  });

export type Inputs = z.infer<ReturnType<typeof schema>>;

const defaultValues: Inputs = {
  name: '',
  type: 'string',
  selectOptions: [],
  isActive: true,
  isEncryptionEnabled: false,
};

export const useForm = (props: UseFormProps<Inputs>, registeredNames: string[] = []) => {
  return _useForm<Inputs>({
    schema: schema(registeredNames),
    defaultValues,
    ...props,
  });
};
