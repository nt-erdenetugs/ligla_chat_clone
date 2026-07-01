import { Module } from '@nestjs/common';

import { LiffGuard } from '@/common/guards/liff.guard';

import { LiffVerifyService } from './liff-verify.service';

@Module({
  providers: [LiffVerifyService, LiffGuard],
  exports: [LiffVerifyService, LiffGuard],
})
export class LiffModule {}
