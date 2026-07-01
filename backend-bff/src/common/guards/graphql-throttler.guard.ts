import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler';

import { I18nContext } from 'nestjs-i18n';

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  getRequestResponse(context: ExecutionContext) {
    const gqlCtx = GqlExecutionContext.create(context);
    const ctx = gqlCtx.getContext();
    return { req: ctx.req, res: ctx.res };
  }

  async throwThrottlingException(context: ExecutionContext) {
    const i18n = I18nContext.current(context);
    throw new ThrottlerException(
      i18n?.t('errors.rateLimit') ?? 'You have exceeded the request limit.',
    );
  }
}
