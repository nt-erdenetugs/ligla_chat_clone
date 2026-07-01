import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  mixin,
  Type,
  Logger,
  UseInterceptors,
  applyDecorators,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { Observable, tap, catchError } from 'rxjs';

import { ChatDataSyncService } from '@/modules/chat-data-sync/chat-data-sync.service';
import { ChatDataSyncType } from '@/modules/chat-data-sync/dto/notify-core.input';

export interface NotifyConfig<TResult = unknown> {
  type: ChatDataSyncType;
  buildPayload?: (result: TResult) => Partial<Parameters<ChatDataSyncService['notifyCore']>[0]>;
}

function createNotifyCoreInterceptor<TResult = unknown>(
  config: NotifyConfig<TResult>,
): Type<NestInterceptor> {
  @Injectable()
  class NotifyCoreInterceptor implements NestInterceptor {
    constructor(private readonly chatDataSync: ChatDataSyncService) {}

    private readonly logger = new Logger(NotifyCoreInterceptor.name);

    intercept(context: ExecutionContext, next: CallHandler<TResult>): Observable<TResult> {
      let organizationName = '';

      if (context.getType<'graphql'>() === 'graphql') {
        const gqlCtx = GqlExecutionContext.create(context);
        const nextObj: { organizationName?: string } = gqlCtx.switchToHttp().getNext();
        organizationName = nextObj.organizationName ?? '';
      }

      return next.handle().pipe(
        tap(async (result: TResult) => {
          try {
            let payload: Parameters<ChatDataSyncService['notifyCore']>[0] = {
              type: config.type,
              organizationName,
            };

            if (config.buildPayload) {
              payload = {
                ...payload,
                ...config.buildPayload(result),
              };
            }

            await this.chatDataSync.notifyCore(payload);
          } catch (err) {
            const methodName = context.getHandler().name;
            this.logger.error(
              `[NotifyCore] Failed to send notification for ${methodName}: ${String(err)}`,
            );
          }
        }),
        catchError((error) => {
          throw error;
        }),
      );
    }
  }

  return mixin(NotifyCoreInterceptor);
}

export function NotifyCore<TMethod extends (...args: any[]) => any>(
  config: NotifyConfig<Awaited<ReturnType<TMethod>>>,
) {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<TMethod>,
  ) {
    const interceptor = createNotifyCoreInterceptor<Awaited<ReturnType<TMethod>>>(config);

    applyDecorators(UseInterceptors(interceptor))(target, propertyKey, descriptor);
  };
}
