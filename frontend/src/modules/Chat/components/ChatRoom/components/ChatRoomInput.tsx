import React, { useMemo, useState, memo, useRef, useEffect } from 'react';

import AddIcon from '@mui/icons-material/Add';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import LinkIcon from '@mui/icons-material/Link';
import SendIcon from '@mui/icons-material/Send';
import {
  Box,
  TextField,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { useSnackbar } from 'notistack';

import { CHAT_FILE_ACCEPTED_LIST } from '~/common/constants';
import { useResponsive, useChatFileValidation } from '~/common/hooks';
import { useAuthContext } from '~/context/AuthContext';
import { ChatStatus, UserRoleType } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { type IChat, type IChatMessage, type ID } from '~/modules/Chat';
import { useChatRoomContext } from '~/modules/Chat';
import { useChatFileContext } from '~/modules/Chat/context/ChatRoom/ChatFileContext';
import { useChatFileUpload } from '~/modules/Chat/hooks/useChatFileUpload';
import { useChatKeyboardControl } from '~/modules/Chat/hooks/useChatKeyboardControl';
import { type IUser } from '~/modules/Users/types/user';
import { getFileType } from '~/utils';

import { AttachmentStagingArea } from './AttachmentStagingArea';

const MESSAGE_UTF16_MAX_LENGTH = 5000;
const DEFAULT_PLACEHOLDER = 'enterMessage';
const DEFAULT_PLACEHOLDER_MOBILE = 'enterMessageOnMobile';

interface ChatRoomInputProps {
  isUserBlocked?: boolean;
  targetChatId: string;
  message: string;
  isMessageSending: boolean;
  assignedUserId: string;
  assignedUser: Nullable<IUser>;
  chatStatus: ChatStatus;
  setMessage: (message: string) => void;
  sendMessage: (chatId: ID, text: string) => Promise<Optional<IChatMessage>>;
  sendUploadLink: (input: { chatId: string }) => Promise<Optional<IChatMessage>>;
  sendFileUploadedMessage: (input: {
    chatId: string;
    fileName: string;
    altText?: string;
  }) => Promise<Optional<IChatMessage>>;
  sendMessageToLigla: (chatId: ID, messageId: ID) => Promise<Optional<IChatMessage>>;
  handleChatUpdate: (chat: IChat) => void;
}

export const ChatRoomInput = memo(
  function ChatRoomInput({
    isUserBlocked = false,
    targetChatId,
    message,
    isMessageSending,
    assignedUserId,
    assignedUser,
    chatStatus,
    setMessage,
    sendMessage,
    sendUploadLink,
    sendFileUploadedMessage,
    sendMessageToLigla,
    handleChatUpdate,
  }: ChatRoomInputProps) {
    const { user } = useAuthContext();
    const inputRef = useRef<Nullable<HTMLTextAreaElement>>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { isDesktop } = useResponsive();
    const { t_chat, t_toasts } = useTranslation();
    const { enqueueSnackbar } = useSnackbar();
    const { isChatFileUploadEnabled, isFileUploadConfigured } = useChatRoomContext();
    const {
      pendingFiles,
      addFiles,
      clearFiles,
      isShareUploadLinkStaged,
      setIsShareUploadLinkStaged,
      addUploadingChatId,
      removeUploadingChatId,
      openUploadDialog,
    } = useChatFileContext();
    const uploadChatFile = useChatFileUpload();
    const { validateFiles } = useChatFileValidation();

    const { onChatInputClick, setSuppressBlur } = useChatKeyboardControl({
      inputRef,
      isDesktop,
    });

    const [placeholder, setPlaceholder] = useState(DEFAULT_PLACEHOLDER);
    const [error, setError] = useState('');
    const [attachMenuAnchor, setAttachMenuAnchor] = useState<null | HTMLElement>(null);
    const [isSendingLink, setIsSendingLink] = useState(false);

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setError('');
      setMessage(e.target.value);
    };

    const validateChat = (
      message: string,
      files: File[],
      hasStagedShareUploadLink: boolean,
    ): { valid: boolean; error: string } => {
      if (files.length === 0 && !hasStagedShareUploadLink && message.trim() === '') {
        return { valid: false, error: t_chat('msgCantBeEmpty') };
      }

      if (message.length > MESSAGE_UTF16_MAX_LENGTH) {
        return { valid: false, error: t_chat('msgExceedsCharLimit') };
      }

      return { valid: true, error: '' };
    };

    const normalizeMessage = (rawMessage: string) => {
      return rawMessage.trim();
    };

    const prepareUserMessage = (
      rawMessage: string,
      files: File[],
      hasStagedShareUploadLink: boolean,
    ) => {
      const normalizedMessage = normalizeMessage(rawMessage);
      const { valid, error } = validateChat(normalizedMessage, files, hasStagedShareUploadLink);
      if (!valid) {
        setError(error);
        throw new Error(error);
      }
      return normalizedMessage;
    };

    const focusInput = () => requestAnimationFrame(() => inputRef.current?.focus());
    const resetInput = () => {
      focusInput();
      setMessage('');
    };

    const sendChatMessage = async (text: string): Promise<{ success: boolean }> => {
      if (!targetChatId || !user) {
        throw new Error('Missing chat or user context');
      }

      try {
        setSuppressBlur(true);

        const newMessage = await sendMessage(targetChatId, text);
        if (!newMessage) {
          throw new Error('Message did not returned from sendMessage');
        }

        requestAnimationFrame(() => inputRef.current?.focus());
        setMessage('');

        // Add optimistic message - scroll will be triggered by useChatScroll hook
        const optimisticMessage = { ...newMessage, isRetrying: false, isDelivering: true };

        handleChatUpdate({
          id: targetChatId,
          latestMessageTimestamp: new Date(optimisticMessage.createdAt),
          chatMessages: [optimisticMessage],
        } as IChat);

        await sendMessageToLigla(targetChatId, newMessage.id);
        return { success: true };
      } catch (err) {
        const fallbackError = t_chat('errorWhileSendingMsg');
        const message = err instanceof Error ? err.message : fallbackError;
        setError(message);
        throw err instanceof Error ? err : new Error(fallbackError);
      }
    };

    const sendChatFiles = async () => {
      const hasFiles = pendingFiles.length > 0;
      if (!hasFiles) return;

      const filesToUpload = [...pendingFiles];
      addUploadingChatId(targetChatId);
      clearFiles();

      try {
        const failedFiles: File[] = [];

        const tasks = filesToUpload.map(async (file) => {
          try {
            await uploadChatFile(targetChatId, file);

            const fileType = getFileType(file.name);
            const fileTypeToken = fileType ?? 'FILE';
            const sentMessage = await sendFileUploadedMessage({
              chatId: targetChatId,
              fileName: file.name,
              altText: fileTypeToken,
            });

            if (sentMessage) {
              handleChatUpdate({
                id: targetChatId,
                latestMessageTimestamp: sentMessage.createdAt,
                chatMessages: [{ ...sentMessage }],
              } as IChat);
            }
          } catch (e) {
            console.error('Failed to upload file', file.name, e);
            failedFiles.push(file);
          }
        });

        await Promise.all(tasks);

        if (failedFiles.length > 0) {
          addFiles(failedFiles);
          enqueueSnackbar(t_toasts('chat.error.file.upload'), { variant: 'error' });
        }
      } finally {
        removeUploadingChatId(targetChatId);
      }
    };

    const handleSend = async () => {
      try {
        const normalizedMessage = prepareUserMessage(
          message,
          pendingFiles,
          isShareUploadLinkStaged,
        );

        const hasText = normalizedMessage !== '';
        if (hasText) {
          await sendChatMessage(normalizedMessage);
          resetInput();
        }
        await Promise.all([sendChatFiles(), sendStagedShareUploadLink()]);
      } catch {
        focusInput();
        setError(t_chat('errorWhileSendingMsg'));
        setTimeout(() => inputRef.current?.focus(), 50);
      } finally {
        setSuppressBlur(false);
      }
    };

    const handleKeyPress = (event: React.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        handleSend();
      }
    };

    const handleAttachClick = (event: React.MouseEvent<HTMLElement>) => {
      setAttachMenuAnchor(event.currentTarget);
    };

    const handleCloseAttachMenu = () => {
      setAttachMenuAnchor(null);
    };

    const handleAttachFileClick = () => {
      handleCloseAttachMenu();
      fileInputRef.current?.click();
    };

    const handleViewUploadedFilesClick = () => {
      handleCloseAttachMenu();
      openUploadDialog();
    };

    const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files ?? []);

      const validFiles = await validateFiles(selectedFiles);
      if (validFiles.length > 0) {
        addFiles(validFiles);
      }
      event.target.value = '';
    };

    const handleShareUploadLink = () => {
      handleCloseAttachMenu();
      if (!isEnabled || isSendingLink) return;
      setIsShareUploadLinkStaged(true);
    };

    const sendStagedShareUploadLink = async () => {
      if (!isShareUploadLinkStaged || isSendingLink) return;

      setIsSendingLink(true);
      setIsShareUploadLinkStaged(false);

      try {
        const sentMessage = await sendUploadLink({ chatId: targetChatId });

        if (!sentMessage) {
          throw new Error(t_toasts('chat.error.uploadLink.failed'));
        }

        handleChatUpdate({
          id: targetChatId,
          latestMessageTimestamp: new Date(sentMessage.createdAt),
          chatMessages: [{ ...sentMessage }],
        } as IChat);
      } catch (error) {
        console.error('Failed to send staged upload link', error);

        const fallbackError = t_toasts('chat.error.uploadLink.failed');
        const message = error instanceof Error ? error.message : fallbackError;

        setIsShareUploadLinkStaged(true);
        enqueueSnackbar(message, { variant: 'error' });
      } finally {
        setIsSendingLink(false);
      }
    };

    // NOTE: Input enabled for assignee or admin-operator/manager-operator if chat is assigned
    const isEnabled = useMemo(() => {
      if (!user || !targetChatId) return false;

      const isDoneChat = chatStatus === ChatStatus.Done;

      if (isDoneChat) {
        setPlaceholder('cantSendMsgToCompletedChat');
        return false;
      }

      const isUserAssigned = user.id === assignedUserId;
      const isChatHasAssignee = assignedUser;
      const hasHigherPrivileges =
        [UserRoleType.AdminOperator, UserRoleType.ManagerOperator].includes(
          user.roleType as UserRoleType,
        ) && isChatHasAssignee;

      const enabled = isUserAssigned || hasHigherPrivileges;

      if (!enabled) {
        setPlaceholder('youDontHavePermission');
        return false;
      }

      if (isUserBlocked) {
        setPlaceholder('blockedByUser');
        return false;
      }

      setPlaceholder(isDesktop ? DEFAULT_PLACEHOLDER : DEFAULT_PLACEHOLDER_MOBILE);
      return true;
    }, [user, targetChatId, chatStatus, assignedUserId, assignedUser, isUserBlocked, isDesktop]);

    useEffect(() => {
      clearFiles();
      setIsShareUploadLinkStaged(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- only want to react to targetChatId. Adding clearFiles to deps would trigger this effect whenever the clearFiles reference changes
    }, [targetChatId]);

    useEffect(() => {
      if (isEnabled) requestAnimationFrame(() => inputRef.current?.focus());
    }, [isEnabled]);

    const canSend =
      isEnabled &&
      (!!message || pendingFiles.length > 0 || isShareUploadLinkStaged) &&
      !isMessageSending;

    return (
      <>
        <Box
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          onClick={() => {
            onChatInputClick();
          }}
          sx={{
            width: '100%',
            minHeight: 'fit-content',
            bgcolor: 'white',
            borderLeft: '1px solid #e0e0e0',
          }}
        >
          {(pendingFiles.length > 0 || isShareUploadLinkStaged) && <AttachmentStagingArea />}

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px',
              // Add bottom padding so the ChatRoomInput isn't cut off by mobile screen corners on PWA.
              pb: { xs: 4, sm: 1 },
            }}
          >
            {isFileUploadConfigured && (
              <>
                <IconButton
                  size='small'
                  onClick={(event) => {
                    event.stopPropagation();
                    handleAttachClick(event);
                  }}
                  color='primary'
                  sx={{
                    border: '1px solid',
                    borderColor: 'primary.main',
                    borderRadius: '50%',
                  }}
                >
                  <AddIcon fontSize='small' />
                </IconButton>
                <Menu
                  anchorEl={attachMenuAnchor}
                  open={Boolean(attachMenuAnchor)}
                  onClose={handleCloseAttachMenu}
                  anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                  }}
                  transformOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                  }}
                >
                  <MenuItem
                    onClick={handleAttachFileClick}
                    disabled={!isChatFileUploadEnabled || !isEnabled}
                  >
                    <ListItemIcon>
                      <AttachFileIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText>{t_chat('fileUpload.attachFile')}</ListItemText>
                  </MenuItem>
                  <MenuItem onClick={handleViewUploadedFilesClick}>
                    <ListItemIcon>
                      <FolderOpenIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText>{t_chat('fileUpload.viewUploadedFiles')}</ListItemText>
                  </MenuItem>
                  <MenuItem
                    onClick={handleShareUploadLink}
                    disabled={
                      !isChatFileUploadEnabled ||
                      !isEnabled ||
                      isMessageSending ||
                      isSendingLink ||
                      isShareUploadLinkStaged
                    }
                  >
                    <ListItemIcon>
                      <LinkIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText>{t_chat('fileUpload.shareUploadLink')}</ListItemText>
                  </MenuItem>
                </Menu>
              </>
            )}
            <TextField
              draggable={false}
              inputRef={inputRef}
              multiline
              maxRows={5}
              variant='outlined'
              placeholder={t_chat(placeholder)}
              value={message}
              onChange={handleOnChange}
              onKeyDown={handleKeyPress}
              error={!!error}
              helperText={error}
              disabled={!isEnabled}
              sx={{
                flexGrow: 1,
                '& .MuiOutlinedInput-root': {
                  bgcolor: isEnabled ? '#F5F5F5' : 'white',
                  borderRadius: 3,
                  border: 'none',
                  padding: '8px 8px 8px 20px',
                  minHeight: '40px',
                  fontSize: '14px',
                  '&:hover *': {
                    cursor: isEnabled ? 'text' : 'not-allowed',
                  },
                },
              }}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                      position='end'
                      sx={{
                        '&:hover *': {
                          cursor: canSend ? 'pointer !important' : 'not-allowed',
                        },
                      }}
                    >
                      <IconButton
                        draggable={false}
                        onDragStart={(e) => e.preventDefault()}
                        size='medium'
                        onMouseDown={(e) => e.preventDefault()} // prevent blur (keep keyboard)
                        onPointerDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onClick={handleSend}
                        sx={{ color: canSend ? 'primary.main' : '#ccc' }}
                        disabled={!canSend}
                      >
                        <SendIcon fontSize='small' />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
                htmlInput: {
                  draggable: false,
                  onDragStart: (e: React.DragEvent) => e.preventDefault(),
                },
              }}
            />
          </Box>
        </Box>

        <input
          ref={fileInputRef}
          type='file'
          multiple
          accept={CHAT_FILE_ACCEPTED_LIST}
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
      </>
    );
  },
  (prev, next) =>
    prev.targetChatId === next.targetChatId &&
    prev.isUserBlocked === next.isUserBlocked &&
    prev.message === next.message &&
    prev.isMessageSending === next.isMessageSending &&
    prev.assignedUserId === next.assignedUserId &&
    prev.assignedUser?.id === next.assignedUser?.id &&
    prev.chatStatus === next.chatStatus,
);

ChatRoomInput.displayName = 'ChatRoomInput';
