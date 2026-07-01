import { createHash, timingSafeEqual } from 'crypto';

import {
  Sse,
  Post,
  Body,
  Controller,
  Headers,
  MessageEvent,
  UseGuards,
  Logger,
  NotFoundException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';

import { I18nService } from 'nestjs-i18n';
import { Observable } from 'rxjs';
import { validate as isValidUuid } from 'uuid';

import { API_PREFIXES } from '@/common/constants';
import { UserIdFromRest } from '@/common/decorators/user.decorator';
import { AuthGuard } from '@/modules/auth/auth.guard';

import { OrganizationService } from '../organization/organization.service';

import { ChatService } from './chat.service';
import { ChatReceiveDto } from './dto/chat-receive.input';

@SkipThrottle()
@Controller(`${API_PREFIXES.HTTP}/events`)
export class ChatEventController {
  private readonly logger = new Logger(ChatEventController.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly config: ConfigService,
    private readonly organizationService: OrganizationService,
    private readonly i18n: I18nService,
  ) {}

  @Sse()
  @UseGuards(AuthGuard)
  sse(@UserIdFromRest() userId: string): Observable<MessageEvent> {
    return this.chatService.getOrCreateStream(userId);
  }

  @Post('receive')
  async triggerEvent(
    @Body() body: ChatReceiveDto,
    @Headers('authorization') authHeader: string | undefined,
  ) {
    if (!authHeader) {
      this.logger.warn('Missing authorization header');
      throw new UnauthorizedException(this.i18n.t('errors.auth.noAuthorizationHeader'));
    }

    const jwtSecret = this.config.get<string>('JWT_SECRET');

    if (!jwtSecret) {
      this.logger.error('JWT_SECRET is required but not configured');
      throw new InternalServerErrorException();
    }

    const [scheme, authToken, ...rest] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !authToken || rest.length > 0) {
      this.logger.warn('Invalid authorization header');
      throw new UnauthorizedException(this.i18n.t('errors.auth.invalidAuthorizationHeader'));
    }

    if (!this.isSameToken(authToken, jwtSecret)) {
      this.logger.warn('Authentication failed for receive endpoint');
      throw new UnauthorizedException(this.i18n.t('errors.auth.invalidToken'));
    }

    const { chatId, isAutoReplyMessage, messageId, closeChat, clientName } = body;

    const organization = await this.organizationService.findOneByName(clientName);

    if (!organization) {
      this.logger.error('Valid organization not found');
      throw new NotFoundException(this.i18n.t('errors.organization.notFound'));
    }

    const hasValidMessageId = !!messageId && isValidUuid(messageId);

    if (hasValidMessageId) {
      await this.chatService.broadcastReceivedChatEvent({
        chatId,
        organizationId: organization.id,
        chatMessageId: messageId,
      });
    } else {
      if (messageId) {
        this.logger.warn(`Ignoring non-UUID messageId in receive event: ${messageId}`);
      }
      await this.chatService.broadcastChatEvent(chatId, organization.id);
    }

    if (isAutoReplyMessage && hasValidMessageId) {
      await this.sendAutoReplyToLigla(chatId, messageId, organization.id, closeChat);
    }

    return {
      success: true,
      message: this.i18n.t('toasts.chat.eventSentToSSE'),
      args: { chatId: body.chatId },
    };
  }

  private async sendAutoReplyToLigla(
    chatId: string,
    messageId: string,
    organizationId: string,
    closeChat?: boolean,
  ) {
    try {
      const chat = await this.chatService.findRawOne(chatId, organizationId);
      if (!chat) {
        this.logger.warn(`Chat not found: ${chatId}`);
        return;
      }

      await this.chatService.sendMessageToLigla(chatId, organizationId, messageId, closeChat);
      this.logger.log(`Auto-reply sent to Ligla: ${chatId}/${messageId}`);
    } catch (error) {
      this.logger.error(`Auto-reply failed: ${chatId}/${messageId}`, error);
      await this.chatService.notifyMessageSendFailure(chatId, messageId, organizationId);
    }
  }

  private isSameToken(receivedToken: string, expectedToken: string): boolean {
    const receivedHash = createHash('sha256').update(receivedToken).digest();
    const expectedHash = createHash('sha256').update(expectedToken).digest();
    return timingSafeEqual(receivedHash, expectedHash);
  }
}
