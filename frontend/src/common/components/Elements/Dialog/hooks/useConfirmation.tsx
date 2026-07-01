import React, { createContext, useState, useContext, useCallback, type ReactNode } from 'react';

import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';

type ConfirmationOptions = {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
};

type ConfirmationContextType = {
  requestConfirmation: (options?: ConfirmationOptions) => Promise<boolean | undefined>;
};

const defaultOptions = {
  title: 'Confirmation',
  message: 'Are you sure you want to proceed?',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
};

const defaultContext = {
  requestConfirmation: () => {},
} as ConfirmationContextType;

const ConfirmationContext = createContext<ConfirmationContextType>(defaultContext);

export const ConfirmationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [resolvePromise, setResolvePromise] = useState<(value: boolean | undefined) => void>();
  const [options, setOptions] = useState<ConfirmationOptions>(defaultOptions);

  const requestConfirmation = useCallback(
    (options: ConfirmationOptions = {}): Promise<boolean | undefined> => {
      setOptions(options);
      setIsOpen(true);
      return new Promise((resolve) => {
        setResolvePromise(() => resolve);
      });
    },
    [],
  );

  const handleClose = useCallback(
    (result: boolean | undefined) => {
      if (resolvePromise) {
        resolvePromise(result);
      }
      setIsOpen(false);
    },
    [resolvePromise],
  );

  return (
    <ConfirmationContext.Provider value={{ requestConfirmation }}>
      {children}
      <Dialog open={isOpen} onClose={() => handleClose(undefined)} maxWidth='xs' fullWidth>
        <DialogTitle>{options.title}</DialogTitle>
        <DialogContent>{options.message}</DialogContent>
        <DialogActions>
          <Button onClick={() => handleClose(false)} color='secondary'>
            {options.cancelText}
          </Button>
          <Button onClick={() => handleClose(true)}>{options.confirmText}</Button>
        </DialogActions>
      </Dialog>
    </ConfirmationContext.Provider>
  );
};

export const useConfirmation = () => useContext(ConfirmationContext);
