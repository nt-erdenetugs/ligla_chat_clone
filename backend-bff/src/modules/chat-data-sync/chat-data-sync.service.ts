import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { and, eq, sql } from 'drizzle-orm';

import { logErrorDetails, withRetry } from '@/common/utils/retry';
import { DrizzleDB, InjectDrizzle } from '@/drizzle';
import * as shared from '@@/drizzle/public/schema';

import { NotifyCoreInput } from './dto/notify-core.input';

@Injectable()
export class ChatDataSyncService {
  private readonly channel: string | undefined;
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly config: ConfigService,
  ) {
    this.channel = this.config.get<string>('DB_SYNC_NOTIFY_CHANNEL');
  }

  private readonly logger = new Logger(ChatDataSyncService.name);

  async notifyCore(payload: NotifyCoreInput) {
    if (!this.channel) {
      this.logger.error('NOTIFY channel is not defined.');
      return;
    }
    const operation = async () => {
      await this.verifyOrganization(payload.organizationName);

      const notifyPayload = {
        type: payload.type,
        clientName: payload.organizationName,
        timestamp: new Date(),
        userId: payload.userId,
      };
      const jsonText = JSON.stringify(notifyPayload);

      await this.db.execute(sql`SELECT pg_notify(${this.channel}, ${jsonText})`);

      this.logger.log(`NOTIFY → ${this.channel}: ${jsonText}`);
    };

    try {
      await withRetry(operation, 'pg_notify_core', this.logger);
    } catch (e) {
      logErrorDetails(
        `pg_notify failed to notify core on ${this.channel} after multiple retries`,
        e,
        this.logger,
      );
    }
  }

  private async verifyOrganization(organizationName: string) {
    const organization = await this.db
      .select({ id: shared.organization.id })
      .from(shared.organization)
      .where(
        and(eq(shared.organization.name, organizationName), eq(shared.organization.isActive, true)),
      )
      .then((rows) => rows[0] || null);
    if (!organization) {
      throw new NotFoundException(`Organization with the name ${organizationName} not found.`);
    }
  }
}
