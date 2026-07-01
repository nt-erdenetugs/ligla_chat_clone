import { ObjectType, Field } from '@nestjs/graphql';

import { ChatFile } from './chat-file.entity';

@ObjectType()
export class ConfirmChatFileUploadResponse {
  @Field()
  success: boolean;

  @Field(() => ChatFile)
  chatFile: ChatFile;
}
