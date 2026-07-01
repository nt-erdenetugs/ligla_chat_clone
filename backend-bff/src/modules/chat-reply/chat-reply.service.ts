import { Injectable, NotFoundException, Logger } from '@nestjs/common';

import { eq, and, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

import { OrganizationSettingsType } from '@/common/constants';
import { DrizzleDB, DrizzleTransaction, InjectDrizzle, TenantSchemaService } from '@/drizzle';
import { ChatService } from '@/modules/chat/chat.service';
import { TenantTables } from '@@/drizzle/tenant/schema';

import { ChatMessageType } from '../chat/enums';

import { CreateChatReplySettingInput, UpdateChatReplySettingInput } from './dto/chat-reply.input';
import { ChatReplySetting } from './entities/chat-reply.entity';
import { ChatReplyScheduleType } from './enums';

interface ChatReplySettingsJSON {
  isActive: boolean;
  updatedBy: string | null;
  schedules: Array<{
    scheduleType: ChatReplyScheduleType;
    timeRanges: Array<{
      startTime: string;
      endTime: string;
      timeRangeType: string;
    }>;
    customDates?: string[];
  }>;
  messages: Array<{
    timeRangeType: string;
    templateId: string;
  }>;
}

@Injectable()
export class ChatReplyService {
  private readonly logger = new Logger(ChatReplyService.name);

  constructor(
    private readonly chatService: ChatService,
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly tenantSchema: TenantSchemaService,
  ) {}

  async create(input: CreateChatReplySettingInput, userId: string, organizationId: string) {
    const tenant = this.tenantSchema.getTables(organizationId);

    try {
      await this.db.transaction(async (tx) => {
        const messageTemplates = await this.createMessageTemplates(tx, tenant, input.messages);

        const jsonSettings: ChatReplySettingsJSON = {
          isActive: input.isActive,
          updatedBy: userId,
          schedules: input.schedules.map((s) => ({
            scheduleType: s.scheduleType,
            timeRanges: s.timeRanges.map((t) => ({
              startTime: t.startTime,
              endTime: t.endTime,
              timeRangeType: t.timeRangeType,
            })),
            customDates: s.customDates?.map((d) => d.toISOString()) || [],
          })),
          messages: messageTemplates.map((template, idx) => ({
            timeRangeType: input.messages[idx].timeRangeType,
            templateId: template.id,
          })),
        };

        await tx.insert(tenant.organizationSettings).values({
          type: OrganizationSettingsType.CHAT_REPLY,
          chatReplySettings: jsonSettings,
          createdAt: new Date(),
        });
      });

      return this.findOneByOrganizationId(organizationId);
    } catch (error) {
      this.logger.error(
        `Failed to create Chat Reply Setting for organization: ${organizationId}`,
        error,
      );
      throw new Error(`Failed to create Chat Reply Setting for organization: ${organizationId}`);
    }
  }

  async update(input: UpdateChatReplySettingInput, userId: string, organizationId: string) {
    const tenant = this.tenantSchema.getTables(organizationId);

    try {
      await this.db.transaction(async (tx) => {
        const existing = await tx
          .select()
          .from(tenant.organizationSettings)
          .where(and(eq(tenant.organizationSettings.type, OrganizationSettingsType.CHAT_REPLY)))
          .then((rows) => rows[0] || null);

        if (!existing) {
          throw new NotFoundException(
            `Chat Reply Setting not found for organization: ${organizationId}`,
          );
        }

        const oldSettings = existing.chatReplySettings as ChatReplySettingsJSON;
        const oldTemplateIds = oldSettings.messages?.map((m) => m.templateId) || [];

        if (oldTemplateIds.length > 0) {
          await tx
            .delete(tenant.chatReplyMessageTemplate)
            .where(inArray(tenant.chatReplyMessageTemplate.id, oldTemplateIds));
        }

        const messageTemplates = await this.createMessageTemplates(tx, tenant, input.messages);

        const jsonSettings: ChatReplySettingsJSON = {
          isActive: input.isActive,
          updatedBy: userId,
          schedules: input.schedules.map((s) => ({
            scheduleType: s.scheduleType,
            timeRanges: s.timeRanges.map((t) => ({
              startTime: t.startTime,
              endTime: t.endTime,
              timeRangeType: t.timeRangeType,
            })),
            customDates: s.customDates?.map((d) => d.toISOString()) || [],
          })),
          messages: messageTemplates.map((template, idx) => ({
            timeRangeType: input.messages[idx].timeRangeType,
            templateId: template.id,
          })),
        };

        // Update organizationSettings
        await tx
          .update(tenant.organizationSettings)
          .set({
            chatReplySettings: jsonSettings,
            updatedAt: new Date(),
          })
          .where(and(eq(tenant.organizationSettings.type, OrganizationSettingsType.CHAT_REPLY)));
      });

      return this.findOneByOrganizationId(organizationId);
    } catch (error) {
      this.logger.error(
        `Failed to update Chat Reply Setting for organization: ${organizationId}`,
        error,
      );
      throw error;
    }
  }

  async findOneByOrganizationId(organizationId: string): Promise<ChatReplySetting | null> {
    const tenant = this.tenantSchema.getTables(organizationId);
    const settingsRecord = await this.db
      .select()
      .from(tenant.organizationSettings)
      .where(and(eq(tenant.organizationSettings.type, OrganizationSettingsType.CHAT_REPLY)))
      .then((rows) => rows[0] || null);

    if (!settingsRecord) return null;

    return this.transformJsonToEntity(settingsRecord, organizationId, tenant);
  }

  async findOneByUserId(_userId: string): Promise<ChatReplySetting | null> {
    this.logger.warn('findOneByUserId called but user-level settings are no longer supported');
    return null;
  }

  async findOneById(id: string): Promise<ChatReplySetting> {
    const [organizationId] = id.split(':');

    if (!organizationId) {
      throw new NotFoundException(`Invalid Chat Reply Setting ID format: ${id}`);
    }

    const setting = await this.findOneByOrganizationId(organizationId);

    if (!setting) {
      throw new NotFoundException(`Chat Reply Setting with ID ${id} not found`);
    }

    return setting;
  }

  async findRawOne(id: string) {
    const [organizationId] = id.split(':');

    if (!organizationId) {
      throw new NotFoundException(`Invalid Chat Reply Setting ID format: ${id}`);
    }

    const tenant = this.tenantSchema.getTables(organizationId);
    const settingsRecord = await this.db
      .select()
      .from(tenant.organizationSettings)
      .where(and(eq(tenant.organizationSettings.type, OrganizationSettingsType.CHAT_REPLY)))
      .then((rows) => rows[0] || null);

    if (!settingsRecord) {
      throw new NotFoundException(`Chat Reply Setting with ID ${id} not found`);
    }

    return {
      organizationId,
      ...(settingsRecord.chatReplySettings as ChatReplySettingsJSON),
    };
  }

  private async createMessageTemplates(
    tx: DrizzleTransaction,
    tenant: TenantTables,
    messages: CreateChatReplySettingInput['messages'],
  ) {
    const templates: Array<TenantTables['chatReplyMessageTemplate']['$inferSelect']> = [];

    for (const { messageTemplate } of messages) {
      const storedType =
        messageTemplate.type === ChatMessageType.FLEX ? ChatMessageType.TEXT : messageTemplate.type;

      const [chatReplyMessageTemplate] = await tx
        .insert(tenant.chatReplyMessageTemplate)
        .values({
          id: uuidv4(),
          type: storedType,
          content: JSON.parse(JSON.stringify(messageTemplate)),
        })
        .returning();

      templates.push(chatReplyMessageTemplate);
    }

    return templates;
  }

  private async transformJsonToEntity(
    settingsRecord: TenantTables['organizationSettings']['$inferSelect'],
    organizationId: string,
    tenant: TenantTables,
  ): Promise<ChatReplySetting> {
    const json = settingsRecord.chatReplySettings as ChatReplySettingsJSON;

    // Fetch all referenced templates
    const templateIds = json.messages?.map((m) => m.templateId) || [];
    const templates =
      templateIds.length > 0
        ? await this.db
            .select()
            .from(tenant.chatReplyMessageTemplate)
            .where(inArray(tenant.chatReplyMessageTemplate.id, templateIds))
        : [];

    const templatesById = new Map(templates.map((t) => [t.id, t]));

    // Aggregate message content using ChatService
    const aggregatedMessages = await Promise.all(
      (json.messages || []).map(async (m) => {
        const template = templatesById.get(m.templateId);
        if (!template) {
          this.logger.warn(`Template ${m.templateId} not found for organization ${organizationId}`);
          return null;
        }

        const aggregated = await this.chatService.aggregateMessageContent(
          template.content,
          template.type,
          template.previewImageUrl,
          organizationId,
        );

        return {
          timeRangeType: m.timeRangeType,
          chatReplyMessageTemplate: {
            ...template,
            ...aggregated,
          },
        };
      }),
    );

    return {
      id: `${organizationId}:chatReply`,
      isActive: json.isActive ?? true,
      updatedBy: json.updatedBy || null,
      chatReplySchedules: (json.schedules || []).map((s, idx) => ({
        id: `${organizationId}:schedule:${idx}`,
        scheduleType: s.scheduleType as any,
        chatReplyScheduleCustomDates: (s.customDates || []).map((d) => new Date(d)),
        chatReplyScheduleTimeRanges: s.timeRanges.map((t) => ({
          startTime: t.startTime,
          endTime: t.endTime,
          timeRangeType: t.timeRangeType as any,
        })),
      })),
      chatReplySettingMessages: aggregatedMessages.filter((m) => m !== null) as any[],
    };
  }
}
