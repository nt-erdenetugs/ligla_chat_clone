import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  MessageEvent,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Storage } from '@google-cloud/storage';
import {
  and,
  count,
  desc,
  eq,
  exists,
  getTableColumns,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  not,
  or,
  sql,
  SQL,
} from 'drizzle-orm';
import { AnyPgColumn, unionAll } from 'drizzle-orm/pg-core';
import { I18nService } from 'nestjs-i18n';
import { Observable, Subject } from 'rxjs';
import { v4 as uuidv4, validate as isValidUuid } from 'uuid';

import {
  CursorDirection,
  CursorPaginatedResponse,
  CursorPaginationArgs,
} from '@/common/dto/pagination.args';
import { resolveEffectiveReadTimestamp } from '@/common/utils/chat-read-timestamp';
import { buildCursorConditions, getCursorArgs } from '@/common/utils/cursor';
import { getDefaultPictureUrl, getFlexLogoUrl, getUploadTypeIconUrl } from '@/common/utils/file';
import { buildJsonObject, normalizeDateTime } from '@/common/utils/query';
import { convertCsvStringToArray } from '@/common/utils/string';
import { DrizzleDB, DrizzleTransaction, InjectDrizzle, TenantSchemaService } from '@/drizzle';
import { operatorRoles } from '@/modules/auth/constants';
import { ChatTeamAssignActionsType } from '@/modules/chat-assignment/enums';
import { EncryptionService } from '@/modules/encryption/encryption.service';
import { LiglaService } from '@/modules/ligla/ligla.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { Sender, User } from '@/modules/user/entities/user.entity';
import { SystemUserType } from '@/modules/user/enums';
import { UserService } from '@/modules/user/user.service';
import * as shared from '@@/drizzle/public/schema';
import { TenantTables } from '@@/drizzle/tenant/schema';

import { OrganizationService } from '../organization/organization.service';

import { ChatMessageInput, DeleteMessageInput, RetryMessageInput } from './dto/chat-message.input';
import { ChatStatusInput } from './dto/chat-status.input';
import { ChatTagInput } from './dto/chat-tag.input';
import { SendFileUploadedMessageInput } from './dto/send-file-uploaded-message.input';
import { ActivityType, ChatActivity, ChatActivityActorType } from './entities/chat-activity.entity';
import {
  ChatItem,
  ChatItemCursorPaginatedResponse,
  ChatItemType,
} from './entities/chat-item.entity';
import { ChatMessage, ChatMessageUpdatePayload, SenderType } from './entities/chat-message.entity';
import { Chat, ChatStatus } from './entities/chat.entity';
import { ChatMessageType } from './enums';

type MessageJsonContent = {
  text?: string;
  image?: string;
  contentUrl?: string;
  duration?: number;
  fileName?: string;
  fileSize?: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  title?: string;
  stickerId?: string;
  packageId?: string;
  stickerResourceType?: string;
  keywords?: string[];
  emojis?: any[];
  imageSet?: any;
  quoteToken?: string;
  quotedMessageId?: string;
  unsent?: boolean;
  previewImageUrl?: string;
  altText?: string;
  contents?: Record<string, unknown>;
};

type MessageContent = Pick<ChatMessage, 'type' | 'content' | 'contentUrl' | 'previewImageUrl'>;

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };
type JsonRecord = Record<string, unknown>;

const uriRegex =
  /^gs:\/\/(?<bucketName>[a-z0-9-_]+)\/(?<organizationName>[a-z0-9_]+)\/(?:images|previews)\/(?<userId>U[0-9a-f]{32})(?:\/(?:(?<imageSetId>[A-F0-9]{64})\/(?<index>\d+)-)?)?(?<messageId>[^\/]+)-(?<timestamp>\d+)\.(?<extension>jpg|png|jpeg)$/;

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const LIFF_BASE_URL = 'https://liff.line.me';
const LIFF_FILE_UPLOADER_LABEL = 'ファイルの確認・共有はこちら';

const { hashedPassword: _, ...authColumns } = getTableColumns(shared.auth);

type ChatQueryParams = {
  teamIds?: string[];
  userIds?: string[];
  statuses?: ChatStatus[];
  tagIds?: string[];
  includeUnassigned?: boolean;
};

type RawChatMessage = Omit<TenantTables['chatMessage']['$inferSelect'], 'content'> & {
  content: Buffer | string;
};
type RawChatActivity = TenantTables['chatActivity']['$inferSelect'];

type RawChat = TenantTables['chat']['$inferSelect'] & {
  chatTeamAssignments: (TenantTables['chatTeamAssignment']['$inferSelect'] & {
    team: TenantTables['team']['$inferSelect'] & {
      userTeams: TenantTables['userTeam']['$inferSelect'][];
    };
  })[];
  user: Nullable<
    TenantTables['user']['$inferSelect'] & {
      userTeams: (TenantTables['userTeam']['$inferSelect'] & {
        team: TenantTables['team']['$inferSelect'];
      })[];
    } & { auth: typeof shared.auth.$inferSelect }
  >;
  endUser: TenantTables['endUser']['$inferSelect'];
  chatMessages: RawChatMessage[];
  chatTags: (TenantTables['chatTags']['$inferSelect'] & {
    tag: TenantTables['tags']['$inferSelect'];
  })[];
  chatActivities: RawChatActivity[];
  chatUserReads?: TenantTables['chatUserRead']['$inferSelect'][];
};

type UserId = User['id'];

type ChatActivityInsert = TenantTables['chatActivity']['$inferInsert'];

type ChangeChatStatusType = Pick<ChatStatusInput, 'chatId'> & {
  oldStatus: ChatStatus;
  newStatus: ChatStatus;
  userId?: UserId;
  organizationId: string;
};

type OldNewTeamType = Pick<
  ChatActivityInsert,
  'oldTeamIds' | 'oldTeamNames' | 'newTeamNames' | 'newTeamIds'
>;

type OldNewUserType = Pick<
  ChatActivityInsert,
  'oldUserId' | 'oldUserName' | 'newUserId' | 'newUserName'
>;

type OldNewStatusType = Pick<ChatActivityInsert, 'oldStatus' | 'newStatus'>;

type OldNewValuesType = OldNewTeamType & OldNewUserType & OldNewStatusType;

type CreateChatActivityType = Pick<
  ChatActivityInsert,
  'chatId' | 'activityType' | 'actorId' | 'actorUserName'
> & {
  oldValues?: OldNewValuesType;
  newValues?: OldNewValuesType;
};

type RecipientsOptions = {
  excludeUserIds?: string[];
  includeUserIds?: string[];
};

const CHAT_QUERY_CONFIG = {
  MESSAGE_LIMIT: 1,
  ACTIVE_STATUSES: [ChatStatus.ADDRESSING, ChatStatus.PENDING] as ChatStatus[],
} as const;

const UNREAD_COUNT_CAP = 100;
const CHAT_AGGREGATE_CONCURRENCY = 5;
const UNREAD_BATCH_SIZE = 25;

type UnreadEntry = { key: string; chatId: string; readTs: Nullable<Date> };

// Throws on first failure; do not read partial result via wrapping try/catch.
async function mapWithConcurrency<T, R>(
  items: ReadonlyArray<T>,
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const effectiveLimit = Math.max(1, limit);
  const results: R[] = new Array(items.length);
  let cursor = 0;
  let aborted = false;
  const workers = Array.from({ length: Math.min(effectiveLimit, items.length) }, async () => {
    while (!aborted) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        aborted = true;
        throw err;
      }
    }
  });
  await Promise.all(workers);
  return results;
}

const storage = new Storage();

@Injectable()
export class ChatService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly userService: UserService,
    private readonly i18n: I18nService,
    private readonly liglaService: LiglaService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationsService,
    private readonly organizationService: OrganizationService,
    private readonly tenantSchema: TenantSchemaService,
    private readonly encryption: EncryptionService,
  ) {}

  private readonly chatStreams: Map<string, Set<Subject<MessageEvent>>> = new Map();
  private readonly logger = new Logger(ChatService.name);

  getOrCreateStream(userId: string): Observable<MessageEvent> {
    try {
      if (!this.chatStreams.has(userId)) {
        this.chatStreams.set(userId, new Set());
      }

      const userStreams = this.chatStreams.get(userId);

      if (!userStreams) {
        throw new NotFoundException(
          this.i18n.t('errors.chat.failedToGetOrStreamUser', { args: { userId } }),
        );
      }

      const newStream = new Subject<MessageEvent>();
      userStreams.add(newStream);

      // Return an Observable that cleans up the specific stream when the client disconnects
      return new Observable<MessageEvent>((observer) => {
        // Forward messages from the newStream to the observer
        const subscription = newStream.subscribe(observer);

        return () => {
          subscription.unsubscribe();
          userStreams.delete(newStream);

          if (userStreams.size === 0) {
            this.chatStreams.delete(userId);
          }
        };
      });
    } catch (error) {
      throw error;
    }
  }

  async broadcastChatToClients(
    chat: RawChat | undefined | null,
    organizationId: string,
  ): Promise<void> {
    let recipientIds: string[] = [];
    try {
      if (!chat) throw new NotFoundException(this.i18n.t('errors.chat.notFound'));
      const recipientUserIds = await this.getMessageRecipients(chat, organizationId);
      if (recipientUserIds.size === 0) return;

      const tenant = this.tenantSchema.getTables(organizationId);
      recipientIds = Array.from(recipientUserIds);
      const recipientSet = new Set(recipientIds);

      const readMap = new Map<string, Date>();
      for (const r of chat.chatUserReads ?? []) {
        if (recipientSet.has(r.userId)) {
          const t = this.normalizeTimestampValue(r.readTimestamp);
          if (t) readMap.set(r.userId, t);
        }
      }

      const fallback = this.normalizeTimestampValue(chat.latestReadTimestamp);
      const chatUserReadsNormalized = (chat.chatUserReads ?? []).map((read) => ({
        ...read,
        readTimestamp: normalizeDateTime(read.readTimestamp) ?? read.readTimestamp,
      }));

      const entries: UnreadEntry[] = await Promise.all(
        recipientIds.map(async (uid) => {
          const ts = await resolveEffectiveReadTimestamp({
            chatId: chat.id,
            chatUserReads: chatUserReadsNormalized,
            currentUserId: uid,
            userReadTimestamp: readMap.get(uid) ?? undefined,
            fallbackReadTimestamp: fallback,
            fetchUserReadTimestamp: () => Promise.resolve(null),
          });
          return { key: uid, chatId: chat.id, readTs: ts };
        }),
      );
      const unreadByUser = await this.getBatchUnreadCounts(entries, tenant);
      const readTsMap = new Map(entries.map((e) => [e.key, e.readTs]));

      await mapWithConcurrency(recipientIds, CHAT_AGGREGATE_CONCURRENCY, async (userId) => {
        const payload = await this.aggregateChat(chat, organizationId, {
          currentUserId: userId,
          userReadTimestamp: readMap.get(userId) ?? undefined,
          unreadCount: unreadByUser.get(userId) ?? 0,
          effectiveReadTimestamp: readTsMap.get(userId) ?? null,
        });
        this.emitToStream(userId, payload);
      });

      const notificationPayload = await this.buildNotificationPayload(chat);

      if (notificationPayload)
        this.handleNotificationSend(chat, recipientUserIds, organizationId, notificationPayload);
    } catch (error: any) {
      this.logger.error({
        message: 'Failed to broadcast chat to clients',
        chatId: chat?.id,
        organizationId,
        recipientCount: recipientIds.length,
        recipientIds,
        error: error.message,
        stack: error.stack,
      });
    }
  }

  async broadcastReceivedChatEvent({
    chatId,
    organizationId,
    chatMessageId,
  }: {
    chatId: string;
    organizationId: string;
    chatMessageId: string;
  }): Promise<void> {
    const tenant = this.tenantSchema.getTables(organizationId);

    const chat = await this.encryption.txWithOrgKey(organizationId, async (tx) =>
      this.queryChatWithMessageId({ db: tx, tenant, chatMessageId })
        .where(eq(tenant.chat.id, chatId))
        .then((rows) => rows[0] || null),
    );

    this.broadcastChatToClients(chat, organizationId);
  }

  async broadcastChatEvent(chatId: Chat['id'], organizationId: string): Promise<void> {
    const tenant = this.tenantSchema.getTables(organizationId);

    const chat = await this.encryption.txWithOrgKey(
      organizationId,
      async (tx) =>
        await this.queryChatWithLatestMessage(tx, tenant)
          .where(eq(tenant.chat.id, chatId))
          .then((rows) => rows[0] || null),
    );

    this.broadcastChatToClients(chat, organizationId);
  }

  async sendMessageToEndUser(
    data: ChatMessageInput & { previewImageUrl?: string },
    senderId: string,
    organizationId: string,
  ): Promise<ChatMessage> {
    const { chatId, message } = data;
    const tenant = this.tenantSchema.getTables(organizationId);

    const messageType = (message.type as ChatMessageType) || ChatMessageType.TEXT;

    let normalizedContent: Record<string, any>;
    switch (messageType) {
      case ChatMessageType.TEXT: {
        const text = message.text?.trim() || '';
        normalizedContent = { text };
        break;
      }
      case ChatMessageType.FLEX: {
        if (!message.flex) {
          throw new BadRequestException('Flex payload is required');
        }
        normalizedContent = {
          text: message.flex.altText || 'Flex message',
          altText: message.flex.altText || 'Flex message',
          contents: message.flex.contents,
          ...(data.previewImageUrl ? { previewImageUrl: data.previewImageUrl } : {}),
        };
        break;
      }
      default:
        throw new BadRequestException(`Unsupported message type: ${messageType}`);
    }

    const storedType =
      messageType === ChatMessageType.FLEX
        ? ChatMessageType.TEXT
        : (messageType as Exclude<ChatMessageType, 'FLEX'>);
    const contentString = JSON.stringify(normalizedContent);

    const newMessage = await this.encryption.txWithOrgKey(organizationId, async (tx) => {
      const [cm] = await tx
        .insert(tenant.chatMessage)
        .values({
          id: uuidv4(),
          chatId,
          senderId,
          senderType: SenderType.OPERATOR,
          type: storedType,
          // TODO(JIRA-922): drop the contentEncrypted dual-write; the encryption
          // trigger derives it from content.
          content: normalizedContent,
          contentEncrypted: this.encryption.encryptValue(contentString),
          isDelivered: false,
          isEncrypted: true,
        })
        .returning({
          ...getTableColumns(tenant.chatMessage),
          content: this.encryption.decryptColumnStr(
            tenant.chatMessage.content,
            tenant.chatMessage.contentEncrypted,
            tenant.chatMessage.isEncrypted,
          ),
        });
      return cm;
    });
    return await this.aggregateChatMessage(newMessage, organizationId);
  }

  async sendUploadLink(
    chatId: string,
    senderId: string,
    organizationId: string,
  ): Promise<ChatMessage> {
    const uploadUrl = await this.buildLiffUploadUrl(organizationId);
    const heroImageUrl = getFlexLogoUrl(this.configService);
    const flexBubble = this.shareUploadFlexBubble(
      LIFF_FILE_UPLOADER_LABEL,
      uploadUrl,
      heroImageUrl,
    );

    const message: ChatMessageInput = {
      chatId,
      message: {
        type: ChatMessageType.FLEX,
        flex: {
          altText: LIFF_FILE_UPLOADER_LABEL,
          contents: flexBubble,
        },
      },
    };

    return this.sendFlexToEndUserAndLigla(
      chatId,
      message,
      senderId,
      organizationId,
      'sendUploadLink',
    );
  }

  async sendFileUploadedMessage(
    input: SendFileUploadedMessageInput,
    senderId: string,
    organizationId: string,
  ): Promise<ChatMessage> {
    const { chatId, fileName, altText } = input;
    const uploadUrl = await this.buildLiffUploadUrl(organizationId);

    const fileTypeToken = (altText || '').trim().toUpperCase();
    const heroImageUrl = getUploadTypeIconUrl(this.configService, fileTypeToken);
    const senderDisplayName =
      (await this.userService.findUserSenderName(organizationId, senderId)) || '';
    const formattedDate = this.formatFlexMessageDate(new Date());
    const flexBubble = this.fileUploadFlexBubble(
      fileName,
      uploadUrl,
      heroImageUrl,
      formattedDate,
      senderDisplayName,
    );

    const message = {
      chatId,
      message: {
        type: ChatMessageType.FLEX,
        flex: {
          altText: fileName || altText || 'File upload link',
          contents: flexBubble,
        },
      },
      previewImageUrl: heroImageUrl,
    } satisfies ChatMessageInput & { previewImageUrl?: string };

    return this.sendFlexToEndUserAndLigla(
      chatId,
      message,
      senderId,
      organizationId,
      'sendFileUploadedMessage',
    );
  }

  private async sendFlexToEndUserAndLigla(
    chatId: string,
    message: ChatMessageInput & { previewImageUrl?: string },
    senderId: string,
    organizationId: string,
    logContext: string,
  ): Promise<ChatMessage> {
    const newMessage = await this.sendMessageToEndUser(message, senderId, organizationId);

    try {
      return await this.sendMessageToLigla(chatId, organizationId, newMessage.id);
    } catch (error) {
      this.logger.error(`${logContext}: LINE delivery failed for message ${newMessage.id}`, error);
      return newMessage;
    }
  }

  private async buildLiffUploadUrl(organizationId: string): Promise<string> {
    const organization = await this.db
      .select({
        name: shared.organization.name,
        fileUploadLiffId: shared.organization.fileUploadLiffId,
      })
      .from(shared.organization)
      .where(eq(shared.organization.id, organizationId))
      .then((rows) => rows[0] || null);

    if (!organization) {
      throw new NotFoundException(this.i18n.t('errors.organization.notFound'));
    }

    if (!organization.fileUploadLiffId) {
      throw new BadRequestException(
        this.i18n.t('errors.organization.fileUploadLiffIdNotConfigured'),
      );
    }

    const url = new URL(`${LIFF_BASE_URL}/${organization.fileUploadLiffId}`);
    url.searchParams.set('id', organization.fileUploadLiffId);
    url.searchParams.set('o', organization.name);
    return url.toString();
  }

  async retrySendMessage(data: RetryMessageInput, organizationId: string): Promise<ChatMessage> {
    const { messageId } = data;

    const tenant = this.tenantSchema.getTables(organizationId);

    const message = await this.encryption.txWithOrgKey(organizationId, async (tx) => {
      return await tx
        .select({
          ...getTableColumns(tenant.chatMessage),
          content: this.encryption.decryptColumnStr(
            tenant.chatMessage.content,
            tenant.chatMessage.contentEncrypted,
            tenant.chatMessage.isEncrypted,
          ),
        })
        .from(tenant.chatMessage)
        .where(eq(tenant.chatMessage.id, messageId))
        .then((rows) => rows[0] || null);
    });

    return await this.aggregateChatMessage(message, organizationId);
  }

  async sendMessageToLigla(
    chatId: string,
    organizationId: string,
    messageId: string,
    closeChat?: boolean,
  ): Promise<ChatMessage> {
    const tenant = this.tenantSchema.getTables(organizationId);

    const chat = await this.db
      .select({ endUserId: tenant.chat.endUserId })
      .from(tenant.chat)
      .where(eq(tenant.chat.id, chatId))
      .then((rows) => rows[0] || null);

    if (!chat) {
      throw new NotFoundException(this.i18n.t('errors.chat.notFound'));
    }

    const message = await this.encryption.txWithOrgKey(organizationId, async (tx) => {
      return await tx
        .select({
          ...getTableColumns(tenant.chatMessage),
          content: this.encryption.decryptColumnStr(
            tenant.chatMessage.content,
            tenant.chatMessage.contentEncrypted,
            tenant.chatMessage.isEncrypted,
          ),
          chatEndUserId: tenant.chat.endUserId,
        })
        .from(tenant.chatMessage)
        .innerJoin(tenant.chat, eq(tenant.chat.id, tenant.chatMessage.chatId))
        .where(eq(tenant.chatMessage.id, messageId))
        .then((rows) => rows[0] || null);
    });

    if (!message) {
      throw new NotFoundException(this.i18n.t('errors.chat.messageNotFound'));
    }

    const messageSenderId = message.senderId;

    const content = this.parseMessageContent(message.content);
    const text = content?.text || '';
    const quoteToken = content?.quoteToken;

    const isFlex =
      (message.type as unknown as string) === ChatMessageType.FLEX || Boolean(content?.contents);

    const liglaMessagePayload = (
      isFlex
        ? {
            operatorId: messageSenderId,
            userId: chat.endUserId,
            type: ChatMessageType.FLEX,
            messageId: message.id,
            messages: [
              {
                type: 'flex',
                altText: content?.altText || 'Flex message',
                contents: content?.contents,
              },
            ],
            closeChat,
          }
        : {
            operatorId: messageSenderId,
            userId: chat.endUserId,
            type: ChatMessageType.TEXT,
            messageId: message.id,
            text,
            quoteToken,
            closeChat,
          }
    ) as any;

    try {
      const response = await this.liglaService.sendMessage(
        organizationId,
        liglaMessagePayload,
        () => {}, //this callback as we'll handle it synchronously
        () => this.notifyMessageSendFailure(chatId, message.id, organizationId),
      );

      const updatedMessage = await this.encryption.txWithOrgKey(organizationId, async (tx) => {
        const deliveryTimestamp = new Date();

        const [msg] = await tx
          .update(tenant.chatMessage)
          .set({
            isDelivered: true,
            ...(response?.quoteToken ? { quoteToken: response.quoteToken } : {}),
            ...(response?.messageId ? { quotedMessageId: response.messageId } : {}),
            ...(response?.sentMethod ? { sentMethod: response.sentMethod } : {}),
            ...(response?.sentMessages?.length
              ? { deliveryDetails: { sentMessages: response.sentMessages } }
              : {}),
          })
          .where(eq(tenant.chatMessage.id, message.id))
          .returning({
            ...getTableColumns(tenant.chatMessage),
            content: this.encryption.decryptColumnStr(
              tenant.chatMessage.content,
              tenant.chatMessage.contentEncrypted,
              tenant.chatMessage.isEncrypted,
            ),
          });

        await tx
          .update(tenant.chat)
          .set({
            latestMessageTimestamp: deliveryTimestamp,
            latestReadTimestamp: deliveryTimestamp,
          })
          .where(eq(tenant.chat.id, chatId));

        if (message.senderType === SenderType.OPERATOR) {
          await this.upsertChatUserRead(tx, tenant, {
            chatId,
            userId: messageSenderId,
            readTimestamp: deliveryTimestamp,
          });
        }

        return msg;
      });

      const chatStatusResult = await this.db
        .select({ chatStatus: tenant.chat.chatStatus })
        .from(tenant.chat)
        .where(eq(tenant.chat.id, chatId))
        .then((rows) => rows[0] || null);

      if (
        chatStatusResult?.chatStatus === ChatStatus.PENDING &&
        message.senderType === SenderType.OPERATOR
      ) {
        await this.changeChatStatus(
          {
            chatId,
            oldStatus: chatStatusResult.chatStatus,
            newStatus: ChatStatus.ADDRESSING,
            organizationId: organizationId,
          },
          organizationId,
        );
      }

      const fullChat = await this.encryption.txWithOrgKey(
        organizationId,
        async (tx) =>
          await this.queryChatWithMessageId({ db: tx, tenant, chatMessageId: messageId })
            .where(eq(tenant.chat.id, chatId))
            .then((rows) => rows[0] || null),
      );

      this.broadcastChatToClients(fullChat, organizationId);

      return await this.aggregateChatMessage(updatedMessage, organizationId);
    } catch (error: any) {
      this.logger.error({ message: 'Ligla send message failed' }, error);
      return this.aggregateChatMessage(message, organizationId);
    }
  }

  async deleteChatMessage(data: DeleteMessageInput, organizationId: string): Promise<boolean> {
    const tenant = this.tenantSchema.getTables(organizationId);

    const { chatId, messageId } = data;

    const message = await this.db
      .select()
      .from(tenant.chatMessage)
      .where(and(eq(tenant.chatMessage.id, messageId), eq(tenant.chatMessage.chatId, chatId)));

    if (message.length === 0) {
      throw new NotFoundException(this.i18n.t('errors.chat.messageNotFound'));
    }

    await this.db.delete(tenant.chatMessage).where(eq(tenant.chatMessage.id, messageId));

    return true;
  }

  async findChatsByParams(
    params: ChatQueryParams,
    userId: string,
    role: string,
    organizationId: string,
    paginationArgs: CursorPaginationArgs,
  ): Promise<CursorPaginatedResponse<Chat>> {
    const tenant = this.tenantSchema.getTables(organizationId);

    const where = await this.buildWhereClause(params, tenant, userId, role);
    const { take, ...cursorArgs } = paginationArgs;

    const cursorConditions = buildCursorConditions(
      tenant.chat,
      cursorArgs,
      'latestMessageTimestamp',
    );

    const chats = await this.encryption.txWithOrgKey(organizationId, async (tx) => {
      let query = this.queryChatWithLatestMessage(tx, tenant)
        .where(and(where, cursorConditions?.where))
        .orderBy(...cursorConditions.orderBy);

      if (take) {
        query = query.limit(take + 1);
      }

      return await query;
    });

    const { nextCursorId, hasMore, nextCursorCreatedAt, items, nextCursorDateParam } =
      getCursorArgs(chats, take, { dateParamKey: 'latestMessageTimestamp' });

    const chatIds = items.map((c) => c.id);
    const attributeValuesMap = await this.getBatchAttributeValues(chatIds, tenant, organizationId);
    const userReadMap = userId
      ? await this.getUserReadTimestamps(chatIds, userId, tenant)
      : undefined;

    const allMessages = items.flatMap((c) => c.chatMessages || []);
    const senderMap = await this.getBatchSenders(allMessages, tenant);

    const readTsEntries: UnreadEntry[] = await Promise.all(
      items.map(async (chat) => {
        const userReadTimestamp = userReadMap?.get(chat.id) ?? undefined;
        const chatUserReads = (chat.chatUserReads ?? []).map((read) => ({
          ...read,
          readTimestamp: normalizeDateTime(read.readTimestamp) ?? read.readTimestamp,
        }));
        const fallbackReadTimestamp = this.normalizeTimestampValue(chat.latestReadTimestamp);
        const ts = await resolveEffectiveReadTimestamp({
          chatId: chat.id,
          chatUserReads,
          currentUserId: userId,
          userReadTimestamp,
          fallbackReadTimestamp,
          fetchUserReadTimestamp: () => Promise.resolve(null),
        });
        return { key: chat.id, chatId: chat.id, readTs: ts };
      }),
    );
    const unreadCountMap = await this.getBatchUnreadCounts(readTsEntries, tenant);
    const readTsMap = new Map(readTsEntries.map((e) => [e.key, e.readTs]));

    return {
      nextCursorId,
      nextCursorCreatedAt,
      nextCursorDateParam,
      hasMore,
      items: await mapWithConcurrency(items, CHAT_AGGREGATE_CONCURRENCY, (chat) =>
        this.aggregateChat(chat, organizationId, {
          currentUserId: userId,
          userReadTimestamp: userReadMap?.get(chat.id) ?? undefined,
          attributes: attributeValuesMap.get(chat.id) || [],
          senderMap,
          unreadCount: unreadCountMap.get(chat.id) ?? 0,
          effectiveReadTimestamp: readTsMap.get(chat.id) ?? null,
        }),
      ),
    };
  }

  async findChatCountByParams(
    params: ChatQueryParams,
    userId: string,
    role: string,
    organizationId: string,
  ) {
    const tenant = this.tenantSchema.getTables(organizationId);

    const where = await this.buildWhereClause(params, tenant, userId, role);

    const result = await this.db.select({ value: count() }).from(tenant.chat).where(where);

    return result[0]?.value ?? 0;
  }

  async findUnassignedChatCount(params: ChatQueryParams, organizationId: string) {
    const tenant = this.tenantSchema.getTables(organizationId);

    const where = await this.buildWhereClause(params, tenant);

    const result = await this.db
      .select({ value: count() })
      .from(tenant.chat)
      .where(and(where, isNull(tenant.chat.assignedUserId)));

    return result[0]?.value ?? 0;
  }

  async findOne(id: string, organizationId: string, currentUserId?: string): Promise<Chat> {
    const tenant = this.tenantSchema.getTables(organizationId);
    const chat = await this.encryption.txWithOrgKey(
      organizationId,
      async (tx) =>
        await this.queryChatWithLatestMessage(tx, tenant)
          .where(eq(tenant.chat.id, id))
          .then((rows) => rows[0] || null),
    );

    return this.aggregateChat(chat, organizationId, { currentUserId });
  }

  async findOneIfAccessible(
    id: string,
    params: ChatQueryParams,
    userId: string,
    role: string,
    organizationId: string,
  ): Promise<Chat | null> {
    const tenant = this.tenantSchema.getTables(organizationId);
    const canAccess = await this.canAccessChat(id, params, userId, role, tenant);
    if (!canAccess) {
      return null;
    }

    return this.findOne(id, organizationId, userId);
  }

  private async canAccessChat(
    id: string,
    params: ChatQueryParams,
    userId: string,
    role: string,
    tenant: TenantTables,
  ): Promise<boolean> {
    const where = await this.buildWhereClause(params, tenant, userId, role);
    const condition = where ? and(eq(tenant.chat.id, id), where) : eq(tenant.chat.id, id);

    const chat = await this.db
      .select({ id: tenant.chat.id })
      .from(tenant.chat)
      .where(condition)
      .then((rows) => rows[0] || null);

    return !!chat;
  }

  async getChatData(
    chatId: string,
    organizationId: string,
    paginationArgs: CursorPaginationArgs,
  ): Promise<ChatItemCursorPaginatedResponse> {
    const {
      take = 100,
      cursorId,
      cursorCreatedAt,
      cursorDirection = CursorDirection.BACKWARD,
    } = paginationArgs;

    const tenant = this.tenantSchema.getTables(organizationId);

    const buildItemCursor = (createdAtColumn: AnyPgColumn, idColumn: AnyPgColumn) =>
      cursorCreatedAt && cursorId
        ? cursorDirection === CursorDirection.FORWARD
          ? or(
              gt(createdAtColumn, cursorCreatedAt),
              and(eq(createdAtColumn, cursorCreatedAt), gt(idColumn, cursorId)),
            )
          : or(
              lt(createdAtColumn, cursorCreatedAt),
              and(eq(createdAtColumn, cursorCreatedAt), lt(idColumn, cursorId)),
            )
        : undefined;

    const orderItems = (
      createdAtColumn: AnyPgColumn,
      idColumn: AnyPgColumn,
    ): (AnyPgColumn | SQL)[] =>
      cursorDirection === CursorDirection.FORWARD
        ? [createdAtColumn, idColumn]
        : [desc(createdAtColumn), desc(idColumn)];

    const messagesSubquery = this.db
      .select({
        id: tenant.chatMessage.id,
        createdAt: tenant.chatMessage.createdAt,
        itemType: sql<string>`'MESSAGE'`.as('item_type'),
      })
      .from(tenant.chatMessage)
      .where(
        and(
          eq(tenant.chatMessage.chatId, chatId),
          buildItemCursor(tenant.chatMessage.createdAt, tenant.chatMessage.id),
        ),
      )
      .orderBy(...orderItems(tenant.chatMessage.createdAt, tenant.chatMessage.id))
      .limit(take + 1);

    const activitiesSubquery = this.db
      .select({
        id: tenant.chatActivity.id,
        createdAt: tenant.chatActivity.createdAt,
        itemType: sql<string>`'ACTIVITY'`.as('item_type'),
      })
      .from(tenant.chatActivity)
      .where(
        and(
          eq(tenant.chatActivity.chatId, chatId),
          buildItemCursor(tenant.chatActivity.createdAt, tenant.chatActivity.id),
        ),
      )
      .orderBy(...orderItems(tenant.chatActivity.createdAt, tenant.chatActivity.id))
      .limit(take + 1);

    const combinedCTE = this.db
      .$with('combined_items')
      .as(unionAll(messagesSubquery, activitiesSubquery));

    const baseQuery = this.db.with(combinedCTE).select().from(combinedCTE);

    const queryWithOrder =
      cursorDirection === CursorDirection.FORWARD
        ? baseQuery.orderBy(combinedCTE.createdAt, combinedCTE.id)
        : baseQuery.orderBy(desc(combinedCTE.createdAt), desc(combinedCTE.id));

    // Fetch take + 1 to determine hasMore
    const paginatedItems = await queryWithOrder.limit(take + 1);

    // Step 2: Fetch full data for the specific IDs
    const itemsToFetch = paginatedItems.slice(0, take);
    const messageIds = itemsToFetch.filter((i) => i.itemType === 'MESSAGE').map((i) => i.id);
    const activityIds = itemsToFetch.filter((i) => i.itemType === 'ACTIVITY').map((i) => i.id);

    const [rawMessages, rawActivities] = await this.encryption.txWithOrgKey(
      organizationId,
      async (tx) =>
        await Promise.all([
          messageIds.length > 0
            ? tx
                .select({
                  ...getTableColumns(tenant.chatMessage),
                  content: this.encryption.decryptColumnStr(
                    tenant.chatMessage.content,
                    tenant.chatMessage.contentEncrypted,
                    tenant.chatMessage.isEncrypted,
                  ),
                })
                .from(tenant.chatMessage)
                .where(inArray(tenant.chatMessage.id, messageIds))
            : [],
          activityIds.length > 0
            ? tx
                .select({
                  ...getTableColumns(tenant.chatActivity),
                  user_actorId: sql`
                    (
                      SELECT ${buildJsonObject(getTableColumns(tenant.user))}
                      FROM ${tenant.user}
                      WHERE ${tenant.user.id} = ${tenant.chatActivity.actorId}
                    )
                  `,
                  user_newUserId: sql`
                    (
                      SELECT ${buildJsonObject(getTableColumns(tenant.user))}
                      FROM ${tenant.user}
                      WHERE ${tenant.user.id} = ${tenant.chatActivity.newUserId}
                    )
                  `,
                  user_oldUserId: sql`
                    (
                      SELECT ${buildJsonObject(getTableColumns(tenant.user))}
                      FROM ${tenant.user}
                      WHERE ${tenant.user.id} = ${tenant.chatActivity.oldUserId}
                    )
                  `,
                })
                .from(tenant.chatActivity)
                .where(inArray(tenant.chatActivity.id, activityIds))
            : [],
        ]),
    );

    // Step 3: Aggregate the data
    // Performance: Batch load senders for all messages
    const senderMap = await this.getBatchSenders(rawMessages, tenant);

    const [messages, activities] = await Promise.all([
      Promise.all(
        rawMessages.map((msg) =>
          this.aggregateChatMessage(msg, organizationId, senderMap.get(msg.senderId)),
        ),
      ),
      Promise.all(rawActivities.map((act) => this.aggregateChatActivity(act as RawChatActivity))),
    ]);

    // Create maps for quick lookups
    const messageMap = new Map(messages.map((m) => [m.id, m]));
    const activityMap = new Map(activities.map((a) => [a.id, a]));

    // Step 4: Reconstruct items in the correct order from the paginated query
    const combinedItems: ChatItem[] = itemsToFetch.map((item) => {
      if (item.itemType === 'MESSAGE') {
        const message = messageMap.get(item.id)!;
        return {
          id: message.id,
          createdAt: message.createdAt,
          message,
          activity: null,
          itemType: ChatItemType.MESSAGE,
        };
      } else {
        const activity = activityMap.get(item.id)!;
        return {
          id: activity.id,
          createdAt: activity.createdAt,
          message: null,
          activity,
          itemType: ChatItemType.ACTIVITY,
        };
      }
    });

    const hasMore = paginatedItems.length > take;
    const lastItem =
      hasMore && combinedItems.length > 0 ? combinedItems[combinedItems.length - 1] : null;

    return {
      items: combinedItems,
      nextCursorId: lastItem?.id || null,
      nextCursorCreatedAt: lastItem?.createdAt || null,
      hasMore,
    };
  }

  async findRawOne(id: string, organizationId: string) {
    const tenant = this.tenantSchema.getTables(organizationId);

    const chat = await this.db
      .select({
        id: tenant.chat.id,
        assignedUserId: tenant.chat.assignedUserId,
        chatStatus: tenant.chat.chatStatus,
        isUserBlocked: tenant.chat.isUserBlocked,
      })
      .from(tenant.chat)
      .where(eq(tenant.chat.id, id))
      .then((rows) => rows[0] || null);

    if (!chat) throw new NotFoundException(this.i18n.t('errors.chat.notFound'));

    return chat;
  }
  async isUserInChatTeam(chatId: string, organizationId: string, userId: string): Promise<boolean> {
    const tenant = this.tenantSchema.getTables(organizationId);

    const [assignment] = await this.db
      .select({ userId: tenant.userTeam.userId })
      .from(tenant.chatTeamAssignment)
      .innerJoin(tenant.userTeam, eq(tenant.userTeam.teamId, tenant.chatTeamAssignment.teamId))
      .where(and(eq(tenant.chatTeamAssignment.chatId, chatId), eq(tenant.userTeam.userId, userId)))
      .limit(1);

    return !!assignment;
  }
  async hasActiveChatForTeamMembers(teamId: string, organizationId: string): Promise<boolean> {
    const tenant = this.tenantSchema.getTables(organizationId);

    const [{ activeChatCount }] = await this.db
      .select({ activeChatCount: count() })
      .from(tenant.chat)
      .where(
        and(
          inArray(tenant.chat.chatStatus, CHAT_QUERY_CONFIG.ACTIVE_STATUSES),
          isNotNull(tenant.chat.assignedUserId),
          exists(
            this.db
              .select()
              .from(tenant.chatTeamAssignment)
              .where(
                and(
                  eq(tenant.chatTeamAssignment.chatId, tenant.chat.id),
                  eq(tenant.chatTeamAssignment.teamId, teamId),
                ),
              ),
          ),
          not(
            exists(
              this.db
                .select()
                .from(tenant.userTeam)
                .where(
                  and(
                    eq(tenant.userTeam.userId, tenant.chat.assignedUserId),
                    ne(tenant.userTeam.teamId, teamId),
                  ),
                ),
            ),
          ),
        ),
      );

    return activeChatCount > 0;
  }

  async hasActiveChatForTag(tagId: string, organizationId: string): Promise<boolean> {
    const tenant = this.tenantSchema.getTables(organizationId);
    const [{ activeChatCount }] = await this.db
      .select({ activeChatCount: count() })
      .from(tenant.chatTags)
      .where(
        and(
          eq(tenant.chatTags.tagId, tagId),
          exists(
            this.db
              .select()
              .from(tenant.chat)
              .where(
                and(
                  eq(tenant.chat.id, tenant.chatTags.chatId),
                  inArray(tenant.chat.chatStatus, CHAT_QUERY_CONFIG.ACTIVE_STATUSES),
                ),
              ),
          ),
        ),
      );

    return activeChatCount > 0;
  }

  async hasActiveChatForTeamStores(
    teamId: string,
    storeIds: string[],
    organizationId: string,
  ): Promise<boolean> {
    const tenant = this.tenantSchema.getTables(organizationId);

    const [{ activeChatCount }] = await this.db
      .select({ activeChatCount: count() })
      .from(tenant.chat)
      .where(
        and(
          inArray(tenant.chat.chatStatus, CHAT_QUERY_CONFIG.ACTIVE_STATUSES),
          isNotNull(tenant.chat.assignedUserId),
          not(
            exists(
              this.db
                .select()
                .from(tenant.userTeam)
                .where(
                  and(
                    eq(tenant.userTeam.userId, tenant.chat.assignedUserId),
                    or(
                      ne(tenant.userTeam.teamId, teamId),
                      not(
                        exists(
                          this.db
                            .select()
                            .from(tenant.storeTeam)
                            .where(
                              and(
                                eq(tenant.storeTeam.teamId, tenant.userTeam.teamId),
                                inArray(tenant.storeTeam.storeId, storeIds),
                              ),
                            ),
                        ),
                      ),
                    ),
                  ),
                ),
            ),
          ),
        ),
      );

    return activeChatCount > 0;
  }

  async changeChatStatus(
    chatStatusInput: ChangeChatStatusType,
    organizationId: string,
  ): Promise<ChatActivity> {
    const tenant = this.tenantSchema.getTables(organizationId);
    const { chatId, newStatus } = chatStatusInput;

    const { activity, endUserId } = await this.db.transaction(async (tx) => {
      const chatRow = await tx
        .select({
          latestMessageTimestamp: tenant.chat.latestMessageTimestamp,
          assignedUserId: tenant.chat.assignedUserId,
          chatStatus: tenant.chat.chatStatus,
          endUserId: tenant.chat.endUserId,
        })
        .from(tenant.chat)
        .where(eq(tenant.chat.id, chatId))
        .then((rows) => rows[0] || null);

      if (!chatRow) {
        throw new NotFoundException(this.i18n.t('errors.chat.notFound'));
      }

      await this.updateChatWithTx(tx, tenant, chatId, { chatStatus: newStatus });

      const latestMsgTs =
        this.normalizeTimestampValue(chatRow.latestMessageTimestamp) ?? new Date();
      const pinnedReadTs = new Date(latestMsgTs.getTime() + 1);

      const pinLatestRead = async (pinUserId?: string) => {
        await tx
          .update(tenant.chat)
          .set({ latestReadTimestamp: pinnedReadTs })
          .where(eq(tenant.chat.id, chatId));

        if (pinUserId) {
          await this.upsertChatUserRead(tx, tenant, {
            chatId,
            userId: pinUserId,
            readTimestamp: pinnedReadTs,
          });
        }
      };

      if (newStatus === ChatStatus.DONE) {
        const pinUserId = chatRow.assignedUserId ?? chatStatusInput.userId;
        await pinLatestRead(pinUserId);
      }

      if (chatRow.chatStatus === ChatStatus.DONE && newStatus !== ChatStatus.DONE) {
        const pinUserId = chatRow.assignedUserId ?? chatStatusInput.userId;
        await pinLatestRead(pinUserId);
      }

      const activity = await this.createStatusChangeActivity(tx, tenant, chatStatusInput);
      return { activity, endUserId: chatRow.endUserId };
    });

    // Fire-and-forget: log on failure, don't block the status change.
    if (newStatus === ChatStatus.DONE && endUserId) {
      this.liglaService.endChatSession(organizationId, { endUserId }).catch((error) => {
        this.logger.error('Failed to close Ligla session', {
          chatId,
          endUserId,
          error: error?.message ?? error,
        });
      });
    }

    this.broadcastChatEvent(chatId, organizationId);

    return activity;
  }

  async addChatTag(chatTagInput: ChatTagInput, organizationId: string): Promise<Chat> {
    const { chatId, tagId } = chatTagInput;

    const tenant = this.tenantSchema.getTables(organizationId);

    const chat = await this.db
      .select({ id: tenant.chat.id })
      .from(tenant.chat)
      .where(eq(tenant.chat.id, chatId))
      .then((rows) => rows[0] || null);

    if (!chat) {
      throw new NotFoundException(this.i18n.t('errors.chat.notFound'));
    }

    const tag = await this.db
      .select({ id: tenant.tags.id })
      .from(tenant.tags)
      .where(eq(tenant.tags.id, tagId))
      .then((rows) => rows[0] || null);

    if (!tag) {
      throw new NotFoundException(this.i18n.t('errors.tag.notFound'));
    }

    const chatTag = await this.db
      .select()
      .from(tenant.chatTags)
      .where(and(eq(tenant.chatTags.chatId, chatId), eq(tenant.chatTags.tagId, tagId)))
      .then((rows) => rows[0] || null);

    if (chatTag) {
      throw new BadRequestException(this.i18n.t('errors.chat.alreadyTagAdded'));
    }

    await this.db.insert(tenant.chatTags).values({
      id: uuidv4(),
      chatId,
      tagId,
    });

    return this.findOne(chatId, organizationId);
  }

  async removeChatTag(chatTagInput: ChatTagInput, organizationId: string): Promise<Chat> {
    const { chatId, tagId } = chatTagInput;
    const tenant = this.tenantSchema.getTables(organizationId);

    const chatTag = await this.ensureTagIsAssigned(chatId, tagId, tenant);

    await this.db.delete(tenant.chatTags).where(eq(tenant.chatTags.id, chatTag.id));

    return this.findOne(chatId, organizationId);
  }

  async updateChatLatestRead(
    chatId: string,
    timestamp: Date | string,
    organizationId: string,
    userId: string,
    isGlobalRead = true,
  ): Promise<Chat> {
    const parsedTimestamp = this.normalizeTimestampValue(timestamp);

    if (!parsedTimestamp) {
      throw new BadRequestException(this.i18n.t('errors.chat.invalidTimestamp'));
    }

    const tenant = this.tenantSchema.getTables(organizationId);

    const latestIncomingMessage = await this.db
      .select({
        createdAt: tenant.chatMessage.createdAt,
        markAsReadToken: tenant.chatMessage.markAsReadToken,
      })
      .from(tenant.chatMessage)
      .where(
        and(
          eq(tenant.chatMessage.chatId, chatId),
          eq(tenant.chatMessage.isDelivered, true),
          ne(tenant.chatMessage.senderType, SenderType.OPERATOR),
        ),
      )
      .orderBy(desc(tenant.chatMessage.createdAt), desc(tenant.chatMessage.id))
      .limit(1)
      .then((rows) => rows[0] || null);

    const latestIncomingTimestamp = this.normalizeTimestampValue(latestIncomingMessage?.createdAt);
    const normalizedTimestamp = new Date(
      Math.max(parsedTimestamp.getTime(), latestIncomingTimestamp?.getTime() ?? 0) + 1,
    );

    const chat = await this.db
      .select({
        endUserId: tenant.chat.endUserId,
      })
      .from(tenant.chat)
      .where(eq(tenant.chat.id, chatId))
      .then((rows) => rows[0] || null);

    if (!chat) {
      throw new NotFoundException(this.i18n.t('errors.chat.notFound'));
    }

    await this.db.transaction(async (tx) => {
      await this.upsertChatUserRead(tx, tenant, {
        chatId,
        userId,
        readTimestamp: normalizedTimestamp,
      });

      if (isGlobalRead) {
        await tx
          .update(tenant.chat)
          .set({ latestReadTimestamp: normalizedTimestamp })
          .where(eq(tenant.chat.id, chatId));
      }
    });

    if (isGlobalRead) {
      try {
        await this.liglaService.chatRead(organizationId, {
          endUserId: chat.endUserId,
          markAsReadToken: latestIncomingMessage?.markAsReadToken,
        });
      } catch (error: any) {
        this.logger.error({ message: 'Ligla chat read failed' }, error);
      }
    }

    return this.findOne(chatId, organizationId, userId);
  }

  async updateChatTags(chatId: string, tagIds: string[], organizationId: string): Promise<Chat> {
    // Deduplicate tag IDs
    const tenant = this.tenantSchema.getTables(organizationId);

    const uniqueTagIds = [...new Set(tagIds)];

    // If there are tag IDs to validate, check they exist
    if (uniqueTagIds.length > 0) {
      // First validate UUID format
      const invalidUuidTagIds = uniqueTagIds.filter((tagId) => !isValidUuid(tagId));
      if (invalidUuidTagIds.length > 0) {
        throw new BadRequestException(this.i18n.t('errors.chat.invalidTags'));
      }

      const existingTags = await this.db
        .select({ id: tenant.tags.id })
        .from(tenant.tags)
        .where(inArray(tenant.tags.id, uniqueTagIds));

      const missingTagIds = uniqueTagIds.filter(
        (tagId) => !existingTags.some((tag) => tag.id === tagId),
      );

      if (missingTagIds.length > 0) {
        throw new BadRequestException(this.i18n.t('errors.chat.invalidTags'));
      }
    }

    await this.db.transaction(async (tx) => {
      await tx.delete(tenant.chatTags).where(eq(tenant.chatTags.chatId, chatId));

      // Only insert if there are tags to insert
      if (uniqueTagIds.length > 0) {
        await tx.insert(tenant.chatTags).values(
          uniqueTagIds.map((tagId) => ({
            id: uuidv4(),
            chatId,
            tagId,
          })),
        );
      }
    });
    return this.findOne(chatId, organizationId);
  }

  async createChatActivity(
    tx: DrizzleTransaction,
    tenant: TenantTables,
    data: CreateChatActivityType,
  ) {
    const { chatId, activityType, actorId, actorUserName, oldValues, newValues } = data;

    const [chatActivity] = await tx
      .insert(tenant.chatActivity)
      .values({
        id: uuidv4(),
        chatId,
        activityType,
        actorType: actorId ? ChatActivityActorType.USER : ChatActivityActorType.SYSTEM,
        actorId,
        actorUserName,
        ...oldValues,
        ...newValues,
      })
      .returning();

    await tx
      .update(tenant.chat)
      .set({ latestActivityAt: chatActivity.createdAt })
      .where(eq(tenant.chat.id, chatId));

    this.logger.log({
      message: `Chat activity created: ${chatActivity.id} for chat: ${chatId}`,
      ...data,
    });
    return this.aggregateChatActivity(chatActivity);
  }

  async updateChatWithTx(
    tx: DrizzleTransaction,
    tenant: TenantTables,
    chatId: string,
    data: Partial<TenantTables['chat']['$inferInsert']>,
  ) {
    await tx.update(tenant.chat).set(data).where(eq(tenant.chat.id, chatId));
  }

  async aggregateMessageContent(
    contentJson: unknown,
    messageType: ChatMessageType,
    messagePreviewImageUrl: Nullable<string>,
    organizationId: string,
  ): Promise<MessageContent> {
    const jsonContent = contentJson as MessageJsonContent;
    const organizationName = await this.organizationService.getOrganizationNameById(organizationId);

    const typeForContent =
      (messageType as unknown as string) === ChatMessageType.TEXT && jsonContent?.contents
        ? ChatMessageType.FLEX
        : messageType;

    const content = await this.setContent(jsonContent, typeForContent, organizationName);

    // Extract fields from content JSON if they're not in the message object directly
    const contentUrl = jsonContent.contentUrl || this.extractFlexActionUri(jsonContent) || null;

    let previewImageUrl = messagePreviewImageUrl || jsonContent.previewImageUrl || null;
    if (previewImageUrl && previewImageUrl.startsWith('gs://')) {
      try {
        this.logger.log(`Processing preview image URL: ${previewImageUrl}`);

        const uriMatch = previewImageUrl.match(uriRegex);
        if (uriMatch && uriMatch.groups) {
          this.logger.log('Matched GCS URI pattern, downloading from GCS...');
          try {
            const base64Image = await this.downloadFileAsBase64(previewImageUrl, organizationName);
            previewImageUrl = `data:image/${uriMatch.groups.extension || 'jpeg'};base64,${base64Image}`;
            this.logger.log('Successfully converted to base64');
          } catch (downloadError) {
            this.logger.error(`Failed to download from GCS: ${downloadError.message}`);
            throw downloadError;
          }
        } else {
          this.logger.warn(`URI pattern not matched, using generic approach: ${previewImageUrl}`);
          try {
            const { bucketName, filePath } = await this.parseGenericGcsUri(
              previewImageUrl,
              organizationName,
            );

            this.logger.log(
              `Attempting generic download - Bucket: ${bucketName}, Path: ${filePath}`,
            );

            const bucket = storage.bucket(bucketName);
            const file = bucket.file(filePath);

            const [metadata] = await file.getMetadata();
            const fileSize = parseInt(metadata.size as string, 10);
            if (fileSize > MAX_FILE_SIZE_BYTES) {
              throw new Error(`File is too large to process (size: ${fileSize} bytes)`);
            }

            const [buffer] = await file.download();
            const extension = filePath.split('.').pop() || 'jpeg';
            previewImageUrl = `data:image/${extension};base64,${buffer.toString('base64')}`;
            this.logger.log('Successfully converted to base64 using generic approach');
          } catch (genericError) {
            this.logger.error(`Failed generic GCS download: ${genericError.message}`);
            throw genericError;
          }
        }
      } catch (error) {
        this.logger.error(`Failed to process previewImageUrl: ${error.message}`);
        // Fall back to original content for images/videos
        if (typeForContent === ChatMessageType.IMAGE && content) {
          this.logger.log('Falling back to original content for preview');
          previewImageUrl = content;
        }
      }
    } else if (typeForContent === ChatMessageType.IMAGE && content) {
      previewImageUrl = content;
    }

    return {
      type: typeForContent as ChatMessageType,
      content,
      contentUrl,
      previewImageUrl,
    };
  }

  private sentMessageToLiglaFailure(chatId: string, messageId: string, senderId: string) {
    const payload: ChatMessageUpdatePayload = {
      chatId,
      messageId,
      isDelivered: false,
    };

    this.emitToStream(senderId, payload);
  }

  async notifyMessageSendFailure(
    chatId: string,
    messageId: string,
    organizationId: string,
  ): Promise<void> {
    try {
      const tenant = this.tenantSchema.getTables(organizationId);

      const message = await this.db
        .select({
          senderId: tenant.chatMessage.senderId,
          senderType: tenant.chatMessage.senderType,
        })
        .from(tenant.chatMessage)
        .where(and(eq(tenant.chatMessage.id, messageId), eq(tenant.chatMessage.chatId, chatId)))
        .then((rows) => rows[0] || null);

      if (!message?.senderId || message.senderType !== SenderType.OPERATOR) {
        return;
      }

      this.sentMessageToLiglaFailure(chatId, messageId, message.senderId);
    } catch (error) {
      this.logger.error('Failed to notify message send failure', {
        chatId,
        messageId,
        organizationId,
        error: error.message,
      });
    }
  }

  private async createStatusChangeActivity(
    tx: DrizzleTransaction,
    tenant: TenantTables,
    data: ChangeChatStatusType,
  ) {
    const { chatId, userId, oldStatus, newStatus, organizationId } = data;

    const actorUserName = await this.userService.findUserDisplayName(organizationId, userId);

    return this.createChatActivity(tx, tenant, {
      chatId,
      activityType: ActivityType.STATUS_CHANGE,
      actorId: userId,
      actorUserName,
      oldValues: {
        oldStatus,
      },
      newValues: {
        newStatus,
      },
    });
  }

  private async getMessageRecipients(
    chat: RawChat,
    organizationId: string,
    recipientsOptions?: RecipientsOptions,
  ): Promise<Set<string>> {
    const { excludeUserIds = [], includeUserIds = [] } = recipientsOptions || {};
    const recipientIds = new Set<string>();

    const updateRecipientIds = (userIds: string[], isAdding = true) => {
      userIds.forEach(isAdding ? recipientIds.add : recipientIds.delete, recipientIds);
    };

    if (!includeUserIds.length) {
      // NOTE: Adding admin and chat team user IDs by default
      const adminUserIds = await this.userService.findAllAdminUserIds(organizationId);
      const chatTeamUserIds = this.getChatTeamUserIds(chat);

      updateRecipientIds([...adminUserIds, ...chatTeamUserIds]);
    } else {
      updateRecipientIds(includeUserIds);
    }

    updateRecipientIds(excludeUserIds, false);

    return recipientIds;
  }

  private getChatTeamUserIds(chat: RawChat) {
    return chat.chatTeamAssignments.flatMap((chatTeam) =>
      chatTeam.team.userTeams.map((userTeam) => userTeam.userId),
    );
  }

  private async getSender(message: RawChatMessage, organizationId: string): Promise<Sender> {
    const { senderId, senderType } = message;

    if (senderType === SenderType.END_USER) {
      const endUser = await this.userService.findOneEndUser(senderId, organizationId);
      return {
        id: endUser.userId,
        displayName: endUser.displayName,
        pictureUrl: endUser.pictureUrl,
      };
    }

    if (senderType === SenderType.SYSTEM) {
      try {
        if (senderId.startsWith('S') && senderId.length === 33) {
          const orgUuidHex = senderId.substring(1);
          if (!/^[0-9a-f]{32}$/i.test(orgUuidHex)) {
            throw new Error('Invalid hex format in system sender ID');
          }

          return {
            id: senderId,
            displayName: 'Auto-Reply',
            pictureUrl: getDefaultPictureUrl(this.configService),
          };
        }
      } catch (error) {
        this.logger.error(`Failed to get sender for system message: ${error.message}`);
      }

      return {
        id: senderId,
        displayName: 'Auto-Reply',
        pictureUrl: getDefaultPictureUrl(this.configService),
      };
    }

    // Default case for OPERATOR
    const user = await this.userService.findOne(senderId, organizationId);
    return {
      id: user.id,
      displayName: user.senderName || user.displayName,
      pictureUrl: user.pictureUrl,
    };
  }

  private async getAttributeValues(chatId: string, tenant: TenantTables, organizationId: string) {
    return await this.encryption.txWithOrgKey(organizationId, async (tx) => {
      return await tx
        .select({
          ...getTableColumns(tenant.chatAttributeValue),
          value: this.encryption.decryptColumnStr(
            tenant.chatAttributeValue.value,
            tenant.chatAttributeValue.valueEncrypted,
            tenant.chatAttributeValue.isEncrypted,
          ),
          user: getTableColumns(tenant.user),
        })
        .from(tenant.chatAttributeValue)
        .innerJoin(tenant.user, eq(tenant.user.id, tenant.chatAttributeValue.userId))
        .where(eq(tenant.chatAttributeValue.chatId, chatId));
    });
  }

  private async getBatchAttributeValues(
    chatIds: string[],
    tenant: TenantTables,
    organizationId: string,
  ) {
    if (!chatIds.length) return new Map();

    const attributeValues = await this.encryption.txWithOrgKey(
      organizationId,
      async (tx) =>
        await tx
          .select({
            ...getTableColumns(tenant.chatAttributeValue),
            value: this.encryption.decryptColumnStr(
              tenant.chatAttributeValue.value,
              tenant.chatAttributeValue.valueEncrypted,
              tenant.chatAttributeValue.isEncrypted,
            ),
            user: getTableColumns(tenant.user),
          })
          .from(tenant.chatAttributeValue)
          .innerJoin(tenant.user, eq(tenant.user.id, tenant.chatAttributeValue.userId))
          .where(inArray(tenant.chatAttributeValue.chatId, chatIds)),
    );

    const grouped = new Map<string, typeof attributeValues>();
    attributeValues.forEach((attr) => {
      if (!grouped.has(attr.chatId)) grouped.set(attr.chatId, []);
      grouped.get(attr.chatId)!.push(attr);
    });

    return grouped;
  }

  private async getBatchSenders(messages: RawChatMessage[], tenant: TenantTables) {
    if (!messages.length) return new Map();

    const operatorIds = new Set<string>();
    const endUserIds = new Set<string>();
    const systemSenderIds = new Set<string>();

    messages.forEach((msg) => {
      if (msg.senderType === SenderType.OPERATOR) operatorIds.add(msg.senderId);
      else if (msg.senderType === SenderType.END_USER) endUserIds.add(msg.senderId);
      else if (msg.senderType === SenderType.SYSTEM) systemSenderIds.add(msg.senderId);
    });

    const [operators, endUsers] = await Promise.all([
      operatorIds.size > 0
        ? this.db
            .select({
              id: tenant.user.id,
              displayName: tenant.user.displayName,
              senderName: tenant.user.senderName,
              pictureUrl: tenant.user.pictureUrl,
            })
            .from(tenant.user)
            .where(inArray(tenant.user.id, Array.from(operatorIds)))
        : ([] as Pick<
            typeof tenant.user.$inferSelect,
            'id' | 'displayName' | 'senderName' | 'pictureUrl'
          >[]),
      endUserIds.size > 0
        ? this.db
            .select({
              userId: tenant.endUser.userId,
              displayName: tenant.endUser.displayName,
              pictureUrl: tenant.endUser.pictureUrl,
            })
            .from(tenant.endUser)
            .where(inArray(tenant.endUser.userId, Array.from(endUserIds)))
        : ([] as Pick<
            typeof tenant.endUser.$inferSelect,
            'userId' | 'displayName' | 'pictureUrl'
          >[]),
    ]);

    const senderMap = new Map<string, Sender>();

    operators.forEach((u) =>
      senderMap.set(u.id, {
        id: u.id,
        displayName: u.senderName || u.displayName,
        pictureUrl: u.pictureUrl,
      }),
    );

    endUsers.forEach((u) =>
      senderMap.set(u.userId, {
        id: u.userId,
        displayName: u.displayName,
        pictureUrl: u.pictureUrl,
      }),
    );

    // System senders
    systemSenderIds.forEach((id) =>
      senderMap.set(id, {
        id,
        displayName: 'Auto-Reply',
        pictureUrl: getDefaultPictureUrl(this.configService),
      }),
    );

    return senderMap;
  }

  private async getUserReadTimestamp(
    chatId: string,
    userId: string,
    tenant: TenantTables,
  ): Promise<Nullable<Date>> {
    const record = await this.db
      .select({ readTimestamp: tenant.chatUserRead.readTimestamp })
      .from(tenant.chatUserRead)
      .where(and(eq(tenant.chatUserRead.chatId, chatId), eq(tenant.chatUserRead.userId, userId)))
      .then((rows) => rows[0] || null);

    return this.normalizeTimestampValue(record?.readTimestamp);
  }

  private async getBatchUnreadCounts(
    entries: ReadonlyArray<UnreadEntry>,
    tenant: TenantTables,
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (!entries.length) return out;

    const chunks: UnreadEntry[][] = [];
    for (let i = 0; i < entries.length; i += UNREAD_BATCH_SIZE) {
      chunks.push(entries.slice(i, i + UNREAD_BATCH_SIZE) as UnreadEntry[]);
    }

    await mapWithConcurrency(chunks, CHAT_AGGREGATE_CONCURRENCY, async (chunk) => {
      const valuesList = sql.join(
        chunk.map(
          (e, i) =>
            sql`(${i}::int, ${e.chatId}::uuid, ${
              e.readTs ? sql`${e.readTs.toISOString()}::timestamptz` : sql`NULL::timestamptz`
            })`,
        ),
        sql`, `,
      );

      const rows = await this.db.execute(sql`
        WITH t(idx, chat_id, read_ts) AS (VALUES ${valuesList})
        SELECT t.idx AS idx, COALESCE(c.unread, 0) AS unread
        FROM t
        LEFT JOIN LATERAL (
          SELECT count(*)::int AS unread FROM (
            SELECT 1
            FROM ${tenant.chatMessage} cm
            WHERE cm."chatId" = t.chat_id
              AND cm."isDelivered" = true
              AND cm."senderType" = ${sql.raw(`'${SenderType.END_USER}'`)}
              AND cm."createdAt" > COALESCE(t.read_ts, '-infinity'::timestamptz)
            ORDER BY cm."createdAt" DESC
            LIMIT ${sql.raw(String(UNREAD_COUNT_CAP))}
          ) x
        ) c ON true
      `);

      for (const row of rows.rows as Array<{ idx: number | string; unread: number | string }>) {
        const entry = chunk[Number(row.idx)];
        if (entry) out.set(entry.key, Number(row.unread));
      }
    });

    return out;
  }

  private async countUnreadCapped(
    chatId: string,
    readTs: Nullable<Date>,
    tenant: TenantTables,
  ): Promise<number> {
    const tsClause = readTs
      ? sql`AND cm."createdAt" > ${readTs.toISOString()}::timestamptz`
      : sql`AND cm."createdAt" > '-infinity'::timestamptz`;
    const rows = await this.db.execute(sql`
      SELECT count(*)::int AS unread FROM (
        SELECT 1
        FROM ${tenant.chatMessage} cm
        WHERE cm."chatId" = ${chatId}::uuid
          AND cm."isDelivered" = true
          AND cm."senderType" = ${sql.raw(`'${SenderType.END_USER}'`)}
          ${tsClause}
        ORDER BY cm."createdAt" DESC
        LIMIT ${sql.raw(String(UNREAD_COUNT_CAP))}
      ) x
    `);
    const row = (rows.rows as Array<{ unread: number | string }>)[0];
    return row ? Number(row.unread) : 0;
  }

  private async getUserReadTimestamps(
    chatIds: string[],
    userId: string,
    tenant: TenantTables,
  ): Promise<Map<string, Date>> {
    if (!chatIds.length) return new Map();

    const records = await this.db
      .select({
        chatId: tenant.chatUserRead.chatId,
        readTimestamp: tenant.chatUserRead.readTimestamp,
      })
      .from(tenant.chatUserRead)
      .where(
        and(eq(tenant.chatUserRead.userId, userId), inArray(tenant.chatUserRead.chatId, chatIds)),
      );

    const map = new Map<string, Date>();
    records.forEach(({ chatId, readTimestamp }) => {
      const normalizedTimestamp = this.normalizeTimestampValue(readTimestamp);

      if (normalizedTimestamp) {
        map.set(chatId, normalizedTimestamp);
      }
    });

    return map;
  }

  async upsertChatUserRead(
    tx: DrizzleTransaction,
    tenant: TenantTables,
    params: { chatId: string; userId: string; readTimestamp: Date },
  ) {
    const { chatId, userId, readTimestamp } = params;

    await tx
      .insert(tenant.chatUserRead)
      .values({
        chatId,
        userId,
        readTimestamp,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [tenant.chatUserRead.chatId, tenant.chatUserRead.userId],
        set: {
          readTimestamp,
          updatedAt: new Date(),
        },
      });
  }

  private async aggregateChatMessage(
    message: RawChatMessage | undefined,
    organizationId: string,
    sender?: Sender,
  ): Promise<ChatMessage> {
    if (!message) {
      throw new NotFoundException(this.i18n.t('errors.chat.messageNotFound'));
    }

    const messageSender = sender ?? (await this.getSender(message, organizationId));
    const fallbackText = this.i18n.t('errors.chat.failedToRetrieveContent');

    let contentJson: MessageJsonContent;
    try {
      contentJson = this.parseMessageContent(message.content);
    } catch (error) {
      this.logger.warn('Failed to parse chat message content - using fallback', {
        organizationId,
        messageId: message.id,
        error: error instanceof Error ? error.message : String(error),
      });
      contentJson = { text: fallbackText };
    }

    // Extract fields from content JSON if they're not in the message object directly
    const jsonContent = contentJson as MessageJsonContent;
    const jsonRecord = jsonContent as JsonRecord;
    const messageId = typeof jsonRecord.id === 'string' ? jsonRecord.id : null;
    const isUnsent = jsonContent.unsent || false;
    const duration = jsonContent.duration || null;
    const latitude = jsonContent.latitude || null;
    const longitude = jsonContent.longitude || null;
    const quoteToken = jsonContent.quoteToken || null;
    const quotedMessageId = jsonContent.quotedMessageId || null;

    const aggregatedMessageContent = await this.aggregateMessageContent(
      contentJson,
      message.type,
      message.previewImageUrl,
      organizationId,
    );

    return {
      ...message,
      createdAt: normalizeDateTime(message.createdAt) ?? message.createdAt,
      ...aggregatedMessageContent,
      sender: messageSender,
      messageId,
      isUnsent,
      duration,
      latitude,
      longitude,
      quoteToken,
      quotedMessageId,
    };
  }

  private async setContent(
    content: MessageJsonContent,
    type: ChatMessageType,
    organizationName: string,
  ) {
    switch (type) {
      case ChatMessageType.TEXT:
        return content.text || '';
      case ChatMessageType.IMAGE:
        // Always use the original image URL (content.image or content.contentUrl), not the preview
        const imageUrl = content.image || content.contentUrl;
        if (!imageUrl) {
          this.logger.error('No image URL found');
          return '';
        }
        const uriMatch = imageUrl.match(uriRegex);
        if (uriMatch) {
          try {
            const base64Image = await this.downloadFileAsBase64(imageUrl, organizationName);
            return `data:image/${uriMatch.groups?.extension || '*'};base64, ${base64Image}`;
          } catch (error) {
            this.logger.error(`Failed to download file as base64 for: ${imageUrl}`, error);
            return '';
          }
        }
        return imageUrl;
      case ChatMessageType.VIDEO:
        return content.contentUrl || '';
      case ChatMessageType.AUDIO:
        return content.contentUrl || '';
      case ChatMessageType.FILE:
        return content.contentUrl || '';
      case ChatMessageType.LOCATION:
        return `${content.title || ''} (${content.latitude}, ${content.longitude})`;
      case ChatMessageType.STICKER:
        return content.text || `Sticker: ${content.stickerId}`;
      case ChatMessageType.FLEX:
        return content.altText || '[Flex message]';
      default:
        return '';
    }
  }

  private extractFlexActionUri(content: MessageJsonContent): string | undefined {
    const flex = content?.contents as any;
    const topUri = flex?.action?.uri;
    if (typeof topUri === 'string') return topUri;

    const bodyUri = flex?.body?.action?.uri;
    if (typeof bodyUri === 'string') return bodyUri;

    const bodyContents = flex?.body?.contents;
    if (Array.isArray(bodyContents)) {
      for (const item of bodyContents) {
        const uri = item?.action?.uri;
        if (typeof uri === 'string') return uri;
      }
    }

    return undefined;
  }

  private formatFlexMessageDate(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');

    return `${year}.${month}.${day}`;
  }

  private shareUploadFlexBubble(
    fileName: string,
    uploadUrl: string | undefined,
    heroImageUrl: string,
  ): Record<string, any> {
    return {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'horizontal',
        spacing: '12px',
        paddingAll: '12px',
        backgroundColor: '#DFF5EC',
        cornerRadius: '12px',
        ...(uploadUrl ? { action: { type: 'uri', uri: uploadUrl } } : {}),

        contents: [
          {
            type: 'box',
            layout: 'vertical',
            flex: 0,
            width: '56px',
            height: '56px',
            contents: [
              {
                type: 'image',
                url: heroImageUrl,
                size: 'full',
                aspectRatio: '1:1',
                aspectMode: 'fit',
              },
            ],
          },
          {
            type: 'box',
            layout: 'vertical',
            flex: 1,
            spacing: '4px',
            justifyContent: 'center',
            contents: [
              {
                type: 'text',
                text: fileName,
                weight: 'bold',
                color: '#0F2A0F',
                size: 'sm',
                wrap: false,
                maxLines: 1,
              },
            ],
          },
        ],
      },
    };
  }

  private fileUploadFlexBubble(
    fileName: string,
    uploadUrl: string | undefined,
    heroImageUrl: string,
    formattedDate: string,
    senderDisplayName: string,
  ): Record<string, any> {
    return {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'horizontal',
        spacing: '12px',
        paddingAll: '12px',
        backgroundColor: '#DFF5EC',
        cornerRadius: '12px',
        ...(uploadUrl ? { action: { type: 'uri', uri: uploadUrl } } : {}),
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            flex: 0,
            width: '56px',
            height: '56px',
            contents: [
              {
                type: 'image',
                url: heroImageUrl,
                size: 'full',
                aspectRatio: '1:1',
                aspectMode: 'fit',
              },
            ],
            cornerRadius: '8px',
          },
          {
            type: 'box',
            layout: 'vertical',
            flex: 1,
            spacing: '4px',
            contents: [
              {
                type: 'text',
                text: fileName,
                weight: 'bold',
                color: '#0F2A0F',
                size: 'sm',
                wrap: false,
                maxLines: 1,
              },
              {
                type: 'box',
                layout: 'horizontal',
                alignItems: 'center',
                spacing: '4px',
                contents: [
                  {
                    type: 'text',
                    text: formattedDate,
                    size: 'xs',
                    color: '#6A9A6A',
                    flex: 0,
                  },
                  ...(senderDisplayName
                    ? [
                        {
                          type: 'text',
                          text: senderDisplayName,
                          size: 'xs',
                          color: '#4A7A4A',
                          flex: 0,
                          wrap: false,
                          maxLines: 1,
                        },
                      ]
                    : []),
                ],
              },
            ],
          },
        ],
      },
    };
  }

  private validateGcsAccess(
    bucketName: string,
    organizationName: string,
    expectedOrganizationName: string,
  ) {
    const configuredBucketName = this.configService.get<string>('GCP_STORAGE_CHAT_DATA_BUCKET');
    if (configuredBucketName && bucketName !== configuredBucketName) {
      throw new ForbiddenException('Access to this bucket is not allowed');
    }

    if (organizationName !== expectedOrganizationName) {
      throw new ForbiddenException('Access to this organization resource is not allowed');
    }
  }

  private parseGcsUri(uri: string, expectedOrganizationName: string) {
    const match = uri.match(uriRegex);
    if (!match?.groups) {
      throw new BadRequestException('Invalid GCS URI format');
    }

    const {
      bucketName,
      organizationName,
      userId,
      imageSetId,
      index,
      messageId,
      timestamp,
      extension,
    } = match.groups;

    this.validateGcsAccess(bucketName, organizationName, expectedOrganizationName);

    let filePath;
    if (uri.includes('/previews/')) {
      if (imageSetId && index) {
        filePath = `${organizationName}/previews/${userId}/${imageSetId}/${index}-${messageId}-${timestamp}.${extension}`;
      } else {
        filePath = `${organizationName}/previews/${userId}/${messageId}-${timestamp}.${extension}`;
      }
    } else {
      if (imageSetId && index) {
        filePath = `${organizationName}/images/${userId}/${imageSetId}/${index}-${messageId}-${timestamp}.${extension}`;
      } else {
        filePath = `${organizationName}/images/${userId}/${messageId}-${timestamp}.${extension}`;
      }
    }

    return { bucketName, filePath };
  }

  private async parseGenericGcsUri(uri: string, expectedOrganizationName: string) {
    const parts = uri.replace('gs://', '').split('/');
    const [bucketName, organizationName, ...pathSegments] = parts;

    if (!bucketName || !organizationName || pathSegments.length === 0) {
      throw new BadRequestException('Invalid GCS URI format');
    }

    this.validateGcsAccess(bucketName, organizationName, expectedOrganizationName);

    return {
      bucketName: this.configService.get<string>('GCP_STORAGE_CHAT_DATA_BUCKET') || bucketName,
      filePath: [organizationName, ...pathSegments].join('/'),
    };
  }

  private async downloadFileAsBase64(gcsUri: string, organizationName: string): Promise<string> {
    try {
      const { bucketName, filePath } = this.parseGcsUri(gcsUri, organizationName);
      const bucket = storage.bucket(bucketName);
      const file = bucket.file(filePath);

      const [metadata] = await file.getMetadata();
      const fileSize = parseInt(metadata.size as string, 10);
      if (fileSize > MAX_FILE_SIZE_BYTES) {
        throw new Error(`File is too large to process (size: ${fileSize} bytes)`);
      }

      const [buffer] = await file.download();
      return buffer.toString('base64');
    } catch (error) {
      throw new Error(`Failed to download file from GCS: ${error.message}`);
    }
  }

  private async aggregateChatActivity(
    chatActivity: RawChatActivity | undefined,
  ): Promise<ChatActivity> {
    if (!chatActivity) {
      throw new NotFoundException(this.i18n.t('errors.chat.activityNotFound'));
    }

    const { oldTeamIds, newTeamIds, oldTeamNames, newTeamNames } = chatActivity;

    const teamDifferences = this.getTeamDifferences({
      oldTeamIds,
      newTeamIds,
      oldTeamNames,
      newTeamNames,
    });

    const {
      teamId: changedTeamId = null,
      teamName: changedTeamName = null,
      action: teamAssignAction = null,
    } = teamDifferences ? teamDifferences[0] : {};

    return {
      ...chatActivity,
      createdAt: normalizeDateTime(chatActivity.createdAt) ?? chatActivity.createdAt,
      changedTeamId,
      changedTeamName,
      teamAssignAction,
    };
  }

  private getTeamDifferences(data: OldNewTeamType) {
    const oldTeamIds = convertCsvStringToArray(data.oldTeamIds);
    const oldTeamNames = convertCsvStringToArray(data.oldTeamNames);
    const newTeamIds = convertCsvStringToArray(data.newTeamIds);
    const newTeamNames = convertCsvStringToArray(data.newTeamNames);

    if (oldTeamIds.length !== oldTeamNames.length || newTeamIds.length !== newTeamNames.length) {
      throw new ForbiddenException(this.i18n.t('errors.activity.teamMismatch'));
    }

    const oldTeams = oldTeamIds.map((id, index) => ({ teamId: id, teamName: oldTeamNames[index] }));
    const newTeams = newTeamIds.map((id, index) => ({ teamId: id, teamName: newTeamNames[index] }));

    const oldTeamsSet = new Set(oldTeamIds);
    const newTeamsSet = new Set(newTeamIds);

    const addedTeams = newTeams.filter((team) => !oldTeamsSet.has(team.teamId));
    const removedTeams = oldTeams.filter((team) => !newTeamsSet.has(team.teamId));

    const result = [
      ...addedTeams.map((team) => ({ ...team, action: ChatTeamAssignActionsType.ADDED })),
      ...removedTeams.map((team) => ({ ...team, action: ChatTeamAssignActionsType.REMOVED })),
    ];

    return result.length > 0 ? result : null;
  }

  private async aggregateChat(
    chat: RawChat | undefined,
    organizationId: string,
    preloaded?: {
      currentUserId?: string;
      userReadTimestamp?: Nullable<Date>;
      attributes?: any[];
      senderMap?: Map<string, Sender>;
      unreadCount?: number;
      effectiveReadTimestamp?: Nullable<Date>;
    },
  ): Promise<Chat> {
    const tenant = this.tenantSchema.getTables(organizationId);
    if (!chat) {
      throw new NotFoundException(this.i18n.t('errors.chat.notFound'));
    }

    const { currentUserId, userReadTimestamp, attributes } = preloaded || {};

    const {
      user,
      chatTags: rawChatTags = [],
      endUser,
      clientUserId,
      chatTeamAssignments,
      chatMessages: rawChatMessages = [],
      chatActivities: rawChatActivities = [],
    } = chat;

    const chatUserReads = (chat.chatUserReads ?? []).map((read) => ({
      ...read,
      readTimestamp: normalizeDateTime(read.readTimestamp) ?? read.readTimestamp,
    }));
    const fallbackReadTimestamp = this.normalizeTimestampValue(chat.latestReadTimestamp);

    const effectiveReadTimestamp =
      preloaded?.effectiveReadTimestamp !== undefined
        ? preloaded.effectiveReadTimestamp
        : await resolveEffectiveReadTimestamp({
            chatId: chat.id,
            chatUserReads,
            currentUserId,
            userReadTimestamp,
            fallbackReadTimestamp,
            fetchUserReadTimestamp: (targetChatId, targetUserId) =>
              this.getUserReadTimestamp(targetChatId, targetUserId, tenant),
          });

    const assignedUser = user
      ? {
          ...user,
          createdAt: normalizeDateTime(user.createdAt) ?? user.createdAt,
          updatedAt: normalizeDateTime(user.updatedAt) ?? user.updatedAt,
          auth: {
            createdAt: normalizeDateTime(user.auth.createdAt) ?? user.auth.createdAt,
            updatedAt: normalizeDateTime(user.auth.updatedAt) ?? user.auth.updatedAt,
            mailSentAt: normalizeDateTime(user.auth.mailSentAt) ?? user.auth.mailSentAt,
          },
          email: user.auth.email,
          status: user.auth.status,
          teams: user.userTeams.map(({ team }) => ({
            ...team,
            createdAt: normalizeDateTime(team.createdAt) ?? team.createdAt,
            updatedAt: normalizeDateTime(team.updatedAt) ?? team.updatedAt,
          })),
          systemUserType: SystemUserType.USER,
        }
      : null;

    const unreadCountPromise =
      preloaded?.unreadCount !== undefined
        ? Promise.resolve([{ count: preloaded.unreadCount }])
        : this.countUnreadCapped(chat.id, effectiveReadTimestamp, tenant).then((c) => [
            { count: c },
          ]);

    const attributesPromise = attributes
      ? Promise.resolve(attributes)
      : this.getAttributeValues(chat.id, tenant, organizationId);

    const [chatMessages, chatActivities, unreadCountResult, chatAttributeValues] =
      await Promise.all([
        Promise.all(
          rawChatMessages.map((message) =>
            this.aggregateChatMessage(
              message,
              organizationId,
              preloaded?.senderMap?.get(message.senderId),
            ),
          ),
        ),
        Promise.all(rawChatActivities.map((activity) => this.aggregateChatActivity(activity))),
        unreadCountPromise,
        attributesPromise,
      ]);

    const isAssigned = Boolean(chat.assignedUserId);
    const suppressUnread =
      isAssigned && currentUserId !== undefined && currentUserId !== chat.assignedUserId;
    const chatUnreadCount =
      chat.chatStatus === ChatStatus.DONE
        ? 0
        : suppressUnread
          ? 0
          : (unreadCountResult[0]?.count ?? 0);

    const chatTags = rawChatTags.map((chatTag) => ({
      ...chatTag,
      createdAt: normalizeDateTime(chatTag.createdAt) ?? chatTag.createdAt,
      tag: {
        ...chatTag.tag,
        createdAt: normalizeDateTime(chatTag.tag.createdAt) ?? chatTag.tag.createdAt,
        updatedAt: normalizeDateTime(chatTag.tag.updatedAt) ?? chatTag.tag.updatedAt,
      },
    }));

    const normalizedChatTeamAssignments = chatTeamAssignments?.map((assignment) => ({
      ...assignment,
      createdAt: normalizeDateTime(assignment.createdAt) ?? assignment.createdAt,
      team: {
        ...assignment.team,
        createdAt: normalizeDateTime(assignment.team.createdAt) ?? assignment.team.createdAt,
        updatedAt: normalizeDateTime(assignment.team.updatedAt) ?? assignment.team.updatedAt,
        userTeams: assignment.team.userTeams?.map((userTeam) => ({
          ...userTeam,
          createdAt: normalizeDateTime(userTeam.createdAt) ?? userTeam.createdAt,
        })),
      },
    }));

    return {
      id: chat.id,
      chatStatus: chat.chatStatus,
      endUserId: chat.endUserId,
      assignedUserId: chat.assignedUserId,
      assignedUser,
      latestMessageTimestamp: chat.latestMessageTimestamp,
      latestReadTimestamp: effectiveReadTimestamp,
      createdAt: chat.createdAt,
      chatMessages,
      chatActivities,
      chatUnreadCount,
      chatTags,
      chatTeamAssignment: normalizedChatTeamAssignments,
      chatAttributeValues,
      sessionActive: chat.sessionActive,
      isUserBlocked: chat.isUserBlocked,
      endUser: {
        ...endUser,
        createdAt: normalizeDateTime(endUser.createdAt) ?? endUser.createdAt,
        updatedAt: normalizeDateTime(endUser.updatedAt) ?? endUser.updatedAt,
        clientUserId,
      },
    };
  }

  private async buildWhereClause(
    { teamIds, userIds, statuses, tagIds, includeUnassigned }: ChatQueryParams,
    tenant: TenantTables,
    userId?: string,
    role?: string,
  ): Promise<SQL | undefined> {
    const whereClause: (SQL | undefined)[] = [];

    const teamCondition = await this.buildTeamConditions(tenant, teamIds, userId, role);

    if (teamCondition) {
      whereClause.push(teamCondition);
    }

    if (statuses?.length) {
      whereClause.push(inArray(tenant.chat.chatStatus, statuses));
    }

    if (tagIds?.length) {
      whereClause.push(
        exists(
          this.db
            .select()
            .from(tenant.chatTags)
            .where(
              and(
                eq(tenant.chatTags.chatId, tenant.chat.id),
                inArray(tenant.chatTags.tagId, tagIds),
              ),
            ),
        ),
      );
    }

    if (includeUnassigned) {
      if (userIds?.length) {
        whereClause.push(
          or(inArray(tenant.chat.assignedUserId, userIds), isNull(tenant.chat.assignedUserId)),
        );
      } else {
        whereClause.push(isNull(tenant.chat.assignedUserId));
      }
    } else {
      if (userIds?.length) {
        whereClause.push(inArray(tenant.chat.assignedUserId, userIds));
      }
    }

    return and(...whereClause);
  }

  private async buildTeamConditions(
    tenant: TenantTables,
    teamIds?: string[],
    userId?: string,
    role?: string,
  ): Promise<SQL | undefined> {
    if (!teamIds?.length) return;

    const isOperator = role ? operatorRoles.includes(role) : false;

    if (!isOperator) {
      return exists(
        this.db
          .select()
          .from(tenant.chatTeamAssignment)
          .where(
            and(
              eq(tenant.chatTeamAssignment.chatId, tenant.chat.id),
              inArray(tenant.chatTeamAssignment.teamId, teamIds),
            ),
          ),
      );
    }

    const teamSettings = await this.db
      .select({
        ...getTableColumns(tenant.teamSetting),
        teamChatSetting: getTableColumns(tenant.teamChatSetting),
      })
      .from(tenant.teamSetting)
      .innerJoin(
        tenant.teamChatSetting,
        eq(tenant.teamChatSetting.teamSettingId, tenant.teamSetting.id),
      )
      .where(inArray(tenant.teamSetting.teamId, teamIds));

    const teamConditions = teamIds.map((teamId) => {
      const teamSetting = teamSettings.find((ts) => ts.teamId === teamId);

      const viewAllChatsEnabled = teamSetting?.teamChatSetting?.viewAllChatsEnabled ?? true;

      const conditions: (SQL | undefined)[] = [
        exists(
          this.db
            .select()
            .from(tenant.chatTeamAssignment)
            .where(
              and(
                eq(tenant.chatTeamAssignment.chatId, tenant.chat.id),
                eq(tenant.chatTeamAssignment.teamId, teamId),
              ),
            ),
        ),
      ];

      if (!viewAllChatsEnabled) {
        conditions.push(
          or(eq(tenant.chat.assignedUserId, userId!), isNull(tenant.chat.assignedUserId)),
        );
      }

      return and(...conditions);
    });

    return or(...teamConditions);
  }

  private async emitToStream(userId: string, payload: Chat | ChatMessageUpdatePayload) {
    const userStreams = this.chatStreams.get(userId);
    if (userStreams) {
      this.logger.log(`Emitting to ${userId} streams (count: ${userStreams.size})`);
      userStreams.forEach((stream) => stream.next({ data: payload }));
    } else {
      this.logger.warn(`No streams found for user ${userId}`);
    }
  }

  private async ensureTagIsAssigned(chatId: string, tagId: string, tenant: TenantTables) {
    const chatTag = await this.db
      .select()
      .from(tenant.chatTags)
      .where(and(eq(tenant.chatTags.chatId, chatId), eq(tenant.chatTags.tagId, tagId)))
      .then((rows) => rows[0] || null);

    if (!chatTag) {
      throw new NotFoundException(this.i18n.t('errors.chat.tagNotFound'));
    }

    return chatTag;
  }

  private async buildNotificationPayload(chat: RawChat) {
    const opts = { lang: 'ja' };
    const displayName = chat.endUser.displayName || this.i18n.t('toasts.anonymous', opts);

    const chatMessages = chat.chatMessages ?? [];
    const chatActivities = chat.chatActivities ?? [];

    const latestMessage = chatMessages[0];
    const latestActivity = chatActivities[0];

    if (!latestMessage && !latestActivity) return null;

    const latestMessageCreatedAt = latestMessage
      ? (normalizeDateTime(latestMessage.createdAt) ??
        (latestMessage.createdAt instanceof Date ? latestMessage.createdAt : null))
      : null;
    const latestActivityCreatedAt = latestActivity
      ? (normalizeDateTime(latestActivity.createdAt) ??
        (latestActivity.createdAt instanceof Date ? latestActivity.createdAt : null))
      : null;

    const isMessageEvent = Boolean(
      latestMessage &&
      (!latestActivity ||
        (latestMessageCreatedAt &&
          (!latestActivityCreatedAt ||
            latestMessageCreatedAt.getTime() > latestActivityCreatedAt.getTime()))),
    );

    if (isMessageEvent && latestMessage.senderType !== SenderType.END_USER) {
      return null;
    }

    const getBodyText = async () => {
      if (isMessageEvent) {
        if (latestMessage.type === ChatMessageType.TEXT) {
          try {
            const content = this.parseMessageContent(latestMessage.content);
            return content.text || this.i18n.t('toasts.chat.sentMessage', opts);
          } catch (error) {
            this.logger.warn({
              message: 'Failed to parse notification message content',
              chatId: chat.id,
              messageId: latestMessage.id,
              error,
            });
            return this.i18n.t('toasts.chat.sentMessage', opts);
          }
        }
        return this.i18n.t('toasts.chat.sentMedia', opts);
      }

      switch (latestActivity.activityType) {
        case ActivityType.STATUS_CHANGE:
          return latestActivity.actorType === ChatActivityActorType.SYSTEM
            ? this.i18n.t('toasts.chat.startedChat', opts)
            : this.i18n.t('toasts.chat.changedStatus', {
                ...opts,
                args: {
                  actor: latestActivity.actorUserName || this.i18n.t('toasts.anonymous', opts),
                  newStatus: this.getLocalizedChatStatus(latestActivity.newStatus, opts),
                },
              });

        case ActivityType.END_SESSION:
          return this.i18n.t('toasts.chat.endedChat', opts);

        default:
          return null;
      }
    };

    const bodyText = await getBodyText();
    if (!bodyText) return null;

    return {
      title: 'Liglaチャット',
      body: `${displayName}: ${bodyText}`,
      data: { url: `?id=${chat.id}` },
    };
  }

  private getLocalizedChatStatus(status: Nullable<ChatStatus>, opts: { lang: string }) {
    switch (status) {
      case ChatStatus.PENDING:
        return this.i18n.t('toasts.chat.status.pending', opts);
      case ChatStatus.ADDRESSING:
        return this.i18n.t('toasts.chat.status.addressing', opts);
      case ChatStatus.DONE:
        return this.i18n.t('toasts.chat.status.done', opts);
      default:
        return status ?? '';
    }
  }

  private async handleNotificationSend(
    chat: RawChat,
    recipientUserIds: Set<string>,
    organizationId: string,
    notificationPayload: any,
  ) {
    // TODO: implement locale for notifications
    try {
      if (chat.assignedUserId) {
        await this.notificationService.sendNotification(
          chat.assignedUserId,
          organizationId,
          notificationPayload,
        );
        return;
      }
      await this.notificationService.sendNotificationToSubscribedUsers(
        Array.from(recipientUserIds),
        notificationPayload,
        organizationId,
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.logger.debug({
          message: 'No notification subscriptions for recipients',
          chatId: chat.id,
          recipientUserIds: Array.from(recipientUserIds),
        });
        return;
      }

      this.logger.error({
        message: 'Failed to send notification',
        chatId: chat.id,
        error,
      });
    }
  }

  private parseMessageContent(content: Buffer | string): MessageJsonContent {
    const contentStr = Buffer.isBuffer(content) ? content.toString('utf8') : content;
    const parsed = JSON.parse(contentStr);

    if (typeof parsed !== 'object' || parsed === null) {
      throw new InternalServerErrorException(
        `parseMessageContent: decoded value is not an object (typeof=${typeof parsed})`,
      );
    }

    return parsed as MessageJsonContent;
  }

  /**
   * Generate systematic SYSTEM sender ID using S + organization UUID format
   * Format: S{32_hex_chars} for consistency with END_USER pattern
   */
  generateSystemSenderId(organizationId: string): string {
    return `S${organizationId.replace(/-/g, '')}`;
  }

  private normalizeTimestampValue(value: Date | string | null | undefined): Nullable<Date> {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return value;
    }

    const parsedTimestamp = new Date(value);

    if (Number.isNaN(parsedTimestamp.getTime())) {
      return null;
    }

    return parsedTimestamp;
  }

  /**
   * @deprecated Fetching a chat with the latest message can cause race conditions with database inserts. Use queryChatWithMessageId instead.
   */
  // TODO: Refine queryChatWithMessageId and replace usage of queryChatWithLatestMessage with it
  private queryChatWithLatestMessage(
    db: DrizzleDB | DrizzleTransaction,
    tenant: TenantTables,
    senderId?: string,
  ) {
    const chat = tenant.chat;
    const chatIdRef = sql`${tenant.chat.id}`;
    const chatAssignedUserIdRef = sql`${tenant.chat.assignedUserId}`;
    const chatEndUserIdRef = sql`${tenant.chat.endUserId}`;

    const teamWithUserTeams = {
      ...getTableColumns(tenant.team),
      userTeams: sql<TenantTables['userTeam']['$inferSelect'][]>`(
        SELECT COALESCE(
          json_agg(${buildJsonObject(getTableColumns(tenant.userTeam))}),
          '[]'::json
        )
        FROM ${tenant.userTeam}
        WHERE ${tenant.userTeam.teamId} = ${tenant.team.id}
      )`,
    };

    const chatTeamAssignmentWithTeam = {
      ...getTableColumns(tenant.chatTeamAssignment),
      team: sql<RawChat['chatTeamAssignments'][number]['team']>`(
        SELECT ${buildJsonObject(teamWithUserTeams)}
        FROM ${tenant.team}
        WHERE ${tenant.team.id} = ${tenant.chatTeamAssignment.teamId}
      )`,
    };

    const userTeamWithTeam = {
      ...getTableColumns(tenant.userTeam),
      team: sql<TenantTables['team']['$inferSelect']>`(
        SELECT ${buildJsonObject(getTableColumns(tenant.team))}
        FROM ${tenant.team}
        WHERE ${tenant.team.id} = ${tenant.userTeam.teamId}
      )`,
    };

    const userWithTeamsAndAuth = {
      ...getTableColumns(tenant.user),
      auth: sql<typeof shared.auth.$inferSelect>`(
        SELECT ${buildJsonObject(authColumns)}
        FROM ${shared.auth}
        WHERE ${shared.auth.id} = ${tenant.user.id}
      )`,
      userTeams: sql`(
        SELECT COALESCE(
          json_agg(${buildJsonObject(userTeamWithTeam)}),
          '[]'::json
        )
        FROM ${tenant.userTeam}
        WHERE ${tenant.userTeam.userId} = ${tenant.user.id}
      )`,
    };

    // chatTags -> tag
    const chatTagWithTag = {
      ...getTableColumns(tenant.chatTags),
      tag: sql<TenantTables['tags']['$inferSelect']>`(
        SELECT ${buildJsonObject(getTableColumns(tenant.tags))}
        FROM ${tenant.tags}
        WHERE ${tenant.tags.id} = ${tenant.chatTags.tagId}
      )`,
    };

    // Message filter conditions (matches buildChatWithClause logic)
    const messageConditions = senderId
      ? sql`(
          ${tenant.chatMessage.isDelivered} = true
          OR (${tenant.chatMessage.senderId} = ${senderId} AND ${tenant.chatMessage.isDelivered} = false)
        )`
      : sql`${tenant.chatMessage.isDelivered} = true`;

    return db
      .select({
        ...getTableColumns(chat),

        chatTeamAssignments: sql<RawChat['chatTeamAssignments']>`(
          SELECT COALESCE(
            json_agg(${buildJsonObject(chatTeamAssignmentWithTeam)}),
            '[]'::json
          )
          FROM ${tenant.chatTeamAssignment}
          WHERE ${tenant.chatTeamAssignment.chatId} = ${chatIdRef}
        )`.as('chatTeamAssignments'),

        user: sql<RawChat['user']>`(
          CASE
            WHEN ${chatAssignedUserIdRef} IS NULL THEN NULL
            ELSE (
              SELECT ${buildJsonObject(userWithTeamsAndAuth)}
              FROM ${tenant.user}
              WHERE ${tenant.user.id} = ${chatAssignedUserIdRef}
            )
          END
        )`.as('user'),

        endUser: sql<RawChat['endUser']>`(
          SELECT ${buildJsonObject(getTableColumns(tenant.endUser))}
          FROM ${tenant.endUser}
          WHERE ${tenant.endUser.userId} = ${chatEndUserIdRef}
        )`.as('endUser'),

        chatMessages: sql<RawChat['chatMessages']>`(
          SELECT COALESCE(
            json_agg(message_row),
            '[]'::json
          )
          FROM (
            SELECT ${buildJsonObject({
              ...getTableColumns(tenant.chatMessage),
              content: this.encryption.decryptColumnStr(
                tenant.chatMessage.content,
                tenant.chatMessage.contentEncrypted,
                tenant.chatMessage.isEncrypted,
              ),
            })} AS message_row
            FROM ${tenant.chatMessage}
            WHERE ${tenant.chatMessage.chatId} = ${chatIdRef}
              AND ${messageConditions}
            ORDER BY ${tenant.chatMessage.createdAt} DESC, ${tenant.chatMessage.id} DESC
            LIMIT ${CHAT_QUERY_CONFIG.MESSAGE_LIMIT}
          ) messages
        )`.as('chatMessages'),

        chatTags: sql<RawChat['chatTags']>`(
          SELECT COALESCE(
            json_agg(tag_row),
            '[]'::json
          )
          FROM (
            SELECT ${buildJsonObject(chatTagWithTag)} AS tag_row
            FROM ${tenant.chatTags}
            WHERE ${tenant.chatTags.chatId} = ${chatIdRef}
            ORDER BY ${tenant.chatTags.createdAt} DESC
          ) tags
        )`.as('chatTags'),

        chatActivities: sql<RawChat['chatActivities']>`(
          SELECT COALESCE(
            json_agg(activity_row),
            '[]'::json
          )
          FROM (
            SELECT ${buildJsonObject(getTableColumns(tenant.chatActivity))} AS activity_row
            FROM ${tenant.chatActivity}
            WHERE ${tenant.chatActivity.chatId} = ${chatIdRef}
            ORDER BY ${tenant.chatActivity.createdAt} DESC, ${tenant.chatActivity.id} DESC
            LIMIT ${CHAT_QUERY_CONFIG.MESSAGE_LIMIT}
          ) activities
        )`.as('chatActivities'),

        chatUserReads: sql<NonNullable<RawChat['chatUserReads']>>`(
          SELECT COALESCE(
            json_agg(${buildJsonObject(getTableColumns(tenant.chatUserRead))}),
            '[]'::json
          )
          FROM ${tenant.chatUserRead}
          WHERE ${tenant.chatUserRead.chatId} = ${chatIdRef}
        )`.as('chatUserReads'),
      })
      .from(chat)
      .$dynamic();
  }

  private queryChatWithMessageId({
    db,
    tenant,
    chatMessageId,
  }: {
    db: DrizzleDB | DrizzleTransaction;
    tenant: TenantTables;
    chatMessageId: ChatMessage['id'];
  }) {
    const chat = tenant.chat;
    const chatIdRef = sql`${tenant.chat.id}`;
    const chatAssignedUserIdRef = sql`${tenant.chat.assignedUserId}`;
    const chatEndUserIdRef = sql`${tenant.chat.endUserId}`;

    const teamWithUserTeams = {
      ...getTableColumns(tenant.team),
      userTeams: sql<TenantTables['userTeam']['$inferSelect'][]>`(
        SELECT COALESCE(
          json_agg(${buildJsonObject(getTableColumns(tenant.userTeam))}),
          '[]'::json
        )
        FROM ${tenant.userTeam}
        WHERE ${tenant.userTeam.teamId} = ${tenant.team.id}
      )`,
    };

    const chatTeamAssignmentWithTeam = {
      ...getTableColumns(tenant.chatTeamAssignment),
      team: sql<RawChat['chatTeamAssignments'][number]['team']>`(
        SELECT ${buildJsonObject(teamWithUserTeams)}
        FROM ${tenant.team}
        WHERE ${tenant.team.id} = ${tenant.chatTeamAssignment.teamId}
      )`,
    };

    const userTeamWithTeam = {
      ...getTableColumns(tenant.userTeam),
      team: sql<TenantTables['team']['$inferSelect']>`(
        SELECT ${buildJsonObject(getTableColumns(tenant.team))}
        FROM ${tenant.team}
        WHERE ${tenant.team.id} = ${tenant.userTeam.teamId}
      )`,
    };

    const userWithTeamsAndAuth = {
      ...getTableColumns(tenant.user),
      auth: sql<typeof shared.auth.$inferSelect>`(
        SELECT ${buildJsonObject(authColumns)}
        FROM ${shared.auth}
        WHERE ${shared.auth.id} = ${tenant.user.id}
      )`,
      userTeams: sql`(
        SELECT COALESCE(
          json_agg(${buildJsonObject(userTeamWithTeam)}),
          '[]'::json
        )
        FROM ${tenant.userTeam}
        WHERE ${tenant.userTeam.userId} = ${tenant.user.id}
      )`,
    };

    // chatTags -> tag
    const chatTagWithTag = {
      ...getTableColumns(tenant.chatTags),
      tag: sql<TenantTables['tags']['$inferSelect']>`(
        SELECT ${buildJsonObject(getTableColumns(tenant.tags))}
        FROM ${tenant.tags}
        WHERE ${tenant.tags.id} = ${tenant.chatTags.tagId}
      )`,
    };

    // Message filter conditions (matches buildChatWithClause logic)
    const messageConditions = sql`${tenant.chatMessage.isDelivered} = true`;

    return db
      .select({
        ...getTableColumns(chat),

        chatTeamAssignments: sql<RawChat['chatTeamAssignments']>`(
          SELECT COALESCE(
            json_agg(${buildJsonObject(chatTeamAssignmentWithTeam)}),
            '[]'::json
          )
          FROM ${tenant.chatTeamAssignment}
          WHERE ${tenant.chatTeamAssignment.chatId} = ${chatIdRef}
        )`.as('chatTeamAssignments'),

        user: sql<RawChat['user']>`(
          CASE
            WHEN ${chatAssignedUserIdRef} IS NULL THEN NULL
            ELSE (
              SELECT ${buildJsonObject(userWithTeamsAndAuth)}
              FROM ${tenant.user}
              WHERE ${tenant.user.id} = ${chatAssignedUserIdRef}
            )
          END
        )`.as('user'),

        endUser: sql<RawChat['endUser']>`(
          SELECT ${buildJsonObject(getTableColumns(tenant.endUser))}
          FROM ${tenant.endUser}
          WHERE ${tenant.endUser.userId} = ${chatEndUserIdRef}
        )`.as('endUser'),

        chatMessages: sql<RawChat['chatMessages']>`(
          SELECT COALESCE(
            json_agg(message_row),
            '[]'::json
          )
          FROM (
            SELECT ${buildJsonObject({
              ...getTableColumns(tenant.chatMessage),
              content: this.encryption.decryptColumnStr(
                tenant.chatMessage.content,
                tenant.chatMessage.contentEncrypted,
                tenant.chatMessage.isEncrypted,
              ),
            })} AS message_row
            FROM ${tenant.chatMessage}
            WHERE ${tenant.chatMessage.chatId} = ${chatIdRef}
              AND ${messageConditions}
              AND ${tenant.chatMessage.id} = ${chatMessageId}
            ORDER BY ${tenant.chatMessage.createdAt} DESC, ${tenant.chatMessage.id} DESC
            LIMIT ${CHAT_QUERY_CONFIG.MESSAGE_LIMIT}
          ) messages
        )`.as('chatMessages'),

        chatTags: sql<RawChat['chatTags']>`(
          SELECT COALESCE(
            json_agg(tag_row),
            '[]'::json
          )
          FROM (
            SELECT ${buildJsonObject(chatTagWithTag)} AS tag_row
            FROM ${tenant.chatTags}
            WHERE ${tenant.chatTags.chatId} = ${chatIdRef}
            ORDER BY ${tenant.chatTags.createdAt} DESC
          ) tags
        )`.as('chatTags'),

        chatActivities: sql<RawChat['chatActivities']>`(
          SELECT COALESCE(
            json_agg(activity_row),
            '[]'::json
          )
          FROM (
            SELECT ${buildJsonObject(getTableColumns(tenant.chatActivity))} AS activity_row
            FROM ${tenant.chatActivity}
            WHERE ${tenant.chatActivity.chatId} = ${chatIdRef}
            ORDER BY ${tenant.chatActivity.createdAt} DESC, ${tenant.chatActivity.id} DESC
            LIMIT ${CHAT_QUERY_CONFIG.MESSAGE_LIMIT}
          ) activities
        )`.as('chatActivities'),

        chatUserReads: sql<NonNullable<RawChat['chatUserReads']>>`(
          SELECT COALESCE(
            json_agg(${buildJsonObject(getTableColumns(tenant.chatUserRead))}),
            '[]'::json
          )
          FROM ${tenant.chatUserRead}
          WHERE ${tenant.chatUserRead.chatId} = ${chatIdRef}
        )`.as('chatUserReads'),
      })
      .from(chat)
      .$dynamic();
  }
}
