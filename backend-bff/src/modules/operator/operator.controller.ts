import { Controller, Get, HttpStatus, Logger, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import archiver from 'archiver';
import { Request, Response } from 'express';
import sanitize from 'sanitize-filename';

import { API_PREFIXES, MAX_DOWNLOAD_ATTEMPTS_PER_TTL, THROTTLE_TTL } from '@/common/constants';
import { Roles } from '@/common/decorators/roles.decorator';
import {
  UserIdFromRest,
  UserOrganizationIdFromRest,
  UserRole,
} from '@/common/decorators/user.decorator';
import { PaginationArgs } from '@/common/dto/pagination.args';
import { RoleGuard } from '@/common/guards/role.guard';
import { generateQRCodeToBuffer } from '@/common/utils/qrcode';
import { AuthGuard } from '@/modules/auth/auth.guard';
import { adminManagerRoles, adminRoles } from '@/modules/auth/constants';
import { UserService } from '@/modules/user/user.service';

const FILENAME_SANITIZE_REPLACEMENT = '_';

@Controller(`${API_PREFIXES.HTTP}/operator`)
export class OperatorController {
  constructor(private readonly userService: UserService) {}

  private readonly logger = new Logger(OperatorController.name);

  @Throttle({ default: { limit: MAX_DOWNLOAD_ATTEMPTS_PER_TTL, ttl: THROTTLE_TTL } })
  @Get('qr-codes/download')
  @Roles(adminManagerRoles)
  @UseGuards(AuthGuard, RoleGuard)
  async downloadQRs(
    @Res() res: Response,
    @Req() req: Request,
    @UserIdFromRest() userId: string,
    @UserOrganizationIdFromRest() organizationId: string,
    @UserRole() role: string,
    @Query() paginationArgs: PaginationArgs,
  ) {
    this.logger.log(`Starting QR download for org: ${organizationId}, requested by: ${userId}`);

    const users = await this.userService.findAllOperatorsQrUrl({
      paginationArgs,
      // Passing userId ensures that query is filtered by teams that user is member of
      // If user is admin, then no need to filter by userId
      userId: adminRoles.includes(role) ? undefined : userId,
      organizationId: organizationId,
    });

    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `${organizationId}_operators_qr_${timestamp}.zip`;
    const encodedFileName = encodeURIComponent(fileName);

    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodedFileName}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    req.on('close', () => {
      this.logger.warn(`Client disconnected during QR download for org: ${organizationId}`);
      archive.abort();
    });

    archive.on('error', (error: any) => {
      this.logger.error('Failed to create archive', error?.message);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).end('Failed to create archive');
    });

    let successCount = 0;
    await Promise.all(
      users.map(async (user) => {
        if (!user.qrUrl) {
          return;
        }

        try {
          const qrBuffer = await generateQRCodeToBuffer(user.qrUrl);
          const fallbackName = user.email.split('@')[0];
          let sanitizedName = sanitize(user.displayName, {
            replacement: FILENAME_SANITIZE_REPLACEMENT,
          });

          if (!sanitizedName || sanitizedName === FILENAME_SANITIZE_REPLACEMENT) {
            sanitizedName = fallbackName;
          }

          const name = `${sanitizedName}.png`;

          archive.append(qrBuffer, { name });
          successCount++;
        } catch (e) {
          this.logger.error(`Failed to generate QR for user ${user.id}`, e);
        }
      }),
    );

    await archive.finalize();

    this.logger.log(
      `Completed QR download for org: ${organizationId}, ${successCount} QRs generated`,
    );
  }
}
