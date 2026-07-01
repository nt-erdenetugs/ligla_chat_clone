import { useState } from 'react';

import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import {
  Box,
  CircularProgress,
  Drawer,
  IconButton,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Typography,
  type ListItemProps,
} from '@mui/material';

import { useResponsive } from '~/common/hooks';
import { FileStatus } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { FileIcon } from '~/modules/Chat/components/ChatFile/components/ChatFileIcon';
import { formatYYYYMMDDHHmm } from '~/plugins/dayjs';
import { formatBytes } from '~/utils';

export interface FileData {
  id: string;
  name: string;
  owner: string;
  date: Date;
  size?: number;
  isFailed: boolean;
  isOperatorUploadedFile: boolean;
  status: FileStatus;
  canDelete?: boolean;
}
export interface FileItemProps extends ListItemProps {
  file: FileData;
  onDownload?: (fileId: string) => Promise<void> | void;
  onDelete?: (fileId: string) => Promise<void> | void;
  onRequestDelete?: () => void;
  isChatFileDownloadEnabled?: boolean;
  isChatFileDeleteEnabled?: boolean;
  isLiffChatFileDeleteEnabled?: boolean;
  isLiffChatFileDownloadEnabled?: boolean;
}

export const FileItem = ({
  file,
  onDownload,
  onDelete,
  onRequestDelete,
  isChatFileDownloadEnabled,
  isChatFileDeleteEnabled,
  isLiffChatFileDeleteEnabled,
  isLiffChatFileDownloadEnabled,
  sx,
  ...rest
}: FileItemProps) => {
  const { t_chat } = useTranslation();
  const [isDownloading, setIsDownloading] = useState(false);
  const { isMobile } = useResponsive();
  const [isMobileActionSheetOpen, setIsMobileActionSheetOpen] = useState(false);
  const isPendingScan = file.status === FileStatus.PendingScan;
  const isVirusDetected = file.status === FileStatus.VirusDetected;
  const isDownloadEnabled = isChatFileDownloadEnabled || isLiffChatFileDownloadEnabled;
  const isDeleteEnabled = isChatFileDeleteEnabled || isLiffChatFileDeleteEnabled;

  return (
    <ListItem
      sx={{
        width: '100%',
        px: 1,
        py: 1.5,
        '&:hover': {
          backgroundColor: 'action.hover',
          borderRadius: 1,
          cursor: 'pointer',
        },
        ...sx,
      }}
      {...rest}
    >
      <ListItemIcon>
        <FileIcon filename={file.name} color='success' fontSize='medium' />
      </ListItemIcon>

      <Box
        sx={{
          flexGrow: 1,
          mr: isMobile ? 1 : 2,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        <Typography
          variant={file.isFailed || isPendingScan ? 'muted' : 'body1'}
          sx={{
            fontWeight: 500,
            fontSize: isMobile ? '0.875rem' : '1rem',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {file.name}
        </Typography>
        {file.isFailed && (
          <Typography
            noWrap
            variant='body2'
            color='error'
            sx={{ fontSize: isMobile ? '0.875rem' : '1rem' }}
          >
            {t_chat('fileUpload.virusDetected')}
          </Typography>
        )}

        {isPendingScan && (
          <Typography
            noWrap
            variant='body2'
            color='warning.main'
            sx={{ fontSize: isMobile ? '0.875rem' : '1rem' }}
          >
            {t_chat('fileUpload.virusScanPending')}
          </Typography>
        )}
        <Typography
          noWrap
          variant={file.isFailed || isPendingScan ? 'muted' : 'body2'}
          sx={{ fontSize: isMobile ? '0.7rem' : '0.875rem' }}
        >
          {file.owner}
        </Typography>
        <Typography
          noWrap
          variant={file.isFailed || isPendingScan ? 'muted' : 'body2'}
          sx={{ fontSize: isMobile ? '0.7rem' : '0.875rem' }}
        >
          {formatYYYYMMDDHHmm(file.date)}
          {file.size != null && ` · ${formatBytes(file.size)}`}
        </Typography>
      </Box>

      {!file.isFailed && !isVirusDetected && !isPendingScan && (
        <>
          {isMobile ? (
            <Box sx={{ ml: 0.5 }}>
              <IconButton
                data-file-action='true'
                size='medium'
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMobileActionSheetOpen(true);
                }}
                sx={{ minWidth: 44, minHeight: 44, color: 'text.secondary' }}
                aria-label={`${t_chat('fileUpload.download')} / ${t_chat('fileUpload.delete')}`}
              >
                <MoreVertIcon sx={{ fontSize: 28 }} />
              </IconButton>
              <Drawer
                anchor='bottom'
                open={isMobileActionSheetOpen}
                onClose={() => setIsMobileActionSheetOpen(false)}
                sx={{ zIndex: (theme) => theme.zIndex.modal + 2 }}
                PaperProps={{
                  sx: {
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(8px)',
                    borderTop: '1px solid rgba(0, 0, 0, 0.08)',
                    pb: 1,
                  },
                }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 4,
                    borderRadius: 999,
                    bgcolor: 'rgba(0, 0, 0, 0.2)',
                    mx: 'auto',
                    mt: 1,
                    mb: 1,
                  }}
                />
                <ListItemButton
                  data-file-action='true'
                  disabled={isDownloading || !isDownloadEnabled}
                  sx={{ minHeight: 56, px: 2.5, gap: 1.25 }}
                  onClick={async () => {
                    try {
                      setIsDownloading(true);
                      await onDownload?.(file.id);
                    } finally {
                      setIsDownloading(false);
                      setIsMobileActionSheetOpen(false);
                    }
                  }}
                >
                  {isDownloading ? (
                    <CircularProgress size='1rem' />
                  ) : (
                    <DownloadIcon sx={{ fontSize: 22 }} />
                  )}
                  <ListItemText
                    primary={t_chat('fileUpload.download')}
                    primaryTypographyProps={{ variant: 'body1' }}
                  />
                </ListItemButton>
                <ListItemButton
                  data-file-action='true'
                  disabled={!isDeleteEnabled}
                  sx={{ minHeight: 56, px: 2.5, gap: 1.25, color: 'error.main' }}
                  onClick={() => {
                    if (onDelete) {
                      onDelete(file.id);
                    } else {
                      onRequestDelete?.();
                    }
                    setIsMobileActionSheetOpen(false);
                  }}
                >
                  <DeleteIcon sx={{ fontSize: 22 }} />
                  <ListItemText
                    primary={t_chat('fileUpload.delete')}
                    primaryTypographyProps={{ variant: 'body1' }}
                  />
                </ListItemButton>
              </Drawer>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <IconButton
                data-file-action='true'
                size='small'
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    setIsDownloading(true);
                    await onDownload?.(file.id);
                  } finally {
                    setIsDownloading(false);
                  }
                }}
                sx={{ color: 'success.main' }}
                title={t_chat('fileUpload.download')}
                aria-label={t_chat('fileUpload.download')}
                disabled={isDownloading || !isDownloadEnabled}
              >
                {isDownloading ? (
                  <CircularProgress size='1rem' />
                ) : (
                  <DownloadIcon fontSize='small' />
                )}
              </IconButton>

              <IconButton
                data-file-action='true'
                size='small'
                onClick={(e) => {
                  e.stopPropagation();
                  if (onDelete) {
                    onDelete(file.id);
                    return;
                  }
                  onRequestDelete?.();
                }}
                sx={{ color: 'error.main' }}
                title={t_chat('fileUpload.delete')}
                aria-label={t_chat('fileUpload.delete')}
                disabled={!isDeleteEnabled}
              >
                <DeleteIcon fontSize='small' />
              </IconButton>
            </Box>
          )}
        </>
      )}
    </ListItem>
  );
};
