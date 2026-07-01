import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { eq, sql } from 'drizzle-orm';
import { GraphQLError } from 'graphql';
import { I18nService } from 'nestjs-i18n';

import { DrizzleDB, InjectDrizzle, TenantSchemaService } from '@/drizzle';
import { SystemUserType } from '@/modules/user/enums';
import * as shared from '@@/drizzle/public/schema';

interface OrganizationContext {
  userId: string;
  organizationId: string;
}

interface CacheEntry {
  exists: boolean;
  timestamp: number;
}

@Injectable()
export class OrganizationGuard implements CanActivate {
  private readonly organizationCache = new Map<string, CacheEntry>();
  private readonly schemaCache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs = 60 * 1000;
  private readonly cacheMaxEntries = 1000;

  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly tenantSchema: TenantSchemaService,
    private readonly i18n: I18nService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const role = ctx.getContext().role;

    if (role === SystemUserType.HYPERVISOR) {
      return true;
    }

    const orgContext = this.getOrganizationContext(ctx);
    const info = ctx.getInfo();

    try {
      if (this.isIntrospectionQuery(info)) {
        return true;
      }

      await this.validateOrganizationExists(orgContext.organizationId);
      await this.validateTenantSchemaExists(orgContext.organizationId);

      return true;
    } catch (error) {
      this.handleError(error);
    }
  }

  private getOrganizationContext(ctx: GqlExecutionContext): OrganizationContext {
    const context = ctx.getContext();

    if (!context.organizationId || !context.uid) {
      throw new ForbiddenException(this.i18n.t('errors.organization.invalidContext'));
    }

    return {
      userId: context.uid,
      organizationId: context.organizationId,
    };
  }

  private async validateOrganizationExists(organizationId: string): Promise<void> {
    const cached = this.getFromCache(this.organizationCache, organizationId);
    if (cached !== null) {
      if (!cached) {
        throw new ForbiddenException(this.i18n.t('errors.organization.notFound'));
      }
      return;
    }

    const organization = await this.db
      .select({ id: shared.organization.id, isActive: shared.organization.isActive })
      .from(shared.organization)
      .where(eq(shared.organization.id, organizationId))
      .then((rows) => rows[0] || null);

    const exists = !!organization && organization.isActive;
    this.setCache(this.organizationCache, organizationId, exists);

    if (!exists) {
      throw new ForbiddenException(this.i18n.t('errors.organization.notFound'));
    }
  }

  private async validateTenantSchemaExists(organizationId: string): Promise<void> {
    const cached = this.getFromCache(this.schemaCache, organizationId);
    if (cached !== null) {
      if (!cached) {
        throw new InternalServerErrorException(this.i18n.t('errors.exception.internalServerError'));
      }
      return;
    }

    const schemaName = this.tenantSchema.getSchemaName(organizationId);
    const exists = await this.db
      .execute(
        sql`SELECT 1 FROM information_schema.schemata WHERE schema_name = ${schemaName} LIMIT 1`,
      )
      .then((result) => result.rows?.length > 0);

    this.setCache(this.schemaCache, organizationId, exists);

    if (!exists) {
      throw new InternalServerErrorException(this.i18n.t('errors.exception.internalServerError'));
    }
  }

  private getFromCache(cache: Map<string, CacheEntry>, key: string): boolean | null {
    const entry = cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.cacheTtlMs) {
      cache.delete(key);
      return null;
    }

    return entry.exists;
  }

  private setCache(cache: Map<string, CacheEntry>, key: string, exists: boolean): void {
    this.evictExpiredEntries(cache);

    while (cache.size >= this.cacheMaxEntries) {
      this.evictOldestEntry(cache);
    }

    cache.set(key, { exists, timestamp: Date.now() });
  }

  private evictExpiredEntries(cache: Map<string, CacheEntry>): void {
    const now = Date.now();

    for (const [key, entry] of cache.entries()) {
      if (now - entry.timestamp > this.cacheTtlMs) {
        cache.delete(key);
      }
    }
  }

  private evictOldestEntry(cache: Map<string, CacheEntry>): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Number.POSITIVE_INFINITY;

    for (const [key, entry] of cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey !== null) {
      cache.delete(oldestKey);
    }
  }

  private isIntrospectionQuery(info: any): boolean {
    return info.fieldName.startsWith('__');
  }

  private handleError(error: unknown): never {
    const errorCode =
      error instanceof InternalServerErrorException ? 'INTERNAL_SERVER_ERROR' : 'FORBIDDEN';
    const errorMessage =
      error instanceof Error ? error.message : this.i18n.t('errors.graphQL.accessDenied');

    throw new GraphQLError(errorMessage, {
      extensions: {
        code: errorCode,
        http: { status: errorCode === 'INTERNAL_SERVER_ERROR' ? 500 : 403 },
      },
    });
  }
}
