import { useCallback, useEffect, useState, useRef, useMemo, memo } from 'react';

import { ArrowLeft, ArrowRight, Message, ThreeP } from '@mui/icons-material';
import CloseIcon from '@mui/icons-material/Close';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import NoChatsIcon from '@mui/icons-material/SpeakerNotesOffOutlined';
import {
  Box,
  Typography,
  Stack,
  Tabs,
  Tab,
  IconButton,
  Badge,
  Tooltip,
  Drawer,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useSearchParams } from 'react-router';

import { ListboxComponent, Suspense } from '~/common/components';
import { allOperatorRoles } from '~/common/constants';
import { useResponsive } from '~/common/hooks';
import { useAuthContext } from '~/context/AuthContext';
import { InfiniteQueryProvider } from '~/context/InfiniteScrollContext';
import { useTranslation } from '~/locales/hooks';
import {
  chatListStyles,
  ChatFilter,
  ChatListItem,
  useChatScreenContext,
  isFiltersEmpty,
  type IChat,
  type ChatPageProps,
  useChatListContext,
  useChatRoomContext,
  useChatActions,
  getMeFilters,
} from '~/modules/Chat';
import { useChatFileContext } from '~/modules/Chat/context';

export const ChatList = memo(function ChatList({ isMounting, setIsMounting }: ChatPageProps) {
  const [searchParams] = useSearchParams();
  const {
    chats,
    infiniteQueryResponse,
    chatsCount,
    unassignedChatsCount,
    isFetchingAll,
    setIsFetchingAll,
    filters,
    applyFilters,
    initializeFilters,
    isFiltersApplied,
    isFetchingAllOptions,
    clearFilters,
    filterCategories,
    filtersOptions,
    setFilters,
    refetchChats,
  } = useChatListContext();
  const { targetChat, setIsFetchingOne } = useChatRoomContext();
  const { confirmDiscardMessage, clearTargetChat, setTargetChatId } = useChatActions();

  const {
    isChatListOpen: open,
    toggleChatList,
    openChatList,
    closeChatList,
  } = useChatScreenContext();

  const { uploadingChatIds } = useChatFileContext();
  const { id: targetChatId } = targetChat ?? {};
  const { user } = useAuthContext();
  const { t_chat, t_toasts } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { isMobileOrTablet } = useResponsive();

  const [tabIndex, setTabIndex] = useState(1);

  const shouldFetchRef = useRef(true);
  const isOperator = allOperatorRoles.includes(user?.roleType ?? '');
  const isAssignedToMeTab = isOperator && tabIndex === 1;
  const hasChats = chatsCount > 0;
  const showTabs = open && hasChats && isOperator;
  const showChatFilter = open && (!showTabs || tabIndex === 0);
  const isLoading = isFetchingAll || isMounting;

  const validateChatFilters = useCallback(
    (chat: IChat) => {
      const { includeUnassigned, statuses, tags, teams, users } = filters;

      if (statuses.length > 0 && !statuses.includes(chat.chatStatus)) return false;
      if (tags.length > 0 && !chat.chatTags.some((t) => tags.includes(t.tagId))) return false;
      if (teams.length > 0 && !chat.chatTeamAssignment.some((t) => teams.includes(t.teamId)))
        return false;

      if (users.length > 0 || includeUnassigned) {
        const matchesUser = users.length > 0 && users.includes(chat.assignedUserId || '');
        const matchesUnassigned = includeUnassigned && !chat.assignedUserId;
        if (!matchesUser && !matchesUnassigned) return false;
      }

      return true;
    },
    [filters],
  );

  const handleTabChange = useCallback(
    async (newValue: number, shouldReset = false) => {
      if (!(await confirmDiscardMessage())) return;

      setIsFetchingAll(true);
      if (shouldReset) {
        setIsFetchingOne(true);
        clearTargetChat();
      }
      shouldFetchRef.current = true;
      setTabIndex(newValue);
    },
    [clearTargetChat, confirmDiscardMessage, setIsFetchingAll, setIsFetchingOne],
  );

  const filteredChats = useMemo(() => {
    if (!chats) return [];

    if (user && isAssignedToMeTab) {
      return chats.filter(({ assignedUserId }) => assignedUserId === user.id);
    }

    if (isFiltersEmpty(filters) || !isFiltersApplied) return chats;

    return chats.filter(validateChatFilters);
  }, [chats, user, isAssignedToMeTab, filters, isFiltersApplied, validateChatFilters]);

  useEffect(() => {
    initializeFilters();
  }, [initializeFilters]);

  useEffect(() => {
    if (!user || !shouldFetchRef.current || isFetchingAllOptions || !isFiltersApplied) return;

    const _filters = isAssignedToMeTab ? getMeFilters(user.id) : filters;
    applyFilters(_filters);
    shouldFetchRef.current = false;
  }, [user, isFetchingAllOptions, isFiltersApplied, filters, isAssignedToMeTab, applyFilters]);

  useEffect(() => {
    if (!isMounting || isFetchingAll || !filteredChats || !setIsMounting) return;

    const isAssignedToMeTabEmpty = isAssignedToMeTab && filteredChats.length === 0;
    const isTargetChatNotAssignedToMe =
      isAssignedToMeTab && targetChat && user && targetChat.assignedUserId !== user.id;

    if (isAssignedToMeTabEmpty || isTargetChatNotAssignedToMe) {
      handleTabChange(0);
      if (isAssignedToMeTabEmpty && !isMobileOrTablet) {
        enqueueSnackbar(t_toasts('chat.info.tabAutoSwitched'), {
          variant: 'success',
          preventDuplicate: true,
          autoHideDuration: 3000,
        });
      }
      return;
    }

    setIsMounting(false);
  }, [
    isMounting,
    isFetchingAll,
    filteredChats,
    isAssignedToMeTab,
    targetChat,
    user,
    isMobileOrTablet,
    enqueueSnackbar,
    t_toasts,
    handleTabChange,
    setIsMounting,
  ]);

  useEffect(() => {
    if (isMobileOrTablet && isMounting) {
      openChatList();
    }
  }, [isMobileOrTablet, isMounting, openChatList, searchParams, targetChat]);

  const handleChatListItemSelect = useCallback(
    (chatId: string) => {
      setTargetChatId(chatId);
      if (isMobileOrTablet) closeChatList();
    },
    [setTargetChatId, closeChatList, isMobileOrTablet],
  );

  const renderChatList = useCallback(() => {
    if (!filteredChats?.length) {
      return open ? (
        <Stack alignItems='center' my={4}>
          <NoChatsIcon sx={{ fontSize: 90 }} />
          <Typography mt={2}>{t_chat('noChatList')}</Typography>
        </Stack>
      ) : null;
    }

    return (
      <Box sx={{ height: '100%', overflow: 'hidden', justifyContent: 'flex-start' }}>
        <ListboxComponent>
          {filteredChats.map((chat) => (
            <ChatListItem
              key={chat.id}
              chat={chat}
              open={open}
              targetChatId={targetChatId ?? ''}
              isChatUploading={uploadingChatIds.has(chat.id)}
              setTargetChatId={handleChatListItemSelect}
            />
          ))}
        </ListboxComponent>
      </Box>
    );
  }, [filteredChats, open, t_chat, targetChatId, handleChatListItemSelect]);

  const renderToggleBtn = (
    <IconButton
      onClick={() => {
        openChatList();
        refetchChats();
      }}
      sx={{
        left: 10,
        top: 10,
        zIndex: (theme) => theme.zIndex.appBar + 1,
        width: { xs: 32, sm: 42 },
        height: { xs: 32, sm: 42 },
        position: 'fixed',
      }}
    >
      <PeopleAltIcon fontSize='medium' />
    </IconButton>
  );

  const renderHeader = (
    <Box sx={{ ...chatListStyles.header, justifyContent: open ? 'flex-end' : 'center' }}>
      {showChatFilter && (
        <ChatFilter
          filters={filters}
          applyFilters={applyFilters}
          initializeFilters={initializeFilters}
          clearFilters={clearFilters}
          filterCategories={filterCategories}
          filtersOptions={filtersOptions}
          setFilters={setFilters}
        />
      )}
      {isMobileOrTablet ? (
        <IconButton onClick={closeChatList}>
          <CloseIcon />
        </IconButton>
      ) : (
        <Tooltip
          key={open ? 'chat-list-open' : 'chat-list-close'}
          title={open ? `${t_chat('action.chatList.close')}` : `${t_chat('action.chatList.open')}`}
          placement='bottom'
          arrow
        >
          <IconButton onClick={toggleChatList}>{!open ? <ArrowRight /> : <ArrowLeft />}</IconButton>
        </Tooltip>
      )}
    </Box>
  );

  const renderTabs = (
    <Tabs
      value={tabIndex}
      sx={{
        ...chatListStyles.tabs,
        '.MuiTabs-flexContainer': { height: 1 },
      }}
      onChange={(_e, newValue) => handleTabChange(newValue, true)}
      aria-label='Inbox tabs'
      TabIndicatorProps={{ children: <span className='MuiTabs-indicatorSpan' /> }}
    >
      <Tab
        icon={
          <Tooltip title={!!unassignedChatsCount && t_chat('unassignedChatCount')}>
            <Badge
              badgeContent={unassignedChatsCount}
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'left',
              }}
              color='primary'
            >
              <Message fontSize='small' />
            </Badge>
          </Tooltip>
        }
        iconPosition='start'
        label={t_chat('messages')}
        sx={chatListStyles.tab}
      />
      <Tab
        icon={<ThreeP fontSize='small' />}
        label={t_chat('assignedToMe')}
        iconPosition='start'
        sx={chatListStyles.tab}
      />
    </Tabs>
  );

  const renderContent = (
    <Box sx={{ ...chatListStyles.container }}>
      {renderHeader}
      {showTabs && renderTabs}
      <InfiniteQueryProvider infiniteQueryResponse={infiniteQueryResponse}>
        <Suspense isLoading={isLoading}>{renderChatList()}</Suspense>
      </InfiniteQueryProvider>
    </Box>
  );

  return isMobileOrTablet ? (
    <>
      {renderToggleBtn}
      <Drawer
        open={open}
        onClose={closeChatList}
        PaperProps={{ sx: { width: { xs: 1, sm: '70%' } } }}
      >
        {renderContent}
      </Drawer>
    </>
  ) : (
    <Stack
      sx={{
        height: '100%',
        width: open ? '300px' : '60px',
        transition: 'width 0.3s',
        overflowX: 'hidden',
      }}
    >
      {renderContent}
    </Stack>
  );
});

ChatList.displayName = 'ChatList';
