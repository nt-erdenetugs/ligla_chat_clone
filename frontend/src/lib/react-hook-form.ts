import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  useForm as _useForm,
  type UseFormProps as _UseFormProps,
  type FieldValues,
  type Path,
} from 'react-hook-form';
import { type ZodType } from 'zod';

type ErrorResponse = Record<string, string | string[]>;

export type UseFormProps<Inputs extends FieldValues> = _UseFormProps<Inputs> & {
  errors?: ErrorResponse;
};

export type UseFormWithSchema<Inputs extends FieldValues> = UseFormProps<Inputs> & {
  schema: ZodType<any, any, any>;
};

export const useForm = <Inputs extends FieldValues>({
  schema,
  errors,
  ...props
}: UseFormWithSchema<Inputs>) => {
  const form = _useForm<Inputs>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    ...props,
  });

  useEffect(() => {
    if (errors) {
      Object.entries(errors).forEach(([key, value]) => {
        const message = Array.isArray(value) ? value.join('\n') : (value as string);
        form.setError(key as Path<Inputs>, { message });
      });
    }
  }, [errors, form]);

  return form;
};
