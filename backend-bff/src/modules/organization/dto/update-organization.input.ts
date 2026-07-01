import { Field, InputType, PartialType } from '@nestjs/graphql';

import { IsBoolean, IsOptional } from 'class-validator';

import { CreateOrganizationInput } from './create-organization.input';

@InputType()
export class UpdateOrganizationInput extends PartialType(CreateOrganizationInput) {
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
