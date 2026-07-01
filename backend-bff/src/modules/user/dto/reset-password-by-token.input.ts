import { InputType, Field } from '@nestjs/graphql';

import { MaxLength, MinLength, Matches } from 'class-validator';

@InputType()
export class ResetPasswordByTokenInput {
  @Field()
  @MinLength(1)
  token: string;

  @Field()
  @MinLength(1)
  @MaxLength(255, { message: 'Password is too long' })
  @Matches(/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[!@#$%^&*()_+-]).{6,}$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  newPassword: string;
}
