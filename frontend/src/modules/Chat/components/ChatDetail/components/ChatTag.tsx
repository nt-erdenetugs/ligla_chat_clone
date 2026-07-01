import { useMemo, useState, memo, useEffect } from 'react';

import { Box, TextField } from '@mui/material';
import { useSnackbar } from 'notistack';

import { MultipleAutocomplete, Suspense, MobileSelectModal } from '~/common/components';
import { adminManagerRoles } from '~/common/constants';
import { useResponsive } from '~/common/hooks';
import { useTranslation } from '~/locales/hooks';
import { SelectedTags } from '~/modules/Chat';
import { type ITag, useTagActions } from '~/modules/Tags';
import { type IUser } from '~/modules/Users';

interface ChatTagProps {
  chatId: string;
  chatTags: Array<{
    tagId: string;
    tag: {
      id: string;
      name: string;
      isActive: boolean;
    };
  }>;
  assignedUserId: string;
  user: Nullish<IUser>;
  removeChatTag: (chatId: string, tagId: string) => void;
  updateChatTags: (chatId: string, tagIds: string[]) => Promise<void>;
}

type TagOptionsType = Omit<ITag, 'createdAt'>;

export const ChatTag = memo(
  function ChatTag({
    chatId,
    chatTags,
    assignedUserId,
    user,
    removeChatTag,
    updateChatTags,
  }: ChatTagProps) {
    const { tags, isFetchingAll } = useTagActions();
    const { t_chat, t_toasts } = useTranslation();

    const [isLoading, setIsLoading] = useState(false);
    const [isDialogOpen, setDialogOpen] = useState(false);
    const [searchValue, setSearchValue] = useState('');
    const [selectedTags, setSelectedTags] = useState<TagOptionsType[]>([]);
    const { isMobile } = useResponsive();
    const { enqueueSnackbar } = useSnackbar();

    const selectedTagIds = selectedTags.map((tag) => tag.id);
    const chatTagOptions: TagOptionsType[] = useMemo(
      () =>
        tags.filter((tag) => tag.isActive).map(({ id, name }) => ({ id, name, isActive: true })),
      [tags],
    );

    const multipleOptions = useMemo(
      () => chatTagOptions.map((tag) => ({ label: tag.name, value: tag.id })),
      [chatTagOptions],
    );
    useEffect(() => {
      setSelectedTags(
        chatTags.map((chatTag) => ({
          id: chatTag.tagId,
          name: chatTag.tag.name,
          isActive: chatTag.tag.isActive,
        })),
      );
    }, [chatTags]);

    if (!user) return null;

    const isUserAssigned = user.id === assignedUserId;
    const hasHigherPrivileges = adminManagerRoles.includes(user.roleType);
    const isEnabled = isUserAssigned || hasHigherPrivileges;

    const handleTagDelete = (tagId: string) => {
      try {
        removeChatTag(chatId, tagId);
      } catch (error) {
        console.error('Failed to update chat tags:', error);
        enqueueSnackbar(t_toasts('Failed to delete chat tags'), { variant: 'error' });
      }
    };

    const handleTagChange = (newValue: string[]) => {
      const newSelectedTags: TagOptionsType[] = newValue
        .map((tagId) => chatTagOptions.find((tag) => String(tag.id) === tagId))
        .filter(Boolean) as TagOptionsType[];

      setSelectedTags(newSelectedTags);
    };

    const handleMobileTagToggle = (option: TagOptionsType) => {
      let newSelectedTags;
      const isSelected = selectedTags.some((tag) => tag.id === option.id);

      if (isSelected) {
        newSelectedTags = selectedTags.filter((tag) => tag.id !== option.id);
      } else {
        newSelectedTags = [...selectedTags, option];
      }

      setSelectedTags(newSelectedTags);
    };

    const handleDialogClose = async () => {
      // Compare current selected tags with the actual chat tags to see if anything changed
      const currentChatTagIds = chatTags.map((ct) => ct.tagId).sort();
      const selectedTagIds = selectedTags.map((tag) => tag.id).sort();

      // Only update if tags actually changed via mobile select
      const tagsChanged =
        currentChatTagIds.length !== selectedTagIds.length ||
        currentChatTagIds.some((id, index) => id !== selectedTagIds[index]);

      if (!tagsChanged) {
        setDialogOpen(false);
        setSearchValue('');
        return;
      }

      setIsLoading(true);
      try {
        const tagIds = selectedTags.map((tag) => tag.id);
        await updateChatTags(chatId, tagIds);
      } catch (error) {
        console.error('Failed to update chat tags:', error);
        enqueueSnackbar(t_toasts('Failed to update chat tags'), { variant: 'error' });
      } finally {
        setDialogOpen(false);
        setSearchValue('');
        setIsLoading(false);
      }
    };

    const handleAutocompleteClose = async () => {
      // Compare current selected tags with the actual chat tags to see if anything changed
      const currentChatTagIds = chatTags.map((ct) => ct.tagId).sort();
      const selectedTagIds = selectedTags.map((tag) => tag.id).sort();

      // Only update if tags actually changed via autocomplete
      const tagsChanged =
        currentChatTagIds.length !== selectedTagIds.length ||
        currentChatTagIds.some((id, index) => id !== selectedTagIds[index]);

      if (!tagsChanged) {
        setSearchValue('');
        return;
      }

      setIsLoading(true);
      try {
        const tagIds = selectedTags.map((tag) => tag.id);
        await updateChatTags(chatId, tagIds);
      } catch (error) {
        console.error('Failed to update chat tags:', error);
        enqueueSnackbar(t_toasts('Failed to update chat tags'), { variant: 'error' });
      } finally {
        setIsLoading(false);
        setSearchValue('');
      }
    };

    return (
      <Suspense isLoading={isFetchingAll}>
        <Box>
          <>
            {isMobile ? (
              <>
                <TextField
                  placeholder={t_chat('chatTags.enterTagValue')}
                  disabled={!isEnabled}
                  size='medium'
                  fullWidth
                  slotProps={{
                    input: {
                      readOnly: true,
                      sx: { height: '36px', fontSize: 14, borderRadius: 2 },
                      onClick: () => setDialogOpen(true),
                    },
                  }}
                />
                <MobileSelectModal<TagOptionsType>
                  title='Tags'
                  options={chatTagOptions}
                  selectedOptions={selectedTags}
                  getOptionId={(option) => option.id}
                  getOptionLabel={(option) => option.name}
                  isEnabled={isEnabled}
                  searchValue={searchValue}
                  setSearchValue={setSearchValue}
                  onToggle={handleMobileTagToggle}
                  isDialogOpen={isDialogOpen}
                  onClose={handleDialogClose}
                />
              </>
            ) : (
              <MultipleAutocomplete
                options={multipleOptions}
                value={selectedTagIds}
                onChange={(newValue) => handleTagChange(newValue as string[])}
                onClose={handleAutocompleteClose}
                label={t_chat('chatTags.enterTagValue')}
                placeholder={t_chat('chatTags.enterTagValue')}
                checkBox
                disabled={!isEnabled}
                renderValue={() => null}
                inputProps={{
                  sx: {
                    '& .MuiInputBase-root': { height: 36, fontSize: 14, borderRadius: 2 },
                    '& .MuiInputBase-input': {
                      lineHeight: '0px',
                      height: '0px',
                    },
                  },
                }}
              />
            )}
            <SelectedTags
              id={chatId}
              handleTagDelete={handleTagDelete}
              isEnabled={isEnabled}
              isLoading={isLoading}
              selectedTags={selectedTags}
            />
          </>
        </Box>
      </Suspense>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.chatId === nextProps.chatId &&
      JSON.stringify(prevProps.chatTags) === JSON.stringify(nextProps.chatTags)
    );
  },
);

ChatTag.displayName = 'ChatTag';
