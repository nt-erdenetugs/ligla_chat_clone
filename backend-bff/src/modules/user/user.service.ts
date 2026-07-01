import { randomBytes } from 'crypto';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import * as bcrypt from 'bcrypt';
import {
  eq,
  exists,
  and,
  inArray,
  count,
  ne,
  ilike,
  getTableColumns,
  sql,
  desc,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { I18nService } from 'nestjs-i18n';
import { v4 as uuidv4 } from 'uuid';

import { ONE_HOUR } from '@/common/constants';
import { FilterInput } from '@/common/dto/filter.args';
import {
  CursorPaginatedResponse,
  CursorPaginationArgs,
  PaginationArgs,
} from '@/common/dto/pagination.args';
import { buildCursorConditions, getCursorArgs } from '@/common/utils/cursor';
import { createUserProfilePath, getDefaultPictureUrl, getPublicFileUrl } from '@/common/utils/file';
import { buildFieldFilter, buildWhereClause } from '@/common/utils/filter.drizzle';
import { generateLiffUrl } from '@/common/utils/liff';
import { buildJsonObject, normalizeDateTime } from '@/common/utils/query';
import { generateRandomPassword } from '@/common/utils/string';
import { DrizzleDB, DrizzleTransaction, InjectDrizzle, TenantSchemaService } from '@/drizzle';
import { FileService } from '@/modules/file/file.service';
import { MailService } from '@/modules/mail/mail.service';
import { TeamService } from '@/modules/team/team.service';
import * as shared from '@@/drizzle/public/schema';
import { TenantTables } from '@@/drizzle/tenant/schema';

import {
  adminRoles,
  allNonOperatorRoles,
  allOperatorRoles,
  allUserRoles,
  managerOperatorRoles,
  managerRoles,
  operatorRoles,
  SALT_OR_ROUNDS,
} from '../auth/constants';
import { ChatStatus } from '../chat/entities/chat.entity';

import { CreateAdminInput } from './dto/create-admin.input';
import { CreateUserInput } from './dto/create-user.input';
import { ResetPasswordByTokenResponse } from './dto/reset-password-by-token-response.dto';
import {
  ResetPasswordInput,
  UpdateDisplayNameInput,
  UpdateSenderNameInput,
  UpdateUserInput,
} from './dto/update-user.input';
import { EndUser, User } from './entities/user.entity';
import { UserRoleType, SystemUserType, UserStatusType } from './enums';

type UsersQuery = NonNullable<Parameters<DrizzleDB['query']['user']['findMany']>[0]>;

type DBUser = TenantTables['user']['$inferSelect'] & {
  userTeams: (TenantTables['userTeam']['$inferSelect'] & {
    team: TenantTables['team']['$inferSelect'];
  })[];
  organization?: typeof shared.organization.$inferSelect;
  auth: typeof shared.auth.$inferSelect;
};

const activeUsersFilter = eq(shared.auth.status, UserStatusType.ACTIVE);

@Injectable()
export class UserService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly teamService: TeamService,
    private readonly i18n: I18nService,
    private readonly fileService: FileService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly tenantSchema: TenantSchemaService,
  ) {}

  private readonly logger = new Logger(UserService.name);

  async create(createUserInput: CreateUserInput, organizationId: string): Promise<User> {
    const { email: emailInput, displayName, senderName, roleType, teamIds = [] } = createUserInput;
    const tenant = this.tenantSchema.getTables(organizationId);

    const email = emailInput.toLocaleLowerCase();

    const userExists = await this.findOneByEmail(email, tenant);
    const authExists = await this.findAuthByEmail(email);

    if (userExists || authExists) {
      throw new ForbiddenException(this.i18n.t('errors.user.alreadyExist', { args: { email } }));
    }

    const password = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(password, SALT_OR_ROUNDS);

    const defaultTeam = await this.teamService.findDefaultTeam(tenant);
    let { id: defaultTeamId } = defaultTeam || {};

    if (!defaultTeamId) {
      defaultTeamId = await this.teamService.createDefaultTeam(tenant);
    }

    const isExceeded = await this.isOperatorsExceeded(organizationId, createUserInput.roleType);

    if (isExceeded) throw new ForbiddenException(this.i18n.t('errors.user.maxOperatorExceeded'));

    const user = await this.db.transaction(async (tx) => {
      const organization = await tx
        .select({ name: shared.organization.name })
        .from(shared.organization)
        .where(eq(shared.organization.id, organizationId))
        .then((rows) => rows[0] || null);

      const [a] = await tx
        .insert(shared.auth)
        .values({
          id: uuidv4(),
          email,
          status: UserStatusType.PENDING,
          hashedPassword,
          organizationName: organization.name,
          loginAttempts: 0,
          mailSentAt: null,
          updatedAt: new Date(),
          createdAt: new Date(),
        })
        .returning();
      const [u] = await tx
        .insert(tenant.user)
        .values({
          id: a.id,
          displayName,
          senderName,
          roleType,
          pictureUrl: getDefaultPictureUrl(this.configService),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      if (teamIds.length > 0) {
        await tx.insert(tenant.userTeam).values(
          teamIds.map((teamId) => ({
            teamId,
            userId: u.id,
          })),
        );
      } else {
        await tx.insert(tenant.userTeam).values({
          teamId: defaultTeamId,
          userId: u.id,
        });
      }

      const user = await this.queryUsersWithTeams(tx, tenant)
        .where(eq(tenant.user.id, u.id))
        .then((rows) => rows[0] || null);

      if (!user) throw new InternalServerErrorException('Failed to create user');

      return user;
    });

    const { token } = (await this.getPasswordResetToken(user.auth.email)) || {};

    const { success, error } = await this.mailService.sendUserConfirmation(
      user.auth.email,
      token,
      user.displayName,
    );

    if (!success || error) {
      throw new BadRequestException(this.i18n.t('errors.auth.emailSendFailed'));
    }

    return this.aggregateUser(user);
  }

  async findAll(
    paginationArgs: PaginationArgs,
    organizationId: string,
    userId?: string,
    role?: string,
    filter?: FilterInput,
  ): Promise<{ items: User[]; count: number }> {
    const { skip, take } = paginationArgs;
    const tenant = this.tenantSchema.getTables(organizationId);

    const searchValue = filter?.searchValue?.trim();

    const filterWhere = buildWhereClause(
      {
        refineConditions: filter?.refineConditions,
        searchValue,
        searchFields: [
          'displayName',
          'senderName',
          {
            field: 'email',
            query: searchValue
              ? exists(
                  this.db
                    .select()
                    .from(shared.auth)
                    .where(
                      and(
                        eq(shared.auth.id, tenant.user.id),
                        ilike(shared.auth.email, `%${searchValue}%`),
                      ),
                    ),
                )
              : undefined,
            refineQuery: (option) => {
              const { condition, value } = option;
              if (!condition) return null;
              const fieldFilter = buildFieldFilter(
                shared.auth.email,
                condition,
                value,
                'email',
                this.i18n,
              );
              if (!fieldFilter) return null;
              return exists(
                this.db
                  .select()
                  .from(shared.auth)
                  .where(and(eq(shared.auth.id, tenant.user.id), fieldFilter)),
              );
            },
          },
          {
            field: 'status',
            refineQuery: (option) => {
              const { condition, value } = option;
              if (!condition) return null;
              const fieldFilter = buildFieldFilter(
                shared.auth.status,
                condition,
                value,
                'status',
                this.i18n,
              );
              if (!fieldFilter) return null;
              return exists(
                this.db
                  .select()
                  .from(shared.auth)
                  .where(and(eq(shared.auth.id, tenant.user.id), fieldFilter)),
              );
            },
          },
        ],
      },
      tenant.user,
      this.i18n,
    );

    const paginationConditions = this.paginatedManagerOperatorArgs({
      paginationArgs,
      tenant,
      userId,
      role,
    });

    const where = and(filterWhere, paginationConditions.where);

    let query = this.queryUsersWithTeams(this.db, tenant)
      .where(where)
      .orderBy(...paginationConditions.orderBy);

    if (skip) {
      query = query.offset(skip);
    }

    if (take) {
      query = query.limit(take);
    }

    const users = await query;

    const items = users.map(this.aggregateUser);
    const { c } = await this.db
      .select({ c: count() })
      .from(tenant.user)
      .where(where)
      .then((rows) => rows[0]);

    return { items, count: c };
  }

  async findAllAdminUserIds(organizationId: string) {
    const tenant = this.tenantSchema.getTables(organizationId);
    return await this.db
      .select({ id: tenant.user.id })
      .from(tenant.user)
      .where(inArray(tenant.user.roleType, adminRoles as UserRoleType[]))
      .then((rows) => rows.map((r) => r.id));
  }

  async findAllOperatorsQrUrl({
    paginationArgs,
    organizationId,
    userId,
    role,
  }: {
    organizationId: string;
    paginationArgs: PaginationArgs;
    userId?: string;
    role?: string;
  }): Promise<Pick<User, 'id' | 'qrUrl' | 'displayName' | 'email'>[]> {
    const organization = await this.db
      .select({ id: shared.organization.id, loginLiffId: shared.organization.loginLiffId })
      .from(shared.organization)
      .where(eq(shared.organization.id, organizationId))
      .then((rows) => rows[0] || null);

    if (!organization) {
      this.logger.error(`Failed QR download for org: ${organizationId}, organization not found`);
      throw new NotFoundException();
    }

    const { items: paginatedUsers } = await this.findAll(
      paginationArgs,
      organization.id,
      userId,
      role,
      {
        refineConditions: [
          { searchItem: 'status', condition: 'equals', value: UserStatusType.ACTIVE },
        ],
      },
    );

    const activeOperators = paginatedUsers.filter(
      (user) => user.status === UserStatusType.ACTIVE && allOperatorRoles.includes(user.roleType),
    );

    if (!activeOperators.length) {
      this.logger.error(
        `Failed QR download for org: ${organizationId}, no active operators on the requested page`,
      );

      throw new BadRequestException();
    }

    return activeOperators.map(({ id, displayName, email }) => {
      const { loginLiffId } = organization;
      const qrUrl =
        loginLiffId && id
          ? generateLiffUrl({
              loginLiffId,
              id,
            })
          : null;

      return {
        id,
        qrUrl,
        displayName,
        email,
      };
    });
  }

  async findByRoles(
    types: UserRoleType[],
    organizationId: string,
    paginationArgs?: CursorPaginationArgs,
    userId?: string,
  ): Promise<CursorPaginatedResponse<User>> {
    const { take, ...args } = paginationArgs || {};
    const tenant = this.tenantSchema.getTables(organizationId);
    const userTeamWhere = this.findUserTeamsWhere(tenant, userId);

    const cursorConditions = buildCursorConditions(tenant.user, args);

    const baseWhere = and(
      userTeamWhere,
      types.length !== 0 ? inArray(tenant.user.roleType, types) : undefined,
      cursorConditions?.where,
      activeUsersFilter,
    );

    const userRowsQuery = this.db
      .select({ id: tenant.user.id, createdAt: tenant.user.createdAt })
      .from(tenant.user)
      .innerJoin(shared.auth, eq(shared.auth.id, tenant.user.id))
      .where(baseWhere)
      .orderBy(...cursorConditions.orderBy);

    const userRows = take ? await userRowsQuery.limit(take + 1) : await userRowsQuery;

    const { nextCursorId, hasMore, nextCursorCreatedAt, items } = getCursorArgs(userRows, take);

    const userIds = items.map((user) => user.id);

    const query = this.queryUsersWithTeams(this.db, tenant)
      .where(inArray(tenant.user.id, userIds))
      .orderBy(...cursorConditions.orderBy);

    const users = userIds.length > 0 ? await query : [];

    const usersById = new Map(users.map((user) => [user.id, user]));
    const orderedUsers = items
      .map((user) => usersById.get(user.id))
      .filter((user): user is NonNullable<typeof user> => Boolean(user)) as DBUser[];

    return {
      items: orderedUsers.map(this.aggregateUser),
      nextCursorId,
      hasMore,
      nextCursorCreatedAt,
    };
  }

  async findOneByEmail(email: string, tenant: string): Promise<boolean>;
  async findOneByEmail(email: string, tenant: TenantTables): Promise<boolean>;
  async findOneByEmail(email: string, tenant: TenantTables | string): Promise<boolean> {
    const table = typeof tenant === 'string' ? this.tenantSchema.getTables(tenant) : tenant;

    const user = await this.db
      .select(getTableColumns(table.user))
      .from(table.user)
      .innerJoin(shared.auth, eq(shared.auth.id, table.user.id))
      .where(eq(shared.auth.email, email))
      .then((rows) => rows[0] || null);

    return Boolean(user);
  }

  private async findAuthByEmail(email: string): Promise<boolean> {
    const auth = await this.db
      .select({ id: shared.auth.id })
      .from(shared.auth)
      .where(eq(shared.auth.email, email))
      .limit(1)
      .then((rows) => rows[0] || null);

    return Boolean(auth);
  }

  // TODO: Add validation to find user in same organization [phase 2][task 107295500]
  async findOne(id: string, organizationId: string): Promise<User> {
    const user = await this.getUserFromDB(id, organizationId);
    return this.aggregateUser(user);
  }

  async findMe(id: string, organizationId: string): Promise<User> {
    const user = await this.getUserFromDB(id, organizationId);
    return this.aggregateUserWithQrUrl(user);
  }

  async findRawOne(id: string, organizationId: string) {
    const tenant = this.tenantSchema.getTables(organizationId);
    const user = await this.db
      .select({
        id: tenant.user.id,
        roleType: tenant.user.roleType,
        displayName: tenant.user.displayName,
        senderName: tenant.user.senderName,
      })
      .from(tenant.user)
      .where(eq(tenant.user.id, id))
      .then((rows) => rows[0] || null);

    if (!user) throw new NotFoundException(this.i18n.t('errors.user.notFound'));

    return user;
  }

  async findUserAuth(id: string) {
    const auth = await this.db
      .select({
        id: shared.auth.id,
        email: shared.auth.email,
        organizationName: shared.auth.organizationName,
        status: shared.auth.status,
      })
      .from(shared.auth)
      .where(eq(shared.auth.id, id))
      .then((rows) => rows[0] || null);

    if (!auth) throw new NotFoundException(this.i18n.t('errors.user.notFound'));

    return auth;
  }

  async findUserDisplayName(
    organizationId: string,
    id?: Nullable<string>,
  ): Promise<Nullable<string>> {
    return id ? (await this.findRawOne(id, organizationId)).displayName : null;
  }

  async findUserSenderName(
    organizationId: string,
    id?: Nullable<string>,
  ): Promise<Nullable<string>> {
    if (!id) return null;
    const { senderName, displayName } = await this.findRawOne(id, organizationId);
    return senderName || displayName;
  }

  async findOneEndUser(id: string, organizationId: string): Promise<EndUser> {
    const tenant = this.tenantSchema.getTables(organizationId);
    const user = await this.db
      .select()
      .from(tenant.endUser)
      .where(eq(tenant.endUser.userId, id))
      .then((rows) => rows[0] || null);

    if (!user) throw new NotFoundException(this.i18n.t('errors.user.notFound'));

    return user;
  }

  async update(updateUserInput: UpdateUserInput, organizationId: string): Promise<User> {
    const { id, status, ...data } = updateUserInput;

    const tenant = this.tenantSchema.getTables(organizationId);

    const user = await this.findOne(id, organizationId);

    const isAdminUser = adminRoles.includes(user.roleType);

    const isAttemptingToChangeAdminRole =
      isAdminUser && managerOperatorRoles.includes(data.roleType);

    const isAttemptingToDisableUser =
      user.status === UserStatusType.ACTIVE && status === UserStatusType.INACTIVE;

    if (isAdminUser && isAttemptingToDisableUser) {
      await this.validateOrganizationAdmin(id, tenant);
    }

    if (isAttemptingToChangeAdminRole) {
      throw new ForbiddenException(this.i18n.t('errors.user.adminToNonAdminError'));
    }

    const userStatus = status as UserStatusType;
    const isAttemptingToChangeStatus = userStatus && userStatus !== user.status;

    const isAttemptingToAddOperatorRole =
      allNonOperatorRoles.includes(user.roleType) && allOperatorRoles.includes(data.roleType);

    if (
      isAttemptingToAddOperatorRole ||
      (userStatus === UserStatusType.ACTIVE && isAttemptingToChangeStatus)
    ) {
      const isExceeded = await this.isOperatorsExceeded(organizationId, data.roleType);

      if (isExceeded) throw new ForbiddenException(this.i18n.t('errors.user.maxOperatorExceeded'));
    }

    const isAttemptingToRemoveOperatorRole =
      allNonOperatorRoles.includes(data.roleType) && allOperatorRoles.includes(user.roleType);

    if (isAttemptingToChangeStatus || isAttemptingToRemoveOperatorRole) {
      if (isAttemptingToRemoveOperatorRole || userStatus !== UserStatusType.ACTIVE) {
        await this.validateUserChats(id, tenant);
      }

      await this.db.transaction(async (tx) => {
        await tx
          .update(shared.auth)
          .set({ status: userStatus, loginAttempts: 0 })
          .where(eq(shared.auth.id, id));
        await tx.update(tenant.user).set(data).where(eq(tenant.user.id, id));
      });

      return this.findOne(id, organizationId);
    }

    const updatedUser = await this.updateAndReturnUser(id, data, tenant);

    return this.aggregateUser(updatedUser);
  }

  async updateWithValidation(
    updateUserInput: UpdateUserInput,
    organizationId: string,
    role: string,
    userId: string,
  ): Promise<User> {
    const targetUser = await this.findOne(updateUserInput.id, organizationId);

    const hasLowerRole =
      managerOperatorRoles.includes(role) && adminRoles.includes(targetUser.roleType);

    if (hasLowerRole) {
      throw new UnauthorizedException(this.i18n.t('errors.user.unauthorized'));
    }

    const { items: adminUsers } = await this.findByRoles(
      adminRoles as UserRoleType[],
      organizationId,
    );

    if (
      adminUsers.length === 1 &&
      adminUsers[0].id === targetUser.id &&
      !adminRoles.includes(updateUserInput.roleType)
    ) {
      throw new BadRequestException(this.i18n.t('errors.user.lastAdmin'));
    }

    if (
      targetUser.status !== updateUserInput.status &&
      updateUserInput.status === UserStatusType.INACTIVE
    ) {
      const activeAdminCount = adminUsers.filter(
        (admin) => admin.status === UserStatusType.ACTIVE,
      ).length;
      const isTargetActiveAdmin =
        adminRoles.includes(targetUser.roleType) && targetUser.status === UserStatusType.ACTIVE;

      if (activeAdminCount === 1 && isTargetActiveAdmin) {
        throw new BadRequestException(this.i18n.t('errors.user.lastAdmin'));
      }

      this.validateUserToggleStatus(userId, targetUser.id);
    } else if (targetUser.status !== updateUserInput.status) {
      this.validateUserToggleStatus(userId, targetUser.id);
    }

    return this.update(updateUserInput, organizationId);
  }

  async toggleStatus(
    id: string,
    organizationId: string,
    userId: string,
    role: string,
  ): Promise<User> {
    const { displayName, status: prevStatus, roleType } = await this.findOne(id, organizationId);

    if (prevStatus === UserStatusType.PENDING) {
      throw new BadRequestException(this.i18n.t('errors.user.pending'));
    }

    const status: UserStatusType =
      prevStatus === UserStatusType.INACTIVE || prevStatus === UserStatusType.LOCKED
        ? UserStatusType.ACTIVE
        : UserStatusType.INACTIVE;

    return this.updateWithValidation(
      { id, displayName, status, roleType: roleType as UserRoleType },
      organizationId,
      role,
      userId,
    );
  }

  private async updateAndReturnUser(
    userId: string,
    data: Partial<TenantTables['user']['$inferSelect'] & { hashedPassword: string }>,
    tenant: TenantTables,
  ): Promise<DBUser> {
    return await this.db.transaction(async (tx) => {
      const [updatedUser] = await tx
        .update(tenant.user)
        .set(data)
        .where(eq(tenant.user.id, userId))
        .returning();

      const u = await this.queryUsersWithTeams(tx, tenant)
        .where(eq(tenant.user.id, updatedUser.id))
        .then((rows) => rows[0] || null);

      if (!u) {
        throw new InternalServerErrorException('Failed to create user');
      }

      return u;
    });
  }

  async updateDisplayName(
    id: string,
    { displayName }: UpdateDisplayNameInput,
    organizationId: string,
  ): Promise<User> {
    const tenant = this.tenantSchema.getTables(organizationId);
    const user = await this.updateAndReturnUser(id, { displayName }, tenant);
    return this.aggregateUser(user);
  }

  async updateSenderName(
    id: string,
    { senderName }: UpdateSenderNameInput,
    organizationId: string,
  ): Promise<User> {
    const tenant = this.tenantSchema.getTables(organizationId);
    const user = await this.updateAndReturnUser(id, { senderName: senderName || null }, tenant);
    return this.aggregateUser(user);
  }

  async updateUserProfileUrl(
    id: string,
    organizationId: string,
    organizationName: string,
    uploadedFile: Express.Multer.File,
  ): Promise<Nullable<string>> {
    const tenant = this.tenantSchema.getTables(organizationId);

    const targetUser = await this.db
      .select({ pictureUrl: tenant.user.pictureUrl })
      .from(tenant.user)
      .where(eq(tenant.user.id, id))
      .then((rows) => rows[0] || null);

    if (!targetUser) {
      throw new NotFoundException(this.i18n.t('errors.user.notFound'));
    }

    try {
      const filePath = createUserProfilePath(organizationName, id);
      const publicBucketName = this.configService.get('GCP_STORAGE_CHAT_PUBLIC_DATA_BUCKET');
      const publicMediaUrl = this.configService.get('GCP_STORAGE_CHAT_PUBLIC_MEDIA_URL');

      if (!publicMediaUrl && !publicBucketName) {
        this.logger.error('Missing publicMediaUrl or publicBucketName in environment variables');
        throw new Error('Missing publicMediaUrl or publicBucketName in environment variables');
      }

      const pictureUrl = getPublicFileUrl(filePath, publicBucketName, publicMediaUrl);

      await this.fileService.savePublic(uploadedFile, filePath).then(async () => {
        await this.updateAndReturnUser(id, { pictureUrl }, tenant);
      });

      return pictureUrl;
    } catch (error) {
      this.logger.error(`Failed to update profile picture for user: ${id}`, error);
      return targetUser.pictureUrl;
    }
  }

  async updatePassword(
    id: string,
    resetPasswordInput: ResetPasswordInput,
    organizationId: string,
  ): Promise<User> {
    const { newPassword, currentPassword } = resetPasswordInput;
    const tenant = this.tenantSchema.getTables(organizationId);

    const targetUser = await this.db
      .select({ hashedPassword: shared.auth.hashedPassword })
      .from(tenant.user)
      .innerJoin(shared.auth, eq(shared.auth.id, tenant.user.id))
      .where(eq(tenant.user.id, id))
      .then((rows) => rows[0] || null);

    if (!targetUser) {
      throw new NotFoundException(this.i18n.t('errors.user.notFound'));
    }

    const isPasswordMatch = await bcrypt.compare(currentPassword, targetUser.hashedPassword);

    if (!isPasswordMatch) {
      throw new UnauthorizedException(this.i18n.t('errors.auth.passwordIsIncorrect'));
    }
    const hashedPassword = await bcrypt.hash(newPassword, SALT_OR_ROUNDS);

    // Update password in auth table
    await this.db.update(shared.auth).set({ hashedPassword }).where(eq(shared.auth.id, id));

    return this.findOne(id, organizationId);
  }

  async initiatePasswordReset(email: string, reset = false): Promise<boolean> {
    const normalizedEmail = email.toLowerCase();

    try {
      const payload = await this.getPasswordResetToken(normalizedEmail);

      if (!payload?.token || !payload.user) {
        return true;
      }

      const result = await this.mailService.sendUserConfirmation(
        normalizedEmail,
        payload.token,
        payload.user.displayName || '',
        reset,
      );

      if (!result.success) {
        this.logger.error(result.error?.message || 'Failed to send email');
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.logger.warn('Password reset requested for unknown or inactive email');
        return true;
      }

      this.logger.error('Failed to initiate password reset', error);
    }

    return true;
  }

  async resetPasswordByToken(
    token: string,
    newPassword: string,
  ): Promise<ResetPasswordByTokenResponse> {
    const userId = await this.validateResetToken(token);
    const user = await this.db
      .select()
      .from(shared.auth)
      .where(eq(shared.auth.id, userId))
      .then((rows) => rows[0] || null);

    if (!user) {
      throw new NotFoundException(this.i18n.t('errors.user.notFound'));
    }

    if (user.status === UserStatusType.INACTIVE) {
      throw new ForbiddenException(this.i18n.t('errors.user.inactiveUserResetPassword'));
    }

    let shouldSetInactiveAfterVerification = false;

    if (user.status === UserStatusType.PENDING) {
      if (!user.organizationName) {
        throw new NotFoundException(this.i18n.t('errors.organization.notFound'));
      }

      const organization = await this.db
        .select({ id: shared.organization.id, maxOperator: shared.organization.maxOperator })
        .from(shared.organization)
        .where(eq(shared.organization.name, user.organizationName))
        .then((rows) => rows[0] || null);

      if (!organization) {
        throw new NotFoundException(this.i18n.t('errors.organization.notFound'));
      }

      const tenant = this.tenantSchema.getTables(organization.id);
      const pendingUser = await this.db
        .select({ roleType: tenant.user.roleType })
        .from(tenant.user)
        .where(eq(tenant.user.id, userId))
        .then((rows) => rows[0] || null);

      if (!pendingUser) {
        throw new NotFoundException(this.i18n.t('errors.user.notFound'));
      }

      if (allOperatorRoles.includes(pendingUser.roleType) && organization.maxOperator) {
        const operatorCount = await this.findOperatorCount(organization.id);
        if (operatorCount >= organization.maxOperator) {
          shouldSetInactiveAfterVerification = true;
        }
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_OR_ROUNDS);

    const data = await this.db.transaction(async (tx) => {
      await tx
        .update(shared.auth)
        .set({
          hashedPassword,
          ...(shouldSetInactiveAfterVerification
            ? { status: UserStatusType.INACTIVE }
            : user.status === UserStatusType.LOCKED || user.status === UserStatusType.PENDING
              ? { status: UserStatusType.ACTIVE }
              : {}),
        })
        .where(eq(shared.auth.id, userId));
      await tx
        .delete(shared.userPasswordResetToken)
        .where(eq(shared.userPasswordResetToken.userId, userId));

      return true;
    });

    return {
      success: !!data,
      warning: shouldSetInactiveAfterVerification
        ? this.i18n.t('errors.user.verifyOperatorLimitExceeded')
        : null,
    };
  }

  async validateResetToken(token: string): Promise<string> {
    const passwordResetToken = await this.db
      .select({
        authId: shared.auth.id,
        token: shared.userPasswordResetToken.token,
        expiresAt: shared.userPasswordResetToken.expiresAt,
      })
      .from(shared.userPasswordResetToken)
      .innerJoin(shared.auth, eq(shared.auth.id, shared.userPasswordResetToken.userId))
      .where(eq(shared.userPasswordResetToken.token, token))
      .then((rows) => rows[0] || null);

    if (!passwordResetToken || passwordResetToken.expiresAt < new Date()) {
      throw new NotFoundException(this.i18n.t('errors.auth.invalidToken'));
    }

    return passwordResetToken.authId;
  }

  private async getPasswordResetToken(email: string) {
    try {
      const auth = await this.db
        .select({ ...getTableColumns(shared.auth), organizationId: shared.organization.id })
        .from(shared.auth)
        .where(sql`LOWER(${shared.auth.email}) = LOWER(${email})`)
        .innerJoin(shared.organization, eq(shared.organization.name, shared.auth.organizationName))
        .then((rows) => rows[0] || null);

      if (!auth || auth.status === UserStatusType.INACTIVE) {
        throw new NotFoundException(this.i18n.t('errors.user.notFound'));
      }

      const isResetTokenExists = await this.db
        .select()
        .from(shared.userPasswordResetToken)
        .where(eq(shared.userPasswordResetToken.userId, auth.id))
        .then((rows) => rows[0] || null);

      const tenant = this.tenantSchema.getTables(auth.organizationId);
      const user = await this.db
        .select({ displayName: tenant.user.displayName })
        .from(tenant.user)
        .where(eq(tenant.user.id, auth.id))
        .then((rows) => rows[0] || null);

      if (isResetTokenExists && isResetTokenExists.expiresAt > new Date()) {
        return {
          token: isResetTokenExists.token,
          user: { ...auth, displayName: user?.displayName },
        };
      }

      const token = randomBytes(32).toString('hex');

      const tokenExpirationHours = 24;
      const expiryTime = new Date(Date.now() + tokenExpirationHours * ONE_HOUR);

      const payload = {
        token,
        expiresAt: expiryTime,
        createdAt: new Date(),
      };

      await this.db
        .insert(shared.userPasswordResetToken)
        .values({ userId: auth.id, ...payload })
        .onConflictDoUpdate({
          target: [shared.userPasswordResetToken.userId],
          set: {
            token: token,
            expiresAt: expiryTime,
            createdAt: new Date(),
          },
        });

      return { token, user: { ...auth, displayName: user?.displayName } };
    } catch (error) {
      // Re-throw NotFoundException so it propagates to the caller
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get password reset token for email: ${email}`, error);
    }
  }

  async remove(id: string): Promise<boolean> {
    const auth = await this.db
      .select({ ...getTableColumns(shared.auth), organizationId: shared.organization.id })
      .from(shared.auth)
      .innerJoin(shared.organization, eq(shared.organization.name, shared.auth.organizationName))
      .where(eq(shared.auth.id, id))
      .then((rows) => rows[0] || null);

    if (!auth) {
      throw new NotFoundException(this.i18n.t('errors.user.notFound'));
    }

    const tenant = this.tenantSchema.getTables(auth.organizationId);

    const assigneeUsers = await this.db
      .select()
      .from(tenant.chat)
      .where(eq(tenant.chat.assignedUserId, id));

    if (assigneeUsers.length === 0) {
      await this.db
        .update(shared.auth)
        .set({ status: UserStatusType.INACTIVE })
        .where(eq(shared.auth.id, id));
    } else {
      throw new ForbiddenException(this.i18n.t('errors.user.cannotDeleteAssigneeUser'));
    }
    return true;
  }

  async prepareAdminPayload(createAdminInput: CreateAdminInput): Promise<
    TenantTables['user']['$inferInsert'] & {
      email: string;
      hashedPassword: string;
      status: UserStatusType;
      organizationName: string;
    }
  > {
    const { email, organizationName } = createAdminInput;

    const password = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(password, SALT_OR_ROUNDS);

    const defaultUserName = email.split('@')[0];

    return {
      id: uuidv4(),
      email,
      hashedPassword,
      displayName: defaultUserName,
      status: UserStatusType.PENDING,
      roleType: UserRoleType.ADMIN,
      createdAt: new Date(),
      updatedAt: new Date(),
      organizationName,
    };
  }

  async findOperatorCount(organizationId: string): Promise<number> {
    const tenant = this.tenantSchema.getTables(organizationId);

    const { c } = await this.db
      .select({ c: count() })
      .from(tenant.user)
      .innerJoin(shared.auth, eq(shared.auth.id, tenant.user.id))
      .where(
        and(inArray(tenant.user.roleType, allOperatorRoles as UserRoleType[]), activeUsersFilter),
      )
      .then((rows) => rows[0]);

    return c;
  }

  async findAllSelectableOperators(
    organizationId: string,
    paginationArgs?: CursorPaginationArgs,
  ): Promise<CursorPaginatedResponse<User>> {
    const { take, ...args } = paginationArgs || {};
    const tenant = this.tenantSchema.getTables(organizationId);

    const cursorConditions = buildCursorConditions(tenant.user, args);

    const where = and(
      inArray(tenant.user.roleType, operatorRoles as UserRoleType[]),
      cursorConditions?.where,
      activeUsersFilter,
    );

    const userRowsQuery = this.db
      .select({ id: tenant.user.id, createdAt: tenant.user.createdAt })
      .from(tenant.user)
      .innerJoin(shared.auth, eq(shared.auth.id, tenant.user.id))
      .where(where)
      .orderBy(...cursorConditions.orderBy);

    const userRows = take ? await userRowsQuery.limit(take + 1) : await userRowsQuery;

    const { nextCursorId, hasMore, nextCursorCreatedAt, items } = getCursorArgs(userRows, take);

    const userIds = items.map((user) => user.id);

    const query = this.queryUsersWithTeams(this.db, tenant)
      .where(inArray(tenant.user.id, userIds))
      .orderBy(...cursorConditions.orderBy);

    const users = userIds.length > 0 ? await query : [];

    const usersById = new Map(users.map((user) => [user.id, user]));
    const orderedUsers = items
      .map((user) => usersById.get(user.id))
      .filter((user): user is NonNullable<typeof user> => Boolean(user)) as DBUser[];

    return {
      items: orderedUsers.map(this.aggregateUser),
      nextCursorId,
      nextCursorCreatedAt,
      hasMore,
    };
  }

  private async getUserFromDB(id: string, organizationId: string): Promise<DBUser> {
    const tenant = this.tenantSchema.getTables(organizationId);

    const user = await this.queryUsersWithTeams(this.db, tenant)
      .where(eq(tenant.user.id, id))
      .then((rows) => rows[0] || null);

    if (!user) throw new NotFoundException(this.i18n.t('errors.user.notFound'));

    return user;
  }

  private isOperatorsExceeded = async (organizationId: string, role: string) => {
    const isOperator = allOperatorRoles.includes(role);
    if (!isOperator) return false;

    const organization = await this.db
      .select()
      .from(shared.organization)
      .where(eq(shared.organization.id, organizationId))
      .then((rows) => rows[0] || null);

    const maxOperator = organization?.maxOperator;

    if (maxOperator) {
      const operatorCount = await this.findOperatorCount(organizationId);

      return operatorCount >= maxOperator;
    }
    return false;
  };

  private async validateOrganizationAdmin(userId: string, tenant: TenantTables) {
    const [{ adminCount }] = await this.db
      .select({ adminCount: count() })
      .from(tenant.user)
      .innerJoin(shared.auth, eq(shared.auth.id, tenant.user.id))
      .where(
        and(
          ne(tenant.user.id, userId),
          activeUsersFilter,
          inArray(tenant.user.roleType, adminRoles as UserRoleType[]),
        ),
      );

    if (adminCount === 0) {
      throw new BadRequestException(this.i18n.t('errors.user.lastAdmin'));
    }
  }

  private validateUserChats = async (userId: string, tenant: TenantTables) => {
    const [{ activeChatCount }] = await this.db
      .select({ activeChatCount: count() })
      .from(tenant.chat)
      .where(
        and(
          eq(tenant.chat.assignedUserId, userId),
          eq(tenant.chat.chatStatus, ChatStatus.ADDRESSING),
        ),
      );

    if (activeChatCount > 0) {
      throw new ForbiddenException(this.i18n.t('errors.user.hasOngoingChat'));
    }
  };

  private validateUserToggleStatus(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new BadRequestException(this.i18n.t('errors.user.cannotDeactivateSelf'));
    }
  }

  private aggregateUser(user: DBUser): User {
    const { userTeams, organization, auth, ...rest } = user;

    return {
      ...rest,
      createdAt: normalizeDateTime(rest.createdAt) ?? rest.createdAt,
      email: auth.email,
      status: auth.status!,
      systemUserType: SystemUserType.USER,
      teams: userTeams.map(({ team }) => ({
        ...team,
        createdAt: normalizeDateTime(team.createdAt) ?? team.createdAt,
        updatedAt: normalizeDateTime(team.updatedAt) ?? team.updatedAt,
      })),
      organization,
    };
  }

  private aggregateUserWithQrUrl(user: DBUser): User {
    const { id, organization } = user;

    return {
      ...this.aggregateUser(user),
      qrUrl: this.generateUserQrUrl(id, organization),
    };
  }

  private generateUserQrUrl(
    id: string,
    organization?: typeof shared.organization.$inferSelect,
  ): string {
    const { name, loginLiffId } = organization || {};
    if (!loginLiffId) {
      this.logger.error(
        `Missing organization login LIFF ID for QR generation: ${JSON.stringify({
          organizationName: name,
          userId: id,
        })}`,
      );
      return '';
    }

    return generateLiffUrl({
      loginLiffId,
      id,
    });
  }

  private queryUsersWithTeams(db: DrizzleDB | DrizzleTransaction, tenant: TenantTables) {
    const userTeamWithTeam = {
      ...getTableColumns(tenant.userTeam),
      team: sql`(
        SELECT ${buildJsonObject(getTableColumns(tenant.team))}
        FROM ${tenant.team}
        WHERE ${tenant.team.id} = ${tenant.userTeam.teamId}
      )`,
    };

    return db
      .select({
        ...getTableColumns(tenant.user),
        auth: getTableColumns(shared.auth),
        organization: sql<typeof shared.organization.$inferSelect>`(
          SELECT ${buildJsonObject(getTableColumns(shared.organization))}
          FROM ${shared.organization}
          WHERE ${shared.organization.name} = ${shared.auth.organizationName}
        )`.as('organization'),
        userTeams: sql<DBUser['userTeams']>`(
          SELECT COALESCE(
            json_agg(${buildJsonObject(userTeamWithTeam)}), '[]'::json
          )
          FROM ${tenant.userTeam}
          WHERE ${tenant.userTeam.userId} = ${tenant.user.id}
        )`.as('userTeams'),
      })
      .from(tenant.user)
      .innerJoin(shared.auth, eq(shared.auth.id, tenant.user.id))
      .$dynamic();
  }

  private paginatedManagerOperatorArgs({
    paginationArgs,
    tenant,
    userId,
    role,
  }: {
    paginationArgs: PaginationArgs;
    tenant: TenantTables;
    userId?: string;
    role?: string;
  }) {
    const { skip = 0, take = 100 } = paginationArgs;

    const userTeamWhere = this.findUserTeamsWhere(tenant, userId);

    let acceptedRoleTypes = allOperatorRoles as UserRoleType[];
    if (role && managerRoles.includes(role)) {
      acceptedRoleTypes = managerOperatorRoles as UserRoleType[];
    } else if (role && adminRoles.includes(role)) {
      acceptedRoleTypes = allUserRoles as UserRoleType[];
    } else if (userId) {
      acceptedRoleTypes = managerOperatorRoles as UserRoleType[];
    }

    const roleTypeWhere = inArray(tenant.user.roleType, acceptedRoleTypes);

    const where = and(roleTypeWhere, userTeamWhere);

    return {
      where,
      orderBy: [desc(tenant.user.createdAt), desc(tenant.user.id)],
      offset: skip,
      limit: take,
    } satisfies UsersQuery;
  }

  private findUserTeamsWhere(tenant: TenantTables, userId?: string) {
    if (!userId) return;

    const ut1 = alias(tenant.userTeam, 'ut1');
    const ut2 = alias(tenant.userTeam, 'ut2');

    return exists(
      this.db
        .select()
        .from(ut1)
        .where(
          and(
            eq(ut1.userId, tenant.user.id),
            exists(
              this.db
                .select()
                .from(ut2)
                .where(and(eq(ut2.teamId, ut1.teamId), eq(ut2.userId, userId))),
            ),
          ),
        ),
    );
  }
}
