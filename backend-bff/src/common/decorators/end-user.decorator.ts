import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const EndUserId = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const ctx = GqlExecutionContext.create(context);
  const next: { endUserId: string } = ctx.switchToHttp().getNext();
  return next.endUserId;
});

export const EndUserOrganizationId = createParamDecorator(
  (_: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const next: { organizationId: string } = ctx.switchToHttp().getNext();
    return next.organizationId;
  },
);
