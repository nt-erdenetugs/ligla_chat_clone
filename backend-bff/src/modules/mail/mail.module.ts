import { join } from 'path';

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MailerModule } from '@nestjs-modules/mailer';

import { ConfigModule } from '@/modules/config/config.module';

import { MailService } from './mail.service';

const GMAIL_SMTP_HOST = 'smtp-relay.gmail.com';
const isTestEnvironment = process.env.NODE_ENV === 'test';

@Module({
  imports: [
    ...(isTestEnvironment
      ? []
      : [
          MailerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => {
              const mailDomain = configService.get<string>('MAIL_DOMAIN');
              const mailFrom = configService.get<string>('MAIL_FROM');

              const { HandlebarsAdapter } =
                await import('@nestjs-modules/mailer/adapters/handlebars.adapter');

              return {
                transport: {
                  host: GMAIL_SMTP_HOST,
                  port: 587,
                  secure: false,
                  connectionTimeout: 30000,
                  greetingTimeout: 10000,
                  name: mailDomain,
                  pool: true,
                  maxConnections: 2,
                },
                defaults: {
                  from: mailFrom || 'noreply@example.com',
                },
                template: {
                  dir: join(process.cwd(), 'src', 'modules', 'mail', 'templates'),
                  adapter: new HandlebarsAdapter(),
                  options: {
                    strict: true,
                  },
                },
              };
            },
          }),
        ]),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
