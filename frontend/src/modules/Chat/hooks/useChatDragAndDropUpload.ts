import { useCallback, useRef, useState, type DragEvent } from 'react';

type Params = {
  isEnabled: boolean;
  targetChatId: string | null;
  onFilesDropped: (files: File[]) => void | Promise<void>;
  onPermissionDenied?: () => void;
};

export const useChatDragAndDropUpload = ({
  isEnabled,
  targetChatId,
  onFilesDropped,
  onPermissionDenied,
}: Params) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounter = useRef(0);

  const resetDrag = () => {
    dragCounter.current = 0;
    setIsDraggingOver(false);
  };

  const isFileEvent = (event: DragEvent) =>
    Array.from(event.dataTransfer?.items ?? []).some((i) => i.kind === 'file');

  const handleDragEnter = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      if (!isEnabled || !isFileEvent(event)) return;

      dragCounter.current += 1;
      setIsDraggingOver(true);
    },
    [isEnabled],
  );

  const handleDragOver = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      if (!isEnabled || !isFileEvent(event)) return;

      event.dataTransfer.dropEffect = 'copy';
    },
    [isEnabled],
  );

  const handleDragLeave = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      if (!isEnabled) return;

      dragCounter.current -= 1;

      if (dragCounter.current <= 0) resetDrag();
    },
    [isEnabled],
  );

  const handleDrop = useCallback(
    async (event: DragEvent) => {
      event.preventDefault();
      resetDrag();

      if (!targetChatId) return;

      if (!isEnabled) {
        onPermissionDenied?.();
        return;
      }

      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length === 0) return;

      await onFilesDropped(files);
    },
    [isEnabled, targetChatId, onFilesDropped, onPermissionDenied],
  );

  return {
    isDraggingOver,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
};
