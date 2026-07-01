import { type ReactNode } from 'react';

import { DragOverlay as _DragOverlay } from '@dnd-kit/core';
import { createPortal } from 'react-dom';

type DragOverlayProps = {
  children?: ReactNode;
};

export const DragOverlay = ({ children }: DragOverlayProps) => {
  return createPortal(
    <_DragOverlay dropAnimation={null} zIndex={1350}>
      {children}
    </_DragOverlay>,
    document.body,
  );
};
