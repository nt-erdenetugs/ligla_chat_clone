import { useState, useEffect, memo, useMemo, type ReactElement } from 'react';

import { ArrowDropDown } from '@mui/icons-material';
import CloseIcon from '@mui/icons-material/Close';
import InfoIcon from '@mui/icons-material/Info';
import { Stack, Typography, Box, Card, List, Collapse, IconButton, Drawer } from '@mui/material';

import { Loading } from '~/common/components';
import { useResponsive } from '~/common/hooks';
import { useAuthContext } from '~/context/AuthContext';
import { useTranslation } from '~/locales/hooks';
import {
  ChatTag,
  ChatAttribute,
  ChatNote,
  useChatScreenContext,
  type ChatPageProps,
  useChatRoomContext,
  useChatActions,
  AssignPopover,
  ChatUserInfo,
  ChatMemberId,
  InfoDisplay,
} from '~/modules/Chat';
import { useMemberFeedInfoActions } from '~/modules/Member';
import { useSurveyInfoActions } from '~/modules/Survey';

const chatDetailWidth = 300;

export const ChatDetail = memo(function ChatDetail({ isMounting }: ChatPageProps) {
  const { targetChat, isFetchingOne } = useChatRoomContext();
  const { removeChatTag, updateChatTags } = useChatActions();
  const { user } = useAuthContext();
  const { isChatDetailOpen: open, closeChatDetail } = useChatScreenContext();
  const { t_chat } = useTranslation();
  const [expandedItems, setExpandedItems] = useState<boolean[]>([]);

  const { isMobileOrTablet } = useResponsive();

  const clientUserId = targetChat?.endUser.clientUserId || undefined;
  const chatId = targetChat?.id || undefined;

  const { data: memberFeeds, loading: memberFeedsLoading } = useMemberFeedInfoActions(clientUserId);
  const { data: surveys, loading: surveysLoading } = useSurveyInfoActions(chatId);

  type DetailItem = {
    title: string;
    component: ReactElement;
  };

  const listItems = useMemo<DetailItem[]>(() => {
    if (!targetChat) return [];

    const assignedUserId = targetChat.assignedUserId || '';

    const items: DetailItem[] = [
      {
        title: 'chatAttributes.attributes',
        component: (
          <ChatAttribute
            chatId={targetChat.id}
            chatAttributeValues={targetChat.chatAttributeValues}
          />
        ),
      },
      {
        title: 'chatTags.tags',
        component: (
          <ChatTag
            chatId={targetChat.id}
            chatTags={targetChat.chatTags}
            assignedUserId={assignedUserId}
            user={user}
            removeChatTag={removeChatTag}
            updateChatTags={updateChatTags}
          />
        ),
      },
      {
        title: 'chatNotes.notes',
        component: <ChatNote chatId={targetChat.id} assignedUserId={assignedUserId} user={user} />,
      },
    ];

    if (surveysLoading || surveys.length > 0) {
      items.push({
        title: 'chatSurvey.surveyInfo',
        component: (
          <InfoDisplay
            fields={surveys}
            loading={surveysLoading}
            emptyMessage={t_chat('chatSurveys.noList')}
          />
        ),
      });
    }

    if (memberFeedsLoading || memberFeeds.length > 0) {
      items.push({
        title: 'chatFeeds.memberInfo',
        component: (
          <InfoDisplay
            fields={memberFeeds}
            loading={memberFeedsLoading}
            emptyMessage={t_chat('chatFeeds.noList')}
          />
        ),
      });
    }

    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetChat, user, memberFeeds, memberFeedsLoading, surveys, surveysLoading]);

  useEffect(() => {
    const cachedState = JSON.parse(
      localStorage.getItem('chatDetailExpandedItems') ?? '[]',
    ) as boolean[];
    setExpandedItems(cachedState.length !== 0 ? cachedState : listItems.map(() => true));
  }, [listItems]);

  const toggleItem = (index: number) => {
    setExpandedItems((prev: boolean[]) => {
      const newState = [...prev];
      newState[index] = !newState[index];
      localStorage.setItem('chatDetailExpandedItems', JSON.stringify(newState));
      return newState;
    });
  };

  const renderChatContent = () => {
    if (isFetchingOne || isMounting) {
      return (
        <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
          <Loading />
        </Box>
      );
    }

    if (!targetChat) {
      return (
        <Stack flexDirection='row' alignItems='center' gap={1} justifyContent='center'>
          <InfoIcon />
          <Typography my={5} variant='body1' color='text.secondary'>
            {t_chat('noChatSelected')}
          </Typography>
        </Stack>
      );
    }

    return (
      <List
        sx={{
          display: 'flex',
          width: { xs: 1, lg: chatDetailWidth },
          flexDirection: 'column',
          padding: 0,
          overflowX: 'hidden',
          overflowY: 'auto',
        }}
      >
        {isMobileOrTablet && (
          <Stack width={1} gap={1} px={2} pt={1}>
            <Stack direction='row' alignItems='center' justifyContent='space-between'>
              <Typography fontWeight='bold'>{t_chat('chatInfo')}</Typography>
              <IconButton onClick={closeChatDetail}>
                <CloseIcon />
              </IconButton>
            </Stack>
            <Stack alignItems='center' gap={2} mb={3}>
              <ChatUserInfo chat={targetChat} avatarSize={100} gap={2} />
              <AssignPopover />
            </Stack>
          </Stack>
        )}
        <Box
          sx={{
            py: 1,
            px: 2,
          }}
        >
          <ChatMemberId clientUserId={targetChat?.endUser?.clientUserId} />
        </Box>
        {listItems.map((item: DetailItem, index: number) => (
          <Box key={item.title}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                py: 1,
                px: 2,
                bgcolor: '#ededed',
                cursor: 'pointer',
              }}
              onClick={() => toggleItem(index)}
            >
              <Typography variant='subtitle1' color='text.secondary' fontWeight='bold'>
                {t_chat(item.title)}
              </Typography>
              <IconButton size='small'>
                <ArrowDropDown
                  sx={{
                    transform: expandedItems[index] ? 'rotate(0deg)' : 'rotate(180deg)',
                    transition: 'transform 0.3s',
                  }}
                />
              </IconButton>
            </Box>
            <Collapse timeout={250} in={expandedItems[index]}>
              <Box sx={{ px: 2, py: 2 }}>{item.component}</Box>
            </Collapse>
          </Box>
        ))}
      </List>
    );
  };

  return isMobileOrTablet ? (
    <Drawer
      open={open}
      onClose={closeChatDetail}
      slotProps={{ paper: { sx: { width: { xs: 1, sm: '70%' } } } }}
      anchor='right'
    >
      {renderChatContent()}
    </Drawer>
  ) : (
    <Card
      sx={{
        height: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        width: open ? chatDetailWidth : 0,
        transition: 'width 0.3s',
        flex: 'none',
        borderLeft: open ? 1 : 0,
        borderRadius: 0,
        borderColor: '#e0e0e0',
      }}
      elevation={0}
    >
      {renderChatContent()}
    </Card>
  );
});

ChatDetail.displayName = 'ChatDetail';
