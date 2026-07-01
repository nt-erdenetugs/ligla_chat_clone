import AudioFileIcon from '@mui/icons-material/AudioFile';
import DescriptionIcon from '@mui/icons-material/Description';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import ImageIcon from '@mui/icons-material/Image';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import type { SvgIconProps } from '@mui/material';

import { FileType } from '~/generated/graphql/types';
import { getFileType } from '~/utils';

interface FileIconProps extends SvgIconProps {
  filename: string;
}

const getFileIconComponent = (fileType: FileType | null, props: SvgIconProps) => {
  switch (fileType) {
    case FileType.Document:
      return <DescriptionIcon {...props} />;
    case FileType.Audio:
      return <AudioFileIcon {...props} />;
    case FileType.Image:
      return <ImageIcon {...props} />;
    case FileType.Video:
      return <VideoFileIcon {...props} />;
    case FileType.Archive:
      return <FolderZipIcon {...props} />;
    default:
      return <InsertDriveFileIcon {...props} />;
  }
};

export const FileIcon = ({ filename, ...props }: FileIconProps) => {
  const fileType = getFileType(filename);
  return getFileIconComponent(fileType, props);
};
