import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { isArray } from 'class-validator';
import { and, eq, inArray } from 'drizzle-orm';
import * as uuid from 'uuid';
import * as webpush from 'web-push';

import { DrizzleDB, InjectDrizzle, TenantSchemaService } from '@/drizzle';
import { UserStatusType } from '@/modules/user/enums';
import * as shared from '@@/drizzle/public/schema';
import { TenantTables } from '@@/drizzle/tenant/schema';

import { SubscribePushDto } from './dto/subscribe-push.dto';

type NotificationPayload = {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: {
    url?: string;
  };
};

const WEB_PUSH_OPTIONS = {
  TTL: 60,
} as const;

@Injectable()
export class NotificationsService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly jwtService: JwtService,
    private readonly tenantSchema: TenantSchemaService,
  ) {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const mailDomain = process.env.MAIL_DOMAIN;

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('VAPID keys are not set in environment variables');
    }
    webpush.setVapidDetails(`mailto:ligla_chat@${mailDomain}`, vapidPublicKey, vapidPrivateKey);
  }

  async subscribe({
    body,
    userId,
    token,
    organizationId,
  }: {
    body: SubscribePushDto;
    userId: string;
    token: string;
    organizationId: string;
  }) {
    const tenant = this.tenantSchema.getTables(organizationId);

    const validatedUserId = await this.usersValidation(userId, organizationId);

    const {
      endpoint,
      keys: { p256dh, auth },
    } = body;

    await this.db
      .insert(tenant.pushSubscription)
      .values({
        id: uuid.v4(),
        userId: validatedUserId,
        endpoint,
        p256dh,
        auth,
        token,
      })
      .onConflictDoUpdate({
        target: [tenant.pushSubscription.endpoint],
        set: {
          p256dh,
          auth,
          token,
          userId,
        },
      });
  }

  async sendNotification(userId: string, organizationId: string, payload: NotificationPayload) {
    const validatedUserId = await this.usersValidation(userId, organizationId);
    const tenant = this.tenantSchema.getTables(organizationId);

    const subscriptions = await this.db
      .select()
      .from(tenant.pushSubscription)
      .where(eq(tenant.pushSubscription.userId, validatedUserId));

    if (subscriptions.length === 0) {
      throw new NotFoundException('No subscriptions found for this user: ' + userId);
    }

    await this.sendNotificationSubscriptions(subscriptions, payload, organizationId);
  }

  async sendNotificationToSubscribedUsers(
    userIDs: string[],
    payload: NotificationPayload,
    organizationId: string,
  ) {
    const validatedUserIds = await this.usersValidation(userIDs, organizationId);
    const tenant = this.tenantSchema.getTables(organizationId);

    const subscriptions = await this.db
      .select()
      .from(tenant.pushSubscription)
      .where(inArray(tenant.pushSubscription.userId, validatedUserIds));

    if (subscriptions.length === 0) {
      throw new NotFoundException('No subscriptions were found.');
    }

    await this.sendNotificationSubscriptions(subscriptions, payload, organizationId);
  }

  async unsubscribe(body: SubscribePushDto, userId: string, organizationId: string) {
    const validatedUserId = await this.usersValidation(userId, organizationId);
    const tenant = this.tenantSchema.getTables(organizationId);

    const { endpoint } = body;

    const result = await this.db
      .delete(tenant.pushSubscription)
      .where(
        and(
          eq(tenant.pushSubscription.userId, validatedUserId),
          eq(tenant.pushSubscription.endpoint, endpoint),
        ),
      )
      .returning();

    if (result.length === 0) {
      throw new NotFoundException('Subscription not found');
    }
  }

  async sync(body: Pick<SubscribePushDto, 'endpoint'>, userId: string, organizationId: string) {
    const validatedUserId = await this.usersValidation(userId, organizationId);
    const tenant = this.tenantSchema.getTables(organizationId);

    const { endpoint } = body;

    const subscription = await this.db
      .select()
      .from(tenant.pushSubscription)
      .where(
        and(
          eq(tenant.pushSubscription.userId, validatedUserId),
          eq(tenant.pushSubscription.endpoint, endpoint),
        ),
      )
      .then((rows) => rows[0] || null);

    if (!subscription) {
      return { synced: false };
    }

    return { synced: true };
  }

  private async verifyJwtToken(token: string) {
    await this.jwtService.verifyAsync(token, {
      secret: process.env.JWT_SECRET,
    });
  }

  private async sendNotificationSubscriptions(
    subscriptions: TenantTables['pushSubscription']['$inferSelect'][],
    payload: NotificationPayload,
    organizationId: string,
  ) {
    const invalidSubscriptions: string[] = [];

    const promises = subscriptions.map(async (subscription) => {
      const { id, endpoint, p256dh, auth, token } = subscription;

      const pushSubscription = {
        endpoint,
        keys: {
          p256dh,
          auth,
        },
      };

      try {
        await this.verifyJwtToken(token);
      } catch (error) {
        Logger.error(`Token verification failed for subscription ID: ${id}`, error);
        invalidSubscriptions.push(id);
        return;
      }

      return await webpush
        .sendNotification(pushSubscription, JSON.stringify(payload), WEB_PUSH_OPTIONS)
        .catch((error) => {
          if (error.statusCode === 410 || error.statusCode === 404) invalidSubscriptions.push(id);
        });
    });

    await Promise.all(promises);

    if (invalidSubscriptions.length === 0) return;

    Logger.log(`Removed invalid subscriptions: ${invalidSubscriptions.join()}`);
    const tenant = this.tenantSchema.getTables(organizationId);
    await this.db
      .delete(tenant.pushSubscription)
      .where(inArray(tenant.pushSubscription.id, invalidSubscriptions));
  }

  private async usersValidation(userIds: string, organizationId: string): Promise<string>;
  private async usersValidation(userIds: string[], organizationId: string): Promise<string[]>;
  private async usersValidation(
    userIds: string[] | string,
    organizationId: string,
  ): Promise<string[] | string> {
    const tenant = this.tenantSchema.getTables(organizationId);

    // Validate input
    if (isArray(userIds) && userIds.length === 0) {
      throw new NotFoundException('Users to send notifications not found');
    }

    const idCondition = isArray(userIds)
      ? inArray(shared.auth.id, userIds)
      : eq(shared.auth.id, userIds);

    const auths = await this.db
      .select({ id: shared.auth.id, user: tenant.user })
      .from(shared.auth)
      .where(and(idCondition, eq(shared.auth.status, UserStatusType.ACTIVE)))
      .innerJoin(tenant.user, eq(tenant.user.id, shared.auth.id));

    if (auths.length === 0) {
      throw new NotFoundException('Users to send notifications not found');
    }

    return isArray(userIds) ? auths.map((auth) => auth.user.id) : auths[0].user.id;
  }
}
