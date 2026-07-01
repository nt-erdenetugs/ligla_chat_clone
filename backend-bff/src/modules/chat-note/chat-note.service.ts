import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';

import { and, desc, eq, getTableColumns, sql } from 'drizzle-orm';
import { I18nService } from 'nestjs-i18n';
import { v4 as uuidv4 } from 'uuid';

import { trimAndCleanSpacesWithoutNewline } from '@/common/utils/string';
import { DrizzleDB, DrizzleTransaction, InjectDrizzle, TenantSchemaService } from '@/drizzle';
import { adminManagerRoles } from '@/modules/auth/constants';
import { EncryptionService } from '@/modules/encryption/encryption.service';
import { TenantTables } from '@@/drizzle/tenant/schema';

import { CreateChatNoteInput } from './dto/create-chat-note.input';
import { UpdateChatNoteInput } from './dto/update-chat-note.input';
import { ChatNote } from './entities/chat-note.entity';

type ValidationParams = {
  userId: string;
  role: string;
  chatId: string;
  noteId: string;
};

@Injectable()
export class ChatNoteService {
  constructor(
    private readonly i18n: I18nService,
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly tenantSchema: TenantSchemaService,
    private readonly encryption: EncryptionService,
  ) {}

  async findByChatId(chatId: string, organizationId: string): Promise<ChatNote[]> {
    const tenant = this.tenantSchema.getTables(organizationId);

    const chat = await this.db
      .select()
      .from(tenant.chat)
      .where(eq(tenant.chat.id, chatId))
      .then((rows) => rows[0] || null);

    if (!chat) {
      throw new UnauthorizedException(this.i18n.t('errors.chat.accessDenied'));
    }

    return await this.encryption.txWithOrgKey(organizationId, async (tx) => {
      return await tx
        .select({
          ...getTableColumns(tenant.note),
          noteValue: this.encryption.decryptColumnStr(
            tenant.note.noteValue,
            tenant.note.noteValueEncrypted,
            tenant.note.isEncrypted,
          ),
          user: {
            id: tenant.user.id,
            displayName: tenant.user.displayName,
          },
        })
        .from(tenant.note)
        .innerJoin(tenant.user, eq(tenant.note.userId, tenant.user.id))
        .where(and(eq(tenant.note.chatId, chatId), eq(tenant.note.isActive, true)))
        .orderBy(desc(sql`COALESCE(${tenant.note.updatedAt}, ${tenant.note.createdAt})`));
    });
  }

  async create(
    createNoteInput: CreateChatNoteInput,
    userId: string,
    organizationId: string,
    role: string,
  ): Promise<ChatNote> {
    const { chatId, noteValue: value } = createNoteInput;
    const tenant = this.tenantSchema.getTables(organizationId);

    await this.validateChat(userId, chatId, role, organizationId);

    const cleanedValue = trimAndCleanSpacesWithoutNewline(value);

    // TODO(JIRA-922): the DB encryption trigger derives noteValueEncrypted/isEncrypted
    // from noteValue on write — this explicit dual-write is redundant, drop it.
    const createData = {
      id: uuidv4(),
      chatId,
      noteValue: cleanedValue,
      noteValueEncrypted: this.encryption.encryptValue(cleanedValue),
      userId,
      isEncrypted: true,
    };

    return await this.encryption.txWithOrgKey(organizationId, async (tx) => {
      const [newNote] = await tx.insert(tenant.note).values(createData).returning();

      return await this.aggregateNote(tx, tenant, newNote.id);
    });
  }

  async update(
    updateNoteInput: UpdateChatNoteInput,
    userId: string,
    role: string,
    organizationId: string,
  ): Promise<ChatNote> {
    const { noteValue: rawValue, chatId, id } = updateNoteInput;
    const tenant = this.tenantSchema.getTables(organizationId);

    const cleanedValue = trimAndCleanSpacesWithoutNewline(rawValue);

    await this.validateNote({ userId, chatId, role, noteId: id, organizationId });

    return await this.encryption.txWithOrgKey(organizationId, async (tx) => {
      // TODO(JIRA-922): redundant dual-write — the encryption trigger owns
      // noteValueEncrypted/isEncrypted; set noteValue only.
      const [updatedNote] = await tx
        .update(tenant.note)
        .set({
          noteValue: cleanedValue,
          noteValueEncrypted: this.encryption.encryptValue(cleanedValue),
          userId,
          updatedAt: new Date(),
          isEncrypted: true,
        })
        .where(eq(tenant.note.id, id))
        .returning();

      return await this.aggregateNote(tx, tenant, updatedNote.id);
    });
  }

  async remove(organizationId: string, id: string, chatId: string, userId: string, role: string) {
    const tenant = this.tenantSchema.getTables(organizationId);
    await this.validateNote({ userId, chatId, role, noteId: id, organizationId });

    return await this.encryption.txWithOrgKey(organizationId, async (tx) => {
      const [removedNote] = await tx
        .update(tenant.note)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(tenant.note.id, id))
        .returning();

      return await this.aggregateNote(tx, tenant, removedNote.id);
    });
  }

  private async validateNote({
    userId,
    chatId,
    role,
    noteId,
    organizationId,
  }: ValidationParams & { organizationId: string }) {
    const tenant = this.tenantSchema.getTables(organizationId);
    await this.validateChat(userId, chatId, role, organizationId);
    const note = await this.db
      .select()
      .from(tenant.note)
      .where(eq(tenant.note.id, noteId))
      .then((rows) => rows[0] || null);

    if (!note || !note.isActive) {
      throw new NotFoundException(this.i18n.t('errors.note.notFound'));
    }

    if (note.userId !== userId && !adminManagerRoles.includes(role)) {
      throw new UnauthorizedException(this.i18n.t('errors.note.accessDenied'));
    }

    return note;
  }

  private async validateChat(userId: string, chatId: string, role: string, organizationId: string) {
    const tenant = this.tenantSchema.getTables(organizationId);
    const chat = await this.db
      .select()
      .from(tenant.chat)
      .where(eq(tenant.chat.id, chatId))
      .then((rows) => rows[0] || null);

    if (!chat) {
      throw new UnauthorizedException(this.i18n.t('errors.chat.accessDenied'));
    }

    if (chat.assignedUserId !== userId && !adminManagerRoles.includes(role)) {
      throw new UnauthorizedException(this.i18n.t('errors.chat.accessDenied'));
    }

    return chat;
  }

  private async aggregateNote(
    db: DrizzleDB | DrizzleTransaction,
    tenant: TenantTables,
    noteId: string,
  ): Promise<ChatNote> {
    const note = await db
      .select({
        ...getTableColumns(tenant.note),
        noteValue: this.encryption.decryptColumnStr(
          tenant.note.noteValue,
          tenant.note.noteValueEncrypted,
          tenant.note.isEncrypted,
        ),
        user: {
          id: tenant.user.id,
          displayName: tenant.user.displayName,
        },
      })
      .from(tenant.note)
      .innerJoin(tenant.user, eq(tenant.note.userId, tenant.user.id))
      .where(eq(tenant.note.id, noteId))
      .then((rows) => rows[0] || null);

    if (!note) {
      throw new NotFoundException(this.i18n.t('errors.note.notFound'));
    }

    return note;
  }
}
