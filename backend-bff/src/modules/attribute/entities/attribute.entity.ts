import { ObjectType, Field } from '@nestjs/graphql';

import { AttributeType } from '@/modules/attribute/enums';

@ObjectType()
export class SelectOption {
  @Field()
  id: string;

  @Field()
  value: string;

  @Field(() => String, { nullable: true })
  label?: string | null;
}
@ObjectType()
export class Attribute {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field(() => AttributeType, { defaultValue: AttributeType.string, nullable: true })
  type: AttributeType;

  @Field(() => [SelectOption], { nullable: true, name: 'selectOption' })
  selectOptions?: SelectOption[];

  @Field(() => Boolean)
  isActive: boolean;

  @Field(() => Boolean)
  isEncryptionEnabled: boolean;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => String, { nullable: true })
  chatId?: string | null;
}
