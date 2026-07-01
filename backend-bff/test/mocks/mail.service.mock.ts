import { Injectable, Logger } from '@nestjs/common';

/**
 * Mock MailService for E2E tests
 * Avoids loading HandlebarsAdapter and sending real emails
 */
@Injectable()
export class MockMailService {
  private readonly logger = new Logger(MockMailService.name);

  async sendUserConfirmation(
    to: string,
    token: string | undefined,
    _userFullName: string,
    reset = false,
    _retryOptions?: any,
  ): Promise<{ success: boolean; error?: Error }> {
    this.logger.debug(`Mock email sent to: ${to}, reset: ${reset}, token exists: ${!!token}`);

    if (!token) {
      return { success: false, error: new Error('Token is required.') };
    }

    // Simulate email sending
    await new Promise((resolve) => setTimeout(resolve, 10));

    return { success: true };
  }
}
