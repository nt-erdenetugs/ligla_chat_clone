import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';

import { Roles } from '@/common/decorators/roles.decorator';
import { getNext } from '@/common/utils/context';
import { SystemUserType } from '@/modules/user/enums';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  matchRoles(roles: string[], userRole: string) {
    return roles.some((role) => role === userRole);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gqlContext = GqlExecutionContext.create(context);

    const roles = this.reflector.get<string[]>(Roles, gqlContext.getHandler());

    if (!roles || roles.length === 0) {
      return true;
    }

    const { uid, isHypervisor, role } = getNext(context);

    if (isHypervisor) {
      return this.matchRoles(roles, SystemUserType.HYPERVISOR);
    }

    if (uid) {
      return this.matchRoles(roles, role);
    }

    return false;
  }
}
