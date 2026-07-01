import React from 'react';

import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { Box, IconButton, Typography } from '@mui/material';

import { useTranslation } from '~/locales/hooks';
import { FileIcon } from '~/modules/Chat/components/ChatFile/components/ChatFileIcon';
import { useChatFileContext } from '~/modules/Chat/context/ChatRoom/ChatFileContext';
import { formatBytes } from '~/utils';

export const AttachmentStagingArea = React.memo(function AttachmentStagingArea() {
  const { t_chat } = useTranslation();
  const { pendingFiles, removeFile, isShareUploadLinkStaged, setIsShareUploadLinkStaged } =
    useChatFileContext();

  return (
    <Box
      sx={{
        display: 'flex',
        overflow: 'scroll',
        width: 0,
        minWidth: '100%',
        px: 1,
        py: 0.75,
        bgcolor: 'white',
      }}
    >
      {isShareUploadLinkStaged && (
        <Box
          sx={{
            mr: { xs: 0, sm: pendingFiles.length > 0 ? 0 : 'auto' },
            pr: { xs: 0, sm: pendingFiles.length > 0 ? 1 : 0 },
            width: 'fit-content',
            minWidth: { xs: 0, sm: 'fit-content' },
            maxWidth: 'none',
            borderRight: pendingFiles.length > 0 ? '1px solid #e0e0e0' : 'none',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              bgcolor: '#F5F5F5',
              border: '1px solid #e0e0e0',
              borderRadius: 1,
              width: 'fit-content',
              px: 1,
              py: 0.5,
              minHeight: 50,
            }}
          >
            <CloudUploadIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
            <Box
              component='span'
              sx={{
                fontSize: '0.75rem',
                fontWeight: 500,
                lineHeight: 1.3,
                whiteSpace: 'nowrap',
              }}
            >
              {t_chat('fileUpload.shareUploadLink')}
            </Box>
            <IconButton
              size='small'
              onClick={() => setIsShareUploadLinkStaged(false)}
              sx={{ p: 0.25 }}
              aria-label='Remove shared upload link'
            >
              <CloseIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Box>
        </Box>
      )}

      {pendingFiles.length > 0 && (
        <Box
          sx={{
            minWidth: 0,
            pl: isShareUploadLinkStaged ? 1 : 0,
            overflow: 'auto',
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            gap: 1,
          }}
        >
          {pendingFiles.map((file, index) => (
            <Box
              key={index}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                bgcolor: '#F5F5F5',
                border: '1px solid #e0e0e0',
                borderRadius: 1,
                px: 1,
                py: 0.5,
                maxWidth: 200,
              }}
            >
              <FileIcon
                filename={file.name}
                sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }}
              />
              <Box sx={{ overflow: 'hidden', minWidth: 0 }}>
                <Typography
                  variant='caption'
                  noWrap
                  title={file.name}
                  sx={{ display: 'block', fontWeight: 500, lineHeight: 1.3 }}
                >
                  {file.name}
                </Typography>
                <Typography variant='caption' sx={{ color: 'text.secondary', lineHeight: 1.3 }}>
                  {formatBytes(file.size)}
                </Typography>
              </Box>
              <IconButton
                size='small'
                onClick={() => removeFile(index)}
                sx={{ flexShrink: 0, p: 0.25 }}
                aria-label='Remove attachment'
              >
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
});

AttachmentStagingArea.displayName = 'AttachmentStagingArea';
