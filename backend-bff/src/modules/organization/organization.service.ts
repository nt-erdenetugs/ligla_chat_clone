import {
  BadRequestException,
  Injectable,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  inArray,
  ne,
  not,
  or,
  SelectedFields,
  sql,
} from 'drizzle-orm';
import { I18nService } from 'nestjs-i18n';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';

import { MAX_OPERATOR_INPUT_LIMIT } from '@/common/constants';
import { FilterInput } from '@/common/dto/filter.args';
import { PaginationArgs } from '@/common/dto/pagination.args';
import { buildHypervisorWhere } from '@/common/utils/filter.drizzle';
import { uuidToSchemaName } from '@/common/utils/tenant';
import { DrizzleDB, DrizzleTransaction, InjectDrizzle, TenantSchemaService } from '@/drizzle';
import { adminRoles, allOperatorRoles } from '@/modules/auth/constants';
import { CoreApiService } from '@/modules/core-api/core-api.service';
import { TeamService } from '@/modules/team/team.service';
import { SystemUserType, UserRoleType, UserStatusType } from '@/modules/user/enums';
import { UserService } from '@/modules/user/user.service';
import * as shared from '@@/drizzle/public/schema';
import { TenantTables } from '@@/drizzle/tenant/schema';

import { CreateOrganizationInput } from './dto/create-organization.input';
import { UpdateOrganizationInput } from './dto/update-organization.input';
import { Organization } from './entities/organization.entity';

type DBOrganization = typeof shared.organization.$inferSelect;

type OrganizationUser = TenantTables['user']['$inferSelect'] & {
  auth: typeof shared.auth.$inferSelect;
};

type OrganizationUserLite = {
  id: string;
  displayName: string;
  roleType: UserRoleType;
  pictureUrl: string | null;
  createdAt: Date;
  updatedAt: Date | null;
  email: string;
  organizationName: string | null;
  status: UserStatusType;
  teams: {
    id: string;
    name: string;
    createdAt: Date;
  }[];
};

type AdminPayload = Awaited<ReturnType<UserService['prepareAdminPayload']>>;

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);
  private readonly organizationNameCache = new Map<string, string>();
  private readonly maxOrganizationNameCacheEntries = 1000;

  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly userService: UserService,
    private readonly teamService: TeamService,
    private readonly i18n: I18nService,
    private readonly tenantSchema: TenantSchemaService,
    private readonly coreApiService: CoreApiService,
  ) {}

  async create(createOrganizationInput: CreateOrganizationInput, hypervisorUserId: string) {
    const {
      name,
      description,
      maxOperator,
      displayName,
      apiKey,
      loginLiffId,
      fileUploadLiffId,
      emails = [],
    } = createOrganizationInput;

    this.maxOperatorCheck(maxOperator);

    const organizationId = uuidv4();

    try {
      await this.db.insert(shared.organization).values({
        id: organizationId,
        name,
        displayName,
        description,
        maxOperator,
        apiKey,
        loginLiffId,
        fileUploadLiffId,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new BadRequestException(
          this.i18n.t('errors.organization.alreadyExists', { args: { name } }),
        );
      }
      throw error;
    }

    let adminsPayload: AdminPayload[] = [];
    try {
      adminsPayload = await Promise.all(
        emails.map((email) =>
          this.userService.prepareAdminPayload({
            email,
            organizationName: name,
          }),
        ),
      );
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.logger.error(
        `Failed to prepare admin payloads for organization ${organizationId}: ${errorMessage}`,
      );

      await this.cleanupOrganizationRow(organizationId, 'after payload preparation failure');

      throw new BadRequestException(
        this.i18n.t('errors.organization.createAdminFailed', {
          args: { details: 'Failed to prepare admin users' },
        }),
      );
    }

    try {
      const provisionResult = await this.coreApiService.provisionSchema(
        organizationId,
        hypervisorUserId,
        apiKey,
      );

      this.logger.log(
        `Provisioned tenant schema for ${organizationId}: tableCount=${provisionResult.tableCount}, alreadyExisted=${provisionResult.alreadyExisted}`,
      );

      if (!provisionResult.success || provisionResult.tableCount <= 1) {
        throw new Error(
          `Schema provisioning returned invalid result: success=${provisionResult.success}, tableCount=${provisionResult.tableCount}`,
        );
      }
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.logger.error(
        `Failed to provision tenant schema for organization ${organizationId}: ${errorMessage}`,
      );

      await this.rollbackOrganizationCreation({
        organizationId,
        hypervisorUserId,
        apiKey,
        schemaProvisioned: false,
        context: 'after provisioning failure',
      });

      throw new BadRequestException(this.i18n.t('errors.organization.organizationCreateFailed'));
    }

    try {
      await this.db.transaction(async (tx) => {
        const tenant = this.tenantSchema.getTables(organizationId);

        if (adminsPayload.length > 0) {
          await this.assertNoAuthAndUserInsertConflicts(tx, adminsPayload);

          await tx.insert(shared.auth).values(
            adminsPayload.map((payload) => ({
              id: payload.id,
              organizationName: payload.organizationName,
              email: payload.email,
              hashedPassword: payload.hashedPassword,
              status: payload.status,
              createdAt: payload.createdAt ?? new Date(),
              loginAttempts: 0,
              updatedAt: payload.updatedAt ?? new Date(),
            })),
          );

          await tx.insert(tenant.user).values(
            adminsPayload.map((payload) => ({
              id: payload.id,
              displayName: payload.displayName,
              roleType: payload.roleType,
              createdAt: payload.createdAt,
              updatedAt: payload.updatedAt,
            })),
          );
        }

        await this.teamService.createDefaultTeam(tenant, tx);

        await tx
          .update(shared.organization)
          .set({ isActive: true, updatedAt: new Date() })
          .where(eq(shared.organization.id, organizationId));
      });
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.logger.error(
        `Failed to complete organization setup for ${organizationId}: ${errorMessage}`,
      );

      await this.rollbackOrganizationCreation({
        organizationId,
        hypervisorUserId,
        apiKey,
        schemaProvisioned: true,
        context: 'after setup failure',
      });

      throw new BadRequestException(
        this.i18n.t('errors.organization.createAdminFailed', {
          args: { details: 'Failed to complete organization setup' },
        }),
      );
    }

    if (emails.length > 0) {
      try {
        this.logger.log(
          `Sending invitations to ${emails.length} new admin users for organization ${name}`,
        );
        await this.handleAdminInvitations(emails, name);
        this.logger.log(`Successfully sent invitations for organization ${name}`);
      } catch (error) {
        const errorMessage = this.extractErrorMessage(error);
        this.logger.error(`Failed to send invitations for organization ${name}: ${errorMessage}`);
      }
    }

    this.cacheOrganizationName(organizationId, name);

    return this.findOneByName(name);
  }

  private extractErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private async cleanupOrganizationRow(organizationId: string, context: string): Promise<void> {
    try {
      await this.db.delete(shared.organization).where(eq(shared.organization.id, organizationId));
    } catch (cleanupError) {
      const cleanupErrorMessage = this.extractErrorMessage(cleanupError);
      this.logger.warn(
        `Failed to clean up organization row ${context} for ${organizationId}: ${cleanupErrorMessage}`,
      );
    }
  }

  private async cleanupTenantSchema(
    organizationId: string,
    hypervisorUserId: string,
    apiKey: string,
    context: string,
  ): Promise<void> {
    try {
      await this.coreApiService.deprovisionSchema(organizationId, hypervisorUserId, apiKey);
    } catch (deprovisionError) {
      const deprovisionErrorMessage = this.extractErrorMessage(deprovisionError);
      this.logger.warn(
        `Failed to deprovision tenant schema ${context} for ${organizationId}: ${deprovisionErrorMessage}`,
      );
    }
  }

  private async rollbackOrganizationCreation({
    organizationId,
    hypervisorUserId,
    apiKey,
    schemaProvisioned,
    context,
  }: {
    organizationId: string;
    hypervisorUserId: string;
    apiKey: string;
    schemaProvisioned: boolean;
    context: string;
  }): Promise<void> {
    if (schemaProvisioned) {
      await this.cleanupTenantSchema(organizationId, hypervisorUserId, apiKey, context);
    }

    await this.cleanupOrganizationRow(organizationId, context);
  }

  async findOneByName(name: string) {
    const organization = await this.getOrganizationByName(name);
    const users = await this.getOrganizationUsers(organization.id, organization.name);

    return this.aggregateOrganization(organization, users);
  }

  async findRawOneById(id: string) {
    const organization = await this.db
      .select()
      .from(shared.organization)
      .where(eq(shared.organization.id, id))
      .then((rows) => rows[0] || null);

    if (!organization) {
      throw new NotFoundException(this.i18n.t('errors.organization.notFound'));
    }

    this.cacheOrganizationName(organization.id, organization.name);

    return organization;
  }

  async getOrganizationNameById(organizationId: string): Promise<string> {
    const cachedName = this.getCachedOrganizationName(organizationId);
    if (cachedName !== undefined) {
      return cachedName;
    }

    const organization = await this.db
      .select({ name: shared.organization.name })
      .from(shared.organization)
      .where(eq(shared.organization.id, organizationId))
      .then((rows) => rows[0] || null);

    if (!organization) {
      throw new NotFoundException(this.i18n.t('errors.organization.notFound'));
    }

    this.cacheOrganizationName(organizationId, organization.name);

    return organization.name;
  }

  async resolveOrganizationId(
    role: string,
    contextOrganizationId: string | undefined,
    inputOrganizationId?: string,
  ): Promise<string> {
    if (role !== SystemUserType.HYPERVISOR) {
      if (!contextOrganizationId) {
        throw new ForbiddenException(this.i18n.t('errors.organization.invalidContext'));
      }

      return contextOrganizationId;
    }

    if (!inputOrganizationId) {
      throw new ForbiddenException(this.i18n.t('errors.organization.inputOrganizationIdRequired'));
    }

    if (!uuidValidate(inputOrganizationId)) {
      throw new ForbiddenException(this.i18n.t('errors.organization.invalidOrganizationId'));
    }

    await this.findRawOneById(inputOrganizationId);

    return inputOrganizationId;
  }

  async findAll(paginationArgs: PaginationArgs, filter?: FilterInput) {
    const { skip = 0, take = 100 } = paginationArgs;
    const where = buildHypervisorWhere(
      {
        refineConditions: filter?.refineConditions,
        searchValue: filter?.searchValue,
        searchFields: ['name', 'displayName', 'description', 'loginLiffId', 'fileUploadLiffId'],
      },
      shared.organization,
      this.i18n,
    );

    const organizations = await this.db
      .select()
      .from(shared.organization)
      .where(where)
      .orderBy(desc(shared.organization.createdAt), desc(shared.organization.name))
      .offset(skip)
      .limit(take);

    const usersByOrganizationId = await this.getOrganizationUsersForList(organizations);
    const items = organizations.map((organization) =>
      this.aggregateOrganizationWithLiteUsers(
        organization,
        usersByOrganizationId.get(organization.id) ?? [],
      ),
    );

    const { c } = await this.db
      .select({ c: count() })
      .from(shared.organization)
      .where(where)
      .then((rows) => rows[0]);

    return { items, count: c };
  }

  private async getOrganizationUsersForList(organizations: DBOrganization[]) {
    const usersByOrganizationId = new Map<string, OrganizationUserLite[]>();
    if (organizations.length === 0) {
      return usersByOrganizationId;
    }

    const BATCH_SIZE = 10;
    for (let index = 0; index < organizations.length; index += BATCH_SIZE) {
      const chunk = organizations.slice(index, index + BATCH_SIZE);
      const chunkResults = await Promise.all(
        chunk.map(async (organization) => {
          const users = await this.getOrganizationUsersLite(organization.id, organization.name);
          return [organization.id, users] as const;
        }),
      );

      for (const [organizationId, users] of chunkResults) {
        usersByOrganizationId.set(organizationId, users);
      }
    }

    return usersByOrganizationId;
  }

  private async getOrganizationUsersLite(
    organizationId: string,
    organizationName: string,
  ): Promise<OrganizationUserLite[]> {
    const tenant = this.tenantSchema.getTables(organizationId);

    try {
      const users = await this.db
        .select({
          id: tenant.user.id,
          displayName: tenant.user.displayName,
          roleType: tenant.user.roleType,
          pictureUrl: tenant.user.pictureUrl,
          createdAt: tenant.user.createdAt,
          updatedAt: tenant.user.updatedAt,
          email: shared.auth.email,
          organizationName: shared.auth.organizationName,
          status: shared.auth.status,
        })
        .from(tenant.user)
        .innerJoin(shared.auth, eq(shared.auth.id, tenant.user.id))
        .where(eq(shared.auth.organizationName, organizationName))
        .orderBy(desc(tenant.user.createdAt), desc(tenant.user.id));

      if (users.length === 0) {
        return [];
      }

      const userIds = users.map((user) => user.id);
      const userTeams = await this.db
        .select({
          userId: tenant.userTeam.userId,
          id: tenant.team.id,
          name: tenant.team.name,
          createdAt: tenant.team.createdAt,
        })
        .from(tenant.userTeam)
        .innerJoin(tenant.team, eq(tenant.team.id, tenant.userTeam.teamId))
        .where(inArray(tenant.userTeam.userId, userIds));

      const teamsByUserId = new Map<string, OrganizationUserLite['teams']>();
      for (const userTeam of userTeams) {
        const teams = teamsByUserId.get(userTeam.userId) ?? [];
        teams.push({
          id: userTeam.id,
          name: userTeam.name,
          createdAt: userTeam.createdAt,
        });
        teamsByUserId.set(userTeam.userId, teams);
      }

      return users.map((user) => ({
        ...user,
        teams: teamsByUserId.get(user.id) ?? [],
      }));
    } catch (error) {
      if (this.isMissingTenantResourceError(error)) {
        return [];
      }

      throw error;
    }
  }

  private isMissingTenantResourceError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const maybeCode =
      (error as { code?: unknown }).code ??
      (error as { cause?: { code?: unknown } }).cause?.code ??
      (error as { originalError?: { code?: unknown } }).originalError?.code;

    return maybeCode === '42P01' || maybeCode === '3F000';
  }

  async getMaxOperatorCount(organizationId: string) {
    const org = await this.db
      .select({ maxOperator: shared.organization.maxOperator })
      .from(shared.organization)
      .where(eq(shared.organization.id, organizationId))
      .then((rows) => rows[0] || null);

    return org?.maxOperator ?? 0;
  }

  async update(updateOrganizationInput: UpdateOrganizationInput) {
    const {
      name,
      description,
      maxOperator,
      displayName,
      loginLiffId,
      fileUploadLiffId,
      isActive,
      apiKey,
      emails,
    } = updateOrganizationInput;

    if (!name) {
      throw new BadRequestException(this.i18n.t('errors.organization.nameIsRequired'));
    }

    const organization = await this.validateOrganization(name, maxOperator);
    if (isActive === true && !organization.isActive) {
      await this.validateOrganizationActivationReadiness(organization.id, organization.name);
    }
    const shouldProcessEmails = emails !== undefined;
    const targetEmails = emails ?? [];

    if (shouldProcessEmails) {
      await this.validateOrganizationAdmins(organization.id, name, targetEmails);
    }
    const organizationUpdateSet: Partial<typeof shared.organization.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (description !== undefined) {
      organizationUpdateSet.description = description;
    }
    if (maxOperator !== undefined) {
      organizationUpdateSet.maxOperator = maxOperator;
    }
    if (displayName !== undefined) {
      organizationUpdateSet.displayName = displayName;
    }
    if (isActive !== undefined) {
      organizationUpdateSet.isActive = isActive;
    }
    if (apiKey !== undefined) {
      organizationUpdateSet.apiKey = apiKey;
    }
    if (loginLiffId !== undefined) {
      organizationUpdateSet.loginLiffId = loginLiffId;
    }
    if (fileUploadLiffId !== undefined) {
      organizationUpdateSet.fileUploadLiffId = fileUploadLiffId;
    }

    await this.executeAdminQueries(
      organization.id,
      name,
      targetEmails,
      organizationUpdateSet,
      shouldProcessEmails,
    );

    return this.findOneByName(name);
  }

  async aggregateOrganization(
    organization: DBOrganization | null,
    users: OrganizationUser[],
  ): Promise<Organization> {
    if (!organization) {
      throw new NotFoundException(this.i18n.t('errors.organization.notFound'));
    }

    return {
      ...organization,
      // TODO: fix maxOperator field not nullable in DB [phase 2][task 107293312]
      maxOperator: organization.maxOperator || 0,
      apiKey: organization.apiKey,
      loginLiffId: organization.loginLiffId || '',
      fileUploadLiffId: organization.fileUploadLiffId ?? null,
      users: users
        .filter((user) => adminRoles.includes(user.roleType))
        .map((user) => {
          return {
            id: user.id,
            email: user.auth.email,
            displayName: user.displayName,
            roleType: user.roleType,
            pictureUrl: user.pictureUrl || '',
            organizationName: organization.name,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            status: user.auth.status,
            systemUserType: SystemUserType.USER,
            teams: [],
          };
        }),
      operatorCount: users.filter(
        (user) =>
          user.auth.status === UserStatusType.ACTIVE && allOperatorRoles.includes(user.roleType),
      ).length,
    };
  }

  private aggregateOrganizationWithLiteUsers(
    organization: DBOrganization,
    users: OrganizationUserLite[],
  ): Organization {
    return {
      ...organization,
      maxOperator: organization.maxOperator || 0,
      apiKey: organization.apiKey,
      loginLiffId: organization.loginLiffId || '',
      fileUploadLiffId: organization.fileUploadLiffId ?? null,
      users: users
        .filter((user) => adminRoles.includes(user.roleType))
        .map((user) => ({
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          roleType: user.roleType,
          pictureUrl: user.pictureUrl || '',
          organizationName: organization.name,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          status: user.status,
          systemUserType: SystemUserType.USER,
          teams: user.teams,
        })),
      operatorCount: users.filter(
        (user) => user.status === UserStatusType.ACTIVE && allOperatorRoles.includes(user.roleType),
      ).length,
    };
  }

  private async getOrganizationByName(name: string) {
    const organization = await this.db
      .select()
      .from(shared.organization)
      .where(eq(shared.organization.name, name))
      .then((rows) => rows[0] || null);

    if (!organization) {
      throw new NotFoundException(this.i18n.t('errors.organization.notFound'));
    }

    this.cacheOrganizationName(organization.id, organization.name);

    return organization;
  }

  private getCachedOrganizationName(organizationId: string): string | undefined {
    const cachedName = this.organizationNameCache.get(organizationId);
    if (cachedName === undefined) {
      return undefined;
    }

    this.organizationNameCache.delete(organizationId);
    this.organizationNameCache.set(organizationId, cachedName);

    return cachedName;
  }

  private cacheOrganizationName(organizationId: string, organizationName: string): void {
    if (this.organizationNameCache.has(organizationId)) {
      this.organizationNameCache.delete(organizationId);
    } else if (this.organizationNameCache.size >= this.maxOrganizationNameCacheEntries) {
      const oldestKey = this.organizationNameCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.organizationNameCache.delete(oldestKey);
      }
    }

    this.organizationNameCache.set(organizationId, organizationName);
  }

  private async getOrganizationUsers(organizationId: string, organizationName: string) {
    const schemaName = uuidToSchemaName(organizationId);
    const schemaExists = await this.db
      .execute(
        sql`SELECT 1 FROM information_schema.schemata WHERE schema_name = ${schemaName} LIMIT 1`,
      )
      .then((result) => result.rows?.length > 0);

    if (!schemaExists) {
      return [];
    }

    const userTableExists = await this.db
      .execute(
        sql`
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = ${schemaName}
            AND table_name = 'user'
          LIMIT 1
        `,
      )
      .then((result) => result.rows?.length > 0);

    if (!userTableExists) {
      return [];
    }

    const tenant = this.tenantSchema.getTables(organizationId);

    return this.db
      .select({
        ...getTableColumns(tenant.user),
        auth: getTableColumns(shared.auth),
      })
      .from(tenant.user)
      .innerJoin(shared.auth, eq(shared.auth.id, tenant.user.id))
      .where(eq(shared.auth.organizationName, organizationName))
      .orderBy(desc(tenant.user.createdAt), desc(tenant.user.id));
  }

  private async validateOrganization(name: string, maxOperator?: number) {
    try {
      this.logger.log(`Validating organization: ${name}, maxOperator: ${maxOperator}`);

      if (maxOperator) this.maxOperatorCheck(maxOperator);

      const targetOrganization = await this.getOrganizationByName(name);
      const users = await this.getOrganizationUsers(targetOrganization.id, targetOrganization.name);

      this.logger.log(`Found organization ${name} with ${users.length} users`);

      if (targetOrganization.name !== name) {
        this.logger.warn(`Organization name mismatch: ${targetOrganization.name} != ${name}`);
        throw new BadRequestException(this.i18n.t('errors.organization.nameCannotBeChanged'));
      }

      if (maxOperator !== undefined) {
        const currentOperatorCount = await this.userService.findOperatorCount(
          targetOrganization.id,
        );
        this.logger.log(
          `Current operator count for ${name}: ${currentOperatorCount}, requested max: ${maxOperator}`,
        );

        if (currentOperatorCount > maxOperator) {
          this.logger.warn(
            `Max operator validation failed: current (${currentOperatorCount}) > requested max (${maxOperator})`,
          );
          throw new ForbiddenException(
            this.i18n.t('errors.organization.maxOperatorLessThanCurrentOperator', {
              args: { maxOperator, currentOperatorCount },
            }),
          );
        }
      }

      return targetOrganization;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error(`Failed to validate organization ${name}:`, error);
      throw new BadRequestException(
        this.i18n.t('errors.organization.validationFailed', {
          args: { name, error: 'validation check failed' },
        }),
      );
    }
  }

  private async validateOrganizationAdmins(organizationId: string, name: string, emails: string[]) {
    if (emails.length === 0) return;
    const tenant = this.tenantSchema.getTables(organizationId);
    // Find users in other organizations that aren't INACTIVE
    const otherOrganizationUsers = await this.db
      .select({
        email: shared.auth.email,
        organizationName: shared.auth.organizationName,
        status: shared.auth.status,
      })
      .from(shared.auth)
      .where(and(ne(shared.auth.organizationName, name), inArray(shared.auth.email, emails)));

    // If users exist in other organizations, we don't allow adding them
    if (otherOrganizationUsers.length > 0) {
      throw new BadRequestException(
        this.i18n.t('errors.organization.usersBelongToOtherOrganization', {
          args: { users: otherOrganizationUsers.join(', ') },
        }),
      );
    }

    // Find users that don't have admin roles
    const nonAdminUserEmails = await this.db
      .select({
        email: shared.auth.email,
        roleType: tenant.user.roleType,
      })
      .from(shared.auth)
      .innerJoin(tenant.user, eq(tenant.user.id, shared.auth.id))
      .where(
        and(
          eq(shared.auth.organizationName, name),
          inArray(shared.auth.email, emails),
          not(inArray(tenant.user.roleType, adminRoles as UserRoleType[])),
        ),
      );

    // Don't allow adding non-admin users as organization admins
    if (nonAdminUserEmails.length > 0) {
      type NonAdminUser = {
        email: string;
        roleType: string;
      };

      const formattedUsers = nonAdminUserEmails.map(
        (user: NonAdminUser) => `${user.email} (role: ${user.roleType})`,
      );
      throw new BadRequestException(
        this.i18n.t('errors.organization.nonAdminUsers', {
          args: { users: formattedUsers.join(', ') },
        }),
      );
    }
  }

  private async executeAdminQueries(
    organizationId: string,
    name: string,
    emails: string[],
    organizationUpdateSet?: Partial<typeof shared.organization.$inferInsert>,
    shouldProcessEmails = true,
  ) {
    try {
      this.logger.log(
        `Starting admin queries for organization: ${name} with ${emails.length} emails`,
      );

      const tenant = this.tenantSchema.getTables(organizationId);

      if (!shouldProcessEmails) {
        await this.db.transaction(async (tx) => {
          if (organizationUpdateSet) {
            await tx
              .update(shared.organization)
              .set(organizationUpdateSet)
              .where(eq(shared.organization.name, name));
          }
        });
        this.logger.log(`Skipped admin user operations for organization: ${name}`);
        return true;
      }

      const { users, usersNotInOrganization } = await this.fetchUserData(tenant, name, emails);
      this.logger.log(
        `Found ${users.length} users in organization and ${usersNotInOrganization.length} users in other organizations`,
      );

      // Categorize emails into different operations
      const emailCategories = this.categorizeEmails(users, usersNotInOrganization, emails);
      this.logger.log(
        'Email categories generated: ' +
          JSON.stringify({
            newAdmins: emailCategories.newAdminUserEmails.length,
            inactivateUsers: emailCategories.inactivateUserEmails.length,
            pendingUsersToDelete: emailCategories.pendingUsersToDelete.length,
          }),
      );

      // Log if any emails can't be processed because they're in other organizations
      if (usersNotInOrganization.length > 0) {
        const otherOrgEmails = usersNotInOrganization.map(
          (user) => `${user.email} (in organization: ${user.organizationName})`,
        );
        this.logger.warn(
          `The following emails cannot be processed because they belong to other organizations: ${otherOrgEmails.join(', ')}`,
        );
      }

      // Prepare user payloads for operations
      const { newAdminsPayload } = await this.prepareUserPayloads(name, emailCategories);
      this.logger.log(`Prepared ${newAdminsPayload.length} new admin payloads`);

      await this.db.transaction(async (tx) => {
        await this.executeTransactionOperations(
          tx,
          tenant,
          name,
          emailCategories,
          newAdminsPayload,
        );

        if (organizationUpdateSet) {
          await tx
            .update(shared.organization)
            .set(organizationUpdateSet)
            .where(eq(shared.organization.name, name));
        }
      });

      this.logger.log('Successfully executed all transaction operations');

      // Send invitations to new admin users
      if (emailCategories.newAdminUserEmails.length > 0) {
        this.logger.log(
          `Sending invitations to ${emailCategories.newAdminUserEmails.length} new admin users`,
        );
        await this.handleAdminInvitations(emailCategories.newAdminUserEmails, name);
        this.logger.log('Successfully sent all admin invitations');
      }

      this.logger.log(`Successfully completed all admin queries for organization: ${name}`);
      return true;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to execute admin queries`, error);
      throw new BadRequestException(this.i18n.t('errors.organization.failedToUpdateOrganization'));
    }
  }

  private queryUsers<T extends SelectedFields<any, any>>(
    db: DrizzleDB | DrizzleTransaction,
    tenant: TenantTables,
    columns: T = {} as T,
  ) {
    return db
      .select({
        id: shared.auth.id,
        email: shared.auth.email,
        status: shared.auth.status,
        organizationName: shared.auth.organizationName,
        ...columns,
      })
      .from(shared.auth)
      .innerJoin(tenant.user, eq(tenant.user.id, shared.auth.id));
  }

  private async fetchUserData(tenant: TenantTables, name: string, emails: string[]) {
    const query = this.queryUsers(this.db, tenant);

    const users = await query.where(
      and(
        eq(shared.auth.organizationName, name),
        inArray(tenant.user.roleType, adminRoles as UserRoleType[]),
      ),
    );

    if (emails.length === 0) {
      return { users, usersNotInOrganization: [] };
    }

    const usersNotInOrganization = await this.db
      .select({
        email: shared.auth.email,
        organizationName: shared.auth.organizationName,
        status: shared.auth.status,
      })
      .from(shared.auth)
      .where(and(ne(shared.auth.organizationName, name), inArray(shared.auth.email, emails)));

    return { users, usersNotInOrganization };
  }

  private categorizeEmails(
    users: { id: string; email: string; status: UserStatusType }[],
    usersNotInOrganization: { email: string }[],
    emails: string[],
  ) {
    const emailsNotInOrganization = usersNotInOrganization.map((user) => user.email);
    const organizationUserEmails = users.map((user) => user.email);
    const activeUserEmails = users
      .filter((user) => user.status === UserStatusType.ACTIVE)
      .map((user) => user.email);

    // We want to find PENDING users in the current organization
    // But we only want to delete them if they are NOT in the emails list
    // This is because if a PENDING user is in the emails list, we want to keep them
    const pendingUsersToDelete = users
      .filter((user) => user.status === UserStatusType.PENDING && !emails.includes(user.email))
      .map((user) => user.email);

    return {
      // New admin users are those not in the organization and not in other organizations
      newAdminUserEmails: emails.filter(
        (email) =>
          !organizationUserEmails.includes(email) && !emailsNotInOrganization.includes(email),
      ),

      // We no longer migrate users from other organizations
      migrateUserEmails: [],

      // We no longer activate users directly - they need email verification
      activateUserEmails: [],

      // Active users that are not in the emails list should be inactivated
      inactivateUserEmails: activeUserEmails.filter((email) => !emails.includes(email)),

      // Pending users that are not in the emails list should be deleted
      pendingUsersToDelete,
    };
  }

  private async prepareUserPayloads(
    name: string,
    emailCategories: ReturnType<typeof this.categorizeEmails>,
  ) {
    const newAdminsPayload = await Promise.all(
      emailCategories.newAdminUserEmails.map((email) =>
        this.userService.prepareAdminPayload({ email, organizationName: name }),
      ),
    );

    return { newAdminsPayload };
  }

  private async executeTransactionOperations(
    tx: DrizzleTransaction,
    tenant: TenantTables,
    name: string,
    emailCategories: ReturnType<typeof this.categorizeEmails>,
    newAdminsPayload: Awaited<ReturnType<typeof this.userService.prepareAdminPayload>>[],
  ) {
    try {
      const operationSummary = {
        createNewAdmins: emailCategories.newAdminUserEmails.length,
        inactivateUsers: emailCategories.inactivateUserEmails.length,
        deletePendingUsers: emailCategories.pendingUsersToDelete.length,
      };

      this.logger.log(`Starting transaction operations: ${JSON.stringify(operationSummary)}`);

      if (emailCategories.newAdminUserEmails.length > 0) {
        await this.createNewAdminUsers(
          tx,
          tenant,
          name,
          emailCategories.newAdminUserEmails,
          newAdminsPayload,
        );
      }

      if (emailCategories.inactivateUserEmails.length > 0) {
        await this.inactivateUsers(tx, tenant, emailCategories.inactivateUserEmails);
      }

      if (emailCategories.pendingUsersToDelete.length > 0) {
        await this.deletePendingUsers(tx, tenant, name, emailCategories.pendingUsersToDelete);
      }

      this.logger.log('All transaction operations completed successfully');
      return true;
    } catch (error) {
      this.logger.error('Transaction failed', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        this.i18n.t('errors.organization.transactionFailed', {
          args: { details: 'Unable to process organization user updates' },
        }),
      );
    }
  }

  private async createNewAdminUsers(
    tx: DrizzleTransaction,
    tenant: TenantTables,
    name: string,
    newAdminUserEmails: string[],
    newAdminsPayload: AdminPayload[],
  ) {
    if (newAdminUserEmails.length > 0 && newAdminsPayload.length > 0) {
      try {
        // Create a map of email to payload for reliable matching
        const emailToPayloadMap = new Map();

        // Populate the map with the prepared payloads
        newAdminsPayload.forEach((payload) => {
          if (payload && payload.email) {
            emailToPayloadMap.set(payload.email, payload);
          }
        });

        // Use only the emails that have corresponding payloads
        const validEmails = newAdminUserEmails.filter((email) => emailToPayloadMap.has(email));
        const invalidEmails = newAdminUserEmails.filter((email) => !emailToPayloadMap.has(email));

        if (invalidEmails.length > 0) {
          this.logger.warn(
            `Skipping creation for ${invalidEmails.length} users without valid payloads: ${invalidEmails.join(', ')}`,
          );
        }

        if (validEmails.length > 0) {
          const validPayloads = validEmails.map(
            (email) => emailToPayloadMap.get(email) as AdminPayload,
          );

          await this.assertNoAuthAndUserInsertConflicts(tx, validPayloads);

          this.logger.log(
            `Creating ${validEmails.length} new admin users: ${validEmails.join(', ')}`,
          );

          // First insert into auth table
          await tx.insert(shared.auth).values(
            validPayloads.map((payload) => {
              return {
                id: payload.id,
                organizationName: name,
                email: payload.email,
                hashedPassword: payload.hashedPassword,
                status: payload.status,
                createdAt: payload.createdAt ?? new Date(),
                loginAttempts: 0,
                updatedAt: payload.updatedAt ?? new Date(),
              };
            }),
          );

          // Then insert into user table
          await tx.insert(tenant.user).values(
            validPayloads.map((payload) => {
              return {
                id: payload.id,
                displayName: payload.displayName,
                roleType: payload.roleType,
                createdAt: payload.createdAt,
                updatedAt: payload.updatedAt,
              };
            }),
          );

          this.logger.log(`Successfully created ${validEmails.length} new admin users`);
        } else {
          this.logger.warn('No valid admin user payloads to create');
        }
      } catch (error) {
        this.logger.error(`Error in createNewAdminUsers:`, error);
        throw new BadRequestException(
          this.i18n.t('errors.organization.createAdminFailed', {
            args: { details: 'Failed to create admin users' },
          }),
        );
      }
    }
  }

  private async inactivateUsers(
    tx: DrizzleDB | DrizzleTransaction,
    tenant: TenantTables,
    userEmailsToDisable: string[],
  ) {
    if (userEmailsToDisable.length === 0) return;

    try {
      this.logger.log(
        `Inactivating ${userEmailsToDisable.length} users: ${userEmailsToDisable.join(', ')}`,
      );

      // ---- 1) Get users with their current status ----
      const usersToInactivate = await this.queryUsers(tx, tenant).where(
        inArray(shared.auth.email, userEmailsToDisable),
      );

      if (usersToInactivate.length === 0) {
        this.logger.warn('No users found to inactivate');
        return;
      }

      // Log current statuses
      for (const user of usersToInactivate) {
        this.logger.log(`Current status of user ${user.email}: ${user.status}`);
      }

      // ---- 2) Update by user IDs (efficient single query) ----
      const userIds = usersToInactivate.map((u) => u.id);

      await tx
        .update(shared.auth)
        .set({ status: UserStatusType.INACTIVE })
        .where(inArray(shared.auth.id, userIds));

      // ---- 3) Log updated statuses ----
      for (const user of usersToInactivate) {
        this.logger.log(`Updated status of user ${user.email}: ${user.status} -> INACTIVE`);
      }

      this.logger.log(`Successfully inactivated ${usersToInactivate.length} users`);
    } catch (error: any) {
      this.logger.error('Error inactivating users', error);
      throw new BadRequestException(
        this.i18n.t('errors.organization.inactivateUsersFailed', {
          args: {
            details: `Unable to inactivate ${userEmailsToDisable.length} user(s)`,
          },
        }),
      );
    }
  }

  private async deletePendingUsers(
    tx: DrizzleTransaction,
    tenant: TenantTables,
    orgName: string,
    pendingEmails: string[],
  ) {
    if (pendingEmails.length === 0) {
      this.logger.log('No pending users to delete');
      return true;
    }

    try {
      this.logger.log(
        `Attempting to delete ${pendingEmails.length} pending users: ${pendingEmails.join(', ')}`,
      );

      // ---- 1) Fetch candidates with relationship counts (single round-trip) ----
      const users = await this.queryUsers(tx, tenant, {
        chatCount: sql<number>`(
        select count(*)::int
        from ${tenant.chat}
        where ${tenant.chat.assignedUserId} = ${tenant.user.id}
      )`.mapWith(Number),

        teamCount: sql<number>`(
        select count(*)::int
        from ${tenant.userTeam}
        where ${tenant.userTeam.userId} = ${tenant.user.id}
      )`.mapWith(Number),

        activityCount: sql<number>`(
        select count(*)::int
        from ${tenant.chatActivity}
        where ${tenant.chatActivity.actorId} = ${tenant.user.id}
           or ${tenant.chatActivity.newUserId} = ${tenant.user.id}
           or ${tenant.chatActivity.oldUserId} = ${tenant.user.id}
      )`.mapWith(Number),

        noteCount: sql<number>`(
        select count(*)::int
        from ${tenant.note}
        where ${tenant.note.userId} = ${tenant.user.id}
      )`.mapWith(Number),

        chatAttributeCount: sql<number>`(
        select count(*)::int
        from ${tenant.chatAttributeValue}
        where ${tenant.chatAttributeValue.userId} = ${tenant.user.id}
      )`.mapWith(Number),
      }).where(
        and(eq(shared.auth.organizationName, orgName), inArray(shared.auth.email, pendingEmails)),
      );

      this.logger.log(`Found ${users.length} of ${pendingEmails.length} requested users to delete`);

      if (users.length < pendingEmails.length) {
        const found = new Set(users.map((u) => u.email));
        const notFound = pendingEmails.filter((e) => !found.has(e));
        this.logger.warn(`Could not find these users: ${notFound.join(', ')}`);
      }

      // ---- 2) Decide delete eligibility in-memory ----
      const idsToDelete: string[] = [];
      const deletableEmails: string[] = [];
      const cannotDeleteUsers: Array<{
        id: string;
        email: string;
        status: any;
        chats: number;
        teams: number;
        activities: number;
        notes: number;
        attrs: number;
      }> = [];

      for (const u of users) {
        const hasRels =
          u.chatCount > 0 ||
          u.teamCount > 0 ||
          u.activityCount > 0 ||
          u.noteCount > 0 ||
          u.chatAttributeCount > 0;

        if (u.status === UserStatusType.PENDING && !hasRels) {
          idsToDelete.push(u.id);
          deletableEmails.push(u.email);
        } else {
          cannotDeleteUsers.push({
            id: u.id,
            email: u.email,
            status: u.status,
            chats: u.chatCount,
            teams: u.teamCount,
            activities: u.activityCount,
            notes: u.noteCount,
            attrs: u.chatAttributeCount,
          });
        }
      }

      this.logger.log(
        `${idsToDelete.length} users can be deleted, ${cannotDeleteUsers.length} users cannot be deleted`,
      );

      // ---- 3) Delete (set-based, scoped) ----
      if (idsToDelete.length > 0) {
        this.logger.log(`Deleting password reset tokens for ${idsToDelete.length} users`);
        await tx
          .delete(shared.userPasswordResetToken)
          .where(inArray(shared.userPasswordResetToken.userId, idsToDelete));

        this.logger.log(`Deleting ${idsToDelete.length} users: ${deletableEmails.join(', ')}`);

        // Delete from user table first due to foreign key constraint (user.id -> auth.id)
        await tx.delete(tenant.user).where(inArray(tenant.user.id, idsToDelete));
        await tx.delete(shared.auth).where(inArray(shared.auth.id, idsToDelete));

        this.logger.log(`Successfully deleted ${idsToDelete.length} users`);
      } else {
        this.logger.log('No users to delete after validation');
      }

      // ---- 4) Log reasons for cannot-delete users (data already fetched!) ----
      if (cannotDeleteUsers.length > 0) {
        for (const u of cannotDeleteUsers.slice(0, 25)) {
          const reasons: string[] = [];

          if (u.status !== UserStatusType.PENDING) reasons.push(`status=${u.status}`);
          if (u.chats) reasons.push(`chats=${u.chats}`);
          if (u.teams) reasons.push(`teams=${u.teams}`);
          if (u.activities) reasons.push(`activities=${u.activities}`);
          if (u.attrs) reasons.push(`chatAttributes=${u.attrs}`);
          if (u.notes) reasons.push(`notes=${u.notes}`);

          this.logger.warn(`User ${u.email} cannot be deleted because: ${reasons.join(', ')}`);
        }
        if (cannotDeleteUsers.length > 25) {
          this.logger.warn(`...and ${cannotDeleteUsers.length - 25} more users were skipped`);
        }
      }

      return true;
    } catch (error: any) {
      this.logger.error('Error in deletePendingUsers', error);
      throw new BadRequestException(
        this.i18n.t('errors.organization.deletePendingUsersFailed', {
          args: { users: pendingEmails.join(', ') },
        }),
      );
    }
  }

  private async handleAdminInvitations(newAdminUserEmails: string[], organizationName: string) {
    if (newAdminUserEmails.length > 0) {
      this.logger.log(`Sending invitations to ${newAdminUserEmails.length} new admin users`);

      const organization = await this.getOrganizationByName(organizationName);
      const tenant = this.tenantSchema.getTables(organization.id);
      const failedEmails: string[] = [];
      const successfulEmails: string[] = [];

      for (const email of newAdminUserEmails) {
        try {
          this.logger.log(`Processing invitation for user: ${email}`);

          const user = await this.queryUsers(this.db, tenant, {
            displayName: tenant.user.displayName,
          })
            .where(eq(shared.auth.email, email))
            .then((rows) => rows[0] || null);

          if (!user) {
            this.logger.warn(`User not found during invitation: ${email}`);
            throw new Error(`User not found: ${email}`);
          }

          if (user.status === UserStatusType.PENDING) {
            this.logger.log(`Initiating password reset for PENDING user: ${email}`);
            await this.userService.initiatePasswordReset(email, false);
            successfulEmails.push(email);
          } else {
            this.logger.warn(
              `Skipping invitation for user ${email} with status ${user.status} - not PENDING`,
            );
            // We don't add this to failedEmails because it's an expected condition
          }
        } catch (error) {
          this.logger.error(`Failed to process invitation for ${email}:`, error);
          failedEmails.push(email);
        }
      }

      // Log the overall result
      if (successfulEmails.length > 0) {
        this.logger.log(
          `Successfully sent invitations to ${successfulEmails.length} users: ${successfulEmails.join(', ')}`,
        );
      }

      if (failedEmails.length > 0) {
        this.logger.error(
          `Failed to send invitations to ${failedEmails.length} users: ${failedEmails.join(', ')}`,
        );
        throw new BadRequestException(
          this.i18n.t('errors.organization.adminInvitationsFailed', {
            args: { details: failedEmails.join(', ') },
          }),
        );
      }

      return successfulEmails.length;
    }

    return 0;
  }

  private async assertNoAuthAndUserInsertConflicts(
    db: DrizzleDB | DrizzleTransaction,
    payloads: AdminPayload[],
  ) {
    if (payloads.length === 0) {
      return;
    }

    const emails = payloads.map((payload) => payload.email);
    const ids = payloads.map((payload) => payload.id);
    const targetOrganizationName = payloads[0].organizationName;

    if (payloads.some((payload) => payload.organizationName !== targetOrganizationName)) {
      throw new BadRequestException(
        this.i18n.t('errors.organization.transactionFailed', {
          args: {
            details: 'Inconsistent organization names detected in admin payloads',
          },
        }),
      );
    }

    const duplicateEmails = this.findDuplicateValues(emails);
    if (duplicateEmails.length > 0) {
      throw new BadRequestException(
        this.i18n.t('errors.user.alreadyExist', {
          args: { email: duplicateEmails.join(', ') },
        }),
      );
    }

    const duplicateIds = this.findDuplicateValues(ids);
    if (duplicateIds.length > 0) {
      throw new BadRequestException(
        this.i18n.t('errors.organization.transactionFailed', {
          args: {
            details: 'Duplicate admin user IDs detected in request',
          },
        }),
      );
    }

    const existingAuthRows = await db
      .select({
        id: shared.auth.id,
        email: shared.auth.email,
        organizationName: shared.auth.organizationName,
      })
      .from(shared.auth)
      .where(or(inArray(shared.auth.id, ids), inArray(shared.auth.email, emails)));

    if (existingAuthRows.length > 0) {
      const existingEmailsInAnotherOrganization = [
        ...new Set(
          existingAuthRows
            .filter((row) => row.organizationName !== targetOrganizationName)
            .map((row) => row.email),
        ),
      ];

      if (existingEmailsInAnotherOrganization.length > 0) {
        throw new BadRequestException(
          this.i18n.t('errors.organization.adminExistsInAnotherOrg', {
            args: { emails: existingEmailsInAnotherOrganization.join(', ') },
          }),
        );
      }

      const existingEmailsInOrganization = [...new Set(existingAuthRows.map((row) => row.email))];

      throw new BadRequestException(
        this.i18n.t('errors.organization.adminExistsInOrganization', {
          args: { emails: existingEmailsInOrganization.join(', ') },
        }),
      );
    }
  }

  private findDuplicateValues(values: string[]) {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const value of values) {
      if (seen.has(value)) {
        duplicates.add(value);
      } else {
        seen.add(value);
      }
    }

    return [...duplicates];
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const maybeCode =
      (error as { code?: unknown }).code ??
      (error as { cause?: { code?: unknown } }).cause?.code ??
      (error as { originalError?: { code?: unknown } }).originalError?.code;
    return maybeCode === '23505';
  }

  private async validateOrganizationActivationReadiness(
    organizationId: string,
    organizationName: string,
  ): Promise<void> {
    const schemaName = uuidToSchemaName(organizationId);

    const schemaExists = await this.db
      .execute(
        sql`SELECT 1 FROM information_schema.schemata WHERE schema_name = ${schemaName} LIMIT 1`,
      )
      .then((result) => result.rows?.length > 0);

    if (!schemaExists) {
      throw new BadRequestException(
        this.i18n.t('errors.organization.activationPrerequisitesNotMet'),
      );
    }

    const alembicVersionTableExists = await this.db
      .execute(
        sql`
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = ${schemaName}
            AND table_name = 'alembic_version'
          LIMIT 1
        `,
      )
      .then((result) => result.rows?.length > 0);

    if (!alembicVersionTableExists) {
      throw new BadRequestException(
        this.i18n.t('errors.organization.activationPrerequisitesNotMet'),
      );
    }

    const tenant = this.tenantSchema.getTables(organizationId);
    const adminCount = await this.db
      .select({ count: count() })
      .from(tenant.user)
      .innerJoin(shared.auth, eq(shared.auth.id, tenant.user.id))
      .where(
        and(
          eq(shared.auth.organizationName, organizationName),
          inArray(tenant.user.roleType, adminRoles as UserRoleType[]),
        ),
      )
      .then((rows) => rows[0]?.count || 0);

    if (Number(adminCount) === 0) {
      throw new BadRequestException(
        this.i18n.t('errors.organization.activationPrerequisitesNotMet'),
      );
    }
  }

  private maxOperatorCheck(maxOperator: number) {
    if (maxOperator > MAX_OPERATOR_INPUT_LIMIT) {
      this.logger.warn(
        `Organization create error: field maxOperator should not exceed ${MAX_OPERATOR_INPUT_LIMIT}.`,
      );
      throw new BadRequestException(
        this.i18n.t('errors.organization.maxOperatorLimitExceeded', {
          args: { length: MAX_OPERATOR_INPUT_LIMIT },
        }),
      );
    }
  }
}
