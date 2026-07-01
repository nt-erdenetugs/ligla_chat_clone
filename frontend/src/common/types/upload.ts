import { type Theme, type SxProps } from '@mui/material/styles';
import { type DropzoneOptions } from 'react-dropzone';

import { type UserStatusType } from '../constants';

export interface CustomFile extends File {
  path?: string;
  preview?: string;
  lastModifiedDate?: Date;
}

export interface UploadProps extends DropzoneOptions {
  error?: boolean;
  sx?: SxProps<Theme>;
  placeholder?: React.ReactNode;
  helperText?: React.ReactNode;
  disabled?: boolean;
  disableMultiple?: boolean;
  file?: CustomFile | string | null;
  onDelete?: VoidFunction;
  files?: (File | string)[];
  onUpload?: VoidFunction;
  onRemove?: (file: CustomFile | string) => void;
  onRemoveAll?: VoidFunction;
  userStatus?: UserStatusType;
  children?: React.ReactNode;
}
