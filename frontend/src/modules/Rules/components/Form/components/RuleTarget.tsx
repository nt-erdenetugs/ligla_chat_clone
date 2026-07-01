import { Box } from '@mui/material';
import { type Control, useController } from 'react-hook-form';

import { ChipsWrapper, MultipleAutocompleteControl, type OptionProps } from '~/common/components';
import { useTranslation } from '~/locales/hooks';
import { type Inputs } from '~/modules/Rules/configs';
import { uniqueKey } from '~/utils';

type RuleTargetProps = {
  control: Control<Inputs>;
  options: OptionProps<string>[];
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
};

export const RuleTarget = ({
  control,
  options,
  placeholder,
  disabled = false,
  readOnly = false,
}: RuleTargetProps) => {
  const { t_management } = useTranslation();

  const {
    field: { value: targetTeamIds = [] },
  } = useController({ control, name: 'targetTeamIds' });

  const targetTeams = options.filter((option) =>
    targetTeamIds.includes((option as [string, string])[1] ?? ''),
  ) as [string, string][];

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 5,
      }}
    >
      {readOnly ? (
        <ChipsWrapper
          title={t_management('teams.title')}
          key={uniqueKey()}
          items={targetTeams}
          getChipLabel={(team) => team?.[0]}
          stackProps={{ flexWrap: 'wrap', maxWidth: 550 }}
        />
      ) : (
        <MultipleAutocompleteControl
          label={t_management('teams.selectTeams')}
          name='targetTeamIds'
          control={control}
          options={options}
          disabled={disabled}
          checkBox
          size='small'
          sx={{ flex: 1 }}
          placeholder={placeholder}
          required
        />
      )}
    </Box>
  );
};
