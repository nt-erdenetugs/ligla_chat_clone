import { useCallback, useEffect, useMemo, useState } from 'react';

import { type FileRejection } from 'react-dropzone';

import { getUploadUrl, uploadFile } from '~/utils/file';

export function useUploadProfile(initialUrl?: Nullable<string>, userId?: string) {
  const [pictureUrl, setPictureUrl] = useState<Nullish<string>>(initialUrl);
  const [pictureFile, setPictureFile] = useState<Nullable<File>>(null);
  const [isUploading, setIsUploading] = useState(false);

  const isChanged = useMemo(() => {
    return Boolean(pictureUrl && pictureUrl !== initialUrl);
  }, [pictureUrl, initialUrl]);

  useEffect(() => {
    if (!pictureFile) {
      setPictureUrl(initialUrl);
    }
  }, [initialUrl, pictureFile]);

  const handleDrop = useCallback((acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
    if (rejectedFiles.length > 0 || acceptedFiles.length === 0) return;

    const newFile = acceptedFiles[0];
    const objectUrl = URL.createObjectURL(newFile);

    setPictureFile(newFile);
    setPictureUrl(objectUrl);
  }, []);

  const upload = useCallback(async () => {
    if (!pictureFile || !pictureUrl) return false;

    setIsUploading(true);
    try {
      const url = getUploadUrl('uploadProfile');
      const { success } = await uploadFile(url, pictureFile, userId);
      return success;
    } catch (err) {
      console.error(err);
      return false;
    } finally {
      setIsUploading(false);
    }
  }, [pictureFile, pictureUrl, userId]);

  const reset = () => {
    setPictureUrl(initialUrl);
    setPictureFile(null);
  };

  return {
    pictureUrl,
    pictureFile,
    isUploading,
    isChanged,
    handleDrop,
    reset,
    upload,
  };
}
