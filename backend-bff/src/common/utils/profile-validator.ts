import { Injectable, MaxFileSizeValidator } from '@nestjs/common';
import { FileTypeValidator } from '@nestjs/common/pipes/file/file-type.validator';

import { I18nContext } from 'nestjs-i18n';

import { fileI18n, LOCALES } from '@/i18n/constants';

@Injectable()
export class ProfileFileTypeValidator extends FileTypeValidator {
  constructor() {
    super({
      fileType: /^image\/png$/,
    });
  }

  override buildErrorMessage(): string {
    const lang = (I18nContext.current()?.lang as LOCALES) || LOCALES.en;
    return fileI18n[lang].invalidFile;
  }
}

@Injectable()
export class ProfileMaxFileSizeValidator extends MaxFileSizeValidator {
  constructor() {
    super({
      maxSize: 1048576, // 1MB -> 1 * 2^20
    });
  }

  override buildErrorMessage(): string {
    const lang = (I18nContext.current()?.lang as LOCALES) || LOCALES.en;
    return fileI18n[lang].fileTooLarge;
  }
}
