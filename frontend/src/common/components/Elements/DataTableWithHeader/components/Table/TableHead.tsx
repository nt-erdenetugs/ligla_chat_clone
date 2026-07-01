import { TableCell, TableHead as MuiTableHead, TableRow } from '@mui/material';

import { type Column } from '~/common/components';
import { TABLE_ROW_ACTIONS } from '~/common/constants';
import { useActionContext } from '~/context/ActionContext';

type TableHeadProps = {
  columns: Column[];
  hideActionsColumn?: boolean;
  disableBulkSelect?: boolean;
};

export const TableHead = ({
  columns,
  hideActionsColumn = false,
  disableBulkSelect = false,
}: TableHeadProps) => {
  const { actions } = useActionContext();

  const shouldShowActionsColumn =
    !hideActionsColumn && actions.some((action) => TABLE_ROW_ACTIONS.includes(action));

  return (
    <MuiTableHead>
      <TableRow
        sx={{
          '&>.MuiTableCell-head': {
            py: 1,
            backgroundColor: '#eaeaeb',
          },
        }}
      >
        {columns.map(
          ({ name, label, renderHeader, align = 'left', width, minWidth, sortDisabled }) =>
            name === 'isShow' && disableBulkSelect ? null : (
              <TableCell
                key={name}
                align={align}
                sortDirection={'desc'}
                sx={{
                  width,
                  minWidth,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  ...(!sortDisabled && { cursor: 'pointer' }),
                }}
              >
                {renderHeader ? renderHeader() : label}
              </TableCell>
            ),
        )}
        {shouldShowActionsColumn && (
          <TableCell
            sx={{
              minWidth: '80px',
            }}
          />
        )}
      </TableRow>
    </MuiTableHead>
  );
};
