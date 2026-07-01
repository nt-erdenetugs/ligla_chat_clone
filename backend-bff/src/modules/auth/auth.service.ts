import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import * as bcrypt from 'bcrypt';
import { eq, sql } from 'drizzle-orm';
import { I18nService } from 'nestjs-i18n';

import { MAX_LOGIN_ATTEMPTS, ONE_HOUR } from '@/common/constants';
import { DrizzleDB, InjectDrizzle, TenantSchemaService } from '@/drizzle';
import { increment } from '@/drizzle/utils';
import * as shared from '@@/drizzle/public/schema';
import type { TenantTables } from '@@/drizzle/tenant/schema';

import { UserStatusType } from '../user/enums';

import { LoginInput } from './dto/login.input';
import { Auth } from './entities/auth.entity';

type PayloadType = {
  userId: string;
  isHypervisor: boolean;
};

type TenantUser = TenantTables['user']['$inferSelect'];
type User = typeof shared.auth.$inferSelect & { user: TenantUser | null };
type HypervisorUser = typeof shared.hypervisorUser.$inferSelect;

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private readonly i18n: I18nService,
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly tenantSchema: TenantSchemaService,
  ) {}

  private readonly logger = new Logger(AuthService.name);

  async findHypervisorUser(email: string): Promise<HypervisorUser | null> {
    try {
      return await this.db
        .select()
        .from(shared.hypervisorUser)
        .where(sql`LOWER(${shared.hypervisorUser.email}) = LOWER(${email})`)
        .then((rows) => rows[0] || null);
    } catch (error) {
      this.logger.error(`Failed to look up hypervisor user for email: ${email}`, error);
      return null;
    }
  }

  async findRegularUser(email: string): Promise<User | null> {
    const auth = await this.db
      .select()
      .from(shared.auth)
      .where(sql`LOWER(${shared.auth.email}) = LOWER(${email})`)
      .then((rows) => rows[0] || null);

    if (!auth) return null;

    if (!auth.organizationName) {
      return { ...auth, user: null };
    }

    const organization = await this.getOrganization(auth.organizationName);

    if (!organization) {
      return { ...auth, user: null };
    }

    const tenant = this.tenantSchema.getTables(organization.id);
    const user = await this.db
      .select()
      .from(tenant.user)
      .where(eq(tenant.user.id, auth.id))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    return { ...auth, user };
  }

  async validatePassword(user: User | HypervisorUser, password: string, isHypervisor: boolean) {
    const isPasswordValid = await bcrypt.compare(password, user.hashedPassword);

    if (!isPasswordValid) {
      if (!isHypervisor) {
        await this.db
          .update(shared.auth)
          .set({ loginAttempts: increment(shared.auth.loginAttempts) })
          .where(eq(shared.auth.id, user.id));
      }
      this.logger.error(`Invalid password for user with email ${user.email}`);
      throw new UnauthorizedException(this.i18n.t('errors.auth.emailOrPasswordIsIncorrect'));
    }

    if (isHypervisor) return;

    await this.db.update(shared.auth).set({ loginAttempts: 0 }).where(eq(shared.auth.id, user.id));
  }

  generateJwt(user: User | HypervisorUser, isHypervisor: boolean): Auth {
    const payload: PayloadType = { userId: user.id, isHypervisor };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
    };
  }

  async authenticate(loginInput: LoginInput, isHypervisor: boolean): Promise<Auth> {
    const { email, password } = loginInput;

    const normalizedEmail = email.toLocaleLowerCase();

    this.logger.log(`Authenticating user with email: ${normalizedEmail}`);

    const auth = isHypervisor
      ? await this.findHypervisorUser(normalizedEmail)
      : await this.findRegularUser(normalizedEmail);

    if (!auth || (this.isRegularUser(auth) && !auth.user)) {
      throw new ForbiddenException(this.i18n.t('errors.auth.emailOrPasswordIsIncorrect'));
    }

    const isRegularUser = isHypervisor === false && this.isRegularUser(auth);

    if (isRegularUser && auth.organizationName) {
      const organization = await this.getOrganization(auth.organizationName);

      if (organization && !organization.isActive) {
        throw new UnauthorizedException(this.i18n.t('errors.auth.emailOrPasswordIsIncorrect'));
      }
    }

    if (isRegularUser) {
      const isInactiveOrPending =
        isRegularUser &&
        (auth.status === UserStatusType.INACTIVE || auth.status === UserStatusType.PENDING);

      if (isInactiveOrPending) {
        this.logger.error(`User with email ${normalizedEmail} is inactive or pending`);
        throw new UnauthorizedException(this.i18n.t('errors.auth.emailOrPasswordIsIncorrect'));
      }

      if (auth.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        const now = new Date().getTime();
        const lastLoginAttempt = auth.updatedAt?.getTime() ?? 0;

        if (lastLoginAttempt && now - lastLoginAttempt > ONE_HOUR) {
          await this.db
            .update(shared.auth)
            .set({ loginAttempts: 0, status: UserStatusType.ACTIVE })
            .where(eq(shared.auth.id, auth.id));

          await this.validatePassword(auth, password, isHypervisor);
          return this.generateJwt(auth, isHypervisor);
        }

        if (auth.status !== UserStatusType.LOCKED) {
          await this.db
            .update(shared.auth)
            .set({ status: UserStatusType.LOCKED })
            .where(eq(shared.auth.id, auth.id));
        }

        this.logger.error(`User with email ${normalizedEmail} is locked`);
        throw new UnauthorizedException(this.i18n.t('errors.auth.emailOrPasswordIsIncorrect'));
      }
    }
    await this.validatePassword(auth, password, isHypervisor);

    this.logger.log(`User with email ${normalizedEmail} authenticated successfully`);
    return this.generateJwt(auth, isHypervisor);
  }

  private isRegularUser(auth: unknown): auth is User {
    const user = auth as User;
    return (
      !!user && typeof user.organizationName === 'string' && typeof user.loginAttempts === 'number'
    );
  }

  private async getOrganization(name: string) {
    return await this.db
      .select()
      .from(shared.organization)
      .where(eq(shared.organization.name, name))
      .then((rows) => rows[0] || null);
  }
}
