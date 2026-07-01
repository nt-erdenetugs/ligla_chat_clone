import { useCallback, useMemo, useState, memo } from 'react';

import ArrowForwardIosSharpIcon from '@mui/icons-material/ArrowForwardIosSharp';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import {
  Accordion as MuiAccordion,
  AccordionDetails as MuiAccordionDetails,
  AccordionSummary as MuiAccordionSummary,
  accordionSummaryClasses,
  type AccordionProps,
  type AccordionSummaryProps,
  Badge,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
  styled,
} from '@mui/material';

import { CustomPopover } from '~/common/components';
import { useBoolean, useResponsive } from '~/common/hooks';
import { useTranslation } from '~/locales/hooks';
import {
  ChatFilterField,
  TooltipChip,
  ChatFiltersType,
  type UseChatFiltersType,
} from '~/modules/Chat';

type ChatFilterProps = Omit<UseChatFiltersType, 'isFetchingAllOptions' | 'isFiltersApplied'> & {
  disabled?: boolean;
};

const Accordion = styled((props: AccordionProps) => (
  <MuiAccordion disableGutters elevation={0} square {...props} />
))(() => ({
  '&:not(:last-child)': {
    borderBottom: 0,
  },
  '&::before': {
    display: 'none',
  },
}));

const AccordionSummary = styled((props: AccordionSummaryProps) => (
  <MuiAccordionSummary
    expandIcon={<ArrowForwardIosSharpIcon sx={{ fontSize: '0.9rem' }} />}
    {...props}
  />
))(({ theme }) => ({
  [`& .${accordionSummaryClasses.expandIconWrapper}.${accordionSummaryClasses.expanded}`]: {
    transform: 'rotate(90deg)',
  },
  [`& .${accordionSummaryClasses.content}`]: {
    alignItems: 'center',
    marginRight: theme.spacing(1),
  },
}));

const AccordionDetails = styled(MuiAccordionDetails)(({ theme }) => ({
  padding: 0,
  paddingLeft: theme.spacing(5),
  paddingRight: theme.spacing(2),
}));

export const ChatFilter = memo(function ChatFilter({
  clearFilters,
  setFilters,
  filterCategories,
  filters,
  filtersOptions,
  disabled = false,
}: ChatFilterProps) {
  const { t_management, t_chat } = useTranslation();
  const { isMobile } = useResponsive();
  const { value: isOpen, onFalse: onClose, onTrue: onOpen } = useBoolean();

  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<Nullable<ChatFiltersType>>(null);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
    onOpen();
  };

  const handleReset = useCallback(() => {
    setSelectedCategory(null);
    clearFilters();
    onClose();
  }, [clearFilters, onClose]);

  const handleIncludeUnassignedChange = useCallback(
    (checked: boolean) => {
      setFilters('includeUnassigned', checked);
    },
    [setFilters],
  );

  const totalFilterCount = useMemo(
    () => Object.values(filterCategories).reduce((acc, category) => acc + category.count, 0),
    [filterCategories],
  );

  const canReset = useMemo(() => totalFilterCount > 0, [totalFilterCount]);

  const renderSelectedFilterOptions = useMemo(() => {
    if (!selectedCategory) return null;

    const optionList = filtersOptions[selectedCategory];
    const selectedIds = filters[selectedCategory];

    return (
      <Box
        sx={{
          width: { xs: 1, sm: 300 },
          height: { xs: 1, sm: 500 },
          p: { xs: 0, sm: 2 },
          display: selectedCategory ? 'block' : 'none',
          overflow: 'auto',
          mt: { xs: -1, sm: 0 },
        }}
      >
        {!isMobile && (
          <>
            <Typography variant='subtitle1' sx={{ mb: 1 }}>
              {t_management(filterCategories[selectedCategory].labelKey)}
            </Typography>
            <Divider sx={{ mb: 1 }} />
          </>
        )}
        <List disablePadding>
          {selectedCategory === ChatFiltersType.Users && (
            <>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={(e) => {
                    e.preventDefault();
                    handleIncludeUnassignedChange(!filters.includeUnassigned);
                  }}
                  sx={{ display: 'flex', justifyContent: 'space-between', px: { xs: 0, sm: 2 } }}
                  selected={false}
                >
                  <TooltipChip
                    item={{ label: t_chat('unassigned'), value: t_chat('unassigned') }}
                    isSelected={filters.includeUnassigned}
                  />
                  <Checkbox checked={Boolean(filters.includeUnassigned)} />
                </ListItemButton>
              </ListItem>
              <Divider sx={{ my: 1 }} />
            </>
          )}
          <ChatFilterField
            filterType={selectedCategory}
            optionList={optionList}
            selectedIds={selectedIds}
            handleSelectEvent={(id) => {
              const newSelected = selectedIds.includes(id)
                ? selectedIds.filter((item) => item !== id)
                : [...selectedIds, id];
              setFilters(selectedCategory, newSelected);
            }}
          />
        </List>
      </Box>
    );
  }, [
    selectedCategory,
    filters,
    filtersOptions,
    filterCategories,
    isMobile,
    t_management,
    t_chat,
    handleIncludeUnassignedChange,
    setFilters,
  ]);

  const renderFiltersButton = (
    <Button
      color='inherit'
      onClick={handleClick}
      size='small'
      endIcon={
        <Badge color='error' badgeContent={totalFilterCount}>
          <FilterListIcon />
        </Badge>
      }
      disabled={disabled}
      sx={{ fontSize: 12 }}
      disableRipple
    >
      {t_management('filters')}
    </Button>
  );

  const renderCategoryList = (isAccordion = false) =>
    Object.entries(filterCategories).map(([categoryKey, category]) => {
      const isSelected = selectedCategory === categoryKey;

      const filterCategoryLabel = (
        <>
          <ListItemText primary={t_management(category.labelKey)} />
          {category.count > 0 && (
            <Chip
              size='small'
              label={category.count}
              sx={{ backgroundColor: 'primary.main', color: 'primary.contrastText' }}
            />
          )}
          {!isAccordion && <KeyboardArrowRightIcon />}
        </>
      );

      return isAccordion ? (
        <Accordion
          key={categoryKey}
          expanded={isSelected}
          onChange={(_, expanded) =>
            setSelectedCategory(expanded ? (categoryKey as ChatFiltersType) : null)
          }
          slotProps={{
            transition: {
              unmountOnExit: true,
            },
          }}
        >
          <AccordionSummary>{filterCategoryLabel}</AccordionSummary>
          <AccordionDetails>{isSelected && renderSelectedFilterOptions}</AccordionDetails>
        </Accordion>
      ) : (
        <ListItem key={categoryKey} disablePadding>
          <ListItemButton
            selected={isSelected}
            onClick={() => setSelectedCategory(categoryKey as ChatFiltersType)}
          >
            {filterCategoryLabel}
          </ListItemButton>
        </ListItem>
      );
    });

  const renderDrawerFilters = (
    <Drawer
      anchor='bottom'
      open={isOpen}
      PaperProps={{ sx: { height: 1, display: 'flex', flexDirection: 'column' } }}
    >
      <Stack px={2} py={1} direction='row' alignItems='center' justifyContent='space-between'>
        <Typography fontWeight='bold'>{t_management('filters')}</Typography>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Stack>
      <List sx={{ flexGrow: 1, overflowY: 'auto' }}>{renderCategoryList(true)}</List>
      <Button fullWidth color='inherit' onClick={handleReset} disabled={!canReset} sx={{ py: 4 }}>
        {t_management('clearAll')}
      </Button>
    </Drawer>
  );

  const renderPopoverFilters = (
    <CustomPopover
      open={isOpen}
      anchorEl={anchorEl}
      onClose={onClose}
      sx={{ width: 'auto', height: 500 }}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
    >
      <Stack direction='row' sx={{ height: 1 }}>
        <Box sx={{ width: 300, borderRight: 1, borderColor: 'divider' }}>
          <List>{renderCategoryList()}</List>
          <Button
            fullWidth
            color='inherit'
            onClick={handleReset}
            disabled={!canReset}
            sx={{ mb: 1, mx: 2, width: 'auto', position: 'absolute', bottom: 0 }}
          >
            {t_management('clearAll')}
          </Button>
        </Box>
        {selectedCategory && renderSelectedFilterOptions}
      </Stack>
    </CustomPopover>
  );

  return (
    <>
      {renderFiltersButton}
      {isMobile ? renderDrawerFilters : renderPopoverFilters}
    </>
  );
});
