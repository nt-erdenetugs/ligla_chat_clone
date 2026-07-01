import { randomUUID } from 'crypto';
import { Readable } from 'stream';

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

import { eq, and, or, isNull, isNotNull, desc, lt, count, SQL, inArray } from 'drizzle-orm';
import { I18nService } from 'nestjs-i18n';
import sanitize from 'sanitize-filename';

import { CHAT_FILE_ACCEPTED_MIME_TYPES } from '@/common/constants';
import { CursorPaginationArgs } from '@/common/dto/pagination.args';
import { getCursorArgs } from '@/common/utils/cursor';
import { formatBytes } from '@/common/utils/file';
import { logErrorDetails } from '@/common/utils/retry';
import { DrizzleDB, InjectDrizzle, TenantSchemaService } from '@/drizzle';
import { inferEnum } from '@/drizzle/utils';
import { filestatus as filestatusEnum, filefolder as filefolderEnum } from '@@/drizzle/enums';
import * as shared from '@@/drizzle/public/schema';
import { TenantTables } from '@@/drizzle/tenant/schema';

import { adminRoles, managerRoles } from '../auth/constants';
import { UserRoleType } from '../user/enums';

import { ChatFileStorageService } from './chat-file-storage.service';
import { ChatFileListArgs } from './dto/chat-file-list.args';
import { ChatFileDownloadUrlResponse } from './entities/chat-file-download-url.response';
import { ChatFileListResponse } from './entities/chat-file-list.response';
import { ChatFile, FileStatus, FileType } from './entities/chat-file.entity';
import { MAX_FILE_SIZE_BYTES } from './file.enums';

import type { FileMetadata } from '@google-cloud/storage';

const FileStatusEnum = inferEnum(filestatusEnum);
const FileFolderEnum = inferEnum(filefolderEnum);

type ChatFileRow = TenantTables['chatFile']['$inferSelect'];

@Injectable()
export class ChatFileService {
  private readonly logger = new Logger(ChatFileService.name);
  private readonly viewStatuses: FileStatus[] = [
    FileStatusEnum.PENDING_SCAN,
    FileStatusEnum.SCANNED,
    FileStatusEnum.VIRUS_DETECTED,
  ];

  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly tenantSchema: TenantSchemaService,
    private readonly chatFileStorageService: ChatFileStorageService,
    private readonly i18n: I18nService,
  ) {}

  async prepareUploadChatFile(
    input: {
      chatId: string;
      fileName: string;
      fileSize: bigint;
      mimeType: string;
      fileType: FileType;
    },
    uploaderOperatorId: string,
    organizationId: string,
  ) {
    this.logger.log(
      `Preparing chat file upload: chatId=${input.chatId}, fileName=${input.fileName}, ` +
        `fileSize=${input.fileSize}, mimeType=${input.mimeType}, operatorId=${uploaderOperatorId}`,
    );

    if (input.fileSize > BigInt(MAX_FILE_SIZE_BYTES)) {
      const formattedFileSize = formatBytes(Number(MAX_FILE_SIZE_BYTES));
      throw new BadRequestException(
        this.i18n.t('errors.chatFile.fileSizeExceeded', {
          args: {
            size: formattedFileSize,
          },
        }),
      );
    }

    if (!this.isMimeTypeAllowed(input.mimeType)) {
      throw new BadRequestException(this.i18n.t('errors.chatFile.invalidMimeType'));
    }

    const tenant = this.tenantSchema.getTables(organizationId);
    const organizationName = await this.getOrganizationName(organizationId);

    const chat = await this.db
      .select()
      .from(tenant.chat)
      .where(eq(tenant.chat.id, input.chatId))
      .then((rows) => rows[0] || null);

    if (!chat) {
      throw new NotFoundException(this.i18n.t('errors.chat.notFound'));
    }
    const isAssignedOperator = chat.assignedUserId === uploaderOperatorId;
    if (!isAssignedOperator) {
      const chatIsAssigned = chat.assignedUserId != null;

      if (!chatIsAssigned) {
        throw new ForbiddenException(this.i18n.t('errors.chatFile.accessDenied'));
      }

      const uploader = await this.db
        .select({ roleType: tenant.user.roleType })
        .from(tenant.user)
        .where(eq(tenant.user.id, uploaderOperatorId))
        .then((rows) => rows[0] || null);

      const isAdminOperator = uploader?.roleType === UserRoleType.ADMIN_OPERATOR;
      const hasElevatedAccess = isAdminOperator && chatIsAssigned;

      if (!hasElevatedAccess) {
        throw new ForbiddenException(this.i18n.t('errors.chatFile.accessDenied'));
      }
    }

    const fileName = this.generateSanitizedFileName({
      originalFileName: input.fileName,
    });

    const gcsObjectKey = this.generateGcsObjectKey({
      organizationName,
      uploaderUserId: uploaderOperatorId,
      endUserId: chat.endUserId,
      fileName,
    });

    try {
      const [chatFile] = await this.db
        .insert(tenant.chatFile)
        .values({
          id: randomUUID(),
          chatId: input.chatId,
          uploaderOperatorId,
          fileName,
          originalFileName: input.fileName,
          fileSize: Number(input.fileSize),
          mimeType: input.mimeType,
          fileType: input.fileType,
          gcsObjectKey,
          storageFolder: FileFolderEnum.PENDING,
          status: FileStatusEnum.UPLOADING,
        })
        .returning();

      this.logger.log(
        `Chat file record created: fileId=${chatFile.id}, gcsObjectKey=${gcsObjectKey}`,
      );

      const signedUrl = await this.chatFileStorageService.generateSignedUrl({
        gcsPath: gcsObjectKey,
        contentType: input.mimeType,
        action: 'write',
      });

      this.logger.log(`Signed upload URL generated for fileId=${chatFile.id}`);

      return {
        chatFile: {
          ...chatFile,
          scanResult: chatFile.scanResult ? JSON.stringify(chatFile.scanResult) : null,
        },
        signedUrl,
      };
    } catch (error) {
      this.logger.error(`Failed to prepare chat file upload: ${error.message}`);

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(this.i18n.t('errors.chatFile.uploadFailed'));
    }
  }

  isMimeTypeAllowed = (mimeType: string) => {
    return CHAT_FILE_ACCEPTED_MIME_TYPES.some((acceptedMimeType) => {
      if (acceptedMimeType.endsWith('/*')) {
        const prefix = acceptedMimeType.slice(0, acceptedMimeType.length - 1);
        return mimeType.startsWith(prefix);
      }

      return acceptedMimeType === mimeType;
    });
  };

  async prepareUploadChatFileForEndUser(
    input: {
      fileName: string;
      fileSize: bigint;
      mimeType: string;
      fileType: FileType;
    },
    endUserId: string,
    organizationId: string,
  ) {
    this.logger.log(
      `Preparing end user chat file upload: fileName=${input.fileName}, ` +
        `fileSize=${input.fileSize}, mimeType=${input.mimeType}, endUserId=${endUserId}`,
    );

    if (input.fileSize > BigInt(MAX_FILE_SIZE_BYTES)) {
      const formattedFileSize = formatBytes(Number(MAX_FILE_SIZE_BYTES));
      throw new BadRequestException(
        this.i18n.t('errors.chatFile.fileSizeExceeded', {
          args: {
            size: formattedFileSize,
          },
        }),
      );
    }

    if (!this.isMimeTypeAllowed(input.mimeType)) {
      throw new BadRequestException(this.i18n.t('errors.chatFile.invalidMimeType'));
    }

    const organizationName = await this.getOrganizationName(organizationId);
    const tenant = this.tenantSchema.getTables(organizationId);

    const chat = await this.db
      .select()
      .from(tenant.chat)
      .where(eq(tenant.chat.endUserId, endUserId))
      .then((rows) => rows[0] || null);

    if (!chat) {
      throw new NotFoundException(this.i18n.t('errors.chat.notFound'));
    }

    const fileName = this.generateSanitizedFileName({
      originalFileName: input.fileName,
    });

    const gcsObjectKey = this.generateGcsObjectKey({
      organizationName,
      uploaderUserId: endUserId,
      endUserId,
      fileName,
    });

    try {
      const [chatFile] = await this.db
        .insert(tenant.chatFile)
        .values({
          id: randomUUID(),
          chatId: chat.id,
          uploaderEndUserId: endUserId,
          fileName,
          originalFileName: input.fileName,
          fileSize: Number(input.fileSize),
          mimeType: input.mimeType,
          fileType: input.fileType,
          gcsObjectKey,
          storageFolder: FileFolderEnum.PENDING,
          status: FileStatusEnum.UPLOADING,
        })
        .returning();

      this.logger.log(
        `End user chat file record created: fileId=${chatFile.id}, gcsObjectKey=${gcsObjectKey}`,
      );

      const signedUrl = await this.chatFileStorageService.generateSignedUrl({
        gcsPath: gcsObjectKey,
        contentType: input.mimeType,
        action: 'write',
      });

      this.logger.log(`Signed upload URL generated for fileId=${chatFile.id}`);

      return {
        chatFile: {
          ...chatFile,
          scanResult: chatFile.scanResult ? JSON.stringify(chatFile.scanResult) : null,
        },
        signedUrl,
      };
    } catch (error) {
      this.logger.error(`Failed to prepare end user chat file upload: ${error.message}`);

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(this.i18n.t('errors.chatFile.uploadFailed'));
    }
  }

  async listChatFilesForOperator(
    args: ChatFileListArgs,
    paginationArgs: CursorPaginationArgs,
    requester: { organizationId: string; userId: string },
  ): Promise<ChatFileListResponse> {
    const tenant = this.tenantSchema.getTables(requester.organizationId);

    await this.validateListChatFilesRequest({
      args,
      tenant,
      operatorId: requester.userId,
    });

    const statusFilters = this.getOperatorStatusFilters(tenant);

    return this.fetchChatFilesWithPagination({
      args,
      tenant,
      statusFilters,
      paginationArgs,
    });
  }

  async listChatFilesForEndUser(
    requester: { endUserId: string; organizationId: string },
    paginationArgs: CursorPaginationArgs,
  ): Promise<ChatFileListResponse> {
    const tenant = this.tenantSchema.getTables(requester.organizationId);

    const chat = await this.db
      .select({ id: tenant.chat.id })
      .from(tenant.chat)
      .where(eq(tenant.chat.endUserId, requester.endUserId))
      .then((rows) => rows[0] || null);

    if (!chat) {
      throw new NotFoundException(this.i18n.t('errors.chat.notFound'));
    }

    const statusFilters = this.getEndUserStatusFilters(tenant, requester.endUserId);

    return this.fetchChatFilesWithPagination({
      args: { chatId: chat.id } as ChatFileListArgs,
      tenant,
      statusFilters,
      paginationArgs,
    });
  }

  private getOperatorStatusFilters(tenant: TenantTables): SQL[] {
    return [
      and(
        isNotNull(tenant.chatFile.uploaderOperatorId),
        inArray(tenant.chatFile.status, this.viewStatuses),
      )!,
      and(
        isNotNull(tenant.chatFile.uploaderEndUserId),
        inArray(tenant.chatFile.status, this.viewStatuses),
      )!,
    ];
  }

  private getEndUserStatusFilters(tenant: TenantTables, endUserId: string): SQL[] {
    return [
      and(
        eq(tenant.chatFile.uploaderEndUserId, endUserId),
        inArray(tenant.chatFile.status, this.viewStatuses),
      )!,
      and(
        isNotNull(tenant.chatFile.uploaderOperatorId),
        inArray(tenant.chatFile.status, this.viewStatuses),
      )!,
    ];
  }

  private async fetchChatFilesWithPagination({
    args,
    tenant,
    statusFilters,
    paginationArgs,
  }: {
    args: ChatFileListArgs;
    tenant: TenantTables;
    statusFilters: SQL[];
    paginationArgs: CursorPaginationArgs;
  }): Promise<ChatFileListResponse> {
    const { cursorId, take } = paginationArgs;

    const baseWhere = and(
      eq(tenant.chatFile.chatId, args.chatId),
      isNull(tenant.chatFile.deletedAt),
      or(...statusFilters),
    );

    // Build cursor condition
    let cursorCondition: SQL | undefined;
    if (cursorId) {
      const cursorFile = await this.db
        .select({ createdAt: tenant.chatFile.createdAt, id: tenant.chatFile.id })
        .from(tenant.chatFile)
        .where(eq(tenant.chatFile.id, cursorId))
        .then((rows) => rows[0] || null);

      if (cursorFile) {
        cursorCondition = or(
          lt(tenant.chatFile.createdAt, cursorFile.createdAt),
          and(
            eq(tenant.chatFile.createdAt, cursorFile.createdAt),
            lt(tenant.chatFile.id, cursorFile.id),
          ),
        );
      }
    }

    const whereClause = cursorCondition ? and(baseWhere, cursorCondition) : baseWhere;

    const [files, totalCountResult] = await Promise.all([
      this.db
        .select({
          id: tenant.chatFile.id,
          chatId: tenant.chatFile.chatId,
          uploaderOperatorId: tenant.chatFile.uploaderOperatorId,
          uploaderEndUserId: tenant.chatFile.uploaderEndUserId,
          fileName: tenant.chatFile.fileName,
          originalFileName: tenant.chatFile.originalFileName,
          fileSize: tenant.chatFile.fileSize,
          mimeType: tenant.chatFile.mimeType,
          fileType: tenant.chatFile.fileType,
          gcsObjectKey: tenant.chatFile.gcsObjectKey,
          storageFolder: tenant.chatFile.storageFolder,
          status: tenant.chatFile.status,
          scanResult: tenant.chatFile.scanResult,
          createdAt: tenant.chatFile.createdAt,
          updatedAt: tenant.chatFile.updatedAt,
          deletedAt: tenant.chatFile.deletedAt,
          deletedBy: tenant.chatFile.deletedBy,
          uploaderOperatorName: tenant.user.displayName,
          uploaderEndUserName: tenant.endUser.displayName,
        })
        .from(tenant.chatFile)
        .leftJoin(tenant.user, eq(tenant.chatFile.uploaderOperatorId, tenant.user.id))
        .leftJoin(tenant.endUser, eq(tenant.chatFile.uploaderEndUserId, tenant.endUser.userId))
        .where(whereClause)
        .orderBy(desc(tenant.chatFile.createdAt), desc(tenant.chatFile.id))
        .limit(take ? take + 1 : 100),
      this.db
        .select({ value: count() })
        .from(tenant.chatFile)
        .where(baseWhere)
        .then((rows) => rows[0]?.value ?? 0),
    ]);

    const {
      items: paginatedItems,
      hasMore,
      nextCursorId,
      nextCursorCreatedAt,
    } = getCursorArgs(files, take);

    const serializedItems = paginatedItems.map((file) => ({
      ...file,
      uploaderOperatorName: file.uploaderOperatorName ?? null,
      uploaderEndUserName: file.uploaderEndUserName ?? null,
    }));

    return {
      items: serializedItems as ChatFile[],
      nextCursorId: nextCursorId ?? null,
      nextCursorCreatedAt: nextCursorCreatedAt ?? null,
      hasMore,
      totalCount: totalCountResult,
    };
  }

  private async validateListChatFilesRequest({
    args,
    tenant,
    operatorId,
  }: {
    args: ChatFileListArgs;
    tenant: TenantTables;
    operatorId?: string;
  }) {
    const chat = await this.db
      .select({
        id: tenant.chat.id,
        assignedUserId: tenant.chat.assignedUserId,
      })
      .from(tenant.chat)
      .where(and(eq(tenant.chat.id, args.chatId), eq(tenant.chat.endUserId, args.endUserId)))
      .then((rows) => rows[0] || null);

    if (!chat) {
      throw new NotFoundException(this.i18n.t('errors.chat.notFound'));
    }

    const chatAssignments = await this.db
      .select({ teamId: tenant.chatTeamAssignment.teamId })
      .from(tenant.chatTeamAssignment)
      .where(eq(tenant.chatTeamAssignment.chatId, chat.id));

    if (operatorId) {
      const user = await this.db
        .select({
          roleType: tenant.user.roleType,
        })
        .from(tenant.user)
        .where(eq(tenant.user.id, operatorId))
        .then((rows) => rows[0] || null);

      if (!user) {
        throw new NotFoundException(this.i18n.t('errors.user.notFound'));
      }

      const userTeams = await this.db
        .select({ teamId: tenant.userTeam.teamId })
        .from(tenant.userTeam)
        .where(eq(tenant.userTeam.userId, operatorId));

      const isPrivilegedOperator =
        adminRoles.includes(user.roleType) ||
        chatAssignments.some((assignment) =>
          userTeams.some((userTeam) => userTeam.teamId === assignment.teamId),
        ) ||
        chat.assignedUserId === operatorId;

      if (!isPrivilegedOperator) {
        throw new ForbiddenException(this.i18n.t('errors.chatFile.accessDenied'));
      }
    }
  }

  async downloadChatFile({
    fileId,
    organizationId,
    userId,
  }: {
    fileId: string;
    organizationId: string;
    userId: string;
  }): Promise<{
    metadata?: FileMetadata | undefined;
    chatFile: ChatFileRow;
    stream?: Readable;
  }> {
    if (!fileId || !organizationId || !userId) {
      throw new BadRequestException(this.i18n.t('errors.exception.badRequest'));
    }

    const tenant = this.tenantSchema.getTables(organizationId);

    const chatFile = await this.db
      .select()
      .from(tenant.chatFile)
      .where(and(eq(tenant.chatFile.id, fileId), isNull(tenant.chatFile.deletedAt)))
      .then((rows) => rows[0] || null);

    if (!chatFile) {
      throw new NotFoundException(this.i18n.t('errors.chatFile.notFound'));
    }

    await this.validateDownloadAccess({ chatFile, userId, tenant });

    const gcsPath = chatFile.gcsObjectKey;
    if (!gcsPath) {
      throw new NotFoundException(this.i18n.t('errors.chatFile.notFound'));
    }

    if (chatFile.status !== FileStatusEnum.SCANNED) {
      throw new BadRequestException(this.i18n.t('errors.chatFile.notAvailableForDownload'));
    }

    const { exists, stream, metadata } = await this.chatFileStorageService.streamFile(gcsPath);

    if (!exists || !stream) {
      throw new NotFoundException(this.i18n.t('errors.chatFile.notFound'));
    }

    return { metadata, chatFile, stream };
  }

  private async validateDownloadAccess({
    chatFile,
    userId,
    tenant,
  }: {
    chatFile: ChatFileRow;
    userId: string;
    tenant: TenantTables;
  }) {
    const user = await this.db
      .select({ roleType: tenant.user.roleType })
      .from(tenant.user)
      .where(eq(tenant.user.id, userId))
      .then((rows) => rows[0] || null);

    if (!user) {
      throw new NotFoundException(this.i18n.t('errors.user.notFound'));
    }

    if (adminRoles.includes(user.roleType)) {
      return;
    }

    if (managerRoles.includes(user.roleType)) {
      const [chatAssignments, userTeams] = await Promise.all([
        this.db
          .select({ teamId: tenant.chatTeamAssignment.teamId })
          .from(tenant.chatTeamAssignment)
          .where(eq(tenant.chatTeamAssignment.chatId, chatFile.chatId)),
        this.db
          .select({ teamId: tenant.userTeam.teamId })
          .from(tenant.userTeam)
          .where(eq(tenant.userTeam.userId, userId)),
      ]);

      const isInChatTeam = chatAssignments.some((assignment) =>
        userTeams.some((userTeam) => userTeam.teamId === assignment.teamId),
      );

      if (isInChatTeam) {
        return;
      }
    }

    const chat = await this.db
      .select({ assignedUserId: tenant.chat.assignedUserId })
      .from(tenant.chat)
      .where(eq(tenant.chat.id, chatFile.chatId))
      .then((rows) => rows[0] || null);

    if (!chat) {
      throw new NotFoundException(this.i18n.t('errors.chat.notFound'));
    }

    if (chat.assignedUserId === userId) {
      return;
    }

    throw new ForbiddenException(this.i18n.t('errors.chatFile.accessDenied'));
  }

  async getDownloadUrlForEndUser(
    fileId: string,
    endUserId: string,
    organizationId: string,
  ): Promise<ChatFileDownloadUrlResponse> {
    if (!fileId || !endUserId || !organizationId) {
      throw new BadRequestException(this.i18n.t('errors.exception.badRequest'));
    }

    const tenant = this.tenantSchema.getTables(organizationId);

    const chatFile = await this.db
      .select()
      .from(tenant.chatFile)
      .where(and(eq(tenant.chatFile.id, fileId), isNull(tenant.chatFile.deletedAt)))
      .then((rows) => rows[0] || null);

    if (!chatFile) {
      throw new NotFoundException(this.i18n.t('errors.chatFile.notFound'));
    }

    const chat = await this.db
      .select()
      .from(tenant.chat)
      .where(and(eq(tenant.chat.id, chatFile.chatId), eq(tenant.chat.endUserId, endUserId)))
      .then((rows) => rows[0] || null);

    if (!chat) {
      throw new NotFoundException(this.i18n.t('errors.chat.notFound'));
    }

    if (chatFile.status !== FileStatusEnum.SCANNED) {
      throw new BadRequestException(this.i18n.t('errors.chatFile.notAvailableForDownload'));
    }

    if (!chatFile.gcsObjectKey) {
      throw new NotFoundException(this.i18n.t('errors.chatFile.notFound'));
    }

    const fileName = chatFile.originalFileName ?? chatFile.fileName ?? 'file';
    const mimeType = chatFile.mimeType ?? 'application/octet-stream';

    const fileExistsOnGCS = await this.chatFileStorageService.fileExists(chatFile.gcsObjectKey);
    if (!fileExistsOnGCS) {
      throw new NotFoundException(this.i18n.t('errors.chatFile.notFound'));
    }

    const signedUrl = await this.chatFileStorageService.generateSignedUrl({
      gcsPath: chatFile.gcsObjectKey,
      action: 'read',
      expirationMinutes: 15,
      responseDisposition: `attachment; filename="${encodeURIComponent(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      responseType: 'application/octet-stream',
    });

    return { signedUrl, fileName, mimeType };
  }

  async validateDeleteAccess({
    fileId,
    userId,
    organizationId,
  }: {
    fileId: string;
    userId: string;
    organizationId: string;
  }) {
    const tenant = this.tenantSchema.getTables(organizationId);

    const chatFile = await this.db
      .select()
      .from(tenant.chatFile)
      .where(and(eq(tenant.chatFile.id, fileId), isNull(tenant.chatFile.deletedAt)))
      .then((rows) => rows[0] || null);

    if (!chatFile) {
      throw new NotFoundException(this.i18n.t('errors.chatFile.notFound'));
    }

    const chat = await this.db
      .select({
        assignedUserId: tenant.chat.assignedUserId,
      })
      .from(tenant.chat)
      .where(eq(tenant.chat.id, chatFile.chatId))
      .then((rows) => rows[0] || null);

    if (!chat) {
      throw new NotFoundException(this.i18n.t('errors.chat.notFound'));
    }

    const chatAssignments = await this.db
      .select({ teamId: tenant.chatTeamAssignment.teamId })
      .from(tenant.chatTeamAssignment)
      .where(eq(tenant.chatTeamAssignment.chatId, chatFile.chatId));

    const user = await this.db
      .select({
        roleType: tenant.user.roleType,
      })
      .from(tenant.user)
      .where(eq(tenant.user.id, userId))
      .then((rows) => rows[0] || null);

    if (!user) {
      throw new NotFoundException(this.i18n.t('errors.user.notFound'));
    }

    const isAdmin = adminRoles.includes(user.roleType);

    if (isAdmin) {
      return { chatFile };
    }

    const userTeams = await this.db
      .select({ teamId: tenant.userTeam.teamId })
      .from(tenant.userTeam)
      .where(eq(tenant.userTeam.userId, userId));

    const isManager = managerRoles.includes(user.roleType);
    const isTeamManager =
      isManager &&
      chatAssignments.some((assignment) =>
        userTeams.some((userTeam) => userTeam.teamId === assignment.teamId),
      );

    if (isTeamManager) {
      return { chatFile };
    }

    const isAssignedOperator = chat.assignedUserId === userId;
    const isOperatorUploadedFile = !!(!chatFile.uploaderEndUserId && chatFile.uploaderOperatorId);

    if (isAssignedOperator && isOperatorUploadedFile) {
      return { chatFile };
    }

    throw new ForbiddenException(this.i18n.t('errors.chatFile.accessDenied'));
  }

  async deleteChatFile({
    fileId,
    userId,
    organizationId,
  }: {
    fileId: string;
    userId: string;
    organizationId: string;
  }) {
    const { chatFile } = await this.validateDeleteAccess({ fileId, userId, organizationId });

    const tenant = this.tenantSchema.getTables(organizationId);

    await this.db
      .update(tenant.chatFile)
      .set({
        deletedAt: new Date(),
        deletedBy: userId,
        status: FileStatusEnum.DELETED,
      })
      .where(eq(tenant.chatFile.id, fileId));

    await this.chatFileStorageService.deleteChatFile(chatFile.gcsObjectKey);

    // TODO: Create chat activity message
    return { success: true };
  }

  async deleteChatFileForEndUser({
    fileId,
    endUserId,
    organizationId,
  }: {
    fileId: string;
    endUserId: string;
    organizationId: string;
  }) {
    const tenant = this.tenantSchema.getTables(organizationId);

    const chatFile = await this.db
      .select()
      .from(tenant.chatFile)
      .where(and(eq(tenant.chatFile.id, fileId), isNull(tenant.chatFile.deletedAt)))
      .then((rows) => rows[0] || null);

    if (!chatFile) {
      throw new NotFoundException(this.i18n.t('errors.chatFile.notFound'));
    }

    if (chatFile.uploaderEndUserId !== endUserId) {
      throw new ForbiddenException(this.i18n.t('errors.chatFile.accessDenied'));
    }

    await this.db
      .update(tenant.chatFile)
      .set({
        deletedAt: new Date(),
        deletedBy: endUserId,
        status: FileStatusEnum.DELETED,
      })
      .where(eq(tenant.chatFile.id, fileId));

    await this.chatFileStorageService.deleteChatFile(chatFile.gcsObjectKey);

    return { success: true };
  }

  async confirmChatFileUpload({
    fileId,
    organizationId,
    chatFile,
  }: {
    fileId: string;
    organizationId: string;
    chatFile: TenantTables['chatFile']['$inferSelect'];
  }) {
    const tenant = this.tenantSchema.getTables(organizationId);

    if (!chatFile || chatFile.status !== FileStatusEnum.UPLOADING) {
      throw new NotFoundException(this.i18n.t('errors.chatFile.notFound'));
    }

    const fileExists = await this.chatFileStorageService.fileExists(chatFile.gcsObjectKey);

    if (!fileExists) {
      throw new NotFoundException(this.i18n.t('errors.chatFile.notYetUploaded'));
    }

    this.logger.log(
      `File verified in GCS: fileId=${fileId}, gcsObjectKey=${chatFile.gcsObjectKey}`,
    );

    try {
      const [updatedChatFile] = await this.db
        .update(tenant.chatFile)
        .set({
          status: FileStatusEnum.PENDING_SCAN,
        })
        .where(eq(tenant.chatFile.id, fileId))
        .returning();

      this.logger.log(`Chat file status updated to PENDING_SCAN: fileId=${fileId}`);

      await this.chatFileStorageService.triggerVirusScan(updatedChatFile);

      this.logger.log(`Virus scan triggered: fileId=${fileId}`);

      return {
        success: true,
        chatFile: {
          ...updatedChatFile,
          scanResult: updatedChatFile.scanResult
            ? JSON.stringify(updatedChatFile.scanResult)
            : null,
        },
      };
    } catch (error) {
      logErrorDetails(
        `Virus scan trigger failed for fileId=${chatFile.id} after all retries`,
        error,
        this.logger,
      );

      await this.db
        .update(tenant.chatFile)
        .set({
          status: FileStatusEnum.UPLOADING,
        })
        .where(eq(tenant.chatFile.id, fileId));

      this.logger.log(`Chat file status reverted to UPLOADING: fileId=${fileId}`);

      throw error;
    }
  }

  async confirmChatFileUploadForOperator({
    fileId,
    organizationId,
    operatorId,
  }: {
    fileId: string;
    organizationId: string;
    operatorId: string;
  }) {
    this.logger.log(`Confirming chat file upload: fileId=${fileId}`);

    const tenant = this.tenantSchema.getTables(organizationId);

    const chatFile = await this.db
      .select()
      .from(tenant.chatFile)
      .where(
        and(
          eq(tenant.chatFile.id, fileId),
          eq(tenant.chatFile.uploaderOperatorId, operatorId),
          isNull(tenant.chatFile.deletedAt),
        ),
      )
      .then((rows) => rows[0] || null);

    return this.confirmChatFileUpload({ fileId, organizationId, chatFile });
  }

  async confirmChatFileUploadForEndUser({
    fileId,
    organizationId,
    endUserId,
  }: {
    fileId: string;
    organizationId: string;
    endUserId: string;
  }) {
    this.logger.log(`Confirming chat file upload: fileId=${fileId}`);

    const tenant = this.tenantSchema.getTables(organizationId);

    const chatFile = await this.db
      .select()
      .from(tenant.chatFile)
      .where(
        and(
          eq(tenant.chatFile.id, fileId),
          eq(tenant.chatFile.uploaderEndUserId, endUserId),
          isNull(tenant.chatFile.deletedAt),
        ),
      )
      .then((rows) => rows[0] || null);

    return this.confirmChatFileUpload({ fileId, organizationId, chatFile });
  }

  async handleVirusScanResult({
    gcsObjectKey,
    infected,
  }: {
    gcsObjectKey: string;
    infected: boolean;
  }) {
    this.logger.log(
      `Processing virus scan result: gcsObjectKey=${gcsObjectKey}, infected=${infected}`,
    );

    // TODO: Resolve tenant from gcsObjectKey (parse organizationName from path,
    // look up organization UUID, then use TenantSchemaService.getTables(orgId))
    // For now, parse organizationName from the GCS path and look up the org.
    const organizationName = gcsObjectKey.split('/')[0];
    if (!organizationName) {
      throw new BadRequestException('Unable to parse organization from gcsObjectKey');
    }

    const organizationId = await this.getOrganizationIdByName(organizationName);
    const tenant = this.tenantSchema.getTables(organizationId);

    const file = await this.db
      .select()
      .from(tenant.chatFile)
      .where(eq(tenant.chatFile.gcsObjectKey, gcsObjectKey))
      .then((rows) => rows[0] || null);

    if (!file) {
      throw new NotFoundException(this.i18n.t('errors.chatFile.notFound'));
    }

    this.logger.log(`Found chat file for scan result: fileId=${file.id}`);

    const newStatus = infected ? FileStatusEnum.VIRUS_DETECTED : FileStatusEnum.SCANNED;
    const newFolder = infected ? FileFolderEnum.FAILED : FileFolderEnum.PROCESSED;

    const newGcsObjectKey = await this.chatFileStorageService.moveProcessedFile(
      gcsObjectKey,
      infected,
    );

    await this.db
      .update(tenant.chatFile)
      .set({
        status: newStatus,
        storageFolder: newFolder,
        gcsObjectKey: newGcsObjectKey,
      })
      .where(eq(tenant.chatFile.id, file.id));

    // TODO: Create chat activity message

    this.logger.log(`Virus scan result processed: ${file.id} - ${newStatus}`);

    return { success: true, status: newStatus };
  }

  private async getOrganizationIdByName(organizationName: string): Promise<string> {
    const org = await this.db
      .select({ id: shared.organization.id })
      .from(shared.organization)
      .where(eq(shared.organization.name, organizationName))
      .then((rows) => rows[0] || null);

    if (!org) {
      throw new NotFoundException(this.i18n.t('errors.organization.notFound'));
    }

    return org.id;
  }

  private async getOrganizationName(organizationId: string): Promise<string> {
    const org = await this.db
      .select({ name: shared.organization.name })
      .from(shared.organization)
      .where(eq(shared.organization.id, organizationId))
      .then((rows) => rows[0] || null);

    if (!org) {
      throw new NotFoundException(this.i18n.t('errors.organization.notFound'));
    }

    return org.name;
  }

  private generateSanitizedFileName({ originalFileName }: { originalFileName: string }) {
    const now = new Date();
    const pad = (num: number, size: number) => num.toString().padStart(size, '0');
    const timestamp =
      `${now.getFullYear()}${pad(now.getMonth() + 1, 2)}${pad(now.getDate(), 2)}_` +
      `${pad(now.getHours(), 2)}${pad(now.getMinutes(), 2)}${pad(now.getSeconds(), 2)}` +
      `${pad(now.getMilliseconds(), 3)}`;

    const firstDotIndex = originalFileName.indexOf('.');
    let baseName = originalFileName;
    let extension = '';
    if (firstDotIndex !== -1) {
      baseName = originalFileName.slice(0, firstDotIndex);
      extension = originalFileName.slice(firstDotIndex + 1);
    }

    const sanitizedBaseName = sanitize(baseName) || 'file';
    const sanitizedExtension = sanitize(extension);

    const fileName = `${sanitizedBaseName}-${timestamp}${sanitizedExtension ? '.' + sanitizedExtension : ''}`;

    return fileName;
  }

  private generateGcsObjectKey({
    organizationName,
    endUserId,
    uploaderUserId,
    fileName,
  }: {
    organizationName: string;
    endUserId: string;
    uploaderUserId: string;
    fileName: string;
  }): string {
    return `${organizationName}/files/${endUserId}/${uploaderUserId}/${fileName}`;
  }
}
