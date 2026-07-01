import { ObjectType, Field } from '@nestjs/graphql';

import { ChatFile } from './chat-file.entity';

@ObjectType()
export class ChatFileUploadResponse {
  @Field(() => ChatFile)
  chatFile: ChatFile;

  @Field()
  signedUrl: string;
}
