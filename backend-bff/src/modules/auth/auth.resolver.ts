import { UseGuards } from '@nestjs/common';
import { Resolver, Mutation, Args } from '@nestjs/graphql';

import { GqlThrottlerGuard } from '@/common/guards/graphql-throttler.guard';

import { AuthService } from './auth.service';
import { LoginInput } from './dto/login.input';
import { Auth } from './entities/auth.entity';

@UseGuards(GqlThrottlerGuard)
@Resolver(() => Auth)
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => Auth)
  login(@Args('loginInput') loginInput: LoginInput) {
    return this.authService.authenticate(loginInput, false);
  }

  @Mutation(() => Auth)
  loginToHypervisor(@Args('loginInput') loginInput: LoginInput) {
    return this.authService.authenticate(loginInput, true);
  }
}
