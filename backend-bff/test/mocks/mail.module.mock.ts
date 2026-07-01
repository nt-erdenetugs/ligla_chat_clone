import { Module } from '@nestjs/common';

import { MailService } from '@/modules/mail/mail.service';

import { MockMailService } from './mail.service.mock';

/**
 * Mock MailModule for E2E tests
 * Replaces the real MailModule to avoid loading HandlebarsAdapter
 * which has native dependencies (@css-inline/css-inline) that create open handles
 */
@Module({
  providers: [
    {
      provide: MailService,
      useClass: MockMailService,
    },
  ],
  exports: [MailService],
})
export class MockMailModule {}
