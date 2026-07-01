import { createContext, useContext } from 'react';

export type ChatFileContextProps = {
  pendingFiles: File[];
  addFiles: (files: File[]) => void;
  removeFile: (index: number) => void;
  clearFiles: () => void;
  isShareUploadLinkStaged: boolean;
  setIsShareUploadLinkStaged: (v: boolean) => void;
  isUploading: boolean;
  uploadingChatIds: Set<string>;
  addUploadingChatId: (id: string) => void;
  removeUploadingChatId: (id: string) => void;
  isUploadDialogOpen: boolean;
  openUploadDialog: () => void;
  closeUploadDialog: () => void;
};

const defaultValue: ChatFileContextProps = {
  pendingFiles: [],
  addFiles: () => {},
  removeFile: () => {},
  clearFiles: () => {},
  isShareUploadLinkStaged: false,
  setIsShareUploadLinkStaged: () => {},
  isUploading: false,
  uploadingChatIds: new Set(),
  addUploadingChatId: () => {},
  removeUploadingChatId: () => {},
  isUploadDialogOpen: false,
  openUploadDialog: () => {},
  closeUploadDialog: () => {},
};

export const ChatFileContext = createContext<ChatFileContextProps>(defaultValue);

export const useChatFileContext = () => {
  const context = useContext(ChatFileContext);
  if (!context) {
    throw new Error('useChatFileContext must be used within a ChatFileProvider');
  }
  return context;
};
