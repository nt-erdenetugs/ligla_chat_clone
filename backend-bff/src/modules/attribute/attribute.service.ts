import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { exists, and, inArray, not, eq, count, sql, getTableColumns, asc, SQL } from 'drizzle-orm';
import { I18nService } from 'nestjs-i18n';
import { v4 as uuidv4 } from 'uuid';

import { MAX_SELECT_OPTION_LENGTH, MAX_SELECT_OPTION_STRING_LENGTH } from '@/common/constants';
import { FilterInput } from '@/common/dto/filter.args';
import { PaginationArgs } from '@/common/dto/pagination.args';
import { buildWhereClause } from '@/common/utils/filter.drizzle';
import { trimAndCleanSpaces } from '@/common/utils/string';
import { DrizzleDB, DrizzleTransaction, InjectDrizzle, TenantSchemaService } from '@/drizzle';
import { EncryptionService } from '@/modules/encryption/encryption.service';
import { TenantTables } from '@@/drizzle/tenant/schema';

import { CreateAttributeInput, SelectOptionInput } from './dto/create-attribute.input';
import { CreateChatAttributeValueInput } from './dto/create-chat-attribute-value.input';
import { UpdateAttributeInput } from './dto/update-attribute.input';
import { AttributeType } from './enums';

@Injectable()
export class AttributeService {
  constructor(
    private readonly i18n: I18nService,
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly tenantSchema: TenantSchemaService,
    private readonly encryption: EncryptionService,
  ) {}

  async create(createAttributeInput: CreateAttributeInput, organizationId: string) {
    const { name: _name, type, selectOptions, isEncryptionEnabled } = createAttributeInput;
    const tenant = this.tenantSchema.getTables(organizationId);

    const name = trimAndCleanSpaces(_name);

    await this.validateNameDuplication(name, tenant);

    const base = {
      id: uuidv4(),
      name,
      type,
      isEncryptionEnabled: Boolean(isEncryptionEnabled),
    };

    if (type === AttributeType.selection) {
      await this.validateSelectOptions(selectOptions as SelectOptionInput[]);

      return await this.db.transaction(async (tx) => {
        const [attribute] = await tx.insert(tenant.attribute).values(base).returning();

        await tx.insert(tenant.selectOption).values(
          selectOptions!.map((option) => ({
            id: uuidv4(),
            value: option.value,
            label: option.label ?? null,
            attributeId: attribute.id,
          })),
        );

        return await this.getAttributeWithSelectOptions(
          tx,
          { where: eq(tenant.attribute.id, attribute.id), single: true },
          tenant,
        );
      });
    }

    const [attribute] = await this.db.insert(tenant.attribute).values(base).returning();

    return attribute;
  }

  async findAll(paginationArgs: PaginationArgs, organizationId: string, filter?: FilterInput) {
    const { skip, take } = paginationArgs;
    const tenant = this.tenantSchema.getTables(organizationId);

    const whereClause = buildWhereClause(
      {
        refineConditions: filter?.refineConditions,
        searchValue: filter?.searchValue,
        searchFields: ['name'],
      },
      tenant.attribute,
      this.i18n,
    );

    const items = await this.getAttributeWithSelectOptions(
      this.db,
      {
        where: whereClause,
        offset: skip,
        limit: take,
        orderBy: [asc(tenant.attribute.createdAt), asc(tenant.attribute.id)],
      },
      tenant,
    );

    const { c } = await this.db
      .select({ c: count() })
      .from(tenant.attribute)
      .where(whereClause)
      .then((rows) => rows[0]);

    return { items, count: c };
  }

  async findOne(id: string, organizationId: string) {
    const tenant = this.tenantSchema.getTables(organizationId);
    const attribute = await this.getAttributeWithSelectOptions(
      this.db,
      { where: eq(tenant.attribute.id, id), single: true },
      tenant,
    );

    if (!attribute) {
      throw new NotFoundException(this.i18n.t('errors.attribute.notFound'));
    }

    return attribute;
  }

  async fillChatAttributeValue(
    createChatAttributeValueInput: CreateChatAttributeValueInput,
    userId: string,
    organizationId: string,
  ) {
    const { chatId, attributeId, value: rawValue } = createChatAttributeValueInput;
    const tenant = this.tenantSchema.getTables(organizationId);

    const targetAttribute = await this.db
      .select()
      .from(tenant.attribute)
      .where(and(eq(tenant.attribute.id, attributeId), eq(tenant.attribute.isActive, true)))
      .then((rows) => rows[0] || null);

    if (!targetAttribute) {
      throw new NotFoundException(this.i18n.t('errors.attribute.notFound'));
    }

    const value = trimAndCleanSpaces(rawValue);
    const isEncrypted = Boolean(targetAttribute.isEncryptionEnabled);

    if (targetAttribute.type === AttributeType.selection) {
      return await this.encryption.txWithOrgKey(organizationId, async (tx) => {
        const option = await tx
          .select()
          .from(tenant.selectOption)
          .where(
            and(
              eq(tenant.selectOption.attributeId, attributeId),
              eq(tenant.selectOption.value, value),
            ),
          )
          .then((rows) => rows[0] || null);

        if (!option) {
          throw new NotFoundException(this.i18n.t('errors.attribute.noSelectOptionsProvided'));
        }

        const chatAttributeValue = await this.upsertChatAttributeValue(
          tx,
          {
            chatId,
            attributeId,
            value,
            userId,
            isEncrypted,
          },
          tenant,
        );

        await tx
          .insert(tenant.chatAttributeValueSelectOption)
          .values({
            chatAttributeValueId: chatAttributeValue.id,
            selectOptionId: option.id,
          })
          .onConflictDoNothing({
            target: [
              tenant.chatAttributeValueSelectOption.chatAttributeValueId,
              tenant.chatAttributeValueSelectOption.selectOptionId,
            ],
          });

        return this.getChatAttributeValueWithRelations(tx, chatAttributeValue.id, tenant);
      });
    }

    return await this.encryption.txWithOrgKey(organizationId, async (tx) => {
      const chatAttributeValue = await this.upsertChatAttributeValue(
        tx,
        {
          chatId,
          attributeId,
          value,
          userId,
          isEncrypted,
        },
        tenant,
      );

      return await this.getChatAttributeValueWithRelations(tx, chatAttributeValue.id, tenant);
    });
  }

  async update(updateAttributeInput: UpdateAttributeInput, organizationId: string) {
    const { name: _name, isActive, id, type, selectOptions } = updateAttributeInput;
    const tenant = this.tenantSchema.getTables(organizationId);

    const name = trimAndCleanSpaces(_name);

    await this.ensureAttributeExists(id, tenant);
    await this.validateNameDuplication(name, tenant, id);

    if (type === AttributeType.selection) {
      await this.validateSelectOptions(selectOptions);

      const updatedAttribute = await this.db.transaction(async (tx) => {
        const attributeSelectOptions = selectOptions ?? [];
        const attributeSelectOptionValues = Array.from(
          new Set(selectOptions?.map((attributeSelectOption) => attributeSelectOption.value)),
        );

        await tx.delete(tenant.chatAttributeValueSelectOption).where(
          exists(
            tx
              .select()
              .from(tenant.selectOption)
              .where(
                and(
                  eq(tenant.selectOption.id, tenant.chatAttributeValueSelectOption.selectOptionId),
                  eq(tenant.selectOption.attributeId, id),
                  not(inArray(tenant.selectOption.value, attributeSelectOptionValues)),
                ),
              ),
          ),
        );

        await tx
          .delete(tenant.chatAttributeValue)
          .where(
            and(
              eq(tenant.chatAttributeValue.attributeId, id),
              not(
                exists(
                  tx
                    .select({ id: tenant.chatAttributeValueSelectOption.chatAttributeValueId })
                    .from(tenant.chatAttributeValueSelectOption)
                    .where(
                      eq(
                        tenant.chatAttributeValueSelectOption.chatAttributeValueId,
                        tenant.chatAttributeValue.id,
                      ),
                    ),
                ),
              ),
            ),
          );

        await tx
          .delete(tenant.selectOption)
          .where(
            and(
              eq(tenant.selectOption.attributeId, id),
              not(inArray(tenant.selectOption.value, attributeSelectOptionValues)),
            ),
          );

        await tx
          .insert(tenant.selectOption)
          .values(
            attributeSelectOptions.map((option) => ({
              id: uuidv4(),
              attributeId: id,
              value: option.value,
              label: option.label ?? null,
            })),
          )
          .onConflictDoNothing();

        await this.updateAttributeFields(tx, { id, name, isActive, type }, tenant);

        return this.getAttributeWithSelectOptions(
          tx,
          { where: eq(tenant.attribute.id, id), single: true },
          tenant,
        );
      });

      return updatedAttribute;
    }

    await this.updateAttributeFields(this.db, { id, name, isActive, type }, tenant);

    return this.getAttributeWithSelectOptions(
      this.db,
      { where: eq(tenant.attribute.id, id), single: true },
      tenant,
    );
  }

  async toggle(organizationId: string, id: string) {
    const tenant = this.tenantSchema.getTables(organizationId);
    const attribute = await this.getAttributeWithSelectOptions(
      this.db,
      { where: eq(tenant.attribute.id, id), single: true },
      tenant,
    );

    if (!attribute) {
      throw new NotFoundException(this.i18n.t('errors.attribute.notFound'));
    }

    const [updated] = await this.db
      .update(tenant.attribute)
      .set({ isActive: !attribute.isActive, updatedAt: new Date() })
      .where(eq(tenant.attribute.id, id))
      .returning();

    return this.getAttributeWithSelectOptions(
      this.db,
      { where: eq(tenant.attribute.id, updated.id), single: true },
      tenant,
    );
  }

  async disable(organizationId: string, id: string) {
    const tenant = this.tenantSchema.getTables(organizationId);

    await this.ensureAttributeExists(id, tenant);
    return await this.db
      .update(tenant.attribute)
      .set({ isActive: false })
      .where(eq(tenant.attribute.id, id))
      .returning()
      .then((rows) => rows[0] || null);
  }

  private async ensureAttributeExists(id: string, tenant: TenantTables) {
    const targetAttribute = await this.db
      .select()
      .from(tenant.attribute)
      .where(eq(tenant.attribute.id, id))
      .then((rows) => rows[0] || null);

    if (!targetAttribute) {
      throw new NotFoundException(this.i18n.t('errors.attribute.notFound'));
    }
  }

  private async validateNameDuplication(name: string, tenant: TenantTables, id?: string) {
    const conditions = [eq(sql`lower(${tenant.attribute.name})`, name.toLowerCase())];

    if (id) {
      conditions.push(not(eq(tenant.attribute.id, id)));
    }

    const { c } = await this.db
      .select({ c: count() })
      .from(tenant.attribute)
      .where(and(...conditions))
      .then((rows) => rows[0]);

    if (c > 0) {
      throw new BadRequestException(this.i18n.t('errors.attribute.duplicatedName'));
    }
  }

  private async validateSelectOptions(selectOptions?: SelectOptionInput[]) {
    if (!selectOptions || selectOptions?.length === 0) {
      throw new BadRequestException(this.i18n.t('errors.attribute.noSelectOptionsProvided'));
    }
    const selectOptionValues = selectOptions.map((selectOption) => selectOption.value);
    if (selectOptions.length > MAX_SELECT_OPTION_LENGTH) {
      throw new BadRequestException(this.i18n.t('errors.attribute.selectOptionsExceedLimit'));
    }
    const unique = Array.from(new Set(selectOptionValues));
    if (unique.length !== selectOptionValues.length) {
      throw new BadRequestException(this.i18n.t('errors.attribute.duplicatedSelectOptions'));
    }
    const isInvalidSelectOption = selectOptions.some(
      (selectOption) =>
        selectOption.value.length === 0 ||
        !/\S/.test(selectOption.value) ||
        selectOption.value.length > MAX_SELECT_OPTION_STRING_LENGTH,
    );
    if (isInvalidSelectOption) {
      throw new BadRequestException(this.i18n.t('errors.attribute.invalidSelectOption'));
    }
    return selectOptions;
  }

  private async upsertChatAttributeValue(
    db: DrizzleDB | DrizzleTransaction,
    {
      chatId,
      attributeId,
      value,
      userId,
      isEncrypted,
    }: {
      chatId: string;
      attributeId: string;
      value: string;
      userId: string;
      isEncrypted: boolean;
    },
    tenant: TenantTables,
  ) {
    // TODO(JIRA-922): redundant dual-write — the encryption trigger derives
    // valueEncrypted/isEncrypted from value (gated on attribute.isEncryptionEnabled);
    // write value only.
    const valueEncrypted = isEncrypted
      ? this.encryption.encryptValue(value)
      : Buffer.from(value, 'utf-8');

    const [chatAttributeValue] = await db
      .insert(tenant.chatAttributeValue)
      .values({
        id: uuidv4(),
        chatId,
        attributeId,
        value,
        valueEncrypted,
        userId,
        isEncrypted,
      })
      .onConflictDoUpdate({
        target: [tenant.chatAttributeValue.chatId, tenant.chatAttributeValue.attributeId],
        set: {
          value,
          valueEncrypted,
          userId,
          updatedAt: new Date(),
          isEncrypted,
        },
      })
      .returning();

    return chatAttributeValue;
  }

  private async getChatAttributeValueWithRelations(
    db: DrizzleDB | DrizzleTransaction,
    chatAttributeValueId: string,
    tenant: TenantTables,
  ) {
    const chatAttributeValue = await db
      .select({
        ...getTableColumns(tenant.chatAttributeValue),
        value: this.encryption.decryptColumnStr(
          tenant.chatAttributeValue.value,
          tenant.chatAttributeValue.valueEncrypted,
          tenant.chatAttributeValue.isEncrypted,
        ),
        user: getTableColumns(tenant.user),
        chat: { endUserId: tenant.chat.endUserId },
      })
      .from(tenant.chatAttributeValue)
      .innerJoin(tenant.user, eq(tenant.user.id, tenant.chatAttributeValue.userId))
      .innerJoin(tenant.chat, eq(tenant.chat.id, tenant.chatAttributeValue.chatId))
      .where(eq(tenant.chatAttributeValue.id, chatAttributeValueId))
      .then((rows) => rows[0] || null);

    if (!chatAttributeValue) {
      return null;
    }

    return chatAttributeValue;
  }

  private async updateAttributeFields(
    db: DrizzleDB | DrizzleTransaction,
    {
      id,
      name,
      isActive,
      type,
    }: {
      id: string;
      name: string;
      isActive: boolean;
      type: AttributeType;
    },
    tenant: TenantTables,
  ) {
    await db
      .update(tenant.attribute)
      .set({
        name,
        isActive,
        type,
        updatedAt: new Date(),
      })
      .where(eq(tenant.attribute.id, id));
  }

  private async getAttributeWithSelectOptions(
    db: DrizzleDB | DrizzleTransaction,
    options: {
      where?: SQL;
      offset?: number;
      limit?: number;
      orderBy?: SQL[];
      single: true;
    },
    tenant: TenantTables,
  ): Promise<
    | (typeof tenant.attribute.$inferSelect & {
        selectOptions: (typeof tenant.selectOption.$inferSelect)[] | null;
      })
    | null
  >;
  private async getAttributeWithSelectOptions(
    db: DrizzleDB | DrizzleTransaction,
    options: {
      where?: SQL;
      offset?: number;
      limit?: number;
      orderBy?: SQL[];
      single?: false;
    },
    tenant: TenantTables,
  ): Promise<
    (typeof tenant.attribute.$inferSelect & {
      selectOptions: (typeof tenant.selectOption.$inferSelect)[] | null;
    })[]
  >;
  private async getAttributeWithSelectOptions(
    db: DrizzleDB | DrizzleTransaction,
    options: {
      where?: SQL;
      offset?: number;
      limit?: number;
      orderBy?: SQL[];
      single?: boolean;
    },
    tenant: TenantTables,
  ) {
    const { where, offset, limit, orderBy, single } = options;

    let query = db
      .select({
        ...getTableColumns(tenant.attribute),
        selectOptions: sql<(typeof tenant.selectOption.$inferSelect)[]>`
          COALESCE(
            json_agg(
              json_build_object(
                'id', ${tenant.selectOption.id},
                'value', ${tenant.selectOption.value},
                'label', ${tenant.selectOption.label},
                'attributeId', ${tenant.selectOption.attributeId},
                'updatedAt', ${tenant.selectOption.updatedAt},
                'createdAt', ${tenant.selectOption.createdAt}
              )
              ORDER BY ${tenant.selectOption.value} ASC
            ) FILTER (WHERE ${tenant.selectOption.id} IS NOT NULL),
            '[]'
          )
        `.as('selectOptions'),
      })
      .from(tenant.attribute)
      .leftJoin(tenant.selectOption, eq(tenant.selectOption.attributeId, tenant.attribute.id))
      .$dynamic();

    if (where) {
      query = query.where(where);
    }

    query = query.groupBy(tenant.attribute.id);

    if (orderBy) {
      query = query.orderBy(...orderBy);
    }

    if (offset !== undefined) {
      query = query.offset(offset);
    }

    if (limit !== undefined) {
      query = query.limit(limit);
    }

    const rows = await query;
    const mapRow = (row: (typeof rows)[number]) => ({
      ...row,
      selectOptions: row.selectOptions.length > 0 ? row.selectOptions : null,
    });

    if (single) {
      const result = rows[0] || null;
      return result ? mapRow(result) : null;
    }

    return rows.map(mapRow);
  }
}
