import { useCallback, useRef, useEffect } from 'react';

export function useThrottle(callback: () => void, delay: number = 50) {
  const timeoutRef = useRef<number>();

  const throttledCallback = useCallback(() => {
    if (!timeoutRef.current) {
      callback();

      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = undefined;
      }, delay);
    }
  }, [callback, delay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledCallback;
}
