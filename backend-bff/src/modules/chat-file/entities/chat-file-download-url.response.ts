import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class ChatFileDownloadUrlResponse {
  @Field()
  signedUrl: string;

  @Field()
  fileName: string;

  @Field()
  mimeType: string;
}
