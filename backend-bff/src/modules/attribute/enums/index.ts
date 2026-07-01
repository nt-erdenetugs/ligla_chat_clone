import { registerEnumType } from '@nestjs/graphql';

import { inferEnum, InferEnumType } from '@/drizzle/utils';
import { attributetype } from '@@/drizzle/schema';

export const AttributeType = inferEnum(attributetype);
export type AttributeType = InferEnumType<typeof attributetype.enumValues>;

registerEnumType(AttributeType, {
  name: 'AttributeType',
});
