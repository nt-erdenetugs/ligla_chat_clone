import { useRef, useCallback } from 'react';

import {
  Box,
  Checkbox,
  DialogContent,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
} from '@mui/material';
import { alpha } from '@mui/material/styles';

import { FullScreenDialog } from '~/common/components';
import { useTranslation } from '~/locales/hooks';

interface MobileSelectModalProps<T> {
  title?: string;
  options: T[];
  selectedOptions?: T[];
  isEnabled?: boolean;
  isDialogOpen: boolean;
  searchValue: string;
  setSearchValue: (value: string) => void;
  enableEnterAdd?: boolean;
  getOptionId: (option: T) => string;
  getOptionLabel?: (option: T) => string;
  onToggle?: (option: T) => void | Promise<void>;
  onClose?: () => void;
}

export const MobileSelectModal = <T,>({
  title,
  options,
  isEnabled,
  isDialogOpen,
  searchValue,
  selectedOptions = [],
  setSearchValue,
  getOptionId,
  getOptionLabel = (option: any) => String(option?.name ?? option?.label ?? option),
  onToggle,
  onClose,
  enableEnterAdd = false,
}: MobileSelectModalProps<T>) => {
  const { t_chat } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleScroll = useCallback(() => {
    if (inputRef.current) inputRef.current.blur();
  }, []);

  const handleInteraction = useCallback(() => {
    if (inputRef.current) inputRef.current.blur();
  }, []);

  // TODO: paginated scrolling and search
  const filterText = (option: T) =>
    getOptionLabel(option).toLowerCase().includes(searchValue.toLowerCase());

  const isSelected = (option: T) =>
    selectedOptions.some((selectedOption) => getOptionId(selectedOption) === getOptionId(option));

  return (
    <FullScreenDialog
      open={isDialogOpen}
      onClose={() => onClose?.()}
      title={title ?? ''}
      sx={{ height: '100dvh' }}
    >
      <Box
        sx={(theme) => ({
          marginLeft: `-${theme.spacing(3)}`,
          marginRight: `-${theme.spacing(3)}`,
          height: '100%',
        })}
      >
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 0 }}>
          <Box sx={{ pl: 3, pr: 3, pt: 1, pb: 1 }}>
            <TextField
              placeholder={t_chat('chatTags.enterTagValue')}
              disabled={!isEnabled}
              value={searchValue}
              fullWidth
              inputRef={inputRef}
              autoFocus
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => {
                if (!enableEnterAdd) return;
                if (e.key !== 'Enter') return;
                e.preventDefault();

                if (!searchValue || !isEnabled) return;
                const existedOption = options.some(
                  (option) =>
                    getOptionLabel(option) === searchValue || getOptionId(option) === searchValue,
                );
                if (existedOption) return;
                const newOption = { label: searchValue, value: searchValue } as T;
                onToggle?.(newOption);
                setSearchValue('');
              }}
              slotProps={{
                input: {
                  sx: { height: '48px', fontSize: 14, borderRadius: 2 },
                },
              }}
            />
          </Box>
          <Box
            sx={{ flexGrow: 1, overflow: 'auto' }}
            onScroll={handleScroll}
            onTouchStart={handleInteraction}
            onPointerDown={handleInteraction}
            onMouseDown={handleInteraction}
          >
            <List dense sx={{ marginTop: '10', width: '100%', maxHeight: 'vh', overflow: 'auto' }}>
              {options.filter(filterText).map((option) => {
                const checked = isSelected(option);
                return (
                  <ListItem key={getOptionId(option)} disablePadding>
                    <ListItemButton
                      onClick={() => onToggle?.(option)}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: checked
                          ? (t) => alpha(t.palette.primary.main, 0.06)
                          : 'transparent',
                        '&:hover': {
                          backgroundColor: checked
                            ? (t) => alpha(t.palette.primary.main, 0.12)
                            : (t) => alpha(t.palette.grey[300], 0.3),
                        },
                      }}
                    >
                      <Checkbox
                        edge='start'
                        checked={checked}
                        tabIndex={-1}
                        disableRipple
                        sx={{ pl: 2.1 }}
                      />
                      <ListItemText primary={getOptionLabel(option)} />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Box>
        </DialogContent>
      </Box>
    </FullScreenDialog>
  );
};

MobileSelectModal.displayName = 'MobileSelectModal';
