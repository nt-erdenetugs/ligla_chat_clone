import { useEffect } from 'react';

import { useQuery } from '@apollo/client';
import { type SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { DragIndicator } from '@mui/icons-material';
import ClearIcon from '@mui/icons-material/Clear';
import { Button, CircularProgress, Stack } from '@mui/material';
import { useSearchParams } from 'react-router';

import { TooltipIconButton } from '~/common/components';
import { ChatAssignFilterDocument, type ChatAssignFilterQuery } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { type NestedStyleProps, nestedStyle, RULE_FILTER_ACTION_KEY } from '~/modules/Rules';

export type FilterProps = {
  id?: string;
  name?: string;
  onRemove?: () => void;
  onNameChange?: (name: string) => void;
  setNodeRef?: (element: HTMLElement | null) => void;
  nested?: boolean;
  nestedStyleProps?: NestedStyleProps;
  listeners?: SyntheticListenerMap;
  overlay?: boolean;
  mb?: number | string;
};

export const Filter = ({
  id,
  name,
  onRemove,
  onNameChange,
  setNodeRef,
  nested,
  nestedStyleProps,
  listeners,
  overlay,
  mb,
}: FilterProps) => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data, loading: isLoading } = useQuery<ChatAssignFilterQuery>(ChatAssignFilterDocument, {
    variables: { id },
    fetchPolicy: 'network-only',
    skip: !id || !onNameChange,
  });

  useEffect(() => {
    if (onNameChange && data && data.chatAssignFilter.name !== name) {
      onNameChange(data.chatAssignFilter.name);
    }
  }, [data, id, onNameChange, name]);

  const handleClick = () => {
    searchParams.set(RULE_FILTER_ACTION_KEY, `show_${id}`);
    setSearchParams(searchParams);
  };

  const borderColor = nestedStyleProps?.color || 'rgba(0, 0, 0, 0.23)';

  return (
    <Stack
      ref={setNodeRef}
      direction='row'
      pr={1}
      gap={1}
      alignItems='center'
      mb={mb || '12px'}
      sx={{ opacity: '1 !important' }}
      {...(nested && !overlay && { sx: nestedStyle({ ...nestedStyleProps }) })}
    >
      <Stack
        component={Button}
        direction='row'
        alignItems='center'
        gap='2px'
        p={1}
        border={`1px solid ${borderColor}`}
        borderRadius={1}
        bgcolor='#fff'
        color='inherit'
        justifyContent='flex-start'
        textAlign='left'
        flexGrow={1}
        sx={{
          ':hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' },
          overflowWrap: 'break-word',
          wordBreak: 'break-all',
          ...(overlay && {
            backgroundColor: 'rgba(255, 255, 255, 0.75)',
            filter: 'drop-shadow(0px 0px 4px rgba(0, 0, 0, 0.1))',
          }),
        }}
        {...((listeners || overlay) && {
          startIcon: <DragIndicator />,
        })}
        textTransform='initial'
        onClick={handleClick}
        disabled={!id || isLoading}
        {...listeners}
      >
        {isLoading && !name ? (
          <CircularProgress size='1rem' color='secondary' />
        ) : (
          data?.chatAssignFilter.name || name
        )}
      </Stack>
      {onRemove && !overlay && (
        <TooltipIconButton title={t('削除')} icon={<ClearIcon />} onClick={() => onRemove()} />
      )}
    </Stack>
  );
};
