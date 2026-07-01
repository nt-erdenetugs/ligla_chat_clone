import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { MailerService } from '@nestjs-modules/mailer';

import { MailService } from '@/modules/mail/mail.service';

describe('MailService', () => {
  let service: MailService;
  let mailerService: jest.Mocked<MailerService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockMailerService = {
      sendMail: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue('http://localhost:8001'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: MailerService,
          useValue: mockMailerService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    mailerService = module.get(MailerService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendUserConfirmation', () => {
    const testEmail = 'test@example.com';
    const testToken = 'test-token-123';
    const testUserFullName = 'Test User';

    describe('initial login confirmation', () => {
      it('should send initial login email successfully', async () => {
        mailerService.sendMail.mockResolvedValue({} as any);

        const result = await service.sendUserConfirmation(
          testEmail,
          testToken,
          testUserFullName,
          false,
        );

        expect(result.success).toBe(true);
        expect(mailerService.sendMail).toHaveBeenCalledTimes(1);
        expect(mailerService.sendMail).toHaveBeenCalledWith({
          to: testEmail,
          subject: 'Liglaのアカウントを確認してください。 (Confirm your Ligla account.)',
          template: 'initial-login',
          context: {
            url: 'http://localhost:8001/initial-login?token=test-token-123',
            userFullName: testUserFullName,
          },
        });
      });

      it('should use BASE_URL from config service', async () => {
        configService.get.mockReturnValue('https://production.example.com');
        mailerService.sendMail.mockResolvedValue({} as any);

        await service.sendUserConfirmation(testEmail, testToken, testUserFullName, false);

        expect(configService.get).toHaveBeenCalledWith('BASE_URL');
        expect(mailerService.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            context: expect.objectContaining({
              url: 'https://production.example.com/initial-login?token=test-token-123',
            }),
          }),
        );
      });
    });

    describe('password reset', () => {
      it('should send password reset email successfully', async () => {
        mailerService.sendMail.mockResolvedValue({} as any);

        const result = await service.sendUserConfirmation(
          testEmail,
          testToken,
          testUserFullName,
          true,
        );

        expect(result.success).toBe(true);
        expect(mailerService.sendMail).toHaveBeenCalledWith({
          to: testEmail,
          subject: 'Liglaのパスワードをリセットしてください。 (Reset your Ligla password.)',
          template: 'reset-password',
          context: {
            url: 'http://localhost:8001/reset-password?token=test-token-123',
            userFullName: testUserFullName,
          },
        });
      });

      it('should include correct template for password reset', async () => {
        mailerService.sendMail.mockResolvedValue({} as any);

        await service.sendUserConfirmation(testEmail, testToken, testUserFullName, true);

        expect(mailerService.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            template: 'reset-password',
          }),
        );
      });
    });

    describe('error handling', () => {
      it('should return error when token is undefined', async () => {
        const result = await service.sendUserConfirmation(
          testEmail,
          undefined,
          testUserFullName,
          false,
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error?.message).toBe('Token is required.');
        expect(mailerService.sendMail).not.toHaveBeenCalled();
      });

      it('should return error when token is null', async () => {
        const result = await service.sendUserConfirmation(
          testEmail,
          null as any,
          testUserFullName,
          false,
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(mailerService.sendMail).not.toHaveBeenCalled();
      });

      it('should handle mailer service failure', async () => {
        const mailError = new Error('SMTP connection failed');
        mailerService.sendMail.mockRejectedValue(mailError);

        const result = await service.sendUserConfirmation(
          testEmail,
          testToken,
          testUserFullName,
          false,
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should handle timeout errors gracefully', async () => {
        const timeoutError = new Error('Connection timeout');
        mailerService.sendMail.mockRejectedValue(timeoutError);

        const result = await service.sendUserConfirmation(
          testEmail,
          testToken,
          testUserFullName,
          false,
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe(timeoutError);
      });

      it('should handle network errors', async () => {
        const networkError = new Error('ECONNREFUSED');
        mailerService.sendMail.mockRejectedValue(networkError);

        const result = await service.sendUserConfirmation(
          testEmail,
          testToken,
          testUserFullName,
          true,
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe(networkError);
      });
    });

    describe('retry mechanism', () => {
      it('should retry on transient failures and eventually succeed', async () => {
        // Mock to fail twice then succeed
        mailerService.sendMail
          .mockRejectedValueOnce(new Error('Temporary failure 1'))
          .mockRejectedValueOnce(new Error('Temporary failure 2'))
          .mockResolvedValueOnce({} as any);

        const result = await service.sendUserConfirmation(
          testEmail,
          testToken,
          testUserFullName,
          false,
        );

        expect(result.success).toBe(true);
        expect(mailerService.sendMail).toHaveBeenCalledTimes(3);
      });

      it('should return error after exhausting all retries', async () => {
        const persistentError = new Error('Persistent SMTP error');
        mailerService.sendMail.mockRejectedValue(persistentError);

        const result = await service.sendUserConfirmation(
          testEmail,
          testToken,
          testUserFullName,
          false,
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(mailerService.sendMail).toHaveBeenCalled();
      });

      it('should accept custom retry options', async () => {
        mailerService.sendMail.mockResolvedValue({} as any);
        const customRetryOptions = {
          maxRetries: 5,
          delayMs: 2000,
        };

        const result = await service.sendUserConfirmation(
          testEmail,
          testToken,
          testUserFullName,
          false,
          customRetryOptions,
        );

        expect(result.success).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should handle empty user full name', async () => {
        mailerService.sendMail.mockResolvedValue({} as any);

        const result = await service.sendUserConfirmation(testEmail, testToken, '', false);

        expect(result.success).toBe(true);
        expect(mailerService.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            context: expect.objectContaining({
              userFullName: '',
            }),
          }),
        );
      });

      it('should handle special characters in email', async () => {
        mailerService.sendMail.mockResolvedValue({} as any);
        const specialEmail = 'test+tag@example.com';

        const result = await service.sendUserConfirmation(
          specialEmail,
          testToken,
          testUserFullName,
          false,
        );

        expect(result.success).toBe(true);
        expect(mailerService.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            to: specialEmail,
          }),
        );
      });

      it('should handle special characters in user name', async () => {
        mailerService.sendMail.mockResolvedValue({} as any);
        const specialName = 'テスト ユーザー';

        const result = await service.sendUserConfirmation(testEmail, testToken, specialName, false);

        expect(result.success).toBe(true);
        expect(mailerService.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            context: expect.objectContaining({
              userFullName: specialName,
            }),
          }),
        );
      });

      it('should handle very long tokens', async () => {
        mailerService.sendMail.mockResolvedValue({} as any);
        const longToken = 'a'.repeat(500);

        const result = await service.sendUserConfirmation(
          testEmail,
          longToken,
          testUserFullName,
          false,
        );

        expect(result.success).toBe(true);
        expect(mailerService.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            context: expect.objectContaining({
              url: expect.stringContaining(longToken),
            }),
          }),
        );
      });

      it('should handle URL with special characters in token', async () => {
        mailerService.sendMail.mockResolvedValue({} as any);
        const specialToken = 'token-with-special-chars!@#$%';

        const result = await service.sendUserConfirmation(
          testEmail,
          specialToken,
          testUserFullName,
          false,
        );

        expect(result.success).toBe(true);
        expect(mailerService.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            context: expect.objectContaining({
              url: `http://localhost:8001/initial-login?token=${specialToken}`,
            }),
          }),
        );
      });
    });

    describe('template selection', () => {
      it('should use initial-login template when reset is false', async () => {
        mailerService.sendMail.mockResolvedValue({} as any);

        await service.sendUserConfirmation(testEmail, testToken, testUserFullName, false);

        expect(mailerService.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            template: 'initial-login',
          }),
        );
      });

      it('should use reset-password template when reset is true', async () => {
        mailerService.sendMail.mockResolvedValue({} as any);

        await service.sendUserConfirmation(testEmail, testToken, testUserFullName, true);

        expect(mailerService.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            template: 'reset-password',
          }),
        );
      });

      it('should include correct URL path for initial login', async () => {
        mailerService.sendMail.mockResolvedValue({} as any);

        await service.sendUserConfirmation(testEmail, testToken, testUserFullName, false);

        expect(mailerService.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            context: expect.objectContaining({
              url: expect.stringContaining('/initial-login?'),
            }),
          }),
        );
      });

      it('should include correct URL path for password reset', async () => {
        mailerService.sendMail.mockResolvedValue({} as any);

        await service.sendUserConfirmation(testEmail, testToken, testUserFullName, true);

        expect(mailerService.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            context: expect.objectContaining({
              url: expect.stringContaining('/reset-password?'),
            }),
          }),
        );
      });
    });
  });
});
