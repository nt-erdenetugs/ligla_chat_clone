import { useState, useCallback } from 'react';

import { useResponsive } from './useResponsive';

export const useCollapsible = (initialDesktopExpanded = false) => {
  const { isMobileOrTablet } = useResponsive();

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDesktopExpanded, setIsDesktopExpanded] = useState(initialDesktopExpanded);

  const openDesktop = useCallback(() => setIsDesktopExpanded(true), []);
  const closeDesktop = useCallback(() => setIsDesktopExpanded(false), []);
  const toggleDesktop = useCallback(() => setIsDesktopExpanded((prev) => !prev), []);

  const openMobile = useCallback(() => setIsMobileOpen(true), []);
  const closeMobile = useCallback(() => setIsMobileOpen(false), []);
  const toggleMobile = useCallback(() => setIsMobileOpen((prev) => !prev), []);

  const collapsibleMap = {
    PC: {
      isOpen: isDesktopExpanded,
      open: openDesktop,
      close: closeDesktop,
      toggle: toggleDesktop,
    },
    SP: {
      isOpen: isMobileOpen,
      open: openMobile,
      close: closeMobile,
      toggle: toggleMobile,
    },
  };

  return collapsibleMap[isMobileOrTablet ? 'SP' : 'PC'];
};
