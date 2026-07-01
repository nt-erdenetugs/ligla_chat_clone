export const isIOSPWA = (): boolean => {
  if (typeof window === 'undefined') return false;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = (window.navigator as any).standalone === true;

  return isIOS && isStandalone;
};

export const isIOS = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

export const getDeviceEnvironment = (): string => {
  if (isIOSPWA()) return 'iOS PWA (Standalone)';
  if (isIOS()) return 'iOS Safari Browser';
  return 'Desktop/Other Browser';
};
