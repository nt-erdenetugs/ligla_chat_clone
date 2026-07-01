import { memo } from 'react';

import { CircularProgress } from '@mui/material';
import Chip from '@mui/material/Chip';
import Zoom from '@mui/material/Zoom';

import { useTranslation } from '~/locales/hooks';
import { useChatFileContext } from '~/modules/Chat/context/ChatRoom/ChatFileContext';
import { useChatRoomContext } from '~/modules/Chat/context/ChatRoom/ChatRoomContext';

export const UploadingChip = memo(function UploadingChip() {
  const { uploadingChatIds } = useChatFileContext();
  const { targetChat } = useChatRoomContext();
  const { t_chat } = useTranslation();

  const isCurrentChatUploading = targetChat != null && uploadingChatIds.has(targetChat.id);

  if (!isCurrentChatUploading) return null;
  return (
    <Zoom in={isCurrentChatUploading}>
      <Chip
        sx={{ bgcolor: 'white', boxShadow: 3 }}
        icon={<CircularProgress size={14} />}
        label={t_chat('fileUpload.uploading')}
      />
    </Zoom>
  );
});

UploadingChip.displayName = 'UploadingChip';
