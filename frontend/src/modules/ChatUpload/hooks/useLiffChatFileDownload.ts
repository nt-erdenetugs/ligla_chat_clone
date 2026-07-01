import { useCallback } from 'react';

import liff from '@line/liff';

import { API_PREFIXES } from '~/common/constants';
import { useChatFileDownloadUrlForEndUserLazyQuery } from '~/generated/graphql/types';

export const useLiffChatFileDownload = () => {
  const [fetchDownloadUrl] = useChatFileDownloadUrlForEndUserLazyQuery({
    fetchPolicy: 'network-only',
  });

  const downloadFile = useCallback(
    async (fileId: string) => {
      if (!fileId) {
        throw new Error('Missing fileId');
      }

      const { data, error } = await fetchDownloadUrl({
        variables: { input: { fileId } },
      });

      if (error || !data?.chatFileDownloadUrlForEndUser?.signedUrl) {
        throw new Error(error?.message ?? 'Failed to get download URL');
      }

      // Why: LIFF SDK re-encodes URLs in openWindow(), corrupting GCS signed URL signatures
      // for non-ASCII filenames. BFF redirect preserves the signature through these layers:
      //
      // 1. GCS signedUrl:      https://storage.../マネージャー.pdf?X-Goog-Signature=abc
      // 2. encodeURIComponent: https%3A%2F%2Fstorage...%2F%E3%83%9E...pdf%3FX-Goog-Signature%3Dabc
      // 3. redirectUrl:        https://bff/srv/.../redirect?url=https%3A%2F%2Fstorage...%2F%E3%83%9E...
      // 4. LIFF openWindow:    https://bff/srv/.../redirect?url=https%3A%2F%2Fstorage...%2F%E3%83%9E...
      //                        (100% ASCII — LIFF has nothing to re-encode)
      // 5. BFF @Query('url'):  https://storage.../マネージャー.pdf?X-Goog-Signature=abc
      //                        (Express auto-decodes query param — original signedUrl restored)
      // 6. 302 Location:       https://storage.../マネージャー.pdf?X-Goog-Signature=abc
      // 7. Browser -> GCS:     https://storage.../マネージャー.pdf?X-Goog-Signature=abc
      //                        (signature intact — download works)
      const signedUrl = data.chatFileDownloadUrlForEndUser.signedUrl;
      const BASE_URL = import.meta.env.VITE_BACKEND_URL as string;
      const redirectUrl = `${BASE_URL}/${API_PREFIXES.HTTP}/chat-files/redirect?url=${encodeURIComponent(signedUrl)}`;

      liff.openWindow({
        url: redirectUrl,
        external: true,
      });
    },
    [fetchDownloadUrl],
  );

  return { downloadFile };
};
