import React from 'react';

import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { Box, Button } from '@mui/material';
import { useSnackbar } from 'notistack';

import { DeleteDialog, DraggableDialog } from '~/common/components';
import type { FileData } from '~/common/components/FileItem';
import { CHAT_FILE_ACCEPTED_LIST } from '~/common/constants';
import { useChatFileValidation } from '~/common/hooks';
import { useAuthContext } from '~/context/AuthContext';
import {
  FileStatus,
  useChatFilesQuery,
  useDeleteChatFileMutation,
} from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { useChatRoomContext } from '~/modules/Chat';
import { useChatFileContext } from '~/modules/Chat/context/ChatRoom/ChatFileContext';
import { useChatFileDownload } from '~/modules/Chat/hooks/useChatFileDownload';

import { ChatFileList } from './ChatFileList';

const CHAT_FILES_PAGE_SIZE = 20;

interface FileUploadDialogProps {
  open: boolean;
  onClose: () => void;
  chatId: string;
}

export const FileUploadDialog = React.memo(function FileUploadDialog({
  open,
  onClose,
  chatId,
}: FileUploadDialogProps) {
  const { t, t_chat, t_toasts } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [fileIdToDelete, setFileIdToDelete] = React.useState<string | null>(null);
  const [fileDeleteLoading, setFileDeleteLoading] = React.useState(false);
  const [isFetchingMore, setIsFetchingMore] = React.useState(false);
  const downloadChatFile = useChatFileDownload();
  const { addFiles } = useChatFileContext();
  const { validateFiles } = useChatFileValidation();
  const [deleteChatFile] = useDeleteChatFileMutation();
  const organizationName = user?.organization?.name ?? '';
  const { targetChat, isChatFileUploadEnabled } = useChatRoomContext();
  const endUserId = targetChat?.endUserId ?? '';

  const skipChatFilesQuery = !open || !chatId || !endUserId;
  const queryKey = React.useMemo(() => `${chatId}:${endUserId}`, [chatId, endUserId]);

  const { data, previousData, fetchMore, refetch } = useChatFilesQuery({
    variables: {
      chatId,
      endUserId,
      take: CHAT_FILES_PAGE_SIZE,
    },
    skip: skipChatFilesQuery,
    notifyOnNetworkStatusChange: true,
  });

  const previousQueryKeyRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (data?.chatFiles) {
      previousQueryKeyRef.current = queryKey;
    }
  }, [data, queryKey]);

  const isCachedChatFiles = previousQueryKeyRef.current === queryKey;
  const chatFiles = React.useMemo(() => {
    return isCachedChatFiles ? (data?.chatFiles ?? previousData?.chatFiles) : data?.chatFiles;
  }, [isCachedChatFiles, data, previousData]);

  const fileItems = React.useMemo(() => chatFiles?.items ?? [], [chatFiles]);
  const hasMore = React.useMemo(() => chatFiles?.hasMore ?? false, [chatFiles]);

  const files: FileData[] = React.useMemo(
    () =>
      fileItems.map((file) => ({
        id: file.id,
        name: file.originalFileName ?? file.fileName,
        isOperatorUploadedFile: !!(file.uploaderOperatorId && !file.uploaderEndUserId),
        owner: file.uploaderOperatorName
          ? t_chat('fileUpload.uploaderOperator', { name: file.uploaderOperatorName })
          : t_chat('fileUpload.uploaderEndUser', { name: file.uploaderEndUserName ?? '' }),
        date: new Date(file.createdAt),
        size: file.fileSize != null ? Number(file.fileSize) : undefined,
        isFailed: file.status === FileStatus.VirusDetected,
        status: file.status,
      })),
    [fileItems, t_chat],
  );

  const handleDownload = async (fileId: string) => {
    try {
      await downloadChatFile(fileId);
    } catch (error) {
      console.error('Error downloading file:', error);
      enqueueSnackbar(t_toasts('chat.error.file.download'), {
        variant: 'error',
      });
    }
  };

  const handleDelete = (fileId: string) => {
    setFileIdToDelete(fileId);
    setConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!fileIdToDelete) {
      setConfirmDeleteOpen(false);
      setFileIdToDelete(null);
      return;
    }

    setFileDeleteLoading(true);
    try {
      const result = await deleteChatFile({
        variables: {
          input: { fileId: fileIdToDelete },
        },
      });

      if (result.data?.deleteChatFile.success) {
        if (!skipChatFilesQuery) {
          await refetch({
            chatId,
            endUserId,
            take: CHAT_FILES_PAGE_SIZE,
          });
        }
        enqueueSnackbar(t_toasts('chat.success.file.delete'), { variant: 'success' });
      } else {
        throw new Error('Delete failed');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      enqueueSnackbar(t_toasts('chat.error.file.delete'), { variant: 'error' });
    } finally {
      setFileDeleteLoading(false);
      setConfirmDeleteOpen(false);
      setFileIdToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setConfirmDeleteOpen(false);
    setFileIdToDelete(null);
  };

  const handleFileChange = async (files: FileList | null) => {
    if (!files) return;
    const validFiles = await validateFiles(Array.from(files));
    if (validFiles.length === 0) return;
    addFiles(validFiles);
    onClose();
  };

  const handleLoadMore = async () => {
    if (!hasMore || skipChatFilesQuery) return;
    try {
      setIsFetchingMore(true);
      const nextCursorId = chatFiles?.nextCursorId;
      const nextCursorCreatedAt = chatFiles?.nextCursorCreatedAt as Date | null | undefined;
      if (!nextCursorId) return;

      await fetchMore({
        variables: {
          chatId,
          endUserId,
          take: CHAT_FILES_PAGE_SIZE,
          cursorId: nextCursorId,
          cursorCreatedAt: nextCursorCreatedAt,
        },
        updateQuery: (previous, { fetchMoreResult }) => {
          if (!fetchMoreResult?.chatFiles || !previous?.chatFiles) {
            return previous;
          }

          return {
            chatFiles: {
              ...fetchMoreResult.chatFiles,
              items: [...previous.chatFiles.items, ...fetchMoreResult.chatFiles.items],
            },
          };
        },
      });
    } catch (error) {
      console.error('Error fetching more files:', error);
      enqueueSnackbar(t_chat('fileUpload.loadError'), { variant: 'error' });
    } finally {
      setIsFetchingMore(false);
    }
  };

  const isInitialLoading = !skipChatFilesQuery && !chatFiles;
  return (
    <>
      <DraggableDialog
        open={open}
        onClose={onClose}
        contentElWithFit={false}
        heightFixed
        hideCancel
        hideBackdrop={false}
        confirmButton={
          <Button
            component='label'
            variant='contained'
            startIcon={<CloudUploadIcon sx={{ fontSize: { xs: 6, sm: 20 } }} />}
            sx={{
              fontSize: { xs: '0.7rem', sm: '1rem' },
              cursor: isChatFileUploadEnabled ? 'pointer !important' : 'not-allowed',
            }}
            disabled={!organizationName || !isChatFileUploadEnabled}
          >
            {t('actions.upload')}
            <input
              type='file'
              style={{ display: 'none' }}
              accept={CHAT_FILE_ACCEPTED_LIST}
              multiple
              onChange={(event) => {
                handleFileChange(event.target.files);
                event.target.value = '';
              }}
            />
          </Button>
        }
      >
        <Box sx={{ height: '80vh', pb: 3 }}>
          <ChatFileList
            files={files}
            isInitialLoading={isInitialLoading}
            hasMore={hasMore}
            isFetchingMore={isFetchingMore}
            onLoadMore={handleLoadMore}
            onDownload={handleDownload}
            onDelete={handleDelete}
          />
        </Box>
      </DraggableDialog>
      <DeleteDialog
        open={confirmDeleteOpen}
        contentText={t_chat('fileUpload.confirmDelete')}
        onConfirm={handleConfirmDelete}
        onClose={handleCancelDelete}
        isLoading={fileDeleteLoading}
      />
    </>
  );
});
