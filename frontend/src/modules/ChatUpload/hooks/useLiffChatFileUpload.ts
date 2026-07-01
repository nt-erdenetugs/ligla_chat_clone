import { useCallback, useState } from 'react';

import {
  useUploadChatFileForEndUserMutation,
  useConfirmChatFileUploadForEndUserMutation,
} from '~/generated/graphql/types';
import { getFileType } from '~/utils';

interface UseLiffChatFileUploadParams {
  onUploadComplete?: () => void;
}

type UploadFilesOptions = {
  onFileUploaded?: (chatFile: {
    originalFileName?: string | null;
    fileName: string;
  }) => Promise<void> | void;
};

export const useLiffChatFileUpload = ({ onUploadComplete }: UseLiffChatFileUploadParams) => {
  const [uploading, setUploading] = useState(false);
  const [uploadChatFileMutation] = useUploadChatFileForEndUserMutation();
  const [confirmChatFileMutation] = useConfirmChatFileUploadForEndUserMutation();

  const _uploadFile = useCallback(
    async (file: File) => {
      const fileType = getFileType(file.name);
      if (fileType === null) {
        throw new Error('Invalid file type');
      }

      const signedUrlResult = await uploadChatFileMutation({
        variables: {
          input: {
            fileName: file.name,
            fileSize: file.size,
            fileType,
            mimeType: file.type,
          },
        },
      });

      const signedUrl = signedUrlResult.data?.uploadChatFileForEndUser.signedUrl;
      if (!signedUrlResult.data || !signedUrl) {
        throw new Error('Failed to get signed url');
      }

      const chatFileId = signedUrlResult.data.uploadChatFileForEndUser.chatFile.id;

      const uploadResult = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadResult.ok) {
        throw new Error('Failed to upload file');
      }

      const confirmResult = await confirmChatFileMutation({
        variables: {
          input: {
            fileId: chatFileId,
          },
        },
      });

      if (!confirmResult.data?.confirmChatFileUploadForEndUser.success) {
        throw new Error('Failed to confirm chat file upload');
      }

      return confirmResult.data.confirmChatFileUploadForEndUser.chatFile;
    },
    [uploadChatFileMutation, confirmChatFileMutation],
  );

  const uploadFile = useCallback(
    async (file: File) => {
      try {
        setUploading(true);
        const chatFile = await _uploadFile(file);
        onUploadComplete?.();
        return chatFile;
      } finally {
        setUploading(false);
      }
    },
    [_uploadFile, onUploadComplete],
  );

  const uploadFiles = useCallback(
    async (files: File[], options?: UploadFilesOptions) => {
      setUploading(true);

      const statuses = await Promise.allSettled(
        files.map(async (file) => {
          const chatFile = await _uploadFile(file);
          await options?.onFileUploaded?.(chatFile);
          return { chatFile };
        }),
      ).then((results) =>
        files.map((file, index) => {
          const result = results[index];
          if (result.status === 'fulfilled') {
            return { file, chatFile: result.value.chatFile };
          }
          return {
            file,
            error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
          };
        }),
      );

      setUploading(false);
      onUploadComplete?.();

      return statuses;
    },
    [onUploadComplete, _uploadFile],
  );

  return { uploadFile, uploadFiles, uploading };
};
