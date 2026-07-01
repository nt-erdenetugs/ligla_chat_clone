import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler';

import { I18nContext } from 'nestjs-i18n';

@Injectable()
export class RestThrottlerGuard extends ThrottlerGuard {
  async throwThrottlingException(context: ExecutionContext) {
    const i18n = I18nContext.current(context);
    throw new ThrottlerException(
      i18n?.t('errors.rateLimit') ?? 'You have exceeded the request limit.',
    );
  }
}
