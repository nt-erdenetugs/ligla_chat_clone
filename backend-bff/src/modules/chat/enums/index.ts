import { registerEnumType } from '@nestjs/graphql';

import { inferEnum, InferEnumType } from '@/drizzle/utils';
import { contenttype } from '@@/drizzle/schema';

const baseChatMessageType = inferEnum(contenttype);
export const ChatMessageType = { ...baseChatMessageType, FLEX: 'FLEX' } as const;
export type ChatMessageType = InferEnumType<typeof contenttype.enumValues> | 'FLEX';

registerEnumType(ChatMessageType, {
  name: 'ChatMessageType',
});
