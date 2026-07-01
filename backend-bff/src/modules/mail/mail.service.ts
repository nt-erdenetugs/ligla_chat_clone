import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MailerService } from '@nestjs-modules/mailer';

import { INITIAL_LOGIN, RESET_PASSWORD, RetryOptions } from '@/common/constants';
import { logErrorDetails, withRetry } from '@/common/utils/retry';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  private readonly logger = new Logger(MailService.name);

  async sendUserConfirmation(
    to: string,
    token: string | undefined,
    userFullName: string,
    reset = false,
    retryOptions?: Partial<RetryOptions>,
  ) {
    if (!token) {
      return { success: false, error: new Error('Token is required.') };
    }

    const url = `${this.configService.get<string>('BASE_URL')}/${reset ? RESET_PASSWORD : INITIAL_LOGIN}?token=${token}`;

    const subject = reset
      ? 'Liglaのパスワードをリセットしてください。 (Reset your Ligla password.)'
      : 'Liglaのアカウントを確認してください。 (Confirm your Ligla account.)';

    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const env = this.configService.get<string>('ENV');

    if (nodeEnv === 'development' || env === 'local') {
      this.logger.log(`[DEV MODE] Email would be sent to: ${to}`);
      this.logger.log(`[DEV MODE] Subject: ${subject}`);
      this.logger.log(`[DEV MODE] URL: ${url}`);
      return { success: true };
    }

    const template = reset ? RESET_PASSWORD : INITIAL_LOGIN;
    const operationName = `Email ${reset ? 'password reset' : 'confirmation'} to ${to}`;

    try {
      await withRetry(
        async () =>
          this.mailerService.sendMail({
            to,
            subject,
            template,
            context: {
              url,
              userFullName,
            },
          }),
        operationName,
        this.logger,
        retryOptions,
      );

      return { success: true };
    } catch (error) {
      logErrorDetails('Failed to send email after multiple retries', error, this.logger);
      return { success: false, error };
    }
  }
}
