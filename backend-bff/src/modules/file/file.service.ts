import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Storage, Bucket, File, StorageOptions } from '@google-cloud/storage';

@Injectable()
export class FileService {
  protected storage: Storage;
  protected bucket: Bucket;
  protected region: 'ASIA-NORTHEAST1'; // Tokyo. https://cloud.google.com/storage/docs/locations

  constructor(protected readonly configService: ConfigService) {
    const opts: StorageOptions = {};

    const emulator = this.configService.get<string>('GCS_EMULATOR_HOST');
    if (emulator) {
      opts.projectId = this.configService.get<string>('GCP_PROJECT_ID');
      opts.apiEndpoint = emulator;
    }
    this.storage = new Storage(opts);
    const bucketName = this.configService.get<string>('GCP_STORAGE_CHAT_PUBLIC_DATA_BUCKET');
    if (!bucketName) {
      this.logger.error('BucketName is missing');
      throw Error('BucketName is missing');
    }

    this.bucket = this.storage.bucket(bucketName);
  }

  protected logger = new Logger(FileService.name);

  async savePublic(uploadedFile: Express.Multer.File, fileName: string) {
    const [isBucketExists] = await this.bucket.exists();
    if (!isBucketExists) {
      const bucketName = this.configService.get<string>('GCP_STORAGE_CHAT_PUBLIC_DATA_BUCKET');
      if (!bucketName) {
        this.logger.error('BucketName is missing');
        throw Error('BucketName is missing');
      }
      const bucket = await this.createBucket(bucketName);
      this.bucket = bucket;
    }
    const file = this.bucket.file(fileName);
    try {
      const [isFileExists] = await file.exists();
      if (!isFileExists) {
        this.logger.log(`Uploading new file: ${fileName}`);
        await this.upload(file, uploadedFile);
      } else {
        this.logger.log(`Replacing existing file: ${fileName}`);
        await file.delete().then(async () => await this.upload(file, uploadedFile));
      }
    } catch (error) {
      this.logger.error(`Failed to save file ${fileName}`, error);
      throw new BadRequestException(error?.message);
    }
    return file.metadata;
  }

  async delete(fileName: string) {
    const file = this.bucket.file(fileName);
    try {
      this.logger.log(`Deleting file: ${fileName}`);
      await file.delete({ ignoreNotFound: true });
    } catch (error) {
      this.logger.error(`Failed to delete file ${fileName}`, error);
      throw new BadRequestException(error?.message);
    }
  }

  protected async createBucket(mediaBucket: string) {
    const [bucket] = await this.storage.createBucket(mediaBucket, {
      location: this.region,
    });
    return bucket;
  }

  protected async upload(file: File, uploadedFile: Express.Multer.File) {
    try {
      await file.save(uploadedFile.buffer, {
        contentType: uploadedFile.mimetype,
      });
    } catch (error) {
      throw new BadRequestException(error?.message);
    }
  }
}
