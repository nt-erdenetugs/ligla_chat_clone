import { useMemo, memo } from 'react';

import {
  Box,
  CircularProgress,
  Typography,
  FormControl,
  Select,
  MenuItem,
  type SelectChangeEvent,
} from '@mui/material';

import {
  AddressingDoneStatuses,
  adminManagerRoles,
  AllChatStatus,
  getChatStatusLabel,
} from '~/common/constants';
import { useAuthContext } from '~/context/AuthContext';
import { ChatStatus as ChatStatusType } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';

function getStatusColor(status: ChatStatusType): string {
  switch (status) {
    case ChatStatusType.Pending:
      return '#ff9800';
    case ChatStatusType.Addressing:
      return '#2196f3';
    case ChatStatusType.Done:
      return '#4caf50';
    default:
      return '#9e9e9e';
  }
}

type ChatStatusProps = {
  assignedUserId: string;
  chatStatus: ChatStatusType;
  chatId: string;
  isChangingChatStatus?: boolean;
  changeChatStatus: (chatId: string, status: ChatStatusType) => void;
};

export const ChatStatus = memo(function ChatStatus({
  assignedUserId,
  chatStatus,
  chatId,
  isChangingChatStatus = false,
  changeChatStatus,
}: ChatStatusProps) {
  const { user } = useAuthContext();
  const { t_chat } = useTranslation();

  const filteredChatStatus = useMemo(() => {
    if (!chatStatus) return AllChatStatus;

    return chatStatus === ChatStatusType.Pending ? AllChatStatus : AddressingDoneStatuses;
  }, [chatStatus]);

  const chatStatusOptions = useMemo(
    () =>
      filteredChatStatus.map((status) => ({
        label: t_chat(`status.${getChatStatusLabel(status)}`),
        value: status,
      })),
    [filteredChatStatus, t_chat],
  );

  if (!user) return null;

  const handleChangeStatus = (status: ChatStatusType) => {
    changeChatStatus(chatId, status);
  };

  const isUserAssigned = user.id === assignedUserId;
  const hasHigherPrivileges = adminManagerRoles.includes(user.roleType);
  const isEnabled = (isUserAssigned || hasHigherPrivileges) && !isChangingChatStatus;

  const handleSelectChange = (event: SelectChangeEvent<ChatStatusType>) => {
    handleChangeStatus(event.target.value);
  };

  return (
    <FormControl size='small' sx={{ minWidth: { xs: 100, sm: 150 } }}>
      <Select
        value={chatStatus}
        onChange={handleSelectChange}
        disabled={!isEnabled}
        displayEmpty
        renderValue={(selectedValue) => {
          const selectedOption = chatStatusOptions.find((opt) => opt.value === selectedValue);
          const color = getStatusColor(selectedValue);
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {isChangingChatStatus ? (
                <CircularProgress size={10} />
              ) : (
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: color,
                    flexShrink: 0,
                  }}
                />
              )}
              <Typography variant='body2' fontSize={12} noWrap>
                {selectedOption?.label || ''}
              </Typography>
            </Box>
          );
        }}
        sx={{
          borderRadius: 2,
          fontSize: 12,
          '.MuiSelect-select': {
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: isEnabled ? 'grey.300' : 'grey.200',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: isEnabled ? 'grey.400' : 'grey.200',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: isEnabled ? 'primary.main' : 'grey.200',
          },
        }}
        MenuProps={{
          sx: {
            '.MuiMenuItem-root': {
              fontSize: 12,
              padding: '4px 8px',
            },
          },
        }}
      >
        {chatStatusOptions.map((option) => {
          const color = getStatusColor(option.value);
          return (
            <MenuItem key={option.value} value={option.value}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  width: '100%',
                }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: color,
                    flexShrink: 0,
                  }}
                />
                <Typography variant='body2' fontSize={12}>
                  {option.label}
                </Typography>
              </Box>
            </MenuItem>
          );
        })}
      </Select>
    </FormControl>
  );
});

ChatStatus.displayName = 'ChatStatus';
