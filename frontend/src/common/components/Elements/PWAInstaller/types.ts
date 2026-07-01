export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export interface NavigatorStandalone extends Navigator {
  standalone?: boolean;
}

export interface PWAInstallDrawerProps {
  forceShow?: boolean;
  onInstall?: (success: boolean) => void;
  onDismiss?: () => void;
  ignoreSession?: boolean;
}

export type PWAState = {
  open: boolean;
  isIOS: boolean;
  unsupported: boolean;
  dontShowAgain: boolean;
  loading: boolean;
};

export type PWAAction =
  | { type: 'SET_PLATFORM'; payload: { isIOS: boolean; unsupported: boolean } }
  | { type: 'SHOW_PROMPT' }
  | { type: 'HIDE_PROMPT' }
  | { type: 'SET_DONT_SHOW'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean };
