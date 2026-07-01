import * as crypto from 'crypto';

import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SQL, sql } from 'drizzle-orm';

import { DrizzleDB, DrizzleTransaction, InjectDrizzle } from '@/drizzle';
import { TenantTables } from '@@/drizzle/tenant/schema';

//keep in sync with bff's encryption/service.py
const APPLICATION_SALT = Buffer.from('ligla-chat-encryption-v1');

const ALLOWED_TABLES = {
  CHAT_MESSAGE: 'chatMessage',
  CHAT_NOTE: 'note',
  CHAT_ATTRIBUTE_VALUE: 'chatAttributeValue',
} as const;

type ALLOWED_TABLES = (typeof ALLOWED_TABLES)[keyof typeof ALLOWED_TABLES];

type AllowedColumns = {
  [TableName in ALLOWED_TABLES]: TenantTables[TableName]['_']['columns'][keyof TenantTables[TableName]['_']['columns']];
}[ALLOWED_TABLES];

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly masterKey: Buffer;
  private readonly maxCacheEntries = 1000;
  private readonly orgKeyCache = new Map<string, { key: string; expiresAt: number }>();
  private readonly cacheTtlMs: number;

  constructor(
    private readonly configService: ConfigService,
    @InjectDrizzle() private readonly db: DrizzleDB,
  ) {
    const masterKeyBase64 = this.configService.get<string>('ENCRYPTION_MASTER_KEY');

    if (!masterKeyBase64) {
      throw new Error('ENCRYPTION_MASTER_KEY not configured in settings');
    }

    try {
      this.masterKey = Buffer.from(masterKeyBase64, 'base64');
      if (this.masterKey.length !== 32) {
        throw new Error('Master key must be exactly 32 bytes (256 bits)');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to decode master key', error);
      throw new Error(`Invalid master key format: ${errorMessage}`);
    }

    this.logger.log('EncryptionService initialized successfully');

    const rawTtlMs =
      this.configService.get<number>('ENCRYPTION_ORG_KEY_CACHE_TTL_MS') ?? 60 * 60 * 1000;
    this.cacheTtlMs = Number(rawTtlMs);

    if (!Number.isFinite(this.cacheTtlMs) || this.cacheTtlMs <= 0) {
      throw new Error('ENCRYPTION_ORG_KEY_CACHE_TTL_MS must be a positive number');
    }
  }

  decryptColumn(column: AllowedColumns): SQL<Buffer> {
    return sql<Buffer>`pgp_sym_decrypt_bytea(${column}::bytea, current_setting('app.organizationKey', true))`;
  }

  // Reads the expand/contract pair: prefer the encrypted BYTEA column, falling back
  // to the legacy plaintext column for rows the backfill has not reached yet.
  // TODO(JIRA-922): once the plaintext columns are dropped this collapses to
  // `pgp_sym_decrypt(${encryptedColumn}, key)` and the oldColumn fallback goes away.
  decryptColumnStr(
    oldColumn: AllowedColumns,
    encryptedColumn: AllowedColumns,
    isEncryptedColumn: AllowedColumns,
  ): SQL<string> {
    return sql<string>`
      CASE
        WHEN ${encryptedColumn} IS NOT NULL THEN
          CASE
            WHEN ${isEncryptedColumn} = true
              THEN pgp_sym_decrypt(${encryptedColumn}, current_setting('app.organizationKey', true))
            ELSE convert_from(${encryptedColumn}, 'UTF8')
          END
        ELSE ${oldColumn}::text
      END
    `;
  }

  encryptValue(value: string): SQL<unknown> {
    return sql`pgp_sym_encrypt(${value}::text, current_setting('app.organizationKey', true), 's2k-mode=0')`;
  }

  async txWithOrgKey<T>(
    organizationId: string,
    callback: (tx: DrizzleTransaction) => Promise<T>,
  ): Promise<T> {
    const organizationKey = this.deriveOrgKey(organizationId);

    try {
      return await this.db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT set_config('app.organizationKey', ${organizationKey}::text, true)`,
        );

        return await callback(tx);
      });
    } catch (error) {
      if (this.isPgpDecryptError(error)) {
        this.logger.error('Failed to decrypt protected tenant data', {
          organizationId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw new InternalServerErrorException('Failed to decrypt protected data');
      }

      throw error;
    }
  }

  private deriveOrgKey(organizationId: string): string {
    try {
      const cachedEntry = this.orgKeyCache.get(organizationId);

      if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
        this.orgKeyCache.delete(organizationId);
        this.orgKeyCache.set(organizationId, cachedEntry);
        return cachedEntry.key;
      }

      if (cachedEntry) {
        this.orgKeyCache.delete(organizationId);
      }

      const derivedKey = crypto.hkdfSync(
        'sha256',
        this.masterKey,
        APPLICATION_SALT,
        Buffer.from(organizationId, 'utf-8'),
        32,
      );

      const organizationKey = Buffer.from(derivedKey).toString('base64');

      if (this.orgKeyCache.size >= this.maxCacheEntries) {
        const oldestCacheKey = this.orgKeyCache.keys().next().value;

        if (oldestCacheKey) {
          this.orgKeyCache.delete(oldestCacheKey);
        }
      }

      this.orgKeyCache.set(organizationId, {
        key: organizationKey,
        expiresAt: Date.now() + this.cacheTtlMs,
      });

      return organizationKey;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const orgIdHash = crypto
        .createHash('sha256')
        .update(organizationId)
        .digest('hex')
        .slice(0, 8);
      this.logger.error(`Failed to derive organization key (orgIdHash=${orgIdHash})`, error);
      throw new Error(`Key derivation failed: ${errorMessage}`);
    }
  }

  private isPgpDecryptError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();

    return (
      normalized.includes('pgp_sym_decrypt') || normalized.includes('wrong key or corrupt data')
    );
  }
}
