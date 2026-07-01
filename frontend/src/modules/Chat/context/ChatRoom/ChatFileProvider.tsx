import { useCallback, useEffect, useMemo, useState } from 'react';

import { useSnackbar } from 'notistack';
import { useBlocker } from 'react-router';

import { ConfirmationDialog } from '~/common/components';
import { CHAT_FILE_ACCEPTED_MIME_TYPES } from '~/common/constants';
import { useTranslation } from '~/locales/hooks';

import { ChatFileContext, type ChatFileContextProps } from './ChatFileContext';

type ChatFileProviderProps = {
  children: React.ReactNode;
};

const isAcceptedFileType = (file: File) =>
  CHAT_FILE_ACCEPTED_MIME_TYPES.some((acceptedMimeType) => {
    if (acceptedMimeType.endsWith('/*')) {
      const prefix = acceptedMimeType.slice(0, acceptedMimeType.length - 1);
      return file.type.startsWith(prefix);
    }

    return acceptedMimeType === file.type;
  });

export const ChatFileProvider: React.FC<ChatFileProviderProps> = ({ children }) => {
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isShareUploadLinkStaged, setIsShareUploadLinkStaged] = useState(false);
  const [uploadingChatIds, setUploadingChatIds] = useState<Set<string>>(new Set());
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const isUploading = uploadingChatIds.size > 0;

  useEffect(() => {
    if (!isUploading) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isUploading]);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isUploading && currentLocation.pathname !== nextLocation.pathname,
  );

  const { enqueueSnackbar } = useSnackbar();
  const { t_toasts, t } = useTranslation();

  const addFiles = useCallback(
    (files: File[]) => {
      const accepted = files.filter(isAcceptedFileType);
      if (accepted.length < files.length) {
        enqueueSnackbar(t_toasts('chat.error.file.invalidType'), { variant: 'error' });
      }
      if (accepted.length === 0) return;

      let hadDuplicates = false;
      setPendingFiles((prev) => {
        const existingNames = new Set(prev.map((f) => f.name));
        const unique = accepted.filter((f) => {
          if (existingNames.has(f.name)) return false;
          existingNames.add(f.name);
          return true;
        });
        hadDuplicates = unique.length < accepted.length;
        return unique.length > 0 ? [...prev, ...unique] : prev;
      });
      if (hadDuplicates) {
        enqueueSnackbar(t_toasts('chat.error.file.duplicateName'), { variant: 'warning' });
      }
    },
    [enqueueSnackbar, t_toasts],
  );

  const removeFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearFiles = useCallback(() => {
    setPendingFiles([]);
  }, []);

  const openUploadDialog = useCallback(() => {
    setIsUploadDialogOpen(true);
  }, []);

  const closeUploadDialog = useCallback(() => {
    setIsUploadDialogOpen(false);
  }, []);

  const addUploadingChatId = useCallback((id: string) => {
    setUploadingChatIds((prev) => new Set(prev).add(id));
  }, []);

  const removeUploadingChatId = useCallback((id: string) => {
    setUploadingChatIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const value = useMemo<ChatFileContextProps>(
    () => ({
      pendingFiles,
      addFiles,
      removeFile,
      clearFiles,
      isShareUploadLinkStaged,
      setIsShareUploadLinkStaged,
      isUploading,
      uploadingChatIds,
      addUploadingChatId,
      removeUploadingChatId,
      isUploadDialogOpen,
      openUploadDialog,
      closeUploadDialog,
    }),
    [
      pendingFiles,
      addFiles,
      removeFile,
      clearFiles,
      isShareUploadLinkStaged,
      isUploading,
      uploadingChatIds,
      addUploadingChatId,
      removeUploadingChatId,
      isUploadDialogOpen,
      openUploadDialog,
      closeUploadDialog,
    ],
  );

  return (
    <ChatFileContext.Provider value={value}>
      {children}
      <ConfirmationDialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
        contentText={t('info.sureToDiscardUpload')}
      />
    </ChatFileContext.Provider>
  );
};
