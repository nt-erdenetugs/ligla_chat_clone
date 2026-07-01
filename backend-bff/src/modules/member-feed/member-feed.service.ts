import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { eq } from 'drizzle-orm';
import { I18nService } from 'nestjs-i18n';

import { OrganizationSettingsType } from '@/common/constants';
import {
  type ColumnSettingsWithExtras,
  parseMemberFeedSettingsMap,
  parseSettingsWithExtras,
  getMemberFeedColumnSetting,
} from '@/common/types/column-settings.types';
import {
  validateColumns,
  checkDuplicates,
  filterInvalidColumns,
} from '@/common/utils/memberFeedSurveySetting';
import { DrizzleDB, InjectDrizzle, TenantSchemaService } from '@/drizzle';

import { UpdateMemberFeedSettingInput } from './dto/update-member-feed-setting.input';
import { MemberFeed, MemberFeedColumn } from './entities/member-feed.entity';
import { MemberFeedColumnType } from './enums';

type MemberFeedColumnSettingsRecord = ColumnSettingsWithExtras<MemberFeedColumnType>;

@Injectable()
export class MemberFeedService {
  private readonly logger = new Logger(MemberFeedService.name);
  private readonly validColumns = new Set<MemberFeedColumnType>(
    Object.values(MemberFeedColumnType),
  );

  constructor(
    private readonly i18n: I18nService,
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly tenantSchema: TenantSchemaService,
  ) {}

  async findMemberFeedColumns(organizationId: string): Promise<MemberFeedColumn[]> {
    const setting = await this.getMemberFeedSettings(organizationId);

    const columnSettings = parseMemberFeedSettingsMap(setting?.memberFeedSurveyColumnSettings);

    const memberFeedColumnMap = Object.entries(MemberFeedColumnType).map(([key, value]) => ({
      key,
      value,
    }));

    return memberFeedColumnMap.map(({ key, value }) => {
      const setting = getMemberFeedColumnSetting(columnSettings, value);
      return {
        name: value,
        alias: setting?.alias || key,
        isEnabled: setting?.isEnabled ?? false,
      };
    });
  }

  async findMemberFeeds(
    organizationId: string,
    clientUserId?: string,
  ): Promise<Nullable<MemberFeed[]>> {
    try {
      // Fetch settings to get enabled columns
      const setting = await this.getMemberFeedSettings(organizationId);

      if (!setting) return null;

      const columnSettings = parseMemberFeedSettingsMap(setting.memberFeedSurveyColumnSettings);

      // Extract enabled columns from settings
      const enabledColumnsArray = (
        Object.entries(columnSettings) as [
          MemberFeedColumnType,
          (typeof columnSettings)[MemberFeedColumnType],
        ][]
      )
        .filter(([, value]) => value?.isEnabled === true)
        .map(([key]) => key);

      if (!enabledColumnsArray.length) return null;

      // Validate enabled columns
      const validatedColumns = validateColumns(enabledColumnsArray, {
        validColumns: this.validColumns,
        organizationId,
        i18n: this.i18n,
        logger: this.logger,
        errorPrefix: 'memberFeed',
      });

      if (!validatedColumns.length) return null;

      // Sort columns according to enum order
      const columnsOrder = Object.values(MemberFeedColumnType);
      const sortedColumns = validatedColumns.sort(
        (a, b) => columnsOrder.indexOf(a) - columnsOrder.indexOf(b),
      );

      const tenant = this.tenantSchema.getTables(organizationId);

      const memberFeedData = clientUserId
        ? await this.db
            .select()
            .from(tenant.memberFeedData)
            .where(eq(tenant.memberFeedData.clientUserId, clientUserId))
            .then((rows) => rows[0] || null)
        : null;

      // Map to result format
      const enumEntries = Object.entries(MemberFeedColumnType).map(([key, value]) => ({
        key,
        value: value as MemberFeedColumnType,
      }));

      return sortedColumns.map((column) => {
        const entry = enumEntries.find((e) => e.value === column);
        const key = entry?.key || column;
        const setting = getMemberFeedColumnSetting(columnSettings, column);

        return {
          columnName: column,
          columnAlias: setting?.alias || key,
          value:
            memberFeedData?.[column] instanceof Date
              ? memberFeedData?.[column].toISOString()
              : memberFeedData?.[column]?.toString() || '-',
        };
      });
    } catch (error) {
      this.logger.error(
        `Failed to read member feeds for clientUserId: ${clientUserId}: ${error.message}`,
      );
      throw new BadRequestException(this.i18n.t('errors.memberFeed.readFailed'));
    }
  }

  async updateMemberFeedSetting(
    input: UpdateMemberFeedSettingInput,
    organizationId: string,
  ): Promise<MemberFeedColumn[]> {
    const { enabledColumns: rawEnabledColumns = [] } = input;

    checkDuplicates(rawEnabledColumns, this.i18n, 'memberFeed');
    filterInvalidColumns(rawEnabledColumns, this.validColumns, this.i18n, 'memberFeed');

    try {
      const tenant = this.tenantSchema.getTables(organizationId);
      const existingSetting = await this.getMemberFeedSettings(organizationId);
      const existingColumnSettings = parseSettingsWithExtras(
        existingSetting?.memberFeedSurveyColumnSettings,
        Object.values(MemberFeedColumnType),
        parseMemberFeedSettingsMap,
      );

      const enabledSet = new Set(rawEnabledColumns);
      const updatedColumnSettings: MemberFeedColumnSettingsRecord = {};
      const aliasByColumnValue = new Map(
        Object.entries(MemberFeedColumnType).map(([columnAlias, columnValue]) => [
          columnValue,
          columnAlias,
        ]),
      );

      for (const columnName of Object.values(MemberFeedColumnType)) {
        const existing = existingColumnSettings[columnName];
        if (!existing) {
          continue;
        }

        updatedColumnSettings[columnName] = {
          ...existing,
          isEnabled: enabledSet.has(columnName),
        };
      }

      rawEnabledColumns.forEach((columnName) => {
        const existing = updatedColumnSettings[columnName];

        if (!existing) {
          updatedColumnSettings[columnName] = {
            isEnabled: true,
          };
          return;
        }

        updatedColumnSettings[columnName] = {
          ...existing,
          isEnabled: true,
        };
      });

      const normalizedColumnSettings = Object.fromEntries(
        Object.entries(updatedColumnSettings).map(([columnName, settings]) => {
          const defaultAlias =
            aliasByColumnValue.get(columnName as MemberFeedColumnType) ?? columnName;
          const normalizedSettings = { ...settings };

          if (
            !normalizedSettings.alias ||
            normalizedSettings.alias === defaultAlias ||
            normalizedSettings.alias === columnName
          ) {
            delete normalizedSettings.alias;
          }

          return [columnName, normalizedSettings];
        }),
      );

      await this.db
        .insert(tenant.organizationSettings)
        .values({
          type: OrganizationSettingsType.MEMBER_FEED,
          memberFeedSurveyColumnSettings: normalizedColumnSettings,
        })
        .onConflictDoUpdate({
          target: [tenant.organizationSettings.type],
          set: { memberFeedSurveyColumnSettings: normalizedColumnSettings },
        });
    } catch (error) {
      this.logger.error(
        `Failed to update member feed settings for organization ${organizationId}: ${error.message}`,
      );
      throw new BadRequestException(this.i18n.t('errors.memberFeed.updateFailed'));
    }

    return this.findMemberFeedColumns(organizationId);
  }

  private async getMemberFeedSettings(organizationId: string) {
    const tenant = this.tenantSchema.getTables(organizationId);

    return await this.db
      .select({
        memberFeedSurveyColumnSettings: tenant.organizationSettings.memberFeedSurveyColumnSettings,
      })
      .from(tenant.organizationSettings)
      .where(eq(tenant.organizationSettings.type, OrganizationSettingsType.MEMBER_FEED))
      .then((rows) => rows[0] || null);
  }
}
