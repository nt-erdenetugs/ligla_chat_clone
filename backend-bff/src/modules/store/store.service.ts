import { Injectable, NotFoundException } from '@nestjs/common';

import { and, count, desc, eq, SQL } from 'drizzle-orm';
import { I18nService } from 'nestjs-i18n';

import { FilterInput, FilterOptionInput } from '@/common/dto/filter.args';
import {
  CursorPaginatedResponse,
  CursorPaginationArgs,
  PaginationArgs,
} from '@/common/dto/pagination.args';
import { buildCursorConditions, getCursorArgs } from '@/common/utils/cursor';
import { buildWhereClause } from '@/common/utils/filter.drizzle';
import { DrizzleDB, InjectDrizzle, TenantSchemaService } from '@/drizzle';
import { TenantTables } from '@@/drizzle/tenant/schema';

import { Store } from './entities/store.entity';

@Injectable()
export class StoreService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly i18n: I18nService,
    private readonly tenantSchema: TenantSchemaService,
  ) {}

  async findAll(paginationArgs: PaginationArgs, organizationId: string, filter?: FilterInput) {
    const { skip, take } = paginationArgs;
    const tenant = this.tenantSchema.getTables(organizationId);

    const where = buildWhereClause(
      {
        refineConditions: filter?.refineConditions as FilterOptionInput[],
        searchValue: filter?.searchValue,
        searchFields: ['name', 'typeName', 'areaName', 'note'],
      },
      tenant.store,
      this.i18n,
    );

    let query: any = this.db
      .select()
      .from(tenant.store)
      .where(where)
      .orderBy(...this.buildOrderBy(tenant.store));

    if (take) {
      query = query.limit(take);
    }
    if (skip) {
      query = query.offset(skip);
    }

    const items = await query;

    const { c } = await this.db
      .select({ c: count() })
      .from(tenant.store)
      .where(where)
      .then((row) => row[0]);
    return { items, count: c };
  }

  async findAllCursor(
    paginationArgs: CursorPaginationArgs,
    organizationId: string,
  ): Promise<CursorPaginatedResponse<Store>> {
    const { take } = paginationArgs;
    const tenant = this.tenantSchema.getTables(organizationId);

    const cursorConditions = buildCursorConditions(
      tenant.store,
      paginationArgs,
      undefined,
      'liglaStoreId',
    );

    const whereConditions: SQL[] = [];

    if (cursorConditions?.where) {
      whereConditions.push(cursorConditions.where);
    }

    let query: any = this.db
      .select()
      .from(tenant.store)
      .where(and(...whereConditions));

    if (cursorConditions) {
      query = query.orderBy(...cursorConditions.orderBy);
    } else {
      query = query.orderBy(...this.buildOrderBy(tenant.store));
    }

    if (take) {
      query = query.limit(take + 1);
    }

    const stores = await query;

    return getCursorArgs(stores, take, { intParamKey: 'liglaStoreId' });
  }

  async findOneById(id: string, organizationId: string) {
    const tenant = this.tenantSchema.getTables(organizationId);

    const store = await this.db
      .select()
      .from(tenant.store)
      .where(eq(tenant.store.id, id))
      .then((rows) => rows[0] || null);

    if (!store) {
      throw new NotFoundException(this.i18n.t('errors.store.notFound'));
    }

    return store;
  }

  private buildOrderBy(table: TenantTables['store']) {
    return [desc(table.liglaStoreId), desc(table.createdAt), desc(table.id)];
  }
}
