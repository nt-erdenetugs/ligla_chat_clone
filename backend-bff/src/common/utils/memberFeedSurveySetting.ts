import { BadRequestException, Logger } from '@nestjs/common';

import { I18nService } from 'nestjs-i18n';

export type ColumnValidatorOptions<T extends string> = {
  validColumns: Set<T>;
  organizationId: string;
  i18n: I18nService;
  logger?: Logger;
  errorPrefix: string;
};

export function validateColumns<T extends string>(
  columns: string[],
  options: ColumnValidatorOptions<T>,
): T[] {
  const { validColumns, organizationId, i18n, logger, errorPrefix } = options;

  return columns.map((col) => {
    if (!validColumns.has(col as T)) {
      logger?.error(
        `Failed to fetch ${errorPrefix} setting for organization ${organizationId}: Invalid column found ${col}`,
      );
      throw new BadRequestException(i18n.t(`errors.${errorPrefix}.fetchFailed`));
    }
    return col as T;
  });
}

export function checkDuplicates(columns: string[], i18n: I18nService, errorPrefix: string) {
  const uniqueColumns = Array.from(new Set(columns));
  if (uniqueColumns.length !== columns.length) {
    throw new BadRequestException(i18n.t(`errors.${errorPrefix}.duplicateColumnsDetected`));
  }
}

export function filterInvalidColumns<T extends string>(
  columns: string[],
  validColumns: Set<T>,
  i18n: I18nService,
  errorPrefix: string,
) {
  const invalidColumns = columns.filter((col) => !validColumns.has(col as T));
  if (invalidColumns.length) {
    throw new BadRequestException(i18n.t(`errors.${errorPrefix}.columnNotFound`));
  }
}
