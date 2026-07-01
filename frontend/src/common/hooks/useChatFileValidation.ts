import { useSnackbar } from 'notistack';

import { CHAT_FILE_MAX_SIZE_BYTES } from '~/common/constants';
import { useTranslation } from '~/locales/hooks';
import { formatBytes, validateChatFileSizes, validateChatFileTypes } from '~/utils';

export const useChatFileValidation = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { t_toasts } = useTranslation();

  const validateFiles = async (files: File[]): Promise<File[]> => {
    const {
      validFiles: sizeValidFiles,
      hasEmptyFile,
      hasTooLargeFile,
    } = validateChatFileSizes(files);
    if (hasEmptyFile) {
      enqueueSnackbar(t_toasts('chat.error.file.empty'), { variant: 'error' });
    }
    if (hasTooLargeFile) {
      enqueueSnackbar(
        t_toasts('chat.error.file.tooLarge', { fileSize: formatBytes(CHAT_FILE_MAX_SIZE_BYTES) }),
        { variant: 'error' },
      );
    }

    const { validFiles: typeValidFiles, hasInvalidFile: hasTypeError } =
      await validateChatFileTypes(sizeValidFiles);
    if (hasTypeError) {
      enqueueSnackbar(t_toasts('chat.error.file.disguised'), { variant: 'error' });
    }

    return typeValidFiles;
  };

  return { validateFiles };
};
