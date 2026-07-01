import { InputType, Int, Field } from '@nestjs/graphql';

import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

@InputType()
export class CreateOrganizationInput {
  @Field()
  @IsNotEmpty({ message: 'Code name is required' })
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @Field()
  @IsNotEmpty({ message: 'Display name is required' })
  @MinLength(1)
  @MaxLength(255)
  displayName: string;

  @Field({ nullable: true })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  description?: string;

  @Field(() => Int)
  @IsNumber()
  @Min(1)
  maxOperator: number;

  @Field()
  @IsNotEmpty({ message: 'Login Liff ID is required' })
  @MinLength(1)
  @MaxLength(30)
  loginLiffId: string;

  @Field()
  @IsNotEmpty({ message: 'File upload Liff ID is required' })
  @MinLength(1)
  @MaxLength(30)
  fileUploadLiffId: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsEmail({}, { each: true, message: 'Invalid email address' })
  emails?: string[];

  @Field()
  @IsString()
  @IsNotEmpty({ message: 'API key is required' })
  @MinLength(5)
  @MaxLength(64)
  apiKey: string;
}
