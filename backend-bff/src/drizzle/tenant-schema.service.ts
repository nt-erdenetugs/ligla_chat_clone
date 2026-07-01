import { BadRequestException, Injectable } from '@nestjs/common';
import { validate as uuidValidate } from 'uuid';

import { uuidToSchemaName } from '@/common/utils/tenant';
import { createTenantTables, TenantTables } from '@@/drizzle/tenant/schema';

@Injectable()
export class TenantSchemaService {
  private readonly cache = new Map<string, TenantTables>();
  private readonly maxCacheEntries = 1000;

  getTables(organizationId: string): TenantTables {
    const schemaName = this.getSchemaName(organizationId);
    const cached = this.cache.get(schemaName);

    if (cached) {
      this.cache.delete(schemaName);
      this.cache.set(schemaName, cached);
      return cached;
    }

    const tables = createTenantTables(schemaName);

    if (this.cache.size >= this.maxCacheEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(schemaName, tables);
    return tables;
  }

  getSchemaName(organizationId: string): string {
    if (!uuidValidate(organizationId)) {
      throw new BadRequestException(`Invalid organization ID format: ${organizationId}`);
    }
    return uuidToSchemaName(organizationId);
  }
}
