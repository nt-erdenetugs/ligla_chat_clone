import { memo } from 'react';

import {
  Checkbox,
  Chip,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';

import { UserRoleType } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { type FilterItem, ChatFiltersType } from '~/modules/Chat';
import { truncate } from '~/utils';

type FilterFieldProps = {
  filterType: ChatFiltersType;
  selectedIds: string[];
  optionList: FilterItem[];
  handleSelectEvent: (id: string) => void;
};

type ChipProps = { item: FilterItem; isSelected: boolean };

const TAG_NAME_MAX_LENGTH = 10;

const commonChipStyles = {
  width: 'auto',
  borderRadius: 20,
  fontSize: '0.75rem',
  alignItems: 'center',
} as const;

const FilterChip = memo(function FilterChip({ item, isSelected }: ChipProps) {
  return (
    <Chip
      label={item.label}
      variant={isSelected ? 'filled' : 'outlined'}
      color={isSelected ? 'primary' : 'default'}
      sx={commonChipStyles}
    />
  );
});

const TagChip = memo(function TagChip({ item, isSelected }: ChipProps) {
  return (
    <Chip
      label={truncate(item.label, TAG_NAME_MAX_LENGTH)}
      sx={{ py: 2, px: 0.95, width: 'auto' }}
      variant={isSelected ? 'filled' : 'outlined'}
      color={isSelected ? 'primary' : 'default'}
      size='small'
    />
  );
});

const OperatorChip = memo(function OperatorChip({ item, isSelected }: ChipProps) {
  const { t_errors } = useTranslation();
  const isManagerOperator = item.roleType === UserRoleType.ManagerOperator;

  return (
    <Tooltip
      title={isManagerOperator ? t_errors('userHasBothOperatorAndManagerRoles') : undefined}
      arrow
    >
      <Chip
        label={item.label}
        variant={isManagerOperator || isSelected ? 'filled' : 'outlined'}
        color={isManagerOperator || isSelected ? 'primary' : 'default'}
        sx={commonChipStyles}
      />
    </Tooltip>
  );
});

export const TooltipChip = memo(function TooltipChip({ item, isSelected }: ChipProps) {
  return (
    <Tooltip title={item.label} arrow>
      <span>
        <FilterChip item={item} isSelected={isSelected} />
      </span>
    </Tooltip>
  );
});

export const ChatFilterField = memo(function ChatFilterField({
  filterType,
  selectedIds,
  optionList,
  handleSelectEvent,
}: FilterFieldProps) {
  const { t, t_chat } = useTranslation();

  const getTranslatedLabel = (item: FilterItem) =>
    filterType === ChatFiltersType.Statuses
      ? t_chat(`status.${item.label.toLowerCase()}`)
      : item.label;

  const renderContent = (item: FilterItem) => {
    const isSelected = selectedIds.includes(item.value);

    const ChipComponent =
      {
        [ChatFiltersType.Tags]: TagChip,
        [ChatFiltersType.Users]: OperatorChip,
        [ChatFiltersType.Teams]: TooltipChip,
        [ChatFiltersType.Statuses]: TooltipChip,
      }[filterType] ?? FilterChip;

    return (
      <ListItemText>
        <ChipComponent
          item={{ ...item, label: getTranslatedLabel(item) }}
          isSelected={isSelected}
        />
      </ListItemText>
    );
  };

  return (
    <List sx={{ p: 0 }}>
      {optionList.length > 0 ? (
        optionList.map((item) => (
          <ListItem key={item.value} disablePadding>
            <ListItemButton
              sx={{ px: { xs: 0, sm: 2 }, py: { xs: 0.5, sm: 1 } }}
              onClick={() => handleSelectEvent(item.value)}
            >
              {renderContent(item)}
              <Checkbox checked={selectedIds.includes(item.value)} />
            </ListItemButton>
          </ListItem>
        ))
      ) : (
        <Typography sx={{ ml: 3, opacity: 0.6 }}>{t('noOptions')}</Typography>
      )}
    </List>
  );
});
