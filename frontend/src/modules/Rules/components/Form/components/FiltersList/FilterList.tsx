import { useMemo, useRef, useState } from 'react';

import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  CircularProgress,
  Divider,
  FormHelperText,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SimpleBar from 'simplebar-react';

import { Label } from '~/common/components';
import { useTranslation } from '~/locales/hooks';
import { useSelectableFiltersActions, SortableFilter, FilterCategoriesMenu } from '~/modules/Rules';

export type GroupedFiltersResponse = {
  [key in string]: [string, string, string][];
};

export const FilterList = () => {
  const { t_management } = useTranslation();
  const [searchWord, setSearchWord] = useState<string>('');
  const [groups, setGroups] = useState<string[] | null>(null);
  const parentRef = useRef<HTMLDivElement | null>(null);

  const { filters, isFetchingAll: isLoading } = useSelectableFiltersActions();

  const data: GroupedFiltersResponse = useMemo(() => {
    return (filters || []).reduce((acc, filter) => {
      if (!acc[filter.targetTable]) {
        acc[filter.targetTable] = [];
      }
      acc[filter.targetTable].push([filter.name, filter.id, filter.name]);
      return acc;
    }, {} as GroupedFiltersResponse);
  }, [filters]);

  const groupKeys = useMemo(() => (data ? Object.keys(data) : []), [data]);

  const activeGroupKeys = useMemo(() => {
    return (
      data &&
      groupKeys.filter(
        (key) =>
          (groups ? groups.includes(key) : true) &&
          data[key].some(([title, _id]) => title.includes(searchWord)),
      )
    );
  }, [data, groupKeys, groups, searchWord]);

  const items = useMemo(
    () =>
      data &&
      activeGroupKeys
        ?.map((key) => [key, ...data[key].filter((v) => v[0].includes(searchWord))])
        .flat(),
    [data, activeGroupKeys, searchWord],
  );

  return (
    <Stack
      width='25%'
      maxWidth={320}
      gap={2}
      borderRight='1px solid rgba(0, 0, 0, 0.23)'
      height='100%'
      minWidth={240}
    >
      <Stack pr={2} gap={2}>
        <div>
          <Label text={t_management('chatAssignFilters.title')} />
          <Stack direction='row'>
            <TextField
              size='small'
              placeholder={t_management('chatAssignFilters.searchByFilter')}
              value={searchWord}
              onChange={(e) => setSearchWord(e.target.value)}
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position='start'>
                      <SearchIcon />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <FilterCategoriesMenu
              value={groups || groupKeys}
              options={groupKeys.map((key) => ({
                label: t_management(`chatAssignFilters.${key.toLowerCase()}`),
                value: key,
              }))}
              onChange={(value) => setGroups(value)}
            />
          </Stack>
        </div>
        <Divider />
      </Stack>
      <Box flexGrow={1} sx={{ height: '100%', overflow: 'hidden' }}>
        <SimpleBar
          forceVisible='y'
          style={{ height: '100%' }}
          classNames={{ contentEl: 'simplebar-content h-100' }}
          scrollableNodeProps={{ ref: parentRef }}
        >
          <Stack gap={1} position='relative' width='95%'>
            {isLoading ? (
              <CircularProgress size={24} sx={{ alignSelf: 'center' }} />
            ) : activeGroupKeys?.length ? (
              <Stack
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                }}
              >
                {items.map((item, index) => {
                  return (
                    item && (
                      <Stack
                        key={item[1]}
                        data-index={index}
                        justifyContent='flex-end'
                        width='100%'
                      >
                        {typeof item === 'string' ? (
                          <FormHelperText sx={{ fontWeight: 'bold' }}>
                            {t_management(`chatAssignFilters.${item.toLowerCase()}`)}
                          </FormHelperText>
                        ) : (
                          <SortableFilter
                            id={item[1]}
                            itemId={`filter-list-${item[1]}`}
                            name={item[0]}
                            mb='4px'
                          />
                        )}
                      </Stack>
                    )
                  );
                })}
              </Stack>
            ) : (
              <Typography variant='muted' textAlign='center' mx='auto' mt={1}>
                {t_management('chatAssignFilters.noFiltersFound')}
              </Typography>
            )}
          </Stack>
        </SimpleBar>
      </Box>
    </Stack>
  );
};
