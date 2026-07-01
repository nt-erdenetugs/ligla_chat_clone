import { MemberFeedColumnType } from '@/modules/member-feed/enums';
import { SurveyColumnType } from '@/modules/survey/enums';

export interface ColumnSetting {
  alias?: string;
  isEnabled: boolean;
}

export type ColumnSettingsWithExtras<T extends string> = Partial<
  Record<T, ColumnSetting & Record<string, unknown>>
>;

export type MemberFeedSettingsMap = Partial<Record<MemberFeedColumnType, ColumnSetting>>;

export type SurveySettingsMap = Partial<Record<SurveyColumnType, ColumnSetting>>;

export function toRecord(data: unknown): Record<string, unknown> {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }

  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

export function parseSettingsWithExtras<T extends string>(
  data: unknown,
  columns: readonly T[],
  parseSettingsMap: (value: unknown) => Partial<Record<T, ColumnSetting>>,
): ColumnSettingsWithExtras<T> {
  const parsed = parseSettingsMap(data);
  const existingMap = toRecord(data);
  const result: ColumnSettingsWithExtras<T> = {};

  for (const columnName of columns) {
    const base = parsed[columnName];
    if (!base) {
      continue;
    }

    const rawValue = existingMap[columnName];
    const extras =
      rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)
        ? (rawValue as Record<string, unknown>)
        : undefined;

    result[columnName] = {
      ...extras,
      alias: base.alias,
      isEnabled: base.isEnabled,
    };
  }

  return result;
}

export function isValidColumnSetting(value: unknown): value is ColumnSetting {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const setting = value as Record<string, unknown>;

  if (typeof setting.isEnabled !== 'boolean') {
    return false;
  }

  return typeof setting.alias === 'undefined' || typeof setting.alias === 'string';
}

export function isValidMemberFeedSettingsMap(value: unknown): value is MemberFeedSettingsMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const map = value as Record<string, unknown>;
  const validColumns = new Set(Object.values(MemberFeedColumnType));

  for (const key of Object.keys(map)) {
    if (!validColumns.has(key as MemberFeedColumnType)) {
      return false;
    }
    if (!isValidColumnSetting(map[key])) {
      return false;
    }
  }

  return true;
}

export function isValidSurveySettingsMap(value: unknown): value is SurveySettingsMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const map = value as Record<string, unknown>;
  const validColumns = new Set(Object.values(SurveyColumnType));

  for (const key of Object.keys(map)) {
    if (!validColumns.has(key as SurveyColumnType)) {
      return false;
    }
    if (!isValidColumnSetting(map[key])) {
      return false;
    }
  }

  return true;
}

export function parseMemberFeedSettingsMap(data: unknown): MemberFeedSettingsMap {
  const map = toRecord(data);
  const validColumns = new Set(Object.values(MemberFeedColumnType));
  const aliasByColumnValue = new Map(
    Object.entries(MemberFeedColumnType).map(([columnAlias, columnValue]) => [
      columnValue,
      columnAlias,
    ]),
  );
  const parsed: MemberFeedSettingsMap = {};

  for (const [key, value] of Object.entries(map)) {
    if (!validColumns.has(key as MemberFeedColumnType)) {
      continue;
    }

    const columnValue = key as MemberFeedColumnType;

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }

    const setting = value as Record<string, unknown>;
    if (typeof setting.isEnabled !== 'boolean') {
      continue;
    }

    parsed[columnValue] = {
      alias:
        typeof setting.alias === 'string'
          ? setting.alias
          : (aliasByColumnValue.get(columnValue) ?? columnValue),
      isEnabled: setting.isEnabled,
    };
  }

  return parsed;
}

export function parseSurveySettingsMap(data: unknown): SurveySettingsMap {
  const map = toRecord(data);
  const validColumns = new Set(Object.values(SurveyColumnType));
  const aliasByColumnValue = new Map(
    Object.entries(SurveyColumnType).map(([columnAlias, columnValue]) => [
      columnValue,
      columnAlias,
    ]),
  );
  const parsed: SurveySettingsMap = {};

  for (const [key, value] of Object.entries(map)) {
    if (!validColumns.has(key as SurveyColumnType)) {
      continue;
    }

    const columnValue = key as SurveyColumnType;

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }

    const setting = value as Record<string, unknown>;
    if (typeof setting.isEnabled !== 'boolean') {
      continue;
    }

    parsed[columnValue] = {
      alias:
        typeof setting.alias === 'string'
          ? setting.alias
          : (aliasByColumnValue.get(columnValue) ?? columnValue),
      isEnabled: setting.isEnabled,
    };
  }

  return parsed;
}

export function getMemberFeedColumnSetting(
  settings: MemberFeedSettingsMap,
  columnName: MemberFeedColumnType,
): ColumnSetting | undefined {
  const setting = settings[columnName];
  return isValidColumnSetting(setting) ? setting : undefined;
}

export function getSurveyColumnSetting(
  settings: SurveySettingsMap,
  columnName: SurveyColumnType,
): ColumnSetting | undefined {
  const setting = settings[columnName];
  return isValidColumnSetting(setting) ? setting : undefined;
}
