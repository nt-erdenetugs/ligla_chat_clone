declare module '*.png' {
  const value: string;
  export = value;
}
declare module '*.jpg' {
  const value: string;
  export = value;
}
declare module '*.jpeg' {
  const value: string;
  export = value;
}
declare module '*.gif' {
  const value: string;
  export = value;
}
declare module '*.svg' {
  const value: string;
  export = value;
}

type Optional<T> = T | undefined;

type Nullable<T> = T | null;

type Nullish<T> = T | undefined | null;

declare module 'virtual:pwa-register/react' {
  import type { Dispatch, SetStateAction } from 'react';

  import type { RegisterSWOptions } from 'vite-plugin-pwa/types';

  export type { RegisterSWOptions };

  export function useRegisterSW(options?: RegisterSWOptions): {
    needRefresh: [boolean, Dispatch<SetStateAction<boolean>>];
    offlineReady: [boolean, Dispatch<SetStateAction<boolean>>];
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  };
}
