import { Fragment, type ReactNode } from 'react';

import { Grid, Divider, type GridProps } from '@mui/material';

export type LabeledGridProps = Omit<GridProps, 'children'> & {
  rows: Optional<ReactNode[]>[];
  gridSize?: number;
  showTopDivider?: boolean;
  showBottomDivider?: boolean;
  flexColumn?: boolean;
};

const GridDivider = () => (
  <Grid size={12}>
    <Divider sx={{ borderColor: 'secondary.light' }} />
  </Grid>
);

export const LabeledGrid = ({
  rows,
  gridSize,
  showTopDivider = true,
  showBottomDivider = false,
  width = 500,
  flexColumn = false,
  ...props
}: LabeledGridProps) => {
  const labelSize = flexColumn ? 12 : gridSize || 4;
  const valueSize = flexColumn ? 12 : gridSize ? 12 - gridSize : 8;

  return (
    <Grid container spacing={2} alignItems='center' width={width} {...props}>
      {showTopDivider && <GridDivider />}
      {rows.map(
        (row, index) =>
          row && (
            <Fragment key={index}>
              {row.length === 1 ? (
                <Grid size={12} ml={flexColumn ? 2 : 0}>
                  <div style={{ paddingLeft: '1rem', overflowWrap: 'break-word' }}>{row[0]}</div>
                </Grid>
              ) : (
                <>
                  <Grid size={labelSize} fontSize='0.85rem' fontWeight='bold'>
                    <div style={{ paddingLeft: '1rem' }}>{row[0]}</div>
                  </Grid>
                  <Grid size={valueSize} ml={flexColumn ? 2 : 0}>
                    <div style={{ paddingRight: '1rem', overflowWrap: 'break-word' }}>{row[1]}</div>
                  </Grid>
                </>
              )}
              {(showBottomDivider || index + 1 !== rows.length) && <GridDivider />}
            </Fragment>
          ),
      )}
    </Grid>
  );
};
