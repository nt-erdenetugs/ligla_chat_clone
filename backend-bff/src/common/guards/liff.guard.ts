import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { eq } from 'drizzle-orm';
import { I18nService } from 'nestjs-i18n';

import { extractChannelIdFromLiffId } from '@/common/utils/liff';
import { DrizzleDB, InjectDrizzle } from '@/drizzle';
import { LiffVerifyService } from '@/modules/liff/liff-verify.service';
import { organization as organizationTable } from '@@/drizzle/public/schema';

const LIFF_TOKEN_HEADER = 'x-liff-id-token';
const ORGANIZATION_CODE_HEADER = 'x-organization-code';

@Injectable()
export class LiffGuard implements CanActivate {
  private readonly logger = new Logger(LiffGuard.name);

  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly liffVerifyService: LiffVerifyService,
    private readonly i18n: I18nService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = this.getRequest(context);

    const idToken = this.readHeader(request, LIFF_TOKEN_HEADER);
    if (!idToken) {
      throw new UnauthorizedException(this.i18n.t('errors.auth.noLiffToken'));
    }

    const organizationCode = this.readHeader(request, ORGANIZATION_CODE_HEADER);
    if (!organizationCode) {
      throw new UnauthorizedException(this.i18n.t('errors.auth.noOrganizationHeader'));
    }

    const org = await this.db
      .select({
        id: organizationTable.id,
        fileUploadLiffId: organizationTable.fileUploadLiffId,
        isActive: organizationTable.isActive,
      })
      .from(organizationTable)
      .where(eq(organizationTable.name, organizationCode))
      .then((rows) => rows[0] ?? null);

    if (!org || !org.isActive) {
      throw new UnauthorizedException(this.i18n.t('errors.auth.invalidOrganization'));
    }

    const channelId = extractChannelIdFromLiffId(org.fileUploadLiffId);
    if (!channelId) {
      throw new UnauthorizedException(this.i18n.t('errors.auth.invalidOrganization'));
    }

    const { sub } = await this.liffVerifyService.verify(idToken, channelId);

    const next = context.switchToHttp().getNext();
    next.endUserId = sub;
    next.organizationId = org.id;

    return true;
  }

  private getRequest(context: ExecutionContext) {
    if (context.getType() === 'http') {
      return context.switchToHttp().getRequest();
    }
    const gqlContext = GqlExecutionContext.create(context);
    return gqlContext.getContext().req;
  }

  private readHeader(
    request: { headers?: Record<string, string | string[] | undefined> },
    name: string,
  ): string | null {
    const raw = request.headers?.[name];
    if (!raw) return null;
    const value = Array.isArray(raw) ? raw[0] : raw;
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
