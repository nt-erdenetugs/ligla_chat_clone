import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  UseGuards,
  Logger,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';

import { FileMetadata } from '@google-cloud/storage';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { Response } from 'express';

import { API_PREFIXES, MAX_DOWNLOAD_ATTEMPTS_PER_TTL, THROTTLE_TTL } from '@/common/constants';
import { UserIdFromRest, UserOrganizationIdFromRest } from '@/common/decorators/user.decorator';
import { PubSubAuthGuard } from '@/common/guards/pubsub-auth.guard';
import { RestThrottlerGuard } from '@/common/guards/rest-throttler.guard';
import type { TenantTables } from '@@/drizzle/tenant/schema';

import { AuthGuard } from '../auth/auth.guard';

import { ChatFileService } from './chat-file.service';
import { VirusScanResultPubSubDto, VirusScanResultPayload } from './dto/virus-scan-result.dto';

type ChatFileRow = TenantTables['chatFile']['$inferSelect'];

@UseGuards(RestThrottlerGuard)
@Controller(`${API_PREFIXES.HTTP}/chat-files`)
export class ChatFileController {
  private readonly logger = new Logger(ChatFileController.name);

  constructor(
    private readonly chatFileService: ChatFileService,
    private readonly configService: ConfigService,
  ) {}

  @Throttle({ default: { limit: MAX_DOWNLOAD_ATTEMPTS_PER_TTL, ttl: THROTTLE_TTL } })
  @Get(':fileId/download')
  @UseGuards(AuthGuard)
  async downloadChatFile(
    @Param('fileId') fileId: string,
    @UserIdFromRest() userId: string,
    @UserOrganizationIdFromRest() organizationId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const result = await this.chatFileService.downloadChatFile({ fileId, organizationId, userId });
    await this.streamFileResponse(result, response);
  }

  @Throttle({ default: { limit: MAX_DOWNLOAD_ATTEMPTS_PER_TTL, ttl: THROTTLE_TTL } })
  @Get('redirect')
  async redirectToSignedUrl(@Query('url') url: string, @Res() response: Response): Promise<void> {
    if (!url || typeof url !== 'string') {
      this.logger.warn('Redirect called with missing/invalid url parameter');
      response.status(400).json({ message: 'Missing url parameter' });
      return;
    }

    const bucketName = this.configService.get<string>('GCP_STORAGE_CHAT_DATA_BUCKET');
    if (!bucketName) {
      this.logger.error('GCP_STORAGE_CHAT_DATA_BUCKET is not configured');
      response.status(500).json({ message: 'Server misconfiguration' });
      return;
    }
    try {
      const parsed = new URL(url);
      if (
        parsed.origin !== 'https://storage.googleapis.com' ||
        !parsed.pathname.startsWith(`/${bucketName}/`)
      ) {
        this.logger.warn(
          `Redirect rejected: invalid URL target ${parsed.hostname}${parsed.pathname.substring(0, 50)}`,
        );
        response.status(400).json({ message: 'Invalid redirect URL' });
        return;
      }
    } catch (error) {
      this.logger.warn(`Redirect rejected: malformed URL — ${String(error)}`);
      response.status(400).json({ message: 'Invalid redirect URL' });
      return;
    }
    response.redirect(302, url);
  }

  private async streamFileResponse(
    {
      chatFile,
      metadata,
      stream,
    }: {
      chatFile: ChatFileRow;
      metadata?: FileMetadata;
      stream?: Readable;
    },
    response: Response,
  ): Promise<void> {
    const contentType = metadata?.contentType ?? chatFile.mimeType ?? 'application/octet-stream';
    const sizeValue = metadata?.size ?? chatFile.fileSize;
    const fileName = chatFile.originalFileName ?? chatFile.fileName ?? 'file';

    response.setHeader('Content-Type', contentType);
    if (sizeValue !== undefined) {
      response.setHeader('Content-Length', String(sizeValue));
    }
    const encoded = encodeURIComponent(fileName);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`,
    );
    response.setHeader('X-File-Name', encodeURIComponent(fileName));
    response.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-File-Name');

    response.on('close', () => {
      if (stream && typeof (stream as Readable).destroy === 'function') {
        (stream as Readable).destroy();
      }
    });

    try {
      await pipeline(stream as Readable, response);
    } catch (error) {
      this.logger.error(error);
      if (!response.headersSent) {
        response.status(500).json({ message: 'Failed to stream file' });
      } else {
        response.destroy();
      }
    }
  }

  @Post('scan-webhook')
  @UseGuards(PubSubAuthGuard)
  async handleVirusScanWebhook(@Body() body: VirusScanResultPubSubDto) {
    const decodedData = Buffer.from(body.message.data, 'base64').toString('utf-8');

    let parsedData: unknown;
    try {
      parsedData = JSON.parse(decodedData);
    } catch {
      throw new BadRequestException('Invalid JSON in message data');
    }

    const payload = plainToInstance(VirusScanResultPayload, parsedData);

    try {
      await validateOrReject(payload);
    } catch (errors) {
      this.logger.error('Invalid virus scan result payload', errors);
      throw new BadRequestException('Invalid virus scan result payload');
    }

    this.logger.log(
      `Virus scan webhook called for GCS file: ${payload.gcsObjectKey}, status: ${payload.infected ? 'infected' : 'clean'}`,
    );

    return this.chatFileService.handleVirusScanResult(payload);
  }
}
