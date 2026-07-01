import { Controller, Post, Body, Req, UseGuards, UnauthorizedException } from '@nestjs/common';

import { Request } from 'express';
import { I18nService } from 'nestjs-i18n';

import { API_PREFIXES } from '@/common/constants';
import { UserIdFromRest, UserOrganizationIdFromRest } from '@/common/decorators/user.decorator';
import { RestThrottlerGuard } from '@/common/guards/rest-throttler.guard';
import { AuthGuard } from '@/modules/auth/auth.guard';

import { SubscribePushDto } from './dto/subscribe-push.dto';
import { NotificationsService } from './notifications.service';

@UseGuards(RestThrottlerGuard)
@Controller(`${API_PREFIXES.HTTP}/notifications`)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly i18n: I18nService,
  ) {}

  @UseGuards(AuthGuard)
  @Post('subscribe')
  subscribe(
    @Body() body: SubscribePushDto,
    @UserIdFromRest() userId: string,
    @UserOrganizationIdFromRest() organizationId: string,
    @Req() req: Request,
  ) {
    const token: string | undefined = req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new UnauthorizedException(this.i18n.t('errors.auth.invalidAuthorizationHeader'));
    }
    return this.notificationsService.subscribe({ body, userId, token, organizationId });
  }

  @UseGuards(AuthGuard)
  @Post('unsubscribe')
  unsubscribe(
    @Body() body: SubscribePushDto,
    @UserIdFromRest() userId: string,
    @UserOrganizationIdFromRest() organizationId: string,
  ) {
    return this.notificationsService.unsubscribe(body, userId, organizationId);
  }

  @UseGuards(AuthGuard)
  @Post('sync')
  sync(
    @Body() body: { endpoint: string },
    @UserIdFromRest() userId: string,
    @UserOrganizationIdFromRest() organizationId: string,
  ) {
    return this.notificationsService.sync(body, userId, organizationId);
  }

  // TODO: Remove this endpoint in production
  @UseGuards(AuthGuard)
  @Post('send-notification')
  sendNotification(
    @Body() body: { userId: string },
    @UserOrganizationIdFromRest() organizationId: string,
  ) {
    const payload = {
      title: 'Test Notification',
      body: 'This is a test notification',
    };
    return this.notificationsService.sendNotification(body.userId, organizationId, payload);
  }
}
