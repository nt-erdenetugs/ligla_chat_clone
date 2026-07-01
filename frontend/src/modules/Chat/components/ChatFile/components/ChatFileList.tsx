import React, { useMemo } from 'react';

import { Box, Divider, ListItemIcon, Typography } from '@mui/material';

import { ListboxComponent, Loading } from '~/common/components';
import type { FileData } from '~/common/components/FileItem';
import { InfiniteQueryProvider, type InfiniteQueryResponse } from '~/context/InfiniteScrollContext';
import { useTranslation } from '~/locales/hooks';
import { FileIcon } from '~/modules/Chat/components/ChatFile/components/ChatFileIcon';

import { ChatFileListItem } from './ChatFileListItem';

interface ChatFileListProps {
  files: FileData[];
  isInitialLoading: boolean;
  hasMore: boolean;
  isFetchingMore: boolean;
  onLoadMore: () => Promise<void>;
  onDownload: (fileId: string) => Promise<void> | void;
  onDelete: (fileId: string) => void;
}

export const ChatFileList = React.memo(function ChatFileList({
  files,
  isInitialLoading,
  hasMore,
  isFetchingMore,
  onLoadMore,
  onDownload,
  onDelete,
}: ChatFileListProps) {
  const { t_chat } = useTranslation();

  const infiniteQueryResponse: InfiniteQueryResponse = useMemo(
    () => ({
      fetchMore: onLoadMore,
      loading: isFetchingMore,
      fetchedAll: !hasMore,
    }),
    [onLoadMore, isFetchingMore, hasMore],
  );

  if (isInitialLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <Loading size='small' />
      </Box>
    );
  }

  if (files.length === 0) {
    return (
      <Box
        sx={{
          width: '100%',
          minHeight: 240,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          px: 4,
        }}
      >
        <ListItemIcon>
          <FileIcon filename='file' color='primary' fontSize='large' />
        </ListItemIcon>
        <Typography variant='body2' color='text.secondary' fontSize='large'>
          {t_chat('fileUpload.noFilesUploadedYet')}
        </Typography>
      </Box>
    );
  }

  return (
    <InfiniteQueryProvider infiniteQueryResponse={infiniteQueryResponse}>
      <ListboxComponent>
        {files.map((file, index) => (
          <Box key={file.id}>
            <ChatFileListItem
              file={file}
              onDownload={onDownload}
              onDelete={onDelete}
              sx={{
                width: '100%',
              }}
            />
            {index < files.length - 1 && <Divider />}
          </Box>
        ))}
      </ListboxComponent>
    </InfiniteQueryProvider>
  );
});
