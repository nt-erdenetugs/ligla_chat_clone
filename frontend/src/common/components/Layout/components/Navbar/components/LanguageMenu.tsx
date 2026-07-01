import { useState, useMemo, type MouseEvent } from 'react';

import LanguageIcon from '@mui/icons-material/Language';
import { ListItemText, Menu, MenuItem, Typography } from '@mui/material';

import { languages } from '~/locales/config';
import { useTranslation } from '~/locales/hooks';

import { NavItem, type NavItemProps } from '..';

const DEFAULT_LOCALE = 'en';

export const LanguageMenu = ({ showLabel }: Pick<NavItemProps, 'showLabel'>) => {
  const { t, i18n } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<Nullable<HTMLElement>>(null);

  const handleOpenMenu = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleChangeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    handleCloseMenu();
  };

  const currentLanguageLabel = useMemo(() => {
    return (
      languages.find((lng) => lng.key === i18n.language)?.label ??
      languages.find((lng) => lng.key === DEFAULT_LOCALE)?.label ??
      DEFAULT_LOCALE
    );
  }, [i18n.language]);

  return (
    <>
      <NavItem
        icon={<LanguageIcon fontSize='medium' color='secondary' />}
        label={
          <Typography textTransform='initial' color='secondary'>
            {currentLanguageLabel}
          </Typography>
        }
        tooltip={t('sidebar.language')}
        showLabel={showLabel}
        onClick={handleOpenMenu}
      />

      <Menu
        id='language-menu'
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        keepMounted
      >
        {languages.map((lng) => (
          <MenuItem
            key={lng.key}
            selected={lng.key === i18n.language}
            onClick={() => handleChangeLanguage(lng.key)}
          >
            <ListItemText>{lng.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};
