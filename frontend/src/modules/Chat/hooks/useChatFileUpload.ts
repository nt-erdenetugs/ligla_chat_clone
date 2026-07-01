import {
  useConfirmChatFileUploadMutation,
  useUploadChatFileMutation,
} from '~/generated/graphql/types';
import { getFileType } from '~/utils';

export type UploadChatFileResult = {
  fileId: string;
  fileName: string;
};

export const useChatFileUpload = () => {
  const [uploadChatFileMutation] = useUploadChatFileMutation();
  const [confirmChatFileUploadMutation] = useConfirmChatFileUploadMutation();

  return async function uploadChatFile(chatId: string, file: File): Promise<UploadChatFileResult> {
    const fileType = getFileType(file.name);
    if (fileType === null) {
      throw new Error('Invalid file type');
    }

    const signedUrlResult = await uploadChatFileMutation({
      variables: {
        input: {
          chatId,
          fileName: file.name,
          fileSize: file.size,
          fileType,
          mimeType: file.type,
        },
      },
    });

    const signedUrl = signedUrlResult.data?.uploadChatFile.signedUrl;
    if (!signedUrlResult.data || !signedUrl) {
      throw new Error('Failed to get signed url');
    }

    const chatFileId = signedUrlResult.data.uploadChatFile.chatFile.id;

    const uploadResult = await fetch(signedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    });

    if (!uploadResult.ok) {
      throw new Error('Failed to upload file');
    }

    const { data } = await confirmChatFileUploadMutation({
      variables: {
        input: {
          fileId: chatFileId,
        },
      },
    });

    const confirm = data?.confirmChatFileUpload;
    if (!confirm || !confirm.success) {
      throw new Error('Failed to confirm chat file upload');
    }

    return {
      fileId: chatFileId,
      fileName: file.name,
    };
  };
};
