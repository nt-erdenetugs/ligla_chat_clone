import { useMemo } from 'react';

import AddToHomeIcon from '@mui/icons-material/AddToHomeScreen';
import ShareIcon from '@mui/icons-material/IosShare';
import SafariIcon from '@mui/icons-material/Public';
import { Typography, List, ListItem, ListItemText, ListItemIcon } from '@mui/material';

import { useTranslation } from '~/locales/hooks';

import { IOS_INSTALL_STEPS } from '../constants';

const iconMap = {
  SafariIcon: <SafariIcon fontSize='small' />,
  ShareIcon: <ShareIcon fontSize='small' />,
  AddToHomeIcon: <AddToHomeIcon fontSize='small' />,
};

export const IOSInstallInstructions = () => {
  const { t_toasts } = useTranslation();

  const steps = useMemo(
    () =>
      IOS_INSTALL_STEPS.map((step) => ({
        icon: iconMap[step.icon],
        text: t_toasts(step.text),
      })),
    [t_toasts],
  );

  return (
    <>
      <Typography variant='body2' sx={{ mb: 1 }}>
        {t_toasts('pwa.installInstructionsIOS')}
      </Typography>
      <List dense>
        {steps.map((step, index) => (
          <ListItem key={index} disableGutters>
            <ListItemIcon sx={{ minWidth: 32 }}>{step.icon}</ListItemIcon>
            <ListItemText primary={step.text} />
          </ListItem>
        ))}
      </List>
    </>
  );
};
