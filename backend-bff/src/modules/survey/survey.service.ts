import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { eq } from 'drizzle-orm';
import { I18nService } from 'nestjs-i18n';

import { OrganizationSettingsType } from '@/common/constants';
import {
  type ColumnSettingsWithExtras,
  parseSurveySettingsMap,
  parseSettingsWithExtras,
  getSurveyColumnSetting,
} from '@/common/types/column-settings.types';
import {
  validateColumns,
  checkDuplicates,
  filterInvalidColumns,
} from '@/common/utils/memberFeedSurveySetting';
import { DrizzleDB, InjectDrizzle, TenantSchemaService } from '@/drizzle';

import { UpdateSurveySettingInput } from './dto/update-survey-setting.input';
import { Survey, SurveyColumn } from './entities/survey.entity';
import { SurveyColumnType } from './enums';

type SurveyColumnSettingsRecord = ColumnSettingsWithExtras<SurveyColumnType>;

@Injectable()
export class SurveyService {
  private readonly logger = new Logger(SurveyService.name);
  private readonly validColumns = new Set<SurveyColumnType>(Object.values(SurveyColumnType));

  constructor(
    private readonly i18n: I18nService,
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly tenantSchema: TenantSchemaService,
  ) {}

  async findSurveyColumns(organizationId: string): Promise<SurveyColumn[]> {
    const setting = await this.getSurveySetting(organizationId);

    const columnSettings = parseSurveySettingsMap(setting?.memberFeedSurveyColumnSettings);

    const surveyColumnMap = Object.entries(SurveyColumnType).map(([key, value]) => ({
      key,
      value,
    }));

    return surveyColumnMap.map(({ key, value }) => {
      const setting = getSurveyColumnSetting(columnSettings, value);
      return {
        name: value,
        alias: setting?.alias || key,
        isEnabled: setting?.isEnabled ?? false,
      };
    });
  }

  async findSurveys(organizationId: string, chatId: string): Promise<Nullable<Survey[]>> {
    const tenant = this.tenantSchema.getTables(organizationId);

    const chat = await this.db
      .select()
      .from(tenant.chat)
      .where(eq(tenant.chat.id, chatId))
      .then((rows) => rows[0] || null);

    if (!chat) {
      throw new NotFoundException(`Could not find chat with id ${chatId}`);
    }

    try {
      // Fetch settings to get enabled columns
      const setting = await this.getSurveySetting(organizationId);

      if (!setting) return null;

      const columnSettings = parseSurveySettingsMap(setting.memberFeedSurveyColumnSettings);

      // Extract enabled columns from settings
      const enabledColumnsArray = (
        Object.entries(columnSettings) as [
          SurveyColumnType,
          (typeof columnSettings)[SurveyColumnType],
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
        errorPrefix: 'survey',
      });

      if (!validatedColumns.length) return null;

      // Sort columns according to enum order
      const columnsOrder = Object.values(SurveyColumnType);
      const sortedColumns = validatedColumns.sort(
        (a, b) => columnsOrder.indexOf(a) - columnsOrder.indexOf(b),
      );

      // Fetch survey data
      const surveyData = await this.db
        .select({ userSurvey: tenant.surveyData.userSurvey })
        .from(tenant.surveyData)
        .where(eq(tenant.surveyData.endUserId, chat.endUserId))
        .then((rows) => rows[0] || null);

      const feedData = surveyData?.userSurvey as Record<string, string> | null;

      const enumEntries = Object.entries(SurveyColumnType).map(([key, value]) => ({
        key,
        value: value as SurveyColumnType,
      }));

      return sortedColumns.map((column) => {
        const entry = enumEntries.find((e) => e.value === column);
        const key = entry?.key || column;
        const setting = getSurveyColumnSetting(columnSettings, column);

        return {
          columnName: column,
          columnAlias: setting?.alias || key,
          value: feedData?.[column]?.toString() || '-',
        };
      });
    } catch (error) {
      this.logger.error(`Failed to read surveys for chatId: ${chatId}: ${error.message}`);
      throw new BadRequestException(this.i18n.t('errors.survey.readFailed'));
    }
  }

  async updateSurveySetting(
    input: UpdateSurveySettingInput,
    organizationId: string,
  ): Promise<SurveyColumn[]> {
    const { enabledColumns: rawEnabledColumns = [] } = input;
    const tenant = this.tenantSchema.getTables(organizationId);

    checkDuplicates(rawEnabledColumns, this.i18n, 'survey');
    filterInvalidColumns(rawEnabledColumns, this.validColumns, this.i18n, 'survey');

    try {
      const existingSetting = await this.getSurveySetting(organizationId);
      const existingColumnSettings = parseSettingsWithExtras(
        existingSetting?.memberFeedSurveyColumnSettings,
        Object.values(SurveyColumnType),
        parseSurveySettingsMap,
      );

      const enabledSet = new Set(rawEnabledColumns);
      const updatedColumnSettings: SurveyColumnSettingsRecord = {};
      const aliasByColumnValue = new Map(
        Object.entries(SurveyColumnType).map(([columnAlias, columnValue]) => [
          columnValue,
          columnAlias,
        ]),
      );

      for (const columnName of Object.values(SurveyColumnType)) {
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
          const defaultAlias = aliasByColumnValue.get(columnName as SurveyColumnType) ?? columnName;
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
          type: OrganizationSettingsType.SURVEY,
          memberFeedSurveyColumnSettings: normalizedColumnSettings,
        })
        .onConflictDoUpdate({
          target: [tenant.organizationSettings.type],
          set: { memberFeedSurveyColumnSettings: normalizedColumnSettings },
        });
    } catch (error) {
      this.logger.error(
        `Failed to update survey settings for organization ${organizationId}: ${error.message}`,
      );
      throw new BadRequestException(this.i18n.t('errors.survey.updateFailed'));
    }

    return this.findSurveyColumns(organizationId);
  }

  private async getSurveySetting(organizationId: string) {
    const tenant = this.tenantSchema.getTables(organizationId);

    return await this.db
      .select({
        memberFeedSurveyColumnSettings: tenant.organizationSettings.memberFeedSurveyColumnSettings,
      })
      .from(tenant.organizationSettings)
      .where(eq(tenant.organizationSettings.type, OrganizationSettingsType.SURVEY))
      .then((rows) => rows[0] || null);
  }
}
