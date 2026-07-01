export const PLATFORM_PATTERNS = {
  IOS: /iphone|ipad|ipod/i,
  ANDROID: /android/i,
} as const;

export const PWA_DISPLAY_MODES = {
  STANDALONE: '(display-mode: standalone)',
  MINIMAL_UI: '(display-mode: minimal-ui)',
} as const;

export const IOS_INSTALL_STEPS = [
  { icon: 'SafariIcon', text: 'pwa.iosInstall.step1' },
  { icon: 'ShareIcon', text: 'pwa.iosInstall.step2' },
  { icon: 'AddToHomeIcon', text: 'pwa.iosInstall.step3' },
] as const;

export const PWA_PROMPT_SHOWN_SESSION_KEY = 'pwa_install_prompt_shown_session';
