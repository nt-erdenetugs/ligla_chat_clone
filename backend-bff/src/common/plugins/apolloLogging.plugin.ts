import { Plugin } from '@nestjs/apollo';
import { Logger } from '@nestjs/common';

import {
  ApolloServerPlugin,
  BaseContext,
  GraphQLRequestContext,
  GraphQLRequestListener,
} from '@apollo/server';
import { OperationTypeNode } from 'graphql';

const sanitizeVariables = (obj: any): any => {
  const sensitiveKeys = ['password'];

  const mask = (value: any): any => {
    if (Array.isArray(value)) {
      return value.map(mask);
    } else if (value && typeof value === 'object') {
      return Object.entries(value).reduce((acc, [key, val]) => {
        const _key = key.toLowerCase();
        acc[key] = sensitiveKeys.some((sensitiveKey) => _key.includes(sensitiveKey))
          ? '********'
          : mask(val);
        return acc;
      }, {} as any);
    }
    return value;
  };

  return mask(obj);
};

const ignoredOperationNames = ['IntrospectionQuery', 'me'];

@Plugin()
export class ApolloLoggingPlugin implements ApolloServerPlugin {
  private readonly logger = new Logger(ApolloLoggingPlugin.name);

  async requestDidStart(
    requestContext: GraphQLRequestContext<BaseContext>,
  ): Promise<GraphQLRequestListener<BaseContext>> {
    const { request } = requestContext;
    const { operationName, variables, http, query } = request;
    const logger = this.logger;

    const buildRequestPayload = (extra: Record<string, any> = {}) => ({
      operationName,
      variables: sanitizeVariables(variables),
      request: {
        method: http?.method,
        headers: http?.headers,
      },
      ...extra,
    });

    return {
      async didEncounterErrors(ctx) {
        if (ignoredOperationNames.includes(operationName || '')) return;

        const errors = ctx.errors;
        const payload = buildRequestPayload();

        logger.error({ message: errors?.[0]?.message || 'Apollo error', ...payload }, errors);
      },

      async willSendResponse() {
        const isMutation = query?.includes(OperationTypeNode.MUTATION);
        if (ignoredOperationNames.includes(operationName || '') || !isMutation) return;

        const payload = buildRequestPayload();
        logger.log({
          message: 'Apollo mutation',
          ...payload,
        });
      },
    };
  }
}
