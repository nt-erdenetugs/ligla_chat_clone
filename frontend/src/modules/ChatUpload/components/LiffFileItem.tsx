import { useState } from 'react';

import { type ListItemProps } from '@mui/material';

import { DeleteDialog } from '~/common/components/Elements/Dialog';
import { FileItem, type FileData } from '~/common/components/FileItem';
import { FileStatus } from '~/generated/graphql/types';

type LiffFileData = FileData & { canDelete?: boolean };

interface LiffFileItemProps extends ListItemProps {
  file: LiffFileData;
  onDownload: (fileId: string) => Promise<void> | void;
  onDelete: (fileId: string) => Promise<void> | void;
}

export const LiffFileItem = ({ file, onDownload, onDelete }: LiffFileItemProps) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const isLiffChatFileDownloadEnabled = file.status == FileStatus.Scanned;
  const isLiffChatFileDeleteEnabled = file.canDelete;

  const handleDeleteConfirm = async () => {
    if (!file.canDelete) return;
    try {
      await onDelete(file.id);
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  return (
    <>
      <DeleteDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
      />
      <FileItem
        file={file}
        onDownload={onDownload}
        onRequestDelete={() => setIsDeleteDialogOpen(true)}
        isLiffChatFileDownloadEnabled={isLiffChatFileDownloadEnabled}
        isLiffChatFileDeleteEnabled={isLiffChatFileDeleteEnabled}
      />
    </>
  );
};

LiffFileItem.displayName = 'LiffFileItem';
