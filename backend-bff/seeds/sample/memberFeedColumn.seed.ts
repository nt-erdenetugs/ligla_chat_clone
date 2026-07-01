import { DrizzleDB } from '@/drizzle';
import { MemberFeedColumnType } from '@/modules/member-feed/enums';
import { TenantTables } from '@@/drizzle/tenant/schema';

import { seedFeedOrSurveyColumns } from './common/memberFeedSurveyColumnSeeder';

const COLUMNS: Record<string, string> = Object.values(MemberFeedColumnType).reduce(
  (acc, columnName) => {
    acc[columnName] = columnName;
    return acc;
  },
  {} as Record<string, string>,
);

export const createMemberFeedColumns = async (
  db: DrizzleDB,
  tenantTables: TenantTables,
  orgName: string,
) => {
  await seedFeedOrSurveyColumns(db, tenantTables, {
    type: 'memberFeed',
    orgName,
    columns: COLUMNS,
    name: 'organizationSettings (memberFeed)',
    validColumnNames: new Set(Object.values(MemberFeedColumnType)),
  });
};
