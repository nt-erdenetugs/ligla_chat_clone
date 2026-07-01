import { ObjectType, Field } from '@nestjs/graphql';

import { SurveyColumnType } from '@/modules/survey/enums';

@ObjectType()
export class SurveyColumn {
  @Field(() => SurveyColumnType)
  name: SurveyColumnType;

  @Field()
  alias: string;

  @Field()
  isEnabled: boolean;
}

@ObjectType()
export class Survey {
  @Field(() => SurveyColumnType)
  columnName: SurveyColumnType;

  @Field()
  columnAlias: string;

  @Field(() => String, { nullable: true })
  value: Nullable<string>;
}
