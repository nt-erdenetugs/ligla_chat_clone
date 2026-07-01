import { Plugin } from '@nestjs/apollo';
import { HttpStatus } from '@nestjs/common';

import { ApolloServerPlugin, GraphQLRequestListener } from '@apollo/server';

@Plugin()
export class HttpStatusCodePlugin implements ApolloServerPlugin {
  async requestDidStart(): Promise<GraphQLRequestListener<any>> {
    return {
      async willSendResponse({ response }) {
        if (
          response.body.kind === 'single' &&
          response.body.singleResult.errors &&
          response.body.singleResult.errors.length > 0
        ) {
          const error = response.body.singleResult.errors[0];

          if (error.extensions?.status) {
            response.http.status = error.extensions.status as number;
          } else {
            const errorCode = error.extensions?.code;

            switch (errorCode) {
              case 'BAD_USER_INPUT':
                response.http.status = HttpStatus.BAD_REQUEST; // 400
                break;
              case 'UNAUTHENTICATED':
                response.http.status = HttpStatus.UNAUTHORIZED; // 401
                break;
              case 'FORBIDDEN':
                response.http.status = HttpStatus.FORBIDDEN; // 403
                break;
              case 'NOT_FOUND':
                response.http.status = HttpStatus.NOT_FOUND; // 404
                break;
              case 'CONFLICT':
                response.http.status = HttpStatus.CONFLICT; // 409
                break;
              default:
                response.http.status = HttpStatus.INTERNAL_SERVER_ERROR; // 500
                break;
            }
          }
        } else {
          response.http.status = HttpStatus.OK; // 200
        }
      },
    };
  }
}
