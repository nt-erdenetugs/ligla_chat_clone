import { InputType, Field } from '@nestjs/graphql';

import { MaxLength, MinLength, IsEmail } from 'class-validator';

@InputType()
export class LoginInput {
  @Field()
  @IsEmail()
  @MinLength(1)
  @MaxLength(255, { message: 'Email address is too long' })
  email: string;

  @Field()
  @MinLength(1)
  password: string;
}
