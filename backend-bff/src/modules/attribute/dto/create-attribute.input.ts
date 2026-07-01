import { InputType, Field } from '@nestjs/graphql';

import { Type } from 'class-transformer';
import {
  MaxLength,
  Matches,
  IsEnum,
  IsArray,
  IsOptional,
  IsUUID,
  ValidateNested,
  IsDefined,
  IsBoolean,
  IsString,
  IsNotEmpty,
} from 'class-validator';

import { AttributeType } from '../enums';

@InputType()
export class SelectOptionInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  id?: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty({ message: 'The value field cannot be empty' })
  value: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  label?: string;
}
@InputType()
export class CreateAttributeInput {
  @Field()
  @Matches(/^(?!\s*$).+/, {
    message: 'The name field cannot be empty',
  })
  @MaxLength(20, { message: 'The name must contain at most 20 character(s)' })
  name: string;

  @Field(() => AttributeType, { defaultValue: AttributeType.string })
  @IsEnum(AttributeType)
  type: AttributeType;

  @Field(() => [SelectOptionInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectOptionInput)
  selectOptions?: SelectOptionInput[];

  @Field(() => Boolean, { defaultValue: false })
  @IsDefined()
  @IsBoolean()
  isEncryptionEnabled: boolean;
}
