import { useCallback, useEffect, useState, memo } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Add, Check, Close, EditNote } from '@mui/icons-material';
import { Box, IconButton, InputAdornment, TextField, Typography } from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';

import { DeleteDialog, Suspense } from '~/common/components';
import { adminManagerRoles } from '~/common/constants';
import { useErrorHandledAction } from '~/common/hooks';
import { useTranslation } from '~/locales/hooks';
import { typographyColors } from '~/modules/Chat/styles';
import {
  inputAdornmentStyle,
  notesListContainer,
  textFieldStyle,
  useNoteActions,
} from '~/modules/ChatNotes';
import { useFetchNotes } from '~/modules/ChatNotes/hooks/useFetchNotes';
import { type IUser } from '~/modules/Users';

const MIN_NOTE_LENGTH = 1;
const MAX_NOTE_LENGTH = 2000;

interface ChatNoteProps {
  chatId: string;
  assignedUserId: string;
  user: Nullish<IUser>;
}

export const ChatNote = memo(
  function ChatNote({ chatId, assignedUserId, user }: ChatNoteProps) {
    const { notes, loading: isLoading } = useFetchNotes(chatId);
    const { createNote, updateNote, removeNote } = useNoteActions();
    const { t_chat } = useTranslation();

    const [showDialog, setShowDialog] = useState(false);
    const [currentNoteId, setCurrentNoteId] = useState<string>();
    const [isEditing, setIsEditing] = useState(false);

    const schema = z.object({
      noteValue: z
        .string()
        .trim()
        .min(MIN_NOTE_LENGTH, { message: t_chat('chatNotes.noteValueRequired') })
        .max(MAX_NOTE_LENGTH, { message: t_chat('chatNotes.noteValueTooLong') }),
    });

    type FormInput = z.infer<typeof schema>;

    const {
      control,
      handleSubmit,
      setValue,
      reset,
      formState: { errors },
    } = useForm<FormInput>({
      defaultValues: {
        noteValue: '',
      },
      resolver: zodResolver(schema),
    });

    const { executeAction } = useErrorHandledAction();

    const clearState = useCallback(() => {
      reset();
      setCurrentNoteId(undefined);
      setIsEditing(false);
      setShowDialog(false);
    }, [reset]);

    useEffect(() => {
      clearState();
    }, [chatId, clearState]);

    if (!notes || !user) return null;

    const isUserAssigned = user.id === assignedUserId;
    const hasHigherPrivileges = adminManagerRoles.includes(user.roleType);
    const isEnabled = isUserAssigned || hasHigherPrivileges;

    const handleKeyPress = (event: React.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        handleSubmit(isEditing ? handleUpdateNote : handleAddNote)();
      }
    };

    const handleEnableEdit = (noteId: string) => {
      const note = notes.find((note) => note.id === noteId);
      if (!note) return;
      setValue('noteValue', note.noteValue);
      setCurrentNoteId(noteId);
      setIsEditing(true);
    };

    const handleDisableEdit = () => {
      setCurrentNoteId('');
      clearState();
    };

    const handleAddNote = async (data: FormInput) => {
      await executeAction(
        () =>
          createNote({
            chatId,
            noteValue: data.noteValue,
          }),
        () => clearState(),
      );
    };

    const handleRemoveNote = async () => {
      if (!currentNoteId) return;
      await executeAction(
        () => removeNote(currentNoteId, chatId),
        () => clearState(),
      );
    };

    const handleUpdateNote = async (data: FormInput) => {
      if (!currentNoteId) return;
      if (data.noteValue.trim() === notes.find((note) => note.id === currentNoteId)?.noteValue) {
        handleDisableEdit();
        return;
      }
      await executeAction(
        () =>
          updateNote(
            {
              chatId,
              noteValue: data.noteValue,
            },
            currentNoteId,
          ),
        () => clearState(),
      );
    };

    return (
      <Suspense isLoading={isLoading}>
        <Box>
          <form onSubmit={handleSubmit(isEditing ? handleUpdateNote : handleAddNote)}>
            <Controller
              name='noteValue'
              control={control}
              rules={{
                required: t_chat('chatNotes.noteValueRequired'),
                maxLength: {
                  value: MAX_NOTE_LENGTH,
                  message: t_chat('chatNotes.noteValueTooLong'),
                },
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  multiline
                  maxRows={5}
                  variant='outlined'
                  error={!!errors.noteValue}
                  helperText={errors.noteValue?.message}
                  onKeyDown={handleKeyPress}
                  placeholder={t_chat('chatNotes.enterNoteValue')}
                  disabled={!isEnabled}
                  fullWidth
                  sx={textFieldStyle(isEnabled)}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position='end' sx={inputAdornmentStyle(isEnabled)}>
                          {isEditing ? (
                            <>
                              <IconButton
                                type='submit'
                                size='medium'
                                sx={{
                                  color: 'primary.main',
                                }}
                              >
                                <Check fontSize='small' />
                              </IconButton>
                              <IconButton size='small' onClick={handleDisableEdit}>
                                <Close fontSize='small' color='error' />
                              </IconButton>
                            </>
                          ) : (
                            <IconButton
                              type='submit'
                              size='medium'
                              sx={{ color: 'primary.main' }}
                              disabled={!isEnabled}
                            >
                              <Add fontSize='small' />
                            </IconButton>
                          )}
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              )}
            />
          </form>
          {notes.length > 0 && (
            <Box sx={notesListContainer}>
              {notes.map((note) => (
                <Box
                  key={note.id}
                  sx={{
                    overflowWrap: 'break-word',
                  }}
                >
                  <Box
                    sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Typography
                          variant='subtitle2'
                          fontSize='12px'
                          lineHeight={1}
                          color='textDisabled'
                          sx={{
                            marginBottom: 'auto',
                          }}
                        >
                          {t_chat(note.updatedAt ? 'chatNotes.editedBy' : 'chatNotes.addedBy')}
                          :&nbsp;
                        </Typography>
                        <Typography
                          variant='subtitle2'
                          fontSize='12px'
                          lineHeight={1}
                          color={typographyColors.operator}
                        >
                          {note.user.displayName}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <IconButton
                        size='small'
                        disabled={user.id !== note.user.id && !hasHigherPrivileges}
                        onClick={() => handleEnableEdit(note.id)}
                      >
                        <EditNote fontSize='small' />
                      </IconButton>
                      <IconButton
                        size='small'
                        disabled={user.id !== note.user.id && !hasHigherPrivileges}
                        onClick={() => {
                          setShowDialog(true);
                          setCurrentNoteId(note.id);
                        }}
                      >
                        <Close fontSize='small' />
                      </IconButton>
                    </Box>
                  </Box>
                  <Typography
                    whiteSpace='pre-line'
                    variant='body2'
                    fontSize='12px'
                    lineHeight='1.4'
                    color='textSecondary'
                    textOverflow='break-word'
                  >
                    {note.noteValue}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
          {showDialog && (
            <DeleteDialog onClose={() => setShowDialog(false)} onConfirm={handleRemoveNote} />
          )}
        </Box>
      </Suspense>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.chatId === nextProps.chatId && prevProps.assignedUserId === nextProps.assignedUserId
    );
  },
);

ChatNote.displayName = 'ChatNote';
