import { Post, Controller, UseGuards, Logger, Body } from '@nestjs/common';

import { API_PREFIXES } from '@/common/constants';
import { UserIdFromRest } from '@/common/decorators/user.decorator';
import { RestThrottlerGuard } from '@/common/guards/rest-throttler.guard';
import { AuthGuard } from '@/modules/auth/auth.guard';

@UseGuards(RestThrottlerGuard)
@Controller(`${API_PREFIXES.HTTP}/log`)
export class LogController {
  private readonly logger = new Logger(LogController.name);

  constructor() {}

  @Post('error')
  @UseGuards(AuthGuard)
  async logError(
    @Body() body: { message: string; stack?: string; context?: string },
    @UserIdFromRest() userId: string,
  ) {
    this.logger.error({
      message: `ClientError: ${body.message}`,
      stack: body.stack,
      context: body.context,
      userId,
    });

    return { status: 'ok' };
  }
}
