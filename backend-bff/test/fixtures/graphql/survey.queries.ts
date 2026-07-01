export const SURVEY_QUERIES = {
  GET_SURVEY_COLUMNS: `
    query SurveyColumns {
      surveyColumns {
        name
        alias
        isEnabled
      }
    }
  `,

  GET_SURVEYS: `
    query Surveys($chatId: String!) {
      surveys(chatId: $chatId) {
        columnName
        columnAlias
        value
      }
    }
  `,

  UPDATE_SURVEY_SETTING: `
    mutation UpdateSurveySetting($updateSurveySettingInput: UpdateSurveySettingInput!) {
      updateSurveySetting(updateSurveySettingInput: $updateSurveySettingInput) {
        name
        alias
        isEnabled
      }
    }
  `,
};
