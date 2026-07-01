import { useEffect, useCallback, useMemo, useState, type FunctionComponent } from 'react';

import { Box, Typography, type SxProps } from '@mui/material';
import { useSearchParams } from 'react-router';

import { Loading, DeleteDialog, RestoreDialog, Card } from '~/common/components/Elements';
import { type DataTableBaseProps } from '~/common/components/Elements/DataTableWithHeader/DataTableWithHeader';
import { useDataTableContext } from '~/common/components/Elements/DataTableWithHeader/providers';
import { ListFilter } from '~/common/components/ListFilter';
import { useColumnFilter } from '~/common/components/ListFilter/hooks/useColumnFilter';
import {
  ACTION_PARAM_KEY,
  ACTIONS_TYPE,
  ALL_ACTIONS,
  ID_PARAM_KEY,
  MAIN_ACTIONS,
  type IAction,
} from '~/common/constants';
import { useErrorHandledAction, usePaginatedQuery } from '~/common/hooks';
import { useActionContext } from '~/context/ActionContext';
import { useTranslation } from '~/locales/hooks';

import { type GetStartedProps, Pagination, GetStarted, Table } from './components';
import { type Row, type Column, type FormProps, type ShowProps } from './types';

export interface DataTableProps extends DataTableBaseProps {
  Form?: FunctionComponent<FormProps>;
  Show?: FunctionComponent<ShowProps>;
  actionDisabled?: boolean;
  editDisabled?: boolean;
  useColumns: () => Column<any>[];
  updateAdditionalInfo?: (query: any) => void;
  getRowStyle?: (row: Row) => SxProps;
  checkRowProtected?: (row: Row) => boolean;
  onDelete?: (id: string) => Promise<void>;
  onRestore?: (id: string) => void;
  getStartedProps?: Partial<GetStartedProps>;
  hideActionsColumn?: boolean;
  disableAddAction?: boolean;
  disablePagination?: boolean;
  showFilterSearchBar?: boolean;
}

export const DataTable = ({
  entryKey,
  query,
  Form,
  Show,
  extraQueryVariables,
  disableUrlParams,
  actionDisabled,
  editDisabled,
  getStartedProps,
  disableAddAction,
  disablePagination,
  hideActionsColumn,
  mergeHeader,
  sx,
  useColumns,
  updateAdditionalInfo,
  getRowStyle,
  checkRowProtected,
  onDelete,
  onRestore,
  onFilterApply,
  onFilterReset,
  externalAppliedFilters,
  externalSearchValue,
}: DataTableProps) => {
  const {
    setTargetId,
    showDelete,
    setShowDelete,
    formOpen,
    setFormOpen,
    openFormModal,
    targetId,
    setHasRows,
  } = useDataTableContext();
  const { resetActions, setActions, setActionAndId } = useActionContext();
  const [searchParams] = useSearchParams();
  const { executeAction } = useErrorHandledAction();

  const columns = useColumns();
  const [showOpen, setShowOpen] = useState(false);
  const action = useMemo(() => searchParams.get(ACTION_PARAM_KEY) ?? '', [searchParams]);

  const id = useMemo(
    () => (disableUrlParams ? targetId : searchParams.get(ID_PARAM_KEY)) ?? '',
    [searchParams, targetId, disableUrlParams],
  );

  const {
    data: rows,
    rawData,
    loading,
    totalPages,
  } = usePaginatedQuery(query, entryKey, extraQueryVariables);

  const organizationId = useMemo(
    () => extraQueryVariables?.organizationId as string | undefined,
    [extraQueryVariables],
  );

  useEffect(() => {
    if (loading) {
      return;
    }
    const hasRows = Boolean(rows && rows.length > 0);
    setHasRows?.(hasRows);
  }, [rows, loading, setHasRows]);

  useEffect(() => {
    if (!disableUrlParams && searchParams.has(ACTION_PARAM_KEY)) {
      const isInvalidAction = !ALL_ACTIONS.includes(action as IAction);
      const isMainActionWithoutId = MAIN_ACTIONS.includes(action as IAction) && !id;

      if (isInvalidAction || isMainActionWithoutId) {
        resetActions();
      }
    }
  }, [action, disableUrlParams, id, resetActions, searchParams]);

  useEffect(() => {
    if (!rawData || !updateAdditionalInfo) return;
    updateAdditionalInfo(rawData);
  }, [rawData, updateAdditionalInfo]);

  useEffect(() => {
    const actions: IAction[] = [];

    if (Show) actions.push(ACTIONS_TYPE.SHOW);
    if (Form && !editDisabled) actions.push(ACTIONS_TYPE.EDIT);
    if (onDelete) actions.push(ACTIONS_TYPE.DELETE);
    if (onRestore) actions.push(ACTIONS_TYPE.RESTORE);

    setActions(actions);
  }, [Form, Show, onDelete, onRestore, editDisabled, setActions]);

  const { t, t_management, t_errors } = useTranslation();

  const handleClose = () => {
    resetActions();
    setFormOpen?.(false);
  };

  const handleDeleteDialogConfirm = async () => {
    if (onDelete) {
      await executeAction(
        () => onDelete(id),
        disableUrlParams ? () => setShowDelete?.(false) : handleClose,
      );
    }
  };

  const handleRestoreDialogConfirm = () => {
    if (onRestore) onRestore(id);
    handleClose();
  };

  const isAction = useCallback(
    (action: IAction) => (actionDisabled ? false : searchParams.get(ACTION_PARAM_KEY) === action),
    [actionDisabled, searchParams],
  );
  const formTitle = useMemo(() => t_management(`${entryKey}.formTitle`), [entryKey, t_management]);

  const showForm = useMemo(
    () =>
      (formOpen && Form) ||
      (Form && (isAction(ACTIONS_TYPE.NEW) || (isAction(ACTIONS_TYPE.EDIT) && Boolean(id)))),
    [Form, formOpen, isAction, id],
  );

  const showDetail = useMemo(
    () => (showOpen && Show) || (Show && isAction(ACTIONS_TYPE.SHOW) && Boolean(id)),
    [Show, id, isAction, showOpen],
  );

  const showDeleteDialog = useMemo(
    () =>
      ((showDelete && onDelete) || (onDelete && isAction(ACTIONS_TYPE.DELETE) && Boolean(id))) &&
      (!checkRowProtected || checkRowProtected({ id })),
    [checkRowProtected, id, isAction, onDelete, showDelete],
  );

  const showRestoreDialog = useMemo(
    () => onRestore && isAction(ACTIONS_TYPE.RESTORE) && Boolean(id),
    [id, isAction, onRestore],
  );

  const handleShowDialogConfirm = useCallback(() => {
    if (!Form || !id) return;

    setShowOpen(false);
    openFormModal?.(id);
  }, [Form, id, openFormModal, setShowOpen]);

  useEffect(() => {
    if (!searchParams.has(ACTION_PARAM_KEY)) return;

    const actionHandlers: Record<string, () => void> = {
      [ACTIONS_TYPE.DELETE]: () => {
        if (!showDeleteDialog && id) setActionAndId(ACTIONS_TYPE.EDIT, id);
      },
      [ACTIONS_TYPE.EDIT]: () => {
        if (editDisabled && id) setActionAndId(ACTIONS_TYPE.SHOW, id);
      },
      [ACTIONS_TYPE.NEW]: () => {
        if (disableAddAction) resetActions();
      },
    };

    actionHandlers[action]?.();
  }, [
    action,
    disableAddAction,
    editDisabled,
    id,
    resetActions,
    searchParams,
    setActionAndId,
    showDeleteDialog,
  ]);
  const { filteredRows, handleColumnFilterApply, handleColumnFilterReset, noMatchMessage } =
    useColumnFilter(rows, entryKey, onFilterApply, onFilterReset);
  return (
    <>
      <Card
        sx={{
          ...sx?.tableSx,
          ...(mergeHeader ? { borderRadius: '0 0 8px 8px', boxShadow: 'none' } : {}),
        }}
      >
        {loading ? (
          <Loading />
        ) : rows ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <ListFilter
              columns={columns}
              storageKey={disableUrlParams ? undefined : String(entryKey)}
              onApply={handleColumnFilterApply}
              onReset={handleColumnFilterReset}
              externalAppliedFilters={externalAppliedFilters}
              externalSearchValue={externalSearchValue}
            />
            <Table
              rows={filteredRows ?? rows}
              columns={columns}
              getRowStyle={getRowStyle}
              onRowClick={
                disableUrlParams
                  ? (id) => {
                      setTargetId?.(id);
                      setShowOpen(true);
                    }
                  : undefined
              }
              onClickEdit={disableUrlParams ? openFormModal : undefined}
              onClickDelete={
                disableUrlParams
                  ? (id) => {
                      setTargetId?.(id);
                      setShowDelete?.(true);
                    }
                  : undefined
              }
              checkRowProtected={checkRowProtected}
              hideActionsColumn={hideActionsColumn}
            />

            {filteredRows && filteredRows.length === 0 && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography align='center'>{noMatchMessage}</Typography>
              </Box>
            )}
          </Box>
        ) : (
          <Typography>{t_errors('failedToFetchRefreshAgain')}</Typography>
        )}

        {rows?.length === 0 && (
          <GetStarted
            title={formTitle}
            showAddButton={Boolean(Form)}
            addButtonProps={{ onClick: () => openFormModal?.() }}
            {...getStartedProps}
          />
        )}

        {!disablePagination && <Pagination totalPages={totalPages} />}

        {showForm && Form && (
          <Form
            id={organizationId ? targetId : id}
            organizationId={organizationId}
            onClose={disableUrlParams ? () => setFormOpen?.(false) : handleClose}
          />
        )}

        {showDetail && Show && (
          <Show
            id={id}
            organizationId={organizationId}
            onClose={disableUrlParams ? () => setShowOpen(false) : handleClose}
            onConfirm={disableUrlParams ? handleShowDialogConfirm : undefined}
            dialogProps={
              disableUrlParams
                ? {
                    open: showOpen,
                    onConfirm: handleShowDialogConfirm,
                  }
                : undefined
            }
          />
        )}

        {showDeleteDialog && (
          <DeleteDialog
            title={`${t('actions.delete')} ${formTitle}`}
            onClose={disableUrlParams ? () => setShowDelete?.(false) : handleClose}
            onConfirm={handleDeleteDialogConfirm}
          />
        )}

        {showRestoreDialog && (
          <RestoreDialog
            title={`${t('actions.delete')} ${formTitle}`}
            onClose={handleClose}
            onConfirm={handleRestoreDialogConfirm}
          />
        )}
      </Card>
    </>
  );
};
