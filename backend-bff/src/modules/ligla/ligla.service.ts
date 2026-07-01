import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  UnauthorizedException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { eq } from 'drizzle-orm';
import { I18nService } from 'nestjs-i18n';

import { getDefaultPictureUrl } from '@/common/utils/file';
import { withRetry } from '@/common/utils/retry';
import { truncate } from '@/common/utils/string';
import { DrizzleDB, InjectDrizzle, TenantSchemaService } from '@/drizzle';
import { ChatPushMessageInput } from '@/modules/chat/dto/chat-push-message.input';
import { DISPLAY_NAME_MAX_CHAR_LIMIT } from '@/modules/user/constants';
import * as shared from '@@/drizzle/public/schema';

type ChatMessageEmoji = {
  index: number;
  length: number;
  productId: string;
  emojiId: string;
};

type ChatPushFlexMessage = {
  type: 'flex';
  altText: string;
  contents: any;
};

type ChatPushMessagePayload = {
  userId: string;
  message?: {
    type: string;
    text?: string;
    quoteToken?: string;
    emojis?: ChatMessageEmoji[];
  };
  messages?: ChatPushFlexMessage[];
  profile: {
    displayName: string;
    pictureUrl: string;
  };
  closeChat?: boolean;
};

type SentMessage = { id: string; quoteToken: string };

enum SentMethodType {
  PUSH = 'push',
  REPLY = 'reply',
}

type MessageSuccessResponse = {
  messageId: string;
  quoteToken: string;
  sentMethod?: SentMethodType;
  sentMessages?: SentMessage[];
};

type LiglaSingularResponse = {
  messageId: string;
  quoteToken: string;
  sentMethod?: string;
};

type LiglaPluralResponse = {
  sentMessages: SentMessage[];
  sentMethod?: string;
};

function isLiglaPluralResponse(
  data: LiglaSingularResponse | LiglaPluralResponse,
): data is LiglaPluralResponse {
  return 'sentMessages' in data && Array.isArray(data.sentMessages);
}

@Injectable()
export class LiglaService {
  private static readonly FLEX_TYPE = 'flex';

  private readonly MESSAGES = {
    SEND_ATTEMPT: 'Sending message attempt',
    SEND_SUCCESS: 'Message successfully delivered',
    SEND_FAILED: 'Message send failed',
    READ_SUCCESS: 'Chat read successfully delivered',
    READ_FAILED: 'Chat read failed',
    CLOSE_SUCCESS: 'Chat session closed successfully',
    CLOSE_FAILED: 'Chat session close failed',
    RETRY_ATTEMPT: 'Retrying message delivery',
    FINAL_FAILURE: 'Message delivery failed after max retries',
    MISSING_API_KEY: 'Organization API key missing',
    INVALID_ENV: 'Required environment variable missing',
    SEND_204_NO_TRACKING: 'Ligla API returned 204 — no tracking data available',
  };

  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly i18n: I18nService,
    private readonly configService: ConfigService,
    private readonly tenantSchema: TenantSchemaService,
  ) {}
  private readonly logger = new Logger(LiglaService.name);

  async sendMessage(
    organizationId: string,
    input: ChatPushMessageInput,
    onSuccess = () => {},
    onFailure = () => {},
  ): Promise<MessageSuccessResponse> {
    const { operatorId, messageId } = input;
    const organization = await this.getOrganization(organizationId);
    const uri = this.generateOrganizationPushMessageEndpoint(organization.name);

    if (!uri) {
      this.logger.error(this.MESSAGES.INVALID_ENV, 'LIGLA_MESSAGE_BASE_URL/PATH not configured');
      throw new BadRequestException();
    }

    this.logger.debug(`Message initiated - ID: ${messageId} | Endpoint: ${uri}`);

    const profile = await this.getOperatorProfile(organizationId, operatorId);
    const apiKey = this.getOrganizationApiKey(organization);

    const messagePayload = this.buildPushMessagePayload(input, profile);
    this.logLinePayloadPreview(messageId, messagePayload);

    try {
      const result = await this.requestLiglaApi<MessageSuccessResponse>({
        uri,
        apiKey,
        payload: messagePayload,
        operationName: 'Send message',
        context: { messageId },
        extraHeaders: { 'X-Line-Retry-Key': messageId },
        errorMessages: {
          badRequest: 'Invalid userId format, payload, or display name exceeds 20 characters',
          notFound: 'chat feature is disabled',
        },
        onSuccess: async (response) => {
          if (response.status === 200) {
            const responseData: LiglaSingularResponse | LiglaPluralResponse = await response.json();
            const normalized = this.normalizeLiglaResponse(responseData);

            this.logger.log({
              message: this.MESSAGES.SEND_SUCCESS,
              messageId,
              quotedMessageId: normalized.messageId,
              quoteToken: normalized.quoteToken,
              ...(normalized.sentMethod && { sentMethod: normalized.sentMethod }),
            });

            return normalized;
          }
          // 204 - Legacy success response (no body) - will be deprecated
          this.logger.warn({
            message: this.MESSAGES.SEND_204_NO_TRACKING,
            messageId,
          });
          return { messageId: '', quoteToken: '' };
        },
        onConflict: async (response) => {
          const responseData: LiglaSingularResponse | LiglaPluralResponse = await response.json();
          const normalized = this.normalizeLiglaResponse(responseData);
          this.logger.log({
            message: 'Message already sent successfully with this retry key',
            messageId,
            quotedMessageId: normalized.messageId,
            quoteToken: normalized.quoteToken,
            ...(normalized.sentMethod && { sentMethod: normalized.sentMethod }),
          });
          return normalized;
        },
      });

      onSuccess();
      return result;
    } catch (error) {
      onFailure();
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Message delivery failed after maximum retries');
    }
  }

  async chatRead(
    organizationId: string,
    input: { endUserId: Nullable<string>; markAsReadToken?: string | null },
  ): Promise<void> {
    const { endUserId, markAsReadToken } = input;

    if (!endUserId) return;

    const organization = await this.getOrganization(organizationId);
    const uri = this.generateOrganizationChatReadEndpoint(organization.name);

    if (!uri) {
      this.logger.error(this.MESSAGES.INVALID_ENV, 'LIGLA_MESSAGE_BASE_URL/PATH not configured');
      throw new BadRequestException();
    }

    this.logger.debug(`Chat read initiated - ID: ${endUserId} | Endpoint: ${uri}`);

    const apiKey = this.getOrganizationApiKey(organization);

    try {
      await this.requestLiglaApi<void>({
        uri,
        apiKey,
        payload: { userId: endUserId, ...(markAsReadToken ? { markAsReadToken } : {}) },
        operationName: 'Chat read',
        context: { endUserId },
        maxRetries: 1,
        errorMessages: {
          badRequest: 'Invalid userId format',
          notFound: 'chat read feature is disabled',
        },
        onSuccess: async () => {
          this.logger.log({ message: this.MESSAGES.READ_SUCCESS, endUserId });
        },
        onConflict: async () => {
          this.logger.log({ message: 'Chat read already processed successfully', endUserId });
        },
      });
    } catch {
      this.logger.error(this.MESSAGES.READ_FAILED, { endUserId });
    }
  }

  async endChatSession(
    organizationId: string,
    input: { endUserId: Nullable<string> },
  ): Promise<void> {
    const { endUserId } = input;

    if (!endUserId) return;

    const organization = await this.getOrganization(organizationId);
    const uri = this.generateOrganizationChatCloseEndpoint(organization.name);

    if (!uri) {
      this.logger.error(
        this.MESSAGES.INVALID_ENV,
        'LIGLA_MESSAGE_CLOSE_ENDPOINT_PATH not configured',
      );
      throw new BadRequestException();
    }

    this.logger.debug(`Chat session close initiated - ID: ${endUserId} | Endpoint: ${uri}`);

    const apiKey = this.getOrganizationApiKey(organization);

    try {
      await this.requestLiglaApi<void>({
        uri,
        apiKey,
        payload: { userId: endUserId },
        operationName: 'Chat session close',
        context: { endUserId },
        errorMessages: {
          badRequest: 'Invalid userId format',
          notFound: 'chat close feature is disabled',
        },
        onSuccess: async () => {
          this.logger.log({ message: this.MESSAGES.CLOSE_SUCCESS, endUserId });
        },
        onConflict: async () => {
          this.logger.log({ message: 'Chat session already closed', endUserId });
        },
      });
    } catch {
      this.logger.error(this.MESSAGES.CLOSE_FAILED, { endUserId });
    }
  }

  private async requestLiglaApi<T>(options: {
    uri: string;
    apiKey: string;
    payload: Record<string, any>;
    operationName: string;
    context: Record<string, any>;
    extraHeaders?: Record<string, string>;
    maxRetries?: number;
    onSuccess: (response: Response) => Promise<T>;
    onConflict?: (response: Response) => Promise<T>;
    errorMessages?: {
      badRequest?: string;
      notFound?: string;
    };
  }): Promise<T> {
    const { uri, apiKey, payload, operationName, context, extraHeaders, onSuccess, onConflict } =
      options;
    const errorMessages = options.errorMessages ?? {};

    this.logger.log({
      message: `${operationName}: Request details`,
      endpoint: uri,
      headers: {
        'Content-Type': 'application/json',
        ...extraHeaders,
        'X-API-Key': `${apiKey.slice(0, apiKey.length / 2)}${'*'.repeat(apiKey.length / 2)}`,
      },
      payload,
    });

    return withRetry(
      async () => {
        const response = await fetch(uri, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
            ...extraHeaders,
          },
          body: JSON.stringify(payload),
        });

        this.logger.debug({
          message: `${operationName}: Response details`,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
        });

        switch (response.status) {
          case 200:
          case 204:
            return onSuccess(response);
          case 409: {
            if (onConflict) {
              return onConflict(response);
            }
            const responseBody = await response.text();
            this.logger.error('Conflict', { ...context, responseBody });
            throw new ConflictException(responseBody);
          }
          case 401: {
            this.logger.error('Unauthorized: Invalid API key', context);
            throw new UnauthorizedException('Invalid API key');
          }
          case 400: {
            const responseBody = await response.text();
            this.logger.error('Bad request', { ...context, responseBody });
            throw new BadRequestException(errorMessages.badRequest ?? 'Bad request');
          }
          case 404: {
            this.logger.error('Not found: feature is disabled', context);
            throw new NotFoundException(errorMessages.notFound ?? 'feature is disabled');
          }
          case 429: {
            const responseBody = await response.text();
            this.logger.error('Rate limit exceeded: Too many requests', {
              ...context,
              responseBody,
            });
            throw new BadRequestException('Too many requests. Please try again later.');
          }
          case 500: {
            const responseBody = await response.text();
            this.logger.error('Internal server error from LINE API', {
              ...context,
              responseBody,
            });
            throw new Error('Internal server error from LINE API');
          }
          case 502: {
            const responseBody = await response.text();
            this.logger.error('Bad Gateway error from Ligla', { ...context, responseBody });
            throw new Error('Bad Gateway error from Ligla');
          }
          default: {
            const responseBody = await response.text();
            this.logger.error('Unexpected response status', {
              ...context,
              status: response.status,
              responseBody,
            });
            throw new Error(`Unexpected response status: ${response.status}`);
          }
        }
      },
      operationName,
      this.logger,
      {
        maxRetries: options.maxRetries,
        shouldRetry: (error) => !(error instanceof HttpException),
      },
    );
  }

  private async getOperatorProfile(
    organizationId: string,
    operatorId: string,
  ): Promise<{
    displayName: string;
    pictureUrl: string;
  }> {
    // Handle system auto-reply messages (S{32_hex_chars})
    if (operatorId.startsWith('S') && operatorId.length === 33) {
      return {
        displayName: 'Auto-Reply',
        pictureUrl: getDefaultPictureUrl(this.configService),
      };
    }

    const tenant = this.tenantSchema.getTables(organizationId);
    const operator = await this.db
      .select({
        displayName: tenant.user.displayName,
        senderName: tenant.user.senderName,
        pictureUrl: tenant.user.pictureUrl,
      })
      .from(tenant.user)
      .where(eq(tenant.user.id, operatorId))
      .then((rows) => rows[0] || null);

    if (!operator) {
      throw new BadRequestException(this.i18n.t('errors.chat.operatorNotAssigned'));
    }

    return {
      displayName: truncate(
        operator.senderName || operator.displayName,
        DISPLAY_NAME_MAX_CHAR_LIMIT,
      ),
      pictureUrl: operator.pictureUrl || getDefaultPictureUrl(this.configService),
    };
  }

  private getOrganizationApiKey(organization: { apiKey: string | null }): string {
    const apiKey = organization.apiKey;

    if (!apiKey) {
      this.logger.error(this.MESSAGES.MISSING_API_KEY);
      throw new BadRequestException(this.i18n.t('errors.apiKeyRequired'));
    }

    return apiKey;
  }

  private async getOrganization(organizationId: string) {
    const organization = await this.db
      .select({ name: shared.organization.name, apiKey: shared.organization.apiKey })
      .from(shared.organization)
      .where(eq(shared.organization.id, organizationId))
      .then((rows) => rows[0] || null);

    if (!organization) {
      throw new BadRequestException(this.i18n.t('errors.chat.organizationNotFound'));
    }

    return organization;
  }

  private generateOrganizationEndpoint(organizationName: string, pathEnvVar: string) {
    const domain = this.configService.get<string>('LIGLA_MESSAGE_BASE_URL');
    const path = this.configService.get<string>(pathEnvVar);

    if (!domain || !path) {
      this.logger.error(this.MESSAGES.INVALID_ENV, {
        domainConfigured: !!domain,
        pathConfigured: !!path,
      });
      throw new Error(this.MESSAGES.INVALID_ENV);
    }

    return `${domain}/${organizationName}${path}`;
  }

  private generateOrganizationPushMessageEndpoint(organizationName: string) {
    return this.generateOrganizationEndpoint(organizationName, 'LIGLA_MESSAGE_ENDPOINT_PATH');
  }

  private generateOrganizationChatReadEndpoint(organizationName: string) {
    return this.generateOrganizationEndpoint(organizationName, 'LIGLA_CHAT_READ_ENDPOINT_PATH');
  }

  private generateOrganizationChatCloseEndpoint(organizationName: string) {
    return this.generateOrganizationEndpoint(organizationName, 'LIGLA_MESSAGE_CLOSE_ENDPOINT_PATH');
  }

  private buildPushMessagePayload(
    input: ChatPushMessageInput,
    profile: { displayName: string; pictureUrl: string },
  ): ChatPushMessagePayload {
    const { userId, type, text, messages, quoteToken, emojis, closeChat } = input;

    const normalizedType = String(type || '').toLowerCase();
    const normalizedFlexMessages = this.normalizeFlexMessages(messages);
    const hasFlexMessages = normalizedFlexMessages.length > 0;
    const hasTextPayload = Boolean(text || quoteToken || emojis?.length);

    if (profile.displayName.length > DISPLAY_NAME_MAX_CHAR_LIMIT) {
      throw new BadRequestException(
        `Display name exceeds ${DISPLAY_NAME_MAX_CHAR_LIMIT} characters`,
      );
    }

    if (hasFlexMessages && hasTextPayload) {
      throw new BadRequestException(
        'Invalid payload: provide either flex messages or text payload, not both',
      );
    }

    if (hasFlexMessages && normalizedType !== LiglaService.FLEX_TYPE) {
      throw new BadRequestException('Invalid payload: messages requires type "flex"');
    }

    if (!hasFlexMessages && normalizedType === LiglaService.FLEX_TYPE) {
      throw new BadRequestException('Invalid payload: type "flex" requires messages');
    }

    if (!hasFlexMessages && !normalizedType) {
      throw new BadRequestException('Invalid payload: message type is required');
    }

    const payload: ChatPushMessagePayload = {
      userId,
      profile,
      closeChat,
      ...(hasFlexMessages
        ? { messages: normalizedFlexMessages }
        : {
            message: {
              type: normalizedType,
              text,
              quoteToken,
              emojis,
            },
          }),
    };

    return payload;
  }

  private normalizeSentMethod(raw?: string): SentMethodType | undefined {
    if (raw === SentMethodType.PUSH) return SentMethodType.PUSH;
    if (raw === SentMethodType.REPLY) return SentMethodType.REPLY;
    return undefined;
  }

  private normalizeLiglaResponse(
    data: LiglaSingularResponse | LiglaPluralResponse,
  ): MessageSuccessResponse {
    const sentMethod = this.normalizeSentMethod(data.sentMethod);

    if (isLiglaPluralResponse(data)) {
      const first = data.sentMessages[0];
      if (!first) {
        throw new InternalServerErrorException(
          'Ligla API returned empty sentMessages array — delivery unconfirmed',
        );
      }
      return {
        messageId: first.id,
        quoteToken: first.quoteToken,
        sentMethod,
        sentMessages: data.sentMessages.map((m) => ({ id: m.id, quoteToken: m.quoteToken })),
      };
    }

    return {
      messageId: data.messageId,
      quoteToken: data.quoteToken,
      sentMethod,
    };
  }

  private normalizeFlexMessages(rawMessages?: Record<string, unknown>[]): ChatPushFlexMessage[] {
    if (!rawMessages?.length) {
      return [];
    }

    return rawMessages.map((message) => ({
      type: LiglaService.FLEX_TYPE,
      altText: String(message?.altText || ''),
      contents: (message?.contents ?? {}) as Record<string, unknown>,
    }));
  }

  private logLinePayloadPreview(messageId: string, payload: ChatPushMessagePayload): void {
    const lineMessages =
      payload.messages?.map((message) => ({
        type: LiglaService.FLEX_TYPE,
        altText: message.altText,
        hasContents: Boolean(message.contents),
      })) ??
      (payload.message
        ? [
            {
              type: payload.message.type,
              hasText: Boolean(payload.message.text),
              hasQuoteToken: Boolean(payload.message.quoteToken),
              emojiCount: payload.message.emojis?.length ?? 0,
            },
          ]
        : []);

    this.logger.debug({
      message: 'LINE payload preview',
      messageId,
      to: payload.userId,
      messageCount: lineMessages.length,
      messages: lineMessages,
      closeChat: payload.closeChat ?? false,
      displayNameLength: payload.profile.displayName.length,
    });
  }
}
