import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { GqlContextType } from '@nestjs/graphql';

import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      tap((data) => {
        if (context.getType<GqlContextType>() === 'graphql' && data) {
          const arg3 = context.getArgByIndex(3);
          const fieldName = arg3?.fieldName;
          if (fieldName && /^(remove|delete|disable|archive)/.test(String(fieldName))) {
            const variables = context.getArgByIndex(1);
            const uid = context.getArgByIndex(2).uid;
            this.logger.log({
              message: 'Remove action log',
              'logging-method-type': 'remove',
              'logging-field-name': fieldName,
              'logging-user-id': uid,
              ...variables,
            });
          }
        }
      }),
    );
  }
}
