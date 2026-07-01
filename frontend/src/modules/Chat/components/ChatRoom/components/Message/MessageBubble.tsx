import { Fragment, useCallback, useMemo, type KeyboardEvent } from 'react';

import {
  ErrorOutline,
  Replay,
  DeleteOutlineRounded,
  LocationOn,
  InsertDriveFile,
  AudioFile,
  Videocam,
  EmojiEmotions,
} from '@mui/icons-material';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import {
  Box,
  Typography,
  Paper,
  Avatar,
  CardMedia,
  Stack,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';

import { CHAT_FILE_UPLOADER, USER_DEFAULT_PICTURE_URL } from '~/common/constants';
import { useAuthContext } from '~/context/AuthContext';
import { ChatMessageType, SenderType } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import {
  getDisplayNames,
  msgBubbleStyles,
  chatListStyles,
  type IChatMessage,
  useChatActions,
  useChatFileContext,
  useChatRoomContext,
} from '~/modules/Chat';
import { formatDateTo_HHmm, formatYYYYMMDDWithDots } from '~/plugins';
import { convertUrlsToLinks, discardNull } from '~/utils';

type MessageBubbleProps = Omit<IChatMessage, 'previewImageUrl' | 'senderId'> & {
  showSender?: boolean;
  showProfile?: boolean;
  onLightboxOpen?: (index: string) => void;
  contentUrl?: Nullable<string>;
  duration?: Nullable<number>;
  latitude?: Nullable<number>;
  longitude?: Nullable<number>;
  previewImageUrl?: Nullable<string>;
};

export const MessageBubble = ({
  id,
  chatId,
  type,
  content,
  senderType,
  sender,
  createdAt,
  showSender = false,
  showProfile = true,
  isDelivering = false,
  isRetrying = false,
  isDelivered = true,
  isDeleting = false,
  contentUrl,
  duration,
  latitude,
  longitude,
  previewImageUrl,
  onLightboxOpen,
}: MessageBubbleProps) => {
  const { user } = useAuthContext();
  const { targetChat } = useChatRoomContext();
  const { openUploadDialog } = useChatFileContext();
  const { retryMessage, handleChatUpdate, handleChatMessageDelete, sendMessageToLigla } =
    useChatActions();
  const { t, t_chat } = useTranslation();

  const isOperatorMessage = senderType === SenderType.Operator;
  const isSystemMessage = senderType === SenderType.System;
  const isRightAligned = isOperatorMessage || isSystemMessage;
  const isFlexMessage = type === ChatMessageType.Flex;
  const isShareUploadFlexMessage = isFlexMessage && content === CHAT_FILE_UPLOADER;
  const fileUploadLiffId = user?.organization?.fileUploadLiffId;
  const isLiffUploadUrl = useMemo(() => {
    if (!contentUrl || !fileUploadLiffId) return false;

    try {
      const parsedUrl = new URL(contentUrl);
      return (
        parsedUrl.origin === 'https://liff.line.me' &&
        parsedUrl.pathname === `/${fileUploadLiffId}` &&
        parsedUrl.searchParams.has('o')
      );
    } catch {
      return false;
    }
  }, [contentUrl, fileUploadLiffId]);
  const isUploadFlexMessage = isFlexMessage && isLiffUploadUrl;

  const containerDirection = isRightAligned ? 'row-reverse' : 'row';
  const backgroundColor = isOperatorMessage || isSystemMessage ? '#6CE131' : 'white';
  const bubbleBackground = isFlexMessage ? '#dff5ec' : backgroundColor;
  const textColor = isRightAligned ? 'white' : 'grey.800';

  const { displayName, senderName, pictureUrl, id: senderId } = sender;
  const senderDisplayName =
    discardNull(senderName)?.trim() || discardNull(displayName)?.trim() || '';

  const { fullName } = getDisplayNames(discardNull(displayName));

  const sanitizedContent = convertUrlsToLinks(content);

  const TextContent = useMemo(() => {
    return sanitizedContent.map((message, index) => (
      <Fragment key={`${id}-${index}`}>
        {message.isLink ? (
          <a href={message.text} target='_blank' rel='noopener noreferrer'>
            {message.text}
          </a>
        ) : (
          <Typography
            variant='body1'
            whiteSpace='pre-line'
            sx={{
              fontSize: {
                xs: '0.8125rem',
                sm: 10,
              },
            }}
          >
            {message.text}
          </Typography>
        )}
      </Fragment>
    ));
  }, [id, sanitizedContent]);

  const memorizedPictureUrl = useMemo(() => {
    if (user && senderId === user.id) {
      return user.pictureUrl || USER_DEFAULT_PICTURE_URL;
    }
    return pictureUrl || USER_DEFAULT_PICTURE_URL;
  }, [pictureUrl, user, senderId]);

  const handleRetry = useCallback(async () => {
    const retryingMessage = await retryMessage(chatId, id);
    if (!retryingMessage || !targetChat) return;

    handleChatUpdate({
      ...targetChat,
      chatMessages: [{ ...retryingMessage, isDelivering: false, isRetrying: true }],
    });

    await sendMessageToLigla(chatId, id);
  }, [chatId, handleChatUpdate, id, retryMessage, sendMessageToLigla, targetChat]);

  const isLoading = useMemo(
    () => isDelivering || isRetrying || isDeleting,
    [isDelivering, isRetrying, isDeleting],
  );

  const handleUploadFlexClick = useCallback(() => {
    if (isUploadFlexMessage) {
      openUploadDialog();
    }
  }, [isUploadFlexMessage, openUploadDialog]);

  const handleUploadFlexKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      event.preventDefault();
      handleUploadFlexClick();
    },
    [handleUploadFlexClick],
  );

  const renderContent = () => {
    switch (type) {
      case ChatMessageType.Text:
        return TextContent;
      case ChatMessageType.Image: {
        const imageSrc = previewImageUrl || content || '';
        const fullImageSrc = content || '';
        return (
          <CardMedia
            component='img'
            alt={`Photo sent by ${fullName}`}
            src={imageSrc}
            loading='lazy'
            style={{
              width: '200px',
              height: '200px',
              minHeight: '200px',
              borderRadius: '8px',
              cursor: 'pointer',
              objectFit: 'cover',
            }}
            onClick={() => onLightboxOpen?.(fullImageSrc)}
          />
        );
      }
      case ChatMessageType.Video: {
        if (previewImageUrl) {
          return (
            <Tooltip title={t_chat('videoNotAccessible')} placement='top'>
              <Box sx={{ position: 'relative', width: 'fit-content' }}>
                <CardMedia
                  component='img'
                  alt={`Video sent by ${fullName}`}
                  src={previewImageUrl}
                  style={{
                    width: '100%',
                    maxWidth: '500px',
                    maxHeight: '300px',
                    height: 'auto',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                  onClick={() => onLightboxOpen?.(content)}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    borderRadius: '50%',
                    padding: 1,
                  }}
                >
                  <Videocam sx={{ color: 'white', fontSize: 40 }} />
                </Box>
                {duration && (
                  <Typography
                    variant='caption'
                    sx={{
                      position: 'absolute',
                      bottom: 8,
                      right: 8,
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                      color: 'white',
                      padding: '2px 4px',
                      borderRadius: 1,
                    }}
                  >
                    {Math.round(duration / 1000)}s
                  </Typography>
                )}
              </Box>
            </Tooltip>
          );
        }
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Videocam />
            <Typography variant='body2'>
              {t_chat('videoMessage')} {duration && `(${Math.round(duration / 1000)}s)`}
            </Typography>
          </Box>
        );
      }
      case ChatMessageType.Audio:
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AudioFile />
            <Typography variant='body2'>
              {t_chat('audioMessage')} {duration && `(${Math.round(duration / 1000)}s)`}
            </Typography>
          </Box>
        );
      case ChatMessageType.File:
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InsertDriveFile />
            <Typography variant='body2'>{t_chat('fileMessage')}</Typography>
          </Box>
        );
      case ChatMessageType.Location:
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocationOn />
            <Typography variant='body2'>
              {t_chat('locationMessage')} {latitude && longitude && `(${latitude}, ${longitude})`}
            </Typography>
          </Box>
        );
      case ChatMessageType.Sticker:
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmojiEmotions />
            <Typography variant='body2'>{t_chat('stickerMessage')}</Typography>
          </Box>
        );
      case ChatMessageType.Flex: {
        const isLinkedFlexMessage = !isUploadFlexMessage && Boolean(contentUrl);
        const isClickableFlexMessage = isUploadFlexMessage || isLinkedFlexMessage;

        return (
          <Box
            component={isLinkedFlexMessage ? 'a' : 'div'}
            href={isLinkedFlexMessage ? contentUrl || undefined : undefined}
            target={isLinkedFlexMessage ? '_blank' : undefined}
            rel={isLinkedFlexMessage ? 'noopener noreferrer' : undefined}
            onClick={isUploadFlexMessage ? handleUploadFlexClick : undefined}
            onKeyDown={isUploadFlexMessage ? handleUploadFlexKeyDown : undefined}
            role={isUploadFlexMessage ? 'button' : undefined}
            tabIndex={isUploadFlexMessage ? 0 : undefined}
            sx={{
              textDecoration: 'none',
              color: 'inherit',
              display: 'block',
              cursor: isClickableFlexMessage ? 'pointer' : 'default',
            }}
          >
            <Paper
              elevation={0}
              sx={{
                p: 1.25,
                borderRadius: 2,
                bgcolor: '#dff5ec',
                minWidth: 200,
                maxWidth: 320,
              }}
            >
              {previewImageUrl ? (
                <Stack direction='row' spacing={1.5} alignItems='center'>
                  <CardMedia
                    component='img'
                    src={previewImageUrl}
                    alt={content || 'Preview'}
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: 1.5,
                      objectFit: 'contain',
                      flexShrink: 0,
                    }}
                  />
                  <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      variant='body2'
                      fontWeight={700}
                      sx={{
                        color: '#0f2a0f',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {content || CHAT_FILE_UPLOADER}
                    </Typography>
                    {!isShareUploadFlexMessage && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                        <Typography variant='caption' sx={{ color: '#6a9a6a', flexShrink: 0 }}>
                          {formatYYYYMMDDWithDots(createdAt)}
                        </Typography>
                        {senderDisplayName && (
                          <Typography
                            variant='caption'
                            sx={{
                              color: '#4a7a4a',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              minWidth: 0,
                            }}
                          >
                            {senderDisplayName}
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Stack>
                </Stack>
              ) : (
                <Stack direction='row' spacing={1.5} alignItems='center'>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: 1.5,
                      objectFit: 'contain',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CloudUploadRoundedIcon sx={{ fontSize: 56, color: '#2f7d45' }} />
                  </Box>
                  <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      variant='body2'
                      fontWeight={700}
                      sx={{
                        color: '#0f2a0f',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {content || CHAT_FILE_UPLOADER}
                    </Typography>
                    {!isShareUploadFlexMessage && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                        <Typography variant='caption' sx={{ color: '#6a9a6a', flexShrink: 0 }}>
                          {formatYYYYMMDDWithDots(createdAt)}
                        </Typography>
                        {senderDisplayName && (
                          <Typography
                            variant='caption'
                            sx={{
                              color: '#4a7a4a',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              minWidth: 0,
                            }}
                          >
                            {senderDisplayName}
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Stack>
                </Stack>
              )}
            </Paper>
          </Box>
        );
      }
      default:
        return <Typography variant='body2'>{t_chat('unsupportedMessage')}</Typography>;
    }
  };

  return (
    <Box
      sx={msgBubbleStyles.container({
        flexDirection: containerDirection,
        opacity: isDeleting ? 0.5 : 1,
      })}
    >
      {showProfile ? (
        <Avatar src={memorizedPictureUrl} sx={msgBubbleStyles.avatar} />
      ) : (
        <Box sx={msgBubbleStyles.avatar} />
      )}
      <Paper
        sx={msgBubbleStyles.paper({
          bgcolor: bubbleBackground,
          marginTop: showSender ? 2 : 0,
          wordBreak: 'break-word',
        })}
      >
        {renderContent()}
        {(isOperatorMessage || isSystemMessage) && showSender && !isFlexMessage && (
          <Typography
            variant='caption'
            sx={msgBubbleStyles.sentBy({
              color: textColor,
              ...chatListStyles.truncate,
            })}
          >
            {fullName}
          </Typography>
        )}
      </Paper>
      <Stack
        sx={{
          marginTop: 'auto',
          marginBottom: isLoading ? 'auto' : 'inherit',
          height: '100%',
        }}
      >
        {isOperatorMessage && !isLoading && !isDelivered && !showSender ? (
          <Box>
            <Box sx={msgBubbleStyles.actionsContainer}>
              <Tooltip title={t('actions.tryAgain')}>
                <IconButton sx={msgBubbleStyles.actionButton} onClick={handleRetry}>
                  <Replay sx={msgBubbleStyles.errorIcon} />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('actions.delete')}>
                <IconButton
                  sx={msgBubbleStyles.actionButton}
                  onClick={() => handleChatMessageDelete(chatId, id)}
                >
                  <DeleteOutlineRounded sx={msgBubbleStyles.errorIcon} />
                </IconButton>
              </Tooltip>
            </Box>
            <Box sx={msgBubbleStyles.errorContainer}>
              <ErrorOutline sx={msgBubbleStyles.errorMsg} />
              <Typography variant='caption' color='error' sx={msgBubbleStyles.errorText}>
                {t_chat('sendingFailed')}
              </Typography>
            </Box>
          </Box>
        ) : (
          <>
            {isLoading ? (
              <CircularProgress size={20} sx={msgBubbleStyles.loadingIcon} />
            ) : (
              <Typography
                variant='caption'
                sx={msgBubbleStyles.time({
                  color: textColor,
                })}
              >
                {formatDateTo_HHmm(createdAt)}
              </Typography>
            )}
          </>
        )}
      </Stack>
    </Box>
  );
};
