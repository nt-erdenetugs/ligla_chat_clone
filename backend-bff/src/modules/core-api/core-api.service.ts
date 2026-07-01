import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type ProvisionSchemaResponse = {
  success: boolean;
  tableCount: number;
  alreadyExisted: boolean;
};

@Injectable()
export class CoreApiService {
  private readonly logger = new Logger(CoreApiService.name);
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('CORE_API_URL') || 'http://backend-core:8000';
  }

  async provisionSchema(
    organizationId: string,
    hypervisorUserId: string,
    organizationApiKey: string,
  ): Promise<ProvisionSchemaResponse> {
    const url = `${this.baseUrl}/api/v1/organization/provision-schema`;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Hypervisor-User-Id': hypervisorUserId,
            'X-API-Key': organizationApiKey,
          },
          body: JSON.stringify({ organizationId }),
          signal: AbortSignal.timeout(60000),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          const sanitizedErrorBody = errorBody.slice(0, 500);
          const isRetryable = response.status >= 500;

          this.logger.error(
            `Schema provisioning failed for organizationId=${organizationId}: ${response.status} ${sanitizedErrorBody}`,
          );

          if (isRetryable && attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            continue;
          }

          if (isRetryable) {
            throw new Error('RETRYABLE_PROVISIONING_ERROR');
          }

          throw new Error('Schema provisioning failed');
        }

        return (await response.json()) as ProvisionSchemaResponse;
      } catch (error) {
        if (error instanceof Error && error.message === 'Schema provisioning failed') {
          throw error;
        }

        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }

        throw new Error('Schema provisioning failed');
      }
    }

    throw new Error('Schema provisioning failed');
  }

  async deprovisionSchema(
    organizationId: string,
    hypervisorUserId: string,
    organizationApiKey: string,
  ): Promise<void> {
    const url = `${this.baseUrl}/api/v1/organization/deprovision-schema`;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Hypervisor-User-Id': hypervisorUserId,
            'X-API-Key': organizationApiKey,
          },
          body: JSON.stringify({ organizationId }),
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          const sanitizedErrorBody = errorBody.slice(0, 500);
          const isRetryable = response.status >= 500;

          this.logger.error(
            `Schema deprovisioning failed for organizationId=${organizationId}: ${response.status} ${sanitizedErrorBody}`,
          );

          if (isRetryable && attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            continue;
          }

          throw new Error('Schema deprovisioning failed');
        }

        return;
      } catch (error) {
        if (error instanceof Error && error.message === 'Schema deprovisioning failed') {
          throw error;
        }

        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }

        throw new Error('Schema deprovisioning failed');
      }
    }

    throw new Error('Schema deprovisioning failed');
  }
}
