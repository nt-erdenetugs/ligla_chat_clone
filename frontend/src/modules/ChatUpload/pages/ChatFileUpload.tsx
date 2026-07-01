import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import liff from '@line/liff';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { Box, Button, CircularProgress, Divider, Stack, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import { ErrorBoundary } from 'react-error-boundary';
import { useSearchParams } from 'react-router';

import { LanguageMenu, PublicErrorFallback, ListboxComponent } from '~/common/components';
import { type FileData } from '~/common/components/FileItem';
import { CHAT_FILE_ACCEPTED_LIST } from '~/common/constants';
import { useResponsive, useChatFileValidation } from '~/common/hooks';
import { InfiniteQueryProvider, type InfiniteQueryResponse } from '~/context/InfiniteScrollContext';
import {
  FileStatus,
  useChatFilesForEndUserQuery,
  useDeleteChatFileForEndUserMutation,
} from '~/generated/graphql/types';
import { clearLiffSession, setLiffSession } from '~/lib/liff-session';
import { useTranslation } from '~/locales/hooks';
import { chatListStyles } from '~/modules/Chat';
import { FileIcon } from '~/modules/Chat/components/ChatFile';
import { LIFF_INIT_STATUS, type LiffInitStatus } from '~/modules/ChatUpload/constants';

import { LiffFileItem } from '../components/LiffFileItem';
import { useLiffChatFileDownload } from '../hooks/useLiffChatFileDownload';
import { useLiffChatFileUpload } from '../hooks/useLiffChatFileUpload';

const PAGE_SIZE = 20;
const MAX_MESSAGE_FILE_NAME_LENGTH = 40;
const FALLBACK_MESSAGE_FILE_NAME = 'ファイル';

const truncateFileNameForMessage = (fileName: string) => {
  const normalizedFileName = fileName.trim() || FALLBACK_MESSAGE_FILE_NAME;

  if (normalizedFileName.length <= MAX_MESSAGE_FILE_NAME_LENGTH) {
    return normalizedFileName;
  }

  const lastDotIndex = normalizedFileName.lastIndexOf('.');

  if (lastDotIndex <= 0 || lastDotIndex === normalizedFileName.length - 1) {
    return `${normalizedFileName.slice(0, MAX_MESSAGE_FILE_NAME_LENGTH - 3)}...`;
  }

  const extension = normalizedFileName.slice(lastDotIndex);
  const baseName = normalizedFileName.slice(0, lastDotIndex);
  const maxBaseNameLength = MAX_MESSAGE_FILE_NAME_LENGTH - extension.length - 3;

  if (maxBaseNameLength <= 0) {
    return `${normalizedFileName.slice(0, MAX_MESSAGE_FILE_NAME_LENGTH - 3)}...`;
  }

  return `${baseName.slice(0, maxBaseNameLength)}...${extension}`;
};

const buildUploadedFileTextMessage = (fileName: string) => {
  const truncatedFileName = truncateFileNameForMessage(fileName);

  return {
    type: 'text' as const,
    text: `「${truncatedFileName}」のアップロードが完了しました`,
  };
};

const LiffFileUpload = memo(() => {
  const { t, t_chat, t_toasts } = useTranslation();

  useEffect(() => {
    document.title = t_chat('fileUpload.pageTitle');
  }, [t_chat]);

  const { enqueueSnackbar } = useSnackbar();
  const [searchParams] = useSearchParams();
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const { isMobileOrTablet } = useResponsive();
  const { validateFiles } = useChatFileValidation();
  const [liffEndUserId, setLiffEndUserId] = useState<string | null>(null);
  const [liffInitStatus, setLiffInitStatus] = useState<LiffInitStatus>(
    LIFF_INIT_STATUS.NOT_INITIALIZED,
  );

  const liffStateParams = useMemo(() => {
    const liffState = searchParams.get('liff.state');
    if (!liffState) return null;
    const queryString = liffState.startsWith('?') ? liffState.slice(1) : liffState;
    return new URLSearchParams(queryString);
  }, [searchParams]);

  const LIFF_ID = searchParams.get('id') ?? liffStateParams?.get('id') ?? '';
  const endUserId = liffEndUserId ?? '';
  const organizationCode = searchParams.get('o') ?? liffStateParams?.get('o') ?? '';

  const canQuery = !!endUserId && !!organizationCode;

  const initLIFF = useCallback(async () => {
    if (!LIFF_ID) {
      setLiffInitStatus(LIFF_INIT_STATUS.ERROR);
      return;
    }
    setLiffInitStatus(LIFF_INIT_STATUS.INITIALIZING);

    try {
      await liff.init({ liffId: String(LIFF_ID) });

      if (!liff.isInClient()) {
        setLiffInitStatus(LIFF_INIT_STATUS.ERROR);
        return;
      }

      if (!liff.isLoggedIn()) {
        setLiffInitStatus(LIFF_INIT_STATUS.LOGGED_OUT);
        return;
      }

      const profile = await liff.getProfile();
      const profileUserId = profile.userId ? profile.userId : null;
      const idToken = liff.getIDToken();

      if (!profileUserId || !idToken || !organizationCode) {
        setLiffInitStatus(LIFF_INIT_STATUS.ERROR);
        return;
      }

      setLiffSession({ idToken, organizationCode });
      setLiffEndUserId(profileUserId);
      setLiffInitStatus(LIFF_INIT_STATUS.INITIALIZED);
    } catch (error) {
      console.error('LIFF init failed', error);
      setLiffInitStatus(LIFF_INIT_STATUS.ERROR);
    }
  }, [LIFF_ID, organizationCode]);

  useEffect(() => {
    void initLIFF();
  }, []); //eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      clearLiffSession();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const scrollY = window.scrollY || window.pageYOffset || 0;
    const bodyStyle = document.body.style;

    bodyStyle.position = 'fixed';
    bodyStyle.top = `-${scrollY}px`;
    bodyStyle.left = '0';
    bodyStyle.right = '0';
    bodyStyle.width = '100%';

    return () => {
      bodyStyle.position = '';
      bodyStyle.top = '';
      bodyStyle.left = '';
      bodyStyle.right = '';
      bodyStyle.width = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  const {
    data,
    loading: filesLoading,
    refetch,
    fetchMore,
  } = useChatFilesForEndUserQuery({
    variables: { take: PAGE_SIZE },
    skip: !canQuery,
  });

  const [deleteChatFile] = useDeleteChatFileForEndUserMutation();

  const { uploadFiles, uploading } = useLiffChatFileUpload({
    onUploadComplete: () => refetch(),
  });

  const { downloadFile } = useLiffChatFileDownload();
  const chatFilesData = data?.chatFilesForEndUser;
  const hasMore = chatFilesData?.hasMore ?? false;

  const fileEntries = useMemo(
    () =>
      (chatFilesData?.items ?? []).map((item) => ({
        file: {
          id: item.id,
          name: item.originalFileName,
          owner: item.uploaderOperatorName
            ? t_chat('fileUpload.uploaderOperator', { name: item.uploaderOperatorName })
            : t_chat('fileUpload.uploaderEndUser', { name: item.uploaderEndUserName ?? '' }),
          isOperatorUploadedFile: !!(item.uploaderOperatorId && !item.uploaderEndUserId),
          date: new Date(item.createdAt),
          size: item.fileSize != null ? Number(item.fileSize) : undefined,
          isFailed: item.status === FileStatus.VirusDetected,
          status: item.status,
          canDelete: item.uploaderEndUserId === endUserId,
        } satisfies FileData,
      })),
    [chatFilesData?.items, t_chat, endUserId],
  );
  const handleLiffLogin = () => {
    try {
      liff.login();
    } catch (err) {
      console.error('LIFF login call failed', err);
      enqueueSnackbar(t_toasts('chat.error.liff.login'), { variant: 'error' });
    }
  };

  const hasFiles = fileEntries.length > 0;

  const handleFileChange = async (files: File[]) => {
    if (files.length === 0) return;

    const validFiles = await validateFiles(files);
    if (validFiles.length === 0) return;

    const results = await uploadFiles(validFiles, {
      onFileUploaded: async (chatFile) => {
        const uploadedFileName = chatFile.originalFileName ?? chatFile.fileName;
        const message = buildUploadedFileTextMessage(uploadedFileName);

        try {
          await liff.sendMessages([message]);
        } catch (error) {
          console.error('LIFF sendMessages failed:', error);
        }
      },
    });

    const failedFileNames = results.filter((result) => !!result.error).map(({ file }) => file.name);

    const uploadedFileNames = results
      .filter((result) => !result.error && !!result.chatFile)
      .map((result) => result.chatFile.originalFileName ?? result.chatFile.fileName);

    const hasFailedUpload = failedFileNames.length > 0;

    if (hasFailedUpload) {
      console.error('The following files failed to upload: ', failedFileNames.join(', '));
      enqueueSnackbar(t_toasts('chat.error.file.upload'), { variant: 'error' });
    }

    if (uploadedFileNames.length > 0) {
      enqueueSnackbar(t_toasts('chat.success.file.upload'), { variant: 'success' });
    }

    try {
      if (!liff.isInClient()) {
        throw new Error('not in LIFF client');
      }

      if (hasFailedUpload) {
        return;
      }
      liff.closeWindow();
    } catch (error) {
      console.error('LIFF closeWindow failed:', error);
    }
  };

  const handleDownload = async (fileId: string) => {
    try {
      await downloadFile(fileId);
      enqueueSnackbar(t_toasts('chat.success.file.download'), { variant: 'success' });
    } catch (error) {
      console.error('Error downloading file:', error);
      enqueueSnackbar(t_toasts('chat.error.file.download'), { variant: 'error' });
    }
  };

  const handleDelete = async (fileId: string) => {
    try {
      await deleteChatFile({
        variables: { input: { fileId } },
      });
      enqueueSnackbar(t_toasts('chat.success.file.delete'), { variant: 'success' });
      refetch();
    } catch (error) {
      console.error('Error deleting file:', error);
      enqueueSnackbar(t_toasts('chat.error.file.delete'), { variant: 'error' });
    }
  };
  const handleLoadMore = useCallback(async () => {
    if (!hasMore || !canQuery) return;
    const nextCursorId = chatFilesData?.nextCursorId;
    const nextCursorCreatedAt = chatFilesData?.nextCursorCreatedAt as Date | null | undefined;
    if (!nextCursorId) return;

    try {
      setIsFetchingMore(true);
      await fetchMore({
        variables: {
          take: PAGE_SIZE,
          cursorId: nextCursorId,
          cursorCreatedAt: nextCursorCreatedAt,
        },
        updateQuery: (previous, { fetchMoreResult }) => {
          if (!fetchMoreResult?.chatFilesForEndUser || !previous?.chatFilesForEndUser) {
            return previous;
          }

          return {
            chatFilesForEndUser: {
              ...fetchMoreResult.chatFilesForEndUser,
              items: [
                ...previous.chatFilesForEndUser.items,
                ...fetchMoreResult.chatFilesForEndUser.items,
              ],
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
  }, [hasMore, canQuery, chatFilesData, fetchMore, enqueueSnackbar, t_chat]);

  const infiniteQueryResponse: InfiniteQueryResponse = useMemo(
    () => ({
      fetchMore: handleLoadMore,
      loading: filesLoading || isFetchingMore,
      fetchedAll: !hasMore,
    }),
    [handleLoadMore, filesLoading, isFetchingMore, hasMore],
  );

  const isUploadDisabled = uploading || !endUserId || !organizationCode;

  return (
    <Box
      sx={{
        height: '100dvh',
        width: '100%',
        background: (theme) => theme.palette.grey[100],
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Stack maxWidth={720} width='100%' sx={{ height: '100%' }}>
        {liffInitStatus === LIFF_INIT_STATUS.INITIALIZED && (
          <Stack spacing={3} width='100%'>
            <Box
              sx={{
                ...chatListStyles.header,
                borderRight: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                position: 'sticky',
                top: 0,
              }}
            >
              <Stack
                direction='row'
                spacing={2}
                alignItems='center'
                sx={{ minWidth: 0, flexGrow: 1 }}
              >
                <Box sx={{ textAlign: 'left', minWidth: 0 }}>
                  <Typography
                    variant='h6'
                    color='rgb(54, 65, 82)'
                    sx={{
                      fontWeight: 600,
                      lineHeight: 1.2,
                      ...(isMobileOrTablet ? { fontSize: '1.125rem' } : {}),
                    }}
                  >
                    {t_chat('fileUpload.headerTitle')}
                  </Typography>
                </Box>
              </Stack>
              <Box sx={{ ml: 'auto' }}>
                <LanguageMenu showLabel={false} />
              </Box>
            </Box>
          </Stack>
        )}
        <Box sx={{ flex: 1, overflow: 'hidden', pb: 5 }}>
          {(() => {
            if (liffInitStatus !== LIFF_INIT_STATUS.INITIALIZED) {
              if (liffInitStatus === LIFF_INIT_STATUS.ERROR) {
                return <PublicErrorFallback />;
              }

              if (liffInitStatus === LIFF_INIT_STATUS.LOGGED_OUT) {
                return (
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      height: '100vh',
                      width: '100%',
                    }}
                  >
                    <Button variant='contained' onClick={handleLiffLogin} sx={{ mt: 2 }}>
                      {t_chat('fileUpload.loginToLine')}
                    </Button>
                  </Box>
                );
              }

              return (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100vh',
                    width: '100%',
                  }}
                >
                  <CircularProgress />
                </Box>
              );
            }

            if (filesLoading) {
              return (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100vh',
                    width: '100%',
                  }}
                >
                  <CircularProgress />
                </Box>
              );
            }

            if (hasFiles) {
              return (
                <InfiniteQueryProvider infiniteQueryResponse={infiniteQueryResponse}>
                  <ListboxComponent>
                    {fileEntries.map(({ file }, index) => (
                      <Box key={file.id}>
                        <LiffFileItem
                          file={file}
                          onDownload={handleDownload}
                          onDelete={handleDelete}
                          sx={{ px: 2, py: 1.5 }}
                        />
                        {index < fileEntries.length - 1 && <Divider component='li' />}
                      </Box>
                    ))}
                  </ListboxComponent>
                </InfiniteQueryProvider>
              );
            }

            return (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  height: '100%',
                  gap: 1.5,
                  width: '100%',
                }}
              >
                <FileIcon filename='file' color='success' sx={{ fontSize: 48 }} />
                <Typography variant='h6' fontWeight={600} color='text.secondary'>
                  {t_chat('fileUpload.noFilesUploadedYet')}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {t_chat('fileUpload.uploadFile')}
                </Typography>
              </Box>
            );
          })()}
        </Box>

        {liffInitStatus === LIFF_INIT_STATUS.INITIALIZED && (
          <Box sx={{ px: 2 }}>
            <Button
              component='label'
              variant='contained'
              color='primary'
              startIcon={uploading ? <CircularProgress size='1rem' /> : <CloudUploadIcon />}
              disabled={isUploadDisabled}
              sx={{
                width: '100%',
                marginBottom: 0.5,
                borderRadius: 2,
                minHeight: '48px',
              }}
            >
              {t('actions.upload')}
              <input
                type='file'
                style={{ visibility: 'hidden', position: 'absolute' }}
                multiple={true}
                accept={CHAT_FILE_ACCEPTED_LIST}
                onChange={(event) => {
                  const files = event.target.files ? Array.from(event.target.files) : [];
                  if (files.length > 0) handleFileChange(files);
                  event.target.value = '';
                }}
              />
            </Button>
          </Box>
        )}
      </Stack>
    </Box>
  );
});

LiffFileUpload.displayName = 'LiffFileUpload';

const LiffFileUploadBoundary = memo(() => (
  <ErrorBoundary fallbackRender={() => <PublicErrorFallback />}>
    <LiffFileUpload />
  </ErrorBoundary>
));

LiffFileUploadBoundary.displayName = 'LiffFileUploadBoundary';

export { LiffFileUploadBoundary as LiffFileUpload };
