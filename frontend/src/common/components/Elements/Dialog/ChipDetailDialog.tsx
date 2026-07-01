import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  Divider,
  Box,
} from '@mui/material';

import { useTranslation } from '~/locales/hooks';

type ChipDetailDialogProps<T> = {
  title?: string;
  open: boolean;
  onClose: () => void;
  getChipLabel: (item: T) => string;
  items: T[];
};

export const ChipDetailDialog = <T,>({
  title,
  open,
  onClose,
  getChipLabel,
  items,
}: ChipDetailDialogProps<T>) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth='xs' closeAfterTransition={true}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack width='100%' direction='column' gap={1} alignItems='center' flexWrap='wrap'>
          {items.map((item, index) => (
            <Box width='100%' key={index}>
              <Typography variant='subtitle1' sx={{ mb: 1 }}>
                {getChipLabel(item)}
              </Typography>
              <Divider sx={{ width: '100%', mb: 1 }} />
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('actions.cancel')}</Button>
      </DialogActions>
    </Dialog>
  );
};
