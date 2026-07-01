import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { getNext } from '@/common/utils/context';

export const UserId = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const ctx = GqlExecutionContext.create(context);
  const next: { uid: string } = ctx.switchToHttp().getNext();
  return next.uid;
});

export const IsHypervisor = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const ctx = GqlExecutionContext.create(context);
  const next: { isHypervisor: boolean } = ctx.switchToHttp().getNext();
  return next.isHypervisor;
});

export const UserIdFromRest = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const next: { uid: string } = context.switchToHttp().getNext();
  return next.uid;
});

export const UserOrganizationNameFromRest = createParamDecorator(
  (_: unknown, context: ExecutionContext) => {
    const next: { organizationName: string } = context.switchToHttp().getNext();
    return next.organizationName;
  },
);

export const UserOrganizationIdFromRest = createParamDecorator(
  (_: unknown, context: ExecutionContext) => {
    const next: { organizationId: string } = context.switchToHttp().getNext();
    return next.organizationId;
  },
);

export const UserOrganizationName = createParamDecorator(
  (_: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const next: { organizationName: string } = ctx.switchToHttp().getNext();
    return next.organizationName;
  },
);

export const UserOrganizationId = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const ctx = GqlExecutionContext.create(context);
  const next: { organizationId: string } = ctx.switchToHttp().getNext();
  return next.organizationId;
});

export const UserRole = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const next: { role: string } = getNext(context);
  return next.role;
});
