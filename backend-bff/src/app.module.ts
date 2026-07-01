import { join } from 'path';

import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { HttpStatus, Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ThrottlerModule } from '@nestjs/throttler';

import { ApolloServerErrorCode } from '@apollo/server/errors';
import {
  ApolloServerPluginLandingPageLocalDefault,
  ApolloServerPluginLandingPageProductionDefault,
} from '@apollo/server/plugin/landingPage/default';
import { GraphQLError, GraphQLFormattedError } from 'graphql';
import { GraphQLBigInt } from 'graphql-scalars';
import {
  I18nContext,
  AcceptLanguageResolver,
  I18nModule,
  QueryResolver,
  HeaderResolver,
  CookieResolver,
} from 'nestjs-i18n';

import { THROTTLE_TTL, THROTTLE_LIMIT, API_PREFIXES } from '@/common/constants';
import { GqlThrottlerGuard } from '@/common/guards/graphql-throttler.guard';
import { RestThrottlerGuard } from '@/common/guards/rest-throttler.guard';
import { ApolloLoggingPlugin } from '@/common/plugins/apolloLogging.plugin';
import { HttpStatusCodePlugin } from '@/common/plugins/httpStatus.plugin';
import { AnyScalar } from '@/common/scalars/any.scalar';
import { DrizzleModule } from '@/drizzle';
import { AttributeModule } from '@/modules/attribute/attribute.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { ChatModule } from '@/modules/chat/chat.module';
import { ChatAssignmentModule } from '@/modules/chat-assignment/chat-assignment.module';
import { ChatAssignRuleModule } from '@/modules/chat-assignment-rule/chat-assign-rule.module';
import { ChatDataSyncModule } from '@/modules/chat-data-sync/chat-data-sync.module';
import { ChatFileModule } from '@/modules/chat-file/chat-file.module';
import { ChatNoteModule } from '@/modules/chat-note/chat-note.module';
import { ChatReplyModule } from '@/modules/chat-reply/chat-reply.module';
import { ConfigModule } from '@/modules/config/config.module';
import { CoreApiModule } from '@/modules/core-api/core-api.module';
import { EncryptionModule } from '@/modules/encryption/encryption.module';
import { FileModule } from '@/modules/file/file.module';
import { HypervisorModule } from '@/modules/hypervisor/hypervisor.module';
import { LiglaModule } from '@/modules/ligla/ligla.module';
import { LogModule } from '@/modules/log/log.module';
import { MailModule } from '@/modules/mail/mail.module';
import { MemberFeedModule } from '@/modules/member-feed/member-feed.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { OperatorModule } from '@/modules/operator/operator.module';
import { OrganizationModule } from '@/modules/organization/organization.module';
import { StoreModule } from '@/modules/store/store.module';
import { SurveyModule } from '@/modules/survey/survey.module';
import { TagModule } from '@/modules/tag/tag.module';
import { TeamModule } from '@/modules/team/team.module';
import { UserModule } from '@/modules/user/user.module';

@Module({
  imports: [
    ConfigModule,
    CoreApiModule,
    DrizzleModule,
    EncryptionModule,
    UserModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      path: API_PREFIXES.GRAPHQL,
      autoSchemaFile:
        process.env.NODE_ENV === 'production' ? true : join(process.cwd(), 'src/schema.gql'),
      csrfPrevention: false,
      // https://docs.nestjs.com/graphql/quick-start#apollo-sandbox
      playground: false,
      introspection: process.env.NODE_ENV === 'production' ? false : true,
      sortSchema: true,
      context: ({ req, res }: { req: unknown; res: unknown }) => ({ req, res }),
      plugins: [
        ...(process.env.NODE_ENV === 'development'
          ? [ApolloServerPluginLandingPageLocalDefault()]
          : [
              ApolloServerPluginLandingPageProductionDefault({
                footer: false,
              }),
            ]),

        new HttpStatusCodePlugin(),
      ],
      resolvers: {
        BigInt: GraphQLBigInt,
      },
      formatError: (error: GraphQLError) => {
        const validationError =
          (error?.extensions?.originalError as Error & { statusCode?: number }) || undefined;
        const graphqlErrorCode = error?.extensions?.code;
        const isDrizzleQueryError =
          validationError?.name === 'DrizzleQueryError' ||
          error?.message?.includes('Failed query:');

        const lang = I18nContext.current()?.lang ?? 'ja';

        let errorMessage =
          error.message || (lang === 'ja' ? 'エラーが発生しました' : 'An error occurred');
        let status = HttpStatus.INTERNAL_SERVER_ERROR;

        if (graphqlErrorCode === ApolloServerErrorCode.BAD_USER_INPUT) {
          errorMessage =
            typeof error.message === 'string' ? error.message : JSON.stringify(error.message);
          status = HttpStatus.BAD_REQUEST;
        } else if (isDrizzleQueryError) {
          errorMessage =
            lang === 'ja' ? '内部サーバーエラーが発生しました' : 'Internal server error occurred';
          status = HttpStatus.INTERNAL_SERVER_ERROR;
        } else if (validationError) {
          const validationMessage = validationError.message;
          const statusCode = validationError.statusCode;

          errorMessage =
            typeof validationMessage === 'object'
              ? JSON.stringify(validationMessage)
              : validationMessage;
          status = statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
        }

        if (typeof errorMessage !== 'string') {
          errorMessage = JSON.stringify(errorMessage);
        }

        const graphQLFormattedError: GraphQLFormattedError = {
          message: errorMessage,
          extensions: {
            code: validationError?.name || error?.name || error?.extensions?.code,
            status,
          },
        };
        return graphQLFormattedError;
      },
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'ja',
      loaderOptions: {
        path: join(__dirname, '/i18n/'),
        watch: true,
      },
      resolvers: [
        new QueryResolver(['lang', 'l']),
        new HeaderResolver(['x-custom-lang']),
        new CookieResolver(),
        AcceptLanguageResolver,
      ],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: THROTTLE_TTL,
        limit: THROTTLE_LIMIT,
      },
    ]),
    AuthModule,
    MailModule,
    OrganizationModule,
    TeamModule,
    HypervisorModule,
    StoreModule,
    ChatModule,
    ChatAssignmentModule,
    ChatAssignRuleModule,
    ChatReplyModule,
    AttributeModule,
    TagModule,
    FileModule,
    ChatNoteModule,
    LiglaModule,
    OperatorModule,
    LogModule,
    NotificationsModule,
    ChatDataSyncModule,
    MemberFeedModule,
    SurveyModule,
    ChatFileModule,
  ],
  providers: [
    RestThrottlerGuard,
    GqlThrottlerGuard,
    HttpStatusCodePlugin,
    AnyScalar,
    ApolloLoggingPlugin,
  ],
})
export class AppModule {}
