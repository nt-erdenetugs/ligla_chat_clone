import { z } from 'zod';

type NumberProps = {
  min?: number;
  max?: number;
  required?: boolean;
};

export const number = (props?: NumberProps) => {
  const { min, max, required } = props || {};
  return z.preprocess(
    (v) => {
      if (v === '' || v === null || v === undefined) {
        return '';
      } else {
        return Number(v);
      }
    },
    z
      .number()
      .or(z.literal(''))
      .or(z.nan())
      .nullish()
      .refine((v) => !Number.isNaN(v), {
        message: 'fieldMustBeNumber',
      })
      .refine((v) => !required || (v !== '' && v !== null && v !== undefined), {
        message: 'fieldIsRequired',
      })
      .refine((v) => typeof v !== 'number' || min === undefined || min <= v, {
        message: `Number must be greater than or equal to ${min}`,
      })
      .refine((v) => typeof v !== 'number' || max === undefined || v <= max, {
        message: `Number must be less than or equal to ${max}`,
      }),
  );
};

export { z };
