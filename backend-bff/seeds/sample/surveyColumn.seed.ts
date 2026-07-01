import { DrizzleDB } from '@/drizzle';
import { SurveyColumnType } from '@/modules/survey/enums';
import { TenantTables } from '@@/drizzle/tenant/schema';

import { seedFeedOrSurveyColumns } from './common/memberFeedSurveyColumnSeeder';

export const COLUMNS: Record<string, string> = Object.values(SurveyColumnType).reduce(
  (acc, columnName) => {
    acc[columnName] = columnName;
    return acc;
  },
  {} as Record<string, string>,
);

export const createSurveyColumns = async (
  db: DrizzleDB,
  tenantTables: TenantTables,
  orgName: string,
) => {
  await seedFeedOrSurveyColumns(db, tenantTables, {
    type: 'survey',
    orgName,
    columns: COLUMNS,
    name: 'organizationSettings (survey)',
    validColumnNames: new Set(Object.values(SurveyColumnType)),
  });
};
