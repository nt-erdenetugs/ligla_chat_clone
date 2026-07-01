import AddIcon from '@mui/icons-material/Add';
import { Button, Stack, Typography, type SxProps } from '@mui/material';

import { type LogicalOperator } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { GATE_COLORS, NESTED_GROUP_MAX_DEPTH } from '~/modules/Rules/Filters';

type ConditionsActionButtonsProps = SxProps & {
  onAddFilter: () => void;
  onAddGroup: () => void;
  level?: number;
  disabled?: boolean;
  logicalOperator: LogicalOperator;
};

export const ConditionsActions = ({
  onAddFilter,
  onAddGroup,
  level = 0,
  disabled = false,
  logicalOperator,
  ...sx
}: ConditionsActionButtonsProps) => {
  const { t_management } = useTranslation();

  const { chipBgColor, actionBtnColor } = GATE_COLORS[logicalOperator];

  const buttonSx: SxProps = {
    color: actionBtnColor,
    bgcolor: chipBgColor,
    border: 1,
    borderColor: actionBtnColor,
    borderRadius: '7px',
    px: 1,
  };

  const buttons = [
    {
      label: t_management('chatAssignFilters.filterBuilder.addCondition'),
      startIcon: <AddIcon />,
      onClick: onAddFilter,
    },
    {
      label: t_management(`chatAssignRules.${level === 0 ? 'addGroup' : 'addInnerGroup'}`),
      startIcon: <AddIcon />,
      isHidden: level >= NESTED_GROUP_MAX_DEPTH,
      onClick: onAddGroup,
    },
  ];

  return (
    <Stack direction='row' spacing={1} sx={sx}>
      {buttons
        .filter((btn) => !btn.isHidden)
        .map(({ label, startIcon, onClick }, i) => (
          <Button
            key={`${level}-${i}`}
            sx={buttonSx}
            startIcon={startIcon}
            onClick={onClick}
            disabled={disabled}
          >
            <Typography
              sx={{
                fontSize: 14,
                fontWeight: 'bold',
                pt: '1px',
              }}
            >
              {label}
            </Typography>
          </Button>
        ))}
    </Stack>
  );
};
