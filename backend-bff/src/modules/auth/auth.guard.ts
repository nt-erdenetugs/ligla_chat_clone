import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';

import { eq } from 'drizzle-orm';
import { I18nService } from 'nestjs-i18n';

import { DrizzleDB, InjectDrizzle } from '@/drizzle';
import { HypervisorService } from '@/modules/hypervisor/hypervisor.service';
import { UserStatusType } from '@/modules/user/enums';
import { UserService } from '@/modules/user/user.service';
import { organization as organizationDB } from '@@/drizzle/public/schema';

type TokenPayloadType = {
  userId?: string;
  isHypervisor: boolean;
};
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly userService: UserService,
    private readonly hypervisorService: HypervisorService,
    private jwtService: JwtService,
    private readonly i18n: I18nService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const next: {
      uid: string;
      isHypervisor: boolean;
      organizationName?: string;
      organizationId?: string;
      role?: string;
      req: { body: { variables: { uid: string } } };
    } = context.switchToHttp().getNext();

    const ctx = GqlExecutionContext.create(context);

    try {
      const authorization: string = ctx.getContext<{
        req: { headers: { authorization: string } };
      }>().req.headers.authorization;

      const result = this.generateUidFromAuthorization(authorization);

      if (!result) {
        return false;
      }

      const { userId, isHypervisor } = result;

      if (!!userId) {
        if (isHypervisor) {
          const hypervisor = await this.hypervisorService.findOne(userId);
          if (hypervisor) {
            next.uid = userId;
            next.role = hypervisor.systemUserType;
            next.isHypervisor = isHypervisor;
            return true;
          }
        } else {
          // First get user auth info to get organizationName
          const userAuth = await this.userService.findUserAuth(userId);

          if (userAuth && userAuth.status === UserStatusType.ACTIVE && userAuth.organizationName) {
            const org = await this.db
              .select({
                id: organizationDB.id,
                name: organizationDB.name,
                isActive: organizationDB.isActive,
              })
              .from(organizationDB)
              .where(eq(organizationDB.name, userAuth.organizationName))
              .then((rows) => rows[0] || null);

            if (!org || !org.isActive) {
              throw new UnauthorizedException(this.i18n.t('errors.auth.invalidToken'));
            }

            // Now get full user details with organizationId
            const user = await this.userService.findOne(userId, org.id);

            next.uid = userId;
            next.organizationName = org.name;
            next.organizationId = org.id;
            next.role = user.roleType;
            return true;
          }
        }
      }

      return false;
    } catch {
      throw new UnauthorizedException();
    }
  }

  private generateUidFromAuthorization(authorization: string): Optional<TokenPayloadType> {
    if (!authorization) {
      throw new UnauthorizedException(this.i18n.t('errors.auth.noAuthorizationHeader'));
    }

    const [bearer, token] = authorization.split(' ');

    if (!token || bearer.toLowerCase() !== 'bearer') {
      throw new UnauthorizedException(this.i18n.t('errors.auth.invalidAuthorizationHeader'));
    }

    return this.verifyIdFromToken(token);
  }

  private verifyIdFromToken(token: string): Optional<TokenPayloadType> {
    try {
      const payload: TokenPayloadType = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      if (payload) {
        return {
          userId: payload.userId,
          isHypervisor: payload.isHypervisor,
        };
      }
    } catch {
      throw new UnauthorizedException(this.i18n.t('errors.auth.invalidToken'));
    }
  }
}
