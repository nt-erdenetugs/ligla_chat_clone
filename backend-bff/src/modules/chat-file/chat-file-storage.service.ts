import { Readable } from 'stream';

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PubSub } from '@google-cloud/pubsub';
import { Bucket, Storage, type FileMetadata } from '@google-cloud/storage';
import { I18nService } from 'nestjs-i18n';

import type { TenantTables } from '@@/drizzle/tenant/schema';

type ChatFile = TenantTables['chatFile']['$inferSelect'];

/**
 * ChatFileStorageService
 *
 * Extends FileService to add chat-specific GCS operations.
 * Inherits common GCS functionality (storage, bucket, upload, delete)
 * and adds chat-specific features (signed URLs, file movement).
 */
@Injectable()
export class ChatFileStorageService {
  private storage: Storage;
  private bucket: Bucket;
  private logger = new Logger(ChatFileStorageService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {
    this.storage = new Storage();

    const bucketName = this.configService.get<string>('GCP_STORAGE_CHAT_DATA_BUCKET');
    if (!bucketName) {
      this.logger.error('BucketName is missing');
      throw Error('BucketName is missing');
    }

    this.bucket = this.storage.bucket(bucketName);
  }

  /**
   * Generate a signed URL for downloading a chat file
   *
   * @param gcsPath - Full GCS path to the file
   * @param expirationMinutes - How long the URL should be valid (default: 60 minutes)
   * @returns Signed URL string
   */
  async generateSignedUrl({
    gcsPath,
    action,
    expirationMinutes = 60,
    contentType,
    responseDisposition,
    responseType,
  }: {
    gcsPath: string;
    expirationMinutes?: number;
    contentType?: string;
    action: 'read' | 'write';
    responseDisposition?: string;
    responseType?: string;
  }): Promise<string> {
    const file = this.bucket.file(gcsPath);

    try {
      const [signedUrl] = await file.getSignedUrl({
        version: 'v4' as const,
        action,
        expires: Date.now() + expirationMinutes * 60 * 1000,
        contentType,
        responseDisposition,
        responseType,
      });
      this.logger.log(`Generated signed URL for: ${gcsPath}`);

      return signedUrl;
    } catch (error) {
      this.logger.error(`Failed to generate signed URL for ${gcsPath}`, error);
      throw new BadRequestException(`Failed to generate download URL: ${error?.message}`);
    }
  }

  async deleteChatFile(gcsPath: string): Promise<void> {
    const file = this.bucket.file(gcsPath);

    try {
      this.logger.log(`Deleting chat file from GCS: ${gcsPath}`);
      await file.delete({ ignoreNotFound: true });
    } catch (error) {
      this.logger.error(`Failed to delete chat file ${gcsPath}`, error);
      throw new BadRequestException(`Failed to delete file: ${error?.message}`);
    }
  }

  /**
   * Check if a file exists in GCS
   *
   * @param gcsPath - Full GCS path to the file
   * @returns True if file exists, false otherwise
   */
  async fileExists(gcsPath: string): Promise<boolean> {
    const file = this.bucket.file(gcsPath);
    try {
      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      throw new BadRequestException(`Failed to check file existence: ${error?.message}`);
    }
  }

  /**
   * Move a file from one location to another in GCS
   * Used for moving files between storage folders (e.g., PENDING → PROCESSED or FAILED)
   *
   * @param fromPath - Source GCS path
   * @param toPath - Destination GCS path
   */
  async moveFile(fromPath: string, toPath: string): Promise<void> {
    const sourceFile = this.bucket.file(fromPath);
    const destinationFile = this.bucket.file(toPath);

    try {
      this.logger.log(`Moving file from ${fromPath} to ${toPath}`);

      // Check if source file exists
      const [exists] = await sourceFile.exists();
      if (!exists) {
        throw new BadRequestException(`Source file not found: ${fromPath}`);
      }

      // Copy to new location
      await sourceFile.copy(destinationFile);

      // Delete original file
      await sourceFile.delete();

      this.logger.log(`Successfully moved file from ${fromPath} to ${toPath}`);
    } catch (error) {
      this.logger.error(`Failed to move file from ${fromPath} to ${toPath}`, error);
      throw new BadRequestException(`Failed to move file: ${error?.message}`);
    }
  }

  async triggerVirusScan(chatFile: ChatFile) {
    const pubsub = new PubSub();
    const topicName = this.configService.get<string>('GCP_VIRUS_SCAN_TOPIC_NAME');
    if (!topicName) {
      this.logger.error('GCP_VIRUS_SCAN_TOPIC_NAME is missing');
      throw Error('GCP_VIRUS_SCAN_TOPIC_NAME is missing');
    }
    const isLocalEmulator = !!process.env.PUBSUB_EMULATOR_HOST;
    const [topic] = await pubsub
      .topic(topicName, {
        gaxOpts: {
          retry: {
            backoffSettings: {
              initialRetryDelayMillis: 100,
              retryDelayMultiplier: 4,
              maxRetryDelayMillis: 10000,
              totalTimeoutMillis: 120000,
            },
          },
        },
      })
      .get({ autoCreate: isLocalEmulator });

    this.logger.log(
      `Publishing virus scan request to topic=${topicName}: fileId=${chatFile.id}, gcsObjectKey=${chatFile.gcsObjectKey}`,
    );

    await topic.publishMessage({
      data: Buffer.from(
        JSON.stringify({
          kind: 'storage#object',
          name: chatFile.gcsObjectKey,
          bucket: this.bucket.name,
          size: chatFile.fileSize.toString(),
        }),
      ),
    });

    this.logger.log(`Virus scan request published successfully for fileId=${chatFile.id}`);
  }

  async moveProcessedFile(gcsObjectKey: string, infected: boolean) {
    const fileParts = gcsObjectKey.split('/');

    const folderPath = fileParts.slice(0, -1).join('/');
    const fileName = fileParts[fileParts.length - 1];

    const destinationFolder = infected ? 'quarantined' : 'clean';
    const fileDestination = `${folderPath}/${destinationFolder}/${fileName}`;

    await this.moveFile(gcsObjectKey, fileDestination);

    this.logger.log(`Successfully moved file ${gcsObjectKey} to gs://${fileDestination}`);
    return fileDestination;
  }

  async streamFile(gcsPath: string): Promise<{
    exists: boolean;
    metadata?: FileMetadata | undefined;
    stream?: Readable;
  }> {
    const file = this.bucket.file(gcsPath);
    try {
      const exists = await file.exists();
      if (!exists) return { exists: false };

      const [metadata] = await file.getMetadata().catch(() => [undefined]);
      const stream: Readable = file.createReadStream();

      return { exists: true, metadata, stream };
    } catch (error) {
      this.logger.error(`Failed to stream file ${gcsPath}`, error);
      throw new BadRequestException(this.i18n.t('errors.chatFile.streamFailed'));
    }
  }
}
