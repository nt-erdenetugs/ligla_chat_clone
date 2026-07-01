import AddIcon from '@mui/icons-material/Add';
import { Button } from '@mui/material';
import { useSearchParams } from 'react-router';

import { type ChatAssignFilter } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { RULE_FILTER_ACTION_KEY, type DragData } from '~/modules/Rules';
import { FilterForm } from '~/modules/Rules/Filters';

export type AddFilterButtonProps = {
  groupKey: string;
  onAdd: (filter: Pick<DragData, 'id' | 'name'>, index?: number) => void;
};

export const AddFilterButton = ({ groupKey, onAdd }: AddFilterButtonProps) => {
  const { t_management } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const actionValue = `new_${groupKey}`;

  const handleClick = () => {
    searchParams.set(RULE_FILTER_ACTION_KEY, actionValue);
    setSearchParams(searchParams);
  };

  const handleClose = () => {
    searchParams.delete(RULE_FILTER_ACTION_KEY);
    setSearchParams(searchParams);
  };

  const handleSuccess = (data?: ChatAssignFilter) => {
    if (!data) return;
    onAdd({ id: data.id, name: data.name });
  };

  return (
    <>
      <Button
        size='small'
        startIcon={<AddIcon />}
        variant='outlined'
        onClick={handleClick}
        sx={{ backgroundColor: 'white' }}
      >
        {t_management('chatAssignRules.createFilter')}
      </Button>

      {searchParams.has(RULE_FILTER_ACTION_KEY, actionValue) && (
        <FilterForm onClose={handleClose} onSuccess={handleSuccess} />
      )}
    </>
  );
};
