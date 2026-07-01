import { useRef, type ReactNode, forwardRef, type Ref, useState } from 'react';

import { useDndMonitor, useDraggable, DndContext, MouseSensor, useSensor } from '@dnd-kit/core';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import { CSS, type Coordinates } from '@dnd-kit/utilities';
import ClearIcon from '@mui/icons-material/Clear';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  type ButtonProps,
  type PaperProps,
  type DialogProps,
  type SxProps,
} from '@mui/material';
import SimpleBar from 'simplebar-react';

import { TitleCaption, TooltipIconButton } from '~/common/components';
import { useResponsive } from '~/common/hooks';
import { useTranslation } from '~/locales/hooks';
import { uniqueKey } from '~/utils';

export type DraggableDialogProps = Omit<DialogProps, 'onClose' | 'fullScreen'> & {
  onClose: () => void;
  onConfirm?: () => void;
  title?: string;
  subTitle?: string;
  titleAction?: ReactNode;
  isLoading?: boolean;
  confirmationText?: string;
  cancelText?: string;
  hideConfirm?: boolean;
  hideCancel?: boolean;
  confirmButtonProps?: ButtonProps;
  actions?: ReactNode;
  heightFixed?: boolean;
  confirmButton?: ReactNode;
  contentSx?: SxProps;
  contentElWithFit?: boolean;
};

export const DraggableDialog = (props: DraggableDialogProps) => {
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: { distance: 3 },
  });

  return (
    <DndContext modifiers={[restrictToWindowEdges]} sensors={[mouseSensor]}>
      <DraggableDialogComponent {...props} />
    </DndContext>
  );
};

const PaperComponent = forwardRef(function PaperComponent(
  props: PaperProps,
  ref: Ref<HTMLDivElement>,
) {
  return <Paper ref={ref} {...props} />;
});

const DraggableDialogComponent = ({
  onClose,
  onConfirm,
  children,
  title,
  subTitle,
  titleAction,
  confirmationText,
  cancelText,
  isLoading,
  hideConfirm,
  hideCancel,
  confirmButtonProps,
  actions,
  heightFixed,
  confirmButton,
  sx,
  contentSx,
  contentElWithFit = true,
  ...rest
}: DraggableDialogProps) => {
  const defaultCoordinates = { x: 0, y: 0 };

  const { t } = useTranslation();

  const [{ x, y }, setCoordinates] = useState<Coordinates>(defaultCoordinates);
  const id = useRef<string>(uniqueKey('draggable'));
  const { isMobile } = useResponsive();

  const { listeners, setNodeRef, transform } = useDraggable({ id: id.current });

  useDndMonitor({
    onDragEnd: ({ delta }) => {
      setCoordinates(({ x, y }) => ({ x: x + delta.x, y: y + delta.y }));
    },
  });

  return (
    <Dialog
      onClose={onClose}
      PaperComponent={PaperComponent}
      PaperProps={{
        ref: setNodeRef,
        sx: {
          overflow: 'hidden',
          transform: CSS.Translate.toString(transform),
          top: y,
          left: x,
          minWidth: isMobile ? '96dvw' : '500px',
          maxWidth: isMobile ? '96dvw' : '900px',
        },
        id: id.current,
      }}
      maxWidth={false}
      hideBackdrop
      sx={{ zIndex: (theme) => theme.zIndex.modal - 1, ...sx }}
      {...rest}
    >
      <DialogTitle sx={{ cursor: 'move', backgroundColor: '#eee', px: 2, py: 0 }} {...listeners}>
        <Stack direction='row' justifyContent='space-between' alignItems='center'>
          <DragHandleIcon fontSize='small' color='secondary' />
          <TooltipIconButton
            title={t('actions.close')}
            onClick={onClose}
            icon={<ClearIcon fontSize='small' />}
          />
        </Stack>
      </DialogTitle>

      <DialogContent
        sx={{
          p: isMobile ? 0.5 : 4,
          overflow: heightFixed ? 'hidden' : 'auto',
          maxHeight: 'calc(100vh - 50px)',
          ...contentSx,
          width: '100%',
        }}
      >
        <SimpleBar
          style={{
            maxHeight: '100%',
            width: '100%',
            paddingTop: '20px',
            position: 'relative',
            ...(heightFixed && { height: '100%' }),
          }}
          classNames={{
            contentEl: contentElWithFit ? 'simplebar-content w-fit' : 'simplebar-content',
          }}
        >
          {title && (
            <TitleCaption
              primary={title}
              secondary={subTitle}
              titleProps={{ fontWeight: 'normal' }}
              mb={2}
            >
              {titleAction}
            </TitleCaption>
          )}
          {children}
        </SimpleBar>
      </DialogContent>

      <DialogActions sx={{ height: 52.5 }}>
        {isLoading && <CircularProgress size='1rem' sx={{ mr: 'auto', ml: '1rem' }} />}
        {!hideCancel && (
          <Button onClick={onClose} color='secondary'>
            {cancelText || t('actions.close')}
          </Button>
        )}
        {!hideConfirm &&
          (confirmButton ? (
            confirmButton
          ) : (
            <Button onClick={onConfirm} disabled={isLoading} {...confirmButtonProps}>
              {confirmationText || t('actions.save')}
            </Button>
          ))}
        {actions}
      </DialogActions>
    </Dialog>
  );
};
