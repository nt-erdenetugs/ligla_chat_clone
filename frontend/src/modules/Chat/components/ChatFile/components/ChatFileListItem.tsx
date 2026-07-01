import type { ListItemProps } from '@mui/material';

import { FileItem, type FileData } from '~/common/components/FileItem';
import { useChatRoomContext } from '~/modules/Chat';

interface Props extends ListItemProps {
  file: FileData;
  onDownload: (fileId: string) => Promise<void> | void;
  onDelete: (fileId: string) => void;
}

export const ChatFileListItem = ({ file, onDownload, onDelete, ...rest }: Props) => {
  const { isChatFileDownloadEnabled, isChatFileDeleteEnabled } = useChatRoomContext();

  return (
    <FileItem
      file={file}
      onDownload={() => onDownload(file.id)}
      onDelete={() => onDelete(file.id)}
      isChatFileDownloadEnabled={isChatFileDownloadEnabled}
      isChatFileDeleteEnabled={isChatFileDeleteEnabled({
        isOperatorUploadedFile: file.isOperatorUploadedFile,
      })}
      {...rest}
    />
  );
};
