import { InputType, Field } from '@nestjs/graphql';

import { Transform } from 'class-transformer';
import { IsString, MaxLength, Matches } from 'class-validator';

@InputType()
export class CreateTagInput {
  @Field()
  @IsString()
  @Transform(({ value }) => value?.trim().replace(/\s+/g, ' '))
  @Matches(/^(?!\s*$).+/, {
    message: 'The name field cannot be empty',
  })
  @MaxLength(20, { message: 'The name must contain at most 20 character(s)' })
  name: string;
}
