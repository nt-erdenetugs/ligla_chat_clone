import { useState } from 'react';

import FilterListIcon from '@mui/icons-material/FilterList';
import { Menu, Stack } from '@mui/material';

import { CheckboxGroup, type CheckboxGroupProps, TooltipIconButton } from '~/common/components';
import { useTranslation } from '~/locales/hooks';

type FilterCategoriesMenuProps = {
  options: CheckboxGroupProps['options'];
  onChange: CheckboxGroupProps['onChange'];
  value?: CheckboxGroupProps['value'];
};

export const FilterCategoriesMenu = ({ options, onChange, value }: FilterCategoriesMenuProps) => {
  const { t_management } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  return (
    <>
      <TooltipIconButton
        icon={<FilterListIcon />}
        title={t_management('chatAssignFilters.categories')}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        disabled={!value || options.length === 0}
      />

      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <Stack p='2px 16px'>
          <CheckboxGroup
            value={value}
            options={options}
            onChange={onChange}
            label={t_management('chatAssignFilters.allCategories')}
            showSelectAll
          />
        </Stack>
      </Menu>
    </>
  );
};
