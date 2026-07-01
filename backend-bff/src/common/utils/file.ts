import { ConfigService } from '@nestjs/config';

export const createUserProfilePath = (organizationName: string, userId: string): string => {
  return `${organizationName}/images/users/${userId}/profile.png`;
};

export const getPublicFileUrl = (
  filePath: string,
  publicBucketName: string,
  publicMediaUrl?: string,
): string => {
  // Notes: cache busting
  const t = Date.now();
  if (process.env.NODE_ENV === 'development') {
    return `${publicMediaUrl}/${encodeURIComponent(filePath)}?alt=media&t=${t}`;
  }
  const STORAGE_PUBLIC_URL = publicMediaUrl || `https://storage.googleapis.com/${publicBucketName}`;
  return `${STORAGE_PUBLIC_URL}/${filePath}?t=${t}`;
};

export const formatBytes = (bytes: number): string => {
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);
  return `${size} ${units[i]}`;
};

export const getDefaultPictureUrl = (configService: ConfigService): string => {
  const mediaBaseUrl = configService.get<string>('GCP_STORAGE_CHAT_PUBLIC_MEDIA_URL');
  const publicBucketName = configService.get<string>('GCP_STORAGE_CHAT_PUBLIC_DATA_BUCKET') || '';
  if (!mediaBaseUrl) {
    throw new Error('GCP_STORAGE_CHAT_PUBLIC_MEDIA_URL is not defined in environment variables');
  }

  return getPublicFileUrl('shared/images/default-avatar.png', publicBucketName, mediaBaseUrl);
};

const uploadIconPathByToken: Record<string, string> = {
  DOCUMENT: 'shared/images/description-icon.png',
  IMAGE: 'shared/images/image-icon.png',
  VIDEO: 'shared/images/video-icon.png',
  AUDIO: 'shared/images/audio-icon.png',
  ARCHIVE: 'shared/images/archive-icon.png',
  FILE: 'shared/images/file-icon.png',
};

export const getUploadTypeIconUrl = (configService: ConfigService, token?: string): string => {
  const mediaBaseUrl = configService.get<string>('GCP_STORAGE_CHAT_PUBLIC_MEDIA_URL');
  const publicBucketName = configService.get<string>('GCP_STORAGE_CHAT_PUBLIC_DATA_BUCKET') || '';
  if (!mediaBaseUrl) {
    throw new Error('GCP_STORAGE_CHAT_PUBLIC_MEDIA_URL is not defined in environment variables');
  }

  const normalizedToken = (token || 'FILE').toUpperCase();
  const iconPath = uploadIconPathByToken[normalizedToken] || uploadIconPathByToken.FILE;

  return getPublicFileUrl(iconPath, publicBucketName, mediaBaseUrl);
};

export const getFlexLogoUrl = (configService: ConfigService): string => {
  const mediaBaseUrl = configService.get<string>('GCP_STORAGE_CHAT_PUBLIC_MEDIA_URL');
  const publicBucketName = configService.get<string>('GCP_STORAGE_CHAT_PUBLIC_DATA_BUCKET') || '';
  if (!mediaBaseUrl) {
    throw new Error('GCP_STORAGE_CHAT_PUBLIC_MEDIA_URL is not defined in environment variables');
  }

  return getPublicFileUrl('shared/images/cloud-upload.png', publicBucketName, mediaBaseUrl);
};
