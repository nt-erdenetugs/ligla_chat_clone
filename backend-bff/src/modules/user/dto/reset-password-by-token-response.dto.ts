import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ResetPasswordByTokenResponse {
  @Field()
  success: boolean;

  @Field(() => String, { nullable: true })
  warning: string | null;
}
