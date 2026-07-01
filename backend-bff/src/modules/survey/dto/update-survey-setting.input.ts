import { Field, InputType } from '@nestjs/graphql';

import { SurveyColumnType } from '@/modules/survey/enums';

@InputType()
export class UpdateSurveySettingInput {
  @Field(() => [SurveyColumnType])
  enabledColumns: SurveyColumnType[];
}
