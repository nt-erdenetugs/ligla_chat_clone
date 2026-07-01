import { Injectable, Logger } from '@nestjs/common';

/**
 * Mock LiglaService for E2E tests
 * Avoids making real HTTP requests to external Ligla API
 */
@Injectable()
export class MockLiglaService {
  private readonly logger = new Logger(MockLiglaService.name);

  async sendMessage(
    organizationId: string,
    input: any,
    onSuccess = () => {},
    _onFailure = () => {},
  ): Promise<{ messageId: string; quoteToken: string }> {
    this.logger.debug(
      `Mock sendMessage called for org: ${organizationId}, messageId: ${input.messageId}`,
    );

    // Simulate small delay
    await new Promise((resolve) => setTimeout(resolve, 10));

    onSuccess();
    return {
      messageId: `test-msg-${input.messageId || 'unknown'}`,
      quoteToken: `test-qt-${input.messageId || 'unknown'}`,
    };
  }

  async chatRead(
    organizationId: string,
    input: { endUserId: Nullable<string>; markAsReadToken?: string | null },
  ): Promise<void> {
    this.logger.debug(`Mock chatRead called for org: ${organizationId}, user: ${input.endUserId}`);

    if (!input.endUserId) return;

    // Simulate small delay
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  async endChatSession(
    organizationId: string,
    input: { endUserId: Nullable<string> },
  ): Promise<void> {
    this.logger.debug(
      `Mock endChatSession called for org: ${organizationId}, user: ${input.endUserId}`,
    );

    if (!input.endUserId) return;

    // Simulate small delay
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
