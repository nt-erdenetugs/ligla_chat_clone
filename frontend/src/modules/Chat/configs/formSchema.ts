import { z } from '~/lib/zod';

export const ATTRIBUTE_VALUE_MAX_CHARACTER_LIMIT = 500;

export const attributeSchema = z.object({
  value: z.string().max(ATTRIBUTE_VALUE_MAX_CHARACTER_LIMIT).optional(),
});
