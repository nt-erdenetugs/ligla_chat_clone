import { fetchApi } from '~/utils';
import { triggerBlobDownload, getFilenameFromHeaders } from '~/utils/file';

export const useChatFileDownload = () => {
  return async function downloadChatFile(fileId: string) {
    if (!fileId) {
      throw new Error('Invalid file id');
    }
    const response = await fetchApi(`chat-files/${fileId}/download`);
    if (!response.ok) {
      throw new Error('Failed to download');
    }
    const filename = getFilenameFromHeaders(response) ?? 'file';
    const blob = await response.blob();
    triggerBlobDownload(blob, filename);
  };
};
