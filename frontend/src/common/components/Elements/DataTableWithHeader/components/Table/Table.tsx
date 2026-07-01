import { Fade, Table as MuiTable, type SxProps, TableBody, TableContainer } from '@mui/material';

import { type Column, type Row } from '~/common/components';

import { TableHead } from './TableHead';
import { TableRow } from './TableRow';

type TableProps = {
  columns: Column[];
  rows: Row[];
  getRowStyle?: (row: Row) => SxProps;
  onRowClick?: (id: string) => void;
  onClickEdit?: (id: string) => void;
  onClickDelete?: (id: string) => void;
  checkRowProtected?: (row: Row) => boolean;
  hideActionsColumn?: boolean;
};

export const Table = ({
  columns,
  rows,
  getRowStyle,
  onRowClick,
  onClickEdit,
  onClickDelete,
  checkRowProtected,
  hideActionsColumn = false,
}: TableProps) => {
  return (
    <Fade timeout={200} in>
      <TableContainer sx={{ maxHeight: hideActionsColumn ? '82vh' : 'auto' }}>
        <MuiTable stickyHeader={true} size='small'>
          <TableHead
            columns={columns}
            hideActionsColumn={hideActionsColumn}
            disableBulkSelect={rows.length === 0}
          />
          <TableBody>
            {rows.map((row, index) => (
              <TableRow
                key={`${row.id}-${index}`}
                columns={columns}
                row={row}
                getRowStyle={getRowStyle}
                onRowClick={onRowClick}
                onClickEdit={onClickEdit}
                onClickDelete={onClickDelete}
                checkRowProtected={checkRowProtected}
                hideActionsColumn={hideActionsColumn}
              />
            ))}
          </TableBody>
        </MuiTable>
      </TableContainer>
    </Fade>
  );
};
