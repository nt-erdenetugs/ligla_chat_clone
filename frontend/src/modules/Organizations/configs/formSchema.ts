import { ORGANIZATION_DEFAULT_MAX_OPERATOR, ORGANIZATION_MAX_OPERATOR } from '~/common/constants';
import { useForm as _useForm, type UseFormProps } from '~/lib/react-hook-form';
import { z } from '~/lib/zod';

const schema = (registeredNames: string[]) =>
  z.object({
    name: z
      .string()
      .min(1, 'enterName')
      .max(250, 'nameTooLong')
      .regex(/^[a-z0-9_]+$/, {
        message: 'invalidCodeName',
      })
      .refine((v) => !registeredNames.includes(v), {
        message: 'nameAlreadyExists',
      }),
    displayName: z.string().min(1).max(250),
    description: z.string().max(250).nullish(),
    maxOperator: z.coerce
      .string()
      .refine((val) => !isNaN(parseFloat(val)), {
        message: 'maxOperatorNumeric',
      })
      .transform((val) => parseFloat(val)) // Convert string to number
      .refine((val) => Number.isInteger(val), {
        message: 'maxOperatorNotDecimal',
      })
      .refine((val) => val > 0, {
        message: 'maxOperatorPositive',
      })
      .refine((val) => val < ORGANIZATION_MAX_OPERATOR, {
        message: 'maxOperatorMaxValueExceeded',
      }),
    loginLiffId: z
      .string()
      .max(30)
      .regex(/^[A-Za-z0-9-]+$/, 'invalidLiffId'),
    fileUploadLiffId: z
      .string()
      .max(30)
      .regex(/^[A-Za-z0-9-]+$/, 'invalidLiffId'),
    emails: z.array(z.string()).optional(),
    apiKey: z
      .string()
      .min(5)
      .max(64)
      .regex(/^[A-Za-z0-9_\-.@#$%^&+=]+$/, 'invalidApiKey'),
    isActive: z.boolean().optional(),
  });

export type Inputs = z.infer<ReturnType<typeof schema>>;

const defaultValues: Inputs = {
  name: '',
  displayName: '',
  emails: [],
  isActive: true,
  apiKey: '',
  loginLiffId: '',
  fileUploadLiffId: '',
  maxOperator: ORGANIZATION_DEFAULT_MAX_OPERATOR,
};

export const useForm = (props: UseFormProps<Inputs>, registeredNames: string[] = []) => {
  return _useForm<Inputs>({
    schema: schema(registeredNames),
    defaultValues,
    ...props,
  });
};

const emailSchema = () => z.object({ email: z.string().email() });

export type EmailInputs = z.infer<ReturnType<typeof emailSchema>>;

export const useEmailForm = (props: UseFormProps<EmailInputs>) => {
  return _useForm<EmailInputs>({
    schema: emailSchema(),
    ...props,
  });
};
