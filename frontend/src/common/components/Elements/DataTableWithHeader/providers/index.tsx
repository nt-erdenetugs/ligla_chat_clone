import { createContext, useCallback, useContext, useState, useMemo, type ReactNode } from 'react';

import { useTopBarHeight } from '~/common/components/Layout';
import ActionProvider from '~/context/ActionContext';
import { PaginationProvider } from '~/context/PaginationContext';

type DataTableProviderProps = {
  customPagination?: boolean;
  children: ReactNode;
};

export interface DataTableContextValue {
  targetId?: string;
  setTargetId: (id?: string) => void;
  showDelete: boolean;
  setShowDelete: (open: boolean) => void;
  formOpen: boolean;
  setFormOpen: (open: boolean) => void;
  topBarHeight: number;
  layoutMarginTop: string;
  openFormModal: (id?: string) => void;
  hasRows: boolean;
  setHasRows: (hasRows: boolean) => void;
}

const DataTableContext = createContext<DataTableContextValue | undefined>(undefined);

export const DataTableProvider = ({ children, customPagination }: DataTableProviderProps) => {
  const [targetId, setTargetId] = useState<string>();
  const [hasRows, setHasRows] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const topBarHeight = useTopBarHeight();
  const layoutMarginTop = `${topBarHeight}px`;
  const openFormModal = useCallback((id?: string) => {
    setTargetId(id);
    setFormOpen(true);
  }, []);

  const value = useMemo<DataTableContextValue>(
    () => ({
      targetId,
      setTargetId,
      showDelete,
      setShowDelete,
      formOpen,
      setFormOpen,
      topBarHeight,
      layoutMarginTop,
      openFormModal,
      hasRows,
      setHasRows,
    }),
    [targetId, showDelete, formOpen, topBarHeight, layoutMarginTop, openFormModal, hasRows],
  );

  return (
    <PaginationProvider customPagination={customPagination}>
      <ActionProvider>
        <DataTableContext.Provider value={value}>{children}</DataTableContext.Provider>
      </ActionProvider>
    </PaginationProvider>
  );
};

export const useDataTableContext = (): DataTableContextValue => {
  const dataTableContext = useContext(DataTableContext);
  if (!dataTableContext)
    throw new Error('useDataTableContext must be used within a DataTableProvider');
  return dataTableContext;
};
