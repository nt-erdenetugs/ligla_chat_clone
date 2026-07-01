import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

import { parseEnvToJson } from './utils';

const secretName = 'CHAT_ENV';
const version = 'latest';

export const secretManagerFactory = async () => {
  const logger = new Logger('SecretManagerFactory');

  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    logger.log('Skip SecretManager: Skipping secret retrieval in development/test mode');
    return new ConfigService();
  }

  const client = new SecretManagerServiceClient();

  const projectId = process.env.GCP_PROJECT_ID;

  const name = `projects/${projectId}/secrets/${secretName}/versions/${version}`;

  try {
    if (!client) {
      throw new Error('Secret Manager client not initialized');
    }

    const [accessResponse] = await client.accessSecretVersion({ name });

    const payloadBuffer = accessResponse?.payload?.data;

    const secretPayload = payloadBuffer?.toString();

    if (!secretPayload) {
      logger.error('No secrets found in Secret Manager');
      throw new Error('No secrets found in Secret Manager');
    }

    const jsonSecret = parseEnvToJson(secretPayload);

    Object.entries(jsonSecret).forEach(([key, value]) => {
      process.env[key] = value;
    });

    logger.log('Successfully loaded secret version');
    return new ConfigService(jsonSecret);
  } catch (error) {
    logger.error('Failed to load secret version:', error);
    return new ConfigService();
  }
};
