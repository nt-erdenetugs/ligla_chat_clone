import { Typography } from '@mui/material';
import { type FileRejection } from 'react-dropzone';

import { SkeletonSuspense } from '~/common/components';
import { FILE_SIZE, USER_DEFAULT_PICTURE_URL, type UserStatusType } from '~/common/constants';
import { useTranslation } from '~/locales/hooks';

import UploadImage from './UploadImage';

type UploadProfileImageProps = {
  fileUrl?: Nullish<string>;
  isLoading: boolean;
  onDrop: (acceptedFiles: File[], rejectedFiles: FileRejection[]) => void;
  userStatus?: UserStatusType;
  children?: React.ReactNode;
};

export const PROFILE_FILE_ACCEPTED_TYPE = 'png';

export function UploadProfileImage({
  fileUrl,
  isLoading,
  onDrop,
  children,
  ...otherProps
}: UploadProfileImageProps) {
  const { t } = useTranslation();

  return (
    <SkeletonSuspense
      skeletonProps={{ variant: 'circular', animation: 'wave', width: 144, height: 144 }}
      isLoading={isLoading}
    >
      <UploadImage
        file={fileUrl || USER_DEFAULT_PICTURE_URL}
        onDrop={onDrop}
        maxSize={FILE_SIZE.MB} // 1MB
        accept={{ 'image/png': [] }}
        helperText={
          <Typography
            variant='caption'
            sx={{
              m: 1,
              mx: 'auto',
              display: 'block',
              textAlign: 'center',
              color: 'text.disabled',
            }}
          >
            {t('upload.supportedFileType', { ext: PROFILE_FILE_ACCEPTED_TYPE })}
            <br />
            {t('upload.maxSize', { size: '1MB' })}
            <br />
            {t('upload.aspectRatio')}
          </Typography>
        }
        {...otherProps}
      >
        {children}
      </UploadImage>
    </SkeletonSuspense>
  );
}
