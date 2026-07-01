import { useState, useRef } from 'react';

import DeleteIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import { Box, Button, Menu, MenuItem } from '@mui/material';

import { TooltipIconButton } from '~/common/components';
import { LogicalOperator } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { GATE_COLORS } from '~/modules/Rules/Filters';

type ConditionGateProps = {
  logicalOperator?: LogicalOperator;
  disabled?: boolean;
  readOnly?: boolean;
  onChange: (operator: LogicalOperator) => void;
  onDelete?: () => void;
};

const GATE_BUTTON_WIDTH = 90;

export const ConditionGate = ({
  logicalOperator = LogicalOperator.And,
  onChange,
  onDelete,
  disabled,
  readOnly,
}: ConditionGateProps) => {
  const { t } = useTranslation();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const gateButtonRef = useRef<HTMLButtonElement | null>(null);

  const { lineColor, chipBgColor, chipBorderColor } = GATE_COLORS[logicalOperator];

  const availableOperators = Object.values(LogicalOperator);
  const hasOnlyTwoOperators = availableOperators.length === 2;

  const Line = () => (
    <Box sx={{ width: 15, height: 3, bgcolor: lineColor, ml: `${90 / 2 - 1}px` }} />
  );
  const VerticalLine = () => <Box sx={{ width: 3, bgcolor: lineColor, flexGrow: 1, mx: 'auto' }} />;

  const handleOperatorChange = (newOperator: LogicalOperator) => {
    onChange(newOperator);
    setIsMenuOpen(false);
  };

  const handleGateButtonClick = () => {
    if (hasOnlyTwoOperators) {
      const otherOperator = availableOperators.find((op) => op !== logicalOperator);
      if (otherOperator) {
        onChange(otherOperator);
      }
    } else {
      setIsMenuOpen(true);
    }
  };

  const handleMenuClose = () => {
    setIsMenuOpen(false);
  };

  const gateButtonSx = {
    position: 'relative',
    minWidth: GATE_BUTTON_WIDTH,
    backgroundColor: chipBgColor,
    borderColor: chipBorderColor,
    borderWidth: 2,
    borderRadius: '16px',
    textAlign: 'center',
    py: 0.5,
    px: 1.5,
    fontWeight: 700,
    fontSize: 14,
    textTransform: 'uppercase',
    color: 'text.primary',
    '&:hover': {
      backgroundColor: chipBgColor,
      borderColor: lineColor,
      borderWidth: 2,
    },
    '& .MuiButton-endIcon': {
      position: 'absolute',
      top: 7,
      right: 4,
      margin: 0,
      color: lineColor,
    },
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        width: GATE_BUTTON_WIDTH,
      }}
    >
      <Line />
      <VerticalLine />

      <Box sx={{ display: 'flex', gap: 0.3, alignItems: 'center' }}>
        <Button
          ref={gateButtonRef}
          onClick={handleGateButtonClick}
          disabled={disabled}
          variant='outlined'
          endIcon={!readOnly && <EditIcon sx={{ fontSize: '16px !important' }} />}
          sx={gateButtonSx}
        >
          {t(`logicalOperator.${logicalOperator.toLowerCase()}`)}
        </Button>

        {!readOnly && onDelete && (
          <TooltipIconButton
            title={t('actions.delete')}
            icon={<DeleteIcon fontSize='small' color={disabled ? 'disabled' : 'primary'} />}
            onClick={onDelete}
            disabled={disabled}
          />
        )}
      </Box>

      <Menu
        anchorEl={gateButtonRef.current}
        open={isMenuOpen}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        {availableOperators.map((operator) => (
          <MenuItem
            key={operator}
            selected={operator === logicalOperator}
            onClick={() => handleOperatorChange(operator)}
          >
            {t(`logicalOperator.${operator.toLowerCase()}`)}
          </MenuItem>
        ))}
      </Menu>

      <VerticalLine />
      <Line />
    </Box>
  );
};
