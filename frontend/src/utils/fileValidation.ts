import { fileTypeFromBlob } from 'file-type';

import {
  ACCEPTED_ARCHIVE_MIME_TYPES,
  ACCEPTED_DOCUMENT_MIME_TYPES,
  CHAT_FILE_MAX_SIZE_BYTES,
} from '~/common/constants';

type ValidationResult = { validFiles: File[]; hasInvalidFile: boolean };
type SizeValidationResult = { validFiles: File[]; hasEmptyFile: boolean; hasTooLargeFile: boolean };

export const validateChatFileSizes = (files: File[]): SizeValidationResult => {
  const nonEmptyFiles = files.filter((file) => file.size > 0);

  const validFiles = nonEmptyFiles.filter((file) => file.size <= CHAT_FILE_MAX_SIZE_BYTES);

  return {
    validFiles,
    hasEmptyFile: nonEmptyFiles.length < files.length,
    hasTooLargeFile: validFiles.length < nonEmptyFiles.length,
  };
};

export const validateChatFileTypes = async (files: File[]): Promise<ValidationResult> => {
  const results = await Promise.all(
    files.map(async (file) => {
      const detected = await fileTypeFromBlob(file);

      if (!detected) return file;
      if (!file.type) return file;

      const detectedMime = detected.mime;
      const fileMime = file.type;

      // some legacy microsoft documents will be detected as application/x-cfb
      if (ACCEPTED_DOCUMENT_MIME_TYPES.includes(fileMime) && detectedMime === 'application/x-cfb')
        return file;

      // audio/video/image: match on category prefix to avoid false positives from codec/container variation
      const mediaPrefix = ['audio/', 'video/', 'image/'].find((p) => fileMime.startsWith(p));
      if (mediaPrefix && detectedMime.startsWith(mediaPrefix)) return file;

      // zip: both must be within accepted archive types (covers Windows application/x-zip-compressed)
      if (
        ACCEPTED_ARCHIVE_MIME_TYPES.includes(fileMime) &&
        ACCEPTED_ARCHIVE_MIME_TYPES.includes(detectedMime)
      )
        return file;

      // documents and everything else: require exact match
      return detectedMime === fileMime ? file : null;
    }),
  );

  const validFiles = results.filter((f): f is File => f !== null);
  return { validFiles, hasInvalidFile: validFiles.length < files.length };
};
