import CloseIcon from '@mui/icons-material/Close';
import {
  AppBar,
  Dialog,
  DialogContent,
  type DialogProps,
  IconButton,
  Toolbar,
  Typography,
} from '@mui/material';

export type FullScreenDialogProps = Partial<Omit<DialogProps, 'title'>> & {
  open?: boolean;
  onClose: () => void;
  title?: string | React.ReactNode;
  titleIcon?: React.ReactNode;
  showCloseIcon?: boolean;
  children?: React.ReactNode;
};

const isTitleComponent = (title: string | React.ReactNode): title is React.ReactNode => {
  return typeof title !== 'string' && !!title;
};

export const FullScreenDialog = ({
  open = true,
  onClose,
  title,
  titleIcon,
  showCloseIcon = true,
  children,
  ...rest
}: FullScreenDialogProps) => {
  return (
    <Dialog open={open} fullScreen onClose={onClose} {...rest}>
      <AppBar sx={{ position: 'relative' }}>
        <Toolbar>
          {titleIcon}

          {isTitleComponent(title) ? (
            <>{title}</>
          ) : (
            <Typography sx={{ ml: 2, flex: 1 }} variant='h6' component='div'>
              {title}
            </Typography>
          )}

          {showCloseIcon && (
            <IconButton edge='start' color='inherit' onClick={onClose} aria-label='close'>
              <CloseIcon />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      <DialogContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </DialogContent>
    </Dialog>
  );
};
