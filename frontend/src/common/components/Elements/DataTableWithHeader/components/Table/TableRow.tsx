import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import { TableCell, TableRow as MuiTableRow, type SxProps } from '@mui/material';

import { type Row, type Column } from '~/common/components';
import {
  ACTIONS_TYPE,
  TABLE_ROW_ACTIONS,
  ACTION_LABEL_KEYS,
  UserStatusType,
} from '~/common/constants';
import { useActionContext } from '~/context/ActionContext';
import { useTranslation } from '~/locales/hooks';

import { ToolIconButton } from './ToolIconButton';

type TableRowProps = {
  row: Row;
  columns: Column[];
  getRowStyle?: (row: Row) => SxProps;
  checkRowProtected?: (row: Row) => boolean;
  isActionDisabled?: boolean;
  onRowClick?: (id: string) => void;
  onClickEdit?: (id: string) => void;
  onClickDelete?: (id: string) => void;
  hideActionsColumn?: boolean;
};

export const TableRow = ({
  row,
  columns,
  getRowStyle,
  checkRowProtected,
  onRowClick,
  onClickDelete,
  onClickEdit,
  hideActionsColumn = false,
}: TableRowProps) => {
  const { actions, setActionAndId } = useActionContext();
  const { t } = useTranslation();

  const isActive = Boolean(row.isActive);
  const isDefault = Boolean(row.isDefault);
  const showDeleteButton =
    (checkRowProtected ? checkRowProtected(row) : true) && actions.includes(ACTIONS_TYPE.DELETE);

  const showEnabled = actions.includes(ACTIONS_TYPE.SHOW);
  const isInactive = 'status' in row && row.status !== UserStatusType.ACTIVE;

  const shouldShowActionsColumn = !hideActionsColumn;

  return (
    <MuiTableRow
      sx={{
        opacity: isInactive ? 0.5 : 1,
        backgroundColor: isInactive ? '#f5f5f9' : 'inherit',
        '&:hover': {
          '.hover-tool-icon': {
            visibility: 'visible',
            opacity: 1,
            '&:nth-last-of-type(2)': {
              transform: 'translate(-110%, -50%)',
            },
          },
          opacity: 0.75,
        },
        ...(getRowStyle ? getRowStyle(row) : {}),
      }}
      hover={showEnabled}
      tabIndex={-1}
    >
      {columns.map(({ name, align, formatValue, sx }) => {
        return (
          <TableCell
            key={name}
            align={align}
            sx={{
              overflowWrap: 'anywhere',
              ...(showEnabled && { cursor: 'pointer' }),
              color: isActive ? 'inherit' : 'text.disabled',
              ...sx,
            }}
            {...(showEnabled && {
              onClick: () =>
                onRowClick ? onRowClick(String(row.id)) : setActionAndId(ACTIONS_TYPE.SHOW, row.id),
            })}
          >
            {formatValue ? formatValue(row) : String(row[name] || '')}
          </TableCell>
        );
      })}

      {shouldShowActionsColumn && actions.some((action) => TABLE_ROW_ACTIONS.includes(action)) && (
        <TableCell align='right' sx={{ position: 'relative' }}>
          {isActive && <MoreHorizIcon />}
          {actions.includes(ACTIONS_TYPE.EDIT) && (
            <ToolIconButton
              title={t(ACTION_LABEL_KEYS[ACTIONS_TYPE.EDIT])}
              icon={<EditIcon />}
              onClick={() =>
                onClickEdit
                  ? onClickEdit(String(row.id))
                  : setActionAndId(ACTIONS_TYPE.EDIT, row.id)
              }
              keep
            />
          )}
          {!isActive || isDefault
            ? null
            : showDeleteButton && (
                <ToolIconButton
                  title={t(ACTION_LABEL_KEYS[ACTIONS_TYPE.DELETE])}
                  icon={<DeleteIcon />}
                  onClick={() =>
                    !isDefault && onClickDelete
                      ? onClickDelete(String(row.id))
                      : setActionAndId(ACTIONS_TYPE.DELETE, row.id)
                  }
                  keep
                />
              )}
        </TableCell>
      )}
    </MuiTableRow>
  );
};
