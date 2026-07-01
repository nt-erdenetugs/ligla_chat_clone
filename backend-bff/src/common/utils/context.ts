import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const getNext = (context: ExecutionContext) => {
  if (context.getType() === 'http') {
    return context.switchToHttp().getNext();
  }

  const gqlContext = GqlExecutionContext.create(context);
  if (gqlContext.getType() === 'graphql') {
    return gqlContext.getContext();
  }
};
