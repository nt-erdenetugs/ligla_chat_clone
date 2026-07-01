import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class PubSubAuthGuard implements CanActivate {
  private readonly logger = new Logger(PubSubAuthGuard.name);
  private readonly oAuth2Client: OAuth2Client;
  private readonly expectedEmail: string;

  constructor(private readonly configService: ConfigService) {
    this.oAuth2Client = new OAuth2Client();
    const expectedEmail = this.configService.get<string>('PUBSUB_SERVICE_ACCOUNT_EMAIL');
    if (!expectedEmail) {
      throw new Error('PUBSUB_SERVICE_ACCOUNT_EMAIL must be configured');
    }
    this.expectedEmail = expectedEmail;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization;

    if (!authorization) {
      this.logger.error('No authorization header in Pub/Sub request');
      throw new UnauthorizedException('Missing authorization header');
    }

    const [bearer, token] = authorization.split(' ');
    if (bearer?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization format');
    }

    let payload;
    try {
      const ticket = await this.oAuth2Client.verifyIdToken({
        idToken: token,
      });
      payload = ticket.getPayload();
    } catch (error) {
      this.logger.error('Pub/Sub token verification failed', error);
      throw new UnauthorizedException('Invalid Pub/Sub token');
    }

    if (payload?.email !== this.expectedEmail) {
      this.logger.error(`Unexpected service account: ${payload?.email}`);
      throw new UnauthorizedException('Invalid service account');
    }

    this.logger.log(`Pub/Sub request authenticated: ${payload?.email}`);
    return true;
  }
}
