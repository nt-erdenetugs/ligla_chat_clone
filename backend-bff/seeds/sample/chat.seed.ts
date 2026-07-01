import { eq, and } from 'drizzle-orm';

import { DrizzleDB } from '@/drizzle';
import { TenantTables } from '@@/drizzle/tenant/schema';

import { OrgSeedData } from './data';

export const createChats = async (
  db: DrizzleDB,
  tenantTables: TenantTables,
  orgData: OrgSeedData,
) => {
  console.debug(`Creating chats for ${orgData.orgName}...`);

  for (const chatData of orgData.chats) {
    await db
      .insert(tenantTables.chat)
      .values({
        id: chatData.id,
        endUserId: chatData.endUserId,
        clientUserId: chatData.clientUserId,
        assignedUserId: chatData.assignedUserId,
        chatStatus: chatData.chatStatus as any,
        createdAt: chatData.createdAt,
        latestMessageTimestamp: chatData.createdAt,
      })
      .onConflictDoNothing();
  }
};

export const createChatMessages = async (
  db: DrizzleDB,
  tenantTables: TenantTables,
  orgData: OrgSeedData,
) => {
  console.debug(`Creating chat messages for ${orgData.orgName}...`);

  for (const msg of orgData.chatMessages) {
    const [existing] = await db
      .select({ id: tenantTables.chatMessage.id })
      .from(tenantTables.chatMessage)
      .where(
        and(
          eq(tenantTables.chatMessage.chatId, msg.chatId),
          eq(tenantTables.chatMessage.senderId, msg.senderId),
          eq(tenantTables.chatMessage.createdAt, msg.createdAt),
        ),
      )
      .limit(1);

    if (existing) continue;

    const [inserted] = await db
      .insert(tenantTables.chatMessage)
      .values({
        id: msg.id,
        chatId: msg.chatId,
        senderId: msg.senderId,
        senderType: msg.senderType as any,
        type: msg.type as any,
        previewImageUrl: msg.previewImageUrl,
        content: msg.content as any,
        createdAt: msg.createdAt,
        isDelivered: msg.isDelivered,
        isEncrypted: false,
      })
      .returning();

    if (inserted) {
      await db
        .update(tenantTables.chat)
        .set({ latestMessageTimestamp: inserted.createdAt })
        .where(eq(tenantTables.chat.id, msg.chatId));
    }
  }
};

export const createChatTeamAssignments = async (
  db: DrizzleDB,
  tenantTables: TenantTables,
  orgData: OrgSeedData,
  teams: { id: string; name: string; isDefault: boolean }[],
) => {
  console.debug(`Creating chat team assignments for ${orgData.orgName}...`);

  const teamId = teams.find((t) => !t.isDefault)?.id || '';
  if (!teamId) return;

  for (const item of orgData.chatTeamAssignments) {
    const [existing] = await db
      .select({ id: tenantTables.chatTeamAssignment.id })
      .from(tenantTables.chatTeamAssignment)
      .where(
        and(
          eq(tenantTables.chatTeamAssignment.chatId, item.chatId),
          eq(tenantTables.chatTeamAssignment.teamId, teamId),
        ),
      )
      .limit(1);

    if (existing) continue;

    await db.insert(tenantTables.chatTeamAssignment).values({
      id: item.id,
      teamId,
      chatId: item.chatId,
      createdAt: new Date(),
    });
  }
};
