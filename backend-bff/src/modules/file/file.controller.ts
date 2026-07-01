import {
  Post,
  Controller,
  UseGuards,
  UploadedFile,
  ParseFilePipe,
  UseInterceptors,
  Logger,
  HttpStatus,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';

import { API_PREFIXES, MAX_UPLOAD_ATTEMPTS_PER_TTL, THROTTLE_TTL } from '@/common/constants';
import {
  UserIdFromRest,
  UserOrganizationIdFromRest,
  UserOrganizationNameFromRest,
} from '@/common/decorators/user.decorator';
import { RestThrottlerGuard } from '@/common/guards/rest-throttler.guard';
import {
  ProfileFileTypeValidator,
  ProfileMaxFileSizeValidator,
} from '@/common/utils/profile-validator';
import { AuthGuard } from '@/modules/auth/auth.guard';
import { UserService } from '@/modules/user/user.service';

class UploadProfileDto {
  userId: string;
}

@UseGuards(RestThrottlerGuard)
@Controller(`${API_PREFIXES.HTTP}/files`)
export class FileController {
  constructor(private readonly userService: UserService) {}

  private readonly logger = new Logger(FileController.name);

  @Throttle({ default: { limit: MAX_UPLOAD_ATTEMPTS_PER_TTL, ttl: THROTTLE_TTL } })
  @Post('uploadProfile')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadProfile(
    @Body()
    body: UploadProfileDto,
    @UploadedFile(
      new ParseFilePipe({
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        fileIsRequired: true,
        validators: [new ProfileMaxFileSizeValidator(), new ProfileFileTypeValidator()],
      }),
    )
    file: Express.Multer.File,
    @UserIdFromRest() userIdFromRest: string,
    @UserOrganizationIdFromRest() organizationId: string,
    @UserOrganizationNameFromRest() organizationName: string,
  ) {
    try {
      const userId = body.userId || userIdFromRest;
      const pictureUrl = await this.userService.updateUserProfileUrl(
        userId,
        organizationId,
        organizationName,
        file,
      );

      if (pictureUrl) {
        this.logger.log(`Successfully uploaded profile picture for user ${userId}`);
      }

      return {
        success: !!pictureUrl,
        userId,
        pictureUrl,
      };
    } catch (error) {
      this.logger.error('Failed to upload profile picture', error?.message);
      return {
        success: false,
        userId: body.userId || userIdFromRest,
        pictureUrl: null,
      };
    }
  }
}
