import { useEffect, useRef } from 'react';

type Props = {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  edgeThreshold?: number;
  throttleDelay?: number;
};

export function useEdgeSwipe({
  onSwipeLeft,
  onSwipeRight,
  edgeThreshold = 100,
  throttleDelay = 300,
}: Props) {
  const lastExecutionTime = useRef<number>(0);

  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!e.cancelable) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;

      // Only horizontal swipe
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        e.preventDefault();

        const now = Date.now();
        if (now - lastExecutionTime.current < throttleDelay) return;

        if (touchStartX < edgeThreshold && deltaX > 0) {
          lastExecutionTime.current = now;
          onSwipeRight?.();
        }

        if (touchStartX > window.innerWidth - edgeThreshold && deltaX < 0) {
          lastExecutionTime.current = now;
          onSwipeLeft?.();
        }
      }
    };

    const preventBack = () => {
      window.history.go(1);
    };

    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('popstate', preventBack);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('popstate', preventBack);
    };
  }, [onSwipeLeft, onSwipeRight, edgeThreshold, throttleDelay]);
}
