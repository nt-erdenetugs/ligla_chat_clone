import { useRef, useEffect, useCallback, useState } from 'react';

interface UseChatKeyboardControlProps {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  isDesktop: boolean;
}

export const useChatKeyboardControl = ({ inputRef, isDesktop }: UseChatKeyboardControlProps) => {
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const lastScrollTopRef = useRef(0);
  const pointerCleanupRef = useRef<(() => void) | null>(null);
  const containerSelector = '.chat-messages';
  const threshold = 150;

  const stateRef = useRef({
    focusing: false,
    suppressBlur: false,
    isDragging: false,
  });

  const ignoreBlur = useCallback(() => {
    if (isDesktop || !keyboardVisible) return;
    return stateRef.current.suppressBlur || stateRef.current.focusing;
  }, [keyboardVisible, isDesktop]);

  const blurChatInput = useCallback(() => {
    if (isDesktop || ignoreBlur()) return;
    inputRef.current?.blur();
  }, [ignoreBlur, inputRef, isDesktop]);

  const focusChatInput = useCallback(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  // Handles clicks or taps on the chat input: resets any previous interaction state, marks input as being interacted with, focuses it, and sets up cleanup on pointer release or cancel:
  const onChatInputClick = useCallback(() => {
    pointerCleanupRef.current?.();
    stateRef.current.isDragging = true;
    stateRef.current.focusing = true;
    focusChatInput();

    const cleanup = () => {
      stateRef.current.isDragging = false;
      stateRef.current.focusing = false;
      pointerCleanupRef.current = null;
    };

    document.addEventListener('pointerup', cleanup, { once: true });
    document.addEventListener('pointercancel', cleanup, { once: true });
    pointerCleanupRef.current = cleanup;
  }, [focusChatInput]);

  const setSuppressBlur = useCallback((value: boolean) => {
    stateRef.current.suppressBlur = value;
  }, []);

  useEffect(() => {
    if (isDesktop || typeof window === 'undefined') return;

    // Detects keyboard visibility based on viewport height changes:
    const initialHeight = window.visualViewport?.height ?? window.innerHeight;

    const updateKeyboard = () => {
      const currentHeight = window.visualViewport?.height ?? window.innerHeight;
      setKeyboardVisible(initialHeight - currentHeight > threshold);
    };

    window.visualViewport?.addEventListener('resize', updateKeyboard);
    window.visualViewport?.addEventListener('scroll', updateKeyboard);
    window.addEventListener('resize', updateKeyboard);

    // Prevent scroll when dragging the input:
    const handleDocumentTouchMove = (event: TouchEvent) => {
      if (stateRef.current.isDragging) event.preventDefault();
    };
    document.addEventListener('touchmove', handleDocumentTouchMove, { passive: false });

    return () => {
      window.visualViewport?.removeEventListener('resize', updateKeyboard);
      window.visualViewport?.removeEventListener('scroll', updateKeyboard);
      window.removeEventListener('resize', updateKeyboard);
      document.removeEventListener('touchmove', handleDocumentTouchMove as EventListener);
      pointerCleanupRef.current?.();
    };
  }, [isDesktop, threshold]);

  useEffect(() => {
    if (isDesktop || typeof window === 'undefined') return;

    const container = document.querySelector<HTMLElement>(containerSelector);
    if (!container) return;

    lastScrollTopRef.current = container.scrollTop;

    let touchStartY: number | null = null;
    let touchInside = false;
    let touchOutside = false;

    // Handles the start of a touch gesture: marks the touch as inside the chat, stores initial Y position, and focuses the chat input:
    const handleTouchStart = (event: TouchEvent) => {
      if (!keyboardVisible) return;
      touchInside = true;
      touchStartY = event.touches[0]?.clientY ?? null;
      focusChatInput();
    };

    // Handles touch scrolling: if scrolling down at the top of the chat, blur input; if scrolling up at the bottom, prevent further scrolling:
    const handleTouchMove = (event: TouchEvent) => {
      if (!keyboardVisible || !touchInside || touchStartY == null) return;

      const currentY = event.touches[0]?.clientY ?? touchStartY;
      const deltaY = currentY - touchStartY;

      const atTop = container.scrollTop <= 0;
      const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 1;

      if (deltaY > 0 && atTop) blurChatInput();
      if (deltaY < 0 && atBottom) event.preventDefault();
    };

    // Handles the end of a touch gesture by resetting touch tracking variables:
    const handleTouchEnd = () => {
      touchInside = false;
      touchStartY = null;
    };

    // Handles touches that start outside the chat container and prevent their move events while the keyboard is visible.
    const handleDocumentTouchStart = (event: TouchEvent) => {
      if (!keyboardVisible) return;
      const touch = event.touches?.[0];
      if (!touch) {
        touchOutside = false;
        return;
      }
      const element = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
      touchOutside = !(element && container.contains(element));
    };

    const handleDocumentTouchMove = (event: TouchEvent) => {
      if (!keyboardVisible || !touchOutside) return;
      event.preventDefault();
    };

    const handleDocumentTouchEnd = () => {
      touchOutside = false;
    };

    // Handles container scroll: if scrolling up slightly while keyboard is visible, blur the chat input to hide the keyboard:
    const handleScroll = () => {
      if (!keyboardVisible) return;
      if (container.scrollTop < lastScrollTopRef.current - 8) blurChatInput();
      lastScrollTopRef.current = container.scrollTop;
    };

    // Handles clicks inside the chat container: focuses the chat input unless the click is on interactive elements or editable content:
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target) return;

      const ignore = ['a', 'button', 'input', 'textarea', 'select', 'label'];
      if (ignore.includes(target.tagName.toLowerCase()) || target.isContentEditable) return;

      event.preventDefault();
      focusChatInput();
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchstart', handleDocumentTouchStart, { passive: true });
    document.addEventListener('touchmove', handleDocumentTouchMove, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleDocumentTouchEnd, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('scroll', handleScroll, { passive: true });
    container.addEventListener('click', handleClick, true);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchstart', handleDocumentTouchStart as EventListener);
      document.removeEventListener('touchmove', handleDocumentTouchMove as EventListener);
      document.removeEventListener('touchmove', handleTouchMove as EventListener);
      document.removeEventListener('touchend', handleDocumentTouchEnd as EventListener);
      document.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('click', handleClick, true);
    };
  }, [keyboardVisible, isDesktop, containerSelector, blurChatInput, focusChatInput]);

  return {
    keyboardVisible,
    onChatInputClick,
    setSuppressBlur,
  };
};
