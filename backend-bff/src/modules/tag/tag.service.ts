import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { count, desc, eq, sql } from 'drizzle-orm';
import { I18nService } from 'nestjs-i18n';
import { v4 as uuidv4 } from 'uuid';

import { FilterInput } from '@/common/dto/filter.args';
import { CursorPaginationArgs, PaginationArgs } from '@/common/dto/pagination.args';
import { buildCursorConditions, getCursorArgs } from '@/common/utils/cursor';
import { buildWhereClause } from '@/common/utils/filter.drizzle';
import { DrizzleDB, InjectDrizzle, TenantSchemaService } from '@/drizzle';
import { ChatService } from '@/modules/chat/chat.service';

import { CreateTagInput } from './dto/create-tag.input';
import { UpdateTagInput } from './dto/update-tag.input';

@Injectable()
export class TagService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly i18n: I18nService,
    private readonly tenantSchema: TenantSchemaService,
    private readonly chatService: ChatService,
  ) {}

  async findAll(paginationArgs: PaginationArgs, organizationId: string, filter?: FilterInput) {
    const { skip = 0, take = 100 } = paginationArgs;
    const tenant = this.tenantSchema.getTables(organizationId);

    const filterConditions = buildWhereClause(
      {
        refineConditions: filter?.refineConditions,
        searchValue: filter?.searchValue,
        searchFields: ['name'],
      },
      tenant.tags,
      this.i18n,
    );

    const items = await this.db
      .select()
      .from(tenant.tags)
      .where(filterConditions)
      .orderBy(desc(tenant.tags.createdAt), desc(tenant.tags.id))
      .offset(skip)
      .limit(take);

    const { c } = await this.db
      .select({ c: count() })
      .from(tenant.tags)
      .where(filterConditions)
      .then((row) => row[0]);

    return { items, count: c };
  }

  async findAllCursorPaginated(paginationArgs: CursorPaginationArgs, organizationId: string) {
    const { take, ...cursorParams } = paginationArgs;
    const tenant = this.tenantSchema.getTables(organizationId);

    const cursorConditions = buildCursorConditions(tenant.tags, cursorParams);

    let query: any = this.db.select().from(tenant.tags).where(cursorConditions?.where);

    if (take) {
      query = query.limit(take + 1);
    }

    if (cursorConditions?.orderBy) {
      query = query.orderBy(...cursorConditions.orderBy);
    }

    const tags = await query;

    return getCursorArgs(tags, take);
  }

  async findOneById(organizationId: string, id: string) {
    const tenant = this.tenantSchema.getTables(organizationId);

    const tag = await this.db
      .select()
      .from(tenant.tags)
      .where(eq(tenant.tags.id, id))
      .then((rows) => rows[0] || null);

    if (!tag) {
      throw new NotFoundException(this.i18n.t('errors.tag.notFound'));
    }

    return tag;
  }

  async findOneByName(organizationId: string, name: string) {
    const tenant = this.tenantSchema.getTables(organizationId);

    return await this.db
      .select()
      .from(tenant.tags)
      .where(eq(sql`lower(${tenant.tags.name})`, name.toLowerCase()))
      .then((rows) => rows[0] || null);
  }

  async create(createTagInput: CreateTagInput, organizationId: string) {
    const { name } = createTagInput;
    const tenant = this.tenantSchema.getTables(organizationId);

    const existingTag = await this.findOneByName(organizationId, name);
    if (existingTag) {
      throw new BadRequestException(this.i18n.t('errors.tag.nameTaken'));
    }

    return await this.db
      .insert(tenant.tags)
      .values({
        id: uuidv4(),
        name,
      })
      .returning()
      .then((rows) => rows[0]);
  }

  async update(updateTagInput: UpdateTagInput, organizationId: string) {
    const { id, name, isActive } = updateTagInput;
    const tenant = this.tenantSchema.getTables(organizationId);

    const tag = await this.findOneById(organizationId, id);

    if (name !== tag.name) {
      const existingTag = await this.findOneByName(organizationId, name);
      if (existingTag) {
        throw new BadRequestException(this.i18n.t('errors.tag.nameTaken'));
      }

      const hasOngoingChat = await this.chatService.hasActiveChatForTag(id, organizationId);
      if (hasOngoingChat) {
        throw new BadRequestException(this.i18n.t('errors.tag.forbiddenUpdateOngoingChat'));
      }
    }

    return await this.db
      .update(tenant.tags)
      .set({
        name,
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(tenant.tags.id, id))
      .returning()
      .then((rows) => rows[0]);
  }

  async disable(organizationId: string, id: string) {
    const tenant = this.tenantSchema.getTables(organizationId);

    return await this.db
      .update(tenant.tags)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(tenant.tags.id, id))
      .returning()
      .then((rows) => rows[0]);
  }
}
